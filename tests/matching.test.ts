import { describe, expect, it } from "vitest";
import { getBestMatchReason, rankWorkers, scoreWorker } from "../lib/matching";
import type { Worker } from "../lib/types";

const mockWorker = (overrides: Partial<Worker> = {}): Worker => ({
  id: "w-test",
  name: "Santosh Verma",
  emoji: "🔧",
  bio: "Experienced technician",
  categories: ["plumber"],
  baseRate: 350,
  rating: 4.8,
  jobsDone: 42,
  badges: ["id_verified", "background_checked"],
  reviews: [],
  online: true,
  loc: { lat: 19.22, lng: 72.97 },
  ...overrides,
});

describe("Matching Algorithm (lib/matching.ts)", () => {
  it("gives higher scores to closer workers", () => {
    const w = mockWorker();
    const scoreClose = scoreWorker(w, 1.0, 10, 400);
    const scoreFar = scoreWorker(w, 8.0, 10, 400);

    expect(scoreClose).toBeGreaterThan(scoreFar);
  });

  it("gives higher score to workers with higher ratings", () => {
    const highRated = mockWorker({ rating: 4.9 });
    const lowRated = mockWorker({ rating: 3.5 });

    const scoreHigh = scoreWorker(highRated, 2.0, 10, 400);
    const scoreLow = scoreWorker(lowRated, 2.0, 10, 400);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it("penalizes workers whose rates significantly exceed the customer budget", () => {
    const withinBudget = mockWorker({ baseRate: 300 });
    const overBudget = mockWorker({ baseRate: 700 });

    const scoreWithin = scoreWorker(withinBudget, 2.0, 10, 350);
    const scoreOver = scoreWorker(overBudget, 2.0, 10, 350);

    expect(scoreWithin).toBeGreaterThan(scoreOver);
  });

  it("boosts score for verified badges", () => {
    const verified = mockWorker({ badges: ["id_verified", "background_checked", "skill_certified"] });
    const unverified = mockWorker({ badges: [] });

    const scoreVerified = scoreWorker(verified, 2.0, 10, 400);
    const scoreUnverified = scoreWorker(unverified, 2.0, 10, 400);

    expect(scoreVerified).toBeGreaterThan(scoreUnverified);
  });

  it("ranks candidates and marks exactly one Best Match with a sensible reason", () => {
    const workers = [
      { worker: mockWorker({ id: "w1", baseRate: 600, rating: 3.8 }), distanceKm: 7 },
      { worker: mockWorker({ id: "w2", baseRate: 300, rating: 4.9, badges: ["id_verified", "background_checked"] }), distanceKm: 1.5 },
      { worker: mockWorker({ id: "w3", baseRate: 350, rating: 4.2 }), distanceKm: 3 },
    ];

    const ranked = rankWorkers(workers, 10, 400, "plumber");

    expect(ranked).toHaveLength(3);
    expect(ranked[0].worker.id).toBe("w2");
    expect(ranked[0].isBestMatch).toBe(true);
    expect(ranked[0].matchReason).toBeDefined();
    expect(typeof ranked[0].matchReason).toBe("string");
    expect(ranked[0].matchReason?.length).toBeGreaterThan(5);

    // Other candidates should not be marked as best match
    expect(ranked[1].isBestMatch).toBe(false);
    expect(ranked[2].isBestMatch).toBe(false);
  });

  it("produces appropriate match reasons based on worker profile", () => {
    const verifiedNear = mockWorker({
      baseRate: 300,
      rating: 4.6,
      badges: ["id_verified"],
    });
    const reason = getBestMatchReason(verifiedNear, 2.0, 350, "plumber");
    expect(reason).toContain("Nearest verified");
    expect(reason).toContain("budget");
  });
});
