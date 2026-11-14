import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { applyValues } from "./core/apply";
import { readFields } from "./core/fields";
import { diffValues, requestValues, snapshot } from "./core/run";
import {
  SmartPasteError,
  type SmartPasteChange,
  type SmartPasteComplete,
  type SmartPasteField,
  type SmartPasteValues,
} from "./core/types";

export type SmartPasteStatus = "idle" | "working" | "review" | "applied" | "nothing" | "error";

export interface UseSmartPasteOptions {
  /** The form to fill: a ref, or a function that returns the form element. */
  form: RefObject<HTMLFormElement | null> | (() => HTMLFormElement | null | undefined);
  /** Sends the pasted text and the field list to a model, normally through your own backend. */
  complete: SmartPasteComplete;
  /**
   * `"empty"` (default) fills blank fields only, so nothing the user typed is replaced.
   * `"all"` may replace existing values.
   */
  overwrite?: "empty" | "all";
  /** Show the proposed changes and wait for `accept()` before touching the form. Default true. */
  review?: boolean;
  /** Longest pasted text that will be sent, in characters. Default 20000. */
  maxLength?: number;
  onApply?: (changes: SmartPasteChange[]) => void;
  onError?: (error: SmartPasteError) => void;
}

export interface UseSmartPasteResult {
  status: SmartPasteStatus;
  /** In `review`: the proposed edits. In `applied`: the edits that were made. */
  changes: SmartPasteChange[];
  error: SmartPasteError | null;
  /** Fill the form from `text`, or from the clipboard when called with no argument. */
  paste: (text?: string) => Promise<void>;
  /** Apply the reviewed changes, or only those with the given field names. */
  accept: (names?: string[]) => void;
  /** Drop the reviewed changes without touching the form. */
  discard: () => void;
  /** Put back the values the last apply replaced. */
  undo: () => void;
  canUndo: boolean;
  /** Stop a request in progress and return to idle. */
  cancel: () => void;
}

const toError = (error: unknown): SmartPasteError =>
  error instanceof SmartPasteError
    ? error
    : new SmartPasteError("request", error instanceof Error && error.message ? error.message : "Something went wrong.");

export function useSmartPaste(options: UseSmartPasteOptions): UseSmartPasteResult {
  const [status, setStatus] = useState<SmartPasteStatus>("idle");
  const [changes, setChanges] = useState<SmartPasteChange[]>([]);
  const [error, setError] = useState<SmartPasteError | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Latest options, so the returned callbacks stay stable between renders.
  const latest = useRef(options);
  latest.current = options;

  const run = useRef<{ id: number; abort?: AbortController }>({ id: 0 });
  const pending = useRef<{ fields: SmartPasteField[]; changes: SmartPasteChange[] } | null>(null);
  const undoState = useRef<{ fields: SmartPasteField[]; values: SmartPasteValues } | null>(null);

  const getForm = useCallback((): HTMLFormElement | null => {
    const { form } = latest.current;
    return (typeof form === "function" ? form() : form.current) ?? null;
  }, []);

  const stop = useCallback(() => {
    run.current.abort?.abort();
    run.current = { id: run.current.id + 1 };
  }, []);

  useEffect(() => stop, [stop]);

  const apply = useCallback(
    (fields: SmartPasteField[], selected: SmartPasteChange[]) => {
      const form = getForm();
      pending.current = null;
      if (!selected.length) {
        setChanges([]);
        setStatus("idle");
        return;
      }
      if (!form) {
        setChanges([]);
        setError(new SmartPasteError("no-form", "No form was found to fill."));
        setStatus("error");
        return;
      }
      const names = selected.map((change) => change.name);
      undoState.current = { fields, values: snapshot(form, fields, names) };
      applyValues(form, Object.fromEntries(selected.map((change) => [change.name, change.value])));
      setChanges(selected);
      setCanUndo(true);
      setStatus("applied");
      latest.current.onApply?.(selected);
    },
    [getForm],
  );

  const paste = useCallback(
    async (input?: string) => {
      stop();
      const id = run.current.id;
      const abort = new AbortController();
      run.current.abort = abort;
      const isCurrent = () => run.current.id === id;

      pending.current = null;
      setError(null);
      setChanges([]);
      setStatus("working");

      try {
        let text = input;
        if (text === undefined) {
          try {
            text = await navigator.clipboard.readText();
          } catch {
            throw new SmartPasteError("clipboard", "The clipboard could not be read. Paste your text in the box instead.");
          }
          if (!isCurrent()) return;
        }
        text = text.trim();
        if (!text) throw new SmartPasteError("empty", "There is no text to read.");
        const limit = latest.current.maxLength ?? 20000;
        if (text.length > limit) {
          throw new SmartPasteError("too-long", `That text is too long (${text.length} characters; the limit is ${limit}).`);
        }

        const form = getForm();
        if (!form) throw new SmartPasteError("no-form", "No form was found to fill.");
        const fields = readFields(form, { overwrite: latest.current.overwrite });
        if (!fields.length) {
          throw new SmartPasteError(
            "no-fields",
            latest.current.overwrite === "all" ? "This form has no fields to fill." : "Every field is already filled in.",
          );
        }

        const values = await requestValues(latest.current.complete, text, fields, abort.signal);
        if (!isCurrent()) return;

        const proposed = diffValues(form, fields, values);
        if (!proposed.length) {
          setStatus("nothing");
        } else if (latest.current.review === false) {
          apply(fields, proposed);
        } else {
          pending.current = { fields, changes: proposed };
          setChanges(proposed);
          setStatus("review");
        }
      } catch (caught) {
        if (!isCurrent()) return;
        const failure = toError(caught);
        setError(failure);
        setStatus("error");
        latest.current.onError?.(failure);
      }
    },
    [apply, getForm, stop],
  );

  const accept = useCallback(
    (names?: string[]) => {
      const current = pending.current;
      if (!current) return;
      apply(current.fields, names ? current.changes.filter((change) => names.includes(change.name)) : current.changes);
    },
    [apply],
  );

  const reset = useCallback(() => {
    stop();
    pending.current = null;
    setChanges([]);
    setError(null);
    setStatus("idle");
  }, [stop]);

  const undo = useCallback(() => {
    const saved = undoState.current;
    const form = getForm();
    if (!saved || !form) return;
    applyValues(form, saved.values);
    undoState.current = null;
    setCanUndo(false);
    setChanges([]);
    setStatus("idle");
  }, [getForm]);

  return { status, changes, error, paste, accept, discard: reset, undo, canUndo, cancel: reset };
}
