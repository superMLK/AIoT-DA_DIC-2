// 以網頁實際使用的清理、編碼與切分流程產生 oracle 的 input fixture。
// 執行：npm run fixtures:inputs（之後再執行 npm run oracle 產生 expected）
import { readFileSync, writeFileSync } from 'node:fs'
import { BUILTIN_DATASETS } from '../src/data/builtins.ts'
import { prepare } from '../src/data/clean.ts'
import { describeColumns, parseCsv } from '../src/data/loader.ts'
import { DEFAULT_SEED, DEFAULT_TEST_RATIO, makeSplit } from '../src/engine/split.ts'

interface Case {
  name: string
  datasetId: string
  extraFeatures?: string[]
  subsets: (p: number) => number[][]
}

const all = (p: number) => Array.from({ length: p }, (_, j) => j)

const cases: Case[] = [
  { name: 'startups', datasetId: '50-startups', subsets: (p) => [all(p), [0], [0, 2], [0, 2, 4]] },
  { name: 'boston', datasetId: 'boston-housing', subsets: (p) => [all(p), [5, 11]] },
  { name: 'boston-with-b', datasetId: 'boston-housing', extraFeatures: ['B'], subsets: (p) => [all(p)] },
]

for (const c of cases) {
  const ds = BUILTIN_DATASETS.find((d) => d.id === c.datasetId)!
  const table = parseCsv(readFileSync(new URL(`../public/${ds.file}`, import.meta.url), 'utf8'))
  const config = { ...ds.config, features: [...ds.config.features, ...(c.extraFeatures ?? [])] }
  const res = prepare(table, describeColumns(table), config)
  if (!res.ok) throw new Error(`${c.name}: ${res.error}`)
  const { data } = res
  const split = makeSplit(data.n, DEFAULT_TEST_RATIO, DEFAULT_SEED)
  const X = Array.from({ length: data.n }, (_, i) => Array.from(data.X.slice(i * data.p, (i + 1) * data.p)))
  const input = {
    columns: data.columns,
    X,
    y: Array.from(data.y),
    train: split.train,
    test: split.test,
    folds: split.folds,
    subsets: c.subsets(data.p),
    exhaustiveMaxP: 15,
  }
  const out = new URL(`../tests/fixtures/${c.name}.input.json`, import.meta.url)
  writeFileSync(out, JSON.stringify(input))
  console.log(`wrote tests/fixtures/${c.name}.input.json (n=${data.n}, p=${data.p})`)
}
