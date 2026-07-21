import { useEffect, useRef } from 'react'
import gsap from 'gsap'

// ── RotatingWord ───────────────────────────────────────────────────────────
// Masked vertical roll between words, with the mask width easing to each new
// word so the line re-flows smoothly instead of snapping.
//
// Runs entirely through GSAP on refs — the cycle never re-renders React, so a
// headline can rotate indefinitely at zero reconciliation cost.
//
// The wrapper is aria-hidden: only one word is ever "true" at a time, so the
// consumer must expose the full accessible text (e.g. aria-label on the h1).

const RotatingWord = ({
  words,
  interval = 2800,
  animate = true,
  className = '',
  wordClassName = '',
}) => {
  const wrapRef = useRef(null)
  const itemsRef = useRef([])

  useEffect(() => {
    const wrap = wrapRef.current
    const items = itemsRef.current.filter(Boolean)
    if (!wrap || !items.length) return

    const widthOf = (el) => el.getBoundingClientRect().width
    let index = 0
    let tl = null

    // Park every word below the mask, then lift the first one into view.
    gsap.set(items, { yPercent: 115, opacity: 0 })
    gsap.set(items[0], { yPercent: 0, opacity: 1 })
    gsap.set(wrap, { width: widthOf(items[0]) })

    // Widths measured before the webfont swaps in would be wrong.
    const resync = () => gsap.set(wrap, { width: widthOf(items[index]) })
    if (document.fonts?.ready) document.fonts.ready.then(resync).catch(() => {})
    window.addEventListener('resize', resync)

    let timer = null
    if (animate && items.length > 1) {
      timer = setInterval(() => {
        const current = items[index]
        index = (index + 1) % items.length
        const next = items[index]
        tl?.kill()
        tl = gsap.timeline()
        tl.to(wrap, { width: widthOf(next), duration: 0.55, ease: 'power3.inOut' }, 0)
          .to(current, { yPercent: -115, opacity: 0, duration: 0.45, ease: 'power3.in' }, 0)
          .fromTo(next,
            { yPercent: 115, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
            0.1
          )
      }, interval)
    }

    return () => {
      if (timer) clearInterval(timer)
      tl?.kill()
      window.removeEventListener('resize', resync)
      gsap.set([wrap, ...items], { clearProps: 'all' })
    }
  }, [words, interval, animate])

  return (
    <span
      ref={wrapRef}
      aria-hidden="true"
      // pb/-mb keeps descenders from being clipped by the mask.
      className={`relative inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom ${className}`}
    >
      {/* In-flow sizer: gives the mask its height. Width is GSAP-driven. */}
      <span className="invisible whitespace-nowrap" aria-hidden="true">{words[0]}</span>
      {words.map((word, i) => (
        <span
          key={word}
          ref={(el) => { itemsRef.current[i] = el }}
          className={`absolute left-0 top-0 whitespace-nowrap ${wordClassName}`}
        >
          {word}
        </span>
      ))}
    </span>
  )
}

export default RotatingWord
