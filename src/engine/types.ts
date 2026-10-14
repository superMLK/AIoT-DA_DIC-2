/** 已清理、已編碼的數值資料。X 為列主序 n × p。 */
export interface NumericData {
  n: number
  p: number
  X: Float64Array
  y: Float64Array
  columns: string[]
}

export function cell(data: NumericData, row: number, col: number): number {
  return data.X[row * data.p + col]
}
