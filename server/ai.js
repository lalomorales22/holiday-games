import { gameSchema, demoGame, demoReply } from "./games.js";
import vm from "node:vm";

const guide = `You are the friendly game designer inside Holiday Arcade, a family multiplayer arcade. Help a family member make a game in a short conversation. The engine supports collect (competitive collection race), snowball (friendly projectile battle), freeze (camera freeze dance), build (collaborative block world), and custom (AI-written browser JavaScript with Three.js and the ARCADE multiplayer SDK). Themes: garden, winter, candy, space. Customize names, colors, duration (30-180 seconds), collection targets (5-50), descriptions and instructions. Custom games can implement mazes, treasure hunts, obstacle courses, puzzles and other simple ideas, using built-in Three.js shapes and shared player movement. No external assets, packages, network access, or host filesystem access. Camera video stays on the player's device; camera games use the freeze engine. Ask one simple question at a time. Keep replies under 130 words. All games support multiple players. Do not promise platform installers, downloads of external assets, or AAA games.`;
const sdk = `For a custom game, include a code string with complete plain JavaScript (no imports, modules, JSX, eval, external URLs, or external assets). It runs in an opaque-origin sandbox with globals THREE and ARCADE. Use new THREE.WebGLRenderer({canvas:ARCADE.canvas,antialias:true}), scene, camera, lights and procedural shapes. ARCADE.me is {id,name,color,avatar}; ARCADE.game is {id,name,color}; ARCADE.onState(cb) calls cb({room,players:[{id,name,color,avatar,x,z}],round:{number,remaining,scores,result},custom:{...sharedValues}}) initially and at 10Hz. A state may be null before room initialization; handle that. Round remaining can be null until the family starts a round. Render all players at server-provided x,z positions in bounds x -9..9,z -8..8. WASD/arrows and phone joystick already control movement; do not implement conflicting movement. ARCADE.onResize((width,height)=>...) initializes and updates renderer/camera dimensions. Use requestAnimationFrame for render. ARCADE.set(key,value) shares a JSON value (max 2KB) with everyone in this game, at most 64 keys, persisted across restarts. ARCADE.emit(type,payload) sends a room-scoped JSON event. ARCADE.onEvent(cb) receives {playerId,type,payload}. ARCADE.score(delta) adds at most 10 points once per second during an active round; scores are intended for friendly family play. ARCADE.status(text) updates a text overlay. Build the requested mechanics completely: e.g. store collectible flags with stable keys and award points when the local player enters a distance threshold; avoid repeatedly awarding the same thing each frame. Scope per-round data by resetting when round.number changes. Shared state is last-write-wins, no atomic transactions. Include at least one real interactive mechanic and meaningful instructions. THREE, window, document, Math and browser timers are available. The HTML already contains a full-size canvas#game; create your own overlay buttons only if essential, with touch-friendly sizing. Always render the whole playable area with a camera and actual geometry; handle resize and dispose removed objects. No API requests or camera access. Keep code under 18,000 characters.`;

async function completion(store, messages, json = false) {
  const url = store.env.HOLIDAY_AI_URL || store.data.aiUrl;
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
    )
  )
    throw new Error(
      "AI providers require HTTPS, except a local Ollama server.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${store.getKey()}`,
      },
      body: JSON.stringify({
        model: store.env.HOLIDAY_AI_MODEL || store.data.aiModel,
        messages,
        max_tokens: json ? 5000 : 350,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!response.ok)
      throw new Error(
        `The AI provider returned ${response.status}. The host can check the API key, model, and provider URL in settings.`,
      );
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length > 40000)
      throw new Error(
        "The AI provider returned an unexpected response. Please try again.",
      );
    return content;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("The AI provider took too long. Please try again.");
    if (error instanceof TypeError)
      throw new Error(
        "Could not reach the AI provider. The host can check the provider URL and connection.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export async function chat(store, messages) {
  return store.getKey()
    ? completion(store, [{ role: "system", content: guide }, ...messages])
    : demoReply(messages);
}
export async function generateGame(store, messages) {
  if (!store.getKey()) return demoGame(messages);
  const content = await completion(
    store,
    [
      {
        role: "system",
        content: `${guide}\nReturn ONLY a JSON object with these fields: name (3-45 chars), description (10-220 chars), kind (collect|snowball|freeze|build|custom), theme (garden|winter|candy|space), color (hex #RRGGBB), duration (integer 30-180), target (integer 5-50), instructions (10-300 chars, accurately describe the chosen mechanic). Prefer the built-in engine for an idea it already supports. Otherwise build a custom game and include code. ${sdk} Build the family member's final agreed idea. No markdown.`,
      },
      ...messages,
    ],
    true,
  );
  try {
    const game = gameSchema.parse(
      JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")),
    );
    if (game.kind === "custom") new vm.Script(game.code);
    return game;
  } catch {
    throw new Error(
      "The AI returned a game plan the engine could not use. Refine your idea and try again.",
    );
  }
}
