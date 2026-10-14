import { firstDeficientColumn, leastSquares, qrDecompose } from '../linalg.ts'
import { standardize } from '../standardize.ts'
import type { NumericData } from '../types.ts'

/**
 * RFE：在標準化資料上反覆以 OLS 擬合、刪除 |β| 最小的特徵。
 * 回傳刪除順序的反序（最重要者在前），前 k 個即為 n_features_to_select = k 的結果。
 */
export function rfeRanking(data: NumericData, rows: ArrayLike<number>, cols: number[]): number[] {
  const s = standardize(data, rows, cols)
  const n = s.n
  let remaining = cols.map((_, i) => i)
  const eliminated: number[] = []
  while (remaining.length > 1) {
    const m = remaining.length + 1
    const a = new Float64Array(n * m)
    for (let i = 0; i < n; i++) a[i] = 1
    remaining.forEach((j, idx) => a.set(s.Xs.subarray(j * n, (j + 1) * n), (idx + 1) * n))
    const d = qrDecompose(a, n, m)
    const deficient = firstDeficientColumn(d)
    let drop: number
    if (deficient > 0) {
      // 與其他特徵完全共線的欄位沒有可辨識的係數，先刪除
      drop = deficient - 1
    } else {
      const beta = leastSquares(d, s.yc)
      drop = 0
      for (let j = 1; j < remaining.length; j++) {
        if (Math.abs(beta[j + 1]) < Math.abs(beta[drop + 1])) drop = j
      }
    }
    eliminated.push(remaining[drop])
    remaining = remaining.filter((_, i) => i !== drop)
  }
  return [...remaining, ...eliminated.reverse()].map((i) => cols[i])
}
