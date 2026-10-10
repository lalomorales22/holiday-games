// Example custom game for the Holiday Arcade browser sandbox.
// Available globals: THREE, ARCADE. No imports or external assets.
const renderer = new THREE.WebGLRenderer({
  canvas: ARCADE.canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color("#dfe9d9");
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(15, 20, 22);
camera.lookAt(0, 0, 0);
scene.add(new THREE.AmbientLight("#ffffff", 2));
const sunlight = new THREE.DirectionalLight("#ffffff", 2);
sunlight.position.set(5, 12, 7);
scene.add(sunlight);
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(20, 0.4, 17),
  new THREE.MeshStandardMaterial({ color: "#b5c7a0" }),
);
ground.position.y = -0.2;
scene.add(ground);
const members = new Map();
const coins = Array.from({ length: 12 }, (_, i) => {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.12, 8, 16),
    new THREE.MeshStandardMaterial({
      color: "#e8bb51",
      metalness: 0.25,
      roughness: 0.5,
    }),
  );
  mesh.position.set(
    Math.cos(i * 2.4) * (3 + (i % 4)),
    0.6,
    Math.sin(i * 2.4) * (3 + (i % 3)),
  );
  scene.add(mesh);
  return mesh;
});
let latest = null,
  lastCollected = 0;
ARCADE.onResize((width, height) => {
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
ARCADE.onState((state) => {
  if (!state) return;
  latest = state;
  for (const player of state.players) {
    if (!members.has(player.id)) {
      const body = new THREE.Group();
      const shirt = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 0.5, 4, 8),
        new THREE.MeshStandardMaterial({ color: player.color }),
      );
      shirt.position.y = 0.8;
      body.add(shirt);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 12, 8),
        new THREE.MeshStandardMaterial({ color: "#f1d5b5" }),
      );
      head.position.y = 1.5;
      body.add(head);
      scene.add(body);
      members.set(player.id, body);
    }
    members.get(player.id).position.set(player.x, 0, player.z);
  }
  for (const [id, body] of members)
    if (!state.players.some((p) => p.id === id)) {
      scene.remove(body);
      body.traverse((obj) => {
        obj.geometry?.dispose();
        obj.material?.dispose();
      });
      members.delete(id);
    }
  const round = state.round;
  for (let i = 0; i < coins.length; i++)
    coins[i].visible =
      !round?.number || state.custom[`coin-${i}`] !== round.number;
  const me = state.players.find((p) => p.id === ARCADE.me.id);
  if (
    me &&
    round?.remaining > 0 &&
    !round.result &&
    Date.now() - lastCollected > 1100
  ) {
    const index = coins.findIndex(
      (coin) =>
        coin.visible &&
        Math.hypot(coin.position.x - me.x, coin.position.z - me.z) < 0.8,
    );
    if (index >= 0) {
      lastCollected = Date.now();
      coins[index].visible = false;
      ARCADE.set(`coin-${index}`, round.number);
      ARCADE.score(1);
      ARCADE.emit("found", { coin: index });
    }
  }
  ARCADE.status(
    round?.remaining > 0
      ? `${state.players.length} family members exploring · Collect golden rings!`
      : "A family treasure garden · Start a round to hunt together",
  );
});
function animate(time) {
  requestAnimationFrame(animate);
  for (const coin of coins) {
    coin.rotation.y = time * 0.001;
    coin.position.y = 0.6 + Math.sin(time * 0.002 + coin.position.x) * 0.08;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
