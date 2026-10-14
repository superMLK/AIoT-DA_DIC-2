import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILTIN_DATASETS } from '../src/data/builtins.ts'
import { prepare } from '../src/data/clean.ts'
import { describeColumns, parseCsv } from '../src/data/loader.ts'
import { fitOls, type OlsOk } from '../src/engine/ols.ts'
import { computePrediction, predictorDefaults } from '../src/engine/predictor.ts'
import { makeSplit } from '../src/engine/split.ts'

const ds = BUILTIN_DATASETS.find((d) => d.id === '50-startups')!
const table = parseCsv(readFileSync(new URL(`../public/${ds.file}`, import.meta.url), 'utf8'))
const prep = prepare(table, describeColumns(table), ds.config)
if (!prep.ok) throw new Error(prep.error)
const split = makeSplit(prep.data.n, 0.2, 42)
const defaults = predictorDefaults(prep.data, prep.features, split.train)

describe('預測器', () => {
  it('初始值：數值欄為訓練集平均、類別欄為眾數', () => {
    const rd = split.train.map((r) => prep.data.X[r * prep.data.p])
    const mean = rd.reduce((a, b) => a + b, 0) / rd.length
    expect(Number(defaults.values['R&D Spend'])).toBeCloseTo(mean, 0)
    expect(['California', 'Florida', 'New York']).toContain(defaults.values.State)
    expect(defaults.ranges['R&D Spend'].max).toBe(Math.max(...rd))
  })

  it('截距＋各特徵貢獻＝預測值（全特徵）', () => {
    const fit = fitOls(prep.data, split.train, [0, 1, 2, 3, 4]) as OlsOk
    for (const state of ['California', 'Florida', 'New York']) {
      const res = computePrediction(fit, prep.features, { ...defaults.values, State: state })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      const sum = res.intercept + res.features.reduce((a, f) => a + (f.contribution ?? 0), 0)
      expect(Math.abs(sum - res.prediction.yhat)).toBeLessThan(1e-6)
      if (state === 'California') expect(res.features.find((f) => f.name === 'State')!.contribution).toBe(0)
    }
  })

  it('未使用的特徵不影響預測，且標示為未使用', () => {
    const fit = fitOls(prep.data, split.train, [0, 2]) as OlsOk
    const a = computePrediction(fit, prep.features, { ...defaults.values, Administration: '1' })
    const b = computePrediction(fit, prep.features, { ...defaults.values, Administration: '999999', State: 'Florida' })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.prediction.yhat).toBe(b.prediction.yhat)
    expect(a.features.find((f) => f.name === 'Administration')).toMatchObject({ used: false, contribution: null })
    expect(a.features.find((f) => f.name === 'State')!.used).toBe(false)
  })

  it('只選到 State_Florida 時，New York 與 California 等價', () => {
    const fit = fitOls(prep.data, split.train, [0, 3]) as OlsOk
    const res = computePrediction(fit, prep.features, { ...defaults.values, State: 'New York' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.features.find((f) => f.name === 'State')!.equivalentLevels).toEqual(['California', 'New York'])
    const ca = computePrediction(fit, prep.features, { ...defaults.values, State: 'California' })
    expect(ca.ok && ca.prediction.yhat).toBe(res.prediction.yhat)
  })

  it('被使用的數值欄輸入無效時不產生預測', () => {
    const fit = fitOls(prep.data, split.train, [0, 2]) as OlsOk
    const res = computePrediction(fit, prep.features, { ...defaults.values, 'R&D Spend': '' })
    expect(res.ok).toBe(false)
    expect(res.features.find((f) => f.name === 'R&D Spend')!.invalid).toBe(true)
    // 未使用的欄位空白則不影響
    expect(computePrediction(fit, prep.features, { ...defaults.values, Administration: '' }).ok).toBe(true)
  })
})
