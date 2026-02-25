import { prisma } from './prisma'

export async function createSuggestions(newTaskId: string, candidateTaskIds: string[], reason: string) {
  if (candidateTaskIds.length === 0) return

  // LLMが存在しないIDを返す可能性があるため、実在するIDのみに絞る
  const existing = await prisma.task.findMany({
    where: { id: { in: candidateTaskIds } },
    select: { id: true },
  })
  const validIds = existing.map((t) => t.id)
  if (validIds.length === 0) return

  await prisma.groupSuggestion.createMany({
    data: validIds.map((candidateTaskId) => ({
      newTaskId,
      candidateTaskId,
      reason,
    })),
    skipDuplicates: true,
  })
}
