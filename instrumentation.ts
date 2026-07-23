export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDripWorker } = await import("./src/lib/drip-worker");
    startDripWorker();
  }
}
