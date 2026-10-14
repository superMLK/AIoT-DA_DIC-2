import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMemo } from 'react'
import type { OlsOk, OlsResult } from '../../engine/ols.ts'
import type { PreparedOk } from '../../state/reducer.ts'
import { fmtFixed, fmtP, fmtSig } from '../common/format.ts'
import { METHOD_META } from '../common/methods.ts'
import { featureName, useCurrent } from '../common/useCurrent.ts'
import { Chapter } from '../layout/Chapter.tsx'
import { MODELING_CONTROLS_ID } from '../layout/StickyControls.tsx'
import { MethodControls } from '../modeling/MethodControls.tsx'
import { PrepErrorNote } from './PrepErrorNote.tsx'

export function Modeling() {
  const { model, prep, method, updating, prepError } = useCurrent()
  return (
    <Chapter id="modeling" updating={updating}>
      <div className="stack">
        <div id={MODELING_CONTROLS_ID}>
          <MethodControls />
        </div>
        {prepError && <PrepErrorNote message={prepError} />}
        {model && prep && method && (
          <>
            <p className="caption">
              目前模型：{METHOD_META[method].label}
              {method !== 'ols' && <>，k = {model.k}</>}
              <span className="sub">
                入選特徵：{model.features ? model.features.map((c) => prep.data.columns[c]).join('、') : '—'}
              </span>
            </p>
            {model.fit ? (
              model.fit.status === 'ok' ? (
                <>
                  <Equation fit={model.fit} prep={prep} />
                  <CoefTable fit={model.fit} prep={prep} />
                </>
              ) : (
                <SingularNote fit={model.fit} columns={prep.data.columns} />
              )
            ) : (
              <p className="note note-warn">這個訓練集可用的特徵少於 k 個，無法估計。</p>
            )}
          </>
        )}
      </div>
    </Chapter>
  )
}

export function SingularNote({ fit, columns }: { fit: Extract<OlsResult, { status: 'singular' }>; columns: string[] }) {
  if (fit.reason === 'df') {
    return (
      <p className="note note-warn">
        無法估計：訓練筆數 n = {fit.n}、特徵數 k = {fit.k}，殘差自由度 n − k − 1 ≤ 0。
      </p>
    )
  }
  const c = fit.collinear!
  return (
    <p className="note note-warn">
      無法估計：「{featureName(columns, c.col)}」可由「{c.with.map((w) => featureName(columns, w)).join('、')}」完全線性組合而成（完全共線）。
    </p>
  )
}

function texText(s: string): string {
  return s.replace(/[\\{}$&#^_%~]/g, (ch) =>
    ch === '\\' ? '\\textbackslash{}' : ch === '~' ? '\\textasciitilde{}' : ch === '^' ? '\\textasciicircum{}' : `\\${ch}`,
  )
}

function texNum(v: number): string {
  return fmtSig(Math.abs(v), 4).replace(/,/g, '{,}')
}

function Equation({ fit, prep }: { fit: OlsOk; prep: PreparedOk }) {
  const html = useMemo(() => {
    let tex = `\\widehat{\\text{${texText(prep.report.target)}}} = ${fit.beta[0] < 0 ? '-' : ''}${texNum(fit.beta[0])}`
    fit.cols.forEach((c, j) => {
      const b = fit.beta[j + 1]
      tex += ` ${b < 0 ? '-' : '+'} ${texNum(b)}\\,\\text{${texText(prep.data.columns[c])}}`
    })
    return katex.renderToString(tex, { throwOnError: false, output: 'htmlAndMathml' })
  }, [fit, prep])

  const refs = prep.features.filter((f) => f.kind === 'categorical' && f.dummies!.some((d) => fit.cols.includes(d.col)))

  return (
    <figure className="figure equation">
      <figcaption>迴歸方程式<span className="sub">係數取 4 位有效數字，原始尺度</span></figcaption>
      <div className="equation-body" dangerouslySetInnerHTML={{ __html: html }} />
      {refs.map((f) => (
        <p key={f.name} className="note">
          {f.name} 的參考組為 {f.reference}；dummy 係數是相對於 {f.reference} 的差異。
        </p>
      ))}
    </figure>
  )
}

function vifTag(v: number) {
  if (!Number.isFinite(v)) return <span className="tag tag-warn" title="與其他特徵完全共線">∞</span>
  if (v >= 10)
    return (
      <span className="tag tag-warn" title="VIF ≥ 10：與其他入選特徵高度共線，係數的標準誤被放大、正負號可能不穩定">
        {fmtFixed(v, 2)}
      </span>
    )
  if (v >= 5)
    return (
      <span className="tag tag-caution" title="5 ≤ VIF < 10：中度共線，值得留意">
        {fmtFixed(v, 2)}
      </span>
    )
  return <span className="num">{fmtFixed(v, 2)}</span>
}

function CoefTable({ fit, prep }: { fit: OlsOk; prep: PreparedOk }) {
  const rows = [-1, ...fit.cols]
  const anyHighVif = fit.vif?.some((v) => v >= 10)
  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="three-line">
          <caption>
            表 3｜係數估計（訓練集 n = {fit.n}，殘差自由度 {fit.df}）
          </caption>
          <thead>
            <tr>
              <th>變數</th>
              <th className="r">β</th>
              <th className="r">標準誤</th>
              <th className="r">t</th>
              <th className="r">p 值</th>
              <th className="r">95% 信賴區間</th>
              <th className="r">VIF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const sig = fit.p[i] < 0.05
              return (
                <tr key={c} className={sig ? 'is-sig' : undefined}>
                  <td>
                    {featureName(prep.data.columns, c)}
                    {sig && (
                      <span className="sig-mark" title="p < 0.05" aria-label="顯著（p < 0.05）">
                        {' '}
                        *
                      </span>
                    )}
                  </td>
                  <td className="r num">{fmtSig(fit.beta[i], 5)}</td>
                  <td className="r num">{fmtSig(fit.se[i], 4)}</td>
                  <td className="r num">{fmtFixed(fit.t[i], 3)}</td>
                  <td className="r num">{fmtP(fit.p[i])}</td>
                  <td className="r num">
                    [{fmtSig(fit.ciLower[i], 4)}, {fmtSig(fit.ciUpper[i], 4)}]
                  </td>
                  <td className="r">{c < 0 || !fit.vif ? <span className="muted">—</span> : vifTag(fit.vif[i - 1])}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="note">
        * 表示 p &lt; 0.05：在「其他入選特徵不變」的前提下，這個特徵的係數顯著不為 0。95% 信賴區間若跨過 0，等同不顯著。
        {fit.k === 1 && ' 模型只有一個特徵時，VIF 不適用。'}
      </p>
      {anyHighVif && (
        <p className="note note-warn">
          有特徵的 VIF ≥ 10，代表它幾乎能由其他特徵線性組合出來。這時個別係數的標準誤會被放大，正負號也可能不穩定；但整體預測未必變差。
        </p>
      )}
    </div>
  )
}
