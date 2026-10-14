import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILTIN_DATASETS } from '../src/data/builtins.ts'
import { prepare } from '../src/data/clean.ts'
import { describeColumns, parseCsv } from '../src/data/loader.ts'
import type { ResultBundle } from '../src/engine/pipeline.ts'
import { makeSplit } from '../src/engine/split.ts'
import { bestCvMethod, currentModel, initialState, reducer, type AppState, type PreparedOk } from '../src/state/reducer.ts'
import { handleRequest, type WorkerResponse } from '../src/worker/protocol.ts'

function loadPrep(id: string, extra: string[] = []): PreparedOk {
  const ds = BUILTIN_DATASETS.find((d) => d.id === id)!
  const table = parseCsv(readFileSync(new URL(`../public/${ds.file}`, import.meta.url), 'utf8'))
  const res = prepare(table, describeColumns(table), { ...ds.config, features: [...ds.config.features, ...extra] })
  if (!res.ok) throw new Error(res.error)
  return res
}

function runWorker(prep: PreparedOk, requestId: number, seed = 42): WorkerResponse[] {
  const msgs: WorkerResponse[] = []
  handleRequest({ type: 'run', requestId, data: prep.data, split: makeSplit(prep.data.n, 0.2, seed) }, (m) => msgs.push(m))
  return msgs
}

const resultOf = (msgs: WorkerResponse[]) =>
  (msgs.find((m) => m.type === 'result') as Extract<WorkerResponse, { type: 'result' }>).bundle

describe('Worker 訊息處理', () => {
  it('依序回報進度並以結果結束', () => {
    const msgs = runWorker(loadPrep('50-startups'), 7)
    const progress = msgs.filter((m) => m.type === 'progress').map((m) => (m as { fraction: number }).fraction)
    expect(progress.length).toBe(6)
    expect(progress[progress.length - 1]).toBe(1)
    expect(msgs[msgs.length - 1]).toMatchObject({ type: 'result', requestId: 7 })
  })

  it('錯誤時回報 error 訊息而不是丟出例外', () => {
    const msgs: WorkerResponse[] = []
    const prep = loadPrep('50-startups')
    handleRequest({ type: 'run', requestId: 3, data: prep.data, split: { train: [], test: [], folds: [] } }, (m) => msgs.push(m))
    expect(msgs[msgs.length - 1]).toMatchObject({ type: 'error', requestId: 3 })
  })
})

describe('只採用最新請求的結果', () => {
  const prep = loadPrep('50-startups')
  const bundleSeed42 = resultOf(runWorker(prep, 1, 42))
  const bundleSeed7 = resultOf(runWorker(prep, 2, 7))

  it('回應亂序抵達時，舊請求的結果被忽略', () => {
    let s: AppState = reducer(initialState, { type: 'computeStart', requestId: 1, prep })
    s = reducer(s, { type: 'computeStart', requestId: 2, prep })
    s = reducer(s, { type: 'computeDone', requestId: 2, bundle: bundleSeed7 })
    s = reducer(s, { type: 'computeDone', requestId: 1, bundle: bundleSeed42 })
    expect(s.compute.result?.bundle).toBe(bundleSeed7)
    expect(s.compute.running).toBe(false)
  })

  it('舊請求先到也不會被顯示', () => {
    let s: AppState = reducer(initialState, { type: 'computeStart', requestId: 1, prep })
    s = reducer(s, { type: 'computeStart', requestId: 2, prep })
    s = reducer(s, { type: 'computeDone', requestId: 1, bundle: bundleSeed42 })
    expect(s.compute.result).toBeNull()
    expect(s.compute.running).toBe(true)
    s = reducer(s, { type: 'computeProgress', requestId: 1, fraction: 0.9 })
    expect(s.compute.fraction).toBe(0)
  })

  it('新計算進行中仍保留上一次的結果', () => {
    let s: AppState = reducer(initialState, { type: 'computeStart', requestId: 1, prep })
    s = reducer(s, { type: 'computeDone', requestId: 1, bundle: bundleSeed42 })
    s = reducer(s, { type: 'computeStart', requestId: 2, prep })
    expect(s.compute.result?.bundle).toBe(bundleSeed42)
    expect(s.compute.running).toBe(true)
  })
})

describe('k 的範圍與方法', () => {
  const boston = loadPrep('boston-housing')
  const startups = loadPrep('50-startups')
  const bostonBundle = resultOf(runWorker(boston, 1))
  const startupsBundle = resultOf(runWorker(startups, 2))

  function withResult(prep: PreparedOk, bundle: ResultBundle, base: AppState = initialState, id = 1): AppState {
    const s = reducer(base, { type: 'computeStart', requestId: id, prep })
    return reducer(s, { type: 'computeDone', requestId: id, bundle })
  }

  it('切換到 p 較小的資料集時，k 自動夾到 p', () => {
    let s = withResult(boston, bostonBundle)
    s = reducer(s, { type: 'setK', k: 12 })
    expect(s.view.k).toBe(12)
    s = withResult(startups, startupsBundle, s, 2)
    expect(s.view.k).toBe(5)
  })

  it('setK 不會超出目前資料的 p', () => {
    let s = withResult(startups, startupsBundle)
    s = reducer(s, { type: 'setK', k: 9 })
    expect(s.view.k).toBe(5)
    s = reducer(s, { type: 'setK', k: 0 })
    expect(s.view.k).toBe(1)
  })

  it('OLS 基準的模型不受 k 影響', () => {
    let s = withResult(startups, startupsBundle)
    s = reducer(s, { type: 'setMethod', method: 'ols' })
    s = reducer(s, { type: 'setK', k: 1 })
    expect(currentModel(s)?.features).toEqual([0, 1, 2, 3, 4])
  })

  it('比較模式預設顯示 CV 最低的方法，點選後切換', () => {
    let s = withResult(startups, startupsBundle)
    s = reducer(s, { type: 'setK', k: 3 })
    const best = bestCvMethod(startupsBundle, 3)!
    expect(currentModel(s)?.method).toBe(best)
    s = reducer(s, { type: 'setDetailMethod', method: 'rfe' })
    expect(currentModel(s)?.method).toBe('rfe')
    s = reducer(s, { type: 'setK', k: 2 })
    expect(currentModel(s)?.method).toBe(bestCvMethod(startupsBundle, 2))
  })

  it('載入失敗時保留目前資料', () => {
    let s = withResult(startups, startupsBundle)
    s = reducer(s, { type: 'loadStart' })
    s = reducer(s, { type: 'loadError', message: 'CORS', showUpload: true })
    expect(s.compute.result?.bundle).toBe(startupsBundle)
    expect(s.load).toMatchObject({ status: 'error', showUpload: true })
  })
})
