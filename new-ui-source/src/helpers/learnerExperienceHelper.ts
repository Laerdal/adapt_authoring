import { apiClient } from "../api/client";

type AnyRecord = Record<string, unknown>;

interface EngineConfigDetails {
  _id?: string;
  _enabledExtensions?: Record<string, { _id: string; name: string; version?: string; targetAttribute?: string }>;
  _extensions?: Record<string, unknown>;
}

export interface LearnerNotesSettings {
  enabled: boolean;
  title: string;
  instruction: string;
  placeholder: string;
  searchErrorMessage: string;
  successMessage: string;
  errorMessage: string;
  createANewNote: string;
  exportANote: string;
  saveNote: string;
  downloadANote: string;
  uploadANote: string;
  searchNote: string;
  deleteNote: string;
  cancel: string;
  editNote: string;
}

export interface LearnerSearchSettings {
  enabled: boolean;
  title: string;
  placeholder: string;
  searchBoxPlaceholder: string;
  noResultsMessage: string;
  processingResultsMessage: string;
  showFoundWords: boolean;
  showHighlights: boolean;
  previewWords: number;
  previewCharacters: number;
  minimumWordLength: number;
  frequencyImportance: number;
  ignoredWords: string[];
  matchOn: {
    contentWordBeginsPhraseWord: boolean;
    contentWordContainsPhraseWord: boolean;
    contentWordEqualsPhraseWord: boolean;
    phraseWordBeginsContentWord: boolean;
  };
}

export type CourseFeedbackOption = "autoOpen" | "hideAfterSubmit";

export interface CourseFeedbackSettings {
  enabled: boolean;
  options: CourseFeedbackOption[];
  buttonText: string;
  buttonAriaLabel: string;
  ratingTitle: string;
  ratingAriaLabel: string;
  highestRatingLabel: string;
  lowestRatingLabel: string;
  commonTitle: string;
  commonPlaceholder: string;
  commonAriaLabel: string;
  maximumCharacterLength: number;
  nextButtonText: string;
  closeButtonText: string;
  thankYouBody: string;
}

const LEARNER_NOTES_EXTENSION_NAME = "adapt-courseNotes";
const LEARNER_SEARCH_EXTENSION_NAME = "adapt-search";
const COURSE_FEEDBACK_EXTENSION_NAME = "laerdal-course-feedback";
const COURSE_FEEDBACK_EXTENSION_DISPLAY_NAME = "Laerdal Course Feedback";
const LEARNING_RESOURCES_EXTENSION_NAME = "adapt-contrib-resources";
const AI_TUTOR_EXTENSION_NAME = "adapt-laerdal-ai-tutor";

export interface AiTutorDocument {
  id: string;
  name: string;
  document: string;
}

export interface AiTutorSettings {
  enabled: boolean;
  title: string;
  placeholderText: string;
  languageCode: string;
  documents: AiTutorDocument[];
}

function obj(v: unknown): AnyRecord {
  return v && typeof v === "object" ? (v as AnyRecord) : {};
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function normalizeIgnoredWords(value: string): string[] {
  return value
    .split(",")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function normalizePluginName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isExtensionInstalledByName(config: EngineConfigDetails, extensionName: string): boolean {
  const target = normalizePluginName(extensionName);
  const map = config._enabledExtensions ?? {};
  const byValue = Object.values(map).some((entry) => normalizePluginName(entry?.name ?? "") === target);
  if (byValue) return true;
  return Object.keys(map).some((key) => normalizePluginName(key) === target);
}

async function resolveExtensionTypeIdsByNames(extensionNames: string[]): Promise<string[]> {
  if (!extensionNames.length) return [];
  const rows = await apiClient.get<{
    _id: string;
    name?: string;
    displayName?: string;
    extension?: string;
    targetAttribute?: string;
  }[]>("/api/extensiontype");
  const byName = new Map<string, string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?._id) continue;
    const keys = [row.name, row.displayName, row.extension, row.targetAttribute]
      .map((value) => normalizePluginName(value ?? ""))
      .filter((value) => value.length > 0);
    for (const key of keys) {
      if (!byName.has(key)) byName.set(key, row._id);
    }
  }
  return extensionNames
    .map((name) => byName.get(normalizePluginName(name)))
    .filter((id): id is string => !!id);
}

export function defaultLearnerNotesSettings(): LearnerNotesSettings {
  return {
    enabled: false,
    title: "",
    instruction: "",
    placeholder: "",
    searchErrorMessage: "",
    successMessage: "",
    errorMessage: "",
    createANewNote: "",
    exportANote: "",
    saveNote: "",
    downloadANote: "",
    uploadANote: "",
    searchNote: "",
    deleteNote: "",
    cancel: "",
    editNote: "",
  };
}

export function defaultLearnerSearchSettings(): LearnerSearchSettings {
  return {
    enabled: false,
    title: "Search",
    placeholder: "Type in search words",
    searchBoxPlaceholder: "",
    noResultsMessage: "Sorry, no results were found",
    processingResultsMessage: "Formulating results...",
    showFoundWords: true,
    showHighlights: true,
    previewWords: 15,
    previewCharacters: 30,
    minimumWordLength: 2,
    frequencyImportance: 5,
    ignoredWords: [],
    matchOn: {
      contentWordBeginsPhraseWord: false,
      contentWordContainsPhraseWord: false,
      contentWordEqualsPhraseWord: true,
      phraseWordBeginsContentWord: true,
    },
  };
}

export function defaultCourseFeedbackSettings(): CourseFeedbackSettings {
  return {
    enabled: false,
    options: [],
    buttonText: "Feedback",
    buttonAriaLabel: "Click to provide course feedback",
    ratingTitle: "How would you rate your experience?",
    ratingAriaLabel: "where 1 is Hate and 5 is Love",
    highestRatingLabel: "Love",
    lowestRatingLabel: "Hate",
    commonTitle: "Tell us about your experience",
    commonPlaceholder: "Share your feedback",
    commonAriaLabel: "Your feedback",
    maximumCharacterLength: 250,
    nextButtonText: "Next",
    closeButtonText: "Close",
    thankYouBody: "Thank you for sharing your feedback with us!",
  };
}

export async function getLearnerNotesSettings(courseId: string): Promise<LearnerNotesSettings> {
  const [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const courseExtensions = obj(course._extensions);
  const notes = obj(courseExtensions._courseNotes || course._courseNotes);
  const defaults = defaultLearnerNotesSettings();

  return {
    ...defaults,
    enabled: isExtensionInstalledByName(config, LEARNER_NOTES_EXTENSION_NAME) && bool(notes._isEnabled, true),
    title: str(notes.displayTitle),
    instruction: str(notes.instruction),
    placeholder: str(notes.placeholder),
    searchErrorMessage: str(notes.errorMessageSearch),
    successMessage: str(notes.successMessage),
    errorMessage: str(notes.errorMessage),
    createANewNote: str(notes.newNote),
    exportANote: str(notes.exportNote),
    saveNote: str(notes.saveNote),
    downloadANote: str(notes.downloadNote),
    uploadANote: str(notes.uploadNote),
    searchNote: str(notes.searchNote),
    deleteNote: str(notes.deleteNote),
    cancel: str(notes.cancelNote),
    editNote: str(notes.editNote),
  };
}

export async function saveLearnerNotesSettings(courseId: string, settings: LearnerNotesSettings): Promise<void> {
  let [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const installed = isExtensionInstalledByName(config, LEARNER_NOTES_EXTENSION_NAME);
  if (settings.enabled && !installed) {
    const ids = await resolveExtensionTypeIdsByNames([LEARNER_NOTES_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
      [course, config] = await Promise.all([
        apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
        apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
      ]);
    }
  } else if (!settings.enabled && installed) {
    const ids = await resolveExtensionTypeIdsByNames([LEARNER_NOTES_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
    return;
  }

  if (!isExtensionInstalledByName(config, LEARNER_NOTES_EXTENSION_NAME)) return;

  const courseExtensions = obj(course._extensions);
  const notes = {
    ...obj(courseExtensions._courseNotes || course._courseNotes),
    _isEnabled: settings.enabled,
    displayTitle: settings.title,
    instruction: settings.instruction,
    placeholder: settings.placeholder,
    errorMessageSearch: settings.searchErrorMessage,
    successMessage: settings.successMessage,
    errorMessage: settings.errorMessage,
    newNote: settings.createANewNote,
    exportNote: settings.exportANote,
    saveNote: settings.saveNote,
    downloadNote: settings.downloadANote,
    uploadNote: settings.uploadANote,
    searchNote: settings.searchNote,
    deleteNote: settings.deleteNote,
    cancelNote: settings.cancel,
    editNote: settings.editNote,
  };

  await apiClient.put(`/api/content/course/${courseId}`, {
    _extensions: {
      ...courseExtensions,
      _courseNotes: notes,
    },
  });
}
/* =============================================================
   LEARNING RESOURCES (adapt-contrib-resources)
   ============================================================= */

export type LearningResourceType =
  | "document" | "media" | "link"
  | "custom1" | "custom2" | "custom3" | "custom4" | "custom5"
  | "custom6" | "custom7" | "custom8" | "custom9" | "custom10";

export interface LearningResourceItem {
  /** UI-only stable id (not persisted) */
  id: string;
  format: LearningResourceType;
  forceDownload: boolean;
  title: string;
  fileName: string;
  description: string;
  /** "asset" = path relative to course, "url" = external http(s) link */
  sourceType: "asset" | "url";
  assetValue: string;
  urlValue: string;
  displayOnEveryPage: boolean;
}

export interface LearningResourceFilterText {
  all: string;
  document: string;
  media: string;
  link: string;
  customType1: string;
  customType2: string;
  customType3: string;
  customType4: string;
  customType5: string;
  customType6: string;
  customType7: string;
  customType8: string;
  customType9: string;
  customType10: string;
}

export interface LearningResourcesSettings {
  enabled: boolean;
  drawerOrder: number;
  sectionTitle: string;
  description: string;
  displayTitle: string;
  body: string;
  instruction: string;
  enableFilterButton: boolean;
  filterButtons: LearningResourceFilterText;
  ariaLabels: LearningResourceFilterText;
  resources: LearningResourceItem[];
}

function defaultLearningResourceFilterText(): LearningResourceFilterText {
  return {
    all: "", document: "", media: "", link: "",
    customType1: "", customType2: "", customType3: "", customType4: "", customType5: "",
    customType6: "", customType7: "", customType8: "", customType9: "", customType10: "",
  };
}

export function defaultLearningResourcesSettings(): LearningResourcesSettings {
  return {
    enabled: false,
    drawerOrder: 0,
    sectionTitle: "",
    description: "",
    displayTitle: "",
    body: "",
    instruction: "",
    enableFilterButton: false,
    filterButtons: defaultLearningResourceFilterText(),
    ariaLabels: defaultLearningResourceFilterText(),
    resources: [],
  };
}

/** Convert a `_link` string from the schema to sourceType + values. */
function parseLinkField(link: string): Pick<LearningResourceItem, "sourceType" | "assetValue" | "urlValue"> {
  if (/^https?:\/\//i.test(link)) {
    return { sourceType: "url", assetValue: "", urlValue: link };
  }
  return { sourceType: "asset", assetValue: link, urlValue: "" };
}

function filterTextFromSchema(buttons: AnyRecord, suffix: string): LearningResourceFilterText {
  return {
    all: str(buttons[`all${suffix}`]),
    document: str(buttons[`document${suffix}`]),
    media: str(buttons[`media${suffix}`]),
    link: str(buttons[`link${suffix}`]),
    customType1: str(buttons[`custom1${suffix}`]),
    customType2: str(buttons[`custom2${suffix}`]),
    customType3: str(buttons[`custom3${suffix}`]),
    customType4: str(buttons[`custom4${suffix}`]),
    customType5: str(buttons[`custom5${suffix}`]),
    customType6: str(buttons[`custom6${suffix}`]),
    customType7: str(buttons[`custom7${suffix}`]),
    customType8: str(buttons[`custom8${suffix}`]),
    customType9: str(buttons[`custom9${suffix}`]),
    customType10: str(buttons[`custom10${suffix}`]),
  };
}

function filterTextToSchemaButtons(text: LearningResourceFilterText): AnyRecord {
  return {
    all: text.all, document: text.document, media: text.media, link: text.link,
    custom1: text.customType1, custom2: text.customType2, custom3: text.customType3,
    custom4: text.customType4, custom5: text.customType5, custom6: text.customType6,
    custom7: text.customType7, custom8: text.customType8, custom9: text.customType9,
    custom10: text.customType10,
  };
}

function filterTextToSchemaAria(text: LearningResourceFilterText): AnyRecord {
  return {
    allAria: text.all, documentAria: text.document, mediaAria: text.media, linkAria: text.link,
    custom1Aria: text.customType1, custom2Aria: text.customType2, custom3Aria: text.customType3,
    custom4Aria: text.customType4, custom5Aria: text.customType5, custom6Aria: text.customType6,
    custom7Aria: text.customType7, custom8Aria: text.customType8, custom9Aria: text.customType9,
    custom10Aria: text.customType10,
  };
}

export async function getLearningResourcesSettings(courseId: string): Promise<LearningResourcesSettings> {
  const [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const courseExtensions = obj(course._extensions);
  const resources = obj(courseExtensions._resources || course._resources);
  const filterButtons = obj(resources._filterButtons);
  const filterAria = obj(resources._filterAria);
  const defaults = defaultLearningResourcesSettings();

  const rawItems = Array.isArray(resources._resourcesItems) ? resources._resourcesItems : [];
  const items: LearningResourceItem[] = rawItems.map((item: unknown) => {
    const i = obj(item);
    const { sourceType, assetValue, urlValue } = parseLinkField(str(i._link));
    return {
      id: Math.random().toString(36).slice(2),
      format: str(i._type, "document") as LearningResourceType,
      forceDownload: bool(i._forceDownload, false),
      title: str(i.title),
      fileName: str(i.filename),
      description: str(i.description),
      sourceType,
      assetValue,
      urlValue,
      displayOnEveryPage: bool(i._isGlobal, true),
    };
  });

  return {
    ...defaults,
    enabled: isExtensionInstalledByName(config, LEARNING_RESOURCES_EXTENSION_NAME) && bool(resources._isEnabled, true),
    drawerOrder: num(resources._drawerOrder, 0),
    sectionTitle: str(resources.title),
    description: str(resources.description),
    displayTitle: str(resources.displayTitle),
    body: str(resources.body),
    instruction: str(resources.instruction),
    enableFilterButton: bool(resources._enableFilters, false),
    filterButtons: filterTextFromSchema(filterButtons, ""),
    ariaLabels: filterTextFromSchema(filterAria, "Aria"),
    resources: items,
  };
}

export async function saveLearningResourcesSettings(courseId: string, settings: LearningResourcesSettings): Promise<void> {
  let [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const installed = isExtensionInstalledByName(config, LEARNING_RESOURCES_EXTENSION_NAME);
  if (settings.enabled && !installed) {
    const ids = await resolveExtensionTypeIdsByNames([LEARNING_RESOURCES_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
      [course, config] = await Promise.all([
        apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
        apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
      ]);
    }
  } else if (!settings.enabled && installed) {
    const ids = await resolveExtensionTypeIdsByNames([LEARNING_RESOURCES_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
    return;
  }

  if (!isExtensionInstalledByName(config, LEARNING_RESOURCES_EXTENSION_NAME)) return;

  const courseExtensions = obj(course._extensions);
  const existing = obj(courseExtensions._resources || course._resources);

  const resourcesItems = settings.resources.map((r) => ({
    _type: r.format,
    _forceDownload: r.forceDownload,
    title: r.title,
    filename: r.fileName,
    description: r.description,
    _link: r.sourceType === "url" ? r.urlValue : r.assetValue,
    _isGlobal: r.displayOnEveryPage,
  }));

  const payload = {
    ...existing,
    _isEnabled: settings.enabled,
    _drawerOrder: settings.drawerOrder,
    title: settings.sectionTitle,
    description: settings.description,
    displayTitle: settings.displayTitle,
    body: settings.body,
    instruction: settings.instruction,
    _enableFilters: settings.enableFilterButton,
    _filterButtons: filterTextToSchemaButtons(settings.filterButtons),
    _filterAria: filterTextToSchemaAria(settings.ariaLabels),
    _resourcesItems: resourcesItems,
  };

  await apiClient.put(`/api/content/course/${courseId}`, {
    _extensions: {
      ...courseExtensions,
      _resources: payload,
    },
  });
}
export async function getLearnerSearchSettings(courseId: string): Promise<LearnerSearchSettings> {
  const [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const courseExtensions = obj(course._extensions);
  const search = obj(courseExtensions._search || course._search);
  const matchOn = obj(search._matchOn);
  const defaults = defaultLearnerSearchSettings();
  const ignoreWords = Array.isArray(search._ignoreWords)
    ? search._ignoreWords.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : typeof search._ignoreWords === "string"
      ? normalizeIgnoredWords(search._ignoreWords)
      : defaults.ignoredWords;

  return {
    ...defaults,
    enabled: isExtensionInstalledByName(config, LEARNER_SEARCH_EXTENSION_NAME) && bool(search._isEnabled, true),
    title: str(search.title, defaults.title),
    placeholder: str(search.description, defaults.placeholder),
    searchBoxPlaceholder: str(search.placeholder, defaults.searchBoxPlaceholder),
    noResultsMessage: str(search.noResultsMessage, defaults.noResultsMessage),
    processingResultsMessage: str(search.awaitingResultsMessage, defaults.processingResultsMessage),
    showFoundWords: bool(search._showFoundWords, defaults.showFoundWords),
    showHighlights: bool(search._showHighlights, defaults.showHighlights),
    previewWords: num(search._previewWords, defaults.previewWords),
    previewCharacters: num(search._previewCharacters, defaults.previewCharacters),
    minimumWordLength: num(search._minimumWordLength, defaults.minimumWordLength),
    frequencyImportance: num(search._frequencyImportance, defaults.frequencyImportance),
    ignoredWords: ignoreWords,
    matchOn: {
      contentWordBeginsPhraseWord: bool(matchOn._contentWordBeginsPhraseWord, defaults.matchOn.contentWordBeginsPhraseWord),
      contentWordContainsPhraseWord: bool(matchOn._contentWordContainsPhraseWord, defaults.matchOn.contentWordContainsPhraseWord),
      contentWordEqualsPhraseWord: bool(matchOn._contentWordEqualsPhraseWord, defaults.matchOn.contentWordEqualsPhraseWord),
      phraseWordBeginsContentWord: bool(matchOn._phraseWordBeginsContentWord, defaults.matchOn.phraseWordBeginsContentWord),
    },
  };
}

export async function saveLearnerSearchSettings(courseId: string, settings: LearnerSearchSettings): Promise<void> {
  let [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);

  const installed = isExtensionInstalledByName(config, LEARNER_SEARCH_EXTENSION_NAME);
  if (settings.enabled && !installed) {
    const ids = await resolveExtensionTypeIdsByNames([LEARNER_SEARCH_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
      [course, config] = await Promise.all([
        apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
        apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
      ]);
    }
  } else if (!settings.enabled && installed) {
    const ids = await resolveExtensionTypeIdsByNames([LEARNER_SEARCH_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
    return;
  }

  if (!isExtensionInstalledByName(config, LEARNER_SEARCH_EXTENSION_NAME)) return;

  const courseExtensions = obj(course._extensions);
  const search = {
    ...obj(courseExtensions._search || course._search),
    _isEnabled: settings.enabled,
    title: settings.title,
    description: settings.placeholder,
    placeholder: settings.searchBoxPlaceholder,
    noResultsMessage: settings.noResultsMessage,
    awaitingResultsMessage: settings.processingResultsMessage,
    _showFoundWords: settings.showFoundWords,
    _showHighlights: settings.showHighlights,
    _previewWords: settings.previewWords,
    _previewCharacters: settings.previewCharacters,
    _minimumWordLength: settings.minimumWordLength,
    _frequencyImportance: settings.frequencyImportance,
    _ignoreWords: settings.ignoredWords.join(","),
    _matchOn: {
      _contentWordBeginsPhraseWord: settings.matchOn.contentWordBeginsPhraseWord,
      _contentWordContainsPhraseWord: settings.matchOn.contentWordContainsPhraseWord,
      _contentWordEqualsPhraseWord: settings.matchOn.contentWordEqualsPhraseWord,
      _phraseWordBeginsContentWord: settings.matchOn.phraseWordBeginsContentWord,
    },
  };

  await apiClient.put(`/api/content/course/${courseId}`, {
    _extensions: {
      ...courseExtensions,
      _search: search,
    },
  });
}

export async function getCourseFeedbackSettings(courseId: string): Promise<CourseFeedbackSettings> {
  const [course, config] = await Promise.all([
    apiClient.get<AnyRecord>(`/api/content/course/${courseId}`),
    apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`),
  ]);
  const laerdalCourseFeedbackId = await resolveLaerdalCourseFeedbackExtensionTypeId();

  const configExtensions = obj(config._extensions);
  const courseExtensions = obj(course._extensions);
  const feedback = obj(configExtensions._courseFeedback || courseExtensions._courseFeedback || course._courseFeedback);
  const triggerButton = obj(feedback._triggerButton);
  const widget = obj(feedback._widget);
  const rating = obj(widget._rating);
  const comment = obj(widget._comment);
  const buttons = obj(widget._buttons);
  const thankYou = obj(widget._thankYou);
  const defaults = defaultCourseFeedbackSettings();
  const options: CourseFeedbackOption[] = [];

  if (bool(feedback._autoOpenOnComplete, false)) options.push("autoOpen");
  if (bool(feedback._hideButtonAfterSubmission, false)) options.push("hideAfterSubmit");

  return {
    ...defaults,
    enabled: isExtensionInstalledById(config, laerdalCourseFeedbackId) && bool(feedback._isEnabled, true),
    options,
    buttonText: str(triggerButton.text, defaults.buttonText),
    buttonAriaLabel: str(triggerButton.ariaLabel, defaults.buttonAriaLabel),
    ratingTitle: str(rating.title, defaults.ratingTitle),
    ratingAriaLabel: str(rating.ariaLabel, defaults.ratingAriaLabel),
    highestRatingLabel: str(rating.labelHigh, defaults.highestRatingLabel),
    lowestRatingLabel: str(rating.labelLow, defaults.lowestRatingLabel),
    commonTitle: str(comment.title, defaults.commonTitle),
    commonPlaceholder: str(comment.placeholder, defaults.commonPlaceholder),
    commonAriaLabel: str(comment.ariaLabel, defaults.commonAriaLabel),
    maximumCharacterLength: num(comment.maxLength, defaults.maximumCharacterLength),
    nextButtonText: str(buttons.next, defaults.nextButtonText),
    closeButtonText: str(buttons.close, defaults.closeButtonText),
    thankYouBody: str(thankYou.body, defaults.thankYouBody),
  };
}

export async function saveCourseFeedbackSettings(courseId: string, settings: CourseFeedbackSettings): Promise<void> {
  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const laerdalCourseFeedbackId = await resolveLaerdalCourseFeedbackExtensionTypeId();

  const ensureConfigId = (cfg: EngineConfigDetails): string => {
    if (!cfg._id) throw new Error("Could not resolve config id for course feedback settings");
    return cfg._id;
  };

  const installed = isExtensionInstalledById(config, laerdalCourseFeedbackId);
  if (settings.enabled && !installed) {
    await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: [laerdalCourseFeedbackId] });
    config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  } else if (!settings.enabled && installed) {
    await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: [laerdalCourseFeedbackId] });
    return;
  }

  if (!isExtensionInstalledById(config, laerdalCourseFeedbackId)) return;

  const configId = ensureConfigId(config);
  const configExtensions = obj(config._extensions);
  const existingFeedback = obj(configExtensions._courseFeedback);
  const existingTriggerButton = obj(existingFeedback._triggerButton);
  const existingWidget = obj(existingFeedback._widget);
  const existingRating = obj(existingWidget._rating);
  const existingComment = obj(existingWidget._comment);
  const existingButtons = obj(existingWidget._buttons);
  const existingThankYou = obj(existingWidget._thankYou);

  const feedback = {
    ...existingFeedback,
    _isEnabled: settings.enabled,
    _autoOpenOnComplete: settings.options.includes("autoOpen"),
    _hideButtonAfterSubmission: settings.options.includes("hideAfterSubmit"),
    _triggerButton: {
      ...existingTriggerButton,
      text: settings.buttonText,
      ariaLabel: settings.buttonAriaLabel,
    },
    _widget: {
      ...existingWidget,
      _rating: {
        ...existingRating,
        title: settings.ratingTitle,
        ariaLabel: settings.ratingAriaLabel,
        labelLow: settings.lowestRatingLabel,
        labelHigh: settings.highestRatingLabel,
      },
      _comment: {
        ...existingComment,
        title: settings.commonTitle,
        placeholder: settings.commonPlaceholder,
        ariaLabel: settings.commonAriaLabel,
        maxLength: settings.maximumCharacterLength,
      },
      _buttons: {
        ...existingButtons,
        next: settings.nextButtonText,
        close: settings.closeButtonText,
      },
      _thankYou: {
        ...existingThankYou,
        body: settings.thankYouBody,
      },
    },
  };

  await apiClient.patch(`/api/content/config/${configId}`, {
    _id: configId,
    _courseId: courseId,
    _extensions: {
      ...configExtensions,
      _courseFeedback: feedback,
    },
  });
}

interface ExtensionTypeRow {
  _id: string;
  name?: string;
  displayName?: string;
  extension?: string;
  targetAttribute?: string;
}

async function getExtensionTypes(): Promise<ExtensionTypeRow[]> {
  const rows = await apiClient.get<ExtensionTypeRow[]>("/api/extensiontype");
  return Array.isArray(rows) ? rows : [];
}

async function resolveLaerdalCourseFeedbackExtensionTypeId(): Promise<string> {
  const rows = await getExtensionTypes();
  const normalizedName = normalizePluginName(COURSE_FEEDBACK_EXTENSION_NAME);
  const normalizedDisplay = normalizePluginName(COURSE_FEEDBACK_EXTENSION_DISPLAY_NAME);

  const byExactName = rows.find((row) => normalizePluginName(row.name ?? "") === normalizedName);
  if (byExactName?._id) return byExactName._id;

  const byExactExtension = rows.find((row) => normalizePluginName(row.extension ?? "") === normalizedName);
  if (byExactExtension?._id) return byExactExtension._id;

  const byDisplayName = rows.find((row) => normalizePluginName(row.displayName ?? "") === normalizedDisplay);
  if (byDisplayName?._id) return byDisplayName._id;

  throw new Error("Could not resolve extension type id for Laerdal Course Feedback");
}

function isExtensionInstalledById(config: EngineConfigDetails, extensionTypeId: string): boolean {
  const map = config._enabledExtensions ?? {};
  return Object.values(map).some((entry) => entry?._id === extensionTypeId);
}

export function defaultAiTutorSettings(): AiTutorSettings {
  return {
    enabled: false,
    title: "AI Tutor",
    placeholderText: "Ask AI tutor anything...",
    languageCode: "en",
    documents: [],
  };
}

export async function getAiTutorSettings(courseId: string): Promise<AiTutorSettings> {
  const config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  const defaults = defaultAiTutorSettings();
  const configExtensions = obj(config._extensions);
  const aiTutor = obj(config._aiTutor || configExtensions._aiTutor);
  const sourceDocuments = Array.isArray(aiTutor._sourceDocuments) ? aiTutor._sourceDocuments : [];

  const documents = sourceDocuments
    .map((item: unknown) => {
      const raw = typeof item === "string" ? item : str(obj(item)._document);
      const document = raw.trim();
      if (!document) return null;
      const name = document.split("/").pop() || document;
      return {
        id: Math.random().toString(36).slice(2),
        name,
        document,
      } satisfies AiTutorDocument;
    })
    .filter((item): item is AiTutorDocument => !!item);

  return {
    ...defaults,
    enabled: isExtensionInstalledByName(config, AI_TUTOR_EXTENSION_NAME) && bool(aiTutor._isEnabled, true),
    title: str(aiTutor._aiTutorTitle, defaults.title),
    placeholderText: str(aiTutor._placeHolderText, defaults.placeholderText),
    languageCode: str(aiTutor._languageCode, defaults.languageCode),
    documents,
  };
}

export async function saveAiTutorSettings(courseId: string, settings: AiTutorSettings): Promise<void> {
  let config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
  if (!config?._id) {
    throw new Error("Could not resolve config id for AI Tutor settings");
  }

  const installed = isExtensionInstalledByName(config, AI_TUTOR_EXTENSION_NAME);
  if (settings.enabled && !installed) {
    const ids = await resolveExtensionTypeIdsByNames([AI_TUTOR_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/enable/${courseId}`, { extensions: ids });
      config = await apiClient.get<EngineConfigDetails & AnyRecord>(`/api/content/config/${courseId}`);
      if (!config?._id) {
        throw new Error("Could not resolve config id for AI Tutor settings after enabling extension");
      }
    }
  } else if (!settings.enabled && installed) {
    const ids = await resolveExtensionTypeIdsByNames([AI_TUTOR_EXTENSION_NAME]);
    if (ids.length) {
      await apiClient.post(`/api/extension/disable/${courseId}`, { extensions: ids });
    }
    return;
  }

  if (!isExtensionInstalledByName(config, AI_TUTOR_EXTENSION_NAME)) return;

  const configExtensions = obj(config._extensions);
  const existingAiTutor = obj(config._aiTutor || configExtensions._aiTutor);
  const sourceDocuments = settings.documents
    .map((doc) => str(doc.document).trim())
    .filter((doc) => doc.length > 0)
    .map((doc) => ({ _document: doc }));

  const aiTutor = {
    ...existingAiTutor,
    _isEnabled: settings.enabled,
    _aiTutorTitle: settings.title,
    _placeHolderText: settings.placeholderText,
    _languageCode: settings.languageCode,
    _sourceDocuments: sourceDocuments,
  };

  await apiClient.patch(`/api/content/config/${config._id}`, {
    _id: config._id,
    _courseId: courseId,
    _aiTutor: aiTutor,
    _extensions: {
      ...configExtensions,
      _aiTutor: aiTutor,
    },
  });
}