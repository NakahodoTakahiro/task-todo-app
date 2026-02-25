import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'
import { adaptChatworkEvent } from '@/lib/adapters/chatwork'
import { processWebhookEvent } from '@/lib/webhook-processor'

function verifyChatworkSignature(req: NextRequest, body: string): boolean {
  const signature = req.nextUrl.searchParams.get('chatwork_webhook_signature')
  if (!signature) return false

  const key = Buffer.from(env.chatworkWebhookToken, 'base64')
  const expected = createHmac('sha256', key)
    .update(body)
    .digest('base64')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return timingSafeEqual(sigBuf, expBuf)
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifyChatworkSignature(req, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  type ChatworkRawPayload = {
    webhook_event_type: string
    webhook_event: Record<string, unknown>
  }

  let payload: ChatworkRawPayload
  try {
    payload = JSON.parse(body) as ChatworkRawPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.webhook_event_type === 'mention_to_me') {
    const rawPayload = payload as Parameters<typeof adaptChatworkEvent>[0]
    const accountId = rawPayload.webhook_event.from_account_id
    const roomId = rawPayload.webhook_event.room_id
    let senderName = String(accountId)

    if (env.chatworkApiToken) {
      try {
        const res = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/members`, {
          headers: { 'X-ChatWorkToken': env.chatworkApiToken },
        })
        const members = await res.json() as { account_id: number; name: string }[]
        const member = members.find((m) => m.account_id === accountId)
        if (member) senderName = member.name
      } catch {
        // フォールバック: account_id をそのまま使う
      }
    }

    const event = adaptChatworkEvent(rawPayload, { senderName })
    void processWebhookEvent(event)
  }

  return NextResponse.json({ ok: true })
}
