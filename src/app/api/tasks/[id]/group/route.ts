import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

type Params = { params: Promise<{ id: string }> }

// 新規グループを作成してTaskを紐づける
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { title, mergeTaskIds } = await req.json() as {
    title: string
    mergeTaskIds?: string[] // 既存Taskも同じグループにまとめる場合
  }

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.taskGroup.create({ data: { title: title.trim() } })
    const taskIds = [id, ...(mergeTaskIds ?? [])]
    await tx.task.updateMany({
      where: { id: { in: taskIds } },
      data: { groupId: created.id },
    })
    return created
  })

  return NextResponse.json(group)
}
