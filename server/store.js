import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { seedGames } from "./games.js";

export function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex"),
) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password, hash) {
  const [salt, encoded] = hash.split(":");
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(encoded, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
export function createStore(directory, env = process.env) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "house.json");
  const keyPath = path.join(directory, "key");
  let encryptionKey;
  try {
    encryptionKey = fs.readFileSync(keyPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    encryptionKey = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, encryptionKey, { mode: 0o600, flag: "wx" });
  }
  let initialPassword = null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    initialPassword =
      env.HOLIDAY_HOST_PASSWORD || crypto.randomBytes(12).toString("base64url");
    data = {
      familyName: env.HOLIDAY_FAMILY_NAME || "The family",
      joinCode:
        env.HOLIDAY_JOIN_CODE ||
        crypto.randomBytes(5).toString("hex").toUpperCase(),
      hostHash: hashPassword(initialPassword),
      aiUrl: env.HOLIDAY_AI_URL || "https://api.openai.com/v1",
      aiModel: env.HOLIDAY_AI_MODEL || "gpt-4o-mini",
      encryptedKey: null,
      games: structuredClone(seedGames),
      members: [],
      blocks: {},
    };
  }
  function save() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  // Explicit environment override also provides a host-controlled password recovery path.
  if (
    env.HOLIDAY_HOST_PASSWORD &&
    !checkPassword(env.HOLIDAY_HOST_PASSWORD, data.hostHash)
  )
    data.hostHash = hashPassword(env.HOLIDAY_HOST_PASSWORD);
  function setKey(value) {
    if (!value) {
      data.encryptedKey = null;
      return;
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
    const payload = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    data.encryptedKey = {
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      payload: payload.toString("hex"),
    };
  }
  function getKey() {
    if (env.HOLIDAY_AI_KEY) return env.HOLIDAY_AI_KEY;
    if (!data.encryptedKey) return null;
    const d = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
      Buffer.from(data.encryptedKey.iv, "hex"),
    );
    d.setAuthTag(Buffer.from(data.encryptedKey.tag, "hex"));
    return Buffer.concat([
      d.update(Buffer.from(data.encryptedKey.payload, "hex")),
      d.final(),
    ]).toString("utf8");
  }
  save();
  return { data, save, setKey, getKey, initialPassword, env };
}
