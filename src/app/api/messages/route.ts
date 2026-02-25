import { NextResponse } from 'next/server'
import { getUncertainMessages } from '@/lib/db/messages'

export async function GET() {
  const messages = await getUncertainMessages()
  return NextResponse.json(messages)
}
