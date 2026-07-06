import { useEffect, useState } from "react";
import { PRESETS, Provider } from "../practice";
import { T, button, card, input } from "../theme";

const STORE = "ffd-provider";

export function loadProvider(): Provider & { preset: string; remember: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (saved) return saved;
  } catch {
    /* fall through */
  }
  return { preset: "local", base_url: PRESETS[0].base_url, api_key: "", model: "", remember: false };
}

export function ProviderCard({
  value,
  onChange,
}: {
  value: Provider & { preset: string; remember: boolean };
  onChange: (p: Provider & { preset: string; remember: boolean }) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [probe, setProbe] = useState<string>("");

  const set = (patch: Partial<typeof value>) => {
    const next = { ...value, ...patch };
    onChange(next);
    if (next.remember) {
      localStorage.setItem(STORE, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORE);
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
          Remember these settings on this computer (the key is stored unencrypted)
        </label>
      </div>
    </section>
  );
}
