import { apiClient } from "../api/client";

type AnyRecord = Record<string, unknown>;

interface EngineConfigDetails {
  _enabledExtensions?: Record<string, { _id: string; name: string; version?: string; targetAttribute?: string }>;
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

const LEARNER_NOTES_EXTENSION_NAME = "adapt-courseNotes";
const LEARNER_SEARCH_EXTENSION_NAME = "adapt-search";

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
  return Object.values(map).some((entry) => normalizePluginName(entry?.name ?? "") === target);
}

async function resolveExtensionTypeIdsByNames(extensionNames: string[]): Promise<string[]> {
  if (!extensionNames.length) return [];
  const rows = await apiClient.get<{ _id: string; name?: string }[]>("/api/extensiontype");
  const byName = new Map<string, string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?._id || !row?.name) continue;
    byName.set(normalizePluginName(row.name), row._id);
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