import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { Server } from "socket.io";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { createStore, checkPassword } from "./store.js";
import { chat, generateGame } from "./ai.js";
import { createWorld } from "./world.js";
import { packageHouse } from "./package.js";
import { gameFrame } from "./frame.js";

const conversation = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(2000),
    }),
  )
  .min(1)
  .max(24);
const colors = [
  "#df876d",
  "#719b7d",
  "#a69aca",
  "#6a9db3",
  "#d6ac54",
  "#cf8ca5",
];

export function createHouse({
  dataDir = path.resolve(".holiday-data"),
  env = process.env,
  staticDir = path.resolve("dist"),
} = {}) {
  const store = createStore(dataDir, env);
  const app = express(),
    server = createServer(app);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
    );
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host
    )
      return res
        .status(403)
        .json({
          error: "Please use the family dashboard to make this request.",
        });
    next();
  });
  app.use(express.json({ limit: "250kb" }));
  const sessions = new Map(),
    jobs = new Map();
  function sessionFor(req) {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("holiday_session="))
      ?.slice(16);
    const session = sessions.get(token);
    if (session && session.expires > Date.now()) return session;
    if (token) sessions.delete(token);
    return null;
  }
  const sessionTimer = setInterval(() => {
    for (const [token, session] of sessions)
      if (session.expires <= Date.now()) sessions.delete(token);
  }, 3600000);
  sessionTimer.unref();
  function setSession(req, res, values) {
    const previous = sessionFor(req);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, {
      ...previous,
      ...values,
      expires: Date.now() + 86400000 * 7,
    });
    res.setHeader(
      "Set-Cookie",
      `holiday_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${req.secure || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`,
    );
  }
  const memberOnly = (req, res, next) =>
    sessionFor(req)?.memberId
      ? next()
      : res.status(401).json({ error: "Join the family first." });
  const hostOnly = (req, res, next) =>
    sessionFor(req)?.host
      ? next()
      : res.status(401).json({ error: "Host login required." });
  const io = new Server(server, {
    maxHttpBufferSize: 16384,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      try {
        callback(null, !origin || new URL(origin).host === req.headers.host);
      } catch {
        callback(null, false);
      }
    },
  });
  const world = createWorld(io, store, sessionFor);
  const safeMember = (id) =>
    store.data.members.find((m) => m.id === id) || null;
  app.get("/api/bootstrap", (req, res) => {
    const session = sessionFor(req);
    res.json({
      familyName: store.data.familyName,
      aiEnabled: !!store.getKey(),
      user: safeMember(session?.memberId),
      host: !!session?.host,
      games: store.data.games,
      members: session?.memberId ? store.data.members : [],
      jobs: [...jobs.values()]
        .filter((j) => j.memberId === session?.memberId)
        .map(({ messages, ...rest }) => rest),
    });
  });
  app.get("/api/games/:id/play", memberOnly, (req, res) => {
    const game = store.data.games.find(
      (g) => g.id === req.params.id && g.kind === "custom",
    );
    if (!game)
      return res
        .status(404)
        .json({ error: "That custom world is not available." });
    if (
      typeof req.query.bridge !== "string" ||
      !/^[a-f0-9]{32}$/i.test(req.query.bridge)
    )
      return res.status(400).json({ error: "Invalid game bridge." });
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
    );
    res.setHeader("Permissions-Policy", "camera=(), microphone=()");
    res.setHeader("Cache-Control", "no-store");
    try {
      res
        .type("html")
        .send(
          gameFrame({
            game,
            member: safeMember(sessionFor(req).memberId),
            world: world.snapshot(game.id),
            token: req.query.bridge,
            staticDir,
          }),
        );
    } catch {
      res
        .status(503)
        .json({
          error: "The game runtime is missing. The host can run npm run build.",
        });
    }
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again in 15 minutes." },
  });
  app.post("/api/join", loginLimit, (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(24),
        code: z.string().max(100),
        avatar: z
          .string()
          .max(140000)
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
          .nullable()
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Enter your name, invite code, and a small photo." });
    if (
      parsed.data.code.trim().toUpperCase() !==
      store.data.joinCode.toUpperCase()
    )
      return res
        .status(403)
        .json({
          error:
            "That invite code isn’t quite right. Ask your host for the family code.",
        });
    if (store.data.members.length >= 100)
      return res
        .status(409)
        .json({ error: "This house has reached its 100-member limit." });
    const member = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      avatar: parsed.data.avatar || null,
      color: colors[store.data.members.length % colors.length],
    };
    store.data.members.push(member);
    store.save();
    setSession(req, res, { memberId: member.id });
    res.json(member);
  });
  app.post("/api/logout", (req, res) => {
    const session = sessionFor(req);
    if (session?.memberId)
      for (const socket of io.sockets.sockets.values())
        if (socket.memberId === session.memberId) socket.disconnect(true);
    const cookie = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("holiday_session="))
      ?.slice(16);
    sessions.delete(cookie);
    res.setHeader(
      "Set-Cookie",
      "holiday_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
    res.json({ ok: true });
  });
  app.post("/api/host/login", loginLimit, (req, res) => {
    if (
      typeof req.body.password !== "string" ||
      req.body.password.length > 256 ||
      !checkPassword(req.body.password, store.data.hostHash)
    )
      return res
        .status(403)
        .json({
          error:
            "Incorrect host password. Find it in the home server’s first-launch terminal output.",
        });
    setSession(req, res, { host: true });
    res.json({ ok: true });
  });
  app.get("/api/host/settings", hostOnly, (req, res) =>
    res.json({
      familyName: store.data.familyName,
      joinCode: store.data.joinCode,
      aiUrl: store.env.HOLIDAY_AI_URL || store.data.aiUrl,
      aiModel: store.env.HOLIDAY_AI_MODEL || store.data.aiModel,
      aiEnabled: !!store.getKey(),
      keyFromEnvironment: !!store.env.HOLIDAY_AI_KEY,
    }),
  );
  app.post("/api/host/settings", hostOnly, (req, res) => {
    const parsed = z
      .object({
        familyName: z.string().trim().min(1).max(40),
        aiUrl: z.string().url().max(250),
        aiModel: z.string().trim().min(1).max(100),
        apiKey: z.string().max(500).optional(),
        clearKey: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: "Please check your family name and AI provider settings.",
        });
    const url = new URL(parsed.data.aiUrl);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      return res
        .status(400)
        .json({
          error:
            "Use HTTPS for an AI provider, or HTTP for a local Ollama server.",
        });
    store.data.familyName = parsed.data.familyName;
    store.data.aiUrl = parsed.data.aiUrl;
    store.data.aiModel = parsed.data.aiModel;
    if (parsed.data.clearKey) store.setKey(null);
    else if (parsed.data.apiKey) store.setKey(parsed.data.apiKey);
    store.save();
    io.emit("library-changed");
    res.json({ ok: true });
  });
  const aiLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 12,
    message: { error: "Let’s slow down a little. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const chatsInFlight = new Set();
  app.post("/api/studio/chat", memberOnly, aiLimit, async (req, res) => {
    const parsed = conversation.safeParse(req.body.messages);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error:
            "Please keep the conversation under 24 messages and each message under 2,000 characters.",
        });
    const memberId = sessionFor(req).memberId;
    if (chatsInFlight.has(memberId))
      return res
        .status(409)
        .json({ error: "Your designer is still replying." });
    chatsInFlight.add(memberId);
    try {
      res.json({
        content: await chat(store, parsed.data),
        demo: !store.getKey(),
      });
    } catch (error) {
      res.status(502).json({ error: error.message });
    } finally {
      chatsInFlight.delete(memberId);
    }
  });
  app.post("/api/studio/build", memberOnly, aiLimit, (req, res) => {
    const parsed = conversation.safeParse(req.body.messages);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Tell the designer about your game first." });
    const memberId = sessionFor(req).memberId;
    if (
      [...jobs.values()].some(
        (j) =>
          j.memberId === memberId && ["queued", "building"].includes(j.status),
      )
    )
      return res
        .status(409)
        .json({
          error: "You already have a game building. It will be ready soon.",
        });
    if (
      [...jobs.values()].filter((j) =>
        ["queued", "building"].includes(j.status),
      ).length >= 8 ||
      store.data.games.length >= 100
    )
      return res
        .status(409)
        .json({
          error: "The studio is full right now. Please try again later.",
        });
    for (const [id, old] of jobs)
      if (old.createdAt < Date.now() - 86400000) jobs.delete(id);
    const job = {
      id: crypto.randomUUID(),
      memberId,
      status: "queued",
      createdAt: Date.now(),
      demo: !store.getKey(),
    };
    jobs.set(job.id, job);
    res.status(202).json(job);
    setImmediate(async () => {
      job.status = "building";
      io.emit("job-changed", { id: job.id, status: job.status, memberId });
      try {
        const spec = await generateGame(store, parsed.data);
        const game = {
          ...spec,
          id: crypto.randomUUID(),
          creator: safeMember(memberId).name,
          creatorId: memberId,
          createdAt: Date.now(),
        };
        store.data.games.push(game);
        store.save();
        job.status = "ready";
        job.gameId = game.id;
        job.name = game.name;
        io.emit("library-changed");
      } catch (error) {
        job.status = "failed";
        job.error = error.message;
      }
      io.emit("job-changed", job);
    });
  });
  let packaging = null;
  app.get("/api/download", async (req, res) => {
    const archive = path.resolve("downloads/holiday-arcade.zip");
    if (!fs.existsSync(path.resolve("dist/index.html")))
      return res
        .status(404)
        .json({
          error: "The host can prepare a download with npm run package.",
        });
    try {
      if (!fs.existsSync(archive)) {
        packaging ||= packageHouse().finally(() => {
          packaging = null;
        });
        await packaging;
      }
      res.download(archive, "holiday-arcade.zip");
    } catch {
      res
        .status(500)
        .json({
          error:
            "The server couldn’t prepare the download. The host can run npm run package to diagnose it.",
        });
    }
  });
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, app: "Holiday Arcade" }),
  );
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get("/{*path}", (req, res) => {
      if (req.path.startsWith("/api/"))
        return res.status(404).json({ error: "Not found." });
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res
      .status(error.status || 500)
      .json({
        error:
          error.status === 413
            ? "That photo is too large. Please choose a smaller one."
            : "The server couldn’t complete that request. Please try again.",
      });
  });
  return {
    app,
    server,
    io,
    store,
    world,
    jobs,
    close: async () => {
      clearInterval(sessionTimer);
      world.close();
      await new Promise((resolve) => io.close(resolve));
    },
  };
}
