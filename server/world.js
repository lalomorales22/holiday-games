import crypto from "node:crypto";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createWorld(io, store, sessionFor) {
  const players = new Map();
  const rounds = new Map();
  const bullets = [];
  const lastAction = new Map();
  let saveTimer = null;
  function saveCustom() {
    if (!saveTimer) {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        store.save();
      }, 500);
      saveTimer.unref();
    }
  }
  function customAllowed(p) {
    const now = Date.now();
    if (now - (p.customAt || 0) > 1000) {
      p.customAt = now;
      p.customCount = 0;
    }
    return (
      ++p.customCount <= 25 &&
      store.data.games.some((g) => g.id === p.room && g.kind === "custom")
    );
  }
  function smallJson(value) {
    try {
      return JSON.stringify(value ?? null).length <= 2048;
    } catch {
      return false;
    }
  }
  function getRound(id) {
    if (!rounds.has(id))
      rounds.set(id, {
        started: 0,
        number: 0,
        scores: {},
        pickups: [],
        result: null,
      });
    return rounds.get(id);
  }
  function startRound(id) {
    const game = store.data.games.find((g) => g.id === id);
    const r = getRound(id);
    r.started = Date.now();
    r.number++;
    r.scores = {};
    r.result = null;
    r.pickups = Array.from({ length: game.target }, (_, i) => ({
      id: i,
      x: Math.random() * 15 - 7.5,
      z: Math.random() * 13 - 6.5,
    }));
    for (const p of players.values()) if (p.room === id) r.scores[p.id] = 0;
  }
  const publicPlayer = (p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    color: p.color,
    x: p.x,
    z: p.z,
    room: p.room,
  });
  function snapshot(room) {
    const game = store.data.games.find((g) => g.id === room);
    const r = game ? getRound(room) : null;
    const remaining = r?.started
      ? Math.max(0, game.duration - (Date.now() - r.started) / 1000)
      : null;
    return {
      room,
      players: [...players.values()]
        .filter((p) => p.room === room)
        .map(publicPlayer),
      round: r
        ? {
            number: r.number,
            remaining,
            scores: r.scores,
            pickups: r.pickups,
            result: r.result,
            phase:
              game.kind === "freeze" && remaining > 0
                ? Math.floor((Date.now() - r.started) / 4000) % 2 === 0
                  ? "dance"
                  : "freeze"
                : null,
          }
        : null,
      bullets: bullets.filter((b) => b.room === room),
      blocks: store.data.blocks[room] || [],
      custom: store.data.custom?.[room] || {},
    };
  }
  function presence() {
    io.emit("presence", [...players.values()].map(publicPlayer));
  }
  io.use((socket, next) => {
    const session = sessionFor(socket.request);
    if (!session?.memberId)
      return next(new Error("Join the family before connecting."));
    socket.memberId = session.memberId;
    next();
  });
  io.on("connection", (socket) => {
    const member = store.data.members.find((m) => m.id === socket.memberId);
    if (!member) return socket.disconnect(true);
    const existing = players.get(member.id);
    if (existing) io.sockets.sockets.get(existing.socketId)?.disconnect(true);
    const p = {
      ...member,
      socketId: socket.id,
      x: 0,
      z: 5,
      room: "hub",
      input: { x: 0, z: 0 },
    };
    players.set(p.id, p);
    socket.join("hub");
    presence();
    socket.on("enter", (id, done) => {
      if (
        typeof id !== "string" ||
        (id !== "hub" && !store.data.games.some((g) => g.id === id))
      )
        return done?.({ error: "That game is not available." });
      socket.leave(p.room);
      p.room = id;
      p.x = 0;
      p.z = 4;
      p.input = { x: 0, z: 0 };
      socket.join(id);
      presence();
      socket.emit("world", snapshot(id));
      done?.({ ok: true });
    });
    socket.on("input", (value) => {
      if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.z))
        return;
      const length = Math.max(1, Math.hypot(value.x, value.z));
      p.input = { x: value.x / length, z: value.z / length };
      p.inputAt = Date.now();
    });
    socket.on("start-round", () => {
      if (p.room === "hub") return;
      const r = getRound(p.room);
      if (r.started && !r.result) return;
      startRound(p.room);
    });
    socket.on("action", (value) => {
      const game = store.data.games.find((g) => g.id === p.room);
      if (!game) return;
      const now = Date.now(),
        last = lastAction.get(p.id) || 0;
      if (now - last < 400) return;
      lastAction.set(p.id, now);
      const r = getRound(p.room);
      if (game.kind === "snowball" && r.started && !r.result) {
        const targets = [...players.values()]
          .filter((other) => other.room === p.room && other.id !== p.id)
          .sort(
            (a, b) =>
              Math.hypot(a.x - p.x, a.z - p.z) -
              Math.hypot(b.x - p.x, b.z - p.z),
          );
        const target = targets[0];
        const dx = target ? target.x - p.x : p.input.x || 0,
          dz = target ? target.z - p.z : p.input.z || -1;
        const length = Math.hypot(dx, dz) || 1;
        bullets.push({
          id: crypto.randomUUID(),
          room: p.room,
          owner: p.id,
          x: p.x,
          z: p.z,
          vx: (dx / length) * 9,
          vz: (dz / length) * 9,
          life: 2,
        });
      }
      if (game.kind === "build") {
        const blocks = (store.data.blocks[p.room] ||= []);
        if (value?.undo) {
          const index = blocks.findLastIndex((b) => b.owner === p.id);
          if (index >= 0) blocks.splice(index, 1);
        } else if (blocks.length < 300) {
          const x = clamp(Math.round(p.x + 1.2), -9, 9),
            z = clamp(Math.round(p.z), -8, 8);
          const height = blocks.filter((b) => b.x === x && b.z === z).length;
          if (height < 8)
            blocks.push({
              id: crypto.randomUUID(),
              owner: p.id,
              x,
              z,
              y: height,
              color: /^#[a-f0-9]{6}$/i.test(value?.color || "")
                ? value.color
                : p.color,
            });
        }
        store.save();
      }
    });
    socket.on("camera-motion", (motion) => {
      const game = store.data.games.find((g) => g.id === p.room);
      if (
        game?.kind !== "freeze" ||
        !Number.isFinite(motion) ||
        motion < 0 ||
        motion > 1
      )
        return;
      const r = getRound(p.room),
        now = Date.now();
      if (!r.started || r.result || now - (p.lastCamera || 0) < 900) return;
      p.lastCamera = now;
      const phase = Math.floor((now - r.started) / 4000) % 2;
      const good = phase === 0 ? motion > 0.02 : motion < 0.015;
      if (good) r.scores[p.id] = (r.scores[p.id] || 0) + 1;
    });
    socket.on("custom-event", (value) => {
      if (
        !customAllowed(p) ||
        typeof value?.type !== "string" ||
        !/^[-a-zA-Z0-9_]{1,40}$/.test(value.type) ||
        !smallJson(value.payload)
      )
        return;
      io.to(p.room).emit("custom-event", {
        playerId: p.id,
        type: value.type,
        payload: value.payload ?? null,
      });
    });
    socket.on("custom-set", (value) => {
      if (
        !customAllowed(p) ||
        typeof value?.key !== "string" ||
        !/^[-a-zA-Z0-9_]{1,40}$/.test(value.key) ||
        ["__proto__", "prototype", "constructor"].includes(value.key) ||
        !smallJson(value.value)
      )
        return;
      store.data.custom ||= {};
      const state = (store.data.custom[p.room] ||= {});
      if (!Object.hasOwn(state, value.key) && Object.keys(state).length >= 64)
        return;
      state[value.key] = value.value ?? null;
      saveCustom();
    });
    socket.on("custom-score", (delta) => {
      if (
        !customAllowed(p) ||
        !Number.isInteger(delta) ||
        Math.abs(delta) > 10 ||
        Date.now() - (p.lastCustomScore || 0) < 1000
      )
        return;
      const r = getRound(p.room);
      if (!r.started || r.result) return;
      p.lastCustomScore = Date.now();
      r.scores[p.id] = Math.max(0, (r.scores[p.id] || 0) + delta);
    });
    socket.on("chat", (text) => {
      if (
        typeof text !== "string" ||
        !text.trim() ||
        Date.now() - (p.lastChat || 0) < 800
      )
        return;
      p.lastChat = Date.now();
      io.to(p.room).emit("chat", {
        id: crypto.randomUUID(),
        name: p.name,
        text: text.trim().slice(0, 250),
      });
    });
    socket.on("disconnect", () => {
      if (players.get(p.id)?.socketId === socket.id) {
        players.delete(p.id);
        lastAction.delete(p.id);
        presence();
      }
    });
    socket.emit("world", snapshot("hub"));
  });
  let ticks = 0;
  const timer = setInterval(() => {
    for (const p of players.values()) {
      if (Date.now() - (p.inputAt || 0) < 350) {
        p.x = clamp(p.x + p.input.x * 0.23, -9, 9);
        p.z = clamp(p.z + p.input.z * 0.23, -8, 8);
      }
      if (p.room === "hub") continue;
      const game = store.data.games.find((g) => g.id === p.room),
        r = getRound(p.room);
      if (!r.started || r.result) continue;
      if (game.kind === "collect") {
        for (let i = r.pickups.length - 1; i >= 0; i--)
          if (Math.hypot(p.x - r.pickups[i].x, p.z - r.pickups[i].z) < 0.8) {
            r.pickups.splice(i, 1);
            r.scores[p.id] = (r.scores[p.id] || 0) + 1;
          }
      }
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * 0.05;
      b.z += b.vz * 0.05;
      b.life -= 0.05;
      let hit = false;
      const r = getRound(b.room);
      if (!r.result)
        for (const p of players.values())
          if (
            p.room === b.room &&
            p.id !== b.owner &&
            Math.hypot(p.x - b.x, p.z - b.z) < 0.7
          ) {
            r.scores[b.owner] = (r.scores[b.owner] || 0) + 1;
            hit = true;
            break;
          }
      if (hit || b.life <= 0 || r.result) bullets.splice(i, 1);
    }
    for (const [id, r] of rounds) {
      const game = store.data.games.find((g) => g.id === id);
      if (
        r.started &&
        !r.result &&
        (Date.now() - r.started >= game.duration * 1000 ||
          (game.kind === "collect" && !r.pickups.length))
      ) {
        const scores = Object.entries(r.scores).sort((a, b) => b[1] - a[1]);
        const winnerId = scores[0]?.[0];
        r.result = {
          name:
            store.data.members.find((m) => m.id === winnerId)?.name ||
            "The family",
          score: scores[0]?.[1] || 0,
          tie: scores.filter((s) => s[1] === scores[0]?.[1]).length > 1,
        };
      }
    }
    if (++ticks % 2 === 0)
      for (const room of new Set([...players.values()].map((p) => p.room)))
        io.to(room).emit("world", snapshot(room));
  }, 50);
  timer.unref();
  return {
    players,
    snapshot,
    close: () => {
      clearInterval(timer);
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        store.save();
      }
    },
  };
}
