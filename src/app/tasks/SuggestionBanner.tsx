'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Suggestion = {
  id: string
  reason: string | null
  newTask: { id: string; title: string }
  candidateTask: { id: string; title: string } | null
  candidateGroup: { id: string; title: string } | null
}

export default function SuggestionBanner() {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)

  useEffect(() => {
    const fetchSuggestions = () => {
      fetch('/api/suggestions')
        .then((r) => r.json())
        .then(setSuggestions)
        .catch(() => {})
    }
    fetchSuggestions()
    const id = setInterval(fetchSuggestions, 5000)
    return () => clearInterval(id)
  }, [])

  async function handleAccept(suggestion: Suggestion) {
    let body: { title?: string } = {}

    // グループへの追加: タイトル不要
    // 個別タスクのまとめ: グループ名を入力
    if (!suggestion.candidateGroup) {
      const defaultTitle = `${suggestion.newTask.title} / ${suggestion.candidateTask?.title ?? ''}`
      const title = window.prompt('グループ名を入力してください', defaultTitle)
      if (!title || !title.trim()) return
      body = { title: title.trim() }
    }

    setAccepting(suggestion.id)
    try {
      const res = await fetch(`/api/suggestions/${suggestion.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('accept failed')
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id))
      router.refresh()
    } catch {
      alert('まとめ処理に失敗しました。もう一度お試しください。')
    } finally {
      setAccepting(null)
    }
  }

  async function handleReject(id: string) {
    setRejecting(id)
    try {
      const res = await fetch(`/api/suggestions/${id}/reject`, { method: 'POST' })
      if (!res.ok) throw new Error('reject failed')
      setSuggestions((prev) => prev.filter((s) => s.id !== id))
      router.refresh()
    } catch {
      alert('却下処理に失敗しました。もう一度お試しください。')
    } finally {
      setRejecting(null)
    }
  }

  if (suggestions.length === 0) return null

  return (
    <div className="border border-yellow-200 rounded-lg overflow-hidden divide-y divide-yellow-100 bg-yellow-50">
      {suggestions.map((s) => {
        const candidateName = s.candidateGroup
          ? `「${s.candidateGroup.title}」グループ`
          : `「${s.candidateTask?.title ?? ''}」`

        return (
          <div key={s.id} className="px-4 py-3">
            <p className="text-sm text-yellow-800">
              <span className="mr-1">⚠</span>
              「{s.newTask.title}」と{candidateName}は同じ依頼かもしれません
            </p>
            {s.reason && <p className="mt-0.5 text-xs text-yellow-600">{s.reason}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => handleReject(s.id)}
                disabled={rejecting === s.id || accepting === s.id}
                className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                別々のままにする
              </button>
              <button
                onClick={() => handleAccept(s)}
                disabled={accepting === s.id || rejecting === s.id}
                className="rounded border border-yellow-300 bg-white px-3 py-1 text-xs font-medium text-yellow-800 hover:text-yellow-900 disabled:opacity-50"
              >
                まとめる
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
