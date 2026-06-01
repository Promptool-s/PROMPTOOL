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
          body: 'Malo: "Dame una imagen"\nBueno: "Genera una imagen de un gato naranja durmiendo en un sofa gris, estilo fotografia realista, iluminacion natural suave"',
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
    en: {
      title: 'Prompting Fundamentals: What It Is and How It Works',
      summary: 'Learn the basic concepts of how to communicate effectively with generative AI models.',
      lesson: {
        title: 'Lesson: What a prompt is and why it matters',
        blocks: [
          {
            heading: 'Definition',
            body: 'A prompt is a natural language request you send to an AI model to receive a response. It can be a question, instruction, context, or example. The quality of the prompt directly determines the quality of the response.',
          },
          {
            heading: 'Components of an effective prompt (according to Google Cloud)',
            bullets: [
              'Task (required): What you want the model to do',
              'Context (optional): Relevant information for the task',
              'Examples (optional): Samples of the expected result',
              'Format (optional): Specific structure of the output',
            ],
          },
          {
            heading: 'Why clarity matters',
            body: 'AI models don\'t "guess" your intention. Vague instructions produce vague results. Being specific and clear significantly increases the probability of getting the desired result.',
          },
          {
            heading: 'Practical example',
            body: 'Bad: "Give me an image"\nGood: "Generate an image of an orange cat sleeping on a gray sofa, realistic photography style, soft natural lighting"',
          },
        ],
        takeaway: 'Specificity is control. The clearer you are, the better the result.',
        quiz: {
          question: 'What is the REQUIRED component in every prompt?',
          options: ['Context', 'Examples', 'Task', 'Format'],
          correctIndex: 2,
          explanation: 'The task is the only mandatory component: it defines what you want the model to do.',
        },
      },
      steps: [
        'Clearly define WHAT you want (the task)',
        'Add relevant context if necessary',
        'Specify the desired output format',
        'Be specific, not ambiguous',
        'Iterate and improve based on results',
      ],
      drills: [
        'Convert "make me a nice image" into a specific prompt with task, context and format',
        'Identify what\'s missing in this prompt: "A dog" and improve it',
      ],
      checkpoints: [
        'I defined the task clearly',
        'I added necessary context',
        'I specified the output format',
      ],
    },
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
    en: {
      title: 'Zero-Shot Prompting: Direct Instructions',
      summary: 'The simplest technique: give a clear instruction without prior examples.',
      lesson: {
        title: 'Lesson: When to use Zero-Shot',
        blocks: [
          {
            heading: 'What is Zero-Shot',
            body: 'Zero-shot prompting means giving a direct instruction to the model without providing examples. The model relies solely on its training to respond.',
          },
          {
            heading: 'When to use it',
            bullets: [
              'Simple and direct tasks',
              'General knowledge questions',
              'When you don\'t need a specific format',
              'For quick exploration of ideas',
            ],
          },
          {
            heading: 'Real example',
            body: 'Prompt: "What are the colors of the rainbow?"\nResponse: "The colors of the rainbow are: red, orange, yellow, green, blue, indigo, and violet."',
          },
          {
            heading: 'Advantages and limitations',
            body: 'Advantages: Fast, simple, requires no preparation.\nLimitations: May lack precision for complex or specific tasks.',
          },
        ],
        takeaway: 'Zero-shot is your starting point. If it doesn\'t work, escalate to few-shot or chain-of-thought.',
        quiz: {
          question: 'When is zero-shot prompting most appropriate?',
          options: [
            'Complex tasks requiring step-by-step reasoning',
            'When you need a very specific format',
            'Simple and direct questions',
            'When you want maximum precision',
          ],
          correctIndex: 2,
          explanation: 'Zero-shot works best for simple, direct tasks that don\'t require examples.',
        },
      },
      steps: [
        'Identify if your task is simple and direct',
        'Write a clear and concise instruction',
        'Send the prompt without examples',
        'Evaluate the result',
        'If not enough, consider few-shot',
      ],
      drills: [
        'Write 3 zero-shot prompts for: translate text, summarize a paragraph, generate a title',
        'Identify which of these requires zero-shot vs few-shot',
      ],
      checkpoints: [
        'I wrote a clear instruction',
        'I verified the task is simple',
        'I evaluated if I need to escalate to few-shot',
      ],
    },
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
    en: {
      title: 'Few-Shot Prompting: Teaching with Examples',
      summary: 'Improve precision by showing the model examples of the expected result.',
      lesson: {
        title: 'Lesson: The power of examples',
        blocks: [
          {
            heading: 'What is Few-Shot',
            body: 'Few-shot prompting includes 1–5 examples in your prompt to show the model exactly what kind of response you expect. It\'s like "teaching by demonstration".',
          },
          {
            heading: 'When to use it (according to OpenAI)',
            bullets: [
              'You need a specific format',
              'You want consistency in responses',
              'The task requires a particular style',
              'Zero-shot didn\'t give good results',
            ],
          },
          {
            heading: 'Real example from Google Cloud',
            body: 'Prompt: "Classify as red or white wine:\\n\\nExamples:\\nName: Chardonnay\\nType: White wine\\n\\nName: Cabernet\\nType: Red wine\\n\\nName: Riesling\\nType:"\\n\\nResponse: "White wine"',
          },
          {
            heading: 'Golden rule',
            body: '2–3 examples are usually enough. More examples = more tokens = more cost. Find the balance.',
          },
        ],
        takeaway: 'Examples are your best tool for controlling the format and style of the output.',
        quiz: {
          question: 'How many examples are typically recommended in few-shot?',
          options: ['1 example always', '2–3 examples', '10+ examples', 'As many as possible'],
          correctIndex: 1,
          explanation: '2–3 examples are usually the optimal balance between effectiveness and cost.',
        },
      },
      steps: [
        'Identify the format or style you need',
        'Create 2–3 input → output examples',
        'Structure: Examples first, then your query',
        'Make sure the examples are consistent',
        'Test and adjust examples if necessary',
      ],
      drills: [
        'Create a few-shot prompt to classify emails as spam/not spam with 3 examples',
        'Convert a failed zero-shot prompt into a few-shot one',
      ],
      checkpoints: [
        'I created 2–3 clear examples',
        'The examples are consistent',
        'I structured: examples → query',
      ],
    },
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
    en: {
      title: 'Chain of Thought: Step-by-Step Reasoning',
      summary: 'Improve reasoning by asking the model to think through logical steps.',
      lesson: {
        title: 'Lesson: How step-by-step reasoning works',
        blocks: [
          {
            heading: 'What is Chain of Thought (CoT)',
            body: 'CoT is a technique where you explicitly ask the model to show its reasoning step by step before giving the final answer. This significantly improves accuracy in complex tasks.',
          },
          {
            heading: 'When to use it',
            bullets: [
              'Mathematical or logical problems',
              'Tasks requiring multiple steps',
              'When you need to verify the reasoning',
              'Complex decisions requiring analysis',
            ],
          },
          {
            heading: 'Practical example',
            body: 'Without CoT: "What is 45 + (15 × 2)?" → "75"\\n\\nWith CoT: "Solve step by step: 45 + (15 × 2)"\\nResponse:\\n1. First solve the parentheses: 15 × 2 = 30\\n2. Then add: 45 + 30 = 75\\nFinal answer: 75',
          },
          {
            heading: 'Magic phrase',
            body: 'Simply add: "Think step by step" or "Explain your reasoning" at the end of your prompt.',
          },
        ],
        takeaway: 'CoT reduces errors in complex tasks by forcing the model to show its work.',
        quiz: {
          question: 'What is the main advantage of Chain of Thought?',
          options: [
            'It\'s faster',
            'It uses fewer tokens',
            'It improves precision in complex reasoning',
            'It works better for simple tasks',
          ],
          correctIndex: 2,
          explanation: 'CoT significantly improves accuracy in tasks that require logical reasoning.',
        },
      },
      steps: [
        'Identify if your task requires reasoning',
        'Add "Think step by step" to your prompt',
        'Or provide an example with steps',
        'Check that each step is logical',
        'Use the final answer, not the intermediate steps',
      ],
      drills: [
        'Convert "What is 15% of 240?" into a CoT prompt',
        'Create a CoT prompt to decide if a text is positive or negative',
      ],
      checkpoints: [
        'I added "step by step" to the prompt',
        'I verified the task requires reasoning',
        'I reviewed the logic of the steps',
      ],
    },
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
    en: {
      title: 'System Instructions: Configuring Behavior',
      summary: 'Use system instructions to define the role, tone, and restrictions of the model.',
      lesson: {
        title: 'Lesson: Control global behavior',
        blocks: [
          {
            heading: 'What are System Instructions',
            body: 'System instructions are passed to the model BEFORE any user input. They define the role, tone, style, and constraints the model must follow throughout the conversation.',
          },
          {
            heading: 'Key components',
            bullets: [
              'Role/Persona: "You are an expert in..."',
              'Tone: "Respond in a professional/casual/technical way"',
              'Restrictions: "Don\'t talk about topics outside of..."',
              'Format: "Always respond in list format"',
            ],
          },
          {
            heading: 'Example from Google Cloud',
            body: 'System: "You are Captain Barktholomew, a pirate dog from the 18th century. You only talk about pirate-related topics. End every message with \'Woof!\'"\\n\\nUser: "Who are you?"\\n\\nModel: "Avast! I be Captain Barktholomew, the terror of the seven seas! Woof!"',
          },
          {
            heading: 'Main advantage',
            body: 'System instructions apply to the ENTIRE conversation without having to repeat them in each message.',
          },
        ],
        takeaway: 'System instructions are your tool for creating consistent and personalized experiences.',
      },
      steps: [
        'Define the role or persona of the model',
        'Specify the tone and style of response',
        'Add restrictions if necessary',
        'Define the preferred output format',
        'Test with several messages to verify consistency',
      ],
      drills: [
        'Create system instructions for a professional photography assistant',
        'Write system instructions that limit responses to 50 words',
      ],
      checkpoints: [
        'I defined the role clearly',
        'I specified tone and style',
        'I added necessary restrictions',
      ],
    },
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
    en: {
      title: 'Providing Effective Context',
      summary: 'Learn to give the right information so the model understands your request.',
      lesson: {
        title: 'Lesson: Context is key',
        blocks: [
          {
            heading: 'Why context matters',
            body: 'The model doesn\'t have access to your mind or external information. Everything it needs to know must be in the prompt. More relevant context = better results.',
          },
          {
            heading: 'Types of context',
            bullets: [
              'Data: Tables, lists, structured information',
              'Background: History, situation, antecedents',
              'Constraints: Limits, rules, requirements',
              'Audience: Who the result is for',
            ],
          },
          {
            heading: 'Example with context',
            body: 'Without context: "Write an email"\\n\\nWith context: "Write a professional email for a client who has been waiting 2 months for their order. Tone: sincere but professional apology. Length: 100–150 words. Include: apology, brief explanation, proposed solution, compensation."',
          },
          {
            heading: 'Practical rule',
            body: 'Ask yourself: "What information would I need to do this task?" That\'s the information the model needs.',
          },
        ],
        takeaway: 'Relevant context > abundant context. Include only what\'s necessary.',
      },
      steps: [
        'Identify what information is essential',
        'Structure the context clearly',
        'Use format (lists, tables) when it helps',
        'Separate context from instruction',
        'Remove irrelevant information',
      ],
      drills: [
        'Take "Summarize this text" and add context about audience and length',
        'Identify what context is missing in: "Create an image of an office"',
      ],
      checkpoints: [
        'I included all necessary information',
        'I structured the context clearly',
        'I removed irrelevant information',
      ],
    },
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
    en: {
      title: 'Controlling Output Format',
      summary: 'Specify exactly how you want the result to look.',
      lesson: {
        title: 'Lesson: Format is part of the result',
        blocks: [
          {
            heading: 'Why specify format',
            body: 'If you don\'t specify the format, the model will choose one for you. This may not be what you need. Being explicit about format gives you full control.',
          },
          {
            heading: 'Common formats',
            bullets: [
              'Numbered list or bullet points',
              'Table with specific columns',
              'Structured JSON',
              'Paragraphs with defined length',
              'Code with specific language',
            ],
          },
          {
            heading: 'Practical example',
            body: 'Vague: "Give me information about Python"\\n\\nSpecific: "Create a table with 3 columns: Feature | Description | Example. Include 5 rows about Python features."',
          },
          {
            heading: 'Pro tip',
            body: 'For complex formats, provide an example of the desired format (few-shot).',
          },
        ],
        takeaway: 'Clear format = usable result. Always specify how you want the output.',
      },
      steps: [
        'Decide what format you need',
        'Specify the format explicitly',
        'Define limits (length, quantity)',
        'If complex, give an example',
        'Verify the format is consistent',
      ],
      drills: [
        'Convert "Give me photography tips" into a prompt with numbered list format',
        'Create a prompt that generates JSON with specific fields',
      ],
      checkpoints: [
        'I specified the desired format',
        'I defined clear limits',
        'I gave an example if necessary',
      ],
    },
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
    en: {
      title: 'Iteration and Prompt Improvement',
      summary: 'Learn the systematic process for improving your prompts.',
      lesson: {
        title: 'Lesson: Prompting is iterative',
        blocks: [
          {
            heading: 'The reality of prompting',
            body: 'You rarely get it right on the first try. Effective prompting is an iterative process: test → evaluate → adjust → repeat. This is normal and expected.',
          },
          {
            heading: 'Iteration process (according to OpenAI)',
            bullets: [
              '1. Start simple (zero-shot)',
              '2. Evaluate the result',
              '3. Identify WHAT failed',
              '4. Adjust ONE thing at a time',
              '5. Compare results',
              '6. Repeat until you reach the goal',
            ],
          },
          {
            heading: 'What to adjust',
            body: 'If precision fails → Add context or examples\nIf format fails → Specify format explicitly\nIf tone fails → Use system instructions\nIf logic fails → Use chain-of-thought',
          },
          {
            heading: 'Golden rule',
            body: 'Change ONE variable per iteration. If you change everything, you won\'t know what worked.',
          },
        ],
        takeaway: 'Controlled iteration is the key to professional prompting.',
        quiz: {
          question: 'How many variables should you change per iteration?',
          options: ['As many as you can', 'One at a time', 'Two or three', 'Depends on mood'],
          correctIndex: 1,
          explanation: 'Changing one variable at a time lets you identify which improvement worked.',
        },
      },
      steps: [
        'Create version 1 (V1) simple',
        'Evaluate with fixed criteria',
        'Identify the specific problem',
        'Change ONE thing in V2',
        'Compare V1 vs V2',
        'Save the best version',
        'Repeat until the goal is reached',
      ],
      drills: [
        'Take a prompt that failed and do 3 iterations documenting each change',
        'Create a table: Version | Change | Result | Better?',
      ],
      checkpoints: [
        'I made a simple V1',
        'I changed only one thing in V2',
        'I compared results objectively',
      ],
    },
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
          body: 'No: "Hazme una imagen"\nSi: "Genera una imagen fotorrealista de un gato naranja durmiendo en un sofá gris, iluminación natural suave, estilo documental"',
        },
        {
          heading: 'Error #2: Asumir conocimiento',
          body: 'No: "Usa el estilo de esa película"\nSi: "Usa el estilo cinematográfico de Blade Runner 2049: colores naranjas y azules, iluminación neón, atmósfera cyberpunk"',
        },
        {
          heading: 'Error #3: Instrucciones contradictorias',
          body: 'No: "Sé breve pero detallado"\nSi: "Resume en 3 puntos clave, cada uno de 1-2 oraciones"',
        },
        {
          heading: 'Error #4: No especificar formato',
          body: 'No: "Dame información sobre Python"\nSi: "Crea una lista numerada con 5 características de Python, cada una con descripción de 20-30 palabras"',
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
    en: {
      title: 'Common Errors and How to Avoid Them',
      summary: 'Learn the most frequent prompting mistakes and how to fix them.',
      lesson: {
        title: 'Lesson: Learn from common mistakes',
        blocks: [
          {
            heading: 'Error #1: Being too vague',
            body: 'No: "Make me an image"\nSi: "Generate a photorealistic image of an orange cat sleeping on a gray sofa, soft natural lighting, documentary style"',
          },
          {
            heading: 'Error #2: Assuming knowledge',
            body: 'No: "Use the style of that movie"\nSi: "Use the cinematic style of Blade Runner 2049: orange and blue colors, neon lighting, cyberpunk atmosphere"',
          },
          {
            heading: 'Error #3: Contradictory instructions',
            body: 'No: "Be brief but detailed"\nSi: "Summarize in 3 key points, each 1–2 sentences long"',
          },
          {
            heading: 'Error #4: Not specifying format',
            body: 'No: "Give me information about Python"\nSi: "Create a numbered list with 5 Python features, each with a 20–30 word description"',
          },
          {
            heading: 'Error #5: Changing everything at once',
            body: 'If you change 5 things and it improves, which one worked? Change one thing per iteration.',
          },
        ],
        takeaway: 'Most problems are solved by being more specific and clear.',
      },
      steps: [
        'Check if your prompt is specific',
        'Verify there are no contradictions',
        'Make sure to include all context',
        'Specify the desired format',
        'Iterate changing one thing at a time',
      ],
      drills: [
        'Identify the error in: "Be creative but follow exactly this format"',
        'Fix: "Make me something nice for my project"',
      ],
      checkpoints: [
        'I removed ambiguities',
        'I verified there are no contradictions',
        'I specified format and context',
      ],
    },
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
    en: {
      title: 'Prompts for Image Generation',
      summary: 'Specific techniques for creating effective prompts for image models.',
      lesson: {
        title: 'Lesson: Visual prompt structure',
        blocks: [
          {
            heading: 'Components of an image prompt',
            bullets: [
              'Subject: What/who appears',
              'Action: What they are doing',
              'Environment: Where it is',
              'Style: Photographic, illustration, 3D, etc.',
              'Lighting: Natural, artificial, time of day',
              'Angle/Composition: Shot, perspective',
              'Technical details: Camera, lens, quality',
            ],
          },
          {
            heading: 'Recommended order',
            body: 'Subject → Action → Environment → Style → Lighting → Technical details',
          },
          {
            heading: 'Structured example',
            body: '"An orange cat [subject] sleeping [action] on a gray sofa in a bright living room [environment], documentary photography style [style], soft natural window lighting [lighting], medium shot [composition], 50mm f/2.8 [technical]"',
          },
          {
            heading: 'Pro tip',
            body: 'Use technical photography/art terms for more control: "bokeh", "golden hour", "rule of thirds", "shallow depth of field".',
          },
        ],
        takeaway: 'Structure and specificity are even more important in visual prompts.',
      },
      steps: [
        'Define the main subject clearly',
        'Describe the action or pose',
        'Specify the environment/scene',
        'Choose a visual style',
        'Define the lighting',
        'Add technical details if necessary',
        'Use technical terms for more control',
      ],
      drills: [
        'Create a structured prompt for: professional portrait of a person',
        'Convert "a city" into a complete visual prompt',
      ],
      checkpoints: [
        'I defined subject, action and environment',
        'I specified style and lighting',
        'I used appropriate technical terms',
      ],
    },
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
    en: {
      title: 'Responsible and Ethical Use of AI',
      summary: 'Learn to use AI responsibly, detecting biases and verifying information.',
      lesson: {
        title: 'Lesson: Responsibility in AI use',
        blocks: [
          {
            heading: 'Biases in AI',
            body: 'Models are trained on human data, so they may reflect biases. Check whether responses represent fairly and diversely. If you detect bias, rephrase the prompt to be more specific and inclusive.',
          },
          {
            heading: 'Hallucinations',
            body: 'Models can generate information that sounds convincing but is incorrect. ALWAYS verify factual information, especially on important topics. Ask for sources or evidence when critical.',
          },
          {
            heading: 'Privacy',
            body: 'Do NOT include personal, confidential, or sensitive information in your prompts. If you need context, anonymize the data. Example: Use "Client A" instead of real names.',
          },
          {
            heading: 'How to verify',
            bullets: [
              'Ask the model to cite sources',
              'Verify data with reliable sources',
              'Use multiple models to compare',
              'Apply common sense and expert knowledge',
            ],
          },
        ],
        takeaway: 'AI is a powerful tool. Use it with responsibility and critical thinking.',
        quiz: {
          question: 'What is a "hallucination" in AI?',
          options: [
            'A spelling error',
            'Incorrect information that sounds convincing',
            'A very long prompt',
            'A very creative response',
          ],
          correctIndex: 1,
          explanation: 'Hallucinations are when the model generates false but convincing information.',
        },
      },
      steps: [
        'Review responses for biases',
        'Verify factual information',
        'Anonymize sensitive data',
        'Ask for evidence for important claims',
        'Always apply critical thinking',
      ],
      drills: [
        'Identify possible biases in a response about professions',
        'Rewrite a prompt removing personal information',
      ],
      checkpoints: [
        'I checked for biases',
        'I verified factual information',
        'I protected sensitive information',
      ],
    },
  },
]

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export const getGuideById = (id) => GUIDE_LIBRARY.find((g) => g.id === id) ?? null

export const getAllGuideSlugs = () => GUIDE_LIBRARY.map((g) => g.id)

export const getRecommendedGuides = (improvements = [], suggestions = '') => {
  const sourceText = normalize([...(improvements || []), suggestions].join(' '))

  if (!sourceText.trim()) return []

  const scored = GUIDE_LIBRARY.map((guide) => {
    const score = guide.keywords.reduce((acc, keyword) => (sourceText.includes(normalize(keyword)) ? acc + 1 : acc), 0)
    return { id: guide.id, score }
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map((item) => item.id).slice(0, 3)
}

export default GUIDE_LIBRARY
