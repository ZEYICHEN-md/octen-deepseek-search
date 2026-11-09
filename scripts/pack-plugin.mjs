#!/usr/bin/env node
/**
 * Build a plugin zip whose root is the plugin root (kimi.plugin.json at the
 * archive root). No .git, dependency caches, transcripts, or secrets.
 *
 *   node scripts/pack-plugin.mjs [out.zip]
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const outPath = resolve(process.argv[2] || join(repoRoot, "dist", "octen-deepseek-exa-kimi.zip"));
  const files = listPluginFiles(repoRoot);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, zipStore(repoRoot, files));
  console.log(JSON.stringify({ zip: outPath, files: files.length, rootEntry: "kimi.plugin.json" }));
}

export function listPluginFiles(root) {
  const out = [];
  walk(root, root, out);
  return out.sort();
}

function walk(root, dir, out) {
  for (const name of readdirSync(dir)) {
    if (dir === root && (name === ".git" || name === "node_modules" || name === "dist")) continue;
    if (name === ".DS_Store") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(root, full, out);
      continue;
    }
    if (!st.isFile()) continue;
    const rel = relative(root, full).split(sep).join("/");
    if (rel.startsWith("prove/.tmp/")) continue;
    if (rel.startsWith("prove/") && rel.endsWith(".jsonl")) continue;
    if (rel === ".env" || rel.startsWith(".env.")) continue;
    if (rel.endsWith(".zip")) continue;
    if (rel.endsWith("/secrets.json") || rel === "secrets.json") continue;
    if (rel.includes("api_key")) continue;
    out.push(rel);
  }
}

export function zipStore(root, files, wrap = "") {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const rel of files) {
    const data = readFileSync(join(root, rel));
    const name = Buffer.from(`${wrap}${rel}`, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, Buffer.from(name));
    offset += local.length + name.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
