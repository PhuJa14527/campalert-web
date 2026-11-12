import { mkdir, readFile, writeFile } from "node:fs/promises";

const SETTINGS_FILE = new URL("./data/settings.json", import.meta.url);
const SNAPSHOT_FILE = new URL("./data/snapshot.json", import.meta.url);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(new URL("./data/", import.meta.url), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function loadSettings() {
  return readJson(SETTINGS_FILE, { users: {} });
}

export async function saveSettings(settings) {
  await writeJson(SETTINGS_FILE, settings);
}

export function getUserSettings(settings, userId) {
  return settings.users[userId] ?? null;
}

export async function upsertUser(settings, userId, config) {
  settings.users[userId] = {
    ...settings.users[userId],
    ...config,
    updatedAt: new Date().toISOString(),
  };
  await saveSettings(settings);
  return settings.users[userId];
}

export async function removeUser(settings, userId) {
  delete settings.users[userId];
  await saveSettings(settings);
}

export async function loadSnapshot() {
  return readJson(SNAPSHOT_FILE, { knownIds: null });
}

export async function saveSnapshot(snapshot) {
  await writeJson(SNAPSHOT_FILE, snapshot);
}
