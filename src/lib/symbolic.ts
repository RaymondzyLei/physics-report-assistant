import { create, all, type MathNode } from 'mathjs';
import { nodeToLatex } from './parser';

const math = create(all);

export interface DerivativeResult {
  variable: string;
  // 原始偏导数 ∂f/∂x
  derivative: MathNode;
  derivativeLatex: string;
  // 对数偏导数 ∂(ln f)/∂x = (1/f) * (∂f/∂x)
  logDerivative: MathNode;
  logDerivativeLatex: string;
  // 简化后的字符串
  simplified: string;
}

/**
 * 对表达式关于指定变量求偏导数（包括对数偏导）
 */
export function computeDerivative(expression: string, variable: string): DerivativeResult {
  try {
    const node = math.parse(expression);
    
    // 计算原始偏导数 ∂f/∂x
    const derivative = math.derivative(node, variable);
    const simplifiedDerivative = math.simplify(derivative);
    
    // 计算对数偏导数 ∂(ln f)/∂x
    const logExpr = `log(${expression})`;
    const logNode = math.parse(logExpr);
    const logDerivative = math.derivative(logNode, variable);
    const simplifiedLogDerivative = math.simplify(logDerivative);
    
    return {
      variable,
      derivative: simplifiedDerivative,
      derivativeLatex: nodeToLatex(simplifiedDerivative),
      logDerivative: simplifiedLogDerivative,
      logDerivativeLatex: nodeToLatex(simplifiedLogDerivative),
      simplified: simplifiedLogDerivative.toString(),
    };
  } catch (e) {
    console.error(`求导错误 (${variable}):`, e);
    const zeroNode = math.parse('0');
    return {
      variable,
      derivative: zeroNode,
      derivativeLatex: '0',
      logDerivative: zeroNode,
      logDerivativeLatex: '0',
      simplified: '0',
    };
  }
}

/**
 * 计算所有变量的偏导数
 */
export function computeAllDerivatives(expression: string, variables: string[]): DerivativeResult[] {
  return variables.map(v => computeDerivative(expression, v));
}

/**
 * 生成对数形式的公式
 */
export function generateLogFormula(resultVar: string, expressionLatex: string): string {
  return `\\ln ${resultVar} = \\ln\\left(${expressionLatex}\\right)`;
}

/**
 * 生成展开形式的相对不确定度公式
 */
export function generateExpandedFormula(
  resultVar: string,
  derivatives: DerivativeResult[]
): string {
  if (derivatives.length === 0) {
    return `\\frac{u_c(${resultVar})}{|${resultVar}|} = 0`;
  }
  
  const terms = derivatives.map(d => {
    return `\\left(${d.logDerivativeLatex}\\right)^2 u_c^2(${d.variable})`;
  });
  
  return `\\frac{u_c(${resultVar})}{|${resultVar}|} = \\sqrt{${terms.join(' + ')}}`;
}

/**
 * 计算对数偏导数在给定点的数值
 */
export function evaluateLogDerivative(
  logDerivative: MathNode,
  values: { [key: string]: number }
): number {
  try {
    const scope = { ...values, pi: Math.PI, e: Math.E, PI: Math.PI, E: Math.E };
    const compiled = logDerivative.compile();
    return compiled.evaluate(scope) as number;
  } catch {
    return NaN;
  }
}

/**
 * 计算原始偏导数在给定点的数值
 */
export function evaluateDerivative(
  derivative: MathNode,
  values: { [key: string]: number }
): number {
  try {
    const scope = { ...values, pi: Math.PI, e: Math.E, PI: Math.PI, E: Math.E };
    const compiled = derivative.compile();
    return compiled.evaluate(scope) as number;
  } catch {
    return NaN;
  }
}