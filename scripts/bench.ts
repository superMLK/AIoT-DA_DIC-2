// 效能檢查：對內建資料集跑完整管線並計時。執行：npm run bench
import { readFileSync } from 'node:fs'
import { BUILTIN_DATASETS } from '../src/data/builtins.ts'
import { prepare } from '../src/data/clean.ts'
import { describeColumns, parseCsv } from '../src/data/loader.ts'
import { runPipeline } from '../src/engine/pipeline.ts'
import { DEFAULT_SEED, DEFAULT_TEST_RATIO, makeSplit } from '../src/engine/split.ts'

const cases = [
  { id: '50-startups', extra: [] as string[] },
  { id: 'boston-housing', extra: [] as string[] },
  { id: 'boston-housing', extra: ['B'] },
]

for (const c of cases) {
  const ds = BUILTIN_DATASETS.find((d) => d.id === c.id)!
  const table = parseCsv(readFileSync(new URL(`../public/${ds.file}`, import.meta.url), 'utf8'))
  const res = prepare(table, describeColumns(table), { ...ds.config, features: [...ds.config.features, ...c.extra] })
  if (!res.ok) throw new Error(res.error)
  const split = makeSplit(res.data.n, DEFAULT_TEST_RATIO, DEFAULT_SEED)
  runPipeline(res.data, split) // 暖機
  const runs = 3
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) runPipeline(res.data, split)
  const ms = (performance.now() - t0) / runs
  console.log(`${ds.label}${c.extra.length ? ' + ' + c.extra.join(',') : ''} (p=${res.data.p}): ${ms.toFixed(0)} ms`)
}
