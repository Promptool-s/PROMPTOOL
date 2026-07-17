/**
 * Contrato de datos de la tabla `imagenes_ia`.
 * ⚠️ prompt_original es LA RESPUESTA del juego: nunca debe salir del backend
 * hacia el cliente (salvo el flujo explícito de "revelar prompt").
 */
class ImagenIA {
    id_imagen;
    url_image;
    prompt_original;   // SECRETO de juego — solo uso interno del backend
    image_diff;        // 'Easy' | 'Medium' | 'Hard'
    theme;
    modo;
    eval_instructions;
    company_id;
}

export default ImagenIA
