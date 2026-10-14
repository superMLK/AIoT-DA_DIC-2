import type { NumericData } from './types.ts'

export interface Summary {
  count: number
  mean: number
  std: number
  min: number
  max: number
}

/** 描述統計（標準差用樣本標準差 ddof = 1，與 pandas describe 一致）。 */
export function summarize(values: number[]): Summary {
  const count = values.length
  let mean = 0
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    mean += v
    if (v < min) min = v
    if (v > max) max = v
  }
  mean /= count
  let ss = 0
  for (const v of values) ss += (v - mean) ** 2
  return { count, mean, std: count > 1 ? Math.sqrt(ss / (count - 1)) : NaN, min, max }
}

/** y 與所有特徵欄（含 dummy）兩兩的 Pearson 相關係數；回傳 (p+1)×(p+1)，第 0 列/欄為 y。 */
export function correlationMatrix(data: NumericData): number[][] {
  const m = data.p + 1
  const n = data.n
  const col = (j: number) =>
    j === 0 ? Array.from(data.y) : Array.from({ length: n }, (_, i) => data.X[i * data.p + j - 1])
  const cols = Array.from({ length: m }, (_, j) => {
    const c = col(j)
    const mean = c.reduce((a, b) => a + b, 0) / n
    const dev = c.map((v) => v - mean)
    const norm = Math.sqrt(dev.reduce((a, b) => a + b * b, 0))
    return { dev, norm }
  })
  return cols.map((a) =>
    cols.map((b) => {
      if (a.norm === 0 || b.norm === 0) return NaN
      let s = 0
      for (let i = 0; i < n; i++) s += a.dev[i] * b.dev[i]
      return s / (a.norm * b.norm)
    }),
  )
}
