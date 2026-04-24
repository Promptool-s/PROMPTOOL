export default async function handler(req, res) {
  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  let targetUrl
  try {
    targetUrl = decodeURIComponent(url)
    new URL(targetUrl) // valida que sea una URL válida
  } catch {
    return res.status(400).json({ error: 'Invalid url' })
  }

  // Solo permitir http/https
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'Only http/https allowed' })
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        // Simular un browser para evitar bloqueos por user-agent
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
        'Accept': 'image/*,*/*',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Solo permitir content-types de imagen
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'URL is not an image' })
    }

    const buffer = await response.arrayBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400') // cache 24h
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).send(Buffer.from(buffer))
  } catch (err) {
    console.error('img-proxy error:', err)
    res.status(500).json({ error: 'Proxy error' })
  }
}
