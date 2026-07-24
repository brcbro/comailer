#!/usr/bin/env node
/**
 * OpenNext worker.js only exports fetch. Patch in a scheduled handler on the
 * default export so Cloudflare cron triggers drip sends via /api/drip/tick.
 *
 * IMPORTANT: Cron requires `scheduled` on `export default { ... }`.
 * A top-level `export async function scheduled` is ignored by the runtime.
 */
const fs = require("fs");
const path = require("path");

const workerPath = path.join(__dirname, "..", ".open-next", "worker.js");

if (!fs.existsSync(workerPath)) {
  console.warn("[patch-worker-cron] worker.js not found — skip");
  process.exit(0);
}

let src = fs.readFileSync(workerPath, "utf8");

// Remove obsolete named-export patches from older deploys.
src = src.replace(/\nexport async function scheduled\([\s\S]*?\n\}\r?\n/g, "\n");

const MARKER = "[drip-cron]";
if (src.includes(MARKER) && /export default \{[\s\S]*?async scheduled\s*\(/.test(src)) {
  console.log("[patch-worker-cron] worker.js already patched");
  process.exit(0);
}

// Also strip a previous default-export scheduled if re-running with old marker text.
if (src.includes(MARKER) && !/export default \{[\s\S]*?async scheduled\s*\(/.test(src)) {
  // fall through to inject onto default export
}

const scheduledMethod = `async scheduled(event, env, ctx) {
    const secret = env.CRON_SECRET;
    const base = (env.APP_URL || "").replace(/\\/$/, "");
    if (!secret || !base) {
        console.warn("${MARKER} CRON_SECRET and APP_URL must be set");
        return;
    }
    ctx.waitUntil(
        fetch(base + "/api/drip/tick", {
            method: "POST",
            headers: { Authorization: "Bearer " + secret },
        })
            .then(async (res) => {
                const body = await res.text();
                console.log("${MARKER}", res.status, body.slice(0, 200));
            })
            .catch((err) => console.error("${MARKER}", err))
    );
},
`;

if (!/export default \{/.test(src)) {
  console.error("[patch-worker-cron] could not find `export default {` in worker.js");
  process.exit(1);
}

src = src.replace(/export default \{/, `export default {\n${scheduledMethod}`);

fs.writeFileSync(workerPath, src);
console.log("[patch-worker-cron] added scheduled handler to export default");
