import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

type Params = { params: Promise<{ id: string }> }

const VALID_STATUSES = ['todo', 'doing', 'done'] as const
type TaskStatus = typeof VALID_STATUSES[number]

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json() as { status?: string; groupId?: string | null }

  if (body.status && !VALID_STATUSES.includes(body.status as TaskStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    // groupId: null はグループ脱退 → グループ自動解除ロジックを含むトランザクションで処理
    if (body.groupId === null) {
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.task.findUnique({ where: { id }, select: { groupId: true } })
        if (!current) throw Object.assign(new Error('Not found'), { code: 'P2025' })

        const task = await tx.task.update({ where: { id }, data: { groupId: null } })

        if (current.groupId) {
          const remaining = await tx.task.findMany({
            where: { groupId: current.groupId },
            select: { id: true },
          })
          if (remaining.length <= 1) {
            if (remaining.length === 1) {
              await tx.task.update({ where: { id: remaining[0].id }, data: { groupId: null } })
            }
            await tx.taskGroup.delete({ where: { id: current.groupId } })
          }
        }
        return task
      })
      return NextResponse.json(result)
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status as TaskStatus }),
        ...(body.groupId !== undefined && { groupId: body.groupId }),
      },
    })
    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'Not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw error
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id }, select: { groupId: true } })
      if (!task) throw Object.assign(new Error('Not found'), { code: 'P2025' })

      await tx.task.delete({ where: { id } })

      // グループに属していた場合、残タスクが1件以下ならグループを解除・削除
      if (task.groupId) {
        const remaining = await tx.task.findMany({
          where: { groupId: task.groupId },
          select: { id: true },
        })
        if (remaining.length <= 1) {
          if (remaining.length === 1) {
            await tx.task.update({ where: { id: remaining[0].id }, data: { groupId: null } })
          }
          await tx.taskGroup.delete({ where: { id: task.groupId } })
        }
      }
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'Not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw error
  }
}
