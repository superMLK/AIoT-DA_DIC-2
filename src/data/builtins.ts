import type { ColumnConfig, ColumnNote } from './types.ts'

export interface BuiltinDataset {
  id: string
  label: string
  /** 相對於網站根目錄的路徑。 */
  file: string
  config: ColumnConfig
  notes: Record<string, ColumnNote>
  /** Business Understanding 區塊的背景說明（每個元素一段）。 */
  description: string[]
  /** 目標變數的白話說明。 */
  targetLabel: string
}

export const BUILTIN_DATASETS: BuiltinDataset[] = [
  {
    id: '50-startups',
    label: '50 Startups',
    file: 'datasets/50_Startups.csv',
    config: {
      target: 'Profit',
      features: ['R&D Spend', 'Administration', 'Marketing Spend', 'State'],
    },
    notes: {},
    targetLabel: '年度利潤（美元）',
    description: [
      '假設你是一家創投公司的分析師，手上有 50 家新創公司去年的支出與利潤：研發（R&D Spend）、行政管理（Administration）、行銷（Marketing Spend）三項支出，以及公司所在的州（State）。',
      '要回答的商業問題是：「哪些支出真的和利潤有關？只看其中幾項，能不能把利潤預測得一樣好，甚至更好？」特徵越多，模型在訓練資料上一定越貼合，但不一定能推廣到新公司。這就是本頁要觀察的取捨。',
    ],
  },
  {
    id: 'boston-housing',
    label: 'Boston Housing',
    file: 'datasets/BostonHousing.csv',
    config: {
      target: 'MEDV',
      features: ['CRIM', 'ZN', 'INDUS', 'CHAS', 'NOX', 'RM', 'AGE', 'DIS', 'RAD', 'TAX', 'PTRATIO', 'LSTAT'],
    },
    notes: {
      B: {
        reason:
          '此欄定義為 1000(Bk − 0.63)²，Bk 為該區黑人居民比例，原作者以此假設種族與房價有關，具倫理爭議，預設排除。',
      },
    },
    targetLabel: '自住房屋中位數價格（千美元）',
    description: [
      '1970 年代波士頓地區 506 個普查區的資料（Harrison & Rubinfeld, 1978），目標是自住房屋的中位數價格 MEDV。特徵包含犯罪率（CRIM）、平均房間數（RM）、低收入人口比例（LSTAT）、師生比（PTRATIO）、空氣污染（NOX）等 13 項。',
      '這份資料的特徵彼此高度相關（例如 RAD 與 TAX），很適合觀察共線性如何讓係數變得不穩定，以及特徵選擇能否在少用特徵的情況下維持預測力。',
    ],
  },
]

export const DEFAULT_DATASET_ID = '50-startups'

export const GENERIC_DESCRIPTION = [
  '這是你從外部載入的資料集。請先在 Data Preparation 確認目標 y 與特徵欄位是否正確。',
  '接下來可以觀察：不同特徵選擇方法挑出哪些特徵、特徵數 k 增加時測試誤差是否持續下降，以及最後的模型在統計上是否站得住腳。',
]
