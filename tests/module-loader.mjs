import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const prismaMockUrl = new URL("./support/prisma-mock.mjs", import.meta.url).href;
const nextCacheMockUrl = new URL("./support/next-cache-mock.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/prisma") return { url: prismaMockUrl, shortCircuit: true };
  if (specifier === "next/cache") return { url: nextCacheMockUrl, shortCircuit: true };
  if (specifier === "@prisma/client") return { url: new URL("./support/prisma-client-mock.mjs", import.meta.url).href, shortCircuit: true };

  if (specifier.startsWith("@/")) {
    const candidate = new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url);
    if (existsSync(fileURLToPath(candidate))) {
      return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true };
    }
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !specifier.match(/\.[cm]?[jt]sx?$/)) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) {
      return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true };
    }
    const indexCandidate = new URL(`${specifier}/index.ts`, context.parentURL);
    if (existsSync(fileURLToPath(indexCandidate))) {
      return { url: pathToFileURL(fileURLToPath(indexCandidate)).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
