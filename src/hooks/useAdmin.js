import { useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

export const useAdmin = (userId) => {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    let cancelled = false
    const checkAdmin = async () => {
      try {
        const me = await api.get('/usuarios/me')
        if (!cancelled) setIsAdmin(me?.adminstate === true)
      } catch {
        if (!cancelled) setIsAdmin(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    checkAdmin()
    return () => { cancelled = true }
  }, [userId])

  return { isAdmin, loading }
}
