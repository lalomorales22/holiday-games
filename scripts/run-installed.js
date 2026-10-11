import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { marker, processAlive } from "./install.js";

const directory = path.resolve(process.argv[2] || "");
const options = process.argv.slice(3);
if (options.includes("--help")) {
  console.log(
    "Holiday-arcade [--no-open]\nStarts the website and multiplayer WebSocket server together.\nSet PORT and AI settings in the installation's .env. Press Ctrl+C to stop.",
  );
  process.exit(0);
}
if (options.some((option) => option !== "--no-open")) {
  console.error("Unknown option. Use Holiday-arcade --help.");
  process.exit(1);
}
if (
  fs.readFileSync(path.join(directory, ".holiday-arcade-install"), "utf8") !==
  marker
) {
  console.error(
    "This is not a Holiday Arcade installation. Run the installer again.",
  );
  process.exit(1);
}
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(
    "Node.js 22.12+ is needed. Run the Install launcher again to repair the runtime.",
  );
  process.exit(1);
}
if (fs.existsSync(path.join(directory, "install.lock"))) {
  console.error(
    "Installation is in progress. Wait for it to finish before starting the arcade.",
  );
  process.exit(1);
}
dotenv.config({ path: path.join(directory, ".env"), quiet: true });
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(
    "PORT must be a number from 1 to 65535. Check the installation's .env.",
  );
  process.exit(1);
}
const noOpen =
  options.includes("--no-open") || process.env.HOLIDAY_NO_OPEN === "1";
function openBrowser(url) {
  if (noOpen) return;
  const executable =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "rundll32.exe"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const browser = spawn(executable, args, { detached: true, stdio: "ignore" });
  browser.on("error", () => {});
  browser.unref();
}
const lock = path.join(directory, "run.lock");
try {
  fs.mkdirSync(lock);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  let owner;
  try {
    owner = JSON.parse(fs.readFileSync(path.join(lock, "owner.json"), "utf8"));
  } catch {
    console.error(
      "The start lock is incomplete. If no arcade is running, remove run.lock and try again.",
    );
    process.exit(1);
  }
  if (processAlive(owner.pid)) {
    console.log(
      `Holiday Arcade is already running.\nOpen http://localhost:${owner.port}`,
    );
    openBrowser(`http://localhost:${owner.port}`);
    process.exit(0);
  }
  fs.rmSync(lock, { recursive: true });
  fs.mkdirSync(lock);
}
const token = crypto.randomUUID();
fs.writeFileSync(
  path.join(lock, "owner.json"),
  JSON.stringify({ pid: process.pid, port, token }),
  { mode: 0o600 },
);
function releaseLock() {
  try {
    if (
      JSON.parse(fs.readFileSync(path.join(lock, "owner.json"), "utf8"))
        .token === token
    )
      fs.rmSync(lock, { recursive: true });
  } catch {}
}
process.on("exit", releaseLock);
if (fs.existsSync(path.join(directory, "install.lock"))) {
  console.error(
    "Installation started while opening the arcade. Wait for setup to finish and try again.",
  );
  process.exit(1);
}
console.log(
  "Starting the Holiday Arcade website and multiplayer server. Keep this terminal open; Ctrl+C stops both.",
);
const child = spawn(
  process.execPath,
  [path.join(directory, "app", "server", "index.js")],
  {
    cwd: path.join(directory, "app"),
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: path.join(directory, ".env"),
      HOLIDAY_DATA_DIR: path.join(directory, ".holiday-data"),
    },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  },
);
let stopping = false;
let forceTimer;
function stop() {
  if (stopping) return;
  stopping = true;
  // IPC requests a clean stop on Windows too, where child.kill cannot send POSIX signals.
  if (child.connected)
    child.send({ type: "holiday-arcade:shutdown" }, (error) => {
      if (error) child.kill();
    });
  else child.kill();
  forceTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
  forceTimer.unref();
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, stop);
child.on("error", (error) => {
  console.error(`The server could not start: ${error.message}`);
  process.exitCode = 1;
});
child.on("close", (code) => {
  clearTimeout(forceTimer);
  process.exit(code ?? (stopping ? 0 : 1));
});
// Readiness gates browser opening; never open an unrelated service occupying PORT.
for (
  let attempt = 0;
  attempt < 60 && child.exitCode === null && !stopping;
  attempt++
) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(400),
    });
    const health = await response.json();
    if (response.ok && health.ok && health.app === "Holiday Arcade") {
      openBrowser(`http://localhost:${port}`);
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}
