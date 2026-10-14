import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { BUILTIN_DATASETS } from '../../data/builtins.ts'
import { useStore } from '../../state/store.tsx'

/** 頁首下方的資料來源列：對應 CRISP-DM 的「蒐集初始資料」，開啟頁面即可選擇資料集。 */
export function SourceBar() {
  const { state, loadBuiltin, loadUrl, loadFile } = useStore()
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const origin = state.dataset?.origin
  const builtinValue = origin?.kind === 'builtin' ? origin.id : ''
  const { load } = state

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (url.trim()) void loadUrl(url)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void loadFile(file)
  }

  return (
    <section className="source-bar" aria-labelledby="source-bar-title">
      <div className="inner stack">
        <div className="row">
          <h2 id="source-bar-title" className="source-title">資料來源</h2>
          <label className="field">
            <span>內建資料集</span>
            <select
              className="select"
              value={builtinValue}
              onChange={(e) => e.target.value && void loadBuiltin(e.target.value)}
            >
              {builtinValue === '' && <option value="">（外部資料）</option>}
              {BUILTIN_DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <form className="row" onSubmit={submit} style={{ flex: '1 1 320px', gap: 8 }}>
            <label className="field" style={{ flex: '1 1 240px' }}>
              <span>或輸入 CSV 網址</span>
              <input
                className="input"
                type="url"
                inputMode="url"
                placeholder="https://raw.githubusercontent.com/…/data.csv"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={load.status === 'loading' || !url.trim()}>
              {load.status === 'loading' ? '載入中…' : '載入'}
            </button>
          </form>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            上傳本機 CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void loadFile(f)
              e.target.value = ''
            }}
          />
        </div>
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          目前資料：{state.dataset?.label ?? '—'}
          {origin?.kind === 'url' && <span className="mono"> · {origin.url}</span>}
          。網址需允許跨網域讀取；上傳的檔案只在你的瀏覽器內讀取，不會傳到任何伺服器。
        </p>
        {load.rewriteNotice && <p className="note">{load.rewriteNotice}</p>}
        {load.status === 'error' && (
          <p className="note note-warn" role="alert">
            {load.message}
            {state.dataset && <> 目前仍顯示「{state.dataset.label}」的分析結果。</>}
          </p>
        )}
        {load.showUpload && (
          <div
            className="dropzone"
            data-dragging={dragging}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            把下載好的 CSV 拖曳到這裡，或點一下選擇檔案
          </div>
        )}
      </div>
    </section>
  )
}
