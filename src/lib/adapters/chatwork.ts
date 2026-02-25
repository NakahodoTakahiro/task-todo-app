import { IncomingEvent } from './types'

type ChatworkWebhookPayload = {
  webhook_event: {
    type: string
    message_id: string
    room_id: number
    from_account_id: number
    to_account_id: number
    body: string
    send_time: number
  }
  webhook_event_type: string
}

export function adaptChatworkEvent(
  payload: ChatworkWebhookPayload,
  options?: { senderName?: string }
): IncomingEvent {
  const { webhook_event } = payload
  const permalink = `https://www.chatwork.com/#!rid${webhook_event.room_id}-${webhook_event.message_id}`

  return {
    source: 'chatwork',
    externalId: String(webhook_event.message_id),
    senderName: options?.senderName ?? String(webhook_event.from_account_id),
    body: webhook_event.body.replace(/\[To:\d+\]\S*\s*/g, '').trim(),
    permalink,
    rawPayload: payload as Record<string, unknown>,
  }
}
