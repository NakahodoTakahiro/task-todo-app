import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

type Params = { params: Promise<{ id: string }> }

// 束ね候補を承認 → タイトル入力でグループ作成・統合
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { title } = await req.json() as { title: string }

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const group = await prisma.$transaction(async (tx) => {
    const suggestion = await tx.groupSuggestion.findUnique({ where: { id } })
    if (!suggestion || suggestion.status !== 'pending') return null

    const created = await tx.taskGroup.create({ data: { title: title.trim() } })
    await tx.task.updateMany({
      where: { id: { in: [suggestion.newTaskId, suggestion.candidateTaskId] } },
      data: { groupId: created.id },
    })
    await tx.groupSuggestion.update({
      where: { id },
      data: { status: 'accepted' },
    })
    return created
  })

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(group)
}
