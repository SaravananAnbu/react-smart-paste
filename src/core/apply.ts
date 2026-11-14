import { groupControls, type Control } from "./fields";
import type { FieldValue, SmartPasteValues } from "./types";

/**
 * Sets a value the way a person typing would, so React (and other frameworks that track
 * input state) notice: write through the native setter, then fire `input` and `change`.
 */
function setText(el: Control, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setChecked(el: HTMLInputElement, checked: boolean): void {
  if (el.checked === checked) return;
  // A click toggles a checkbox and selects a radio, firing the same events as a real click.
  if (checked || el.type === "checkbox") {
    el.click();
    return;
  }
  // Clearing a radio (only happens on undo): there is no click that does it.
  el.checked = false;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyOne(controls: Control[], value: FieldValue): void {
  const first = controls[0];
  if (!first) return;

  if (first instanceof HTMLSelectElement && first.multiple) {
    const wanted = new Set(Array.isArray(value) ? value : [String(value)]);
    for (const option of Array.from(first.options)) option.selected = wanted.has(option.value);
    first.dispatchEvent(new Event("input", { bubbles: true }));
    first.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if (first instanceof HTMLInputElement && first.type === "radio") {
    for (const el of controls) setChecked(el as HTMLInputElement, el.value === value);
    return;
  }

  if (first instanceof HTMLInputElement && first.type === "checkbox") {
    if (typeof value === "boolean") {
      setChecked(first, value);
      return;
    }
    const wanted = new Set(Array.isArray(value) ? value : [value]);
    for (const el of controls) setChecked(el as HTMLInputElement, wanted.has(el.value));
    return;
  }

  setText(first, Array.isArray(value) ? value.join(", ") : String(value));
}

/** Writes values into the form. Names that do not match a fillable field are ignored. */
export function applyValues(form: HTMLFormElement, values: SmartPasteValues): void {
  const groups = groupControls(form);
  for (const [name, value] of Object.entries(values)) {
    const controls = groups.get(name);
    if (controls) applyOne(controls, value);
  }
}
