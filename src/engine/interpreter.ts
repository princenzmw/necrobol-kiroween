import { parseCobolSource } from './parser';
import type {
  CobolProgram,
  CobolStatement,
  ConditionNode,
  DataItem,
  ExecutionResult,
  ExecutionStep,
  ExprNode,
  PicSpec,
  VariableSnapshot,
} from './types';

const MAX_STEPS = 2000;

export function applyPicConstraint(
  raw: string | number,
  pic: PicSpec,
): { value: string | number; truncated: boolean } {
  if (pic.kind === 'alphanumeric') {
    const str = String(raw);
    const truncated = str.length > pic.maxLength;
    return {
      value: str.slice(0, pic.maxLength),
      truncated,
    };
  }

  let num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) num = 0;

  let truncated = false;
  if (!pic.signed && num < 0) {
    num = Math.abs(num);
    truncated = true;
  }

  const rounded = Number(num.toFixed(pic.decDigits));
  const modulus = 10 ** pic.intDigits;
  if (Math.abs(rounded) >= modulus) {
    truncated = true;
    const sign = rounded < 0 ? -1 : 1;
    const abs = Math.abs(rounded);
    const intPart = Math.trunc(abs) % modulus;
    const decPart = Number((abs - Math.trunc(abs)).toFixed(pic.decDigits));
    return {
      value: sign * Number((intPart + decPart).toFixed(pic.decDigits)),
      truncated,
    };
  }

  return { value: rounded, truncated };
}

export function formatPicValue(value: string | number, pic: PicSpec): string {
  if (pic.kind === 'alphanumeric') {
    return String(value);
  }
  const num = typeof value === 'number' ? value : Number(value) || 0;
  const neg = num < 0;
  const abs = Math.abs(num);
  if (pic.decDigits > 0) {
    const fixed = abs.toFixed(pic.decDigits);
    const [whole, frac] = fixed.split('.');
    return `${neg ? '-' : ''}${whole.padStart(pic.intDigits, '0')}.${frac}`;
  }
  return `${neg ? '-' : ''}${Math.trunc(abs).toString().padStart(pic.intDigits, '0')}`;
}

interface RuntimeContext {
  program: CobolProgram;
  dataMap: Map<string, DataItem>;
  vars: Record<string, string | number>;
  truncFlags: Record<string, boolean>;
  alterRedirects: Map<string, string>;
  output: string[];
  warnings: string[];
  steps: ExecutionStep[];
  halted: boolean;
  haltedReason: ExecutionResult['haltedReason'];
  gotoTarget: string | null;
}

function evalExpr(expr: ExprNode, vars: Record<string, string | number>): string | number {
  switch (expr.kind) {
    case 'number':
      return expr.value;
    case 'string':
      return expr.value;
    case 'identifier':
      return vars[expr.name] ?? 0;
    case 'unary':
      return -(Number(evalExpr(expr.expr, vars)) || 0);
    case 'binary': {
      const l = Number(evalExpr(expr.left, vars)) || 0;
      const r = Number(evalExpr(expr.right, vars)) || 0;
      switch (expr.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return r === 0 ? 0 : l / r;
        case '**':
          return l ** r;
      }
    }
  }
}

function evalCondition(cond: ConditionNode, vars: Record<string, string | number>): boolean {
  if (cond.kind === 'logic') {
    const l = evalCondition(cond.left, vars);
    return cond.op === 'AND' ? l && evalCondition(cond.right, vars) : l || evalCondition(cond.right, vars);
  }
  const lRaw = evalExpr(cond.left, vars);
  const rRaw = evalExpr(cond.right, vars);
  const bothNum = typeof lRaw === 'number' || typeof rRaw === 'number';
  const l = bothNum ? Number(lRaw) || 0 : String(lRaw);
  const r = bothNum ? Number(rRaw) || 0 : String(rRaw);

  switch (cond.op) {
    case '=':
      return l === r;
    case '!=':
      return l !== r;
    case '>':
      return l > r;
    case '<':
      return l < r;
    case '>=':
      return l >= r;
    case '<=':
      return l <= r;
  }
}

function assignVar(
  ctx: RuntimeContext,
  targetName: string,
  nextRaw: string | number,
  changedKeys: string[],
  line: number,
  guardSizeError: boolean,
): boolean {
  const item = ctx.dataMap.get(targetName);
  if (!item) {
    ctx.vars[targetName] = nextRaw;
    changedKeys.push(targetName);
    return false;
  }
  const { value, truncated } = applyPicConstraint(nextRaw, item.pic);
  if (truncated && guardSizeError) {
    ctx.warnings.push(`Line ${line}: SIZE ERROR caught on ${targetName} (PIC ${item.pic.raw}).`);
    return true;
  }
  if (truncated) {
    ctx.truncFlags[targetName] = true;
    ctx.warnings.push(
      `Line ${line}: Silent PIC truncation/wrap on ${targetName} (PIC ${item.pic.raw}) stored ${String(value)}.`,
    );
  }
  ctx.vars[targetName] = value;
  changedKeys.push(targetName);
  return false;
}

function recordStep(
  ctx: RuntimeContext,
  line: number,
  paragraph: string,
  statementText: string,
  changedKeys: string[],
): void {
  if (ctx.steps.length >= MAX_STEPS) {
    ctx.halted = true;
    ctx.haltedReason = 'MAX_STEPS';
    return;
  }
  ctx.steps.push({
    step: ctx.steps.length + 1,
    line,
    paragraph,
    statementText,
    changedKeys: [...changedKeys],
    outputSnapshot: [...ctx.output],
    variables: { ...ctx.vars },
    warnings: [...ctx.warnings],
  });
}

function runStatementList(ctx: RuntimeContext, paraName: string, stmts: CobolStatement[]): void {
  for (const stmt of stmts) {
    if (ctx.halted || ctx.gotoTarget) return;
    if (ctx.steps.length >= MAX_STEPS) {
      ctx.halted = true;
      ctx.haltedReason = 'MAX_STEPS';
      return;
    }

    const changedKeys: string[] = [];

    switch (stmt.kind) {
      case 'DISPLAY': {
        const rendered = stmt.args
          .map((arg) => {
            if (arg.kind === 'identifier') {
              const item = ctx.dataMap.get(arg.name);
              const val = ctx.vars[arg.name] ?? '';
              return item ? formatPicValue(val, item.pic) : String(val);
            }
            return String(evalExpr(arg, ctx.vars));
          })
          .join('');
        ctx.output.push(rendered);
        recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
        break;
      }

      case 'MOVE': {
        const val = evalExpr(stmt.source, ctx.vars);
        assignVar(ctx, stmt.target, val, changedKeys, stmt.line, false);
        recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
        break;
      }

      case 'ARITH': {
        const vals = stmt.operands.map((o) => Number(evalExpr(o, ctx.vars)) || 0);
        const curTarget = Number(ctx.vars[stmt.target] ?? 0) || 0;
        let nextVal = curTarget;

        if (stmt.givingTarget) {
          if (stmt.verb === 'ADD') nextVal = vals.reduce((a, b) => a + b, 0);
          else if (stmt.verb === 'SUBTRACT') nextVal = (vals[1] ?? 0) - (vals[0] ?? 0);
          else if (stmt.verb === 'MULTIPLY') nextVal = vals.reduce((a, b) => a * b, 1);
          else if (stmt.verb === 'DIVIDE') {
            nextVal = (vals[1] ?? 0) === 0 ? 0 : (vals[0] ?? 0) / (vals[1] ?? 1);
          }
          const dest = stmt.givingTarget;
          const sizeErr = assignVar(
            ctx,
            dest,
            nextVal,
            changedKeys,
            stmt.line,
            stmt.onSizeError.length > 0,
          );
          recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
          if (sizeErr) runStatementList(ctx, paraName, stmt.onSizeError);
        } else {
          const sumOps = vals.reduce((a, b) => a + b, 0);
          if (stmt.verb === 'ADD') nextVal = curTarget + sumOps;
          else if (stmt.verb === 'SUBTRACT') nextVal = curTarget - sumOps;
          else if (stmt.verb === 'MULTIPLY') nextVal = curTarget * vals.reduce((a, b) => a * b, 1);
          else if (stmt.verb === 'DIVIDE') {
            const divisor = vals[0] ?? 1;
            if (divisor === 0 && stmt.onSizeError.length > 0) {
              recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
              runStatementList(ctx, paraName, stmt.onSizeError);
              break;
            }
            nextVal = divisor === 0 ? curTarget : curTarget / divisor;
          }
          const sizeErr = assignVar(
            ctx,
            stmt.target,
            nextVal,
            changedKeys,
            stmt.line,
            stmt.onSizeError.length > 0,
          );
          recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
          if (sizeErr) runStatementList(ctx, paraName, stmt.onSizeError);
        }
        break;
      }

      case 'COMPUTE': {
        const val = Number(evalExpr(stmt.expr, ctx.vars)) || 0;
        const sizeErr = assignVar(
          ctx,
          stmt.target,
          val,
          changedKeys,
          stmt.line,
          stmt.onSizeError.length > 0,
        );
        recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
        if (sizeErr) {
          runStatementList(ctx, paraName, stmt.onSizeError);
        }
        break;
      }

      case 'IF': {
        const ok = evalCondition(stmt.condition, ctx.vars);
        recordStep(ctx, stmt.line, paraName, `${stmt.text} [${ok ? 'TRUE' : 'FALSE'}]`, changedKeys);
        runStatementList(ctx, paraName, ok ? stmt.thenBranch : stmt.elseBranch);
        break;
      }

      case 'PERFORM': {
        const targetPara = ctx.program.paragraphs.find((p) => p.name === stmt.paragraph);
        if (!targetPara) {
          ctx.warnings.push(`Line ${stmt.line}: Missing PERFORM target ${stmt.paragraph}.`);
          recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
          break;
        }
        if (stmt.times) {
          const count = Math.max(0, Math.min(500, Math.trunc(Number(evalExpr(stmt.times, ctx.vars)) || 0)));
          recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
          for (let i = 0; i < count; i += 1) {
            if (ctx.halted || ctx.gotoTarget) break;
            runStatementList(ctx, targetPara.name, targetPara.statements);
          }
        } else if (stmt.until) {
          recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
          while (!evalCondition(stmt.until, ctx.vars)) {
            if (ctx.halted || ctx.gotoTarget || ctx.steps.length >= MAX_STEPS) break;
            runStatementList(ctx, targetPara.name, targetPara.statements);
          }
        } else {
          recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
          runStatementList(ctx, targetPara.name, targetPara.statements);
        }
        break;
      }

      case 'GOTO': {
        const redirected = ctx.alterRedirects.get(paraName) ?? stmt.paragraph;
        recordStep(ctx, stmt.line, paraName, `GO TO ${redirected}`, changedKeys);
        ctx.gotoTarget = redirected;
        return;
      }

      case 'ALTER': {
        ctx.alterRedirects.set(stmt.sourceParagraph, stmt.targetParagraph);
        ctx.warnings.push(
          `Line ${stmt.line}: Self-modifying ALTER redirected ${stmt.sourceParagraph} -> ${stmt.targetParagraph}.`,
        );
        recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
        break;
      }

      case 'EXIT': {
        recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
        return;
      }

      case 'STOP_RUN': {
        recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
        ctx.halted = true;
        ctx.haltedReason = 'STOP_RUN';
        return;
      }
    }
  }
}

export function executeCobolProgram(program: CobolProgram): ExecutionResult {
  const dataMap = new Map<string, DataItem>();
  const vars: Record<string, string | number> = {};
  const truncFlags: Record<string, boolean> = {};

  for (const item of program.dataItems) {
    dataMap.set(item.name, item);
    const { value, truncated } = applyPicConstraint(item.initialValue, item.pic);
    vars[item.name] = value;
    truncFlags[item.name] = truncated;
  }

  const ctx: RuntimeContext = {
    program,
    dataMap,
    vars,
    truncFlags,
    alterRedirects: new Map(),
    output: [],
    warnings: [],
    steps: [],
    halted: false,
    haltedReason: 'END_OF_PROGRAM',
    gotoTarget: null,
  };

  if (program.parseErrors.length > 0 && program.paragraphs.length === 0) {
    return {
      programId: program.programId,
      haltedReason: 'PARSE_ERROR',
      output: [],
      steps: [],
      finalVariables: [],
      warnings: [],
      parseErrors: program.parseErrors,
    };
  }

  let idx = 0;
  while (idx < program.paragraphs.length && !ctx.halted) {
    if (ctx.steps.length >= MAX_STEPS) {
      ctx.halted = true;
      ctx.haltedReason = 'MAX_STEPS';
      break;
    }
    const para = program.paragraphs[idx];
    ctx.gotoTarget = null;
    runStatementList(ctx, para.name, para.statements);

    if (ctx.gotoTarget) {
      const targetIdx = program.paragraphs.findIndex((p) => p.name === ctx.gotoTarget);
      if (targetIdx >= 0) {
        idx = targetIdx;
        continue;
      }
      ctx.warnings.push(`Missing GO TO target paragraph "${ctx.gotoTarget}".`);
      break;
    }
    idx += 1;
  }

  const finalVariables: VariableSnapshot[] = program.dataItems.map((item) => {
    const val = ctx.vars[item.name] ?? item.initialValue;
    return {
      name: item.name,
      pic: item.pic.raw,
      value: val,
      formatted: formatPicValue(val, item.pic),
      truncated: Boolean(ctx.truncFlags[item.name]),
    };
  });

  return {
    programId: program.programId,
    haltedReason: ctx.haltedReason,
    output: ctx.output,
    steps: ctx.steps,
    finalVariables,
    warnings: ctx.warnings,
    parseErrors: program.parseErrors,
  };
}

export function executeCobolSource(source: string): ExecutionResult {
  const program = parseCobolSource(source);
  return executeCobolProgram(program);
}
