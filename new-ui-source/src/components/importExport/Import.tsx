import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ── Types ────────────────────────────────────────────────────────────────────

interface PluginInfo {
  importVersion: string
  displayName: string
  authoringToolVersion: string
}

interface PluginVersions {
  white: Record<string, PluginInfo>
  'green-install': Record<string, PluginInfo>
  'green-update': Record<string, PluginInfo>
  amber: Record<string, PluginInfo>
  red: Record<string, PluginInfo>
}

interface CheckResult {
  frameworkVersions: {
    imported: string
    installed: string
    downgrade?: boolean
  }
  pluginVersions: PluginVersions
}

type ModalStep = 'form' | 'checking' | 'results' | 'importing'

interface TagItem {
  _id: string
  title: string
}

interface TagSuggestion {
  _id?: string
  title?: string
  value?: string
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ImportCourseModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called after a successful import. deprecatedPlugins contains any plugin names that were skipped. */
  onSuccess: (deprecatedPlugins?: string[]) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-md text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors shrink-0"
      aria-label="Close"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

// ── Plugin row ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  'green-install': { label: 'Install',             color: '#059669' },
  'green-update':  { label: 'Update',              color: '#059669' },
  'amber':         { label: 'Use installed version', color: '#d97706' },
  'red':           { label: 'Action needed',        color: '#dc2626' },
}

function PluginRow({ name, info, category }: { name: string; info: PluginInfo; category: string }) {
  const cat = CATEGORY_LABELS[category]
  return (
    <tr className="border-b border-[#f3f4f6] last:border-0">
      <td className="py-3 pr-4 text-sm text-[#374151]">{info.displayName || name}</td>
      <td className="py-3 pr-4 text-sm font-semibold text-[#111827] text-center">{info.importVersion}</td>
      <td className="py-3 pr-4 text-sm text-[#6b7280] text-center">
        {info.authoringToolVersion === 'none' || !info.authoringToolVersion ? '–' : info.authoringToolVersion}
      </td>
      <td className="py-3 text-sm font-semibold text-center" style={{ color: cat?.color ?? '#6b7280' }}>
        {cat?.label ?? category}
      </td>
    </tr>
  )
}

// ── Key legend entry ──────────────────────────────────────────────────────────

const CATEGORY_KEY_DESC: Record<string, string> = {
  'green-install': 'This plugin will be installed into the authoring tool during import.',
  'green-update':  'This plugin will be updated in the authoring tool during import.',
  'amber':         'The version of this plugin included in this import is either not compatible with this authoring tool, or a newer version is already installed. The imported course will use the existing version.',
  'red':           'This plugin is not supported in this authoring tool. You must remove or update this plugin before you can continue with the import.',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImportCourseModal({ isOpen, onClose, onSuccess }: ImportCourseModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [assetFolders, setAssetFolders]   = useState('')
  const [tagInput, setTagInput]           = useState('')
  const [tags, setTags]                   = useState<TagItem[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<TagItem[]>([])
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  // Flow state
  const [step, setStep]           = useState<ModalStep>('form')
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)

  // ── Reset ────────────────────────────────────────────────────────────────

  function resetAndClose() {
    setSelectedFile(null)
    setAssetFolders('')
    setTagInput('')
    setTags([])
    setTagSuggestions([])
    setShowTagSuggestions(false)
    setStep('form')
    setCheckResult(null)
    setErrorMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  // ── Step 1 → 2: Check versions ───────────────────────────────────────────

  function hasTagTitle(title: string): boolean {
    const compare = title.trim().toLowerCase()
    return tags.some((tag) => tag.title.trim().toLowerCase() === compare)
  }

  function removeTagById(id: string) {
    setTags((prev) => prev.filter((tag) => tag._id !== id))
  }

  async function resolveTag(title: string): Promise<TagItem | null> {
    const cleanTitle = title.trim().replace(/,/g, '')
    if (!cleanTitle || hasTagTitle(cleanTitle)) return null

    const response = await fetch('/api/content/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ title: cleanTitle }),
    })

    if (!response.ok) {
      throw new Error('Unable to add tag. Please try again.')
    }

    const json = await response.json() as { _id?: string; id?: string; title?: string }
    const id = json._id ?? json.id
    if (!id) {
      throw new Error('Unable to add tag. Missing tag id from server response.')
    }

    return { _id: id, title: json.title ?? cleanTitle }
  }

  async function addTagFromTitle(title: string) {
    try {
      const tag = await resolveTag(title)
      if (!tag) return
      setTags((prev) => {
        if (prev.some((item) => item._id === tag._id || item.title.trim().toLowerCase() === tag.title.trim().toLowerCase())) {
          return prev
        }
        return [...prev, tag]
      })
      setErrorMsg(null)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to add tag.'
      setErrorMsg(msg)
    }
  }

  function mergeUniqueTags(existing: TagItem[], incoming: TagItem[]): TagItem[] {
    const merged = [...existing]
    for (const tag of incoming) {
      const exists = merged.some((item) => item._id === tag._id || item.title.trim().toLowerCase() === tag.title.trim().toLowerCase())
      if (!exists) merged.push(tag)
    }
    return merged
  }

  async function resolveTagsFromInput(rawInput: string): Promise<TagItem[]> {
    const candidates = rawInput
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    const resolved: TagItem[] = []
    for (const title of candidates) {
      try {
        const tag = await resolveTag(title)
        if (tag) resolved.push(tag)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unable to add tag.'
        setErrorMsg(msg)
      }
    }
    return resolved
  }

  async function addTagsFromInput(rawInput: string, clearInput = false): Promise<TagItem[]> {
    const resolved = await resolveTagsFromInput(rawInput)
    const merged = mergeUniqueTags(tags, resolved)
    setTags(merged)
    if (clearInput) setTagInput('')
    return merged
  }

  function selectedTagIdsCsv(sourceTags = tags): string {
    return sourceTags.map((tag) => tag._id).join(',')
  }

  useEffect(() => {
    const term = tagInput.trim()
    if (term.length < 3) {
      setTagSuggestions([])
      return
    }

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/autocomplete/tag?term=${encodeURIComponent(term)}`, {
          credentials: 'same-origin',
        })
        if (!response.ok || cancelled) return
        const data = await response.json() as TagSuggestion[]
        if (cancelled) return

        const results = (Array.isArray(data) ? data : [])
          .map((item) => {
            const id = item._id
            const title = item.title ?? item.value ?? ''
            return id && title ? { _id: id, title } : null
          })
          .filter((item): item is TagItem => Boolean(item))
          .filter((item) => !hasTagTitle(item.title))

        setTagSuggestions(results.slice(0, 8))
      } catch {
        if (!cancelled) setTagSuggestions([])
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [tagInput, tags])

  async function handleCheckVersions() {
    if (!selectedFile) return
    setStep('checking')
    setErrorMsg(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (assetFolders.trim()) formData.append('formAssetFolders', assetFolders.trim())
      let tagsToSubmit = tags
      if (tagInput.trim()) {
        tagsToSubmit = await addTagsFromInput(tagInput, true)
      }
      const tagIds = selectedTagIdsCsv(tagsToSubmit)
      if (tagIds) formData.append('tags', tagIds)

      const response = await fetch('/importsourcecheck', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ body: response.statusText }))
        const title = err.title ? `${err.title}: ` : ''
        throw new Error(`${title}${err.body || err.message || `HTTP ${response.status}`}`)
      }

      const data: CheckResult = await response.json()
      setCheckResult(data)
      setStep('results')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred.'
      setErrorMsg(msg)
      setStep('form')
    }
  }

  // ── Step 3 → 4: Perform import ───────────────────────────────────────────

  async function handleConfirmImport() {
    setStep('importing')
    setErrorMsg(null)

    try {
      const response = await fetch('/importsource', {
        method: 'POST',
        credentials: 'same-origin',
      })

      if (!response.ok) {
        // PartialImportError → { title, body }; other errors → { body } or plain text
        const err = await response.json().catch(() => ({ body: response.statusText }))
        const title = err.title ? `${err.title}: ` : ''
        throw new Error(`${title}${err.body || err.message || `HTTP ${response.status}`}`)
      }

      // Parse success body: { body: string, deprecatedPlugins?: string[] }
      const result = await response.json().catch(() => ({})) as { body?: string; deprecatedPlugins?: string[] }
      const deprecated = result.deprecatedPlugins ?? []

      resetAndClose()
      onSuccess(deprecated.length > 0 ? deprecated : undefined)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Import failed.'
      setErrorMsg(msg)
      setStep('results')
    }
  }

  // ── Derived state for results ─────────────────────────────────────────────

  const hasRed      = checkResult ? !isEmpty(checkResult.pluginVersions.red)             : false
  const hasAmber    = checkResult ? !isEmpty(checkResult.pluginVersions.amber)           : false
  const hasGreenU   = checkResult ? !isEmpty(checkResult.pluginVersions['green-update']) : false
  const hasGreenI   = checkResult ? !isEmpty(checkResult.pluginVersions['green-install']): false
  const hasAnyGreen = hasGreenU || hasGreenI
  const downgrade   = checkResult?.frameworkVersions.downgrade ?? false
  const canProceed  = !hasRed && !downgrade
  const allIdentical = !hasRed && !hasAmber && !hasAnyGreen && !downgrade

  // ── Render ────────────────────────────────────────────────────────────────

  const PLUGIN_ORDER = ['red', 'amber', 'green-update', 'green-install'] as const

  return isOpen ? createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 99999 }}
      onClick={step === 'form' || step === 'results' ? resetAndClose : undefined}
    >
      <div
        className="bg-white rounded-xl w-full flex flex-col shadow-2xl"
        style={{ maxWidth: step === 'results' ? 720 : 560, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5e7eb] shrink-0">
          <h2 className="text-base font-bold text-[#111827]">Import framework source</h2>
          {(step === 'form' || step === 'results') && <CloseButton onClick={resetAndClose} />}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── FORM STEP ─── */}
          {(step === 'form' || step === 'checking') && (
            <div className="px-6 py-6 flex flex-col gap-6">

              {/* Error banner */}
              {errorMsg && (
                <div className="flex items-start gap-3 p-4 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-sm text-[#b91c1c]">
                  <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* File */}
              <div>
                <p className="text-sm text-[#111827] mb-3">
                  <strong>File</strong>{' '}
                  <span className="text-[#ef4444]">*</span>{' '}
                  <span className="text-[#6b7280]">Select a framework zip for import. Tags will be added to the course and all new assets.</span>
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={step === 'checking'}
                    className="flex items-center gap-2 px-4 h-9 bg-white border border-[#d1d5db] hover:bg-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed text-[#374151] text-sm font-medium rounded-lg transition-colors shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Choose File
                  </button>
                  <span className={`text-sm truncate ${selectedFile ? 'text-[#111827]' : 'text-[#9ca3af]'}`}>
                    {selectedFile ? selectedFile.name : 'No file chosen'}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <p className="text-xs text-[#9ca3af] mt-2">Maximum upload file size: 600MB.</p>
              </div>

              {/* Asset Folders */}
              <div>
                <p className="text-sm font-bold text-[#111827] mb-1.5">Asset Folders</p>
                <p className="text-xs text-[#6b7280] mb-2.5 leading-relaxed">
                  Enter the names of folders that contain assets. If there are multiple folders enter a comma separated list.
                  Automatically checks for the following folders if no value is entered: assets, images, video, audio.
                </p>
                <input
                  type="text"
                  value={assetFolders}
                  onChange={(e) => setAssetFolders(e.target.value)}
                  disabled={step === 'checking'}
                  placeholder="assets, images, video, audio"
                  className="w-full h-[42px] border border-[#d1d5db] rounded-lg px-3.5 text-sm text-[#111827] placeholder:text-[#9ca3af] bg-white outline-none focus:border-[#2d6fa8] disabled:opacity-50 transition-colors"
                />
              </div>

              {/* Tags */}
              <div>
                <p className="text-sm font-bold text-[#111827] mb-2.5">Tags</p>
                <div className="relative">
                  <div className="w-full min-h-[44px] border border-[#d1d5db] rounded-lg px-2 py-2 bg-white focus-within:border-[#2d6fa8] transition-colors">
                    <div className="flex flex-wrap gap-2 items-center">
                      {tags.map((tag) => (
                        <span
                          key={tag._id}
                          className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-[#e6f0f8] text-[#1f4f75] text-xs font-medium"
                          title={tag.title}
                        >
                          <span className="truncate max-w-[180px]">{tag.title}</span>
                          <button
                            type="button"
                            onClick={() => removeTagById(tag._id)}
                            disabled={step === 'checking'}
                            className="w-4 h-4 rounded-full hover:bg-[#c9deee] text-[#1f4f75] leading-none disabled:opacity-50"
                            aria-label={`Remove ${tag.title}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value)
                          setShowTagSuggestions(true)
                        }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onBlur={() => {
                          window.setTimeout(() => setShowTagSuggestions(false), 120)
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault()
                            await addTagsFromInput(tagInput, true)
                            return
                          }
                          if (e.key === 'Backspace' && !tagInput && tags.length) {
                            removeTagById(tags[tags.length - 1]._id)
                          }
                        }}
                        disabled={step === 'checking'}
                        placeholder={tags.length ? 'Type and press comma or Enter' : 'Add tags'}
                        className="flex-1 min-w-[180px] h-7 px-1 text-sm text-[#111827] placeholder:text-[#9ca3af] bg-transparent outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {showTagSuggestions && tagSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-[#e5e7eb] rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {tagSuggestions.map((suggestion) => (
                        <button
                          key={suggestion._id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (hasTagTitle(suggestion.title)) return
                            setTags((prev) => [...prev, suggestion])
                            setTagInput('')
                            setShowTagSuggestions(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-[#111827] hover:bg-[#f3f4f6]"
                        >
                          {suggestion.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#6b7280] mt-2">Type at least 3 characters for suggestions. Press comma or Enter to add a tag.</p>
              </div>
            </div>
          )}

          {/* ─── RESULTS STEP ─── */}
          {(step === 'results' || step === 'importing') && checkResult && (
            <div className="px-6 py-6 flex flex-col gap-4">

              {/* Error banner */}
              {errorMsg && (
                <div className="flex items-start gap-3 p-4 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-sm text-[#b91c1c]">
                  <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Framework versions panel */}
              {checkResult.frameworkVersions.imported !== checkResult.frameworkVersions.installed && !downgrade && (
                <div className="p-4 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg text-sm text-[#374151] leading-relaxed">
                  <p>Import framework version: <strong>{checkResult.frameworkVersions.imported}</strong></p>
                  <p>Installed framework version: <strong>{checkResult.frameworkVersions.installed}</strong></p>
                  <p className="mt-2">
                    If you proceed with this import then your course will use framework{' '}
                    <strong>{checkResult.frameworkVersions.installed}</strong> and should be tested.
                  </p>
                </div>
              )}

              {/* Import status summary */}
              <div className="p-4 border rounded-lg">
                {!canProceed ? (
                  <>
                    <p className="text-base font-bold text-[#dc2626] mb-2">Course cannot be imported</p>
                    <p className="text-sm text-[#374151] leading-relaxed">
                      {downgrade
                        ? 'The framework version used in this course is newer than the framework version that is used by this authoring tool. You cannot import this course because the framework version cannot be downgraded.'
                        : 'One or more of the plugins used in this course are not compatible with the version of the framework that is used by this authoring tool. Please remove or update these plugins and try again.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-base font-bold mb-2 ${allIdentical ? 'text-[#059669]' : 'text-[#d97706]'}`}>
                      Course can be imported
                    </p>
                    <p className="text-sm text-[#374151] leading-relaxed font-semibold">
                      {allIdentical
                        ? 'All of the plugins used in this course are identical to those in this authoring tool.'
                        : 'One or more of the plugins used in this course will be updated as part of the import process. You should test the course after the import has completed.'}
                    </p>
                  </>
                )}
              </div>

              {/* Plugin list */}
              {(hasRed || hasAmber || hasAnyGreen) && (
                <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                  {/* Legend keys */}
                  <div className="px-4 py-3 bg-[#f9fafb] border-b border-[#e5e7eb] flex flex-col gap-1">
                    {PLUGIN_ORDER.map((cat) => {
                      const catPlugins = checkResult.pluginVersions[cat]
                      if (isEmpty(catPlugins)) return null
                      const c = CATEGORY_LABELS[cat]
                      return (
                        <p key={cat} className="text-xs text-[#6b7280] leading-relaxed">
                          <span className="font-semibold" style={{ color: c.color }}>{c.label}</span>
                          {' – '}{CATEGORY_KEY_DESC[cat]}
                        </p>
                      )
                    })}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Name</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Import Version</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Installed Version</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3f4f6]">
                        {PLUGIN_ORDER.map((cat) => {
                          const catPlugins = checkResult.pluginVersions[cat]
                          if (isEmpty(catPlugins)) return null
                          return Object.entries(catPlugins)
                            .sort(([, a], [, b]) => (a.displayName || '').localeCompare(b.displayName || ''))
                            .map(([name, info]) => (
                              <PluginRow key={`${cat}-${name}`} name={name} info={info} category={cat} />
                            ))
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb] shrink-0">

          {/* FORM step buttons */}
          {(step === 'form' || step === 'checking') && (
            <>
              <button
                type="button"
                onClick={resetAndClose}
                disabled={step === 'checking'}
                className="h-[38px] px-[18px] bg-white border border-[#d1d5db] hover:bg-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed text-[#374151] text-sm font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCheckVersions}
                disabled={!selectedFile || step === 'checking'}
                className="flex items-center gap-2 h-[38px] px-[18px] bg-[#2d6fa8] hover:bg-[#245c8f] disabled:bg-[#d1d5db] disabled:text-[#9ca3af] text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {step === 'checking' && <Spinner />}
                {step === 'checking' ? 'Checking…' : 'Import source'}
              </button>
            </>
          )}

          {/* RESULTS step buttons */}
          {(step === 'results' || step === 'importing') && (
            <>
              <button
                type="button"
                onClick={() => { setStep('form'); setCheckResult(null); setErrorMsg(null) }}
                disabled={step === 'importing'}
                className="h-[38px] px-[18px] bg-white border border-[#d1d5db] hover:bg-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed text-[#374151] text-sm font-semibold rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                disabled={step === 'importing'}
                className="h-[38px] px-[18px] bg-white border border-[#d1d5db] hover:bg-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed text-[#374151] text-sm font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              {canProceed && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={step === 'importing'}
                  className="flex items-center gap-2 h-[38px] px-[18px] bg-[#2d6fa8] hover:bg-[#245c8f] disabled:bg-[#d1d5db] disabled:text-[#9ca3af] text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {step === 'importing' && <Spinner />}
                  {step === 'importing' ? 'Importing…' : 'Import source'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null
}
