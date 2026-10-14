import { describe, expect, it } from 'vitest'
import { fitOls, type OlsOk } from '../src/engine/ols.ts'
import { runPipeline, SELECTION_METHODS, type ModelResult } from '../src/engine/pipeline.ts'
import { exhaustiveBest } from '../src/engine/select/exhaustive.ts'
import { ENET_L1_RATIO, pathOrder } from '../src/engine/select/lasso.ts'
import { rfeRanking } from '../src/engine/select/rfe.ts'
import { sfsOrder } from '../src/engine/select/sfs.ts'
import { SubsetRss } from '../src/engine/select/subsetRss.ts'
import { makeSplit } from '../src/engine/split.ts'
import { usableColumns } from '../src/engine/standardize.ts'
import type { NumericData } from '../src/engine/types.ts'
import { expectAllClose, expectClose, fixtureCases, loadFixture, toNumericData, type FixtureInput } from './helpers.ts'

const sorted = (a: number[]) => a.slice().sort((x, y) => x - y)

for (const name of fixtureCases()) {
  const input = loadFixture<FixtureInput>(`${name}.input.json`)
  const exp = loadFixture(`${name}.expected.json`)
  const data = toNumericData(input)
  const cand = usableColumns(data, input.train)

  describe(`特徵選擇與 scikit-learn 一致：${name}`, () => {
    it('Lasso 與 ElasticNet 的 α 網格與進場順序', () => {
      const lasso = pathOrder(data, input.train, cand, 1)
      expectAllClose(lasso.alphas, exp.lasso.alphas, 1e-9, 0, 'lasso alphas')
      expect(lasso.order).toEqual(exp.lasso.order)
      const enet = pathOrder(data, input.train, cand, ENET_L1_RATIO)
      expectAllClose(enet.alphas, exp.enet.alphas, 1e-9, 0, 'enet alphas')
      expect(enet.order).toEqual(exp.enet.order)
    })

    it('Forward SFS 加入順序', () => {
      expect(sfsOrder(data, input.train, cand)).toEqual(exp.sfs_order)
    })

    it('RFE 各 k 的入選特徵', () => {
      const ranking = rfeRanking(data, input.train, cand)
      for (const [k, feats] of Object.entries(exp.rfe)) expect(sorted(ranking.slice(0, Number(k)))).toEqual(feats)
    })

    if (exp.exhaustive) {
      it('Exhaustive 各 k 的最佳子集', () => {
        const best = exhaustiveBest(new SubsetRss(data, input.train, cand))
        for (const [k, feats] of Object.entries(exp.exhaustive)) expect(best[Number(k) - 1]).toEqual(feats)
      })
    }

    if (exp.pipeline) {
      it('完整管線：入選特徵、測試指標與 CV RMSE', () => {
        const bundle = runPipeline(data, { train: input.train, test: input.test, folds: input.folds! })
        const check = (m: ModelResult, e: any, label: string) => {
          expect(m.features, `${label} features`).toEqual(e.features)
          const fit = m.fit as OlsOk
          expectClose(fit.adjR2, e.adj_r2, 1e-6, 0, `${label} adjR2`)
          expectClose(m.test!.metrics.rmse, e.test_rmse, 1e-9, 0, `${label} rmse`)
          expectClose(m.test!.metrics.mae, e.test_mae, 1e-9, 0, `${label} mae`)
          expectClose(m.test!.metrics.r2, e.test_r2, 1e-9, 0, `${label} r2`)
          if (e.cv_rmse === null) expect(m.cvRmse).toBeNull()
          else expectClose(m.cvRmse!, e.cv_rmse, 1e-8, 0, `${label} cv`)
        }
        check(bundle.ols, exp.pipeline.ols, 'ols')
        for (const method of SELECTION_METHODS) {
          const e = exp.pipeline[method === 'enet' ? 'enet' : method]
          if (!e) {
            expect(bundle.methods[method].available).toBe(false)
            continue
          }
          for (const [k, entry] of Object.entries(e)) check(bundle.methods[method].byK[Number(k) - 1], entry, `${method} k=${k}`)
        }
      })
    }
  })
}

function synthetic(rows: number[][], y: number[]): NumericData {
  const p = rows[0].length
  return { n: rows.length, p, X: Float64Array.from(rows.flat()), y: Float64Array.from(y), columns: rows[0].map((_, j) => `x${j}`) }
}

function randomData(n: number, p: number, seed: number): NumericData {
  let s = seed
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5
  const rows = Array.from({ length: n }, () => Array.from({ length: p }, rand))
  const y = rows.map((r) => r.reduce((acc, v, j) => acc + v * (p - j), 0) + rand())
  return synthetic(rows, y)
}

describe('子集 RSS（Gram + Cholesky）', () => {
  it('與 QR 計算的 RSS 一致', () => {
    const data = randomData(60, 6, 7)
    const rows = Array.from({ length: 60 }, (_, i) => i)
    const cols = [0, 1, 2, 3, 4, 5]
    const rss = new SubsetRss(data, rows, cols)
    for (const subset of [[0], [1, 3], [0, 2, 5], [0, 1, 2, 3, 4, 5]]) {
      const fit = fitOls(data, rows, subset) as OlsOk
      const qrRss = fit.s * fit.s * fit.df
      expectClose(rss.rss(subset), qrRss, 1e-8, 0, `[${subset}]`)
    }
  })

  it('完全共線的子集 RSS 為 Infinity', () => {
    const data = synthetic(
      [[1, 2, 3], [2, 4, 1], [3, 6, 4], [4, 8, 1], [5, 10, 5], [6, 12, 9]],
      [1, 3, 2, 5, 4, 7],
    )
    const rss = new SubsetRss(data, [0, 1, 2, 3, 4, 5], [0, 1, 2])
    expect(rss.rss([0, 1])).toBe(Infinity)
    expect(Number.isFinite(rss.rss([0, 2]))).toBe(true)
  })
})

describe('選擇規則', () => {
  it('Lasso 遇到同時進場仍能每個 k 恰好選出 k 個（依欄位順序破平手）', () => {
    // x0、x1 正交且尺度相同、與 y 的相關一樣強 → 在同一個 α 進場
    const x0 = [1, -1, 1, -1, 1, -1, 1, -1]
    const x1 = [1, 1, -1, -1, 1, 1, -1, -1]
    const x2 = [1, 1, 1, 1, -1, -1, -1, -1]
    const rows = x0.map((_, i) => [x1[i], x0[i], x2[i]])
    const y = x0.map((_, i) => 3 * x0[i] + 3 * x1[i] + 0.5 * x2[i])
    const data = synthetic(rows, y)
    const all = Array.from({ length: 8 }, (_, i) => i)
    const { order } = pathOrder(data, all, [0, 1, 2], 1)
    expect(order).toEqual([0, 1, 2])
    for (let k = 1; k <= 3; k++) expect(order.slice(0, k)).toHaveLength(k)
  })

  it('SFS 具巢狀結構', () => {
    const data = randomData(50, 5, 3)
    const rows = Array.from({ length: 50 }, (_, i) => i)
    const order = sfsOrder(data, rows, [0, 1, 2, 3, 4])
    expect(sorted(order)).toEqual([0, 1, 2, 3, 4])
  })

  it('Exhaustive 與「暴力列舉 + QR」結果相同', () => {
    const data = randomData(40, 6, 11)
    const rows = Array.from({ length: 40 }, (_, i) => i)
    const best = exhaustiveBest(new SubsetRss(data, rows, [0, 1, 2, 3, 4, 5]))
    for (let k = 1; k <= 6; k++) {
      let brute: number[] = []
      let bruteRss = Infinity
      for (let mask = 1; mask < 64; mask++) {
        const subset = [0, 1, 2, 3, 4, 5].filter((j) => mask & (1 << j))
        if (subset.length !== k) continue
        const fit = fitOls(data, rows, subset) as OlsOk
        const v = fit.s * fit.s * fit.df
        if (v < bruteRss) [brute, bruteRss] = [subset, v]
      }
      expect(best[k - 1]).toEqual(brute)
    }
  })

  it('RFE 不受特徵原始尺度影響', () => {
    const data = randomData(50, 4, 5)
    const rows = Array.from({ length: 50 }, (_, i) => i)
    const before = rfeRanking(data, rows, [0, 1, 2, 3])
    const scaled = { ...data, X: data.X.map((v, i) => (i % 4 === 3 ? v * 1e5 : v)) }
    expect(rfeRanking(scaled, rows, [0, 1, 2, 3])).toEqual(before)
  })

  it('p > 15 時 Exhaustive 停用並說明原因', () => {
    const data = randomData(80, 18, 9)
    const bundle = runPipeline(data, makeSplit(80, 0.2, 42))
    expect(bundle.methods.exhaustive.available).toBe(false)
    expect(bundle.methods.exhaustive.reason).toContain('2^p')
    expect(bundle.methods.lasso.byK).toHaveLength(18)
  })

  it('測試集的 y 不影響任何選擇與 CV 結果（無資料洩漏）', () => {
    const data = randomData(50, 5, 21)
    const split = makeSplit(50, 0.2, 42)
    const a = runPipeline(data, split)
    const y = Float64Array.from(data.y)
    for (const i of split.test) y[i] += 1000
    const b = runPipeline({ ...data, y }, split)
    for (const m of SELECTION_METHODS) {
      a.methods[m].byK.forEach((r, i) => {
        expect(b.methods[m].byK[i].features).toEqual(r.features)
        expect(b.methods[m].byK[i].cvRmse).toBe(r.cvRmse)
      })
    }
  })
})
