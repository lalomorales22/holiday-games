import React, { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Maximize2, Minimize2 } from "lucide-react";
export default function CustomGame({ game, world, user, socket }) {
  const frame = useRef(),
    stick = useRef(),
    latest = useRef(world),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [large, setLarge] = useState(false);
  const token = useMemo(
    () =>
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
    [game.id],
  );
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(
      () =>
        setError(
          "This world couldn’t open. Return to the living room and try again.",
        ),
      15000,
    );
    return () => clearTimeout(timer);
  }, [game.id, ready]);
  useEffect(() => {
    if (ready) setError("");
  }, [ready]);
  function post(type, payload) {
    frame.current?.contentWindow?.postMessage(
      { channel: "holiday-arcade", token, type, payload },
      "*",
    );
  }
  useEffect(() => {
    latest.current = world;
    post("state", world);
  }, [world, ready]);
  useEffect(() => {
    const listener = (event) => {
      const d = event.data;
      if (
        event.source !== frame.current?.contentWindow ||
        d?.channel !== "holiday-arcade" ||
        d.token !== token
      )
        return;
      if (d.type === "ready") {
        setReady(true);
        post("state", latest.current);
      }
      if (d.type === "input") socket?.emit("input", d.payload);
      if (d.type === "event") socket?.emit("custom-event", d.payload);
      if (d.type === "set") socket?.emit("custom-set", d.payload);
      if (d.type === "score") socket?.emit("custom-score", d.payload);
    };
    const onEvent = (payload) => post("event", payload);
    window.addEventListener("message", listener);
    socket?.on("custom-event", onEvent);
    return () => {
      window.removeEventListener("message", listener);
      socket?.off("custom-event", onEvent);
      socket?.emit("input", { x: 0, z: 0 });
    };
  }, [socket, token]);
  const input = useRef({ x: 0, z: 0 });
  useEffect(() => {
    const keys = new Set();
    const movement = () => {
      input.current = {
        x:
          (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
          (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
        z:
          (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
          (keys.has("w") || keys.has("arrowup") ? 1 : 0),
      };
    };
    const down = (e) => {
      if (e.target.closest("input,textarea,[contenteditable]")) return;
      const key = e.key.toLowerCase();
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
        e.preventDefault();
        keys.add(key);
        movement();
      }
    };
    const up = (e) => {
      keys.delete(e.key.toLowerCase());
      movement();
      socket?.emit("input", input.current);
    };
    const stop = () => {
      keys.clear();
      input.current = { x: 0, z: 0 };
      socket?.emit("input", input.current);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    const timer = setInterval(() => {
      if (input.current.x || input.current.z)
        socket?.emit("input", input.current);
    }, 50);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      stop();
    };
  }, [socket]);
  function moveStick(e) {
    const rect = stick.current.getBoundingClientRect(),
      x = (e.clientX - rect.left - rect.width / 2) / 30,
      z = (e.clientY - rect.top - rect.height / 2) / 30,
      len = Math.max(1, Math.hypot(x, z));
    input.current = { x: x / len, z: z / len };
    stick.current.style.setProperty("--stick-x", `${input.current.x * 23}px`);
    stick.current.style.setProperty("--stick-y", `${input.current.z * 23}px`);
  }
  function stopStick() {
    input.current = { x: 0, z: 0 };
    socket?.emit("input", input.current);
    stick.current?.style.setProperty("--stick-x", "0px");
    stick.current?.style.setProperty("--stick-y", "0px");
  }
  return (
    <div className={`world-wrap custom-game ${large ? "expanded" : ""}`}>
      {error ? (
        <div className="world-fallback">
          <p className="error">{error}</p>
        </div>
      ) : (
        <>
          <iframe
            title={`${game.name} playable world`}
            ref={frame}
            src={`/api/games/${encodeURIComponent(game.id)}/play?bridge=${token}`}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            onLoad={() => post("state", latest.current)}
          />
          {!ready && (
            <div className="custom-loading">
              <LoaderCircle className="spin" />
              Opening your family’s world…
            </div>
          )}
        </>
      )}
      <button
        className="icon-btn translucent custom-expand"
        title={large ? "Shrink game" : "Expand game"}
        onClick={() => setLarge(!large)}
      >
        {large ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
      <div
        className="joystick"
        ref={stick}
        role="application"
        aria-label="Movement joystick"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveStick(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) moveStick(e);
        }}
        onPointerUp={stopStick}
        onPointerCancel={stopStick}
      >
        <span />
      </div>
    </div>
  );
}
