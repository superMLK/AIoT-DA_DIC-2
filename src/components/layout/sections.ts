export interface SectionMeta {
  id: string
  no: number
  en: string
  zh: string
}

export const SECTIONS: SectionMeta[] = [
  { id: 'business', no: 1, en: 'Business Understanding', zh: '商業理解' },
  { id: 'data-understanding', no: 2, en: 'Data Understanding', zh: '資料理解' },
  { id: 'data-preparation', no: 3, en: 'Data Preparation', zh: '資料準備' },
  { id: 'modeling', no: 4, en: 'Modeling', zh: '建模' },
  { id: 'evaluation', no: 5, en: 'Evaluation', zh: '評估' },
  { id: 'deployment', no: 6, en: 'Deployment', zh: '部署：即時預測' },
]
