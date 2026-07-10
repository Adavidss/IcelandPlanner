// Attraction-category display metadata shared by cards, map markers and filters.

export const CATEGORY_META: Record<string, { label: string; color: string; glyph: string }> = {
  waterfall: { label: "Waterfall", color: "#38bdf8", glyph: "≋" },
  glacier: { label: "Glacier", color: "#a5f3fc", glyph: "◆" },
  glacier_lagoon: { label: "Glacier lagoon", color: "#67e8f9", glyph: "◈" },
  hot_spring: { label: "Hot spring / bath", color: "#f59e0b", glyph: "♨" },
  geothermal: { label: "Geothermal", color: "#fb923c", glyph: "✸" },
  beach: { label: "Beach", color: "#94a3b8", glyph: "~" },
  canyon: { label: "Canyon", color: "#c084fc", glyph: "∨" },
  crater: { label: "Crater", color: "#f87171", glyph: "◎" },
  lava_field: { label: "Lava field", color: "#ef4444", glyph: "▲" },
  cave: { label: "Cave", color: "#a78bfa", glyph: "∩" },
  museum: { label: "Museum", color: "#f472b6", glyph: "◫" },
  church: { label: "Church", color: "#e4e4e7", glyph: "†" },
  viewpoint: { label: "Viewpoint", color: "#34d399", glyph: "▲" },
  town: { label: "Town", color: "#facc15", glyph: "⌂" },
  wildlife: { label: "Wildlife", color: "#4ade80", glyph: "❋" },
  pool: { label: "Pool", color: "#22d3ee", glyph: "≈" },
  other: { label: "Place", color: "#9ca3af", glyph: "●" },
};

export const POI_KIND_META: Record<string, { label: string; color: string }> = {
  food: { label: "Food & drink", color: "#fb7185" },
  fuel: { label: "Fuel", color: "#e11d48" },
  pool: { label: "Pools", color: "#22d3ee" },
  grocery: { label: "Groceries", color: "#facc15" },
  stay: { label: "Places to stay", color: "#818cf8" },
};
