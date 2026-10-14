import { useEffect, useRef, useState } from 'react'
import { SECTIONS } from './sections.ts'

export function SectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting)
        const current = SECTIONS.find((s) => visible.get(s.id))
        if (current) setActive(current.id)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  // 手機版橫向導覽：讓目前階段捲入可視範圍
  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLElement>(`a[href="#${active}"]`)
    const list = listRef.current
    if (link && list && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: link.offsetLeft - 16, behavior: 'smooth' })
    }
  }, [active])

  return (
    <nav className="section-nav" aria-label="CRISP-DM 階段">
      <ol ref={listRef}>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined}>
              <span className="no">{s.no}</span>
              <span>
                {s.en}
                <span className="zh">{s.zh}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
