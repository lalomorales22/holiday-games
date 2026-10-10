import "dotenv/config";
import os from "node:os";
import { createHouse } from "./app.js";
const house = createHouse();
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
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await house.close();
    process.exit(0);
  });
