import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { createHouse } from "./app.js";
const house = createHouse({
  dataDir: path.resolve(process.env.HOLIDAY_DATA_DIR || ".holiday-data"),
});
const port = Number(process.env.PORT || 3000);
house.server.listen(port, "0.0.0.0", () => {
  console.log(
    `\n  Holiday Arcade is open!\n  This computer: http://localhost:${port}`,
  );
  for (const entries of Object.values(os.networkInterfaces()))
    for (const entry of entries || [])
      if (entry.family === "IPv4" && !entry.internal)
        console.log(`  Share on your Wi-Fi: http://${entry.address}:${port}`);
  console.log(`  Family invite code: ${house.store.data.joinCode}`);
  if (house.store.initialPassword)
    console.log(`  Host password (save this): ${house.store.initialPassword}`);
  console.log(
    `  AI designer: ${house.store.getKey() ? "connected" : "demo mode — configure in Host settings"}\n`,
  );
});
house.server.on("error", async (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Close the other server or change PORT in .env.`
      : `The arcade could not listen: ${error.message}`,
  );
  await house.close();
  process.exit(1);
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await house.close();
  process.exit(0);
}
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"])
  process.on(signal, shutdown);
process.on("message", (message) => {
  if (message?.type === "holiday-arcade:shutdown") shutdown();
});
if (process.send) process.once("disconnect", shutdown);
