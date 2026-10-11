import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { install } from "../scripts/install.js";

const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
function fixture(t, { built = true } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "holiday-installer-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(temp, "source"),
    directory = path.join(temp, "Arcade's home with spaces"),
    profileHome = path.join(temp, "profile");
  fs.mkdirSync(source);
  fs.mkdirSync(profileHome);
  fs.writeFileSync(
    path.join(profileHome, ".bashrc"),
    "# Keep my shell settings\nexport ARCADE_EXISTING_SETTING=kept\n",
  );
  fs.writeFileSync(
    path.join(profileHome, ".profile"),
    "# Existing login settings\n",
  );
  for (const file of [
    "package.json",
    "package-lock.json",
    ".env.example",
    "README.md",
    "AGENTS.md",
    "Install-Linux.sh",
    "Install-Mac.command",
    "Install-Windows.cmd",
  ])
    fs.copyFileSync(path.join(project, file), path.join(source, file));
  for (const folder of ["server", "scripts", "skills", "examples", "docs"])
    fs.cpSync(path.join(project, folder), path.join(source, folder), {
      recursive: true,
    });
  if (built) {
    fs.mkdirSync(path.join(source, "dist", "runtime"), { recursive: true });
    fs.writeFileSync(path.join(source, "dist", "index.html"), "old app");
    fs.writeFileSync(
      path.join(source, "dist", "runtime", "game-runtime.js"),
      "runtime",
    );
  } else {
    for (const folder of ["src", "public"])
      fs.mkdirSync(path.join(source, folder));
    for (const file of [
      "index.html",
      "vite.config.js",
      "vite.runtime.config.js",
    ])
      fs.writeFileSync(path.join(source, file), "source");
  }
  // The shared installer tests use existing dependencies without network access.
  // Actual npm/bootstrap installation is checked separately against the packaged app.
  const npmRunner = (args, stage) => {
    if (args[0] === "ci")
      fs.symlinkSync(
        path.join(project, "node_modules"),
        path.join(stage, "node_modules"),
        "junction",
      );
    if (args[0] === "run") {
      fs.mkdirSync(path.join(stage, "dist", "runtime"), { recursive: true });
      fs.writeFileSync(
        path.join(stage, "dist", "index.html"),
        "built from source",
      );
      fs.writeFileSync(
        path.join(stage, "dist", "runtime", "game-runtime.js"),
        "built runtime",
      );
    }
  };
  return { source, directory, profileHome, npmRunner };
}

test("installation creates a command usable from another folder, handles quoted paths, and preserves shell settings", async (t) => {
  const options = fixture(t);
  const { command } = await install(options);
  assert.ok(fs.statSync(command).mode & 0o100);
  assert.equal(
    fs.existsSync(path.join(options.profileHome, ".bash_profile")),
    false,
  );
  const result = spawnSync(
    "bash",
    [
      "--noprofile",
      "--norc",
      "-c",
      'source "$HOLIDAY_TEST_PROFILE"; test "$ARCADE_EXISTING_SETTING" = kept && command -v Holiday-arcade && Holiday-arcade --help',
    ],
    {
      cwd: os.tmpdir(),
      env: {
        ...process.env,
        HOLIDAY_TEST_PROFILE: path.join(options.profileHome, ".bashrc"),
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(command));
  assert.match(
    result.stdout,
    /website and multiplayer WebSocket server together/,
  );
});

test("reinstall replaces app files, keeps private data, and registers PATH just once", async (t) => {
  const options = fixture(t);
  await install(options);
  const env = path.join(options.directory, ".env"),
    saved = path.join(options.directory, ".holiday-data", "house.json");
  fs.writeFileSync(env, "PORT=4321\n# private settings\n");
  fs.writeFileSync(saved, '{"familyName":"Preserved family"}');
  fs.writeFileSync(path.join(options.source, "dist", "index.html"), "new app");
  // Private files in a source folder must never migrate into an installation.
  fs.writeFileSync(
    path.join(options.source, ".env"),
    "DO_NOT_COPY=private-source\n",
  );
  fs.mkdirSync(path.join(options.source, ".holiday-data"));
  fs.writeFileSync(
    path.join(options.source, ".holiday-data", "photo"),
    "private-source",
  );
  await install(options);
  assert.equal(fs.readFileSync(env, "utf8"), "PORT=4321\n# private settings\n");
  assert.equal(
    fs.readFileSync(saved, "utf8"),
    '{"familyName":"Preserved family"}',
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.directory, "app", "dist", "index.html"),
      "utf8",
    ),
    "new app",
  );
  assert.equal(
    fs.existsSync(path.join(options.directory, "app", ".env")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(options.directory, "app", ".holiday-data")),
    false,
  );
  for (const file of [".bashrc", ".profile", ".zshrc", ".zprofile"]) {
    const content = fs.readFileSync(
      path.join(options.profileHome, file),
      "utf8",
    );
    assert.equal(content.split("# >>> Holiday Arcade command >>>").length, 2);
  }
  assert.equal(
    fs.existsSync(path.join(options.directory, "install.lock")),
    false,
  );
});

test("failed dependency installation leaves the previous working app and family data intact", async (t) => {
  const options = fixture(t);
  await install(options);
  fs.writeFileSync(
    path.join(options.directory, ".holiday-data", "house.json"),
    "saved world",
  );
  fs.writeFileSync(
    path.join(options.source, "dist", "index.html"),
    "failed new app",
  );
  await assert.rejects(
    install({
      ...options,
      npmRunner: () => {
        throw new Error("Simulated registry outage");
      },
    }),
    /registry outage/,
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.directory, "app", "dist", "index.html"),
      "utf8",
    ),
    "old app",
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.directory, ".holiday-data", "house.json"),
      "utf8",
    ),
    "saved world",
  );
  assert.equal(
    fs.existsSync(path.join(options.directory, "install.lock")),
    false,
  );
  assert.ok(
    fs
      .readdirSync(options.directory)
      .every((name) => !name.startsWith(".app-")),
  );
});

test("installation refuses an unrelated folder and a currently running arcade", async (t) => {
  const options = fixture(t);
  fs.mkdirSync(options.directory);
  fs.writeFileSync(path.join(options.directory, "keep.txt"), "my files");
  await assert.rejects(install(options), /not empty/);
  assert.equal(
    fs.readFileSync(path.join(options.directory, "keep.txt"), "utf8"),
    "my files",
  );
  fs.unlinkSync(path.join(options.directory, "keep.txt"));
  await install(options);
  fs.mkdirSync(path.join(options.directory, "run.lock"));
  fs.writeFileSync(
    path.join(options.directory, "run.lock", "owner.json"),
    JSON.stringify({ pid: process.pid, port: 3000 }),
  );
  await assert.rejects(install(options), /running/);
  assert.equal(
    fs.readFileSync(
      path.join(options.directory, "app", "dist", "index.html"),
      "utf8",
    ),
    "old app",
  );
});

test("source installation builds a complete website before activation", async (t) => {
  const options = fixture(t, { built: false });
  await install(options);
  assert.equal(
    fs.readFileSync(
      path.join(options.directory, "app", "dist", "index.html"),
      "utf8",
    ),
    "built from source",
  );
  assert.equal(
    fs.readFileSync(
      path.join(options.directory, "app", "dist", "runtime", "game-runtime.js"),
      "utf8",
    ),
    "built runtime",
  );
});
