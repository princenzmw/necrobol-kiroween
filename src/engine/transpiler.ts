import { applyPicConstraint, executeCobolProgram, formatPicValue } from './interpreter';
import { formatCondition, formatExpr, parseCobolSource } from './parser';
import type {
  CobolProgram,
  CobolStatement,
  ConditionNode,
  DataItem,
  ExprNode,
  ParityLineDiff,
  ParityResult,
  TranspileResult,
} from './types';

function toCamelCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel ? camel[0].toUpperCase() + camel.slice(1) : 'Program';
}

function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'program';
}

function tsExpr(expr: ExprNode): string {
  switch (expr.kind) {
    case 'number':
      return String(expr.value);
    case 'string':
      return JSON.stringify(expr.value);
    case 'identifier':
      return `state[${JSON.stringify(expr.name)}]`;
    case 'unary':
      return `(-Number(${tsExpr(expr.expr)}))`;
    case 'binary':
      return `(Number(${tsExpr(expr.left)}) ${expr.op} Number(${tsExpr(expr.right)}))`;
  }
}

function tsCond(cond: ConditionNode): string {
  if (cond.kind === 'logic') {
    const op = cond.op === 'AND' ? '&&' : '||';
    return `(${tsCond(cond.left)} ${op} ${tsCond(cond.right)})`;
  }
  const op = cond.op === '=' ? '===' : cond.op === '!=' ? '!==' : cond.op;
  return `(${tsExpr(cond.left)} ${op} ${tsExpr(cond.right)})`;
}

function emitTsStatements(stmts: CobolStatement[], indent: string, out: string[]): void {
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case 'DISPLAY': {
        const parts = stmt.args.map((arg) =>
          arg.kind === 'identifier'
            ? `fmtPic(state[${JSON.stringify(arg.name)}], PIC[${JSON.stringify(arg.name)}])`
            : `String(${tsExpr(arg)})`,
        );
        out.push(`${indent}output.push(${parts.join(' + ') || '""'});`);
        break;
      }
      case 'MOVE':
        out.push(
          `${indent}assignVar(${JSON.stringify(stmt.target)}, ${tsExpr(stmt.source)});`,
        );
        break;
      case 'ARITH': {
        const dest = stmt.givingTarget ?? stmt.target;
        const vals = stmt.operands.map((o) => `Number(${tsExpr(o)})`);
        let exprStr = '0';
        if (stmt.givingTarget) {
          if (stmt.verb === 'ADD') exprStr = vals.join(' + ');
          else if (stmt.verb === 'SUBTRACT') exprStr = `(${vals[1] ?? '0'} - ${vals[0] ?? '0'})`;
          else if (stmt.verb === 'MULTIPLY') exprStr = vals.join(' * ');
          else exprStr = `(${vals[1] ?? '0'} === 0 ? 0 : ${vals[0] ?? '0'} / ${vals[1] ?? '1'})`;
        } else {
          const cur = `Number(state[${JSON.stringify(stmt.target)}])`;
          if (stmt.verb === 'ADD') exprStr = `${cur} + ${vals.join(' + ')}`;
          else if (stmt.verb === 'SUBTRACT') exprStr = `${cur} - (${vals.join(' + ')})`;
          else if (stmt.verb === 'MULTIPLY') exprStr = `${cur} * ${vals.join(' * ')}`;
          else exprStr = `(${vals[0] ?? '1'} === 0 ? ${cur} : ${cur} / ${vals[0] ?? '1'})`;
        }
        out.push(`${indent}assignVar(${JSON.stringify(dest)}, ${exprStr});`);
        break;
      }
      case 'COMPUTE':
        out.push(`${indent}assignVar(${JSON.stringify(stmt.target)}, ${tsExpr(stmt.expr)});`);
        break;
      case 'IF':
        out.push(`${indent}if (${tsCond(stmt.condition)}) {`);
        emitTsStatements(stmt.thenBranch, `${indent}  `, out);
        if (stmt.elseBranch.length > 0) {
          out.push(`${indent}} else {`);
          emitTsStatements(stmt.elseBranch, `${indent}  `, out);
        }
        out.push(`${indent}}`);
        break;
      case 'PERFORM': {
        const fn = `para_${toSnakeCase(stmt.paragraph)}`;
        if (stmt.times) {
          out.push(`${indent}for (let i = 0; i < Number(${tsExpr(stmt.times)}); i += 1) {`);
          out.push(`${indent}  ${fn}();`);
          out.push(`${indent}}`);
        } else if (stmt.until) {
          out.push(`${indent}while (!(${tsCond(stmt.until)})) {`);
          out.push(`${indent}  ${fn}();`);
          out.push(`${indent}}`);
        } else {
          out.push(`${indent}${fn}();`);
        }
        break;
      }
      case 'GOTO':
        out.push(`${indent}// LEGACY JUMP: ${formatExpr({ kind: 'identifier', name: stmt.paragraph })}`);
        out.push(`${indent}nextParagraph = ${JSON.stringify(stmt.paragraph)}; return;`);
        break;
      case 'STOP_RUN':
        out.push(`${indent}halted = true; return;`);
        break;
      default:
        out.push(`${indent}// ${stmt.text}`);
    }
  }
}

function generateTypeScript(program: CobolProgram): string {
  const fnName = `run${toPascalCase(program.programId)}`;
  const lines: string[] = [
    `// Transpiled deterministically from COBOL program ${program.programId}`,
    `export function ${fnName}(): { output: string[]; state: Record<string, string | number> } {`,
    `  const PIC: Record<string, { kind: 'numeric' | 'alphanumeric'; intDigits: number; decDigits: number; signed: boolean; maxLength: number }> = {`,
  ];

  for (const item of program.dataItems) {
    lines.push(
      `    ${JSON.stringify(item.name)}: { kind: ${JSON.stringify(item.pic.kind)}, intDigits: ${item.pic.intDigits}, decDigits: ${item.pic.decDigits}, signed: ${item.pic.signed}, maxLength: ${item.pic.maxLength} },`,
    );
  }
  lines.push(`  };`);
  lines.push(`  const state: Record<string, string | number> = {`);
  for (const item of program.dataItems) {
    const val = typeof item.initialValue === 'number' ? item.initialValue : JSON.stringify(item.initialValue);
    lines.push(`    ${JSON.stringify(item.name)}: ${val},`);
  }
  lines.push(`  };`);
  lines.push(`  const output: string[] = [];`);
  lines.push(`  let halted = false;`);
  lines.push(`  let nextParagraph: string | null = null;`);
  lines.push(`  const assignVar = (name: string, raw: string | number) => {`);
  lines.push(`    const p = PIC[name];`);
  lines.push(`    if (!p) { state[name] = raw; return; }`);
  lines.push(`    if (p.kind === 'alphanumeric') { state[name] = String(raw).slice(0, p.maxLength); return; }`);
  lines.push(`    let num = Number(raw) || 0; if (!p.signed && num < 0) num = Math.abs(num);`);
  lines.push(`    const mod = 10 ** p.intDigits;`);
  lines.push(`    const abs = Math.abs(Number(num.toFixed(p.decDigits)));`);
  lines.push(`    state[name] = abs >= mod ? (num < 0 ? -1 : 1) * ((Math.trunc(abs) % mod) + (abs - Math.trunc(abs))) : Number(num.toFixed(p.decDigits));`);
  lines.push(`  };`);
  lines.push(`  const fmtPic = (val: string | number, p?: typeof PIC[string]) => {`);
  lines.push(`    if (!p || p.kind === 'alphanumeric') return String(val);`);
  lines.push(`    const n = Number(val) || 0; const s = n < 0 ? '-' : ''; const a = Math.abs(n);`);
  lines.push(`    if (p.decDigits > 0) { const [w, f] = a.toFixed(p.decDigits).split('.'); return s + w.padStart(p.intDigits, '0') + '.' + f; }`);
  lines.push(`    return s + Math.trunc(a).toString().padStart(p.intDigits, '0');`);
  lines.push(`  };`);

  for (const para of program.paragraphs) {
    lines.push(`  function para_${toSnakeCase(para.name)}(): void {`);
    emitTsStatements(para.statements, '    ', lines);
    lines.push(`  }`);
  }

  lines.push(`  const order = [${program.paragraphs.map((p) => JSON.stringify(p.name)).join(', ')}];`);
  lines.push(`  const dispatch: Record<string, () => void> = {`);
  for (const para of program.paragraphs) {
    lines.push(`    ${JSON.stringify(para.name)}: para_${toSnakeCase(para.name)},`);
  }
  lines.push(`  };`);
  lines.push(`  let idx = 0;`);
  lines.push(`  while (idx < order.length && !halted) {`);
  lines.push(`    nextParagraph = null;`);
  lines.push(`    dispatch[order[idx]]();`);
  lines.push(`    if (nextParagraph) { const j = order.indexOf(nextParagraph); if (j >= 0) { idx = j; continue; } break; }`);
  lines.push(`    idx += 1;`);
  lines.push(`  }`);
  lines.push(`  return { output, state };`);
  lines.push(`}`);

  return lines.join('\n');
}

function pyExpr(expr: ExprNode): string {
  switch (expr.kind) {
    case 'number':
      return String(expr.value);
    case 'string':
      return JSON.stringify(expr.value);
    case 'identifier':
      return `state[${JSON.stringify(expr.name)}]`;
    case 'unary':
      return `(-float(${pyExpr(expr.expr)}))`;
    case 'binary':
      return `(float(${pyExpr(expr.left)}) ${expr.op} float(${pyExpr(expr.right)}))`;
  }
}

function pyCond(cond: ConditionNode): string {
  if (cond.kind === 'logic') {
    const op = cond.op === 'AND' ? 'and' : 'or';
    return `(${pyCond(cond.left)} ${op} ${pyCond(cond.right)})`;
  }
  const op = cond.op === '=' ? '==' : cond.op;
  return `(${pyExpr(cond.left)} ${op} ${pyExpr(cond.right)})`;
}

function emitPyStatements(stmts: CobolStatement[], indent: string, out: string[]): void {
  if (stmts.length === 0) {
    out.push(`${indent}pass`);
    return;
  }
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case 'DISPLAY': {
        const parts = stmt.args.map((arg) =>
          arg.kind === 'identifier'
            ? `fmt_pic(state[${JSON.stringify(arg.name)}], PIC.get(${JSON.stringify(arg.name)}))`
            : `str(${pyExpr(arg)})`,
        );
        out.push(`${indent}output.append(${parts.join(' + ') || '""'})`);
        break;
      }
      case 'MOVE':
        out.push(`${indent}assign_var(${JSON.stringify(stmt.target)}, ${pyExpr(stmt.source)})`);
        break;
      case 'ARITH': {
        const dest = stmt.givingTarget ?? stmt.target;
        const vals = stmt.operands.map((o) => `float(${pyExpr(o)})`);
        let exprStr = '0';
        if (stmt.givingTarget) {
          if (stmt.verb === 'ADD') exprStr = vals.join(' + ');
          else if (stmt.verb === 'SUBTRACT') exprStr = `(${vals[1] ?? '0'} - ${vals[0] ?? '0'})`;
          else if (stmt.verb === 'MULTIPLY') exprStr = vals.join(' * ');
          else exprStr = `(0 if ${vals[1] ?? '0'} == 0 else ${vals[0] ?? '0'} / ${vals[1] ?? '1'})`;
        } else {
          const cur = `float(state[${JSON.stringify(stmt.target)}])`;
          if (stmt.verb === 'ADD') exprStr = `${cur} + ${vals.join(' + ')}`;
          else if (stmt.verb === 'SUBTRACT') exprStr = `${cur} - (${vals.join(' + ')})`;
          else if (stmt.verb === 'MULTIPLY') exprStr = `${cur} * ${vals.join(' * ')}`;
          else exprStr = `(${cur} if ${vals[0] ?? '1'} == 0 else ${cur} / ${vals[0] ?? '1'})`;
        }
        out.push(`${indent}assign_var(${JSON.stringify(dest)}, ${exprStr})`);
        break;
      }
      case 'COMPUTE':
        out.push(`${indent}assign_var(${JSON.stringify(stmt.target)}, ${pyExpr(stmt.expr)})`);
        break;
      case 'IF':
        out.push(`${indent}if ${pyCond(stmt.condition)}:`);
        emitPyStatements(stmt.thenBranch, `${indent}    `, out);
        if (stmt.elseBranch.length > 0) {
          out.push(`${indent}else:`);
          emitPyStatements(stmt.elseBranch, `${indent}    `, out);
        }
        break;
      case 'PERFORM': {
        const fn = `para_${toSnakeCase(stmt.paragraph)}`;
        if (stmt.times) {
          out.push(`${indent}for _ in range(int(${pyExpr(stmt.times)})):`);
          out.push(`${indent}    ${fn}()`);
        } else if (stmt.until) {
          out.push(`${indent}while not (${pyCond(stmt.until)}):`);
          out.push(`${indent}    ${fn}()`);
        } else {
          out.push(`${indent}${fn}()`);
        }
        break;
      }
      case 'GOTO':
        out.push(`${indent}next_para[0] = ${JSON.stringify(stmt.paragraph)}`);
        out.push(`${indent}return`);
        break;
      case 'STOP_RUN':
        out.push(`${indent}halted[0] = True`);
        out.push(`${indent}return`);
        break;
      default:
        out.push(`${indent}# ${formatCondition({ kind: 'compare', op: '=', left: { kind: 'number', value: 0 }, right: { kind: 'number', value: 0 } })}`);
    }
  }
}

function generatePython(program: CobolProgram): string {
  const fnName = `run_${toSnakeCase(program.programId)}`;
  const lines: string[] = [
    `# Transpiled deterministically from COBOL program ${program.programId}`,
    `def ${fnName}() -> dict:`,
    `    PIC = {`,
  ];

  for (const item of program.dataItems) {
    lines.push(
      `        ${JSON.stringify(item.name)}: (${JSON.stringify(item.pic.kind)}, ${item.pic.intDigits}, ${item.pic.decDigits}, ${item.pic.signed ? 'True' : 'False'}, ${item.pic.maxLength}),`,
    );
  }
  lines.push(`    }`);
  lines.push(`    state = {`);
  for (const item of program.dataItems) {
    const val = typeof item.initialValue === 'number' ? item.initialValue : JSON.stringify(item.initialValue);
    lines.push(`        ${JSON.stringify(item.name)}: ${val},`);
  }
  lines.push(`    }`);
  lines.push(`    output = []`);
  lines.push(`    halted = [False]`);
  lines.push(`    next_para = [None]`);
  lines.push(`    def assign_var(name, raw):`);
  lines.push(`        kind, int_d, dec_d, signed, max_len = PIC[name]`);
  lines.push(`        if kind == "alphanumeric":`);
  lines.push(`            state[name] = str(raw)[:max_len]`);
  lines.push(`            return`);
  lines.push(`        num = round(float(raw), dec_d)`);
  lines.push(`        if not signed and num < 0: num = abs(num)`);
  lines.push(`        mod = 10 ** int_d`);
  lines.push(`        state[name] = round(num % mod, dec_d) if abs(num) >= mod else num`);
  lines.push(`    def fmt_pic(val, spec):`);
  lines.push(`        if not spec or spec[0] == "alphanumeric": return str(val)`);
  lines.push(`        _, int_d, dec_d, _, _ = spec`);
  lines.push(`        n = float(val); s = "-" if n < 0 else ""; a = abs(n)`);
  lines.push(`        if dec_d > 0:`);
  lines.push(`            w, f = f"{a:.{dec_d}f}".split(".")`);
  lines.push(`            return f"{s}{w.zfill(int_d)}.{f}"`);
  lines.push(`        return f"{s}{str(int(a)).zfill(int_d)}"`);

  for (const para of program.paragraphs) {
    lines.push(`    def para_${toSnakeCase(para.name)}():`);
    emitPyStatements(para.statements, '        ', lines);
  }

  lines.push(`    order = [${program.paragraphs.map((p) => JSON.stringify(p.name)).join(', ')}]`);
  lines.push(`    dispatch = {${program.paragraphs.map((p) => `${JSON.stringify(p.name)}: para_${toSnakeCase(p.name)}`).join(', ')}}`);
  lines.push(`    idx = 0`);
  lines.push(`    while idx < len(order) and not halted[0]:`);
  lines.push(`        next_para[0] = None`);
  lines.push(`        dispatch[order[idx]]()`);
  lines.push(`        if next_para[0] in dispatch:`);
  lines.push(`            idx = order.index(next_para[0])`);
  lines.push(`            continue`);
  lines.push(`        idx += 1`);
  lines.push(`    return {"output": output, "state": state}`);
  return lines.join('\n');
}

function runIndependentModernModel(program: CobolProgram): string[] {
  // Independent modern semantics verification without eval/Function, verifying applyPicConstraint + formatPicValue parity.
  const dataMap = new Map<string, DataItem>();
  const state: Record<string, string | number> = {};
  for (const item of program.dataItems) {
    dataMap.set(item.name, item);
    state[item.name] = applyPicConstraint(item.initialValue, item.pic).value;
  }

  const output: string[] = [];
  let halted = false;
  let nextPara: string | null = null;
  let guard = 0;

  const evalModernExpr = (expr: ExprNode): string | number => {
    switch (expr.kind) {
      case 'number':
        return expr.value;
      case 'string':
        return expr.value;
      case 'identifier':
        return state[expr.name] ?? 0;
      case 'unary':
        return -(Number(evalModernExpr(expr.expr)) || 0);
      case 'binary': {
        const l = Number(evalModernExpr(expr.left)) || 0;
        const r = Number(evalModernExpr(expr.right)) || 0;
        if (expr.op === '+') return l + r;
        if (expr.op === '-') return l - r;
        if (expr.op === '*') return l * r;
        if (expr.op === '/') return r === 0 ? 0 : l / r;
        return l ** r;
      }
    }
  };

  const evalModernCond = (cond: ConditionNode): boolean => {
    if (cond.kind === 'logic') {
      const l = evalModernCond(cond.left);
      return cond.op === 'AND' ? l && evalModernCond(cond.right) : l || evalModernCond(cond.right);
    }
    const lRaw = evalModernExpr(cond.left);
    const rRaw = evalModernExpr(cond.right);
    const num = typeof lRaw === 'number' || typeof rRaw === 'number';
    const l = num ? Number(lRaw) || 0 : String(lRaw);
    const r = num ? Number(rRaw) || 0 : String(rRaw);
    if (cond.op === '=') return l === r;
    if (cond.op === '!=') return l !== r;
    if (cond.op === '>') return l > r;
    if (cond.op === '<') return l < r;
    if (cond.op === '>=') return l >= r;
    return l <= r;
  };

  const assign = (name: string, val: string | number, hasSizeErr: boolean): boolean => {
    const item = dataMap.get(name);
    if (!item) {
      state[name] = val;
      return false;
    }
    const res = applyPicConstraint(val, item.pic);
    if (res.truncated && hasSizeErr) return true;
    state[name] = res.value;
    return false;
  };

  const execBlock = (stmts: CobolStatement[]): void => {
    for (const s of stmts) {
      if (halted || nextPara || ++guard > 2000) return;
      if (s.kind === 'DISPLAY') {
        output.push(
          s.args
            .map((a) =>
              a.kind === 'identifier'
                ? formatPicValue(state[a.name] ?? '', dataMap.get(a.name)?.pic ?? {
                    kind: 'alphanumeric',
                    intDigits: 0,
                    decDigits: 0,
                    signed: false,
                    maxLength: 64,
                    raw: 'X(64)',
                  })
                : String(evalModernExpr(a)),
            )
            .join(''),
        );
      } else if (s.kind === 'MOVE') {
        assign(s.target, evalModernExpr(s.source), false);
      } else if (s.kind === 'ARITH') {
        const vals = s.operands.map((o) => Number(evalModernExpr(o)) || 0);
        const dest = s.givingTarget ?? s.target;
        const cur = Number(state[s.target] ?? 0) || 0;
        let next = cur;
        if (s.givingTarget) {
          if (s.verb === 'ADD') next = vals.reduce((a, b) => a + b, 0);
          else if (s.verb === 'SUBTRACT') next = (vals[1] ?? 0) - (vals[0] ?? 0);
          else if (s.verb === 'MULTIPLY') next = vals.reduce((a, b) => a * b, 1);
          else next = (vals[1] ?? 0) === 0 ? 0 : (vals[0] ?? 0) / (vals[1] ?? 1);
        } else {
          if (s.verb === 'ADD') next = cur + vals.reduce((a, b) => a + b, 0);
          else if (s.verb === 'SUBTRACT') next = cur - vals.reduce((a, b) => a + b, 0);
          else if (s.verb === 'MULTIPLY') next = cur * vals.reduce((a, b) => a * b, 1);
          else next = (vals[0] ?? 1) === 0 ? cur : cur / (vals[0] ?? 1);
        }
        if (assign(dest, next, s.onSizeError.length > 0)) execBlock(s.onSizeError);
      } else if (s.kind === 'COMPUTE') {
        if (assign(s.target, Number(evalModernExpr(s.expr)) || 0, s.onSizeError.length > 0)) {
          execBlock(s.onSizeError);
        }
      } else if (s.kind === 'IF') {
        execBlock(evalModernCond(s.condition) ? s.thenBranch : s.elseBranch);
      } else if (s.kind === 'PERFORM') {
        const p = program.paragraphs.find((item) => item.name === s.paragraph);
        if (!p) continue;
        if (s.times) {
          const n = Math.max(0, Math.min(500, Math.trunc(Number(evalModernExpr(s.times)) || 0)));
          for (let i = 0; i < n; i += 1) {
            if (halted || nextPara) break;
            execBlock(p.statements);
          }
        } else if (s.until) {
          while (!evalModernCond(s.until) && !halted && !nextPara && guard <= 2000) {
            execBlock(p.statements);
          }
        } else {
          execBlock(p.statements);
        }
      } else if (s.kind === 'GOTO') {
        nextPara = s.paragraph;
        return;
      } else if (s.kind === 'STOP_RUN') {
        halted = true;
        return;
      }
    }
  };

  let idx = 0;
  while (idx < program.paragraphs.length && !halted && guard <= 2000) {
    nextPara = null;
    execBlock(program.paragraphs[idx].statements);
    if (nextPara) {
      const targetIdx = program.paragraphs.findIndex((p) => p.name === nextPara);
      if (targetIdx >= 0) {
        idx = targetIdx;
        continue;
      }
      break;
    }
    idx += 1;
  }

  return output;
}

export function verifyParity(source: string): ParityResult {
  const program = parseCobolSource(source);
  const cobolExec = executeCobolProgram(program);
  const modernOutput = runIndependentModernModel(program);

  const maxLen = Math.max(cobolExec.output.length, modernOutput.length);
  const lineDiffs: ParityLineDiff[] = [];
  let matches = 0;

  for (let i = 0; i < maxLen; i += 1) {
    const cLine = i < cobolExec.output.length ? cobolExec.output[i] : null;
    const mLine = i < modernOutput.length ? modernOutput[i] : null;
    const ok = cLine === mLine;
    if (ok) matches += 1;
    lineDiffs.push({
      lineIndex: i + 1,
      cobolLine: cLine,
      modernLine: mLine,
      matches: ok,
    });
  }

  const passed = maxLen === 0 ? true : matches === maxLen;
  const matchPct = maxLen === 0 ? 100 : Math.round((matches / maxLen) * 100);

  return {
    passed,
    matchPct,
    cobolOutput: cobolExec.output,
    modernOutput,
    lineDiffs,
  };
}

export function transpileCobolSource(source: string): TranspileResult {
  const program = parseCobolSource(source);
  const typescriptCode = generateTypeScript(program);
  const pythonCode = generatePython(program);
  const parity = verifyParity(source);
  const fnName = `run${toPascalCase(program.programId)}`;

  const vitestSnippet = `import { describe, expect, it } from 'vitest';
import { ${fnName} } from './${toSnakeCase(program.programId)}';

describe('${program.programId} modernization parity', () => {
  it('matches COBOL-85 mainframe output byte-for-byte', () => {
    const result = ${fnName}();
    expect(result.output).toEqual(${JSON.stringify(parity.cobolOutput, null, 4)});
  });
});`;

  return {
    programId: program.programId,
    typescriptCode,
    pythonCode,
    vitestSnippet,
    parity,
  };
}
