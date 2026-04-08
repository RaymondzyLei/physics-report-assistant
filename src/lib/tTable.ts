// t分布临界值表
// 自由度 ν = n - 1，置信概率 P = 0.95 和 P = 0.99

export interface TTableEntry {
  df: number; // 自由度 degrees of freedom
  t95: number; // P = 0.95
  t99: number; // P = 0.99
}

export const tTable: TTableEntry[] = [
  { df: 1, t95: 12.706, t99: 63.657 },
  { df: 2, t95: 4.303, t99: 9.925 },
  { df: 3, t95: 3.182, t99: 5.841 },
  { df: 4, t95: 2.776, t99: 4.604 },
  { df: 5, t95: 2.571, t99: 4.032 },
  { df: 6, t95: 2.447, t99: 3.707 },
  { df: 7, t95: 2.365, t99: 3.499 },
  { df: 8, t95: 2.306, t99: 3.355 },
  { df: 9, t95: 2.262, t99: 3.250 },
  { df: 10, t95: 2.228, t99: 3.169 },
  { df: 11, t95: 2.201, t99: 3.106 },
  { df: 12, t95: 2.179, t99: 3.055 },
  { df: 13, t95: 2.160, t99: 3.012 },
  { df: 14, t95: 2.145, t99: 2.977 },
  { df: 15, t95: 2.131, t99: 2.947 },
  { df: 16, t95: 2.120, t99: 2.921 },
  { df: 17, t95: 2.110, t99: 2.898 },
  { df: 18, t95: 2.101, t99: 2.878 },
  { df: 19, t95: 2.093, t99: 2.861 },
  { df: 20, t95: 2.086, t99: 2.845 },
  { df: 21, t95: 2.080, t99: 2.831 },
  { df: 22, t95: 2.074, t99: 2.819 },
  { df: 23, t95: 2.069, t99: 2.807 },
  { df: 24, t95: 2.064, t99: 2.797 },
  { df: 25, t95: 2.060, t99: 2.787 },
  { df: 26, t95: 2.056, t99: 2.779 },
  { df: 27, t95: 2.052, t99: 2.771 },
  { df: 28, t95: 2.048, t99: 2.763 },
  { df: 29, t95: 2.045, t99: 2.756 },
  { df: 30, t95: 2.042, t99: 2.750 },
  { df: Infinity, t95: 1.960, t99: 2.576 },
];

export type ConfidenceLevel = 0.95 | 0.99;

export function getTValue(n: number, confidence: ConfidenceLevel = 0.95): number {
  const df = n - 1;
  
  if (df <= 0) {
    return confidence === 0.95 ? 12.706 : 63.657;
  }
  
  // 查找匹配的自由度
  const entry = tTable.find(e => e.df === df);
  if (entry) {
    return confidence === 0.95 ? entry.t95 : entry.t99;
  }
  
  // 如果自由度大于30，使用无穷大的值
  if (df > 30) {
    return confidence === 0.95 ? 1.960 : 2.576;
  }
  
  // 线性插值
  const lower = tTable.filter(e => e.df < df && e.df !== Infinity).pop();
  const upper = tTable.find(e => e.df > df && e.df !== Infinity);
  
  if (lower && upper) {
    const ratio = (df - lower.df) / (upper.df - lower.df);
    const lowerT = confidence === 0.95 ? lower.t95 : lower.t99;
    const upperT = confidence === 0.95 ? upper.t95 : upper.t99;
    return lowerT + ratio * (upperT - lowerT);
  }
  
  return confidence === 0.95 ? 1.960 : 2.576;
}