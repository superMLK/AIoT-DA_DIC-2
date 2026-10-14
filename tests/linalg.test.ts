import { describe, expect, it } from 'vitest'
import {
  cholesky,
  dependentOn,
  firstDeficientColumn,
  gramInverseFromQR,
  leastSquares,
  qrDecompose,
  solveLower,
} from '../src/engine/linalg.ts'
import { expectAllClose } from './helpers.ts'

/** 由列主序二維陣列建立欄主序矩陣。 */
function colMajor(rows: number[][]): Float64Array {
  const n = rows.length
  const m = rows[0].length
  const a = new Float64Array(n * m)
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) a[i + j * n] = rows[i][j]
  return a
}

describe('QR 分解', () => {
  const A = [
    [1, 2, 0.5],
    [1, -1, 3],
    [1, 4, -2],
    [1, 0.5, 1],
    [1, 3, 3],
  ]
  const b = new Float64Array([1, 2, 0.5, -1, 4])

  it('最小平方解滿足正規方程式 Aᵀ(Ax − b) = 0', () => {
    const d = qrDecompose(colMajor(A), 5, 3)
    expect(firstDeficientColumn(d)).toBe(-1)
    const x = leastSquares(d, b)
    for (let j = 0; j < 3; j++) {
      let g = 0
      for (let i = 0; i < 5; i++) {
        const r = A[i][0] * x[0] + A[i][1] * x[1] + A[i][2] * x[2] - b[i]
        g += A[i][j] * r
      }
      expect(Math.abs(g)).toBeLessThan(1e-12)
    }
  })

  it('(AᵀA)⁻¹ 與 AᵀA 相乘為單位矩陣', () => {
    const d = qrDecompose(colMajor(A), 5, 3)
    const inv = gramInverseFromQR(d)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0
        for (let k = 0; k < 3; k++) {
          let g = 0
          for (let r = 0; r < 5; r++) g += A[r][i] * A[r][k]
          s += g * inv[k + j * 3]
        }
        expect(Math.abs(s - (i === j ? 1 : 0))).toBeLessThan(1e-12)
      }
    }
  })

  it('秩判定與尺度無關，並指出相依的欄位', () => {
    // 第 3 欄 = 1e5 × 第 2 欄（大尺度）；第 4 欄 = 截距 + 第 2 欄
    const rows = [
      [1, 0.3, 3e4, 1.3],
      [1, 0.7, 7e4, 1.7],
      [1, 0.1, 1e4, 1.1],
      [1, 0.9, 9e4, 1.9],
      [1, 0.4, 4e4, 1.4],
    ]
    const d = qrDecompose(colMajor(rows), 5, 4)
    expect(firstDeficientColumn(d)).toBe(2)
    expect(dependentOn(d, 2)).toEqual([1])

    const d2 = qrDecompose(colMajor(rows.map((r) => [r[0], r[1], r[3]])), 5, 3)
    expect(firstDeficientColumn(d2)).toBe(2)
    expect(dependentOn(d2, 2)).toEqual([0, 1])
  })

  it('大尺度但滿秩的欄位不會被誤判', () => {
    const rows = [
      [1, 165349.2, 0],
      [1, 162597.7, 1],
      [1, 153441.5, 0],
      [1, 144372.4, 0],
      [1, 142107.3, 1],
    ]
    const d = qrDecompose(colMajor(rows), 5, 3)
    expect(firstDeficientColumn(d)).toBe(-1)
  })
})

describe('Cholesky', () => {
  it('正定矩陣可分解且可解 L x = b', () => {
    const g = new Float64Array([4, 2, 0.4, 2, 5, 1, 0.4, 1, 3])
    const l = cholesky(g, 3)!
    expect(l).not.toBeNull()
    // L Lᵀ = G
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let s = 0
        for (let k = 0; k < 3; k++) s += l[i + k * 3] * l[j + k * 3]
        expect(Math.abs(s - g[i + j * 3])).toBeLessThan(1e-12)
      }
    const x = solveLower(l, 3, [1, 2, 3])
    const back = [0, 1, 2].map((i) => [0, 1, 2].reduce((s, k) => s + l[i + k * 3] * x[k], 0))
    expectAllClose(back, [1, 2, 3], 1e-12)
  })

  it('奇異矩陣回報失敗', () => {
    const g = new Float64Array([1, 2, 2, 4])
    expect(cholesky(g, 2)).toBeNull()
  })
})
