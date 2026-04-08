import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { type MathNode } from 'mathjs';
import { ExpressionInput } from './ExpressionInput';
import { FormulaPreview } from './FormulaPreview';
import { VariableCard } from './VariableCard';
import { ResultsPanel } from './ResultsPanel';
import { ProcessDocument } from './ProcessDocument';
import { ExportButtons } from './ExportButtons';
import { parseExpression, nodeToLatex, evaluateExpression } from '../lib/parser';
import type { ParsedExpression } from '../lib/parser';
import { computeAllDerivatives, generateExpandedFormula } from '../lib/symbolic';
import type { DerivativeResult } from '../lib/symbolic';
import type {
  MeasurementData,
  VariableResult,
} from '../lib/uncertainty';
import {
  calculateVariableStats,
  calculateCombinedUncertainty,
  getDefaultMeasurementData,
} from '../lib/uncertainty';
import { getTValue, type ConfidenceLevel } from '../lib/tTable';
import { formatResult } from '../lib/rounding';
import { generateLatex, generateMarkdown } from '../lib/latex';
import type { ExportData } from '../lib/latex';

// 示例公式
const EXAMPLE_EXPRESSIONS = [
  { label: '密度测量', expr: 'rho = 4 * m / (pi * d^2 * L)' },
  { label: '单摆周期', expr: 'g = 4 * pi^2 * L / T^2' },
  { label: '欧姆定律', expr: 'R = U / I' },
];

// localStorage key
const STORAGE_KEY = 'physics-uncertainty-calculator';

interface StoredData {
  expression: string;
  variableData: { [key: string]: MeasurementData };
  confidence: ConfidenceLevel;
}

export function Calculator() {
  // 状态
  const [expression, setExpression] = useState('');
  const [parsedExpr, setParsedExpr] = useState<ParsedExpression | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativeResult[]>([]);
  const [variableData, setVariableData] = useState<{ [key: string]: MeasurementData }>({});
  const [confidence, setConfidence] = useState<ConfidenceLevel>(0.95);

  // 从 localStorage 加载数据
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: StoredData = JSON.parse(stored);
        setExpression(data.expression || '');
        setVariableData(data.variableData || {});
        setConfidence(data.confidence || 0.95);
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  }, []);

  // 保存到 localStorage
  useEffect(() => {
    try {
      const data: StoredData = {
        expression,
        variableData,
        confidence,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
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

    // 计算偏导数
    const derivs = computeAllDerivatives(parsed.expression, parsed.variables);
    setDerivatives(derivs);

    // 初始化新变量的数据
    const newVarData = { ...variableData };
    let hasNewVar = false;

    parsed.variables.forEach(v => {
      if (!newVarData[v]) {
        newVarData[v] = getDefaultMeasurementData(3, confidence);
        hasNewVar = true;
      }
    });

    if (hasNewVar) {
      setVariableData(newVarData);
    }
  }, [expression]);

  // 更新变量数据
  const updateVariableData = useCallback((varName: string, data: MeasurementData) => {
    setVariableData(prev => ({
      ...prev,
      [varName]: data,
    }));
  }, []);

  // 更新置信概率时同步更新所有变量的 t 因子
  const handleConfidenceChange = useCallback((newConfidence: ConfidenceLevel) => {
    setConfidence(newConfidence);
    setVariableData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(varName => {
        const n = updated[varName].values.filter(v => !isNaN(v)).length || 3;
        updated[varName] = {
          ...updated[varName],
          tFactor: getTValue(n, newConfidence),
        };
      });
      return updated;
    });
  }, []);

  // 计算各变量结果
  const variableResults: VariableResult[] = useMemo(() => {
    if (!parsedExpr || parsedExpr.error) return [];

    return parsedExpr.variables.map(varName => {
      const data = variableData[varName] || getDefaultMeasurementData(3, confidence);
      const stats = calculateVariableStats(data);
      return { name: varName, data, stats };
    });
  }, [parsedExpr, variableData, confidence]);

  // 计算总不确定度
  const combinedResult = useMemo(() => {
    if (!parsedExpr || parsedExpr.error || derivatives.length === 0 || variableResults.length === 0) {
      return null;
    }

    // 检查是否所有变量都有有效数据
    const allValid = variableResults.every(vr => !isNaN(vr.stats.mean) && !isNaN(vr.stats.uc));
    if (!allValid) return null;

    return calculateCombinedUncertainty(derivatives, variableResults);
  }, [derivatives, variableResults, parsedExpr]);

  // 计算最终值
  const finalValue = useMemo(() => {
    if (!parsedExpr || parsedExpr.error || variableResults.length === 0) return NaN;

    const meanValues: { [key: string]: number } = {};
    variableResults.forEach(vr => {
      meanValues[vr.name] = vr.stats.mean;
    });

    return evaluateExpression(parsedExpr.expression, meanValues);
  }, [parsedExpr, variableResults]);

  // 格式化最终结果
  const formattedResult = useMemo(() => {
    if (!combinedResult || isNaN(finalValue)) return null;
    return formatResult(finalValue, combinedResult.totalUc);
  }, [finalValue, combinedResult]);

  // 生成导出数据
  const exportData: ExportData | null = useMemo(() => {
    if (!parsedExpr || !parsedExpr.mathNode || !combinedResult || !formattedResult) {
      return null;
    }

    return {
      expression: parsedExpr.expression,
      resultVariable: parsedExpr.resultVariable,
      expressionLatex: nodeToLatex(parsedExpr.mathNode),
      derivatives,
      variableResults,
      finalValue,
      finalUncertainty: combinedResult.totalUc,
      formattedValue: formattedResult.value,
      formattedUncertainty: formattedResult.uncertainty,
      confidence,
    };
  }, [parsedExpr, derivatives, variableResults, finalValue, combinedResult, formattedResult, confidence]);

  // 清空所有数据
  const handleReset = useCallback(() => {
    setExpression('');
    setParsedExpr(null);
    setDerivatives([]);
    setVariableData({});
    setConfidence(0.95);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 加载示例
  const loadExample = useCallback((expr: string) => {
    setExpression(expr);
    setVariableData({});
  }, []);

  return (
    <div class="calculator">
      {/* 标题区 */}
      <header class="header">
        <h1>物理实验不确定度计算器</h1>
        <p class="subtitle">大学物理实验误差分析辅助工具</p>
      </header>

      {/* 置信概率选择 */}
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

      {/* 示例表达式 */}
      <div class="examples">
        <span>示例：</span>
        {EXAMPLE_EXPRESSIONS.map(ex => (
          <button
            key={ex.label}
            class="example-btn"
            onClick={() => loadExample(ex.expr)}
          >
            {ex.label}
          </button>
        ))}
        <button class="reset-btn" onClick={handleReset}>
          🗑️ 清空
        </button>
      </div>

      {/* 表达式输入 */}
      <ExpressionInput
        value={expression}
        onChange={setExpression}
        error={parsedExpr?.error || null}
      />

      {/* 公式预览 */}
      {parsedExpr && parsedExpr.mathNode && (
        <FormulaPreview
          resultVariable={parsedExpr.resultVariable}
          expressionNode={parsedExpr.mathNode}
          derivatives={derivatives}
        />
      )}

      {/* 变量输入卡片 */}
      {parsedExpr && parsedExpr.variables.length > 0 && (
        <div class="variables-section">
          <h2>变量数据输入</h2>
          <div class="variable-cards">
            {parsedExpr.variables.map(varName => (
              <VariableCard
                key={varName}
                name={varName}
                data={variableData[varName] || getDefaultMeasurementData(3, confidence)}
                stats={variableResults.find(vr => vr.name === varName)?.stats || null}
                confidence={confidence}
                onDataChange={(data) => updateVariableData(varName, data)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 结果面板 */}
      {combinedResult && formattedResult && parsedExpr && (
        <ResultsPanel
          resultVariable={parsedExpr.resultVariable}
          finalValue={finalValue}
          totalUc={combinedResult.totalUc}
          terms={combinedResult.terms}
          formattedValue={formattedResult.value}
          formattedUncertainty={formattedResult.uncertainty}
          confidence={confidence}
          derivatives={derivatives}
        />
      )}

      {/* 计算过程文档 */}
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