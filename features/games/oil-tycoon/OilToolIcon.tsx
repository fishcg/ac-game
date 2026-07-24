type OilToolIconProps = {
  type: "dowser" | "mole" | "scanner" | "rig" | "silo" | "wagon";
};

export function OilToolIcon({ type }: OilToolIconProps) {
  if (type === "dowser") {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><circle cx="24" cy="18" r="4" /><path d="M16 10a12 12 0 0 0 0 16M32 10a12 12 0 0 1 0 16M10 5a20 20 0 0 0 0 26M38 5a20 20 0 0 1 0 26" /></svg>;
  }
  if (type === "mole") {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M9 24c4-10 12-15 23-12 7 2 9 8 5 13-5 6-20 7-28-1Z" /><circle cx="33" cy="17" r="1.8" /><path d="m11 22-7 5m12-2-5 7m9-7-2 8M13 15 9 9m10 4-1-7" /></svg>;
  }
  if (type === "scanner") {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M5 10h38M9 10l7 7m23-7-8 8M14 17l9 3m11-2-9 2M24 20v12" /><circle cx="24" cy="20" r="3" /></svg>;
  }
  if (type === "rig") {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M18 32 24 4l7 28M12 32h24M20 22h9M21 14h6M17 27h15" /><circle cx="32" cy="20" r="5" /><path d="m32 15 3 9" /></svg>;
  }
  if (type === "silo") {
    return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M11 8h26v24H11zM8 32h32M15 4h18v4M15 14h18M15 19h18" /><path d="M18 8v24m12-24v24" /></svg>;
  }
  return <svg viewBox="0 0 48 36" aria-hidden="true">
    <path d="M3 19c2-6 7-8 13-5l5 4-2 7H9l-5 4m2-13-1-6 5 3m3 11-1 8m6-9 2 9" />
    <path d="M20 21h5" fill="none" />
    <path d="M24 14h19v14H24z" />
    <path d="M27 11h13l3 3H24zM29 18h10" fill="none" />
    <circle cx="28" cy="30" r="4" /><circle cx="40" cy="30" r="4" />
  </svg>;
}
