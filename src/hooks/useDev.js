import { useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

export const useDev = (userId) => {
  const [isDev, setIsDev] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setIsDev(false); setLoading(false); return }

    let cancelled = false
    const checkDev = async () => {
      try {
        const me = await api.get('/usuarios/me')
        if (!cancelled) setIsDev(me?.devstate === true)
      } catch {
        if (!cancelled) setIsDev(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    checkDev()
    return () => { cancelled = true }
  }, [userId])

  return { isDev, loading }
}
