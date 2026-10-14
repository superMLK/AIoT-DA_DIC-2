import { useMemo } from 'react'
import type { MethodId, ModelResult, ResultBundle } from '../../engine/pipeline.ts'
import { availableMethods, bestCvMethod, modelOf } from '../../state/reducer.ts'
import { useStore } from '../../state/store.tsx'
import { fmtFixed, fmtP } from '../common/format.ts'
import { LineChart, type Series } from '../common/LineChart.tsx'
import { METHOD_META } from '../common/methods.ts'
import { useCurrent } from '../common/useCurrent.ts'
import { Chapter } from '../layout/Chapter.tsx'
import { SingularNote } from './Modeling.tsx'
import { PrepErrorNote } from './PrepErrorNote.tsx'

const fmt2 = (v: number) => fmtFixed(v, 2)
const fmtR2 = (v: number) => fmtFixed(v, 3)

export function Evaluation() {
  const { bundle, prep, model, updating, prepError } = useCurrent()
  const { state } = useStore()
  return (
    <Chapter id="evaluation" updating={updating}>
      <div className="stack">
        {prepError && <PrepErrorNote message={prepError} />}
        {bundle && model && prep && (
          <>
            <MetricReadouts model={model} />
            <KCharts bundle={bundle} />
            {state.view.method === 'all' && <CompareTable bundle={bundle} columns={prep.data.columns} />}
            {model.fit?.status === 'singular' && <SingularNote fit={model.fit} columns={prep.data.columns} />}
            {model.test && <ResidualTable model={model} sourceRows={prep.sourceRows} />}
          </>
        )}
      </div>
    </Chapter>
  )
}

function MetricReadouts({ model }: { model: ModelResult }) {
  const fit = model.fit?.status === 'ok' ? model.fit : null
  const m = model.test?.metrics
  const items = [
    { label: 'Test RMSE', value: m ? fmt2(m.rmse) : null, src: '測試集', hint: '預測誤差的平方平均再開根號，與 y 同單位，越小越好' },
    { label: 'Test MAE', value: m ? fmt2(m.mae) : null, src: '測試集', hint: '預測誤差絕對值的平均，比 RMSE 不受極端值影響' },
    { label: 'Test R²', value: m ? fmtR2(m.r2) : null, src: '測試集', hint: '模型解釋了測試集 y 變異的比例；可能為負' },
    { label: 'Adjusted R²', value: fit ? fmtR2(fit.adjR2) : null, src: '訓練集', hint: '依特徵數懲罰後的 R²，加入沒用的特徵會讓它下降' },
    {
      label: 'F 檢定',
      value: fit ? fmtFixed(fit.F, 2) : null,
      extra: fit ? (fit.Fp < 0.001 ? 'p < .001' : `p = ${fmtP(fit.Fp)}`) : null,
      src: '訓練集',
      hint: '檢定「所有係數都等於 0」；p 值很小代表模型整體有解釋力',
    },
  ]
  return (
    <dl className="readouts">
      {items.map((it) => (
        <div key={it.label} className="readout" title={it.hint}>
          <dt>
            {it.label}
            <span className="src">{it.src}</span>
          </dt>
          <dd className="num">{it.value ?? <span className="muted">無法估計</span>}</dd>
          {it.extra && <dd className="extra num">{it.extra}</dd>}
        </div>
      ))}
    </dl>
  )
}

function seriesValues(bundle: ResultBundle, method: MethodId, pick: (r: ModelResult) => number | null | undefined) {
  return Array.from({ length: bundle.p }, (_, i) => {
    const r = modelOf(bundle, method, i + 1)
    const v = r ? pick(r) : null
    return v ?? null
  })
}

const testRmse = (r: ModelResult) => r.test?.metrics.rmse
const cvRmse = (r: ModelResult) => r.cvRmse
const testR2 = (r: ModelResult) => r.test?.metrics.r2
const adjR2 = (r: ModelResult) => (r.fit?.status === 'ok' ? r.fit.adjR2 : null)

/** 不同方法常選到相同特徵而完全重疊：越後面的方法畫在越下層、點越大，形成同心標記。 */
function stacked(i: number): Pick<Series, 'radius' | 'order'> {
  // Chart.js 先畫 order 大的資料集，order 小的在上層
  return { radius: 4 + 2.2 * i, order: i }
}

function baseline(bundle: ResultBundle, label: string, v: number | null | undefined): Series {
  return {
    label,
    values: Array(bundle.p).fill(v ?? null),
    colorVar: METHOD_META.ols.colorVar,
    pointStyle: 'line',
    baseline: true,
    order: 99,
  }
}

function KCharts({ bundle }: { bundle: ResultBundle }) {
  const { state, dispatch } = useStore()
  const { method, k, compareMetric } = state.view
  const labels = useMemo(() => Array.from({ length: bundle.p }, (_, i) => String(i + 1)), [bundle])
  const markerIndex = method === 'ols' ? null : k - 1

  const { rmse, r2 } = useMemo(() => {
    if (method === 'all') {
      const methods = availableMethods(bundle)
      const pick = compareMetric === 'test' ? testRmse : cvRmse
      const tag = compareMetric === 'test' ? 'Test' : 'CV'
      return {
        rmse: [
          ...methods.map<Series>((m, i) => ({
            label: METHOD_META[m].label,
            values: seriesValues(bundle, m, pick),
            colorVar: METHOD_META[m].colorVar,
            pointStyle: METHOD_META[m].pointStyle,
            ...stacked(i),
          })),
          baseline(bundle, `OLS 基準（${tag}）`, pick(bundle.ols)),
        ],
        r2: [
          ...methods.map<Series>((m, i) => ({
            label: METHOD_META[m].label,
            values: seriesValues(bundle, m, testR2),
            colorVar: METHOD_META[m].colorVar,
            pointStyle: METHOD_META[m].pointStyle,
            ...stacked(i),
          })),
          baseline(bundle, 'OLS 基準（Test）', testR2(bundle.ols)),
        ],
      }
    }
    if (method === 'ols') {
      return {
        rmse: [baseline(bundle, 'OLS 基準 Test RMSE', testRmse(bundle.ols)), { ...baseline(bundle, 'OLS 基準 CV RMSE', cvRmse(bundle.ols)), colorVar: '--series-1' }],
        r2: [baseline(bundle, 'OLS 基準 Test R²', testR2(bundle.ols)), { ...baseline(bundle, 'OLS 基準 Adjusted R²（訓練）', adjR2(bundle.ols)), colorVar: '--series-1' }],
      }
    }
    const meta = METHOD_META[method]
    return {
      rmse: [
        { label: `${meta.label} Test RMSE`, values: seriesValues(bundle, method, testRmse), colorVar: meta.colorVar, pointStyle: meta.pointStyle },
        { label: `${meta.label} CV RMSE`, values: seriesValues(bundle, method, cvRmse), colorVar: meta.colorVar, pointStyle: meta.pointStyle, dashed: true },
        baseline(bundle, 'OLS 基準（Test）', testRmse(bundle.ols)),
      ] as Series[],
      r2: [
        { label: `${meta.label} Test R²`, values: seriesValues(bundle, method, testR2), colorVar: meta.colorVar, pointStyle: meta.pointStyle },
        { label: `${meta.label} Adjusted R²（訓練）`, values: seriesValues(bundle, method, adjR2), colorVar: meta.colorVar, pointStyle: meta.pointStyle, dashed: true },
        baseline(bundle, 'OLS 基準（Test）', testR2(bundle.ols)),
      ] as Series[],
    }
  }, [bundle, method, compareMetric])

  return (
    <div className="chart-grid">
      <figure className="figure">
        <figcaption>
          圖 2｜RMSE vs k
          <span className="sub">
            {method === 'all' ? `每條線是一種方法的 ${compareMetric === 'test' ? 'Test' : 'CV'} RMSE` : '實線＝Test、虛線＝5 折 CV'}
          </span>
        </figcaption>
        {method === 'all' && (
          <div className="segmented" role="group" aria-label="比較模式的 RMSE 種類" style={{ marginBottom: 8 }}>
            {(['test', 'cv'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={compareMetric === m}
                onClick={() => dispatch({ type: 'setCompareMetric', metric: m })}
              >
                {m === 'test' ? 'Test RMSE' : 'CV RMSE'}
              </button>
            ))}
          </div>
        )}
        <LineChart labels={labels} series={rmse} markerIndex={markerIndex} yLabel="RMSE" format={fmt2} ariaLabel="RMSE 隨特徵數 k 變化的折線圖" />
        <ChartTable labels={labels} series={rmse} format={fmt2} />
      </figure>
      <figure className="figure">
        <figcaption>
          圖 3｜R² vs k
          <span className="sub">{method === 'all' ? '每條線是一種方法的 Test R²' : '實線＝Test R²、虛線＝訓練集 Adjusted R²'}</span>
        </figcaption>
        <LineChart labels={labels} series={r2} markerIndex={markerIndex} yLabel="R²" format={fmtR2} ariaLabel="R² 隨特徵數 k 變化的折線圖" />
        <ChartTable labels={labels} series={r2} format={fmtR2} />
      </figure>
    </div>
  )
}

function ChartTable({ labels, series, format }: { labels: string[]; series: Series[]; format: (v: number) => string }) {
  return (
    <details className="chart-table">
      <summary>以表格檢視數值</summary>
      <div className="table-wrap">
        <table className="three-line">
          <thead>
            <tr>
              <th>k</th>
              {series.map((s) => (
                <th key={s.label} className="r">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((l, i) => (
              <tr key={l}>
                <td className="num">{l}</td>
                {series.map((s) => (
                  <td key={s.label} className="r num">
                    {s.values[i] == null ? <span className="muted">無法估計</span> : format(s.values[i]!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function CompareTable({ bundle, columns }: { bundle: ResultBundle; columns: string[] }) {
  const { state, dispatch } = useStore()
  const { k } = state.view
  const best = bestCvMethod(bundle, k)
  const shown = state.view.detailMethod ?? best ?? 'ols'
  const methods: MethodId[] = [...availableMethods(bundle), 'ols']
  const rows = methods.map((m) => ({ m, r: modelOf(bundle, m, k)! }))
  const key = (f: number[] | null) => (f ? f.join(',') : '')

  return (
    <div className="table-wrap">
      <table className="three-line compare">
        <caption>表 4｜k = {k} 時各方法的比較（點選一列查看該模型的細節）</caption>
        <thead>
          <tr>
            <th>方法</th>
            <th>入選特徵</th>
            <th className="r">Test RMSE</th>
            <th className="r">CV RMSE</th>
            <th className="r">Adjusted R²</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, r }, i) => {
            const same = r.features ? rows.slice(0, i).find((o) => key(o.r.features) === key(r.features)) : undefined
            const fit = r.fit?.status === 'ok' ? r.fit : null
            const select = () => dispatch({ type: 'setDetailMethod', method: m })
            return (
              <tr
                key={m}
                className={`is-clickable${shown === m ? ' is-selected' : ''}`}
                onClick={select}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select())}
                tabIndex={0}
                aria-selected={shown === m}
              >
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className="swatch" style={{ background: `var(${METHOD_META[m].colorVar})` }} aria-hidden="true" />
                  {METHOD_META[m].label}
                  {m === best && <span className="tag tag-accent" style={{ marginLeft: 6 }}>CV 最低</span>}
                  {m === 'ols' && <span className="muted"> （k = {r.k}）</span>}
                </td>
                <td>
                  {same ? (
                    <span className="muted">與 {METHOD_META[same.m].label} 相同</span>
                  ) : r.features ? (
                    r.features.map((c) => columns[c]).join('、')
                  ) : (
                    <span className="muted">無法選出 {k} 個</span>
                  )}
                </td>
                <td className="r num">{r.test ? fmt2(r.test.metrics.rmse) : <span className="muted">無法估計</span>}</td>
                <td className="r num">{r.cvRmse != null ? fmt2(r.cvRmse) : <span className="muted">無法估計</span>}</td>
                <td className="r num">{fit ? fmtR2(fit.adjR2) : <span className="muted">無法估計</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ResidualTable({ model, sourceRows }: { model: ModelResult; sourceRows: number[] }) {
  const fit = model.fit?.status === 'ok' ? model.fit : null
  const rows = useMemo(
    () => (model.test ? [...model.test.rows].sort((a, b) => Math.abs(b.resid) - Math.abs(a.resid)) : []),
    [model],
  )
  if (!fit) return null
  const flagged = rows.filter((r) => Math.abs(r.r) > fit.tCrit).length
  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="three-line">
          <caption>表 5｜測試集殘差診斷（依 |殘差| 由大到小）</caption>
          <thead>
            <tr>
              <th className="r">排名</th>
              <th className="r">原始列號</th>
              <th className="r">實際值</th>
              <th className="r">預測值</th>
              <th className="r">殘差</th>
              <th className="r">r</th>
              <th className="r">95% 預測區間</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const abs = Math.abs(r.r)
              return (
                <tr key={r.row}>
                  <td className="r num muted">{i + 1}</td>
                  <td className="r num">{sourceRows[r.row] + 1}</td>
                  <td className="r num">{fmt2(r.actual)}</td>
                  <td className="r num">{fmt2(r.pred)}</td>
                  <td className="r num">{fmt2(r.resid)}</td>
                  <td className="r num">{fmtFixed(r.r, 2)}</td>
                  <td className="r num">
                    [{fmt2(r.piLower)}, {fmt2(r.piUpper)}]
                  </td>
                  <td>
                    {abs > 3 ? (
                      <span className="tag tag-warn">⚠ 可能離群</span>
                    ) : abs > fit.tCrit ? (
                      <span className="tag tag-caution">注意</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="note">
        r = 殘差 ÷ (s·√(1 + h))，s 是訓練集殘差標準誤，h 是槓桿值（這筆資料離訓練資料中心多遠）。|r| 大於 t 臨界值{' '}
        <span className="num">{fmtFixed(fit.tCrit, 3)}</span> 等同實際值落在 95% 預測區間外，標為「注意」；|r| &gt; 3 標為「可能離群」。
        目前共 {flagged} 筆在區間外；即使模型正確，大約也會有 5% 的資料落在外面。
      </p>
    </div>
  )
}
