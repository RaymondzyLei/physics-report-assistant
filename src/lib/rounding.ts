// 有效数字修约

export interface RoundingResult {
  value: string;
  uncertainty: string;
  significantDigits: number;
  decimalPlaces: number;
}

/**
 * 对不确定度进行修约，保留1-2位有效数字
 */
export function roundUncertainty(uncertainty: number): { value: string; decimalPlaces: number; sigFigs: number } {
  if (uncertainty === 0 || !isFinite(uncertainty)) {
    return { value: '0', decimalPlaces: 0, sigFigs: 1 };
  }
  
  const absUncertainty = Math.abs(uncertainty);
  
  // 找到第一个有效数字的位置
  const log10 = Math.floor(Math.log10(absUncertainty));
  
  // 获取第一位有效数字
  const firstDigit = Math.floor(absUncertainty / Math.pow(10, log10));
  
  // 根据第一位数字决定保留1位还是2位有效数字
  // 如果第一位是1或2，保留2位有效数字
  // 否则保留1位有效数字
  const sigFigs = (firstDigit <= 2) ? 2 : 1;
  
  // 计算小数位数
  const decimalPlaces = sigFigs - 1 - log10;
  
  // 修约
  const multiplier = Math.pow(10, decimalPlaces);
  const roundedValue = Math.round(absUncertainty * multiplier) / multiplier;
  
  // 格式化输出
  let formatted: string;
  if (decimalPlaces > 0) {
    formatted = roundedValue.toFixed(decimalPlaces);
  } else {
    formatted = roundedValue.toString();
  }
  
  return { value: formatted, decimalPlaces: Math.max(0, decimalPlaces), sigFigs };
}

/**
 * 根据不确定度的位数修约测量值
 */
export function roundToMatch(value: number, decimalPlaces: number): string {
  if (!isFinite(value)) {
    return 'NaN';
  }
  
  if (decimalPlaces >= 0) {
    return value.toFixed(decimalPlaces);
  } else {
    // 需要四舍五入到整数位以上
    const factor = Math.pow(10, -decimalPlaces);
    return (Math.round(value / factor) * factor).toString();
  }
}

/**
 * 格式化最终结果
 */
export function formatResult(value: number, uncertainty: number): RoundingResult {
  const uncertaintyResult = roundUncertainty(uncertainty);
  const roundedValue = roundToMatch(value, uncertaintyResult.decimalPlaces);
  
  return {
    value: roundedValue,
    uncertainty: uncertaintyResult.value,
    significantDigits: uncertaintyResult.sigFigs,
    decimalPlaces: uncertaintyResult.decimalPlaces,
  };
}

/**
 * 格式化数字，保留指定位数的有效数字
 */
export function formatNumber(num: number, sigFigs: number = 4): string {
  if (num === 0) return '0';
  if (!isFinite(num)) return num.toString();
  
  const magnitude = Math.floor(Math.log10(Math.abs(num)));
  const decimalPlaces = sigFigs - 1 - magnitude;
  
  if (decimalPlaces >= 0) {
    return num.toFixed(decimalPlaces);
  } else {
    const factor = Math.pow(10, -decimalPlaces);
    return (Math.round(num / factor) * factor).toString();
  }
}