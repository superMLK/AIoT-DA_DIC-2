/** 可重現的切分：mulberry32 亂數 + Fisher–Yates 洗牌。 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice()
  const rand = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const TEST_RATIOS = [0.3, 0.25, 0.2, 0.1] as const
export const DEFAULT_TEST_RATIO = 0.2
export const DEFAULT_SEED = 42
export const CV_FOLDS = 5

export interface Split {
  /** 皆為遞增排序的列索引。 */
  train: number[]
  test: number[]
  /** 訓練集內的 5 折驗證索引（彼此不重疊、聯集為 train）。 */
  folds: number[][]
}

export function testSize(n: number, testRatio: number): number {
  return Math.min(n - 1, Math.max(1, Math.round(n * testRatio)))
}

export function makeSplit(n: number, testRatio: number, seed: number, folds = CV_FOLDS): Split {
  const perm = shuffle(
    Array.from({ length: n }, (_, i) => i),
    seed,
  )
  const nt = testSize(n, testRatio)
  const test = perm.slice(0, nt).sort((a, b) => a - b)
  const train = perm.slice(nt).sort((a, b) => a - b)

  const cvPerm = shuffle(train, seed + 1)
  const base = Math.floor(train.length / folds)
  const extra = train.length % folds
  const out: number[][] = []
  let start = 0
  for (let f = 0; f < folds; f++) {
    const size = base + (f < extra ? 1 : 0)
    out.push(cvPerm.slice(start, start + size).sort((a, b) => a - b))
    start += size
  }
  return { train, test, folds: out }
}

/** 一折的擬合列 = 訓練集 − 該折驗證列。 */
export function foldFitRows(train: number[], val: number[]): number[] {
  const v = new Set(val)
  return train.filter((i) => !v.has(i))
}
