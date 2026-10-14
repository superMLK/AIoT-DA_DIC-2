import Papa from 'papaparse'
import type { ColumnInfo, RawTable } from './types.ts'

export const MAX_FILE_BYTES = 10 * 1024 * 1024

const MISSING = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '?', '-'])
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/
const THOUSANDS_NUMBER = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/

export function isMissing(raw: string): boolean {
  return MISSING.has(raw.trim().toLowerCase())
}

/** 解析數值，支援千分位逗號；非數值回傳 null，缺值回傳 NaN。 */
export function parseNumber(raw: string): number | null {
  const s = raw.trim()
  if (isMissing(s)) return NaN
  if (PLAIN_NUMBER.test(s)) return Number(s)
  if (THOUSANDS_NUMBER.test(s)) return Number(s.replaceAll(',', ''))
  return null
}

export class DataLoadError extends Error {
  readonly kind: 'empty' | 'too-large' | 'cors' | 'http' | 'not-csv' | 'parse'
  constructor(kind: DataLoadError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

/** 解析 CSV 文字：自動偵測分隔符號，第一列為欄名。 */
export function parseCsv(text: string): RawTable {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    header: false,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', ';', '\t', '|'],
  })
  const all = result.data
  if (all.length < 2) throw new DataLoadError('empty', '檔案沒有資料列，至少需要欄名列與一列資料。')
  const width = all[0].length
  if (width < 2) throw new DataLoadError('parse', '只偵測到一個欄位，請確認檔案是以逗號、分號或 Tab 分隔的 CSV。')

  const seen = new Map<string, number>()
  const headers = all[0].map((h, j) => {
    const base = h.trim() || `欄位${j + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}_${count + 1}`
  })
  const rows = all.slice(1).map((r) => {
    const row = r.slice(0, width)
    while (row.length < width) row.push('')
    return row
  })
  return { headers, rows }
}

/** 判斷每個欄位是數值或類別，並統計缺值與類別級數。 */
export function describeColumns(table: RawTable): ColumnInfo[] {
  return table.headers.map((name, j) => {
    let missing = 0
    let numeric = true
    const levels = new Set<string>()
    for (const row of table.rows) {
      const raw = row[j]
      if (isMissing(raw)) {
        missing++
        continue
      }
      levels.add(raw.trim())
      if (numeric && parseNumber(raw) === null) numeric = false
    }
    if (missing === table.rows.length) numeric = false
    return {
      name,
      kind: numeric ? 'numeric' : 'categorical',
      missing,
      levels: numeric ? [] : [...levels].sort(compareLevels),
    }
  })
}

/** 字母序（依 Unicode 碼位，與 pandas 排序一致）。 */
export function compareLevels(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export async function readFileAsTable(file: File): Promise<RawTable> {
  if (file.size > MAX_FILE_BYTES) throw new DataLoadError('too-large', '檔案超過 10 MB 上限。')
  return parseCsv(await file.text())
}

/** 以 fetch 讀取網址上的 CSV；失敗時拋出帶有白話說明的 DataLoadError。 */
export async function fetchTable(url: string, fetchImpl: typeof fetch = fetch): Promise<RawTable> {
  let res: Response
  try {
    res = await fetchImpl(url, { mode: 'cors' })
  } catch {
    throw new DataLoadError(
      'cors',
      '對方伺服器不允許網頁直接讀取（CORS），或網路連線失敗。請下載檔案後拖曳到下方上傳。',
    )
  }
  if (!res.ok) throw new DataLoadError('http', `伺服器回應 ${res.status}，無法取得檔案。請確認網址是否正確、是否公開。`)
  const length = Number(res.headers.get('content-length'))
  if (length > MAX_FILE_BYTES) throw new DataLoadError('too-large', '檔案超過 10 MB 上限。')
  const type = res.headers.get('content-type') ?? ''
  const blob = await res.blob()
  if (blob.size > MAX_FILE_BYTES) throw new DataLoadError('too-large', '檔案超過 10 MB 上限。')
  const text = await blob.text()
  if (type.includes('text/html') || /^\s*<(!doctype|html)/i.test(text)) {
    throw new DataLoadError('not-csv', '這個網址回傳的是網頁而不是 CSV 檔。請改用檔案的原始（raw）下載網址。')
  }
  return parseCsv(text)
}
