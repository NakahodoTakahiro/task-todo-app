'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Message = {
  id: string
  source: 'slack' | 'chatwork'
  senderName: string
  body: string
  permalink: string | null
  receivedAt: string
}

type Task = {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  memo: string | null
  group: { id: string; title: string } | null
  message: Message | null
}

const STATUS_COLORS: Record<Task['status'], string> = {
  todo: 'bg-gray-100 text-gray-600',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨日'
  return `${days}日前`
}

export default function TaskDetail({ task }: { task: Task }) {
  const router = useRouter()
  const [status, setStatus] = useState(task.status)
  const [statusSaving, setStatusSaving] = useState(false)
  const [memo, setMemo] = useState(task.memo ?? '')
  const [memoSaving, setMemoSaving] = useState(false)
  const [memoSaved, setMemoSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleStatusChange(newStatus: string) {
    const prev = status
    setStatusSaving(true)
    setStatus(newStatus as Task['status'])
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('status update failed')
    } catch {
      setStatus(prev)
      alert('ステータスの更新に失敗しました。')
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleMemoSave() {
    setMemoSaving(true)
    setMemoSaved(false)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo }),
      })
      if (!res.ok) throw new Error('memo save failed')
      setMemoSaved(true)
    } catch {
      alert('メモの保存に失敗しました。')
    } finally {
      setMemoSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`「${task.title}」を削除しますか？`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      router.push('/tasks')
    } catch {
      setDeleting(false)
      alert('削除に失敗しました。')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 border-b bg-white px-4 py-3">
        <Link href="/tasks" className="text-sm text-gray-500 hover:text-gray-700">
          ← 一覧に戻る
        </Link>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4">
        {/* タイトル・ステータス・削除 */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-base font-bold leading-snug text-gray-800">
              {task.group && (
                <span className="mr-2 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-xs font-normal text-purple-700">
                  {task.group.title}
                </span>
              )}
              {task.title}
            </h1>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="shrink-0 text-xs text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
            >
              削除
            </button>
          </div>
          <div className="mt-2">
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusSaving}
              className={`cursor-pointer rounded border-0 px-2 py-1 text-xs font-medium outline-none ${STATUS_COLORS[status]}`}
            >
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>
          </div>
        </div>

        {/* メモ */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            メモ
          </h2>
          <textarea
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value)
              setMemoSaved(false)
            }}
            placeholder="自由にメモを残せます"
            rows={4}
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="mt-1 flex items-center justify-end gap-2">
            {memoSaved && <span className="text-xs text-green-500">保存しました</span>}
            <button
              onClick={handleMemoSave}
              disabled={memoSaving}
              className="rounded bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </section>

        {/* 紐づくメッセージ */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            紐づくメッセージ
          </h2>
          {!task.message ? (
            <p className="text-sm text-gray-400">メッセージはありません</p>
          ) : (
            <div className="rounded-lg border bg-white px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                    {task.message.source}
                  </span>
                  <span className="text-xs text-gray-500">{task.message.senderName}</span>
                  <span suppressHydrationWarning className="text-xs text-gray-400">
                    {formatRelativeTime(task.message.receivedAt)}
                  </span>
                </div>
                {task.message.permalink && (
                  <a
                    href={task.message.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-blue-500 hover:text-blue-700"
                  >
                    {task.message.source === 'slack' ? 'Slackで開く' : 'Chatworkで開く'} ↗
                  </a>
                )}
              </div>
              <p className="text-sm text-gray-800">「{task.message.body}」</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
