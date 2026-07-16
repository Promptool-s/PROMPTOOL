/**
 * Contrato de datos de la tabla `plagiarism_flags` (esquema inferido del uso
 * real del frontend — validar contra Supabase antes del E2E).
 */
class PlagiarismFlag {
    id;
    id_usuario;
    id_imagen;
    prompt_snapshot;   // primeros 500 chars del prompt
    score;
    elapsed_seconds;
    reasons;           // jsonb: ['response_time:4s', 'text_similarity:91%', ...]
    severity;          // 'low' | 'medium' | 'high'
    created_at;
}

export default PlagiarismFlag;
