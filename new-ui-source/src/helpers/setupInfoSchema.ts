import {
  findAppliedPluginSchemaFields,
  getExtensionTypeSchemaByName,
  getMenuSettingsSchemaByLevel,
  getMergedContentSchema,
  getThemeSettingsSchemaByLevel,
  type ExtensionSchemaLevel,
} from "../api/adaptAuthoring";

export type SetupSchemaNode = Record<string, unknown>;

function asRecord(value: unknown): SetupSchemaNode {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SetupSchemaNode)
    : {};
}

export function getSchemaText(schema: unknown, key: string): string | undefined {
  const value = asRecord(schema)[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  return undefined;
}

export function getSchemaHint(schema: unknown): string | undefined {
  return getSchemaText(schema, "help")
    ?? getSchemaText(schema, "helpText")
    ?? getSchemaText(schema, "helptext");
}

export function getSchemaLabel(schema: unknown, fallback: string): string {
  return getSchemaText(schema, "title")
    ?? getSchemaText(schema, "legend")
    ?? getSchemaText(schema, "name")
    ?? fallback;
}

export function getSchemaNode(schema: unknown, ...path: string[]): SetupSchemaNode | undefined {
  let current = asRecord(schema);
  if (!Object.keys(current).length) return undefined;

  for (const segment of path) {
    const direct = asRecord(current[segment]);
    if (Object.keys(direct).length) {
      current = direct;
      continue;
    }

    const props = asRecord(current.properties);
    const propValue = asRecord(props[segment]);
    if (Object.keys(propValue).length) {
      current = propValue;
      continue;
    }

    const itemsProps = asRecord(asRecord(current.items).properties);
    const itemValue = asRecord(itemsProps[segment]);
    if (Object.keys(itemValue).length) {
      current = itemValue;
      continue;
    }

    return undefined;
  }

  return current;
}

export async function getCourseRootSchema(): Promise<SetupSchemaNode | null> {
  return getMergedContentSchema("course");
}

export async function getConfigRootSchema(): Promise<SetupSchemaNode | null> {
  return getMergedContentSchema("config");
}

export async function getAppliedCourseMenuSettingsSchema(courseMenu: string): Promise<SetupSchemaNode | null> {
  const schemasByLevel = await getMenuSettingsSchemaByLevel();
  const fields = findAppliedPluginSchemaFields(schemasByLevel.course, courseMenu);
  return fields;
}

export async function getAppliedCourseThemeSettingsSchema(courseTheme: string): Promise<SetupSchemaNode | null> {
  const schemasByLevel = await getThemeSettingsSchemaByLevel();
  const fields = findAppliedPluginSchemaFields(schemasByLevel.course, courseTheme);
  return fields;
}

export async function getExtensionSchema(extensionName: string): Promise<SetupSchemaNode | null> {
  return getExtensionTypeSchemaByName(extensionName);
}

export async function getAppliedPluginSettingsSchema(
  type: "menu" | "theme",
  level: ExtensionSchemaLevel,
  appliedPluginName: string,
): Promise<SetupSchemaNode | null> {
  const schemasByLevel = type === "menu"
    ? await getMenuSettingsSchemaByLevel()
    : await getThemeSettingsSchemaByLevel();
  const fields = findAppliedPluginSchemaFields(schemasByLevel[level], appliedPluginName);
  return fields;
}