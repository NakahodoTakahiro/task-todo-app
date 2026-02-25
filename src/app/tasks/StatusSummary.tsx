'use client'

import { useState, useEffect } from 'react'

type Status = 'todo' | 'doing' | 'done'

export default function StatusSummary({
  initialTodo,
  initialDoing,
  initialDone,
}: {
  initialTodo: number
  initialDoing: number
  initialDone: number
}) {
  const [counts, setCounts] = useState({
    todo: initialTodo,
    doing: initialDoing,
    done: initialDone,
  })

  // router.refresh() 後にサーバーから新しい件数が来たら同期する
  useEffect(() => {
    setCounts({ todo: initialTodo, doing: initialDoing, done: initialDone })
  }, [initialTodo, initialDoing, initialDone])

  useEffect(() => {
    function handleStatusChange(e: Event) {
      const { oldStatus, newStatus } = (e as CustomEvent<{ oldStatus: Status; newStatus: Status }>).detail
      setCounts((prev) => ({
        ...prev,
        [oldStatus]: prev[oldStatus] - 1,
        [newStatus]: prev[newStatus] + 1,
      }))
    }
    window.addEventListener('task-status-change', handleStatusChange)
    return () => window.removeEventListener('task-status-change', handleStatusChange)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border p-4 text-center">
        <p className="text-2xl font-bold text-gray-700">{counts.todo}</p>
        <p className="text-xs text-gray-400 mt-1">Todo</p>
      </div>
      <div className="bg-white rounded-xl border p-4 text-center">
        <p className="text-2xl font-bold text-blue-600">{counts.doing}</p>
        <p className="text-xs text-gray-400 mt-1">Doing</p>
      </div>
      <div className="bg-white rounded-xl border p-4 text-center">
        <p className="text-2xl font-bold text-green-600">{counts.done}</p>
        <p className="text-xs text-gray-400 mt-1">Done</p>
      </div>
    </div>
  )
}
