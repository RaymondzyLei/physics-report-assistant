import { getTValue, type ConfidenceLevel } from './tTable';
import { grubbsTest, type GrubbsResult } from './grubbs';
import { evaluateLogDerivative, type DerivativeResult } from './symbolic';

export interface MeasurementData {
  values: number[];
  instrumentError: number | null;
  distributionFactor: number | null;
  tFactor: number | null;
}

export interface VariableStats {
  mean: number;
  residuals: number[];
  sampleStd: number;
  uA: number;
  uB: number;
  uc: number;
  relativeUc: number;
  grubbsResult: GrubbsResult | null;
}

export interface VariableResult {
  name: string;
  data: MeasurementData;
  stats: VariableStats;
}

export interface CombinedUncertaintyResult {
  totalUc: number;
  relativeUc: number;
  terms: {
    variable: string;
    logPartialValue: number;
    uc: number;
    contribution: number;
  }[];
}

export const DEFAULT_DISTRIBUTION_FACTOR = Math.sqrt(3);

export function getEffectiveDistributionFactor(value: number | null): number {
  if (value === null || isNaN(value) || value === 0) {
    return DEFAULT_DISTRIBUTION_FACTOR;
  }
  return value;
}

export function getEffectiveInstrumentError(value: number | null): number {
  if (value === null || isNaN(value)) {
    return 0;
  }
  return value;
}

export function getEffectiveTFactor(value: number | null, n: number, confidence: ConfidenceLevel): number {
  if (value === null || isNaN(value)) {
    return getTValue(n, confidence);
  }
  return value;
}

/**
 * 计算单个变量的统计量和不确定度
 */
export function calculateVariableStats(data: MeasurementData, confidence: ConfidenceLevel = 0.95): VariableStats {
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
  
  // 样本标准差
  let sampleStd = 0;
  if (n > 1) {
    const sumSquaredResiduals = residuals.reduce((sum, r) => sum + r * r, 0);
    sampleStd = Math.sqrt(sumSquaredResiduals / (n - 1));
  }
  
  // 获取有效参数
  const effectiveTFactor = getEffectiveTFactor(data.tFactor, n, confidence);
  const effectiveDistributionFactor = getEffectiveDistributionFactor(data.distributionFactor);
  const effectiveInstrumentError = getEffectiveInstrumentError(data.instrumentError);
  
  // A类不确定度
  let uA = 0;
  if (n > 1 && sampleStd > 0) {
    uA = effectiveTFactor * sampleStd / Math.sqrt(n);
  }
  
  // B类不确定度
  const uB = Math.abs(effectiveInstrumentError) / effectiveDistributionFactor;
  
  // 合成不确定度
  const uc = Math.sqrt(uA * uA + uB * uB);
  
  // 相对不确定度
  const relativeUc = mean !== 0 ? uc / Math.abs(mean) : NaN;
  
  // Grubbs检验
  const grubbsResult = n >= 3 ? grubbsTest(values) : null;
  
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
): CombinedUncertaintyResult {
  const meanValues: { [key: string]: number } = {};
  const uncertainties: { [key: string]: number } = {};
  
  variableResults.forEach(vr => {
    meanValues[vr.name] = vr.stats.mean;
    uncertainties[vr.name] = vr.stats.uc;
  });
  
  const terms: CombinedUncertaintyResult['terms'] = [];
  let sumSquared = 0;
  
  derivatives.forEach(d => {
    const logPartialValue = evaluateLogDerivative(d.logDerivative, meanValues);
    const uc = uncertainties[d.variable] || 0;
    const contribution = Math.pow(logPartialValue * uc, 2);
    
    if (isFinite(contribution)) {
      terms.push({
        variable: d.variable,
        logPartialValue: isFinite(logPartialValue) ? logPartialValue : 0,
        uc,
        contribution,
      });
      sumSquared += contribution;
    } else {
      terms.push({
        variable: d.variable,
        logPartialValue: 0,
        uc,
        contribution: 0,
      });
    }
  });
  
  const relativeUc = Math.sqrt(sumSquared);
  const totalUc = Math.abs(finalValue) * relativeUc;
  
  return {
    totalUc: isFinite(totalUc) ? totalUc : 0,
    relativeUc: isFinite(relativeUc) ? relativeUc : 0,
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
    instrumentError: null,
    distributionFactor: null,
    tFactor: getTValue(n, confidence),
  };
}