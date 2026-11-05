export function Mark({ size = 28 }: { size?: number }) {
  // Stepped F: three bars climbing right = progression.
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-[0.18em]">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="4" width="6" height="24" fill="currentColor" />
        <rect x="10" y="4" width="18" height="6" fill="currentColor" />
        <rect x="10" y="14" width="11" height="6" fill="#5268F5" />
        <rect x="22" y="14" width="6" height="6" fill="#D5F26A" />
      </svg>
      FRIKHII
    </span>
  );
}
