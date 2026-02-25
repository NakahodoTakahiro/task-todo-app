import { Suspense } from 'react'
import { prisma } from '@/lib/db/prisma'
import TaskCard from './TaskCard'
import SuggestionBanner from './SuggestionBanner'
import UncertainBadgeWithModal from './UncertainBadgeWithModal'
import SourceFilter from './SourceFilter'
import StatusSummary from './StatusSummary'
import TaskPoller from './TaskPoller'
import GroupCard from './GroupCard'

export const dynamic = 'force-dynamic'

const VALID_SOURCES = ['slack', 'chatwork'] as const
type ValidSource = typeof VALID_SOURCES[number]

type Props = { searchParams: Promise<{ source?: string }> }

export default async function TasksPage({ searchParams }: Props) {
  const { source } = await searchParams
  const sourceFilter: ValidSource | null =
    source && (VALID_SOURCES as readonly string[]).includes(source)
      ? (source as ValidSource)
      : null

  const [tasks, uncertainCount] = await Promise.all([
    prisma.task.findMany({
      where: sourceFilter
        ? { messages: { some: { source: sourceFilter } } }
        : {},
      include: {
        messages: {
          where: sourceFilter ? { source: sourceFilter } : {},
          orderBy: { receivedAt: 'asc' },
          take: 1,
        },
        group: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.message.count({ where: { taskId: null, isProcessing: false } }),
  ])

  const serialized = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    groupId: t.groupId,
    createdAt: t.createdAt.toISOString(),
    group: t.group ? { id: t.group.id, title: t.group.title } : null,
    messages: t.messages.map((m) => ({
      source: m.source,
      senderName: m.senderName,
      body: m.body,
      permalink: m.permalink,
      receivedAt: m.receivedAt.toISOString(),
    })),
  }))

  const todoCount = serialized.filter((t) => t.status === 'todo').length
  const doingCount = serialized.filter((t) => t.status === 'doing').length
  const doneCount = serialized.filter((t) => t.status === 'done').length

  // グループ別に分類
  const groupMap = new Map<string, { group: { id: string; title: string }; tasks: typeof serialized }>()
  const ungrouped: typeof serialized = []
  for (const task of serialized) {
    if (task.group) {
      if (!groupMap.has(task.group.id)) groupMap.set(task.group.id, { group: task.group, tasks: [] })
      groupMap.get(task.group.id)!.tasks.push(task)
    } else {
      ungrouped.push(task)
    }
  }
  const groups = Array.from(groupMap.values())

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <TaskPoller initialCount={serialized.length} />
      <header className="flex-none bg-gray-50 border-b shadow-sm">
        <div className="px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-black">M</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Mension</h1>
              <p className="text-xs text-gray-400 mt-0.5 tracking-widest uppercase">Mission starts here.</p>
            </div>
          </div>
          <UncertainBadgeWithModal initialCount={uncertainCount} />
        </div>
      </header>

      {/* 固定サブヘッダー（件数 + フィルター） */}
      <div className="flex-none bg-gray-50 border-b px-6 lg:px-10 py-3 space-y-3">
        <StatusSummary initialTodo={todoCount} initialDoing={doingCount} initialDone={doneCount} />
        <Suspense fallback={null}>
          <SourceFilter />
        </Suspense>
      </div>

      {/* スクロールエリア */}
      <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-5 space-y-4">
        {/* 束ね候補バナー */}
        <SuggestionBanner />

        {/* タスク一覧 */}
        {serialized.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">
              {sourceFilter
                ? `${sourceFilter.charAt(0).toUpperCase() + sourceFilter.slice(1)} のタスクはありません`
                : 'タスクはまだありません'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(({ group, tasks }) => (
              <GroupCard key={group.id} group={group} tasks={tasks} />
            ))}
            {ungrouped.map((task) => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </main>
    </div>
  )
}
