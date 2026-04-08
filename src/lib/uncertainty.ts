import { type MathNode } from 'mathjs';
import { getTValue, type ConfidenceLevel } from './tTable';
import { grubbsTest, type GrubbsResult } from './grubbs';
import { evaluateLogDerivative, type DerivativeResult } from './symbolic';

export interface MeasurementData {
  values: number[];
  instrumentError: number | null; // Δ_ins，允许为 null 表示未输入
  distributionFactor: number | null; // k，允许为 null 表示未输入
  tFactor: number | null; // t_p，允许为 null 表示未输入
}

export interface VariableStats {
  mean: number;
  residuals: number[];
  sampleStd: number; // S
  uA: number; // A类不确定度
  uB: number; // B类不确定度
  uc: number; // 合成不确定度
  relativeUc: number; // 相对不确定度 uc/mean
  grubbsResult: GrubbsResult | null;
}

export interface VariableResult {
  name: string;
  data: MeasurementData;
  stats: VariableStats;
}

// 默认值常量
export const DEFAULT_DISTRIBUTION_FACTOR = Math.sqrt(3);

/**
 * 获取有效的分布因子（如果未输入则使用默认值）
 */
export function getEffectiveDistributionFactor(value: number | null): number {
  if (value === null || isNaN(value)) {
    return DEFAULT_DISTRIBUTION_FACTOR;
  }
  return value;
}

/**
 * 获取有效的仪器误差（如果未输入则返回0）
 */
export function getEffectiveInstrumentError(value: number | null): number {
  if (value === null || isNaN(value)) {
    return 0;
  }
  return value;
}

/**
 * 计算单个变量的统计量和不确定度
 */
export function calculateVariableStats(data: MeasurementData): VariableStats {
  const values = data.values.filter(v => !isNaN(v) && isFinite(v));
  const n = values.length;
  
  if (n === 0) {
    return {
      mean: NaN,
      residuals: [],
      sampleStd: NaN,
      uA: NaN,
      uB: NaN,
      uc: NaN,
      relativeUc: NaN,
      grubbsResult: null,
    };
  }
  
  // 均值
  const mean = values.reduce((sum, x) => sum + x, 0) / n;
  
  // 残差
  const residuals = values.map(x => x - mean);
  
  // 样本标准差 (贝塞尔公式)
  let sampleStd = 0;
  if (n > 1) {
    const sumSquaredResiduals = residuals.reduce((sum, r) => sum + r * r, 0);
    sampleStd = Math.sqrt(sumSquaredResiduals / (n - 1));
  }
  
  // 获取有效的参数值
  const effectiveTFactor = data.tFactor ?? getTValue(n, 0.95);
  const effectiveDistributionFactor = getEffectiveDistributionFactor(data.distributionFactor);
  const effectiveInstrumentError = getEffectiveInstrumentError(data.instrumentError);
  
  // A类不确定度
  let uA = 0;
  if (n > 1) {
    uA = effectiveTFactor * sampleStd / Math.sqrt(n);
  }
  
  // B类不确定度
  const uB = effectiveInstrumentError / effectiveDistributionFactor;
  
  // 合成不确定度
  const uc = Math.sqrt(uA * uA + uB * uB);
  
  // 相对不确定度
  const relativeUc = mean !== 0 ? uc / Math.abs(mean) : NaN;
  
  // Grubbs检验
  const grubbsResult = grubbsTest(values);
  
  return {
    mean,
    residuals,
    sampleStd,
    uA,
    uB,
    uc,
    relativeUc,
    grubbsResult,
  };
}

/**
 * 使用对数微分法计算总合成不确定度
 */
export function calculateCombinedUncertainty(
  derivatives: DerivativeResult[],
  variableResults: VariableResult[],
  finalValue: number
): { 
  totalUc: number; 
  relativeUc: number;
  terms: { 
    variable: string; 
    logPartialValue: number; 
    uc: number; 
    contribution: number;
    relativeContribution: number;
  }[] 
} {
  const meanValues: { [key: string]: number } = {};
  const uncertainties: { [key: string]: number } = {};
  
  variableResults.forEach(vr => {
    meanValues[vr.name] = vr.stats.mean;
    uncertainties[vr.name] = vr.stats.uc;
  });
  
  const terms: { 
    variable: string; 
    logPartialValue: number; 
    uc: number; 
    contribution: number;
    relativeContribution: number;
  }[] = [];
  
  let sumSquared = 0;
  
  derivatives.forEach(d => {
    // 使用对数偏导数
    const logPartialValue = evaluateLogDerivative(d.logDerivative, meanValues);
    const uc = uncertainties[d.variable] || 0;
    // 贡献项：(∂ln f/∂x)² * u²(x)
    const contribution = Math.pow(logPartialValue * uc, 2);
    // 相对贡献（用于显示）
    const mean = meanValues[d.variable];
    const relativeContribution = mean !== 0 ? Math.pow(logPartialValue * uc, 2) : 0;
    
    terms.push({
      variable: d.variable,
      logPartialValue,
      uc,
      contribution,
      relativeContribution,
    });
    
    sumSquared += contribution;
  });
  
  // 相对不确定度
  const relativeUc = Math.sqrt(sumSquared);
  // 绝对不确定度
  const totalUc = Math.abs(finalValue) * relativeUc;
  
  return {
    totalUc,
    relativeUc,
    terms,
  };
}

/**
 * 获取默认的测量数据
 */
export function getDefaultMeasurementData(
  n: number = 3,
  confidence: ConfidenceLevel = 0.95
): MeasurementData {
  return {
    values: Array(n).fill(NaN),
    instrumentError: null, // 初始为 null，表示未输入
    distributionFactor: null, // 初始为 null，使用默认值 √3
    tFactor: getTValue(n, confidence),
  };
}