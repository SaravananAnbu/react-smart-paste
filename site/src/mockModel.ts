import type { SmartPasteComplete } from "react-smart-paste";

/**
 * A stand-in for a real model so this page runs with no API key and sends nothing anywhere.
 * It is plain pattern matching and only understands text shaped like the samples on the page.
 * A real app's `complete` calls its own backend instead.
 */
export const mockModel: SmartPasteComplete = async ({ text, fields, signal }) => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (signal.aborted) return "{}";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const found: Record<string, unknown> = {};
  const set = (name: string, value: string | boolean | undefined) => {
    const tidy = typeof value === "string" ? value.trim().replace(/[.,;]+$/, "") : value;
    if (tidy !== undefined && tidy !== "" && fields.some((field) => field.name === name)) found[name] = tidy;
  };
  const labelled = (keys: string) => new RegExp(`^(?:${keys})\\s*:\\s*(.+)$`, "im").exec(text)?.[1];

  const opener = /(?:this is|my name is|i am|i'm)\s+/i.exec(text);
  const intro = opener
    ? /^[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)+/.exec(text.slice(opener.index + opener[0].length))?.[0]
    : undefined;
  const firstLine = lines[0] && /^[A-Z][\w'-]+(\s+[A-Z][\w'-]+){1,3}$/.test(lines[0]) ? lines[0] : undefined;
  const name = labelled("name|full name") ?? intro ?? firstLine;
  if (name) {
    const [first, ...rest] = name.trim().split(/\s+/);
    set("firstName", first);
    set("lastName", rest.join(" "));
  }

  const role = /^(.+?)\s+at\s+(.+)$/i.exec(firstLine ? (lines[1] ?? "") : "");
  set("jobTitle", labelled("title|role|position") ?? role?.[1]);
  set("company", labelled("company|organisation|organization") ?? role?.[2] ?? /\bfrom\s+([A-Z][\w&' -]*?)(?=[.,\n]|$)/m.exec(text)?.[1]);
  set("email", /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text)?.[0]);
  set("phone", /\+?\d[\d\s().-]{7,}\d/.exec(text)?.[0]);
  set("website", labelled("web|website|site|url") ?? /\b(?:https?:\/\/|www\.)\S+/i.exec(text)?.[0]);
  for (const option of fields.find((field) => field.name === "country")?.options ?? []) {
    if (new RegExp(`\\b${option.label}\\b`, "i").test(text)) set("country", option.value);
  }
  if (/prefers?\s+(?:a\s+)?(?:phone|call)|call me/i.test(text)) set("contactBy", "phone");
  else if (/prefers?\s+email|email me/i.test(text)) set("contactBy", "email");
  if (/newsletter|subscribe/i.test(text)) set("newsletter", true);
  set("notes", labelled("note|notes|ps|p\\.s\\."));

  return JSON.stringify(found);
};
