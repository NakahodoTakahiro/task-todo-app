import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const suggestions = await prisma.groupSuggestion.findMany({
    where: { status: 'pending' },
    include: {
      newTask: true,
      candidateTask: true,
      candidateGroup: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(suggestions)
}
