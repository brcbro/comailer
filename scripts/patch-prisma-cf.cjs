#!/usr/bin/env node
/**
 * Cloudflare Workers must load Prisma via the wasm entry (driver adapters + wasm compiler).
 * OpenNext inlines Prisma into handler.mjs with fs.readFileSync — patch that after build.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", ".open-next", "server-functions", "default");
const prismaClientDir = path.join(root, "node_modules", ".prisma", "client");
const handlerPath = path.join(root, "handler.mjs");

const wasmCompilerFix = `getQueryCompilerWasmModule:async()=>{let mod=await import("./node_modules/.prisma/client/query_compiler_bg.wasm");return mod.default}`;

function patchHandler() {
  if (!fs.existsSync(handlerPath)) {
    console.warn("[patch-prisma-cf] handler.mjs not found");
    return;
  }

  let src = fs.readFileSync(handlerPath, "utf8");
  const before = src;

  // Fix a missing semicolon from an earlier patch variant.
  src = src.replace(/config\.isBundled=!0config\./g, "config.isBundled=!0;config.");

  src = src.replace(
    /getQueryCompilerWasmModule:async\(\)=>\{let queryCompilerWasmFilePath=require\("path"\)\.join\(config\.dirname,"query_compiler_bg\.wasm"\),queryCompilerWasmFileBytes=require\("fs"\)\.readFileSync\(queryCompilerWasmFilePath\);return new WebAssembly\.Module\(queryCompilerWasmFileBytes\)\}/g,
    wasmCompilerFix
  );

  // Skip schema.prisma fs.existsSync checks on Workers (no filesystem).
  src = src.replace(
    /config\.dirname="";if\(!fs\.existsSync\(path2\.join\("","schema\.prisma"\)\)\)\{let alternativePaths=\["node_modules\/\.prisma\/client","\.prisma\/client"\],alternativePath=alternativePaths\.find\(altPath=>fs\.existsSync\(path2\.join\(process\.cwd\(\),altPath,"schema\.prisma"\)\)\)\?\?alternativePaths\[0\];config\.dirname=path2\.join\(process\.cwd\(\),alternativePath\),config\.isBundled=!0\}/g,
    'config.dirname=path2.join(process.cwd(),"node_modules/.prisma/client"),config.isBundled=!0;'
  );

  if (src !== before) {
    fs.writeFileSync(handlerPath, src);
    console.log("[patch-prisma-cf] patched handler.mjs");
  } else {
    console.log("[patch-prisma-cf] handler.mjs already patched");
  }
}

const reexports = [
  {
    file: path.join(root, "node_modules", "@prisma", "client", "default.js"),
    content: "module.exports = { ...require('.prisma/client/wasm') }\n",
  },
  {
    file: path.join(prismaClientDir, "default.js"),
    content: "module.exports = { ...require('./wasm') }\n",
  },
  {
    file: path.join(prismaClientDir, "index.js"),
    content: "module.exports = { ...require('./wasm') }\n",
  },
];

for (const { file, content } of reexports) {
  if (!fs.existsSync(file)) continue;
  fs.writeFileSync(file, content);
  console.log("[patch-prisma-cf] patched", path.relative(process.cwd(), file));
}

const wasmPath = path.join(prismaClientDir, "wasm.js");
if (fs.existsSync(wasmPath)) {
  let src = fs.readFileSync(wasmPath, "utf8");
  const replaced = src.replace(
    /getQueryCompilerWasmModule:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\}/,
    `  getQueryCompilerWasmModule: async () => {
    const mod = await import('./query_compiler_bg.wasm');
    return mod.default;
  }`
  );
  if (replaced !== src) {
    fs.writeFileSync(wasmPath, replaced);
    console.log("[patch-prisma-cf] patched wasm.js loader");
  }
}

patchHandler();
