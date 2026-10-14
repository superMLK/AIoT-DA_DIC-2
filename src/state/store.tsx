import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { BUILTIN_DATASETS, DEFAULT_DATASET_ID, GENERIC_DESCRIPTION } from '../data/builtins.ts'
import { defaultRoles, prepare } from '../data/clean.ts'
import { DataLoadError, describeColumns, fetchTable, parseCsv, readFileAsTable } from '../data/loader.ts'
import type { ColumnConfig, RawTable } from '../data/types.ts'
import { rewriteCsvUrl } from '../data/urlRewrite.ts'
import { makeSplit } from '../engine/split.ts'
import type { RunRequest, WorkerResponse } from '../worker/protocol.ts'
import { initialState, reducer, type Action, type AppState, type DatasetOrigin } from './reducer.ts'

interface StoreApi {
  state: AppState
  dispatch: (a: Action) => void
  loadBuiltin: (id: string) => Promise<void>
  loadUrl: (url: string) => Promise<void>
  loadFile: (file: File) => Promise<void>
  applyConfig: (config: ColumnConfig) => void
}

const StoreContext = createContext<StoreApi | null>(null)

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必須在 StoreProvider 內使用')
  return ctx
}

function datasetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file}`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const workerRef = useRef<Worker | null>(null)
  const nextId = useRef(0)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/compute.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') dispatch({ type: 'computeProgress', requestId: msg.requestId, fraction: msg.fraction })
      else if (msg.type === 'result') dispatch({ type: 'computeDone', requestId: msg.requestId, bundle: msg.bundle })
      else dispatch({ type: 'computeError', requestId: msg.requestId, message: msg.message })
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  // 資料或切分設定改變 → 送出新的計算請求（只採用最新的結果）
  const { prep, splitCfg } = state
  useEffect(() => {
    const worker = workerRef.current
    if (!worker || !prep?.ok) return
    const requestId = ++nextId.current
    dispatch({ type: 'computeStart', requestId, prep })
    const split = makeSplit(prep.data.n, splitCfg.testRatio, splitCfg.seed)
    const req: RunRequest = { type: 'run', requestId, data: prep.data, split }
    worker.postMessage(req)
  }, [prep, splitCfg])

  const install = useCallback(
    (origin: DatasetOrigin, label: string, table: RawTable, builtinId?: string) => {
      const columns = describeColumns(table)
      const builtin = BUILTIN_DATASETS.find((d) => d.id === builtinId)
      const roles = builtin ? { config: builtin.config, notes: builtin.notes } : defaultRoles(columns)
      if (!roles) {
        dispatch({ type: 'loadError', message: '這份資料沒有任何數值欄，無法作為迴歸的目標 y。', showUpload: origin.kind === 'url' })
        return
      }
      dispatch({
        type: 'datasetLoaded',
        dataset: {
          origin,
          label,
          table,
          columns,
          config: roles.config,
          notes: roles.notes,
          description: builtin?.description ?? GENERIC_DESCRIPTION,
        },
        prep: prepare(table, columns, roles.config),
      })
    },
    [],
  )

  const loadBuiltin = useCallback(
    async (id: string) => {
      const ds = BUILTIN_DATASETS.find((d) => d.id === id)
      if (!ds) return
      dispatch({ type: 'loadStart' })
      try {
        const res = await fetch(datasetUrl(ds.file))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        install({ kind: 'builtin', id }, ds.label, parseCsv(await res.text()), id)
      } catch (e) {
        dispatch({ type: 'loadError', message: `內建資料集載入失敗：${e instanceof Error ? e.message : e}`, showUpload: false })
      }
    },
    [install],
  )

  const loadUrl = useCallback(
    async (input: string) => {
      const { url, rewritten, kind } = rewriteCsvUrl(input)
      const notice = rewritten
        ? `已自動改為${kind === 'github' ? ' raw ' : ' CSV 匯出'}網址：${url}`
        : null
      dispatch({ type: 'loadStart', rewriteNotice: notice })
      try {
        const table = await fetchTable(url)
        const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || url)
        install({ kind: 'url', url }, name, table)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        const showUpload = e instanceof DataLoadError ? e.kind !== 'too-large' : true
        dispatch({ type: 'loadError', message, showUpload })
      }
    },
    [install],
  )

  const loadFile = useCallback(
    async (file: File) => {
      dispatch({ type: 'loadStart' })
      try {
        install({ kind: 'file', name: file.name }, file.name, await readFileAsTable(file))
      } catch (e) {
        dispatch({ type: 'loadError', message: e instanceof Error ? e.message : String(e), showUpload: true })
      }
    },
    [install],
  )

  const dataset = state.dataset
  const applyConfig = useCallback(
    (config: ColumnConfig) => {
      if (!dataset) return
      dispatch({ type: 'configApplied', config, prep: prepare(dataset.table, dataset.columns, config) })
    },
    [dataset],
  )

  useEffect(() => {
    void loadBuiltin(DEFAULT_DATASET_ID)
  }, [loadBuiltin])

  const api = useMemo(
    () => ({ state, dispatch, loadBuiltin, loadUrl, loadFile, applyConfig }),
    [state, loadBuiltin, loadUrl, loadFile, applyConfig],
  )
  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
