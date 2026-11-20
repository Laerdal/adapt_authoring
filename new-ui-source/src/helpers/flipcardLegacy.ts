// Laerdal flipcard: content authored before the configurable sides only has
// `frontImage` (always a graphic) and `backTitle` / `backBody` (always text) on
// each item. The plugin's current schema uses `_sideA` (front) and `_sideB`
// (back), so the Properties panel would show those fields empty for old cards.
//
// This converts legacy items into `_sideA` / `_sideB` when the component is
// loaded into the editor. Nothing is written to the server here: the converted
// values only reach the database when the author saves the component. The
// legacy fields are left untouched.

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

const isSideEmpty = (side: unknown): boolean => {
  if (!isRec(side)) return true;
  const graphic = isRec(side._graphic) ? side._graphic : {};
  return !(graphic.src || side.title || side.body);
};

// The author explicitly chose a type other than the one the legacy fields
// represent (front = graphic, back = text): don't copy legacy data over it.
const switchedAwayFrom = (side: unknown, legacyType: "graphic" | "text"): boolean => {
  const type = isRec(side) ? side._contentType : undefined;
  return (type === "graphic" || type === "text") && type !== legacyType;
};

// Ids of flipcards converted since the last call, so the editor can save them.
const migratedIds = new Set<string>();

export function consumeMigratedFlipcardIds(): string[] {
  const ids = Array.from(migratedIds);
  migratedIds.clear();
  return ids;
}

export function migrateLegacyFlipcardProperties(properties: Rec, componentId?: string): Rec {
  const items = properties._items;
  if (!Array.isArray(items)) return properties;

  let changed = false;
  const nextItems = items.map((raw) => {
    if (!isRec(raw)) return raw;
    const item: Rec = { ...raw };

    if (isRec(item.frontImage) && item.frontImage.src && isSideEmpty(item._sideA) && !switchedAwayFrom(item._sideA, "graphic")) {
      item._sideA = {
        ...(isRec(item._sideA) ? item._sideA : {}),
        _contentType: "graphic",
        _graphic: { ...item.frontImage },
      };
      changed = true;
    }

    if ((item.backTitle || item.backBody) && isSideEmpty(item._sideB) && !switchedAwayFrom(item._sideB, "text")) {
      item._sideB = {
        ...(isRec(item._sideB) ? item._sideB : {}),
        _contentType: "text",
        title: typeof item.backTitle === "string" ? item.backTitle : "",
        body: typeof item.backBody === "string" ? item.backBody : "",
      };
      changed = true;
    }

    return item;
  });

  if (!changed) return properties;
  if (componentId) migratedIds.add(componentId);
  return { ...properties, _items: nextItems };
}
