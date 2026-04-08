import { useEffect, useRef } from 'preact/hooks';
import katex from 'katex';
import { type MathNode } from 'mathjs';
import { nodeToLatex } from '../lib/parser';
import { type DerivativeResult, generateExpandedFormula } from '../lib/symbolic';

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
  const derivativesRef = useRef<HTMLDivElement>(null);
  const uncertaintyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formulaRef.current) {
      const latex = `${resultVariable} = ${nodeToLatex(expressionNode)}`;
      renderLatex(formulaRef.current, latex);
    }
  }, [resultVariable, expressionNode]);

  useEffect(() => {
    if (derivativesRef.current && derivatives.length > 0) {
      const latex = derivatives.map(d => 
        `\\frac{\\partial ${resultVariable}}{\\partial ${d.variable}} = ${d.latex}`
      ).join(' \\qquad ');
      renderLatex(derivativesRef.current, latex);
    }
  }, [derivatives, resultVariable]);

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
        <h3>测量公式</h3>
        <div class="katex-display" ref={formulaRef}></div>
      </div>

      {derivatives.length > 0 && (
        <>
          <div class="formula-section">
            <h3>偏导数</h3>
            <div class="katex-display" ref={derivativesRef}></div>
          </div>

          <div class="formula-section">
            <h3>不确定度传递公式</h3>
            <div class="katex-display" ref={uncertaintyRef}></div>
          </div>
        </>
      )}
    </div>
  );
}