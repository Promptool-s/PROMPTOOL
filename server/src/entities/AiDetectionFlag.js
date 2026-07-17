/**
 * Contrato de datos de la tabla `ai_detection_flags` (esquema inferido del uso
 * real del frontend — validar contra Supabase antes del E2E).
 */
class AiDetectionFlag {
    id;
    id_usuario;
    prompt_snapshot;   // primeros 500 chars del prompt
    score;
    elapsed_seconds;
    detections;        // jsonb: ['no_corrections', 'robotic_key_timing', ...]
    confidence;        // 0–1
    severity;          // 'low' | 'medium' | 'high'
    typing_report;     // jsonb: snapshot del reporte de tipeo del cliente
    focus_report;      // jsonb: snapshot del reporte de foco del cliente
    created_at;
}

export default AiDetectionFlag;
