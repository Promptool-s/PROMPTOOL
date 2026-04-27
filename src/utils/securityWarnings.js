/**
 * Security warnings for development mode.
 *
 * VITE_ prefixed env vars are bundled into the client-side JavaScript and
 * are visible to anyone who inspects the built assets. This is fine for
 * public keys (Supabase anon key, public URLs) but is a critical secret
 * leak for API keys that should only be used server-side.
 *
 * Long-term fix: move Groq/AI calls to a Vercel serverless function so the
 * key lives in a server-side environment variable (no VITE_ prefix) and is
 * never shipped to the browser.
 */

export function warnExposedSecrets() {
  if (import.meta.env.DEV && import.meta.env.VITE_GROQ_API_KEY) {
    console.warn(
      '[Security] VITE_GROQ_API_KEY is set with a VITE_ prefix, which means it ' +
      'will be bundled into the client-side JavaScript and exposed to all users. ' +
      'Move AI evaluation calls to a server-side API route (e.g. /api/evaluate) ' +
      'and store the key as GROQ_API_KEY (no VITE_ prefix) in your Vercel ' +
      'environment variables.'
    )
  }
}
