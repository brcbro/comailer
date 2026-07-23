#!/usr/bin/env node
/**
 * OpenNext worker.js only exports fetch. Patch in a scheduled handler that
 * POSTs to /api/drip/tick so drip campaigns run on Cloudflare cron triggers.
 */
const fs = require("fs");
const path = require("path");

const workerPath = path.join(__dirname, "..", ".open-next", "worker.js");

if (!fs.existsSync(workerPath)) {
  console.warn("[patch-worker-cron] worker.js not found — skip");
  process.exit(0);
}

let src = fs.readFileSync(workerPath, "utf8");

if (src.includes("export async function scheduled")) {
  console.log("[patch-worker-cron] worker.js already patched");
  process.exit(0);
}

const scheduledHandler = `
export async function scheduled(event, env, ctx) {
    const secret = env.CRON_SECRET;
    const base = (env.APP_URL || "").replace(/\\/$/, "");
    if (!secret || !base) {
        console.warn("[drip-cron] CRON_SECRET and APP_URL must be set");
        return;
    }
    ctx.waitUntil(
        fetch(\`\${base}/api/drip/tick\`, {
            method: "POST",
            headers: { Authorization: \`Bearer \${secret}\` },
        })
            .then(async (res) => {
                const body = await res.text();
                console.log("[drip-cron]", res.status, body.slice(0, 200));
            })
            .catch((err) => console.error("[drip-cron]", err))
    );
}
`;

// Insert before the default export object.
src = src.replace(
  /export default \{/,
  `${scheduledHandler}\nexport default {`
);

fs.writeFileSync(workerPath, src);
console.log("[patch-worker-cron] added scheduled handler to worker.js");
