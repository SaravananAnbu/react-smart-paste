# react-smart-paste

Paste any text and let AI fill your form. A React button and hook that read the form, send the pasted text to your model, show the proposed values, and fill the fields once the user approves. MIT licensed.

- Works on plain HTML forms: no schema to declare, it reads names, labels, types and options from the page
- Review before anything changes, per-field tick boxes, and undo
- Never overwrites what the user already typed (unless you ask it to)
- Passwords, payment fields, files and hidden inputs are never read, sent or filled
- Any model: you pass one function that calls your backend, so no API key reaches the browser
- Fills React-controlled and uncontrolled inputs alike, by setting values the way typing does
- Falls back to a paste box when the browser blocks clipboard access
- Ships with `"use client"`, ESM and CommonJS builds, and TypeScript types

## Install

```bash
npm install react-smart-paste
```

`react` and `react-dom` (18 or newer) are peer dependencies.

## Usage

Put the button inside your form and give it a `complete` function that calls your backend:

```tsx
import { SmartPasteButton, type SmartPasteComplete } from "react-smart-paste";
import "react-smart-paste/styles.css";

const complete: SmartPasteComplete = ({ text, fields, signal }) =>
  fetch("/api/smart-paste", { method: "POST", body: JSON.stringify({ text, fields }), signal });

export function ContactForm() {
  return (
    <form>
      <label>
        Name <input name="name" />
      </label>
      <label>
        Email <input name="email" type="email" />
      </label>
      <label>
        Country
        <select name="country">
          <option value="">Choose…</option>
          <option value="in">India</option>
          <option value="us">United States</option>
        </select>
      </label>

      <SmartPasteButton complete={complete} />
    </form>
  );
}
```

The user copies some text (an email signature, an invoice, a message), presses **Smart paste**, checks the list of proposed values, and presses **Fill all**.

Every control needs a `name`. Good labels give better results: the model sees each field's label, type, options, placeholder and `autocomplete` hint.

## The backend route

`react-smart-paste/server` exports the prompt builder with no React code, so it is safe to import on a server. Send its `system` and `user` messages to any model and return the model's text.

```ts
// app/api/smart-paste/route.ts (Next.js). Set ANTHROPIC_API_KEY in .env.local
import Anthropic from "@anthropic-ai/sdk";
import { buildSmartPastePrompt } from "react-smart-paste/server";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY on the server

export async function POST(req: Request) {
  const { text, fields } = await req.json();
  if (typeof text !== "string" || text.length > 20000 || !Array.isArray(fields)) {
    return new Response("Bad request", { status: 400 });
  }

  const { system, user } = buildSmartPastePrompt({ text, fields });
  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
  });

  const reply = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  return new Response(reply);
}
```

The same shape works with OpenAI, Gemini or a local model: pass `system` and `user`, return the text.

- Keep the API key in a server-only env variable. Variables named `VITE_*` or `NEXT_PUBLIC_*` are copied into the browser bundle and are not secret.
- A route like this lets anyone who can reach it spend your AI budget. Put it behind your app's sign-in and add a rate limit.

`complete` may return a `Response`, the model's text as a string, or an object of field values you parsed yourself.

## Button props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `complete` | `(request) => Response \| string \| object` | required | Sends `{ text, fields, signal }` to your model. |
| `form` | `RefObject<HTMLFormElement>` | the enclosing `<form>` | The form to fill, when the button sits outside it. |
| `overwrite` | `"empty" \| "all"` | `"empty"` | `"empty"` fills blank fields only. `"all"` may replace existing values. |
| `review` | `boolean` | `true` | Show the proposed values for approval. `false` fills straight away. |
| `maxLength` | `number` | `20000` | Longest pasted text that will be sent, in characters. |
| `children` | `ReactNode` | `"Smart paste"` | Button text. |
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` | `"auto"` follows the OS setting. |
| `align` | `"start" \| "end"` | `"start"` | Which side of the button the panel lines up with. |
| `disabled`, `className` | – | – | Passed to the button / wrapper. |
| `onApply` | `(changes) => void` | – | Called after fields are filled. |
| `onError` | `(error) => void` | – | Called when a paste fails. |

## The hook

For your own button and review UI, use `useSmartPaste`:

```tsx
import { useRef } from "react";
import { useSmartPaste } from "react-smart-paste";

function ContactForm() {
  const form = useRef<HTMLFormElement>(null);
  const smart = useSmartPaste({ form, complete });

  return (
    <form ref={form}>
      <input name="email" type="email" />

      <button type="button" onClick={() => smart.paste()}>
        Paste
      </button>

      {smart.status === "review" && (
        <div>
          {smart.changes.map((change) => (
            <p key={change.name}>
              {change.label}: {change.to}
            </p>
          ))}
          <button type="button" onClick={() => smart.accept()}>Fill</button>
          <button type="button" onClick={smart.discard}>Discard</button>
        </div>
      )}
      {smart.status === "error" && <p role="alert">{smart.error?.message}</p>}
    </form>
  );
}
```

| Returned | Description |
| --- | --- |
| `status` | `"idle"`, `"working"`, `"review"`, `"applied"`, `"nothing"` (no match) or `"error"`. |
| `changes` | In `review`, the proposed edits; in `applied`, the edits made. Each has `name`, `label`, `from`, `to`, `value`. |
| `error` | A `SmartPasteError` with a `code`: `clipboard`, `empty`, `too-long`, `no-form`, `no-fields`, `request` or `response`. |
| `paste(text?)` | Fill from `text`, or from the clipboard when called with no argument. |
| `accept(names?)` | Apply the reviewed changes, or only the named fields. |
| `discard()` / `cancel()` | Drop the proposal, or stop a request in progress. |
| `undo()` / `canUndo` | Put back the values the last fill replaced. |

The hook takes the same `complete`, `overwrite`, `review`, `maxLength`, `onApply` and `onError` options as the button. `form` is a ref or a function returning the form element.

Reading the clipboard needs a user gesture and permission, and some browsers refuse it. When that happens `error.code` is `"clipboard"`: show a text box and call `paste(text)` with what the user pastes into it. The button does this for you.

## What is read and what is not

Fields are found through the form's controls. These are always left out, so they are never described to the model and never filled:

- `password`, `file` and `hidden` inputs, and buttons
- fields whose `autocomplete` is a payment token (`cc-number`, `cc-csc`, …), `current-password`, `new-password` or `one-time-code`
- disabled and read-only controls
- anything inside an element with `data-smart-paste="off"`

With the default `overwrite="empty"`, fields that already have a value are left out too. The current values of fields are never sent, only their descriptions.

## Safety and privacy

- **The pasted text goes to your model.** Tell your users, as you would for any AI feature. Nothing is sent until they press the button.
- **The model's answer is validated before it is shown.** Only known field names are accepted, and each value must fit its field: a real date, a listed option, a well-formed email, an `http(s)` URL. Anything else is dropped. Values are set as plain form values, never as HTML.
- **Pasted text is treated as data.** The prompt tells the model not to follow instructions inside it, and the validation above limits what a manipulated answer could do to choosing wrong values for visible fields, which the user reviews before filling.

## Theming

Override any `--rsp-*` variable on `.rsp`:

```css
.rsp {
  --rsp-accent: #7c3aed;
  --rsp-radius: 10px;
}
```

Available variables: `bg`, `fg`, `muted`, `border`, `hover`, `accent`, `on-accent`, `danger`, `radius`, `shadow`, `font`.

## Lower-level helpers

`readFields(form)`, `applyValues(form, values)`, `buildSmartPastePrompt({ text, fields })` and `parseSmartPasteResponse(reply, fields)` are exported for building your own flow.

## Development

```bash
npm install
npm run build      # ESM + CJS + types into dist/
npm test
npm run typecheck
```

`examples/vite` is a demo form that runs without an API key, using a mock model (plain pattern matching, labelled as such on the page). It installs the packed tarball: after changing the library, run `npm run build && npm pack`, reinstall in `examples/vite`, and restart its dev server.

## License

[MIT](./LICENSE)
