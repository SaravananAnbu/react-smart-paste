import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SmartPasteButton, type SmartPasteComplete, type SmartPasteRequest } from "../src";
import * as server from "../src/server";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubClipboard(read: () => Promise<string>) {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { readText: read } });
}

/** A form with one React-controlled input, to prove controlled state is updated. */
function Demo(props: { complete: SmartPasteComplete; review?: boolean; overwrite?: "empty" | "all"; initialName?: string }) {
  const [name, setName] = useState(props.initialName ?? "");
  return (
    <form>
      <label>
        Name <input name="name" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Email <input name="email" type="email" />
      </label>
      <label>
        Country
        <select name="country">
          <option value="">Choose</option>
          <option value="us">USA</option>
          <option value="in">India</option>
        </select>
      </label>
      <label>
        Password <input name="password" type="password" />
      </label>
      <output data-testid="state">{name}</output>
      <SmartPasteButton complete={props.complete} review={props.review} overwrite={props.overwrite} />
    </form>
  );
}

const answer = { name: "Ada Lovelace", email: "ada@example.com", country: "India", password: "hunter2" };
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("SmartPasteButton", () => {
  it("reads the clipboard, shows the changes, and fills only after approval", async () => {
    stubClipboard(async () => "Ada Lovelace <ada@example.com>, India");
    const complete = vi.fn(async (_request: SmartPasteRequest) => JSON.stringify(answer));
    render(<Demo complete={complete} />);

    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    await screen.findByText("Fill these 3 fields?");

    const request = complete.mock.calls[0]![0];
    expect(request.text).toBe("Ada Lovelace <ada@example.com>, India");
    expect(request.fields.map((f) => f.name)).toEqual(["name", "email", "country"]);
    expect(request.signal).toBeInstanceOf(AbortSignal);

    // Nothing is filled yet, and the password field was never offered to the model or filled.
    expect(field("Name").value).toBe("");
    expect(screen.getByRole("dialog").textContent).toContain("India");

    fireEvent.click(screen.getByRole("button", { name: "Fill all" }));
    await screen.findByText("Filled 3 fields.");
    expect(field("Name").value).toBe("Ada Lovelace");
    expect(screen.getByTestId("state").textContent).toBe("Ada Lovelace");
    expect(field("Email").value).toBe("ada@example.com");
    expect(field("Country").value).toBe("in");
    expect(field("Password").value).toBe("");
  });

  it("fills only the ticked fields, and undo restores them", async () => {
    stubClipboard(async () => "text");
    render(<Demo complete={async () => answer} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    await screen.findByText("Fill these 3 fields?");

    fireEvent.click(screen.getByRole("checkbox", { name: /Email/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fill 2" }));
    await screen.findByText("Filled 2 fields.");
    expect(field("Name").value).toBe("Ada Lovelace");
    expect(field("Email").value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(field("Name").value).toBe("");
    expect(screen.getByTestId("state").textContent).toBe("");
    expect(field("Country").value).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("discard leaves the form untouched", async () => {
    stubClipboard(async () => "text");
    render(<Demo complete={async () => answer} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    await screen.findByText("Fill these 3 fields?");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(field("Name").value).toBe("");
  });

  it("does not replace what the user typed unless overwrite is 'all'", async () => {
    stubClipboard(async () => "text");
    const view = render(<Demo complete={async () => answer} initialName="Grace" review={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    await screen.findByText("Filled 2 fields.");
    expect(field("Name").value).toBe("Grace");
    view.unmount();

    render(<Demo complete={async () => answer} initialName="Grace" review={false} overwrite="all" />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    await screen.findByText("Filled 3 fields.");
    expect(field("Name").value).toBe("Ada Lovelace");
  });

  it("offers a text box when the clipboard cannot be read", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    const complete = vi.fn(async (_request: SmartPasteRequest) => ({ email: "ada@example.com" }));
    render(<Demo complete={complete} review={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));

    const box = await screen.findByPlaceholderText("Paste your text here");
    expect(complete).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "reach me at ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    await screen.findByText("Filled 1 field.");
    expect(complete.mock.calls[0]![0].text).toBe("reach me at ada@example.com");
    expect(field("Email").value).toBe("ada@example.com");
  });

  it("reports a failed request, an unreadable reply and an empty match", async () => {
    stubClipboard(async () => "text");
    const view = render(<Demo complete={async () => new Response("nope", { status: 500 })} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The request failed (500).");
    view.unmount();

    const second = render(<Demo complete={async () => "I cannot do that"} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The model did not return any field values.");
    second.unmount();

    render(<Demo complete={async () => new Response("{}")} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    await screen.findByText("Nothing in that text matched this form.");
  });

  it("cancel aborts the request and ignores a late answer", async () => {
    stubClipboard(async () => "text");
    let signal: AbortSignal | undefined;
    let finish: (value: string) => void = () => {};
    const complete: SmartPasteComplete = (request) => {
      signal = request.signal;
      return new Promise<string>((resolve) => (finish = resolve));
    };
    render(<Demo complete={complete} />);
    fireEvent.click(screen.getByRole("button", { name: "Smart paste" }));
    await screen.findByText("Reading your text…");
    await waitFor(() => expect(signal).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal!.aborted).toBe(true);
    await act(async () => finish(JSON.stringify(answer)));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(field("Name").value).toBe("");
  });
});

describe("react-smart-paste/server entry", () => {
  it("exports only the prompt and parsing helpers", () => {
    expect(Object.keys(server).sort()).toEqual(["SMART_PASTE_SYSTEM_PROMPT", "buildSmartPastePrompt", "parseSmartPasteResponse"]);
  });
});
