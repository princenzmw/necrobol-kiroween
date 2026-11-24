export type TokenKind = 'WORD' | 'NUMBER' | 'STRING' | 'DOT' | 'OP' | 'LPAREN' | 'RPAREN' | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
  upper: string;
  line: number;
}

const MULTI_OPS = new Set(['>=', '<=', '<>', '!=', '**']);
const SINGLE_OPS = new Set(['=', '>', '<', '+', '-', '*', '/']);

function preprocessLine(rawLine: string): string {
  let line = rawLine;
  if (/^\d{6}[*/]/.test(line)) {
    return '';
  }
  if (/^\d{6}\s/.test(line)) {
    line = `       ${line.slice(6)}`;
  }
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('*') || trimmed.startsWith('*>')) {
    return '';
  }
  const inlineComment = line.indexOf('*>');
  if (inlineComment >= 0) {
    line = line.slice(0, inlineComment);
  }
  return line;
}

export function tokenizeCobol(source: string): Token[] {
  const tokens: Token[] = [];
  const rawLines = source.split(/\r?\n/);

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx += 1) {
    const lineNum = lineIdx + 1;
    const clean = preprocessLine(rawLines[lineIdx]);
    if (!clean.trim()) {
      continue;
    }

    let i = 0;
    while (i < clean.length) {
      const ch = clean[i];
      if (ch === ' ' || ch === '\t' || ch === ',') {
        i += 1;
        continue;
      }

      if (ch === '"' || ch === "'") {
        const quote = ch;
        let end = i + 1;
        let str = '';
        while (end < clean.length && clean[end] !== quote) {
          str += clean[end];
          end += 1;
        }
        tokens.push({ kind: 'STRING', value: str, upper: str.toUpperCase(), line: lineNum });
        i = end < clean.length ? end + 1 : end;
        continue;
      }

      if (ch === '(') {
        tokens.push({ kind: 'LPAREN', value: '(', upper: '(', line: lineNum });
        i += 1;
        continue;
      }

      if (ch === ')') {
        tokens.push({ kind: 'RPAREN', value: ')', upper: ')', line: lineNum });
        i += 1;
        continue;
      }

      const two = clean.slice(i, i + 2);
      if (MULTI_OPS.has(two)) {
        tokens.push({ kind: 'OP', value: two, upper: two, line: lineNum });
        i += 2;
        continue;
      }

      if (ch === '+' || ch === '-') {
        const next = clean[i + 1];
        const prevToken = tokens[tokens.length - 1];
        const unaryPossible =
          !prevToken ||
          prevToken.kind === 'OP' ||
          prevToken.kind === 'LPAREN' ||
          prevToken.upper === 'VALUE' ||
          prevToken.upper === 'TO' ||
          prevToken.upper === 'MOVE';
        if (unaryPossible && next && /\d/.test(next)) {
          let end = i + 1;
          while (end < clean.length && /[\d.]/.test(clean[end])) {
            end += 1;
          }
          const numStr = clean.slice(i, end);
          tokens.push({ kind: 'NUMBER', value: numStr, upper: numStr, line: lineNum });
          i = end;
          continue;
        }
      }

      if (SINGLE_OPS.has(ch)) {
        tokens.push({ kind: 'OP', value: ch, upper: ch, line: lineNum });
        i += 1;
        continue;
      }

      if (ch === '.') {
        const prev = tokens[tokens.length - 1];
        const next = clean[i + 1];
        if (prev?.kind === 'NUMBER' && next && /\d/.test(next) && !prev.value.includes('.')) {
          let end = i + 1;
          while (end < clean.length && /\d/.test(clean[end])) {
            end += 1;
          }
          prev.value += clean.slice(i, end);
          prev.upper = prev.value;
          i = end;
          continue;
        }
        tokens.push({ kind: 'DOT', value: '.', upper: '.', line: lineNum });
        i += 1;
        continue;
      }

      if (/\d/.test(ch)) {
        let end = i + 1;
        let sawDot = false;
        while (end < clean.length) {
          const c = clean[end];
          if (/\d/.test(c)) {
            end += 1;
          } else if (c === '.' && !sawDot && end + 1 < clean.length && /\d/.test(clean[end + 1])) {
            sawDot = true;
            end += 1;
          } else if (/[A-Za-z0-9_-]/.test(c) && !sawDot && i === end - 1 && !/\d/.test(c)) {
            end += 1;
          } else {
            break;
          }
        }
        if (end < clean.length && /[A-Za-z-]/.test(clean[end]) && !sawDot) {
          while (end < clean.length && /[A-Za-z0-9_-]/.test(clean[end])) {
            end += 1;
          }
          const word = clean.slice(i, end);
          tokens.push({ kind: 'WORD', value: word, upper: word.toUpperCase(), line: lineNum });
        } else {
          const numStr = clean.slice(i, end);
          tokens.push({ kind: 'NUMBER', value: numStr, upper: numStr, line: lineNum });
        }
        i = end;
        continue;
      }

      if (/[A-Za-z_]/.test(ch)) {
        let end = i + 1;
        while (end < clean.length && /[A-Za-z0-9_-]/.test(clean[end])) {
          end += 1;
        }
        const word = clean.slice(i, end);
        tokens.push({ kind: 'WORD', value: word, upper: word.toUpperCase(), line: lineNum });
        i = end;
        continue;
      }

      i += 1;
    }
  }

  const lastLine = rawLines.length || 1;
  tokens.push({ kind: 'EOF', value: '', upper: '', line: lastLine });
  return tokens;
}
