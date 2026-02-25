import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

type Params = { params: Promise<{ id: string }> }

// uncertainなMessageを手動でTask化する
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.message.findUnique({ where: { id } })
    if (!message) return { error: 'Not found', status: 404 } as const
    if (message.taskId) return { error: 'Already linked to a task', status: 400 } as const

    const task = await tx.task.create({
      data: { title: message.body.slice(0, 100) },
    })
    await tx.message.update({
      where: { id },
      data: { taskId: task.id },
    })
    return task
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
