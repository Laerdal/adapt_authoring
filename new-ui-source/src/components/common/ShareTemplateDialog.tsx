import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2, X } from 'lucide-react'
import { getActiveUsers, type DashboardTemplate, type UserSummary } from '@/api/adaptAuthoring'

export default function ShareTemplateDialog({ template, onSave, onClose }: {
  template: DashboardTemplate
  onSave: (isShared: boolean, userIds: string[]) => Promise<void>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isShared, setIsShared] = useState(template.isShared)
  const [selectedIds, setSelectedIds] = useState(template.shareWithUsers)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current?.showModal()
    let cancelled = false
    getActiveUsers().then((rows) => {
      if (!cancelled) setUsers(rows)
    }).catch(() => {
      if (!cancelled) setLoadError(true)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const search = query.trim().toLowerCase()
  const matches = users.filter((user) => !selectedIds.includes(user._id) &&
    `${user.email} ${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(search))
    .slice(0, 8)

  async function save() {
    setSaving(true)
    setError('')
    try {
      await onSave(isShared, isShared ? [] : selectedIds)
      onClose()
    } catch {
      setError('Failed to share the template. Please try again.')
      setSaving(false)
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="share-template-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose() }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); if (!saving) onClose() } }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}
    >
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#e5e7eb]">
        <div className="min-w-0">
          <h2 id="share-template-title" className="font-semibold text-[#111827] text-base">Share Template</h2>
          <p className="text-xs text-[#6b7280] mt-0.5 break-words">{template.name}</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close" title="Close" className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] disabled:opacity-40">
          <X size={18} />
        </button>
      </div>
      <div className="px-6 py-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
        <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
          <input type="checkbox" checked={isShared} disabled={saving} onChange={(event) => setIsShared(event.target.checked)} className="h-4 w-4 accent-[#2d6fa8]" />
          Share with all users
        </label>
        {!isShared && (
          <div className="flex flex-col gap-2">
            <label htmlFor="template-user-search" className="text-sm font-medium text-[#374151]">Share with specific users</label>
            <input
              id="template-user-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={loading || loadError || saving}
              placeholder={loading ? 'Loading users...' : 'Search by name or email'}
              className="w-full px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] text-[#111827]"
            />
            {loadError && <p role="alert" className="text-sm text-[#b42318]">Failed to load users. Close and reopen to try again.</p>}
            {search && !loading && !loadError && (
              <div className="border border-[#d1d5db] rounded-lg max-h-40 overflow-y-auto divide-y divide-[#e5e7eb]">
                {matches.length === 0 ? <p className="px-3 py-2 text-sm text-[#6b7280]">No matching users</p> : matches.map((user) => (
                  <button key={user._id} type="button" disabled={saving} onClick={() => { setSelectedIds((previous) => [...previous, user._id]); setQuery('') }} className="block w-full px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb] break-words">
                    {user.email}
                  </button>
                ))}
              </div>
            )}
            {selectedIds.map((userId) => {
              const label = users.find((user) => user._id === userId)?.email || userId
              return (
                <div key={userId} className="flex items-center gap-2 rounded-lg bg-[#f3f4f6] px-3 py-2 text-sm text-[#374151]">
                  <span className="min-w-0 flex-1 break-words">{label}</span>
                  <button type="button" disabled={saving} aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={() => setSelectedIds((previous) => previous.filter((id) => id !== userId))} className="p-1 rounded hover:bg-[#e5e7eb]">
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-[#b42318]">{error}</p>}
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
        <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-40">Cancel</button>
        <button type="button" disabled={saving || (!isShared && (loading || loadError))} onClick={() => void save()} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg">
          <Share2 size={15} />{saving ? 'Saving...' : 'Share'}
        </button>
      </div>
    </dialog>,
    document.body
  )
}