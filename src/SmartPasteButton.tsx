import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import type { SmartPasteChange, SmartPasteComplete, SmartPasteError } from "./core/types";
import { useSmartPaste } from "./useSmartPaste";

export interface SmartPasteButtonProps {
  /** Sends the pasted text and the field list to a model, normally through your own backend. */
  complete: SmartPasteComplete;
  /** The form to fill. Defaults to the `<form>` the button is inside. */
  form?: RefObject<HTMLFormElement | null>;
  /** `"empty"` (default) fills blank fields only. `"all"` may replace existing values. */
  overwrite?: "empty" | "all";
  /** Show the proposed changes for approval before filling. Default true. */
  review?: boolean;
  /** Longest pasted text that will be sent, in characters. Default 20000. */
  maxLength?: number;
  /** Button text. Default "Smart paste". */
  children?: ReactNode;
  /** `"auto"` (default) follows the OS setting. */
  theme?: "light" | "dark" | "auto";
  /** Which side of the button the panel lines up with. Default "start". */
  align?: "start" | "end";
  disabled?: boolean;
  className?: string;
  onApply?: (changes: SmartPasteChange[]) => void;
  onError?: (error: SmartPasteError) => void;
}

const Icon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
    <path d="M16 4h2a2 2 0 0 1 2 2v4" />
    <path d="M17 13l1.2 2.8L21 17l-2.8 1.2L17 21l-1.2-2.8L13 17l2.8-1.2z" />
  </svg>
);

export function SmartPasteButton(props: SmartPasteButtonProps) {
  const { children = "Smart paste", theme = "auto", align = "start", className } = props;
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const smart = useSmartPaste({
    form: () => props.form?.current ?? root.current?.closest("form"),
    complete: props.complete,
    overwrite: props.overwrite,
    review: props.review,
    maxLength: props.maxLength,
    onApply: props.onApply,
    onError: props.onError,
  });
  const { status, changes, error } = smart;

  // Fields the user unticked in the review list. Everything else is filled.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const picked = changes.map((change) => change.name).filter((name) => !skipped.includes(name));

  const open = status !== "idle" && !dismissed;

  // Move focus into the panel when it opens or changes state, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [open, status]);

  const close = () => {
    if (status === "applied") setDismissed(true);
    else smart.discard();
    root.current?.querySelector<HTMLElement>(".rsp-button")?.focus();
  };

  const start = (text?: string) => {
    setDismissed(false);
    setManual("");
    setSkipped([]);
    void smart.paste(text);
  };

  const toggle = (name: string) =>
    setSkipped((names) => (names.includes(name) ? names.filter((n) => n !== name) : [...names, name]));

  const needsManual = status === "error" && (error?.code === "clipboard" || error?.code === "empty");

  return (
    <span
      ref={root}
      className={["rsp", className].filter(Boolean).join(" ")}
      data-theme={theme === "auto" ? undefined : theme}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        className="rsp-button"
        disabled={props.disabled || status === "working"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => start()}
      >
        <Icon />
        {children}
      </button>

      {open && (
        <div ref={panel} className="rsp-panel" data-align={align} role="dialog" aria-labelledby={titleId}>
          {status === "working" && (
            <>
              <p id={titleId} className="rsp-title" role="status">
                <span className="rsp-spinner" aria-hidden="true" />
                Reading your text…
              </p>
              <div className="rsp-actions">
                <button type="button" className="rsp-ghost" data-autofocus="" onClick={smart.cancel}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {status === "review" && (
            <>
              <p id={titleId} className="rsp-title">
                Fill {changes.length === 1 ? "this field" : `these ${changes.length} fields`}?
              </p>
              <ul className="rsp-changes">
                {changes.map((change) => (
                  <li key={change.name}>
                    <label>
                      <input type="checkbox" checked={picked.includes(change.name)} onChange={() => toggle(change.name)} />
                      <span className="rsp-change">
                        <span className="rsp-label">{change.label}</span>
                        <span className="rsp-value">
                          {change.from && <s>{change.from}</s>}
                          {change.to || "(cleared)"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="rsp-actions">
                <button
                  type="button"
                  className="rsp-primary"
                  data-autofocus=""
                  disabled={!picked.length}
                  onClick={() => smart.accept(picked)}
                >
                  Fill {picked.length === changes.length ? "all" : picked.length}
                </button>
                <button type="button" className="rsp-ghost" onClick={close}>
                  Discard
                </button>
              </div>
            </>
          )}

          {status === "applied" && (
            <>
              <p id={titleId} className="rsp-title" role="status">
                Filled {changes.length} {changes.length === 1 ? "field" : "fields"}.
              </p>
              <div className="rsp-actions">
                {smart.canUndo && (
                  <button type="button" className="rsp-ghost" onClick={smart.undo}>
                    Undo
                  </button>
                )}
                <button type="button" className="rsp-ghost" data-autofocus="" onClick={close}>
                  Close
                </button>
              </div>
            </>
          )}

          {status === "nothing" && (
            <>
              <p id={titleId} className="rsp-title" role="status">
                Nothing in that text matched this form.
              </p>
              <div className="rsp-actions">
                <button type="button" className="rsp-ghost" data-autofocus="" onClick={close}>
                  Close
                </button>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              {/* A blocked clipboard is expected in some browsers, so it is not styled as a failure. */}
              <p id={titleId} className="rsp-title" role="alert" data-tone={needsManual ? undefined : "danger"}>
                {error?.message}
              </p>
              {needsManual && (
                <textarea
                  className="rsp-manual"
                  data-autofocus=""
                  rows={4}
                  aria-label="Text to fill the form from"
                  placeholder="Paste your text here"
                  value={manual}
                  onChange={(event) => setManual(event.target.value)}
                />
              )}
              <div className="rsp-actions">
                {needsManual ? (
                  <button type="button" className="rsp-primary" disabled={!manual.trim()} onClick={() => start(manual)}>
                    Fill form
                  </button>
                ) : (
                  <button type="button" className="rsp-primary" data-autofocus="" onClick={() => start()}>
                    Try again
                  </button>
                )}
                <button type="button" className="rsp-ghost" onClick={close}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
}
