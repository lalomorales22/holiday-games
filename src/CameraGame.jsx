import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
export default function CameraGame({ socket, phase, active }) {
  const video = useRef(),
    stream = useRef(),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState(""),
    [motion, setMotion] = useState(0);
  useEffect(
    () => () => stream.current?.getTracks().forEach((t) => t.stop()),
    [],
  );
  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let previous,
      lastSent = 0;
    const timer = setInterval(() => {
      if (!video.current || video.current.readyState < 2) return;
      ctx.drawImage(video.current, 0, 0, 32, 24);
      const pixels = ctx.getImageData(0, 0, 32, 24).data;
      if (previous) {
        let diff = 0;
        for (let i = 0; i < pixels.length; i += 4)
          diff +=
            Math.abs(pixels[i] - previous[i]) +
            Math.abs(pixels[i + 1] - previous[i + 1]) +
            Math.abs(pixels[i + 2] - previous[i + 2]);
        const amount = diff / (32 * 24 * 3 * 255);
        setMotion(amount);
        if (active && Date.now() - lastSent > 1000) {
          socket?.emit("camera-motion", amount);
          lastSent = Date.now();
        }
      }
      previous = pixels;
    }, 200);
    return () => clearInterval(timer);
  }, [enabled, socket, active]);
  async function enable() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera games need a secure HTTPS address (or localhost on the host computer). Other games work on your Wi-Fi URL.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
        audio: false,
      });
      setEnabled(true);
    } catch (e) {
      setError(
        e.name === "NotAllowedError"
          ? "Camera permission was declined. You can allow it in your browser settings."
          : e.message,
      );
    }
  }
  useEffect(() => {
    if (enabled && video.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {});
    }
  }, [enabled]);
  function disable() {
    stream.current?.getTracks().forEach((t) => t.stop());
    setEnabled(false);
  }
  return (
    <div className={`camera-panel ${phase === "freeze" ? "freeze" : ""}`}>
      {enabled ? (
        <>
          <video ref={video} muted playsInline autoPlay />
          <div className="camera-status">
            <b>
              {active
                ? phase === "freeze"
                  ? "Hold still!"
                  : "Time to dance!"
                : "You’re camera-ready"}
            </b>
            <span>Motion: {Math.round(motion * 100)}%</span>
          </div>
          <button
            className="icon-btn"
            title="Turn off camera"
            onClick={disable}
          >
            <CameraOff size={18} />
          </button>
        </>
      ) : (
        <>
          <Camera size={28} />
          <h3>Your moves. Your device.</h3>
          <p>
            Video stays on your phone. Only a motion score goes to the game.
          </p>
          <button className="btn small" onClick={enable}>
            Enable my camera
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
