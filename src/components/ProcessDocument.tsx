import { useEffect, useRef } from 'preact/hooks';
import katex from 'katex';
import type { ExportData } from '../lib/latex';
import { formatNumber } from '../lib/rounding';

interface Props {
  data: ExportData;
}

export function ProcessDocument({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 清空容器
    containerRef.current.innerHTML = '';

    // 1. 测量公式
    const section1 = document.createElement('div');
    section1.className = 'doc-section';
    section1.innerHTML = '<h3>1. 测量公式</h3>';
    const formula1 = document.createElement('div');
    formula1.className = 'katex-block';
    katex.render(`${data.resultVariable} = ${data.expressionLatex}`, formula1, { displayMode: true, throwOnError: false });
    section1.appendChild(formula1);
    containerRef.current.appendChild(section1);

    // 2. 偏导数推导
    const section2 = document.createElement('div');
    section2.className = 'doc-section';
    section2.innerHTML = '<h3>2. 偏导数推导</h3>';
    data.derivatives.forEach(d => {
      const div = document.createElement('div');
      div.className = 'katex-block';
      katex.render(
        `\\frac{\\partial ${data.resultVariable}}{\\partial ${d.variable}} = ${d.latex}`,
        div,
        { displayMode: true, throwOnError: false }
      );
      section2.appendChild(div);
    });
    containerRef.current.appendChild(section2);

    // 3. 不确定度传递公式
    const section3 = document.createElement('div');
    section3.className = 'doc-section';
    section3.innerHTML = '<h3>3. 不确定度传递公式</h3>';
    const formula3 = document.createElement('div');
    formula3.className = 'katex-block';
    const terms = data.derivatives.map(d => 
      `\\left(\\frac{\\partial ${data.resultVariable}}{\\partial ${d.variable}}\\right)^2 u_c^2(${d.variable})`
    );
    katex.render(
      `u_c(${data.resultVariable}) = \\sqrt{${terms.join(' + ')}}`,
      formula3,
      { displayMode: true, throwOnError: false }
    );
    section3.appendChild(formula3);
    containerRef.current.appendChild(section3);

    // 4. 各变量不确定度计算
    const section4 = document.createElement('div');
    section4.className = 'doc-section';
    section4.innerHTML = '<h3>4. 各变量不确定度计算</h3>';
    
    data.variableResults.forEach(vr => {
      const varSection = document.createElement('div');
      varSection.className = 'var-subsection';
      
      const title = document.createElement('h4');
      katex.render(`\\text{变量 } ${vr.name}`, title, { throwOnError: false });
      varSection.appendChild(title);

      const validValues = vr.data.values.filter(v => !isNaN(v));
      const n = validValues.length;

      // 原始数据
      const dataDiv = document.createElement('p');
      dataDiv.innerHTML = `<strong>原始数据：</strong>`;
      const dataFormula = document.createElement('span');
      katex.render(`${vr.name}_i = ${validValues.map(v => formatNumber(v)).join(', ')}`, dataFormula, { throwOnError: false });
      dataDiv.appendChild(dataFormula);
      varSection.appendChild(dataDiv);

      // 均值
      const meanDiv = document.createElement('div');
      meanDiv.className = 'katex-block';
      katex.render(
        `\\bar{${vr.name}} = \\frac{1}{${n}}\\sum_{i=1}^{${n}} ${vr.name}_i = ${formatNumber(vr.stats.mean)}`,
        meanDiv,
        { displayMode: true, throwOnError: false }
      );
      varSection.appendChild(meanDiv);

      if (n > 1) {
        // 标准差
        const stdDiv = document.createElement('div');
        stdDiv.className = 'katex-block';
        katex.render(
          `S_{${vr.name}} = \\sqrt{\\frac{\\sum(${vr.name}_i - \\bar{${vr.name}})^2}{${n}-1}} = ${formatNumber(vr.stats.sampleStd)}`,
          stdDiv,
          { displayMode: true, throwOnError: false }
        );
        varSection.appendChild(stdDiv);

        // A类不确定度
        const uaDiv = document.createElement('div');
        uaDiv.className = 'katex-block';
        katex.render(
          `u_A(${vr.name}) = t_p \\cdot \\frac{S_{${vr.name}}}{\\sqrt{n}} = ${formatNumber(vr.data.tFactor)} \\times \\frac{${formatNumber(vr.stats.sampleStd)}}{\\sqrt{${n}}} = ${formatNumber(vr.stats.uA)}`,
          uaDiv,
          { displayMode: true, throwOnError: false }
        );
        varSection.appendChild(uaDiv);
      }

      // B类不确定度
      const ubDiv = document.createElement('div');
      ubDiv.className = 'katex-block';
      katex.render(
        `u_B(${vr.name}) = \\frac{\\Delta_{ins}}{k} = \\frac{${formatNumber(vr.data.instrumentError)}}{${formatNumber(vr.data.distributionFactor)}} = ${formatNumber(vr.stats.uB)}`,
        ubDiv,
        { displayMode: true, throwOnError: false }
      );
      varSection.appendChild(ubDiv);

      // 合成不确定度
      const ucDiv = document.createElement('div');
      ucDiv.className = 'katex-block';
      katex.render(
        `u_c(${vr.name}) = \\sqrt{u_A^2(${vr.name}) + u_B^2(${vr.name})} = ${formatNumber(vr.stats.uc)}`,
        ucDiv,
        { displayMode: true, throwOnError: false }
      );
      varSection.appendChild(ucDiv);

      section4.appendChild(varSection);
    });
    containerRef.current.appendChild(section4);

    // 5. 最终结果
    const section5 = document.createElement('div');
    section5.className = 'doc-section';
    section5.innerHTML = '<h3>5. 最终结果</h3>';
    const resultDiv = document.createElement('div');
    resultDiv.className = 'katex-block final';
    katex.render(
      `\\boxed{${data.resultVariable} = ${data.formattedValue} \\pm ${data.formattedUncertainty} \\quad (P = ${data.confidence})}`,
      resultDiv,
      { displayMode: true, throwOnError: false }
    );
    section5.appendChild(resultDiv);
    containerRef.current.appendChild(section5);

  }, [data]);

  return (
    <div class="process-document">
      <h2>完整计算过程</h2>
      <div class="document-content" ref={containerRef}></div>
    </div>
  );
}