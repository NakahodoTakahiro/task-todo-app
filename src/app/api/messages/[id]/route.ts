import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { deleteMessage } from '@/lib/db/messages'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await deleteMessage(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw error
  }
}
