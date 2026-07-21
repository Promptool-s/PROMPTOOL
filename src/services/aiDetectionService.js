/**
 * Chequeo de portapapeles — señal client-only para el anti-cheat.
 *
 * El resto de la detección de IA (comportamiento de tipeo, foco de ventana,
 * patrones de texto, historial) corre server-side dentro de POST /api/intentos
 * desde que se migró el submit de App.jsx (ver server/src/services/aiDetectionService.js).
 * Esta función queda del lado cliente porque necesita leer el portapapeles y
 * comparar píxeles vía canvas — no es algo que el servidor pueda hacer. El
 * resultado se manda como `clip_report` en el body y el server decide qué
 * hacer con la señal, nunca se usa acá para penalizar directamente.
 */

/**
 * Verifica si el portapapeles contiene una imagen y si se parece a la imagen del juego.
 * Usa canvas para comparar píxeles — detecta capturas de pantalla de la imagen.
 *
 * @param {string} gameImageUrl - URL de la imagen del juego actual
 * @returns {Promise<{ hasImage: boolean, similarToGame: boolean, similarity: number }>}
 */
export const checkClipboardForGameImage = async (gameImageUrl) => {
  const result = { hasImage: false, similarToGame: false, similarity: 0 }
  try {
    if (!navigator.clipboard?.read) return result

    const items = await navigator.clipboard.read()
    const imageItem = items.find(item =>
      item.types.some(t => t.startsWith('image/'))
    )
    if (!imageItem) return result

    result.hasImage = true

    if (!gameImageUrl) return result

    // Leer la imagen del clipboard como blob
    const imageType = imageItem.types.find(t => t.startsWith('image/'))
    const blob = await imageItem.getType(imageType)
    const clipboardBitmap = await createImageBitmap(blob)

    // Cargar la imagen del juego
    const gameImg = new Image()
    gameImg.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      gameImg.onload = resolve
      gameImg.onerror = reject
      gameImg.src = gameImageUrl
    })

    // Comparar en canvas pequeño (32x32 es suficiente para similitud perceptual)
    const SIZE = 32
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Píxeles de la imagen del juego
    ctx.drawImage(gameImg, 0, 0, SIZE, SIZE)
    const gamePixels = ctx.getImageData(0, 0, SIZE, SIZE).data

    // Píxeles del clipboard
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.drawImage(clipboardBitmap, 0, 0, SIZE, SIZE)
    const clipPixels = ctx.getImageData(0, 0, SIZE, SIZE).data

    // Diferencia media absoluta normalizada (0 = idéntico, 1 = completamente diferente)
    let totalDiff = 0
    const pixelCount = SIZE * SIZE
    for (let i = 0; i < clipPixels.length; i += 4) {
      const dr = Math.abs(gamePixels[i]     - clipPixels[i])
      const dg = Math.abs(gamePixels[i + 1] - clipPixels[i + 1])
      const db = Math.abs(gamePixels[i + 2] - clipPixels[i + 2])
      totalDiff += (dr + dg + db) / 3
    }
    const avgDiff = totalDiff / pixelCount
    const similarity = 1 - avgDiff / 255

    result.similarity = similarity
    // >60% de similitud = muy probable que sea la misma imagen (puede tener UI encima)
    result.similarToGame = similarity > 0.60

    clipboardBitmap.close()
  } catch {
    // fail open — no bloquear por error técnico
  }
  return result
}
