export type MessageSource = 'slack' | 'chatwork'

export type IncomingEvent = {
  source: MessageSource
  externalId: string
  senderName: string
  body: string
  permalink: string | null
  rawPayload: Record<string, unknown>
}
