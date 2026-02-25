'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function TaskPoller({ initialCount }: { initialCount: number }) {
  const router = useRouter()
  const countRef = useRef(initialCount)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/tasks/count')
        if (!res.ok) return
        const { count } = await res.json() as { count: number }
        if (count !== countRef.current) {
          countRef.current = count
          router.refresh()
        }
      } catch {
        // ポーリング失敗は無視
      }
    }
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [router])

  return null
}
