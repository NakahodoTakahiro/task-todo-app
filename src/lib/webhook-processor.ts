import { IncomingEvent } from './adapters/types'
import { saveMessage, deleteMessage, setMessageProcessed } from './db/messages'
import { createTask, getRecentOpenTasks } from './db/tasks'
import { createSuggestions } from './db/suggestions'
import { judgeMessage } from './llm/judge'

export async function processWebhookEvent(event: IncomingEvent): Promise<void> {
  // fire-and-forget: 保存・LLM判定を全て非同期で実行
  void (async () => {
    try {
      // 1. Messageを保存（isProcessing: true で保存。重複時はnullが返る）
      const message = await saveMessage(event)
      if (!message) return

      // 2. LLM判定（同一ソースのタスクのみを類似検索対象にする）
      const existingTasks = await getRecentOpenTasks(30, event.source)
      const result = await judgeMessage(
        { source: event.source, senderName: event.senderName, body: event.body },
        existingTasks
      )

      if (result.judgment === 'not_actionable') {
        await deleteMessage(message.id)
        return
      }

      if (result.judgment === 'actionable') {
        const task = await createTask(event.body.slice(0, 50), message.id)
        await createSuggestions(task.id, result.similar_task_ids, result.reason)
      }

      // uncertain / actionable 共通: LLM処理完了を記録（uncertain はここで初めてバッジに表示される）
      await setMessageProcessed(message.id)
    } catch (error) {
      console.error('[webhook-processor] processing failed:', error)
    }
  })()
}
