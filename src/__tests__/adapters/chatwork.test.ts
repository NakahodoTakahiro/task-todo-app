import { describe, it, expect } from 'vitest'
import { adaptChatworkEvent } from '@/lib/adapters/chatwork'

const BASE_PAYLOAD = {
  webhook_event_type: 'mention_to_me',
  webhook_event: {
    type: 'mention_to_me',
    message_id: '987654321',
    room_id: 111222,
    from_account_id: 11122288,
    to_account_id: 99887766,
    body: '[To:99887766] 資料送ってください',
    send_time: 1700000000,
  },
}

describe('adaptChatworkEvent', () => {
  it('source が chatwork になる', () => {
    expect(adaptChatworkEvent(BASE_PAYLOAD).source).toBe('chatwork')
  })

  it('externalId に message_id が文字列で入る', () => {
    expect(adaptChatworkEvent(BASE_PAYLOAD).externalId).toBe('987654321')
  })

  it('permalink が正しい形式になる', () => {
    expect(adaptChatworkEvent(BASE_PAYLOAD).permalink).toBe(
      'https://www.chatwork.com/#!rid111222-987654321'
    )
  })

  it('senderName に from_account_id が文字列変換されて入る', () => {
    expect(adaptChatworkEvent(BASE_PAYLOAD).senderName).toBe('11122288')
  })

  it('body から [To:数字] プレフィックスが除去される', () => {
    expect(adaptChatworkEvent(BASE_PAYLOAD).body).toBe('資料送ってください')
  })

  it('rawPayload に payload 全体が入る', () => {
    expect(adaptChatworkEvent(BASE_PAYLOAD).rawPayload).toEqual(BASE_PAYLOAD)
  })
})
