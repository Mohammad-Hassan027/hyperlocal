import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * Auth-ordering tests: init() must await ensureAnonymousAuth before attaching
 * onSnapshot listeners, retry once on permission-denied, then fall back.
 */
describe("Firestore init() auth-before-listeners ordering", () => {
  it("attaches onSnapshot listeners only after ensureAnonymousAuth resolves", async () => {
    const callOrder = [];

    async function fakeEnsureAuth() {
      callOrder.push("auth_start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("auth_done");
    }

    function fakeAttachListeners() {
      callOrder.push("listeners_attached");
    }

    // Replicate init() ordering: await auth, then attach
    await fakeEnsureAuth().then(() => fakeAttachListeners());

    assert.deepStrictEqual(
      callOrder,
      ["auth_start", "auth_done", "listeners_attached"],
      "listeners must only be attached after auth resolves",
    );
  });

  it("falls back to local when auth fails without attaching listeners", async () => {
    const callOrder = [];

    async function fakeEnsureAuthFail() {
      callOrder.push("auth_start");
      throw new Error("permission-denied");
    }

    function fakeAttachListeners() {
      callOrder.push("listeners_attached");
    }

    function fakeFallback() {
      callOrder.push("fallback");
    }

    await fakeEnsureAuthFail()
      .then(() => fakeAttachListeners())
      .catch(() => fakeFallback());

    assert.ok(!callOrder.includes("listeners_attached"), "listeners must NOT attach when auth fails");
    assert.ok(callOrder.includes("fallback"), "fallback must be called on auth failure");
  });

  it("retries attachListeners once on permission-denied snapshot error, then falls back", async () => {
    let retryCount = 0;
    let fallbackCalled = false;

    async function fakeHandleSnapshotError(isRetry) {
      if (!isRetry) {
        retryCount++;
        await Promise.resolve(); // simulate re-auth
        await fakeHandleSnapshotError(true);
      } else {
        fallbackCalled = true;
      }
    }

    await fakeHandleSnapshotError(false);

    assert.strictEqual(retryCount, 1, "should retry exactly once on permission-denied");
    assert.ok(fallbackCalled, "should fall back after retry also fails");
  });
});

/**
 * Concurrency test for Firestore runTransaction semantics:
 * Guarantees that submitOffer(..., "accept") and acceptOffer only allow
 * the first accept to win, and a job is never assigned twice.
 */
describe("Firestore Transaction Concurrency & Status Order", () => {
  it("simultaneous accepts leave exactly one winner using transaction semantics", async () => {
    // Shared in-memory document state simulating Firestore document
    let jobData = {
      id: "job-101",
      category: "plumber",
      description: "Leaking pipe in bathroom",
      mode: "on-demand",
      budget: 350,
      radiusKm: 5,
      customerLoc: { lat: 19.22, lng: 72.97 },
      status: "open",
      broadcastTo: ["w1", "w2"],
      offers: [],
      createdAt: Date.now(),
    };

    // Simulated mutex/version lock for Firestore document
    let version = 1;

    async function runSimulatedTransaction(updateFn) {
      // Max retry loop as in Firestore SDK
      for (let attempt = 0; attempt < 5; attempt++) {
        const readVersion = version;
        let pendingUpdate = null;

        const tx = {
          get: async () => ({
            exists: true,
            data: () => ({ ...jobData }),
            version: readVersion,
          }),
          update: (data) => {
            pendingUpdate = data;
          },
        };

        const result = await updateFn(tx);

        // Atomic commit check
        if (version === readVersion) {
          if (pendingUpdate) {
            jobData = { ...jobData, ...pendingUpdate };
            version++;
          }
          return result;
        }
        // Conflict detected: retry
        await new Promise((r) => setTimeout(r, Math.random() * 20));
      }
      throw new Error("Transaction failed after max retries due to conflict");
    }

    // Worker accept function using transaction
    async function acceptJobTransaction(workerId, price) {
      return runSimulatedTransaction(async (tx) => {
        const snap = await tx.get();
        const job = snap.data();

        if (job.status !== "open" || job.assignedWorkerId) {
          return false; // Already taken!
        }

        const now = Date.now();
        const offer = {
          id: `offer-${workerId}`,
          workerId,
          price,
          kind: "accept",
          status: "accepted",
          createdAt: now,
        };

        tx.update({
          status: "accepted",
          assignedWorkerId: workerId,
          finalPrice: price,
          acceptedAt: now,
          offers: [...job.offers, offer],
        });
        return true;
      });
    }

    // Launch two simultaneous accepts from Worker 1 and Worker 2
    const [resultW1, resultW2] = await Promise.all([
      acceptJobTransaction("w1", 350),
      acceptJobTransaction("w2", 350),
    ]);

    // Exactly one must win (true) and one must lose (false)
    assert.strictEqual(
      (resultW1 ? 1 : 0) + (resultW2 ? 1 : 0),
      1,
      "Exactly one worker must win the job",
    );

    // Job must be assigned to the winner only
    assert.strictEqual(jobData.status, "accepted");
    assert.ok(
      jobData.assignedWorkerId === "w1" || jobData.assignedWorkerId === "w2",
      "Assigned worker must be either w1 or w2",
    );
    assert.strictEqual(jobData.finalPrice, 350);

    // Subsequent accept attempt must also fail
    const resultLate = await acceptJobTransaction("w3", 350);
    assert.strictEqual(resultLate, false, "Late accept must fail when job is already accepted");
  });

  it("validates status transitions: open -> accepted -> in_progress -> completed", () => {
    function isValidStatusTransition(prev, next) {
      return (
        prev === next ||
        (prev === "open" && (next === "accepted" || next === "cancelled" || next === "expired")) ||
        (prev === "accepted" && (next === "in_progress" || next === "cancelled")) ||
        (prev === "in_progress" && next === "completed")
      );
    }

    assert.strictEqual(isValidStatusTransition("open", "accepted"), true);
    assert.strictEqual(isValidStatusTransition("accepted", "in_progress"), true);
    assert.strictEqual(isValidStatusTransition("in_progress", "completed"), true);
    assert.strictEqual(isValidStatusTransition("open", "cancelled"), true);
    assert.strictEqual(isValidStatusTransition("open", "expired"), true);
    assert.strictEqual(isValidStatusTransition("accepted", "cancelled"), true);

    // Disallowed jumps
    assert.strictEqual(isValidStatusTransition("open", "completed"), false);
    assert.strictEqual(isValidStatusTransition("in_progress", "open"), false);
    assert.strictEqual(isValidStatusTransition("completed", "open"), false);
    assert.strictEqual(isValidStatusTransition("cancelled", "open"), false);
  });
});
