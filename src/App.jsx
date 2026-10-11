import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  House,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Users,
  Gamepad2,
  Settings,
  X,
  Check,
  Camera,
  Upload,
  LoaderCircle,
  Send,
  Download,
  Copy,
  LogOut,
  ChevronLeft,
  Trophy,
  Snowflake,
  Cookie,
  Blocks,
  Music2,
  Wifi,
  ShieldCheck,
  Heart,
  CheckCircle2,
  CircleHelp,
  WandSparkles,
  Clock3,
} from "lucide-react";
import World from "./World.jsx";
import CameraGame from "./CameraGame.jsx";
import CustomGame from "./CustomGame.jsx";
import { api, resizePhoto } from "./api.js";

const gameIcons = {
  snowball: Snowflake,
  collect: Cookie,
  freeze: Music2,
  build: Blocks,
  custom: WandSparkles,
};
const gameLabels = {
  snowball: "Friendly competition",
  collect: "A little friendly race",
  freeze: "Camera party",
  build: "Build together",
};
const opening = {
  role: "assistant",
  content:
    "Hey, game maker! ✦ What should we play? Tell me your wild idea — a cookie hunt, a snowball showdown, a space dance party, or a world we build together. We’ll make it yours.",
};
function Avatar({ user, size = 34 }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: user?.color || "#ddad88",
      }}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt={`${user.name}’s avatar`} />
      ) : (
        user?.name?.slice(0, 1).toUpperCase() || <Users size={size * 0.45} />
      )}
    </span>
  );
}
function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll(
          "button,input,textarea,a[href],select",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <button
          className="icon-btn close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        {children}
      </section>
    </div>
  );
}
function Join({ onClose, onJoined, familyName }) {
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [avatar, setAvatar] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    photo = useRef();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await api("/join", { name, code, avatar });
      await onJoined(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Join your family" onClose={onClose}>
      <div className="modal-emblem">
        <House size={29} />
      </div>
      <p className="eyebrow">THERE’S A PLACE FOR YOU HERE</p>
      <h2>Make yourself at home.</h2>
      <p className="muted">
        Join {familyName}’s arcade. All you need is a name and your family’s
        invite code.
      </p>
      <form onSubmit={submit}>
        <div className="photo-picker">
          <Avatar
            user={{ name: name || "?", avatar, color: "#d3c1a3" }}
            size={72}
          />
          <div>
            <button
              type="button"
              className="btn outline small"
              onClick={() => photo.current.click()}
            >
              <Upload size={15} />
              {avatar ? "Change photo" : "Add your photo"}
            </button>
            <small>Your face, your little character. Optional.</small>
          </div>
          <input
            ref={photo}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              try {
                if (e.target.files[0])
                  setAvatar(await resizePhoto(e.target.files[0]));
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        </div>
        <label>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What does the family call you?"
            maxLength={24}
            required
            autoComplete="given-name"
          />
        </label>
        <label>
          Family invite code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ask the person hosting"
            maxLength={100}
            required
            autoComplete="off"
            className="code-input"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn full" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}
          Let me in
        </button>
        <p className="form-footnote">
          <ShieldCheck size={13} />
          Your photo stays on your family’s home server.
        </p>
      </form>
    </Modal>
  );
}
function GameArt({ game }) {
  return (
    <div
      className={`game-art ${game.theme} ${game.kind}`}
      style={{ "--game-color": game.color }}
    >
      <span className="art-dot one" />
      <span className="art-dot two" />
      <span className="art-spark">✦</span>
      <div className="art-ground" />
      {game.kind === "snowball" ? (
        <>
          <div className="snowman">
            <i />
            <b />
            <span />
          </div>
          <div className="mini-tree" />
          <div className="snowball-ball" />
        </>
      ) : game.kind === "collect" ? (
        <>
          <div className="cookie-art big">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="cookie-art little">
            <i />
            <i />
            <i />
          </div>
          <div className="mini-tree candy-tree" />
        </>
      ) : game.kind === "freeze" ? (
        <>
          <div className="boombox">
            <div />
            <div />
            <i />
          </div>
          <span className="music-note">♪</span>
          <span className="music-note second">♫</span>
        </>
      ) : (
        <>
          <div className="block-art b1" />
          <div className="block-art b2" />
          <div className="block-art b3" />
          <div className="block-art b4" />
          <div className="mini-tree" />
        </>
      )}
    </div>
  );
}
function GameCard({ game, players, onPlay }) {
  const Icon = gameIcons[game.kind],
    count = players.filter((p) => p.room === game.id).length;
  return (
    <button className="game-card" onClick={() => onPlay(game)}>
      <div className="game-card-image">
        <GameArt game={game} />
        <span className="game-tag">
          <Icon size={12} />
          {game.kind === "build"
            ? "Co-op"
            : game.kind === "freeze"
              ? "Camera"
              : "Multiplayer"}
        </span>
        <span className="game-play">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="game-card-body">
        <h3>{game.name}</h3>
        <p>{game.description}</p>
        <div className="card-footer">
          <span>
            <span className="creator-dot" style={{ background: game.color }} />
            By {game.creator}
          </span>
          <span className={count ? "playing" : ""}>
            <Users size={13} />
            {count ? `${count} playing` : "Jump in"}
          </span>
        </div>
      </div>
    </button>
  );
}
function Studio({ bootstrap, onBack, onBuild, notify }) {
  const [messages, setMessages] = useState([opening]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [building, setBuilding] = useState(false),
    [error, setError] = useState(""),
    bottom = useRef();
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);
  async function send(e, prompt) {
    e?.preventDefault();
    const value = (prompt || text).trim();
    if (!value || busy || building) return;
    const next = [...messages, { role: "user", content: value }];
    if (next.length > 22) {
      setError(
        "Ready to build? This conversation has reached its limit. Start a fresh idea if you need more changes.",
      );
      return;
    }
    setMessages(next);
    setText("");
    setBusy(true);
    setError("");
    try {
      const result = await api("/studio/chat", { messages: next });
      setMessages([...next, { role: "assistant", content: result.content }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function build() {
    setBuilding(true);
    setError("");
    try {
      const job = await api("/studio/build", { messages });
      onBuild(job);
      notify("Your game is on its way. Go have some fun!");
    } catch (e) {
      setError(e.message);
      setBuilding(false);
    }
  }
  return (
    <section className="studio-page">
      <button className="text-btn back" onClick={onBack}>
        <ChevronLeft size={17} />
        Back to the living room
      </button>
      <div className="studio-heading">
        <div>
          <p className="eyebrow">A LITTLE IMAGINATION GOES A LONG WAY</p>
          <h1>What should we play?</h1>
          <p>Your idea. Your little world. A new family favorite.</p>
        </div>
        <span className="studio-stamp">
          <WandSparkles size={30} />
        </span>
      </div>
      <div className="studio-layout">
        <div className="chat-card">
          <div className="chat-header">
            <span className="designer-avatar">
              <Sparkles size={22} />
            </span>
            <div>
              <strong>Your game designer</strong>
              <span>
                <i className="live-dot" />
                {bootstrap.aiEnabled
                  ? "AI connected"
                  : "Demo designer · no key needed"}
              </span>
            </div>
            <button
              className="text-btn"
              onClick={() => {
                setMessages([opening]);
                setError("");
              }}
            >
              Fresh idea
            </button>
          </div>
          <div className="chat-messages" aria-live="polite">
            {messages.map((m, i) => (
              <div className={`chat-message ${m.role}`} key={i}>
                {m.role === "assistant" && (
                  <span className="chat-icon">
                    <Sparkles size={14} />
                  </span>
                )}
                <div>
                  {m.content
                    .split("**")
                    .map((s, j) => (j % 2 ? <strong key={j}>{s}</strong> : s))}
                </div>
                {m.role === "user" && (
                  <Avatar user={bootstrap.user} size={28} />
                )}
              </div>
            ))}
            {busy && (
              <div className="thinking">
                <i />
                <i />
                <i />
                <span>Thinking up something fun…</span>
              </div>
            )}
            <div ref={bottom} />
          </div>
          {error && (
            <p className="error chat-error" role="alert">
              {error}
            </p>
          )}
          <form className="chat-input" onSubmit={send}>
            <input
              aria-label="Your game idea"
              placeholder="I want to make a game where…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              disabled={busy}
            />
            <button
              className="send-btn"
              aria-label="Send idea"
              disabled={busy || !text.trim()}
            >
              <Send size={19} />
            </button>
          </form>
        </div>
        <aside className="studio-aside">
          <div className="idea-card">
            <span className="tiny-pill">
              <Sparkles size={12} />
              IMAGINATION STARTERS
            </span>
            <h3>A spark is all you need.</h3>
            <p>Pick an idea, then make it your own.</p>
            {[
              ["🍪", "A cookie hunt in a candy garden"],
              ["☃️", "A snowball battle in a winter village"],
              ["🪐", "A freeze dance party in outer space"],
              ["🏡", "A secret garden we build together"],
            ].map(([icon, prompt]) => (
              <button
                className="prompt-option"
                disabled={busy}
                key={prompt}
                onClick={() => send(null, prompt)}
              >
                <span>{icon}</span>
                {prompt}
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="build-card">
            <span className="build-illustration">
              <Blocks size={35} />
              <Sparkles size={15} />
            </span>
            <h3>Ready to bring it to life?</h3>
            <p>
              We’ll build your game in the background and add it to the game
              shelf. You can keep playing.
            </p>
            <button
              className="btn full"
              onClick={build}
              disabled={
                building || busy || !messages.some((m) => m.role === "user")
              }
            >
              <WandSparkles size={17} />
              Build my game
            </button>
            <small>
              {bootstrap.aiEnabled
                ? "Powered by your host’s AI provider"
                : "Demo mode uses the four built-in game mechanics"}
            </small>
          </div>
        </aside>
      </div>
    </section>
  );
}
function HostSettings({ host, onClose, onSaved, notify }) {
  const [password, setPassword] = useState(""),
    [settings, setSettings] = useState(null),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [authenticated, setAuthenticated] = useState(host);
  useEffect(() => {
    if (authenticated)
      api("/host/settings")
        .then(setSettings)
        .catch((e) => setError(e.message));
  }, [authenticated]);
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/host/login", { password });
      setAuthenticated(true);
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/host/settings", {
        familyName: settings.familyName,
        aiUrl: settings.aiUrl,
        aiModel: settings.aiModel,
        apiKey: key,
      });
      setKey("");
      await onSaved();
      notify("The house settings are saved.");
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Host settings" onClose={onClose}>
      <div className="modal-emblem">
        <Settings size={27} />
      </div>
      <p className="eyebrow">KEEP THE GOOD TIMES RUNNING</p>
      <h2>Host’s corner.</h2>
      {!authenticated ? (
        <>
          <p className="muted">
            Your home server prints the host password the first time it starts.
          </p>
          <form onSubmit={login}>
            <label>
              Host password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn full" disabled={busy}>
              Unlock settings
              <ArrowRight size={17} />
            </button>
          </form>
        </>
      ) : !settings ? (
        <p>Opening the host’s corner…{error}</p>
      ) : (
        <form onSubmit={save}>
          <label>
            Family name
            <input
              value={settings.familyName}
              maxLength={40}
              onChange={(e) =>
                setSettings({ ...settings, familyName: e.target.value })
              }
              required
            />
          </label>
          <div className="invite-box">
            <span>YOUR FAMILY INVITE CODE</span>
            <div>
              <b>{settings.joinCode}</b>
              <button
                type="button"
                className="icon-btn"
                title="Copy invite code"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(settings.joinCode);
                    notify("Invite code copied.");
                  } catch {
                    notify("Copy the code shown here.");
                  }
                }}
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
          <div className="settings-divider">
            <Sparkles size={16} /> AI game designer{" "}
            <span>{settings.aiEnabled ? "Connected" : "Demo mode"}</span>
          </div>
          <label>
            API provider URL
            <input
              type="url"
              value={settings.aiUrl}
              onChange={(e) =>
                setSettings({ ...settings, aiUrl: e.target.value })
              }
              required
            />
          </label>
          <label>
            Model
            <input
              value={settings.aiModel}
              onChange={(e) =>
                setSettings({ ...settings, aiModel: e.target.value })
              }
              required
              maxLength={100}
            />
          </label>
          <label>
            API key
            {settings.keyFromEnvironment
              ? " · configured through the server environment"
              : ""}
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                settings.aiEnabled
                  ? "Key saved · leave blank to keep it"
                  : "Paste your OpenAI-compatible API key"
              }
              disabled={settings.keyFromEnvironment}
              autoComplete="off"
            />
          </label>
          <p className="form-footnote">
            <ShieldCheck size={14} />
            Keys stay on the home server and are never sent to players.
          </p>
          {settings.aiEnabled && !settings.keyFromEnvironment && (
            <button
              type="button"
              className="text-btn danger"
              onClick={async () => {
                try {
                  await api("/host/settings", { ...settings, clearKey: true });
                  setSettings({ ...settings, aiEnabled: false });
                  setKey("");
                  await onSaved();
                  notify("API key removed. Demo mode is active.");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Remove saved key
            </button>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}
            Save house settings
          </button>
        </form>
      )}
    </Modal>
  );
}
function DownloadApp({ onClose }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/download");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const blob = await res.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "holiday-arcade.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Download the home server" onClose={onClose}>
      <div className="modal-emblem">
        <Download size={28} />
      </div>
      <p className="eyebrow">ONE COMPUTER. EVERYONE INVITED.</p>
      <h2>Bring the arcade home.</h2>
      <p className="muted">
        The host runs a small app on their computer. Everyone else joins from
        their phone’s browser.
      </p>
      <ol className="download-steps">
        <li>
          <span>1</span>
          <div>
            <b>Download & unzip</b>
            <p>Choose one computer to host the family arcade.</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <b>Install once</b>
            <p>
              Windows: Install-Windows.cmd
              <br />
              Mac: Install-Mac.command
              <br />
              Linux: bash Install-Linux.sh
              <br />
              The installer sets up the app and downloads Node.js if needed.
            </p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <b>Start & invite</b>
            <p>
              Next time, open a new terminal and type Holiday-arcade. Share the
              Wi-Fi address and invite code it prints. Keep that terminal open
              while everyone plays.
            </p>
          </div>
        </li>
      </ol>
      <button className="btn full" disabled={busy} onClick={download}>
        <Download size={17} />
        {busy ? "Preparing download…" : "Download home server (.zip)"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="form-footnote">
        <Wifi size={14} />
        Same Wi-Fi works right away. Remote visits and phone cameras need a
        secure HTTPS address; setup guidance is included.
      </p>
    </Modal>
  );
}
function Family({ members, presence, onInvite }) {
  return (
    <section className="family-page">
      <p className="eyebrow">THE PEOPLE MAKE THE PLACE</p>
      <h1>Our kind of people.</h1>
      <p className="muted">
        A little gallery of everyone who calls this arcade home.
      </p>
      <div className="family-grid">
        {members.map((m) => {
          const online = presence.some((p) => p.id === m.id);
          return (
            <div className="family-card" key={m.id}>
              <Avatar user={m} size={78} />
              <h3>{m.name}</h3>
              <span>
                <i className={online ? "live-dot" : "offline-dot"} />
                {online ? "Hanging out" : "See you soon"}
              </span>
            </div>
          );
        })}
        <button className="family-card invite-card" onClick={onInvite}>
          <span className="invite-plus">
            <Plus size={26} />
          </span>
          <h3>Room for one more</h3>
          <span>Share your family’s link</span>
        </button>
      </div>
    </section>
  );
}

function GameRoom({ game, world, user, socket, onBack, presence, notify }) {
  const [chat, setChat] = useState([]),
    [text, setText] = useState(""),
    [color, setColor] = useState("#df876d");
  useEffect(() => {
    const handler = (m) => setChat((old) => [...old.slice(-19), m]);
    socket?.on("chat", handler);
    return () => socket?.off("chat", handler);
  }, [socket]);
  const round = world?.round,
    players = world?.players || [],
    active = round?.remaining > 0 && !round?.result;
  const scores = players
    .map((p) => ({ ...p, score: round?.scores?.[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);
  return (
    <section className="game-page">
      <div className="game-room-heading">
        <button className="text-btn" onClick={onBack}>
          <ChevronLeft size={17} />
          Living room
        </button>
        <span>
          <Users size={14} />
          {players.length} here
        </span>
      </div>
      <div className="room-title">
        <div>
          <p className="eyebrow">BY {game.creator.toUpperCase()}</p>
          <h1>{game.name}</h1>
          <p>{game.description}</p>
        </div>
        <div className="round-clock">
          <Clock3 size={19} />
          {active
            ? `${Math.ceil(round.remaining)}s`
            : round?.result
              ? "Round complete"
              : "Ready to play?"}
        </div>
      </div>
      <div className="game-layout">
        <div>
          {game.kind === "custom" ? (
            <CustomGame game={game} world={world} user={user} socket={socket} />
          ) : (
            <World
              game={game}
              world={world}
              me={user}
              games={[]}
              onEnter={() => {}}
              socket={socket}
            />
          )}
          <div className="game-actions">
            {game.kind !== "build" && (
              <button
                className="btn"
                disabled={active || !socket?.connected}
                onClick={() => socket.emit("start-round")}
              >
                <Gamepad2 size={18} />
                {active
                  ? "Round in progress"
                  : round?.result
                    ? "Play another round"
                    : "Start a round"}
              </button>
            )}
            {game.kind === "snowball" && (
              <button
                className="btn orange"
                disabled={!active}
                onClick={() => socket.emit("action", {})}
              >
                <Snowflake size={18} />
                Toss snowball
              </button>
            )}
            {game.kind === "build" && (
              <>
                <div className="block-colors" aria-label="Block color">
                  {["#df876d", "#719b7d", "#a69aca", "#6a9db3", "#d6ac54"].map(
                    (c) => (
                      <button
                        key={c}
                        aria-label={`Use ${c} blocks`}
                        aria-pressed={color === c}
                        style={{ background: c }}
                        className={color === c ? "selected" : ""}
                        onClick={() => setColor(c)}
                      />
                    ),
                  )}
                </div>
                <button
                  className="btn"
                  onClick={() => socket.emit("action", { color })}
                >
                  <Plus size={18} />
                  Build a block
                </button>
                <button
                  className="btn outline"
                  onClick={() => socket.emit("action", { undo: true })}
                >
                  Undo
                </button>
              </>
            )}
            <span>
              {game.kind === "snowball" && players.length < 2
                ? "Invite another player for a showdown!"
                : "WASD / arrows or the phone joystick"}
            </span>
          </div>
          {round?.result && (
            <div className="round-result">
              <Trophy size={24} />
              <div>
                <b>
                  {round.result.tie
                    ? "A family tie!"
                    : `${round.result.name} wins!`}
                </b>
                <p>{round.result.score} points · Let’s do that again.</p>
              </div>
            </div>
          )}
          <div className="how-to">
            <CircleHelp size={19} />
            <div>
              <b>How to play</b>
              <p>{game.instructions}</p>
            </div>
          </div>
          {game.kind === "freeze" && (
            <CameraGame socket={socket} phase={round?.phase} active={active} />
          )}
        </div>
        <aside className="room-sidebar">
          <div className="scoreboard">
            <div className="panel-title">
              <Trophy size={17} />
              <h3>
                {game.kind === "build"
                  ? "Building buddies"
                  : "Friendly leaderboard"}
              </h3>
            </div>
            {scores.map((p, i) => (
              <div className="score-row" key={p.id}>
                <span className="score-rank">{i + 1}</span>
                <Avatar user={p} size={30} />
                <b>
                  {p.name}
                  {p.id === user.id ? " (you)" : ""}
                </b>
                {game.kind !== "build" && <strong>{p.score}</strong>}
              </div>
            ))}
          </div>
          <div className="room-chat">
            <div className="panel-title">
              <Users size={17} />
              <h3>Room chat</h3>
            </div>
            <div className="room-messages" aria-live="polite">
              {!chat.length ? (
                <div className="room-chat-empty">
                  <Heart size={22} />
                  <p>A hello goes a long way.</p>
                </div>
              ) : (
                chat.map((m) => (
                  <p key={m.id}>
                    <b>{m.name}</b> {m.text}
                  </p>
                ))
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) {
                  socket.emit("chat", text);
                  setText("");
                }
              }}
            >
              <input
                aria-label="Room message"
                value={text}
                maxLength={250}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something nice…"
              />
              <button className="icon-btn" aria-label="Send room message">
                <Send size={17} />
              </button>
            </form>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default function App() {
  const [bootstrap, setBootstrap] = useState(null),
    [loadError, setLoadError] = useState(""),
    [view, setView] = useState("home"),
    [modal, setModal] = useState(null),
    [world, setWorld] = useState(null),
    [presence, setPresence] = useState([]),
    [socket, setSocket] = useState(null),
    [connected, setConnected] = useState(false),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState("all"),
    [activeGame, setActiveGame] = useState(null);
  const bootRef = useRef(),
    toastTimer = useRef(),
    pending = useRef(null);
  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const refresh = useCallback(async () => {
    const data = await api("/bootstrap");
    bootRef.current = data;
    setBootstrap(data);
    return data;
  }, []);
  useEffect(() => {
    refresh().catch((e) => setLoadError(e.message));
    return () => clearTimeout(toastTimer.current);
  }, [refresh]);
  useEffect(() => {
    if (!bootstrap?.user?.id) return;
    const connection = io({ transports: ["websocket", "polling"] });
    setSocket(connection);
    connection.on("connect", () => {
      setConnected(true);
      if (pending.current?.game) {
        const game = pending.current.game;
        connection.emit("enter", game.id, (result) => {
          if (result?.error) {
            notify(result.error);
            return;
          }
          setActiveGame(game);
          setView("game");
          pending.current = { room: game.id };
        });
      } else if (pending.current?.room)
        connection.emit("enter", pending.current.room);
    });
    connection.on("disconnect", () => setConnected(false));
    connection.on("connect_error", (e) =>
      notify(`Connection interrupted: ${e.message}`),
    );
    connection.on("world", setWorld);
    connection.on("presence", setPresence);
    connection.on("library-changed", () =>
      refresh().catch((e) => notify(e.message)),
    );
    connection.on("job-changed", (job) => {
      if (job.memberId === bootRef.current?.user?.id) {
        refresh().catch(() => {});
        if (job.status === "ready")
          notify(`“${job.name}” is ready! Find it on the game shelf.`);
        if (job.status === "failed") notify(job.error);
      }
    });
    return () => {
      connection.disconnect();
      setSocket(null);
      setConnected(false);
      setPresence([]);
      setWorld(null);
    };
  }, [bootstrap?.user?.id, refresh, notify]);
  function requireFamily(action) {
    if (!bootstrap?.user) {
      pending.current = { action };
      setModal("join");
    } else action();
  }
  function goHome() {
    setView("home");
    setActiveGame(null);
    pending.current = null;
    socket?.emit("enter", "hub");
  }
  function play(game) {
    if (!bootstrap.user) {
      pending.current = { game };
      setModal("join");
      return;
    }
    if (!socket?.connected) {
      notify("Connecting to the home server. Try again in a moment.");
      return;
    }
    socket.emit("enter", game.id, (result) => {
      if (result?.error) {
        notify(result.error);
        return;
      }
      setActiveGame(game);
      setWorld(null);
      setView("game");
      pending.current = { room: game.id };
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  async function joined() {
    const action = pending.current?.action;
    if (!pending.current?.game) pending.current = null;
    await refresh();
    setModal(null);
    if (action) action();
    notify("You’re home. Welcome to the family!");
  }
  function openStudio() {
    if (view === "game") socket?.emit("enter", "hub");
    pending.current = null;
    setView("studio");
    setActiveGame(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      notify(
        "Family link copied. Share it with the invite code from your host.",
      );
    } catch {
      notify(`Share this address: ${window.location.origin}`);
    }
  }
  if (loadError)
    return (
      <div className="loading">
        <House size={40} />
        <h2>The house is taking a moment.</h2>
        <p>{loadError}</p>
        <button
          className="btn"
          onClick={() => {
            setLoadError("");
            refresh().catch((e) => setLoadError(e.message));
          }}
        >
          Try again
        </button>
      </div>
    );
  if (!bootstrap)
    return (
      <div className="loading">
        <House size={40} />
        <p>Opening the arcade…</p>
        <LoaderCircle className="spin" />
      </div>
    );
  const games = bootstrap.games,
    displayGames = games.filter(
      (g) =>
        filter === "all" ||
        (filter === "family" && g.creatorId) ||
        (filter === "coop" && g.kind === "build"),
    ),
    jobs = bootstrap.jobs || [];
  const inFlight = jobs.filter((j) =>
      ["queued", "building"].includes(j.status),
    ),
    failed = jobs.filter((j) => j.status === "failed");
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={goHome}
            aria-label="Holiday Arcade home"
          >
            <span className="brand-mark">
              <House size={21} strokeWidth={2.3} />
              <i>✦</i>
            </span>
            <span>
              holiday<span className="brand-light">arcade</span>
              <small>A LITTLE WORLD FOR YOUR FAMILY</small>
            </span>
          </button>
          <nav aria-label="Main navigation">
            <button
              className={view === "home" || view === "game" ? "active" : ""}
              onClick={goHome}
            >
              <House size={15} />
              The living room
            </button>
            <button
              className={view === "studio" ? "active" : ""}
              onClick={() => requireFamily(openStudio)}
            >
              <Sparkles size={15} />
              Game studio
            </button>
            <button
              className={view === "family" ? "active" : ""}
              onClick={() =>
                requireFamily(() => {
                  socket?.emit("enter", "hub");
                  pending.current = null;
                  setView("family");
                })
              }
            >
              <Users size={15} />
              The family
            </button>
          </nav>
          <div className="header-right">
            <button
              className="icon-btn host-button"
              aria-label="Host settings"
              onClick={() => setModal("host")}
            >
              <Settings size={18} />
            </button>
            {bootstrap.user ? (
              <button
                className="profile-button"
                onClick={() => setModal("profile")}
              >
                <Avatar user={bootstrap.user} />
                <span>
                  {bootstrap.user.name}
                  <small>
                    <i className={connected ? "live-dot" : "offline-dot"} />
                    {connected ? "At home" : "Connecting"}
                  </small>
                </span>
              </button>
            ) : (
              <button className="btn small" onClick={() => setModal("join")}>
                Join the family
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="main-shell">
        {bootstrap.user && !connected && (
          <div className="connection-banner">
            <Wifi size={15} />
            Reconnecting to the home server. Keep the host computer running.
          </div>
        )}
        {inFlight.length > 0 && (
          <div className="build-banner">
            <LoaderCircle size={17} className="spin" />
            <b>Your game is coming to life.</b>
            <span>Explore the arcade — we’ll tell you when it’s ready.</span>
          </div>
        )}
        {failed.length > 0 && (
          <div className="error build-banner">
            <CircleHelp size={17} />
            Your last build needs another try: {failed.at(-1).error}
            <button className="text-btn" onClick={openStudio}>
              Open studio
            </button>
          </div>
        )}
        {view === "home" && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">
                  <span className="tiny-star">✦</span> SMALL WORLDS. BIG
                  MEMORIES.
                </p>
                <h1>
                  Good times, <span>together.</span>
                  <span className="title-star">✳</span>
                </h1>
                <p>
                  Your family’s very own corner of the internet.
                  <br className="mobile-br" /> Wander in, play a little, make
                  something wonderful.
                </p>
              </div>
              <div className="welcome-actions">
                <div className="family-presence">
                  <div className="avatar-stack">
                    {presence.slice(0, 3).map((p) => (
                      <Avatar key={p.id} user={p} size={30} />
                    ))}
                    {!presence.length && (
                      <span className="presence-house">
                        <House size={16} />
                      </span>
                    )}
                  </div>
                  <span>
                    {presence.length
                      ? `${presence.length} ${presence.length === 1 ? "familiar face" : "familiar faces"} here`
                      : "The door is always open"}
                    <i className="live-dot" />
                  </span>
                </div>
                <button
                  className="btn"
                  onClick={() => requireFamily(openStudio)}
                >
                  <Plus size={17} />
                  Create a game
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </section>
            <World
              games={games}
              world={world?.room === "hub" ? world : null}
              me={bootstrap.user}
              onEnter={play}
              onCreate={() => requireFamily(openStudio)}
              socket={socket}
            />
            <section className="shelf-section">
              <div className="section-heading">
                <div>
                  <div className="heading-with-icon">
                    <Gamepad2 size={22} />
                    <h2>A little friendly fun.</h2>
                  </div>
                  <p>
                    Old favorites, new adventures, and a bit of family-made
                    magic.
                  </p>
                </div>
                <div className="shelf-tabs" aria-label="Filter games">
                  {[
                    ["all", "All games"],
                    ["family", "Family-made"],
                    ["coop", "Play together"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? "selected" : ""}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="game-grid">
                {displayGames.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    players={presence}
                    onPlay={play}
                  />
                ))}
                {!displayGames.length && (
                  <div className="empty-games">
                    <Sparkles size={26} />
                    <h3>Your family’s next favorite starts here.</h3>
                    <p>
                      Dream up a game in the studio and it’ll appear on this
                      shelf.
                    </p>
                    <button
                      className="btn small"
                      onClick={() => requireFamily(openStudio)}
                    >
                      Make the first one
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </section>
            <section className="create-banner">
              <div className="banner-art">
                <Blocks size={39} />
                <span>✦</span>
              </div>
              <div>
                <span className="eyebrow">EVERYONE’S A GAME MAKER</span>
                <h2>Your wild idea. The next family favorite.</h2>
                <p>
                  Just tell our AI designer what you’re dreaming of. We’ll take
                  it from there.
                </p>
              </div>
              <button
                className="btn purple"
                onClick={() => requireFamily(openStudio)}
              >
                Let’s make something
                <Sparkles size={17} />
              </button>
            </section>
            <div className="home-bottom">
              <span>
                <ShieldCheck size={15} />
                Hosted at home. Made for your people.
              </span>
              <button className="text-btn" onClick={() => setModal("download")}>
                Want to host your own arcade?
                <Download size={14} />
              </button>
            </div>
          </>
        )}
        {view === "studio" && (
          <Studio
            bootstrap={bootstrap}
            onBack={goHome}
            onBuild={() => {
              refresh();
              goHome();
            }}
            notify={notify}
          />
        )}
        {view === "family" && (
          <Family
            members={bootstrap.members}
            presence={presence}
            onInvite={share}
          />
        )}
        {view === "game" && activeGame && (
          <GameRoom
            game={activeGame}
            world={world?.room === activeGame.id ? world : null}
            user={bootstrap.user}
            socket={socket}
            onBack={goHome}
            presence={presence}
            notify={notify}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>
          holiday arcade <span>✦</span> made for togetherness
        </span>
        <span>A little play goes a long way.</span>
        <button className="text-btn" onClick={() => setModal("download")}>
          Get the home server
          <ArrowUpRight size={13} />
        </button>
      </footer>
      {modal === "join" && (
        <Join
          familyName={bootstrap.familyName}
          onClose={() => {
            setModal(null);
            pending.current = null;
          }}
          onJoined={joined}
        />
      )}
      {modal === "host" && (
        <HostSettings
          host={bootstrap.host}
          onClose={() => setModal(null)}
          onSaved={refresh}
          notify={notify}
        />
      )}
      {modal === "download" && <DownloadApp onClose={() => setModal(null)} />}
      {modal === "profile" && (
        <Modal title="Your family profile" onClose={() => setModal(null)}>
          <div className="profile-modal">
            <Avatar user={bootstrap.user} size={82} />
            <h2>Hey, {bootstrap.user.name}.</h2>
            <p>There’s always a place for you here.</p>
            <button className="btn full" onClick={share}>
              <Copy size={16} />
              Copy the family link
            </button>
            <button
              className="btn outline full"
              onClick={async () => {
                try {
                  await api("/logout", {});
                  setModal(null);
                  setView("home");
                  pending.current = null;
                  await refresh();
                } catch (e) {
                  notify(e.message);
                }
              }}
            >
              <LogOut size={16} />
              Leave the house
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
