import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

type Params = { params: Promise<{ id: string }> }

// 束ね候補を承認
// - candidateGroupId あり → 既存グループにタスクを追加（タイトル不要）
// - candidateTaskId あり  → 新規グループを作成してまとめる（タイトル必須）
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json() as { title?: string }

  const result = await prisma.$transaction(async (tx) => {
    const suggestion = await tx.groupSuggestion.findUnique({ where: { id } })
    if (!suggestion || suggestion.status !== 'pending') return null

    // ケース1: 既存グループへの追加
    if (suggestion.candidateGroupId) {
      await tx.task.update({
        where: { id: suggestion.newTaskId },
        data: { groupId: suggestion.candidateGroupId },
      })
      await tx.groupSuggestion.update({ where: { id }, data: { status: 'accepted' } })
      return tx.taskGroup.findUnique({ where: { id: suggestion.candidateGroupId } })
    }

    // ケース2: 新規グループ作成
    const { title } = body
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return 'TITLE_REQUIRED' as const
    }
    const created = await tx.taskGroup.create({ data: { title: title.trim() } })
    await tx.task.updateMany({
      where: { id: { in: [suggestion.newTaskId, suggestion.candidateTaskId!] } },
      data: { groupId: created.id },
    })
    await tx.groupSuggestion.update({ where: { id }, data: { status: 'accepted' } })
    return created
  })

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (result === 'TITLE_REQUIRED') return NextResponse.json({ error: 'title is required' }, { status: 400 })

  return NextResponse.json(result)
}
