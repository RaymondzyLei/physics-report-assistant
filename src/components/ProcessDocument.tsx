import { useEffect, useRef } from 'preact/hooks';
import katex from 'katex';
import { type ExportData } from '../lib/latex';
import { formatNumber } from '../lib/rounding';

interface Props {
  data: ExportData;
}

export function ProcessDocument({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const renderKatex = (latex: string, element: HTMLElement, displayMode = true) => {
      try {
        katex.render(latex, element, { displayMode, throwOnError: false });
      } catch {
        element.textContent = latex;
      }
    };

    // 1. 测量公式
    const section1 = document.createElement('div');
    section1.className = 'doc-section';
    section1.innerHTML = '<h3>1. 测量公式</h3>';
    const formula1 = document.createElement('div');
    formula1.className = 'katex-block';
    renderKatex(`${data.resultVariable} = ${data.expressionLatex}`, formula1);
    section1.appendChild(formula1);
    container.appendChild(section1);

    // 2. 两边取对数
    const section2 = document.createElement('div');
    section2.className = 'doc-section';
    section2.innerHTML = '<h3>2. 两边取对数</h3>';
    const formula2 = document.createElement('div');
    formula2.className = 'katex-block';
    renderKatex(`\\ln ${data.resultVariable} = \\ln\\left(${data.expressionLatex}\\right)`, formula2);
    section2.appendChild(formula2);
    container.appendChild(section2);

    // 3. 对数偏导数
    const section3 = document.createElement('div');
    section3.className = 'doc-section';
    section3.innerHTML = '<h3>3. 对数偏导数</h3>';
    data.derivatives.forEach(d => {
      const div = document.createElement('div');
      div.className = 'katex-block';
      renderKatex(
        `\\frac{\\partial \\ln ${data.resultVariable}}{\\partial ${d.variable}} = ${d.logDerivativeLatex}`,
        div
      );
      section3.appendChild(div);
    });
    container.appendChild(section3);

    // 4. 相对不确定度传递公式
    const section4 = document.createElement('div');
    section4.className = 'doc-section';
    section4.innerHTML = '<h3>4. 相对不确定度传递公式</h3>';
    const formula4 = document.createElement('div');
    formula4.className = 'katex-block';
    const terms = data.derivatives.map(d => 
      `\\left(${d.logDerivativeLatex}\\right)^2 u_c^2(${d.variable})`
    );
    renderKatex(
      `\\frac{u_c(${data.resultVariable})}{|${data.resultVariable}|} = \\sqrt{${terms.join(' + ')}}`,
      formula4
    );
    section4.appendChild(formula4);
    container.appendChild(section4);

    // 5. 各变量不确定度计算
    const section5 = document.createElement('div');
    section5.className = 'doc-section';
    section5.innerHTML = '<h3>5. 各变量不确定度计算</h3>';
    
    data.variableResults.forEach(vr => {
      const varSection = document.createElement('div');
      varSection.className = 'var-subsection';
      
      const title = document.createElement('h4');
      title.textContent = `变量 ${vr.name}`;
      varSection.appendChild(title);

      const validValues = vr.data.values.filter(v => !isNaN(v));
      const n = validValues.length;

      // 原始数据
      const dataP = document.createElement('p');
      dataP.innerHTML = `<strong>原始数据：</strong>${vr.name}<sub>i</sub> = ${validValues.map(v => formatNumber(v)).join(', ')}`;
      varSection.appendChild(dataP);

      // 均值
      const meanDiv = document.createElement('div');
      meanDiv.className = 'katex-block';
      renderKatex(
        `\\bar{${vr.name}} = \\frac{1}{${n}}\\sum_{i=1}^{${n}} ${vr.name}_i = ${formatNumber(vr.stats.mean)}`,
        meanDiv
      );
      varSection.appendChild(meanDiv);

      if (n > 1 && !isNaN(vr.stats.sampleStd)) {
        const stdDiv = document.createElement('div');
        stdDiv.className = 'katex-block';
        renderKatex(
          `S_{${vr.name}} = \\sqrt{\\frac{\\sum(${vr.name}_i - \\bar{${vr.name}})^2}{${n}-1}} = ${formatNumber(vr.stats.sampleStd)}`,
          stdDiv
        );
        varSection.appendChild(stdDiv);

        const tFactor = vr.data.tFactor ?? 1;
        const uaDiv = document.createElement('div');
        uaDiv.className = 'katex-block';
        renderKatex(
          `u_A(${vr.name}) = t_p \\cdot \\frac{S_{${vr.name}}}{\\sqrt{n}} = ${formatNumber(tFactor)} \\times \\frac{${formatNumber(vr.stats.sampleStd)}}{\\sqrt{${n}}} = ${formatNumber(vr.stats.uA)}`,
          uaDiv
        );
        varSection.appendChild(uaDiv);
      }

      const instError = vr.data.instrumentError ?? 0;
      const distFactor = vr.data.distributionFactor ?? Math.sqrt(3);
      const ubDiv = document.createElement('div');
      ubDiv.className = 'katex-block';
      renderKatex(
        `u_B(${vr.name}) = \\frac{\\Delta_{ins}}{k} = \\frac{${formatNumber(instError)}}{${formatNumber(distFactor)}} = ${formatNumber(vr.stats.uB)}`,
        ubDiv
      );
      varSection.appendChild(ubDiv);

      const ucDiv = document.createElement('div');
      ucDiv.className = 'katex-block';
      renderKatex(
        `u_c(${vr.name}) = \\sqrt{u_A^2(${vr.name}) + u_B^2(${vr.name})} = ${formatNumber(vr.stats.uc)}`,
        ucDiv
      );
      varSection.appendChild(ucDiv);

      section5.appendChild(varSection);
    });
    container.appendChild(section5);

    // 6. 最终结果
    const section6 = document.createElement('div');
    section6.className = 'doc-section';
    section6.innerHTML = '<h3>6. 最终结果</h3>';
    
    const relP = document.createElement('p');
    relP.innerHTML = `<strong>相对不确定度：</strong>${formatNumber(data.relativeUncertainty * 100, 2)}%`;
    section6.appendChild(relP);

    const resultDiv = document.createElement('div');
    resultDiv.className = 'katex-block final';
    renderKatex(
      `\\boxed{${data.resultVariable} = ${data.formattedValue} \\pm ${data.formattedUncertainty} \\quad (P = ${data.confidence})}`,
      resultDiv
    );
    section6.appendChild(resultDiv);
    container.appendChild(section6);

  }, [data]);

  return (
    <div class="process-document">
      <h2>完整计算过程</h2>
      <div class="document-content" ref={containerRef}></div>
    </div>
  );
}