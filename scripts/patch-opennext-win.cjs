#!/usr/bin/env node
/**
 * OpenNext uses symlinks when bundling traced files; Windows blocks that without
 * Developer Mode. Patch the bundler to fall back to directory copies on EPERM.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@opennextjs",
  "aws",
  "dist",
  "build",
  "copyTracedFiles.js"
);

if (!fs.existsSync(target)) {
  console.warn("[patch-opennext-win] copyTracedFiles.js not found, skipping");
  process.exit(0);
}

let src = fs.readFileSync(target, "utf8");
const marker = "Windows often blocks symlinks";
if (src.includes(marker)) {
  console.log("[patch-opennext-win] already patched");
  process.exit(0);
}

const oldBlock = `        if (symlink) {
            try {
                symlinkSync(symlink, to);
            }
            catch (e) {
                if (e.code !== "EEXIST") {
                    throw e;
                }
            }
        }`;

const newBlock = `        if (symlink) {
            try {
                symlinkSync(symlink, to);
            }
            catch (e) {
                if (e.code === "EEXIST") {
                    // already linked
                }
                else if (e.code === "EPERM" || process.platform === "win32") {
                    // Windows often blocks symlinks without Developer Mode — copy instead.
                    const resolved = path.isAbsolute(symlink)
                        ? symlink
                        : path.resolve(path.dirname(from), symlink);
                    cpSync(resolved, to, { recursive: true, force: true });
                }
                else {
                    throw e;
                }
            }
        }`;

if (!src.includes(oldBlock)) {
  console.warn("[patch-opennext-win] unexpected file contents, manual patch may be needed");
  process.exit(0);
}

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(target, src);
console.log("[patch-opennext-win] patched copyTracedFiles.js for Windows");
