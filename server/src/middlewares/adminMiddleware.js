import UsuarioRepository from '../repositories/usuarioRepository.js'

const usuarioRepo = new UsuarioRepository()

/**
 * Autorización de admin verificada CONTRA LA BASE DE DATOS.
 * Reemplaza al useAdmin del frontend, que confiaba en user_metadata
 * (editable por el propio usuario → escalable a admin por consola).
 * Debe montarse SIEMPRE después de authMiddleware.
 */
export async function adminMiddleware(req, res, next) {
    try {
        if (!req.usuario?.id) {
            return res.status(401).json({ message: 'No autenticado.' })
        }
        const esAdmin = await usuarioRepo.isAdminAsync(req.usuario.id)
        if (!esAdmin) {
            return res.status(403).json({ message: 'Requiere permisos de administrador.' })
        }
        req.usuario.isAdmin = true
        next()
    } catch (error) {
        next(error)
    }
}
