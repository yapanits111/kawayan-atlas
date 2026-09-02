/**
 * A deterministic, stylised bamboo-culm illustration for a species — pure inline SVG,
 * coloured by the species and sized by its diameter, so no external images are needed.
 */
function parseMinDiameterMm(range: string): number {
  const m = range.match(/\d+/);
  return m ? parseInt(m[0], 10) : 90;
}

export function SpeciesGlyph({
  color,
  diameterRange,
  className = "",
}: {
  color: string;
  diameterRange: string;
  className?: string;
}) {
  // Culm width scales gently with real diameter (40–200 mm → ~14–30 px).
  const dia = parseMinDiameterMm(diameterRange);
  const w = Math.max(14, Math.min(30, 10 + dia / 8));
  const cx = 60;
  const left = cx - w / 2;
  // Node bands down the culm.
  const nodes = [30, 58, 86];

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Stylised bamboo culm"
    >
      <defs>
        <linearGradient id={`culm-${color}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.65" />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Leaves */}
      <g fill="#538343" opacity="0.9">
        <path d={`M ${cx} 20 Q ${cx + 26} 8 ${cx + 40} 16 Q ${cx + 20} 22 ${cx} 20 Z`} />
        <path d={`M ${cx} 24 Q ${cx - 24} 14 ${cx - 38} 24 Q ${cx - 18} 28 ${cx} 24 Z`} />
        <path d={`M ${cx} 18 Q ${cx + 6} 4 ${cx + 16} 2 Q ${cx + 12} 14 ${cx} 18 Z`} fill="#3f6833" />
      </g>

      {/* Culm */}
      <rect
        x={left}
        y="18"
        width={w}
        height="92"
        rx={w / 2.4}
        fill={`url(#culm-${color})`}
        stroke="#493c29"
        strokeOpacity="0.25"
      />
      {/* Node rings */}
      {nodes.map((y) => (
        <rect
          key={y}
          x={left - 1.5}
          y={y}
          width={w + 3}
          height="4"
          rx="2"
          fill="#493c29"
          fillOpacity="0.28"
        />
      ))}
      {/* Highlight */}
      <rect x={left + 2} y="20" width="2.5" height="88" rx="1.25" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}
