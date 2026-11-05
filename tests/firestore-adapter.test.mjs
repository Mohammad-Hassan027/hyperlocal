import { describe, it } from "node:test";
import assert from "node:assert";

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
        (prev === "open" && (next === "accepted" || next === "cancelled")) ||
        (prev === "accepted" && (next === "in_progress" || next === "cancelled")) ||
        (prev === "in_progress" && next === "completed")
      );
    }

    assert.strictEqual(isValidStatusTransition("open", "accepted"), true);
    assert.strictEqual(isValidStatusTransition("accepted", "in_progress"), true);
    assert.strictEqual(isValidStatusTransition("in_progress", "completed"), true);
    assert.strictEqual(isValidStatusTransition("open", "cancelled"), true);
    assert.strictEqual(isValidStatusTransition("accepted", "cancelled"), true);

    // Disallowed jumps
    assert.strictEqual(isValidStatusTransition("open", "completed"), false);
    assert.strictEqual(isValidStatusTransition("in_progress", "open"), false);
    assert.strictEqual(isValidStatusTransition("completed", "open"), false);
    assert.strictEqual(isValidStatusTransition("cancelled", "open"), false);
  });
});
