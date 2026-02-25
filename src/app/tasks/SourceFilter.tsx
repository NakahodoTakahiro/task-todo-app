'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type Source = 'all' | 'slack' | 'chatwork'

const BUTTONS: { label: string; value: Source }[] = [
  { label: 'すべて', value: 'all' },
  { label: 'Slack', value: 'slack' },
  { label: 'Chatwork', value: 'chatwork' },
]

export default function SourceFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const raw = searchParams.get('source')
  // 不正な値は 'all' に fallback（サーバー側バリデーションと一致させる）
  const current: Source = raw === 'slack' || raw === 'chatwork' ? raw : 'all'

  function handleSelect(source: Source) {
    const params = new URLSearchParams(searchParams.toString())
    if (source === 'all') {
      params.delete('source')
    } else {
      params.set('source', source)
    }
    // クエリが空のときは ? を残さない。フィルター切り替えはブラウザ履歴を汚さない
    const query = params.toString()
    router.replace(query ? `/tasks?${query}` : '/tasks')
  }

  return (
    <div className="flex items-center gap-1">
      {BUTTONS.map((b) => (
        <button
          key={b.value}
          onClick={() => handleSelect(b.value)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            current === b.value
              ? 'border-gray-800 bg-gray-800 text-white'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
