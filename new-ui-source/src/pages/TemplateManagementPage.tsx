import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { getTemplates, deleteTemplate, updateTemplate, type TemplateScope, type DashboardTemplate } from '@/api/adaptAuthoring'
import { Share2 } from 'lucide-react'
import { usePageLoader } from '@/hooks'
import AiAssistant from '@/components/common/AiAssistant'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ShareTemplateDialog from '@/components/common/ShareTemplateDialog'
import Paginator from '@/components/common/Paginator'
import { lifeButtonClass } from '@/components/common/Button'

type TemplateType = 'Topic' | 'Section' | 'Content Group' | 'Component'

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
  { id: 1, name: 'Hero Banner', type: 'Topic', description: 'Full-width hero layout with image, headline and CTA.', timestamp: new Date('2026-06-15T09:30:00') },
  { id: 2, name: 'Learning Article', type: 'Section', description: 'Long-form reading layout with sidebar navigation.', timestamp: new Date('2026-06-18T14:15:00') },
  { id: 3, name: 'Card Grid', type: 'Content Group', description: 'Responsive grid of content cards with hover effects.', timestamp: new Date('2026-06-20T11:45:00') },
  { id: 4, name: 'Progress Tracker', type: 'Component', description: 'Visual step indicator for multi-stage workflows.', timestamp: new Date('2026-06-22T08:00:00') },
  { id: 5, name: 'Quiz Page', type: 'Topic', description: 'Interactive quiz layout with scoring and feedback.', timestamp: new Date('2026-06-23T16:20:00') },
  { id: 6, name: 'News Article', type: 'Section', description: 'Clean editorial layout with pull-quotes and image support.', timestamp: new Date('2026-06-24T10:05:00') },
  { id: 7, name: 'Accordion FAQ', type: 'Content Group', description: 'Collapsible FAQ block with smooth animation.', timestamp: new Date('2026-06-25T13:30:00') },
  { id: 8, name: 'Video Player', type: 'Component', description: 'Embedded video with controls and caption support.', timestamp: new Date('2026-06-26T09:00:00') },
]

const FILTER_OPTIONS: ('All' | TemplateType)[] = ['All', 'Topic', 'Section', 'Content Group', 'Component']
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
  Topic:         { bg: 'bg-[var(--life-primary-100)]', text: 'text-[var(--life-primary-700)]' },
  Section:       { bg: 'bg-[var(--life-positive-050)]', text: 'text-[var(--life-positive-500)]' },
  'Content Group': { bg: 'bg-[var(--life-warning-050)]', text: 'text-[var(--life-warning-500)]' },
  Component:     { bg: 'bg-[var(--life-color-bg-surface-samaritan-subtle)]', text: 'text-[var(--samaritan)]' },
}

export default function TemplateManagementPage() {
  const [templates, setTemplates] = useState<DashboardTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<TemplateScope>('mine')
  const templateRequestIdRef = useRef(0)

  usePageLoader(loading)

  const loadTemplates = useCallback(async () => {
    const requestId = ++templateRequestIdRef.current
    setLoading(true)
    try {
      const rows = await getTemplates(scope)
      if (templateRequestIdRef.current !== requestId) return
      setTemplates(rows)
    } catch {
      if (templateRequestIdRef.current !== requestId) return
      setTemplates([])
    } finally {
      if (templateRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [scope])
  useEffect(() => { void loadTemplates() }, [loadTemplates])
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
  const [shareTarget, setShareTarget] = useState<DashboardTemplate | null>(null)

  async function saveSharing(isShared: boolean, userIds: string[]) {
    if (!shareTarget) return
    await updateTemplate(shareTarget.backendId, { _isShared: isShared, _shareWithUsers: userIds })
    await loadTemplates()
  }

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
    } catch {
      // Optimistic update above may be stale if the backend rejected it — resync.
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
    } catch {
      // Optimistic removal above may be wrong if the backend rejected it — resync.
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
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--life-neutral-850)] leading-tight">Template Management</h1>
            <p className="text-sm text-[var(--life-neutral-600)] mt-1">Browse and manage reusable content templates</p>
          </div>
        </div>

        {/* Ownership scope toggle — My vs Shared with me */}
        <div role="tablist" aria-label="Template ownership" className="life-tabs mb-4">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={scope === opt.value}
              onClick={() => handleScope(opt.value)}
              className="life-tab"
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--life-neutral-400)]"
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
              className="life-field pl-9 pr-4"
            />
          </div>

          {/* Filter tabs */}
          <div role="tablist" aria-label="Template type" className="life-tabs">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={filter === opt}
                onClick={() => handleFilter(opt)}
                className="life-tab"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="life-table-wrap">
          <div className="overflow-x-auto life-scroll">
            <table className="life-table">
              <thead>
                <tr>
                  <th scope="col" className="w-[28%]">Template Title</th>
                  <th scope="col" className="w-[12%]">Type</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="w-[18%]">Time Stamp</th>
                  {scope === 'shared' && (
                    <th scope="col" className="w-[15%]">Author</th>
                  )}
                  <th scope="col" className="w-[10%] !text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={scope === 'shared' ? 6 : 5} className="life-table-empty">
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
                      <tr key={t.id}>
                        <td className="font-medium">{t.name}</td>
                        <td>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="text-[var(--life-neutral-600)] max-w-xs truncate" title={t.description}>{t.description}</td>
                        <td className="text-[var(--life-neutral-600)] whitespace-nowrap text-xs">{formatTimestamp(t.timestamp)}</td>
                        {scope === 'shared' && (
                          <td className="text-[var(--life-neutral-600)] whitespace-nowrap">{t.author || '—'}</td>
                        )}
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setShareTarget(t)}
                              disabled={!t.backendId}
                              title="Share"
                              aria-label={`Share ${t.name}`}
                              className="life-icon-btn life-icon-btn--sm"
                            >
                              <Share2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(t)}
                              title="Edit"
                              aria-label={`Edit ${t.name}`}
                              className="life-icon-btn life-icon-btn--sm"
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
                              aria-label={`Delete ${t.name}`}
                              className="life-icon-btn life-icon-btn--sm life-icon-btn--critical"
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

          <Paginator
            page={safePage}
            pageSize={pageSize}
            totalItems={filtered.length}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            itemLabel="template"
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {shareTarget && (
        <ShareTemplateDialog template={shareTarget} onSave={saveSharing} onClose={() => setShareTarget(null)} />
      )}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--life-neutral-100)]">
              <div>
                <h2 className="font-semibold text-[var(--life-neutral-850)] text-base">Edit Template Details</h2>
                <p className="text-xs text-[var(--life-neutral-600)] mt-0.5">Update the title and description</p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="Close"
                className="life-icon-btn life-icon-btn--sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              <div>
                <label className="life-label">
                  Template Title <span className="text-[var(--life-critical-500)]">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="life-field"
                />
              </div>
              <div>
                <label className="life-label">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="life-field"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--life-neutral-100)]">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className={lifeButtonClass('secondary')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!editName.trim()}
                className={lifeButtonClass('primary')}
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
        <ConfirmDialog
          open
          title="Delete Template"
          message="Are you sure you want to delete this template?"
          note="This will delete the template from the list but will not affect the course(s) where the template is used."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}
