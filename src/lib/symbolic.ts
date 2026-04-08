import { create, all, type MathNode } from 'mathjs';
import { nodeToLatex } from './parser';

const math = create(all);

export interface DerivativeResult {
  variable: string;
  derivative: MathNode;
  latex: string;
  simplified: string;
}

export interface UncertaintyFormula {
  derivatives: DerivativeResult[];
  combinedFormulaLatex: string;
}

/**
 * 对表达式关于指定变量求偏导数
 */
export function computeDerivative(expression: string, variable: string): DerivativeResult {
  try {
    const node = math.parse(expression);
    const derivative = math.derivative(node, variable);
    const simplified = math.simplify(derivative);
    
    return {
      variable,
      derivative: simplified,
      latex: nodeToLatex(simplified),
      simplified: simplified.toString(),
    };
  } catch (e) {
    console.error(`求导错误 (${variable}):`, e);
    return {
      variable,
      derivative: math.parse('0'),
      latex: '\\text{Error}',
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
 * 生成不确定度传递公式的LaTeX
 */
export function generateUncertaintyFormula(
  resultVar: string,
  derivatives: DerivativeResult[]
): string {
  if (derivatives.length === 0) {
    return `u_c(${resultVar}) = 0`;
  }
  
  const terms = derivatives.map(d => {
    return `\\left(\\frac{\\partial f}{\\partial ${d.variable}}\\right)^2 u_c^2(${d.variable})`;
  });
  
  return `u_c(${resultVar}) = \\sqrt{${terms.join(' + ')}}`;
}

/**
 * 生成展开形式的不确定度公式
 */
export function generateExpandedFormula(
  resultVar: string,
  derivatives: DerivativeResult[]
): string {
  if (derivatives.length === 0) {
    return `u_c(${resultVar}) = 0`;
  }
  
  const terms = derivatives.map(d => {
    return `\\left(${d.latex}\\right)^2 u_c^2(${d.variable})`;
  });
  
  return `u_c(${resultVar}) = \\sqrt{${terms.join(' + ')}}`;
}

/**
 * 计算偏导数在给定点的数值
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