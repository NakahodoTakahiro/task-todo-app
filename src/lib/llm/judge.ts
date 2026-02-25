import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { buildPrompt, LLMResult } from './prompts'

const client = new Anthropic({ apiKey: env.anthropicApiKey })

type Message = {
  source: string
  senderName: string
  body: string
}

type ExistingTask = {
  id: string
  title: string
  body: string
}

export async function judgeMessage(
  message: Message,
  existingTasks: ExistingTask[]
): Promise<LLMResult> {
  const prompt = buildPrompt(message, existingTasks)

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[judge] Anthropic API call failed:', err)
    return {
      judgment: 'uncertain',
      reason: 'Anthropic API呼び出しに失敗したため uncertain として扱います',
      similar_task_ids: [],
    }
  }

  const block = response.content[0]
  const raw = block?.type === 'text' ? block.text : ''

  // ```json ... ``` のコードブロックを除去してからパース
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const result = JSON.parse(text) as LLMResult
    if (!['actionable', 'uncertain', 'not_actionable'].includes(result.judgment)) {
      throw new Error(`Invalid judgment value: ${result.judgment}`)
    }
    return result
  } catch (err) {
    console.error('[judge] JSON parse failed:', err, '/ raw text:', text)
    return {
      judgment: 'uncertain',
      reason: 'LLMレスポンスのパースに失敗したため uncertain として扱います',
      similar_task_ids: [],
    }
  }
}
