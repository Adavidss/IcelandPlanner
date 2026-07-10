// SunCalc wrapper for Iceland's extreme daylight. Iceland runs UTC year-round,
// so all display times use Atlantic/Reykjavik regardless of viewer timezone.
// Mainland Iceland sits below the Arctic Circle → sunrise/sunset exist every
// day, but SunCalc can still return Invalid Date near solstices at the
// northern tips — handled as midnight-sun / polar-twilight copy.

import SunCalc from "suncalc";

export const REYKJAVIK = { lat: 64.1466, lng: -21.9426 };

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Atlantic/Reykjavik",
});

export interface Daylight {
  sunrise: string | null; // "05:12" Iceland time, null = doesn't happen
  sunset: string | null;
  dayLengthMin: number | null;
  dayLengthLabel: string;
  goldenMorning: string | null;
  goldenEvening: string | null;
  /** "midnight-sun" | "polar-twilight" | "normal" */
  edge: "midnight-sun" | "polar-twilight" | "normal";
  /** Dark window (roughly aurora-viewable), e.g. "21:30 – 05:40", null in bright months. */
  darkWindow: string | null;
}

const valid = (d: Date | undefined): d is Date => !!d && !Number.isNaN(d.getTime());

export function daylightFor(date: Date, lat = REYKJAVIK.lat, lng = REYKJAVIK.lng): Daylight {
  const t = SunCalc.getTimes(date, lat, lng);
  const sunrise = valid(t.sunrise) ? t.sunrise : null;
  const sunset = valid(t.sunset) ? t.sunset : null;

  let edge: Daylight["edge"] = "normal";
  if (!sunrise || !sunset) {
    // Which extreme? Check sun altitude at solar noon.
    const noonAlt = SunCalc.getPosition(valid(t.solarNoon) ? t.solarNoon : date, lat, lng).altitude;
    edge = noonAlt > 0 ? "midnight-sun" : "polar-twilight";
  }

  const dayLengthMin =
    sunrise && sunset ? Math.round((sunset.getTime() - sunrise.getTime()) / 60_000) : null;

  const dayLengthLabel =
    dayLengthMin !== null
      ? `${Math.floor(dayLengthMin / 60)} h ${String(dayLengthMin % 60).padStart(2, "0")} m`
      : edge === "midnight-sun"
        ? "Sun barely sets"
        : "Polar twilight — a few dim hours";

  // Dark window for aurora: nauticalDusk → nauticalDawn when they exist.
  let darkWindow: string | null = null;
  if (valid(t.nauticalDusk) && valid(t.nauticalDawn)) {
    darkWindow = `${timeFmt.format(t.nauticalDusk)} – ${timeFmt.format(t.nauticalDawn)}`;
  }

  return {
    sunrise: sunrise ? timeFmt.format(sunrise) : null,
    sunset: sunset ? timeFmt.format(sunset) : null,
    dayLengthMin,
    dayLengthLabel,
    goldenMorning: valid(t.goldenHourEnd) ? timeFmt.format(t.goldenHourEnd) : null,
    goldenEvening: valid(t.goldenHour) ? timeFmt.format(t.goldenHour) : null,
    edge,
    darkWindow,
  };
}

// ---- Moon (matters as much as Kp: a full moon washes out faint aurora) ------

const PHASE_NAMES = [
  "New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
  "Full moon", "Waning gibbous", "Last quarter", "Waning crescent",
];

export interface MoonInfo {
  /** 0 (new) – 1 (full). */
  fraction: number;
  phaseName: string;
  rise: string | null; // Iceland time, null = doesn't rise/set today
  set: string | null;
  alwaysUp: boolean;
  /** Bright enough to wash out faint displays. */
  bright: boolean;
}

export function moonFor(date: Date, lat = REYKJAVIK.lat, lng = REYKJAVIK.lng): MoonInfo {
  const ill = SunCalc.getMoonIllumination(date);
  const times = SunCalc.getMoonTimes(date, lat, lng);
  const phaseIdx = Math.round(ill.phase * 8) % 8;
  return {
    fraction: ill.fraction,
    phaseName: PHASE_NAMES[phaseIdx],
    rise: valid(times.rise) ? timeFmt.format(times.rise) : null,
    set: valid(times.set) ? timeFmt.format(times.set) : null,
    alwaysUp: !!times.alwaysUp,
    bright: ill.fraction > 0.65,
  };
}
