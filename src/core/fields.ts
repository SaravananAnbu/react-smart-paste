import type { FieldKind, FieldOption, FieldValue, SmartPasteField } from "./types";

export type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const SKIPPED_TYPES = new Set(["hidden", "password", "file", "submit", "reset", "button", "image", "color"]);

// Autofill tokens for secrets and payment details. These are never read, described to the model, or filled.
const SENSITIVE_AUTOCOMPLETE = /(^|\s)(cc-[a-z-]+|current-password|new-password|one-time-code)(\s|$)/;

const INPUT_KINDS: Record<string, FieldKind> = {
  number: "number",
  range: "number",
  date: "date",
  time: "time",
  "datetime-local": "datetime",
  email: "email",
  tel: "tel",
  url: "url",
};

function isControl(el: Element): el is Control {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

function isFillable(el: Control): boolean {
  if (!el.name || el.disabled) return false;
  if (el.closest('[data-smart-paste="off"]')) return false;
  if (SENSITIVE_AUTOCOMPLETE.test(el.getAttribute("autocomplete") ?? "")) return false;
  if (el instanceof HTMLSelectElement) return true;
  if (el.readOnly) return false;
  return !(el instanceof HTMLInputElement && SKIPPED_TYPES.has(el.type));
}

/** Every fillable control in the form, grouped by `name` in document order. */
export function groupControls(form: HTMLFormElement): Map<string, Control[]> {
  const groups = new Map<string, Control[]>();
  for (const el of Array.from(form.elements)) {
    if (!isControl(el) || !isFillable(el)) continue;
    const group = groups.get(el.name);
    if (group) group.push(el);
    else groups.set(el.name, [el]);
  }
  return groups;
}

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

function humanise(name: string): string {
  const words = name
    .replace(/\[\]$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.[\]]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A label's own text, without the text of any control nested inside it (a select's options, for one). */
function labelText(label: HTMLLabelElement | undefined): string {
  if (!label) return "";
  const copy = label.cloneNode(true) as HTMLElement;
  for (const nested of Array.from(copy.querySelectorAll("select, textarea, input, button"))) nested.remove();
  return clean(copy.textContent);
}

function labelOf(el: Control): string {
  const fromLabel = labelText(el.labels?.[0]);
  if (fromLabel) return fromLabel;
  const aria = clean(el.getAttribute("aria-label"));
  if (aria) return aria;
  const ids = el.getAttribute("aria-labelledby");
  if (ids) {
    const text = clean(
      ids
        .split(/\s+/)
        .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "")
        .join(" "),
    );
    if (text) return text;
  }
  return "";
}

/** A radio or checkbox group is named by its fieldset legend, or failing that by its `name`. */
function groupLabel(controls: Control[], name: string): string {
  const first = controls[0];
  const legend = clean(first?.closest("fieldset")?.querySelector("legend")?.textContent);
  if (legend) return legend;
  const group = first?.closest('[role="group"], [role="radiogroup"]');
  const aria = clean(group?.getAttribute("aria-label"));
  return aria || humanise(name);
}

function selectOptions(select: HTMLSelectElement): FieldOption[] {
  return Array.from(select.options)
    .filter((option) => !option.disabled && option.value !== "")
    .map((option) => ({ value: option.value, label: clean(option.textContent) || option.value }));
}

function hintOf(el: Control, label: string): string | undefined {
  const parts: string[] = [];
  const placeholder = clean(el.getAttribute("placeholder"));
  if (placeholder && placeholder !== label) parts.push(`placeholder: ${placeholder}`);
  const autocomplete = clean(el.getAttribute("autocomplete"));
  if (autocomplete && autocomplete !== "on" && autocomplete !== "off") parts.push(`autocomplete: ${autocomplete}`);
  if (el instanceof HTMLInputElement) {
    if (el.min) parts.push(`min: ${el.min}`);
    if (el.max) parts.push(`max: ${el.max}`);
    if (el.type === "month") parts.push("format: YYYY-MM");
    if (el.type === "week") parts.push("format: YYYY-Www");
  }
  return parts.length ? parts.join("; ") : undefined;
}

function describe(name: string, controls: Control[]): SmartPasteField | null {
  const first = controls[0];
  if (!first) return null;

  if (first instanceof HTMLSelectElement) {
    const options = selectOptions(first);
    if (!options.length) return null;
    const label = labelOf(first) || humanise(name);
    return { name, label, kind: first.multiple ? "multichoice" : "choice", options };
  }

  if (first instanceof HTMLInputElement && first.type === "radio") {
    const options = controls.map((el) => ({ value: el.value, label: labelOf(el) || el.value }));
    return { name, label: groupLabel(controls, name), kind: "choice", options };
  }

  if (first instanceof HTMLInputElement && first.type === "checkbox") {
    if (controls.length === 1) return { name, label: labelOf(first) || humanise(name), kind: "boolean" };
    const options = controls.map((el) => ({ value: el.value, label: labelOf(el) || el.value }));
    return { name, label: groupLabel(controls, name), kind: "multichoice", options };
  }

  const label = labelOf(first) || clean(first.getAttribute("placeholder")) || humanise(name);
  const kind: FieldKind =
    first instanceof HTMLTextAreaElement ? "longtext" : (INPUT_KINDS[(first as HTMLInputElement).type] ?? "text");
  const field: SmartPasteField = { name, label, kind };
  const hint = hintOf(first, label);
  if (hint) field.hint = hint;
  if (first.maxLength > 0) field.maxLength = first.maxLength;
  return field;
}

/** The current value of a field, in the same shape the model's answer is validated into. */
export function readValue(controls: Control[], field: SmartPasteField): FieldValue {
  const first = controls[0];
  if (!first) return "";
  if (first instanceof HTMLSelectElement) {
    if (field.kind === "multichoice") {
      return Array.from(first.selectedOptions)
        .map((option) => option.value)
        .filter(Boolean);
    }
    return first.value;
  }
  if (first instanceof HTMLInputElement && first.type === "radio") {
    return controls.find((el) => (el as HTMLInputElement).checked)?.value ?? "";
  }
  if (first instanceof HTMLInputElement && first.type === "checkbox") {
    if (field.kind === "boolean") return first.checked;
    return controls.filter((el) => (el as HTMLInputElement).checked).map((el) => el.value);
  }
  return first.value;
}

export function isBlank(value: FieldValue): boolean {
  if (typeof value === "boolean") return !value;
  return value.length === 0;
}

/** A value as the person filling the form would read it: option labels instead of option values. */
export function displayValue(value: FieldValue, field: SmartPasteField): string {
  const labelFor = (v: string) => field.options?.find((option) => option.value === v)?.label ?? v;
  if (typeof value === "boolean") return value ? "Yes" : "";
  if (Array.isArray(value)) return value.map(labelFor).join(", ");
  return field.options ? labelFor(value) : value;
}

export interface ReadFieldsOptions {
  /** `"empty"` (default) lists only blank fields, so nothing the user typed is replaced. `"all"` lists every field. */
  overwrite?: "empty" | "all";
}

/**
 * Describes the fillable fields of a form. Passwords, files, hidden inputs, payment fields,
 * disabled or read-only controls and anything inside `data-smart-paste="off"` are left out.
 */
export function readFields(form: HTMLFormElement, options: ReadFieldsOptions = {}): SmartPasteField[] {
  const fields: SmartPasteField[] = [];
  for (const [name, controls] of groupControls(form)) {
    const field = describe(name, controls);
    if (!field) continue;
    if (options.overwrite !== "all" && !isBlank(readValue(controls, field))) continue;
    fields.push(field);
  }
  return fields;
}
