import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ImportCourseModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (file: File, assetFolders: string, tags: string) => void
}

export default function ImportCourseModal({ isOpen, onClose, onImport }: ImportCourseModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [assetFolders, setAssetFolders] = useState('')
  const [tags, setTags] = useState('')

  if (!isOpen) return null

  const canImport = selectedFile !== null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null)
  }

  function handleImport() {
    if (!selectedFile) return
    onImport(selectedFile, assetFolders, tags)
  }

  function handleClose() {
    setSelectedFile(null)
    setAssetFolders('')
    setTags('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 99999 }}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-[560px] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5e7eb]">
          <h2 className="text-base font-bold text-[#111827]">Import framework source</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-md text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-6 overflow-y-auto">

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
                className="flex items-center gap-2 px-4 h-9 bg-white border border-[#d1d5db] hover:bg-[#f9fafb] text-[#374151] text-sm font-medium rounded-lg transition-colors shrink-0"
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
                onChange={handleFileChange}
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
              placeholder="assets, images, video, audio"
              className="w-full h-[42px] border border-[#d1d5db] rounded-lg px-3.5 text-sm text-[#111827] placeholder:text-[#9ca3af] bg-white outline-none focus:border-[#2d6fa8] transition-colors"
            />
          </div>

          {/* Tags */}
          <div>
            <p className="text-sm font-bold text-[#111827] mb-2.5">Tags</p>
            <textarea
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="add a tag"
              rows={4}
              className="w-full border border-[#d1d5db] rounded-lg px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] bg-white outline-none focus:border-[#2d6fa8] transition-colors resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
          <button
            type="button"
            onClick={handleClose}
            className="h-[38px] px-[18px] bg-white border border-[#d1d5db] hover:bg-[#f9fafb] text-[#374151] text-sm font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className="h-[38px] px-[18px] bg-[#2d6fa8] hover:bg-[#245c8f] disabled:bg-[#d1d5db] text-white disabled:text-[#9ca3af] text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            Import source
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
