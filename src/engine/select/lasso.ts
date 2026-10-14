import { gram, standardize } from '../standardize.ts'
import type { NumericData } from '../types.ts'

export const N_ALPHAS = 200
export const ALPHA_MIN_RATIO = 1e-4
export const ENET_L1_RATIO = 0.5
const ENTRY_REL_THRESHOLD = 1e-9
const CD_TOL = 1e-12
const CD_MAX_SWEEPS = 100_000

export interface PathOrder {
  /** 依進場先後排序的欄位索引（資料欄位），未進場者依欄位順序排在最後。 */
  order: number[]
  alphas: Float64Array
}

export function alphaGrid(alphaMax: number): Float64Array {
  const out = new Float64Array(N_ALPHAS)
  const logMax = Math.log(alphaMax)
  const logMin = Math.log(alphaMax * ALPHA_MIN_RATIO)
  for (let i = 0; i < N_ALPHAS; i++) out[i] = Math.exp(logMax + ((logMin - logMax) * i) / (N_ALPHAS - 1))
  return out
}

function softThreshold(z: number, g: number): number {
  return z > g ? z - g : z < -g ? z + g : 0
}

/**
 * 在標準化資料上，沿 α 由大到小以座標下降法計算 Lasso（l1Ratio = 1）或 ElasticNet 路徑，
 * 目標函數同 scikit-learn：(1/2n)‖y − Xw‖² + αρ‖w‖₁ + α(1−ρ)/2‖w‖²。
 * 使用 Gram 矩陣更新，成本與 n 無關。
 */
export function pathOrder(data: NumericData, rows: ArrayLike<number>, cols: number[], l1Ratio: number): PathOrder {
  const s = standardize(data, rows, cols)
  const { G, c } = gram(s)
  const { n, q } = s
  let cmax = 0
  for (let j = 0; j < q; j++) cmax = Math.max(cmax, Math.abs(c[j]))
  const alphas = alphaGrid(cmax / (n * l1Ratio))
  const threshold = ENTRY_REL_THRESHOLD * s.yStd

  const w = new Float64Array(q)
  /** Gw，隨 w 更新維護。 */
  const Gw = new Float64Array(q)
  const entryIdx = new Int32Array(q).fill(-1)
  const entryCoef = new Float64Array(q)

  for (let a = 0; a < alphas.length; a++) {
    const l1 = n * alphas[a] * l1Ratio
    const l2 = n * alphas[a] * (1 - l1Ratio)
    for (let sweep = 0; sweep < CD_MAX_SWEEPS; sweep++) {
      let maxDelta = 0
      let maxW = 0
      for (let j = 0; j < q; j++) {
        const gjj = G[j + j * q]
        if (gjj === 0) continue
        const old = w[j]
        const z = c[j] - Gw[j] + gjj * old
        const next = softThreshold(z, l1) / (gjj + l2)
        const delta = next - old
        if (delta !== 0) {
          w[j] = next
          for (let k = 0; k < q; k++) Gw[k] += G[k + j * q] * delta
        }
        maxDelta = Math.max(maxDelta, Math.abs(delta))
        maxW = Math.max(maxW, Math.abs(next))
      }
      if (maxDelta <= CD_TOL * Math.max(maxW, s.yStd)) break
    }
    for (let j = 0; j < q; j++) {
      if (entryIdx[j] < 0 && Math.abs(w[j]) > threshold) {
        entryIdx[j] = a
        entryCoef[j] = Math.abs(w[j])
      }
    }
  }

  const local = Array.from({ length: q }, (_, j) => j)
  const entered = local
    .filter((j) => entryIdx[j] >= 0)
    .sort((x, y) => entryIdx[x] - entryIdx[y] || entryCoef[y] - entryCoef[x] || x - y)
  const never = local.filter((j) => entryIdx[j] < 0)
  return { order: [...entered, ...never].map((j) => cols[j]), alphas }
}
