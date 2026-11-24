// src/engine/lexer.ts
var MULTI_OPS = /* @__PURE__ */ new Set([
	">=",
	"<=",
	"<>",
	"!=",
	"**"
]);
var SINGLE_OPS = /* @__PURE__ */ new Set([
	"=",
	">",
	"<",
	"+",
	"-",
	"*",
	"/"
]);
function preprocessLine(rawLine) {
	let line = rawLine;
	if (/^\d{6}[*/]/.test(line)) return "";
	if (/^\d{6}\s/.test(line)) line = `       ${line.slice(6)}`;
	const trimmed = line.trim();
	if (trimmed === "" || trimmed.startsWith("*") || trimmed.startsWith("*>")) return "";
	const inlineComment = line.indexOf("*>");
	if (inlineComment >= 0) line = line.slice(0, inlineComment);
	return line;
}
function tokenizeCobol(source) {
	const tokens = [];
	const rawLines = source.split(/\r?\n/);
	for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx += 1) {
		const lineNum = lineIdx + 1;
		const clean = preprocessLine(rawLines[lineIdx]);
		if (!clean.trim()) continue;
		let i = 0;
		while (i < clean.length) {
			const ch = clean[i];
			if (ch === " " || ch === "	" || ch === ",") {
				i += 1;
				continue;
			}
			if (ch === "\"" || ch === "'") {
				const quote = ch;
				let end = i + 1;
				let str = "";
				while (end < clean.length && clean[end] !== quote) {
					str += clean[end];
					end += 1;
				}
				tokens.push({
					kind: "STRING",
					value: str,
					upper: str.toUpperCase(),
					line: lineNum
				});
				i = end < clean.length ? end + 1 : end;
				continue;
			}
			if (ch === "(") {
				tokens.push({
					kind: "LPAREN",
					value: "(",
					upper: "(",
					line: lineNum
				});
				i += 1;
				continue;
			}
			if (ch === ")") {
				tokens.push({
					kind: "RPAREN",
					value: ")",
					upper: ")",
					line: lineNum
				});
				i += 1;
				continue;
			}
			const two = clean.slice(i, i + 2);
			if (MULTI_OPS.has(two)) {
				tokens.push({
					kind: "OP",
					value: two,
					upper: two,
					line: lineNum
				});
				i += 2;
				continue;
			}
			if (ch === "+" || ch === "-") {
				const next = clean[i + 1];
				const prevToken = tokens[tokens.length - 1];
				if ((!prevToken || prevToken.kind === "OP" || prevToken.kind === "LPAREN" || prevToken.upper === "VALUE" || prevToken.upper === "TO" || prevToken.upper === "MOVE") && next && /\d/.test(next)) {
					let end = i + 1;
					while (end < clean.length && /[\d.]/.test(clean[end])) end += 1;
					const numStr = clean.slice(i, end);
					tokens.push({
						kind: "NUMBER",
						value: numStr,
						upper: numStr,
						line: lineNum
					});
					i = end;
					continue;
				}
			}
			if (SINGLE_OPS.has(ch)) {
				tokens.push({
					kind: "OP",
					value: ch,
					upper: ch,
					line: lineNum
				});
				i += 1;
				continue;
			}
			if (ch === ".") {
				const prev = tokens[tokens.length - 1];
				const next = clean[i + 1];
				if (prev?.kind === "NUMBER" && next && /\d/.test(next) && !prev.value.includes(".")) {
					let end = i + 1;
					while (end < clean.length && /\d/.test(clean[end])) end += 1;
					prev.value += clean.slice(i, end);
					prev.upper = prev.value;
					i = end;
					continue;
				}
				tokens.push({
					kind: "DOT",
					value: ".",
					upper: ".",
					line: lineNum
				});
				i += 1;
				continue;
			}
			if (/\d/.test(ch)) {
				let end = i + 1;
				let sawDot = false;
				while (end < clean.length) {
					const c = clean[end];
					if (/\d/.test(c)) end += 1;
					else if (c === "." && !sawDot && end + 1 < clean.length && /\d/.test(clean[end + 1])) {
						sawDot = true;
						end += 1;
					} else if (/[A-Za-z0-9_-]/.test(c) && !sawDot && i === end - 1 && !/\d/.test(c)) end += 1;
					else break;
				}
				if (end < clean.length && /[A-Za-z-]/.test(clean[end]) && !sawDot) {
					while (end < clean.length && /[A-Za-z0-9_-]/.test(clean[end])) end += 1;
					const word = clean.slice(i, end);
					tokens.push({
						kind: "WORD",
						value: word,
						upper: word.toUpperCase(),
						line: lineNum
					});
				} else {
					const numStr = clean.slice(i, end);
					tokens.push({
						kind: "NUMBER",
						value: numStr,
						upper: numStr,
						line: lineNum
					});
				}
				i = end;
				continue;
			}
			if (/[A-Za-z_]/.test(ch)) {
				let end = i + 1;
				while (end < clean.length && /[A-Za-z0-9_-]/.test(clean[end])) end += 1;
				const word = clean.slice(i, end);
				tokens.push({
					kind: "WORD",
					value: word,
					upper: word.toUpperCase(),
					line: lineNum
				});
				i = end;
				continue;
			}
			i += 1;
		}
	}
	const lastLine = rawLines.length || 1;
	tokens.push({
		kind: "EOF",
		value: "",
		upper: "",
		line: lastLine
	});
	return tokens;
}
// src/engine/parser.ts
var VERBS = /* @__PURE__ */ new Set([
	"DISPLAY",
	"MOVE",
	"ADD",
	"SUBTRACT",
	"MULTIPLY",
	"DIVIDE",
	"COMPUTE",
	"IF",
	"PERFORM",
	"GO",
	"GOTO",
	"ALTER",
	"EXIT",
	"STOP"
]);
var BLOCK_ENDS = /* @__PURE__ */ new Set([
	"ELSE",
	"END-IF",
	"END-ADD",
	"END-SUBTRACT",
	"END-MULTIPLY",
	"END-DIVIDE",
	"END-COMPUTE"
]);
function parsePicSpec(rawTokens) {
	const raw = rawTokens.join("").toUpperCase();
	if (raw.includes("X")) {
		const paren = raw.match(/X\((\d+)\)/);
		return {
			kind: "alphanumeric",
			intDigits: 0,
			decDigits: 0,
			signed: false,
			maxLength: paren ? Math.max(1, Number(paren[1])) : Math.max(1, (raw.match(/X/g) ?? ["X"]).length),
			raw
		};
	}
	const signed = raw.startsWith("S");
	const [intPart, decPart] = raw.replace(/^S/, "").split("V");
	const countNines = (part) => {
		if (!part) return 0;
		const parenMatches = Array.from(part.matchAll(/9\((\d+)\)/g));
		let total = 0;
		for (const m of parenMatches) total += Number(m[1]);
		const stripped = part.replace(/9\(\d+\)/g, "");
		total += (stripped.match(/9/g) ?? []).length;
		return total;
	};
	const intDigits = Math.max(1, countNines(intPart));
	const decDigits = countNines(decPart);
	return {
		kind: "numeric",
		intDigits,
		decDigits,
		signed,
		maxLength: intDigits + decDigits + (decDigits > 0 ? 1 : 0) + (signed ? 1 : 0),
		raw
	};
}
var CobolParser = class {
	tokens;
	pos = 0;
	errors = [];
	constructor(tokens) {
		this.tokens = tokens;
	}
	peek(offset = 0) {
		return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
	}
	advance() {
		const tok = this.peek();
		if (this.pos < this.tokens.length - 1) this.pos += 1;
		return tok;
	}
	at(upper) {
		return this.peek().upper === upper;
	}
	consumeDotIfPresent() {
		while (this.peek().kind === "DOT") this.advance();
	}
	isParagraphHeaderAhead() {
		const cur = this.peek();
		const next = this.peek(1);
		return cur.kind === "WORD" && next.kind === "DOT" && !VERBS.has(cur.upper) && !BLOCK_ENDS.has(cur.upper) && cur.upper !== "DIVISION" && cur.upper !== "SECTION";
	}
	parse() {
		let programId = "COBOL-PROG";
		const dataItems = [];
		const paragraphs = [];
		while (this.peek().kind !== "EOF") {
			if (this.at("IDENTIFICATION") && this.peek(1).upper === "DIVISION") {
				this.advance();
				this.advance();
				this.consumeDotIfPresent();
				programId = this.parseIdentificationDivision(programId);
				continue;
			}
			if (this.at("DATA") && this.peek(1).upper === "DIVISION") {
				this.advance();
				this.advance();
				this.consumeDotIfPresent();
				dataItems.push(...this.parseDataDivision());
				continue;
			}
			if (this.at("PROCEDURE") && this.peek(1).upper === "DIVISION") {
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
			parseErrors: this.errors
		};
	}
	parseIdentificationDivision(defaultId) {
		let programId = defaultId;
		while (this.peek().kind !== "EOF" && !(this.at("DATA") && this.peek(1).upper === "DIVISION") && !(this.at("PROCEDURE") && this.peek(1).upper === "DIVISION")) {
			if (this.at("PROGRAM-ID")) {
				this.advance();
				this.consumeDotIfPresent();
				if (this.peek().kind === "WORD" || this.peek().kind === "STRING") programId = this.advance().upper;
				this.consumeDotIfPresent();
				continue;
			}
			this.advance();
		}
		return programId;
	}
	parseDataDivision() {
		const items = [];
		while (this.peek().kind !== "EOF" && !(this.at("PROCEDURE") && this.peek(1).upper === "DIVISION")) {
			if (this.at("WORKING-STORAGE") && this.peek(1).upper === "SECTION") {
				this.advance();
				this.advance();
				this.consumeDotIfPresent();
				continue;
			}
			const tok = this.peek();
			if (tok.kind === "NUMBER" && /^(?:0?[1-9]|[1-4]\d|77)$/.test(tok.value)) {
				const level = Number(this.advance().value);
				const line = tok.line;
				if (this.peek().kind !== "WORD") {
					this.advance();
					continue;
				}
				const name = this.advance().upper;
				const picTokens = [];
				let initialValue = "";
				let hasPic = false;
				while (this.peek().kind !== "EOF" && this.peek().kind !== "DOT") {
					if (this.at("PIC") || this.at("PICTURE")) {
						hasPic = true;
						this.advance();
						if (this.at("IS")) this.advance();
						while (this.peek().kind !== "EOF" && this.peek().kind !== "DOT" && !this.at("VALUE")) picTokens.push(this.advance().value);
						continue;
					}
					if (this.at("VALUE")) {
						this.advance();
						if (this.at("IS")) this.advance();
						const valTok = this.advance();
						if (valTok.kind === "NUMBER") initialValue = Number(valTok.value);
						else if (valTok.kind === "STRING") initialValue = valTok.value;
						else if (valTok.upper === "ZERO" || valTok.upper === "ZEROS" || valTok.upper === "ZEROES") initialValue = 0;
						else if (valTok.upper === "SPACE" || valTok.upper === "SPACES") initialValue = "";
						else initialValue = valTok.value;
						continue;
					}
					this.advance();
				}
				this.consumeDotIfPresent();
				if (hasPic && picTokens.length > 0) {
					const pic = parsePicSpec(picTokens);
					if (initialValue === "" && pic.kind === "numeric") initialValue = 0;
					items.push({
						level,
						name,
						pic,
						initialValue,
						line
					});
				}
				continue;
			}
			this.advance();
		}
		return items;
	}
	parseProcedureDivision() {
		const paragraphs = [];
		let currentPara = null;
		while (this.peek().kind !== "EOF") {
			this.consumeDotIfPresent();
			if (this.peek().kind === "EOF") break;
			if (this.isParagraphHeaderAhead()) {
				const nameTok = this.advance();
				this.consumeDotIfPresent();
				currentPara = {
					name: nameTok.upper,
					line: nameTok.line,
					statements: []
				};
				paragraphs.push(currentPara);
				continue;
			}
			if (!currentPara) {
				currentPara = {
					name: "MAIN-ENTRY",
					line: this.peek().line,
					statements: []
				};
				paragraphs.push(currentPara);
			}
			const stmt = this.parseStatement(false);
			if (stmt) currentPara.statements.push(stmt);
			this.consumeDotIfPresent();
		}
		return paragraphs;
	}
	parseBlock(stopTokens) {
		const stmts = [];
		while (this.peek().kind !== "EOF") {
			if (stopTokens.has(this.peek().upper) || this.isParagraphHeaderAhead()) break;
			if (this.peek().kind === "DOT") {
				if (stopTokens.has("DOT")) break;
				this.advance();
				continue;
			}
			const stmt = this.parseStatement(true);
			if (!stmt) break;
			stmts.push(stmt);
		}
		return stmts;
	}
	parseStatement(insideBlock) {
		const tok = this.peek();
		if (tok.kind === "EOF" || tok.kind === "DOT") return null;
		const line = tok.line;
		switch (tok.upper) {
			case "DISPLAY": {
				this.advance();
				const args = [];
				while (this.peek().kind !== "EOF" && this.peek().kind !== "DOT" && !BLOCK_ENDS.has(this.peek().upper) && !(insideBlock && VERBS.has(this.peek().upper)) && !(this.at("ON") && this.peek(1).upper === "SIZE")) args.push(this.parsePrimaryExpr());
				return {
					kind: "DISPLAY",
					args,
					line,
					text: `DISPLAY ${args.map(formatExpr).join(" ")}`
				};
			}
			case "MOVE": {
				this.advance();
				const source = this.parseSimpleValueExpr();
				if (this.at("TO")) this.advance();
				const target = this.advance().upper;
				return {
					kind: "MOVE",
					source,
					target,
					line,
					text: `MOVE ${formatExpr(source)} TO ${target}`
				};
			}
			case "ADD":
			case "SUBTRACT":
			case "MULTIPLY":
			case "DIVIDE": {
				const verb = this.advance().upper;
				const operands = [];
				while (this.peek().kind !== "EOF" && !this.at("TO") && !this.at("FROM") && !this.at("BY") && !this.at("INTO") && !this.at("GIVING")) operands.push(this.parseSimpleValueExpr());
				const prep = this.peek().upper;
				let target = "";
				let givingTarget;
				if (prep === "GIVING") {
					this.advance();
					givingTarget = this.advance().upper;
					target = givingTarget;
				} else {
					if (prep === "TO" || prep === "FROM" || prep === "BY" || prep === "INTO") this.advance();
					const targetExpr = this.parseSimpleValueExpr();
					target = targetExpr.kind === "identifier" ? targetExpr.name : "";
					if (this.at("GIVING")) {
						this.advance();
						givingTarget = this.advance().upper;
						operands.push(targetExpr);
						if (!target) target = givingTarget;
					} else if (!target) this.errors.push({
						line,
						message: `Expected target variable in ${verb}`
					});
				}
				const onSizeError = this.parseOptionalSizeError(verb);
				return {
					kind: "ARITH",
					verb,
					operands,
					target,
					givingTarget,
					onSizeError,
					line,
					text: `${verb} ${operands.map(formatExpr).join(" ")} ${givingTarget ? `GIVING ${givingTarget}` : `-> ${target}`}`
				};
			}
			case "COMPUTE": {
				this.advance();
				const target = this.advance().upper;
				if (this.at("=")) this.advance();
				const expr = this.parseArithExpr();
				return {
					kind: "COMPUTE",
					target,
					expr,
					onSizeError: this.parseOptionalSizeError("COMPUTE"),
					line,
					text: `COMPUTE ${target} = ${formatExpr(expr)}`
				};
			}
			case "IF": {
				this.advance();
				const condition = this.parseCondition();
				if (this.at("THEN")) this.advance();
				const thenBranch = this.parseBlock(/* @__PURE__ */ new Set([
					"ELSE",
					"END-IF",
					"DOT"
				]));
				let elseBranch = [];
				if (this.at("ELSE")) {
					this.advance();
					elseBranch = this.parseBlock(/* @__PURE__ */ new Set(["END-IF", "DOT"]));
				}
				if (this.at("END-IF")) this.advance();
				return {
					kind: "IF",
					condition,
					thenBranch,
					elseBranch,
					line,
					text: `IF ${formatCondition(condition)}`
				};
			}
			case "PERFORM": {
				this.advance();
				const paragraph = this.advance().upper;
				let times;
				let until;
				if (this.at("UNTIL")) {
					this.advance();
					until = this.parseCondition();
				} else if (this.peek().kind === "NUMBER" || this.peek().kind === "WORD") {
					if (this.peek(1).upper === "TIMES") {
						times = this.parseSimpleValueExpr();
						this.advance();
					}
				}
				return {
					kind: "PERFORM",
					paragraph,
					times,
					until,
					line,
					text: times ? `PERFORM ${paragraph} ${formatExpr(times)} TIMES` : until ? `PERFORM ${paragraph} UNTIL ${formatCondition(until)}` : `PERFORM ${paragraph}`
				};
			}
			case "GO": {
				this.advance();
				if (this.at("TO")) this.advance();
				const paragraph = this.advance().upper;
				return {
					kind: "GOTO",
					paragraph,
					line,
					text: `GO TO ${paragraph}`
				};
			}
			case "GOTO": {
				this.advance();
				const paragraph = this.advance().upper;
				return {
					kind: "GOTO",
					paragraph,
					line,
					text: `GO TO ${paragraph}`
				};
			}
			case "ALTER": {
				this.advance();
				const sourceParagraph = this.advance().upper;
				if (this.at("TO")) this.advance();
				if (this.at("PROCEED")) this.advance();
				if (this.at("TO")) this.advance();
				const targetParagraph = this.advance().upper;
				return {
					kind: "ALTER",
					sourceParagraph,
					targetParagraph,
					line,
					text: `ALTER ${sourceParagraph} TO PROCEED TO ${targetParagraph}`
				};
			}
			case "EXIT":
				this.advance();
				return {
					kind: "EXIT",
					line,
					text: "EXIT"
				};
			case "STOP":
				this.advance();
				if (this.at("RUN")) this.advance();
				return {
					kind: "STOP_RUN",
					line,
					text: "STOP RUN"
				};
			default:
				this.errors.push({
					line,
					message: `Unrecognized statement token "${tok.value}"`
				});
				this.advance();
				return null;
		}
	}
	parseOptionalSizeError(verb) {
		if (!(this.at("ON") && this.peek(1).upper === "SIZE")) {
			if (this.at(`END-${verb}`)) this.advance();
			return [];
		}
		this.advance();
		this.advance();
		if (this.at("ERROR")) this.advance();
		const endMarker = `END-${verb}`;
		const stmts = this.parseBlock(/* @__PURE__ */ new Set([endMarker, "DOT"]));
		if (this.at(endMarker)) this.advance();
		return stmts;
	}
	parseCondition() {
		let left = this.parseAndCondition();
		while (this.at("OR")) {
			this.advance();
			const right = this.parseAndCondition();
			left = {
				kind: "logic",
				op: "OR",
				left,
				right
			};
		}
		return left;
	}
	parseAndCondition() {
		let left = this.parseComparison();
		while (this.at("AND")) {
			this.advance();
			const right = this.parseComparison();
			left = {
				kind: "logic",
				op: "AND",
				left,
				right
			};
		}
		return left;
	}
	parseComparison() {
		const left = this.parseArithExpr();
		let op = "=";
		const isNot = this.at("NOT");
		if (isNot) this.advance();
		if (this.at("=") || this.at("EQUAL")) {
			this.advance();
			if (this.at("TO")) this.advance();
			op = isNot ? "!=" : "=";
		} else if (this.at(">") || this.at("GREATER")) {
			this.advance();
			if (this.at("THAN")) this.advance();
			op = isNot ? "<=" : ">";
		} else if (this.at("<") || this.at("LESS")) {
			this.advance();
			if (this.at("THAN")) this.advance();
			op = isNot ? ">=" : "<";
		} else if (this.at(">=")) {
			this.advance();
			op = ">=";
		} else if (this.at("<=")) {
			this.advance();
			op = "<=";
		} else if (this.at("!=") || this.at("<>")) {
			this.advance();
			op = "!=";
		}
		const right = this.parseArithExpr();
		return {
			kind: "compare",
			op,
			left,
			right
		};
	}
	parseArithExpr() {
		let left = this.parseTerm();
		while (this.at("+") || this.at("-")) {
			const op = this.advance().value;
			const right = this.parseTerm();
			left = {
				kind: "binary",
				op,
				left,
				right
			};
		}
		return left;
	}
	parseTerm() {
		let left = this.parsePower();
		while (this.at("*") || this.at("/")) {
			const op = this.advance().value;
			const right = this.parsePower();
			left = {
				kind: "binary",
				op,
				left,
				right
			};
		}
		return left;
	}
	parsePower() {
		const left = this.parsePrimaryExpr();
		if (this.at("**")) {
			this.advance();
			return {
				kind: "binary",
				op: "**",
				left,
				right: this.parsePower()
			};
		}
		return left;
	}
	parseSimpleValueExpr() {
		return this.parsePrimaryExpr();
	}
	parsePrimaryExpr() {
		const tok = this.peek();
		if (tok.kind === "NUMBER") {
			this.advance();
			return {
				kind: "number",
				value: Number(tok.value)
			};
		}
		if (tok.kind === "STRING") {
			this.advance();
			return {
				kind: "string",
				value: tok.value
			};
		}
		if (tok.kind === "LPAREN") {
			this.advance();
			const inner = this.parseArithExpr();
			if (this.peek().kind === "RPAREN") this.advance();
			return inner;
		}
		if (tok.kind === "OP" && tok.value === "-") {
			this.advance();
			return {
				kind: "unary",
				op: "-",
				expr: this.parsePrimaryExpr()
			};
		}
		if (tok.kind === "WORD") {
			this.advance();
			if (tok.upper === "ZERO" || tok.upper === "ZEROS" || tok.upper === "ZEROES") return {
				kind: "number",
				value: 0
			};
			if (tok.upper === "SPACE" || tok.upper === "SPACES") return {
				kind: "string",
				value: ""
			};
			return {
				kind: "identifier",
				name: tok.upper
			};
		}
		this.advance();
		return {
			kind: "number",
			value: 0
		};
	}
};
function formatExpr(expr) {
	switch (expr.kind) {
		case "number": return String(expr.value);
		case "string": return `"${expr.value}"`;
		case "identifier": return expr.name;
		case "unary": return `-${formatExpr(expr.expr)}`;
		case "binary": return `(${formatExpr(expr.left)} ${expr.op} ${formatExpr(expr.right)})`;
	}
}
function formatCondition(cond) {
	if (cond.kind === "logic") return `${formatCondition(cond.left)} ${cond.op} ${formatCondition(cond.right)}`;
	return `${formatExpr(cond.left)} ${cond.op} ${formatExpr(cond.right)}`;
}
function parseCobolSource(source) {
	return new CobolParser(tokenizeCobol(source)).parse();
}
// src/engine/interpreter.ts
var MAX_STEPS = 2e3;
function applyPicConstraint(raw, pic) {
	if (pic.kind === "alphanumeric") {
		const str = String(raw);
		const truncated = str.length > pic.maxLength;
		return {
			value: str.slice(0, pic.maxLength),
			truncated
		};
	}
	let num = typeof raw === "number" ? raw : Number(raw);
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
			truncated
		};
	}
	return {
		value: rounded,
		truncated
	};
}
function formatPicValue(value, pic) {
	if (pic.kind === "alphanumeric") return String(value);
	const num = typeof value === "number" ? value : Number(value) || 0;
	const neg = num < 0;
	const abs = Math.abs(num);
	if (pic.decDigits > 0) {
		const [whole, frac] = abs.toFixed(pic.decDigits).split(".");
		return `${neg ? "-" : ""}${whole.padStart(pic.intDigits, "0")}.${frac}`;
	}
	return `${neg ? "-" : ""}${Math.trunc(abs).toString().padStart(pic.intDigits, "0")}`;
}
function evalExpr(expr, vars) {
	switch (expr.kind) {
		case "number": return expr.value;
		case "string": return expr.value;
		case "identifier": return vars[expr.name] ?? 0;
		case "unary": return -(Number(evalExpr(expr.expr, vars)) || 0);
		case "binary": {
			const l = Number(evalExpr(expr.left, vars)) || 0;
			const r = Number(evalExpr(expr.right, vars)) || 0;
			switch (expr.op) {
				case "+": return l + r;
				case "-": return l - r;
				case "*": return l * r;
				case "/": return r === 0 ? 0 : l / r;
				case "**": return l ** r;
			}
		}
	}
}
function evalCondition(cond, vars) {
	if (cond.kind === "logic") {
		const l = evalCondition(cond.left, vars);
		return cond.op === "AND" ? l && evalCondition(cond.right, vars) : l || evalCondition(cond.right, vars);
	}
	const lRaw = evalExpr(cond.left, vars);
	const rRaw = evalExpr(cond.right, vars);
	const bothNum = typeof lRaw === "number" || typeof rRaw === "number";
	const l = bothNum ? Number(lRaw) || 0 : String(lRaw);
	const r = bothNum ? Number(rRaw) || 0 : String(rRaw);
	switch (cond.op) {
		case "=": return l === r;
		case "!=": return l !== r;
		case ">": return l > r;
		case "<": return l < r;
		case ">=": return l >= r;
		case "<=": return l <= r;
	}
}
function assignVar(ctx, targetName, nextRaw, changedKeys, line, guardSizeError) {
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
		ctx.warnings.push(`Line ${line}: Silent PIC truncation/wrap on ${targetName} (PIC ${item.pic.raw}) stored ${String(value)}.`);
	}
	ctx.vars[targetName] = value;
	changedKeys.push(targetName);
	return false;
}
function recordStep(ctx, line, paragraph, statementText, changedKeys) {
	if (ctx.steps.length >= MAX_STEPS) {
		ctx.halted = true;
		ctx.haltedReason = "MAX_STEPS";
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
		warnings: [...ctx.warnings]
	});
}
function runStatementList(ctx, paraName, stmts) {
	for (const stmt of stmts) {
		if (ctx.halted || ctx.gotoTarget) return;
		if (ctx.steps.length >= MAX_STEPS) {
			ctx.halted = true;
			ctx.haltedReason = "MAX_STEPS";
			return;
		}
		const changedKeys = [];
		switch (stmt.kind) {
			case "DISPLAY": {
				const rendered = stmt.args.map((arg) => {
					if (arg.kind === "identifier") {
						const item = ctx.dataMap.get(arg.name);
						const val = ctx.vars[arg.name] ?? "";
						return item ? formatPicValue(val, item.pic) : String(val);
					}
					return String(evalExpr(arg, ctx.vars));
				}).join("");
				ctx.output.push(rendered);
				recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
				break;
			}
			case "MOVE": {
				const val = evalExpr(stmt.source, ctx.vars);
				assignVar(ctx, stmt.target, val, changedKeys, stmt.line, false);
				recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
				break;
			}
			case "ARITH": {
				const vals = stmt.operands.map((o) => Number(evalExpr(o, ctx.vars)) || 0);
				const curTarget = Number(ctx.vars[stmt.target] ?? 0) || 0;
				let nextVal = curTarget;
				if (stmt.givingTarget) {
					if (stmt.verb === "ADD") nextVal = vals.reduce((a, b) => a + b, 0);
					else if (stmt.verb === "SUBTRACT") nextVal = (vals[1] ?? 0) - (vals[0] ?? 0);
					else if (stmt.verb === "MULTIPLY") nextVal = vals.reduce((a, b) => a * b, 1);
					else if (stmt.verb === "DIVIDE") nextVal = (vals[1] ?? 0) === 0 ? 0 : (vals[0] ?? 0) / (vals[1] ?? 1);
					const dest = stmt.givingTarget;
					const sizeErr = assignVar(ctx, dest, nextVal, changedKeys, stmt.line, stmt.onSizeError.length > 0);
					recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
					if (sizeErr) runStatementList(ctx, paraName, stmt.onSizeError);
				} else {
					const sumOps = vals.reduce((a, b) => a + b, 0);
					if (stmt.verb === "ADD") nextVal = curTarget + sumOps;
					else if (stmt.verb === "SUBTRACT") nextVal = curTarget - sumOps;
					else if (stmt.verb === "MULTIPLY") nextVal = curTarget * vals.reduce((a, b) => a * b, 1);
					else if (stmt.verb === "DIVIDE") {
						const divisor = vals[0] ?? 1;
						if (divisor === 0 && stmt.onSizeError.length > 0) {
							recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
							runStatementList(ctx, paraName, stmt.onSizeError);
							break;
						}
						nextVal = divisor === 0 ? curTarget : curTarget / divisor;
					}
					const sizeErr = assignVar(ctx, stmt.target, nextVal, changedKeys, stmt.line, stmt.onSizeError.length > 0);
					recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
					if (sizeErr) runStatementList(ctx, paraName, stmt.onSizeError);
				}
				break;
			}
			case "COMPUTE": {
				const val = Number(evalExpr(stmt.expr, ctx.vars)) || 0;
				const sizeErr = assignVar(ctx, stmt.target, val, changedKeys, stmt.line, stmt.onSizeError.length > 0);
				recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
				if (sizeErr) runStatementList(ctx, paraName, stmt.onSizeError);
				break;
			}
			case "IF": {
				const ok = evalCondition(stmt.condition, ctx.vars);
				recordStep(ctx, stmt.line, paraName, `${stmt.text} [${ok ? "TRUE" : "FALSE"}]`, changedKeys);
				runStatementList(ctx, paraName, ok ? stmt.thenBranch : stmt.elseBranch);
				break;
			}
			case "PERFORM": {
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
			case "GOTO": {
				const redirected = ctx.alterRedirects.get(paraName) ?? stmt.paragraph;
				recordStep(ctx, stmt.line, paraName, `GO TO ${redirected}`, changedKeys);
				ctx.gotoTarget = redirected;
				return;
			}
			case "ALTER":
				ctx.alterRedirects.set(stmt.sourceParagraph, stmt.targetParagraph);
				ctx.warnings.push(`Line ${stmt.line}: Self-modifying ALTER redirected ${stmt.sourceParagraph} -> ${stmt.targetParagraph}.`);
				recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
				break;
			case "EXIT":
				recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
				return;
			case "STOP_RUN":
				recordStep(ctx, stmt.line, paraName, stmt.text, changedKeys);
				ctx.halted = true;
				ctx.haltedReason = "STOP_RUN";
				return;
		}
	}
}
function executeCobolProgram(program) {
	const dataMap = /* @__PURE__ */ new Map();
	const vars = {};
	const truncFlags = {};
	for (const item of program.dataItems) {
		dataMap.set(item.name, item);
		const { value, truncated } = applyPicConstraint(item.initialValue, item.pic);
		vars[item.name] = value;
		truncFlags[item.name] = truncated;
	}
	const ctx = {
		program,
		dataMap,
		vars,
		truncFlags,
		alterRedirects: /* @__PURE__ */ new Map(),
		output: [],
		warnings: [],
		steps: [],
		halted: false,
		haltedReason: "END_OF_PROGRAM",
		gotoTarget: null
	};
	if (program.parseErrors.length > 0 && program.paragraphs.length === 0) return {
		programId: program.programId,
		haltedReason: "PARSE_ERROR",
		output: [],
		steps: [],
		finalVariables: [],
		warnings: [],
		parseErrors: program.parseErrors
	};
	let idx = 0;
	while (idx < program.paragraphs.length && !ctx.halted) {
		if (ctx.steps.length >= MAX_STEPS) {
			ctx.halted = true;
			ctx.haltedReason = "MAX_STEPS";
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
	const finalVariables = program.dataItems.map((item) => {
		const val = ctx.vars[item.name] ?? item.initialValue;
		return {
			name: item.name,
			pic: item.pic.raw,
			value: val,
			formatted: formatPicValue(val, item.pic),
			truncated: Boolean(ctx.truncFlags[item.name])
		};
	});
	return {
		programId: program.programId,
		haltedReason: ctx.haltedReason,
		output: ctx.output,
		steps: ctx.steps,
		finalVariables,
		warnings: ctx.warnings,
		parseErrors: program.parseErrors
	};
}
function executeCobolSource(source) {
	return executeCobolProgram(parseCobolSource(source));
}
// src/engine/exorcist.ts
function inferSourcePrecision(expr, dataMap) {
	switch (expr.kind) {
		case "number": {
			const [whole, dec] = String(Math.abs(expr.value)).split(".");
			return {
				intDigits: whole.length,
				decDigits: dec ? dec.length : 0
			};
		}
		case "identifier": {
			const item = dataMap.get(expr.name);
			return item ? {
				intDigits: item.pic.intDigits,
				decDigits: item.pic.decDigits
			} : {
				intDigits: 4,
				decDigits: 0
			};
		}
		case "unary": return inferSourcePrecision(expr.expr, dataMap);
		case "binary": {
			const l = inferSourcePrecision(expr.left, dataMap);
			const r = inferSourcePrecision(expr.right, dataMap);
			if (expr.op === "/") return {
				intDigits: Math.max(l.intDigits, r.intDigits),
				decDigits: Math.max(2, l.decDigits)
			};
			return {
				intDigits: Math.max(l.intDigits, r.intDigits) + 1,
				decDigits: Math.max(l.decDigits, r.decDigits)
			};
		}
		case "string": return {
			intDigits: 0,
			decDigits: 0
		};
	}
}
function paragraphEndsWithJumpOrStop(stmts) {
	const last = stmts[stmts.length - 1];
	if (!last) return false;
	return last.kind === "STOP_RUN" || last.kind === "GOTO";
}
function analyzeCobolProgram(program) {
	const curses = [];
	const dataMap = /* @__PURE__ */ new Map();
	for (const item of program.dataItems) {
		dataMap.set(item.name, item);
		if (item.pic.kind === "numeric" && item.pic.intDigits <= 2 && /(YEAR|YR|YY|DATE)/i.test(item.name)) curses.push({
			id: `y2k-${item.name}-${item.line}`,
			code: "CURSE-Y2K",
			severity: "HIGH",
			line: item.line,
			paragraph: "WORKING-STORAGE",
			title: `Y2K 2-Digit Year Field (${item.name})`,
			detail: `${item.name} uses PIC ${item.pic.raw}, wrapping 99 + 2 silently to 01.`,
			remediation: `Widen ${item.name} to PIC 9(4) and store explicit 4-digit years.`
		});
	}
	const edges = [];
	const paraNames = program.paragraphs.map((p) => p.name);
	const inspectStatements = (paraName, stmts) => {
		for (const stmt of stmts) {
			if (stmt.kind === "ALTER") curses.push({
				id: `alter-${stmt.line}`,
				code: "CURSE-ALTER",
				severity: "CRITICAL",
				line: stmt.line,
				paragraph: paraName,
				title: "Self-Modifying ALTER Control Flow",
				detail: `ALTER mutates ${stmt.sourceParagraph} jump target to ${stmt.targetParagraph} at runtime.`,
				remediation: "Replace ALTER with explicit EVALUATE or structured PERFORM calls."
			});
			if (stmt.kind === "GOTO") {
				edges.push({
					from: paraName,
					to: stmt.paragraph,
					kind: "GOTO",
					line: stmt.line
				});
				curses.push({
					id: `goto-${stmt.line}`,
					code: "CURSE-GOTO",
					severity: "HIGH",
					line: stmt.line,
					paragraph: paraName,
					title: `Unstructured GO TO Transfer (-> ${stmt.paragraph})`,
					detail: `Spaghetti branch from ${paraName} into ${stmt.paragraph} bypasses structured return.`,
					remediation: `Replace GO TO ${stmt.paragraph} with structured PERFORM ${stmt.paragraph}.`
				});
			}
			if (stmt.kind === "PERFORM") edges.push({
				from: paraName,
				to: stmt.paragraph,
				kind: "PERFORM",
				line: stmt.line
			});
			if (stmt.kind === "ARITH") {
				if ((stmt.verb === "ADD" || stmt.verb === "MULTIPLY") && stmt.onSizeError.length === 0) {
					const destName = stmt.givingTarget ?? stmt.target;
					const destItem = dataMap.get(destName);
					if (destItem && destItem.pic.intDigits <= 4) curses.push({
						id: `overflow-${stmt.line}-${destName}`,
						code: "CURSE-OVERFLOW",
						severity: "MEDIUM",
						line: stmt.line,
						paragraph: paraName,
						title: `Unguarded ${stmt.verb} Overflow Risk on ${destName}`,
						detail: `${destName} (PIC ${destItem.pic.raw}) lacks an ON SIZE ERROR handler.`,
						remediation: `Add ON SIZE ERROR handling or widen ${destName}.`
					});
				}
			}
			if (stmt.kind === "COMPUTE") {
				const destItem = dataMap.get(stmt.target);
				if (stmt.onSizeError.length === 0 && destItem && destItem.pic.intDigits <= 4) curses.push({
					id: `overflow-comp-${stmt.line}`,
					code: "CURSE-OVERFLOW",
					severity: "MEDIUM",
					line: stmt.line,
					paragraph: paraName,
					title: `Unguarded COMPUTE Overflow Risk on ${stmt.target}`,
					detail: `COMPUTE into ${stmt.target} (PIC ${destItem.pic.raw}) can silently wrap without ON SIZE ERROR.`,
					remediation: `Guard COMPUTE ${stmt.target} with ON SIZE ERROR and END-COMPUTE.`
				});
				if (destItem && destItem.pic.kind === "numeric") {
					const srcPrec = inferSourcePrecision(stmt.expr, dataMap);
					if (srcPrec.decDigits > destItem.pic.decDigits) curses.push({
						id: `prec-comp-${stmt.line}`,
						code: "CURSE-PRECISION",
						severity: "HIGH",
						line: stmt.line,
						paragraph: paraName,
						title: `Decimal Precision Loss into ${stmt.target}`,
						detail: `Expression computes fractional precision (${srcPrec.decDigits} decimals) into PIC ${destItem.pic.raw}.`,
						remediation: `Store result in a decimal field (e.g. PIC 9(${destItem.pic.intDigits})V99).`
					});
				}
			}
			if (stmt.kind === "MOVE") {
				const destItem = dataMap.get(stmt.target);
				if (destItem && destItem.pic.kind === "numeric" && stmt.source.kind !== "string") {
					if (inferSourcePrecision(stmt.source, dataMap).decDigits > destItem.pic.decDigits) curses.push({
						id: `prec-move-${stmt.line}`,
						code: "CURSE-PRECISION",
						severity: "HIGH",
						line: stmt.line,
						paragraph: paraName,
						title: `Fractional Truncation on MOVE to ${stmt.target}`,
						detail: `Moving higher-precision value into ${stmt.target} (PIC ${destItem.pic.raw}) discards decimals.`,
						remediation: `Use matching decimal scale on ${stmt.target}.`
					});
				}
			}
			if (stmt.kind === "IF") {
				inspectStatements(paraName, stmt.thenBranch);
				inspectStatements(paraName, stmt.elseBranch);
			} else if ((stmt.kind === "ARITH" || stmt.kind === "COMPUTE") && stmt.onSizeError.length > 0) inspectStatements(paraName, stmt.onSizeError);
		}
	};
	for (let i = 0; i < program.paragraphs.length; i += 1) {
		const para = program.paragraphs[i];
		inspectStatements(para.name, para.statements);
		if (i + 1 < program.paragraphs.length && !paragraphEndsWithJumpOrStop(para.statements)) edges.push({
			from: para.name,
			to: program.paragraphs[i + 1].name,
			kind: "FALLTHROUGH",
			line: para.line
		});
	}
	const reachable = /* @__PURE__ */ new Set();
	if (paraNames.length > 0) {
		const queue = [paraNames[0]];
		reachable.add(paraNames[0]);
		while (queue.length > 0) {
			const cur = queue.shift();
			for (const edge of edges) if (edge.from === cur && !reachable.has(edge.to) && paraNames.includes(edge.to)) {
				reachable.add(edge.to);
				queue.push(edge.to);
			}
		}
	}
	const ghostParagraphs = paraNames.filter((name) => !reachable.has(name));
	for (const ghostName of ghostParagraphs) {
		const para = program.paragraphs.find((p) => p.name === ghostName);
		curses.push({
			id: `ghost-${ghostName}`,
			code: "CURSE-GHOST-PARA",
			severity: "MEDIUM",
			line: para?.line ?? 1,
			paragraph: ghostName,
			title: `Unreachable Ghost Paragraph (${ghostName})`,
			detail: `${ghostName} is never reached by entry fall-through, PERFORM, or GO TO.`,
			remediation: `Delete dead paragraph ${ghostName} or invoke it explicitly via PERFORM.`
		});
	}
	const weights = {
		CRITICAL: 30,
		HIGH: 20,
		MEDIUM: 12,
		LOW: 5
	};
	const hauntingScore = Math.min(100, curses.reduce((sum, c) => sum + weights[c.severity], 0));
	const grade = hauntingScore === 0 ? "EXORCISED" : hauntingScore <= 25 ? "MILDLY HAUNTED" : hauntingScore <= 60 ? "CURSED" : "POSSESSED";
	const severityOrder = {
		CRITICAL: 0,
		HIGH: 1,
		MEDIUM: 2,
		LOW: 3
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
		edges
	};
}
function analyzeCobolSource(source) {
	return analyzeCobolProgram(parseCobolSource(source));
}
// src/engine/transpiler.ts
function toCamelCase(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+([a-z0-9])/g, (_, ch) => ch.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
}
function toPascalCase(name) {
	const camel = toCamelCase(name);
	return camel ? camel[0].toUpperCase() + camel.slice(1) : "Program";
}
function toSnakeCase(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "program";
}
function tsExpr(expr) {
	switch (expr.kind) {
		case "number": return String(expr.value);
		case "string": return JSON.stringify(expr.value);
		case "identifier": return `state[${JSON.stringify(expr.name)}]`;
		case "unary": return `(-Number(${tsExpr(expr.expr)}))`;
		case "binary": return `(Number(${tsExpr(expr.left)}) ${expr.op} Number(${tsExpr(expr.right)}))`;
	}
}
function tsCond(cond) {
	if (cond.kind === "logic") {
		const op = cond.op === "AND" ? "&&" : "||";
		return `(${tsCond(cond.left)} ${op} ${tsCond(cond.right)})`;
	}
	const op = cond.op === "=" ? "===" : cond.op === "!=" ? "!==" : cond.op;
	return `(${tsExpr(cond.left)} ${op} ${tsExpr(cond.right)})`;
}
function emitTsStatements(stmts, indent, out) {
	for (const stmt of stmts) switch (stmt.kind) {
		case "DISPLAY": {
			const parts = stmt.args.map((arg) => arg.kind === "identifier" ? `fmtPic(state[${JSON.stringify(arg.name)}], PIC[${JSON.stringify(arg.name)}])` : `String(${tsExpr(arg)})`);
			out.push(`${indent}output.push(${parts.join(" + ") || "\"\""});`);
			break;
		}
		case "MOVE":
			out.push(`${indent}assignVar(${JSON.stringify(stmt.target)}, ${tsExpr(stmt.source)});`);
			break;
		case "ARITH": {
			const dest = stmt.givingTarget ?? stmt.target;
			const vals = stmt.operands.map((o) => `Number(${tsExpr(o)})`);
			let exprStr = "0";
			if (stmt.givingTarget) {
				if (stmt.verb === "ADD") exprStr = vals.join(" + ");
				else if (stmt.verb === "SUBTRACT") exprStr = `(${vals[1] ?? "0"} - ${vals[0] ?? "0"})`;
				else if (stmt.verb === "MULTIPLY") exprStr = vals.join(" * ");
				else exprStr = `(${vals[1] ?? "0"} === 0 ? 0 : ${vals[0] ?? "0"} / ${vals[1] ?? "1"})`;
			} else {
				const cur = `Number(state[${JSON.stringify(stmt.target)}])`;
				if (stmt.verb === "ADD") exprStr = `${cur} + ${vals.join(" + ")}`;
				else if (stmt.verb === "SUBTRACT") exprStr = `${cur} - (${vals.join(" + ")})`;
				else if (stmt.verb === "MULTIPLY") exprStr = `${cur} * ${vals.join(" * ")}`;
				else exprStr = `(${vals[0] ?? "1"} === 0 ? ${cur} : ${cur} / ${vals[0] ?? "1"})`;
			}
			out.push(`${indent}assignVar(${JSON.stringify(dest)}, ${exprStr});`);
			break;
		}
		case "COMPUTE":
			out.push(`${indent}assignVar(${JSON.stringify(stmt.target)}, ${tsExpr(stmt.expr)});`);
			break;
		case "IF":
			out.push(`${indent}if (${tsCond(stmt.condition)}) {`);
			emitTsStatements(stmt.thenBranch, `${indent}  `, out);
			if (stmt.elseBranch.length > 0) {
				out.push(`${indent}} else {`);
				emitTsStatements(stmt.elseBranch, `${indent}  `, out);
			}
			out.push(`${indent}}`);
			break;
		case "PERFORM": {
			const fn = `para_${toSnakeCase(stmt.paragraph)}`;
			if (stmt.times) {
				out.push(`${indent}for (let i = 0; i < Number(${tsExpr(stmt.times)}); i += 1) {`);
				out.push(`${indent}  ${fn}();`);
				out.push(`${indent}}`);
			} else if (stmt.until) {
				out.push(`${indent}while (!(${tsCond(stmt.until)})) {`);
				out.push(`${indent}  ${fn}();`);
				out.push(`${indent}}`);
			} else out.push(`${indent}${fn}();`);
			break;
		}
		case "GOTO":
			out.push(`${indent}// LEGACY JUMP: ${formatExpr({
				kind: "identifier",
				name: stmt.paragraph
			})}`);
			out.push(`${indent}nextParagraph = ${JSON.stringify(stmt.paragraph)}; return;`);
			break;
		case "STOP_RUN":
			out.push(`${indent}halted = true; return;`);
			break;
		default: out.push(`${indent}// ${stmt.text}`);
	}
}
function generateTypeScript(program) {
	const fnName = `run${toPascalCase(program.programId)}`;
	const lines = [
		`// Transpiled deterministically from COBOL program ${program.programId}`,
		`export function ${fnName}(): { output: string[]; state: Record<string, string | number> } {`,
		`  const PIC: Record<string, { kind: 'numeric' | 'alphanumeric'; intDigits: number; decDigits: number; signed: boolean; maxLength: number }> = {`
	];
	for (const item of program.dataItems) lines.push(`    ${JSON.stringify(item.name)}: { kind: ${JSON.stringify(item.pic.kind)}, intDigits: ${item.pic.intDigits}, decDigits: ${item.pic.decDigits}, signed: ${item.pic.signed}, maxLength: ${item.pic.maxLength} },`);
	lines.push(`  };`);
	lines.push(`  const state: Record<string, string | number> = {`);
	for (const item of program.dataItems) {
		const val = typeof item.initialValue === "number" ? item.initialValue : JSON.stringify(item.initialValue);
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
		emitTsStatements(para.statements, "    ", lines);
		lines.push(`  }`);
	}
	lines.push(`  const order = [${program.paragraphs.map((p) => JSON.stringify(p.name)).join(", ")}];`);
	lines.push(`  const dispatch: Record<string, () => void> = {`);
	for (const para of program.paragraphs) lines.push(`    ${JSON.stringify(para.name)}: para_${toSnakeCase(para.name)},`);
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
	return lines.join("\n");
}
function pyExpr(expr) {
	switch (expr.kind) {
		case "number": return String(expr.value);
		case "string": return JSON.stringify(expr.value);
		case "identifier": return `state[${JSON.stringify(expr.name)}]`;
		case "unary": return `(-float(${pyExpr(expr.expr)}))`;
		case "binary": return `(float(${pyExpr(expr.left)}) ${expr.op} float(${pyExpr(expr.right)}))`;
	}
}
function pyCond(cond) {
	if (cond.kind === "logic") {
		const op = cond.op === "AND" ? "and" : "or";
		return `(${pyCond(cond.left)} ${op} ${pyCond(cond.right)})`;
	}
	const op = cond.op === "=" ? "==" : cond.op;
	return `(${pyExpr(cond.left)} ${op} ${pyExpr(cond.right)})`;
}
function emitPyStatements(stmts, indent, out) {
	if (stmts.length === 0) {
		out.push(`${indent}pass`);
		return;
	}
	for (const stmt of stmts) switch (stmt.kind) {
		case "DISPLAY": {
			const parts = stmt.args.map((arg) => arg.kind === "identifier" ? `fmt_pic(state[${JSON.stringify(arg.name)}], PIC.get(${JSON.stringify(arg.name)}))` : `str(${pyExpr(arg)})`);
			out.push(`${indent}output.append(${parts.join(" + ") || "\"\""})`);
			break;
		}
		case "MOVE":
			out.push(`${indent}assign_var(${JSON.stringify(stmt.target)}, ${pyExpr(stmt.source)})`);
			break;
		case "ARITH": {
			const dest = stmt.givingTarget ?? stmt.target;
			const vals = stmt.operands.map((o) => `float(${pyExpr(o)})`);
			let exprStr = "0";
			if (stmt.givingTarget) {
				if (stmt.verb === "ADD") exprStr = vals.join(" + ");
				else if (stmt.verb === "SUBTRACT") exprStr = `(${vals[1] ?? "0"} - ${vals[0] ?? "0"})`;
				else if (stmt.verb === "MULTIPLY") exprStr = vals.join(" * ");
				else exprStr = `(0 if ${vals[1] ?? "0"} == 0 else ${vals[0] ?? "0"} / ${vals[1] ?? "1"})`;
			} else {
				const cur = `float(state[${JSON.stringify(stmt.target)}])`;
				if (stmt.verb === "ADD") exprStr = `${cur} + ${vals.join(" + ")}`;
				else if (stmt.verb === "SUBTRACT") exprStr = `${cur} - (${vals.join(" + ")})`;
				else if (stmt.verb === "MULTIPLY") exprStr = `${cur} * ${vals.join(" * ")}`;
				else exprStr = `(${cur} if ${vals[0] ?? "1"} == 0 else ${cur} / ${vals[0] ?? "1"})`;
			}
			out.push(`${indent}assign_var(${JSON.stringify(dest)}, ${exprStr})`);
			break;
		}
		case "COMPUTE":
			out.push(`${indent}assign_var(${JSON.stringify(stmt.target)}, ${pyExpr(stmt.expr)})`);
			break;
		case "IF":
			out.push(`${indent}if ${pyCond(stmt.condition)}:`);
			emitPyStatements(stmt.thenBranch, `${indent}    `, out);
			if (stmt.elseBranch.length > 0) {
				out.push(`${indent}else:`);
				emitPyStatements(stmt.elseBranch, `${indent}    `, out);
			}
			break;
		case "PERFORM": {
			const fn = `para_${toSnakeCase(stmt.paragraph)}`;
			if (stmt.times) {
				out.push(`${indent}for _ in range(int(${pyExpr(stmt.times)})):`);
				out.push(`${indent}    ${fn}()`);
			} else if (stmt.until) {
				out.push(`${indent}while not (${pyCond(stmt.until)}):`);
				out.push(`${indent}    ${fn}()`);
			} else out.push(`${indent}${fn}()`);
			break;
		}
		case "GOTO":
			out.push(`${indent}next_para[0] = ${JSON.stringify(stmt.paragraph)}`);
			out.push(`${indent}return`);
			break;
		case "STOP_RUN":
			out.push(`${indent}halted[0] = True`);
			out.push(`${indent}return`);
			break;
		default: out.push(`${indent}# ${formatCondition({
			kind: "compare",
			op: "=",
			left: {
				kind: "number",
				value: 0
			},
			right: {
				kind: "number",
				value: 0
			}
		})}`);
	}
}
function generatePython(program) {
	const fnName = `run_${toSnakeCase(program.programId)}`;
	const lines = [
		`# Transpiled deterministically from COBOL program ${program.programId}`,
		`def ${fnName}() -> dict:`,
		`    PIC = {`
	];
	for (const item of program.dataItems) lines.push(`        ${JSON.stringify(item.name)}: (${JSON.stringify(item.pic.kind)}, ${item.pic.intDigits}, ${item.pic.decDigits}, ${item.pic.signed ? "True" : "False"}, ${item.pic.maxLength}),`);
	lines.push(`    }`);
	lines.push(`    state = {`);
	for (const item of program.dataItems) {
		const val = typeof item.initialValue === "number" ? item.initialValue : JSON.stringify(item.initialValue);
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
		emitPyStatements(para.statements, "        ", lines);
	}
	lines.push(`    order = [${program.paragraphs.map((p) => JSON.stringify(p.name)).join(", ")}]`);
	lines.push(`    dispatch = {${program.paragraphs.map((p) => `${JSON.stringify(p.name)}: para_${toSnakeCase(p.name)}`).join(", ")}}`);
	lines.push(`    idx = 0`);
	lines.push(`    while idx < len(order) and not halted[0]:`);
	lines.push(`        next_para[0] = None`);
	lines.push(`        dispatch[order[idx]]()`);
	lines.push(`        if next_para[0] in dispatch:`);
	lines.push(`            idx = order.index(next_para[0])`);
	lines.push(`            continue`);
	lines.push(`        idx += 1`);
	lines.push(`    return {"output": output, "state": state}`);
	return lines.join("\n");
}
function runIndependentModernModel(program) {
	const dataMap = /* @__PURE__ */ new Map();
	const state = {};
	for (const item of program.dataItems) {
		dataMap.set(item.name, item);
		state[item.name] = applyPicConstraint(item.initialValue, item.pic).value;
	}
	const output = [];
	let halted = false;
	let nextPara = null;
	let guard = 0;
	const evalModernExpr = (expr) => {
		switch (expr.kind) {
			case "number": return expr.value;
			case "string": return expr.value;
			case "identifier": return state[expr.name] ?? 0;
			case "unary": return -(Number(evalModernExpr(expr.expr)) || 0);
			case "binary": {
				const l = Number(evalModernExpr(expr.left)) || 0;
				const r = Number(evalModernExpr(expr.right)) || 0;
				if (expr.op === "+") return l + r;
				if (expr.op === "-") return l - r;
				if (expr.op === "*") return l * r;
				if (expr.op === "/") return r === 0 ? 0 : l / r;
				return l ** r;
			}
		}
	};
	const evalModernCond = (cond) => {
		if (cond.kind === "logic") {
			const l = evalModernCond(cond.left);
			return cond.op === "AND" ? l && evalModernCond(cond.right) : l || evalModernCond(cond.right);
		}
		const lRaw = evalModernExpr(cond.left);
		const rRaw = evalModernExpr(cond.right);
		const num = typeof lRaw === "number" || typeof rRaw === "number";
		const l = num ? Number(lRaw) || 0 : String(lRaw);
		const r = num ? Number(rRaw) || 0 : String(rRaw);
		if (cond.op === "=") return l === r;
		if (cond.op === "!=") return l !== r;
		if (cond.op === ">") return l > r;
		if (cond.op === "<") return l < r;
		if (cond.op === ">=") return l >= r;
		return l <= r;
	};
	const assign = (name, val, hasSizeErr) => {
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
	const execBlock = (stmts) => {
		for (const s of stmts) {
			if (halted || nextPara || ++guard > 2e3) return;
			if (s.kind === "DISPLAY") output.push(s.args.map((a) => a.kind === "identifier" ? formatPicValue(state[a.name] ?? "", dataMap.get(a.name)?.pic ?? {
				kind: "alphanumeric",
				intDigits: 0,
				decDigits: 0,
				signed: false,
				maxLength: 64,
				raw: "X(64)"
			}) : String(evalModernExpr(a))).join(""));
			else if (s.kind === "MOVE") assign(s.target, evalModernExpr(s.source), false);
			else if (s.kind === "ARITH") {
				const vals = s.operands.map((o) => Number(evalModernExpr(o)) || 0);
				const dest = s.givingTarget ?? s.target;
				const cur = Number(state[s.target] ?? 0) || 0;
				let next = cur;
				if (s.givingTarget) {
					if (s.verb === "ADD") next = vals.reduce((a, b) => a + b, 0);
					else if (s.verb === "SUBTRACT") next = (vals[1] ?? 0) - (vals[0] ?? 0);
					else if (s.verb === "MULTIPLY") next = vals.reduce((a, b) => a * b, 1);
					else next = (vals[1] ?? 0) === 0 ? 0 : (vals[0] ?? 0) / (vals[1] ?? 1);
				} else if (s.verb === "ADD") next = cur + vals.reduce((a, b) => a + b, 0);
				else if (s.verb === "SUBTRACT") next = cur - vals.reduce((a, b) => a + b, 0);
				else if (s.verb === "MULTIPLY") next = cur * vals.reduce((a, b) => a * b, 1);
				else next = (vals[0] ?? 1) === 0 ? cur : cur / (vals[0] ?? 1);
				if (assign(dest, next, s.onSizeError.length > 0)) execBlock(s.onSizeError);
			} else if (s.kind === "COMPUTE") {
				if (assign(s.target, Number(evalModernExpr(s.expr)) || 0, s.onSizeError.length > 0)) execBlock(s.onSizeError);
			} else if (s.kind === "IF") execBlock(evalModernCond(s.condition) ? s.thenBranch : s.elseBranch);
			else if (s.kind === "PERFORM") {
				const p = program.paragraphs.find((item) => item.name === s.paragraph);
				if (!p) continue;
				if (s.times) {
					const n = Math.max(0, Math.min(500, Math.trunc(Number(evalModernExpr(s.times)) || 0)));
					for (let i = 0; i < n; i += 1) {
						if (halted || nextPara) break;
						execBlock(p.statements);
					}
				} else if (s.until) while (!evalModernCond(s.until) && !halted && !nextPara && guard <= 2e3) execBlock(p.statements);
				else execBlock(p.statements);
			} else if (s.kind === "GOTO") {
				nextPara = s.paragraph;
				return;
			} else if (s.kind === "STOP_RUN") {
				halted = true;
				return;
			}
		}
	};
	let idx = 0;
	while (idx < program.paragraphs.length && !halted && guard <= 2e3) {
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
function verifyParity(source) {
	const program = parseCobolSource(source);
	const cobolExec = executeCobolProgram(program);
	const modernOutput = runIndependentModernModel(program);
	const maxLen = Math.max(cobolExec.output.length, modernOutput.length);
	const lineDiffs = [];
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
			matches: ok
		});
	}
	return {
		passed: maxLen === 0 ? true : matches === maxLen,
		matchPct: maxLen === 0 ? 100 : Math.round(matches / maxLen * 100),
		cobolOutput: cobolExec.output,
		modernOutput,
		lineDiffs
	};
}
function transpileCobolSource(source) {
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
		parity
	};
}
// src/engine/samples.ts
var COBOL_SAMPLES = [
	{
		id: "bank-y2k-1994",
		title: "BANK-Y2K-1994 (Maturity Rollover Bug)",
		era: "1994 Mainframe Batch",
		summary: "Demonstrates silent 2-digit Y2K year rollover (99 + 2 = 01), unguarded overflow, and an unreachable ghost paragraph.",
		source: `000100 IDENTIFICATION DIVISION.
000200 PROGRAM-ID. BANK-Y2K-1994.
000300 DATA DIVISION.
000400 WORKING-STORAGE SECTION.
000500 01 WS-OPEN-YEAR    PIC 99     VALUE 99.
000600 01 WS-TERM-YEARS   PIC 99     VALUE 2.
000700 01 WS-MATURE-YEAR  PIC 99     VALUE 0.
000800 01 WS-PRINCIPAL    PIC 9(4)   VALUE 8500.
000900 01 WS-INTEREST     PIC 9(4)   VALUE 0.
001000 01 WS-STATUS       PIC X(20)  VALUE "ACTIVE-ACCOUNT".
001100 PROCEDURE DIVISION.
001200 MAIN-BATCH.
001300     DISPLAY "=== NAIROBI TRUST MAINFRAME BATCH ===".
001400     ADD WS-OPEN-YEAR WS-TERM-YEARS GIVING WS-MATURE-YEAR.
001500     COMPUTE WS-INTEREST = WS-PRINCIPAL * 0.085.
001600     IF WS-MATURE-YEAR < WS-OPEN-YEAR
001700         MOVE "Y2K-EXPIRED-ERR" TO WS-STATUS
001800     ELSE
001900         MOVE "TERM-VALIDATED" TO WS-STATUS
002000     END-IF.
002100     DISPLAY "OPEN YEAR: 19" WS-OPEN-YEAR.
002200     DISPLAY "MATURITY YEAR: " WS-MATURE-YEAR.
002300     DISPLAY "STATUS: " WS-STATUS.
002400     DISPLAY "INTEREST CREDITED: " WS-INTEREST.
002500     STOP RUN.
002600 GHOST-AUDIT-LOG.
002700     DISPLAY "ORPHAN AUDIT TRAIL NEVER REACHED".
002800     EXIT.`
	},
	{
		id: "payroll-crypt-1987",
		title: "PAYROLL-CRYPT-1987 (GO TO & Truncation)",
		era: "1987 Payroll Kernel",
		summary: "Uses PERFORM TIMES loop, an unstructured GO TO overtime jump, and decimal-to-integer truncation.",
		source: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAYROLL-CRYPT-1987.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-DAYS          PIC 99    VALUE 0.
       01 WS-BASE-PAY      PIC 9(4)  VALUE 420.
       01 WS-TOTAL-PAY     PIC 9(4)  VALUE 0.
       01 WS-BONUS         PIC 9(4)  VALUE 0.
       PROCEDURE DIVISION.
       PAY-DRIVER.
           PERFORM ACCUMULATE-SHIFT 3 TIMES.
           COMPUTE WS-BONUS = WS-TOTAL-PAY * 0.125.
           IF WS-DAYS > 2
               GO TO OVERTIME-GATE
           END-IF.
           DISPLAY "STANDARD PAY: " WS-TOTAL-PAY.
           STOP RUN.
       ACCUMULATE-SHIFT.
           ADD 1 TO WS-DAYS.
           ADD WS-BASE-PAY TO WS-TOTAL-PAY.
       OVERTIME-GATE.
           ADD WS-BONUS TO WS-TOTAL-PAY.
           DISPLAY "DAYS WORKED: " WS-DAYS.
           DISPLAY "BONUS TRUNCATED INT: " WS-BONUS.
           DISPLAY "FINAL PAYOUT: " WS-TOTAL-PAY.
           STOP RUN.`
	},
	{
		id: "inventory-1989",
		title: "INVENTORY-1989 (Warehouse Loop)",
		era: "1989 Depot Ledger",
		summary: "Drains warehouse stock with PERFORM UNTIL and guards restock math.",
		source: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. INVENTORY-1989.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-STOCK-QTY     PIC 9(3)  VALUE 45.
       01 WS-BATCH-SIZE    PIC 99    VALUE 12.
       01 WS-ORDERS-FILLED PIC 99    VALUE 0.
       01 WS-REORDER-FLAG  PIC X(12) VALUE "OK".
       PROCEDURE DIVISION.
       WAREHOUSE-CYCLE.
           PERFORM DISPATCH-CRATE UNTIL WS-STOCK-QTY < 15.
           IF WS-STOCK-QTY < 15
               MOVE "REORDER-NOW" TO WS-REORDER-FLAG
           END-IF.
           DISPLAY "ORDERS DISPATCHED: " WS-ORDERS-FILLED.
           DISPLAY "REMAINING CRATES: " WS-STOCK-QTY.
           DISPLAY "DEPOT FLAG: " WS-REORDER-FLAG.
           STOP RUN.
       DISPATCH-CRATE.
           SUBTRACT WS-BATCH-SIZE FROM WS-STOCK-QTY.
           ADD 1 TO WS-ORDERS-FILLED.`
	},
	{
		id: "ledger-exorcised-2026",
		title: "LEDGER-EXORCISED-2026 (Clean Modernized COBOL)",
		era: "2026 Exorcised Baseline",
		summary: "Clean 4-digit year, guarded ON SIZE ERROR, full decimal precision, zero GO TO, zero ghost paragraphs (Score 0).",
		source: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. LEDGER-EXORCISED-2026.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-SETTLE-YEAR   PIC 9(4)    VALUE 2026.
       01 WS-NEXT-YEAR     PIC 9(4)    VALUE 0.
       01 WS-PRINCIPAL     PIC 9(6)V99 VALUE 8500.00.
       01 WS-INTEREST      PIC 9(6)V99 VALUE 0.00.
       01 WS-STATUS        PIC X(16)   VALUE "VERIFIED-CLEAN".
       PROCEDURE DIVISION.
       CLEAN-SETTLEMENT.
           PERFORM COMPUTE-ACCRUAL.
           PERFORM PRINT-REPORT.
           STOP RUN.
       COMPUTE-ACCRUAL.
           ADD WS-SETTLE-YEAR 1 GIVING WS-NEXT-YEAR
               ON SIZE ERROR
                   MOVE "OVERFLOW-ALERT" TO WS-STATUS
           END-ADD.
           COMPUTE WS-INTEREST = WS-PRINCIPAL * 0.08
               ON SIZE ERROR
                   MOVE "OVERFLOW-ALERT" TO WS-STATUS
           END-COMPUTE.
       PRINT-REPORT.
           DISPLAY "SETTLEMENT YEAR: " WS-SETTLE-YEAR.
           DISPLAY "MATURITY YEAR: " WS-NEXT-YEAR.
           DISPLAY "EXACT INTEREST: " WS-INTEREST.
           DISPLAY "AUDIT STATUS: " WS-STATUS.`
	}
];
export { COBOL_SAMPLES, analyzeCobolProgram, analyzeCobolSource, applyPicConstraint, executeCobolProgram, executeCobolSource, formatCondition, formatExpr, formatPicValue, parseCobolSource, parsePicSpec, tokenizeCobol, transpileCobolSource, verifyParity };
