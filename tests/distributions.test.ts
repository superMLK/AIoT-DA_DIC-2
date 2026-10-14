import { describe, it } from 'vitest'
import { fSf, tCdf, tInv, tTwoSidedP } from '../src/engine/distributions.ts'
import { expectClose, loadFixture } from './helpers.ts'

const ref = loadFixture('distributions.expected.json')

describe('t / F 分布與 scipy 一致', () => {
  it('t 雙尾 p 值', () => {
    for (const r of ref.t_two_sided) expectClose(tTwoSidedP(r.t, r.df), r.p, 1e-9, 1e-12, `df=${r.df} t=${r.t}`)
  })
  it('t CDF', () => {
    for (const r of ref.t_cdf) expectClose(tCdf(r.t, r.df), r.cdf, 1e-9, 1e-12, `df=${r.df} t=${r.t}`)
  })
  it('t 0.975 分位數', () => {
    for (const r of ref.t_ppf_975) expectClose(tInv(0.975, r.df), r.q, 1e-9, 0, `df=${r.df}`)
  })
  it('F 右尾機率', () => {
    for (const r of ref.f_sf) expectClose(fSf(r.f, r.d1, r.d2), r.p, 1e-9, 1e-12, `F(${r.d1},${r.d2})=${r.f}`)
  })
})
