import { useEffect, useState } from 'react'
import { useStore } from '../../state/store.tsx'
import { fmtPct } from '../common/format.ts'
import { MethodControls } from '../modeling/MethodControls.tsx'

export const MODELING_CONTROLS_ID = 'modeling-controls'

/** 捲過 Modeling 區塊的控制項後，固定在畫面頂端的精簡控制列。 */
export function StickyControls() {
  const [visible, setVisible] = useState(false)
  const { state } = useStore()

  useEffect(() => {
    const target = document.getElementById(MODELING_CONTROLS_ID)
    if (!target) return
    // 以捲動位置判斷：IntersectionObserver 在「直接跳轉」跨過整段時不會觸發
    let frame = 0
    const update = () => {
      frame = 0
      setVisible(target.getBoundingClientRect().bottom < 0)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="sticky-controls" data-visible={visible} aria-hidden={!visible} inert={!visible}>
      <div className="inner">
        <MethodControls compact />
        {state.compute.running && (
          <span className="tag tag-accent" role="status">
            計算中 {fmtPct(state.compute.fraction)}
          </span>
        )}
      </div>
    </div>
  )
}

export function ProgressBar() {
  const { state } = useStore()
  const { running, fraction } = state.compute
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label="計算進度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      style={{ width: running ? `${Math.max(4, fraction * 100)}%` : '100%', opacity: running ? 1 : 0 }}
    />
  )
}
