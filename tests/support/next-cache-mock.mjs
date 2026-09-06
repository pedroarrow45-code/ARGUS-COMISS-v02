export function revalidatePath(...args) {
  globalThis.__commissionRevalidatedPaths?.push(args);
}
