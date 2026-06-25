export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureBaseData } = await import("./lib/ensureBaseData");
    await ensureBaseData();
  }
}
