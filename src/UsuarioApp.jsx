import { useEffect, useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import Header from './components/Header'
import Footer from './components/Footer'
import { useAuth } from './hooks/useAuth'
import flameLitGif from './assets/flame-lit.gif'
import { useAdmin } from './hooks/useAdmin'
import { useLang } from './contexts/LangContext'
import { supabase } from './supabaseClient'
import { nowAR } from './utils/dateAR'
import { checkImageSafe } from './services/moderationService'
import { getRank, getNextRank, ELO_RANKS } from './services/eloService'
import { calculateElo } from './services/eloService'
import ImageCropper from './components/ImageCropper'
import { proxyImg } from './utils/imgProxy'

function getTargetUserId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('id') || null
}

function getTargetUsername() {
  const params = new URLSearchParams(window.location.search)
  return params.get('u') || null
}

function UsuarioApp() {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin } = useAdmin(user?.id)
  const { t, lang } = useLang()
  const targetId = getTargetUserId()
  const targetUsername = getTargetUsername()

  const [profile, setProfile] = useState(null)
  const [enterpriseRequests, setEnterpriseRequests] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [enterpriseLoadingRequests, setEnterpriseLoadingRequests] = useState(false)
  const [enterpriseActionStatus, setEnterpriseActionStatus] = useState(null)
  const [enterpriseTab, setEnterpriseTab] = useState('profile')
  const [enterpriseProfileValues, setEnterpriseProfileValues] = useState({
    companyName: '',
    description: '',
    website: '',
    publicProfile: true,
  })
  const [enterpriseSavingProfile, setEnterpriseSavingProfile] = useState(false)
  const [enterpriseMembers, setEnterpriseMembers] = useState([])
  const [enterpriseMembersLoading, setEnterpriseMembersLoading] = useState(false)
  const [joinRequestStatus, setJoinRequestStatus] = useState(null) // null | 'loading' | 'sent' | 'already' | 'error' | 'member'
  const [joinRequestMessage, setJoinRequestMessage] = useState('')
  const [userCompanyData, setUserCompanyData] = useState(null) // datos de la empresa a la que pertenece el usuario

  const ownProfile =
    (!targetId && !targetUsername && !!user) ||
    (targetId && user && targetId === user.id) ||
    (targetUsername && user && profile?.id_usuario === user.id)

  const [stats, setStats] = useState({
    totalIntentos: 0, promedioScore: 0, mejorScore: 0,
    peorScore: 0, intentosHoy: 0, intentosEstaSemana: 0,
    porcentajeAprobacion: 0, racha: 0, avgTime: null,
  })
  const [recentAttempts, setRecentAttempts] = useState([])
  const [chartData, setChartData] = useState([])
  const [heatmapData, setHeatmapData] = useState({})
  const [chartCompanyNames, setChartCompanyNames] = useState({}) // { company_id: company_name }
  const [topStrengths, setTopStrengths] = useState([])
  const [topImprovements, setTopImprovements] = useState([])
  const [selectedAttempt, setSelectedAttempt] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingBio, setEditingBio] = useState(false)
  const [editingStats, setEditingStats] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedProfile, setEditedProfile] = useState({})
  const [editedBio, setEditedBio] = useState('')
  const [editedStats, setEditedStats] = useState({})
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [checkingNsfw, setCheckingNsfw] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)
  const [isTop1, setIsTop1] = useState(false)
  const [chartColor, setChartColor] = useState('#6366f1')
  const hasRedirected = useRef(false)
  const fileInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [showcaseFile, setShowcaseFile] = useState(null)
  const [uploadingShowcase, setUploadingShowcase] = useState(false)

  // Cropper state
  const [cropperSrc, setCropperSrc] = useState(null)
  const [cropperType, setCropperType] = useState(null) // 'avatar' | 'banner' | 'showcase'
  const [cropperAspect, setCropperAspect] = useState(null)
  const [cropperShape, setCropperShape] = useState('rect')

  // Comparador de stats
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareWith, setCompareWith] = useState(null)   // { id, name, avatar, stats }
  const [compareSearch, setCompareSearch] = useState('')
  const [compareResults, setCompareResults] = useState([])
  const [loadingCompare, setLoadingCompare] = useState(false)

  const fetchCompareStats = async (userId) => {
    const { data } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre_display, nombre, username, avatar_url, promedio_score, mejor_score, peor_score, porcentaje_aprobacion, total_intentos, racha_actual')
      .eq('id_usuario', userId)
      .maybeSingle()
    if (!data) return null
    return {
      id: data.id_usuario,
      name: data.nombre_display || data.nombre || data.username || 'Usuario',
      username: data.username,
      avatar: data.avatar_url,
      stats: {
        promedioScore: data.promedio_score || 0,
        mejorScore: data.mejor_score || 0,
        peorScore: data.peor_score || 0,
        porcentajeAprobacion: data.porcentaje_aprobacion || 0,
        totalIntentos: data.total_intentos || 0,
        racha: data.racha_actual || 0,
      }
    }
  }

  const handleCompareSearch = async (q) => {
    setCompareSearch(q)
    if (!q.trim()) { setCompareResults([]); return }
    setLoadingCompare(true)
    const { data } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre_display, nombre, username, avatar_url')
      .or(`username.ilike.%${q}%,nombre_display.ilike.%${q}%,nombre.ilike.%${q}%`)
      .limit(5)
    setCompareResults(data || [])
    setLoadingCompare(false)
  }

  const CHART_COLORS = [
    { hex: '#10b981', name: 'Esmeralda' },
    { hex: '#f59e0b', name: 'Ámbar' },
    { hex: '#ef4444', name: 'Rojo' },
    { hex: '#3b82f6', name: 'Azul' },
    { hex: '#ec4899', name: 'Rosa' },
    { hex: '#8b5cf6', name: 'Violeta' },
    { hex: '#14b8a6', name: 'Teal' },
  ]

  const openCropper = (file, type) => {
    // GIFs no se pueden recortar sin perder la animación — subir directo
    if (file.type === 'image/gif') {
      handleCropDone(file, type)
      return
    }
    const url = URL.createObjectURL(file)
    setCropperSrc(url)
    setCropperType(type)
    if (type === 'avatar') { setCropperAspect(1); setCropperShape('circle') }
    else if (type === 'banner') { setCropperAspect(3); setCropperShape('rect') }
    else { setCropperAspect(null); setCropperShape('rect') }
  }

  const handleCropDone = async (blobOrFile, typeOverride) => {
    const type = typeOverride ?? cropperType
    setCropperSrc(null); setCropperType(null)
    const isGif = blobOrFile instanceof File && blobOrFile.type === 'image/gif'
    const ext = isGif ? 'gif' : 'jpg'
    const file = isGif ? blobOrFile : new File([blobOrFile], `${type}.jpg`, { type: 'image/jpeg' })
    const previewUrl = URL.createObjectURL(file)

    if (type === 'avatar') {
      setAvatarFile(file)
      setAvatarPreview(previewUrl)
    } else if (type === 'banner') {
      setBannerFile(file)
      setProfile(p => ({ ...p, banner_url: previewUrl }))
    } else if (type === 'showcase') {
      setShowcaseFile(file)
      setProfile(p => ({ ...p, showcase_url: previewUrl }))
      setUploadingShowcase(true)
      try {
        await supabase.storage.createBucket('avatars', { public: true }).catch(() => {})
        const path = `${user.id}/showcase.${ext}`
        await supabase.storage.from('avatars').upload(path, file, { upsert: true })
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        const url = data.publicUrl + '?t=' + Date.now()
        await supabase.from('usuarios').update({ showcase_url: url }).eq('id_usuario', user.id)
        setProfile(p => ({ ...p, showcase_url: url }))
      } catch (err) { alert('Error: ' + err.message) }
      finally { setUploadingShowcase(false) }
    }
  }

  const handleChartColorChange = (hex) => {    setChartColor(hex)
    if (user) {
      localStorage.setItem(`profileChartColor_${user.id}`, hex)
      supabase.from('usuarios').update({ accent_color: hex }).eq('id_usuario', user.id).then(() => {})
    }
  }

  // Convierte hex a filtro CSS para colorear imágenes/GIFs
  // Usa hue-rotate dinámico calculado desde el color — funciona con cualquier hex
  const hexToFilter = (hex) => {
    try {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      let h = 0
      if (max !== min) {
        const d = max - min
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        else if (max === g) h = ((b - r) / d + 2) / 6
        else h = ((r - g) / d + 4) / 6
      }
      const hDeg = Math.round(h * 360)
      const s = max === 0 ? 0 : Math.round(((max - min) / max) * 100)
      const l = Math.round(((max + min) / 2) * 100)
      // El GIF de fuego tiene tonos naranjas (~30°) — ajustamos desde ahí
      const rotate = ((hDeg - 30) + 360) % 360
      return `sepia(1) saturate(${Math.max(s * 3, 200)}%) hue-rotate(${rotate}deg) brightness(${l > 50 ? 1.1 : 0.9})`
    } catch {
      return 'none'
    }
  }

  useEffect(() => {
    // Esperar a que auth resuelva
    if (authLoading) return

    // Sin ?id= y sin ?u= y sin sesión → home
    if (!targetId && !targetUsername && !user) {
      if (!hasRedirected.current) {
        hasRedirected.current = true
        window.location.href = '/'
      }
      return
    }

    const run = async () => {
      // Si hay username en URL, resolver a id primero
      const resolveId = async () => {
        if (targetUsername) {
          const { data } = await supabase
            .from('usuarios')
            .select('id_usuario')
            .ilike('username', targetUsername)
            .maybeSingle()
          return data?.id_usuario || null
        }
        return targetId || user?.id || null
      }

      const idToLoad = await resolveId()
      if (!idToLoad) { setNotFound(true); setLoadingData(false); return }

      const fetchData = async () => {
      setLoadingData(true)
      try {
        // Intentar con columnas completas primero
        let prof = null
        const { data: profFull, error: profError } = await supabase
          .from('usuarios')
          .select('id_usuario, nombre, nombre_display, username, email, email_publico, bio, avatar_url, banner_url, adminstate, devstate, fecha_registro, total_intentos, promedio_score, mejor_score, peor_score, porcentaje_aprobacion, racha_actual, pais, idioma_display, social_github, social_linkedin, social_twitter, social_website, pronouns, status, accent_color, organization, showcase_url, elo_rating, user_type, company_name, company_id, company_role, company_joined_at, show_stats, show_company_badge, verified, company_tagline, company_industry, company_size, company_founded, username_last_changed')
          .eq('id_usuario', idToLoad)
          .maybeSingle()

        if (profError) {
          // Columnas nuevas no existen aún — fallback a columnas básicas
          const { data: profBasic } = await supabase
            .from('usuarios')
            .select('id_usuario, nombre, email, adminstate, fecha_registro')
            .eq('id_usuario', idToLoad)
            .maybeSingle()
          prof = profBasic
        } else {
          prof = profFull
        }

        if (!prof) {
          setNotFound(true)
          return
        }

        setProfile(prof)

        // Cargar datos de empresa si el usuario pertenece a una
        if (prof?.company_id) {
          supabase
            .from('usuarios')
            .select('id_usuario, company_name, nombre_display, avatar_url, verified, company_joined_at')
            .eq('id_usuario', prof.company_id)
            .maybeSingle()
            .then(({ data }) => setUserCompanyData(data || null))
        } else {
          setUserCompanyData(null)
        }
        // si es ajeno usar solo el de la BD
        const ownProfileCheck =
          (!targetId && !targetUsername && !!user) ||
          (targetId && user && targetId === user.id) ||
          (targetUsername && user && prof?.id_usuario === user.id)

        if (ownProfileCheck) {
          // Propio: localStorage con clave de usuario tiene prioridad, luego BD
          const saved = user ? localStorage.getItem(`profileChartColor_${user.id}`) : null
          setChartColor(saved || prof?.accent_color || '#6366f1')
        } else {
          // Ajeno: solo la BD, nunca tocar localStorage
          setChartColor(prof?.accent_color || '#6366f1')
        }

        const ownProfile =
  (!targetId && !targetUsername && !!user) ||
  (targetId && user && targetId === user.id) ||
  (targetUsername && user && prof?.id_usuario === user.id)

        // Si es el propio perfil y tiene username, limpiar la URL a /user/username
        if (ownProfile && prof?.username) {
          const cleanUrl = `/user/${prof.username}`
          if (window.location.pathname !== cleanUrl) {
            window.history.replaceState(null, '', cleanUrl)
          }
        }

        // Cargar intentos — RLS permite leer solo los propios, admin puede leer todos
        if (ownProfile || isAdmin) {
          const { data: intentos, error: intentosError } = await supabase
            .from('intentos')
.select('id_intento, puntaje_similitud, fecha_hora, prompt_usuario, id_imagen, strengths, improvements, elo_delta, is_ranked, tiempo_respuesta, imagenes_ia(url_image, prompt_original, image_diff, company_id)')            .eq('id_usuario', idToLoad)
            .order('fecha_hora', { ascending: false })

          if (intentos && intentos.length > 0) {
            const realIntentos = intentos.filter(i => i.prompt_usuario !== '[REVEALED]')
            const total = realIntentos.length
            const scores = realIntentos.map(i => i.puntaje_similitud || 0)
            const promedio = total > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / total) : 0
            const mejor = total > 0 ? Math.max(...scores) : 0
            const peor = total > 0 ? Math.min(...scores) : 0
            const aprobados = realIntentos.filter(i => (i.puntaje_similitud || 0) >= 60).length
            const porcentajeAprobacion = total > 0 ? Math.round((aprobados / total) * 100) : 0

            const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
            const intentosHoy = realIntentos.filter(i => new Date(i.fecha_hora) >= hoy).length
            const inicioSemana = new Date()
            inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
            inicioSemana.setHours(0, 0, 0, 0)
            const intentosEstaSemana = realIntentos.filter(i => new Date(i.fecha_hora) >= inicioSemana).length

            let racha = 0
            const fechasUnicas = [...new Set(realIntentos.map(i => {
              const d = new Date(i.fecha_hora)
              return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            }))]
            const hoyStr = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`
            if (fechasUnicas.includes(hoyStr)) {
              racha = 1
              for (let i = 1; i < 365; i++) {
                const dia = new Date(hoy); dia.setDate(dia.getDate() - i)
                const diaStr = `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}`
                if (fechasUnicas.includes(diaStr)) racha++; else break
              }
            }

            setStats({ totalIntentos: total, promedioScore: promedio, mejorScore: mejor, peorScore: peor, intentosHoy, intentosEstaSemana, porcentajeAprobacion, racha,
              imagenesVencidas: realIntentos.filter(i => (i.puntaje_similitud || 0) > 93).length,
              promptsRevelados: intentos.filter(i => i.prompt_usuario === '[REVEALED]').length,
              avgAttemptsPerImage: (() => {
                const byImage = {}
                realIntentos.forEach(i => { if (i.id_imagen) byImage[i.id_imagen] = (byImage[i.id_imagen] || 0) + 1 })
                const vals = Object.values(byImage)
                return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : 0
              })(),
              avgTime: (() => {
                const avgByDiff = {}
                for (const diff of ['Easy', 'Medium', 'Hard']) {
                  const group = realIntentos.filter(i => i.tiempo_respuesta > 0 && i.imagenes_ia?.image_diff === diff)
                  if (group.length) avgByDiff[diff] = Math.round(group.reduce((s, i) => s + i.tiempo_respuesta, 0) / group.length)
                }
                return Object.keys(avgByDiff).length ? avgByDiff : null
              })(),
            })

            // Filtrar del historial los intentos de desafíos de empresas no verificadas
            const companyIds = [...new Set(intentos.map(i => i.imagenes_ia?.company_id).filter(Boolean))]
            let verifiedCompanyIds = new Set()
            if (companyIds.length > 0) {
              const { data: verifiedCos } = await supabase
                .from('usuarios')
                .select('id_usuario')
                .in('id_usuario', companyIds)
                .eq('verified', true)
              verifiedCos?.forEach(c => verifiedCompanyIds.add(c.id_usuario))
            }
            const intentosVisibles = intentos.filter(i => {
              const cid = i.imagenes_ia?.company_id
              if (!cid) return true // desafío normal, siempre visible
              return verifiedCompanyIds.has(cid) // solo si la empresa está verificada
            })
            setRecentAttempts(intentosVisibles.slice(0, 10))

            // Top strengths/improvements de los últimos 5 intentos
            const last5 = intentos.slice(0, 5)
            const allStrengths = last5.flatMap(i => i.strengths || [])
            const allImprovements = last5.flatMap(i => i.improvements || [])
            // Contar frecuencia y tomar los más repetidos
            const countMap = (arr) => {
              const map = {}
              arr.forEach(s => { map[s] = (map[s] || 0) + 1 })
              return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k]) => k)
            }
            setTopStrengths(countMap(allStrengths).slice(0, 4))
            setTopImprovements(countMap(allImprovements).slice(0, 4))

            // Datos para el gráfico de área (últimos 20 intentos, orden cronológico)
            const last20 = intentos.slice(0, 20).reverse()
            setChartData(last20.map((i, idx) => ({
              n: idx + 1,
              score: i.puntaje_similitud || 0,
              fecha: new Date(i.fecha_hora).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
              diff: i.imagenes_ia?.image_diff || null,
              company_id: i.imagenes_ia?.company_id || null,
              is_ranked: i.is_ranked !== false, // default true si no está seteado
              elo_delta: i.elo_delta ?? null,
            })))

            // Nombres de empresas para el tooltip del gráfico
            const chartCids = [...new Set(last20.map(i => i.imagenes_ia?.company_id).filter(Boolean))]
            if (chartCids.length > 0) {
              const { data: cos } = await supabase.from('usuarios').select('id_usuario, company_name, nombre_display').in('id_usuario', chartCids)
              const map = {}
              cos?.forEach(c => { map[c.id_usuario] = c.company_name || c.nombre_display || 'Empresa' })
              setChartCompanyNames(map)
            }

            // Heatmap: contar intentos por día (últimos 365 días)
            const map = {}
            intentos.forEach(i => {
              const d = new Date(i.fecha_hora)
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
              map[key] = (map[key] || 0) + 1
            })
            setHeatmapData(map)

            if (ownProfile) {
              await supabase.from('usuarios').update({
                total_intentos: total, promedio_score: promedio, mejor_score: mejor,
                peor_score: peor, porcentaje_aprobacion: porcentajeAprobacion, racha_actual: racha,
              }).eq('id_usuario', idToLoad)

              // Recalcular ELO retroactivo si no tiene o tiene el default 1000
              if (!prof.elo_rating || prof.elo_rating === 1000) {
                try {
                  // Ordenar intentos cronológicamente (más viejo primero)
                  const chronological = [...intentos].reverse()
                  let eloActual = 1000
                  const updates = []

                  chronological.forEach((intento, idx) => {
                    const diff = intento.imagenes_ia?.image_diff || 'Medium'
                    const { newElo, delta } = calculateElo({
                      userElo: eloActual,
                      totalAttempts: idx,
                      score: intento.puntaje_similitud || 0,
                      difficulty: diff,
                      timing: {},
                    })
                    updates.push({ id: intento.id_intento, delta })
                    eloActual = newElo
                  })

                  // Guardar ELO final
                  await supabase.from('usuarios').update({ elo_rating: eloActual }).eq('id_usuario', idToLoad)

                  // Actualizar elo_delta en cada intento (en batch de 10)
                  for (let i = 0; i < updates.length; i += 10) {
                    const batch = updates.slice(i, i + 10)
                    await Promise.all(batch.map(u =>
                      supabase.from('intentos').update({ elo_delta: u.delta }).eq('id_intento', u.id)
                    ))
                  }
                } catch {
                  // ELO retroactivo failed silently
                }
              }
            }
          } else {
            setStats({
              totalIntentos: prof.total_intentos || 0,
              promedioScore: prof.promedio_score || 0,
              mejorScore: prof.mejor_score || 0,
              peorScore: prof.peor_score || 0,
              intentosHoy: 0, intentosEstaSemana: 0,
              porcentajeAprobacion: prof.porcentaje_aprobacion || 0,
              racha: prof.racha_actual || 0,
              avgTime: null,
            })
          }
        } else {
          // Cargar intentos públicos — calcular todo igual que perfil propio
          const { data: publicIntentos } = await supabase
            .from('intentos')
            .select('puntaje_similitud, fecha_hora, prompt_usuario, strengths, improvements, elo_delta, is_ranked, id_imagen, imagenes_ia(url_image, image_diff, company_id)')
            .eq('id_usuario', idToLoad)
            .order('fecha_hora', { ascending: false })
            .limit(365)

          if (publicIntentos && publicIntentos.length > 0) {
            const total = publicIntentos.length
            const scores = publicIntentos.map(i => i.puntaje_similitud || 0)
            const promedio = Math.round(scores.reduce((s, v) => s + v, 0) / total)
            const mejor = Math.max(...scores)
            const peor = Math.min(...scores)
            const aprobados = publicIntentos.filter(i => (i.puntaje_similitud || 0) >= 60).length
            const porcentajeAprobacion = Math.round((aprobados / total) * 100)

            const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
            const intentosHoy = publicIntentos.filter(i => new Date(i.fecha_hora) >= hoy).length
            const inicioSemana = new Date()
            inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
            inicioSemana.setHours(0, 0, 0, 0)
            const intentosEstaSemana = publicIntentos.filter(i => new Date(i.fecha_hora) >= inicioSemana).length

            let racha = 0
            const fechasUnicas = [...new Set(publicIntentos.map(i => {
              const d = new Date(i.fecha_hora)
              return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            }))]
            const hoyStr = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`
            if (fechasUnicas.includes(hoyStr)) {
              racha = 1
              for (let i = 1; i < 365; i++) {
                const dia = new Date(hoy); dia.setDate(dia.getDate() - i)
                const diaStr = `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}`
                if (fechasUnicas.includes(diaStr)) racha++; else break
              }
            }

            setStats({
              totalIntentos: prof.total_intentos || total,
              promedioScore: promedio,
              mejorScore: mejor,
              peorScore: peor,
              intentosHoy,
              intentosEstaSemana,
              porcentajeAprobacion,
              racha,
              avgTime: null,
            })

            // Filtrar del historial los intentos de desafíos de empresas no verificadas
            const pubCompanyIds = [...new Set(publicIntentos.map(i => i.imagenes_ia?.company_id).filter(Boolean))]
            let pubVerifiedIds = new Set()
            if (pubCompanyIds.length > 0) {
              const { data: verifiedCos } = await supabase
                .from('usuarios')
                .select('id_usuario')
                .in('id_usuario', pubCompanyIds)
                .eq('verified', true)
              verifiedCos?.forEach(c => pubVerifiedIds.add(c.id_usuario))
            }
            const pubVisibles = publicIntentos.filter(i => {
              const cid = i.imagenes_ia?.company_id
              if (!cid) return true
              return pubVerifiedIds.has(cid)
            })
            setRecentAttempts(pubVisibles.slice(0, 10))

            // Top strengths/improvements de los últimos 5
            const last5 = publicIntentos.slice(0, 5)
            const allStrengths = last5.flatMap(i => i.strengths || [])
            const allImprovements = last5.flatMap(i => i.improvements || [])
            const countMap = (arr) => {
              const map = {}
              arr.forEach(s => { map[s] = (map[s] || 0) + 1 })
              return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k]) => k)
            }
            setTopStrengths(countMap(allStrengths).slice(0, 4))
            setTopImprovements(countMap(allImprovements).slice(0, 4))

            // Gráfico de evolución (últimos 20, orden cronológico)
            const last20 = publicIntentos.slice(0, 20).reverse()
            setChartData(last20.map((i, idx) => ({
              n: idx + 1,
              score: i.puntaje_similitud || 0,
              fecha: new Date(i.fecha_hora).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
              diff: i.imagenes_ia?.image_diff || null,
              company_id: i.imagenes_ia?.company_id || null,
              is_ranked: i.is_ranked !== false,
            })))

            // Nombres de empresas para el tooltip del gráfico
            const chartCids = [...new Set(last20.map(i => i.imagenes_ia?.company_id).filter(Boolean))]
            if (chartCids.length > 0) {
              const { data: cos } = await supabase.from('usuarios').select('id_usuario, company_name, nombre_display').in('id_usuario', chartCids)
              const map = {}
              cos?.forEach(c => { map[c.id_usuario] = c.company_name || c.nombre_display || 'Empresa' })
              setChartCompanyNames(map)
            }

            // Heatmap (todos los intentos del año)
            const map = {}
            publicIntentos.forEach(i => {
              const d = new Date(i.fecha_hora)
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
              map[key] = (map[key] || 0) + 1
            })
            setHeatmapData(map)
          } else {
            // Sin intentos — usar datos cacheados de la BD
            setStats({
              totalIntentos: prof.total_intentos || 0,
              promedioScore: prof.promedio_score || 0,
              mejorScore: prof.mejor_score || 0,
              peorScore: prof.peor_score || 0,
              intentosHoy: 0, intentosEstaSemana: 0,
              porcentajeAprobacion: prof.porcentaje_aprobacion || 0,
              racha: prof.racha_actual || 0,
              avgTime: null,
            })
          }
        }
      } catch {
        // fetchData error — silently handled
      } finally {
        setLoadingData(false)   
      }
    }

      fetchData()

      // Check if top 1
      const checkTop1 = async () => {
        const { data } = await supabase
          .from('usuarios')
          .select('id_usuario')
          .eq('adminstate', false)
          .gt('total_intentos', 0)
          .order('promedio_score', { ascending: false })
          .limit(1)
          .maybeSingle()
        setIsTop1(data?.id_usuario === idToLoad)
      }
      checkTop1()
    }

    run()
}, [authLoading, user?.id, targetId, targetUsername, isAdmin])
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert(lang === 'en' ? 'Image must be under 2MB' : 'La imagen debe ser menor a 2MB')
      return
    }

    // Preview inmediato mientras se analiza
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setCheckingNsfw(true)

    try {
      const { safe, reason } = await checkImageSafe(file)
      if (!safe) {
        setAvatarPreview(null)
        setAvatarFile(null)
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
        alert(lang === 'en'
          ? `This image was rejected: inappropriate content detected.`
          : `Esta imagen fue rechazada: se detectó contenido inapropiado.`)
        return
      }
      setAvatarFile(file)
    } catch {
      // Si falla la detección, aceptar igual
      setAvatarFile(file)
    } finally {
      setCheckingNsfw(false)
    }
  }

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return null
    setUploadingAvatar(true)
    try {
      await supabase.storage.createBucket('avatars', { public: true }).catch(() => {})
      const ext = avatarFile.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      alert('Error al subir imagen: ' + err.message)
      return null
    } finally {
      setUploadingAvatar(false)
    }
  }

  const uploadBanner = async () => {
    if (!bannerFile || !user) return null
    setUploadingBanner(true)
    try {
      await supabase.storage.createBucket('avatars', { public: true }).catch(() => {})
      const ext = bannerFile.name.split('.').pop()
      const path = `${user.id}/banner.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bannerFile, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      alert('Error al subir banner: ' + err.message)
      return null
    } finally {
      setUploadingBanner(false)
    }
  }

  const uploadShowcase = async () => {
    if (!showcaseFile || !user) return null
    setUploadingShowcase(true)
    try {
      await supabase.storage.createBucket('avatars', { public: true }).catch(() => {})
      const ext = showcaseFile.name.split('.').pop()
      const path = `${user.id}/showcase.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, showcaseFile, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      alert('Error al subir imagen: ' + err.message)
      return null
    } finally {
      setUploadingShowcase(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const updates = {}
      if (editedProfile.nombre_display !== undefined) updates.nombre_display = editedProfile.nombre_display
      if (editedProfile.company_name !== undefined) {
        updates.company_name = editedProfile.company_name
        if (editedProfile.nombre_display === undefined) {
          updates.nombre_display = editedProfile.company_name
        }
      }
      // Username — solo si cambió y pasaron 7 días
      if (editedProfile.username !== undefined && editedProfile.username !== profile?.username) {
        const lastChanged = profile?.username_last_changed ? new Date(profile.username_last_changed) : null
        const daysSince = lastChanged ? Math.floor((Date.now() - lastChanged.getTime()) / 86400000) : 999
        if (daysSince >= 7) {
          // Verificar que no esté tomado
          const { data: existing } = await supabase
            .from('usuarios')
            .select('id_usuario')
            .ilike('username', editedProfile.username)
            .neq('id_usuario', user.id)
            .maybeSingle()
          if (existing) {
            alert(lang === 'en' ? 'Username already taken.' : 'Ese username ya está en uso.')
            setSaving(false)
            return
          }
          updates.username = editedProfile.username
          updates.username_last_changed = nowAR()
        }
      }
      updates.email_publico = editedProfile.email_publico ?? profile?.email_publico ?? true
      updates.show_company_badge = editedProfile.show_company_badge ?? profile?.show_company_badge ?? true
      if (editedProfile.show_stats !== undefined) updates.show_stats = editedProfile.show_stats
      if (editedProfile.pais !== undefined) updates.pais = editedProfile.pais
      if (editedProfile.idioma_display !== undefined) updates.idioma_display = editedProfile.idioma_display
      if (editedProfile.social_github !== undefined) updates.social_github = editedProfile.social_github
      if (editedProfile.social_linkedin !== undefined) updates.social_linkedin = editedProfile.social_linkedin
      if (editedProfile.social_twitter !== undefined) updates.social_twitter = editedProfile.social_twitter
      if (editedProfile.social_website !== undefined) updates.social_website = editedProfile.social_website
      if (editedProfile.pronouns !== undefined) updates.pronouns = editedProfile.pronouns
      if (editedProfile.status !== undefined) updates.status = editedProfile.status
      if (editedProfile.organization !== undefined) updates.organization = editedProfile.organization
      if (editedProfile.company_tagline !== undefined) updates.company_tagline = editedProfile.company_tagline
      if (editedProfile.company_industry !== undefined) updates.company_industry = editedProfile.company_industry
      if (editedProfile.company_size !== undefined) updates.company_size = editedProfile.company_size
      if (editedProfile.company_founded !== undefined) updates.company_founded = editedProfile.company_founded

      if (avatarFile) {
        const url = await uploadAvatar()
        if (url) updates.avatar_url = url + '?t=' + Date.now()
      } else if (editedProfile.avatar_url !== undefined) {
        updates.avatar_url = editedProfile.avatar_url
      }

      if (bannerFile) {
        const url = await uploadBanner()
        if (url) updates.banner_url = url + '?t=' + Date.now()
      }

      if (showcaseFile) {
        const url = await uploadShowcase()
        if (url) updates.showcase_url = url + '?t=' + Date.now()
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('usuarios').update(updates).eq('id_usuario', user.id)
        if (error) throw error

        const metaUpdates = {}
        if (updates.nombre_display) metaUpdates.nombre = updates.nombre_display
        if (updates.avatar_url) metaUpdates.avatar_url = updates.avatar_url
        if (Object.keys(metaUpdates).length > 0) {
          await supabase.auth.updateUser({ data: metaUpdates })
        }

        setProfile(p => ({ ...p, ...updates }))
      }

      setAvatarFile(null)
      setAvatarPreview(null)
      setBannerFile(null)
      setBannerPreview(null)
      setShowcaseFile(null)
      setEditingProfile(false)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveBio = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('usuarios').update({ bio: editedBio }).eq('id_usuario', user.id)
      if (error) throw error
      setProfile(p => ({ ...p, bio: editedBio }))
      setEditingBio(false)
    } catch (err) {
      alert('Error al guardar bio: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveStats = async () => {
    setSaving(true)
    const idToLoad = targetId || user?.id
    try {
      const ns = {
        total_intentos: parseInt(editedStats.totalIntentos) || 0,
        promedio_score: parseInt(editedStats.promedioScore) || 0,
        mejor_score: parseInt(editedStats.mejorScore) || 0,
        peor_score: parseInt(editedStats.peorScore) || 0,
        porcentaje_aprobacion: parseInt(editedStats.porcentajeAprobacion) || 0,
        racha_actual: parseInt(editedStats.racha) || 0,
      }
      const { error } = await supabase.from('usuarios').update(ns).eq('id_usuario', idToLoad)
      if (error) throw error
      setStats(s => ({ ...s, totalIntentos: ns.total_intentos, promedioScore: ns.promedio_score, mejorScore: ns.mejor_score, peorScore: ns.peor_score, porcentajeAprobacion: ns.porcentaje_aprobacion, racha: ns.racha_actual }))
      setEditingStats(false)
    } catch (err) {
      alert('Error al guardar stats: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const fetchEnterpriseRequests = async () => {
    if (!profile?.id_usuario || profile?.user_type !== 'enterprise') return
    setEnterpriseLoadingRequests(true)
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('id, user_email, user_id, status, message, created_at')
        .eq('company_id', profile.id_usuario)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEnterpriseRequests(data || [])
    } catch {
      setEnterpriseRequests([])
    } finally {
      setEnterpriseLoadingRequests(false)
    }
  }

  const saveEnterpriseProfile = async () => {
    if (!user || !profile) return
    setEnterpriseSavingProfile(true)
    try {
      const updates = {
        company_name: enterpriseProfileValues.companyName,
        bio: enterpriseProfileValues.description,
        social_website: enterpriseProfileValues.website,
        email_publico: enterpriseProfileValues.publicProfile,
      }
      const { error } = await supabase.from('usuarios').update(updates).eq('id_usuario', profile.id_usuario)
      if (error) throw error
      setProfile(p => ({ ...p, ...updates }))
      setEnterpriseActionStatus(lang === 'en' ? 'Profile saved' : 'Perfil guardado')
    } catch {
      setEnterpriseActionStatus(lang === 'en' ? 'Unable to save profile' : 'No se pudo guardar el perfil')
    } finally {
      setEnterpriseSavingProfile(false)
    }
  }

  const sendEnterpriseInvite = async (event) => {
    event.preventDefault()
    if (!profile?.id_usuario || !inviteEmail.trim()) {
      setEnterpriseActionStatus(lang === 'en' ? 'Enter an email.' : 'Ingresa un email.')
      return
    }
    setEnterpriseActionStatus(lang === 'en' ? 'Sending invitation...' : 'Enviando invitación...')
    try {
      const { error } = await supabase.from('team_invitations').insert([{
        company_id: profile.id_usuario,
        user_email: inviteEmail.trim(),
        status: 'pending',
        message: inviteMessage.trim(),
      }])
      if (error) throw error
      setInviteEmail('')
      setInviteMessage('')
      fetchEnterpriseRequests()
      setEnterpriseActionStatus(lang === 'en' ? 'Invitation sent.' : 'Invitación enviada.')
    } catch {
      setEnterpriseActionStatus(lang === 'en' ? 'Could not send invitation.' : 'No se pudo enviar la invitación.')
    }
  }

  const updateEnterpriseRequestStatus = async (request, status) => {
    if (!request?.id) return
    try {
      if (status === 'accepted') {
        const { error } = await supabase.rpc('accept_team_invitation', { invitation_id: request.id })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('team_invitations')
          .update({ status })
          .eq('id', request.id)
        if (error) throw error
      }
      setEnterpriseActionStatus(status === 'accepted'
        ? (lang === 'en' ? 'Request accepted.' : 'Solicitud aceptada.')
        : (lang === 'en' ? 'Request rejected.' : 'Solicitud rechazada.'))
      fetchEnterpriseRequests()
    } catch {
      setEnterpriseActionStatus(lang === 'en' ? 'Could not update request.' : 'No se pudo actualizar la solicitud.')
    }
  }

  // Verifica si el usuario ya tiene una solicitud pendiente o ya es miembro
  useEffect(() => {
    if (!user || !profile || profile.user_type !== 'enterprise' || ownProfile) return
    const checkExisting = async () => {
      // ¿Ya es miembro?
      const { data: me } = await supabase
        .from('usuarios')
        .select('company_id')
        .eq('id_usuario', user.id)
        .maybeSingle()
      if (me?.company_id === profile.id_usuario) {
        setJoinRequestStatus('member')
        return
      }
      // ¿Ya tiene solicitud pendiente o aceptada?
      const { data: existing } = await supabase
        .from('team_invitations')
        .select('id, status')
        .eq('company_id', profile.id_usuario)
        .eq('user_id', user.id)
        .in('status', ['requested', 'pending', 'accepted'])
        .maybeSingle()
      if (existing) {
        setJoinRequestStatus(existing.status === 'accepted' ? 'member' : 'already')
      }
    }
    checkExisting()
  }, [user?.id, profile?.id_usuario, ownProfile])

  const sendJoinRequest = async () => {
    if (!user || !profile) return
    setJoinRequestStatus('loading')
    try {
      const payload = {
        company_id: profile.id_usuario,
        user_id: user.id,
        user_email: user.email,
        status: 'requested',
        message: joinRequestMessage.trim(),
      }
      const { error } = await supabase.from('team_invitations').insert([payload])
      if (error) throw error
      setJoinRequestStatus('sent')
    } catch {
      setJoinRequestStatus('error')
    }
  }

  useEffect(() => {
    if (!profile || profile.user_type !== 'enterprise' || !ownProfile) return
    setEnterpriseProfileValues({
      companyName: profile.company_name || profile.nombre_display || '',
      description: profile.bio || '',
      website: profile.social_website || '',
      publicProfile: profile.email_publico ?? true,
    })
    fetchEnterpriseRequests()
  }, [profile, ownProfile])

  useEffect(() => {
    if (!profile || profile.user_type !== 'enterprise') {
      setEnterpriseMembers([])
      return
    }

    const canSeeMembers = ownProfile || profile.email_publico !== false
    if (!canSeeMembers) {
      setEnterpriseMembers([])
      return
    }

    const fetchEnterpriseMembers = async () => {
      setEnterpriseMembersLoading(true)
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id_usuario, nombre, nombre_display, username, avatar_url, elo_rating, total_intentos, promedio_score, porcentaje_aprobacion, company_role')
          .eq('company_id', profile.id_usuario)
          .order('elo_rating', { ascending: false })
          .limit(24)
        if (error) throw error
        setEnterpriseMembers(data || [])
      } catch {
        setEnterpriseMembers([])
      } finally {
        setEnterpriseMembersLoading(false)
      }
    }

    fetchEnterpriseMembers()
  }, [profile?.id_usuario, profile?.user_type, profile?.email_publico, ownProfile])

  const handleFollow = async () => {
    if (!user) return
    const idToLoad = targetId || (targetUsername ? profile?.id_usuario : user?.id)
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', user.id).eq('following_id', idToLoad)
        setIsFollowing(false)
        setFollowersCount(c => Math.max(0, c - 1))
      } else {
        await supabase.from('follows').insert([{ follower_id: user.id, following_id: idToLoad }])
        setIsFollowing(true)
        setFollowersCount(c => c + 1)
      }
    } catch {
      // follow/unfollow failed silently
    } finally {
      setFollowLoading(false)
    }
  }

  const copyProfileLink = () => {
    const base = window.location.origin
    const url = profile?.username
      ? `${base}/user/${profile.username}`
      : `${base}/perfil?id=${targetId || user?.id}`
    navigator.clipboard.writeText(url)
  }

  const getDisplayName = () => profile?.nombre_display || profile?.nombre || profile?.email?.split('@')[0] || 'Usuario'
  // Soporta tanto URLs completas como rutas guardadas en storage (ej: "user-id/avatar.jpg")
  const resolveProfileMediaUrl = (value) => {
    if (!value) return null
    const raw = String(value).trim()
    if (!raw) return null
    if (raw.startsWith('blob:')) return raw

    const [pathPart, query = ''] = raw.split('?')
    const cleanPathPart = pathPart.replace(/^\/+/, '')

    // Soporta:
    // - user-id/avatar.jpg
    // - avatars/user-id/avatar.jpg
    // - /storage/v1/object/public/avatars/user-id/avatar.jpg
    // - https://.../storage/v1/object/public/avatars/user-id/avatar.jpg?token=...
    let objectPath = cleanPathPart
    const storageMatch = cleanPathPart.match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/(.+)$/)
      || cleanPathPart.match(/^storage\/v1\/object\/(?:public|sign)\/avatars\/(.+)$/)
    if (storageMatch?.[1]) {
      objectPath = storageMatch[1]
    }
    objectPath = objectPath.replace(/^avatars\//, '')

    // Si quedó una URL externa no-Supabase, pasarla por el proxy para evitar bloqueos institucionales.
    if ((raw.startsWith('http://') || raw.startsWith('https://')) && !storageMatch) return proxyImg(raw)

    const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath)
    return query ? `${data.publicUrl}?${query}` : data.publicUrl
  }

  // Solo usar el avatar del perfil cargado — nunca el del usuario logueado
  const getAvatar = () => resolveProfileMediaUrl(profile?.avatar_url)
  const bannerUrl = resolveProfileMediaUrl(profile?.banner_url)
  const showcaseUrl = resolveProfileMediaUrl(profile?.showcase_url)
  const getScoreColor = (s) => s >= 70 ? 'text-emerald-600' : s >= 50 ? 'text-amber-500' : 'text-rose-500'
  const getScoreBg = (s) => s >= 70 ? 'bg-emerald-50 border-emerald-200' : s >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
  const formatDate = (d) => new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ownProfile is already computed above near the top of the component
  const canEdit = ownProfile && !!user
  const isEnterpriseProfile = ownProfile && profile?.user_type === 'enterprise'
  const enterpriseIncoming = enterpriseRequests.filter(r => r.status === 'requested')
  const enterprisePending = enterpriseRequests.filter(r => r.status === 'pending')

  // ── Social icon ──
  const SocialIcon = ({ type, className = 'h-4 w-4' }) => {
    const paths = {
      github: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
      linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
      twitter: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
      web: null,
    }
    if (type === 'web') return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    )
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d={paths[type]} />
      </svg>
    )
  }

  // ── Bio collapsible ──
  const BioCollapsible = ({ bio }) => {
    const [expanded, setExpanded] = useState(false)
    const isLong = bio.length > 300
    return (
      <div>
        <div className={`prose prose-sm prose-slate max-w-none text-slate-700 overflow-hidden transition-all duration-300 ${!expanded && isLong ? 'max-h-24 [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{bio}</ReactMarkdown>
        </div>
        {isLong && (
          <button onClick={() => setExpanded(e => !e)}
            className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition">
            {expanded ? t('readLess') : t('readMore')}
          </button>
        )}
      </div>
    )
  }

  // ── Medals section ──
  const MedalsSection = ({ userId }) => {
    const [medals, setMedals] = useState([])

    useEffect(() => {
      if (!userId) return
      const fetchMedals = async () => {
        try {
          const { data, error } = await supabase
            .from('usuario_medallas')
            .select('fecha_obtenida, medallas(nombre, descripcion, icono_url, color)')
            .eq('id_usuario', userId)
            .order('fecha_obtenida', { ascending: false })
          if (!error) setMedals(data || [])
          // Si la tabla no existe (404) simplemente no mostramos nada
        } catch { /* tabla no existe aún */ }
      }
      fetchMedals()
    }, [userId])

    if (medals.length === 0) return null

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          {lang === 'en' ? 'Medals' : 'Medallas'}
        </p>
        <div className="flex flex-wrap gap-2">
          {medals.map((m, i) => {
            const medal = m.medallas
            if (!medal) return null
            return (
              <div
                key={i}
                title={`${medal.nombre}${medal.descripcion ? ` — ${medal.descripcion}` : ''}`}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold cursor-default transition hover:scale-105"
                style={{ borderColor: medal.color + '40', backgroundColor: medal.color + '15', color: medal.color }}
              >
                {medal.icono_url ? (
                  <img src={medal.icono_url} alt={medal.nombre} className="h-4 w-4 object-contain" />
                ) : (
                  <span>★</span>
                )}
                {medal.nombre}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderEnterpriseProfile = () => {
    if (!profile) return null

    const displayName = profile.company_name || profile.nombre_display || getDisplayName()
    const isPublicProfile = profile?.email_publico !== false
    const accentHex = chartColor || '#6366f1'
    const accentLight = accentHex + '18'
    const accentMid = accentHex + '40'

    // Industrias disponibles
    const INDUSTRIES = lang === 'en'
      ? ['Technology', 'Education', 'Finance', 'Healthcare', 'Marketing', 'Design', 'Consulting', 'Other']
      : ['Tecnología', 'Educación', 'Finanzas', 'Salud', 'Marketing', 'Diseño', 'Consultoría', 'Otro']
    const SIZES = lang === 'en'
      ? ['1-10', '11-50', '51-200', '201-500', '500+']
      : ['1-10', '11-50', '51-200', '201-500', '500+']

    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 py-8">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div
                  className="h-56 w-full bg-slate-200"
                  style={{
                    background: bannerUrl
                      ? `url(${bannerUrl}) center/cover no-repeat`
                      : `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}99 50%, ${accentHex}cc 100%)`,
                  }}
                >
                  {/* Overlay gradiente para legibilidad */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/70 transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {lang === 'en' ? 'Banner' : 'Banner'}
                    </button>
                  )}
                </div>
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) openCropper(f, 'banner') }}
                />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files[0]; if (f) openCropper(f, 'avatar')
                }} />

                <div className="px-6 pb-8 pt-24">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="h-36 w-36 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-lg"
                        style={{ boxShadow: `0 0 0 4px white, 0 0 0 6px ${chartColor}40` }}>
                        {(avatarPreview || getAvatar()) ? (
                          <img src={avatarPreview || getAvatar()} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-5xl font-bold text-slate-400">
                            {displayName?.substring(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {editingProfile && canEdit && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md text-slate-800 hover:bg-slate-100 transition border border-slate-200"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-900">{displayName}</h2>
                        {profile?.username && (
                          <span className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500">@{profile.username}</span>
                        )}
                        {profile?.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white" title={lang === 'en' ? 'Verified company' : 'Empresa verificada'}>
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor"><path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/></svg>
                            {lang === 'en' ? 'Verified' : 'Verificada'}
                          </span>
                        )}
                        {canEdit && !editingProfile && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProfile(true)
                              setEditedProfile({
                                company_name: profile?.company_name || profile?.nombre_display || '',
                                nombre_display: profile?.nombre_display || profile?.company_name || '',
                                email_publico: profile?.email_publico ?? true,
                                pais: profile?.pais || '',
                                idioma_display: profile?.idioma_display || '',
                                social_github: profile?.social_github || '',
                                social_linkedin: profile?.social_linkedin || '',
                                social_twitter: profile?.social_twitter || '',
                                social_website: profile?.social_website || '',
                                pronouns: profile?.pronouns || '',
                                status: profile?.status || '',
                                organization: profile?.organization || '',
                                bio: profile?.bio || '',
                              })
                            }}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            {lang === 'en' ? 'Edit profile' : 'Editar perfil'}
                          </button>
                        )}
                      </div>
                      {canEdit && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {CHART_COLORS.map(({ hex, name }) => (
                            <button
                              key={hex}
                              type="button"
                              title={name}
                              onClick={() => handleChartColorChange(hex)}
                              className="h-5 w-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                              style={{
                                backgroundColor: hex,
                                boxShadow: chartColor === hex ? `0 0 0 2px white, 0 0 0 3.5px ${hex}` : 'none',
                                transform: chartColor === hex ? 'scale(1.15)' : undefined,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {profile?.status && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-slate-500">
                          {profile.status === 'open' ? (lang === 'en' ? 'Open to collab' : 'Abierto a colaborar') : profile.status === 'learning' ? (lang === 'en' ? 'Learning' : 'Aprendiendo') : profile.status === 'busy' ? (lang === 'en' ? 'Busy' : 'Ocupado') : profile.status === 'lurking' ? (lang === 'en' ? 'Just lurking' : 'Solo mirando') : profile.status}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {editingProfile ? (
                      <div className="space-y-5">
                        {/* Identidad */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Identity' : 'Identidad'}</p>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Company Name' : 'Nombre de la Empresa'}</label>
                            <input
                              type="text"
                              value={editedProfile.company_name ?? profile.company_name ?? ''}
                              onChange={e => setEditedProfile(p => ({ ...p, company_name: e.target.value }))}
                              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Tagline' : 'Eslogan'}</label>
                            <input
                              type="text"
                              value={editedProfile.company_tagline ?? profile.company_tagline ?? ''}
                              onChange={e => setEditedProfile(p => ({ ...p, company_tagline: e.target.value }))}
                              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                              placeholder={lang === 'en' ? 'Short catchy phrase...' : 'Frase corta y memorable...'}
                              maxLength={80}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Description' : 'Descripción'}</label>
                            <textarea
                              value={editedProfile.bio ?? profile.bio ?? ''}
                              onChange={e => setEditedProfile(p => ({ ...p, bio: e.target.value }))}
                              rows={4}
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm resize-none"
                              placeholder={lang === 'en' ? 'Tell users about your company.' : 'Contá a los usuarios sobre tu empresa.'}
                            />
                          </div>
                        </div>

                        {/* Detalles */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Details' : 'Detalles'}</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Industry' : 'Industria'}</label>
                              <select
                                value={editedProfile.company_industry ?? profile.company_industry ?? ''}
                                onChange={e => setEditedProfile(p => ({ ...p, company_industry: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
                              >
                                <option value="">{lang === 'en' ? 'Select...' : 'Seleccionar...'}</option>
                                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Team size' : 'Tamaño'}</label>
                              <select
                                value={editedProfile.company_size ?? profile.company_size ?? ''}
                                onChange={e => setEditedProfile(p => ({ ...p, company_size: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
                              >
                                <option value="">{lang === 'en' ? 'Select...' : 'Seleccionar...'}</option>
                                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Founded' : 'Fundada'}</label>
                              <input
                                type="text"
                                value={editedProfile.company_founded ?? profile.company_founded ?? ''}
                                onChange={e => setEditedProfile(p => ({ ...p, company_founded: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                                placeholder="2020"
                                maxLength={4}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Country' : 'País'}</label>
                            <input
                              type="text"
                              value={editedProfile.pais ?? profile.pais ?? ''}
                              onChange={e => setEditedProfile(p => ({ ...p, pais: e.target.value }))}
                              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                              placeholder={lang === 'en' ? 'e.g. Argentina' : 'ej. Argentina'}
                            />
                          </div>
                        </div>

                        {/* Links */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Links</p>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-2">{lang === 'en' ? 'Website' : 'Sitio web'}</label>
                            <input
                              type="url"
                              value={editedProfile.social_website ?? profile.social_website ?? ''}
                              onChange={e => setEditedProfile(p => ({ ...p, social_website: e.target.value }))}
                              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                              placeholder="https://empresa.com"
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="block text-sm font-medium text-slate-900 mb-2">LinkedIn</label>
                              <input
                                type="text"
                                value={editedProfile.social_linkedin ?? profile.social_linkedin ?? ''}
                                onChange={e => setEditedProfile(p => ({ ...p, social_linkedin: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                                placeholder="linkedin.com/company/..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-900 mb-2">GitHub</label>
                              <input
                                type="text"
                                value={editedProfile.social_github ?? profile.social_github ?? ''}
                                onChange={e => setEditedProfile(p => ({ ...p, social_github: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                                placeholder="github.com/org"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-900 mb-2">X / Twitter</label>
                              <input
                                type="text"
                                value={editedProfile.social_twitter ?? profile.social_twitter ?? ''}
                                onChange={e => setEditedProfile(p => ({ ...p, social_twitter: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm"
                                placeholder="@empresa"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Apariencia */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Appearance' : 'Apariencia'}</p>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-1">{lang === 'en' ? 'Brand color' : 'Color de marca'}</label>
                            <p className="text-xs text-slate-400 mb-3">{lang === 'en' ? 'Used for banner gradient, badges and accents.' : 'Se usa en el gradiente del banner, badges y acentos.'}</p>
                            <div className="flex flex-wrap gap-2">
                              {CHART_COLORS.map(({ hex, name }) => (
                                <button
                                  key={hex}
                                  type="button"
                                  title={name}
                                  onClick={() => handleChartColorChange(hex)}
                                  className="h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                                  style={{
                                    backgroundColor: hex,
                                    boxShadow: chartColor === hex ? `0 0 0 2px white, 0 0 0 4px ${hex}` : 'none',
                                    transform: chartColor === hex ? 'scale(1.2)' : undefined,
                                  }}
                                />
                              ))}
                            </div>
                            {/* Preview del banner */}
                            <div
                              className="mt-3 h-12 w-full rounded-xl"
                              style={{ background: `linear-gradient(135deg, ${accentHex}55 0%, ${accentHex}99 50%, ${accentHex}cc 100%)` }}
                            />
                            <p className="mt-1 text-[11px] text-slate-400">{lang === 'en' ? 'Banner preview (without custom image)' : 'Preview del banner (sin imagen personalizada)'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-900 mb-1">{lang === 'en' ? 'Banner image' : 'Imagen de banner'}</label>
                            <p className="text-xs text-slate-400 mb-2">{lang === 'en' ? 'Overrides the color gradient.' : 'Reemplaza el gradiente de color.'}</p>
                            <button
                              type="button"
                              onClick={() => bannerInputRef.current?.click()}
                              className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {bannerPreview ? (lang === 'en' ? 'Change banner' : 'Cambiar banner') : (lang === 'en' ? 'Upload banner' : 'Subir banner')}
                            </button>
                          </div>
                        </div>

                        {/* Privacidad */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{lang === 'en' ? 'Privacy' : 'Privacidad'}</p>
                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(editedProfile.email_publico ?? profile.email_publico ?? true)}
                              onChange={(e) => setEditedProfile(p => ({ ...p, email_publico: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-violet-600"
                            />
                            <div>
                              <span className="text-sm font-medium text-slate-700">{lang === 'en' ? 'Public company profile' : 'Perfil de empresa público'}</span>
                              <p className="text-xs text-slate-400">{lang === 'en' ? 'Anyone can view your company page.' : 'Cualquiera puede ver tu página de empresa.'}</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(editedProfile.show_stats ?? profile.show_stats ?? true)}
                              onChange={(e) => setEditedProfile(p => ({ ...p, show_stats: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-violet-600"
                            />
                            <div>
                              <span className="text-sm font-medium text-slate-700">{lang === 'en' ? 'Show team statistics publicly' : 'Mostrar estadísticas del equipo públicamente'}</span>
                              <p className="text-xs text-slate-400">{lang === 'en' ? 'Members count, avg ELO and scores.' : 'Cantidad de miembros, ELO promedio y scores.'}</p>
                            </div>
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            onClick={saveProfile}
                            disabled={saving || uploadingAvatar || uploadingBanner || checkingNsfw}
                            className="rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition disabled:opacity-60"
                          >
                            {saving ? (lang === 'en' ? 'Saving...' : 'Guardando...') : (lang === 'en' ? 'Save Profile' : 'Guardar Perfil')}
                          </button>
                          <button
                            onClick={() => {
                              setEditingProfile(false)
                              setAvatarFile(null)
                              setAvatarPreview(null)
                              setBannerFile(null)
                              setBannerPreview(null)
                            }}
                            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            {lang === 'en' ? 'Cancel' : 'Cancelar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Tagline */}
                        {profile?.company_tagline && (
                          <p className="text-base font-medium italic" style={{ color: accentHex }}>
                            "{profile.company_tagline}"
                          </p>
                        )}

                        {/* Meta chips: industria, tamaño, fundación, web */}
                        {(profile?.company_industry || profile?.company_size || profile?.company_founded || profile?.social_website || profile?.pais) && (
                          <div className="flex flex-wrap gap-2">
                            {profile?.company_industry && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                                style={{ borderColor: accentMid, backgroundColor: accentLight, color: accentHex }}>
                                🏢 {profile.company_industry}
                              </span>
                            )}
                            {profile?.company_size && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                👥 {profile.company_size} {lang === 'en' ? 'people' : 'personas'}
                              </span>
                            )}
                            {profile?.company_founded && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                📅 {lang === 'en' ? 'Est.' : 'Fundada'} {profile.company_founded}
                              </span>
                            )}
                            {profile?.pais && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                📍 {profile.pais}
                              </span>
                            )}
                            {profile?.social_website && (
                              <a href={profile.social_website} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-80"
                                style={{ borderColor: accentMid, backgroundColor: accentLight, color: accentHex }}>
                                🔗 {profile.social_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                              </a>
                            )}
                          </div>
                        )}

                        {/* Bio */}
                        {(ownProfile || isPublicProfile) && (
                          <div>
                            {profile?.bio ? (
                              <BioCollapsible bio={profile.bio} />
                            ) : (
                              <p className="text-sm italic text-slate-400">{lang === 'en' ? 'No description yet.' : 'Aún no hay descripción.'}</p>
                            )}
                          </div>
                        )}

                        {/* Redes sociales */}
                        {(profile?.social_github || profile?.social_linkedin || profile?.social_twitter) && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              { val: profile?.social_github, type: 'github', label: 'GitHub', href: `https://github.com/${profile?.social_github?.replace(/.*github\.com\//, '')}` },
                              { val: profile?.social_linkedin, type: 'linkedin', label: 'LinkedIn', href: profile?.social_linkedin },
                              { val: profile?.social_twitter, type: 'twitter', label: 'X', href: `https://x.com/${profile?.social_twitter?.replace(/.*x\.com\//, '')}` },
                            ].filter(s => s.val).map(({ type, label, href }) => (
                              <a key={type} href={href} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                                <SocialIcon type={type} className="h-3.5 w-3.5" />
                                {label}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Miembros afiliados */}
                        {(ownProfile || isPublicProfile) && (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              {lang === 'en' ? 'Affiliated users' : 'Usuarios afiliados'}
                            </h3>
                            {enterpriseMembersLoading ? (
                              <p className="text-xs text-slate-500">{lang === 'en' ? 'Loading users...' : 'Cargando usuarios...'}</p>
                            ) : enterpriseMembers.length > 0 ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {enterpriseMembers.map((member) => {
                                  const memberName = member.nombre_display || member.nombre || member.username || 'Usuario'
                                  const memberHref = member.username ? `/user/${member.username}` : `/perfil?id=${member.id_usuario}`
                                  return (
                                    <a key={member.id_usuario} href={memberHref}
                                      className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition">
                                      <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                                        {member.avatar_url ? (
                                          <img src={proxyImg(member.avatar_url)} alt={memberName} className="h-full w-full object-cover" />
                                        ) : (
                                          <span className="text-xs font-semibold text-slate-500">{memberName.substring(0, 2).toUpperCase()}</span>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{memberName}</p>
                                        <p className="truncate text-[11px] text-slate-400">
                                          {member.company_role && <span className="font-medium mr-1" style={{ color: accentHex }}>{member.company_role}</span>}
                                          ELO {member.elo_rating ?? 1000} · {member.total_intentos ?? 0} {lang === 'en' ? 'attempts' : 'intentos'}
                                        </p>
                                      </div>
                                    </a>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">{lang === 'en' ? 'No affiliated users yet.' : 'Aún no hay usuarios afiliados.'}</p>
                            )}
                          </div>
                        )}

                        {/* Estadísticas del equipo */}
                        {(ownProfile || isPublicProfile) && profile?.show_stats !== false && enterpriseMembers.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              {lang === 'en' ? 'Team Stats' : 'Estadísticas del Equipo'}
                            </h3>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              {[
                                { label: lang === 'en' ? 'Members' : 'Miembros', value: enterpriseMembers.length },
                                { label: lang === 'en' ? 'Avg ELO' : 'ELO Prom.', value: Math.round(enterpriseMembers.reduce((s, m) => s + (m.elo_rating || 1000), 0) / enterpriseMembers.length) },
                                { label: lang === 'en' ? 'Avg Score' : 'Score Prom.', value: (() => { const w = enterpriseMembers.filter(m => m.promedio_score); return w.length ? Math.round(w.reduce((s, m) => s + m.promedio_score, 0) / w.length) : '—' })() },
                                { label: lang === 'en' ? 'Attempts' : 'Intentos', value: enterpriseMembers.reduce((s, m) => s + (m.total_intentos || 0), 0) },
                              ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: accentLight, border: `1px solid ${accentMid}` }}>
                                  <p className="text-xl font-bold" style={{ color: accentHex }}>{value}</p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pedir unirse */}
                        {!ownProfile && user && (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                              {lang === 'en' ? 'Join this company' : 'Unirse a esta empresa'}
                            </h3>
                            {joinRequestStatus === 'member' ? (
                              <p className="text-sm text-emerald-600 font-medium">✓ {lang === 'en' ? 'You are already a member.' : 'Ya eres miembro.'}</p>
                            ) : joinRequestStatus === 'already' ? (
                              <p className="text-sm text-amber-600 font-medium">⏳ {lang === 'en' ? 'Request pending review.' : 'Solicitud pendiente de revisión.'}</p>
                            ) : joinRequestStatus === 'sent' ? (
                              <p className="text-sm text-emerald-600 font-medium">✓ {lang === 'en' ? 'Request sent!' : 'Solicitud enviada.'}</p>
                            ) : (
                              <div className="space-y-3">
                                <textarea
                                  value={joinRequestMessage}
                                  onChange={e => setJoinRequestMessage(e.target.value)}
                                  rows={2}
                                  placeholder={lang === 'en' ? 'Optional message...' : 'Mensaje opcional...'}
                                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
                                  style={{ '--tw-ring-color': accentHex }}
                                />
                                <button
                                  onClick={sendJoinRequest}
                                  disabled={joinRequestStatus === 'loading'}
                                  className="rounded-full px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                                  style={{ backgroundColor: accentHex }}
                                >
                                  {joinRequestStatus === 'loading' ? (lang === 'en' ? 'Sending...' : 'Enviando...') : (lang === 'en' ? 'Request to join' : 'Pedir unirse')}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {!ownProfile && !user && (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {lang === 'en' ? 'Sign in to request to join this company.' : 'Iniciá sesión para pedir unirte a esta empresa.'}
                            </p>
                          </div>
                        )}

                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditingProfile(true)
                              setEditedProfile({
                                company_name: profile?.company_name || profile?.nombre_display || '',
                                nombre_display: profile?.nombre_display || profile?.company_name || '',
                                email_publico: profile?.email_publico ?? true,
                                pais: profile?.pais || '',
                                idioma_display: profile?.idioma_display || '',
                                social_github: profile?.social_github || '',
                                social_linkedin: profile?.social_linkedin || '',
                                social_twitter: profile?.social_twitter || '',
                                social_website: profile?.social_website || '',
                                pronouns: profile?.pronouns || '',
                                status: profile?.status || '',
                                organization: profile?.organization || '',
                                bio: profile?.bio || '',
                                company_tagline: profile?.company_tagline || '',
                                company_industry: profile?.company_industry || '',
                                company_size: profile?.company_size || '',
                                company_founded: profile?.company_founded || '',
                              })
                            }}
                            className="rounded-full border border-slate-300 dark:border-slate-600 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                          >
                            {lang === 'en' ? 'Edit profile' : 'Editar perfil'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </div>
        </main>
        <Footer />

        {cropperSrc && (
          <ImageCropper
            src={cropperSrc}
            aspect={cropperAspect}
            shape={cropperShape}
            onCrop={(blob) => handleCropDone(blob)}
            onCancel={() => { setCropperSrc(null); setCropperType(null) }}
          />
        )}
      </div>
    )
  }

  // ── Heatmap component ──
  const ActivityHeatmap = ({ data, allAttempts, isOwn, color = '#6366f1' }) => {
    const { t, lang } = useLang()
    const scrollRef = useRef(null)
    const [tooltip, setTooltip] = useState(null)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days = []
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      days.push({ date: d, key, count: data[key] || 0 })
    }

    // Scroll al final al montar
    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
      }
    }, [])

    const firstDay = days[0].date.getDay()
    const paddedDays = [...Array(firstDay).fill(null), ...days]
    const weeks = []
    for (let i = 0; i < paddedDays.length; i += 7) weeks.push(paddedDays.slice(i, i + 7))

    // Genera 4 tonos del color base: 40%, 60%, 80%, 100% opacidad
    const heatLevels = [
      color + '66', // ~40%
      color + '99', // ~60%
      color + 'cc', // ~80%
      color,        // 100%
    ]

    const getStyle = (count) => {
      if (count === 0) return { backgroundColor: 'var(--heatmap-empty)' }
      if (count === 1) return { backgroundColor: heatLevels[0] }
      if (count === 2) return { backgroundColor: heatLevels[1] }
      if (count <= 4) return { backgroundColor: heatLevels[2] }
      return { backgroundColor: heatLevels[3] }
    }

    const totalYear = days.reduce((s, d) => s + d.count, 0)

    const monthLabels = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const firstReal = week.find(d => d !== null)
      if (firstReal) {
        const m = firstReal.date.getMonth()
        if (m !== lastMonth) {
          monthLabels.push({ wi, label: firstReal.date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'short' }) })
          lastMonth = m
        }
      }
    })

    const dayLabels = lang === 'en'
      ? ['Sun', '', 'Tue', '', 'Thu', '', 'Sat']
      : ['Dom', '', 'Mar', '', 'Jue', '', 'Sáb']

    const legendColors = ['var(--heatmap-empty)', ...heatLevels]

    // Intentos agrupados por día para el tooltip
    const attemptsByDay = {}
    if (allAttempts) {
      allAttempts.forEach(a => {
        const d = new Date(a.fecha_hora)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        if (!attemptsByDay[key]) attemptsByDay[key] = []
        attemptsByDay[key].push(a)
      })
    }

    const getScoreColor = (s) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444'

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 relative">
        <style>{`
          html.dark .heatmap-wrap { --heatmap-empty: #334155; }
          html:not(.dark) .heatmap-wrap { --heatmap-empty: #e2e8f0; }
        `}</style>
        <div className="heatmap-wrap">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">
              {totalYear} {totalYear === 1 ? t('attempt') : t('attempts')} {t('activityLastYear')}
            </p>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>{lang === 'en' ? 'Less' : 'Menos'}</span>
              {legendColors.map((c, i) => (
                <div key={i} style={{ backgroundColor: c, width: 11, height: 11, borderRadius: 3 }} />
              ))}
              <span>{lang === 'en' ? 'More' : 'Más'}</span>
            </div>
          </div>

          <div ref={scrollRef} className="overflow-x-auto">
            <div className="inline-flex gap-0.5">
              <div className="flex flex-col gap-0.5 mr-1">
                <div className="h-4" />
                {dayLabels.map((l, i) => (
                  <div key={i} className="h-3 w-6 text-[9px] text-slate-400 flex items-center">{l}</div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex gap-0.5 mb-1 h-4">
                  {weeks.map((_, wi) => {
                    const lbl = monthLabels.find(m => m.wi === wi)
                    return <div key={wi} className="w-3 text-[9px] text-slate-400 whitespace-nowrap">{lbl ? lbl.label : ''}</div>
                  })}
                </div>
                <div className="flex gap-0.5">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-0.5">
                      {week.map((day, di) => (
                        <div
                          key={di}
                          style={day ? getStyle(day.count) : { backgroundColor: 'transparent' }}
                          className="h-3 w-3 rounded-sm transition-colors cursor-pointer relative"
                          onMouseEnter={(e) => {
                            if (!day || day.count === 0) return
                            const rect = e.currentTarget.getBoundingClientRect()
                            setTooltip({
                              key: day.key,
                              count: day.count,
                              dayAttempts: attemptsByDay[day.key] || [],
                              x: rect.left,
                              y: rect.top,
                            })
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tooltip flotante */}
          {tooltip && (
            <div
              className="fixed z-[500] pointer-events-none"
              style={{
                left: Math.min(tooltip.x + 12, window.innerWidth - 180),
                top: tooltip.y > 120 ? tooltip.y - 80 : tooltip.y + 20,
              }}
            >
              <div className="rounded-xl border border-slate-200 bg-white shadow-xl px-3 py-2.5 min-w-[150px]">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{tooltip.key}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tooltip.count} {tooltip.count === 1 ? t('attempt') : t('attempts')}
                </p>
                {tooltip.dayAttempts.length > 0 && (
                  <p className="text-xs font-bold mt-1" style={{ color: getScoreColor(Math.round(tooltip.dayAttempts.reduce((s, a) => s + a.puntaje_similitud, 0) / tooltip.dayAttempts.length)) }}>
                    {lang === 'en' ? 'Avg' : 'Promedio'}: {Math.round(tooltip.dayAttempts.reduce((s, a) => s + a.puntaje_similitud, 0) / tooltip.dayAttempts.length)}%
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Panel expandido — eliminado, solo hover */}
        </div>
      </div>
    )
  }
  if (authLoading || loadingData) {
    return (
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Sidebar skeleton */}
            <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
              <div className="relative">
                <div className="h-32 w-full rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="absolute -bottom-12 left-4 h-28 w-28 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse ring-4 ring-white dark:ring-slate-950" />
              </div>
              <div className="pt-14 space-y-3">
                <div className="h-5 w-36 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-3.5 w-24 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-4/5 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-3/5 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            </aside>
            {/* Main skeleton */}
            <div className="flex-1 space-y-4">
              <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-2xl font-bold text-slate-800">{t('userNotFound')}</p>
          <a href="/" className="text-sm text-slate-500 hover:text-slate-800 underline">{t('backHome')}</a>
        </main>
      </div>
    )
  }

  if (profile?.user_type === 'enterprise') {
    return renderEnterpriseProfile()
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch">

          {/* Sidebar */}
          <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4">

            {/* Banner + Avatar */}
            <div className="relative">
              {/* Banner */}
              <div
                className="h-32 w-full rounded-2xl overflow-hidden"
                style={{
                    background: bannerUrl
                    ? `url(${bannerUrl}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${chartColor}33 0%, ${chartColor}66 100%)`,
                }}
              >
                {canEdit && editingProfile && (
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-2xl"
                  >
                    <span className="text-white text-xs font-semibold">
                      {lang === 'en' ? 'Change banner' : 'Cambiar banner'}
                    </span>
                  </button>
                )}
              </div>
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) openCropper(f, 'banner') }}
              />

              {/* Avatar — superpuesto al banner */}
              <div className="absolute -bottom-12 left-4">
                {profile?.devstate ? (
                  // Pentágono para devs
                  <div className="relative h-28 w-28">
                    <svg width="0" height="0" className="absolute">
                      <defs>
                        <clipPath id="pentagon-clip" clipPathUnits="objectBoundingBox">
                          <path d="M0.5,0.02 L0.98,0.36 L0.79,0.93 L0.21,0.93 L0.02,0.36 Z" />
                        </clipPath>
                      </defs>
                    </svg>
                    <div
                      className="h-28 w-28 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden"
                      style={{ clipPath: 'url(#pentagon-clip)' }}
                    >
                      {(avatarPreview || getAvatar()) ? (
                        <img src={avatarPreview || getAvatar()} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-4xl font-bold text-slate-400">{getDisplayName().substring(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    {/* Outline SVG superpuesto */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 80 80">
                      <path
                        d="M40,1.6 L78.4,28.8 L63.2,74.4 L16.8,74.4 L1.6,28.8 Z"
                        fill="none"
                        stroke={chartColor}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {editingProfile && canEdit && (
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                        style={{ clipPath: 'url(#pentagon-clip)' }}>
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  // Círculo normal
                  <div className={`h-28 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-4`}
                    style={{ '--tw-ring-color': chartColor, boxShadow: `0 0 0 4px ${chartColor}` }}>
                    {(avatarPreview || getAvatar()) ? (
                      <img src={avatarPreview || getAvatar()} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-4xl font-bold text-slate-400">
                        {getDisplayName().substring(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                {editingProfile && canEdit && !profile?.devstate && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Badges sobre el banner */}
              <div className="absolute top-2 right-2 flex gap-1.5">
                {profile?.adminstate && (
                  <span className="rounded-full backdrop-blur-sm px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: 'rgba(147,51,234,0.85)' }}>ADMIN</span>
                )}
                {profile?.devstate && (
                  <span className="rounded-full backdrop-blur-sm px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: chartColor + 'dd', color: 'white' }}>DEV</span>
                )}
                {isTop1 && (
                  <span className="rounded-full backdrop-blur-sm px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: chartColor + 'dd', color: 'white' }}>#1 Liga</span>
                )}
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files[0]; if (f) openCropper(f, 'avatar')
            }} />

            {/* Nombre + info — con margen para el avatar superpuesto */}
            <div className="pt-14 flex flex-col items-start gap-3">
              {editingProfile ? (
                <div className="w-full space-y-2">
                  <input type="text" placeholder={t('visibleName')}
                    value={editedProfile.nombre_display ?? getDisplayName()}
                    onChange={e => setEditedProfile(p => ({ ...p, nombre_display: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                  />
                  {/* Username — editable cada 7 días */}
                  {(() => {
                    const lastChanged = profile?.username_last_changed ? new Date(profile.username_last_changed) : null
                    const daysSince = lastChanged ? Math.floor((Date.now() - lastChanged.getTime()) / 86400000) : 999
                    const canChangeUsername = daysSince >= 7
                    const daysLeft = 7 - daysSince
                    return (
                      <div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">@</span>
                          <input
                            type="text"
                            placeholder="username"
                            disabled={!canChangeUsername}
                            value={editedProfile.username ?? profile?.username ?? ''}
                            onChange={e => {
                              const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
                              setEditedProfile(p => ({ ...p, username: val }))
                            }}
                            className={`w-full rounded-lg border pl-8 pr-3 py-2 text-sm ${
                              canChangeUsername
                                ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 cursor-not-allowed'
                            }`}
                          />
                        </div>
                        {!canChangeUsername && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            {lang === 'en'
                              ? `Username can be changed in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                              : `Podés cambiar el username en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text"
                      placeholder={lang === 'en' ? 'Pronouns' : 'Pronombres'}
                      maxLength={20}
                      value={editedProfile.pronouns ?? ''}
                      onChange={e => setEditedProfile(p => ({ ...p, pronouns: e.target.value }))}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                    />
                    <select
                      value={editedProfile.status ?? ''}
                      onChange={e => setEditedProfile(p => ({ ...p, status: e.target.value }))}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                    >
                      <option value="">{lang === 'en' ? 'Status...' : 'Estado...'}</option>
                      <option value="open">{lang === 'en' ? 'Open to collab' : 'Abierto a colaborar'}</option>
                      <option value="learning">{lang === 'en' ? 'Learning' : 'Aprendiendo'}</option>
                      <option value="busy">{lang === 'en' ? 'Busy' : 'Ocupado'}</option>
                      <option value="lurking">{lang === 'en' ? 'Just lurking' : 'Solo mirando'}</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={checkingNsfw}
                    className="w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    {checkingNsfw
                      ? (lang === 'en' ? 'Checking image...' : 'Verificando imagen...')
                      : avatarFile
                        ? `${t('fileSelected')} ${avatarFile.name}`
                        : t('uploadPhoto')
                    }
                  </button>
                  {uploadingAvatar && <p className="text-xs text-slate-400 text-center">{t('uploading')}</p>}
                  {uploadingBanner && <p className="text-xs text-slate-400 text-center">{lang === 'en' ? 'Uploading banner...' : 'Subiendo banner...'}</p>}

                  {/* Toggle email público */}
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {lang === 'en' ? 'Show email on profile' : 'Mostrar email en el perfil'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lang === 'en' ? 'Visible to other users' : 'Visible para otros usuarios'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditedProfile(p => ({ ...p, email_publico: !(p.email_publico ?? profile?.email_publico ?? true) }))}
                      className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                      style={{
                        backgroundColor: (editedProfile.email_publico ?? profile?.email_publico ?? true)
                          ? chartColor
                          : '#cbd5e1'
                      }}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        (editedProfile.email_publico ?? profile?.email_publico ?? true)
                          ? 'translate-x-4'
                          : 'translate-x-0'
                      }`} />
                    </button>
                  </label>

                  {/* Toggle badge de empresa */}
                  {userCompanyData && (
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {lang === 'en' ? 'Show company badge' : 'Mostrar badge de empresa'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {lang === 'en' ? 'Display your company membership on your profile' : 'Muestra tu membresía en tu perfil'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditedProfile(p => ({ ...p, show_company_badge: !(p.show_company_badge ?? profile?.show_company_badge ?? true) }))}
                        className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                        style={{
                          backgroundColor: (editedProfile.show_company_badge ?? profile?.show_company_badge ?? true)
                            ? chartColor
                            : '#cbd5e1'
                        }}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                          (editedProfile.show_company_badge ?? profile?.show_company_badge ?? true)
                            ? 'translate-x-4'
                            : 'translate-x-0'
                        }`} />
                      </button>
                    </label>
                  )}

                  {/* País */}
                  <input type="text"
                    placeholder={lang === 'en' ? 'Country / Location' : 'País / Ubicación'}
                    value={editedProfile.pais ?? ''}
                    onChange={e => setEditedProfile(p => ({ ...p, pais: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                  />

                  {/* Idioma */}
                  <input type="text"
                    placeholder={lang === 'en' ? 'Language (e.g. Spanish, English)' : 'Idioma (ej: Español, English)'}
                    value={editedProfile.idioma_display ?? ''}
                    onChange={e => setEditedProfile(p => ({ ...p, idioma_display: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                  />

                  {/* Organization */}
                  <input type="text"
                    placeholder={lang === 'en' ? 'Organization (company, school...)' : 'Organización (empresa, escuela...)'}
                    maxLength={60}
                    value={editedProfile.organization ?? ''}
                    onChange={e => setEditedProfile(p => ({ ...p, organization: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm"
                  />

                  {/* Redes sociales */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {lang === 'en' ? 'Social links' : 'Redes sociales'}
                    </p>
                    {[
                      { key: 'social_github',   placeholder: 'github.com/usuario',   icon: 'github' },
                      { key: 'social_linkedin', placeholder: 'linkedin.com/in/usuario', icon: 'linkedin' },
                      { key: 'social_twitter',  placeholder: 'x.com/usuario',        icon: 'twitter' },
                      { key: 'social_website',  placeholder: 'tusitio.com',           icon: 'web' },
                    ].map(({ key, placeholder, icon }) => (
                      <div key={key} className="flex items-center gap-2">
                        <SocialIcon type={icon} className="h-4 w-4 shrink-0 text-slate-400" />
                        <input type="text"
                          placeholder={placeholder}
                          value={editedProfile[key] ?? ''}
                          onChange={e => setEditedProfile(p => ({ ...p, [key]: e.target.value }))}
                          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveProfile} disabled={saving || uploadingAvatar || uploadingBanner || checkingNsfw}
                      className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                      {saving ? t('saving') : t('save')}
                    </button>
                    <button onClick={() => { setEditingProfile(false); setAvatarFile(null); setAvatarPreview(null); setBannerFile(null); setBannerPreview(null) }}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{getDisplayName()}</h1>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {profile?.username && (
                          <p className="text-sm text-slate-400 dark:text-slate-500">@{profile.username}</p>
                        )}
                        {profile?.pronouns && (
                          <span className="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">{profile.pronouns}</span>
                        )}
                      </div>
                      {profile?.status && (() => {
                        const statusMap = {
                          open:     { label: lang === 'en' ? 'Open to collab' : 'Abierto a colaborar' },
                          learning: { label: lang === 'en' ? 'Learning' : 'Aprendiendo' },
                          busy:     { label: lang === 'en' ? 'Busy' : 'Ocupado' },
                          lurking:  { label: lang === 'en' ? 'Just lurking' : 'Solo mirando' },
                        }
                        const s = statusMap[profile.status]
                        return s ? (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: chartColor + '50', color: chartColor }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chartColor }} />
                            {s.label}
                          </div>
                        ) : null
                      })()}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {(ownProfile || (profile?.email_publico !== false)) ? profile?.email : null}
                  </p>
                  {canEdit && (
                    <button onClick={() => { setEditingProfile(true); setEditedProfile({
                      email_publico: profile?.email_publico ?? true,
                      pais: profile?.pais || '',
                      idioma_display: profile?.idioma_display || '',
                      social_github: profile?.social_github || '',
                      social_linkedin: profile?.social_linkedin || '',
                      social_twitter: profile?.social_twitter || '',
                      social_website: profile?.social_website || '',
                      pronouns: profile?.pronouns || '',
                      status: profile?.status || '',
                      organization: profile?.organization || '',
                    }) }}
                      className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                      {t('editProfile')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bio */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              {editingBio ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bio</p>
                  <textarea rows={6} value={editedBio}
                    onChange={e => setEditedBio(e.target.value)}
                    placeholder={lang === 'en' ? 'Write your bio in Markdown...' : 'Escribe tu bio en Markdown...'}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveBio} disabled={saving}
                      className="flex-1 rounded-lg bg-slate-900 dark:bg-slate-100 dark:text-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:hover:bg-slate-200 disabled:opacity-50">
                      {saving ? t('saving') : t('save')}
                    </button>
                    <button onClick={() => setEditingBio(false)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {profile?.bio ? (
                    <BioCollapsible bio={profile.bio} />
                  ) : (
                    canEdit && <p className="text-sm text-slate-400 dark:text-slate-500 italic">{t('noBio')}</p>
                  )}
                  {canEdit && (
                    <button onClick={() => { setEditingBio(true); setEditedBio(profile?.bio || '') }}
                      className="mt-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline">
                      {profile?.bio ? t('editBio') : t('addBio')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0" style={{ color: chartColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{t('memberSince')} {new Date(profile?.fecha_registro).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' })}</span>
              </div>
              {profile?.organization && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" style={{ color: chartColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>{profile.organization}</span>
                </div>
              )}

              {/* Badge de empresa */}
              {userCompanyData && profile?.show_company_badge !== false && (() => {
                const companyName = userCompanyData.company_name || userCompanyData.nombre_display || 'Empresa'
                const joinedAt = profile?.company_joined_at
                const sinceText = joinedAt ? (() => {
                  const diff = Date.now() - new Date(joinedAt).getTime()
                  const days = Math.floor(diff / 86400000)
                  if (days < 30) return lang === 'en' ? `${days}d` : `${days}d`
                  const months = Math.floor(days / 30)
                  if (months < 12) return lang === 'en' ? `${months}mo` : `${months} mes${months > 1 ? 'es' : ''}`
                  const years = Math.floor(months / 12)
                  return lang === 'en' ? `${years}yr` : `${years} año${years > 1 ? 's' : ''}`
                })() : null
                const tooltipText = sinceText
                  ? (lang === 'en' ? `Member of ${companyName} · ${sinceText}` : `Miembro de ${companyName} · desde hace ${sinceText}`)
                  : (lang === 'en' ? `Member of ${companyName}` : `Miembro de ${companyName}`)
                // Colores derivados del chartColor del perfil
                const badgeBg = chartColor + '18'
                const badgeBorder = chartColor + '55'
                return (
                  <div className="flex items-center gap-2">
                    <a href={`/perfil?id=${userCompanyData.id_usuario}`} title={tooltipText}
                      className="group relative flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition w-fit hover:opacity-90"
                      style={{ backgroundColor: badgeBg, borderColor: badgeBorder, color: chartColor }}
                    >
                      <div className="h-5 w-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: chartColor + '30' }}>
                        {userCompanyData.avatar_url
                          ? <img src={proxyImg(userCompanyData.avatar_url)} alt={companyName} className="h-full w-full object-cover" />
                          : <span className="text-[9px] font-bold" style={{ color: chartColor }}>{companyName.substring(0,2).toUpperCase()}</span>
                        }
                      </div>
                      <span className="truncate max-w-[110px]">{companyName}</span>
                      {userCompanyData.verified && (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: chartColor }}>
                          <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.44 1.44l3.5 3.5a1 1 0 001.44 0l6.5-6.5a1 1 0 00-1.44-1.44z"/></svg>
                        </span>
                      )}
                      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
                        {tooltipText}
                      </span>
                    </a>
                    {/* Botón ocultar badge — solo en perfil propio */}
                    {canEdit && (
                      <button
                        onClick={async () => {
                          const newVal = false
                          await supabase.from('usuarios').update({ show_company_badge: newVal }).eq('id_usuario', user.id)
                          setProfile(p => ({ ...p, show_company_badge: newVal }))
                        }}
                        title={lang === 'en' ? 'Hide badge' : 'Ocultar badge'}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })()}
              {/* Mostrar badge oculto — solo en perfil propio */}
              {userCompanyData && profile?.show_company_badge === false && canEdit && (
                <button
                  onClick={async () => {
                    await supabase.from('usuarios').update({ show_company_badge: true }).eq('id_usuario', user.id)
                    setProfile(p => ({ ...p, show_company_badge: true }))
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition w-fit"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {lang === 'en' ? 'Show company badge' : 'Mostrar badge de empresa'}
                </button>
              )}

              {profile?.pais && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" style={{ color: chartColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{profile.pais}</span>
                </div>
              )}
              {profile?.idioma_display && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" style={{ color: chartColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <span>{profile.idioma_display}</span>
                </div>
              )}
              {stats.racha > 0 && (
                <div className="flex items-center gap-2">
                  <img src={flameLitGif} alt="racha" className="h-4 w-4 object-contain" style={{ filter: hexToFilter(chartColor) }} />
                  <span>{stats.racha} {stats.racha === 1 ? t('streakDay') : t('streak')}</span>
                </div>
              )}
            </div>

            {/* Social links */}
            {(profile?.social_github || profile?.social_linkedin || profile?.social_twitter || profile?.social_website) && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {[
                  { val: profile?.social_github,   type: 'github',   label: 'GitHub' },
                  { val: profile?.social_linkedin,  type: 'linkedin', label: 'LinkedIn' },
                  { val: profile?.social_twitter,   type: 'twitter',  label: 'X' },
                  { val: profile?.social_website,   type: 'web',      label: 'Website' },
                ].filter(s => s.val).map(({ val, type, label }) => {
                  const href = val.startsWith('http') ? val : `https://${val}`
                  return (
                    <a key={type} href={href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition">
                      <SocialIcon type={type} className="h-3.5 w-3.5" />
                      {label}
                    </a>
                  )
                })}
              </div>
            )}

            <button onClick={copyProfileLink}
              className="w-full rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-2">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {t('copyProfileLink')}
            </button>

            {/* Showcase image/gif */}
            {(showcaseUrl || canEdit) && (
              <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 flex-1 min-h-[200px]">
                {showcaseUrl ? (
                  <>
                    <img
                      src={proxyImg(showcaseUrl)}
                      alt="showcase"
                      className="w-full h-full object-cover"
                      style={{ minHeight: '200px' }}
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => document.getElementById('showcase-input').click()}
                        className="absolute bottom-2 right-2 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/70 transition"
                      >
                        {lang === 'en' ? 'Change' : 'Cambiar'}
                      </button>
                    )}
                  </>
                ) : canEdit ? (
                  <button
                    type="button"
                    onClick={() => document.getElementById('showcase-input').click()}
                    className="flex w-full h-full min-h-[200px] flex-col items-center justify-center gap-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                  >
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs">{lang === 'en' ? 'Add image or GIF' : 'Agregar imagen o GIF'}</span>
                  </button>
                ) : null}
                <input
                  id="showcase-input"
                  type="file"
                  accept="image/*,.gif"
                  className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) openCropper(f, 'showcase') }}
                />
                {uploadingShowcase && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* Contenido principal */}
          <div className="flex-1 min-w-0 space-y-5">
              <div className="space-y-5">
                {isEnterpriseProfile && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    {lang === 'en' ? 'Requests moved to dashboard' : 'Solicitudes movidas al dashboard'}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {lang === 'en'
                      ? 'Manage incoming requests, pending invitations and send new invites from your enterprise dashboard.'
                      : 'Gestiona solicitudes entrantes, invitaciones pendientes y nuevos envíos desde tu dashboard de empresa.'}
                  </p>
                  <a
                    href="/"
                    className="mt-4 inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
                  >
                    {lang === 'en' ? 'Go to dashboard' : 'Ir al dashboard'}
                  </a>
                </div>
                )}
                {/* Medallas */}
                <MedalsSection userId={profile?.id_usuario} />

                {/* Panel de comparación — solo en perfiles ajenos */}
            {!ownProfile && user && (
              <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
                <button
                  onClick={async () => {
                    if (!compareOpen && !compareWith) {
                      const own = await fetchCompareStats(user.id)
                      setCompareWith(own)
                    }
                    setCompareOpen(o => !o)
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition rounded-xl"
                >
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {lang === 'en' ? 'Compare stats' : 'Comparar estadísticas'}
                  </span>
                  <svg className={`h-4 w-4 text-slate-400 transition-transform ${compareOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {compareOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-4">
                    {/* Selector del segundo prompter */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 shrink-0">{lang === 'en' ? 'Compare with:' : 'Comparar con:'}</span>
                      {compareWith ? (
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 flex-1">
                          <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            {compareWith.avatar
                              ? <img src={proxyImg(compareWith.avatar)} alt="" className="h-full w-full object-cover" />
                              : <span className="text-xs font-bold text-slate-500">{compareWith.name.substring(0,2).toUpperCase()}</span>
                            }
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1 truncate">{compareWith.name}</span>
                          <button onClick={() => { setCompareWith(null); setCompareSearch('') }} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                        </div>
                      ) : (
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={compareSearch}
                            onChange={e => handleCompareSearch(e.target.value)}
                            placeholder={lang === 'en' ? 'Search prompter...' : 'Buscar prompter...'}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500"
                          />
                          {loadingCompare && <div className="absolute right-3 top-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />}
                          {compareResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                              {compareResults.map(u => (
                                <button key={u.id_usuario}
                                  onClick={async () => {
                                    const data = await fetchCompareStats(u.id_usuario)
                                    setCompareWith(data)
                                    setCompareSearch('')
                                    setCompareResults([])
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                  <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                    {u.avatar_url
                                      ? <img src={proxyImg(u.avatar_url)} alt="" className="h-full w-full object-cover" />
                                      : <span className="text-xs font-bold text-slate-500">{(u.nombre_display || u.nombre || 'U').substring(0,2).toUpperCase()}</span>
                                    }
                                  </div>
                                  <span className="truncate">{u.nombre_display || u.nombre || u.username}</span>
                                  {u.username && <span className="text-xs text-slate-400 ml-auto">@{u.username}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tabla de comparación */}
                    {compareWith && (() => {
                      const them = stats
                      const me = compareWith.stats
                      const rows = [
                        { label: lang === 'en' ? 'Average' : 'Promedio',    a: them.promedioScore,       b: me.promedioScore,       suffix: '%' },
                        { label: lang === 'en' ? 'Best' : 'Mejor',          a: them.mejorScore,          b: me.mejorScore,          suffix: '%' },
                        { label: lang === 'en' ? 'Approval' : 'Aprobación', a: them.porcentajeAprobacion,b: me.porcentajeAprobacion, suffix: '%' },
                        { label: lang === 'en' ? 'Attempts' : 'Intentos',   a: them.totalIntentos,       b: me.totalIntentos,       suffix: '' },
                        { label: lang === 'en' ? 'Streak' : 'Racha',        a: them.racha,               b: me.racha,               suffix: '' },
                      ]
                      return (
                        <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                          {/* Headers */}
                          <div className="grid grid-cols-[1fr_5rem_1fr] text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                            <span className="truncate">{profile?.nombre_display || profile?.nombre || '—'}</span>
                            <span className="text-center"></span>
                            <span className="text-right truncate">{compareWith.name}</span>
                          </div>
                          {rows.map(({ label, a, b, suffix }) => {
                            const max = Math.max(a, b, 1)
                            const aWins = a > b, bWins = b > a
                            return (
                              <div key={label} className="grid grid-cols-[1fr_5rem_1fr] items-center gap-2 px-4 py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                <div className="flex items-center gap-2 justify-end">
                                  <span className={`text-sm font-bold tabular-nums ${aWins ? '' : 'text-slate-400 dark:text-slate-500'}`} style={aWins ? { color: chartColor } : {}}>
                                    {a}{suffix}
                                  </span>
                                  <div className="h-1.5 w-20 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex justify-end">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${(a/max)*100}%`, backgroundColor: aWins ? chartColor : '#cbd5e1' }} />
                                  </div>
                                </div>
                                <p className="text-xs font-medium text-center text-slate-400 dark:text-slate-500">{label}</p>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-20 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${(b/max)*100}%`, backgroundColor: bWins ? chartColor : '#cbd5e1' }} />
                                  </div>
                                  <span className={`text-sm font-bold tabular-nums ${bWins ? '' : 'text-slate-400 dark:text-slate-500'}`} style={bWins ? { color: chartColor } : {}}>
                                    {b}{suffix}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Header stats */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full inline-block" style={{ backgroundColor: chartColor }} />
                Estadísticas
              </h2>
              {isAdmin && !profile?.devstate && !editingStats && (
                <button onClick={() => { setEditingStats(true); setEditedStats({ ...stats }) }}
                  className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition">
                  Editar stats
                </button>
              )}
              {isAdmin && !profile?.devstate && editingStats && (
                <div className="flex gap-2">
                  <button onClick={saveStats} disabled={saving}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {saving ? '...' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditingStats(false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* ELO Card */}
            {(() => {
              const elo = profile?.elo_rating ?? 1000
              const totalIntentos = stats.totalIntentos
              const isAwaiting = totalIntentos < 5

              if (isAwaiting) {
                return (
                  <div className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: chartColor + '40', backgroundColor: chartColor + '08' }}>
                    <div className="shrink-0 text-center min-w-[4rem]">
                      <p className="text-3xl font-bold tabular-nums" style={{ color: chartColor + '60' }}>
                        {totalIntentos}<span className="text-slate-300">/5</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">ELO</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-500">
                        {lang === 'en' ? 'Awaiting rank' : 'Esperando rango'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lang === 'en'
                          ? `${5 - totalIntentos} more attempt${5 - totalIntentos !== 1 ? 's' : ''} to unlock your ELO`
                          : `${5 - totalIntentos} intento${5 - totalIntentos !== 1 ? 's' : ''} más para desbloquear tu ELO`}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(totalIntentos / 5) * 100}%`, backgroundColor: chartColor + '80' }} />
                      </div>
                    </div>
                  </div>
                )
              }

              const rank = getRank(elo)
              const nextRank = getNextRank(elo)
              const progress = nextRank
                ? Math.round(((elo - rank.min) / (rank.max - rank.min)) * 100)
                : 100
              return (
                <div className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: chartColor + '40', backgroundColor: chartColor + '08' }}>
                  <div className="shrink-0 text-center">
                    <p className="text-3xl font-bold tabular-nums" style={{ color: chartColor }}>{elo}</p>
                    <p className="text-xs text-slate-400 mt-0.5">ELO</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: chartColor }}>
                        {lang === 'en' ? rank.nameEn : rank.name}
                      </span>
                      {nextRank && (
                        <span className="text-xs text-slate-400">
                          → {lang === 'en' ? nextRank.nameEn : nextRank.name} ({nextRank.min - elo} pts)
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progress}%`, backgroundColor: chartColor }} />
                    </div>
                    <div className="mt-2 flex gap-1">
                      {ELO_RANKS.map((r, i) => (
                        <div key={i} title={lang === 'en' ? r.nameEn : r.name}
                          className="h-1 flex-1 rounded-full transition-all"
                          style={{ backgroundColor: elo >= r.min ? chartColor : '#e2e8f0' }} />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Tarjetas principales con radial */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('average'), value: stats.promedioScore, suffix: '%', key: 'promedioScore', useScoreColor: true },
                { label: t('bestScore'), value: stats.mejorScore, suffix: '%', key: 'mejorScore', useScoreColor: true },
                { label: lang === 'en' ? 'Approval' : 'Aprobación', value: stats.porcentajeAprobacion, suffix: '%', key: 'porcentajeAprobacion', useScoreColor: false, hint: lang === 'en' ? '% of attempts with score ≥ 60%' : '% de intentos con score ≥ 60%' },
                { label: t('totalAttempts'), value: stats.totalIntentos, suffix: '', key: 'totalIntentos', useScoreColor: false },
              ].map(({ label, value, suffix, key, useScoreColor, hint }, cardIdx) => {
                const pct = Math.min(100, Math.max(0, key === 'totalIntentos'
                  ? Math.round((value / Math.max(stats.totalIntentos, 1)) * 100)
                  : value))
                const r = 32, cx = 40, cy = 40
                const circumference = 2 * Math.PI * r
                const filled = (pct / 100) * circumference
                const color = useScoreColor
                  ? (pct >= 70 ? chartColor : pct >= 40 ? '#f59e0b' : '#ef4444')
                  : chartColor

                return (
                  <div key={key}
                    className="stat-card-animate rounded-xl border border-slate-200 bg-white p-4 flex flex-col items-center gap-1"
                    style={{ animationDelay: `${cardIdx * 80}ms` }}>
                    <div className="self-start flex items-center gap-1">
                      <p className="text-xs font-medium text-slate-500">{label}</p>
                      {hint && (
                        <div className="relative group/hint">
                          <svg className="h-3 w-3 text-slate-400 shrink-0 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/hint:block z-10 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
                            {hint}
                          </div>
                        </div>
                      )}
                    </div>
                    {editingStats ? (
                      <input type="number" min="0" max={suffix === '%' ? 100 : undefined}
                        value={editedStats[key] ?? value}
                        onChange={e => setEditedStats(s => ({ ...s, [key]: e.target.value }))}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xl font-bold"
                      />
                    ) : (
                      <div className="relative" style={{ width: 80, height: 80 }}>
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
                          <circle
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={color}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${filled} ${circumference}`}
                            strokeDashoffset="0"
                            transform={`rotate(-90 ${cx} ${cy})`}
                            className="stat-circle"
                            style={{ animationDelay: `${cardIdx * 80 + 200}ms`, animationDuration: `${0.8 + pct * 0.005}s` }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-base font-bold text-slate-800">{value}{suffix}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Tarjetas de imágenes vencidas y prompts revelados */}
            {ownProfile && (stats.imagenesVencidas > 0 || stats.promptsRevelados > 0) && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {/* Imágenes vencidas */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{stats.imagenesVencidas}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 font-medium">
                      {lang === 'en' ? 'Images conquered' : 'Imágenes vencidas'}
                    </p>
                    <p className="text-[10px] text-emerald-500/70 dark:text-emerald-600 mt-0.5">
                      {lang === 'en' ? 'Score > 93%' : 'Score mayor a 93%'}
                    </p>
                  </div>
                </div>

                {/* Prompts revelados */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{stats.promptsRevelados}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                      {lang === 'en' ? 'Prompts revealed' : 'Prompts revelados'}
                    </p>
                    <p className="text-[10px] text-amber-500/70 dark:text-amber-600 mt-0.5">
                      {lang === 'en' ? 'After 4 attempts' : 'Después de 4 intentos'}
                    </p>
                  </div>
                </div>

                {/* Promedio de intentos por imagen */}
                {stats.avgAttemptsPerImage > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-700 dark:text-slate-200 tabular-nums">{stats.avgAttemptsPerImage}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {lang === 'en' ? 'Avg attempts/image' : 'Intentos promedio/imagen'}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {lang === 'en' ? 'Lower = more efficient' : 'Menor = más eficiente'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tiempo promedio de respuesta por dificultad */}
            {ownProfile && stats.avgTime != null && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-slate-500">
                    {lang === 'en' ? 'Avg response time' : 'Tiempo promedio de respuesta'}
                  </span>
                </div>
                <div className="flex gap-3">
                  {[
                    { key: 'Easy',   label: lang === 'en' ? 'Easy'   : 'Fácil',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { key: 'Medium', label: lang === 'en' ? 'Medium' : 'Medio',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
                    { key: 'Hard',   label: lang === 'en' ? 'Hard'   : 'Difícil', color: 'text-rose-600 bg-rose-50 border-rose-200' },
                  ].filter(d => stats.avgTime[d.key] !== undefined).map(({ key, label, color }) => {
                    const t = stats.avgTime[key]
                    const fmt = t >= 60 ? `${Math.floor(t / 60)}m ${t % 60}s` : `${t}s`
                    return (
                      <div key={key} className={`flex-1 rounded-lg border px-3 py-2 text-center ${color}`}>
                        <p className="text-xs font-medium opacity-70">{label}</p>
                        <p className="text-sm font-bold tabular-nums mt-0.5">{fmt}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stats secundarias en fila — eliminadas */}

            {/* Fortalezas y debilidades (últimos 5 intentos) */}
            {(topStrengths.length > 0 || topImprovements.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {topStrengths.length > 0 && (
                  <div className="rounded-xl border p-4" style={{ borderColor: chartColor + '40', backgroundColor: chartColor + '0d' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: chartColor }}>Puntos fuertes recientes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topStrengths.map((s, i) => (
                        <span key={i} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium" style={{ color: chartColor, boxShadow: `0 0 0 1px ${chartColor}40` }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {topImprovements.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2">A mejorar</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topImprovements.map((s, i) => (
                        <span key={i} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-rose-800 ring-1 ring-rose-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Gráfico de evolución */}
            {chartData.length > 1 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-slate-700">{t('scoreEvolution')}</p>
                  {ownProfile && (
                    <div className="flex items-center gap-1.5">
                      {CHART_COLORS.map(({ hex, name }) => (
                        <button
                          key={hex}
                          title={name}
                          onClick={() => handleChartColorChange(hex)}
                          className="h-5 w-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                          style={{
                            backgroundColor: hex,
                            boxShadow: chartColor === hex ? `0 0 0 2px white, 0 0 0 3.5px ${hex}` : 'none',
                            transform: chartColor === hex ? 'scale(1.15)' : undefined,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="chart-animate">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="n" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v, i) => chartData[i]?.fecha ?? ''} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload
                          const diffColor = d.diff === 'Hard' ? '#ef4444' : d.diff === 'Easy' ? '#10b981' : '#f59e0b'
                          const companyName = d.company_id ? chartCompanyNames[d.company_id] : null
                          return (
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs space-y-1 min-w-[110px]">
                              <p className="font-semibold text-slate-500">{d.fecha}</p>
                              <p className="text-base font-bold" style={{ color: chartColor }}>{d.score}%</p>
                              {d.diff && (
                                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: diffColor + '20', color: diffColor }}>
                                  {d.diff}
                                </span>
                              )}
                              {d.is_ranked === false && (
                                <p className="text-[10px] text-slate-400">
                                  {lang === 'en' ? 'Unranked' : 'Sin rankeo'}
                                </p>
                              )}
                              {d.elo_delta != null && (
                                <p className={`text-[11px] font-bold tabular-nums ${d.elo_delta >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                                  {d.elo_delta >= 0 ? '+' : ''}{d.elo_delta} ELO
                                </p>
                              )}
                              {companyName && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <span>🏢</span>{companyName}
                                </p>
                              )}
                            </div>
                          )
                        }}
                      />
                      <Area
                        type="monotone" dataKey="score"
                        stroke={chartColor} strokeWidth={2}
                        fill="url(#scoreGrad)" dot={{ r: 3, fill: chartColor, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={true}
                        animationDuration={1200}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Heatmap de actividad */}
            <ActivityHeatmap data={heatmapData} allAttempts={recentAttempts} isOwn={ownProfile} color={chartColor} />

            {/* Historial */}
            <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <span className="w-1 h-5 rounded-full inline-block" style={{ backgroundColor: chartColor }} />
                    {t('resolutionHistory')}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {ownProfile ? `${t('today')}: ${stats.intentosHoy} · ${t('thisWeek')}: ${stats.intentosEstaSemana}` : `${lang === 'en' ? 'Last 5' : 'Últimos 5'}`}
                  </span>
                </div>

                {recentAttempts.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[2fr_5rem_7rem_1.5rem] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <span>{ownProfile ? t('yourPrompt') : (lang === 'en' ? 'Attempt' : 'Intento')}</span>
                      <span className="text-center">{lang === 'en' ? 'Date' : 'Fecha'}</span>
                      <span className="text-right">{t('similarity')}</span>
                      <span />
                    </div>

                    {recentAttempts.slice(0, 5).map((attempt, i) => (
                      <div key={i}>
                        <button
                          onClick={() => setSelectedAttempt(selectedAttempt === i ? null : i)}
                          className="w-full grid grid-cols-[2fr_5rem_7rem_1.5rem] gap-2 items-center px-4 py-2.5 text-left transition border-b border-slate-100 last:border-0 bg-white hover:bg-slate-50"
                          style={selectedAttempt === i ? { backgroundColor: chartColor + '14' } : {}}
                        >
                          {ownProfile ? (
                            <p className="truncate text-sm text-slate-700">
                              {attempt.prompt_usuario === '[REVEALED]'
                                ? <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                    {lang === 'en' ? 'Revealed prompt' : 'Prompt revelado'}
                                  </span>
                                : attempt.puntaje_similitud >= 60
                                  ? <span className="italic text-slate-400">{lang === 'en' ? 'Prompt hidden (score ≥ 60%)' : 'Prompt oculto (score ≥ 60%)'}</span>
                                  : (attempt.prompt_usuario || '—')}
                            </p>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              {attempt.imagenes_ia?.url_image && (
                                <img src={proxyImg(attempt.imagenes_ia.url_image)} alt=""
                                  className="h-8 w-8 shrink-0 rounded-md object-cover border border-slate-200" />
                              )}
                              <span className="truncate text-sm text-slate-500">
                                {attempt.puntaje_similitud < 60 && attempt.prompt_usuario
                                  ? attempt.prompt_usuario
                                  : (attempt.imagenes_ia?.image_diff || '—')}
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-slate-400 whitespace-nowrap text-center">
                            {new Date(attempt.fecha_hora).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric' })}
                          </p>
                          {/* Score + diff + ELO */}
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1.5">
                              {attempt.imagenes_ia?.image_diff && (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 hidden sm:inline">
                                  {attempt.imagenes_ia.image_diff}
                                </span>
                              )}
                              <span className={`text-sm font-bold tabular-nums ${
                                attempt.puntaje_similitud >= 70 ? 'text-emerald-600' :
                                attempt.puntaje_similitud >= 50 ? 'text-amber-500' : 'text-rose-500'
                              }`}>
                                {attempt.puntaje_similitud}%
                              </span>
                            </div>
                            {attempt.elo_delta != null && (
                              <span className={`text-[10px] font-semibold tabular-nums ${attempt.elo_delta >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                                {attempt.elo_delta >= 0 ? '+' : ''}{attempt.elo_delta} ELO
                              </span>
                            )}
                            {attempt.is_ranked === false && (
                              <span className="text-[10px] text-slate-400">
                                {lang === 'en' ? 'Unranked' : 'Sin rankeo'}
                              </span>
                            )}
                          </div>
                          <svg className={`h-3.5 w-3.5 text-slate-300 transition-transform justify-self-center ${selectedAttempt === i ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Detalle expandido — compacto */}
                        {selectedAttempt === i && (
                          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-4">
                              {attempt.imagenes_ia?.url_image && (
                                <img src={proxyImg(attempt.imagenes_ia.url_image)} alt=""
                                  className="h-20 w-20 shrink-0 rounded-lg object-cover border border-slate-200" />
                              )}
                              <div className="flex-1 min-w-0 space-y-2">
                                {ownProfile ? (
                                  <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">{t('yourPrompt')}</p>
                                    {attempt.prompt_usuario === '[REVEALED]' ? (
                                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                                        <svg className="h-3.5 w-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                        <p className="text-xs text-amber-700">
                                          {lang === 'en' ? 'You revealed the original prompt after 4 attempts.' : 'Revelaste el prompt original después de 4 intentos.'}
                                        </p>
                                      </div>
                                    ) : attempt.puntaje_similitud >= 60 ? (
                                      <p className="text-xs italic text-slate-400 bg-white rounded-lg px-3 py-2 border border-slate-200">
                                        {lang === 'en' ? 'Prompt hidden — score ≥ 60% protects the answer.' : 'Prompt oculto — score ≥ 60% protege la respuesta.'}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-slate-700 bg-white rounded-lg px-3 py-2 border border-slate-200 max-h-24 overflow-y-auto">
                                        {attempt.prompt_usuario}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  attempt.puntaje_similitud < 60 && attempt.prompt_usuario ? (
                                    <div>
                                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">{lang === 'en' ? 'Their prompt' : 'Su prompt'}</p>
                                      <p className="text-xs text-slate-700 bg-white rounded-lg px-3 py-2 border border-slate-200 max-h-24 overflow-y-auto">
                                        {attempt.prompt_usuario}
                                      </p>
                                    </div>
                                  ) : null
                                )}
                                {/* Prompt original — never shown */}
                                {/* Improvements — visible para todos */}
                                {attempt.improvements?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">{t('improvements')}</p>
                                    <div className="flex flex-wrap gap-1">
                                      {attempt.improvements.slice(0, 3).map((imp, j) => (
                                        <span key={j} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700 ring-1 ring-rose-200">
                                          {imp}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="h-1.5 rounded-full bg-slate-200">
                                  <div className="h-full rounded-full" style={{ width: `${attempt.puntaje_similitud}%`, backgroundColor: attempt.puntaje_similitud >= 60 ? chartColor : '#ef4444' }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-slate-500 text-sm">{t('noAttempts')}</p>
                    {ownProfile && (
                      <a href="/" className="mt-3 inline-block rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                        {t('firstAttempt')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {cropperSrc && (
        <ImageCropper
          src={cropperSrc}
          aspect={cropperAspect}
          shape={cropperShape}
          onCrop={(blob) => handleCropDone(blob)}
          onCancel={() => { setCropperSrc(null); setCropperType(null) }}
        />
      )}
    </div>
  )
}

export default UsuarioApp
