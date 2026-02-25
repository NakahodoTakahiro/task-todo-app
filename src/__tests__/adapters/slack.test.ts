import { describe, it, expect } from 'vitest'
import { adaptSlackEvent } from '@/lib/adapters/slack'

const BASE_PAYLOAD = {
  event: {
    type: 'app_mention',
    ts: '1234567890.123456',
    user: 'U1234567',
    text: '<@BOT123> 見積もりお願いします',
    channel: 'C1234567',
  },
}

describe('adaptSlackEvent', () => {
  it('source が slack になる', () => {
    expect(adaptSlackEvent(BASE_PAYLOAD).source).toBe('slack')
  })

  it('externalId が "channel-ts" の形式になる', () => {
    expect(adaptSlackEvent(BASE_PAYLOAD).externalId).toBe('C1234567-1234567890.123456')
  })

  it('permalink の ts の . が除去された形式になる', () => {
    expect(adaptSlackEvent(BASE_PAYLOAD).permalink).toBe(
      'https://slack.com/archives/C1234567/p1234567890123456'
    )
  })

  it('senderName に event.user が入る', () => {
    expect(adaptSlackEvent(BASE_PAYLOAD).senderName).toBe('U1234567')
  })

  it('body に event.text が入る', () => {
    expect(adaptSlackEvent(BASE_PAYLOAD).body).toBe('<@BOT123> 見積もりお願いします')
  })

  it('rawPayload に payload 全体が入る', () => {
    expect(adaptSlackEvent(BASE_PAYLOAD).rawPayload).toEqual(BASE_PAYLOAD)
  })

  it('ts に . が複数あっても最初の1つだけ除去される', () => {
    const payload = { event: { ...BASE_PAYLOAD.event, ts: '1111111111.000200' } }
    expect(adaptSlackEvent(payload).permalink).toBe(
      'https://slack.com/archives/C1234567/p1111111111000200'
    )
  })
})
