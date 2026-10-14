const fixedCache = new Map<number, Intl.NumberFormat>()

/** 固定小數位數並加千分位，例如 9055.237 → 9,055.24。 */
export function fmtFixed(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return v === Infinity ? '∞' : '—'
  let f = fixedCache.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    fixedCache.set(digits, f)
  }
  return f.format(v)
}

const sigCache = new Map<number, Intl.NumberFormat>()

/** 有效位數並加千分位，例如 46890.12 → 46,890；0.801234 → 0.8012。 */
export function fmtSig(v: number | null | undefined, sig = 4): string {
  if (v == null || !Number.isFinite(v)) return '—'
  let f = sigCache.get(sig)
  if (!f) {
    f = new Intl.NumberFormat('en-US', { maximumSignificantDigits: sig })
    sigCache.set(sig, f)
  }
  return f.format(v)
}

/** p 值：小於 .001 顯示 <.001，否則三位小數、省略前導 0（APA 格式）。 */
export function fmtP(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return '—'
  if (p < 0.001) return '<.001'
  return p.toFixed(3).replace(/^0/, '')
}

export function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`
}
