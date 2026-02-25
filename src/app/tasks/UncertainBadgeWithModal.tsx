'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type UncertainMessage = {
  id: string
  source: 'slack' | 'chatwork'
  senderName: string
  body: string
  receivedAt: string
  permalink: string | null
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

export default function UncertainBadgeWithModal({ initialCount }: { initialCount: number }) {
  const router = useRouter()
  const [count, setCount] = useState(initialCount)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<UncertainMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [taskifying, setTaskifying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bulkTaskifying, setBulkTaskifying] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // router.refresh() 後にサーバーから新しい initialCount が来たら同期する
  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  // モーダルが閉じている間、10秒ごとに件数をポーリングして自動更新する
  useEffect(() => {
    if (open) return
    const poll = async () => {
      try {
        const res = await fetch('/api/messages')
        if (!res.ok) return
        const data = await res.json() as UncertainMessage[]
        setCount(data.length)
      } catch {
        // ポーリング失敗は無視
      }
    }
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [open])

  async function handleOpen() {
    setOpen(true)
    setLoading(true)
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json() as UncertainMessage[]
      setMessages(data)
    } catch {
      alert('メッセージの取得に失敗しました。')
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setMessages([])
  }

  async function handleTaskify(id: string) {
    setTaskifying(id)
    try {
      const res = await fetch(`/api/messages/${id}/taskify`, { method: 'POST' })
      if (!res.ok) throw new Error('taskify failed')
      setMessages((prev) => prev.filter((m) => m.id !== id))
      setCount((prev) => prev - 1)
      router.refresh()
    } catch {
      alert('Taskの作成に失敗しました。')
    } finally {
      setTaskifying(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('このメッセージを削除しますか？\n削除すると元に戻せません。')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setMessages((prev) => prev.filter((m) => m.id !== id))
      setCount((prev) => prev - 1)
      router.refresh()
    } catch {
      alert('削除に失敗しました。')
    } finally {
      setDeleting(null)
    }
  }

  async function handleBulkDelete() {
    if (!window.confirm(`未確認メッセージ ${messages.length}件を全て削除しますか？\n削除すると元に戻せません。`)) return
    setBulkDeleting(true)
    try {
      for (const m of messages) {
        const res = await fetch(`/api/messages/${m.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('delete failed')
      }
      setMessages([])
      setCount(0)
      router.refresh()
    } catch {
      alert('一括削除に失敗しました。')
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleBulkTaskify() {
    if (!window.confirm(`未確認メッセージ ${messages.length}件を全てタスク化しますか？`)) return
    setBulkTaskifying(true)
    try {
      for (const m of messages) {
        const res = await fetch(`/api/messages/${m.id}/taskify`, { method: 'POST' })
        if (!res.ok) throw new Error('taskify failed')
      }
      setMessages([])
      setCount(0)
      router.refresh()
    } catch {
      alert('一括タスク化に失敗しました。')
    } finally {
      setBulkTaskifying(false)
    }
  }

  // モーダルを閉じている状態でかつ件数が0なら非表示
  if (count === 0 && !open) return null

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
      >
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </span>
        🔔 未確認 {count}件
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          {/* モーダル本体 */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                未確認メッセージ（{loading ? count : messages.length}件）
              </h2>
              <div className="flex items-center gap-2">
                {!loading && messages.length > 0 && (
                  <>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting || bulkTaskifying}
                      className="rounded bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      {bulkDeleting ? '削除中…' : '全て削除'}
                    </button>
                    <button
                      onClick={handleBulkTaskify}
                      disabled={bulkTaskifying || bulkDeleting}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {bulkTaskifying ? '処理中…' : '全てタスク化'}
                    </button>
                  </>
                )}
                <button
                  onClick={handleClose}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ×閉じる
                </button>
              </div>
            </div>

            <div className="overflow-y-auto divide-y">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-400">読み込み中…</p>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  未確認メッセージはありません
                </p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="px-4 py-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                        {m.source}
                      </span>
                      <span className="text-xs text-gray-500">{m.senderName}</span>
                      <span suppressHydrationWarning className="text-xs text-gray-400">
                        {formatRelativeTime(m.receivedAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-gray-800">「{m.body}」</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deleting === m.id || taskifying === m.id}
                        className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:text-red-500 disabled:opacity-50"
                      >
                        削除
                      </button>
                      <button
                        onClick={() => handleTaskify(m.id)}
                        disabled={taskifying === m.id || deleting === m.id}
                        className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50"
                      >
                        Taskにする
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
