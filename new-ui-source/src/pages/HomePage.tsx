import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CourseCard } from '@/components/course'
import AiAssistant from '@/components/common/AiAssistant'
import { createCourse, deleteCourse, duplicateCourse, fetchDashboardCourses, getAuthoringMenuOptions, getAuthoringThemeOptions, updateCourse } from '@/api/adaptAuthoring'


type Theme = string

interface Course {
  id: number
  backendId?: string
  title: string
  description: string
  savedDate: string
  savedDateTs: number   // unix ms for sorting
  imageUrl: string | null
  heroAssetId: string | null
  theme: Theme
  tags: string[]
}

const INITIAL_COURSES: Course[] = [
  { id: 1, title: 'Introduction to Digital Marketing',    description: 'This comprehensive course covers all aspects of digital marketing including SEO, social media, and content strategy.',    savedDate: 'May 11, 2026', savedDateTs: new Date('2026-05-11').getTime(), imageUrl: null, heroAssetId: null, theme: 'LIFE Theme',    tags: ['Marketing', 'SEO', 'Beginner'] },
  { id: 2, title: 'Basic CPR Training',                   description: 'This course provides essential knowledge and hands-on practice for performing CPR in emergency situations.',             savedDate: 'Mar 27, 2026', savedDateTs: new Date('2026-03-27').getTime(), imageUrl: null, heroAssetId: null, theme: 'Vanilla Theme', tags: ['Healthcare', 'Emergency', 'CPR'] },
  { id: 3, title: 'Advanced Airway Management',           description: 'Covers advanced techniques for managing patient airways in clinical and pre-hospital settings.',                        savedDate: 'Mar 24, 2026', savedDateTs: new Date('2026-03-24').getTime(), imageUrl: null, heroAssetId: null, theme: 'LIFE Theme',    tags: ['Healthcare', 'Advanced', 'Clinical'] },
  { id: 4, title: 'Patient Safety Fundamentals',          description: 'An introduction to patient safety principles, error prevention, and culture of safety in healthcare organisations.',   savedDate: 'Feb 14, 2026', savedDateTs: new Date('2026-02-14').getTime(), imageUrl: null, heroAssetId: null, theme: 'Custom Theme',  tags: ['Safety', 'Healthcare', 'Beginner'] },
  { id: 5, title: 'Neonatal Resuscitation Program',       description: 'Evidence-based curriculum for healthcare providers who care for newborns at delivery.',                               savedDate: 'Jan 30, 2026', savedDateTs: new Date('2026-01-30').getTime(), imageUrl: null, heroAssetId: null, theme: 'Vanilla Theme', tags: ['Neonatal', 'Emergency', 'Clinical'] },
  { id: 6, title: 'Trauma Assessment and Management',     description: 'Systematic approach to evaluating and treating trauma patients in emergency and critical care settings.',             savedDate: 'Jan 10, 2026', savedDateTs: new Date('2026-01-10').getTime(), imageUrl: null, heroAssetId: null, theme: 'LIFE Theme',    tags: ['Trauma', 'Emergency', 'Advanced'] },
]

const SORT_OPTIONS = [
  { label: 'Recently Modified', value: 'recent'    },
  { label: 'Alphabetical A–Z',  value: 'alpha-asc' },
  { label: 'Alphabetical Z–A',  value: 'alpha-desc'},
  { label: 'Date Created',      value: 'date'      },
]
const FALLBACK_THEME_OPTIONS: Theme[] = ['LIFE Theme']
const FALLBACK_MENU_OPTIONS = ['LIFE Menu']

function normalizeOption(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function pickPreferredTheme(options: string[]): string {
  const exactLife = options.find((o) => normalizeOption(o) === 'lifetheme')
  if (exactLife) return exactLife

  const lifeNotV2 = options.find((o) => /life/i.test(o) && !/v2/i.test(o))
  if (lifeNotV2) return lifeNotV2

  return options[0] || 'LIFE Theme'
}

function pickPreferredMenu(options: string[]): string {
  const exactLife = options.find((o) => normalizeOption(o) === 'lifemenu')
  if (exactLife) return exactLife

  const life = options.find((o) => /life/i.test(o))
  if (life) return life

  return options[0] || 'LIFE Menu'
}

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const READ_ONLY_REASON = 'Import is temporarily disabled until the matching Adapt API endpoint is wired.'

  // Search / filter / sort / view
  const [search, setSearch]           = useState('')
  const [themeFilter, setThemeFilter] = useState<Theme | 'All'>('All')
  const [themeOptions, setThemeOptions] = useState<Theme[]>(FALLBACK_THEME_OPTIONS)
  const [menuOptions, setMenuOptions] = useState<string[]>(FALLBACK_MENU_OPTIONS)
  const [sort, setSort]               = useState('recent')
  const [view, setView]               = useState<'grid' | 'list'>('grid')
  const [sortOpen, setSortOpen]       = useState(false)
  const [filterOpen, setFilterOpen]   = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagSearch, setTagSearch]         = useState('')

  // Toast notifications
  type Toast = { id: number; message: string; type: 'success' | 'info' }
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const loadCourses = useCallback(async () => {
    try {
      setIsLoadingCourses(true)
      const shared = location.pathname === '/shared'
      const apiCourses = await fetchDashboardCourses(shared)
      // Always reflect the live result — including empty (e.g. no shared courses),
      // so the UI matches the engine instead of falling back to sample data.
      setCourses(apiCourses)
    } catch {
      setCourses([])
      showToast('Could not load live course data.', 'info')
    } finally {
      setIsLoadingCourses(false)
    }
  }, [location.pathname, showToast])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [themes, menus] = await Promise.all([
          getAuthoringThemeOptions(),
          getAuthoringMenuOptions(),
        ]);
        if (cancelled) return;

        const resolvedThemes = themes.length ? themes : FALLBACK_THEME_OPTIONS;
        const resolvedMenus = menus.length ? menus : FALLBACK_MENU_OPTIONS;

        setThemeOptions(resolvedThemes);
        setMenuOptions(resolvedMenus);
        setNewTheme((prev) => (prev && resolvedThemes.includes(prev)) ? prev : pickPreferredTheme(resolvedThemes));
        setNewMenu((prev) => (prev && resolvedMenus.includes(prev)) ? prev : pickPreferredMenu(resolvedMenus));
      } catch {
        if (cancelled) return;
        setThemeOptions(FALLBACK_THEME_OPTIONS);
        setMenuOptions(FALLBACK_MENU_OPTIONS);
        setNewTheme((prev) => prev || pickPreferredTheme(FALLBACK_THEME_OPTIONS));
        setNewMenu((prev) => prev || pickPreferredMenu(FALLBACK_MENU_OPTIONS));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle]     = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [newTheme, setNewTheme]     = useState<Theme>(pickPreferredTheme(FALLBACK_THEME_OPTIONS))
  const [newMenu, setNewMenu]       = useState(pickPreferredMenu(FALLBACK_MENU_OPTIONS))
  const [themeOpen, setThemeOpen]   = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [isCreatingCourse, setIsCreatingCourse] = useState(false)

  // Close dropdowns on outside click
  const toolbarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setSortOpen(false)
        setFilterOpen(false)
        setTagFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function openCreateModal() {
    setNewTitle('')
    setNewDesc('')
    setNewTheme(pickPreferredTheme(themeOptions))
    setNewMenu(pickPreferredMenu(menuOptions))
    setCreateOpen(true)
  }

  async function handleNext() {
    const title = newTitle.trim() || 'Untitled Course'

    try {
      setIsCreatingCourse(true)
      const created = await createCourse({
        title,
        description: newDesc,
        theme: newTheme,
        menuStyle: newMenu,
      })

      const params = new URLSearchParams({
        title,
        description: newDesc,
        theme: newTheme,
        menu: newMenu,
        courseId: created.id,
      })

      setCreateOpen(false)
      navigate(`/course/new/setup?${params.toString()}`)
    } catch {
      showToast('Course creation failed.', 'info')
    } finally {
      setIsCreatingCourse(false)
    }
  }

  async function handleUpdate(id: number, patch: { title?: string; description?: string; heroAssetId?: string | null; tags?: string[] }) {
    const target = courses.find((c) => c.id === id)
    if (!target?.backendId) {
      showToast('Could not resolve course ID for update.', 'info')
      return
    }
    try {
      await updateCourse(target.backendId, {
        title: patch.title,
        description: patch.description,
        heroAssetId: patch.heroAssetId,
        tags: patch.tags,
      })
      await loadCourses()
      showToast('Course updated successfully')
    } catch {
      showToast('Course update failed.', 'info')
    }
  }

  async function handleCopy(id: number) {
    const source = courses.find((c) => c.id === id)
    if (!source) return
    if (!source.backendId) {
      showToast('Could not resolve course ID for copy.', 'info')
      return
    }
    try {
      await duplicateCourse(source.backendId)
      await loadCourses()
      showToast(`"${source.title}" copied successfully`)
    } catch {
      showToast('Course copy failed.', 'info')
    }
  }

  function handleCopyId(id: number) {
    navigator.clipboard.writeText(String(id)).catch(() => {})
    showToast(`Course ID ${id} copied to clipboard`, 'info')
  }

  async function handleDelete(id: number) {
    const target = courses.find((c) => c.id === id)
    if (!target?.backendId) {
      showToast('Could not resolve course ID for delete.', 'info')
      return
    }
    try {
      await deleteCourse(target.backendId)
      await loadCourses()
      showToast('Course deleted', 'info')
    } catch {
      showToast('Course delete failed.', 'info')
    }
  }

  // Import
  const importInputRef = useRef<HTMLInputElement>(null)

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    showToast(`${READ_ONLY_REASON} Import is blocked for now.`, 'info')
  }

  function clearSearch() { setSearch('') }
  function clearTheme()  { setThemeFilter('All') }
  function clearTags()   { setSelectedTags([]) }
  function clearAll()    { setSearch(''); setThemeFilter('All'); setSelectedTags([]) }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (
      prev.some((item) => item.toLowerCase() === tag.toLowerCase())
        ? prev.filter((item) => item.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag]
    ))
  }

  function normalizeTagValue(tag: unknown): string {
    if (typeof tag === 'string') return tag.trim()
    if (!tag || typeof tag !== 'object') return ''

    const candidate = tag as { title?: unknown; name?: unknown; label?: unknown; id?: unknown }
    const text = candidate.title ?? candidate.name ?? candidate.label ?? candidate.id
    return typeof text === 'string' ? text.trim() : ''
  }

  const availableTags = useMemo(() => {
    const tags = courses.flatMap((course) => course.tags)
      .map((tag) => normalizeTagValue(tag))
      .filter(Boolean)

    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b))
  }, [courses])

  const displayed = useMemo(() => {
    let list = courses.filter((c) => {
      const q = search.trim().toLowerCase()
      const matchSearch = q === '' || c.title.toLowerCase().includes(q)
      const matchTheme  = themeFilter === 'All' || c.theme === themeFilter
      const courseTagLabels = c.tags.map((courseTag) => normalizeTagValue(courseTag)).filter(Boolean)
      const matchTags = selectedTags.length === 0 || selectedTags.every((selectedTag) => (
        courseTagLabels.some((courseTag) => courseTag.toLowerCase() === selectedTag.toLowerCase())
      ))
      return matchSearch && matchTheme && matchTags
    })
    switch (sort) {
      case 'alpha-asc':  list = [...list].sort((a, b) => a.title.localeCompare(b.title)); break
      case 'alpha-desc': list = [...list].sort((a, b) => b.title.localeCompare(a.title)); break
      case 'date':       list = [...list].sort((a, b) => a.savedDateTs - b.savedDateTs);  break
      default:           list = [...list].sort((a, b) => b.savedDateTs - a.savedDateTs);  break // recent
    }
    return list
  }, [courses, search, themeFilter, selectedTags, sort])

  const activeSort = SORT_OPTIONS.find((o) => o.value === sort)!
  const hasFilters = search.trim() !== '' || themeFilter !== 'All' || selectedTags.length > 0

  return (
    <>
    <div className="px-4 sm:px-6 md:px-8 py-5 md:py-6">

          {/* Page heading */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#111827] leading-tight">{location.pathname === '/shared' ? 'Shared with Me' : location.pathname === '/my-courses' ? 'My Courses' : 'All Courses'}</h1>
              <p className="text-sm text-[#6b7280] mt-1">Manage and organize your courses</p>
              <p className="text-xs text-[#b45309] mt-1">Partial write mode: copy, edit, delete, and create are persisted; import remains disabled.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Import */}
              <input
                ref={importInputRef}
                type="file"
                accept=".zip,.json"
                className="hidden"
                aria-label="Import course file"
                onChange={handleImport}
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                title={READ_ONLY_REASON}
                disabled
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#d1d5db] hover:bg-[#f9fafb] text-[#374151] text-sm font-semibold rounded-lg transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="hidden sm:inline">Import Course</span>
                <span className="sm:hidden">Import</span>
              </button>

              {/* Create New Course */}
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#2d6fa8] hover:bg-[#245c8f] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="hidden sm:inline">Create New Course</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div ref={toolbarRef} className="flex flex-wrap items-center gap-2 mb-3">
            {/* Search */}
            <div className="w-full sm:flex-1 sm:max-w-xl flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') clearSearch() }}
                  placeholder="Search by name"
                  className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent placeholder-[#9ca3af] text-[#111827]"
                />
                {search && (
                  <button type="button" onClick={clearSearch} title="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setTagFilterOpen((open) => !open); setFilterOpen(false); setSortOpen(false); setTagSearch('') }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border rounded-lg transition-colors whitespace-nowrap ${
                    selectedTags.length > 0
                      ? 'border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8] font-medium'
                      : 'bg-white border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]'
                  }`}
                >
                  Search by tag
                  {selectedTags.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#2d6fa8] text-white text-[10px] font-bold flex items-center justify-center">{selectedTags.length}</span>
                  )}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${tagFilterOpen ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {tagFilterOpen && (
                  <div className="absolute left-0 mt-1 w-64 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1">
                    {/* Search input */}
                    <div className="px-2 pt-1.5 pb-1">
                      <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                          type="text"
                          value={tagSearch}
                          onChange={(e) => setTagSearch(e.target.value)}
                          placeholder="Search tags…"
                          className="w-full pl-7 pr-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-1 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827] bg-[#f9fafb]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                    {availableTags.filter((t) => !tagSearch.trim() || t.toLowerCase().includes(tagSearch.trim().toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-sm text-[#9ca3af]">No matching tags</p>
                    )}
                    {availableTags.filter((t) => !tagSearch.trim() || t.toLowerCase().includes(tagSearch.trim().toLowerCase())).map((tag) => {
                      const isSelected = selectedTags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase())
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                            isSelected ? 'bg-[#dbeeff] text-[#2d6fa8] font-medium' : 'text-[#374151] hover:bg-[#f9fafb]'
                          }`}
                        >
                          <span>#{tag}</span>
                          {isSelected && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                    </div>
                    {selectedTags.length > 0 && (
                      <>
                        <div className="border-t border-[#f3f4f6] my-1" />
                        <button type="button" onClick={() => { clearTags(); setTagFilterOpen(false); setTagSearch('') }} className="w-full text-left px-3 py-2 text-sm text-[#ef4444] hover:bg-[#fef2f2] transition-colors">
                          Clear tags
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              {/* Theme filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setFilterOpen((o) => !o); setSortOpen(false) }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border rounded-lg transition-colors whitespace-nowrap ${
                    themeFilter !== 'All'
                      ? 'border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8] font-medium'
                      : 'bg-white border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]'
                  }`}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
                  </svg>
                  <span className="hidden sm:inline">{themeFilter === 'All' ? 'Filter' : themeFilter}</span>
                  {themeFilter !== 'All' && (
                    <span className="w-4 h-4 rounded-full bg-[#2d6fa8] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  )}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1">
                    <p className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Filter by theme</p>
                    {(['All', ...themeOptions]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => { setThemeFilter(opt as Theme | 'All'); setFilterOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                          themeFilter === opt ? 'bg-[#dbeeff] text-[#2d6fa8] font-medium' : 'text-[#374151] hover:bg-[#f9fafb]'
                        }`}
                      >
                        {opt === 'All' ? 'All Themes' : opt}
                        {themeFilter === opt && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                    {themeFilter !== 'All' && (
                      <>
                        <div className="border-t border-[#f3f4f6] my-1" />
                        <button type="button" onClick={() => { clearTheme(); setFilterOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-[#ef4444] hover:bg-[#fef2f2] transition-colors">
                          Clear filter
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setSortOpen((o) => !o); setFilterOpen(false) }}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-[#374151] bg-white border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] transition-colors whitespace-nowrap"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M7 12h10M11 18h2" />
                  </svg>
                  <span className="hidden sm:inline">{activeSort.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {sortOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-20 py-1">
                    <p className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Sort by</p>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => { setSort(opt.value); setSortOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                          sort === opt.value ? 'bg-[#dbeeff] text-[#2d6fa8] font-medium' : 'text-[#374151] hover:bg-[#f9fafb]'
                        }`}
                      >
                        {opt.label}
                        {sort === opt.value && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center border border-[#e5e7eb] rounded-lg overflow-hidden">
                <button
                  type="button"
                  aria-label="Grid view"
                  onClick={() => setView('grid')}
                  className={`p-2.5 transition-colors ${view === 'grid' ? 'bg-[#2d6fa8] text-white' : 'bg-white text-[#9ca3af] hover:bg-[#f9fafb]'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  onClick={() => setView('list')}
                  className={`p-2.5 transition-colors border-l border-[#e5e7eb] ${view === 'list' ? 'bg-[#2d6fa8] text-white' : 'bg-white text-[#9ca3af] hover:bg-[#f9fafb]'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {search.trim() && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f3f4f6] text-xs text-[#374151] font-medium">
                  Search: <span className="text-[#2d6fa8]">"{search.trim()}"</span>
                  <button type="button" onClick={clearSearch} aria-label="Remove search filter" className="text-[#9ca3af] hover:text-[#374151] ml-0.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              )}
              {themeFilter !== 'All' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dbeeff] text-xs text-[#2d6fa8] font-medium">
                  Theme: {themeFilter}
                  <button type="button" onClick={clearTheme} aria-label="Remove theme filter" className="text-[#2d6fa8] hover:text-[#1e4d73] ml-0.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              )}
              {selectedTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eef2ff] text-xs text-[#3730a3] font-medium">
                  Tag: #{tag}
                  <button
                    type="button"
                    onClick={() => setSelectedTags((prev) => prev.filter((item) => item.toLowerCase() !== tag.toLowerCase()))}
                    aria-label={`Remove tag ${tag}`}
                    className="text-[#3730a3] hover:text-[#1d4ed8] ml-0.5"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              <button type="button" onClick={clearAll} className="text-xs text-[#9ca3af] hover:text-[#374151] underline underline-offset-2 transition-colors">
                Clear all
              </button>
              <span className="ml-auto text-xs text-[#9ca3af]">{displayed.length} course{displayed.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Courses */}
          {isLoadingCourses ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#9ca3af]">
              <p className="text-sm">Loading courses...</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#9ca3af]">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <p className="text-sm">No courses found</p>
            </div>
          ) : (
            <div className={
              view === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5'
                : 'flex flex-col gap-2'
            }>
              {displayed.map((course) => (
                <CourseCard
                  key={course.id}
                  {...course}
                  viewHref={course.backendId ? `/course/${course.backendId}/preview` : ""}
                  onCopy={() => handleCopy(course.id)}
                  onCopyId={() => handleCopyId(course.id)}
                  onDelete={() => handleDelete(course.id)}
                />
              ))}
            </div>
          )}
    </div>

      {/* Create Course Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-visible">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <div>
                <h2 className="font-semibold text-[#111827] text-base">Create New Course</h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Set up the basics before entering the editor</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Course Title */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Course Title <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Introduction to Digital Marketing"
                  className="w-full px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827] placeholder-[#9ca3af]"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe what this course covers…"
                  className="w-full px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent text-[#111827] placeholder-[#9ca3af] resize-none"
                />
              </div>

              {/* Theme + Menu selectors */}
              <div className="grid grid-cols-2 gap-4">
                {/* Theme selector */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Theme</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setThemeOpen((o) => !o); setMenuOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg bg-white hover:border-[#2d6fa8] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] text-[#111827] transition-colors"
                    >
                      <span>{newTheme}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${themeOpen ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {themeOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-10 py-1">
                        {themeOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => { setNewTheme(opt); setThemeOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${newTheme === opt ? 'bg-[#dbeeff] text-[#2d6fa8] font-medium' : 'text-[#374151] hover:bg-[#f9fafb]'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu selector */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Menu Style</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setMenuOpen((o) => !o); setThemeOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg bg-white hover:border-[#2d6fa8] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] text-[#111827] transition-colors"
                    >
                      <span>{newMenu}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {menuOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-10 py-1">
                        {menuOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => { setNewMenu(opt); setMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${newMenu === opt ? 'bg-[#dbeeff] text-[#2d6fa8] font-medium' : 'text-[#374151] hover:bg-[#f9fafb]'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!newTitle.trim() || isCreatingCourse}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isCreatingCourse ? 'Creating...' : 'Next'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notifications ── */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-fade-in-down min-w-[260px] max-w-sm ${
              toast.type === 'success'
                ? 'bg-[#111827] text-white'
                : 'bg-[#1e4d73] text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#4ade80]">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#60a5fa]">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/60 hover:text-white transition-colors ml-1"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <AiAssistant context="Dashboard" />
    </>
  )
}
