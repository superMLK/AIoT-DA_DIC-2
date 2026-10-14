import { evaluateTest, fitOls, regressionMetrics, type OlsResult, type TestMetrics, type TestRow } from './ols.ts'
import { EXHAUSTIVE_MAX_P, exhaustiveBest } from './select/exhaustive.ts'
import { ENET_L1_RATIO, pathOrder } from './select/lasso.ts'
import { rfeRanking } from './select/rfe.ts'
import { sfsOrderWith } from './select/sfs.ts'
import { SubsetRss } from './select/subsetRss.ts'
import { foldFitRows, type Split } from './split.ts'
import { usableColumns } from './standardize.ts'
import { cell, type NumericData } from './types.ts'

export type SelectionMethod = 'lasso' | 'sfs' | 'rfe' | 'enet' | 'exhaustive'
export type MethodId = SelectionMethod | 'ols'

export const SELECTION_METHODS: SelectionMethod[] = ['lasso', 'sfs', 'rfe', 'enet', 'exhaustive']

export interface ModelResult {
  method: MethodId
  k: number
  /** 入選特徵（資料欄位索引，遞增）；無法選出 k 個時為 null。 */
  features: number[] | null
  fit: OlsResult | null
  test: { rows: TestRow[]; metrics: TestMetrics } | null
  /** 5 折 CV RMSE；任一折無法估計時為 null。 */
  cvRmse: number | null
}

export interface MethodResults {
  available: boolean
  /** 停用原因（例如 Exhaustive 在 p > 15）。 */
  reason?: string
  /** 索引 k − 1。 */
  byK: ModelResult[]
}

export interface ResultBundle {
  n: number
  p: number
  columns: string[]
  split: Split
  ols: ModelResult
  methods: Record<SelectionMethod, MethodResults>
}

/** 一個訓練集上各方法的特徵排序，所有 k 都從中取得。 */
interface SelectionPlan {
  usable: number[]
  orders: Partial<Record<Exclude<SelectionMethod, 'exhaustive'>, number[]>>
  exhaustive: number[][] | null
}

function makePlan(data: NumericData, rows: number[], allowExhaustive: boolean): SelectionPlan {
  const usable = usableColumns(data, rows)
  const rss = new SubsetRss(data, rows, usable)
  return {
    usable,
    orders: {
      lasso: pathOrder(data, rows, usable, 1).order,
      enet: pathOrder(data, rows, usable, ENET_L1_RATIO).order,
      sfs: sfsOrderWith(rss),
      rfe: rfeRanking(data, rows, usable),
    },
    exhaustive: allowExhaustive ? exhaustiveBest(rss) : null,
  }
}

function subsetFor(plan: SelectionPlan, method: MethodId, k: number): number[] | null {
  if (method === 'ols') return plan.usable
  if (k > plan.usable.length) return null
  const chosen = method === 'exhaustive' ? plan.exhaustive![k - 1] : plan.orders[method]!.slice(0, k)
  return chosen.slice().sort((a, b) => a - b)
}

function foldRmse(data: NumericData, fitRows: number[], valRows: number[], features: number[] | null): number | null {
  if (!features) return null
  const fit = fitOls(data, fitRows, features)
  if (fit.status !== 'ok') return null
  const actual: number[] = []
  const pred: number[] = []
  for (const r of valRows) {
    let yhat = fit.beta[0]
    for (let j = 0; j < fit.k; j++) yhat += fit.beta[j + 1] * cell(data, r, fit.cols[j])
    actual.push(data.y[r])
    pred.push(yhat)
  }
  return regressionMetrics(actual, pred).rmse
}

export type ProgressFn = (fraction: number) => void

/** 對所有方法、所有 k 在訓練集上選特徵並擬合、評估測試集，並在 5 折 CV 中重跑完整流程。 */
export function runPipeline(data: NumericData, split: Split, onProgress?: ProgressFn): ResultBundle {
  if (split.train.length < 3 || split.test.length < 1 || split.folds.some((f) => f.length === 0)) {
    throw new Error('訓練集或測試集筆數不足，無法進行切分與交叉驗證。')
  }
  const allowExhaustive = data.p <= EXHAUSTIVE_MAX_P
  const totalSteps = split.folds.length + 1
  const main = makePlan(data, split.train, allowExhaustive)
  onProgress?.(1 / totalSteps)
  const folds = split.folds.map((val, f) => {
    const fitRows = foldFitRows(split.train, val)
    const plan = makePlan(data, fitRows, allowExhaustive)
    onProgress?.((f + 2) / totalSteps)
    return { fitRows, val, plan }
  })

  const model = (method: MethodId, k: number): ModelResult => {
    const features = subsetFor(main, method, k)
    const fit = features ? fitOls(data, split.train, features) : null
    const test = fit?.status === 'ok' ? evaluateTest(fit, data, split.test) : null
    let cvRmse: number | null = 0
    for (const f of folds) {
      const r = foldRmse(data, f.fitRows, f.val, subsetFor(f.plan, method, k))
      if (r === null) {
        cvRmse = null
        break
      }
      cvRmse += r / folds.length
    }
    return { method, k: features?.length ?? k, features, fit, test, cvRmse }
  }

  const methods = {} as Record<SelectionMethod, MethodResults>
  for (const m of SELECTION_METHODS) {
    if (m === 'exhaustive' && !allowExhaustive) {
      methods[m] = {
        available: false,
        reason: `特徵數 p = ${data.p} 超過 ${EXHAUSTIVE_MAX_P}，特徵組合數 2^p 過多`,
        byK: [],
      }
      continue
    }
    methods[m] = { available: true, byK: Array.from({ length: data.p }, (_, i) => model(m, i + 1)) }
  }

  return {
    n: data.n,
    p: data.p,
    columns: data.columns,
    split,
    ols: model('ols', data.p),
    methods,
  }
}
