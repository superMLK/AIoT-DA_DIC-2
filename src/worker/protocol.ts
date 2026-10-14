import { runPipeline, type ResultBundle } from '../engine/pipeline.ts'
import type { Split } from '../engine/split.ts'
import type { NumericData } from '../engine/types.ts'

export interface RunRequest {
  type: 'run'
  requestId: number
  data: NumericData
  split: Split
}

export type WorkerResponse =
  | { type: 'progress'; requestId: number; fraction: number }
  | { type: 'result'; requestId: number; bundle: ResultBundle }
  | { type: 'error'; requestId: number; message: string }

/** Worker 的訊息處理（與 Worker 環境無關，方便測試）。 */
export function handleRequest(req: RunRequest, post: (msg: WorkerResponse) => void): void {
  try {
    const bundle = runPipeline(req.data, req.split, (fraction) =>
      post({ type: 'progress', requestId: req.requestId, fraction }),
    )
    post({ type: 'result', requestId: req.requestId, bundle })
  } catch (e) {
    post({ type: 'error', requestId: req.requestId, message: e instanceof Error ? e.message : String(e) })
  }
}
