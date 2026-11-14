import { useEffect, useRef, useState, type ReactNode } from "react";
import { SmartPasteButton, readFields, type SmartPasteField } from "react-smart-paste";
import { mockModel } from "./mockModel";

const NPM_URL = "https://www.npmjs.com/package/react-smart-paste";
const GITHUB_URL = "https://github.com/SaravananAnbu/react-smart-paste";

const SAMPLES = {
  "Email signature": `Ada Lovelace
Chief Analyst at Analytical Engines Ltd
ada@analytical-engines.example
+44 20 7946 0958
www.analytical-engines.example
London, United Kingdom

Prefers email. Please add me to the newsletter.
Note: met at the Babbage conference, wants a demo next week.`,
  "Chat message": `Hi! This is Grace Hopper from Compiler Works. You can reach me at grace@compilerworks.example, or call me on +1 (212) 555-0142, whichever is easier.

I'm based in the United States. Our site is https://compilerworks.example and yes, please subscribe me to your updates.`,
  "Contact card": `Name: Katherine Johnson
Title: Research Mathematician
Company: Langley Research
Email: katherine@langley.example
Tel: +1 757 555 0199
Web: langley.example
Country: United States
Note: prefers email, follow up after the launch review.`,
} as const;

type SampleName = keyof typeof SAMPLES;

const STEPS = [
  {
    title: "Copy any text",
    body: "An email signature, a message, an invoice, a web page. No special format is needed.",
  },
  {
    title: "Review the match",
    body: "The form is read, the text is matched to its fields, and each proposed value is listed with a tick box.",
  },
  {
    title: "Fill, or undo",
    body: "Approved values go into the form as if typed. One click on Undo puts the old values back.",
  },
];

const FEATURES = [
  {
    title: "No schema to write",
    body: "It reads names, labels, types, options and placeholders from the form on the page. Add the button and it works.",
  },
  {
    title: "Review before filling",
    body: "Nothing changes until the user approves. They can untick single fields, and undo the whole fill.",
  },
  {
    title: "Typed input is safe",
    body: "By default only blank fields are filled, so whatever the user already entered stays as it is.",
  },
  {
    title: "Any model, your backend",
    body: "You pass one function that calls your own route. Use Claude, OpenAI, Gemini or a local model, with the key kept on your server.",
  },
  {
    title: "Every kind of field",
    body: "Text, numbers, dates, dropdowns, radio buttons, checkboxes and multi-selects, including React-controlled inputs.",
  },
  {
    title: "Works when the clipboard is blocked",
    body: "If the browser refuses clipboard access, the panel offers a box to paste into instead.",
  },
];

const SNIPPETS = {
  Button: `import { SmartPasteButton, type SmartPasteComplete } from "react-smart-paste";
import "react-smart-paste/styles.css";

const complete: SmartPasteComplete = ({ text, fields, signal }) =>
  fetch("/api/smart-paste", {
    method: "POST",
    body: JSON.stringify({ text, fields }),
    signal,
  });

export function ContactForm() {
  return (
    <form>
      <label>Name <input name="name" /></label>
      <label>Email <input name="email" type="email" /></label>

      <SmartPasteButton complete={complete} />
    </form>
  );
}`,
  Hook: `import { useRef } from "react";
import { useSmartPaste } from "react-smart-paste";

function ContactForm() {
  const form = useRef<HTMLFormElement>(null);
  const smart = useSmartPaste({ form, complete });

  return (
    <form ref={form}>
      <input name="email" type="email" />

      <button type="button" onClick={() => smart.paste()}>Paste</button>

      {smart.status === "review" && (
        <div>
          {smart.changes.map((change) => (
            <p key={change.name}>{change.label}: {change.to}</p>
          ))}
          <button type="button" onClick={() => smart.accept()}>Fill</button>
          <button type="button" onClick={smart.discard}>Discard</button>
        </div>
      )}
    </form>
  );
}`,
  "Server route": `// app/api/smart-paste/route.ts (Next.js)
// Set ANTHROPIC_API_KEY in .env.local
import Anthropic from "@anthropic-ai/sdk";
import { buildSmartPastePrompt } from "react-smart-paste/server";

const client = new Anthropic();

export async function POST(req: Request) {
  const { text, fields } = await req.json();
  const { system, user } = buildSmartPastePrompt({ text, fields });

  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
  });

  const reply = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return new Response(reply);
}`,
} as const;

const PROPS: [string, string, string][] = [
  ["complete", "(request) => Response | string | object", "Sends the pasted text and the field list to your model. Required."],
  ["form", "RefObject<HTMLFormElement>", "The form to fill, when the button sits outside it. Defaults to the enclosing form."],
  ["overwrite", '"empty" | "all"', 'Fill blank fields only (default), or allow replacing existing values.'],
  ["review", "boolean", "Show the proposed values for approval before filling. On by default."],
  ["maxLength", "number", "Longest pasted text that will be sent. 20,000 characters by default."],
  ["theme", '"light" | "dark" | "auto"', "Panel and button colours. Follows the OS setting by default."],
  ["align", '"start" | "end"', "Which side of the button the panel lines up with."],
  ["onApply / onError", "(changes) => void / (error) => void", "Called after a fill, or when a paste fails."],
];

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Section(props: { id: string; eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={props.id} className="section">
      <div className="wrap">
        <p className="eyebrow">{props.eyebrow}</p>
        <h2>{props.title}</h2>
        {props.lead && <p className="lead">{props.lead}</p>}
        {props.children}
      </div>
    </section>
  );
}

export function App() {
  const [dark, setDark] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [sample, setSample] = useState<SampleName>("Email signature");
  const [tab, setTab] = useState<keyof typeof SNIPPETS>("Button");
  const [firstName, setFirstName] = useState("");
  const [sent, setSent] = useState<SmartPasteField[] | null>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <div className="page">
      <header className="nav">
        <div className="wrap nav-inner">
          <a href="#top" className="brand">
            <span className="brand-mark" aria-hidden="true">
              ⌘V
            </span>
            react-smart-paste
          </a>
          <nav aria-label="Sections">
            <a href="#demo">Demo</a>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#usage">Usage</a>
            <a href="#safety">Safety</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </nav>
          <button type="button" className="ghost" aria-pressed={dark} onClick={() => setDark(!dark)}>
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow">Free · MIT licensed · React 18+</p>
            <h1>
              Paste once. <em>The form fills itself.</em>
            </h1>
            <p className="lead">
              A React button that reads your form, sends pasted text to your AI model, and fills the matching fields
              after the user approves. No schema, no key in the browser.
            </p>
            <div className="hero-actions">
              <div className="install">
                <code>npm install react-smart-paste</code>
                <CopyButton text="npm install react-smart-paste" />
              </div>
              <a className="cta" href="#demo">
                Try the demo
              </a>
              <a className="text-link" href={NPM_URL} target="_blank" rel="noreferrer">
                View on npm ↗
              </a>
            </div>
          </div>
        </section>

        <section id="demo" className="demo">
          <div className="wrap">
            <p className="eyebrow">Live demo</p>
            <div className="demo-grid">
              <div className="card source">
                <div className="card-head">
                  <h3>1. Copy some text</h3>
                  <CopyButton text={SAMPLES[sample]} label="Copy text" />
                </div>
                <div className="tabs" role="tablist" aria-label="Sample text">
                  {(Object.keys(SAMPLES) as SampleName[]).map((name) => (
                    <button
                      key={name}
                      type="button"
                      role="tab"
                      aria-selected={name === sample}
                      onClick={() => setSample(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <pre className="sample">{SAMPLES[sample]}</pre>
                <p className="fine">
                  This demo uses a mock model: simple pattern matching that only understands these samples, so nothing
                  leaves this page. In your app, a real AI model does the matching.
                </p>
              </div>

              <form
                ref={form}
                className="card"
                onSubmit={(event) => event.preventDefault()}
                onReset={() => setFirstName("")}
              >
                <div className="card-head">
                  <h3>2. Press Smart paste</h3>
                  <SmartPasteButton complete={mockModel} align="end" theme={dark ? "dark" : "light"} />
                </div>
                <div className="fields">
                  <label>
                    First name
                    <input
                      name="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </label>
                  <label>
                    Last name
                    <input name="lastName" autoComplete="family-name" />
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" autoComplete="email" />
                  </label>
                  <label>
                    Phone
                    <input name="phone" type="tel" autoComplete="tel" />
                  </label>
                  <label>
                    Company
                    <input name="company" autoComplete="organization" />
                  </label>
                  <label>
                    Job title
                    <input name="jobTitle" autoComplete="organization-title" />
                  </label>
                  <label>
                    Website
                    <input name="website" type="url" />
                  </label>
                  <label>
                    Country
                    <select name="country" defaultValue="">
                      <option value="">Choose…</option>
                      <option value="in">India</option>
                      <option value="gb">United Kingdom</option>
                      <option value="us">United States</option>
                    </select>
                  </label>
                </div>
                <fieldset>
                  <legend>Preferred contact</legend>
                  <label className="inline">
                    <input type="radio" name="contactBy" value="email" /> Email
                  </label>
                  <label className="inline">
                    <input type="radio" name="contactBy" value="phone" /> Phone
                  </label>
                </fieldset>
                <label className="inline">
                  <input type="checkbox" name="newsletter" /> Subscribe to the newsletter
                </label>
                <label>
                  Notes
                  <textarea name="notes" rows={2} />
                </label>
                <label>
                  Password <span className="tag">never read or filled</span>
                  <input name="password" type="password" autoComplete="new-password" />
                </label>
                <div className="form-foot">
                  <button type="reset" className="ghost">
                    Clear form
                  </button>
                </div>
              </form>
            </div>

            <details
              className="output"
              onToggle={(event) => {
                if (event.currentTarget.open && form.current) setSent(readFields(form.current, { overwrite: "all" }));
              }}
            >
              <summary>See what the model is told about this form</summary>
              <pre>{sent ? JSON.stringify(sent, null, 2) : ""}</pre>
            </details>
          </div>
        </section>

        <Section
          id="how"
          eyebrow="How it works"
          title="Three steps, and the user stays in charge."
          lead="The AI proposes; the person filling the form decides."
        >
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="step-num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="features" eyebrow="What's inside" title="Small on the page, careful underneath.">
          <ul className="features">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="usage"
          eyebrow="Usage"
          title="One button in your form, one route on your server."
          lead="Use the ready-made button, or the hook when you want your own review screen."
        >
          <div className="code">
            <div className="code-head">
              <div className="tabs" role="tablist" aria-label="Code example">
                {(Object.keys(SNIPPETS) as (keyof typeof SNIPPETS)[]).map((name) => (
                  <button key={name} type="button" role="tab" aria-selected={name === tab} onClick={() => setTab(name)}>
                    {name}
                  </button>
                ))}
              </div>
              <CopyButton text={SNIPPETS[tab]} />
            </div>
            <pre>{SNIPPETS[tab]}</pre>
          </div>
        </Section>

        <Section
          id="safety"
          eyebrow="Safety and privacy"
          title="Built for forms that hold real data."
          lead="Pasted text does go to your AI model, so tell your users. Everything else is designed to limit what can go wrong."
        >
          <div className="safety">
            <div>
              <h3>Never read, sent or filled</h3>
              <ul>
                <li>Password, file and hidden inputs</li>
                <li>Payment fields and one-time codes</li>
                <li>Disabled and read-only fields</li>
                <li>
                  Anything inside <code>data-smart-paste="off"</code>
                </li>
                <li>The current values of your fields</li>
              </ul>
            </div>
            <div>
              <h3>Checked before it is shown</h3>
              <ul>
                <li>Only field names that exist in the form are accepted</li>
                <li>Dates must be real dates; choices must be listed options</li>
                <li>Emails and links must be well formed</li>
                <li>Values are set as plain text, never as HTML</li>
                <li>Instructions hidden in pasted text are not followed</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="props" eyebrow="Reference" title="Button props.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prop</th>
                  <th>Type</th>
                  <th>What it does</th>
                </tr>
              </thead>
              <tbody>
                {PROPS.map(([name, type, text]) => (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                    </td>
                    <td>
                      <code>{type}</code>
                    </td>
                    <td>{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <section className="closing">
          <div className="wrap">
            <h2>Stop retyping. Start pasting.</h2>
            <div className="install">
              <code>npm install react-smart-paste</code>
              <CopyButton text="npm install react-smart-paste" />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span>react-smart-paste · MIT licensed · free to use in any project</span>
          <span>
            <a href={NPM_URL} target="_blank" rel="noreferrer">
              npm
            </a>{" "}
            ·{" "}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
