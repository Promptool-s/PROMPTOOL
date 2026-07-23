import { Router } from 'express'
import ImagenService from '../services/imagenService.js'
import { optionalAuthMiddleware } from '../middlewares/authMiddleware.js'
import { throwError } from '../helpers/httpError.js'
import { isValidPk, isValidUUID, clampInt } from '../helpers/validatorHelper.js'

const router = Router()
const svc = new ImagenService()

/**
 * GET /api/imagenes — feed público (sin prompt_original). Siempre excluye
 * desafíos de empresa (company_id no nulo).
 * Query: dificultad, random=true, daily=true (+before), excludeMastered=true
 * (requiere sesión — saca imágenes ya superadas por el usuario), exclude
 * (csv de ids), limit, offset.
 * Reemplaza los SELECT directos a `imagenes_ia` del frontend.
 */
router.get('', optionalAuthMiddleware, async (req, res) => {
    const { dificultad, random, exclude, daily, before, excludeMastered } = req.query
    const excludeIds = typeof exclude === 'string' && exclude.length
        ? exclude.split(',').map((s) => s.trim()).filter(Boolean)
        : []

    const data = await svc.listarAsync({
        dificultad: typeof dificultad === 'string' ? dificultad : null,
        excludeIds,
        random: random === 'true' || random === '1',
        daily: daily === 'true' || daily === '1',
        before: typeof before === 'string' ? before : null,
        excludeMasteredFor: (excludeMastered === 'true' || excludeMastered === '1') ? (req.usuario?.id ?? null) : null,
        limit: clampInt(req.query.limit, 1, 100, 20),
        offset: clampInt(req.query.offset, 0, 100_000, 0),
    })
    res.status(200).json(data)
})

/** GET /api/imagenes/dificultades — valores disponibles para el filtro. */
router.get('/dificultades', async (req, res) => {
    const data = await svc.getDificultadesAsync()
    res.status(200).json(data)
})

/** GET /api/imagenes/empresa/:companyId — challenges de una empresa (CompanyPanel). */
router.get('/empresa/:companyId', async (req, res) => {
    if (!isValidUUID(req.params.companyId)) throwError('El ID de empresa no es válido.', 400)
    const data = await svc.listByCompanyAsync(req.params.companyId, clampInt(req.query.limit, 1, 100, 50))
    res.status(200).json(data)
})

/**
 * GET /api/imagenes/:id — datos públicos de una imagen (SIN prompt_original).
 */
router.get('/:id', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de imagen no es válido.', 400)
    const data = await svc.getPublicaAsync(req.params.id)
    res.status(200).json(data)
})

/**
 * POST /api/imagenes/:id/revelar — revela prompt_original con gating server-side.
 * Requiere sesión y que el usuario ya tenga un intento sobre la imagen.
 */
router.post('/:id/revelar', optionalAuthMiddleware, async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de imagen no es válido.', 400)
    const data = await svc.revelarPromptAsync(req.params.id, req.usuario?.id ?? null)
    res.status(200).json(data)
})

/**
 * POST /api/imagenes/:id/revelar-demo — reveal para la demo de guests.
 * Sin sesión: el gating por conteo de intentos vive en el cliente. Restringido
 * al pool de la demo (Easy, sin empresa) para no reabrir el acceso a los prompts
 * protegidos.
 */
router.post('/:id/revelar-demo', async (req, res) => {
    if (!isValidPk(req.params.id)) throwError('El ID de imagen no es válido.', 400)
    const data = await svc.revelarDemoAsync(req.params.id)
    res.status(200).json(data)
})

export default router
