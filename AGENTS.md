# Holiday Arcade

This project is a home-hosted multiplayer arcade for family phones and computers. Use the existing checkout; cloud tasks already run in an isolated environment. Do not create a worktree unless requested.

- Requires Node.js 22.12+; use `npm ci`, `npm run build`, and `npm start` for production, or `npm run dev` for development.
- `npm test` runs real HTTP / Socket.IO integration tests. After a build, `npx playwright test` runs desktop and phone browser flows using temporary data and a mock AI provider.
- For game design or authoring, read `skills/create-family-game/SKILL.md`. See `examples/treasure-garden.js` for the custom-game SDK.
- Keep provider keys server-side. Never print or commit `.env`, `.holiday-data/`, secrets, or family photos. Download packaging uses an explicit list of public project directories.
- Generated custom game scripts run in an opaque-origin iframe with network access disabled. Keep `sandbox="allow-scripts"`, the restrictive frame CSP, and source/token checks on the message bridge. Never execute generated code on the Node server or relax those boundaries to accommodate a broken game.
- Shared built-in gameplay belongs in `server/world.js`. Declarative plan validation is in `server/games.js`. The browser SDK is `src/game-runtime.js`; its production bundle is built separately into `dist/runtime/`.
- Do not describe a queued build as completed, demo mode as live AI, or a mock provider test as a live provider test. Keep family-sized scope and friendly score reporting clear.
