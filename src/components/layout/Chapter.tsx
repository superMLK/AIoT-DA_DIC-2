import type { ReactNode } from 'react'
import { SECTIONS } from './sections.ts'

interface Props {
  id: string
  updating?: boolean
  children: ReactNode
}

export function Chapter({ id, updating, children }: Props) {
  const meta = SECTIONS.find((s) => s.id === id)!
  return (
    <section id={id} className="chapter" aria-labelledby={`${id}-title`}>
      <header className="chapter-head">
        <span className="sec">§{meta.no}</span>
        <h2 id={`${id}-title`}>{meta.en}</h2>
        <span className="zh">{meta.zh}</span>
        {updating && (
          <span className="tag tag-accent updating" role="status">
            更新中…
          </span>
        )}
      </header>
      {children}
    </section>
  )
}
