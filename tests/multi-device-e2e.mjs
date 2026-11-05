import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // server starting up
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function wireStorageBridge(allPages) {
  for (const page of allPages) {
    await page.exposeFunction("__broadcastStorage", async (key, val) => {
      for (const target of allPages) {
        if (target === page) continue;
        await target
          .evaluate(
            ({ k, v }) => {
              try {
                window.__isBridging = true;
                localStorage.setItem(k, v);
                window.dispatchEvent(
                  new StorageEvent("storage", { key: k, newValue: v }),
                );
              } finally {
                window.__isBridging = false;
              }
            },
            { k: key, v: val },
          )
          .catch(() => {});
      }
    });

    await page.addInitScript(() => {
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (k, v) {
        orig(k, v);
        if (!window.__isBridging && k === "hyperlocal:v2" && window.__broadcastStorage) {
          window.__broadcastStorage(k, v);
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

    console.log("2. Launching Chromium with 3 isolated browser contexts...");
    const browser = await chromium.launch({ headless: true });

    // Context 1: Customer device
    const contextCustomer = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Context 2: Worker device (Ramesh)
    const contextWorker1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Context 3: Worker device (Anil Bhosale)
    const contextWorker2 = await browser.newContext({ viewport: { width: 390, height: 844 } });

    const pageCustomer = await contextCustomer.newPage();
    const pageWorker1 = await contextWorker1.newPage();
    const pageWorker2 = await contextWorker2.newPage();

    const allPages = [pageCustomer, pageWorker1, pageWorker2];
    await wireStorageBridge(allPages);

    console.log("3. Loading /customer and /worker views in separate contexts...");
    await pageCustomer.goto(`${BASE_URL}/customer`);
    await pageCustomer.waitForSelector("h1", { timeout: 10000 });

    // Turn off random bots so they don't interfere with the test sequence
    await pageCustomer.evaluate(() => {
      try {
        const raw = localStorage.getItem("hyperlocal:v2");
        if (raw) {
          const s = JSON.parse(raw);
          s.bots = false;
          localStorage.setItem("hyperlocal:v2", JSON.stringify(s));
        }
      } catch {}
    });

    await pageWorker1.goto(`${BASE_URL}/worker`);
    await pageWorker2.goto(`${BASE_URL}/worker`);
    await pageWorker1.waitForSelector("#acting-as", { timeout: 10000 });
    await pageWorker2.waitForSelector("#acting-as", { timeout: 10000 });

    // Set Worker 2 identity to w19 (Anil Bhosale, nearby plumber)
    await pageWorker2.selectOption("#acting-as", "w19");
    await pageWorker2.waitForTimeout(300);

    // ── TEST 1: Job broadcast appears on worker side ────────────────────────
    console.log("4. Verifying: A job appears on the worker side...");
    await pageCustomer.waitForSelector("button:has-text('Send to everyone nearby')", { timeout: 10000 });
    await pageCustomer.locator("button:has-text('Send to everyone nearby')").click({ force: true });

    await pageCustomer.waitForSelector("textarea#job-desc", { timeout: 5000 });
    await pageCustomer.fill("textarea#job-desc", "Bathroom tap leaking heavily");
    await pageCustomer.click("button:has-text('Send request')");

    // Worker 1 should receive the broadcast
    await pageWorker1.waitForSelector("text=Plumber needed", { timeout: 10000 });
    await pageWorker1.waitForSelector("text=Bathroom tap leaking heavily", { timeout: 5000 });
    console.log("   [PASS] Job broadcast appeared live on the worker side!");

    // ── TEST 2: Counter-offer appears on customer side ───────────────────────
    console.log("5. Verifying: A counter-offer appears on the customer side...");
    const counterInput = pageWorker1.locator("input[aria-label='Your price']").first();
    await counterInput.fill("450");
    await pageWorker1.click("button:has-text('Send price')");

    // Customer should see the counter-offer
    await pageCustomer.waitForSelector("text=counter-offer", { timeout: 10000 });
    await pageCustomer.waitForSelector("text=450", { timeout: 5000 });
    console.log("   [PASS] Counter-offer appeared live on the customer side!");

    // ── TEST 3: Simultaneous accepts leave exactly one winner ────────────────
    console.log("6. Verifying: Two simultaneous accepts leave exactly one winner...");
    // Customer goes back to Find to post second job
    await pageCustomer.click("button:has-text('Find help')");
    await pageCustomer.waitForSelector("button:has-text('Send to everyone nearby')", { timeout: 8000 });
    await pageCustomer.locator("button:has-text('Send to everyone nearby')").click({ force: true });

    await pageCustomer.waitForSelector("textarea#job-desc", { timeout: 5000 });
    await pageCustomer.fill("textarea#job-desc", "Urgent water tank pipe replacement");
    await pageCustomer.click("button:has-text('Send request')");

    // Both workers see the new request
    await pageWorker1.waitForSelector("text=Urgent water tank pipe replacement", { timeout: 10000 });
    await pageWorker2.waitForSelector("text=Urgent water tank pipe replacement", { timeout: 10000 });

    const takeButton1 = pageWorker1
      .locator("article:has-text('Urgent water tank pipe replacement') button:has-text('Take it for')")
      .first();
    const takeButton2 = pageWorker2
      .locator("article:has-text('Urgent water tank pipe replacement') button:has-text('Take it for')")
      .first();

    // Trigger simultaneous accepts
    await Promise.all([takeButton1.click(), takeButton2.click()]);

    // Give state time to settle
    await pageCustomer.waitForTimeout(2000);

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
