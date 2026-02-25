import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { IncomingEvent } from '@/lib/adapters/types'

// 重複時（P2002）は null を返す（Slack のリトライ等で正常に起こりうる）
export async function saveMessage(event: IncomingEvent) {
  try {
    return await prisma.message.create({
      data: {
        source: event.source,
        externalId: event.externalId,
        senderName: event.senderName,
        body: event.body,
        permalink: event.permalink,
        rawPayload: event.rawPayload as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return null
    }
    throw error
  }
}


export async function deleteMessage(messageId: string) {
  return prisma.message.delete({ where: { id: messageId } })
}

export async function setMessageProcessed(messageId: string) {
  return prisma.message.update({ where: { id: messageId }, data: { isProcessing: false } })
}

export async function getUncertainMessages() {
  return prisma.message.findMany({
    where: { taskId: null, isProcessing: false },
    orderBy: { receivedAt: 'desc' },
  })
}
