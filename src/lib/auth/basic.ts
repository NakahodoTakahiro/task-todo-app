import { env } from '@/lib/env'

// Edge Runtime では Node.js crypto が使えないため、XOR による定数時間比較を実装
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export function checkBasicAuth(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false

  let decoded: string
  try {
    // atob は Edge Runtime で使用可能なWeb API
    decoded = atob(authHeader.slice(6))
  } catch {
    return false
  }

  const colonIdx = decoded.indexOf(':')
  if (colonIdx === -1) return false

  const user = decoded.slice(0, colonIdx)
  const password = decoded.slice(colonIdx + 1)

  const expectedUser = env.basicAuthUser
  const expectedPassword = env.basicAuthPassword

  return safeEqual(user, expectedUser) && safeEqual(password, expectedPassword)
}
