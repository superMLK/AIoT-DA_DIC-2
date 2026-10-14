import { useState } from 'react'
import { isHighCardinality } from '../../data/clean.ts'
import type { ColumnConfig } from '../../data/types.ts'
import { TEST_RATIOS, testSize } from '../../engine/split.ts'
import type { DatasetState } from '../../state/reducer.ts'
import { useStore } from '../../state/store.tsx'
import { Chapter } from '../layout/Chapter.tsx'

export function DataPreparation() {
  return (
    <Chapter id="data-preparation">
      <div className="stack">
        <CurrentSource />
        <ColumnPanel />
        <CleaningReportView />
        <EncodingNote />
        <SplitSettings />
      </div>
    </Chapter>
  )
}

function CurrentSource() {
  const { state } = useStore()
  if (!state.dataset) return null
  return (
    <p className="muted" style={{ margin: 0 }}>
      目前資料：<strong>{state.dataset.label}</strong>（可在頁面最上方的「資料來源」切換）。以下設定只影響這份資料如何進入模型。
    </p>
  )
}

function ColumnPanel() {
  const { state } = useStore()
  const ds = state.dataset
  if (!ds) return null
  // 資料集或已套用的設定改變時，以 key 重新掛載來重設草稿
  return <ColumnPanelForm key={`${ds.label}|${JSON.stringify(ds.config)}`} ds={ds} />
}

function ColumnPanelForm({ ds }: { ds: DatasetState }) {
  const { state, applyConfig } = useStore()
  const [draft, setDraft] = useState<ColumnConfig>(ds.config)

  const numeric = ds.columns.filter((c) => c.kind === 'numeric')
  const dirty = JSON.stringify(draft) !== JSON.stringify(ds.config)
  const toggle = (name: string) =>
    setDraft({
      ...draft,
      features: draft.features.includes(name) ? draft.features.filter((f) => f !== name) : [...draft.features, name],
    })

  return (
    <div className="stack">
      <h3 className="h3">欄位角色</h3>
      <label className="field">
        <span>目標 y（只能選數值欄）</span>
        <select
          className="select"
          value={draft.target}
          onChange={(e) => setDraft({ target: e.target.value, features: draft.features.filter((f) => f !== e.target.value) })}
        >
          {numeric.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="column-list">
        <legend>特徵</legend>
        {ds.columns
          .filter((c) => c.name !== draft.target)
          .map((c) => {
            const note = ds.notes[c.name] ?? (isHighCardinality(c) ? { reason: '類別超過 10 級，預設排除' } : undefined)
            return (
              <label key={c.name} className="column-item">
                <input type="checkbox" checked={draft.features.includes(c.name)} onChange={() => toggle(c.name)} />
                <span className="name">{c.name}</span>
                <span className="kind muted">
                  {c.kind === 'numeric' ? '數值' : `類別（${c.levels.length} 級）`}
                  {c.missing > 0 && ` · 缺值 ${c.missing}`}
                </span>
                {note && <span className="reason">ⓘ {note.reason}</span>}
              </label>
            )
          })}
      </fieldset>
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => applyConfig(draft)}>
          套用並重新計算
        </button>
        {dirty && <span className="muted">設定已修改，尚未套用</span>}
      </div>
      {state.prep && !state.prep.ok && (
        <p className="note note-warn" role="alert">
          {state.prep.error}
        </p>
      )}
    </div>
  )
}

function CleaningReportView() {
  const { state } = useStore()
  const report = state.prep?.report
  if (!report) return null
  const reasons = { constant: '清理後為常數欄，已排除', 'high-cardinality': '類別超過 10 級，預設排除' }
  return (
    <div className="stack">
      <h3 className="h3">資料清理報告</h3>
      <ul className="report">
        <li>
          原始 <span className="num">{report.originalRows}</span> 列 → 可用 <span className="num">{report.usableRows}</span> 列
          {report.originalRows === report.usableRows && '（沒有缺值）'}
        </li>
        {report.missingByColumn.map((m) => (
          <li key={m.column}>
            {m.column}：缺值 <span className="num">{m.count}</span> 筆 → 整列刪除
          </li>
        ))}
        {report.excluded.map((e) => (
          <li key={e.column}>
            {e.column}：{reasons[e.reason]}
          </li>
        ))}
        <li>
          目標 y = {report.target}（數值 ✓）；展開 dummy 後特徵數 p = <span className="num">{report.p}</span>
        </li>
      </ul>
    </div>
  )
}

function EncodingNote() {
  const { state } = useStore()
  const prep = state.prep
  if (!prep?.ok) return null
  const cats = prep.features.filter((f) => f.kind === 'categorical')
  return (
    <div className="stack">
      <h3 className="h3">類別編碼</h3>
      {cats.length === 0 ? (
        <p className="muted">目前沒有類別特徵，不需要編碼。</p>
      ) : (
        <>
          <p>
            類別變數以 one-hot 編碼，並丟掉字母序第一個類別當<strong>參考組</strong>，以免與截距完全共線（dummy variable trap）。每個 dummy 都是一個獨立特徵，計入 k。
          </p>
          <ul className="report">
            {cats.map((f) => (
              <li key={f.name}>
                {f.name}：參考組 <strong>{f.reference}</strong>；dummy ={' '}
                {f.dummies!.map((d, i) => (
                  <span key={d.col}>
                    {i > 0 && '、'}
                    <code>{prep.data.columns[d.col]}</code>
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="note">
            dummy 的係數代表「其他條件相同時，該類別相對於參考組平均多（或少）多少 y」。
          </p>
        </>
      )}
    </div>
  )
}

function SplitSettings() {
  const { state } = useStore()
  return <SplitSettingsForm key={state.splitCfg.seed} />
}

function SplitSettingsForm() {
  const { state, dispatch } = useStore()
  const { testRatio, seed } = state.splitCfg
  const [seedText, setSeedText] = useState(String(seed))
  const n = state.prep?.ok ? state.prep.data.n : null
  const nTest = n ? testSize(n, testRatio) : null

  const commitSeed = () => {
    const v = Number(seedText)
    if (Number.isInteger(v) && v >= 0) dispatch({ type: 'splitChanged', seed: v })
    else setSeedText(String(seed))
  }

  return (
    <div className="stack">
      <h3 className="h3">資料切分</h3>
      <div className="row">
        <div className="field" role="group" aria-label="訓練／測試比例">
          <span>訓練／測試比例</span>
          <div className="segmented">
            {[...TEST_RATIOS].reverse().map((r) => (
              <button
                key={r}
                type="button"
                className="num"
                aria-pressed={testRatio === r}
                onClick={() => dispatch({ type: 'splitChanged', testRatio: r })}
              >
                {Math.round((1 - r) * 100)}/{Math.round(r * 100)}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>隨機種子 seed</span>
          <input
            className="input num"
            style={{ width: 110 }}
            inputMode="numeric"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commitSeed}
            onKeyDown={(e) => e.key === 'Enter' && commitSeed()}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => dispatch({ type: 'splitChanged', seed: Math.floor(Math.random() * 100000) })}
        >
          隨機 seed
        </button>
      </div>
      {n && nTest && (
        <p>
          訓練集 <span className="num">{n - nTest}</span> 筆、測試集 <span className="num">{nTest}</span> 筆；另在訓練集內做 5 折交叉驗證（每折約{' '}
          <span className="num">{Math.round((n - nTest) / 5)}</span> 筆驗證）。
        </p>
      )}
      <p className="note">
        特徵選擇只用訓練集；5 折交叉驗證的每一折也都重新挑選特徵，避免資料洩漏。本頁使用自己的亂數產生器，切分結果與 scikit-learn
        相同 seed 的 <code>train_test_split</code> 不同。
      </p>
      {nTest !== null && nTest < 20 && (
        <p className="note note-warn">
          測試集只有 {nTest} 筆，Test RMSE 會很不穩定。試著換幾個 seed，觀察「最佳 k」會不會跟著改變，再對照較穩定的 CV RMSE。
        </p>
      )}
    </div>
  )
}
