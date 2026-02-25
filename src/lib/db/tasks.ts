import { MessageSource } from '@prisma/client'
import { prisma } from './prisma'

export async function createTask(title: string, messageId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({ data: { title } })
    await tx.message.update({
      where: { id: messageId },
      data: { taskId: task.id },
    })
    return task
  })
}

export async function getRecentOpenTasks(limit = 30, source?: string) {
  const sourceEnum = source as MessageSource | undefined
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'done' },
      ...(sourceEnum ? { messages: { some: { source: sourceEnum } } } : {}),
    },
    include: {
      messages: {
        ...(sourceEnum ? { where: { source: sourceEnum } } : {}),
        take: 1,
        orderBy: { receivedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    body: t.messages[0]?.body ?? '',
  }))
}
