export type LLMJudgment = 'actionable' | 'uncertain' | 'not_actionable'

export type LLMResult = {
  judgment: LLMJudgment
  reason: string
  similar_task_ids: string[]
}

type ExistingTask = {
  id: string
  title: string
  body: string
}

export function buildPrompt(
  message: { source: string; senderName: string; body: string },
  existingTasks: ExistingTask[]
): string {
  const tasksText =
    existingTasks.length === 0
      ? '（なし）'
      : existingTasks
          .map((t) => `- id: ${t.id}\n  title: ${t.title}\n  body: ${t.body}`)
          .join('\n')

  return `あなたはチャットメンションを分析するアシスタントです。

## 新着メッセージ
- ソース: ${message.source}
- 送信者: ${message.senderName}
- 本文: ${message.body}

## 既存の未完了タスク（直近30件）
${tasksText}

## 指示
以下の2点を判定してください。

### 1. 依頼判定
このメッセージは対応が必要な依頼・確認・アクションを含むか？

判定基準:
- "not_actionable": 完全に明らかな感謝・挨拶・リアクションのみ（例:「ありがとう」「お疲れ様」「了解です」）
- "actionable": 依頼・指示・確認依頼が明確なもの（例:「〜してください」「〜確認してもらえますか」）
- "uncertain": 少しでも迷ったら全てこちら（例:「例のやつどうなってる？」「よろしく」）

### 2. 類似タスク検索（judgmentがactionableの場合のみ）
既存タスクの中に同じ依頼と思われるものがあれば、そのIDを返す。

## 出力形式
必ずJSON形式のみで返してください。マークダウンのコードブロック（\`\`\`json）や説明文は不要です。JSONオブジェクトだけを出力してください。

{
  "judgment": "actionable" | "uncertain" | "not_actionable",
  "reason": "判定理由を1文で",
  "similar_task_ids": ["uuid", ...] // 類似タスクがなければ空配列
}`
}
