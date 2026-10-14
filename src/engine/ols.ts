import { fSf, tInv, tTwoSidedP } from './distributions.ts'
import {
  dependentOn,
  firstDeficientColumn,
  gramInverseFromQR,
  leastSquares,
  qrDecompose,
  type QR,
} from './linalg.ts'
import { cell, type NumericData } from './types.ts'

export interface OlsOk {
  status: 'ok'
  /** 入選特徵（資料欄位索引）。 */
  cols: number[]
  n: number
  k: number
  df: number
  /** 以下陣列索引 0 為截距，其後依 cols 順序。 */
  beta: Float64Array
  se: Float64Array
  t: Float64Array
  p: Float64Array
  ciLower: Float64Array
  ciUpper: Float64Array
  /** 依 cols 順序；k = 1 時為 null。 */
  vif: Float64Array | null
  /** 殘差標準誤 s。 */
  s: number
  r2: number
  adjR2: number
  F: number
  Fp: number
  /** t₀.₉₇₅,df */
  tCrit: number
  /** (XᵀX)⁻¹，(k+1)×(k+1) 欄主序，含截距。 */
  xtxInv: Float64Array
}

export interface OlsSingular {
  status: 'singular'
  cols: number[]
  n: number
  k: number
  reason: 'df' | 'collinear'
  /** reason = 'collinear' 時：與前面欄位線性相依的特徵，以及它所依賴的特徵（-1 代表截距）。 */
  collinear?: { col: number; with: number[] }
}

export type OlsResult = OlsOk | OlsSingular

/** 建立含截距的設計矩陣（欄主序）。 */
export function designMatrix(data: NumericData, rows: ArrayLike<number>, cols: number[]): Float64Array {
  const nr = rows.length
  const m = cols.length + 1
  const a = new Float64Array(nr * m)
  for (let i = 0; i < nr; i++) {
    a[i] = 1
    const base = rows[i] * data.p
    for (let j = 0; j < cols.length; j++) a[i + (j + 1) * nr] = data.X[base + cols[j]]
  }
  return a
}

function targetVector(data: NumericData, rows: ArrayLike<number>): Float64Array {
  const y = new Float64Array(rows.length)
  for (let i = 0; i < rows.length; i++) y[i] = data.y[rows[i]]
  return y
}

function sse(a: Float64Array, nr: number, m: number, beta: Float64Array, y: Float64Array): number {
  let s = 0
  for (let i = 0; i < nr; i++) {
    let yhat = 0
    for (let j = 0; j < m; j++) yhat += a[i + j * nr] * beta[j]
    const e = y[i] - yhat
    s += e * e
  }
  return s
}

function sst(y: Float64Array): number {
  let mean = 0
  for (const v of y) mean += v
  mean /= y.length
  let s = 0
  for (const v of y) s += (v - mean) * (v - mean)
  return s
}

/** 以 QR 檢查共線；回傳相依資訊（以資料欄位索引表示，-1 為截距）或 null。 */
function collinearity(d: QR, cols: number[]): { col: number; with: number[] } | null {
  const j = firstDeficientColumn(d)
  if (j < 0) return null
  const toCol = (idx: number) => (idx === 0 ? -1 : cols[idx - 1])
  return { col: toCol(j), with: dependentOn(d, j).map(toCol) }
}

/** 在指定列（訓練集）上，以含截距 OLS 擬合指定特徵。 */
export function fitOls(data: NumericData, rows: ArrayLike<number>, cols: number[]): OlsResult {
  const n = rows.length
  const k = cols.length
  const m = k + 1
  const df = n - k - 1
  if (df <= 0) return { status: 'singular', cols, n, k, reason: 'df' }

  const a = designMatrix(data, rows, cols)
  const d = qrDecompose(a, n, m)
  const col = collinearity(d, cols)
  if (col) return { status: 'singular', cols, n, k, reason: 'collinear', collinear: col }

  const y = targetVector(data, rows)
  const beta = leastSquares(d, y)
  const sseVal = sse(a, n, m, beta, y)
  const sstVal = sst(y)
  const s2 = sseVal / df
  const s = Math.sqrt(s2)
  const xtxInv = gramInverseFromQR(d)
  const tCrit = tInv(0.975, df)

  const se = new Float64Array(m)
  const t = new Float64Array(m)
  const p = new Float64Array(m)
  const ciLower = new Float64Array(m)
  const ciUpper = new Float64Array(m)
  for (let j = 0; j < m; j++) {
    se[j] = Math.sqrt(s2 * xtxInv[j + j * m])
    t[j] = beta[j] / se[j]
    p[j] = tTwoSidedP(t[j], df)
    ciLower[j] = beta[j] - tCrit * se[j]
    ciUpper[j] = beta[j] + tCrit * se[j]
  }

  const r2 = 1 - sseVal / sstVal
  const adjR2 = 1 - ((1 - r2) * (n - 1)) / df
  const F = (sstVal - sseVal) / k / s2
  const Fp = fSf(F, k, df)

  return {
    status: 'ok',
    cols,
    n,
    k,
    df,
    beta,
    se,
    t,
    p,
    ciLower,
    ciUpper,
    vif: k >= 2 ? vif(data, rows, cols) : null,
    s,
    r2,
    adjR2,
    F,
    Fp,
    tCrit,
    xtxInv,
  }
}

/** VIF_j = 1 / (1 − R²_j)，R²_j 為以其他入選特徵（含截距）迴歸特徵 j 的 R²。 */
export function vif(data: NumericData, rows: ArrayLike<number>, cols: number[]): Float64Array {
  const out = new Float64Array(cols.length)
  const n = rows.length
  for (let j = 0; j < cols.length; j++) {
    const others = cols.filter((_, i) => i !== j)
    const a = designMatrix(data, rows, others)
    const target = new Float64Array(n)
    for (let i = 0; i < n; i++) target[i] = cell(data, rows[i], cols[j])
    const d = qrDecompose(a, n, others.length + 1)
    const total = sst(target)
    if (firstDeficientColumn(d) >= 0 || total === 0) {
      out[j] = Infinity
      continue
    }
    const r2 = 1 - sse(a, n, others.length + 1, leastSquares(d, target), target) / total
    out[j] = r2 >= 1 ? Infinity : 1 / (1 - r2)
  }
  return out
}

export interface Prediction {
  yhat: number
  /** 槓桿值 h₀ = x₀ᵀ(XᵀX)⁻¹x₀ */
  h: number
  /** s·√(1 + h₀) */
  seObs: number
  piLower: number
  piUpper: number
}

/** 以入選特徵的值（依 fit.cols 順序）預測，並計算 95% 預測區間。 */
export function predict(fit: OlsOk, x: ArrayLike<number>): Prediction {
  const m = fit.k + 1
  const x0 = new Float64Array(m)
  x0[0] = 1
  for (let j = 0; j < fit.k; j++) x0[j + 1] = x[j]
  let yhat = 0
  for (let j = 0; j < m; j++) yhat += fit.beta[j] * x0[j]
  let h = 0
  for (let i = 0; i < m; i++) {
    let s = 0
    for (let j = 0; j < m; j++) s += fit.xtxInv[i + j * m] * x0[j]
    h += x0[i] * s
  }
  const seObs = fit.s * Math.sqrt(1 + h)
  return { yhat, h, seObs, piLower: yhat - fit.tCrit * seObs, piUpper: yhat + fit.tCrit * seObs }
}

export interface TestRow {
  row: number
  actual: number
  pred: number
  resid: number
  /** 標準化預測殘差 e / (s·√(1+h)) */
  r: number
  piLower: number
  piUpper: number
}

export interface TestMetrics {
  rmse: number
  mae: number
  r2: number
}

export function regressionMetrics(actual: ArrayLike<number>, pred: ArrayLike<number>): TestMetrics {
  const n = actual.length
  let se = 0
  let ae = 0
  let mean = 0
  for (let i = 0; i < n; i++) mean += actual[i]
  mean /= n
  let tot = 0
  for (let i = 0; i < n; i++) {
    const e = actual[i] - pred[i]
    se += e * e
    ae += Math.abs(e)
    tot += (actual[i] - mean) * (actual[i] - mean)
  }
  return { rmse: Math.sqrt(se / n), mae: ae / n, r2: 1 - se / tot }
}

/** 對測試列逐筆預測並計算指標。 */
export function evaluateTest(
  fit: OlsOk,
  data: NumericData,
  rows: ArrayLike<number>,
): { rows: TestRow[]; metrics: TestMetrics } {
  const out: TestRow[] = []
  const x = new Float64Array(fit.k)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    for (let j = 0; j < fit.k; j++) x[j] = cell(data, row, fit.cols[j])
    const pr = predict(fit, x)
    const actual = data.y[row]
    const resid = actual - pr.yhat
    out.push({ row, actual, pred: pr.yhat, resid, r: resid / pr.seObs, piLower: pr.piLower, piUpper: pr.piUpper })
  }
  return {
    rows: out,
    metrics: regressionMetrics(
      out.map((r) => r.actual),
      out.map((r) => r.pred),
    ),
  }
}
