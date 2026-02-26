import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingEvent } from '@/lib/adapters/types'

// 全依存をモック
vi.mock('@/lib/db/messages')
vi.mock('@/lib/db/tasks')
vi.mock('@/lib/db/suggestions')
vi.mock('@/lib/llm/judge')

import { processWebhookEvent } from '@/lib/webhook-processor'
import { saveMessage, deleteMessage } from '@/lib/db/messages'
import { createTask, getRecentOpenTasks } from '@/lib/db/tasks'
import { createSuggestions } from '@/lib/db/suggestions'
import { judgeMessage } from '@/lib/llm/judge'

const mockSaveMessage = vi.mocked(saveMessage)
const mockDeleteMessage = vi.mocked(deleteMessage)
const mockCreateTask = vi.mocked(createTask)
const mockGetRecentOpenTasks = vi.mocked(getRecentOpenTasks)
const mockCreateSuggestions = vi.mocked(createSuggestions)
const mockJudgeMessage = vi.mocked(judgeMessage)

const EVENT: IncomingEvent = {
  source: 'slack',
  externalId: 'C123-1234567890.000100',
  senderName: 'yamada',
  body: '見積もりお願いします',
  permalink: 'https://slack.com/archives/C123/p1234567890000100',
  rawPayload: {},
}

const SAVED_MESSAGE = { id: 'msg-1', taskId: null }
const CREATED_TASK = { id: 'task-1', title: '見積もりお願いします' }

// fire-and-forget の内部処理が完了するまで待つ
async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('processWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRecentOpenTasks.mockResolvedValue([])
  })

  it('saveMessage が null を返す（重複）場合は以降の処理をスキップする', async () => {
    mockSaveMessage.mockResolvedValue(null)

    await processWebhookEvent(EVENT)
    await flushAsync()

    expect(mockJudgeMessage).not.toHaveBeenCalled()
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('actionable の場合は createTask と createSuggestions を呼ぶ', async () => {
    mockSaveMessage.mockResolvedValue(SAVED_MESSAGE as never)
    mockJudgeMessage.mockResolvedValue({
      judgment: 'actionable',
      reason: '明確な依頼',
      similar_task_ids: ['task-existing'],
    })
    mockCreateTask.mockResolvedValue(CREATED_TASK as never)
    mockCreateSuggestions.mockResolvedValue(undefined)

    await processWebhookEvent(EVENT)
    await flushAsync()

    expect(mockCreateTask).toHaveBeenCalledWith(
      EVENT.body.slice(0, 50),
      SAVED_MESSAGE.id
    )
    expect(mockCreateSuggestions).toHaveBeenCalledWith(
      CREATED_TASK.id,
      ['task-existing'],
      '明確な依頼'
    )
    expect(mockDeleteMessage).not.toHaveBeenCalled()
  })

  it('not_actionable の場合は deleteMessage を呼ぶ', async () => {
    mockSaveMessage.mockResolvedValue(SAVED_MESSAGE as never)
    mockJudgeMessage.mockResolvedValue({
      judgment: 'not_actionable',
      reason: '挨拶のみ',
      similar_task_ids: [],
    })
    mockDeleteMessage.mockResolvedValue(undefined as never)

    await processWebhookEvent(EVENT)
    await flushAsync()

    expect(mockDeleteMessage).toHaveBeenCalledWith(SAVED_MESSAGE.id)
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('uncertain の場合は createTask も deleteMessage も呼ばない', async () => {
    mockSaveMessage.mockResolvedValue(SAVED_MESSAGE as never)
    mockJudgeMessage.mockResolvedValue({
      judgment: 'uncertain',
      reason: '不明確',
      similar_task_ids: [],
    })

    await processWebhookEvent(EVENT)
    await flushAsync()

    expect(mockCreateTask).not.toHaveBeenCalled()
    expect(mockDeleteMessage).not.toHaveBeenCalled()
  })

  it('内部でエラーが起きても processWebhookEvent 自体は例外を投げない', async () => {
    mockSaveMessage.mockRejectedValue(new Error('DB error'))

    await expect(processWebhookEvent(EVENT)).resolves.toBeUndefined()
    await flushAsync()
  })

  it('getRecentOpenTasks の結果を judgeMessage に渡す', async () => {
    const existingTasks = [{ id: 'task-existing', title: '既存タスク', body: '本文' }]
    mockSaveMessage.mockResolvedValue(SAVED_MESSAGE as never)
    mockGetRecentOpenTasks.mockResolvedValue(existingTasks)
    mockJudgeMessage.mockResolvedValue({
      judgment: 'uncertain',
      reason: '...',
      similar_task_ids: [],
    })

    await processWebhookEvent(EVENT)
    await flushAsync()

    expect(mockJudgeMessage).toHaveBeenCalledWith(
      { source: EVENT.source, senderName: EVENT.senderName, body: EVENT.body },
      existingTasks
    )
  })
})
