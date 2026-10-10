import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";

export async function packageHouse(root = process.cwd()) {
  const directory = path.join(root, "downloads");
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, "holiday-arcade.zip"),
    tmp = filename + ".tmp";
  const output = fs.createWriteStream(tmp),
    archive = archiver("zip", { zlib: { level: 9 } });
  const finished = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.on("warning", reject);
  });
  archive.pipe(output);
  for (const file of [
    "package.json",
    "package-lock.json",
    ".env.example",
    "README.md",
    "AGENTS.md",
  ])
    archive.file(path.join(root, file), { name: `holiday-arcade/${file}` });
  for (const folder of ["server", "dist", "skills", "scripts", "examples", "docs"])
    archive.directory(path.join(root, folder), `holiday-arcade/${folder}`);
  for (const [source, name] of [
    ["windows.cmd", "Start-Windows.cmd"],
    ["mac.command", "Start-Mac.command"],
    ["linux.sh", "Start-Linux.sh"],
  ])
    archive.file(path.join(root, "scripts", "launchers", source), {
      name: `holiday-arcade/${name}`,
      mode: source.endsWith(".cmd") ? 0o644 : 0o755,
    });
  await archive.finalize();
  await finished;
  fs.renameSync(tmp, filename);
  return { filename, bytes: archive.pointer() };
}
