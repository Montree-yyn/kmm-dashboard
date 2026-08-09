import { KaiToolError, type KaiTool, type KaiToolContext, type KaiToolOutput } from "./types";

type CalculationKind = "number" | "percentage" | "baht";

export type CalculatorToolData = {
  expression: string;
  result: number;
  kind: CalculationKind;
};

const CALCULATOR_INTENT = /(\d[\d,.]*\s*%\s*(?:ของ|of)\s*\d|\d[\d,.]*\s*(?:จากเป้า|จากเป้าหมาย|out of)\s*\d|\d[\d,.]*\s*(?:ล้านบาท|million\s*(?:baht)?)|(?:calculate|คำนวณ|เท่าไร|เท่ากับ|what is).{0,80}\d|\d[\d,]*(?:\.\d+)?\s*[+\-*/×÷]\s*\d)/i;
const MAX_EXPRESSION_LENGTH = 256;
const MAX_TOKENS = 128;
const MAX_ABSOLUTE_RESULT = 1e15;

export const calculatorTool: KaiTool = {
  id: "calculator",
  matches(message) {
    return CALCULATOR_INTENT.test(message);
  },
  execute(context) {
    return executeCalculator(context);
  },
};

export function executeCalculator({ message }: KaiToolContext): KaiToolOutput {
  const calculation = calculationFromMessage(message);
  const result = evaluateArithmetic(calculation.expression);
  const data: CalculatorToolData = { ...calculation, result };
  return { data, answer: composeCalculatorAnswer(message, data) };
}

export function evaluateArithmetic(expression: string) {
  const normalized = expression
    .replaceAll(",", "")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .trim();
  if (!normalized || normalized.length > MAX_EXPRESSION_LENGTH) {
    throw new KaiToolError("invalid_expression", "Expression length is invalid.");
  }

  const tokens = tokenize(normalized);
  let position = 0;

  function peek() {
    return tokens[position];
  }

  function consume(expected?: string) {
    const token = tokens[position];
    if (expected && token !== expected) {
      throw new KaiToolError("invalid_expression", `Expected ${expected}.`);
    }
    position += 1;
    return token;
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = parseUnary();
      if (operator === "/" && right === 0) {
        throw new KaiToolError("division_by_zero", "Division by zero is not allowed.");
      }
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseUnary(): number {
    if (peek() === "+") {
      consume("+");
      return parseUnary();
    }
    if (peek() === "-") {
      consume("-");
      return -parseUnary();
    }
    return parsePostfix();
  }

  function parsePostfix(): number {
    let value = parsePrimary();
    while (peek() === "%") {
      consume("%");
      value /= 100;
    }
    return value;
  }

  function parsePrimary(): number {
    const token = peek();
    if (token === "(") {
      consume("(");
      const value = parseExpression();
      consume(")");
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new KaiToolError("invalid_expression", "A number was expected.");
    }
    consume();
    return Number(token);
  }

  const result = parseExpression();
  if (position !== tokens.length) {
    throw new KaiToolError("invalid_expression", "Unexpected input remains.");
  }
  if (!Number.isFinite(result) || Math.abs(result) > MAX_ABSOLUTE_RESULT) {
    throw new KaiToolError("unsafe_result", "The result is outside the supported range.");
  }
  return normalizeFloatingPoint(result);
}

function calculationFromMessage(message: string): { expression: string; kind: CalculationKind } {
  const percentageOf = message.match(
    /(-?\d[\d,]*(?:\.\d+)?)\s*%\s*(?:ของ|of)\s*(-?\d[\d,]*(?:\.\d+)?)/i,
  );
  if (percentageOf) {
    return { expression: `(${percentageOf[1]} / 100) * ${percentageOf[2]}`, kind: "number" };
  }

  const targetPercentage = message.match(
    /(-?\d[\d,]*(?:\.\d+)?)\s*(?:จากเป้า(?:หมาย)?|out of)\s*(-?\d[\d,]*(?:\.\d+)?)/i,
  );
  if (targetPercentage) {
    return { expression: `(${targetPercentage[1]} / ${targetPercentage[2]}) * 100`, kind: "percentage" };
  }

  const millionBaht = message.match(
    /(-?\d[\d,]*(?:\.\d+)?)\s*(?:ล้านบาท|million\s*(?:baht)?)/i,
  );
  if (millionBaht) {
    return { expression: `${millionBaht[1]} * 1000000`, kind: "baht" };
  }

  const normalized = message.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
  const candidates = normalized
    .match(/[-+*/().,%\d\s]+/g)
    ?.map((value) => value.trim())
    .filter((value) => /\d/.test(value) && /[+*/%\-]/.test(value))
    .sort((left, right) => right.length - left.length);
  if (!candidates?.[0]) {
    throw new KaiToolError("unsupported_expression", "No supported arithmetic expression was found.");
  }
  return { expression: candidates[0], kind: "number" };
}

function tokenize(expression: string) {
  const tokens: string[] = [];
  let position = 0;
  while (position < expression.length) {
    if (/\s/.test(expression[position])) {
      position += 1;
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(expression.slice(position));
    if (number) {
      tokens.push(number[0]);
      position += number[0].length;
    } else if ("+-*/()%".includes(expression[position])) {
      tokens.push(expression[position]);
      position += 1;
    } else {
      throw new KaiToolError("invalid_character", "The expression contains an unsupported character.");
    }
    if (tokens.length > MAX_TOKENS) {
      throw new KaiToolError("too_many_tokens", "The expression is too complex.");
    }
  }
  return tokens;
}

function composeCalculatorAnswer(message: string, data: CalculatorToolData) {
  const language = /[\u1000-\u109f]/.test(message)
    ? "my"
    : /[\u0e00-\u0e7f]/.test(message)
      ? "th"
      : "en";
  const maximumFractionDigits = data.kind === "percentage" ? 2 : 6;
  const formatted = new Intl.NumberFormat(
    language === "th" ? "th-TH" : language === "my" ? "my-MM" : "en-US",
    { maximumFractionDigits },
  ).format(data.result);

  if (language === "th") {
    if (data.kind === "percentage") return `คิดเป็น ${formatted}%`;
    if (data.kind === "baht") return `เท่ากับ ${formatted} บาท`;
    return `ผลลัพธ์คือ ${formatted}`;
  }
  if (language === "my") {
    if (data.kind === "percentage") return `${formatted}% ဖြစ်သည်။`;
    if (data.kind === "baht") return `${formatted} ဘတ် ဖြစ်သည်။`;
    return `အဖြေမှာ ${formatted} ဖြစ်သည်။`;
  }
  if (data.kind === "percentage") return `That is ${formatted}%.`;
  if (data.kind === "baht") return `That is ${formatted} baht.`;
  return `The result is ${formatted}.`;
}

function normalizeFloatingPoint(value: number) {
  return Number.parseFloat(value.toPrecision(15));
}
