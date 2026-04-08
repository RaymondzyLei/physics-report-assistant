import { useCallback, useEffect, useRef } from 'preact/hooks';
import katex from 'katex';
import { type MeasurementData, type VariableStats, DEFAULT_DISTRIBUTION_FACTOR } from '../lib/uncertainty';
import { getTValue, type ConfidenceLevel } from '../lib/tTable';
import { formatNumber } from '../lib/rounding';

interface Props {
  name: string;
  data: MeasurementData;
  stats: VariableStats | null;
  confidence: ConfidenceLevel;
  onDataChange: (data: MeasurementData) => void;
}

export function VariableCard({ name, data, stats, confidence, onDataChange }: Props) {
  const statsRef = useRef<HTMLDivElement>(null);

  // 更新测量值
  const updateValue = useCallback((index: number, valueStr: string) => {
    const numValue = valueStr === '' ? NaN : parseFloat(valueStr);
    const newValues = [...data.values];
    newValues[index] = numValue;
    
    const validCount = newValues.filter(v => !isNaN(v)).length;
    
    onDataChange({
      ...data,
      values: newValues,
      tFactor: validCount > 1 ? getTValue(validCount, confidence) : data.tFactor,
    });
  }, [data, onDataChange, confidence]);

  // 添加测量
  const addMeasurement = useCallback(() => {
    onDataChange({
      ...data,
      values: [...data.values, NaN],
    });
  }, [data, onDataChange]);

  // 删除测量
  const removeMeasurement = useCallback(() => {
    if (data.values.length <= 1) return;
    onDataChange({
      ...data,
      values: data.values.slice(0, -1),
    });
  }, [data, onDataChange]);

  // 更新仪器误差
  const updateInstrumentError = useCallback((valueStr: string) => {
    onDataChange({
      ...data,
      instrumentError: valueStr === '' ? null : parseFloat(valueStr),
    });
  }, [data, onDataChange]);

  // 更新分布因子
  const updateDistributionFactor = useCallback((valueStr: string) => {
    onDataChange({
      ...data,
      distributionFactor: valueStr === '' ? null : parseFloat(valueStr),
    });
  }, [data, onDataChange]);

  // 更新 t 因子
  const updateTFactor = useCallback((valueStr: string) => {
    onDataChange({
      ...data,
      tFactor: valueStr === '' ? null : parseFloat(valueStr),
    });
  }, [data, onDataChange]);

  // 渲染统计结果
  useEffect(() => {
    if (!statsRef.current || !stats || isNaN(stats.mean)) return;
    
    const n = data.values.filter(v => !isNaN(v)).length;
    let latex = `\\begin{aligned}`;
    latex += `&\\bar{${name}} = ${formatNumber(stats.mean)} \\\\`;
    
    if (n > 1 && !isNaN(stats.sampleStd)) {
      latex += `&S_{${name}} = ${formatNumber(stats.sampleStd)} \\\\`;
      latex += `&u_A(${name}) = ${formatNumber(stats.uA)} \\\\`;
    }
    
    latex += `&u_B(${name}) = ${formatNumber(stats.uB)} \\\\`;
    latex += `&u_c(${name}) = ${formatNumber(stats.uc)}`;
    
    if (!isNaN(stats.relativeUc) && isFinite(stats.relativeUc)) {
      latex += ` \\\\`;
      latex += `&\\frac{u_c(${name})}{|\\bar{${name}}|} = ${formatNumber(stats.relativeUc * 100, 2)}\\%`;
    }
    latex += `\\end{aligned}`;
    
    try {
      katex.render(latex, statsRef.current, { displayMode: true, throwOnError: false });
    } catch (e) {
      statsRef.current.textContent = `均值: ${formatNumber(stats.mean)}, uc: ${formatNumber(stats.uc)}`;
    }
  }, [stats, name, data.values]);

  const validCount = data.values.filter(v => !isNaN(v)).length;
  const hasGrubbsWarning = stats?.grubbsResult?.hasSuspiciousValue;

  // 格式化输入框的值
  const formatInputValue = (value: number | null): string => {
    if (value === null) return '';
    if (typeof value === 'number' && isNaN(value)) return '';
    return String(value);
  };

  return (
    <div class={`variable-card ${hasGrubbsWarning ? 'has-warning' : ''}`}>
      <div class="card-header">
        <h3>变量 {name}</h3>
        <span class="measurement-count">共 {data.values.length} 次测量</span>
      </div>

      <div class="measurements">
        <label>测量数据：</label>
        <div class="measurement-inputs">
          {data.values.map((value, index) => (
            <div key={index} class="measurement-input-wrapper">
              <span class="index">{index + 1}.</span>
              <input
                type="number"
                value={isNaN(value) ? '' : String(value)}
                onInput={(e) => updateValue(index, (e.target as HTMLInputElement).value)}
                placeholder={`${name}${index + 1}`}
                class={hasGrubbsWarning && stats?.grubbsResult?.suspiciousIndex === index ? 'suspicious' : ''}
                step="any"
              />
            </div>
          ))}
        </div>
        <div class="measurement-buttons">
          <button onClick={addMeasurement} class="add-btn" title="增加测量次数">+</button>
          <button 
            onClick={removeMeasurement} 
            class="remove-btn" 
            disabled={data.values.length <= 1}
            title="减少测量次数"
          >−</button>
        </div>
      </div>

      {hasGrubbsWarning && stats?.grubbsResult && (
        <div class="grubbs-warning">
          ⚠️ Grubbs检验发现可疑值: {formatNumber(stats.grubbsResult.suspiciousValue)} 
          (G = {formatNumber(stats.grubbsResult.gValue, 3)} &gt; G临界 = {formatNumber(stats.grubbsResult.criticalValue, 3)})
        </div>
      )}

      <div class="parameters">
        <div class="param-row">
          <label>仪器最大允差 Δ<sub>ins</sub>：</label>
          <input
            type="number"
            value={formatInputValue(data.instrumentError)}
            onInput={(e) => updateInstrumentError((e.target as HTMLInputElement).value)}
            placeholder="请输入（可以为0）"
            step="any"
          />
        </div>
        <div class="param-row">
          <label>分布因子 k：</label>
          <input
            type="number"
            value={formatInputValue(data.distributionFactor)}
            onInput={(e) => updateDistributionFactor((e.target as HTMLInputElement).value)}
            placeholder={`留空默认 √3 ≈ ${DEFAULT_DISTRIBUTION_FACTOR.toFixed(4)}`}
            step="any"
          />
        </div>
        <div class="param-row">
          <label>t 因子 t<sub>p</sub>：</label>
          <input
            type="number"
            value={formatInputValue(data.tFactor)}
            onInput={(e) => updateTFactor((e.target as HTMLInputElement).value)}
            placeholder="自动计算"
            step="any"
          />
          <span class="hint">(n={validCount}, ν={Math.max(0, validCount - 1)}, P={confidence})</span>
        </div>
      </div>

      {stats && !isNaN(stats.mean) && (
        <div class="stats-section">
          <h4>计算结果</h4>
          <div class="stats-display" ref={statsRef}></div>
          
          {validCount > 0 && stats.residuals.length > 0 && (
            <div class="residuals">
              <span>残差：</span>
              {stats.residuals.map((r, i) => (
                <span key={i} class="residual">v<sub>{i + 1}</sub>={formatNumber(r, 4)}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}