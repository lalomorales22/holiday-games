import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const marker = "Holiday Arcade installer v1\n";
const commandMarker = "Holiday Arcade managed command";
const pathStart = "# >>> Holiday Arcade command >>>";
const pathEnd = "# <<< Holiday Arcade command <<<";

export function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function defaultInstallDir(platform = process.platform) {
  return platform === "win32"
    ? path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "HolidayArcade",
      )
    : path.join(os.homedir(), ".holiday-arcade");
}

export function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export function runningInstallation(directory) {
  try {
    const info = JSON.parse(
      fs.readFileSync(path.join(directory, "run.lock", "owner.json"), "utf8"),
    );
    return processAlive(info.pid);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw new Error(
      "The arcade's run lock cannot be read. Stop the arcade and check run.lock before reinstalling.",
    );
  }
}

function ensureOwned(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, ".holiday-arcade-install");
  if (fs.existsSync(filename)) {
    if (fs.readFileSync(filename, "utf8") !== marker)
      throw new Error(
        "This folder belongs to a different installation. Choose an empty HOLIDAY_INSTALL_DIR.",
      );
  } else {
    if (fs.readdirSync(directory).length)
      throw new Error(
        "The install folder is not empty. Choose an empty HOLIDAY_INSTALL_DIR; existing files will not be replaced.",
      );
    fs.writeFileSync(filename, marker, { mode: 0o600, flag: "wx" });
  }
}

function runNpm(args, directory, nodePath) {
  const nodeDirectory = path.dirname(nodePath);
  const cli =
    process.platform === "win32"
      ? path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js")
      : path.resolve(
          nodeDirectory,
          "..",
          "lib",
          "node_modules",
          "npm",
          "bin",
          "npm-cli.js",
        );
  const npmEnv = {
    ...process.env,
    PATH: nodeDirectory + path.delimiter + (process.env.PATH || ""),
  };
  const result = fs.existsSync(cli)
    ? spawnSync(nodePath, [cli, ...args], {
        cwd: directory,
        env: npmEnv,
        stdio: "inherit",
      })
    : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
        cwd: directory,
        env: npmEnv,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `npm ${args[0]} failed. Your existing installation and family data were kept.`,
    );
}

function upsertPathBlock(filename, binDir) {
  const original = fs.existsSync(filename)
    ? fs.readFileSync(filename, "utf8")
    : "";
  const start = original.indexOf(pathStart);
  const end = original.indexOf(pathEnd, start);
  if (start >= 0 && end < 0)
    throw new Error(
      `Incomplete Holiday Arcade PATH block in ${filename}; repair it before reinstalling.`,
    );
  const block = `${pathStart}\ncase ":$PATH:" in\n  *${shellQuote(":" + binDir + ":")}*) ;;\n  *) export PATH=${shellQuote(binDir)}:"$PATH" ;;\nesac\n${pathEnd}`;
  const updated =
    start >= 0
      ? original.slice(0, start) + block + original.slice(end + pathEnd.length)
      : original +
        (original.endsWith("\n") || !original ? "" : "\n") +
        "\n" +
        block +
        "\n";
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, updated, { mode: 0o600 });
}

export function registerCommand({
  directory,
  nodePath,
  platform = process.platform,
  profileHome = os.homedir(),
  registerPath = true,
}) {
  const binDir = path.join(directory, "bin");
  fs.mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const runner = path.join(directory, "app", "scripts", "run-installed.js");
  const filename = path.join(
    binDir,
    platform === "win32" ? "Holiday-arcade.cmd" : "Holiday-arcade",
  );
  if (
    fs.existsSync(filename) &&
    !fs.readFileSync(filename, "utf8").includes(commandMarker)
  )
    throw new Error(
      `A different command already exists at ${filename}. It has been left alone.`,
    );
  if (platform === "win32") {
    // CMD expands percent signs even inside quotes; escape them in literal paths.
    const cmdPath = (value) => value.replaceAll("%", "%%");
    fs.writeFileSync(
      filename,
      `@echo off\r\nrem ${commandMarker}\r\nsetlocal DisableDelayedExpansion\r\n"${cmdPath(nodePath)}" "${cmdPath(runner)}" "${cmdPath(directory)}" %*\r\nexit /b %errorlevel%\r\n`,
    );
    if (registerPath) {
      const script =
        "$bin=$env:HOLIDAY_COMMAND_BIN; $current=[Environment]::GetEnvironmentVariable('Path','User'); $parts=@($current -split ';' | Where-Object { $_ -and $_.TrimEnd('\\') -ine $bin.TrimEnd('\\') }); [Environment]::SetEnvironmentVariable('Path', (($parts + $bin) -join ';'), 'User')";
      const result = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        {
          env: { ...process.env, HOLIDAY_COMMAND_BIN: binDir },
          stdio: "inherit",
        },
      );
      if (result.error || result.status !== 0)
        throw new Error(
          "Windows could not update your user PATH. Check permissions or add the installation's bin folder to your user PATH, then run setup again.",
        );
    }
  } else {
    fs.writeFileSync(
      filename,
      `#!/usr/bin/env sh\n# ${commandMarker}\nexec ${shellQuote(nodePath)} ${shellQuote(runner)} ${shellQuote(directory)} "$@"\n`,
      { mode: 0o755 },
    );
    fs.chmodSync(filename, 0o755);
    if (registerPath) {
      // Do not create .bash_profile: that would stop bash reading an existing .profile.
      const profiles = new Set([
        path.join(profileHome, ".profile"),
        path.join(profileHome, ".bashrc"),
      ]);
      for (const name of [".bash_profile", ".bash_login"])
        if (fs.existsSync(path.join(profileHome, name)))
          profiles.add(path.join(profileHome, name));
      const zshHome =
        process.env.ZDOTDIR && profileHome === os.homedir()
          ? process.env.ZDOTDIR
          : profileHome;
      profiles.add(path.join(zshHome, ".zshrc"));
      profiles.add(path.join(zshHome, ".zprofile"));
      for (const profile of profiles) upsertPathBlock(profile, binDir);
    }
  }
  return filename;
}

export async function install({
  source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  directory = process.env.HOLIDAY_INSTALL_DIR || defaultInstallDir(),
  profileHome = process.env.HOLIDAY_PROFILE_DIR || os.homedir(),
  nodePath = fs.realpathSync(process.execPath),
  npmRunner = runNpm,
  registerPath = true,
} = {}) {
  source = fs.realpathSync(source);
  directory = path.resolve(directory);
  if (/[\r\n]/.test(directory + profileHome + nodePath))
    throw new Error("Installation paths cannot contain line breaks.");
  const relative = path.relative(source, directory);
  if (
    !relative ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  )
    throw new Error(
      "Install outside the source folder so the original download can be removed safely.",
    );
  ensureOwned(directory);
  if (runningInstallation(directory))
    throw new Error(
      "Holiday Arcade is running. Press Ctrl+C in its terminal before reinstalling.",
    );
  const lock = path.join(directory, "install.lock");
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another installation is in progress. If it was interrupted, remove install.lock and try again.",
      );
    throw error;
  }
  const app = path.join(directory, "app");
  const stage = path.join(directory, ".app-" + crypto.randomUUID());
  const previous = path.join(directory, ".previous-" + crypto.randomUUID());
  let backedUp = false,
    promoted = false;
  try {
    if (runningInstallation(directory))
      throw new Error(
        "Holiday Arcade started during setup. Stop it before reinstalling.",
      );
    if (
      fs.existsSync(app) &&
      JSON.parse(fs.readFileSync(path.join(app, "package.json"), "utf8"))
        .name !== "holiday-arcade"
    )
      throw new Error(
        "The app folder contains a different application. It has been left alone.",
      );
    fs.mkdirSync(stage, { mode: 0o700 });
    for (const filename of [
      "package.json",
      "package-lock.json",
      ".env.example",
      "README.md",
      "AGENTS.md",
      "Install-Linux.sh",
      "Install-Mac.command",
      "Install-Windows.cmd",
    ])
      fs.copyFileSync(path.join(source, filename), path.join(stage, filename));
    for (const folder of ["server", "scripts", "skills", "examples", "docs"])
      fs.cpSync(path.join(source, folder), path.join(stage, folder), {
        recursive: true,
      });
    const built =
      fs.existsSync(path.join(source, "dist", "index.html")) &&
      fs.existsSync(path.join(source, "dist", "runtime", "game-runtime.js"));
    if (built) {
      fs.cpSync(path.join(source, "dist"), path.join(stage, "dist"), {
        recursive: true,
      });
      npmRunner(
        ["ci", "--omit=dev", "--no-audit", "--no-fund"],
        stage,
        nodePath,
      );
    } else {
      for (const folder of ["src", "public"])
        fs.cpSync(path.join(source, folder), path.join(stage, folder), {
          recursive: true,
        });
      for (const filename of [
        "index.html",
        "vite.config.js",
        "vite.runtime.config.js",
      ])
        fs.copyFileSync(
          path.join(source, filename),
          path.join(stage, filename),
        );
      npmRunner(
        ["ci", "--include=dev", "--no-audit", "--no-fund"],
        stage,
        nodePath,
      );
      npmRunner(["run", "build"], stage, nodePath);
      npmRunner(
        ["prune", "--omit=dev", "--no-audit", "--no-fund"],
        stage,
        nodePath,
      );
    }
    if (
      !fs.existsSync(path.join(stage, "dist", "index.html")) ||
      !fs.existsSync(path.join(stage, "dist", "runtime", "game-runtime.js"))
    )
      throw new Error(
        "The production website or game runtime is missing. Installation was not activated.",
      );
    if (fs.existsSync(app)) {
      fs.renameSync(app, previous);
      backedUp = true;
    }
    fs.renameSync(stage, app);
    promoted = true;
    const envFile = path.join(directory, ".env");
    if (!fs.existsSync(envFile))
      fs.copyFileSync(
        path.join(app, ".env.example"),
        envFile,
        fs.constants.COPYFILE_EXCL,
      );
    if (process.platform !== "win32") fs.chmodSync(envFile, 0o600);
    fs.mkdirSync(path.join(directory, ".holiday-data"), {
      recursive: true,
      mode: 0o700,
    });
    const command = registerCommand({
      directory,
      nodePath,
      profileHome,
      registerPath,
    });
    if (backedUp) {
      try {
        fs.rmSync(previous, { recursive: true });
      } catch {
        console.warn(
          `The new app is installed. The old app files could not be removed from ${previous}.`,
        );
      }
    }
    console.log(
      `\nHoliday Arcade is installed!\nApp and private data: ${directory}\nCommand: ${command}\nOpen a new terminal, then type: Holiday-arcade\nKeep its terminal open while the family plays. Press Ctrl+C to stop.\n`,
    );
    return { directory, command };
  } catch (error) {
    // Restore the working app if activation fails; private data lives outside it.
    if (promoted) fs.rmSync(app, { recursive: true, force: true });
    if (backedUp && fs.existsSync(previous)) fs.renameSync(previous, app);
    throw error;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    console.error(
      "Node.js 22.12+ is required. Use the platform Install launcher to download Node automatically.",
    );
    process.exitCode = 1;
  } else {
    try {
      await install();
    } catch (error) {
      console.error(`Installation stopped: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
