export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDripWorker } = await import("./lib/drip-worker");
    startDripWorker();
  }
}
