import { describe, it, expect } from 'vitest'
import { buildPrompt } from '@/lib/llm/prompts'

const MESSAGE = { source: 'slack', senderName: 'yamada', body: '見積もりお願いします' }

describe('buildPrompt', () => {
  it('既存タスクがない場合に "（なし）" が含まれる', () => {
    const prompt = buildPrompt(MESSAGE, [])
    expect(prompt).toContain('（なし）')
  })

  it('メッセージのソース・送信者・本文がプロンプトに含まれる', () => {
    const prompt = buildPrompt(MESSAGE, [])
    expect(prompt).toContain('slack')
    expect(prompt).toContain('yamada')
    expect(prompt).toContain('見積もりお願いします')
  })

  it('既存タスクがある場合にそのidとtitleが含まれる', () => {
    const tasks = [
      { id: 'uuid-1', title: 'A社見積もり', body: 'A社の見積もりを作る' },
      { id: 'uuid-2', title: 'B社対応', body: 'B社の返信をする' },
    ]
    const prompt = buildPrompt(MESSAGE, tasks)
    expect(prompt).toContain('uuid-1')
    expect(prompt).toContain('A社見積もり')
    expect(prompt).toContain('uuid-2')
    expect(prompt).toContain('B社対応')
  })

  it('出力形式の指示（JSON）がプロンプトに含まれる', () => {
    const prompt = buildPrompt(MESSAGE, [])
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('judgment')
    expect(prompt).toContain('similar_task_ids')
  })

  it('actionable / uncertain / not_actionable の選択肢がプロンプトに含まれる', () => {
    const prompt = buildPrompt(MESSAGE, [])
    expect(prompt).toContain('actionable')
    expect(prompt).toContain('uncertain')
    expect(prompt).toContain('not_actionable')
  })
})
