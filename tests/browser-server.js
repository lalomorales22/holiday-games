import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHouse } from "../server/app.js";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "holiday-browser-"));
const house = createHouse({
  dataDir,
  env: {
    HOLIDAY_JOIN_CODE: "BROWSERTEST",
    HOLIDAY_HOST_PASSWORD: "browser-test-host",
  },
});
house.server.listen(4173, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await house.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    process.exit(0);
  });
