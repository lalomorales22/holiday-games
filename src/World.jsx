import React, {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Move,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from "lucide-react";

export const portalPositions = [
  [-5, -3.2],
  [5, -3.2],
  [-5, 3.5],
  [5, 3.5],
  [0, -5.3],
  [0, 0],
];
function CameraRig() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.zoom = Math.min(size.width / 27, size.height / 18);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}
function Box({
  position = [0, 0, 0],
  size = [1, 1, 1],
  color = "#ffffff",
  radius = 0.12,
  ...props
}) {
  return (
    <RoundedBox
      args={size}
      radius={Math.min(radius, ...size.map((v) => v / 2 - 0.001))}
      smoothness={2}
      bevelSegments={2}
      position={position}
      castShadow
      receiveShadow
      {...props}
    >
      <meshStandardMaterial color={color} roughness={0.8} />
    </RoundedBox>
  );
}
function Tree({ position, snow = false, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.18, 1.2, 7]} />
        <meshStandardMaterial color="#90775b" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 1 + i * 0.55, 0]} castShadow>
          <coneGeometry args={[1.1 - i * 0.23, 1.6, 7]} />
          <meshStandardMaterial
            color={
              snow
                ? ["#d4e8da", "#e5f1e5", "#f5f8ed"][i]
                : ["#547957", "#6c9462", "#83a874"][i]
            }
          />
        </mesh>
      ))}
    </group>
  );
}
function Flower({ position, color = "#eedb75" }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.24, 5]} />
        <meshStandardMaterial color="#759256" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos(i * 1.256) * 0.12,
            0.25,
            Math.sin(i * 1.256) * 0.12,
          ]}
        >
          <sphereGeometry args={[0.11, 6, 5]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
function Cottage({ color = "#e8b88d", winter = false }) {
  return (
    <group>
      <Box position={[0, 0.65, 0]} size={[1.7, 1.3, 1.45]} color={color} />
      <mesh position={[0, 1.65, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.55, 1.2, 4]} />
        <meshStandardMaterial color={winter ? "#f9f8ee" : "#bb7665"} />
      </mesh>
      <Box
        position={[0, 0.42, 0.74]}
        size={[0.38, 0.8, 0.08]}
        color="#647d68"
        radius={0.07}
      />
      {[-0.5, 0.5].map((x) => (
        <Box
          key={x}
          position={[x, 0.83, 0.74]}
          size={[0.3, 0.34, 0.08]}
          color="#f9e29c"
          radius={0.04}
        />
      ))}
    </group>
  );
}
function Rocket() {
  return (
    <group>
      <mesh position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[0.45, 1, 5, 10]} />
        <meshStandardMaterial color="#f1eee5" />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <coneGeometry args={[0.45, 0.7, 12]} />
        <meshStandardMaterial color="#b195ce" />
      </mesh>
      <mesh position={[0, 1.2, 0.44]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
        <meshStandardMaterial color="#8db9c4" />
      </mesh>
      {[-1, 1].map((x) => (
        <Box
          key={x}
          position={[x * 0.46, 0.48, 0]}
          size={[0.25, 0.7, 0.55]}
          color="#c3b1dc"
        />
      ))}
    </group>
  );
}
function Blocks() {
  return (
    <group>
      {[
        [0, 0.3, 0, "#e6b05d"],
        [-0.65, 0.3, 0, "#cb8e82"],
        [0.65, 0.3, 0, "#8fb0a2"],
        [0, 0.9, 0, "#b3a2cf"],
        [-0.33, 1.5, 0, "#efd880"],
      ].map(([x, y, z, c], i) => (
        <Box key={i} position={[x, y, z]} size={[0.6, 0.6, 0.6]} color={c} />
      ))}
    </group>
  );
}
function Portal({ game, position, onEnter, labels }) {
  const [hover, setHover] = useState(false);
  return (
    <group
      position={[position[0], 0.02, position[1]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onEnter(game);
      }}
    >
      <Box
        size={[3.6, 0.24, 3]}
        position={[0, 0.12, 0]}
        color={hover ? "#fff5cc" : game.color}
        radius={0.25}
      />
      <group position={[0, 0.25, -0.18]} scale={hover ? 1.08 : 1}>
        {game.kind === "freeze" ? (
          <Rocket />
        ) : game.kind === "build" ? (
          <Blocks />
        ) : (
          <Cottage
            color={game.kind === "snowball" ? "#c6dde0" : "#e4b07b"}
            winter={game.kind === "snowball"}
          />
        )}
      </group>
      <Html portal={labels} center position={[0, 2.9, 0]} zIndexRange={[10, 0]}>
        <button
          className={`portal-label ${hover ? "hover" : ""}`}
          onClick={() => onEnter(game)}
        >
          {game.name}
          <ArrowUpRight size={11} />
        </button>
      </Html>
      {game.kind === "collect" && (
        <>
          <Flower position={[-1.3, 0.24, 0.8]} color="#dd889d" />
          <Flower position={[1.3, 0.24, 0.8]} />
        </>
      )}
    </group>
  );
}
function PhotoFace({ avatar }) {
  const texture = useLoader(THREE.TextureLoader, avatar);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[0, 1.53, 0.365]}>
      <circleGeometry args={[0.32, 28]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}
function Character({ player, me = false, labels }) {
  const ref = useRef(),
    target = useRef(new THREE.Vector3(player.x, 0, player.z));
  const moving = useRef(false);
  useEffect(() => {
    moving.current =
      Math.hypot(target.current.x - player.x, target.current.z - player.z) >
      0.03;
    target.current.set(player.x, 0, player.z);
  }, [player.x, player.z]);
  useFrame(({ clock }, delta) => {
    if (ref.current) {
      ref.current.position.lerp(target.current, Math.min(1, delta * 14));
      ref.current.position.y = moving.current
        ? Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.08
        : 0;
    }
  });
  return (
    <group ref={ref} position={[player.x, 0, player.z]} rotation={[0, 0.6, 0]}>
      <mesh position={[0, 0.78, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.45, 4, 10]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      <mesh position={[0, 1.48, 0]} castShadow>
        <sphereGeometry args={[0.38, 16, 12]} />
        <meshStandardMaterial color="#f0d4b4" />
      </mesh>
      {player.avatar ? (
        <Suspense fallback={null}>
          <PhotoFace avatar={player.avatar} />
        </Suspense>
      ) : (
        <group>
          {[-0.11, 0.11].map((x) => (
            <mesh key={x} position={[x, 1.54, 0.35]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshStandardMaterial color="#574b43" />
            </mesh>
          ))}
          <mesh position={[0, 1.4, 0.365]}>
            <torusGeometry args={[0.08, 0.015, 5, 10, Math.PI]} />
            <meshStandardMaterial color="#a37562" />
          </mesh>
        </group>
      )}
      <mesh position={[0, 1.8, 0]} castShadow>
        <sphereGeometry args={[0.39, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      {[-0.16, 0.16].map((x) => (
        <Box
          key={x}
          position={[x, 0.17, 0.04]}
          size={[0.22, 0.27, 0.38]}
          color="#f6eee2"
          radius={0.08}
        />
      ))}
      <Html portal={labels} center position={[0, 2.2, 0]} zIndexRange={[8, 0]}>
        <span className={`player-label ${me ? "me" : ""}`}>
          {player.name}
          {me ? " · you" : ""}
        </span>
      </Html>
    </group>
  );
}
function Cookie({ x, z }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime;
  });
  return (
    <group ref={ref} position={[x, 0.5, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.13, 12]} />
        <meshStandardMaterial color="#e6b761" />
      </mesh>
      {[
        [0.1, 0.1],
        [-0.1, 0.02],
        [0.03, -0.12],
      ].map(([a, b], i) => (
        <mesh key={i} position={[a, 0.08, b]}>
          <sphereGeometry args={[0.04, 5, 5]} />
          <meshStandardMaterial color="#936544" />
        </mesh>
      ))}
    </group>
  );
}
function Scene({ games, world, me, game, onEnter, onCreate, labels }) {
  const winter = game?.theme === "winter",
    space = game?.theme === "space";
  return (
    <>
      <color
        attach="background"
        args={[space ? "#d6d0e4" : winter ? "#deedf0" : "#dfe9d9"]}
      />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[7, 15, 8]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-normalBias={0.04}
      />
      <Box
        position={[0, -0.38, 0]}
        size={[20, 0.75, 17.5]}
        color={space ? "#b9adcc" : winter ? "#edf4ed" : "#a8bd94"}
        radius={0.6}
      />
      <Box
        position={[0, 0.008, 0]}
        size={[18, 0.06, 15.5]}
        color={space ? "#cabedc" : winter ? "#f6f6ec" : "#c5d3ab"}
        radius={0.4}
      />
      {!game && (
        <>
          <Box
            size={[2.1, 0.055, 14]}
            position={[0, 0.07, 0]}
            color="#e9dec1"
            radius={0.08}
          />
          <Box
            size={[17, 0.06, 1.5]}
            position={[0, 0.075, 0]}
            color="#e9dec1"
            radius={0.08}
          />
          <mesh
            position={[0, 0.13, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <circleGeometry args={[2.3, 40]} />
            <meshStandardMaterial color="#eee3c8" />
          </mesh>
          <group position={[0, 0.13, 0]}>
            <Box
              size={[1.3, 0.3, 1.3]}
              position={[0, 0.15, 0]}
              color="#d8cbb1"
            />
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.55, 0.45, 0.85, 12]} />
              <meshStandardMaterial color="#f3d782" />
            </mesh>
            <mesh position={[0, 1.3, 0]}>
              <sphereGeometry args={[0.65, 16, 10]} />
              <meshStandardMaterial color="#f4dfa0" />
            </mesh>
          </group>
          {games.slice(0, 6).map((g, i) => (
            <Portal
              key={g.id}
              game={g}
              position={portalPositions[i]}
              onEnter={onEnter}
              labels={labels}
            />
          ))}
        </>
      )}
      {[
        [-8, -6],
        [-7.1, -6.8],
        [8, -6],
        [7.2, -6.9],
        [-8, 6.4],
        [8, 6.6],
        [-8.5, -1],
        [8.4, 1],
      ].map((p, i) => (
        <Tree
          key={i}
          position={[p[0], 0.06, p[1]]}
          snow={winter}
          scale={0.7 + (i % 3) * 0.15}
        />
      ))}
      {!space &&
        [
          [-7, 5.5],
          [-6.5, 5.7],
          [7, 5],
          [-7, -4.6],
          [7, -4.6],
          [6.5, 5.5],
        ].map((p, i) => (
          <Flower
            key={i}
            position={[p[0], 0.05, p[1]]}
            color={i % 2 ? "#deaaa3" : "#f2da89"}
          />
        ))}
      {!game && (
        <Html
          portal={labels}
          center
          position={[0, 2.6, 0]}
          zIndexRange={[10, 0]}
        >
          <button className="studio-portal-label" onClick={onCreate}>
            ✦ Game studio <ArrowUpRight size={11} />
          </button>
        </Html>
      )}
      <group position={[0, 0.2, 0]}>
        {world?.blocks?.map((b) => (
          <Box
            key={b.id}
            position={[b.x, b.y * 0.65 + 0.325, b.z]}
            size={[0.62, 0.62, 0.62]}
            color={b.color}
          />
        ))}
      </group>
      {world?.round?.pickups?.map((p) =>
        game?.kind === "collect" ? <Cookie key={p.id} x={p.x} z={p.z} /> : null,
      )}
      {world?.bullets?.map((b) => (
        <mesh key={b.id} position={[b.x, 0.85, b.z]}>
          <sphereGeometry args={[0.18, 8, 6]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      {(world?.players || []).map((p) => (
        <Character key={p.id} player={p} me={p.id === me?.id} labels={labels} />
      ))}
      {game && (
        <Html
          portal={labels}
          center
          position={[0, 3, -6]}
          zIndexRange={[10, 0]}
        >
          <span className="world-sign">
            {game.kind === "freeze" && world?.round?.remaining > 0
              ? world.round.phase === "dance"
                ? "✦ DANCE!"
                : "◼ FREEZE!"
              : game.name}
          </span>
        </Html>
      )}
    </>
  );
}
class WorldBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="world-fallback">
        <Move size={35} />
        <h3>The game shelf is still open.</h3>
        <p>
          This device couldn’t display the 3D world. Try a browser with WebGL
          enabled.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function World({
  games,
  world,
  me,
  game,
  onEnter,
  onCreate,
  socket,
}) {
  const [large, setLarge] = useState(false),
    [sound, setSound] = useState(false);
  const labelLayer = useRef();
  const input = useRef({ x: 0, z: 0 }),
    keys = useRef(new Set()),
    joystick = useRef(null);
  useEffect(() => {
    const movement = () => {
      input.current = {
        x:
          (keys.current.has("d") || keys.current.has("arrowright") ? 1 : 0) -
          (keys.current.has("a") || keys.current.has("arrowleft") ? 1 : 0),
        z:
          (keys.current.has("s") || keys.current.has("arrowdown") ? 1 : 0) -
          (keys.current.has("w") || keys.current.has("arrowup") ? 1 : 0),
      };
    };
    const down = (e) => {
      if (e.target.closest("input,textarea,[contenteditable]")) return;
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
        ].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        keys.current.add(e.key.toLowerCase());
        movement();
      }
    };
    const up = (e) => {
      keys.current.delete(e.key.toLowerCase());
      movement();
    };
    const stop = () => {
      keys.current.clear();
      input.current = { x: 0, z: 0 };
      socket?.emit("input", input.current);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    const timer = setInterval(
      () => socket?.connected && socket.emit("input", input.current),
      50,
    );
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      socket?.emit("input", { x: 0, z: 0 });
      document.body.style.cursor = "auto";
    };
  }, [socket]);
  function stick(e) {
    const rect = joystick.current.getBoundingClientRect(),
      x = (e.clientX - rect.left - rect.width / 2) / 30,
      z = (e.clientY - rect.top - rect.height / 2) / 30,
      len = Math.max(1, Math.hypot(x, z));
    input.current = { x: x / len, z: z / len };
    joystick.current.style.setProperty(
      "--stick-x",
      `${input.current.x * 23}px`,
    );
    joystick.current.style.setProperty(
      "--stick-y",
      `${input.current.z * 23}px`,
    );
  }
  function stopStick() {
    input.current = { x: 0, z: 0 };
    joystick.current?.style.setProperty("--stick-x", "0px");
    joystick.current?.style.setProperty("--stick-y", "0px");
  }
  const AudioCtx = useRef(null);
  function toggleSound() {
    if (!sound) {
      const ctx = (AudioCtx.current ||= new (window.AudioContext ||
        window.webkitAudioContext)());
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
    setSound(!sound);
  }
  useEffect(() => {
    if (sound && world?.round?.result && AudioCtx.current) {
      const ctx = AudioCtx.current,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.frequency.value = 783.99;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    }
  }, [world?.round?.result?.name, sound]);
  return (
    <div className={`world-wrap ${large ? "expanded" : ""}`}>
      <WorldBoundary>
        <Canvas
          shadows
          orthographic
          camera={{ position: [18, 21, 23], zoom: 26, near: 0.1, far: 100 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true }}
        >
          <CameraRig />
          <Suspense fallback={null}>
            <Scene
              games={games}
              world={world}
              me={me}
              game={game}
              onEnter={onEnter}
              onCreate={onCreate}
              labels={labelLayer}
            />
          </Suspense>
        </Canvas>
      </WorldBoundary>
      <div className="world-labels" ref={labelLayer} />
      <div className="world-top">
        <div className="world-title">
          <span className="live-dot" />
          <div>
            <strong>{game ? game.name : "The living room"}</strong>
            <small>
              {game
                ? "Your family’s playground"
                : `${games.length} games · a little something for everyone`}
            </small>
          </div>
        </div>
        <div className="world-tools">
          <button
            className="icon-btn translucent"
            title={sound ? "Turn off game sounds" : "Turn on game sounds"}
            onClick={toggleSound}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            className="icon-btn translucent"
            title={large ? "Shrink world" : "Expand world"}
            onClick={() => setLarge(!large)}
          >
            {large ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      <div className="world-bottom">
        <span className="world-hint">
          <Move size={15} />
          <span>
            <b>
              {game ? "Make yourself at home" : "Click a little world to play"}
            </b>
            <small>
              {me
                ? "WASD / arrow keys to wander"
                : "Join the family to wander together"}
            </small>
          </span>
        </span>
        <span className="world-caption">
          Made for togetherness <span>✦</span>
        </span>
      </div>
      {me && (
        <div
          className="joystick"
          ref={joystick}
          role="application"
          aria-label="Movement joystick"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            stick(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) stick(e);
          }}
          onPointerUp={stopStick}
          onPointerCancel={stopStick}
        >
          <span />
        </div>
      )}
    </div>
  );
}
