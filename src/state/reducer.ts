import type { PrepareResult } from '../data/clean.ts'
import type { ColumnConfig, ColumnInfo, ColumnNote, RawTable } from '../data/types.ts'
import type { MethodId, ModelResult, ResultBundle, SelectionMethod } from '../engine/pipeline.ts'
import { SELECTION_METHODS } from '../engine/pipeline.ts'
import { DEFAULT_SEED, DEFAULT_TEST_RATIO } from '../engine/split.ts'

export type PreparedOk = Extract<PrepareResult, { ok: true }>

export type DatasetOrigin =
  | { kind: 'builtin'; id: string }
  | { kind: 'url'; url: string }
  | { kind: 'file'; name: string }

export interface DatasetState {
  origin: DatasetOrigin
  label: string
  table: RawTable
  columns: ColumnInfo[]
  config: ColumnConfig
  notes: Record<string, ColumnNote>
  description: string[]
}

export type ViewMethod = MethodId | 'all'

export interface AppState {
  dataset: DatasetState | null
  prep: PrepareResult | null
  splitCfg: { testRatio: number; seed: number }
  view: {
    method: ViewMethod
    k: number
    compareMetric: 'test' | 'cv'
    /** 比較模式下使用者點選的方法；null 代表自動（CV 最低者）。 */
    detailMethod: MethodId | null
  }
  compute: {
    latestId: number
    running: boolean
    fraction: number
    pending: PreparedOk | null
    result: { bundle: ResultBundle; prep: PreparedOk } | null
    error: string | null
  }
  load: {
    status: 'idle' | 'loading' | 'error'
    message: string | null
    /** 是否顯示本機上傳區（網址讀取失敗後）。 */
    showUpload: boolean
    rewriteNotice: string | null
  }
}

export const initialState: AppState = {
  dataset: null,
  prep: null,
  splitCfg: { testRatio: DEFAULT_TEST_RATIO, seed: DEFAULT_SEED },
  view: { method: 'all', k: 2, compareMetric: 'test', detailMethod: null },
  compute: { latestId: 0, running: false, fraction: 0, pending: null, result: null, error: null },
  load: { status: 'idle', message: null, showUpload: false, rewriteNotice: null },
}

export type Action =
  | { type: 'loadStart'; rewriteNotice?: string | null }
  | { type: 'loadError'; message: string; showUpload: boolean }
  | { type: 'datasetLoaded'; dataset: DatasetState; prep: PrepareResult }
  | { type: 'configApplied'; config: ColumnConfig; prep: PrepareResult }
  | { type: 'splitChanged'; testRatio?: number; seed?: number }
  | { type: 'setMethod'; method: ViewMethod }
  | { type: 'setK'; k: number }
  | { type: 'setCompareMetric'; metric: 'test' | 'cv' }
  | { type: 'setDetailMethod'; method: MethodId | null }
  | { type: 'computeStart'; requestId: number; prep: PreparedOk }
  | { type: 'computeProgress'; requestId: number; fraction: number }
  | { type: 'computeDone'; requestId: number; bundle: ResultBundle }
  | { type: 'computeError'; requestId: number; message: string }

export function clampK(k: number, p: number): number {
  return Math.max(1, Math.min(k, p))
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loadStart':
      return { ...state, load: { status: 'loading', message: null, showUpload: false, rewriteNotice: action.rewriteNotice ?? null } }
    case 'loadError':
      // 載入失敗時保留目前的資料集與結果
      return { ...state, load: { ...state.load, status: 'error', message: action.message, showUpload: action.showUpload } }
    case 'datasetLoaded':
      return {
        ...state,
        dataset: action.dataset,
        prep: action.prep,
        load: { ...state.load, status: 'idle', message: null, showUpload: false },
      }
    case 'configApplied':
      if (!state.dataset) return state
      return { ...state, dataset: { ...state.dataset, config: action.config }, prep: action.prep }
    case 'splitChanged':
      return {
        ...state,
        splitCfg: {
          testRatio: action.testRatio ?? state.splitCfg.testRatio,
          seed: action.seed ?? state.splitCfg.seed,
        },
      }
    case 'setMethod':
      return { ...state, view: { ...state.view, method: action.method, detailMethod: null } }
    case 'setK': {
      const p = state.compute.result?.bundle.p ?? action.k
      return { ...state, view: { ...state.view, k: clampK(action.k, p), detailMethod: null } }
    }
    case 'setCompareMetric':
      return { ...state, view: { ...state.view, compareMetric: action.metric } }
    case 'setDetailMethod':
      return { ...state, view: { ...state.view, detailMethod: action.method } }
    case 'computeStart':
      return {
        ...state,
        compute: { ...state.compute, latestId: action.requestId, running: true, fraction: 0, pending: action.prep, error: null },
      }
    case 'computeProgress':
      if (action.requestId !== state.compute.latestId) return state
      return { ...state, compute: { ...state.compute, fraction: action.fraction } }
    case 'computeDone': {
      // 只採用最新請求的結果
      if (action.requestId !== state.compute.latestId || !state.compute.pending) return state
      const { bundle } = action
      let method = state.view.method
      if (method === 'exhaustive' && !bundle.methods.exhaustive.available) method = 'all'
      return {
        ...state,
        view: { ...state.view, method, k: clampK(state.view.k, bundle.p), detailMethod: null },
        compute: {
          ...state.compute,
          running: false,
          fraction: 1,
          result: { bundle, prep: state.compute.pending },
          pending: null,
        },
      }
    }
    case 'computeError':
      if (action.requestId !== state.compute.latestId) return state
      return { ...state, compute: { ...state.compute, running: false, error: action.message, pending: null } }
  }
}

// ---------- selectors ----------

export function availableMethods(bundle: ResultBundle): SelectionMethod[] {
  return SELECTION_METHODS.filter((m) => bundle.methods[m].available)
}

/** 目前 k 下 CV RMSE 最低的選擇方法。 */
export function bestCvMethod(bundle: ResultBundle, k: number): SelectionMethod | null {
  let best: SelectionMethod | null = null
  let bestCv = Infinity
  for (const m of availableMethods(bundle)) {
    const cv = bundle.methods[m].byK[k - 1]?.cvRmse
    if (cv != null && cv < bestCv) {
      best = m
      bestCv = cv
    }
  }
  return best
}

/** 細節區塊要顯示的方法。 */
export function detailMethodOf(state: AppState): MethodId | null {
  const bundle = state.compute.result?.bundle
  if (!bundle) return null
  const { method, k, detailMethod } = state.view
  if (method !== 'all') return method
  return detailMethod ?? bestCvMethod(bundle, k) ?? 'ols'
}

export function modelOf(bundle: ResultBundle, method: MethodId, k: number): ModelResult | null {
  if (method === 'ols') return bundle.ols
  const res = bundle.methods[method]
  return res.available ? (res.byK[k - 1] ?? null) : null
}

export function currentModel(state: AppState): ModelResult | null {
  const bundle = state.compute.result?.bundle
  const method = detailMethodOf(state)
  if (!bundle || !method) return null
  return modelOf(bundle, method, state.view.k)
}
