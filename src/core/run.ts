import { displayValue, groupControls, readValue } from "./fields";
import { parseSmartPasteResponse } from "./parse";
import {
  SmartPasteError,
  type SmartPasteChange,
  type SmartPasteComplete,
  type SmartPasteField,
  type SmartPasteValues,
} from "./types";

/** Calls `complete` and turns whatever it returns into validated field values. */
export async function requestValues(
  complete: SmartPasteComplete,
  text: string,
  fields: SmartPasteField[],
  signal: AbortSignal,
): Promise<SmartPasteValues> {
  let result = await complete({ text, fields, signal });
  if (typeof Response !== "undefined" && result instanceof Response) {
    if (!result.ok) throw new SmartPasteError("request", `The request failed (${result.status}).`);
    result = await result.text();
  }
  return parseSmartPasteResponse(result as string | Record<string, unknown>, fields);
}

/** The edits the values would make, skipping any that match what the form already shows. */
export function diffValues(form: HTMLFormElement, fields: SmartPasteField[], values: SmartPasteValues): SmartPasteChange[] {
  const groups = groupControls(form);
  const changes: SmartPasteChange[] = [];
  for (const field of fields) {
    const value = values[field.name];
    const controls = groups.get(field.name);
    if (value === undefined || !controls) continue;
    const current = readValue(controls, field);
    if (JSON.stringify(current) === JSON.stringify(value)) continue;
    changes.push({
      name: field.name,
      label: field.label,
      from: displayValue(current, field),
      to: displayValue(value, field),
      value,
    });
  }
  return changes;
}

/** The current values of the named fields, for undo. */
export function snapshot(form: HTMLFormElement, fields: SmartPasteField[], names: string[]): SmartPasteValues {
  const groups = groupControls(form);
  const saved: SmartPasteValues = {};
  for (const field of fields) {
    const controls = groups.get(field.name);
    if (controls && names.includes(field.name)) saved[field.name] = readValue(controls, field);
  }
  return saved;
}
