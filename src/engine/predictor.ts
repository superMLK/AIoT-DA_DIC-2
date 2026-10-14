import { parseNumber } from '../data/loader.ts'
import type { FeatureMeta } from '../data/types.ts'
import { predict, type OlsOk, type Prediction } from './ols.ts'
import { cell, type NumericData } from './types.ts'

export interface PredictorDefaults {
  values: Record<string, string>
  /** 數值特徵在訓練集的範圍。 */
  ranges: Record<string, { min: number; max: number }>
}

/** 初始值：數值欄為訓練集平均數，類別欄為訓練集中最常出現的類別。 */
export function predictorDefaults(data: NumericData, features: FeatureMeta[], train: number[]): PredictorDefaults {
  const values: Record<string, string> = {}
  const ranges: Record<string, { min: number; max: number }> = {}
  for (const f of features) {
    if (f.kind === 'numeric') {
      let sum = 0
      let min = Infinity
      let max = -Infinity
      for (const r of train) {
        const v = cell(data, r, f.col!)
        sum += v
        min = Math.min(min, v)
        max = Math.max(max, v)
      }
      const mean = sum / train.length
      values[f.name] = String(Number(mean.toPrecision(6)))
      ranges[f.name] = { min, max }
    } else {
      const counts = new Map<string, number>(f.levels!.map((l) => [l, 0]))
      for (const r of train) {
        const hit = f.dummies!.find((d) => cell(data, r, d.col) === 1)
        const level = hit ? hit.level : f.reference!
        counts.set(level, counts.get(level)! + 1)
      }
      let best = f.reference!
      for (const [l, c] of counts) if (c > counts.get(best)!) best = l
      values[f.name] = best
    }
  }
  return { values, ranges }
}

export interface FeatureState {
  name: string
  used: boolean
  /** β·x（類別特徵為所選類別的 dummy 係數，參考組為 0）；未使用為 null。 */
  contribution: number | null
  invalid: boolean
  /** 只用到部分 dummy 時，在此模型中彼此等價的類別。 */
  equivalentLevels: string[] | null
}

export type PredictorResult =
  | { ok: true; intercept: number; prediction: Prediction; features: FeatureState[] }
  | { ok: false; features: FeatureState[] }

export function computePrediction(fit: OlsOk, features: FeatureMeta[], values: Record<string, string>): PredictorResult {
  const colPos = new Map(fit.cols.map((c, j) => [c, j]))
  const x = new Float64Array(fit.k)
  const states: FeatureState[] = []
  let anyInvalid = false

  for (const f of features) {
    if (f.kind === 'numeric') {
      const pos = colPos.get(f.col!)
      const used = pos !== undefined
      const v = parseNumber(values[f.name] ?? '')
      const invalid = used && (v === null || !Number.isFinite(v))
      anyInvalid ||= invalid
      if (used && !invalid) x[pos] = v!
      states.push({
        name: f.name,
        used,
        contribution: used && !invalid ? fit.beta[pos + 1] * v! : null,
        invalid,
        equivalentLevels: null,
      })
    } else {
      const inModel = f.dummies!.filter((d) => colPos.has(d.col))
      const used = inModel.length > 0
      const level = values[f.name]
      let contribution: number | null = used ? 0 : null
      for (const d of inModel) {
        const pos = colPos.get(d.col)!
        x[pos] = d.level === level ? 1 : 0
        if (d.level === level) contribution = fit.beta[pos + 1]
      }
      const partial = used && inModel.length < f.dummies!.length
      const equivalent = partial
        ? [f.reference!, ...f.dummies!.filter((d) => !colPos.has(d.col)).map((d) => d.level)]
        : null
      states.push({ name: f.name, used, contribution, invalid: false, equivalentLevels: equivalent })
    }
  }

  if (anyInvalid) return { ok: false, features: states }
  return { ok: true, intercept: fit.beta[0], prediction: predict(fit, x), features: states }
}
