import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'
import { adaptSlackEvent } from '@/lib/adapters/slack'
import { processWebhookEvent } from '@/lib/webhook-processor'

function verifySlackSignature(req: NextRequest, body: string): boolean {
  const timestamp = req.headers.get('x-slack-request-timestamp')
  const signature = req.headers.get('x-slack-signature')
  if (!timestamp || !signature) return false

  // タイムスタンプが5分以上古い場合は拒否
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) return false

  const sigBase = `v0:${timestamp}:${body}`
  const expected = `v0=${createHmac('sha256', env.slackSigningSecret).update(sigBase).digest('hex')}`

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return timingSafeEqual(sigBuf, expBuf)
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifySlackSignature(req, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  type SlackRawPayload = {
    type: string
    challenge?: string
    event?: { type: string; subtype?: string; text?: string }
  }

  let payload: SlackRawPayload
  try {
    payload = JSON.parse(body) as SlackRawPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // message イベントのうち、自分へのメンションを含むもののみ処理
  // bot_message サブタイプは除外（ボット自身の発言を拾わない）
  const isUserMention =
    payload.type === 'event_callback' &&
    payload.event?.type === 'message' &&
    payload.event?.subtype !== 'bot_message' &&
    payload.event?.text?.includes(`<@${env.slackUserId}>`)

  if (isUserMention) {
    // 送信者のユーザー名を Slack API で解決する（失敗時はユーザーIDにフォールバック）
    const rawPayload = payload as unknown as Parameters<typeof adaptSlackEvent>[0]
    const userId = rawPayload.event.user
    let senderName = userId
    if (env.slackBotToken) {
      try {
        const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
          headers: { Authorization: `Bearer ${env.slackBotToken}` },
        })
        const data = await res.json() as { ok: boolean; user?: { profile?: { display_name?: string; real_name?: string } } }
        if (data.ok && data.user?.profile) {
          senderName = data.user.profile.display_name || data.user.profile.real_name || userId
        }
      } catch {
        // フォールバック: ユーザーID をそのまま使う
      }
    }
    // <@ユーザーID> を本文から除去してすっきり表示する
    const cleanBody = rawPayload.event.text
      .replace(new RegExp(`<@${env.slackUserId}>`, 'g'), '')
      .trim()
    const event = adaptSlackEvent(rawPayload, { senderName, body: cleanBody })
    void processWebhookEvent(event)
  }

  return NextResponse.json({ ok: true })
}
