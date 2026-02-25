import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      messages: { orderBy: { receivedAt: 'asc' } },
      group: true,
    },
  })
  return NextResponse.json(tasks)
}
