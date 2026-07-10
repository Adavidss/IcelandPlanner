// Vegagerðin AstandYfirbord codes → stable English enum + map color.
// Codes verified against the live faerd2017_1 feed (2026-07); the feed also
// ships its own English label (AstandLysingEn) which we pass through
// per-segment, so an unmapped new code degrades to `unknown` + feed label,
// never a crash.

const TABLE = {
  GREIDFAERT: { condition: "good", label: "Easily passable", labelIs: "Greiðfært", color: "#22c55e" },
  BLAUTT: { condition: "wet", label: "Wet", labelIs: "Blautt", color: "#38bdf8" },
  HALKUBLETTIR: { condition: "spots", label: "Slippery patches", labelIs: "Hálkublettir", color: "#7dd3fc" },
  HALKA: { condition: "slippery", label: "Slippery", labelIs: "Hálka", color: "#3b82f6" },
  FLUGHALKA: { condition: "very_slippery", label: "Extremely slippery", labelIs: "Flughálka", color: "#1d4ed8" },
  SNJOTHEKJA: { condition: "snow", label: "Snow cover", labelIs: "Snjóþekja", color: "#e5e7eb" },
  KRAPI: { condition: "slush", label: "Slush", labelIs: "Krapi", color: "#a78bfa" },
  THAEFINGSFAERD: { condition: "difficult", label: "Difficult (drifting snow)", labelIs: "Þæfingsfærð", color: "#f97316" },
  THUNGFAERT: { condition: "extremely_difficult", label: "Extremely difficult", labelIs: "Þungfært", color: "#ea580c" },
  OFAERT: { condition: "impassable", label: "Impassable", labelIs: "Ófært", color: "#ef4444" },
  OFAERT_ANNAD: { condition: "impassable", label: "Impassable", labelIs: "Ófært", color: "#ef4444" },
  OFAERT_VEDUR: { condition: "impassable", label: "Impassable (weather)", labelIs: "Ófært vegna veðurs", color: "#ef4444" },
  LOKAD: { condition: "closed", label: "Closed", labelIs: "Lokað", color: "#0f172a" },
  FAERT_FJALLABILUM: { condition: "mountain", label: "Mountain vehicles only", labelIs: "Fært fjallabílum", color: "#c084fc" },
  EKKI_I_THJONUSTU: { condition: "no_service", label: "No winter service", labelIs: "Ekki í þjónustu", color: "#9ca3af" },
  OTHEKKT: { condition: "unknown", label: "Unknown", labelIs: "Óþekkt", color: "#6b7280" },
};

const UNKNOWN = TABLE.OTHEKKT;

/** The legend shipped inside roads.json — enum key → {label, labelIs, color}. */
export function legend() {
  const out = {};
  for (const entry of Object.values(TABLE)) {
    if (!(entry.condition in out)) {
      out[entry.condition] = { label: entry.label, labelIs: entry.labelIs, color: entry.color };
    }
  }
  return out;
}

/** Map a raw AstandYfirbord code; unknown codes are logged by the caller. */
export function mapCondition(code) {
  if (!code) return { ...UNKNOWN, known: false };
  const hit = TABLE[String(code).toUpperCase()];
  return hit ? { ...hit, known: true } : { ...UNKNOWN, known: false };
}
