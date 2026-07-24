import { config } from '../config/env.js'
import { throwError } from '../helpers/httpError.js'

/**
 * Subida de archivos a Supabase Storage vía su API REST con la SERVICE_ROLE
 * key (server-side). Reemplaza los `supabase.storage.upload` del navegador y
 * elimina el `createBucket` del cliente (los buckets se crean una vez en infra).
 *
 * Validación server-side real: tipo por MAGIC BYTES (no por extensión ni por
 * el Content-Type que declare el cliente) y tamaño acotado.
 *
 * Pendiente (documentado en el informe): moderación NSFW server-side — el
 * nsfwjs del cliente era evadible; portarlo requiere tfjs en el server.
 */

const MAX_BYTES = 3 * 1024 * 1024 // 3MB
const TEXT_MAX_BYTES = 1 * 1024 * 1024 // 1MB para archivos de código/texto

// Extensiones aceptadas para desafíos de código/documento (espejo del frontend).
const CODE_EXTS = new Set(['js','jsx','ts','tsx','py','cs','java','cpp','c','cc','h','hpp','css','scss','html','xml','json','sql','sh','bash','rb','go','rs','php','swift','kt','vue','yaml','yml','toml','r','lua','dart','scala'])
const DOC_EXTS = new Set(['txt','md','csv','log'])

/** Detecta el tipo real por magic bytes. Solo formatos de imagen soportados. */
function detectImageType(buffer) {
    if (buffer.length < 12) return null
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { ext: 'jpg', mime: 'image/jpeg' }
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return { ext: 'png', mime: 'image/png' }
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { ext: 'webp', mime: 'image/webp' }
    }
    return null
}

export default class StorageService {
    constructor() {
        this.supabaseUrl = config.storage.supabaseUrl
        this.serviceRoleKey = config.storage.serviceRoleKey
    }

    _assertConfigurado = () => {
        if (!this.supabaseUrl || !this.serviceRoleKey) {
            throwError('El storage no está configurado (faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', 503)
        }
    }

    /**
     * Sube una imagen validada y devuelve su URL pública.
     * @param {Buffer} buffer - bytes crudos del archivo
     * @param {string} bucket - 'avatars' | 'enterprise-challenges'
     * @param {string} pathPrefix - carpeta (p. ej. el id del usuario)
     */
    subirImagenAsync = async (buffer, bucket, pathPrefix) => {
        this._assertConfigurado()
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) throwError('El archivo está vacío.', 400)
        if (buffer.length > MAX_BYTES) throwError('La imagen supera el tamaño máximo (3MB).', 413)

        const tipo = detectImageType(buffer)
        if (!tipo) throwError('Formato no soportado. Usá JPG, PNG o WebP.', 415)

        const path = `${pathPrefix}/${Date.now()}.${tipo.ext}`
        const response = await fetch(
            `${this.supabaseUrl}/storage/v1/object/${bucket}/${path}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.serviceRoleKey}`,
                    'Content-Type': tipo.mime,
                    'x-upsert': 'true',
                },
                body: buffer,
            }
        )

        if (!response.ok) {
            const detail = await response.json().catch(() => ({}))
            console.error('[storage] upload error:', response.status, detail)
            throwError('No se pudo subir la imagen.', 502)
        }

        return {
            path,
            public_url: `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
        }
    }

    /**
     * Sube un archivo de código/texto (desafíos que no son de imagen). Valida
     * por extensión (whitelist) y descarta binarios (bytes nulos). Se guarda con
     * Content-Type text/plain para que el juego lo lea como texto.
     * @param {Buffer} buffer - bytes crudos del archivo
     * @param {string} bucket - 'enterprise-challenges'
     * @param {string} pathPrefix - carpeta (el id del usuario)
     * @param {string} ext - extensión declarada por el cliente (validada acá)
     */
    subirArchivoAsync = async (buffer, bucket, pathPrefix, ext) => {
        this._assertConfigurado()
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) throwError('El archivo está vacío.', 400)
        if (buffer.length > TEXT_MAX_BYTES) throwError('El archivo supera el tamaño máximo (1MB).', 413)

        const cleanExt = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)
        if (!CODE_EXTS.has(cleanExt) && !DOC_EXTS.has(cleanExt)) {
            throwError('Extensión de archivo no soportada.', 415)
        }
        // Rechazar binarios: un archivo de texto real no tiene bytes nulos.
        if (buffer.subarray(0, 8192).includes(0x00)) {
            throwError('El archivo no parece ser texto plano.', 415)
        }

        const path = `${pathPrefix}/${Date.now()}.${cleanExt}`
        const response = await fetch(
            `${this.supabaseUrl}/storage/v1/object/${bucket}/${path}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.serviceRoleKey}`,
                    'Content-Type': 'text/plain; charset=utf-8',
                    'x-upsert': 'true',
                },
                body: buffer,
            }
        )

        if (!response.ok) {
            const detail = await response.json().catch(() => ({}))
            console.error('[storage] upload archivo error:', response.status, detail)
            throwError('No se pudo subir el archivo.', 502)
        }

        return {
            path,
            public_url: `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
        }
    }

    /**
     * Descarga una imagen del bucket y la devuelve validada (magic bytes,
     * tamaño). Usada por la generación de desafíos: el cliente sube primero
     * la imagen (subirImagenAsync) y acá se recupera para mandarla a Gemini —
     * así el request a la API nunca supera el límite de body de Vercel.
     * @returns {{ buffer: Buffer, mime: string }}
     */
    descargarImagenAsync = async (bucket, path) => {
        this._assertConfigurado()
        const response = await fetch(
            `${this.supabaseUrl}/storage/v1/object/${bucket}/${path}`,
            { headers: { Authorization: `Bearer ${this.serviceRoleKey}` } }
        )
        if (response.status === 404 || response.status === 400) throwError('La imagen no existe.', 404)
        if (!response.ok) {
            console.error('[storage] download error:', response.status)
            throwError('No se pudo recuperar la imagen.', 502)
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length === 0) throwError('La imagen está vacía.', 404)
        if (buffer.length > MAX_BYTES) throwError('La imagen supera el tamaño máximo (3MB).', 413)

        const tipo = detectImageType(buffer)
        if (!tipo) throwError('El archivo no es una imagen soportada (JPG, PNG o WebP).', 415)

        return { buffer, mime: tipo.mime }
    }
}
