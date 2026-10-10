import { packageHouse } from "../server/package.js";
const { bytes } = await packageHouse();
console.log(
  `Home-server download created: downloads/holiday-arcade.zip (${Math.round(bytes / 1024)} KB). No family data, photos, or API keys are included.`,
);
