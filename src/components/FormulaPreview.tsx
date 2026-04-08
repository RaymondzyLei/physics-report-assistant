import { useEffect, useRef } from 'preact/hooks';
import katex from 'katex';
import { type MathNode } from 'mathjs';
import { nodeToLatex } from '../lib/parser';
import { type DerivativeResult, generateExpandedFormula, generateLogFormula } from '../lib/symbolic';

interface Props {
  resultVariable: string;
  expressionNode: MathNode;
  derivatives: DerivativeResult[];
}

function renderLatex(element: HTMLElement, latex: string, displayMode: boolean = true) {
  try {
    katex.render(latex, element, {
      displayMode,
      throwOnError: false,
      trust: true,
    });
  } catch (e) {
    element.textContent = latex;
  }
}

export function FormulaPreview({ resultVariable, expressionNode, derivatives }: Props) {
  const formulaRef = useRef<HTMLDivElement>(null);
  const logFormulaRef = useRef<HTMLDivElement>(null);
  const derivativesRef = useRef<HTMLDivElement>(null);
  const uncertaintyRef = useRef<HTMLDivElement>(null);

  // 原始公式
  useEffect(() => {
    if (formulaRef.current) {
      const latex = `${resultVariable} = ${nodeToLatex(expressionNode)}`;
      renderLatex(formulaRef.current, latex);
    }
  }, [resultVariable, expressionNode]);

  // 对数公式
  useEffect(() => {
    if (logFormulaRef.current) {
      const exprLatex = nodeToLatex(expressionNode);
      const latex = generateLogFormula(resultVariable, exprLatex);
      renderLatex(logFormulaRef.current, latex);
    }
  }, [resultVariable, expressionNode]);

  // 对数偏导数
  useEffect(() => {
    if (derivativesRef.current && derivatives.length > 0) {
      const latex = derivatives.map(d => 
        `\\frac{\\partial \\ln ${resultVariable}}{\\partial ${d.variable}} = ${d.logDerivativeLatex}`
      ).join(' \\qquad ');
      renderLatex(derivativesRef.current, latex);
    }
  }, [derivatives, resultVariable]);

  // 相对不确定度传递公式
  useEffect(() => {
    if (uncertaintyRef.current && derivatives.length > 0) {
      const latex = generateExpandedFormula(resultVariable, derivatives);
      renderLatex(uncertaintyRef.current, latex);
    }
  }, [derivatives, resultVariable]);

  return (
    <div class="formula-preview">
      <h2>公式预览</h2>
      
      <div class="formula-section">
        <h3>1. 测量公式</h3>
        <div class="katex-display" ref={formulaRef}></div>
      </div>

      {derivatives.length > 0 && (
        <>
          <div class="formula-section">
            <h3>2. 两边取对数</h3>
            <div class="katex-display" ref={logFormulaRef}></div>
          </div>

          <div class="formula-section">
            <h3>3. 对数偏导数（各变量）</h3>
            <div class="katex-display" ref={derivativesRef}></div>
          </div>

          <div class="formula-section">
            <h3>4. 相对不确定度传递公式</h3>
            <div class="katex-display" ref={uncertaintyRef}></div>
          </div>
        </>
      )}
    </div>
  );
}