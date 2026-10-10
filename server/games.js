import { z } from "zod";

export const gameSchema = z
  .object({
    name: z.string().trim().min(3).max(45),
    description: z.string().trim().min(10).max(220),
    kind: z.enum(["collect", "snowball", "freeze", "build", "custom"]),
    theme: z.enum(["garden", "winter", "candy", "space"]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    duration: z.number().int().min(30).max(180),
    target: z.number().int().min(5).max(50),
    instructions: z.string().trim().min(10).max(300),
    code: z.string().trim().min(30).max(30000).optional(),
  })
  .refine((g) => g.kind !== "custom" || !!g.code, {
    message: "Custom games need a playable script.",
  });

export const seedGames = [
  {
    id: "snowball-social",
    name: "Snowball Social",
    description:
      "A friendly snowball showdown. Dodge, toss, and laugh together.",
    kind: "snowball",
    theme: "winter",
    color: "#a8cbd5",
    duration: 90,
    target: 15,
    instructions:
      "Move with WASD, arrow keys, or the joystick. Tap Toss to throw toward the nearest player. Each hit earns a point.",
    creator: "Holiday Arcade",
    featured: true,
  },
  {
    id: "cookie-quest",
    name: "Cookie Quest",
    description:
      "Collect all the cookies before someone else eats your high score.",
    kind: "collect",
    theme: "candy",
    color: "#efbd87",
    duration: 90,
    target: 20,
    instructions:
      "Run around the gingerbread garden and collect golden cookies. The family member with the most cookies wins!",
    creator: "Holiday Arcade",
  },
  {
    id: "freeze-frame",
    name: "Freeze Frame",
    description: "Dance like nobody’s watching. Freeze like everybody is.",
    kind: "freeze",
    theme: "space",
    color: "#c3b9e0",
    duration: 60,
    target: 10,
    instructions:
      "Allow your camera, dance while the light is green, and hold still when it turns red. Only a motion score leaves your device; video stays private.",
    creator: "Holiday Arcade",
  },
  {
    id: "little-world",
    name: "Our Little World",
    description:
      "Build something wonderfully weird, one colorful block at a time.",
    kind: "build",
    theme: "garden",
    color: "#b9d4b2",
    duration: 120,
    target: 20,
    instructions:
      "Move around and tap Build to place a block beside you. Pick a color and build a shared family world. Tap Undo to remove your last block.",
    creator: "Holiday Arcade",
  },
];

export function demoGame(messages) {
  const idea = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const lower = idea.toLowerCase();
  const kind = /camera|dance|freeze/.test(lower)
    ? "freeze"
    : /build|block|co.?op|together/.test(lower)
      ? "build"
      : /battle|snowball|fight|throw/.test(lower)
        ? "snowball"
        : "collect";
  const theme = /space|alien|planet|moon/.test(lower)
    ? "space"
    : /snow|winter|christmas|ice/.test(lower)
      ? "winter"
      : /cookie|candy|cake|gingerbread|sweet/.test(lower)
        ? "candy"
        : "garden";
  const names = {
    space: "Cosmic",
    winter: "Snowy",
    candy: "Candy",
    garden: "Secret Garden",
  };
  const endings = {
    collect: "Quest",
    snowball: "Showdown",
    freeze: "Dance Party",
    build: "Builders",
  };
  const base = seedGames.find((g) => g.kind === kind);
  return gameSchema.parse({
    ...base,
    name: `${names[theme]} ${endings[kind]}`,
    theme,
    color: {
      space: "#c3b9e0",
      winter: "#a8cbd5",
      candy: "#efbd87",
      garden: "#b9d4b2",
    }[theme],
    description: `Your family’s ${theme} ${kind === "build" ? "building adventure" : kind === "freeze" ? "freeze dance party" : kind === "snowball" ? "friendly showdown" : "collection race"}. Made from your idea, ready to play together.`,
  });
}

export function demoReply(messages) {
  const latest = messages.at(-1)?.content || "";
  if (messages.filter((m) => m.role === "user").length === 1)
    return `I love the sound of that! We can turn it into a collection race, a snowball showdown, a freeze dance game, or a world you build together. Should your world feel like a snowy village, a candy garden, outer space, or a secret garden?`;
  const plan = demoGame(messages);
  return `Here’s our plan: **${plan.name}** — ${plan.description} ${plan.instructions} ${/ready|build|yes|make|go/.test(latest.toLowerCase()) ? "Ready when you are!" : "Tell me anything you’d like to change, or tap “Build my game” to bring it to life."}`;
}
