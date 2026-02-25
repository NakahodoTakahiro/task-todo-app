import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock は巻き上げられるため vi.hoisted で先に定義する
const { mockFindMany, mockCreateMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreateMany: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    task: { findMany: mockFindMany },
    groupSuggestion: { createMany: mockCreateMany },
  },
}))

import { createSuggestions } from '@/lib/db/suggestions'

const NEW_TASK_ID = 'new-task-id'
const REASON = 'テスト理由'

describe('createSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMany.mockResolvedValue({ count: 0 })
  })

  it('候補が空の場合は何もしない', async () => {
    await createSuggestions(NEW_TASK_ID, [], REASON)
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('実在するタスクが0件の場合は何もしない', async () => {
    mockFindMany.mockResolvedValue([])
    await createSuggestions(NEW_TASK_ID, ['nonexistent-id'], REASON)
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('類似タスクが全て同じグループ内 → グループで1件に集約', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'task-a', groupId: 'group-1' },
      { id: 'task-b', groupId: 'group-1' },
    ])

    await createSuggestions(NEW_TASK_ID, ['task-a', 'task-b'], REASON)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [{ newTaskId: NEW_TASK_ID, candidateGroupId: 'group-1', reason: REASON }],
      skipDuplicates: true,
    })
  })

  it('類似タスクが複数グループにまたがる → グループごとに1件ずつ', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'task-a', groupId: 'group-1' },
      { id: 'task-b', groupId: 'group-2' },
    ])

    await createSuggestions(NEW_TASK_ID, ['task-a', 'task-b'], REASON)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        { newTaskId: NEW_TASK_ID, candidateGroupId: 'group-1', reason: REASON },
        { newTaskId: NEW_TASK_ID, candidateGroupId: 'group-2', reason: REASON },
      ],
      skipDuplicates: true,
    })
  })

  it('類似タスクが全てグループ未所属 → タスク単位で個別に作成', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'task-a', groupId: null },
      { id: 'task-b', groupId: null },
    ])

    await createSuggestions(NEW_TASK_ID, ['task-a', 'task-b'], REASON)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        { newTaskId: NEW_TASK_ID, candidateTaskId: 'task-a', reason: REASON },
        { newTaskId: NEW_TASK_ID, candidateTaskId: 'task-b', reason: REASON },
      ],
      skipDuplicates: true,
    })
  })

  it('グループ内タスクとグループ未所属タスクが混在 → それぞれ別々に作成', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'task-a', groupId: 'group-1' },
      { id: 'task-b', groupId: null },
    ])

    await createSuggestions(NEW_TASK_ID, ['task-a', 'task-b'], REASON)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        { newTaskId: NEW_TASK_ID, candidateGroupId: 'group-1', reason: REASON },
        { newTaskId: NEW_TASK_ID, candidateTaskId: 'task-b', reason: REASON },
      ],
      skipDuplicates: true,
    })
  })

  it('同じグループに属する3件は1件に集約し、別グループと未所属はそれぞれ別々に作成', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'task-a', groupId: 'group-1' },
      { id: 'task-b', groupId: 'group-1' },
      { id: 'task-c', groupId: 'group-1' },
      { id: 'task-d', groupId: 'group-2' },
      { id: 'task-e', groupId: null },
    ])

    await createSuggestions(NEW_TASK_ID, ['task-a', 'task-b', 'task-c', 'task-d', 'task-e'], REASON)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        { newTaskId: NEW_TASK_ID, candidateGroupId: 'group-1', reason: REASON },
        { newTaskId: NEW_TASK_ID, candidateGroupId: 'group-2', reason: REASON },
        { newTaskId: NEW_TASK_ID, candidateTaskId: 'task-e', reason: REASON },
      ],
      skipDuplicates: true,
    })
  })
})
