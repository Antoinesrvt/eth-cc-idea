import { ensureTables } from "./migrate";

let initialized = false;

export async function ensureInit() {
  if (initialized) return;
  await ensureTables();
  initialized = true;
}
