import { parseCobolSource } from './parser';
import type {
  CallGraphEdge,
  CobolProgram,
  CobolStatement,
  CurseDiagnostic,
  DataItem,
  ExorcismReport,
  ExprNode,
} from './types';

function inferSourcePrecision(
  expr: ExprNode,
  dataMap: Map<string, DataItem>,
): { intDigits: number; decDigits: number } {
  switch (expr.kind) {
    case 'number': {
      const str = String(Math.abs(expr.value));
      const [whole, dec] = str.split('.');
      return { intDigits: whole.length, decDigits: dec ? dec.length : 0 };
    }
    case 'identifier': {
      const item = dataMap.get(expr.name);
      return item
        ? { intDigits: item.pic.intDigits, decDigits: item.pic.decDigits }
        : { intDigits: 4, decDigits: 0 };
    }
    case 'unary':
      return inferSourcePrecision(expr.expr, dataMap);
    case 'binary': {
      const l = inferSourcePrecision(expr.left, dataMap);
      const r = inferSourcePrecision(expr.right, dataMap);
      if (expr.op === '/') {
        return { intDigits: Math.max(l.intDigits, r.intDigits), decDigits: Math.max(2, l.decDigits) };
      }
      return {
        intDigits: Math.max(l.intDigits, r.intDigits) + 1,
        decDigits: Math.max(l.decDigits, r.decDigits),
      };
    }
    case 'string':
      return { intDigits: 0, decDigits: 0 };
  }
}

function paragraphEndsWithJumpOrStop(stmts: CobolStatement[]): boolean {
  const last = stmts[stmts.length - 1];
  if (!last) return false;
  return last.kind === 'STOP_RUN' || last.kind === 'GOTO';
}

export function analyzeCobolProgram(program: CobolProgram): ExorcismReport {
  const curses: CurseDiagnostic[] = [];
  const dataMap = new Map<string, DataItem>();

  for (const item of program.dataItems) {
    dataMap.set(item.name, item);
    if (
      item.pic.kind === 'numeric' &&
      item.pic.intDigits <= 2 &&
      /(YEAR|YR|YY|DATE)/i.test(item.name)
    ) {
      curses.push({
        id: `y2k-${item.name}-${item.line}`,
        code: 'CURSE-Y2K',
        severity: 'HIGH',
        line: item.line,
        paragraph: 'WORKING-STORAGE',
        title: `Y2K 2-Digit Year Field (${item.name})`,
        detail: `${item.name} uses PIC ${item.pic.raw}, wrapping 99 + 2 silently to 01.`,
        remediation: `Widen ${item.name} to PIC 9(4) and store explicit 4-digit years.`,
      });
    }
  }

  const edges: CallGraphEdge[] = [];
  const paraNames = program.paragraphs.map((p) => p.name);

  const inspectStatements = (paraName: string, stmts: CobolStatement[]) => {
    for (const stmt of stmts) {
      if (stmt.kind === 'ALTER') {
        curses.push({
          id: `alter-${stmt.line}`,
          code: 'CURSE-ALTER',
          severity: 'CRITICAL',
          line: stmt.line,
          paragraph: paraName,
          title: 'Self-Modifying ALTER Control Flow',
          detail: `ALTER mutates ${stmt.sourceParagraph} jump target to ${stmt.targetParagraph} at runtime.`,
          remediation: 'Replace ALTER with explicit EVALUATE or structured PERFORM calls.',
        });
      }

      if (stmt.kind === 'GOTO') {
        edges.push({ from: paraName, to: stmt.paragraph, kind: 'GOTO', line: stmt.line });
        curses.push({
          id: `goto-${stmt.line}`,
          code: 'CURSE-GOTO',
          severity: 'HIGH',
          line: stmt.line,
          paragraph: paraName,
          title: `Unstructured GO TO Transfer (-> ${stmt.paragraph})`,
          detail: `Spaghetti branch from ${paraName} into ${stmt.paragraph} bypasses structured return.`,
          remediation: `Replace GO TO ${stmt.paragraph} with structured PERFORM ${stmt.paragraph}.`,
        });
      }

      if (stmt.kind === 'PERFORM') {
        edges.push({ from: paraName, to: stmt.paragraph, kind: 'PERFORM', line: stmt.line });
      }

      if (stmt.kind === 'ARITH') {
        if (
          (stmt.verb === 'ADD' || stmt.verb === 'MULTIPLY') &&
          stmt.onSizeError.length === 0
        ) {
          const destName = stmt.givingTarget ?? stmt.target;
          const destItem = dataMap.get(destName);
          if (destItem && destItem.pic.intDigits <= 4) {
            curses.push({
              id: `overflow-${stmt.line}-${destName}`,
              code: 'CURSE-OVERFLOW',
              severity: 'MEDIUM',
              line: stmt.line,
              paragraph: paraName,
              title: `Unguarded ${stmt.verb} Overflow Risk on ${destName}`,
              detail: `${destName} (PIC ${destItem.pic.raw}) lacks an ON SIZE ERROR handler.`,
              remediation: `Add ON SIZE ERROR handling or widen ${destName}.`,
            });
          }
        }
      }

      if (stmt.kind === 'COMPUTE') {
        const destItem = dataMap.get(stmt.target);
        if (stmt.onSizeError.length === 0 && destItem && destItem.pic.intDigits <= 4) {
          curses.push({
            id: `overflow-comp-${stmt.line}`,
            code: 'CURSE-OVERFLOW',
            severity: 'MEDIUM',
            line: stmt.line,
            paragraph: paraName,
            title: `Unguarded COMPUTE Overflow Risk on ${stmt.target}`,
            detail: `COMPUTE into ${stmt.target} (PIC ${destItem.pic.raw}) can silently wrap without ON SIZE ERROR.`,
            remediation: `Guard COMPUTE ${stmt.target} with ON SIZE ERROR and END-COMPUTE.`,
          });
        }
        if (destItem && destItem.pic.kind === 'numeric') {
          const srcPrec = inferSourcePrecision(stmt.expr, dataMap);
          if (srcPrec.decDigits > destItem.pic.decDigits) {
            curses.push({
              id: `prec-comp-${stmt.line}`,
              code: 'CURSE-PRECISION',
              severity: 'HIGH',
              line: stmt.line,
              paragraph: paraName,
              title: `Decimal Precision Loss into ${stmt.target}`,
              detail: `Expression computes fractional precision (${srcPrec.decDigits} decimals) into PIC ${destItem.pic.raw}.`,
              remediation: `Store result in a decimal field (e.g. PIC 9(${destItem.pic.intDigits})V99).`,
            });
          }
        }
      }

      if (stmt.kind === 'MOVE') {
        const destItem = dataMap.get(stmt.target);
        if (destItem && destItem.pic.kind === 'numeric' && stmt.source.kind !== 'string') {
          const srcPrec = inferSourcePrecision(stmt.source, dataMap);
          if (srcPrec.decDigits > destItem.pic.decDigits) {
            curses.push({
              id: `prec-move-${stmt.line}`,
              code: 'CURSE-PRECISION',
              severity: 'HIGH',
              line: stmt.line,
              paragraph: paraName,
              title: `Fractional Truncation on MOVE to ${stmt.target}`,
              detail: `Moving higher-precision value into ${stmt.target} (PIC ${destItem.pic.raw}) discards decimals.`,
              remediation: `Use matching decimal scale on ${stmt.target}.`,
            });
          }
        }
      }

      if (stmt.kind === 'IF') {
        inspectStatements(paraName, stmt.thenBranch);
        inspectStatements(paraName, stmt.elseBranch);
      } else if ((stmt.kind === 'ARITH' || stmt.kind === 'COMPUTE') && stmt.onSizeError.length > 0) {
        inspectStatements(paraName, stmt.onSizeError);
      }
    }
  };

  for (let i = 0; i < program.paragraphs.length; i += 1) {
    const para = program.paragraphs[i];
    inspectStatements(para.name, para.statements);
    if (i + 1 < program.paragraphs.length && !paragraphEndsWithJumpOrStop(para.statements)) {
      edges.push({
        from: para.name,
        to: program.paragraphs[i + 1].name,
        kind: 'FALLTHROUGH',
        line: para.line,
      });
    }
  }

  const reachable = new Set<string>();
  if (paraNames.length > 0) {
    const queue = [paraNames[0]];
    reachable.add(paraNames[0]);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const edge of edges) {
        if (edge.from === cur && !reachable.has(edge.to) && paraNames.includes(edge.to)) {
          reachable.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
  }

  const ghostParagraphs = paraNames.filter((name) => !reachable.has(name));
  for (const ghostName of ghostParagraphs) {
    const para = program.paragraphs.find((p) => p.name === ghostName);
    curses.push({
      id: `ghost-${ghostName}`,
      code: 'CURSE-GHOST-PARA',
      severity: 'MEDIUM',
      line: para?.line ?? 1,
      paragraph: ghostName,
      title: `Unreachable Ghost Paragraph (${ghostName})`,
      detail: `${ghostName} is never reached by entry fall-through, PERFORM, or GO TO.`,
      remediation: `Delete dead paragraph ${ghostName} or invoke it explicitly via PERFORM.`,
    });
  }

  const weights: Record<CurseDiagnostic['severity'], number> = {
    CRITICAL: 30,
    HIGH: 20,
    MEDIUM: 12,
    LOW: 5,
  };
  const hauntingScore = Math.min(
    100,
    curses.reduce((sum, c) => sum + weights[c.severity], 0),
  );

  const grade: ExorcismReport['grade'] =
    hauntingScore === 0
      ? 'EXORCISED'
      : hauntingScore <= 25
        ? 'MILDLY HAUNTED'
        : hauntingScore <= 60
          ? 'CURSED'
          : 'POSSESSED';

  const severityOrder: Record<CurseDiagnostic['severity'], number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  curses.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.line - b.line);

  return {
    programId: program.programId,
    hauntingScore,
    grade,
    curses,
    paragraphs: paraNames,
    reachableParagraphs: Array.from(reachable),
    ghostParagraphs,
    edges,
  };
}

export function analyzeCobolSource(source: string): ExorcismReport {
  const program = parseCobolSource(source);
  return analyzeCobolProgram(program);
}
