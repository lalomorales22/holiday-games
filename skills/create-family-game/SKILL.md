---
name: create-family-game
description: Design and build a multiplayer family game for Holiday Arcade using its supported game engine and authenticated studio API.
---

# Create a family game

Use the existing repository and checkout. Cloud tasks are already isolated; do not create a Git worktree unless the user explicitly requests one.

Holiday Arcade makes validated game plans and can run custom AI-written Three.js scripts in a browser sandbox. Generated JavaScript is syntax-checked on the host without being executed there. Find the server in the host's documented configuration. Do not ask for a host password or API key in chat; the host enters provider credentials in Host settings or the server environment.

1. Help the family member describe one joyful, easy-to-understand idea. Ask one short question at a time. Keep the controls usable on a phone.
2. Choose an existing engine mechanic: `collect` for a collection race, `snowball` for a friendly projectile battle, `freeze` for camera freeze dance, or `build` for collaborative block building. Use `custom` for another simple browser game built with Three.js and the ARCADE SDK. Themes are `garden`, `winter`, `candy`, and `space`. Custom games use procedural geometry, shared positions, room events, saved JSON state, and friendly scores. No imports, external assets, networking, or server code.
3. Agree on a name (3–45 characters), description (10–220), hex color, round duration (30–180 seconds), target (5–50), and accurate instructions (10–300). A custom game also includes `code` (plain JavaScript, up to 30KB). Read `src/game-runtime.js` and `examples/treasure-garden.js` when authoring custom scripts. Themes change the world palette; snowball throws target the nearest other player. Building worlds and custom shared state persist across visits. Collection and battle scoring are computed on the home server. Freeze dance and custom games use client reports and are friendly party games.
4. In the dashboard's authenticated Game studio, use `POST /api/studio/chat` with `{ "messages": [{ "role": "user", "content": "..." }] }` to refine the idea. Use `POST /api/studio/build` with the agreed conversation to queue a background build. These routes require the joining player's HttpOnly session cookie and a matching origin. Do not place credentials in a URL or invent an authentication bypass.
5. Follow the `job-changed` and `library-changed` Socket.IO events or inspect the authenticated `/api/bootstrap` jobs. A successful HTTP 202 is queued, not completed. A build is finished only when the job says `ready` and its game is present on the shelf. Report a failed job's error and allow retry.
6. Join the new room with the Socket.IO `enter` event. Verify the relevant mechanic and invite another family member to verify shared state. Keep camera frames local. Phone cameras require HTTPS; ordinary games work over the LAN URL.

Without an AI key, the demo designer chooses among the same four mechanics using keywords. Label this as demo mode. Do not describe it as live AI generation.

When adding engine mechanics or expanding the sandbox's capabilities, extend the plan schema, world simulation, client rendering/controls, and integration tests together. Provider keys remain exclusively on the host server. Never expand the iframe to allow same-origin scripts, top navigation, or arbitrary network access merely to make generated code work.
