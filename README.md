# 🧠 PROMPTOOL

> Adiviná el prompt. Dominá la IA

PROMPTOOL es un juego diario inspirado en Wordle donde el objetivo es recrear el prompt original de una imagen generada por IA.

Cada día se presenta una imagen y el usuario debe escribir el prompt que cree que la generó. Luego, una IA evalúa qué tan cerca estuvo y devuelve un puntaje junto con feedback detallado.

---

## Demo

https://promptool.vercel.app

---

## 🎯 ¿Cómo funciona?

1. Se muestra una imagen generada por IA  
2. El usuario escribe su prompt  
3. Se compara con el prompt original  
4. Se devuelve:
   - 🧮 Score (0–100)
   - 🧠 Explicación
   - 🛠️ Sugerencias de mejora  

---

## 🧩 Features

- 🎮 Gameplay tipo Wordle (1 desafío por día)
- 🖼️ Imágenes precargadas desde JSON
- 🤖 Evaluación automática con IA (Gemini)
- 📊 Feedback detallado en lenguaje natural
- ⚡ Frontend rápido con Vite + React

---


El proyecto consiste en una aplicación interactiva basada en inteligencia artificial que combina juego, aprendizaje y evaluación de habilidades en el uso de prompts. Su núcleo es una dinámica tipo “Wordle”, donde cada día se presenta una imagen generada por IA y los usuarios deben intentar recrear el prompt original que la generó.

La aplicación contempla dos tipos principales de usuarios. Por un lado, está el usuario recreativo, que puede participar en desafíos diarios o jugar en modo libre (random) tantas veces como quiera. Este perfil está orientado al entretenimiento y al aprendizaje autodidacta, permitiendo a las personas mejorar su capacidad para escribir prompts efectivos mediante práctica constante y feedback inmediato.

Por otro lado, existe un perfil orientado a empresas o instituciones, bajo un modelo pago. Este tipo de usuario puede configurar completamente la plataforma: crear desafíos personalizados, gestionar múltiples usuarios, definir objetivos, establecer niveles de dificultad, tipos de actividades y otras preferencias según sus necesidades. Estas configuraciones pueden ajustarse dinámicamente desde un panel de organización, el cual se adapta según el plan de pago contratado.

El sistema utiliza inteligencia artificial para analizar la similitud entre el prompt original y el ingresado por el usuario, evaluando no solo coincidencias textuales, sino también aspectos semánticos como los elementos visuales, el estilo, la atmósfera y los detalles técnicos. A partir de este análisis, se genera un puntaje acompañado de una explicación detallada y sugerencias concretas de mejora.

Cada usuario cuenta con un perfil propio dentro de la plataforma, donde puede visualizar sus estadísticas (rendimiento, evolución, puntajes), las guías que ha consultado y los certificados que ha obtenido. Estas estadísticas no solo se acumulan a nivel personal, sino que están diseñadas para ser reutilizables y visibles en distintos contextos: tanto en su perfil individual como dentro de las organizaciones a las que pertenece.

Un mismo usuario puede formar parte de múltiples compañías o instituciones, manteniendo un historial de desempeño independiente pero integrable. Esto permite que diferentes organizaciones puedan evaluar su progreso dentro de sus propios entornos, sin perder la trazabilidad global del usuario.

En particular, las guías cumplen un rol clave: no son genéricas, sino que son recomendadas dinámicamente por la aplicación en función del desempeño del usuario. Es decir, el sistema detecta en qué aspectos el usuario tiene más dificultades (por ejemplo, falta de detalle, problemas con estilo o iluminación) y le sugiere contenido específico para mejorar esas áreas. De esta manera, la plataforma no solo evalúa, sino que también forma activamente al usuario.

En el caso de empresas, esta información permite visualizar claramente el progreso de cada persona, identificar fortalezas y debilidades, y acompañar procesos de capacitación con datos concretos. Incluso puede utilizarse como criterio objetivo en evaluaciones de desempeño o selección de candidatos.

En resumen, el proyecto es una plataforma híbrida que une gamificación, inteligencia artificial y formación personalizada, permitiendo tanto a usuarios individuales aprender de forma práctica como a organizaciones medir, entrenar y optimizar las habilidades de sus equipos en el uso de prompts, con un sistema flexible de gestión, análisis y personalización.