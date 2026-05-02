/**
 * GUÍAS DE PROMPT ENGINEERING
 * Basadas en documentación oficial de:
 * - Google Cloud Vertex AI (Gemini)
 * - OpenAI GPT Best Practices
 * - Anthropic Claude Documentation
 * - Research papers y mejores prácticas de la industria
 * 
 * Fuentes:
 * - https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/introduction-prompt-design
 * - https://platform.openai.com/docs/guides/prompt-engineering
 * - https://docs.anthropic.com/claude/docs/prompt-engineering
 */

const GUIDE_LIBRARY = [
  {
    id: 'fundamentos-prompting',
    title: 'Fundamentos de Prompting: Qué es y cómo funciona',
    summary: 'Aprende los conceptos básicos de cómo comunicarte efectivamente con modelos de IA generativa.',
    accent: 'indigo',
    keywords: ['fundamento', 'basico', 'prompt', 'que es', 'introduccion', 'comenzar'],
    lesson: {
      title: 'Lección: Qué es un prompt y por qué importa',
      blocks: [
        {
          heading: 'Definición',
          body: 'Un prompt es una solicitud en lenguaje natural que envías a un modelo de IA para recibir una respuesta. Puede ser una pregunta, instrucción, contexto o ejemplo. La calidad del prompt determina directamente la calidad de la respuesta.',
        },
        {
          heading: 'Componentes de un prompt efectivo (según Google Cloud)',
          bullets: [
            'Tarea (requerido): Lo que quieres que el modelo haga',
            'Contexto (opcional): Información relevante para la tarea',
            'Ejemplos (opcional): Muestras del resultado esperado',
            'Formato (opcional): Estructura específica de la salida',
          ],
        },
        {
          heading: 'Por qué importa la claridad',
          body: 'Los modelos de IA no "adivinan" tu intención. Instrucciones vagas producen resultados vagas. Ser específico y claro aumenta significativamente la probabilidad de obtener el resultado deseado.',
        },
        {
          heading: 'Ejemplo práctico',
          body: '✗ Malo: "Dame una imagen"\n✓ Bueno: "Genera una imagen de un gato naranja durmiendo en un sofá gris, estilo fotografía realista, iluminación natural suave"',
        },
      ],
      takeaway: 'La especificidad es control. Cuanto más claro seas, mejor será el resultado.',
      quiz: {
        question: '¿Cuál es el componente REQUERIDO en todo prompt?',
        options: ['Contexto', 'Ejemplos', 'Tarea', 'Formato'],
        correctIndex: 2,
        explanation: 'La tarea es el único componente obligatorio: define qué quieres que el modelo haga.',
      },
    },
    steps: [
      'Define claramente QUÉ quieres (la tarea)',
      'Agrega contexto relevante si es necesario',
      'Especifica el formato de salida deseado',
      'Sé específico, no ambiguo',
      'Itera y mejora basándote en los resultados',
    ],
    drills: [
      'Convierte "hazme una imagen bonita" en un prompt específico con tarea, contexto y formato',
      'Identifica qué falta en este prompt: "Un perro" y mejóralo',
    ],
    checkpoints: [
      'Definí la tarea claramente',
      'Agregué contexto necesario',
      'Especifiqué el formato de salida',
    ],
  },

  {
    id: 'zero-shot-prompting',
    title: 'Zero-Shot Prompting: Instrucciones directas',
    summary: 'La técnica más simple: dar una instrucción clara sin ejemplos previos.',
    accent: 'cyan',
    keywords: ['zero shot', 'directo', 'simple', 'sin ejemplos', 'basico'],
    lesson: {
      title: 'Lección: Cuándo usar Zero-Shot',
      blocks: [
        {
          heading: 'Qué es Zero-Shot',
          body: 'Zero-shot prompting es dar una instrucción directa al modelo sin proporcionar ejemplos. El modelo se basa únicamente en su entrenamiento para responder.',
        },
        {
          heading: 'Cuándo usarlo',
          bullets: [
            'Tareas simples y directas',
            'Preguntas de conocimiento general',
            'Cuando no necesitas un formato específico',
            'Para exploración rápida de ideas',
          ],
        },
        {
          heading: 'Ejemplo real',
          body: 'Prompt: "¿Cuáles son los colores del arcoíris?"\nRespuesta: "Los colores del arcoíris son: rojo, naranja, amarillo, verde, azul, añil y violeta."',
        },
        {
          heading: 'Ventajas y limitaciones',
          body: 'Ventajas: Rápido, simple, no requiere preparación.\nLimitaciones: Puede carecer de precisión en tareas complejas o específicas.',
        },
      ],
      takeaway: 'Zero-shot es tu punto de partida. Si no funciona, escala a few-shot o chain-of-thought.',
      quiz: {
        question: '¿Cuándo es más apropiado usar zero-shot prompting?',
        options: [
          'Tareas complejas que requieren razonamiento paso a paso',
          'Cuando necesitas un formato muy específico',
          'Preguntas simples y directas',
          'Cuando quieres máxima precisión',
        ],
        correctIndex: 2,
        explanation: 'Zero-shot funciona mejor para tareas simples y directas que no requieren ejemplos.',
      },
    },
    steps: [
      'Identifica si tu tarea es simple y directa',
      'Escribe una instrucción clara y concisa',
      'Envía el prompt sin ejemplos',
      'Evalúa el resultado',
      'Si no es suficiente, considera few-shot',
    ],
    drills: [
      'Escribe 3 prompts zero-shot para: traducir texto, resumir un párrafo, generar un título',
      'Identifica cuál de estos requiere zero-shot vs few-shot',
    ],
    checkpoints: [
      'Escribí una instrucción clara',
      'Verifiqué que la tarea es simple',
      'Evalué si necesito escalar a few-shot',
    ],
  },

  {
    id: 'few-shot-prompting',
    title: 'Few-Shot Prompting: Enseñar con ejemplos',
    summary: 'Mejora la precisión mostrando al modelo ejemplos del resultado esperado.',
    accent: 'violet',
    keywords: ['few shot', 'ejemplos', 'muestras', 'formato', 'consistencia'],
    lesson: {
      title: 'Lección: El poder de los ejemplos',
      blocks: [
        {
          heading: 'Qué es Few-Shot',
          body: 'Few-shot prompting incluye 1-5 ejemplos en tu prompt para mostrar al modelo exactamente qué tipo de respuesta esperas. Es como "enseñar por demostración".',
        },
        {
          heading: 'Cuándo usarlo (según OpenAI)',
          bullets: [
            'Necesitas un formato específico',
            'Quieres consistencia en las respuestas',
            'La tarea requiere un estilo particular',
            'Zero-shot no dio buenos resultados',
          ],
        },
        {
          heading: 'Ejemplo real de Google Cloud',
          body: 'Prompt: "Clasifica como vino tinto o blanco:\\n\\nEjemplos:\\nNombre: Chardonnay\\nTipo: Vino blanco\\n\\nNombre: Cabernet\\nTipo: Vino tinto\\n\\nNombre: Riesling\\nTipo:"\\n\\nRespuesta: "Vino blanco"',
        },
        {
          heading: 'Regla de oro',
          body: '2-3 ejemplos suelen ser suficientes. Más ejemplos = más tokens = más costo. Encuentra el balance.',
        },
      ],
      takeaway: 'Los ejemplos son tu mejor herramienta para controlar el formato y estilo de la salida.',
      quiz: {
        question: '¿Cuántos ejemplos se recomiendan típicamente en few-shot?',
        options: ['1 ejemplo siempre', '2-3 ejemplos', '10+ ejemplos', 'Tantos como sea posible'],
        correctIndex: 1,
        explanation: '2-3 ejemplos suelen ser el punto óptimo entre efectividad y costo.',
      },
    },
    steps: [
      'Identifica el formato o estilo que necesitas',
      'Crea 2-3 ejemplos de entrada → salida',
      'Estructura: Ejemplos primero, luego tu consulta',
      'Asegúrate que los ejemplos sean consistentes',
      'Prueba y ajusta los ejemplos si es necesario',
    ],
    drills: [
      'Crea un prompt few-shot para clasificar emails como spam/no spam con 3 ejemplos',
      'Convierte un prompt zero-shot que falló en uno few-shot',
    ],
    checkpoints: [
      'Creé 2-3 ejemplos claros',
      'Los ejemplos son consistentes',
      'Estructuré: ejemplos → consulta',
    ],
  },

  {
    id: 'chain-of-thought',
    title: 'Chain of Thought: Razonamiento paso a paso',
    summary: 'Mejora el razonamiento pidiendo al modelo que piense en pasos lógicos.',
    accent: 'amber',
    keywords: ['chain of thought', 'cot', 'paso a paso', 'razonamiento', 'logica', 'pensar'],
    lesson: {
      title: 'Lección: Cómo funciona el razonamiento paso a paso',
      blocks: [
        {
          heading: 'Qué es Chain of Thought (CoT)',
          body: 'CoT es una técnica donde pides explícitamente al modelo que muestre su razonamiento paso a paso antes de dar la respuesta final. Esto mejora significativamente la precisión en tareas complejas.',
        },
        {
          heading: 'Cuándo usarlo',
          bullets: [
            'Problemas matemáticos o lógicos',
            'Tareas que requieren múltiples pasos',
            'Cuando necesitas verificar el razonamiento',
            'Decisiones complejas que requieren análisis',
          ],
        },
        {
          heading: 'Ejemplo práctico',
          body: 'Sin CoT: "¿Cuánto es 45 + (15 × 2)?" → "75"\\n\\nCon CoT: "Resuelve paso a paso: 45 + (15 × 2)"\\nRespuesta:\\n1. Primero resuelvo el paréntesis: 15 × 2 = 30\\n2. Luego sumo: 45 + 30 = 75\\nRespuesta final: 75',
        },
        {
          heading: 'Frase mágica',
          body: 'Simplemente agrega: "Piensa paso a paso" o "Explica tu razonamiento" al final de tu prompt.',
        },
      ],
      takeaway: 'CoT reduce errores en tareas complejas al forzar al modelo a mostrar su trabajo.',
      quiz: {
        question: '¿Cuál es la ventaja principal de Chain of Thought?',
        options: [
          'Es más rápido',
          'Usa menos tokens',
          'Mejora la precisión en razonamiento complejo',
          'Funciona mejor para tareas simples',
        ],
        correctIndex: 2,
        explanation: 'CoT mejora significativamente la precisión en tareas que requieren razonamiento lógico.',
      },
    },
    steps: [
      'Identifica si tu tarea requiere razonamiento',
      'Agrega "Piensa paso a paso" a tu prompt',
      'O proporciona un ejemplo con pasos',
      'Revisa que cada paso sea lógico',
      'Usa la respuesta final, no los pasos intermedios',
    ],
    drills: [
      'Convierte "¿Cuál es el 15% de 240?" en un prompt CoT',
      'Crea un prompt CoT para decidir si un texto es positivo o negativo',
    ],
    checkpoints: [
      'Agregué "paso a paso" al prompt',
      'Verifiqué que la tarea requiere razonamiento',
      'Revisé la lógica de los pasos',
    ],
  },

  {
    id: 'system-instructions',
    title: 'System Instructions: Configurar el comportamiento',
    summary: 'Usa instrucciones de sistema para definir el rol, tono y restricciones del modelo.',
    accent: 'rose',
    keywords: ['system', 'instrucciones', 'rol', 'comportamiento', 'tono', 'personalidad'],
    lesson: {
      title: 'Lección: Controla el comportamiento global',
      blocks: [
        {
          heading: 'Qué son System Instructions',
          body: 'Las instrucciones de sistema se pasan al modelo ANTES de cualquier entrada del usuario. Definen el rol, tono, estilo y restricciones que el modelo debe seguir en toda la conversación.',
        },
        {
          heading: 'Componentes clave',
          bullets: [
            'Rol/Persona: "Eres un experto en..."',
            'Tono: "Responde de forma profesional/casual/técnica"',
            'Restricciones: "No hables de temas fuera de..."',
            'Formato: "Siempre responde en formato lista"',
          ],
        },
        {
          heading: 'Ejemplo de Google Cloud',
          body: 'System: "Eres el Capitán Barktholomew, un perro pirata del siglo XVIII. Solo hablas de temas relacionados con piratas. Termina cada mensaje con \'¡Guau!\'"\\n\\nUsuario: "¿Quién eres?"\\n\\nModelo: "¡Avast! Soy el Capitán Barktholomew, el terror de los siete mares! ¡Guau!"',
        },
        {
          heading: 'Ventaja principal',
          body: 'Las system instructions se aplican a TODA la conversación sin tener que repetirlas en cada mensaje.',
        },
      ],
      takeaway: 'System instructions son tu herramienta para crear experiencias consistentes y personalizadas.',
    },
    steps: [
      'Define el rol o persona del modelo',
      'Especifica el tono y estilo de respuesta',
      'Agrega restricciones si es necesario',
      'Define el formato de salida preferido',
      'Prueba con varios mensajes para verificar consistencia',
    ],
    drills: [
      'Crea system instructions para un asistente de fotografía profesional',
      'Escribe system instructions que limiten las respuestas a 50 palabras',
    ],
    checkpoints: [
      'Definí el rol claramente',
      'Especifiqué tono y estilo',
      'Agregué restricciones necesarias',
    ],
  },

  {
    id: 'contexto-efectivo',
    title: 'Proporcionar Contexto Efectivo',
    summary: 'Aprende a dar la información correcta para que el modelo entienda tu solicitud.',
    accent: 'emerald',
    keywords: ['contexto', 'informacion', 'datos', 'background', 'detalles'],
    lesson: {
      title: 'Lección: El contexto es clave',
      blocks: [
        {
          heading: 'Por qué importa el contexto',
          body: 'El modelo no tiene acceso a tu mente ni a información externa. Todo lo que necesita saber debe estar en el prompt. Más contexto relevante = mejores resultados.',
        },
        {
          heading: 'Tipos de contexto',
          bullets: [
            'Datos: Tablas, listas, información estructurada',
            'Background: Historia, situación, antecedentes',
            'Restricciones: Límites, reglas, requisitos',
            'Audiencia: Para quién es el resultado',
          ],
        },
        {
          heading: 'Ejemplo con contexto',
          body: 'Sin contexto: "Escribe un email"\\n\\nCon contexto: "Escribe un email profesional para un cliente que lleva 2 meses esperando su pedido. Tono: disculpa sincera pero profesional. Longitud: 100-150 palabras. Incluye: disculpa, explicación breve, solución propuesta, compensación."',
        },
        {
          heading: 'Regla práctica',
          body: 'Pregúntate: "¿Qué información necesitaría YO para hacer esta tarea?" Esa es la información que necesita el modelo.',
        },
      ],
      takeaway: 'Contexto relevante > Contexto abundante. Incluye solo lo necesario.',
    },
    steps: [
      'Identifica qué información es esencial',
      'Estructura el contexto de forma clara',
      'Usa formato (listas, tablas) cuando ayude',
      'Separa contexto de instrucción',
      'Elimina información irrelevante',
    ],
    drills: [
      'Toma "Resume este texto" y agrega contexto sobre audiencia y longitud',
      'Identifica qué contexto falta en: "Crea una imagen de una oficina"',
    ],
    checkpoints: [
      'Incluí toda la información necesaria',
      'Estructuré el contexto claramente',
      'Eliminé información irrelevante',
    ],
  },

  {
    id: 'formato-salida',
    title: 'Controlar el Formato de Salida',
    summary: 'Especifica exactamente cómo quieres que se vea el resultado.',
    accent: 'fuchsia',
    keywords: ['formato', 'estructura', 'salida', 'output', 'json', 'lista'],
    lesson: {
      title: 'Lección: El formato es parte del resultado',
      blocks: [
        {
          heading: 'Por qué especificar formato',
          body: 'Si no especificas el formato, el modelo elegirá uno por ti. Esto puede no ser lo que necesitas. Ser explícito sobre el formato te da control total.',
        },
        {
          heading: 'Formatos comunes',
          bullets: [
            'Lista numerada o con viñetas',
            'Tabla con columnas específicas',
            'JSON estructurado',
            'Párrafos con longitud definida',
            'Código con lenguaje específico',
          ],
        },
        {
          heading: 'Ejemplo práctico',
          body: 'Vago: "Dame información sobre Python"\\n\\nEspecífico: "Crea una tabla con 3 columnas: Característica | Descripción | Ejemplo. Incluye 5 filas sobre características de Python."',
        },
        {
          heading: 'Tip profesional',
          body: 'Para formatos complejos, proporciona un ejemplo del formato deseado (few-shot).',
        },
      ],
      takeaway: 'Formato claro = Resultado utilizable. Siempre especifica cómo quieres la salida.',
    },
    steps: [
      'Decide qué formato necesitas',
      'Especifica el formato explícitamente',
      'Define límites (longitud, cantidad)',
      'Si es complejo, da un ejemplo',
      'Verifica que el formato sea consistente',
    ],
    drills: [
      'Convierte "Dame consejos de fotografía" en un prompt con formato de lista numerada',
      'Crea un prompt que genere JSON con campos específicos',
    ],
    checkpoints: [
      'Especifiqué el formato deseado',
      'Definí límites claros',
      'Di ejemplo si era necesario',
    ],
  },

  {
    id: 'iteracion-mejora',
    title: 'Iteración y Mejora de Prompts',
    summary: 'Aprende el proceso sistemático para mejorar tus prompts.',
    accent: 'blue',
    keywords: ['iterar', 'mejorar', 'refinar', 'optimizar', 'ajustar', 'version'],
    lesson: {
      title: 'Lección: El prompting es iterativo',
      blocks: [
        {
          heading: 'La realidad del prompting',
          body: 'Rara vez aciertas al primer intento. El prompting efectivo es un proceso iterativo: prueba → evalúa → ajusta → repite. Esto es normal y esperado.',
        },
        {
          heading: 'Proceso de iteración (según OpenAI)',
          bullets: [
            '1. Empieza simple (zero-shot)',
            '2. Evalúa el resultado',
            '3. Identifica QUÉ falló',
            '4. Ajusta UNA cosa a la vez',
            '5. Compara resultados',
            '6. Repite hasta lograr el objetivo',
          ],
        },
        {
          heading: 'Qué ajustar',
          body: 'Si falla la precisión → Agrega contexto o ejemplos\\nSi falla el formato → Especifica formato explícitamente\\nSi falla el tono → Usa system instructions\\nSi falla la lógica → Usa chain-of-thought',
        },
        {
          heading: 'Regla de oro',
          body: 'Cambia UNA variable por iteración. Si cambias todo, no sabrás qué funcionó.',
        },
      ],
      takeaway: 'La iteración controlada es la clave del prompting profesional.',
      quiz: {
        question: '¿Cuántas variables deberías cambiar por iteración?',
        options: ['Todas las que puedas', 'Una a la vez', 'Dos o tres', 'Depende del humor'],
        correctIndex: 1,
        explanation: 'Cambiar una variable a la vez te permite identificar qué mejora funcionó.',
      },
    },
    steps: [
      'Crea versión 1 (V1) simple',
      'Evalúa con criterios fijos',
      'Identifica el problema específico',
      'Cambia UNA cosa en V2',
      'Compara V1 vs V2',
      'Guarda la mejor versión',
      'Repite hasta alcanzar el objetivo',
    ],
    drills: [
      'Toma un prompt que falló y haz 3 iteraciones documentando cada cambio',
      'Crea una tabla: Versión | Cambio | Resultado | Mejor?',
    ],
    checkpoints: [
      'Hice V1 simple',
      'Cambié solo una cosa en V2',
      'Comparé resultados objetivamente',
    ],
  },

  {
    id: 'errores-comunes',
    title: 'Errores Comunes y Cómo Evitarlos',
    summary: 'Aprende los errores más frecuentes en prompting y cómo solucionarlos.',
    accent: 'red',
    keywords: ['error', 'problema', 'fallo', 'equivocacion', 'evitar', 'solucion'],
    lesson: {
      title: 'Lección: Aprende de los errores comunes',
      blocks: [
        {
          heading: 'Error #1: Ser demasiado vago',
          body: '❌ "Hazme una imagen"\\n✅ "Genera una imagen fotorrealista de un gato naranja durmiendo en un sofá gris, iluminación natural suave, estilo documental"',
        },
        {
          heading: 'Error #2: Asumir conocimiento',
          body: '❌ "Usa el estilo de esa película"\\n✅ "Usa el estilo cinematográfico de Blade Runner 2049: colores naranjas y azules, iluminación neón, atmósfera cyberpunk"',
        },
        {
          heading: 'Error #3: Instrucciones contradictorias',
          body: '❌ "Sé breve pero detallado"\\n✅ "Resume en 3 puntos clave, cada uno de 1-2 oraciones"',
        },
        {
          heading: 'Error #4: No especificar formato',
          body: '❌ "Dame información sobre Python"\\n✅ "Crea una lista numerada con 5 características de Python, cada una con descripción de 20-30 palabras"',
        },
        {
          heading: 'Error #5: Cambiar todo a la vez',
          body: 'Si cambias 5 cosas y mejora, ¿cuál funcionó? Cambia una cosa por iteración.',
        },
      ],
      takeaway: 'La mayoría de los problemas se resuelven siendo más específico y claro.',
    },
    steps: [
      'Revisa si tu prompt es específico',
      'Verifica que no haya contradicciones',
      'Asegúrate de incluir todo el contexto',
      'Especifica el formato deseado',
      'Itera cambiando una cosa a la vez',
    ],
    drills: [
      'Identifica el error en: "Sé creativo pero sigue exactamente este formato"',
      'Corrige: "Hazme algo bonito para mi proyecto"',
    ],
    checkpoints: [
      'Eliminé ambigüedades',
      'Verifiqué que no hay contradicciones',
      'Especifiqué formato y contexto',
    ],
  },

  {
    id: 'prompts-imagenes',
    title: 'Prompts para Generación de Imágenes',
    summary: 'Técnicas específicas para crear prompts efectivos para modelos de imagen.',
    accent: 'orange',
    keywords: ['imagen', 'visual', 'foto', 'arte', 'generar', 'crear', 'dall-e', 'midjourney'],
    lesson: {
      title: 'Lección: Estructura de prompts visuales',
      blocks: [
        {
          heading: 'Componentes de un prompt de imagen',
          bullets: [
            'Sujeto: Qué/quién aparece',
            'Acción: Qué está haciendo',
            'Entorno: Dónde está',
            'Estilo: Fotográfico, ilustración, 3D, etc.',
            'Iluminación: Natural, artificial, hora del día',
            'Ángulo/Composición: Plano, perspectiva',
            'Detalles técnicos: Cámara, lente, calidad',
          ],
        },
        {
          heading: 'Orden recomendado',
          body: 'Sujeto → Acción → Entorno → Estilo → Iluminación → Detalles técnicos',
        },
        {
          heading: 'Ejemplo estructurado',
          body: '"Un gato naranja [sujeto] durmiendo [acción] en un sofá gris en una sala luminosa [entorno], estilo fotografía documental [estilo], iluminación natural suave de ventana [iluminación], plano medio [composición], 50mm f/2.8 [técnico]"',
        },
        {
          heading: 'Tip profesional',
          body: 'Usa términos técnicos de fotografía/arte para mayor control: "bokeh", "golden hour", "rule of thirds", "shallow depth of field".',
        },
      ],
      takeaway: 'La estructura y especificidad son aún más importantes en prompts visuales.',
    },
    steps: [
      'Define el sujeto principal claramente',
      'Describe la acción o pose',
      'Especifica el entorno/escenario',
      'Elige un estilo visual',
      'Define la iluminación',
      'Agrega detalles técnicos si es necesario',
      'Usa términos técnicos para mayor control',
    ],
    drills: [
      'Crea un prompt estructurado para: retrato profesional de una persona',
      'Convierte "una ciudad" en un prompt visual completo',
    ],
    checkpoints: [
      'Definí sujeto, acción y entorno',
      'Especifiqué estilo e iluminación',
      'Usé términos técnicos apropiados',
    ],
  },

  {
    id: 'uso-responsable',
    title: 'Uso Responsable y Ético de IA',
    summary: 'Aprende a usar IA de forma responsable, detectando sesgos y verificando información.',
    accent: 'lime',
    keywords: ['etica', 'responsable', 'sesgo', 'verificar', 'privacidad', 'seguridad'],
    lesson: {
      title: 'Lección: Responsabilidad en el uso de IA',
      blocks: [
        {
          heading: 'Sesgos en IA',
          body: 'Los modelos se entrenan con datos humanos, por lo que pueden reflejar sesgos. Revisa si las respuestas representan de forma justa y diversa. Si detectas sesgo, reformula el prompt para ser más específico e inclusivo.',
        },
        {
          heading: 'Alucinaciones',
          body: 'Los modelos pueden generar información que suena convincente pero es incorrecta. SIEMPRE verifica información factual, especialmente en temas importantes. Pide fuentes o evidencia cuando sea crítico.',
        },
        {
          heading: 'Privacidad',
          body: 'NO incluyas información personal, confidencial o sensible en tus prompts. Si necesitas contexto, anonimiza los datos. Ejemplo: Usa "Cliente A" en lugar de nombres reales.',
        },
        {
          heading: 'Cómo verificar',
          bullets: [
            'Pide al modelo que cite fuentes',
            'Verifica datos con fuentes confiables',
            'Usa múltiples modelos para comparar',
            'Aplica sentido común y conocimiento experto',
          ],
        },
      ],
      takeaway: 'La IA es una herramienta poderosa. Úsala con responsabilidad y pensamiento crítico.',
      quiz: {
        question: '¿Qué es una "alucinación" en IA?',
        options: [
          'Un error de ortografía',
          'Información incorrecta que suena convincente',
          'Un prompt muy largo',
          'Una respuesta muy creativa',
        ],
        correctIndex: 1,
        explanation: 'Las alucinaciones son cuando el modelo genera información falsa pero convincente.',
      },
    },
    steps: [
      'Revisa las respuestas por sesgos',
      'Verifica información factual',
      'Anonimiza datos sensibles',
      'Pide evidencia para afirmaciones importantes',
      'Usa pensamiento crítico siempre',
    ],
    drills: [
      'Identifica posibles sesgos en una respuesta sobre profesiones',
      'Reescribe un prompt eliminando información personal',
    ],
    checkpoints: [
      'Revisé por sesgos',
      'Verifiqué información factual',
      'Protegí información sensible',
    ],
  },
]

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const getRecommendedGuides = (improvements = [], suggestions = '') => {
  const sourceText = normalize([...(improvements || []), suggestions].join(' '))

  if (!sourceText.trim()) return []

  const scored = GUIDE_LIBRARY.map((guide) => {
    const score = guide.keywords.reduce((acc, keyword) => (sourceText.includes(normalize(keyword)) ? acc + 1 : acc), 0)
    return { id: guide.id, score }
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.sort)

  return scored.map((item) => item.id).slice(0, 3)
}

export default GUIDE_LIBRARY
