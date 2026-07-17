/**
 * Contrato de datos de la tabla `usuarios`.
 * Clase plana, sin lógica — documenta la forma de los datos.
 */
class Usuario {
    id_usuario;        // uuid (= auth.users.id)
    nombre;
    nombre_display;
    username;
    email;
    bio;
    avatar_url;
    accent_color;
    elo_rating;
    total_intentos;
    ranked_count;
    rank_anterior;
    promedio_score;
    mejor_score;
    porcentaje_aprobacion;
    racha_actual;
    adminstate;        // boolean — autorización server-side ÚNICAMENTE
    devstate;
    verified;
    suspension_status; // 'none' | 'warned' | 'suspended' | 'banned'
    suspension_reason;
    suspension_until;
    company_name;
    show_company_badge;
    user_onboarded;
}

export default Usuario
