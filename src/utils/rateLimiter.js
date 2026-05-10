// Rate limiter para el chatbot empresarial
class RateLimiter {
  constructor() {
    this.requests = new Map() // userId -> { count, resetTime }
    this.maxRequests = 10 // máximo 10 requests por minuto
    this.windowMs = 60 * 1000 // 1 minuto
  }

  // Solo verificar sin consumir
  checkLimit(userId) {
    const now = Date.now()
    const userRequests = this.requests.get(userId)

    if (!userRequests || now > userRequests.resetTime) {
      return { allowed: true, remaining: this.maxRequests - 1 }
    }

    if (userRequests.count >= this.maxRequests) {
      const resetIn = Math.ceil((userRequests.resetTime - now) / 1000)
      return { 
        allowed: false, 
        remaining: 0, 
        resetIn,
        message: `Too many requests. Try again in ${resetIn} seconds.`
      }
    }

    return { 
      allowed: true, 
      remaining: this.maxRequests - userRequests.count - 1 
    }
  }

  canMakeRequest(userId) {
    const now = Date.now()
    const userRequests = this.requests.get(userId)

    if (!userRequests) {
      // Primera request del usuario
      this.requests.set(userId, { count: 1, resetTime: now + this.windowMs })
      return { allowed: true, remaining: this.maxRequests - 1 }
    }

    if (now > userRequests.resetTime) {
      // La ventana de tiempo se resetea
      this.requests.set(userId, { count: 1, resetTime: now + this.windowMs })
      return { allowed: true, remaining: this.maxRequests - 1 }
    }

    if (userRequests.count >= this.maxRequests) {
      // Límite alcanzado
      const resetIn = Math.ceil((userRequests.resetTime - now) / 1000)
      return { 
        allowed: false, 
        remaining: 0, 
        resetIn,
        message: `Too many requests. Try again in ${resetIn} seconds.`
      }
    }

    // Incrementar contador
    userRequests.count++
    this.requests.set(userId, userRequests)
    
    return { 
      allowed: true, 
      remaining: this.maxRequests - userRequests.count 
    }
  }

  // Limpiar requests antiguos para evitar memory leaks
  cleanup() {
    const now = Date.now()
    for (const [userId, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(userId)
      }
    }
  }
}

// Instancia global del rate limiter
export const chatRateLimiter = new RateLimiter()

// Limpiar cada 5 minutos
setInterval(() => {
  chatRateLimiter.cleanup()
}, 5 * 60 * 1000)