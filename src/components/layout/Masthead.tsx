import { useTheme, type ThemeMode } from '../../state/theme.tsx'

const LABEL: Record<ThemeMode, string> = { system: '跟隨系統', light: '淺色', dark: '深色' }
const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

export function Masthead() {
  const { mode, setMode } = useTheme()
  return (
    <header className="masthead">
      <div>
        <div className="kicker">Lab Notes · Multiple Linear Regression</div>
        <h1>特徵越多，模型就越好嗎？</h1>
        <p className="lede">
          以 CRISP-DM 六個階段，比較五種特徵選擇方法在不同特徵數 k 下的多元線性迴歸表現，觀察偏差與變異之間的取捨。所有計算都在你的瀏覽器裡完成。
        </p>
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => setMode(NEXT[mode])}
        aria-label={`配色：${LABEL[mode]}，按下切換為${LABEL[NEXT[mode]]}`}
        title="切換淺色／深色／跟隨系統"
      >
        <span aria-hidden="true">{mode === 'dark' ? '☾' : mode === 'light' ? '☀' : '◐'}</span>
        {LABEL[mode]}
      </button>
    </header>
  )
}
