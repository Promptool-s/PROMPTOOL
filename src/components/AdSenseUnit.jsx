import { useEffect, useRef } from 'react'

const PUBLISHER_ID = import.meta.env.VITE_ADSENSE_PUBLISHER_ID

const AdSenseUnit = ({ slot, format = 'auto', style = {} }) => {
  const ref = useRef(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!PUBLISHER_ID || pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (_) {}
  }, [])

  if (!PUBLISHER_ID) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-slate-200 text-slate-400 text-[10px] text-center leading-tight p-2"
        style={{ width: 160, height: 600, ...style }}
      >
        Ad<br />160×600
      </div>
    )
  }

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block', width: 160, height: 600, ...style }}
      data-ad-client={PUBLISHER_ID}
      data-ad-slot={slot}
      data-ad-format={format}
    />
  )
}

export default AdSenseUnit
