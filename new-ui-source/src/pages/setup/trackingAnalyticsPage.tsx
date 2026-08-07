import { useState, type ReactNode } from "react";

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

export function TrackingAnalyticsPage() {
  const [trackingOpen, setTrackingOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [trackingPlugin, setTrackingPlugin] = useState<TrackingPlugin>("scorm");
  const [analyticsPlugin, setAnalyticsPlugin] = useState<AnalyticsPlugin>("ues");

  const [scorm, setScorm] = useState({
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
  });

  const [xapi, setXapi] = useState({
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
  });

  const [hyper, setHyper] = useState({
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
  });

  const [ues, setUes] = useState({
    isEnabled: false,
    isDebugMode: false,
    projectTag: "",
    portfolio: "Adapt Course",
    resourceLinkId: "",
    standard: "",
    ecl: "",
  });

  const [google, setGoogle] = useState({
    isEnabled: false,
    trackingId: "",
  });

  const [hotjar, setHotjar] = useState({
    isEnabled: false,
    siteId: "",
  });

  return (
    <div className="max-w-2xl w-full">
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
  );
}
