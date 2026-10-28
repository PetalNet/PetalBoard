import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FRIENDSGIVING_POTLUCK, type PotluckConfig } from "$lib/potluck";

// The real scrypt hash blocks the event loop ~90ms per request, which would
// stagger the concurrent signups below instead of overlapping them.
vi.mock("$lib/server/security", () => ({
  hashPin: (pin: string) => `test:${pin}`,
  verifyPin: (pin: string, hash: string) => hash === `test:${pin}`,
}));

const dir = mkdtempSync(join(tmpdir(), "petalboard-potluck-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;

type Actions = typeof import("./+page.server").actions;
type Prisma = typeof import("$lib/server/prisma").default;
let actions: Actions;
let prisma: Prisma;
let publicCode: string;
let questionId: string;
let pinSeq = 1000;

const strict: PotluckConfig = { ...FRIENDSGIVING_POTLUCK, minOptions: 1 };

function post(action: keyof Actions, fields: Record<string, string>) {
  const body = new FormData();
  body.set("email", "");
  body.set("guestCount", "1");
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const request = new Request(`http://localhost/event/${publicCode}?/${action}`, {
    method: "POST",
    body,
  });
  const handler = actions[action] as (e: unknown) => Promise<any>;
  return handler({ request, params: { code: publicCode }, locals: {} });
}

function signUp(category: string, dish: string) {
  const pin = String(pinSeq++);
  return post("rsvp", {
    name: `Guest ${pin}`,
    pin,
    status: "attending",
    [`response_${questionId}`]: JSON.stringify({ category, dish }),
  }).then((result) => ({ result, pin }));
}

const accepted = (r: any) => r?.success === true;

async function countIn(category: string) {
  const rows = await prisma.response.findMany({ where: { questionId } });
  return rows.filter((r) => JSON.parse(r.value).category === category).length;
}

beforeAll(async () => {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: process.env,
    stdio: "ignore",
  });
  ({ actions } = await import("./+page.server"));
  prisma = (await import("$lib/server/prisma")).default;
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { email: "host@example.test", passwordHash: "x", name: "Host" },
  });
  const event = await prisma.event.create({
    data: {
      title: "Test potluck",
      date: new Date("2026-11-26T18:00:00Z"),
      publicCode: `pc${pinSeq}`,
      manageToken: `mt${pinSeq}`,
      userId: user.id,
      questions: {
        create: {
          type: "potluck",
          label: "What are you bringing?",
          isPublic: true,
          potluckConfig: JSON.stringify(strict),
        },
      },
    },
    include: { questions: true },
  });
  publicCode = event.publicCode;
  questionId = event.questions[0].id;

  const seed = { sides: 5, "apps-snacks": 2, desserts: 1, drinks: 1 };
  for (const [category, n] of Object.entries(seed)) {
    for (let i = 0; i < n; i++) {
      await prisma.rsvp.create({
        data: {
          name: `Seed ${category} ${i}`,
          pinHash: `seed-${category}-${i}`,
          eventId: event.id,
          responses: {
            create: { questionId, value: JSON.stringify({ category, dish: `${category} ${i}` }) },
          },
        },
      });
    }
  }
});

describe("potluck signups", () => {
  it("accepts exactly the two desserts the ratio allows when eight guests submit at once", async () => {
    // 9 dishes, 1 dessert at 20%: dessert 2 fits ceil(0.2 * 10) = 2, dessert 3 fits ceil(0.2 * 11) = 3,
    // dessert 4 would need ceil(0.2 * 12) = 3, so exactly two more are accepted.
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => signUp("desserts", `pie ${i}`)),
    );
    const outcomes = results.map(({ result }) => (accepted(result) ? "ok" : result.status));
    expect(outcomes.filter((o) => o === "ok")).toHaveLength(2);
    expect(outcomes.filter((o) => o === 409)).toHaveLength(6);
    expect(await countIn("desserts")).toBe(3);
  }, 60_000);

  it("tells a rejected guest which categories are still needed", async () => {
    await signUp("desserts", "pie a");
    await signUp("desserts", "pie b");
    const { result } = await signUp("desserts", "pie c");
    expect(result.status).toBe(409);
    expect(result.data.potluck.offered).not.toContain("desserts");
    expect(result.data.message).toMatch(/^Desserts has enough for now\. Still needed: /);
  });

  it("frees a dessert slot when a guest cancels", async () => {
    await signUp("desserts", "pie a");
    const { result: second, pin } = await signUp("desserts", "pie b");
    expect(accepted((await signUp("desserts", "pie c")).result)).toBe(false);

    const cancelled = await post("cancelRsvp", { rsvpId: second.rsvpId, pin });
    expect(cancelled.success).toBe(true);
    expect(accepted((await signUp("desserts", "pie c")).result)).toBe(true);
  });

  it("frees a dessert slot when a guest edits their dish to a side", async () => {
    await signUp("desserts", "pie a");
    const { result: second, pin } = await signUp("desserts", "pie b");
    const edited = await post("updateRsvp", {
      rsvpId: second.rsvpId,
      pin,
      name: "Guest edited",
      status: "attending",
      [`response_${questionId}`]: JSON.stringify({ category: "sides", dish: "stuffing" }),
    });
    expect(edited.success).toBe(true);
    expect(await countIn("desserts")).toBe(2);
    expect(accepted((await signUp("desserts", "pie c")).result)).toBe(true);
  });

  it("lets a guest keep their dessert while editing after desserts closed", async () => {
    await signUp("desserts", "pie a");
    const { result: second, pin } = await signUp("desserts", "pie b");
    const edited = await post("updateRsvp", {
      rsvpId: second.rsvpId,
      pin,
      name: "Guest renamed",
      status: "attending",
      [`response_${questionId}`]: JSON.stringify({ category: "desserts", dish: "pecan pie" }),
    });
    expect(edited.success).toBe(true);
    expect(await countIn("desserts")).toBe(3);
  });

  it("rejects free text that is not a category and dish", async () => {
    const result = await post("rsvp", {
      name: "Guest free text",
      pin: "4321",
      status: "attending",
      [`response_${questionId}`]: "brownies",
    });
    expect(result.status).toBe(409);
    expect(await prisma.rsvp.count({ where: { name: "Guest free text" } })).toBe(0);
  });
});
