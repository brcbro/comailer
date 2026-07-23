export async function register() {
  // Background drip loops are unreliable on Cloudflare Workers — use wrangler cron → /api/drip/tick
  if (process.env.CF_PAGES || process.env.CLOUDFLARE || process.env.WRANGLER) {
    return;
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDripWorker } = await import("./lib/drip-worker");
    startDripWorker();
  }
}
