import { useEffect, useRef, useState } from "react";
import { PRESETS, Provider } from "../practice";
import { T, button, card, input } from "../theme";

const STORE = "ffd-provider";
const KEY_SECRET = "provider_api_key";

export type ProviderSettings = Provider & { preset: string; remember: boolean };

// localStorage never holds the API key — only non-secret fields. The key is
// encrypted at rest in the OS keychain via main's safeStorage bridge
// (window.lens.setSecret), or kept in memory for the session if the keychain
// is unavailable. Pure: reads only (no writes) so StrictMode's double-invoked
// state initializer is harmless; migration/scrubbing happens in the mount
// effect below.
export function loadProvider(): ProviderSettings {
  const defaults: ProviderSettings = {
    preset: "local",
    base_url: PRESETS[0].base_url,
    api_key: "",
    model: "",
    remember: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (saved) return { ...defaults, ...saved };
  } catch {
    /* fall through */
  }
  return defaults;
}

export function ProviderCard({
  value,
  onChange,
}: {
  value: ProviderSettings;
  onChange: (p: ProviderSettings) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [probe, setProbe] = useState("");
  const [keychain, setKeychain] = useState<"ok" | "unavailable" | "unknown">("unknown");
  const saveKeyTimer = useRef<number | null>(null);
  const booted = useRef(false);

  // One-time: migrate a legacy plaintext key (pre-keychain builds stored it in
  // localStorage) into the OS keychain and scrub it, or restore a remembered
  // key from the keychain.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      if (value.api_key) {
        const ok = await window.lens.setSecret(KEY_SECRET, value.api_key);
        setKeychain(ok ? "ok" : "unavailable");
        if (value.remember) {
          const { api_key: _k, ...persist } = value;
          localStorage.setItem(STORE, JSON.stringify(persist)); // scrub
        } else {
          localStorage.removeItem(STORE);
        }
      } else if (value.remember) {
        const stored = await window.lens.getSecret(KEY_SECRET);
        if (stored) onChange({ ...value, api_key: stored });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (saveKeyTimer.current) window.clearTimeout(saveKeyTimer.current);
    },
    [],
  );

  const set = (patch: Partial<ProviderSettings>) => {
    const next = { ...value, ...patch };
    onChange(next);
    const { api_key, ...persist } = next;
    if (next.remember) {
      localStorage.setItem(STORE, JSON.stringify(persist));
      // Debounce keychain writes — typing in the key field fires set() per keystroke.
      if (saveKeyTimer.current) window.clearTimeout(saveKeyTimer.current);
      saveKeyTimer.current = window.setTimeout(() => {
        void window.lens.setSecret(KEY_SECRET, api_key).then((ok) => {
          if (api_key) setKeychain(ok ? "ok" : "unavailable");
        });
      }, 400);
    } else {
      localStorage.removeItem(STORE);
      if (saveKeyTimer.current) window.clearTimeout(saveKeyTimer.current);
      void window.lens.setSecret(KEY_SECRET, ""); // delete any stored key
    }
  };

  useEffect(() => {
    setModels([]);
    setProbe("");
  }, [value.base_url]);

  const preset = PRESETS.find((p) => p.id === value.preset) ?? PRESETS[0];

  const fetchModels = async () => {
    setProbe("Checking endpoint…");
    const resp = await window.lens.api("POST", "/practice/models", {
      base_url: value.base_url,
      api_key: value.api_key,
      model: "",
    });
    if (resp.status === 200) {
      const list = (resp.body as { models: string[] }).models;
      setModels(list);
      setProbe(list.length ? `${list.length} models available` : "Endpoint reachable, no models listed");
      if (!value.model && list.length) set({ model: list[0] });
    } else {
      setProbe(`Could not reach endpoint (${(resp.body as { detail?: string })?.detail ?? resp.status})`);
    }
  };

  return (
    <section style={card}>
      <div style={T.label}>Model endpoint</div>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => set({ preset: p.id, base_url: p.base_url, model: "" })}
            style={{
              ...button(value.preset === p.id ? "primary" : "secondary"),
              padding: "7px 12px",
              fontSize: 11,
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ fontSize: 13, color: T.textBody }}>
          Endpoint URL
          <input
            style={{ ...input, marginTop: 4 }}
            value={value.base_url}
            placeholder="https://your-server.example/v1"
            onChange={(e) => set({ base_url: e.target.value })}
          />
        </label>
        {(preset.needsKey || value.api_key) && (
          <label style={{ fontSize: 13, color: T.textBody }}>
            API key / bearer token
            <input
              style={{ ...input, marginTop: 4 }}
              type="password"
              value={value.api_key}
              placeholder="sk-…"
              onChange={(e) => set({ api_key: e.target.value })}
            />
          </label>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
          <label style={{ fontSize: 13, color: T.textBody, flex: 1 }}>
            Model
            {models.length > 0 ? (
              <select style={{ ...input, marginTop: 4 }} value={value.model} onChange={(e) => set({ model: e.target.value })}>
                {models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                style={{ ...input, marginTop: 4 }}
                value={value.model}
                placeholder="llama3.2:3b"
                onChange={(e) => set({ model: e.target.value })}
              />
            )}
          </label>
          <button style={{ ...button("secondary"), padding: "9px 14px", fontSize: 11 }} onClick={fetchModels}>
            List models
          </button>
        </div>
        {probe && <div style={{ fontSize: 12, color: T.textMuted }}>{probe}</div>}
        <label style={{ fontSize: 12, color: T.textMuted, display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={value.remember}
            onChange={(e) => set({ remember: e.target.checked })}
          />
          Remember these settings on this computer
        </label>
        {value.remember && (
          <div style={{ fontSize: 12, color: T.textMuted }}>
            {keychain === "unavailable"
              ? "Your computer's keychain is unavailable, so the key is kept for this session only (other settings are saved)."
              : "Your key is stored encrypted in your computer's keychain."}
          </div>
        )}
      </div>
    </section>
  );
}
