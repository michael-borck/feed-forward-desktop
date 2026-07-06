/** FeedForward Editorial palette — mirrors the server's design tokens. */
export const T = {
  ink: "#1a2e44",
  inkHover: "#0f1e30",
  paper: "#faf8f2",
  card: "#fdfcf8",
  border: "#cbd5e1",
  teal: "#0d9488",
  amber: "#b45309",
  red: "#b91c1c",
  textBody: "#334155",
  textMuted: "#64748b",
  serif: "Georgia, 'Times New Roman', serif",
  label: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.18em",
    color: "#64748b",
  },
};

export const levelColor = (color: string) =>
  color === "teal" ? T.teal : color === "amber" ? T.amber : T.red;

export const card: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  padding: 20,
};

export const button = (variant: "primary" | "secondary" = "primary"): React.CSSProperties => ({
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  padding: "10px 22px",
  borderRadius: 4,
  cursor: "pointer",
  border: `1px solid ${T.ink}`,
  background: variant === "primary" ? T.ink : "transparent",
  color: variant === "primary" ? T.paper : T.ink,
});

export const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  background: "#fff",
  color: T.ink,
  fontSize: 13,
  boxSizing: "border-box",
};
