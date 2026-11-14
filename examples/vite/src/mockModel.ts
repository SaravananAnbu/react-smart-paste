import type { SmartPasteComplete } from "react-smart-paste";

/**
 * A stand-in for a real model so the example runs with no API key. It is plain pattern
 * matching and only understands text shaped like the sample on the page.
 *
 * In a real app, `complete` calls your backend instead:
 *
 *   const complete: SmartPasteComplete = ({ text, fields, signal }) =>
 *     fetch("/api/smart-paste", { method: "POST", body: JSON.stringify({ text, fields }), signal });
 */
export const mockModel: SmartPasteComplete = async ({ text, fields, signal }) => {
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (signal.aborted) return "{}";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const found: Record<string, unknown> = {};
  const has = (name: string) => fields.some((field) => field.name === name);
  const set = (name: string, value: unknown) => {
    if (value !== undefined && value !== "" && has(name)) found[name] = value;
  };

  const [first, ...rest] = (lines[0] ?? "").split(/\s+/);
  if (lines[0] && /^[A-Za-z .'-]+$/.test(lines[0])) {
    set("firstName", first);
    set("lastName", rest.join(" "));
  }
  const role = /^(.+?)\s+(?:at|@)\s+(.+)$/i.exec(lines[1] ?? "");
  set("jobTitle", role?.[1]);
  set("company", role?.[2]);
  set("email", /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text)?.[0]);
  set("phone", /\+?\d[\d\s().-]{7,}\d/.exec(text)?.[0]);
  set("website", /\b(?:https?:\/\/|www\.)\S+/i.exec(text)?.[0]);
  for (const option of fields.find((field) => field.name === "country")?.options ?? []) {
    if (new RegExp(`\\b${option.label}\\b`, "i").test(text)) set("country", option.value);
  }
  if (/prefer(s|red)?\b.*\bphone|call me/i.test(text)) set("contactBy", "phone");
  else if (/prefer(s|red)?\b.*\bemail|email me/i.test(text)) set("contactBy", "email");
  if (/newsletter|subscribe/i.test(text)) set("newsletter", true);
  set("notes", /(?:note|ps|p\.s\.)[:,]?\s*(.+)$/im.exec(text)?.[1]);

  return JSON.stringify(found);
};
