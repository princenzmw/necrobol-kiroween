export type PhosphorTheme = 'green' | 'amber' | 'violet';

export type PicKind = 'numeric' | 'alphanumeric';

export interface PicSpec {
  kind: PicKind;
  intDigits: number;
  decDigits: number;
  signed: boolean;
  maxLength: number;
  raw: string;
}

export interface DataItem {
  level: number;
  name: string;
  pic: PicSpec;
  initialValue: string | number;
  line: number;
}

export type ExprNode =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'identifier'; name: string }
  | { kind: 'unary'; op: '-'; expr: ExprNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '**'; left: ExprNode; right: ExprNode };

export type ConditionNode =
  | {
      kind: 'compare';
      op: '=' | '!=' | '>' | '<' | '>=' | '<=';
      left: ExprNode;
      right: ExprNode;
    }
  | {
      kind: 'logic';
      op: 'AND' | 'OR';
      left: ConditionNode;
      right: ConditionNode;
    };

export type CobolStatement =
  | { kind: 'DISPLAY'; args: ExprNode[]; line: number; text: string }
  | { kind: 'MOVE'; source: ExprNode; target: string; line: number; text: string }
  | {
      kind: 'ARITH';
      verb: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE';
      operands: ExprNode[];
      target: string;
      givingTarget?: string;
      onSizeError: CobolStatement[];
      line: number;
      text: string;
    }
  | {
      kind: 'COMPUTE';
      target: string;
      expr: ExprNode;
      onSizeError: CobolStatement[];
      line: number;
      text: string;
    }
  | {
      kind: 'IF';
      condition: ConditionNode;
      thenBranch: CobolStatement[];
      elseBranch: CobolStatement[];
      line: number;
      text: string;
    }
  | {
      kind: 'PERFORM';
      paragraph: string;
      times?: ExprNode;
      until?: ConditionNode;
      line: number;
      text: string;
    }
  | { kind: 'GOTO'; paragraph: string; line: number; text: string }
  | { kind: 'ALTER'; sourceParagraph: string; targetParagraph: string; line: number; text: string }
  | { kind: 'EXIT'; line: number; text: string }
  | { kind: 'STOP_RUN'; line: number; text: string };

export interface Paragraph {
  name: string;
  line: number;
  statements: CobolStatement[];
}

export interface CobolProgram {
  programId: string;
  dataItems: DataItem[];
  paragraphs: Paragraph[];
  parseErrors: Array<{ line: number; message: string }>;
}

export interface VariableSnapshot {
  name: string;
  pic: string;
  value: string | number;
  formatted: string;
  truncated: boolean;
}

export interface ExecutionStep {
  step: number;
  line: number;
  paragraph: string;
  statementText: string;
  changedKeys: string[];
  outputSnapshot: string[];
  variables: Record<string, string | number>;
  warnings: string[];
}

export interface ExecutionResult {
  programId: string;
  haltedReason: 'STOP_RUN' | 'END_OF_PROGRAM' | 'MAX_STEPS' | 'PARSE_ERROR';
  output: string[];
  steps: ExecutionStep[];
  finalVariables: VariableSnapshot[];
  warnings: string[];
  parseErrors: Array<{ line: number; message: string }>;
}

export type CurseSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type CurseCode =
  | 'CURSE-Y2K'
  | 'CURSE-ALTER'
  | 'CURSE-GOTO'
  | 'CURSE-GHOST-PARA'
  | 'CURSE-OVERFLOW'
  | 'CURSE-PRECISION';

export interface CurseDiagnostic {
  id: string;
  code: CurseCode;
  severity: CurseSeverity;
  line: number;
  paragraph: string;
  title: string;
  detail: string;
  remediation: string;
}

export interface CallGraphEdge {
  from: string;
  to: string;
  kind: 'PERFORM' | 'GOTO' | 'FALLTHROUGH';
  line: number;
}

export interface ExorcismReport {
  programId: string;
  hauntingScore: number;
  grade: 'EXORCISED' | 'MILDLY HAUNTED' | 'CURSED' | 'POSSESSED';
  curses: CurseDiagnostic[];
  paragraphs: string[];
  reachableParagraphs: string[];
  ghostParagraphs: string[];
  edges: CallGraphEdge[];
}

export interface ParityLineDiff {
  lineIndex: number;
  cobolLine: string | null;
  modernLine: string | null;
  matches: boolean;
}

export interface ParityResult {
  passed: boolean;
  matchPct: number;
  cobolOutput: string[];
  modernOutput: string[];
  lineDiffs: ParityLineDiff[];
}

export interface TranspileResult {
  programId: string;
  typescriptCode: string;
  pythonCode: string;
  vitestSnippet: string;
  parity: ParityResult;
}
