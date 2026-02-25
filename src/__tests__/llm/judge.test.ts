import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { anthropicApiKey: 'test-api-key' },
}))

const mockCreate = vi.hoisted(() => vi.fn())
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } }
  }),
}))

import { judgeMessage } from '@/lib/llm/judge'

const MESSAGE = { source: 'slack', senderName: 'yamada', body: '見積もりお願いします' }
const TASKS = [{ id: 'uuid-1', title: 'A社見積もり', body: 'A社の見積もりを作る' }]

function makeTextResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

describe('judgeMessage', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('actionable の結果を正しく返す', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse(
        JSON.stringify({ judgment: 'actionable', reason: '明確な依頼', similar_task_ids: ['uuid-1'] })
      )
    )
    const result = await judgeMessage(MESSAGE, TASKS)
    expect(result.judgment).toBe('actionable')
    expect(result.similar_task_ids).toEqual(['uuid-1'])
    expect(result.reason).toBe('明確な依頼')
  })

  it('uncertain の結果を正しく返す', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse(
        JSON.stringify({ judgment: 'uncertain', reason: '不明確', similar_task_ids: [] })
      )
    )
    const result = await judgeMessage(MESSAGE, [])
    expect(result.judgment).toBe('uncertain')
  })

  it('not_actionable の結果を正しく返す', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse(
        JSON.stringify({ judgment: 'not_actionable', reason: '挨拶のみ', similar_task_ids: [] })
      )
    )
    const result = await judgeMessage(MESSAGE, [])
    expect(result.judgment).toBe('not_actionable')
  })

  it('JSON パース失敗時は uncertain を返す', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('invalid json {{{'))
    const result = await judgeMessage(MESSAGE, [])
    expect(result.judgment).toBe('uncertain')
    expect(result.similar_task_ids).toEqual([])
  })

  it('不正な judgment 値の場合は uncertain を返す', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse(
        JSON.stringify({ judgment: 'INVALID', reason: '...', similar_task_ids: [] })
      )
    )
    const result = await judgeMessage(MESSAGE, [])
    expect(result.judgment).toBe('uncertain')
  })

  it('content が空配列の場合は uncertain を返す', async () => {
    mockCreate.mockResolvedValue({ content: [] })
    const result = await judgeMessage(MESSAGE, [])
    expect(result.judgment).toBe('uncertain')
  })

  it('content[0] が text 型でない場合は uncertain を返す', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }] })
    const result = await judgeMessage(MESSAGE, [])
    expect(result.judgment).toBe('uncertain')
  })

  it('API エラー時は uncertain にフォールバックする', async () => {
    mockCreate.mockRejectedValue(new Error('rate limit'))
    const result = await judgeMessage(MESSAGE, [])
    expect(result.judgment).toBe('uncertain')
  })
})
