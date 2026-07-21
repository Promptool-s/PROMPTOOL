import ImagenRepository from '../repositories/imagenRepository.js'
import IntentoRepository from '../repositories/intentoRepository.js'
import { throwError } from '../helpers/httpError.js'

export default class ImagenService {
    constructor() {
        this.repo = new ImagenRepository()
        this.intentoRepo = new IntentoRepository()
    }

    /**
     * Datos públicos de una imagen. Se quita prompt_original (la respuesta del
     * juego) y las instrucciones internas de evaluación antes de responder.
     * Nota para la migración de RLS: además de este endpoint, hay que REVOCAR
     * el SELECT de esas columnas para el rol anon/authenticated en Supabase,
     * porque hoy el frontend puede leerlas con la anon key.
     */
    getPublicaAsync = async (idImagen) => {
        const imagen = await this.repo.getByIdAsync(idImagen)
        if (!imagen) throwError('La imagen no existe.', 404)
        const { prompt_original, challenge_eval_instructions, ...publica } = imagen
        return publica
    }

    /**
     * Feed público de imágenes (sin prompt_original). Reemplaza los múltiples
     * SELECT directos a `imagenes_ia` del frontend (App.jsx). La selección
     * random/daily se decide en el servidor.
     */
    listarAsync = async (filtros) => await this.repo.listarAsync(filtros)

    getDificultadesAsync = async () => await this.repo.getDificultadesAsync()

    /**
     * Revela prompt_original con gating server-side. Reemplaza el SELECT directo
     * de la "respuesta" que hacía el cliente (App.jsx:932, :1236).
     *
     * Regla: solo se revela a un usuario autenticado que YA tiene al menos un
     * intento sobre esa imagen (ya "jugó"). Los guests hacen el gating de la demo
     * en el cliente y no acceden por este endpoint.
     * (Decisión abierta del plan: ajustar a "solo si aprobó" o "tras N intentos"
     * si se quiere una regla más estricta.)
     */
    revelarPromptAsync = async (idImagen, idUsuario) => {
        if (!idUsuario) throwError('Necesitás iniciar sesión para revelar el prompt.', 401)

        const imagen = await this.repo.getByIdAsync(idImagen)
        if (!imagen) throwError('La imagen no existe.', 404)

        const intentos = await this.intentoRepo.countByUsuarioImagenAsync(idUsuario, idImagen)
        if (intentos < 1) {
            throwError('Tenés que intentar esta imagen antes de ver el prompt.', 403)
        }

        return { id_imagen: imagen.id_imagen, prompt_original: imagen.prompt_original ?? '' }
    }
}
