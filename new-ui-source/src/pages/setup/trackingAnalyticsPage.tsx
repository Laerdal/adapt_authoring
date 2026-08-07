import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  defaultTrackingAnalyticsSettings,
  getTrackingAnalyticsSettings,
  saveTrackingAnalyticsSettings,
  type TrackingAnalyticsSettings,
} from "../../api/adaptAuthoring";
import { UnsavedChangesModal } from "./unsavedChangesModal";
import { useUnsavedChangesNavigationGuard } from "./useUnsavedChangesNavigationGuard";

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer group hover:bg-[#f9fafb]">
      <div
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]" : "border-[#d1d5db] bg-white group-hover:border-[#93c5fd]"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className="text-sm text-[#374151] leading-snug">{label}</span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent pr-8"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "password";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e7eb] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] focus:border-transparent transition-colors"
      />
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af] mb-2 mt-1">{children}</p>;
}

function SubSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[#6b7280] mb-2 flex items-center gap-1.5">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      {children}
    </p>
  );
}

function AccordionCard({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3.5 flex items-center justify-between bg-white hover:bg-[#f9fafb] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#6b7280]">{icon}</span>
          <span className="text-sm font-semibold text-[#111827]">{title}</span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-[22px] py-[20px] border-t border-[#f3f4f6] space-y-4">{children}</div>}
    </div>
  );
}

function PluginRadio({
  id,
  label,
  description,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-start gap-3 py-2.5 px-3 rounded-lg border text-left transition-colors ${
        selected ? "border-[#2d6fa8] bg-[#f0f7ff]" : "border-[#e5e7eb] hover:border-[#93c5fd] hover:bg-[#f9fafb]"
      }`}
    >
      <span className={`mt-0.5 w-4 h-4 rounded-full shrink-0 border-2 flex items-center justify-center ${selected ? "border-[#2d6fa8]" : "border-[#d1d5db]"}`}>
        {selected && <span className="w-2 h-2 rounded-full bg-[#2d6fa8]" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-[#111827]">{label}</span>
        <span className="block text-xs text-[#6b7280]">{description}</span>
      </span>
    </button>
  );
}

type TrackingPlugin = "scorm" | "xapi" | "hyperbridge";
type AnalyticsPlugin = "ues" | "google" | "hotjar";

type TrackingAnalyticsPageSnapshot = {
  scorm: {
    isEnabled: boolean;
    shouldStoreResponses: boolean;
    shouldStoreAttempts: boolean;
    shouldRecordInteractions: boolean;
    shouldRecordObjectives: boolean;
    shouldCompress: boolean;
    onTrackingCriteriaMet: string;
    onAssessmentFailure: string;
    scormVersion: string;
    showDebugWindow: boolean;
    commitOnStatusChange: boolean;
    commitOnAnyChange: boolean;
    timedCommitFrequency: string;
    maxCommitRetries: string;
    commitRetryDelay: string;
  };
  xapi: {
    isEnabled: boolean;
    specification: string;
    activityID: string;
    auID: string;
    endpoint: string;
    user: string;
    password: string;
    lang: string;
    generateIds: boolean;
    shouldTrackState: boolean;
    shouldUseRegistration: boolean;
    componentBlacklist: string;
    lrsFailureBehaviour: string;
  };
  hyper: {
    isEnabled: boolean;
    shouldStoreResponses: boolean;
    shouldStoreAttempts: boolean;
    shouldCompress: boolean;
    onTrackingCriteriaMet: string;
    onAssessmentFailure: string;
    commitOnStatusChange: boolean;
    commitOnAnyChange: boolean;
    commitOnAssessmentResult: boolean;
    timedCommitFrequency: string;
    maxCommitRetries: string;
    commitRetryDelay: string;
    showSuspendDataPopup: boolean;
  };
  ues: {
    isEnabled: boolean;
    isDebugMode: boolean;
    projectTag: string;
    portfolio: string;
    resourceLinkId: string;
    standard: string;
    ecl: string;
  };
  google: {
    isEnabled: boolean;
    trackingId: string;
  };
  hotjar: {
    isEnabled: boolean;
    siteId: string;
  };
};

const DEFAULT_SCORM_STATE: TrackingAnalyticsPageSnapshot["scorm"] = {
  isEnabled: true,
  shouldStoreResponses: true,
  shouldStoreAttempts: false,
  shouldRecordInteractions: true,
  shouldRecordObjectives: true,
  shouldCompress: false,
  onTrackingCriteriaMet: "completed",
  onAssessmentFailure: "incomplete",
  scormVersion: "1.2",
  showDebugWindow: false,
  commitOnStatusChange: true,
  commitOnAnyChange: false,
  timedCommitFrequency: "10",
  maxCommitRetries: "5",
  commitRetryDelay: "2000",
};

const DEFAULT_XAPI_STATE: TrackingAnalyticsPageSnapshot["xapi"] = {
  isEnabled: false,
  specification: "xAPI",
  activityID: "",
  auID: "1",
  endpoint: "",
  user: "",
  password: "",
  lang: "en-US",
  generateIds: false,
  shouldTrackState: true,
  shouldUseRegistration: true,
  componentBlacklist: "blank,graphic",
  lrsFailureBehaviour: "show",
};

const DEFAULT_HYPER_STATE: TrackingAnalyticsPageSnapshot["hyper"] = {
  isEnabled: false,
  shouldStoreResponses: true,
  shouldStoreAttempts: false,
  shouldCompress: false,
  onTrackingCriteriaMet: "completed",
  onAssessmentFailure: "incomplete",
  commitOnStatusChange: true,
  commitOnAnyChange: false,
  commitOnAssessmentResult: false,
  timedCommitFrequency: "10",
  maxCommitRetries: "5",
  commitRetryDelay: "2000",
  showSuspendDataPopup: false,
};

const DEFAULT_UES_STATE: TrackingAnalyticsPageSnapshot["ues"] = {
  isEnabled: false,
  isDebugMode: false,
  projectTag: "",
  portfolio: "Adapt Course",
  resourceLinkId: "",
  standard: "",
  ecl: "",
};

const DEFAULT_GOOGLE_STATE: TrackingAnalyticsPageSnapshot["google"] = {
  isEnabled: false,
  trackingId: "",
};

const DEFAULT_HOTJAR_STATE: TrackingAnalyticsPageSnapshot["hotjar"] = {
  isEnabled: false,
  siteId: "",
};

const DEFAULT_SNAPSHOT: TrackingAnalyticsPageSnapshot = {
  scorm: DEFAULT_SCORM_STATE,
  xapi: DEFAULT_XAPI_STATE,
  hyper: DEFAULT_HYPER_STATE,
  ues: DEFAULT_UES_STATE,
  google: DEFAULT_GOOGLE_STATE,
  hotjar: DEFAULT_HOTJAR_STATE,
};

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinDeploymentUrls(value: unknown): string {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row) => asString(asRecord(row)._deploymentURL).trim())
    .filter(Boolean)
    .join(", ");
}

function buildDeploymentItems(
  csv: string,
  existing: unknown,
  includeRegion: boolean
): Array<Record<string, string>> {
  const urls = parseCsv(csv);
  const prior = Array.isArray(existing) ? existing : [];

  return urls.map((deploymentURL, index) => {
    const base = asRecord(prior[index]);
    const item: Record<string, string> = {
      ...Object.fromEntries(Object.entries(base).filter(([, v]) => typeof v === "string")),
      _deploymentURL: deploymentURL,
    };

    if (includeRegion && !item._region) {
      item._region = "US";
    }
    if (!item._environment) {
      item._environment = "PRODUCTION";
    }
    return item;
  });
}

function buildSnapshotFromSettings(settings: TrackingAnalyticsSettings): TrackingAnalyticsPageSnapshot {
  const spoor = asRecord(settings._spoor);
  const spoorTracking = asRecord(spoor._tracking);
  const spoorReporting = asRecord(spoor._reporting);
  const spoorAdvanced = asRecord(spoor._advancedSettings);

  const xapi = asRecord(settings._xapi);
  const hyper = asRecord(settings._hyper);
  const hyperTracking = asRecord(hyper._tracking);
  const hyperReporting = asRecord(hyper._reporting);
  const hyperAdvanced = asRecord(hyper._advancedSettings);

  const ues = asRecord(settings._uesAnalytics);
  const google = asRecord(settings._googleAnalytics);
  const hotjar = asRecord(settings._hotjarAnalytics);

  return {
    scorm: {
      isEnabled: asBool(spoor._isEnabled, DEFAULT_SCORM_STATE.isEnabled),
      shouldStoreResponses: asBool(spoorTracking._shouldStoreResponses, DEFAULT_SCORM_STATE.shouldStoreResponses),
      shouldStoreAttempts: asBool(spoorTracking._shouldStoreAttempts, DEFAULT_SCORM_STATE.shouldStoreAttempts),
      shouldRecordInteractions: asBool(spoorTracking._shouldRecordInteractions, DEFAULT_SCORM_STATE.shouldRecordInteractions),
      shouldRecordObjectives: asBool(spoorTracking._shouldRecordObjectives, DEFAULT_SCORM_STATE.shouldRecordObjectives),
      shouldCompress: asBool(spoorTracking._shouldCompress, DEFAULT_SCORM_STATE.shouldCompress),
      onTrackingCriteriaMet: asString(spoorReporting._onTrackingCriteriaMet, DEFAULT_SCORM_STATE.onTrackingCriteriaMet),
      onAssessmentFailure: asString(spoorReporting._onAssessmentFailure, DEFAULT_SCORM_STATE.onAssessmentFailure),
      scormVersion: asString(spoorAdvanced._scormVersion, DEFAULT_SCORM_STATE.scormVersion),
      showDebugWindow: asBool(spoorAdvanced._showDebugWindow, DEFAULT_SCORM_STATE.showDebugWindow),
      commitOnStatusChange: asBool(spoorAdvanced._commitOnStatusChange, DEFAULT_SCORM_STATE.commitOnStatusChange),
      commitOnAnyChange: asBool(spoorAdvanced._commitOnAnyChange, DEFAULT_SCORM_STATE.commitOnAnyChange),
      timedCommitFrequency: asString(spoorAdvanced._timedCommitFrequency, DEFAULT_SCORM_STATE.timedCommitFrequency),
      maxCommitRetries: asString(spoorAdvanced._maxCommitRetries, DEFAULT_SCORM_STATE.maxCommitRetries),
      commitRetryDelay: asString(spoorAdvanced._commitRetryDelay, DEFAULT_SCORM_STATE.commitRetryDelay),
    },
    xapi: {
      isEnabled: asBool(xapi._isEnabled, DEFAULT_XAPI_STATE.isEnabled),
      specification: asString(xapi._specification, DEFAULT_XAPI_STATE.specification),
      activityID: asString(xapi._activityID, DEFAULT_XAPI_STATE.activityID),
      auID: asString(xapi._auID, DEFAULT_XAPI_STATE.auID),
      endpoint: asString(xapi._endpoint, DEFAULT_XAPI_STATE.endpoint),
      user: asString(xapi._user, DEFAULT_XAPI_STATE.user),
      password: asString(xapi._password, DEFAULT_XAPI_STATE.password),
      lang: asString(xapi._lang, DEFAULT_XAPI_STATE.lang),
      generateIds: asBool(xapi._generateIds, DEFAULT_XAPI_STATE.generateIds),
      shouldTrackState: asBool(xapi._shouldTrackState, DEFAULT_XAPI_STATE.shouldTrackState),
      shouldUseRegistration: asBool(xapi._shouldUseRegistration, DEFAULT_XAPI_STATE.shouldUseRegistration),
      componentBlacklist: asString(xapi._componentBlacklist, DEFAULT_XAPI_STATE.componentBlacklist),
      lrsFailureBehaviour: asString(xapi._lrsFailureBehaviour, DEFAULT_XAPI_STATE.lrsFailureBehaviour),
    },
    hyper: {
      isEnabled: asBool(hyper._isEnabled, DEFAULT_HYPER_STATE.isEnabled),
      shouldStoreResponses: asBool(hyperTracking._shouldStoreResponses, DEFAULT_HYPER_STATE.shouldStoreResponses),
      shouldStoreAttempts: asBool(hyperTracking._shouldStoreAttempts, DEFAULT_HYPER_STATE.shouldStoreAttempts),
      shouldCompress: asBool(hyperTracking._shouldCompress, DEFAULT_HYPER_STATE.shouldCompress),
      onTrackingCriteriaMet: asString(hyperReporting._onTrackingCriteriaMet, DEFAULT_HYPER_STATE.onTrackingCriteriaMet),
      onAssessmentFailure: asString(hyperReporting._onAssessmentFailure, DEFAULT_HYPER_STATE.onAssessmentFailure),
      commitOnStatusChange: asBool(hyperAdvanced._commitOnStatusChange, DEFAULT_HYPER_STATE.commitOnStatusChange),
      commitOnAnyChange: asBool(hyperAdvanced._commitOnAnyChange, DEFAULT_HYPER_STATE.commitOnAnyChange),
      commitOnAssessmentResult: asBool(hyperAdvanced._commitOnAssessmentResult, DEFAULT_HYPER_STATE.commitOnAssessmentResult),
      timedCommitFrequency: asString(hyperAdvanced._timedCommitFrequency, DEFAULT_HYPER_STATE.timedCommitFrequency),
      maxCommitRetries: asString(hyperAdvanced._maxCommitRetries, DEFAULT_HYPER_STATE.maxCommitRetries),
      commitRetryDelay: asString(hyperAdvanced._commitRetryDelay, DEFAULT_HYPER_STATE.commitRetryDelay),
      showSuspendDataPopup: asBool(hyperAdvanced._showSuspendDataPopup, DEFAULT_HYPER_STATE.showSuspendDataPopup),
    },
    ues: {
      isEnabled: asBool(ues._isEnabled, DEFAULT_UES_STATE.isEnabled),
      isDebugMode: asBool(ues._isDebugMode, DEFAULT_UES_STATE.isDebugMode),
      projectTag: asString(ues._projectTag, asString(ues._trackingId, DEFAULT_UES_STATE.projectTag)),
      portfolio: asString(ues._portfolio, DEFAULT_UES_STATE.portfolio),
      resourceLinkId: asString(ues._resourceLinkId, DEFAULT_UES_STATE.resourceLinkId),
      standard: joinDeploymentUrls(ues._items),
      ecl: joinDeploymentUrls(ues._itemsECL),
    },
    google: {
      isEnabled: asBool(google._isEnabled, DEFAULT_GOOGLE_STATE.isEnabled),
      trackingId: asString(google._trackingId, DEFAULT_GOOGLE_STATE.trackingId),
    },
    hotjar: {
      isEnabled: asBool(hotjar._isEnabled, DEFAULT_HOTJAR_STATE.isEnabled),
      siteId: asString(hotjar._siteId, DEFAULT_HOTJAR_STATE.siteId),
    },
  };
}

function buildSettingsFromSnapshot(
  snapshot: TrackingAnalyticsPageSnapshot,
  current: TrackingAnalyticsSettings
): TrackingAnalyticsSettings {
  const spoor = asRecord(current._spoor);
  const spoorTracking = asRecord(spoor._tracking);
  const spoorReporting = asRecord(spoor._reporting);
  const spoorAdvanced = asRecord(spoor._advancedSettings);

  const xapi = asRecord(current._xapi);
  const hyper = asRecord(current._hyper);
  const hyperTracking = asRecord(hyper._tracking);
  const hyperReporting = asRecord(hyper._reporting);
  const hyperAdvanced = asRecord(hyper._advancedSettings);

  const ues = asRecord(current._uesAnalytics);
  const google = asRecord(current._googleAnalytics);
  const hotjar = asRecord(current._hotjarAnalytics);

  return {
    _spoor: {
      ...spoor,
      _isEnabled: snapshot.scorm.isEnabled,
      _tracking: {
        ...spoorTracking,
        _shouldStoreResponses: snapshot.scorm.shouldStoreResponses,
        _shouldStoreAttempts: snapshot.scorm.shouldStoreAttempts,
        _shouldRecordInteractions: snapshot.scorm.shouldRecordInteractions,
        _shouldRecordObjectives: snapshot.scorm.shouldRecordObjectives,
        _shouldCompress: snapshot.scorm.shouldCompress,
      },
      _reporting: {
        ...spoorReporting,
        _onTrackingCriteriaMet: snapshot.scorm.onTrackingCriteriaMet,
        _onAssessmentFailure: snapshot.scorm.onAssessmentFailure,
      },
      _advancedSettings: {
        ...spoorAdvanced,
        _scormVersion: snapshot.scorm.scormVersion,
        _showDebugWindow: snapshot.scorm.showDebugWindow,
        _commitOnStatusChange: snapshot.scorm.commitOnStatusChange,
        _commitOnAnyChange: snapshot.scorm.commitOnAnyChange,
        _timedCommitFrequency: Number(snapshot.scorm.timedCommitFrequency || 0),
        _maxCommitRetries: Number(snapshot.scorm.maxCommitRetries || 0),
        _commitRetryDelay: Number(snapshot.scorm.commitRetryDelay || 0),
      },
    },
    _xapi: {
      ...xapi,
      _isEnabled: snapshot.xapi.isEnabled,
      _specification: snapshot.xapi.specification,
      _activityID: snapshot.xapi.activityID,
      _auID: snapshot.xapi.auID,
      _endpoint: snapshot.xapi.endpoint,
      _user: snapshot.xapi.user,
      _password: snapshot.xapi.password,
      _lang: snapshot.xapi.lang,
      _generateIds: snapshot.xapi.generateIds,
      _shouldTrackState: snapshot.xapi.shouldTrackState,
      _shouldUseRegistration: snapshot.xapi.shouldUseRegistration,
      _componentBlacklist: snapshot.xapi.componentBlacklist,
      _lrsFailureBehaviour: snapshot.xapi.lrsFailureBehaviour,
    },
    _hyper: {
      ...hyper,
      _isEnabled: snapshot.hyper.isEnabled,
      _tracking: {
        ...hyperTracking,
        _shouldStoreResponses: snapshot.hyper.shouldStoreResponses,
        _shouldStoreAttempts: snapshot.hyper.shouldStoreAttempts,
        _shouldCompress: snapshot.hyper.shouldCompress,
      },
      _reporting: {
        ...hyperReporting,
        _onTrackingCriteriaMet: snapshot.hyper.onTrackingCriteriaMet,
        _onAssessmentFailure: snapshot.hyper.onAssessmentFailure,
      },
      _advancedSettings: {
        ...hyperAdvanced,
        _commitOnStatusChange: snapshot.hyper.commitOnStatusChange,
        _commitOnAnyChange: snapshot.hyper.commitOnAnyChange,
        _commitOnAssessmentResult: snapshot.hyper.commitOnAssessmentResult,
        _timedCommitFrequency: Number(snapshot.hyper.timedCommitFrequency || 0),
        _maxCommitRetries: Number(snapshot.hyper.maxCommitRetries || 0),
        _commitRetryDelay: Number(snapshot.hyper.commitRetryDelay || 0),
        _showSuspendDataPopup: snapshot.hyper.showSuspendDataPopup,
      },
    },
    _uesAnalytics: {
      ...ues,
      _isEnabled: snapshot.ues.isEnabled,
      _isDebugMode: snapshot.ues.isDebugMode,
      _projectTag: snapshot.ues.projectTag,
      _trackingId: snapshot.ues.projectTag,
      _portfolio: snapshot.ues.portfolio,
      _resourceLinkId: snapshot.ues.resourceLinkId,
      _items: buildDeploymentItems(snapshot.ues.standard, ues._items, true),
      _itemsECL: buildDeploymentItems(snapshot.ues.ecl, ues._itemsECL, false),
    },
    _googleAnalytics: {
      ...google,
      _isEnabled: snapshot.google.isEnabled,
      _trackingId: snapshot.google.trackingId,
    },
    _hotjarAnalytics: {
      ...hotjar,
      _isEnabled: snapshot.hotjar.isEnabled,
      _siteId: snapshot.hotjar.siteId,
    },
  };
}

export function TrackingAnalyticsPage({
  courseId,
  onNavigationRequest,
  pendingNavigation,
  onPendingNavigationHandled,
}: {
  courseId?: string;
  onNavigationRequest?: (nav: string) => void;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
}) {
  const [trackingOpen, setTrackingOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [trackingPlugin, setTrackingPlugin] = useState<TrackingPlugin>("scorm");
  const [analyticsPlugin, setAnalyticsPlugin] = useState<AnalyticsPlugin>("ues");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<TrackingAnalyticsPageSnapshot>(DEFAULT_SNAPSHOT);
  const [sourceSettings, setSourceSettings] = useState<TrackingAnalyticsSettings>(defaultTrackingAnalyticsSettings());

  const [scorm, setScorm] = useState<TrackingAnalyticsPageSnapshot["scorm"]>(DEFAULT_SCORM_STATE);

  const [xapi, setXapi] = useState<TrackingAnalyticsPageSnapshot["xapi"]>(DEFAULT_XAPI_STATE);

  const [hyper, setHyper] = useState<TrackingAnalyticsPageSnapshot["hyper"]>(DEFAULT_HYPER_STATE);

  const [ues, setUes] = useState<TrackingAnalyticsPageSnapshot["ues"]>(DEFAULT_UES_STATE);

  const [google, setGoogle] = useState<TrackingAnalyticsPageSnapshot["google"]>(DEFAULT_GOOGLE_STATE);

  const [hotjar, setHotjar] = useState<TrackingAnalyticsPageSnapshot["hotjar"]>(DEFAULT_HOTJAR_STATE);

  const currentSnapshot = useMemo<TrackingAnalyticsPageSnapshot>(
    () => ({
      scorm,
      xapi,
      hyper,
      ues,
      google,
      hotjar,
    }),
    [scorm, xapi, hyper, ues, google, hotjar]
  );

  const hasChanges = JSON.stringify(currentSnapshot) !== JSON.stringify(savedSnapshot);

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } = useUnsavedChangesNavigationGuard({
    hasChanges,
    pendingNavigation,
    onPendingNavigationHandled,
    onNavigate: onNavigationRequest,
  });

  const applySnapshot = (snapshot: TrackingAnalyticsPageSnapshot) => {
    setScorm(snapshot.scorm);
    setXapi(snapshot.xapi);
    setHyper(snapshot.hyper);
    setUes(snapshot.ues);
    setGoogle(snapshot.google);
    setHotjar(snapshot.hotjar);

    if (snapshot.scorm.isEnabled) setTrackingPlugin("scorm");
    else if (snapshot.xapi.isEnabled) setTrackingPlugin("xapi");
    else if (snapshot.hyper.isEnabled) setTrackingPlugin("hyperbridge");

    if (snapshot.ues.isEnabled) setAnalyticsPlugin("ues");
    else if (snapshot.google.isEnabled) setAnalyticsPlugin("google");
    else if (snapshot.hotjar.isEnabled) setAnalyticsPlugin("hotjar");
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!courseId) {
        const base = DEFAULT_SNAPSHOT;
        if (cancelled) return;
        setSourceSettings(defaultTrackingAnalyticsSettings());
        applySnapshot(base);
        setSavedSnapshot(base);
        return;
      }

      setIsLoading(true);
      try {
        const settings = await getTrackingAnalyticsSettings(courseId);
        if (cancelled) return;
        const snapshot = buildSnapshotFromSettings(settings);
        setSourceSettings(settings);
        applySnapshot(snapshot);
        setSavedSnapshot(snapshot);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load tracking and analytics settings", error);
        const base = DEFAULT_SNAPSHOT;
        setSourceSettings(defaultTrackingAnalyticsSettings());
        applySnapshot(base);
        setSavedSnapshot(base);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleSave = async () => {
    if (!courseId) return;

    setIsSaving(true);
    try {
      const nextSettings = buildSettingsFromSnapshot(currentSnapshot, sourceSettings);
      await saveTrackingAnalyticsSettings(courseId, nextSettings);
      setSourceSettings(nextSettings);
      setSavedSnapshot(currentSnapshot);
      const navTarget = consumePendingNavigation();
      if (navTarget) onNavigationRequest?.(navTarget);
    } catch (error) {
      console.error("Failed to save tracking and analytics settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    applySnapshot(savedSnapshot);
    const navTarget = consumePendingNavigation();
    if (navTarget) onNavigationRequest?.(navTarget);
  };

  return (
    <>
      <div className="max-w-2xl w-full pb-24">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#111827]">Tracking &amp; Analytics</h2>
          <p className="text-sm text-[#6b7280] mt-0.5">Group and configure your existing tracking and analytics plugins for this course.</p>
        </div>

        <div className="flex flex-col gap-4">
        <AccordionCard
          title="Tracking"
          open={trackingOpen}
          onToggle={() => setTrackingOpen((open) => !open)}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>}
        >
          <p className="text-xs text-[#6b7280] mb-3">Select one tracking plugin and edit its existing settings.</p>
          <div className="flex flex-col gap-1.5">
            <PluginRadio id="scorm" label="SCORM" description="adapt-contrib-spoor" selected={trackingPlugin === "scorm"} onSelect={() => setTrackingPlugin("scorm")} />
            <PluginRadio id="xapi" label="xAPI" description="adapt-contrib-xapi" selected={trackingPlugin === "xapi"} onSelect={() => setTrackingPlugin("xapi")} />
            <PluginRadio id="hyperbridge" label="HyperBridge" description="adapt-hyper-bridge" selected={trackingPlugin === "hyperbridge"} onSelect={() => setTrackingPlugin("hyperbridge")} />
          </div>

          {trackingPlugin === "scorm" && (
            <div className="mt-4 flex flex-col gap-4">
              <SectionLabel>SCORM (SPOOR) Settings</SectionLabel>
              <CheckboxRow checked={scorm.isEnabled} onChange={(v) => setScorm((prev) => ({ ...prev, isEnabled: v }))} label="Enable SCORM plugin" />
              <div className="ml-4 pl-3 border-l-2 border-[#e5e7eb]">
                <SubSectionLabel>Tracking</SubSectionLabel>
                <CheckboxRow checked={scorm.shouldStoreResponses} onChange={(v) => setScorm((prev) => ({ ...prev, shouldStoreResponses: v }))} label="Store question state" />
                <CheckboxRow checked={scorm.shouldStoreAttempts} onChange={(v) => setScorm((prev) => ({ ...prev, shouldStoreAttempts: v }))} label="Store question attempt states" />
                <CheckboxRow checked={scorm.shouldRecordInteractions} onChange={(v) => setScorm((prev) => ({ ...prev, shouldRecordInteractions: v }))} label="Record interactions" />
                <CheckboxRow checked={scorm.shouldRecordObjectives} onChange={(v) => setScorm((prev) => ({ ...prev, shouldRecordObjectives: v }))} label="Record objectives" />
                <CheckboxRow checked={scorm.shouldCompress} onChange={(v) => setScorm((prev) => ({ ...prev, shouldCompress: v }))} label="Should compress data" />
              </div>

              <div className="ml-4 pl-3 border-l-2 border-[#e5e7eb] flex flex-col gap-3">
                <SubSectionLabel>Reporting</SubSectionLabel>
                <SelectField
                  label="Tracking success status"
                  value={scorm.onTrackingCriteriaMet}
                  onChange={(value) => setScorm((prev) => ({ ...prev, onTrackingCriteriaMet: value }))}
                  options={[
                    { value: "completed", label: "Completed" },
                    { value: "passed", label: "Passed" },
                    { value: "failed", label: "Failed" },
                    { value: "incomplete", label: "Incomplete" },
                  ]}
                />
                <SelectField
                  label="Assessment failure status"
                  value={scorm.onAssessmentFailure}
                  onChange={(value) => setScorm((prev) => ({ ...prev, onAssessmentFailure: value }))}
                  options={[
                    { value: "completed", label: "Completed" },
                    { value: "failed", label: "Failed" },
                    { value: "incomplete", label: "Incomplete" },
                  ]}
                />
              </div>

              <SectionLabel>Advanced Settings</SectionLabel>
              <SelectField
                label="SCORM version"
                value={scorm.scormVersion}
                onChange={(value) => setScorm((prev) => ({ ...prev, scormVersion: value }))}
                options={[{ value: "1.2", label: "SCORM 1.2" }, { value: "2004", label: "SCORM 2004" }]}
              />
              <CheckboxRow checked={scorm.showDebugWindow} onChange={(v) => setScorm((prev) => ({ ...prev, showDebugWindow: v }))} label="SCORM debug window" />
              <CheckboxRow checked={scorm.commitOnStatusChange} onChange={(v) => setScorm((prev) => ({ ...prev, commitOnStatusChange: v }))} label="Commit data on status change" />
              <CheckboxRow checked={scorm.commitOnAnyChange} onChange={(v) => setScorm((prev) => ({ ...prev, commitOnAnyChange: v }))} label="Commit data on any change" />
              <TextField label="Frequency (mins) of automatic commits" type="number" value={scorm.timedCommitFrequency} onChange={(value) => setScorm((prev) => ({ ...prev, timedCommitFrequency: value }))} />
              <TextField label="Maximum number of commit retries" type="number" value={scorm.maxCommitRetries} onChange={(value) => setScorm((prev) => ({ ...prev, maxCommitRetries: value }))} />
              <TextField label="Commit retry delay" type="number" value={scorm.commitRetryDelay} onChange={(value) => setScorm((prev) => ({ ...prev, commitRetryDelay: value }))} />
            </div>
          )}

          {trackingPlugin === "xapi" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>xAPI Settings</SectionLabel>
              <CheckboxRow checked={xapi.isEnabled} onChange={(v) => setXapi((prev) => ({ ...prev, isEnabled: v }))} label="Enable xAPI plugin" />
              <SelectField label="Specification" value={xapi.specification} onChange={(value) => setXapi((prev) => ({ ...prev, specification: value }))} options={[{ value: "xAPI", label: "xAPI" }, { value: "cmi5", label: "cmi5" }]} />
              <TextField label="Activity ID" value={xapi.activityID} onChange={(value) => setXapi((prev) => ({ ...prev, activityID: value }))} placeholder="https://your-course-url" />
              <TextField label="Assignable Unit (AU) ID" value={xapi.auID} onChange={(value) => setXapi((prev) => ({ ...prev, auID: value }))} />
              <TextField label="LRS Endpoint" value={xapi.endpoint} onChange={(value) => setXapi((prev) => ({ ...prev, endpoint: value }))} placeholder="https://lrs.example.com/xapi" />
              <TextField label="LRS User / Key" value={xapi.user} onChange={(value) => setXapi((prev) => ({ ...prev, user: value }))} />
              <TextField label="LRS Password / Secret" type="password" value={xapi.password} onChange={(value) => setXapi((prev) => ({ ...prev, password: value }))} />
              <SelectField
                label="Verb language"
                value={xapi.lang}
                onChange={(value) => setXapi((prev) => ({ ...prev, lang: value }))}
                options={[{ value: "de-DE", label: "de-DE" }, { value: "en-US", label: "en-US" }, { value: "fr-FR", label: "fr-FR" }, { value: "es-ES", label: "es-ES" }]}
              />
              <TextField label="Component blacklist" value={xapi.componentBlacklist} onChange={(value) => setXapi((prev) => ({ ...prev, componentBlacklist: value }))} placeholder="blank,graphic" />
              <SelectField
                label="LRS connection failure behaviour"
                value={xapi.lrsFailureBehaviour}
                onChange={(value) => setXapi((prev) => ({ ...prev, lrsFailureBehaviour: value }))}
                options={[{ value: "ignore", label: "Ignore errors" }, { value: "show", label: "Show errors" }]}
              />
              <CheckboxRow checked={xapi.generateIds} onChange={(v) => setXapi((prev) => ({ ...prev, generateIds: v }))} label="Auto-generate ID for statements" />
              <CheckboxRow checked={xapi.shouldTrackState} onChange={(v) => setXapi((prev) => ({ ...prev, shouldTrackState: v }))} label="Track state" />
              <CheckboxRow checked={xapi.shouldUseRegistration} onChange={(v) => setXapi((prev) => ({ ...prev, shouldUseRegistration: v }))} label="Use registration" />
            </div>
          )}

          {trackingPlugin === "hyperbridge" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>HyperBridge Settings</SectionLabel>
              <CheckboxRow checked={hyper.isEnabled} onChange={(v) => setHyper((prev) => ({ ...prev, isEnabled: v }))} label="Enable HyperBridge plugin" />
              <CheckboxRow checked={hyper.shouldStoreResponses} onChange={(v) => setHyper((prev) => ({ ...prev, shouldStoreResponses: v }))} label="Store question state" />
              <CheckboxRow checked={hyper.shouldStoreAttempts} onChange={(v) => setHyper((prev) => ({ ...prev, shouldStoreAttempts: v }))} label="Store question attempt states" />
              <CheckboxRow checked={hyper.shouldCompress} onChange={(v) => setHyper((prev) => ({ ...prev, shouldCompress: v }))} label="Should compress data" />
              <SelectField
                label="Tracking success status"
                value={hyper.onTrackingCriteriaMet}
                onChange={(value) => setHyper((prev) => ({ ...prev, onTrackingCriteriaMet: value }))}
                options={[
                  { value: "completed", label: "Completed" },
                  { value: "passed", label: "Passed" },
                  { value: "failed", label: "Failed" },
                  { value: "incomplete", label: "Incomplete" },
                ]}
              />
              <SelectField
                label="Assessment failure status"
                value={hyper.onAssessmentFailure}
                onChange={(value) => setHyper((prev) => ({ ...prev, onAssessmentFailure: value }))}
                options={[
                  { value: "completed", label: "Completed" },
                  { value: "failed", label: "Failed" },
                  { value: "incomplete", label: "Incomplete" },
                ]}
              />
              <CheckboxRow checked={hyper.commitOnStatusChange} onChange={(v) => setHyper((prev) => ({ ...prev, commitOnStatusChange: v }))} label="Commit data on status change" />
              <CheckboxRow checked={hyper.commitOnAnyChange} onChange={(v) => setHyper((prev) => ({ ...prev, commitOnAnyChange: v }))} label="Commit data on any change" />
              <CheckboxRow checked={hyper.commitOnAssessmentResult} onChange={(v) => setHyper((prev) => ({ ...prev, commitOnAssessmentResult: v }))} label="Commit data on assessment results" />
              <CheckboxRow checked={hyper.showSuspendDataPopup} onChange={(v) => setHyper((prev) => ({ ...prev, showSuspendDataPopup: v }))} label="Suspend data popup" />
              <TextField label="Frequency (mins) of automatic commits" type="number" value={hyper.timedCommitFrequency} onChange={(value) => setHyper((prev) => ({ ...prev, timedCommitFrequency: value }))} />
              <TextField label="Maximum number of commit retries" type="number" value={hyper.maxCommitRetries} onChange={(value) => setHyper((prev) => ({ ...prev, maxCommitRetries: value }))} />
              <TextField label="Commit retry delay" type="number" value={hyper.commitRetryDelay} onChange={(value) => setHyper((prev) => ({ ...prev, commitRetryDelay: value }))} />
            </div>
          )}
        </AccordionCard>

        <AccordionCard
          title="Analytics"
          open={analyticsOpen}
          onToggle={() => setAnalyticsOpen((open) => !open)}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
        >
          <p className="text-xs text-[#6b7280] mb-3">Select one analytics plugin and edit its existing settings.</p>
          <div className="flex flex-col gap-1.5">
            <PluginRadio id="ues" label="Unified Event System Analytics" description="adapt-ues-analytics" selected={analyticsPlugin === "ues"} onSelect={() => setAnalyticsPlugin("ues")} />
            <PluginRadio id="google" label="Google Analytics" description="adapt-googleAnalytics" selected={analyticsPlugin === "google"} onSelect={() => setAnalyticsPlugin("google")} />
            <PluginRadio id="hotjar" label="Hotjar Analytics" description="adapt-hotjarAnalytics" selected={analyticsPlugin === "hotjar"} onSelect={() => setAnalyticsPlugin("hotjar")} />
          </div>

          {analyticsPlugin === "ues" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>UES Settings</SectionLabel>
              <CheckboxRow checked={ues.isEnabled} onChange={(v) => setUes((prev) => ({ ...prev, isEnabled: v }))} label="Enable UES analytics" />
              <CheckboxRow checked={ues.isDebugMode} onChange={(v) => setUes((prev) => ({ ...prev, isDebugMode: v }))} label="Enable debug mode" />
              <TextField label="Project tag" value={ues.projectTag} onChange={(value) => setUes((prev) => ({ ...prev, projectTag: value }))} />
              <TextField label="Portfolio" value={ues.portfolio} onChange={(value) => setUes((prev) => ({ ...prev, portfolio: value }))} />
              <TextField label="Resource link ID" value={ues.resourceLinkId} onChange={(value) => setUes((prev) => ({ ...prev, resourceLinkId: value }))} />
              <TextField label="Standard deployments (comma-separated URLs)" value={ues.standard} onChange={(value) => setUes((prev) => ({ ...prev, standard: value }))} placeholder="*.rqi1stop.com" />
              <TextField label="ECL deployments (comma-separated URLs)" value={ues.ecl} onChange={(value) => setUes((prev) => ({ ...prev, ecl: value }))} placeholder="*.example.com" />
            </div>
          )}

          {analyticsPlugin === "google" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>Google Analytics Settings</SectionLabel>
              <CheckboxRow checked={google.isEnabled} onChange={(v) => setGoogle((prev) => ({ ...prev, isEnabled: v }))} label="Enable Google Analytics" />
              <TextField label="Tracking ID" value={google.trackingId} onChange={(value) => setGoogle((prev) => ({ ...prev, trackingId: value }))} placeholder="G-XXXXXXXXXX" />
            </div>
          )}

          {analyticsPlugin === "hotjar" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>Hotjar Settings</SectionLabel>
              <CheckboxRow checked={hotjar.isEnabled} onChange={(v) => setHotjar((prev) => ({ ...prev, isEnabled: v }))} label="Enable Hotjar Analytics" />
              <TextField label="Site ID" value={hotjar.siteId} onChange={(value) => setHotjar((prev) => ({ ...prev, siteId: value }))} placeholder="1234567" />
            </div>
          )}
        </AccordionCard>
      </div>

      </div>

      {!isLoading && hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--life-warning-100)] shadow-lg animate-fade-in-down">
          <span className="flex items-center gap-2 text-sm text-[#374151]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--life-warning-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !courseId}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--life-base-white)] bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-700)] active:bg-[var(--life-primary-800)] disabled:opacity-50 rounded-lg transition-colors"
            >
              {isSaving && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      <UnsavedChangesModal
        isOpen={showConfirmModal}
        isSaving={isSaving}
        onDiscard={handleDiscard}
        onSave={handleSave}
        onClose={clearPendingNavigation}
      />
    </>
  );
}
