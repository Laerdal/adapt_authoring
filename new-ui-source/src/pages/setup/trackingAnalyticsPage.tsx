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
    <label className="flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer select-none group hover:bg-[#f9fafb]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[#d1d5db] accent-[var(--life-primary-500)] cursor-pointer"
      />
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
        aria-label={label}
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
      id={id}
      type="button"
      role="radio"
      aria-checked={selected}
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
    resetStatusWhenLanguageChanged: boolean;
    scormVersion: string;
    showDebugWindow: boolean;
    commitOnStatusChange: boolean;
    commitOnAnyChange: boolean;
    timedCommitFrequency: string;
    maxCommitRetries: string;
    commitRetryDelay: string;
    suppressLmsErrors: boolean;
    commitOnVisibilityChangeHidden: boolean;
    manifestIdentifier: string;
    exitStateIncomplete: string;
    exitStateComplete: string;
    completedWhenFailed: boolean;
    fillInCharacterLimit: string;
    connectionTestEnabled: boolean;
    connectionTestOnSetValue: boolean;
    silentRetryLimit: string;
    silentRetryDelay: string;
    uniqueInteractionIds: boolean;
    showResetButton: boolean;
    persistCookieData: boolean;
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
    adaptRouterMenu: boolean;
    adaptRouterPage: boolean;
    adaptRecordInteraction: boolean;
    adaptAssessComplete: boolean;
    contentObjectIsComplete: boolean;
    articleIsComplete: boolean;
    blockIsComplete: boolean;
    componentIsComplete: boolean;
  };
  hyper: {
    isEnabled: boolean;
    shouldStoreResponses: boolean;
    shouldStoreAttempts: boolean;
    shouldCompress: boolean;
    onTrackingCriteriaMet: string;
    onAssessmentFailure: string;
    resetStatusWhenLanguageChanged: boolean;
    commitOnStatusChange: boolean;
    commitOnAnyChange: boolean;
    commitOnAssessmentResult: boolean;
    timedCommitFrequency: string;
    maxCommitRetries: string;
    commitRetryDelay: string;
    showSuspendDataPopup: boolean;
    suppressLmsErrors: boolean;
    commitOnVisibilityChangeHidden: boolean;
    manifestIdentifier: string;
    exitStateIncomplete: string;
    exitStateComplete: string;
    fillInCharacterLimit: string;
    connectionTestEnabled: boolean;
    connectionTestOnSetValue: boolean;
    silentRetryLimit: string;
    silentRetryDelay: string;
    uniqueInteractionIds: boolean;
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
    anonymizeIp: boolean;
    debugMode: boolean;
  };
  hotjar: {
    isEnabled: boolean;
    siteId: string;
    version: string;
    debugMode: boolean;
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
  resetStatusWhenLanguageChanged: false,
  scormVersion: "1.2",
  showDebugWindow: false,
  commitOnStatusChange: true,
  commitOnAnyChange: false,
  timedCommitFrequency: "10",
  maxCommitRetries: "5",
  commitRetryDelay: "2000",
  suppressLmsErrors: false,
  commitOnVisibilityChangeHidden: true,
  manifestIdentifier: "adapt_manifest",
  exitStateIncomplete: "auto",
  exitStateComplete: "auto",
  completedWhenFailed: true,
  fillInCharacterLimit: "0",
  connectionTestEnabled: true,
  connectionTestOnSetValue: true,
  silentRetryLimit: "2",
  silentRetryDelay: "1000",
  uniqueInteractionIds: false,
  showResetButton: false,
  persistCookieData: true,
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
  adaptRouterMenu: false,
  adaptRouterPage: false,
  adaptRecordInteraction: true,
  adaptAssessComplete: true,
  contentObjectIsComplete: false,
  articleIsComplete: false,
  blockIsComplete: false,
  componentIsComplete: true,
};

const DEFAULT_HYPER_STATE: TrackingAnalyticsPageSnapshot["hyper"] = {
  isEnabled: false,
  shouldStoreResponses: true,
  shouldStoreAttempts: false,
  shouldCompress: false,
  onTrackingCriteriaMet: "completed",
  onAssessmentFailure: "incomplete",
  resetStatusWhenLanguageChanged: false,
  commitOnStatusChange: true,
  commitOnAnyChange: false,
  commitOnAssessmentResult: false,
  timedCommitFrequency: "10",
  maxCommitRetries: "5",
  commitRetryDelay: "2000",
  showSuspendDataPopup: false,
  suppressLmsErrors: false,
  commitOnVisibilityChangeHidden: true,
  manifestIdentifier: "adapt_manifest",
  exitStateIncomplete: "auto",
  exitStateComplete: "auto",
  fillInCharacterLimit: "0",
  connectionTestEnabled: true,
  connectionTestOnSetValue: true,
  silentRetryLimit: "2",
  silentRetryDelay: "1000",
  uniqueInteractionIds: false,
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
  anonymizeIp: true,
  debugMode: false,
};

const DEFAULT_HOTJAR_STATE: TrackingAnalyticsPageSnapshot["hotjar"] = {
  isEnabled: false,
  siteId: "",
  version: "6",
  debugMode: false,
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
  // Connection test lives inside _advancedSettings per the extension schema
  const spoorConnectionTest = asRecord(spoorAdvanced._connectionTest);

  const xapi = asRecord(settings._xapi);
  // Core events are nested: _coreEvents.Adapt['router:menu'] etc.
  const xapiCoreEvents = asRecord(xapi._coreEvents);
  const xapiAdapt = asRecord(xapiCoreEvents.Adapt);
  const xapiContentObjects = asRecord(xapiCoreEvents.contentObjects);
  const xapiArticles = asRecord(xapiCoreEvents.articles);
  const xapiBlocks = asRecord(xapiCoreEvents.blocks);
  const xapiComponents = asRecord(xapiCoreEvents.components);

  const hyper = asRecord(settings._hyper);
  const hyperTracking = asRecord(hyper._tracking);
  const hyperReporting = asRecord(hyper._reporting);
  const hyperAdvanced = asRecord(hyper._advancedSettings);
  const hyperConnectionTest = asRecord(hyperAdvanced._connectionTest);

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
      // Schema uses _resetStatusOnLanguageChange
      resetStatusWhenLanguageChanged: asBool(spoorReporting._resetStatusOnLanguageChange, DEFAULT_SCORM_STATE.resetStatusWhenLanguageChanged),
      scormVersion: asString(spoorAdvanced._scormVersion, DEFAULT_SCORM_STATE.scormVersion),
      showDebugWindow: asBool(spoorAdvanced._showDebugWindow, DEFAULT_SCORM_STATE.showDebugWindow),
      commitOnStatusChange: asBool(spoorAdvanced._commitOnStatusChange, DEFAULT_SCORM_STATE.commitOnStatusChange),
      commitOnAnyChange: asBool(spoorAdvanced._commitOnAnyChange, DEFAULT_SCORM_STATE.commitOnAnyChange),
      timedCommitFrequency: asString(spoorAdvanced._timedCommitFrequency, DEFAULT_SCORM_STATE.timedCommitFrequency),
      maxCommitRetries: asString(spoorAdvanced._maxCommitRetries, DEFAULT_SCORM_STATE.maxCommitRetries),
      commitRetryDelay: asString(spoorAdvanced._commitRetryDelay, DEFAULT_SCORM_STATE.commitRetryDelay),
      // Schema uses _suppressErrors
      suppressLmsErrors: asBool(spoorAdvanced._suppressErrors, DEFAULT_SCORM_STATE.suppressLmsErrors),
      commitOnVisibilityChangeHidden: asBool(spoorAdvanced._commitOnVisibilityChangeHidden, DEFAULT_SCORM_STATE.commitOnVisibilityChangeHidden),
      manifestIdentifier: asString(spoorAdvanced._manifestIdentifier, DEFAULT_SCORM_STATE.manifestIdentifier),
      // Schema uses _exitStateIfIncomplete/_exitStateIfComplete
      exitStateIncomplete: asString(spoorAdvanced._exitStateIfIncomplete, DEFAULT_SCORM_STATE.exitStateIncomplete),
      exitStateComplete: asString(spoorAdvanced._exitStateIfComplete, DEFAULT_SCORM_STATE.exitStateComplete),
      // Schema uses _setCompletedWhenFailed
      completedWhenFailed: asBool(spoorAdvanced._setCompletedWhenFailed, DEFAULT_SCORM_STATE.completedWhenFailed),
      // Schema uses _maxCharLimitOverride
      fillInCharacterLimit: asString(spoorAdvanced._maxCharLimitOverride, DEFAULT_SCORM_STATE.fillInCharacterLimit),
      connectionTestEnabled: asBool(spoorConnectionTest._isEnabled, DEFAULT_SCORM_STATE.connectionTestEnabled),
      connectionTestOnSetValue: asBool(spoorConnectionTest._testOnSetValue, DEFAULT_SCORM_STATE.connectionTestOnSetValue),
      silentRetryLimit: asString(spoorConnectionTest._silentRetryLimit, DEFAULT_SCORM_STATE.silentRetryLimit),
      silentRetryDelay: asString(spoorConnectionTest._silentRetryDelay, DEFAULT_SCORM_STATE.silentRetryDelay),
      uniqueInteractionIds: asBool(spoorAdvanced._uniqueInteractionIds, DEFAULT_SCORM_STATE.uniqueInteractionIds),
      // Schema uses _showCookieLmsResetButton at root of _spoor
      showResetButton: asBool(spoor._showCookieLmsResetButton, DEFAULT_SCORM_STATE.showResetButton),
      // Schema uses _shouldPersistCookieLMSData at root of _spoor
      persistCookieData: asBool(spoor._shouldPersistCookieLMSData, DEFAULT_SCORM_STATE.persistCookieData),
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
      // Core events live in _coreEvents.Adapt/contentObjects/articles/blocks/components
      adaptRouterMenu: asBool(xapiAdapt['router:menu'], DEFAULT_XAPI_STATE.adaptRouterMenu),
      adaptRouterPage: asBool(xapiAdapt['router:page'], DEFAULT_XAPI_STATE.adaptRouterPage),
      adaptRecordInteraction: asBool(xapiAdapt['questionView:recordInteraction'], DEFAULT_XAPI_STATE.adaptRecordInteraction),
      adaptAssessComplete: asBool(xapiAdapt['assessments:complete'], DEFAULT_XAPI_STATE.adaptAssessComplete),
      contentObjectIsComplete: asBool(xapiContentObjects['change:_isComplete'], DEFAULT_XAPI_STATE.contentObjectIsComplete),
      articleIsComplete: asBool(xapiArticles['change:_isComplete'], DEFAULT_XAPI_STATE.articleIsComplete),
      blockIsComplete: asBool(xapiBlocks['change:_isComplete'], DEFAULT_XAPI_STATE.blockIsComplete),
      componentIsComplete: asBool(xapiComponents['change:_isComplete'], DEFAULT_XAPI_STATE.componentIsComplete),
    },
    hyper: {
      isEnabled: asBool(hyper._isEnabled, DEFAULT_HYPER_STATE.isEnabled),
      shouldStoreResponses: asBool(hyperTracking._shouldStoreResponses, DEFAULT_HYPER_STATE.shouldStoreResponses),
      shouldStoreAttempts: asBool(hyperTracking._shouldStoreAttempts, DEFAULT_HYPER_STATE.shouldStoreAttempts),
      shouldCompress: asBool(hyperTracking._shouldCompress, DEFAULT_HYPER_STATE.shouldCompress),
      onTrackingCriteriaMet: asString(hyperReporting._onTrackingCriteriaMet, DEFAULT_HYPER_STATE.onTrackingCriteriaMet),
      onAssessmentFailure: asString(hyperReporting._onAssessmentFailure, DEFAULT_HYPER_STATE.onAssessmentFailure),
      resetStatusWhenLanguageChanged: asBool(hyperReporting._resetStatusOnLanguageChange, DEFAULT_HYPER_STATE.resetStatusWhenLanguageChanged),
      commitOnStatusChange: asBool(hyperAdvanced._commitOnStatusChange, DEFAULT_HYPER_STATE.commitOnStatusChange),
      commitOnAnyChange: asBool(hyperAdvanced._commitOnAnyChange, DEFAULT_HYPER_STATE.commitOnAnyChange),
      commitOnAssessmentResult: asBool(hyperAdvanced._commitOnAssessmentResult, DEFAULT_HYPER_STATE.commitOnAssessmentResult),
      timedCommitFrequency: asString(hyperAdvanced._timedCommitFrequency, DEFAULT_HYPER_STATE.timedCommitFrequency),
      maxCommitRetries: asString(hyperAdvanced._maxCommitRetries, DEFAULT_HYPER_STATE.maxCommitRetries),
      commitRetryDelay: asString(hyperAdvanced._commitRetryDelay, DEFAULT_HYPER_STATE.commitRetryDelay),
      showSuspendDataPopup: asBool(hyperAdvanced._showSuspendDataPopup, DEFAULT_HYPER_STATE.showSuspendDataPopup),
      suppressLmsErrors: asBool(hyperAdvanced._suppressErrors, DEFAULT_HYPER_STATE.suppressLmsErrors),
      commitOnVisibilityChangeHidden: asBool(hyperAdvanced._commitOnVisibilityChangeHidden, DEFAULT_HYPER_STATE.commitOnVisibilityChangeHidden),
      manifestIdentifier: asString(hyperAdvanced._manifestIdentifier, DEFAULT_HYPER_STATE.manifestIdentifier),
      exitStateIncomplete: asString(hyperAdvanced._exitStateIfIncomplete, DEFAULT_HYPER_STATE.exitStateIncomplete),
      exitStateComplete: asString(hyperAdvanced._exitStateIfComplete, DEFAULT_HYPER_STATE.exitStateComplete),
      fillInCharacterLimit: asString(hyperAdvanced._maxCharLimitOverride, DEFAULT_HYPER_STATE.fillInCharacterLimit),
      connectionTestEnabled: asBool(hyperConnectionTest._isEnabled, DEFAULT_HYPER_STATE.connectionTestEnabled),
      connectionTestOnSetValue: asBool(hyperConnectionTest._testOnSetValue, DEFAULT_HYPER_STATE.connectionTestOnSetValue),
      silentRetryLimit: asString(hyperConnectionTest._silentRetryLimit, DEFAULT_HYPER_STATE.silentRetryLimit),
      silentRetryDelay: asString(hyperConnectionTest._silentRetryDelay, DEFAULT_HYPER_STATE.silentRetryDelay),
      uniqueInteractionIds: asBool(hyperAdvanced._uniqueInteractionIds, DEFAULT_HYPER_STATE.uniqueInteractionIds),
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
      anonymizeIp: asBool(google._anonymizeIp, DEFAULT_GOOGLE_STATE.anonymizeIp),
      debugMode: asBool(google._debugMode, DEFAULT_GOOGLE_STATE.debugMode),
    },
    hotjar: {
      isEnabled: asBool(hotjar._isEnabled, DEFAULT_HOTJAR_STATE.isEnabled),
      siteId: asString(hotjar._siteId, DEFAULT_HOTJAR_STATE.siteId),
      version: asString(hotjar._version, DEFAULT_HOTJAR_STATE.version),
      debugMode: asBool(hotjar._debugMode, DEFAULT_HOTJAR_STATE.debugMode),
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
  // Connection test is inside _advancedSettings per the extension schema
  const spoorConnectionTest = asRecord(spoorAdvanced._connectionTest);

  const xapi = asRecord(current._xapi);
  const hyper = asRecord(current._hyper);
  const hyperTracking = asRecord(hyper._tracking);
  const hyperReporting = asRecord(hyper._reporting);
  const hyperAdvanced = asRecord(hyper._advancedSettings);
  const hyperConnectionTest = asRecord(hyperAdvanced._connectionTest);

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
        _resetStatusOnLanguageChange: snapshot.scorm.resetStatusWhenLanguageChanged,
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
        _suppressErrors: snapshot.scorm.suppressLmsErrors,
        _commitOnVisibilityChangeHidden: snapshot.scorm.commitOnVisibilityChangeHidden,
        _manifestIdentifier: snapshot.scorm.manifestIdentifier,
        _exitStateIfIncomplete: snapshot.scorm.exitStateIncomplete,
        _exitStateIfComplete: snapshot.scorm.exitStateComplete,
        _setCompletedWhenFailed: snapshot.scorm.completedWhenFailed,
        _maxCharLimitOverride: Number(snapshot.scorm.fillInCharacterLimit || 0),
        _uniqueInteractionIds: snapshot.scorm.uniqueInteractionIds,
        // Connection test is nested inside _advancedSettings per the extension schema
        _connectionTest: {
          ...spoorConnectionTest,
          _isEnabled: snapshot.scorm.connectionTestEnabled,
          _testOnSetValue: snapshot.scorm.connectionTestOnSetValue,
          _silentRetryLimit: Number(snapshot.scorm.silentRetryLimit || 0),
          _silentRetryDelay: Number(snapshot.scorm.silentRetryDelay || 0),
        },
      },
      // These two live at the ROOT of _spoor per the extension schema
      _showCookieLmsResetButton: snapshot.scorm.showResetButton,
      _shouldPersistCookieLMSData: snapshot.scorm.persistCookieData,
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
      // Core events use the nested _coreEvents structure from the extension schema
      _coreEvents: {
        ...asRecord(xapi._coreEvents),
        Adapt: {
          ...asRecord(asRecord(xapi._coreEvents).Adapt),
          'router:menu': snapshot.xapi.adaptRouterMenu,
          'router:page': snapshot.xapi.adaptRouterPage,
          'questionView:recordInteraction': snapshot.xapi.adaptRecordInteraction,
          'assessments:complete': snapshot.xapi.adaptAssessComplete,
        },
        contentObjects: {
          ...asRecord(asRecord(xapi._coreEvents).contentObjects),
          'change:_isComplete': snapshot.xapi.contentObjectIsComplete,
        },
        articles: {
          ...asRecord(asRecord(xapi._coreEvents).articles),
          'change:_isComplete': snapshot.xapi.articleIsComplete,
        },
        blocks: {
          ...asRecord(asRecord(xapi._coreEvents).blocks),
          'change:_isComplete': snapshot.xapi.blockIsComplete,
        },
        components: {
          ...asRecord(asRecord(xapi._coreEvents).components),
          'change:_isComplete': snapshot.xapi.componentIsComplete,
        },
      },
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
        _resetStatusOnLanguageChange: snapshot.hyper.resetStatusWhenLanguageChanged,
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
        _suppressErrors: snapshot.hyper.suppressLmsErrors,
        _commitOnVisibilityChangeHidden: snapshot.hyper.commitOnVisibilityChangeHidden,
        _manifestIdentifier: snapshot.hyper.manifestIdentifier,
        _exitStateIfIncomplete: snapshot.hyper.exitStateIncomplete,
        _exitStateIfComplete: snapshot.hyper.exitStateComplete,
        _maxCharLimitOverride: Number(snapshot.hyper.fillInCharacterLimit || 0),
        _connectionTest: {
          ...hyperConnectionTest,
          _isEnabled: snapshot.hyper.connectionTestEnabled,
          _testOnSetValue: snapshot.hyper.connectionTestOnSetValue,
          _silentRetryLimit: Number(snapshot.hyper.silentRetryLimit || 0),
          _silentRetryDelay: Number(snapshot.hyper.silentRetryDelay || 0),
        },
        _uniqueInteractionIds: snapshot.hyper.uniqueInteractionIds,
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
      _anonymizeIp: snapshot.google.anonymizeIp,
      _debugMode: snapshot.google.debugMode,
    },
    _hotjarAnalytics: {
      ...hotjar,
      _isEnabled: snapshot.hotjar.isEnabled,
      _siteId: snapshot.hotjar.siteId,
      _version: snapshot.hotjar.version,
      _debugMode: snapshot.hotjar.debugMode,
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
  const [analyticsPlugin, setAnalyticsPlugin] = useState<AnalyticsPlugin | null>(null);
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

  const currentSnapshotJson = useMemo(() => JSON.stringify(currentSnapshot), [currentSnapshot]);
  const savedSnapshotJson = useMemo(() => JSON.stringify(savedSnapshot), [savedSnapshot]);
  const hasChanges = currentSnapshotJson !== savedSnapshotJson;

  const { showConfirmModal, consumePendingNavigation, clearPendingNavigation } = useUnsavedChangesNavigationGuard({
    hasChanges,
    pendingNavigation,
    onPendingNavigationHandled,
    onNavigate: onNavigationRequest,
  });

  const handleTrackingPluginChange = (plugin: TrackingPlugin) => {
    setTrackingPlugin(plugin);
    setScorm((prev) => ({ ...prev, isEnabled: plugin === "scorm" }));
    setXapi((prev) => ({ ...prev, isEnabled: plugin === "xapi" }));
    setHyper((prev) => ({ ...prev, isEnabled: plugin === "hyperbridge" }));
  };

  const handleAnalyticsPluginChange = (plugin: AnalyticsPlugin) => {
    setAnalyticsPlugin(plugin);
    setUes((prev) => ({ ...prev, isEnabled: plugin === "ues" }));
    setGoogle((prev) => ({ ...prev, isEnabled: plugin === "google" }));
    setHotjar((prev) => ({ ...prev, isEnabled: plugin === "hotjar" }));
  };

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
    else setTrackingPlugin("scorm");

    if (snapshot.ues.isEnabled) setAnalyticsPlugin("ues");
    else if (snapshot.google.isEnabled) setAnalyticsPlugin("google");
    else if (snapshot.hotjar.isEnabled) setAnalyticsPlugin("hotjar");
    else setAnalyticsPlugin(null);
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
        let snapshot = buildSnapshotFromSettings(settings);
        // If no tracking plugin has ever been explicitly enabled, default SCORM to
        // enabled so that the selected radio (SCORM) drives the _enabledExtensions
        // entry on first save. Without this, the old UI never shows SCORM settings.
        if (!snapshot.scorm.isEnabled && !snapshot.xapi.isEnabled && !snapshot.hyper.isEnabled) {
          snapshot = { ...snapshot, scorm: { ...snapshot.scorm, isEnabled: true } };
        }
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
            <PluginRadio id="scorm" label="SCORM" description="adapt-contrib-spoor" selected={trackingPlugin === "scorm"} onSelect={() => handleTrackingPluginChange("scorm")} />
            <PluginRadio id="xapi" label="xAPI" description="adapt-contrib-xapi" selected={trackingPlugin === "xapi"} onSelect={() => handleTrackingPluginChange("xapi")} />
            <PluginRadio id="hyperbridge" label="HyperBridge" description="adapt-hyper-bridge" selected={trackingPlugin === "hyperbridge"} onSelect={() => handleTrackingPluginChange("hyperbridge")} />
          </div>

          {trackingPlugin === "scorm" && (
            <div className="mt-4 flex flex-col gap-4">
              <SectionLabel>SCORM (SPOOR) Settings</SectionLabel>
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
                <CheckboxRow
                  checked={scorm.resetStatusWhenLanguageChanged}
                  onChange={(v) => setScorm((prev) => ({ ...prev, resetStatusWhenLanguageChanged: v }))}
                  label="Reset status when language changed?"
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
              <CheckboxRow checked={scorm.suppressLmsErrors} onChange={(v) => setScorm((prev) => ({ ...prev, suppressLmsErrors: v }))} label="Suppress LMS errors" />
              <CheckboxRow checked={scorm.commitOnVisibilityChangeHidden} onChange={(v) => setScorm((prev) => ({ ...prev, commitOnVisibilityChangeHidden: v }))} label="Commit on visibility change hidden" />
              <TextField label="Manifest identifier" value={scorm.manifestIdentifier} onChange={(value) => setScorm((prev) => ({ ...prev, manifestIdentifier: value }))} placeholder="adapt_manifest" />
              <SelectField
                label="Exit state if incomplete"
                value={scorm.exitStateIncomplete}
                onChange={(value) => setScorm((prev) => ({ ...prev, exitStateIncomplete: value }))}
                options={[
                  { value: "auto", label: "auto" },
                  { value: "suspend", label: "suspend" },
                  { value: "normal", label: "normal" },
                  { value: "logout", label: "logout" },
                ]}
              />
              <SelectField
                label="Exit state if complete"
                value={scorm.exitStateComplete}
                onChange={(value) => setScorm((prev) => ({ ...prev, exitStateComplete: value }))}
                options={[
                  { value: "auto", label: "auto" },
                  { value: "suspend", label: "suspend" },
                  { value: "normal", label: "normal" },
                  { value: "logout", label: "logout" },
                ]}
              />
              <CheckboxRow checked={scorm.completedWhenFailed} onChange={(v) => setScorm((prev) => ({ ...prev, completedWhenFailed: v }))} label="Completed when failed" />
              <TextField label="Override value for maximum character limit on fill-in type answers" type="number" value={scorm.fillInCharacterLimit} onChange={(value) => setScorm((prev) => ({ ...prev, fillInCharacterLimit: value }))} />

              <SectionLabel>Connection Test</SectionLabel>
              <div className="ml-4 pl-3 border-l-2 border-[#e5e7eb] flex flex-col gap-3">
                <CheckboxRow checked={scorm.connectionTestEnabled} onChange={(v) => setScorm((prev) => ({ ...prev, connectionTestEnabled: v }))} label="Is Enabled" />
                <CheckboxRow checked={scorm.connectionTestOnSetValue} onChange={(v) => setScorm((prev) => ({ ...prev, connectionTestOnSetValue: v }))} label="Test on set value" />
                <TextField label="Silent Retry Limit" type="number" value={scorm.silentRetryLimit} onChange={(value) => setScorm((prev) => ({ ...prev, silentRetryLimit: value }))} />
                <TextField label="Silent Retry Delay" type="number" value={scorm.silentRetryDelay} onChange={(value) => setScorm((prev) => ({ ...prev, silentRetryDelay: value }))} />
              </div>

              <CheckboxRow checked={scorm.uniqueInteractionIds} onChange={(v) => setScorm((prev) => ({ ...prev, uniqueInteractionIds: v }))} label="Unique Interaction Ids" />
              <CheckboxRow checked={scorm.showResetButton} onChange={(v) => setScorm((prev) => ({ ...prev, showResetButton: v }))} label="Show reset button (scorm_test_harness.html only)" />
              <CheckboxRow checked={scorm.persistCookieData} onChange={(v) => setScorm((prev) => ({ ...prev, persistCookieData: v }))} label="Persist cookie data (scorm_test_harness.html only)" />
            </div>
          )}

          {trackingPlugin === "xapi" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>xAPI Settings</SectionLabel>
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
                options={[
                  { value: "de-DE", label: "de-DE" },
                  { value: "en-GB", label: "en-GB" },
                  { value: "en-US", label: "en-US" },
                  { value: "fr-FR", label: "fr-FR" },
                  { value: "es-ES", label: "es-ES" },
                  { value: "zh-CN", label: "zh-CN" },
                ]}
              />
              <TextField label="Component blacklist" value={xapi.componentBlacklist} onChange={(value) => setXapi((prev) => ({ ...prev, componentBlacklist: value }))} placeholder="blank,graphic" />
              <CheckboxRow checked={xapi.generateIds} onChange={(v) => setXapi((prev) => ({ ...prev, generateIds: v }))} label="Auto-generate ID for statements" />
              <CheckboxRow checked={xapi.shouldTrackState} onChange={(v) => setXapi((prev) => ({ ...prev, shouldTrackState: v }))} label="Track state" />
              <CheckboxRow checked={xapi.shouldUseRegistration} onChange={(v) => setXapi((prev) => ({ ...prev, shouldUseRegistration: v }))} label="Use registration" />

              <SectionLabel>Core Events</SectionLabel>
              <div className="ml-4 pl-3 border-l-2 border-[#e5e7eb] flex flex-col gap-3">
                <SubSectionLabel>Adapt</SubSectionLabel>
                <div className="ml-4 pl-3 border-l-2 border-[#f3f4f6] flex flex-col gap-3">
                  <CheckboxRow checked={xapi.adaptRouterMenu} onChange={(v) => setXapi((prev) => ({ ...prev, adaptRouterMenu: v }))} label="router:menu" />
                  <CheckboxRow checked={xapi.adaptRouterPage} onChange={(v) => setXapi((prev) => ({ ...prev, adaptRouterPage: v }))} label="router:page" />
                  <CheckboxRow checked={xapi.adaptRecordInteraction} onChange={(v) => setXapi((prev) => ({ ...prev, adaptRecordInteraction: v }))} label="questionView:recordInteraction" />
                  <CheckboxRow checked={xapi.adaptAssessComplete} onChange={(v) => setXapi((prev) => ({ ...prev, adaptAssessComplete: v }))} label="assessments:complete" />
                </div>
                <SubSectionLabel>contentObjects</SubSectionLabel>
                <div className="ml-4 pl-3 border-l-2 border-[#f3f4f6] flex flex-col gap-3">
                  <CheckboxRow checked={xapi.contentObjectIsComplete} onChange={(v) => setXapi((prev) => ({ ...prev, contentObjectIsComplete: v }))} label="change:_isComplete" />
                </div>
                <SubSectionLabel>articles</SubSectionLabel>
                <div className="ml-4 pl-3 border-l-2 border-[#f3f4f6] flex flex-col gap-3">
                  <CheckboxRow checked={xapi.articleIsComplete} onChange={(v) => setXapi((prev) => ({ ...prev, articleIsComplete: v }))} label="change:_isComplete" />
                </div>
                <SubSectionLabel>blocks</SubSectionLabel>
                <div className="ml-4 pl-3 border-l-2 border-[#f3f4f6] flex flex-col gap-3">
                  <CheckboxRow checked={xapi.blockIsComplete} onChange={(v) => setXapi((prev) => ({ ...prev, blockIsComplete: v }))} label="change:_isComplete" />
                </div>
                <SubSectionLabel>components</SubSectionLabel>
                <div className="ml-4 pl-3 border-l-2 border-[#f3f4f6] flex flex-col gap-3">
                  <CheckboxRow checked={xapi.componentIsComplete} onChange={(v) => setXapi((prev) => ({ ...prev, componentIsComplete: v }))} label="change:_isComplete" />
                </div>
              </div>

              <SelectField
                label="LRS connection failure behaviour"
                value={xapi.lrsFailureBehaviour}
                onChange={(value) => setXapi((prev) => ({ ...prev, lrsFailureBehaviour: value }))}
                options={[
                  { value: "ignore", label: "Ignore errors" },
                  { value: "show", label: "Show errors" },
                ]}
              />
            </div>
          )}

          {trackingPlugin === "hyperbridge" && (
            <div className="mt-4 flex flex-col gap-4">
              <SectionLabel>HyperBridge Settings</SectionLabel>
              <div className="ml-4 pl-3 border-l-2 border-[#e5e7eb] flex flex-col gap-3">
                <SubSectionLabel>Tracking</SubSectionLabel>
                <CheckboxRow checked={hyper.shouldStoreResponses} onChange={(v) => setHyper((prev) => ({ ...prev, shouldStoreResponses: v }))} label="Store question state" />
                <CheckboxRow checked={hyper.shouldStoreAttempts} onChange={(v) => setHyper((prev) => ({ ...prev, shouldStoreAttempts: v }))} label="Store question attempt states" />
                <CheckboxRow checked={hyper.shouldCompress} onChange={(v) => setHyper((prev) => ({ ...prev, shouldCompress: v }))} label="Should compress data" />
              </div>

              <div className="ml-4 pl-3 border-l-2 border-[#e5e7eb] flex flex-col gap-3">
                <SubSectionLabel>Reporting</SubSectionLabel>
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
                <CheckboxRow
                  checked={hyper.resetStatusWhenLanguageChanged}
                  onChange={(v) => setHyper((prev) => ({ ...prev, resetStatusWhenLanguageChanged: v }))}
                  label="Reset status when language changed?"
                />
              </div>

              <SectionLabel>Advanced Settings</SectionLabel>
              <CheckboxRow checked={hyper.commitOnStatusChange} onChange={(v) => setHyper((prev) => ({ ...prev, commitOnStatusChange: v }))} label="Commit data on status change" />
              <CheckboxRow checked={hyper.showSuspendDataPopup} onChange={(v) => setHyper((prev) => ({ ...prev, showSuspendDataPopup: v }))} label="Suspend data popup" />
              <CheckboxRow checked={hyper.commitOnAnyChange} onChange={(v) => setHyper((prev) => ({ ...prev, commitOnAnyChange: v }))} label="Commit data on any change" />
              <CheckboxRow checked={hyper.commitOnAssessmentResult} onChange={(v) => setHyper((prev) => ({ ...prev, commitOnAssessmentResult: v }))} label="Commit data on assessment results" />
              <TextField label="Frequency (mins) of automatic commits" type="number" value={hyper.timedCommitFrequency} onChange={(value) => setHyper((prev) => ({ ...prev, timedCommitFrequency: value }))} />
              <TextField label="Maximum number of commit retries" type="number" value={hyper.maxCommitRetries} onChange={(value) => setHyper((prev) => ({ ...prev, maxCommitRetries: value }))} />
              <TextField label="Commit retry delay" type="number" value={hyper.commitRetryDelay} onChange={(value) => setHyper((prev) => ({ ...prev, commitRetryDelay: value }))} />
              <CheckboxRow checked={hyper.suppressLmsErrors} onChange={(v) => setHyper((prev) => ({ ...prev, suppressLmsErrors: v }))} label="Suppress LMS errors" />
              <CheckboxRow checked={hyper.commitOnVisibilityChangeHidden} onChange={(v) => setHyper((prev) => ({ ...prev, commitOnVisibilityChangeHidden: v }))} label="Commit on visibility change hidden" />
              <TextField label="Manifest identifier" value={hyper.manifestIdentifier} onChange={(value) => setHyper((prev) => ({ ...prev, manifestIdentifier: value }))} placeholder="adapt_manifest" />
              <SelectField
                label="Exit state if incomplete"
                value={hyper.exitStateIncomplete}
                onChange={(value) => setHyper((prev) => ({ ...prev, exitStateIncomplete: value }))}
                options={[
                  { value: "auto", label: "auto" },
                  { value: "suspend", label: "suspend" },
                  { value: "normal", label: "normal" },
                  { value: "", label: "'' (empty string)" },
                ]}
              />
              <SelectField
                label="Exit state if complete"
                value={hyper.exitStateComplete}
                onChange={(value) => setHyper((prev) => ({ ...prev, exitStateComplete: value }))}
                options={[
                  { value: "auto", label: "auto" },
                  { value: "suspend", label: "suspend" },
                  { value: "normal", label: "normal" },
                  { value: "", label: "'' (empty string)" },
                ]}
              />
              <TextField label="Override value for maximum character limit on fill-in type answers" type="number" value={hyper.fillInCharacterLimit} onChange={(value) => setHyper((prev) => ({ ...prev, fillInCharacterLimit: value }))} />

              <SectionLabel>Connection Test</SectionLabel>
              <div className="ml-4 pl-3 border-l-2 border-[#e5e7eb] flex flex-col gap-3">
                <CheckboxRow checked={hyper.connectionTestEnabled} onChange={(v) => setHyper((prev) => ({ ...prev, connectionTestEnabled: v }))} label="Is Enabled" />
                <CheckboxRow checked={hyper.connectionTestOnSetValue} onChange={(v) => setHyper((prev) => ({ ...prev, connectionTestOnSetValue: v }))} label="Test on set value" />
                <TextField label="Silent Retry Limit" type="number" value={hyper.silentRetryLimit} onChange={(value) => setHyper((prev) => ({ ...prev, silentRetryLimit: value }))} />
                <TextField label="Silent Retry Delay" type="number" value={hyper.silentRetryDelay} onChange={(value) => setHyper((prev) => ({ ...prev, silentRetryDelay: value }))} />
              </div>

              <CheckboxRow checked={hyper.uniqueInteractionIds} onChange={(v) => setHyper((prev) => ({ ...prev, uniqueInteractionIds: v }))} label="Unique Interaction Ids" />
            </div>
          )}
        </AccordionCard>

        <AccordionCard
          title="Analytics"
          open={analyticsOpen}
          onToggle={() => setAnalyticsOpen((open) => !open)}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
        >
          <p className="text-xs text-[#6b7280] mb-3">Select one analytics plugin and edit its existing settings. Select none to disable all analytics.</p>
          <div className="flex flex-col gap-1.5">
            <PluginRadio id="ues" label="Unified Event System Analytics" description="adapt-ues-analytics" selected={analyticsPlugin === "ues"} onSelect={() => analyticsPlugin === "ues" ? (setAnalyticsPlugin(null), setUes(p => ({ ...p, isEnabled: false }))) : handleAnalyticsPluginChange("ues")} />
            <PluginRadio id="google" label="Google Analytics" description="adapt-googleAnalytics" selected={analyticsPlugin === "google"} onSelect={() => analyticsPlugin === "google" ? (setAnalyticsPlugin(null), setGoogle(p => ({ ...p, isEnabled: false }))) : handleAnalyticsPluginChange("google")} />
            <PluginRadio id="hotjar" label="Hotjar Analytics" description="adapt-hotjarAnalytics" selected={analyticsPlugin === "hotjar"} onSelect={() => analyticsPlugin === "hotjar" ? (setAnalyticsPlugin(null), setHotjar(p => ({ ...p, isEnabled: false }))) : handleAnalyticsPluginChange("hotjar")} />
          </div>

          {analyticsPlugin === "ues" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>UES Settings</SectionLabel>
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
              <TextField label="Measurement ID" value={google.trackingId} onChange={(value) => setGoogle((prev) => ({ ...prev, trackingId: value }))} placeholder="G-XXXXXXXXXX" />
              <CheckboxRow checked={google.anonymizeIp} onChange={(v) => setGoogle((prev) => ({ ...prev, anonymizeIp: v }))} label="Anonymize IP" />
              <CheckboxRow checked={google.debugMode} onChange={(v) => setGoogle((prev) => ({ ...prev, debugMode: v }))} label="Debug mode" />
            </div>
          )}

          {analyticsPlugin === "hotjar" && (
            <div className="mt-4 flex flex-col gap-3">
              <SectionLabel>Hotjar Settings</SectionLabel>
              <TextField label="Site ID" value={hotjar.siteId} onChange={(value) => setHotjar((prev) => ({ ...prev, siteId: value }))} placeholder="1234567" />
              <TextField label="Hotjar version" value={hotjar.version} onChange={(value) => setHotjar((prev) => ({ ...prev, version: value }))} placeholder="6" />
              <CheckboxRow checked={hotjar.debugMode} onChange={(v) => setHotjar((prev) => ({ ...prev, debugMode: v }))} label="Debug mode" />
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
