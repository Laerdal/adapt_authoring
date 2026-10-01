interface PermissionDeniedModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function PermissionDeniedModal({ open, title, message, onClose }: PermissionDeniedModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center shrink-0 mt-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M12 14v3" />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-[#111827] text-base">{title}</h2>
              <p className="text-sm text-[#6b7280] mt-1.5 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5">
          <div className="p-4 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
            <p className="text-sm text-[#b91c1c]">You are not permitted to perform this action.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
