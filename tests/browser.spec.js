import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
async function join(page, name) {
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page
    .getByLabel("Family invite code", { exact: true })
    .fill("BROWSERTEST");
  await page.getByRole("button", { name: "Let me in" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("3D dashboard, first-visit game selection, multiplayer room, keyboard movement, and round controls", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".portal-label")).toHaveCount(4);
  await expect(page.locator(".game-card")).toHaveCount(4);
  const portal = await page.locator(".portal-label").first().boundingBox();
  expect(portal.width).toBeLessThan(200);
  await page.locator(".game-card").filter({ hasText: "Cookie Quest" }).click();
  await join(page, "Alex");
  await expect(page.locator(".room-title h1")).toHaveText("Cookie Quest");
  await expect(page.locator(".score-row")).toHaveCount(1);
  const other = await browser.newContext();
  const cousin = await other.newPage();
  await cousin.goto("/");
  await cousin
    .getByRole("button", { name: "Join the family", exact: true })
    .click();
  await join(cousin, "Jamie");
  await expect(cousin.getByText("At home", { exact: true })).toBeVisible();
  await cousin
    .locator(".game-card")
    .filter({ hasText: "Cookie Quest" })
    .click();
  await expect(page.locator(".score-row")).toHaveCount(2);
  await expect(cousin.locator(".score-row")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Start a round", exact: true })
    .click();
  await expect(
    cousin.getByRole("button", { name: "Round in progress" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Room message" })
    .fill("Hi from the cookie garden!");
  await page.getByRole("button", { name: "Send room message" }).click();
  await expect(cousin.locator(".room-messages")).toContainText(
    "Hi from the cookie garden!",
  );
  const before = await page.locator(".player-label.me").boundingBox();
  await page.locator(".room-title h1").click();
  await page.keyboard.down("d");
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(".player-label.me").boundingBox()).x - before.x,
      ),
    )
    .toBeGreaterThan(10);
  await page.keyboard.up("d");
  await page.screenshot({ path: "/tmp/holiday-game-verified.png" });
  await page
    .getByRole("button", { name: "The living room", exact: true })
    .click();
  await page.getByRole("button", { name: "✦ Game studio" }).click();
  await expect(page.locator(".studio-heading h1")).toHaveText(
    "What should we play?",
  );
  await other.close();
  expect(errors).toEqual([]);
});

test("chat creates a game in the background, returns to the shelf, and the new game is playable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create a game", exact: true })
    .click();
  await join(page, "Game Maker");
  await expect(page.locator(".studio-heading h1")).toHaveText(
    "What should we play?",
  );
  await page
    .getByRole("textbox", { name: "Your game idea" })
    .fill("A cookie collection race in outer space");
  await page.getByRole("button", { name: "Send idea" }).click();
  await expect(page.locator(".chat-message.assistant")).toHaveCount(2);
  await page.screenshot({ path: "/tmp/holiday-studio-verified.png" });
  await page.getByRole("button", { name: "Build my game" }).click();
  await expect(
    page.locator(".game-card").filter({ hasText: "Cosmic Quest" }),
  ).toBeVisible();
  await page.locator(".game-card").filter({ hasText: "Cosmic Quest" }).click();
  await expect(page.locator(".room-title h1")).toHaveText("Cosmic Quest");
  await page
    .getByRole("button", { name: "Start a round", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Round in progress" }),
  ).toBeDisabled();
});

test("phone layout, photo avatar upload, camera enable/disable, and host-only settings", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page
    .getByRole("button", { name: "Join the family", exact: true })
    .click();
  const photo = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#df876d";
    ctx.fillRect(0, 0, 128, 128);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "family-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(photo, "base64"),
    });
  await join(page, "Photo Pal");
  await expect(page.getByText("At home", { exact: true })).toBeAttached();
  await expect(page.locator(".profile-button img")).toHaveAttribute(
    "src",
    /^data:image\/jpeg/,
  );
  await expect(page.locator(".player-label.me")).toBeVisible();
  const before = await page.locator(".player-label.me").boundingBox(),
    joystick = await page.locator(".joystick").boundingBox();
  await page.mouse.move(
    joystick.x + joystick.width - 8,
    joystick.y + joystick.height / 2,
  );
  await page.mouse.down();
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(".player-label.me").boundingBox()).x - before.x,
      ),
    )
    .toBeGreaterThan(6);
  await page.mouse.up();
  await page.screenshot({
    path: "/tmp/holiday-mobile-verified.png",
    fullPage: true,
  });
  await page.locator(".game-card").filter({ hasText: "Freeze Frame" }).click();
  await page.getByRole("button", { name: "Enable my camera" }).click();
  await expect(page.locator(".camera-panel video")).toBeVisible();
  await page
    .getByRole("button", { name: "Start a round", exact: true })
    .click();
  await expect(page.locator(".camera-status")).toContainText(
    /Time to dance|Hold still/,
  );
  await page.getByRole("button", { name: "Turn off camera" }).click();
  await expect(page.locator(".camera-panel video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Host settings", exact: true })
    .click();
  await page
    .getByLabel("Host password", { exact: true })
    .fill("browser-test-host");
  await page.getByRole("button", { name: "Unlock settings" }).click();
  await expect(page.getByLabel("API provider URL")).toHaveValue(
    "https://api.openai.com/v1",
  );
  await page
    .getByLabel("Family name", { exact: true })
    .fill("The Holiday Crew");
  await page.getByRole("button", { name: "Save house settings" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("AI-written Three.js world runs in a network-disabled sandbox with shared state across players", async ({
  page,
  browser,
}) => {
  const code = `const renderer=new THREE.WebGLRenderer({canvas:ARCADE.canvas});const scene=new THREE.Scene();scene.background=new THREE.Color('#dfe9d9');const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,8,12);camera.lookAt(0,0,0);scene.add(new THREE.AmbientLight('#ffffff',3));const cube=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:'#b495cc'}));scene.add(cube);ARCADE.onResize((w,h)=>{renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});ARCADE.onState(s=>{if(s)ARCADE.status('Family flag: '+(s.custom.greeting||'waiting')+' · '+s.players.length+' exploring');});ARCADE.set('greeting','made together');try{window.parent.document.body;ARCADE.set('isolation','failed');}catch(e){ARCADE.set('isolation','protected');}fetch('/api/host/settings').catch(()=>ARCADE.set('network','blocked'));function draw(){requestAnimationFrame(draw);cube.rotation.y+=.01;renderer.render(scene,camera);}draw();`;
  const provider = createServer(async (req, res) => {
    for await (const part of req) {
    }
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Family Cube Garden",
                description: "A little custom world made together.",
                kind: "custom",
                theme: "garden",
                color: "#b495cc",
                duration: 60,
                target: 10,
                instructions:
                  "Explore with arrow keys or the phone joystick. Look at the shared family flag.",
                code,
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let other;
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Join the family", exact: true })
      .click();
    await join(page, "AI Explorer");
    await page.request.post("/api/host/login", {
      data: { password: "browser-test-host" },
    });
    const save = await page.request.post("/api/host/settings", {
      data: {
        familyName: "The Holiday Crew",
        aiUrl: `http://127.0.0.1:${provider.address().port}/v1`,
        aiModel: "mock-model",
        apiKey: "browser-local-mock",
      },
    });
    expect(save.ok()).toBeTruthy();
    const build = await page.request.post("/api/studio/build", {
      data: {
        messages: [
          { role: "user", content: "Build a custom family cube garden" },
        ],
      },
    });
    expect(build.status()).toBe(202);
    await page.reload();
    await expect(
      page.locator(".game-card").filter({ hasText: "Family Cube Garden" }),
    ).toBeVisible();
    await expect(page.getByText("At home", { exact: true })).toBeVisible();
    await page
      .locator(".game-card")
      .filter({ hasText: "Family Cube Garden" })
      .click();
    await expect(page.locator(".custom-game iframe")).toHaveAttribute(
      "sandbox",
      "allow-scripts",
    );
    const frame = page.frameLocator(".custom-game iframe");
    await expect(frame.locator("#status")).toContainText("made together");
    await expect(page.locator(".custom-loading")).toHaveCount(0);
    other = await browser.newContext();
    const cousin = await other.newPage();
    await cousin.goto("/");
    await cousin
      .getByRole("button", { name: "Join the family", exact: true })
      .click();
    await join(cousin, "Cube Cousin");
    await expect(cousin.getByText("At home", { exact: true })).toBeVisible();
    await cousin
      .locator(".game-card")
      .filter({ hasText: "Family Cube Garden" })
      .click();
    await expect(
      cousin.frameLocator(".custom-game iframe").locator("#status"),
    ).toContainText("made together · 2 exploring");
    await expect(frame.locator("#status")).toContainText("2 exploring");
    const data = await page.request.get("/api/bootstrap");
    const game = (await data.json()).games.find(
      (g) => g.name === "Family Cube Garden",
    );
    const response = await page.request.get(
      `/api/games/${game.id}/play?bridge=${"a".repeat(32)}`,
    );
    expect(response.headers()["content-security-policy"]).toContain(
      "connect-src 'none'",
    );
    const protectedState = await frame
      .locator("#game")
      .evaluate(() => ({
        isolation: window.ARCADE.state.custom.isolation,
        network: window.ARCADE.state.custom.network,
      }));
    expect(protectedState).toEqual({
      isolation: "protected",
      network: "blocked",
    });
    await page
      .getByRole("button", { name: "Start a round", exact: true })
      .click();
    await expect(
      cousin.getByRole("button", { name: "Round in progress" }),
    ).toBeDisabled();
    await page.screenshot({ path: "/tmp/holiday-custom-verified.png" });
    expect(errors).toEqual([]);
    // Readiness must remain stable beyond the initial load timeout.
    await page.waitForTimeout(16000);
    await expect(frame.locator("#status")).toContainText("made together");
  } finally {
    await other?.close();
    await new Promise((resolve) => provider.close(resolve));
  }
});
