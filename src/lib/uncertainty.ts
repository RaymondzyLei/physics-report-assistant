import { type MathNode } from 'mathjs';
import { getTValue, type ConfidenceLevel } from './tTable';
import { grubbsTest, type GrubbsResult } from './grubbs';
import { evaluateDerivative, type DerivativeResult } from './symbolic';

export interface MeasurementData {
  values: number[];
  instrumentError: number; // Δ_ins
  distributionFactor: number; // k
  tFactor: number; // t_p
}

export interface VariableStats {
  mean: number;
  residuals: number[];
  sampleStd: number; // S
  uA: number; // A类不确定度
  uB: number; // B类不确定度
  uc: number; // 合成不确定度
  grubbsResult: GrubbsResult | null;
}

export interface VariableResult {
  name: string;
  data: MeasurementData;
  stats: VariableStats;
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
  
  // A类不确定度
  let uA = 0;
  if (n > 1) {
    uA = data.tFactor * sampleStd / Math.sqrt(n);
  }
  
  // B类不确定度
  const uB = data.instrumentError / data.distributionFactor;
  
  // 合成不确定度
  const uc = Math.sqrt(uA * uA + uB * uB);
  
  // Grubbs检验
  const grubbsResult = grubbsTest(values);
  
  return {
    mean,
    residuals,
    sampleStd,
    uA,
    uB,
    uc,
    grubbsResult,
  };
}

/**
 * 计算总合成不确定度
 */
export function calculateCombinedUncertainty(
  derivatives: DerivativeResult[],
  variableResults: VariableResult[]
): { totalUc: number; terms: { variable: string; partialValue: number; uc: number; contribution: number }[] } {
  const meanValues: { [key: string]: number } = {};
  const uncertainties: { [key: string]: number } = {};
  
  variableResults.forEach(vr => {
    meanValues[vr.name] = vr.stats.mean;
    uncertainties[vr.name] = vr.stats.uc;
  });
  
  const terms: { variable: string; partialValue: number; uc: number; contribution: number }[] = [];
  let sumSquared = 0;
  
  derivatives.forEach(d => {
    const partialValue = evaluateDerivative(d.derivative, meanValues);
    const uc = uncertainties[d.variable] || 0;
    const contribution = Math.pow(partialValue * uc, 2);
    
    terms.push({
      variable: d.variable,
      partialValue,
      uc,
      contribution,
    });
    
    sumSquared += contribution;
  });
  
  return {
    totalUc: Math.sqrt(sumSquared),
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
    instrumentError: 0,
    distributionFactor: Math.sqrt(3), // 均匀分布
    tFactor: getTValue(n, confidence),
  };
}