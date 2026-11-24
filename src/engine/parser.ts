import { tokenizeCobol, type Token } from './lexer';
import type {
  CobolProgram,
  CobolStatement,
  ConditionNode,
  DataItem,
  ExprNode,
  Paragraph,
  PicSpec,
} from './types';

const VERBS = new Set([
  'DISPLAY',
  'MOVE',
  'ADD',
  'SUBTRACT',
  'MULTIPLY',
  'DIVIDE',
  'COMPUTE',
  'IF',
  'PERFORM',
  'GO',
  'GOTO',
  'ALTER',
  'EXIT',
  'STOP',
]);

const BLOCK_ENDS = new Set([
  'ELSE',
  'END-IF',
  'END-ADD',
  'END-SUBTRACT',
  'END-MULTIPLY',
  'END-DIVIDE',
  'END-COMPUTE',
]);

export function parsePicSpec(rawTokens: string[]): PicSpec {
  const raw = rawTokens.join('').toUpperCase();
  if (raw.includes('X')) {
    const paren = raw.match(/X\((\d+)\)/);
    const maxLength = paren ? Math.max(1, Number(paren[1])) : Math.max(1, (raw.match(/X/g) ?? ['X']).length);
    return {
      kind: 'alphanumeric',
      intDigits: 0,
      decDigits: 0,
      signed: false,
      maxLength,
      raw,
    };
  }

  const signed = raw.startsWith('S');
  const [intPart, decPart] = raw.replace(/^S/, '').split('V');

  const countNines = (part: string | undefined): number => {
    if (!part) return 0;
    const parenMatches = Array.from(part.matchAll(/9\((\d+)\)/g));
    let total = 0;
    for (const m of parenMatches) {
      total += Number(m[1]);
    }
    const stripped = part.replace(/9\(\d+\)/g, '');
    total += (stripped.match(/9/g) ?? []).length;
    return total;
  };

  const intDigits = Math.max(1, countNines(intPart));
  const decDigits = countNines(decPart);

  return {
    kind: 'numeric',
    intDigits,
    decDigits,
    signed,
    maxLength: intDigits + decDigits + (decDigits > 0 ? 1 : 0) + (signed ? 1 : 0),
    raw,
  };
}

class CobolParser {
  private tokens: Token[];
  private pos = 0;
  private errors: Array<{ line: number; message: string }> = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private advance(): Token {
    const tok = this.peek();
    if (this.pos < this.tokens.length - 1) {
      this.pos += 1;
    }
    return tok;
  }

  private at(upper: string): boolean {
    return this.peek().upper === upper;
  }

  private consumeDotIfPresent(): void {
    while (this.peek().kind === 'DOT') {
      this.advance();
    }
  }

  private isParagraphHeaderAhead(): boolean {
    const cur = this.peek();
    const next = this.peek(1);
    return (
      cur.kind === 'WORD' &&
      next.kind === 'DOT' &&
      !VERBS.has(cur.upper) &&
      !BLOCK_ENDS.has(cur.upper) &&
      cur.upper !== 'DIVISION' &&
      cur.upper !== 'SECTION'
    );
  }

  parse(): CobolProgram {
    let programId = 'COBOL-PROG';
    const dataItems: DataItem[] = [];
    const paragraphs: Paragraph[] = [];

    while (this.peek().kind !== 'EOF') {
      if (this.at('IDENTIFICATION') && this.peek(1).upper === 'DIVISION') {
        this.advance();
        this.advance();
        this.consumeDotIfPresent();
        programId = this.parseIdentificationDivision(programId);
        continue;
      }
      if (this.at('DATA') && this.peek(1).upper === 'DIVISION') {
        this.advance();
        this.advance();
        this.consumeDotIfPresent();
        dataItems.push(...this.parseDataDivision());
        continue;
      }
      if (this.at('PROCEDURE') && this.peek(1).upper === 'DIVISION') {
        this.advance();
        this.advance();
        this.consumeDotIfPresent();
        paragraphs.push(...this.parseProcedureDivision());
        break;
      }
      this.advance();
    }

    return {
      programId,
      dataItems,
      paragraphs,
      parseErrors: this.errors,
    };
  }

  private parseIdentificationDivision(defaultId: string): string {
    let programId = defaultId;
    while (
      this.peek().kind !== 'EOF' &&
      !(this.at('DATA') && this.peek(1).upper === 'DIVISION') &&
      !(this.at('PROCEDURE') && this.peek(1).upper === 'DIVISION')
    ) {
      if (this.at('PROGRAM-ID')) {
        this.advance();
        this.consumeDotIfPresent();
        if (this.peek().kind === 'WORD' || this.peek().kind === 'STRING') {
          programId = this.advance().upper;
        }
        this.consumeDotIfPresent();
        continue;
      }
      this.advance();
    }
    return programId;
  }

  private parseDataDivision(): DataItem[] {
    const items: DataItem[] = [];
    while (
      this.peek().kind !== 'EOF' &&
      !(this.at('PROCEDURE') && this.peek(1).upper === 'DIVISION')
    ) {
      if (this.at('WORKING-STORAGE') && this.peek(1).upper === 'SECTION') {
        this.advance();
        this.advance();
        this.consumeDotIfPresent();
        continue;
      }
      const tok = this.peek();
      if (tok.kind === 'NUMBER' && /^(?:0?[1-9]|[1-4]\d|77)$/.test(tok.value)) {
        const level = Number(this.advance().value);
        const line = tok.line;
        const nameTok = this.peek();
        if (nameTok.kind !== 'WORD') {
          this.advance();
          continue;
        }
        const name = this.advance().upper;
        const picTokens: string[] = [];
        let initialValue: string | number = '';
        let hasPic = false;

        while (this.peek().kind !== 'EOF' && this.peek().kind !== 'DOT') {
          if (this.at('PIC') || this.at('PICTURE')) {
            hasPic = true;
            this.advance();
            if (this.at('IS')) this.advance();
            while (
              this.peek().kind !== 'EOF' &&
              this.peek().kind !== 'DOT' &&
              !this.at('VALUE')
            ) {
              picTokens.push(this.advance().value);
            }
            continue;
          }
          if (this.at('VALUE')) {
            this.advance();
            if (this.at('IS')) this.advance();
            const valTok = this.advance();
            if (valTok.kind === 'NUMBER') {
              initialValue = Number(valTok.value);
            } else if (valTok.kind === 'STRING') {
              initialValue = valTok.value;
            } else if (valTok.upper === 'ZERO' || valTok.upper === 'ZEROS' || valTok.upper === 'ZEROES') {
              initialValue = 0;
            } else if (valTok.upper === 'SPACE' || valTok.upper === 'SPACES') {
              initialValue = '';
            } else {
              initialValue = valTok.value;
            }
            continue;
          }
          this.advance();
        }
        this.consumeDotIfPresent();

        if (hasPic && picTokens.length > 0) {
          const pic = parsePicSpec(picTokens);
          if (initialValue === '' && pic.kind === 'numeric') {
            initialValue = 0;
          }
          items.push({ level, name, pic, initialValue, line });
        }
        continue;
      }
      this.advance();
    }
    return items;
  }

  private parseProcedureDivision(): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    let currentPara: Paragraph | null = null;

    while (this.peek().kind !== 'EOF') {
      this.consumeDotIfPresent();
      if (this.peek().kind === 'EOF') break;

      if (this.isParagraphHeaderAhead()) {
        const nameTok = this.advance();
        this.consumeDotIfPresent();
        currentPara = {
          name: nameTok.upper,
          line: nameTok.line,
          statements: [],
        };
        paragraphs.push(currentPara);
        continue;
      }

      if (!currentPara) {
        currentPara = {
          name: 'MAIN-ENTRY',
          line: this.peek().line,
          statements: [],
        };
        paragraphs.push(currentPara);
      }

      const stmt = this.parseStatement(false);
      if (stmt) {
        currentPara.statements.push(stmt);
      }
      this.consumeDotIfPresent();
    }

    return paragraphs;
  }

  private parseBlock(stopTokens: Set<string>): CobolStatement[] {
    const stmts: CobolStatement[] = [];
    while (this.peek().kind !== 'EOF') {
      if (stopTokens.has(this.peek().upper) || this.isParagraphHeaderAhead()) {
        break;
      }
      if (this.peek().kind === 'DOT') {
        if (stopTokens.has('DOT')) break;
        this.advance();
        continue;
      }
      const stmt = this.parseStatement(true);
      if (!stmt) break;
      stmts.push(stmt);
    }
    return stmts;
  }

  private parseStatement(insideBlock: boolean): CobolStatement | null {
    const tok = this.peek();
    if (tok.kind === 'EOF' || tok.kind === 'DOT') {
      return null;
    }
    const line = tok.line;

    switch (tok.upper) {
      case 'DISPLAY': {
        this.advance();
        const args: ExprNode[] = [];
        while (
          this.peek().kind !== 'EOF' &&
          this.peek().kind !== 'DOT' &&
          !BLOCK_ENDS.has(this.peek().upper) &&
          !(insideBlock && VERBS.has(this.peek().upper)) &&
          !(this.at('ON') && this.peek(1).upper === 'SIZE')
        ) {
          args.push(this.parsePrimaryExpr());
        }
        return {
          kind: 'DISPLAY',
          args,
          line,
          text: `DISPLAY ${args.map(formatExpr).join(' ')}`,
        };
      }

      case 'MOVE': {
        this.advance();
        const source = this.parseSimpleValueExpr();
        if (this.at('TO')) this.advance();
        const target = this.advance().upper;
        return {
          kind: 'MOVE',
          source,
          target,
          line,
          text: `MOVE ${formatExpr(source)} TO ${target}`,
        };
      }

      case 'ADD':
      case 'SUBTRACT':
      case 'MULTIPLY':
      case 'DIVIDE': {
        const verb = this.advance().upper as 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE';
        const operands: ExprNode[] = [];
        while (
          this.peek().kind !== 'EOF' &&
          !this.at('TO') &&
          !this.at('FROM') &&
          !this.at('BY') &&
          !this.at('INTO') &&
          !this.at('GIVING')
        ) {
          operands.push(this.parseSimpleValueExpr());
        }
        const prep = this.peek().upper;
        let target = '';
        let givingTarget: string | undefined;

        if (prep === 'GIVING') {
          this.advance();
          givingTarget = this.advance().upper;
          target = givingTarget;
        } else {
          if (prep === 'TO' || prep === 'FROM' || prep === 'BY' || prep === 'INTO') {
            this.advance();
          }
          const targetExpr = this.parseSimpleValueExpr();
          target = targetExpr.kind === 'identifier' ? targetExpr.name : '';

          if (this.at('GIVING')) {
            this.advance();
            givingTarget = this.advance().upper;
            operands.push(targetExpr);
            if (!target) target = givingTarget;
          } else if (!target) {
            this.errors.push({ line, message: `Expected target variable in ${verb}` });
          }
        }

        const onSizeError = this.parseOptionalSizeError(verb);
        return {
          kind: 'ARITH',
          verb,
          operands,
          target,
          givingTarget,
          onSizeError,
          line,
          text: `${verb} ${operands.map(formatExpr).join(' ')} ${givingTarget ? `GIVING ${givingTarget}` : `-> ${target}`}`,
        };
      }

      case 'COMPUTE': {
        this.advance();
        const target = this.advance().upper;
        if (this.at('=')) this.advance();
        const expr = this.parseArithExpr();
        const onSizeError = this.parseOptionalSizeError('COMPUTE');
        return {
          kind: 'COMPUTE',
          target,
          expr,
          onSizeError,
          line,
          text: `COMPUTE ${target} = ${formatExpr(expr)}`,
        };
      }

      case 'IF': {
        this.advance();
        const condition = this.parseCondition();
        if (this.at('THEN')) this.advance();
        const thenBranch = this.parseBlock(new Set(['ELSE', 'END-IF', 'DOT']));
        let elseBranch: CobolStatement[] = [];
        if (this.at('ELSE')) {
          this.advance();
          elseBranch = this.parseBlock(new Set(['END-IF', 'DOT']));
        }
        if (this.at('END-IF')) {
          this.advance();
        }
        return {
          kind: 'IF',
          condition,
          thenBranch,
          elseBranch,
          line,
          text: `IF ${formatCondition(condition)}`,
        };
      }

      case 'PERFORM': {
        this.advance();
        const paragraph = this.advance().upper;
        let times: ExprNode | undefined;
        let until: ConditionNode | undefined;
        if (this.at('UNTIL')) {
          this.advance();
          until = this.parseCondition();
        } else if (this.peek().kind === 'NUMBER' || this.peek().kind === 'WORD') {
          if (this.peek(1).upper === 'TIMES') {
            times = this.parseSimpleValueExpr();
            this.advance();
          }
        }
        return {
          kind: 'PERFORM',
          paragraph,
          times,
          until,
          line,
          text: times
            ? `PERFORM ${paragraph} ${formatExpr(times)} TIMES`
            : until
              ? `PERFORM ${paragraph} UNTIL ${formatCondition(until)}`
              : `PERFORM ${paragraph}`,
        };
      }

      case 'GO': {
        this.advance();
        if (this.at('TO')) this.advance();
        const paragraph = this.advance().upper;
        return {
          kind: 'GOTO',
          paragraph,
          line,
          text: `GO TO ${paragraph}`,
        };
      }

      case 'GOTO': {
        this.advance();
        const paragraph = this.advance().upper;
        return {
          kind: 'GOTO',
          paragraph,
          line,
          text: `GO TO ${paragraph}`,
        };
      }

      case 'ALTER': {
        this.advance();
        const sourceParagraph = this.advance().upper;
        if (this.at('TO')) this.advance();
        if (this.at('PROCEED')) this.advance();
        if (this.at('TO')) this.advance();
        const targetParagraph = this.advance().upper;
        return {
          kind: 'ALTER',
          sourceParagraph,
          targetParagraph,
          line,
          text: `ALTER ${sourceParagraph} TO PROCEED TO ${targetParagraph}`,
        };
      }

      case 'EXIT': {
        this.advance();
        return { kind: 'EXIT', line, text: 'EXIT' };
      }

      case 'STOP': {
        this.advance();
        if (this.at('RUN')) this.advance();
        return { kind: 'STOP_RUN', line, text: 'STOP RUN' };
      }

      default: {
        this.errors.push({ line, message: `Unrecognized statement token "${tok.value}"` });
        this.advance();
        return null;
      }
    }
  }

  private parseOptionalSizeError(
    verb: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'COMPUTE',
  ): CobolStatement[] {
    if (!(this.at('ON') && this.peek(1).upper === 'SIZE')) {
      if (this.at(`END-${verb}`)) this.advance();
      return [];
    }
    this.advance();
    this.advance();
    if (this.at('ERROR')) this.advance();
    const endMarker = `END-${verb}`;
    const stmts = this.parseBlock(new Set([endMarker, 'DOT']));
    if (this.at(endMarker)) {
      this.advance();
    }
    return stmts;
  }

  private parseCondition(): ConditionNode {
    let left = this.parseAndCondition();
    while (this.at('OR')) {
      this.advance();
      const right = this.parseAndCondition();
      left = { kind: 'logic', op: 'OR', left, right };
    }
    return left;
  }

  private parseAndCondition(): ConditionNode {
    let left = this.parseComparison();
    while (this.at('AND')) {
      this.advance();
      const right = this.parseComparison();
      left = { kind: 'logic', op: 'AND', left, right };
    }
    return left;
  }

  private parseComparison(): ConditionNode {
    const left = this.parseArithExpr();
    let op: '=' | '!=' | '>' | '<' | '>=' | '<=' = '=';
    const isNot = this.at('NOT');
    if (isNot) this.advance();

    if (this.at('=') || this.at('EQUAL')) {
      this.advance();
      if (this.at('TO')) this.advance();
      op = isNot ? '!=' : '=';
    } else if (this.at('>') || this.at('GREATER')) {
      this.advance();
      if (this.at('THAN')) this.advance();
      op = isNot ? '<=' : '>';
    } else if (this.at('<') || this.at('LESS')) {
      this.advance();
      if (this.at('THAN')) this.advance();
      op = isNot ? '>=' : '<';
    } else if (this.at('>=')) {
      this.advance();
      op = '>=';
    } else if (this.at('<=')) {
      this.advance();
      op = '<=';
    } else if (this.at('!=') || this.at('<>')) {
      this.advance();
      op = '!=';
    }

    const right = this.parseArithExpr();
    return { kind: 'compare', op, left, right };
  }

  private parseArithExpr(): ExprNode {
    let left = this.parseTerm();
    while (this.at('+') || this.at('-')) {
      const op = this.advance().value as '+' | '-';
      const right = this.parseTerm();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseTerm(): ExprNode {
    let left = this.parsePower();
    while (this.at('*') || this.at('/')) {
      const op = this.advance().value as '*' | '/';
      const right = this.parsePower();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parsePower(): ExprNode {
    const left = this.parsePrimaryExpr();
    if (this.at('**')) {
      this.advance();
      const right = this.parsePower();
      return { kind: 'binary', op: '**', left, right };
    }
    return left;
  }

  private parseSimpleValueExpr(): ExprNode {
    return this.parsePrimaryExpr();
  }

  private parsePrimaryExpr(): ExprNode {
    const tok = this.peek();
    if (tok.kind === 'NUMBER') {
      this.advance();
      return { kind: 'number', value: Number(tok.value) };
    }
    if (tok.kind === 'STRING') {
      this.advance();
      return { kind: 'string', value: tok.value };
    }
    if (tok.kind === 'LPAREN') {
      this.advance();
      const inner = this.parseArithExpr();
      if (this.peek().kind === 'RPAREN') this.advance();
      return inner;
    }
    if (tok.kind === 'OP' && tok.value === '-') {
      this.advance();
      return { kind: 'unary', op: '-', expr: this.parsePrimaryExpr() };
    }
    if (tok.kind === 'WORD') {
      this.advance();
      if (tok.upper === 'ZERO' || tok.upper === 'ZEROS' || tok.upper === 'ZEROES') {
        return { kind: 'number', value: 0 };
      }
      if (tok.upper === 'SPACE' || tok.upper === 'SPACES') {
        return { kind: 'string', value: '' };
      }
      return { kind: 'identifier', name: tok.upper };
    }
    this.advance();
    return { kind: 'number', value: 0 };
  }
}

export function formatExpr(expr: ExprNode): string {
  switch (expr.kind) {
    case 'number':
      return String(expr.value);
    case 'string':
      return `"${expr.value}"`;
    case 'identifier':
      return expr.name;
    case 'unary':
      return `-${formatExpr(expr.expr)}`;
    case 'binary':
      return `(${formatExpr(expr.left)} ${expr.op} ${formatExpr(expr.right)})`;
  }
}

export function formatCondition(cond: ConditionNode): string {
  if (cond.kind === 'logic') {
    return `${formatCondition(cond.left)} ${cond.op} ${formatCondition(cond.right)}`;
  }
  return `${formatExpr(cond.left)} ${cond.op} ${formatExpr(cond.right)}`;
}

export function parseCobolSource(source: string): CobolProgram {
  const tokens = tokenizeCobol(source);
  const parser = new CobolParser(tokens);
  return parser.parse();
}
