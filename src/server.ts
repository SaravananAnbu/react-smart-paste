// Server-safe entry: no React and no "use client" marker, so it can be imported from
// a Next.js route handler, a server action or any Node backend.
export { SMART_PASTE_SYSTEM_PROMPT, buildSmartPastePrompt } from "./core/prompt";
export { parseSmartPasteResponse } from "./core/parse";
export type { FieldKind, FieldOption, FieldValue, SmartPasteField, SmartPasteValues } from "./core/types";
