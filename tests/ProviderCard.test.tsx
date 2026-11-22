import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderCard, loadProvider } from "../src/components/ProviderCard";
import { lens } from "./setup";

// App owns the provider state; mirror that here so changes flow back through.
function Harness() {
  const [provider, setProvider] = useState(loadProvider);
  return <ProviderCard value={provider} onChange={setProvider} />;
}

const setSecret = vi.mocked(lens.setSecret);

describe("ProviderCard secret handling", () => {
  beforeEach(() => {
    setSecret.mockResolvedValue(true);
  });

  it("migrates a legacy plaintext key into the OS keychain and scrubs localStorage", async () => {
    localStorage.setItem(
      "ffd-provider",
      JSON.stringify({
        preset: "byok",
        base_url: "https://api.openai.com/v1",
        api_key: "sk-legacy",
        model: "gpt-4o-mini",
        remember: true,
      }),
    );
    const initial = loadProvider();
    expect(initial.api_key).toBe("sk-legacy"); // still available for this session
    expect(initial.remember).toBe(true);

    render(<Harness />);
    await waitFor(() => expect(setSecret).toHaveBeenCalledWith("provider_api_key", "sk-legacy"));

    const stored = JSON.parse(localStorage.getItem("ffd-provider") ?? "{}");
    expect(stored.api_key).toBeUndefined(); // scrubbed
    expect(stored.model).toBe("gpt-4o-mini"); // non-secret fields stay
  });

  it("never writes the API key to localStorage when remembering settings", async () => {
    render(<Harness />);

    // switch to the BYOK preset so the key field appears, then type a key
    fireEvent.click(screen.getByText("My own key (OpenAI-compatible)"));
    const keyInput = await screen.findByPlaceholderText("sk-…");
    fireEvent.change(keyInput, { target: { value: "sk-test" } });
    fireEvent.click(screen.getByRole("checkbox")); // "Remember these settings…"

    await waitFor(() => expect(setSecret).toHaveBeenCalledWith("provider_api_key", "sk-test"), {
      timeout: 3000, // key writes are debounced 400ms
    });
    const stored = JSON.parse(localStorage.getItem("ffd-provider") ?? "{}");
    expect(stored.api_key).toBeUndefined();
    expect(stored.base_url).toBe("https://api.openai.com/v1");
    expect(screen.getByText(/stored encrypted in your computer's keychain/)).toBeTruthy();
  });

  it("deletes the stored key when remembering is switched off", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("My own key (OpenAI-compatible)"));
    const keyInput = await screen.findByPlaceholderText("sk-…");
    fireEvent.change(keyInput, { target: { value: "sk-test" } });
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(setSecret).toHaveBeenCalledWith("provider_api_key", "sk-test"), {
      timeout: 3000,
    });

    setSecret.mockClear();
    fireEvent.click(screen.getByRole("checkbox")); // remember off
    await waitFor(() => expect(setSecret).toHaveBeenCalledWith("provider_api_key", ""));
    expect(localStorage.getItem("ffd-provider")).toBeNull();
  });
});
