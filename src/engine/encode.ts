import { compareLevels, parseNumber } from '../data/loader.ts'
import type { ColumnInfo, FeatureMeta, RawTable } from '../data/types.ts'
import type { NumericData } from './types.ts'

export interface Encoded {
  data: NumericData
  features: FeatureMeta[]
}

/**
 * 把清理後的列編碼成數值矩陣。類別特徵做 one-hot，丟掉字母序第一個類別當參考組，
 * dummy 依原始欄位順序就地展開，命名為 `<欄名>_<類別>`。類別清單由傳入的列決定。
 */
export function encode(
  table: RawTable,
  columns: ColumnInfo[],
  rowIdx: number[],
  target: string,
  featureNames: string[],
): Encoded {
  const index = new Map(table.headers.map((h, j) => [h, j]))
  const kinds = new Map(columns.map((c) => [c.name, c.kind]))
  const features: FeatureMeta[] = []
  const names: string[] = []
  const extractors: ((row: string[]) => number)[] = []

  for (const name of table.headers) {
    if (!featureNames.includes(name) || name === target) continue
    const j = index.get(name)!
    if (kinds.get(name) === 'numeric') {
      features.push({ name, kind: 'numeric', col: names.length })
      names.push(name)
      extractors.push((row) => parseNumber(row[j]) as number)
    } else {
      const levels = [...new Set(rowIdx.map((i) => table.rows[i][j].trim()))].sort(compareLevels)
      const dummies = levels.slice(1).map((level) => {
        const col = names.length
        names.push(`${name}_${level}`)
        extractors.push((row) => (row[j].trim() === level ? 1 : 0))
        return { level, col }
      })
      features.push({ name, kind: 'categorical', levels, reference: levels[0], dummies })
    }
  }

  const n = rowIdx.length
  const p = names.length
  const X = new Float64Array(n * p)
  const y = new Float64Array(n)
  const tj = index.get(target)!
  rowIdx.forEach((ri, i) => {
    const row = table.rows[ri]
    for (let c = 0; c < p; c++) X[i * p + c] = extractors[c](row)
    y[i] = parseNumber(row[tj]) as number
  })
  return { data: { n, p, X, y, columns: names }, features }
}
