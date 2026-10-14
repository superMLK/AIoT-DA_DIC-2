import { useMemo, useState } from 'react'
import { parseNumber } from '../../data/loader.ts'
import { computePrediction, predictorDefaults } from '../../engine/predictor.ts'
import { fmtFixed } from '../common/format.ts'
import { METHOD_META } from '../common/methods.ts'
import { useCurrent } from '../common/useCurrent.ts'
import { Chapter } from '../layout/Chapter.tsx'
import { PrepErrorNote } from './PrepErrorNote.tsx'

export function Deployment() {
  const { bundle, prep, model, method, updating, prepError } = useCurrent()
  const defaults = useMemo(
    () => (prep && bundle ? predictorDefaults(prep.data, prep.features, bundle.split.train) : null),
    [prep, bundle],
  )
  // 輸入值只在資料集或欄位設定改變時重設；切換方法、k 或切分時保留使用者輸入
  const signature = prep ? `${prep.report.target}|${prep.data.columns.join('|')}` : ''
  const [values, setValues] = useState<Record<string, string>>({})
  const [valuesKey, setValuesKey] = useState('')
  if (defaults && valuesKey !== signature) {
    setValuesKey(signature)
    setValues(defaults.values)
  }

  const fit = model?.fit?.status === 'ok' ? model.fit : null
  const result = useMemo(
    () => (fit && prep && Object.keys(values).length ? computePrediction(fit, prep.features, values) : null),
    [fit, prep, values],
  )

  return (
    <Chapter id="deployment" updating={updating}>
      {prepError && <PrepErrorNote message={prepError} />}
      {prep && defaults && method && (
        <div className="predictor">
          <p className="caption">
            預測 {prep.report.target}
            <span className="sub">
              使用目前模型：{METHOD_META[method].label}
              {method !== 'ols' && model && `，k = ${model.k}`}
            </span>
          </p>
          {!fit && <p className="note note-warn">目前的模型無法估計，請在上方換一個方法或 k。</p>}
          <div className="predictor-grid" role="group" aria-label="特徵輸入">
            {prep.features.map((f) => {
              const st = result?.features.find((s) => s.name === f.name)
              const used = st?.used ?? false
              const value = values[f.name] ?? ''
              const range = defaults.ranges[f.name]
              const num = parseNumber(value)
              const outOfRange =
                used && f.kind === 'numeric' && num !== null && Number.isFinite(num) && range && (num < range.min || num > range.max)
              const id = `pred-${f.name.replace(/\W+/g, '-')}`
              return (
                <div key={f.name} className="predictor-row" data-used={used}>
                  <label htmlFor={id} className="pname">
                    {f.name}
                  </label>
                  {f.kind === 'numeric' ? (
                    <input
                      id={id}
                      className="input num"
                      inputMode="decimal"
                      value={value}
                      disabled={!used}
                      aria-invalid={st?.invalid || undefined}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    />
                  ) : (
                    <select
                      id={id}
                      className="select"
                      value={value}
                      disabled={!used}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    >
                      {f.levels!.map((l) => (
                        <option key={l} value={l}>
                          {l}
                          {l === f.reference ? '（參考組）' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="contrib num">
                    {!used ? (
                      <span className="muted">此模型未使用</span>
                    ) : st?.invalid ? (
                      <span className="warn-text">請輸入數字</span>
                    ) : st?.contribution != null ? (
                      `${st.contribution >= 0 ? '+' : '−'}${fmtFixed(Math.abs(st.contribution), 2)}`
                    ) : null}
                  </span>
                  {(outOfRange || st?.equivalentLevels) && (
                    <span className="pnote">
                      {outOfRange && range && (
                        <>
                          ⓘ 超出訓練資料範圍（{fmtFixed(range.min, 2)} ~ {fmtFixed(range.max, 2)}），預測可靠度較低
                        </>
                      )}
                      {st?.equivalentLevels && <>ⓘ {st.equivalentLevels.join(' 與 ')} 在此模型中等價（預測值相同）</>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="predictor-total" aria-live="polite">
            {result?.ok ? (
              <>
                <div className="line">
                  <span>截距</span>
                  <span className="num">{fmtFixed(result.intercept, 2)}</span>
                </div>
                <div className="line total">
                  <span>預測 {prep.report.target}</span>
                  <span className="num">{fmtFixed(result.prediction.yhat, 2)}</span>
                </div>
                <div className="line muted">
                  <span>95% 預測區間</span>
                  <span className="num">
                    [{fmtFixed(result.prediction.piLower, 2)}, {fmtFixed(result.prediction.piUpper, 2)}]
                  </span>
                </div>
              </>
            ) : (
              <div className="line muted">
                <span>預測 {prep.report.target}</span>
                <span>等待有效輸入…</span>
              </div>
            )}
          </div>
          <p className="note">
            預測值＝截距＋各特徵貢獻（β × 輸入值）。被淘汰的特徵係數為 0，所以怎麼改都不會影響結果。預測區間考慮了模型本身的不確定性與個別資料的雜訊，比單看預測值更誠實。
          </p>
        </div>
      )}
    </Chapter>
  )
}
