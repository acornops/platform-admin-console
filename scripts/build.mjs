import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await cp(new URL("../public", import.meta.url), new URL("../dist", import.meta.url), { recursive: true });
await mkdir(new URL("../dist/fonts", import.meta.url), { recursive: true });
const fonts = [
  ["@fontsource/outfit/files/outfit-latin-400-normal.woff2", "outfit-latin-400-normal.woff2"],
  ["@fontsource/outfit/files/outfit-latin-500-normal.woff2", "outfit-latin-500-normal.woff2"],
  ["@fontsource/outfit/files/outfit-latin-600-normal.woff2", "outfit-latin-600-normal.woff2"],
  ["@fontsource/outfit/files/outfit-latin-700-normal.woff2", "outfit-latin-700-normal.woff2"],
  ["@fontsource/ubuntu-mono/files/ubuntu-mono-latin-400-normal.woff2", "ubuntu-mono-latin-400-normal.woff2"],
  ["@fontsource/ubuntu-mono/files/ubuntu-mono-latin-700-normal.woff2", "ubuntu-mono-latin-700-normal.woff2"]
];
for (const [source, destination] of fonts) {
  await copyFile(new URL(`../node_modules/${source}`, import.meta.url), new URL(`../dist/fonts/${destination}`, import.meta.url));
}
process.stdout.write(`Built production static assets from ${root}/public to ${root}/dist\n`);
