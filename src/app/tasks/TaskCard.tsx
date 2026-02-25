'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Task = {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  groupId: string | null
  createdAt: string
  group: { id: string; title: string } | null
  messages: {
    source: string
    senderName: string
    body: string
    permalink: string | null
    receivedAt: string
  }[]
}

const STATUS_STYLES: Record<Task['status'], string> = {
  todo: 'bg-gray-100 text-gray-600',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

const SOURCE_STYLES: Record<string, string> = {
  slack: 'bg-purple-100 text-purple-700',
  chatwork: 'bg-sky-100 text-sky-700',
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

export default function TaskCard({ task, inGroup = false }: { task: Task; inGroup?: boolean }) {
  const router = useRouter()
  const [status, setStatus] = useState(task.status)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [leavingGroup, setLeavingGroup] = useState(false)

  const firstMessage = task.messages[0]

  async function handleStatusChange(newStatus: string) {
    const prev = status
    setSaving(true)
    setStatus(newStatus as Task['status'])
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('status update failed')
      window.dispatchEvent(new CustomEvent('task-status-change', { detail: { oldStatus: prev, newStatus } }))
    } catch {
      setStatus(prev)
      alert('ステータスの更新に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  async function handleLeaveGroup() {
    setLeavingGroup(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: null }),
      })
      if (!res.ok) throw new Error('leave group failed')
      router.refresh()
    } catch {
      setLeavingGroup(false)
      alert('グループの解除に失敗しました。')
    }
  }

  async function handleDelete() {
    if (!confirm(`「${task.title}」を削除しますか？`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      router.refresh()
    } catch {
      setDeleting(false)
      alert('削除に失敗しました。')
    }
  }

  return (
    <div className={`bg-white flex flex-col gap-4 transition-opacity p-5 ${inGroup ? '' : 'rounded-xl border shadow-sm'} ${deleting ? 'opacity-40' : ''}`}>
      {/* タイトル行 */}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-base font-medium leading-snug break-words min-w-0 flex-1 ${status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {!inGroup && task.group && (
            <span className="inline-block text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded mr-1.5 font-normal">
              {task.group.title}
            </span>
          )}
          {task.title}
        </p>
        <div className="flex items-center gap-2">
          {inGroup && (
            <button
              onClick={handleLeaveGroup}
              disabled={leavingGroup || deleting}
              className="shrink-0 text-xs font-medium px-3 py-1 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            >
              {leavingGroup ? '解除中…' : 'グループから外す'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting || leavingGroup}
            className="shrink-0 text-xs font-medium px-3 py-1 rounded-full border border-red-200 text-red-400 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
          >
            {deleting ? '削除中…' : '削除'}
          </button>
        </div>
      </div>

      {/* ソース・送信者 */}
      {firstMessage && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className={`rounded-full px-2 py-0.5 font-medium ${SOURCE_STYLES[firstMessage.source] ?? 'bg-gray-100 text-gray-600'}`}>
            {firstMessage.source}
          </span>
          <span className="truncate">{firstMessage.senderName}</span>
          <span suppressHydrationWarning className="ml-auto text-gray-400 shrink-0">{formatRelativeTime(firstMessage.receivedAt)}</span>
        </div>
      )}

      {/* ステータス・展開ボタン */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={saving}
          className={`text-xs px-2.5 py-1 rounded-full cursor-pointer font-medium border-0 outline-none ${STATUS_STYLES[status]}`}
        >
          <option value="todo">Todo</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
        {firstMessage && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium px-3 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            {expanded ? '閉じる ↑' : '元メッセージ ↓'}
          </button>
        )}
      </div>

      {/* インライン展開：元メッセージ */}
      {expanded && firstMessage && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-2">
          <p className="text-sm text-gray-700">「{firstMessage.body}」</p>
          {firstMessage.permalink && (
            <a
              href={firstMessage.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-blue-500 hover:text-blue-700"
            >
              {firstMessage.source === 'slack' ? 'Slack' : 'Chatwork'}で開く ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
