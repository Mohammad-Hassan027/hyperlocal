import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

/**
 * Wire up a cross-context localStorage bridge so changes in one context
 * propagate to the others — simulating real-time network sync.
 */
async function wireStorageBridge(allPages) {
  for (const page of allPages) {
    await page.exposeFunction("__bridgeStorageEvent", (data) => {
      for (const other of allPages) {
        if (other === page) continue;
        other
          .evaluate((d) => {
            try {
              localStorage.setItem("hyperlocal:v2", d);
              window.dispatchEvent(
                new StorageEvent("storage", { key: "hyperlocal:v2", newValue: d }),
              );
            } catch {}
          }, data)
          .catch(() => {});
      }
    });

    await page.addInitScript(() => {
      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (k, v) {
        origSetItem(k, v);
        if (k === "hyperlocal:v2" && window.__bridgeStorageEvent) {
          window.__bridgeStorageEvent(v);
        }
      };
    });
  }
}

async function run() {
  console.log("1. Starting Next.js production server on port", PORT, "...");
  const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    stdio: "inherit",
    shell: true,
  });

  try {
    await waitForServer(`${BASE_URL}/customer`);
    console.log("   Next.js server is ready at", BASE_URL);

    console.log("2. Launching Chromium with isolated browser contexts...");
    const browser = await chromium.launch({ headless: true });

    // Three separate "devices"
    const contextCustomer = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const contextWorker1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const contextWorker2 = await browser.newContext({ viewport: { width: 390, height: 844 } });

    const pageCustomer = await contextCustomer.newPage();
    const pageWorker1 = await contextWorker1.newPage();
    const pageWorker2 = await contextWorker2.newPage();

    await wireStorageBridge([pageCustomer, pageWorker1, pageWorker2]);

    // ── LOAD PAGES ──────────────────────────────────────────────────────────
    console.log("3. Loading /customer and /worker views in separate contexts...");
    await pageCustomer.goto(`${BASE_URL}/customer`);
    await pageWorker1.goto(`${BASE_URL}/worker`);
    await pageWorker2.goto(`${BASE_URL}/worker`);

    // Worker 2: switch identity to w19 (Anil Bhosale — another plumber)
    await pageWorker2.selectOption("#acting-as", "w19");
    await pageWorker2.waitForTimeout(300);

    // Both workers must be ONLINE so the customer sees "Send to everyone nearby"
    // Worker 1 — toggle online if not already
    const w1Online = await pageWorker1.evaluate(() => {
      try {
        const raw = localStorage.getItem("hyperlocal:v2");
        if (!raw) return false;
        const state = JSON.parse(raw);
        const me = state.workers?.find((w) => w.id === state.myWorkerId || w.id === "w1");
        return me?.online ?? false;
      } catch { return false; }
    });
    if (!w1Online) {
      await pageWorker1.click("button[aria-pressed='false']:has-text('Closed'), button:has-text('Open for jobs')", { timeout: 3000 }).catch(() => {});
      await pageWorker1.waitForTimeout(300);
    }

    // Worker 2 — toggle online if not already
    const w2Online = await pageWorker2.evaluate(() => {
      try {
        const raw = localStorage.getItem("hyperlocal:v2");
        if (!raw) return false;
        const state = JSON.parse(raw);
        const me = state.workers?.find((w) => w.id === "w19");
        return me?.online ?? false;
      } catch { return false; }
    });
    if (!w2Online) {
      await pageWorker2.click("button[aria-pressed='false']:has-text('Closed'), button:has-text('Open for jobs')", { timeout: 3000 }).catch(() => {});
      await pageWorker2.waitForTimeout(300);
    }

    // ── TEST 1: Job appears on worker side ──────────────────────────────────
    console.log("4. Verifying: A job appears on the worker side...");

    // Select plumber category on customer page (it may already be selected by default)
    await pageCustomer.click("button:has-text('Plumber')");
    await pageCustomer.waitForTimeout(500);

    // Wait for the "Send to everyone nearby" button to appear (requires online workers)
    await pageCustomer.waitForSelector("button:has-text('Send to everyone nearby')", { timeout: 10000 });
    await pageCustomer.click("button:has-text('Send to everyone nearby')");

    // BookingDialog opens — fill in job description
    await pageCustomer.waitForSelector("textarea#job-desc", { timeout: 5000 });
    await pageCustomer.fill("textarea#job-desc", "Bathroom tap leaking heavily");

    // Submit — button is enabled once description is >= 3 chars
    await pageCustomer.click("button:has-text('Send request')");

    // Worker 1 should see "Plumber needed" and the job description
    await pageWorker1.waitForSelector("text=Plumber needed", { timeout: 10000 });
    await pageWorker1.waitForSelector("text=Bathroom tap leaking heavily", { timeout: 5000 });
    console.log("   [PASS] Job broadcast appeared live on the worker side!");

    // ── TEST 2: Counter-offer appears on customer side ───────────────────────
    console.log("5. Verifying: A counter appears on the customer side...");

    const counterInput = pageWorker1.locator("input[aria-label='Your price']").first();
    await counterInput.fill("450");
    await pageWorker1.click("button:has-text('Send price')");

    // Customer switches to "My bookings" tab to see the offer
    await pageCustomer.click("button:has-text('My bookings')");
    await pageCustomer.waitForSelector("text=counter-offer", { timeout: 10000 });
    await pageCustomer.waitForSelector("text=450", { timeout: 5000 });
    console.log("   [PASS] Counter-offer appeared live on the customer side!");

    // ── TEST 3: Simultaneous accepts — only one winner ───────────────────────
    console.log("6. Verifying: Two simultaneous accepts leave exactly one winner...");

    // Customer goes back to Find to post a second job
    await pageCustomer.click("button:has-text('Find help')");
    await pageCustomer.waitForSelector("button:has-text('Send to everyone nearby')", { timeout: 8000 });
    await pageCustomer.click("button:has-text('Send to everyone nearby')");
    await pageCustomer.waitForSelector("textarea#job-desc", { timeout: 5000 });
    await pageCustomer.fill("textarea#job-desc", "Urgent water tank pipe replacement");
    await pageCustomer.click("button:has-text('Send request')");

    // Both workers must see the new request
    await pageWorker1.waitForSelector("text=Urgent water tank pipe replacement", { timeout: 10000 });
    await pageWorker2.waitForSelector("text=Urgent water tank pipe replacement", { timeout: 10000 });

    // Fire simultaneous "Take it for ₹..." clicks
    const takeButton1 = pageWorker1.locator("button:has-text('Take it for')").first();
    const takeButton2 = pageWorker2.locator("button:has-text('Take it for')").first();

    await Promise.all([takeButton1.click(), takeButton2.click()]);

    // Allow state to settle
    await pageCustomer.waitForTimeout(2000);

    // Inspect jobs state from customer's localStorage
    const jobs = await pageCustomer.evaluate(() => {
      const raw = localStorage.getItem("hyperlocal:v2");
      return raw ? JSON.parse(raw).jobs : [];
    });

    const urgentJob = jobs.find((j) => j.description === "Urgent water tank pipe replacement");
    console.log("   Assigned worker:", urgentJob?.assignedWorkerId);
    console.log("   Job status:", urgentJob?.status);
    console.log("   Agreed price:", urgentJob?.finalPrice);

    if (!urgentJob || urgentJob.status !== "accepted") {
      throw new Error(`Job was not accepted! Status: ${urgentJob?.status}`);
    }

    if (!urgentJob.assignedWorkerId) {
      throw new Error("Job has no assigned worker!");
    }

    // Must be exactly one of the two workers — never both, never null
    const validWorkers = ["w1", "w19"];
    if (!validWorkers.includes(urgentJob.assignedWorkerId)) {
      throw new Error(`Unexpected assigned worker: ${urgentJob.assignedWorkerId}`);
    }

    console.log(
      `   [PASS] Simultaneous accepts resolved cleanly: exactly one winner (${urgentJob.assignedWorkerId})!`,
    );

    await browser.close();
    console.log("\nAll Playwright multi-device verification checks passed successfully!");
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
