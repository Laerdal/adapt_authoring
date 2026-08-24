import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import CommonCourseTopBarRow from "../components/course/CommonCourseTopBarRow";
import { getCourseBootstrapData, seedMissingCourseDefaults } from "../api/adaptAuthoring";
import { useAuth } from "../context/AuthContext";

type DeviceMode = "desktop" | "tablet" | "mobile";

const deviceButtonBase = "h-full w-9 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer";
const ICON_BASE = "/new/assets/icons";

function MaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[18px] h-[18px] shrink-0 bg-current"}
      style={{
        WebkitMaskImage: `url(${iconPath})`,
        maskImage: `url(${iconPath})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export default function CoursePreviewPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [courseTitle, setCourseTitle] = useState("Untitled Course");
  const [courseDescription, setCourseDescription] = useState("");
  const [themeName, setThemeName] = useState("");
  const [menuName, setMenuName] = useState("");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  // Track when the one-shot defaults seed has resolved so the iframe waits for
  // the possibly-issued PUT to complete before the framework loads course.json.
  const [defaultsReady, setDefaultsReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getCourseBootstrapData(id);
        if (cancelled) return;
        setCourseTitle(data.displayTitle || data.title || "Untitled Course");
        setCourseDescription(data.description || "");
        setThemeName(data.themeName || "");
        setMenuName(data.menuName || "");
      } catch {
        if (cancelled) return;
        setCourseTitle("Untitled Course");
        setCourseDescription("");
        setThemeName("");
        setMenuName("");
      }
    })();

    // Heal older courses (or courses freshly created via the minimal
    // POST /api/courses flow) whose top-level fields the Adapt runtime
    // dereferences — `_buttons`, `_globals`, `themeVariables._components`, … —
    // are absent or empty. Idempotent + non-blocking on failure.
    (async () => {
      try {
        await seedMissingCourseDefaults(id);
      } catch {
        /* seeding is best-effort */
      } finally {
        if (!cancelled) setDefaultsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const pageId = (params.get("pageId") || "").trim();

  const previewUrl = useMemo(() => {
    if (!id || !user?._tenantId || !defaultsReady) return "";
    const baseUrl = `/preview/${user._tenantId}/${id}/`;
    return pageId
      ? `${baseUrl}?_cs=${Date.now()}#/id/${pageId}`
      : `${baseUrl}?_cs=${Date.now()}`;
  }, [id, pageId, user?._tenantId, defaultsReady]);

  const frameSizeClass = useMemo(() => {
    if (deviceMode === "mobile") return "w-[390px]";
    if (deviceMode === "tablet") return "w-[820px]";
    return "w-full";
  }, [deviceMode]);

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden">
      <CommonCourseTopBarRow
        courseTitle={courseTitle}
        loginName={user?.username || user?.email || "Not signed in"}
        activeNav="preview"
        onBack={() => navigate("/")}
        onOpenCourseSettings={() => navigate(`/course/${id}/setup`)}
        onOpenStoryboard={() => navigate(`/course/${id}/setup?panel=storyboarding`)}
        onOpenEditor={() => navigate(`/course/${id}`, { state: { title: courseTitle, description: courseDescription, theme: themeName, menu: menuName } })}
        onOpenPreview={() => undefined}
        previewDisabled={!id || !user?._tenantId}
        previewMode="button"
      />

      <div className="h-[56px] bg-white border-b border-[#d8dde6] flex items-center px-4 md:px-6 shrink-0">
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 inline-flex items-center gap-1 p-[2px] rounded-[8px] border border-[#d8dde6] bg-[#f3f6f9]">
            {(["desktop", "tablet", "mobile"] as const).map((mode) => {
              const active = mode === deviceMode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDeviceMode(mode)}
                  aria-label={`Switch to ${mode} preview`}
                  className={`${deviceButtonBase} ${active ? "bg-[var(--life-primary-500)] text-white" : "text-[#1f2937] hover:bg-white active:bg-[var(--life-primary-100)]"}`}
                >
                  <MaskIcon file={`${mode}-icon.svg`} className="block w-4 h-4 shrink-0 bg-current" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/course/${id}`, { state: { title: courseTitle, description: courseDescription, theme: themeName, menu: menuName } })}
            className="h-9 px-4 rounded-[8px] border border-[#d8dde6] bg-white text-[#111827] text-[13px] font-bold hover:bg-[var(--life-neutral-020)] hover:border-[#c4cfda] active:bg-[var(--life-neutral-100)] transition-colors cursor-pointer inline-flex items-center"
          >
            Quick Edit
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-auto bg-[#e9edf2] px-3 md:px-6 py-4">
        {!previewUrl ? (
          <div className="h-full flex items-center justify-center text-sm text-[#6b7280]">
            Preview is unavailable for this course.
          </div>
        ) : (
          <div className="h-full w-full flex justify-center">
            <div className={`${frameSizeClass} h-full bg-white rounded-[10px] overflow-hidden shadow-[0_8px_30px_rgba(15,41,52,0.14)]`}>
              <iframe
                title="Course Preview"
                src={previewUrl}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
