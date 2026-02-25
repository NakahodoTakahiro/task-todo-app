import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth'

export function middleware(req: NextRequest) {
  if (!checkAuth(req.headers.get('authorization'))) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Mention-TODO"' },
    })
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    // _next（静的ファイル・内部）と favicon と api/webhooks は除外
    // api/webhooks は独自の署名検証があるため Basic Auth 不要
    '/((?!_next|favicon.ico|api/webhooks).*)',
  ],
}
