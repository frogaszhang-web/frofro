import { fileURLToPath } from "node:url";
import path from "node:path";

// src/paths.ts -> repo root is two levels up from this file's dir (server/src).
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "..", "..");
export const DATA_DIR = path.join(REPO_ROOT, "data");
export const DB_PATH = path.join(DATA_DIR, "crucible.db");
