import { useState } from "react";

export function CourseOverviewPage({ title, description }: { title: string; description: string }) {
  const [editing, setEditing] = useState(false);
  const [formTitle, setFormTitle] = useState(title);
  const [formSubTitle, setFormSubTitle] = useState("");
  const [formDesc, setFormDesc] = useState(description);
  const [formInstructions, setFormInstructions] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formCollaborators, setFormCollaborators] = useState("");

  const fieldClass = "w-full px-3 py-2.5 text-sm rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent focus:bg-white transition-colors";
  const readonlyClass = "w-full px-3 py-2.5 text-sm rounded-lg bg-[#f3f4f6] text-[#6b7280]";

  return (
    <div className="max-w-2xl w-full">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Course Overview</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Review and edit the core details for your course.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors shrink-0"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {/* Course Title */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">
            Course Title <span className="text-[#ef4444]">*</span>
          </label>
          {editing ? (
            <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Enter course title" className={fieldClass} />
          ) : (
            <div className={readonlyClass}>{formTitle || <span className="text-[#9ca3af]">No title set</span>}</div>
          )}
        </div>

        {/* Course Sub-Title */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Sub-Title</label>
          {editing ? (
            <input type="text" value={formSubTitle} onChange={(e) => setFormSubTitle(e.target.value)} placeholder="No sub-title set" className={fieldClass} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formSubTitle || "No sub-title set"}</span></div>
          )}
        </div>

        {/* Course Description */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Description</label>
          {editing ? (
            <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={3} placeholder="No description set" className={`${fieldClass} resize-none`} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formDesc || "No description set"}</span></div>
          )}
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Instructions</label>
          {editing ? (
            <textarea value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)} rows={2} placeholder="No instructions set" className={`${fieldClass} resize-none`} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formInstructions || "No instructions set"}</span></div>
          )}
        </div>

        {/* Course Image */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Course Image</label>
          <div className="w-full h-32 rounded-lg bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center text-sm text-[#9ca3af]">
            {editing ? (
              <label className="cursor-pointer flex flex-col items-center gap-2 text-[#6b7280] hover:text-[#2d6fa8] transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-xs">Click to upload image</span>
                <input type="file" accept="image/*" className="hidden" title="Upload course image" aria-label="Upload course image" />
              </label>
            ) : (
              "No image uploaded"
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Tags</label>
          {editing ? (
            <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="Add tags, separated by commas" className={fieldClass} />
          ) : (
            <div className={readonlyClass}><span className="text-[#9ca3af]">{formTags || "No tags added"}</span></div>
          )}
        </div>

        <div className="border-t border-[#e5e7eb] pt-5">
          <div className="mb-1">
            <p className="text-sm font-semibold text-[#111827]">Collaboration — Shared With</p>
            <p className="text-xs text-[#6b7280] mt-0.5">Collaborators who have access to this course</p>
          </div>
          <div className="mt-3">
            {editing ? (
              <input type="text" value={formCollaborators} onChange={(e) => setFormCollaborators(e.target.value)} placeholder="Add collaborator email addresses" className={fieldClass} />
            ) : (
              <div className={readonlyClass}><span className="text-[#9ca3af]">{formCollaborators || "No collaborators added"}</span></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
