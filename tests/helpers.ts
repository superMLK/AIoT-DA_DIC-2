import { readdirSync, readFileSync } from 'node:fs'
import type { NumericData } from '../src/engine/types.ts'
import { expect } from 'vitest'

export function loadFixture<T = any>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
}

/** 相對誤差比較；期望值的絕對值小於 absFloor 時改用絕對誤差。 */
export function expectClose(actual: number, expected: number, rel: number, absFloor = 0, label = '') {
  const diff = Math.abs(actual - expected)
  const ok =
    Math.abs(expected) < absFloor ? diff < absFloor : diff <= rel * Math.abs(expected) || diff === 0
  if (!ok) {
    expect.fail(`${label} actual=${actual} expected=${expected} diff=${diff}`)
  }
}

export function expectAllClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  rel: number,
  absFloor = 0,
  label = '',
) {
  expect(actual.length, `${label} length`).toBe(expected.length)
  for (let i = 0; i < expected.length; i++) expectClose(actual[i], expected[i], rel, absFloor, `${label}[${i}]`)
}


export interface FixtureInput {
  columns: string[]
  X: number[][]
  y: number[]
  train: number[]
  test: number[]
  folds?: number[][]
  subsets?: number[][]
  exhaustiveMaxP?: number
}

export function toNumericData(input: FixtureInput): NumericData {
  const n = input.X.length
  const p = input.columns.length
  const X = new Float64Array(n * p)
  input.X.forEach((row, i) => row.forEach((v, j) => (X[i * p + j] = v)))
  return { n, p, X, y: Float64Array.from(input.y), columns: input.columns }
}

/** 列出所有同時有 input 與 expected 的 fixture 名稱。 */
export function fixtureCases(): string[] {
  const dir = new URL('./fixtures/', import.meta.url)
  const files = readdirSync(dir)
  return files
    .filter((f) => f.endsWith('.input.json'))
    .map((f) => f.replace('.input.json', ''))
    .filter((name) => files.includes(`${name}.expected.json`))
}
