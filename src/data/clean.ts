import { encode } from '../engine/encode.ts'
import type { NumericData } from '../engine/types.ts'
import { isMissing, parseNumber } from './loader.ts'
import type {
  CleaningReport,
  ColumnConfig,
  ColumnInfo,
  ColumnNote,
  ExcludedColumn,
  FeatureMeta,
  RawTable,
} from './types.ts'

export const MAX_FEATURES = 30
export const MAX_CATEGORY_LEVELS = 10
export const MIN_USABLE_ROWS = 10

export interface DefaultRoles {
  config: ColumnConfig
  notes: Record<string, ColumnNote>
}

/** 自動偵測：最後一個數值欄為 y，其餘為特徵；類別超過 10 級的欄位預設不勾選。 */
export function defaultRoles(columns: ColumnInfo[]): DefaultRoles | null {
  const numeric = columns.filter((c) => c.kind === 'numeric')
  if (numeric.length === 0) return null
  const target = numeric[numeric.length - 1].name
  const notes: Record<string, ColumnNote> = {}
  const features: string[] = []
  for (const c of columns) {
    if (c.name === target) continue
    if (isHighCardinality(c)) notes[c.name] = { reason: `類別超過 ${MAX_CATEGORY_LEVELS} 級，預設排除` }
    else features.push(c.name)
  }
  return { config: { target, features }, notes }
}

export function isHighCardinality(c: ColumnInfo): boolean {
  return c.kind === 'categorical' && c.levels.length > MAX_CATEGORY_LEVELS
}

export type PrepareResult =
  | {
      ok: true
      data: NumericData
      features: FeatureMeta[]
      report: CleaningReport
      /** data 第 i 列對應的原始列號（0 起算，不含欄名列）。 */
      sourceRows: number[]
    }
  | { ok: false; error: string; report?: CleaningReport }

/** 依欄位設定清理並編碼資料。 */
export function prepare(table: RawTable, columns: ColumnInfo[], config: ColumnConfig): PrepareResult {
  const info = new Map(columns.map((c) => [c.name, c]))
  const index = new Map(table.headers.map((h, j) => [h, j]))
  const targetInfo = info.get(config.target)
  if (!targetInfo || targetInfo.kind !== 'numeric') return { ok: false, error: '目標 y 必須是數值欄。' }

  const selected = table.headers.filter((h) => h !== config.target && config.features.includes(h))
  const checked = [config.target, ...selected]

  // 1. 缺值整列刪除
  const missingCount = new Map<string, number>()
  const kept: number[] = []
  table.rows.forEach((row, i) => {
    let drop = false
    for (const name of checked) {
      const raw = row[index.get(name)!]
      const bad =
        isMissing(raw) || (info.get(name)!.kind === 'numeric' && !Number.isFinite(parseNumber(raw)))
      if (bad) {
        drop = true
        missingCount.set(name, (missingCount.get(name) ?? 0) + 1)
      }
    }
    if (!drop) kept.push(i)
  })

  // 2. 常數欄排除；未勾選的高基數類別欄記錄在報告中
  const excluded: ExcludedColumn[] = []
  for (const c of columns) {
    if (c.name !== config.target && !selected.includes(c.name) && isHighCardinality(c)) {
      excluded.push({ column: c.name, reason: 'high-cardinality' })
    }
  }
  const usableFeatures = selected.filter((name) => {
    const j = index.get(name)!
    const values = new Set(kept.map((i) => table.rows[i][j].trim()))
    const constant =
      info.get(name)!.kind === 'numeric'
        ? new Set(kept.map((i) => parseNumber(table.rows[i][j]))).size <= 1
        : values.size <= 1
    if (constant) excluded.push({ column: name, reason: 'constant' })
    return !constant
  })

  const { data, features } = encode(table, columns, kept, config.target, usableFeatures)
  const report: CleaningReport = {
    originalRows: table.rows.length,
    usableRows: kept.length,
    missingByColumn: checked
      .filter((name) => missingCount.has(name))
      .map((column) => ({ column, count: missingCount.get(column)! })),
    excluded,
    target: config.target,
    p: data.p,
  }

  if (data.p === 0) return { ok: false, error: '請至少勾選一個可用的特徵。', report }
  if (data.p > MAX_FEATURES) {
    return { ok: false, error: `特徵數 ${data.p} 超過上限 ${MAX_FEATURES}，請取消部分欄位。`, report }
  }
  if (kept.length < MIN_USABLE_ROWS) {
    return {
      ok: false,
      error: `清理後只剩 ${kept.length} 列可用，至少需要 ${MIN_USABLE_ROWS} 列才能切分與估計。`,
      report,
    }
  }
  return { ok: true, data, features, report, sourceRows: kept }
}
