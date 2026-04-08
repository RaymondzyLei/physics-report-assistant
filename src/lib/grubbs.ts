// Grubbs检验（格拉布斯检验）用于剔除坏值

// Grubbs临界值表 (α = 0.05)
const grubbsTable: { [key: number]: number } = {
  3: 1.153,
  4: 1.463,
  5: 1.672,
  6: 1.822,
  7: 1.938,
  8: 2.032,
  9: 2.110,
  10: 2.176,
  11: 2.234,
  12: 2.285,
  13: 2.331,
  14: 2.371,
  15: 2.409,
  16: 2.443,
  17: 2.475,
  18: 2.504,
  19: 2.532,
  20: 2.557,
  25: 2.663,
  30: 2.745,
};

export interface GrubbsResult {
  hasSuspiciousValue: boolean;
  suspiciousIndex: number;
  suspiciousValue: number;
  gValue: number;
  criticalValue: number;
}

export function grubbsTest(data: number[]): GrubbsResult | null {
  const n = data.length;
  
  if (n < 3) {
    return null; // 数据量不足，无法进行Grubbs检验
  }
  
  // 计算均值
  const mean = data.reduce((sum, x) => sum + x, 0) / n;
  
  // 计算标准差
  const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);
  
  if (std === 0) {
    return null; // 所有数据相同，无异常值
  }
  
  // 找出离均值最远的点
  let maxDeviation = 0;
  let suspiciousIndex = 0;
  
  data.forEach((x, i) => {
    const deviation = Math.abs(x - mean);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      suspiciousIndex = i;
    }
  });
  
  // 计算G统计量
  const gValue = maxDeviation / std;
  
  // 获取临界值
  let criticalValue: number;
  if (grubbsTable[n]) {
    criticalValue = grubbsTable[n];
  } else if (n > 30) {
    // 对于n > 30，使用近似公式
    const t = 2.576; // 近似使用正态分布
    criticalValue = ((n - 1) / Math.sqrt(n)) * Math.sqrt(t * t / (n - 2 + t * t));
  } else {
    // 插值
    const keys = Object.keys(grubbsTable).map(Number).sort((a, b) => a - b);
    const lower = keys.filter(k => k < n).pop() || 3;
    const upper = keys.find(k => k > n) || 30;
    const ratio = (n - lower) / (upper - lower);
    criticalValue = grubbsTable[lower] + ratio * (grubbsTable[upper] - grubbsTable[lower]);
  }
  
  return {
    hasSuspiciousValue: gValue > criticalValue,
    suspiciousIndex,
    suspiciousValue: data[suspiciousIndex],
    gValue,
    criticalValue,
  };
}