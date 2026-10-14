import { currentModel, detailMethodOf } from '../../state/reducer.ts'
import { useStore } from '../../state/store.tsx'

/** 目前要呈現的結果：最新完成的計算、其對應的資料，以及細節區塊的模型。 */
export function useCurrent() {
  const { state } = useStore()
  const result = state.compute.result
  return {
    bundle: result?.bundle ?? null,
    prep: result?.prep ?? null,
    model: currentModel(state),
    method: detailMethodOf(state),
    updating: state.compute.running,
    prepError: state.prep && !state.prep.ok ? state.prep.error : null,
  }
}

export function featureName(columns: string[], col: number): string {
  return col < 0 ? '截距' : columns[col]
}
