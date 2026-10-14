/// <reference lib="webworker" />
import { handleRequest, type RunRequest } from './protocol.ts'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<RunRequest>) => {
  handleRequest(event.data, (msg) => scope.postMessage(msg))
}
