import { useMemo } from 'react'
import { parseNumber } from '../../data/loader.ts'
import { correlationMatrix, summarize } from '../../engine/describe.ts'
import { useStore } from '../../state/store.tsx'
import { fmtFixed, fmtSig } from '../common/format.ts'
import { Chapter } from '../layout/Chapter.tsx'

export function DataUnderstanding() {
  const { state } = useStore()
  const ds = state.dataset
  const prep = state.prep

  const stats = useMemo(() => {
    if (!ds) return []
    return ds.columns
      .map((c, j) => ({ c, j }))
      .filter(({ c }) => c.kind === 'numeric')
      .map(({ c, j }) => {
        const values = ds.table.rows.map((r) => parseNumber(r[j])).filter((v): v is number => v !== null && Number.isFinite(v))
        return { name: c.name, ...summarize(values) }
      })
  }, [ds])

  const corr = useMemo(() => (prep?.ok ? correlationMatrix(prep.data) : null), [prep])

  if (!ds) return <Chapter id="data-understanding">{null}</Chapter>
  const preview = ds.table.rows.slice(0, 10)
  const categorical = ds.columns.filter((c) => c.kind === 'categorical')

  return (
    <Chapter id="data-understanding">
      <div className="stack">
        <p>
          共 <span className="num">{ds.table.rows.length}</span> 列、<span className="num">{ds.table.headers.length}</span> 欄。
          {categorical.length > 0 && (
            <>
              類別欄：
              {categorical.map((c, i) => (
                <span key={c.name}>
                  {i > 0 && '、'}
                  {c.name}（{c.levels.length} 級）
                </span>
              ))}
              。
            </>
          )}
        </p>

        <div className="table-wrap">
          <table className="three-line">
            <caption>表 1｜資料預覽（前 10 列）</caption>
            <thead>
              <tr>
                <th className="r">#</th>
                {ds.table.headers.map((h) => (
                  <th key={h} className={ds.columns.find((c) => c.name === h)?.kind === 'numeric' ? 'r' : ''}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  <td className="r num muted">{i + 1}</td>
                  {row.map((v, j) => (
                    <td key={j} className={ds.columns[j].kind === 'numeric' ? 'r num' : ''}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-wrap">
          <table className="three-line">
            <caption>表 2｜數值欄描述統計</caption>
            <thead>
              <tr>
                <th>欄位</th>
                <th className="r">筆數</th>
                <th className="r">平均數</th>
                <th className="r">標準差</th>
                <th className="r">最小值</th>
                <th className="r">最大值</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td className="r num">{s.count}</td>
                  <td className="r num">{fmtSig(s.mean, 6)}</td>
                  <td className="r num">{fmtSig(s.std, 6)}</td>
                  <td className="r num">{fmtSig(s.min, 6)}</td>
                  <td className="r num">{fmtSig(s.max, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {corr && prep?.ok && <CorrelationHeatmap names={[prep.report.target, ...prep.data.columns]} corr={corr} />}
      </div>
    </Chapter>
  )
}

function CorrelationHeatmap({ names, corr }: { names: string[]; corr: number[][] }) {
  const m = names.length
  const cell = m > 14 ? 34 : 56
  return (
    <figure className="figure" style={{ margin: 0 }}>
      <figcaption>
        圖 1｜相關係數熱圖
        <span className="sub">Pearson r，以清理後的完整資料計算；第一列為目標 y</span>
      </figcaption>
      <div className="table-wrap">
        <table className="heatmap" style={{ ['--cell' as string]: `${cell}px` }}>
          <thead>
            <tr>
              <th />
              {names.map((n) => (
                <th key={n} scope="col" title={n}>
                  <span>{n}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {corr.map((row, i) => (
              <tr key={names[i]}>
                <th scope="row" title={names[i]}>
                  {names[i]}
                </th>
                {row.map((r, j) => {
                  const pct = Number.isFinite(r) ? Math.round(Math.abs(r) * 100) : 0
                  const pole = r >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'
                  return (
                    <td
                      key={j}
                      className="num"
                      title={`${names[i]} × ${names[j]}：r = ${fmtFixed(r, 3)}`}
                      style={{
                        background: `color-mix(in oklab, ${pole} ${pct}%, var(--div-mid))`,
                        color: pct > 55 ? 'var(--paper)' : 'var(--ink)',
                      }}
                    >
                      {Number.isFinite(r) ? fmtFixed(r, 2) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span className="num">−1</span>
        <span className="bar" />
        <span className="num">+1</span>
        <span className="muted" style={{ marginLeft: 8 }}>赭紅＝負相關、墨藍＝正相關，顏色越深越強</span>
      </div>
    </figure>
  )
}
