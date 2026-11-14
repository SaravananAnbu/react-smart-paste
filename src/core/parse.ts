import { SmartPasteError, type FieldValue, type SmartPasteField, type SmartPasteValues } from "./types";

/** Pulls the JSON object out of a model reply, tolerating a code fence or stray text around it. */
function extractObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SmartPasteError("response", "The model did not return any field values.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new SmartPasteError("response", "The model's reply could not be read.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SmartPasteError("response", "The model's reply could not be read.");
  }
  return parsed as Record<string, unknown>;
}

const asText = (value: unknown): string | null =>
  typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : null;

function realDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const realTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

function matchOption(value: unknown, field: SmartPasteField): string | null {
  const text = asText(value)?.trim();
  if (!text || !field.options) return null;
  const lower = text.toLowerCase();
  const found =
    field.options.find((option) => option.value === text) ??
    field.options.find((option) => option.value.toLowerCase() === lower) ??
    field.options.find((option) => option.label.toLowerCase() === lower);
  return found?.value ?? null;
}

/** Checks one value against its field. Returns null when it does not fit, and the value is then dropped. */
function coerce(value: unknown, field: SmartPasteField): FieldValue | null {
  if (value === null || value === undefined) return null;

  switch (field.kind) {
    case "boolean": {
      if (typeof value === "boolean") return value;
      const text = asText(value)?.trim().toLowerCase();
      if (text === "true" || text === "yes") return true;
      if (text === "false" || text === "no") return false;
      return null;
    }
    case "choice":
      return matchOption(value, field);
    case "multichoice": {
      const list = Array.isArray(value) ? value : [value];
      const matched = list.map((item) => matchOption(item, field)).filter((item): item is string => item !== null);
      const unique = Array.from(new Set(matched));
      return unique.length ? unique : null;
    }
    case "number": {
      if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
      const text = asText(value)?.replace(/[^0-9.\-]/g, "") ?? "";
      return /^-?\d+(\.\d+)?$/.test(text) ? text : null;
    }
    case "date": {
      const text = asText(value)?.trim() ?? "";
      return realDate(text) ? text : null;
    }
    case "time": {
      const text = asText(value)?.trim() ?? "";
      return realTime(text) ? text : null;
    }
    case "datetime": {
      const text = asText(value)?.trim() ?? "";
      const [date, time] = text.split("T");
      return date && time && realDate(date) && realTime(time.slice(0, 5)) ? `${date}T${time.slice(0, 5)}` : null;
    }
    default: {
      let text = asText(value);
      if (text === null) return null;
      // Single-line inputs cannot hold line breaks; a textarea keeps them.
      text = field.kind === "longtext" ? text.replace(/\r\n?/g, "\n").trim() : text.replace(/\s+/g, " ").trim();
      if (!text) return null;
      if (field.kind === "email" && !/^[^\s@]+@[^\s@]+$/.test(text)) return null;
      if (field.kind === "url") {
        if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
        if (!/^https?:\/\/[^\s/]+/i.test(text)) return null;
      }
      return field.maxLength ? text.slice(0, field.maxLength) : text;
    }
  }
}

/**
 * Turns a model reply into safe field values. Anything that is not one of the given fields,
 * or does not fit its field's type or options, is dropped rather than applied.
 */
export function parseSmartPasteResponse(raw: string | Record<string, unknown>, fields: SmartPasteField[]): SmartPasteValues {
  const object = typeof raw === "string" ? extractObject(raw) : raw;
  const values: SmartPasteValues = {};
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(object, field.name)) continue;
    const value = coerce(object[field.name], field);
    if (value !== null) values[field.name] = value;
  }
  return values;
}
