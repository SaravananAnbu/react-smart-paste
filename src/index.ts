export { SmartPasteButton, type SmartPasteButtonProps } from "./SmartPasteButton";
export {
  useSmartPaste,
  type SmartPasteStatus,
  type UseSmartPasteOptions,
  type UseSmartPasteResult,
} from "./useSmartPaste";
export { readFields, type ReadFieldsOptions } from "./core/fields";
export { applyValues } from "./core/apply";
export { parseSmartPasteResponse } from "./core/parse";
export { SMART_PASTE_SYSTEM_PROMPT, buildSmartPastePrompt } from "./core/prompt";
export { SmartPasteError } from "./core/types";
export type {
  FieldKind,
  FieldOption,
  FieldValue,
  SmartPasteChange,
  SmartPasteComplete,
  SmartPasteErrorCode,
  SmartPasteField,
  SmartPasteRequest,
  SmartPasteResult,
  SmartPasteValues,
} from "./core/types";
