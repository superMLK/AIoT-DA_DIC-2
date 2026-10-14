import { betterRss, SubsetRss } from './subsetRss.ts'
import type { NumericData } from '../types.ts'

/** Forward SFS：每步加入使訓練集 RSS 最小的特徵；回傳完整加入順序（資料欄位索引）。 */
export function sfsOrder(data: NumericData, rows: ArrayLike<number>, cols: number[]): number[] {
  return sfsOrderWith(new SubsetRss(data, rows, cols))
}

export function sfsOrderWith(rss: SubsetRss): number[] {
  const chosen: number[] = []
  const remaining = rss.cols.map((_, i) => i)
  while (remaining.length) {
    let best = -1
    let bestRss = Infinity
    for (const j of remaining) {
      const v = rss.rss([...chosen, j])
      if (best < 0 || betterRss(v, bestRss)) {
        best = j
        bestRss = v
      }
    }
    chosen.push(best)
    remaining.splice(remaining.indexOf(best), 1)
  }
  return chosen.map((i) => rss.cols[i])
}
