import { betterRss, SubsetRss } from './subsetRss.ts'

export const EXHAUSTIVE_MAX_P = 15

/** 依字典序走訪 {0..q-1} 的所有 k 元組合。 */
function* combinations(q: number, k: number): Generator<number[]> {
  const idx = Array.from({ length: k }, (_, i) => i)
  while (true) {
    yield idx
    let i = k - 1
    while (i >= 0 && idx[i] === q - k + i) i--
    if (i < 0) return
    idx[i]++
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1
  }
}

/** 每個 k 下訓練集 RSS 最小的組合（資料欄位索引，遞增）。結果索引 k-1。 */
export function exhaustiveBest(rss: SubsetRss): number[][] {
  const q = rss.cols.length
  const out: number[][] = []
  for (let k = 1; k <= q; k++) {
    let best: number[] | null = null
    let bestRss = Infinity
    for (const combo of combinations(q, k)) {
      const v = rss.rss(combo)
      if (best === null || betterRss(v, bestRss)) {
        best = combo.slice()
        bestRss = v
      }
    }
    out.push(best!.map((i) => rss.cols[i]))
  }
  return out
}
