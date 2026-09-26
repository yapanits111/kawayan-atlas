import type { SVGProps } from "react";

/**
 * One cohesive line-icon set (24×24, 1.6 stroke, currentColor) so the app never falls back
 * to emoji. Each icon inherits text color and sizes via className (e.g. "h-5 w-5").
 */
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Atlas / learn — an open book. */
export const IconBook = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 6.5C10.4 5.4 7.5 5 4.5 5.6v12c3-.6 5.9-.2 7.5 1 1.6-1.2 4.5-1.6 7.5-1v-12C16.5 5 13.6 5.4 12 6.5Z" />
    <path d="M12 6.5v12" />
  </Base>
);

/** Design — a pencil. */
export const IconPencil = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20.5l1.2-4.2L15.6 5.9a2.1 2.1 0 0 1 3 3L8.2 19.3 4 20.5Z" />
    <path d="M14.2 7.3l3 3" />
  </Base>
);

/** Check — a magnifier with a tick. */
export const IconInspect = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="M20 20l-4.4-4.4" />
    <path d="M8.4 11.1l1.9 1.9 3.3-3.5" />
  </Base>
);

/** Build — a stilt A-frame (bahay kubo). */
export const IconFrame = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 21h18" />
    <path d="M4 11l8-6 8 6" />
    <path d="M6 21V10.5" />
    <path d="M18 21V10.5" />
    <path d="M6 15.5h12" />
  </Base>
);

/** House / template. */
export const IconHouse = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 11.5 12 5l8.5 6.5" />
    <path d="M5.5 10.2V19h13v-8.8" />
    <path d="M10 19v-4.5h4V19" />
  </Base>
);

/** Compare — swap arrows. */
export const IconCompare = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 8h13" />
    <path d="M16 4l4 4-4 4" />
    <path d="M17 16H4" />
    <path d="M8 12l-4 4 4 4" />
  </Base>
);

/** Arrow → for links. */
export const IconArrow = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Base>
);

/** Lock — for the safety-gated calculator. */
export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 14.5v2.5" />
  </Base>
);

/**
 * Brand mark — the bamboo culm from the favicon, inline so it scales and takes a size via
 * className. Rounded tile background matches the app icon.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Kawayan Atlas">
      <rect width="32" height="32" rx="8" fill="#e0ecdb" />
      <rect x="11" y="6" width="6" height="21" rx="3" fill="#7d683a" stroke="#493c29" strokeOpacity="0.3" />
      <rect x="10" y="12" width="8" height="2.4" rx="1.2" fill="#493c29" fillOpacity="0.35" />
      <rect x="10" y="19" width="8" height="2.4" rx="1.2" fill="#493c29" fillOpacity="0.35" />
      <path d="M14 8 Q22 4 26 9 Q19 11 14 8 Z" fill="#538343" />
      <path d="M14 10 Q7 7 4 12 Q11 13 14 10 Z" fill="#3f6833" />
    </svg>
  );
}
