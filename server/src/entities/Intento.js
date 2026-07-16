/**
 * Contrato de datos de la tabla `intentos`.
 */
class Intento {
    id_intento;
    id_usuario;          // uuid | null (guests)
    id_imagen;
    prompt_usuario;
    puntaje_similitud;   // score final 0-100 — calculado SOLO en el backend
    fecha_hora;
    strengths;           // jsonb []
    improvements;        // jsonb []
    modo;                // 'random' | 'daily' | 'challenge' | 'enterprise'
    is_ranked;
    elo_delta;
    tiempo_respuesta;    // segundos
    attempt_number;
    tiempo_asignado;
    eficiencia;
}

export default Intento
