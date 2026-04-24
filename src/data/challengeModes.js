// Challenge Types, Modes, and Configurations
// Complete guide for enterprise challenge customization

export const challengeTypes = {
  standard: {
    name: { en: 'Standard Challenge', es: 'Desafío Estándar' },
    description: {
      en: 'Traditional prompt-to-image challenge. Users write a prompt to match the target image.',
      es: 'Desafío tradicional de prompt a imagen. Los usuarios escriben un prompt para coincidir con la imagen objetivo.'
    },
    bestFor: {
      en: 'General training, onboarding, skill assessment',
      es: 'Entrenamiento general, incorporación, evaluación de habilidades'
    },
    icon: '🎯'
  },
  
  multi_round: {
    name: { en: 'Multi-Round Challenge', es: 'Desafío Multi-Ronda' },
    description: {
      en: 'Multiple rounds where users iteratively improve their prompts based on feedback.',
      es: 'Múltiples rondas donde los usuarios mejoran iterativamente sus prompts basándose en feedback.'
    },
    bestFor: {
      en: 'Skill development, learning from mistakes, continuous improvement',
      es: 'Desarrollo de habilidades, aprender de errores, mejora continua'
    },
    icon: '🔄'
  },
  
  speed_challenge: {
    name: { en: 'Speed Challenge', es: 'Desafío de Velocidad' },
    description: {
      en: 'Time-focused challenge where speed matters as much as accuracy.',
      es: 'Desafío enfocado en tiempo donde la velocidad importa tanto como la precisión.'
    },
    bestFor: {
      en: 'Quick thinking, efficiency training, competitive events',
      es: 'Pensamiento rápido, entrenamiento de eficiencia, eventos competitivos'
    },
    icon: '⚡'
  },
  
  creativity: {
    name: { en: 'Creativity Challenge', es: 'Desafío de Creatividad' },
    description: {
      en: 'Focuses on originality and creative interpretation rather than exact matching.',
      es: 'Se enfoca en originalidad e interpretación creativa en lugar de coincidencia exacta.'
    },
    bestFor: {
      en: 'Marketing teams, content creators, innovation workshops',
      es: 'Equipos de marketing, creadores de contenido, talleres de innovación'
    },
    icon: '🎨'
  },
  
  team_collaborative: {
    name: { en: 'Team Collaborative', es: 'Colaborativo en Equipo' },
    description: {
      en: 'Teams work together to solve challenges, combining their skills and ideas.',
      es: 'Los equipos trabajan juntos para resolver desafíos, combinando sus habilidades e ideas.'
    },
    bestFor: {
      en: 'Team building, cross-department collaboration, group training',
      es: 'Construcción de equipos, colaboración interdepartamental, entrenamiento grupal'
    },
    icon: '👥'
  },
  
  tournament: {
    name: { en: 'Tournament', es: 'Torneo' },
    description: {
      en: 'Competitive bracket-style tournament where participants face off in elimination rounds.',
      es: 'Torneo competitivo estilo bracket donde los participantes se enfrentan en rondas eliminatorias.'
    },
    bestFor: {
      en: 'Company competitions, engagement events, rewards programs',
      es: 'Competencias empresariales, eventos de engagement, programas de recompensas'
    },
    icon: '🏆'
  },
  
  color_matching: {
    name: { en: 'Color Matching', es: 'Coincidencia de Colores' },
    description: {
      en: 'Design-focused challenge where users must identify and match 4 key colors from the image using RGB sliders.',
      es: 'Desafío enfocado en diseño donde los usuarios deben identificar y coincidir 4 colores clave de la imagen usando controles RGB.'
    },
    bestFor: {
      en: 'Design teams, brand consistency, visual training, color theory',
      es: 'Equipos de diseño, consistencia de marca, entrenamiento visual, teoría del color'
    },
    icon: '🎨',
    special: true
  },
  
  concept_visualization: {
    name: { en: 'Concept Visualization', es: 'Visualización de Conceptos' },
    description: {
      en: 'Educational challenge to visualize abstract concepts or ideas into concrete images.',
      es: 'Desafío educativo para visualizar conceptos o ideas abstractas en imágenes concretas.'
    },
    bestFor: {
      en: 'Education, training, explaining complex ideas, learning objectives',
      es: 'Educación, capacitación, explicar ideas complejas, objetivos de aprendizaje'
    },
    icon: '💡'
  },
  
  step_by_step: {
    name: { en: 'Step-by-Step Series', es: 'Serie Paso a Paso' },
    description: {
      en: 'Create a series of images that form an instructional sequence or process.',
      es: 'Crear una serie de imágenes que forman una secuencia instructiva o proceso.'
    },
    bestFor: {
      en: 'Training materials, tutorials, process documentation, onboarding',
      es: 'Materiales de capacitación, tutoriales, documentación de procesos, incorporación'
    },
    icon: '📋'
  },
  
  technical_diagram: {
    name: { en: 'Technical Diagram', es: 'Diagrama Técnico' },
    description: {
      en: 'Create technical diagrams, flowcharts, or system architecture visualizations.',
      es: 'Crear diagramas técnicos, diagramas de flujo o visualizaciones de arquitectura de sistemas.'
    },
    bestFor: {
      en: 'Tech teams, documentation, system design, technical communication',
      es: 'Equipos técnicos, documentación, diseño de sistemas, comunicación técnica'
    },
    icon: '📐'
  }
};

export const challengeModes = {
  static: {
    name: { en: 'Static Difficulty', es: 'Dificultad Estática' },
    description: {
      en: 'Difficulty remains constant throughout all attempts. Best for standardized testing and fair comparison.',
      es: 'La dificultad permanece constante en todos los intentos. Mejor para pruebas estandarizadas y comparación justa.'
    },
    icon: '📊',
    recommended: ['standard', 'tournament', 'color_matching']
  },
  
  adaptive: {
    name: { en: 'Adaptive Difficulty', es: 'Dificultad Adaptativa' },
    description: {
      en: 'Difficulty adjusts based on user performance. Gets harder if you succeed, easier if you struggle. Personalized learning experience.',
      es: 'La dificultad se ajusta según el desempeño del usuario. Se vuelve más difícil si tienes éxito, más fácil si tienes dificultades. Experiencia de aprendizaje personalizada.'
    },
    icon: '🎯',
    recommended: ['multi_round', 'concept_visualization', 'step_by_step']
  },
  
  progressive: {
    name: { en: 'Progressive Difficulty', es: 'Dificultad Progresiva' },
    description: {
      en: 'Difficulty increases with each attempt or round. Encourages continuous improvement and skill development.',
      es: 'La dificultad aumenta con cada intento o ronda. Fomenta la mejora continua y el desarrollo de habilidades.'
    },
    icon: '📈',
    recommended: ['multi_round', 'team_collaborative', 'creativity']
  }
};

export const scoringSystems = {
  accuracy_based: {
    name: { en: 'Accuracy Based', es: 'Basado en Precisión' },
    description: {
      en: 'Score based on how closely the generated image matches the target. Standard scoring method.',
      es: 'Puntuación basada en qué tan cerca la imagen generada coincide con el objetivo. Método de puntuación estándar.'
    },
    formula: 'Base score × Accuracy %',
    icon: '🎯'
  },
  
  speed_bonus: {
    name: { en: 'Speed Bonus', es: 'Bonificación por Velocidad' },
    description: {
      en: 'Bonus points for completing quickly. Rewards efficiency and quick thinking.',
      es: 'Puntos extra por completar rápidamente. Recompensa la eficiencia y el pensamiento rápido.'
    },
    formula: 'Base score + (Time remaining × Multiplier)',
    icon: '⚡'
  },
  
  creativity_weighted: {
    name: { en: 'Creativity Weighted', es: 'Ponderado por Creatividad' },
    description: {
      en: 'Higher weight on originality and creative interpretation. Perfect for marketing and content teams.',
      es: 'Mayor peso en originalidad e interpretación creativa. Perfecto para equipos de marketing y contenido.'
    },
    formula: 'Accuracy × 0.6 + Creativity × 0.4',
    icon: '🎨'
  },
  
  efficiency: {
    name: { en: 'Efficiency', es: 'Eficiencia' },
    description: {
      en: 'Rewards concise, effective prompts. Fewer words with high accuracy = higher score.',
      es: 'Recompensa prompts concisos y efectivos. Menos palabras con alta precisión = mayor puntuación.'
    },
    formula: 'Base score × (1 + Brevity bonus)',
    icon: '✂️'
  },
  
  custom_rubric: {
    name: { en: 'Custom Rubric', es: 'Rúbrica Personalizada' },
    description: {
      en: 'Define your own scoring criteria and weights. Fully customizable for specific needs.',
      es: 'Define tus propios criterios de puntuación y pesos. Totalmente personalizable para necesidades específicas.'
    },
    formula: 'Custom weighted criteria',
    icon: '⚙️'
  },
  
  color_precision: {
    name: { en: 'Color Precision', es: 'Precisión de Color' },
    description: {
      en: 'Specific to color matching challenges. Score based on RGB accuracy of identified colors.',
      es: 'Específico para desafíos de coincidencia de colores. Puntuación basada en precisión RGB de colores identificados.'
    },
    formula: 'Σ(255 - RGB difference) / 4 colors',
    icon: '🎨',
    exclusive: ['color_matching']
  }
};

export const feedbackLevels = {
  immediate: {
    name: { en: 'Immediate Feedback', es: 'Feedback Inmediato' },
    description: {
      en: 'Get instant feedback after each attempt. Best for learning and skill development.',
      es: 'Obtén feedback instantáneo después de cada intento. Mejor para aprendizaje y desarrollo de habilidades.'
    },
    icon: '⚡'
  },
  
  delayed: {
    name: { en: 'Delayed Feedback', es: 'Feedback Diferido' },
    description: {
      en: 'Feedback provided at the end of the challenge. Encourages independent problem-solving.',
      es: 'Feedback proporcionado al final del desafío. Fomenta la resolución independiente de problemas.'
    },
    icon: '⏱️'
  },
  
  minimal: {
    name: { en: 'Minimal Feedback', es: 'Feedback Mínimo' },
    description: {
      en: 'Only final score shown. Best for assessments and competitions.',
      es: 'Solo se muestra la puntuación final. Mejor para evaluaciones y competencias.'
    },
    icon: '📊'
  },
  
  detailed: {
    name: { en: 'Detailed Feedback', es: 'Feedback Detallado' },
    description: {
      en: 'Comprehensive analysis with suggestions and improvement areas. Ideal for training.',
      es: 'Análisis completo con sugerencias y áreas de mejora. Ideal para capacitación.'
    },
    icon: '📝'
  }
};

export const collaborationModes = {
  individual: {
    name: { en: 'Individual', es: 'Individual' },
    description: {
      en: 'Solo challenge. Each person works independently.',
      es: 'Desafío individual. Cada persona trabaja independientemente.'
    },
    icon: '👤'
  },
  
  pairs: {
    name: { en: 'Pairs', es: 'Parejas' },
    description: {
      en: 'Two people collaborate on the challenge.',
      es: 'Dos personas colaboran en el desafío.'
    },
    icon: '👥'
  },
  
  team: {
    name: { en: 'Team (3-5)', es: 'Equipo (3-5)' },
    description: {
      en: 'Small teams of 3-5 people work together.',
      es: 'Equipos pequeños de 3-5 personas trabajan juntos.'
    },
    icon: '👨‍👩‍👧‍👦'
  },
  
  department: {
    name: { en: 'Department', es: 'Departamento' },
    description: {
      en: 'Entire department collaborates. Great for large-scale training.',
      es: 'Todo el departamento colabora. Excelente para capacitación a gran escala.'
    },
    icon: '🏢'
  }
};

export const industryFocus = {
  marketing: {
    name: { en: 'Marketing & Advertising', es: 'Marketing y Publicidad' },
    skills: ['Brand consistency', 'Campaign creation', 'Target audience', 'Visual storytelling'],
    icon: '📢'
  },
  
  ecommerce: {
    name: { en: 'E-commerce & Retail', es: 'E-commerce y Retail' },
    skills: ['Product showcase', 'Lifestyle integration', 'Conversion optimization', 'Brand palette'],
    icon: '🛒'
  },
  
  education: {
    name: { en: 'Education & Training', es: 'Educación y Capacitación' },
    skills: ['Concept visualization', 'Instructional design', 'Learning objectives', 'Age-appropriate content'],
    icon: '📚'
  },
  
  tech: {
    name: { en: 'Technology & Software', es: 'Tecnología y Software' },
    skills: ['UI/UX design', 'Technical diagrams', 'Feature illustration', 'System architecture'],
    icon: '💻'
  },
  
  healthcare: {
    name: { en: 'Healthcare & Wellness', es: 'Salud y Bienestar' },
    skills: ['Medical accuracy', 'Patient education', 'Empathy focus', 'Compliance'],
    icon: '🏥'
  },
  
  realestate: {
    name: { en: 'Real Estate & Architecture', es: 'Bienes Raíces y Arquitectura' },
    skills: ['Space visualization', 'Lighting scenarios', 'Staging', 'Multiple perspectives'],
    icon: '🏠'
  },
  
  food: {
    name: { en: 'Food & Beverage', es: 'Alimentos y Bebidas' },
    skills: ['Food photography', 'Plating presentation', 'Ingredient focus', 'Ambiance'],
    icon: '🍽️'
  },
  
  design: {
    name: { en: 'Design & Creative', es: 'Diseño y Creatividad' },
    skills: ['Color theory', 'Composition', 'Visual hierarchy', 'Brand identity'],
    icon: '🎨'
  }
};

export const tournamentTypes = {
  single_elimination: {
    name: { en: 'Single Elimination', es: 'Eliminación Simple' },
    description: {
      en: 'Lose once and you\'re out. Fast-paced, high stakes. Best for quick competitions.',
      es: 'Pierdes una vez y quedas fuera. Ritmo rápido, alto riesgo. Mejor para competencias rápidas.'
    },
    participants: 'Powers of 2 (4, 8, 16, 32...)',
    duration: 'Short',
    icon: '🏆'
  },
  
  double_elimination: {
    name: { en: 'Double Elimination', es: 'Doble Eliminación' },
    description: {
      en: 'Get a second chance. Lose twice to be eliminated. More forgiving, longer tournament.',
      es: 'Tienes una segunda oportunidad. Pierdes dos veces para ser eliminado. Más indulgente, torneo más largo.'
    },
    participants: 'Powers of 2 (4, 8, 16, 32...)',
    duration: 'Medium',
    icon: '🎯'
  },
  
  round_robin: {
    name: { en: 'Round Robin', es: 'Todos contra Todos' },
    description: {
      en: 'Everyone plays everyone. Most fair and comprehensive. Best for smaller groups.',
      es: 'Todos juegan contra todos. Más justo y completo. Mejor para grupos pequeños.'
    },
    participants: 'Any number (best 4-12)',
    duration: 'Long',
    icon: '🔄'
  },
  
  swiss: {
    name: { en: 'Swiss System', es: 'Sistema Suizo' },
    description: {
      en: 'Paired by performance each round. No elimination. Great for large groups with limited time.',
      es: 'Emparejados por desempeño cada ronda. Sin eliminación. Excelente para grupos grandes con tiempo limitado.'
    },
    participants: 'Any number',
    duration: 'Medium',
    icon: '♟️'
  }
};

// Helper function to get recommended settings by industry
export function getRecommendedSettings(industryType) {
  const recommendations = {
    marketing: {
      challengeType: 'creativity',
      challengeMode: 'adaptive',
      scoringSystem: 'creativity_weighted',
      feedbackLevel: 'detailed',
      skills: ['Brand consistency', 'Visual storytelling', 'Target audience', 'Campaign creation']
    },
    ecommerce: {
      challengeType: 'standard',
      challengeMode: 'static',
      scoringSystem: 'accuracy_based',
      feedbackLevel: 'immediate',
      skills: ['Product showcase', 'Lifestyle integration', 'Color palette', 'Conversion focus']
    },
    education: {
      challengeType: 'concept_visualization',
      challengeMode: 'progressive',
      scoringSystem: 'custom_rubric',
      feedbackLevel: 'detailed',
      skills: ['Concept visualization', 'Learning objectives', 'Instructional design', 'Age-appropriate']
    },
    tech: {
      challengeType: 'technical_diagram',
      challengeMode: 'adaptive',
      scoringSystem: 'accuracy_based',
      feedbackLevel: 'detailed',
      skills: ['UI/UX design', 'Technical diagrams', 'System architecture', 'Feature illustration']
    },
    design: {
      challengeType: 'color_matching',
      challengeMode: 'progressive',
      scoringSystem: 'color_precision',
      feedbackLevel: 'immediate',
      skills: ['Color theory', 'Composition', 'Visual hierarchy', 'Brand identity']
    },
    healthcare: {
      challengeType: 'concept_visualization',
      challengeMode: 'static',
      scoringSystem: 'accuracy_based',
      feedbackLevel: 'detailed',
      skills: ['Medical accuracy', 'Patient education', 'Empathy focus', 'Compliance']
    },
    realestate: {
      challengeType: 'standard',
      challengeMode: 'adaptive',
      scoringSystem: 'accuracy_based',
      feedbackLevel: 'immediate',
      skills: ['Space visualization', 'Lighting scenarios', 'Staging', 'Multiple perspectives']
    },
    food: {
      challengeType: 'creativity',
      challengeMode: 'adaptive',
      scoringSystem: 'creativity_weighted',
      feedbackLevel: 'immediate',
      skills: ['Food photography', 'Plating presentation', 'Ingredient focus', 'Ambiance']
    }
  };
  
  return recommendations[industryType] || recommendations.marketing;
}
