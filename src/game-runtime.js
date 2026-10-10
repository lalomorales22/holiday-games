import * as THREE from "three";
// This module runs inside an opaque-origin, network-disabled iframe.
const config = window.__HOLIDAY_CONFIG;
const stateListeners = new Set(),
  eventListeners = new Set(),
  resizeListeners = new Set();
let state = config.state;
const send = (type, payload) =>
  window.parent.postMessage(
    { channel: "holiday-arcade", token: config.token, type, payload },
    "*",
  );
window.THREE = THREE;
window.ARCADE = Object.freeze({
  canvas: document.getElementById("game"),
  me: Object.freeze(config.me),
  game: Object.freeze(config.game),
  onState(callback) {
    stateListeners.add(callback);
    if (state) callback(state);
    return () => stateListeners.delete(callback);
  },
  onEvent(callback) {
    eventListeners.add(callback);
    return () => eventListeners.delete(callback);
  },
  onResize(callback) {
    resizeListeners.add(callback);
    callback(innerWidth, innerHeight);
    return () => resizeListeners.delete(callback);
  },
  emit(type, payload = {}) {
    send("event", { type, payload });
  },
  set(key, value) {
    send("set", { key, value });
  },
  score(delta = 1) {
    send("score", delta);
  },
  input(x, z) {
    send("input", { x, z });
  },
  status(text) {
    document.getElementById("status").textContent = String(text).slice(0, 160);
  },
  get state() {
    return state;
  },
});
window.addEventListener("message", (event) => {
  const data = event.data;
  if (
    event.source !== window.parent ||
    data?.channel !== "holiday-arcade" ||
    data.token !== config.token
  )
    return;
  if (data.type === "state") {
    state = data.payload;
    for (const callback of stateListeners) callback(state);
  }
  if (data.type === "event")
    for (const callback of eventListeners) callback(data.payload);
});
window.addEventListener("resize", () => {
  for (const callback of resizeListeners) callback(innerWidth, innerHeight);
});
const keys = new Set();
const movement = () => ({
  x:
    (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
    (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
  z:
    (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
    (keys.has("w") || keys.has("arrowup") ? 1 : 0),
});
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input,textarea,[contenteditable]")) return;
  const key = event.key.toLowerCase();
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ].includes(key)
  ) {
    event.preventDefault();
    keys.add(key);
  }
});
document.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
  send("input", movement());
});
window.addEventListener("blur", () => {
  keys.clear();
  send("input", { x: 0, z: 0 });
});
setInterval(() => {
  if (document.hasFocus()) send("input", movement());
}, 50);
window.addEventListener("error", () => {
  document.getElementById("status").textContent =
    "This game hit a snag. Return to the living room and try another game.";
});
send("ready", {});
