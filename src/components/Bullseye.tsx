/** Dartboard progress glyph — port of the FeedForward server's
 * bullseye_progress: the dart lands closer to the centre as work improves.
 * `closeness` 0..1; 1 = bullseye. */
export function Bullseye({ closeness, size = 40, label }: { closeness: number; size?: number; label?: string }) {
  const c = Math.max(0, Math.min(1, closeness));
  const maxR = 13;
  const r = maxR * (1 - c);
  const offset = r * 0.7071; // 45° radial
  const cx = 16 + offset;
  const cy = 16 - offset;
  const ink = "#1a2e44";
  const teal = "#0d9488";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={label ?? "progress toward the bullseye"} fill="none">
      <circle cx="16" cy="16" r="14" stroke={ink} strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" stroke={ink} strokeWidth="1" opacity="0.55" />
      <circle cx="16" cy="16" r="4.5" stroke={ink} strokeWidth="1" opacity="0.35" />
      <circle cx="16" cy="16" r="1.6" fill={ink} />
      <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="3" fill={teal} />
      <line
        x1={(cx + 2.2).toFixed(1)}
        y1={(cy - 2.2).toFixed(1)}
        x2={(cx + 6.5).toFixed(1)}
        y2={(cy - 6.5).toFixed(1)}
        stroke={teal}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
