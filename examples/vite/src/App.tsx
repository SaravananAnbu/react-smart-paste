import { useState, type FormEvent } from "react";
import { SmartPasteButton } from "react-smart-paste";
import { mockModel } from "./mockModel";

const SAMPLE = `Ada Lovelace
Chief Analyst at Analytical Engines Ltd
ada@analytical-engines.example
+44 20 7946 0958
www.analytical-engines.example
London, United Kingdom

Prefers email. Please add me to the newsletter.
Note: met at the Babbage conference, wants a demo next week.`;

export function App() {
  // One React-controlled field, to show controlled state is updated too.
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copySample = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSubmitted(JSON.stringify(data, null, 2));
  };

  return (
    <main>
      <h1>react-smart-paste</h1>
      <p className="lead">
        Copy the sample below, then press <strong>Smart paste</strong>. The form is read, the text is matched to its
        fields, and you approve the changes before anything is filled.
      </p>
      <p className="mock">
        This page uses a mock model: simple pattern matching that only understands the sample. A real app sends the
        text to an AI model through its own backend.
      </p>

      <section className="sample">
        <div className="sample-head">
          <h2>Sample text</h2>
          <button type="button" onClick={copySample}>
            {copied ? "Copied" : "Copy sample"}
          </button>
        </div>
        <pre>{SAMPLE}</pre>
      </section>

      <form onSubmit={submit}>
        <div className="form-head">
          <h2>New contact</h2>
          <SmartPasteButton complete={mockModel} align="end" />
        </div>

        <div className="grid">
          <label>
            First name
            <input name="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
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
          <textarea name="notes" rows={3} />
        </label>

        <label>
          Account password (never read or filled)
          <input name="password" type="password" autoComplete="new-password" />
        </label>

        <div className="form-foot">
          <button type="submit" className="primary">
            Save contact
          </button>
          <button type="reset" onClick={() => { setFirstName(""); setSubmitted(null); }}>
            Clear
          </button>
        </div>
      </form>

      {submitted && (
        <section className="sample">
          <h2>Submitted values</h2>
          <pre>{submitted}</pre>
        </section>
      )}
    </main>
  );
}
