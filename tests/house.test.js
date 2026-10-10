import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { io } from "socket.io-client";
import { createHouse } from "../server/app.js";
import { gameSchema } from "../server/games.js";

async function fixture(t, extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "holiday-test-"));
  const env = {
    HOLIDAY_HOST_PASSWORD: "test-host-password",
    HOLIDAY_JOIN_CODE: "FAMILYTEST",
    ...extra,
  };
  const house = createHouse({ dataDir, env, staticDir: "/not-present" });
  await new Promise((resolve) => house.server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${house.server.address().port}`;
  t.after(async () => {
    await house.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  async function request(route, body, cookie, origin) {
    const res = await fetch(url + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function join(name) {
    const result = await request("/api/join", { name, code: "FAMILYTEST" });
    assert.equal(result.status, 200);
    return result;
  }
  async function connect(cookie) {
    const socket = io(url, {
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie },
      forceNew: true,
      reconnection: false,
    });
    t.after(() => socket.disconnect());
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return socket;
  }
  return { ...house, url, request, join, connect, dataDir };
}
function eventUntil(socket, event, predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    const handler = (value) => {
      if (predicate(value)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(value);
      }
    };
    socket.on(event, handler);
  });
}
async function enter(socket, id) {
  const result = await socket.timeout(3000).emitWithAck("enter", id);
  assert.equal(result.ok, true);
}
async function waitForJob(f, jobId, cookie) {
  for (let i = 0; i < 50; i++) {
    const { data } = await f.request("/api/bootstrap", undefined, cookie);
    const job = data.jobs.find((j) => j.id === jobId);
    if (job && ["ready", "failed"].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Job did not finish");
}

test("family access and host-only secrets: rejects unauthenticated writes and foreign origins", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/api/health")).data.ok, true);
  assert.equal(
    (
      await f.request("/api/studio/build", {
        messages: [{ role: "user", content: "cookies" }],
      })
    ).status,
    401,
  );
  assert.equal((await f.request("/api/host/settings")).status, 401);
  assert.equal(
    (await f.request("/api/join", { name: "Alex", code: "wrong" })).status,
    403,
  );
  assert.equal(
    (
      await f.request(
        "/api/join",
        { name: "Alex", code: "FAMILYTEST" },
        null,
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  const member = await f.join("Alex");
  assert.equal(
    (await f.request("/api/bootstrap", undefined, member.cookie)).data.user
      .name,
    "Alex",
  );
  assert.equal(
    (await f.request("/api/host/settings", undefined, member.cookie)).status,
    401,
  );
  const host = await f.request(
    "/api/host/login",
    { password: "test-host-password" },
    member.cookie,
  );
  assert.equal(host.status, 200);
  const save = await f.request(
    "/api/host/settings",
    {
      familyName: "The Morales family",
      aiUrl: "https://api.openai.com/v1",
      aiModel: "test-model",
      apiKey: "test-key-for-encryption",
    },
    host.cookie,
  );
  assert.equal(save.status, 200);
  const settings = await f.request(
    "/api/host/settings",
    undefined,
    host.cookie,
  );
  assert.equal(settings.data.aiEnabled, true);
  assert.equal(
    JSON.stringify(settings.data).includes("test-key-for-encryption"),
    false,
  );
  assert.equal(
    fs
      .readFileSync(path.join(f.dataDir, "house.json"), "utf8")
      .includes("test-key-for-encryption"),
    false,
  );
  assert.equal(f.store.getKey(), "test-key-for-encryption");
  assert.equal(
    (await f.request("/api/bootstrap", undefined, host.cookie)).data.familyName,
    "The Morales family",
  );
  assert.equal(
    (
      await f.request(
        "/api/host/settings",
        {
          familyName: "Family",
          aiUrl: "http://external.example/v1",
          aiModel: "test",
        },
        host.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request("/api/join", {
        name: "Bad avatar",
        code: "FAMILYTEST",
        avatar: "data:image/svg+xml;base64,abcd",
      })
    ).status,
    400,
  );
});

test("two family members share presence, authoritative movement, and room-scoped chat", async (t) => {
  const f = await fixture(t),
    alice = await f.join("Alice"),
    bob = await f.join("Bob");
  const a = await f.connect(alice.cookie),
    b = await f.connect(bob.cookie);
  const together = await eventUntil(
    a,
    "world",
    (w) => w.room === "hub" && w.players.length === 2,
  );
  assert.deepEqual(together.players.map((p) => p.name).sort(), [
    "Alice",
    "Bob",
  ]);
  const before = together.players.find((p) => p.id === alice.data.id).x;
  a.emit("input", { x: 100000, z: 0 });
  const moved = await eventUntil(
    b,
    "world",
    (w) => w.players.find((p) => p.id === alice.data.id)?.x > before + 0.4,
  );
  assert.ok(
    moved.players.find((p) => p.id === alice.data.id).x < before + 2,
    "server normalizes movement",
  );
  const chatReceived = eventUntil(b, "chat", (m) => m.text === "Hello family!");
  a.emit("chat", "Hello family!");
  assert.equal((await chatReceived).name, "Alice");
  await enter(a, "cookie-quest");
  const isolated = await eventUntil(
    b,
    "world",
    (w) => w.room === "hub" && w.players.length === 1,
  );
  assert.equal(isolated.players[0].name, "Bob");
  assert.equal(
    (await a.timeout(3000).emitWithAck("enter", "missing-room")).error,
    "That game is not available.",
  );
});

test("collection rounds update shared scores and announce a winner", async (t) => {
  const f = await fixture(t),
    alice = await f.join("Alice"),
    bob = await f.join("Bob");
  const a = await f.connect(alice.cookie),
    b = await f.connect(bob.cookie);
  await enter(a, "cookie-quest");
  await enter(b, "cookie-quest");
  a.emit("start-round");
  await eventUntil(a, "world", (w) => w.round?.remaining > 0);
  const round = f.world.snapshot("cookie-quest");
  // Put a server-owned pickup on the known player location, then exercise the real tick.
  const p = f.world.players.get(alice.data.id);
  const pickup = round.round.pickups[0];
  pickup.x = p.x;
  pickup.z = p.z;
  const updated = await eventUntil(
    b,
    "world",
    (w) => w.round?.scores?.[alice.data.id] === 1,
  );
  assert.equal(updated.round.pickups.length, 19);
  for (const item of f.world.snapshot("cookie-quest").round.pickups) {
    item.x = p.x;
    item.z = p.z;
  }
  const result = await eventUntil(b, "world", (w) => !!w.round?.result);
  assert.equal(result.round.result.name, "Alice");
  assert.equal(result.round.result.score, 20);
});

test("snowball collisions score for the thrower and can be seen by both players", async (t) => {
  const f = await fixture(t),
    alice = await f.join("Alice"),
    bob = await f.join("Bob");
  const a = await f.connect(alice.cookie),
    b = await f.connect(bob.cookie);
  await enter(a, "snowball-social");
  await enter(b, "snowball-social");
  f.world.players.get(bob.data.id).x = 2;
  a.emit("start-round");
  await eventUntil(a, "world", (w) => w.round?.remaining > 0);
  a.emit("action", {});
  const hit = await eventUntil(
    b,
    "world",
    (w) => w.round?.scores?.[alice.data.id] === 1,
  );
  assert.equal(hit.round.scores[bob.data.id], 0);
});

test("shared building, owner-specific undo, and worlds persist across server restarts", async (t) => {
  const f = await fixture(t),
    alice = await f.join("Alice"),
    bob = await f.join("Bob");
  const a = await f.connect(alice.cookie),
    b = await f.connect(bob.cookie);
  await enter(a, "little-world");
  await enter(b, "little-world");
  a.emit("action", { color: "#a69aca" });
  const built = await eventUntil(b, "world", (w) => w.blocks?.length === 1);
  assert.equal(built.blocks[0].owner, alice.data.id);
  assert.equal(built.blocks[0].color, "#a69aca");
  b.emit("action", { undo: true });
  assert.equal(
    (await eventUntil(a, "world", (w) => w.blocks?.length === 1)).blocks.length,
    1,
  );
  await f.close();
  const restored = createHouse({
    dataDir: f.dataDir,
    env: {},
    staticDir: "/not-present",
  });
  t.after(() => restored.close());
  assert.equal(restored.store.data.blocks["little-world"].length, 1);
  assert.equal(restored.store.data.members.length, 2);
  assert.equal(restored.store.initialPassword, null);
});

test("camera motion only scores an active freeze game and invalid telemetry is ignored", async (t) => {
  const f = await fixture(t),
    alice = await f.join("Alice"),
    a = await f.connect(alice.cookie);
  await enter(a, "freeze-frame");
  a.emit("camera-motion", 0.1);
  assert.equal(
    (await eventUntil(a, "world", (w) => w.room === "freeze-frame")).round
      .scores[alice.data.id],
    undefined,
  );
  a.emit("start-round");
  await eventUntil(a, "world", (w) => w.round?.phase === "dance");
  a.emit("camera-motion", 2);
  a.emit("camera-motion", 0.1);
  const scored = await eventUntil(
    a,
    "world",
    (w) => w.round?.scores[alice.data.id] === 1,
  );
  assert.equal(scored.round.scores[alice.data.id], 1);
});

test("demo chat -> background build -> persistent playable game; job metadata stays private", async (t) => {
  const f = await fixture(t),
    alice = await f.join("Alice"),
    bob = await f.join("Bob");
  const messages = [
    { role: "user", content: "Make a cookie collection race in outer space" },
  ];
  const response = await f.request(
    "/api/studio/chat",
    { messages },
    alice.cookie,
  );
  assert.equal(response.status, 200);
  assert.equal(response.data.demo, true);
  const { data: job, status } = await f.request(
    "/api/studio/build",
    { messages },
    alice.cookie,
  );
  assert.equal(status, 202);
  const complete = await waitForJob(f, job.id, alice.cookie);
  assert.equal(complete.status, "ready");
  const library = (await f.request("/api/bootstrap", undefined, bob.cookie))
    .data;
  const game = library.games.find((g) => g.id === complete.gameId);
  assert.equal(game.kind, "collect");
  assert.equal(game.theme, "space");
  assert.equal(game.creator, "Alice");
  assert.ok(gameSchema.safeParse(game).success);
  assert.equal(library.jobs.length, 0);
  const socket = await f.connect(bob.cookie);
  await enter(socket, game.id);
  socket.emit("start-round");
  assert.ok(
    (await eventUntil(socket, "world", (w) => w.round?.remaining > 0)).round
      .pickups.length > 0,
  );
  assert.ok(
    JSON.parse(fs.readFileSync(path.join(f.dataDir, "house.json"))).games.some(
      (g) => g.id === game.id,
    ),
  );
});

test("OpenAI-compatible transport authenticates on the server and validates the generated plan", async (t) => {
  let received;
  const provider = createServer(async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    received = {
      path: req.url,
      auth: req.headers.authorization,
      body: JSON.parse(body),
    };
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Moon Cookies",
                description: "Collect cookies together on a little moon.",
                kind: "collect",
                theme: "space",
                color: "#b9acdf",
                duration: 45,
                target: 8,
                instructions:
                  "Move with the joystick and collect the cookies. Most cookies wins.",
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => provider.close(resolve)));
  const f = await fixture(t, {
    HOLIDAY_AI_URL: `http://127.0.0.1:${provider.address().port}/v1`,
    HOLIDAY_AI_KEY: "local-test-key",
    HOLIDAY_AI_MODEL: "mock-model",
  });
  const alice = await f.join("Alice");
  const { data: job } = await f.request(
    "/api/studio/build",
    {
      messages: [{ role: "user", content: "I want a cookie race on the moon" }],
    },
    alice.cookie,
  );
  const complete = await waitForJob(f, job.id, alice.cookie);
  assert.equal(complete.status, "ready");
  assert.equal(received.path, "/v1/chat/completions");
  assert.equal(received.auth, "Bearer local-test-key");
  assert.equal(received.body.model, "mock-model");
  assert.deepEqual(received.body.response_format, { type: "json_object" });
  assert.equal(f.store.data.games.at(-1).name, "Moon Cookies");
  assert.equal(
    JSON.stringify(
      (await f.request("/api/bootstrap", undefined, alice.cookie)).data,
    ).includes("local-test-key"),
    false,
  );
});

test("AI failures are reported as failed jobs without publishing broken games", async (t) => {
  const provider = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          { message: { content: '{"kind":"arbitrary-executable-code"}' } },
        ],
      }),
    );
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => provider.close(resolve)));
  const f = await fixture(t, {
      HOLIDAY_AI_URL: `http://127.0.0.1:${provider.address().port}/v1`,
      HOLIDAY_AI_KEY: "local-test-key",
    }),
    alice = await f.join("Alice");
  const { data: job } = await f.request(
    "/api/studio/build",
    { messages: [{ role: "user", content: "A game" }] },
    alice.cookie,
  );
  const complete = await waitForJob(f, job.id, alice.cookie);
  assert.equal(complete.status, "failed");
  assert.match(complete.error, /could not use/);
  assert.equal(f.store.data.games.length, 4);
});

test("custom game bridge scopes events, limits scores and validates persistent shared JSON state", async (t) => {
  const f = await fixture(t),
    alice = await f.join("Alice"),
    bob = await f.join("Bob");
  f.store.data.games.push({
    id: "custom-test",
    name: "Treasure Garden",
    description: "A custom world for the family.",
    kind: "custom",
    theme: "garden",
    color: "#b495cc",
    duration: 60,
    target: 10,
    instructions: "Explore the garden together.",
    code: 'ARCADE.status("Family treasure garden");',
    creator: "Alice",
  });
  const a = await f.connect(alice.cookie),
    b = await f.connect(bob.cookie);
  await enter(a, "custom-test");
  await enter(b, "custom-test");
  const event = eventUntil(b, "custom-event", (e) => e.type === "hello");
  a.emit("custom-event", { type: "hello", payload: { greeting: "together" } });
  assert.equal((await event).playerId, alice.data.id);
  a.emit("custom-set", { key: "familyFlag", value: { color: "purple" } });
  const state = await eventUntil(
    b,
    "world",
    (w) => w.custom?.familyFlag?.color === "purple",
  );
  assert.equal(state.custom.familyFlag.color, "purple");
  a.emit("custom-set", { key: "__proto__", value: { polluted: true } });
  a.emit("custom-set", { key: "oversize", value: "x".repeat(3000) });
  a.emit("custom-score", 10);
  const before = await eventUntil(b, "world", (w) => w.room === "custom-test");
  assert.equal(Object.hasOwn(before.custom, "__proto__"), false);
  assert.equal(before.custom.oversize, undefined);
  assert.equal(before.round.scores[alice.data.id], undefined);
  a.emit("start-round");
  await eventUntil(a, "world", (w) => w.round?.remaining > 0);
  a.emit("custom-score", 10000);
  a.emit("custom-score", 2);
  a.emit("custom-score", 2);
  const score = await eventUntil(
    b,
    "world",
    (w) => w.round?.scores[alice.data.id] === 2,
  );
  assert.equal(score.round.scores[alice.data.id], 2);
  await f.close();
  const saved = JSON.parse(fs.readFileSync(path.join(f.dataDir, "house.json")));
  assert.deepEqual(saved.custom["custom-test"].familyFlag, { color: "purple" });
});

test("host password can be recovered through an explicit environment override without losing games", async (t) => {
  const f = await fixture(t);
  f.store.data.familyName = "Keep this family";
  f.store.save();
  await f.close();
  const restored = createHouse({
    dataDir: f.dataDir,
    env: { HOLIDAY_HOST_PASSWORD: "new-host-password" },
    staticDir: "/not-present",
  });
  t.after(() => restored.close());
  await new Promise((resolve) =>
    restored.server.listen(0, "127.0.0.1", resolve),
  );
  const result = await fetch(
    `http://127.0.0.1:${restored.server.address().port}/api/host/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "new-host-password" }),
    },
  );
  assert.equal(result.status, 200);
  assert.equal(restored.store.data.familyName, "Keep this family");
  assert.equal(restored.store.data.games.length, 4);
});
