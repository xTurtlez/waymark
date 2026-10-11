/**
 * The Waymark cairn mark (brand direction 4a). Three stacked stones:
 * teal base, amber middle, coral top. `reversed` swaps the base to cream
 * for deep-teal backgrounds.
 */
export function Cairn({
  size = 34,
  reversed = false,
  className,
  title,
}: {
  size?: number;
  reversed?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flex: "none" }}
    >
      <rect x="6" y="33" width="36" height="10" rx="5" fill={reversed ? "#FBF6EE" : "#0E5F5B"} />
      <rect x="11" y="21.5" width="26" height="9.5" rx="4.75" fill="#E3A13A" transform="rotate(-5 24 26)" />
      <circle cx="25" cy="13" r="5.5" fill="#E36E55" />
    </svg>
  );
}

export function Wordmark({
  size = 28,
  reversed = false,
  markSize,
  className = "",
}: {
  size?: number;
  reversed?: boolean;
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Cairn size={markSize ?? Math.round(size * 1.2)} reversed={reversed} />
      <span
        className={`font-serif font-medium tracking-[-0.02em] ${reversed ? "text-cream" : "text-ink"}`}
        style={{ fontSize: size, lineHeight: 1 }}
      >
        Waymark
      </span>
    </span>
  );
}
