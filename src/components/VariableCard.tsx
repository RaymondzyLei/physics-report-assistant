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

  // 更新单个测量值
  const updateValue = useCallback((index: number, value: string) => {
    const numValue = value === '' ? NaN : parseFloat(value);
    const newValues = [...data.values];
    newValues[index] = numValue;
    
    // 更新 t 因子
    const validCount = newValues.filter(v => !isNaN(v)).length;
    const newTFactor = validCount > 1 ? getTValue(validCount, confidence) : data.tFactor;
    
    onDataChange({
      ...data,
      values: newValues,
      tFactor: newTFactor,
    });
  }, [data, onDataChange, confidence]);

  // 添加测量次数
  const addMeasurement = useCallback(() => {
    const newValues = [...data.values, NaN];
    onDataChange({
      ...data,
      values: newValues,
      tFactor: getTValue(newValues.length, confidence),
    });
  }, [data, onDataChange, confidence]);

  // 删除测量次数
  const removeMeasurement = useCallback(() => {
    if (data.values.length <= 1) return;
    const newValues = data.values.slice(0, -1);
    const validCount = newValues.filter(v => !isNaN(v)).length;
    onDataChange({
      ...data,
      values: newValues,
      tFactor: validCount > 1 ? getTValue(validCount, confidence) : data.tFactor,
    });
  }, [data, onDataChange, confidence]);

  // 更新仪器误差 - 修复：允许输入0和小数
  const updateInstrumentError = useCallback((value: string) => {
    // 空字符串设为 null，否则解析为数字
    const numValue = value === '' ? null : parseFloat(value);
    onDataChange({
      ...data,
      instrumentError: numValue,
    });
  }, [data, onDataChange]);

  // 更新分布因子 - 修复：不自动填充默认值
  const updateDistributionFactor = useCallback((value: string) => {
    // 空字符串设为 null，否则解析为数字
    const numValue = value === '' ? null : parseFloat(value);
    onDataChange({
      ...data,
      distributionFactor: numValue,
    });
  }, [data, onDataChange]);

  // 更新 t 因子
  const updateTFactor = useCallback((value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    onDataChange({
      ...data,
      tFactor: numValue,
    });
  }, [data, onDataChange]);

  // 渲染统计结果
  useEffect(() => {
    if (statsRef.current && stats && !isNaN(stats.mean)) {
      const n = data.values.filter(v => !isNaN(v)).length;
      let latex = `\\begin{aligned}`;
      latex += `&\\bar{${name}} = ${formatNumber(stats.mean)} \\\\`;
      if (n > 1 && !isNaN(stats.sampleStd)) {
        latex += `&S_{${name}} = ${formatNumber(stats.sampleStd)} \\\\`;
        latex += `&u_A(${name}) = ${formatNumber(stats.uA)} \\\\`;
      }
      latex += `&u_B(${name}) = ${formatNumber(stats.uB)} \\\\`;
      latex += `&u_c(${name}) = ${formatNumber(stats.uc)}`;
      if (!isNaN(stats.relativeUc)) {
        latex += ` \\\\`;
        latex += `&\\frac{u_c(${name})}{|\\bar{${name}}|} = ${formatNumber(stats.relativeUc * 100, 2)}\\%`;
      }
      latex += `\\end{aligned}`;
      
      try {
        katex.render(latex, statsRef.current, {
          displayMode: true,
          throwOnError: false,
        });
      } catch (e) {
        statsRef.current.textContent = `均值: ${stats.mean}, uc: ${stats.uc}`;
      }
    }
  }, [stats, name, data.values]);

  const validCount = data.values.filter(v => !isNaN(v)).length;
  const hasGrubbsWarning = stats?.grubbsResult?.hasSuspiciousValue;

  // 格式化显示值的辅助函数 - 修复：正确处理 0 和 null
  const formatInputValue = (value: number | null): string => {
    if (value === null) return '';
    if (isNaN(value)) return '';
    return value.toString();
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
                value={isNaN(value) ? '' : value.toString()}
                onInput={(e) => updateValue(index, (e.target as HTMLInputElement).value)}
                placeholder={`${name}${index + 1}`}
                class={stats?.grubbsResult?.hasSuspiciousValue && stats.grubbsResult.suspiciousIndex === index ? 'suspicious' : ''}
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
          >
            −
          </button>
        </div>
      </div>

      {hasGrubbsWarning && stats?.grubbsResult && (
        <div class="grubbs-warning">
          ⚠️ Grubbs检验发现可疑值: {formatNumber(stats.grubbsResult.suspiciousValue)} 
          (G = {formatNumber(stats.grubbsResult.gValue, 3)} &gt; G_临界 = {formatNumber(stats.grubbsResult.criticalValue, 3)})
        </div>
      )}

      <div class="parameters">
        <div class="param-row">
          <label>仪器最大允差 Δ<sub>ins</sub>：</label>
          <input
            type="number"
            value={formatInputValue(data.instrumentError)}
            onInput={(e) => updateInstrumentError((e.target as HTMLInputElement).value)}
            placeholder="必填"
            step="any"
          />
        </div>
        <div class="param-row">
          <label>分布因子 k：</label>
          <input
            type="number"
            value={formatInputValue(data.distributionFactor)}
            onInput={(e) => updateDistributionFactor((e.target as HTMLInputElement).value)}
            placeholder={`默认 √3 ≈ ${DEFAULT_DISTRIBUTION_FACTOR.toFixed(4)}`}
            step="any"
          />
          <span class="hint">(均匀分布: √3 ≈ 1.732)</span>
        </div>
        <div class="param-row">
          <label>t 因子 t<sub>p</sub>：</label>
          <input
            type="number"
            value={formatInputValue(data.tFactor)}
            onInput={(e) => updateTFactor((e.target as HTMLInputElement).value)}
            placeholder="自动"
            step="any"
          />
          <span class="hint">(n={validCount}, ν={Math.max(0, validCount - 1)}, P={confidence})</span>
        </div>
      </div>

      {stats && !isNaN(stats.mean) && (
        <div class="stats-section">
          <h4>计算结果</h4>
          <div class="stats-display" ref={statsRef}></div>
          
          {validCount > 0 && (
            <div class="residuals">
              <span>残差：</span>
              {stats.residuals.map((r, i) => (
                <span key={i} class="residual">
                  v<sub>{i + 1}</sub>={formatNumber(r, 4)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}