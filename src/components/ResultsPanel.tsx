import { useEffect, useRef } from 'preact/hooks';
import katex from 'katex';
import type { DerivativeResult } from '../lib/symbolic';
import { formatNumber } from '../lib/rounding';

interface Props {
  resultVariable: string;
  finalValue: number;
  totalUc: number;
  terms: { variable: string; partialValue: number; uc: number; contribution: number }[];
  formattedValue: string;
  formattedUncertainty: string;
  confidence: number;
  derivatives: DerivativeResult[];
}

export function ResultsPanel({
  resultVariable,
  finalValue,
  totalUc,
  terms,
  formattedValue,
  formattedUncertainty,
  confidence,
  derivatives,
}: Props) {
  const contributionsRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contributionsRef.current) {
      const latex = terms.map((term, i) => {
        const deriv = derivatives.find(d => d.variable === term.variable);
        return `\\left(\\frac{\\partial ${resultVariable}}{\\partial ${term.variable}}\\right)^2 u_c^2(${term.variable}) = (${formatNumber(term.partialValue)})^2 \\times (${formatNumber(term.uc)})^2 = ${formatNumber(term.contribution)}`;
      }).join(' \\\\ ');
      
      try {
        katex.render(`\\begin{aligned}${latex}\\end{aligned}`, contributionsRef.current, {
          displayMode: true,
          throwOnError: false,
        });
      } catch (e) {
        contributionsRef.current.textContent = terms.map(t => 
          `(∂${resultVariable}/∂${t.variable})² × u²(${t.variable}) = ${formatNumber(t.contribution)}`
        ).join('\n');
      }
    }
  }, [terms, derivatives, resultVariable]);

  useEffect(() => {
    if (resultRef.current) {
      const latex = `${resultVariable} = ${formattedValue} \\pm ${formattedUncertainty} \\quad (P = ${confidence})`;
      try {
        katex.render(latex, resultRef.current, {
          displayMode: true,
          throwOnError: false,
        });
      } catch (e) {
        resultRef.current.textContent = `${resultVariable} = ${formattedValue} ± ${formattedUncertainty} (P = ${confidence})`;
      }
    }
  }, [resultVariable, formattedValue, formattedUncertainty, confidence]);

  return (
    <div class="results-panel">
      <h2>计算结果</h2>
      
      <div class="contributions-section">
        <h3>各项贡献</h3>
        <div class="contributions" ref={contributionsRef}></div>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>最终值 {resultVariable}：</span>
          <span class="value">{formatNumber(finalValue)}</span>
        </div>
        <div class="summary-row">
          <span>总合成不确定度 u<sub>c</sub>({resultVariable})：</span>
          <span class="value">{formatNumber(totalUc)}</span>
        </div>
        <div class="summary-row">
          <span>相对不确定度：</span>
          <span class="value">{formatNumber(totalUc / Math.abs(finalValue) * 100, 2)}%</span>
        </div>
      </div>

      <div class="final-result">
        <h3>最终结果（已修约）</h3>
        <div class="result-display" ref={resultRef}></div>
      </div>
    </div>
  );
}