import { IncomingEvent } from './types'

type SlackEventPayload = {
  event: {
    type: string
    ts: string
    user: string
    text: string
    channel: string
  }
}

export function adaptSlackEvent(
  payload: SlackEventPayload,
  options?: { senderName?: string; body?: string }
): IncomingEvent {
  const { event } = payload
  const permalink = `https://slack.com/archives/${event.channel}/p${event.ts.replace('.', '')}`

  return {
    source: 'slack',
    externalId: `${event.channel}-${event.ts}`,
    senderName: options?.senderName ?? event.user,
    body: options?.body ?? event.text,
    permalink,
    rawPayload: payload as Record<string, unknown>,
  }
}
