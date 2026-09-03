import { useState, useMemo, useEffect } from 'react'
import { getTemplates, deleteTemplate, updateTemplate, type TemplateScope } from '@/api/adaptAuthoring'
import AiAssistant from '@/components/common/AiAssistant'

type TemplateType = 'Page' | 'Article' | 'Block' | 'Component'

interface Template {
  id: number
  backendId?: string   // engine _id — used for delete
  name: string
  type: TemplateType
  description: string
  timestamp: Date
  author?: string      // creator's name — shown in the Shared Templates view
}

const INITIAL_TEMPLATES: Template[] = [
  { id: 1, name: 'Hero Banner', type: 'Page', description: 'Full-width hero layout with image, headline and CTA.', timestamp: new Date('2026-06-15T09:30:00') },
  { id: 2, name: 'Learning Article', type: 'Article', description: 'Long-form reading layout with sidebar navigation.', timestamp: new Date('2026-06-18T14:15:00') },
  { id: 3, name: 'Card Grid', type: 'Block', description: 'Responsive grid of content cards with hover effects.', timestamp: new Date('2026-06-20T11:45:00') },
  { id: 4, name: 'Progress Tracker', type: 'Component', description: 'Visual step indicator for multi-stage workflows.', timestamp: new Date('2026-06-22T08:00:00') },
  { id: 5, name: 'Quiz Page', type: 'Page', description: 'Interactive quiz layout with scoring and feedback.', timestamp: new Date('2026-06-23T16:20:00') },
  { id: 6, name: 'News Article', type: 'Article', description: 'Clean editorial layout with pull-quotes and image support.', timestamp: new Date('2026-06-24T10:05:00') },
  { id: 7, name: 'Accordion FAQ', type: 'Block', description: 'Collapsible FAQ block with smooth animation.', timestamp: new Date('2026-06-25T13:30:00') },
  { id: 8, name: 'Video Player', type: 'Component', description: 'Embedded video with controls and caption support.', timestamp: new Date('2026-06-26T09:00:00') },
]

const FILTER_OPTIONS: ('All' | TemplateType)[] = ['All', 'Page', 'Article', 'Block', 'Component']
const PAGE_SIZE_OPTIONS = [5, 10, 20]

function formatTimestamp(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(2)
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${dd}/${mm}/${yy}, ${hours}:${minutes} ${ampm}`
}

const TYPE_COLORS: Record<TemplateType, { bg: string; text: string }> = {
  Page:      { bg: 'bg-[#dbeeff]', text: 'text-[#2d6fa8]' },
  Article:   { bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]' },
  Block:     { bg: 'bg-[#fef9c3]', text: 'text-[#a16207]' },
  Component: { bg: 'bg-[#f3e8ff]', text: 'text-[#7e22ce]' },
}

export default function TemplateManagementPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [scope, setScope] = useState<TemplateScope>('mine')

  const loadTemplates = () => { getTemplates(scope).then(setTemplates).catch(() => setTemplates([])) }
  useEffect(() => { loadTemplates() }, [scope])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'All' | TemplateType>('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // Edit modal
  const [editTarget, setEditTarget] = useState<Template | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)

  function openEdit(t: Template) {
    setEditTarget(t)
    setEditName(t.name)
    setEditDesc(t.description)
  }

  async function saveEdit() {
    const target = editTarget
    if (!target) return
    const name = editName.trim()
    const description = editDesc.trim()
    setTemplates((prev) =>
      prev.map((t) => (t.id === target.id ? { ...t, name, description } : t))
    )
    setEditTarget(null)
    if (!target.backendId) return
    try {
      await updateTemplate(target.backendId, { title: name, description })
    } finally {
      loadTemplates()
    }
  }

  async function confirmDelete() {
    const target = deleteTarget
    setDeleteTarget(null)
    if (!target?.backendId) return
    setTemplates((prev) => prev.filter((t) => t.id !== target.id))
    try {
      await deleteTemplate(target.backendId)
    } finally {
      loadTemplates()
    }
  }

  const filtered = useMemo(() => {
    let list = templates
    if (filter !== 'All') list = list.filter((t) => t.type === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(q))
    }
    return list
  }, [templates, filter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
  }

  function handleFilter(val: 'All' | TemplateType) {
    setFilter(val)
    setPage(1)
  }

  function handleScope(val: TemplateScope) {
    if (val === scope) return
    setScope(val)
    setPage(1)
  }

  const SCOPE_OPTIONS: { value: TemplateScope; label: string }[] = [
    { value: 'mine', label: 'My Templates' },
    { value: 'shared', label: 'Shared Templates' },
  ]

  return (
    <>
      <div className="px-4 sm:px-6 md:px-8 py-5 md:py-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#111827] leading-tight">Template Management</h1>
            <p className="text-sm text-[#6b7280] mt-1">Browse and manage reusable content templates</p>
          </div>
        </div>

        {/* Ownership scope toggle — My vs Shared with me */}
        <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-lg p-1 mb-4 w-fit">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleScope(opt.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                scope === opt.value
                  ? 'bg-white text-[#2d6fa8] shadow-sm'
                  : 'text-[#6b7280] hover:text-[#374151]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative w-full sm:flex-1 sm:max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
              width="16" height="16" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af] text-[#111827]"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-lg p-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === opt
                    ? 'bg-white text-[#2d6fa8] shadow-sm'
                    : 'text-[#6b7280] hover:text-[#374151]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                  <th className="text-left px-4 py-3 font-medium text-[#6b7280] w-[28%]">Template Name</th>
                  <th className="text-left px-4 py-3 font-medium text-[#6b7280] w-[12%]">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-[#6b7280] w-[18%] whitespace-nowrap">Time Stamp</th>
                  {scope === 'shared' && (
                    <th className="text-left px-4 py-3 font-medium text-[#6b7280] w-[15%] whitespace-nowrap">Author</th>
                  )}
                  <th className="text-right px-4 py-3 font-medium text-[#6b7280] w-[10%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={scope === 'shared' ? 6 : 5} className="py-16 text-center text-[#9ca3af]">
                      <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      No templates found
                    </td>
                  </tr>
                ) : (
                  paginated.map((t, i) => {
                    const colors = TYPE_COLORS[t.type]
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-[#f3f4f6] hover:bg-[#fafafa] transition-colors ${i === paginated.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-[#111827]">{t.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#6b7280] max-w-xs truncate" title={t.description}>{t.description}</td>
                        <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap font-mono text-xs">{formatTimestamp(t.timestamp)}</td>
                        {scope === 'shared' && (
                          <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{t.author || '—'}</td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(t)}
                              title="Edit"
                              className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#dbeeff] hover:text-[#2d6fa8] transition-colors"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(t)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#fee2e2] hover:text-[#dc2626] transition-colors"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#e5e7eb] bg-[#f9fafb]">
            {/* Row count + page size */}
            <div className="flex items-center gap-2 text-sm text-[#6b7280]">
              <span>
                {filtered.length === 0
                  ? '0 results'
                  : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} template${filtered.length !== 1 ? 's' : ''}`}
              </span>
              <span className="text-[#d1d5db]">|</span>
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="text-sm border border-[#e5e7eb] rounded-md px-2 py-1 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8]"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Pagination */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...')
                  acc.push(n)
                  return acc
                }, [])
                .map((n, i) =>
                  n === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-[#9ca3af] text-sm">…</span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n as number)}
                      className={`min-w-[30px] h-[30px] rounded-lg text-sm font-medium transition-colors ${
                        safePage === n
                          ? 'bg-[#2d6fa8] text-white'
                          : 'text-[#374151] hover:bg-[#e5e7eb]'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <div>
                <h2 className="font-semibold text-[#111827] text-base">Edit Template</h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Update the name and description</p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Template Name <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827] placeholder-[#9ca3af]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!editName.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AiAssistant context="Template Management" />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#fee2e2] flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </div>
              <h2 className="font-semibold text-[#111827] text-base mb-1">Delete Template</h2>
              <p className="text-sm text-[#6b7280]">
                Are you sure you want to delete <span className="font-medium text-[#111827]">"{deleteTarget.name}"</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
