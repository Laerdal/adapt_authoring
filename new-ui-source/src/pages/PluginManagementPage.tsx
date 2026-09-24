import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  checkPluginUpdate,
  deletePlugin,
  getMaxFileUploadSize,
  getPlugins,
  getPluginUses,
  setPluginAddedByDefault,
  setPluginEnabled,
  updatePlugin,
  uploadPlugin,
  type DashboardPlugin,
  type PluginCategory,
} from "@/api/adaptAuthoring";
import AiAssistant from "@/components/common/AiAssistant";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ErrorDialog from "@/components/common/ErrorDialog";

const FILTER_OPTIONS: Array<{ value: "all" | PluginCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "extensions", label: "Extension" },
  { value: "components", label: "Component" },
  { value: "themes", label: "Theme" },
  { value: "menus", label: "Menu" },
];
const PAGE_SIZE_OPTIONS = [5, 10, 20];
type UpdateState = "idle" | "checking" | "available" | "updating" | "updated" | "failed";
type Toast = { id: number; message: string; type: "success" | "info" | "error" };

function TableCheckbox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={disabled ? "Deprecated plugins cannot be enabled" : label}
      disabled={disabled}
      onClick={onChange}
      className={`mx-auto flex h-5 w-5 items-center justify-center rounded-[4px] border-2 transition-colors ${
        checked ? "border-[#2d6fa8] bg-[#2d6fa8] text-white" : "border-[#9ca3af] bg-white text-transparent"
      } disabled:cursor-not-allowed`}
    >
      <Check size={14} strokeWidth={3} aria-hidden="true" />
    </button>
  );
}

function UploadPluginModal({
  open,
  uploading,
  onClose,
  onUpload,
}: {
  open: boolean;
  uploading: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [maxFileUploadSize, setMaxFileUploadSize] = useState("500MB");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setDragging(false);
    }
  }, [open]);

  useEffect(() => {
    let active = true;
    void getMaxFileUploadSize().then((value) => {
      if (active) setMaxFileUploadSize(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!open) return null;

  const chooseFile = (candidate?: File) => {
    if (candidate) setFile(candidate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={(event) => event.target === event.currentTarget && !uploading && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="upload-plugin-title" className="w-full max-w-[560px] overflow-hidden rounded-[18px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#e5e7eb] px-8 py-6">
          <div>
            <h2 id="upload-plugin-title" className="text-xl font-semibold text-[#111827]">Upload Plugin</h2>
            <p className="mt-1 text-sm text-[#6b7280]">Select a plugin file from your device</p>
          </div>
          <button type="button" onClick={onClose} disabled={uploading} title="Close" aria-label="Close upload dialog" className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] disabled:opacity-40">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="px-8 py-7">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files[0]);
            }}
            className={`flex min-h-[225px] w-full flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-6 text-center transition-colors ${
              dragging ? "border-[#2d6fa8] bg-[#f0f8ff]" : "border-[#d1d5db] bg-white hover:border-[#2d6fa8] hover:bg-[#fafcff]"
            }`}
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f3f4f6] text-[#6b7280]">
              <Upload size={26} aria-hidden="true" />
            </span>
            <span className="text-base font-semibold text-[#111827]">{file ? file.name : "Click to browse files"}</span>
            <span className="mt-3 text-sm text-[#6b7280]">Supports .zip</span>
          </button>
          <p className="mt-3 text-left text-sm text-[#6b7280]">Maximum upload file size: {maxFileUploadSize}.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.tar.gz,.tgz,application/zip,application/gzip"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] px-8 py-5">
          <button type="button" onClick={onClose} disabled={uploading} className="rounded-lg border border-[#d1d5db] bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => file && onUpload(file)}
            disabled={!file || uploading}
            className="flex items-center gap-2 rounded-lg bg-[#2d6fa8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#245c8f] disabled:cursor-not-allowed disabled:bg-[#e5e7eb] disabled:text-[#9ca3af]"
          >
            {uploading ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PluginManagementPage() {
  const [plugins, setPlugins] = useState<DashboardPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | PluginCategory>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [updateStates, setUpdateStates] = useState<Record<string, UpdateState>>({});
  const [deleteTarget, setDeleteTarget] = useState<DashboardPlugin | null>(null);
  const [deleteError, setDeleteError] = useState<{ title: string; message: ReactNode } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const showToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = ++toastCounter.current;
    setToasts((previous) => [...previous, { id, message, type }]);
    window.setTimeout(() => setToasts((previous) => previous.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      setPlugins(await getPlugins());
    } catch {
      setPlugins([]);
      showToast("Could not load plugins", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void loadPlugins(); }, [loadPlugins]);

  const updatePluginState = (backendId: string, state: UpdateState) => {
    setUpdateStates((previous) => ({ ...previous, [backendId]: state }));
  };

  async function toggleEnabled(plugin: DashboardPlugin) {
    if (plugin.isDeprecated) return;
    const enabled = plugin.status !== "Enabled";
    setPlugins((previous) => previous.map((item) => item.backendId === plugin.backendId ? { ...item, status: enabled ? "Enabled" : "Disabled" } : item));
    try {
      await setPluginEnabled(plugin.category, plugin.backendId, enabled);
      showToast(`"${plugin.name}" ${enabled ? "enabled" : "disabled"}`, enabled ? "success" : "info");
    } catch {
      setPlugins((previous) => previous.map((item) => item.backendId === plugin.backendId ? plugin : item));
      showToast(`Could not update "${plugin.name}"`, "error");
    }
  }

  async function toggleAddedByDefault(plugin: DashboardPlugin) {
    const enabled = !plugin.isAddedByDefault;
    setPlugins((previous) => previous.map((item) => item.backendId === plugin.backendId ? { ...item, isAddedByDefault: enabled } : item));
    try {
      await setPluginAddedByDefault(plugin.backendId, enabled);
    } catch {
      setPlugins((previous) => previous.map((item) => item.backendId === plugin.backendId ? plugin : item));
      showToast(`Could not update "${plugin.name}"`, "error");
    }
  }

  async function handleUpdateAction(plugin: DashboardPlugin) {
    const state = updateStates[plugin.backendId] ?? "idle";
    if (state === "checking" || state === "updating" || state === "updated") return;
    if (state !== "available") {
      updatePluginState(plugin.backendId, "checking");
      try {
        updatePluginState(plugin.backendId, await checkPluginUpdate(plugin.category, plugin.backendId) ? "available" : "updated");
      } catch {
        updatePluginState(plugin.backendId, "failed");
      }
      return;
    }

    updatePluginState(plugin.backendId, "updating");
    try {
      await updatePlugin(plugin.category, plugin.backendId);
      updatePluginState(plugin.backendId, "updated");
      await loadPlugins();
      showToast(`"${plugin.name}" updated`);
    } catch {
      updatePluginState(plugin.backendId, "failed");
      showToast(`Could not update "${plugin.name}"`, "error");
    }
  }

  async function requestDelete(plugin: DashboardPlugin) {
    try {
      const courses = await getPluginUses(plugin.category, plugin.backendId);
      if (courses.length) {
        setDeleteError({
          title: `Cannot Delete ${plugin.name}`,
          message: (
            <>
              <p>This plugin is used in the following courses:</p>
              {courses.map((course) => (
                <p key={`${course._id}-${course.title}`}>
                  {course.title} by {course.createdByEmail || "Unknown"}
                </p>
              ))}
            </>
          ),
        });
        return;
      }
      setDeleteTarget(plugin);
    } catch {
      setDeleteError({
        title: "Error",
        message: `Could not check where "${plugin.name}" is used`,
      });
    }
  }

  async function confirmDelete() {
    const plugin = deleteTarget;
    setDeleteTarget(null);
    if (!plugin) return;
    try {
      await deletePlugin(plugin.category, plugin.backendId);
      setPlugins((previous) => previous.filter((item) => item.backendId !== plugin.backendId));
      showToast(`"${plugin.name}" deleted`);
    } catch {
      setDeleteError({
        title: "Error",
        message: `Could not delete "${plugin.name}"`,
      });
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      await uploadPlugin(file);
      setUploadOpen(false);
      await loadPlugins();
      showToast("Plugin uploaded successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Plugin upload failed";
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plugins.filter((plugin) => {
      const matchesCategory = filter === "all" || plugin.category === filter;
      const matchesSearch = !term || plugin.name.toLowerCase().includes(term) || plugin.description.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [filter, plugins, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const enabledCount = plugins.filter((plugin) => plugin.status === "Enabled").length;

  const updateAction = (plugin: DashboardPlugin) => {
    if (plugin.isLocalPackage) {
      return <span title="Uploaded by user" className="flex h-8 w-8 items-center justify-center text-[#6b7280]"><UserRound size={16} aria-hidden="true" /></span>;
    }
    const state = updateStates[plugin.backendId] ?? "idle";
    const config = {
      idle: { label: "Check for updates", icon: <RefreshCw size={16} /> },
      checking: { label: "Checking for updates", icon: <RefreshCw size={16} className="animate-spin" /> },
      available: { label: "Update plugin", icon: <ArrowUp size={16} /> },
      updating: { label: "Updating plugin", icon: <RefreshCw size={16} className="animate-spin" /> },
      updated: { label: "Plugin is up to date", icon: <Check size={16} /> },
      failed: { label: "Update check failed. Try again", icon: <X size={16} /> },
    }[state];
    return (
      <button
        type="button"
        title={config.label}
        aria-label={`${config.label}: ${plugin.name}`}
        disabled={plugin.isDeprecated || state === "checking" || state === "updating" || state === "updated"}
        onClick={() => void handleUpdateAction(plugin)}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:cursor-default ${
          state === "available" ? "bg-[#2d6fa8] text-white hover:bg-[#245c8f]" :
          state === "failed" ? "text-[#dc2626] hover:bg-[#fee2e2]" :
          state === "updated" ? "text-[#16a34a] hover:bg-[#dcfce7] hover:text-[#15803d]" :
          "text-[#6b7280] hover:bg-[#dbeeff] hover:text-[#2d6fa8] disabled:opacity-50"
        }`}
      >
        {config.icon}
      </button>
    );
  };

  return (
    <>
      <div className="px-4 py-5 sm:px-6 md:px-8 md:py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-[#111827] md:text-3xl">Plugin Management</h1>
            <p className="mt-1 text-sm text-[#6b7280]">{enabledCount} of {plugins.length} plugins enabled</p>
          </div>
          <button type="button" onClick={() => setUploadOpen(true)} className="flex items-center gap-2 rounded-lg bg-[#2d6fa8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#245c8f]">
            <Upload size={17} aria-hidden="true" />
            Upload Plugin
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by name..." className="w-full rounded-lg border border-[#e5e7eb] bg-white py-2.5 pl-9 pr-4 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2d6fa8]" />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-[#f3f4f6] p-1">
            {FILTER_OPTIONS.map((option) => (
              <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => { setFilter(option.value); setPage(1); }} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === option.value ? "bg-white text-[#2d6fa8] shadow-sm" : "text-[#6b7280] hover:text-[#374151]"}`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                  <th className="w-[20%] px-4 py-3 text-left font-medium text-[#6b7280]">Name</th>
                  <th className="w-[35%] px-4 py-3 text-left font-medium text-[#6b7280]">Description</th>
                  <th className="w-[10%] px-4 py-3 text-left font-medium text-[#6b7280]">Version</th>
                  <th className="w-[10%] px-4 py-3 text-center font-medium text-[#6b7280]">Enabled</th>
                  <th className="w-[15%] px-4 py-3 text-center font-medium leading-tight text-[#6b7280]">Add to new courses by default?</th>
                  <th className="w-[10%] px-4 py-3 text-right font-medium text-[#6b7280]">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-16 text-center text-[#9ca3af]">Loading plugins...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-[#9ca3af]">No plugins found</td></tr>
                ) : paginated.map((plugin, index) => {
                  const disabled = plugin.status === "Disabled" || plugin.isDeprecated;
                  return (
                    <tr key={plugin.backendId} className={`border-b border-[#f3f4f6] transition-colors hover:bg-[#fafafa] ${index === paginated.length - 1 ? "border-b-0" : ""} ${disabled ? "opacity-55" : ""}`}>
                      <td className="px-4 py-3 font-medium text-[#111827]">
                        <span title={plugin.packageName || plugin.name}>{plugin.name}</span>
                        {plugin.isDeprecated && <span className="ml-2 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-semibold text-[#b42318]">Deprecated</span>}
                      </td>
                      <td className="px-4 py-3 text-[#6b7280]">
                        <p className="truncate" title={plugin.description}>{plugin.description || "-"}</p>
                        {plugin.homepage && <a href={plugin.homepage} target="_blank" rel="noreferrer" className="text-xs text-[#2d6fa8] hover:underline">Visit plugin homepage</a>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#6b7280]">{plugin.version || "-"}</td>
                      <td className="px-4 py-3 text-center"><TableCheckbox checked={plugin.status === "Enabled"} disabled={plugin.isDeprecated} label={`${plugin.status === "Enabled" ? "Disable" : "Enable"} ${plugin.name}`} onChange={() => void toggleEnabled(plugin)} /></td>
                      <td className="px-4 py-3 text-center">
                        {plugin.category === "extensions" ? <TableCheckbox checked={plugin.isAddedByDefault} disabled={plugin.isDeprecated} label={`${plugin.isAddedByDefault ? "Do not add" : "Add"} ${plugin.name} to new courses by default`} onChange={() => void toggleAddedByDefault(plugin)} /> : <span className="text-[#d1d5db]">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {updateAction(plugin)}
                          <button type="button" title="Delete plugin" aria-label={`Delete ${plugin.name}`} onClick={() => void requestDelete(plugin)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6b7280] transition-colors hover:bg-[#fee2e2] hover:text-[#dc2626]"><Trash2 size={15} aria-hidden="true" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-[#6b7280]">
              <span>{filtered.length === 0 ? "0 results" : `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} plugins`}</span>
              <span className="text-[#d1d5db]">|</span><span>Rows per page:</span>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8]">
                {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} title="First page" className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#e5e7eb] disabled:cursor-not-allowed disabled:opacity-30"><ChevronsLeft size={14} /></button>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1} title="Previous page" className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#e5e7eb] disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft size={14} /></button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).filter((number) => number === 1 || number === totalPages || Math.abs(number - safePage) <= 1).reduce<Array<number | "...">>((items, number, index, pages) => { if (index > 0 && number - pages[index - 1] > 1) items.push("..."); items.push(number); return items; }, []).map((item, index) => item === "..." ? <span key={`ellipsis-${index}`} className="px-1 text-sm text-[#9ca3af]">...</span> : <button key={item} type="button" onClick={() => setPage(item)} className={`h-[30px] min-w-[30px] rounded-lg text-sm font-medium ${safePage === item ? "bg-[#2d6fa8] text-white" : "text-[#374151] hover:bg-[#e5e7eb]"}`}>{item}</button>)}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} title="Next page" className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#e5e7eb] disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={14} /></button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} title="Last page" className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#e5e7eb] disabled:cursor-not-allowed disabled:opacity-30"><ChevronsRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      <UploadPluginModal open={uploadOpen} uploading={uploading} onClose={() => { if (!uploading) { setUploadOpen(false); setUploadError(null); } }} onUpload={(file) => void handleUpload(file)} />
      <ErrorDialog open={Boolean(uploadError)} title="Upload failed" message={uploadError ?? "Plugin upload failed"} onClose={() => setUploadError(null)} />
      <ErrorDialog
        open={Boolean(deleteError)}
        title={deleteError?.title ?? "Error"}
        message={deleteError?.message ?? ""}
        onClose={() => setDeleteError(null)}
      />
      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete plugin"
          message={<>Are you sure you want to delete <span className="font-medium text-[#111827]">"{deleteTarget.name}"</span>?</>}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      <AiAssistant context="Plugin Management" />
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex flex-col gap-2">
        {toasts.map((toast) => <div key={toast.id} className={`min-w-[260px] max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === "error" ? "bg-[#b42318]" : toast.type === "info" ? "bg-[#1e4d73]" : "bg-[#111827]"}`}>{toast.message}</div>)}
      </div>
    </>
  );
}
