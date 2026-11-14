/** What kind of value a form field holds. Drives both the prompt and validation of the model's answer. */
export type FieldKind =
  | "text"
  | "longtext"
  | "number"
  | "date"
  | "time"
  | "datetime"
  | "email"
  | "tel"
  | "url"
  | "boolean"
  | "choice"
  | "multichoice";

export interface FieldOption {
  value: string;
  label: string;
}

/** One fillable field, as described to the model. */
export interface SmartPasteField {
  /** The form control's `name`. */
  name: string;
  /** Human-readable label, taken from the `<label>`, `aria-label`, legend or placeholder. */
  label: string;
  kind: FieldKind;
  /** Allowed values for `choice` and `multichoice` fields. */
  options?: FieldOption[];
  /** Extra context: the placeholder, the `autocomplete` token, numeric limits. */
  hint?: string;
  maxLength?: number;
}

/** A validated value: text for most fields, true/false for a checkbox, a list for multi-select. */
export type FieldValue = string | boolean | string[];

export type SmartPasteValues = Record<string, FieldValue>;

export interface SmartPasteRequest {
  /** The pasted text. */
  text: string;
  /** The fields that may be filled. */
  fields: SmartPasteField[];
  /** Aborted when the user cancels. Pass it to `fetch`. */
  signal: AbortSignal;
}

/**
 * What `complete` may return: the model's raw text, a `Response` whose body is that text,
 * or an already-parsed object of field values.
 */
export type SmartPasteResult = string | Response | Record<string, unknown>;

/** Your function that sends the request to a model, normally through your own backend. */
export type SmartPasteComplete = (request: SmartPasteRequest) => SmartPasteResult | Promise<SmartPasteResult>;

/** One proposed edit to the form. */
export interface SmartPasteChange {
  name: string;
  label: string;
  /** What the field shows now, as display text. Empty when the field is blank. */
  from: string;
  /** What it will show after applying, as display text. */
  to: string;
  value: FieldValue;
}

export type SmartPasteErrorCode = "clipboard" | "no-form" | "no-fields" | "too-long" | "empty" | "request" | "response";

export class SmartPasteError extends Error {
  code: SmartPasteErrorCode;

  constructor(code: SmartPasteErrorCode, message: string) {
    super(message);
    this.name = "SmartPasteError";
    this.code = code;
  }
}
