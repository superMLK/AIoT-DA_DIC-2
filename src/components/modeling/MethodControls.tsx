import { SELECTION_METHODS } from '../../engine/pipeline.ts'
import type { ViewMethod } from '../../state/reducer.ts'
import { useStore } from '../../state/store.tsx'
import { METHOD_META } from '../common/methods.ts'

const OPTIONS: { id: ViewMethod; label: string }[] = [
  { id: 'all', label: '比較全部' },
  ...SELECTION_METHODS.map((m) => ({ id: m as ViewMethod, label: METHOD_META[m].label })),
  { id: 'ols', label: METHOD_META.ols.label },
]

export function MethodControls({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useStore()
  const bundle = state.compute.result?.bundle
  const p = bundle?.p ?? 0
  const { method, k } = state.view
  const exhaustive = bundle?.methods.exhaustive
  const kDisabled = method === 'ols' || !bundle

  return (
    <div className={compact ? 'row' : 'stack'} style={compact ? { alignItems: 'center' } : undefined}>
      <div className="field" role="group" aria-label="特徵選擇方法">
        {!compact && <span>方法</span>}
        <div className="segmented">
          {OPTIONS.map((o) => {
            const disabled = !bundle || (o.id === 'exhaustive' && exhaustive?.available === false)
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={method === o.id}
                disabled={disabled}
                title={o.id === 'exhaustive' && exhaustive?.reason ? exhaustive.reason : undefined}
                onClick={() => dispatch({ type: 'setMethod', method: o.id })}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="field" role="group" aria-label="特徵數 k" style={compact ? { order: -1 } : undefined}>
        {!compact && <span>特徵數 k（1 ~ {p || '…'}）</span>}
        {p <= 15 ? (
          <div className="segmented">
            {Array.from({ length: p }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                type="button"
                className="num"
                aria-pressed={!kDisabled && k === v}
                aria-label={`k = ${v}`}
                disabled={kDisabled}
                onClick={() => dispatch({ type: 'setK', k: v })}
              >
                {v}
              </button>
            ))}
          </div>
        ) : (
          <span className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input
              type="range"
              min={1}
              max={p}
              value={k}
              disabled={kDisabled}
              onChange={(e) => dispatch({ type: 'setK', k: Number(e.target.value) })}
              aria-label="特徵數 k"
            />
            <span className="num">k = {k}</span>
          </span>
        )}
      </div>

      {!compact && (
        <div className="stack" style={{ marginTop: 8 }}>
          {method === 'ols' && <p className="note">基準模型使用全部特徵，k 不適用。</p>}
          {method === 'enet' && <p className="note">ElasticNet 的 L1 比例固定為 0.5（L1 與 L2 懲罰各半）。</p>}
          {exhaustive?.available === false && <p className="note">Exhaustive Search 已停用：{exhaustive.reason}。</p>}
          {method !== 'all' && method !== 'ols' && <p className="note">{METHOD_META[method].blurb}</p>}
        </div>
      )}
    </div>
  )
}
