import request from "supertest";
import app from "../src/app.js";

const validAddress = "0x1234567890123456789012345678901234567890";

function futureDeadline(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe("Campaign search & discovery (integration)", () => {
  let educationId: number | null = null;
  let healthId: number | null = null;
  let artId: number | null = null;

  beforeAll(async () => {
    // Create a few campaigns with distinct titles/descriptions/goals
    const baseAddr = "0x" + "1".repeat(40);

    const educationRes = await request(app)
      .post("/api/campaigns")
      .send({
        title: "Education for All",
        description: "Supporting education in rural areas",
        goal: "5000000000000000000", // 5 ETH
        deadline: futureDeadline(30),
        creator: validAddress,
        campaignAddress: baseAddr,
        txHash: "0x" + "c".repeat(64),
      });
    educationId = educationRes.body?.id ?? null;

    const healthRes = await request(app)
      .post("/api/campaigns")
      .send({
        title: "Health & Wellness Initiative",
        description: "Healthcare support",
        goal: "10000000000000000000", // 10 ETH
        deadline: futureDeadline(15),
        creator: validAddress,
        campaignAddress: "0x" + "2".repeat(40),
        txHash: "0x" + "d".repeat(64),
      });
    healthId = healthRes.body?.id ?? null;

    const artRes = await request(app)
      .post("/api/campaigns")
      .send({
        title: "Community Art Project",
        description: "Public art and education",
        goal: "2000000000000000000", // 2 ETH
        deadline: futureDeadline(5),
        creator: validAddress,
        campaignAddress: "0x" + "3".repeat(40),
        txHash: "0x" + "e".repeat(64),
      });
    artId = artRes.body?.id ?? null;

    // Mark one campaign as Successful and one as Failed to test status filters
    if (healthId) {
      await request(app)
        .patch(`/api/campaigns/${healthId}/status`)
        .send({ status: "Successful" });
    }
    if (artId) {
      await request(app)
        .patch(`/api/campaigns/${artId}/status`)
        .send({ status: "Failed" });
    }
  });

  it("GET /api/campaigns/search?q=education returns campaigns containing keyword", async () => {
    const res = await request(app).get("/api/campaigns/search").query({ q: "education" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const titles = res.body.items.map(
      (c: { title: string; description: string }) =>
        (c.title + " " + c.description).toLowerCase()
    );
    expect(titles.some((t: string) => t.includes("education"))).toBe(true);
  });

  it("GET /api/campaigns/search?status=active returns only active campaigns", async () => {
    const res = await request(app).get("/api/campaigns/search").query({ status: "active" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const c of res.body.items as { status: string }[]) {
      expect(c.status).toBe("Active");
    }
  });

  it("GET /api/campaigns/search?status=successful returns only successful campaigns", async () => {
    const res = await request(app)
      .get("/api/campaigns/search")
      .query({ status: "successful" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const c of res.body.items as { status: string }[]) {
      expect(c.status).toBe("Successful");
    }
  });

  it("filters by goal range correctly", async () => {
    // Min goal 3 ETH (3e18) should exclude the 2 ETH campaign
    const res = await request(app)
      .get("/api/campaigns/search")
      .query({ goalMin: "3000000000000000000" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const c of res.body.items as { goal: string }[]) {
      expect(BigInt(c.goal) >= 3000000000000000000n).toBe(true);
    }
  });

  it("supports pagination", async () => {
    const page1 = await request(app)
      .get("/api/campaigns/search")
      .query({ page: 1, pageSize: 1 });
    expect(page1.status).toBe(200);
    expect(page1.body.page).toBe(1);
    expect(page1.body.items.length).toBeLessThanOrEqual(1);
    expect(page1.body.total).toBeGreaterThanOrEqual(page1.body.items.length);

    const page2 = await request(app)
      .get("/api/campaigns/search")
      .query({ page: 2, pageSize: 1 });
    expect(page2.status).toBe(200);
    expect(page2.body.page).toBe(2);
    expect(page2.body.items.length).toBeLessThanOrEqual(1);
  });

  it("returns empty result safely when no campaigns found", async () => {
    const res = await request(app)
      .get("/api/campaigns/search")
      .query({ q: "this-keyword-should-not-exist-xyz" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(0);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it("handles empty search (no filters) without error", async () => {
    const res = await request(app).get("/api/campaigns/search");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });

  it("ignores invalid numeric filters gracefully", async () => {
    const res = await request(app)
      .get("/api/campaigns/search")
      .query({ goalMin: "not-a-number", page: "foo" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    // At least does not crash and returns some structure
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("pageSize");
  });
});

