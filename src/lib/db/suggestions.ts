import { prisma } from './prisma'

export async function createSuggestions(newTaskId: string, candidateTaskIds: string[], reason: string) {
  if (candidateTaskIds.length === 0) return

  // LLMが存在しないIDを返す可能性があるため、実在するタスク（グループ情報含む）を取得
  const existingTasks = await prisma.task.findMany({
    where: { id: { in: candidateTaskIds } },
    select: { id: true, groupId: true },
  })
  if (existingTasks.length === 0) return

  // グループに属するタスクは groupId 単位で集約（同グループの複数タスク → 1件）
  const seenGroupIds = new Set<string>()
  const groupData: { newTaskId: string; candidateGroupId: string; reason: string }[] = []
  const taskData: { newTaskId: string; candidateTaskId: string; reason: string }[] = []

  for (const task of existingTasks) {
    if (task.groupId) {
      if (!seenGroupIds.has(task.groupId)) {
        seenGroupIds.add(task.groupId)
        groupData.push({ newTaskId, candidateGroupId: task.groupId, reason })
      }
    } else {
      taskData.push({ newTaskId, candidateTaskId: task.id, reason })
    }
  }

  const allData = [...groupData, ...taskData]
  if (allData.length === 0) return

  await prisma.groupSuggestion.createMany({
    data: allData,
    skipDuplicates: true,
  })
}
