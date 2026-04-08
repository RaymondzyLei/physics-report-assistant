import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { ExpressionInput } from './ExpressionInput';
import { FormulaPreview } from './FormulaPreview';
import { VariableCard } from './VariableCard';
import { ResultsPanel } from './ResultsPanel';
import { ProcessDocument } from './ProcessDocument';
import { ExportButtons } from './ExportButtons';
import { parseExpression, type ParsedExpression, nodeToLatex, evaluateExpression } from '../lib/parser';
import { computeAllDerivatives, type DerivativeResult } from '../lib/symbolic';
import {
  type MeasurementData,
  type VariableResult,
  type CombinedUncertaintyResult,
  calculateVariableStats,
  calculateCombinedUncertainty,
  getDefaultMeasurementData,
} from '../lib/uncertainty';
import { getTValue, type ConfidenceLevel } from '../lib/tTable';
import { formatResult } from '../lib/rounding';
import { generateLatex, generateMarkdown, type ExportData } from '../lib/latex';

interface ExampleItem {
  label: string;
  expr: string;
  data: Record<string, { values: number[]; instrumentUncertainty: number }>;
}

const EXAMPLE_EXPRESSIONS: ExampleItem[] = [
  {
    label: '密度测量',
    expr: 'rho = 4 * m / (pi * d^2 * L)',
    data: {
      m:  { values: [50.2, 50.3, 50.1], instrumentUncertainty: 0.05 },
      d:  { values: [2.01, 2.02, 2.00], instrumentUncertainty: 0.01 },
      L:  { values: [10.0, 10.1, 9.9],  instrumentUncertainty: 0.1 }
    }
  },
  {
    label: '单摆周期',
    expr: 'g = 4 * pi^2 * L / T^2',
    data: {
      L: { values: [1.00, 1.01, 0.99], instrumentUncertainty: 0.005 },
      T: { values: [2.01, 2.00, 2.02], instrumentUncertainty: 0.01 }
    }
  },
  {
    label: '欧姆定律',
    expr: 'R = U / I',
    data: {
      U: { values: [5.00, 5.02, 4.98], instrumentUncertainty: 0.01 },
      I: { values: [0.50, 0.51, 0.49], instrumentUncertainty: 0.005 }
    }
  },
  {
    label: '切变模量',
    expr: 'G = 4 * pi * L * m * (r_1^2 + r_2^2) / (R^4 * (T_1^2 - T_0^2))',
    data: {
      L: { values: [0.50, 0.51, 0.49], instrumentUncertainty: 0.005 },
      m: { values: [200.0, 201.0, 199.0], instrumentUncertainty: 0.5 },
      r_1: { values: [0.02, 0.021, 0.019], instrumentUncertainty: 0.001 },
      r_2: { values: [0.01, 0.011, 0.009], instrumentUncertainty: 0.001 },
      R: { values: [0.005, 0.0051, 0.0049], instrumentUncertainty: 0.0005 },
      T_1: { values: [1.00, 1.01, 0.99], instrumentUncertainty: 0.01 },
      T_0: { values: [0.50, 0.51, 0.49], instrumentUncertainty: 0.005 }
    }
  },
];

const STORAGE_KEY = 'physics-uncertainty-calculator';

interface StoredData {
  expression: string;
  variableData: { [key: string]: MeasurementData };
  confidence: ConfidenceLevel;
}

export function Calculator() {
  const [expression, setExpression] = useState('');
  const [parsedExpr, setParsedExpr] = useState<ParsedExpression | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativeResult[]>([]);
  const [variableData, setVariableData] = useState<{ [key: string]: MeasurementData }>({});
  const [confidence, setConfidence] = useState<ConfidenceLevel>(0.95);

  // 从 localStorage 加载
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: StoredData = JSON.parse(stored);
        if (data.expression) setExpression(data.expression);
        if (data.variableData) setVariableData(data.variableData);
        if (data.confidence) setConfidence(data.confidence);
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  }, []);

  // 保存到 localStorage（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const data: StoredData = { expression, variableData, confidence };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [expression, variableData, confidence]);

  // 解析表达式
  useEffect(() => {
    if (!expression.trim()) {
      setParsedExpr(null);
      setDerivatives([]);
      return;
    }

    const parsed = parseExpression(expression);
    setParsedExpr(parsed);

    if (parsed.error || !parsed.mathNode) {
      setDerivatives([]);
      return;
    }

    const derivs = computeAllDerivatives(parsed.expression, parsed.variables);
    setDerivatives(derivs);

    // 初始化新变量
    setVariableData(prev => {
      const newData = { ...prev };
      let changed = false;
      parsed.variables.forEach(v => {
        if (!newData[v]) {
          newData[v] = getDefaultMeasurementData(3, confidence);
          changed = true;
        }
      });
      return changed ? newData : prev;
    });
  }, [expression, confidence]);

  // 更新变量数据
  const updateVariableData = useCallback((varName: string, data: MeasurementData) => {
    setVariableData(prev => {
      // 避免不必要的更新
      if (JSON.stringify(prev[varName]) === JSON.stringify(data)) {
        return prev;
      }
      return { ...prev, [varName]: data };
    });
  }, []);

  // 更新置信概率
  const handleConfidenceChange = useCallback((newConfidence: ConfidenceLevel) => {
    setConfidence(newConfidence);
    setVariableData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(varName => {
        const n = updated[varName].values.filter(v => !isNaN(v)).length;
        if (n > 0) {
          updated[varName] = {
            ...updated[varName],
            tFactor: getTValue(n, newConfidence),
          };
        }
      });
      return updated;
    });
  }, []);

  // 计算各变量结果
  const variableResults: VariableResult[] = useMemo(() => {
    if (!parsedExpr || parsedExpr.error) return [];

    return parsedExpr.variables.map(varName => {
      const data = variableData[varName] || getDefaultMeasurementData(3, confidence);
      const stats = calculateVariableStats(data, confidence);
      return { name: varName, data, stats };
    });
  }, [parsedExpr, variableData, confidence]);

  // 计算最终值
  const finalValue = useMemo(() => {
    if (!parsedExpr || parsedExpr.error || variableResults.length === 0) return NaN;

    const allHaveMean = variableResults.every(vr => !isNaN(vr.stats.mean));
    if (!allHaveMean) return NaN;

    const meanValues: { [key: string]: number } = {};
    variableResults.forEach(vr => {
      meanValues[vr.name] = vr.stats.mean;
    });

    return evaluateExpression(parsedExpr.expression, meanValues);
  }, [parsedExpr, variableResults]);

  // 计算总不确定度
  const combinedResult: CombinedUncertaintyResult | null = useMemo(() => {
    if (!parsedExpr || parsedExpr.error) return null;
    if (derivatives.length === 0 || variableResults.length === 0) return null;
    if (isNaN(finalValue) || finalValue === 0) return null;

    // 检查所有变量是否有有效的不确定度
    const allValid = variableResults.every(vr => 
      !isNaN(vr.stats.mean) && isFinite(vr.stats.uc)
    );
    if (!allValid) return null;

    try {
      return calculateCombinedUncertainty(derivatives, variableResults, finalValue);
    } catch (e) {
      console.error('计算合成不确定度出错:', e);
      return null;
    }
  }, [derivatives, variableResults, finalValue, parsedExpr]);

  // 格式化最终结果
  const formattedResult = useMemo(() => {
    if (!combinedResult || isNaN(finalValue) || !isFinite(combinedResult.totalUc)) return null;
    return formatResult(finalValue, combinedResult.totalUc);
  }, [finalValue, combinedResult]);

  // 生成导出数据
  const exportData: ExportData | null = useMemo(() => {
    if (!parsedExpr?.mathNode || !combinedResult || !formattedResult) return null;

    return {
      expression: parsedExpr.expression,
      resultVariable: parsedExpr.resultVariable,
      expressionLatex: nodeToLatex(parsedExpr.mathNode),
      derivatives,
      variableResults,
      finalValue,
      finalUncertainty: combinedResult.totalUc,
      relativeUncertainty: combinedResult.relativeUc,
      formattedValue: formattedResult.value,
      formattedUncertainty: formattedResult.uncertainty,
      confidence,
    };
  }, [parsedExpr, derivatives, variableResults, finalValue, combinedResult, formattedResult, confidence]);

  // 清空
  const handleReset = useCallback(() => {
    setExpression('');
    setParsedExpr(null);
    setDerivatives([]);
    setVariableData({});
    setConfidence(0.95);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 加载示例
  const loadExample = useCallback((expr: string, exampleVars: { [key: string]: { values: number[]; instrumentUncertainty: number } }) => {
    setExpression(expr);
    const newVarData: { [key: string]: MeasurementData } = {};
    Object.entries(exampleVars).forEach(([name, { values, instrumentUncertainty }]) => {
      const defaultData = getDefaultMeasurementData(values.length, confidence);
      newVarData[name] = { ...defaultData, values, instrumentError: instrumentUncertainty };
    });
    setVariableData(newVarData);
  }, [confidence]);

  return (
    <div class="calculator">
      <header class="header">
        <h1>物理实验不确定度计算器</h1>
        <p class="subtitle">大学物理实验误差分析辅助工具（对数微分法）</p>
      </header>

      <div class="confidence-selector">
        <label>置信概率 P：</label>
        <select
          value={confidence}
          onChange={(e) => handleConfidenceChange(parseFloat((e.target as HTMLSelectElement).value) as ConfidenceLevel)}
        >
          <option value={0.95}>0.95 (95%)</option>
          <option value={0.99}>0.99 (99%)</option>
        </select>
      </div>

      <div class="examples">
        <span>示例：</span>
        {EXAMPLE_EXPRESSIONS.map(ex => (
          <button key={ex.label} class="example-btn" onClick={() => loadExample(ex.expr, ex.data)}>
            {ex.label}
          </button>
        ))}
        <button class="reset-btn" onClick={handleReset}>🗑️ 清空</button>
      </div>

      <ExpressionInput
        value={expression}
        onChange={setExpression}
        error={parsedExpr?.error || null}
      />

      {parsedExpr?.mathNode && (
        <FormulaPreview
          resultVariable={parsedExpr.resultVariable}
          expressionNode={parsedExpr.mathNode}
          derivatives={derivatives}
        />
      )}

      {parsedExpr && parsedExpr.variables.length > 0 && (
        <div class="variables-section">
          <h2>变量数据输入</h2>
          <div class="variable-cards">
            {parsedExpr.variables.map(varName => {
              const data = variableData[varName] || getDefaultMeasurementData(3, confidence);
              const result = variableResults.find(vr => vr.name === varName);
              return (
                <VariableCard
                  key={varName}
                  name={varName}
                  data={data}
                  stats={result?.stats || null}
                  confidence={confidence}
                  onDataChange={(newData) => updateVariableData(varName, newData)}
                />
              );
            })}
          </div>
        </div>
      )}

      {combinedResult && formattedResult && parsedExpr && (
        <ResultsPanel
          resultVariable={parsedExpr.resultVariable}
          finalValue={finalValue}
          totalUc={combinedResult.totalUc}
          relativeUc={combinedResult.relativeUc}
          terms={combinedResult.terms}
          formattedValue={formattedResult.value}
          formattedUncertainty={formattedResult.uncertainty}
          confidence={confidence}
          derivatives={derivatives}
        />
      )}

      {exportData && (
        <>
          <ProcessDocument data={exportData} />
          <ExportButtons
            latexContent={generateLatex(exportData)}
            markdownContent={generateMarkdown(exportData)}
          />
        </>
      )}
    </div>
  );
}