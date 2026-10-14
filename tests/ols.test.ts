import { describe, expect, it } from 'vitest'
import { evaluateTest, fitOls, regressionMetrics, type OlsOk } from '../src/engine/ols.ts'
import type { NumericData } from '../src/engine/types.ts'
import { expectAllClose, expectClose, fixtureCases, loadFixture, toNumericData, type FixtureInput } from './helpers.ts'

const REL = 1e-6
const P_FLOOR = 1e-12

for (const name of fixtureCases()) {
  const input = loadFixture<FixtureInput>(`${name}.input.json`)
  const expected = loadFixture(`${name}.expected.json`)
  const data = toNumericData(input)

  describe(`OLS 與 statsmodels 一致：${name}`, () => {
    expected.ols.forEach((exp: any) => {
      it(`特徵子集 [${exp.subset}]`, () => {
        const fit = fitOls(data, input.train, exp.subset)
        expect(fit.status).toBe('ok')
        const f = fit as OlsOk
        expectAllClose(f.beta, exp.params, REL, 0, 'beta')
        expectAllClose(f.se, exp.bse, REL, 0, 'se')
        expectAllClose(f.t, exp.tvalues, REL, 0, 't')
        expectAllClose(f.p, exp.pvalues, REL, P_FLOOR, 'p')
        expectAllClose(f.ciLower, exp.ci_lower, REL, 0, 'ciLower')
        expectAllClose(f.ciUpper, exp.ci_upper, REL, 0, 'ciUpper')
        expectClose(f.s, exp.s, REL, 0, 's')
        expect(f.df).toBe(exp.df_resid)
        expectClose(f.r2, exp.rsquared, REL, 0, 'r2')
        expectClose(f.adjR2, exp.rsquared_adj, REL, 0, 'adjR2')
        expectClose(f.F, exp.fvalue, REL, 0, 'F')
        expectClose(f.Fp, exp.f_pvalue, REL, P_FLOOR, 'Fp')
        if (exp.vif === null) expect(f.vif).toBeNull()
        else expectAllClose(f.vif!, exp.vif, REL, 0, 'vif')

        const ev = evaluateTest(f, data, input.test)
        expectAllClose(ev.rows.map((r) => r.pred), exp.test.pred, 1e-9, 0, 'pred')
        expectAllClose(ev.rows.map((r) => r.piLower), exp.test.pi_lower, REL, 0, 'piLower')
        expectAllClose(ev.rows.map((r) => r.piUpper), exp.test.pi_upper, REL, 0, 'piUpper')
        expectAllClose(ev.rows.map((r) => r.r), exp.test.r, REL, 0, 'r')
        expectClose(ev.metrics.rmse, exp.test.rmse, 1e-9, 0, 'rmse')
        expectClose(ev.metrics.mae, exp.test.mae, 1e-9, 0, 'mae')
        expectClose(ev.metrics.r2, exp.test.r2, 1e-9, 0, 'testR2')
      })
    })
  })
}

function makeData(rows: number[][], y: number[]): NumericData {
  const p = rows[0].length
  return { n: rows.length, p, X: Float64Array.from(rows.flat()), y: Float64Array.from(y), columns: rows[0].map((_, j) => `x${j}`) }
}

describe('無法估計的情況', () => {
  it('n − k − 1 ≤ 0', () => {
    const data = makeData([[1, 2], [2, 1], [3, 5]], [1, 2, 3])
    const fit = fitOls(data, [0, 1, 2], [0, 1])
    expect(fit).toMatchObject({ status: 'singular', reason: 'df' })
  })

  it('兩欄完全相同時回報共線特徵', () => {
    const data = makeData(
      [[1, 1, 5], [2, 2, 3], [3, 3, 8], [4, 4, 1], [5, 5, 9], [6, 6, 2]],
      [2, 4, 5, 9, 10, 13],
    )
    const fit = fitOls(data, [0, 1, 2, 3, 4, 5], [0, 1, 2])
    expect(fit).toMatchObject({ status: 'singular', reason: 'collinear', collinear: { col: 1, with: [0] } })
  })

  it('單一特徵時 VIF 為 null', () => {
    const data = makeData([[1], [2], [3], [4]], [1, 3, 2, 5])
    const fit = fitOls(data, [0, 1, 2, 3], [0]) as OlsOk
    expect(fit.vif).toBeNull()
  })
})

describe('測試集指標', () => {
  it('RMSE、MAE、R² 公式', () => {
    const m = regressionMetrics([1, 2, 3, 4], [1.5, 2, 2.5, 5])
    expectClose(m.rmse, Math.sqrt((0.25 + 0 + 0.25 + 1) / 4), 1e-15)
    expectClose(m.mae, (0.5 + 0 + 0.5 + 1) / 4, 1e-15)
    expectClose(m.r2, 1 - 1.5 / 5, 1e-15)
  })
})
