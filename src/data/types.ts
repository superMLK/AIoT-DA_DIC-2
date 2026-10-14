/** CSV 解析後的原始表格（全部為字串）。 */
export interface RawTable {
  headers: string[]
  rows: string[][]
}

export type ColumnKind = 'numeric' | 'categorical'

export interface ColumnInfo {
  name: string
  kind: ColumnKind
  /** 缺值筆數。 */
  missing: number
  /** 類別欄的級數（依字母序）；數值欄為空陣列。 */
  levels: string[]
}

/** 使用者可修改的欄位角色設定。 */
export interface ColumnConfig {
  target: string
  /** 勾選為特徵的原始欄位名稱。 */
  features: string[]
}

export interface ColumnNote {
  /** 預設不勾選的原因。 */
  reason: string
}

/** 原始特徵與其編碼後的欄位對應。 */
export interface FeatureMeta {
  name: string
  kind: ColumnKind
  /** 數值欄：編碼後資料的欄位索引。 */
  col?: number
  /** 類別欄：全部級數（字母序）、參考組與各 dummy 欄位索引。 */
  levels?: string[]
  reference?: string
  dummies?: { level: string; col: number }[]
}

export interface ExcludedColumn {
  column: string
  reason: 'constant' | 'high-cardinality'
}

export interface CleaningReport {
  originalRows: number
  usableRows: number
  /** 被刪除的列中，各欄位有缺值的筆數。 */
  missingByColumn: { column: string; count: number }[]
  excluded: ExcludedColumn[]
  target: string
  /** 展開 dummy 後的特徵數。 */
  p: number
}
