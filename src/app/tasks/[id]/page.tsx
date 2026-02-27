import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import TaskDetail from './TaskDetail'

type Params = { params: Promise<{ id: string }> }

export default async function TaskDetailPage({ params }: Params) {
  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      message: true,
      group: true,
    },
  })

  if (!task) notFound()

  const serialized = {
    id: task.id,
    title: task.title,
    status: task.status,
    memo: task.memo,
    group: task.group ? { id: task.group.id, title: task.group.title } : null,
    message: task.message ? {
      id: task.message.id,
      source: task.message.source,
      senderName: task.message.senderName,
      body: task.message.body,
      permalink: task.message.permalink,
      receivedAt: task.message.receivedAt.toISOString(),
    } : null,
  }

  return <TaskDetail task={serialized} />
}
