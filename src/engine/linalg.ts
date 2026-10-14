// 小型稠密線性代數。矩陣一律以欄主序（column-major）Float64Array 儲存：a[i + j * rows]。

export interface QR {
  rows: number
  cols: number
  /** Householder 向量（對角線以下含對角線）與 R 的嚴格上三角，欄主序。 */
  qr: Float64Array
  rdiag: Float64Array
  /** 每一欄的原始 2-norm，用於與尺度無關的秩判定。 */
  colNorms: Float64Array
}

export const RANK_TOL = 1e-10

/** Householder QR 分解（不含欄位樞紐），會複製輸入。 */
export function qrDecompose(a: Float64Array, rows: number, cols: number): QR {
  const qr = Float64Array.from(a)
  const rdiag = new Float64Array(cols)
  const colNorms = new Float64Array(cols)
  for (let j = 0; j < cols; j++) {
    let s = 0
    for (let i = 0; i < rows; i++) s = Math.hypot(s, qr[i + j * rows])
    colNorms[j] = s
  }
  for (let k = 0; k < cols; k++) {
    const ck = k * rows
    let nrm = 0
    for (let i = k; i < rows; i++) nrm = Math.hypot(nrm, qr[i + ck])
    if (nrm !== 0) {
      if (qr[k + ck] < 0) nrm = -nrm
      for (let i = k; i < rows; i++) qr[i + ck] /= nrm
      qr[k + ck] += 1
      for (let j = k + 1; j < cols; j++) {
        const cj = j * rows
        let s = 0
        for (let i = k; i < rows; i++) s += qr[i + ck] * qr[i + cj]
        s = -s / qr[k + ck]
        for (let i = k; i < rows; i++) qr[i + cj] += s * qr[i + ck]
      }
    }
    rdiag[k] = -nrm
  }
  return { rows, cols, qr, rdiag, colNorms }
}

/** 第一個（依欄序）與前面欄位線性相依的欄位索引；滿秩時回傳 -1。 */
export function firstDeficientColumn(d: QR): number {
  for (let j = 0; j < d.cols; j++) {
    if (d.colNorms[j] === 0 || Math.abs(d.rdiag[j]) <= RANK_TOL * d.colNorms[j]) return j
  }
  return -1
}

/** 取出上三角 R（cols × cols，欄主序）。 */
export function rFactor(d: QR): Float64Array {
  const m = d.cols
  const r = new Float64Array(m * m)
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < j; i++) r[i + j * m] = d.qr[i + j * d.rows]
    r[j + j * m] = d.rdiag[j]
  }
  return r
}

/** 計算 Qᵀb（長度 rows），不修改 b。 */
export function qtMultiply(d: QR, b: Float64Array): Float64Array {
  const x = Float64Array.from(b)
  for (let k = 0; k < d.cols; k++) {
    const ck = k * d.rows
    if (d.qr[k + ck] === 0) continue
    let s = 0
    for (let i = k; i < d.rows; i++) s += d.qr[i + ck] * x[i]
    s = -s / d.qr[k + ck]
    for (let i = k; i < d.rows; i++) x[i] += s * d.qr[i + ck]
  }
  return x
}

/** 解上三角系統 R x = b（R 為 m × m 欄主序，只使用前 m 個 b 元素）。 */
export function solveUpper(r: Float64Array, m: number, b: ArrayLike<number>): Float64Array {
  const x = new Float64Array(m)
  for (let i = m - 1; i >= 0; i--) {
    let s = b[i]
    for (let j = i + 1; j < m; j++) s -= r[i + j * m] * x[j]
    x[i] = s / r[i + i * m]
  }
  return x
}

/** 最小平方解 argmin‖Ax − b‖（A 須滿秩）。 */
export function leastSquares(d: QR, b: Float64Array): Float64Array {
  return solveUpper(rFactor(d), d.cols, qtMultiply(d, b))
}

/** 上三角矩陣的反矩陣（亦為上三角）。 */
export function invertUpper(r: Float64Array, m: number): Float64Array {
  const inv = new Float64Array(m * m)
  for (let j = 0; j < m; j++) {
    inv[j + j * m] = 1 / r[j + j * m]
    for (let i = j - 1; i >= 0; i--) {
      let s = 0
      for (let k = i + 1; k <= j; k++) s += r[i + k * m] * inv[k + j * m]
      inv[i + j * m] = -s / r[i + i * m]
    }
  }
  return inv
}

/** (AᵀA)⁻¹ = R⁻¹R⁻ᵀ（m × m，對稱，欄主序）。 */
export function gramInverseFromQR(d: QR): Float64Array {
  const m = d.cols
  const ri = invertUpper(rFactor(d), m)
  const out = new Float64Array(m * m)
  for (let i = 0; i < m; i++) {
    for (let j = i; j < m; j++) {
      let s = 0
      for (let k = Math.max(i, j); k < m; k++) s += ri[i + k * m] * ri[j + k * m]
      out[i + j * m] = s
      out[j + i * m] = s
    }
  }
  return out
}

/**
 * 求解 R[0..k-1, 0..k-1] z = R[0..k-1, k]，找出第 k 欄由哪些前面的欄位線性組成。
 * 回傳係數絕對值顯著的前面欄位索引。
 */
export function dependentOn(d: QR, k: number): number[] {
  if (k === 0) return []
  const r = rFactor(d)
  const m = d.cols
  const rhs = new Float64Array(k)
  for (let i = 0; i < k; i++) rhs[i] = r[i + k * m]
  const sub = new Float64Array(k * k)
  for (let j = 0; j < k; j++) for (let i = 0; i <= j; i++) sub[i + j * k] = r[i + j * m]
  const z = solveUpper(sub, k, rhs)
  const out: number[] = []
  for (let j = 0; j < k; j++) {
    const scaled = Math.abs(z[j]) * d.colNorms[j]
    if (scaled > 1e-8 * d.colNorms[k]) out.push(j)
  }
  return out
}

/**
 * Cholesky 分解 G = LLᵀ（m × m 對稱，欄主序）。不正定（樞紐 ≤ tol · 對角元）時回傳 null。
 */
export function cholesky(g: Float64Array, m: number, tol = 1e-12): Float64Array | null {
  const l = new Float64Array(m * m)
  for (let j = 0; j < m; j++) {
    let s = g[j + j * m]
    for (let k = 0; k < j; k++) s -= l[j + k * m] * l[j + k * m]
    if (!(s > tol * Math.abs(g[j + j * m])) || !(s > 0)) return null
    const ljj = Math.sqrt(s)
    l[j + j * m] = ljj
    for (let i = j + 1; i < m; i++) {
      let t = g[i + j * m]
      for (let k = 0; k < j; k++) t -= l[i + k * m] * l[j + k * m]
      l[i + j * m] = t / ljj
    }
  }
  return l
}

/** 解下三角系統 L x = b。 */
export function solveLower(l: Float64Array, m: number, b: ArrayLike<number>): Float64Array {
  const x = new Float64Array(m)
  for (let i = 0; i < m; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= l[i + k * m] * x[k]
    x[i] = s / l[i + i * m]
  }
  return x
}
