import fs from "node:fs";
import path from "node:path";
const safeScript = (value) => value.replace(/<\/script/gi, "<\\/script");
export function gameFrame({ game, member, world, token, staticDir }) {
  const runtime = fs.readFileSync(
    path.join(staticDir, "runtime/game-runtime.js"),
    "utf8",
  );
  const config = JSON.stringify({
    token,
    me: member,
    game: { id: game.id, name: game.name, color: game.color },
    state: world,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden;background:#dfe9d9;font-family:system-ui}canvas{display:block;width:100%;height:100%;touch-action:none}#status{position:absolute;top:15px;left:15px;right:60px;pointer-events:none;font-size:12px;font-weight:600;color:#3b5b40;background:#f8faefda;border-radius:8px;padding:10px 12px;z-index:5}button{font:inherit}</style></head><body><canvas id="game"></canvas><div id="status"></div><script>window.__HOLIDAY_CONFIG=${config};</script><script>${safeScript(runtime)}</script><script>try{${safeScript(game.code)}}catch(e){ARCADE.status('This game could not start. Try another room.');}</script></body></html>`;
}
