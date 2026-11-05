import "server-only";
/** Browser-only demonstration when a hosted instance has no database configured. */
export function isDemoRuntime() {
  return (
    !process.env.DATABASE_URL &&
    (!!process.env.VERCEL || process.env.LIVREX_DEMO_MODE === "1")
  );
}
