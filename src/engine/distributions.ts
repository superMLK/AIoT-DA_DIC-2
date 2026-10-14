// t 與 F 分布：以正規化不完全 beta 函數為核心（Lentz 連分數 + Lanczos log-gamma）。

const LANCZOS_G = 7
const LANCZOS_COEF = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
]

export function logGamma(x: number): number {
  if (x < 0.5) {
    // 反射公式
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x)
  }
  const z = x - 1
  let a = LANCZOS_COEF[0]
  const t = z + LANCZOS_G + 0.5
  for (let i = 1; i < LANCZOS_COEF.length; i++) a += LANCZOS_COEF[i] / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

const CF_EPS = 1e-16
const CF_TINY = 1e-300
const CF_MAX_ITER = 10000

function betaContinuedFraction(a: number, b: number, x: number): number {
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < CF_TINY) d = CF_TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= CF_MAX_ITER; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < CF_TINY) d = CF_TINY
    c = 1 + aa / c
    if (Math.abs(c) < CF_TINY) c = CF_TINY
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < CF_TINY) d = CF_TINY
    c = 1 + aa / c
    if (Math.abs(c) < CF_TINY) c = CF_TINY
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < CF_EPS) return h
  }
  return h
}

/** 正規化不完全 beta 函數 I_x(a, b)。 */
export function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lnFront =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x)
  const front = Math.exp(lnFront)
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b
}

/** t 分布雙尾 p 值 P(|T| > |t|)。尾端直接計算，不經由 1 − cdf，以保留極小 p 值的精度。 */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0
  return regIncBeta(df / (df + t * t), df / 2, 0.5)
}

export function tCdf(t: number, df: number): number {
  const tail = 0.5 * tTwoSidedP(t, df)
  return t > 0 ? 1 - tail : tail
}

/** F 分布右尾機率 P(F > f)。 */
export function fSf(f: number, d1: number, d2: number): number {
  if (f <= 0) return 1
  if (!Number.isFinite(f)) return 0
  return regIncBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2)
}

/** t 分布分位數（反函數），Newton 法搭配二分法保護。 */
export function tInv(p: number, df: number): number {
  if (p <= 0 || p >= 1) throw new RangeError(`tInv: p 必須介於 0 與 1 之間，收到 ${p}`)
  if (p === 0.5) return 0
  if (p < 0.5) return -tInv(1 - p, df)
  let lo = 0
  let hi = 1
  while (tCdf(hi, df) < p) {
    lo = hi
    hi *= 2
  }
  let x = (lo + hi) / 2
  for (let i = 0; i < 200; i++) {
    const f = tCdf(x, df) - p
    if (f > 0) hi = x
    else lo = x
    const pdf = Math.exp(
      logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI) -
        ((df + 1) / 2) * Math.log1p((x * x) / df),
    )
    let next = x - f / pdf
    if (!(next > lo && next < hi)) next = (lo + hi) / 2
    if (Math.abs(next - x) <= 1e-14 * Math.max(1, Math.abs(x))) return next
    x = next
  }
  return x
}
