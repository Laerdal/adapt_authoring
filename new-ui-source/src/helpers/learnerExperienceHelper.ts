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