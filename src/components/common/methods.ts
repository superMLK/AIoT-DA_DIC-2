import type { PointStyle } from 'chart.js'
import type { MethodId } from '../../engine/pipeline.ts'

export interface MethodMeta {
  id: MethodId
  label: string
  /** 對應的 CSS 色彩變數。 */
  colorVar: string
  /** 次要編碼：每個方法不同的點形狀。 */
  pointStyle: PointStyle
  blurb: string
}

export const METHOD_META: Record<MethodId, MethodMeta> = {
  lasso: {
    id: 'lasso',
    label: 'Lasso',
    colorVar: '--series-1',
    pointStyle: 'circle',
    blurb: '沿 α 由大到小，依係數變成非零的先後取前 k 個特徵。',
  },
  sfs: {
    id: 'sfs',
    label: 'Forward SFS',
    colorVar: '--series-2',
    pointStyle: 'rect',
    blurb: '從零開始，每一步加入讓訓練 RSS 降最多的特徵。',
  },
  rfe: {
    id: 'rfe',
    label: 'RFE',
    colorVar: '--series-3',
    pointStyle: 'triangle',
    blurb: '從全部特徵開始，每輪刪掉標準化係數絕對值最小的一個。',
  },
  enet: {
    id: 'enet',
    label: 'ElasticNet',
    colorVar: '--series-4',
    pointStyle: 'rectRot',
    blurb: 'L1 與 L2 懲罰各半（L1 比例 0.5），依進場順序取前 k 個。',
  },
  exhaustive: {
    id: 'exhaustive',
    label: 'Exhaustive',
    colorVar: '--series-5',
    pointStyle: 'star',
    blurb: '列舉所有 C(p, k) 種組合，取訓練 RSS 最小者。',
  },
  ols: {
    id: 'ols',
    label: 'OLS 基準',
    colorVar: '--series-base',
    pointStyle: 'line',
    blurb: '使用全部特徵，不做挑選。',
  },
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
