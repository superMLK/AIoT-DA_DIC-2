import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILTIN_DATASETS } from '../src/data/builtins.ts'
import { defaultRoles, prepare } from '../src/data/clean.ts'
import { DataLoadError, describeColumns, fetchTable, parseCsv, parseNumber } from '../src/data/loader.ts'
import { rewriteCsvUrl } from '../src/data/urlRewrite.ts'
import { foldFitRows, makeSplit } from '../src/engine/split.ts'

function readDataset(file: string): string {
  return readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')
}

describe('CSV 解析', () => {
  it('逗號、分號、Tab 分隔皆可偵測', () => {
    for (const sep of [',', ';', '\t']) {
      const t = parseCsv(['a', 'b', 'c'].join(sep) + '\n' + ['1', '2', 'x'].join(sep) + '\n')
      expect(t.headers).toEqual(['a', 'b', 'c'])
      expect(t.rows).toEqual([['1', '2', 'x']])
    }
  })

  it('引號內的千分位視為數值', () => {
    const t = parseCsv('amount,city\n"1,234.5",Taipei\n"12,000",Tainan\n')
    expect(t.rows[0][0]).toBe('1,234.5')
    expect(parseNumber(t.rows[0][0])).toBe(1234.5)
    const cols = describeColumns(t)
    expect(cols[0].kind).toBe('numeric')
    expect(cols[1]).toMatchObject({ kind: 'categorical', levels: ['Tainan', 'Taipei'] })
  })

  it('文字欄判定為類別；缺值不影響數值判定', () => {
    const t = parseCsv('x,label\n1,a\n,b\n3,?\n')
    const cols = describeColumns(t)
    expect(cols[0]).toMatchObject({ kind: 'numeric', missing: 1 })
    expect(cols[1]).toMatchObject({ kind: 'categorical', missing: 1, levels: ['a', 'b'] })
  })

  it('重複欄名自動加上編號；空檔報錯', () => {
    expect(parseCsv('a,a\n1,2\n').headers).toEqual(['a', 'a_2'])
    expect(() => parseCsv('a,b\n')).toThrow(DataLoadError)
  })
})

describe('網址改寫', () => {
  it('GitHub blob 改為 raw', () => {
    expect(rewriteCsvUrl('https://github.com/u/r/blob/main/data.csv')).toEqual({
      url: 'https://raw.githubusercontent.com/u/r/main/data.csv',
      rewritten: true,
      kind: 'github',
    })
  })

  it('Google Sheets 分享網址改為 CSV 匯出', () => {
    expect(rewriteCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=42')).toMatchObject({
      url: 'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=42',
      rewritten: true,
    })
    expect(rewriteCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit?usp=sharing').url).toBe(
      'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv',
    )
  })

  it('不需改寫的網址原樣返回', () => {
    const url = 'https://raw.githubusercontent.com/u/r/main/data.csv'
    expect(rewriteCsvUrl(url)).toEqual({ url, rewritten: false })
    expect(rewriteCsvUrl('not a url').rewritten).toBe(false)
  })
})

describe('網址讀取錯誤', () => {
  it('fetch 失敗（CORS）時給出白話說明', async () => {
    const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
    await expect(fetchTable('https://x.test/a.csv', failing)).rejects.toMatchObject({ kind: 'cors' })
  })

  it('回傳 HTML 頁面時提示改用 raw 網址', async () => {
    const html = (() =>
      Promise.resolve(new Response('<!doctype html><html></html>', { headers: { 'content-type': 'text/html' } }))) as unknown as typeof fetch
    await expect(fetchTable('https://x.test/a.csv', html)).rejects.toMatchObject({ kind: 'not-csv' })
  })

  it('超過 10 MB 拒絕', async () => {
    const big = (() =>
      Promise.resolve(new Response('a,b\n1,2\n', { headers: { 'content-length': String(12 * 1024 * 1024) } }))) as unknown as typeof fetch
    await expect(fetchTable('https://x.test/a.csv', big)).rejects.toMatchObject({ kind: 'too-large' })
  })
})

describe('欄位角色與清理', () => {
  it('預設角色：最後一個數值欄為 y，類別欄標示級數', () => {
    const t = parseCsv('id,area,rooms,city,price\n1,30,2,A,100\n2,40,3,B,120\n')
    const roles = defaultRoles(describeColumns(t))!
    expect(roles.config).toEqual({ target: 'price', features: ['id', 'area', 'rooms', 'city'] })
  })

  it('缺值整列刪除並記錄在報告中', () => {
    const lines = ['x1,x2,y']
    for (let i = 0; i < 20; i++) lines.push(`${i},${i % 3 === 0 && i < 18 ? '' : i * 2 + (i % 4)},${i * 3 + (i % 5)}`)
    const t = parseCsv(lines.join('\n'))
    const cols = describeColumns(t)
    const res = prepare(t, cols, { target: 'y', features: ['x1', 'x2'] })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.originalRows).toBe(20)
    expect(res.report.usableRows).toBe(14)
    expect(res.report.missingByColumn).toEqual([{ column: 'x2', count: 6 }])
  })

  it('高基數類別欄預設排除；常數欄自動排除', () => {
    const lines = ['name,flag,x,y']
    for (let i = 0; i < 15; i++) lines.push(`car${i},1,${i},${i * 2 + (i % 3)}`)
    const t = parseCsv(lines.join('\n'))
    const cols = describeColumns(t)
    const roles = defaultRoles(cols)!
    expect(roles.config.features).toEqual(['flag', 'x'])
    expect(roles.notes.name.reason).toContain('超過 10 級')
    const res = prepare(t, cols, roles.config)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.excluded).toEqual([
      { column: 'name', reason: 'high-cardinality' },
      { column: 'flag', reason: 'constant' },
    ])
    expect(res.data.columns).toEqual(['x'])
  })

  it('特徵過多時停止並提示', () => {
    const header = [...Array.from({ length: 34 }, (_, j) => `f${j}`), 'y'].join(',')
    const rows = Array.from({ length: 40 }, (_, i) => Array.from({ length: 35 }, (_, j) => (i * (j + 1)) % 97 + j).join(','))
    const t = parseCsv([header, ...rows].join('\n'))
    const cols = describeColumns(t)
    const res = prepare(t, cols, defaultRoles(cols)!.config)
    expect(res).toMatchObject({ ok: false, error: '特徵數 34 超過上限 30，請取消部分欄位。' })
  })

  it('目標必須是數值欄', () => {
    const t = parseCsv('x,label\n1,a\n2,b\n')
    expect(prepare(t, describeColumns(t), { target: 'label', features: ['x'] })).toMatchObject({ ok: false })
  })
})

describe('內建資料集', () => {
  const startups = BUILTIN_DATASETS.find((d) => d.id === '50-startups')!
  const boston = BUILTIN_DATASETS.find((d) => d.id === 'boston-housing')!

  it('50 Startups：p = 5，State 編碼為兩個 dummy、參考組 California', () => {
    const t = parseCsv(readDataset(startups.file))
    const res = prepare(t, describeColumns(t), startups.config)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.n).toBe(50)
    expect(res.data.columns).toEqual([
      'R&D Spend',
      'Administration',
      'Marketing Spend',
      'State_Florida',
      'State_New York',
    ])
    const state = res.features.find((f) => f.name === 'State')!
    expect(state.reference).toBe('California')
    // 第一列是 New York
    expect(Array.from(res.data.X.slice(3, 5))).toEqual([0, 1])
  })

  it('Boston：B 欄預設排除並附說明，p = 12；勾回後 p = 13', () => {
    const t = parseCsv(readDataset(boston.file))
    const cols = describeColumns(t)
    const res = prepare(t, cols, boston.config)
    expect(res.ok && res.data.p).toBe(12)
    expect(boston.notes.B.reason).toContain('倫理')
    const withB = prepare(t, cols, { ...boston.config, features: [...boston.config.features, 'B'] })
    expect(withB.ok && withB.data.p).toBe(13)
  })
})

describe('切分', () => {
  it('同一個 seed 產生相同切分，50 筆 80/20 為 40/10', () => {
    const a = makeSplit(50, 0.2, 42)
    const b = makeSplit(50, 0.2, 42)
    expect(a).toEqual(b)
    expect(a.train.length).toBe(40)
    expect(a.test.length).toBe(10)
    expect(makeSplit(50, 0.2, 7)).not.toEqual(a)
  })

  it('各折大小相差不超過 1，彼此不重疊，聯集為訓練集，且不含測試列', () => {
    for (const [n, r] of [[50, 0.2], [506, 0.25], [23, 0.1]] as const) {
      const s = makeSplit(n, r, 3)
      const sizes = s.folds.map((f) => f.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
      const all = s.folds.flat().sort((x, y) => x - y)
      expect(all).toEqual(s.train)
      const test = new Set(s.test)
      expect(all.some((i) => test.has(i))).toBe(false)
      expect(foldFitRows(s.train, s.folds[0]).length).toBe(s.train.length - s.folds[0].length)
    }
  })

  it('各種比例的測試集大小', () => {
    expect(makeSplit(50, 0.3, 1).test.length).toBe(15)
    expect(makeSplit(50, 0.25, 1).test.length).toBe(13)
    expect(makeSplit(50, 0.1, 1).test.length).toBe(5)
  })
})
