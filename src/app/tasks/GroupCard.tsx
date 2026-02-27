'use client'

import { useState } from 'react'
import TaskCard from './TaskCard'

type Message = {
  source: string
  senderName: string
  body: string
  permalink: string | null
  receivedAt: string
}

type Task = {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  groupId: string | null
  createdAt: string
  group: { id: string; title: string } | null
  message: Message | null
}

type Props = {
  group: { id: string; title: string }
  tasks: Task[]
}

export default function GroupCard({ group, tasks }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border-2 border-purple-200 shadow-sm overflow-hidden">
      {/* グループヘッダー（クリックで開閉） */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-purple-50 px-5 py-3 flex items-center gap-2 hover:bg-purple-100 transition-colors"
      >
        <span className="text-purple-500 text-base">🗂</span>
        <span className="text-sm font-bold text-purple-800">{group.title}</span>
        <span className="text-xs text-purple-400 font-medium">{tasks.length}件</span>
        <span className="ml-auto text-purple-400 text-xs">{open ? '▲ 閉じる' : '▼ 開く'}</span>
      </button>

      {/* タスク一覧（開閉） */}
      {open && (
        <div className="divide-y divide-purple-50">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} inGroup />
          ))}
        </div>
      )}
    </div>
  )
}
