import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const count = await prisma.task.count()
  return NextResponse.json({ count })
}
