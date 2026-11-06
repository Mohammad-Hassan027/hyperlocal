import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4965;
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

async function runHappyPath() {
  console.log("=== QuickKaam Playwright Happy-Path E2E Test ===");
  console.log("1. Starting Next.js production server on port", PORT, "...");
  const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    stdio: "inherit",
    shell: true,
  });

  let browser;
  try {
    await waitForServer(`${BASE_URL}/customer`);
    console.log("   Server ready at", BASE_URL);

    console.log("2. Launching Chromium with Customer & Worker tabs in shared context...");
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageCustomer = await context.newPage();
    const pageWorker = await context.newPage();

    // Initialize customer
    await pageCustomer.goto(`${BASE_URL}/customer`);
    await pageCustomer.waitForSelector("h1", { timeout: 10000 });

    // Initialize worker (w1 - Ramesh Yadav, Plumber in Thane West)
    await pageWorker.goto(`${BASE_URL}/worker`);
    await pageWorker.waitForSelector("#acting-as", { timeout: 10000 });

    // Allow adapter and snapshot listeners to settle
    await new Promise((r) => setTimeout(r, 1500));

    // Turn off random bots so they don't race our manual worker
    await pageCustomer.evaluate(() => {
      window.__STORE_ADAPTER__?.setBots(false);
    });
    await pageWorker.evaluate(() => {
      window.__STORE_ADAPTER__?.setBots(false);
    });

    // Step 1: Customer creates a plumber job
    console.log("3. Step 1: Customer posts plumber job...");
    await pageCustomer.waitForSelector("button:has-text('Send to everyone nearby')", { timeout: 8000 });
    await pageCustomer.locator("button:has-text('Send to everyone nearby')").click({ force: true });

    await pageCustomer.waitForSelector("textarea#job-desc", { timeout: 5000 });
    await pageCustomer.fill("textarea#job-desc", "Bathroom tap leaking heavily");
    await pageCustomer.click("button:has-text('Send request')");

    // Verify job in customer bookings
    await pageCustomer.waitForSelector("text=Bathroom tap leaking heavily", { timeout: 8000 });
    console.log("   ✓ Job created and visible in Customer bookings");

    // Step 2: Worker receives broadcast and accepts
    console.log("4. Step 2: Worker w1 receives broadcast and accepts...");
    await pageWorker.waitForSelector("text=Plumber needed", { timeout: 10000 });
    await pageWorker.waitForSelector("text=Bathroom tap leaking heavily", { timeout: 5000 });

    const acceptBtn = pageWorker
      .locator("article:has-text('Bathroom tap leaking heavily') button:has-text('Take it for')")
      .first();
    await acceptBtn.click();
    console.log("   ✓ Worker accepted the job");

    // Step 3: Customer sees Accepted status and Start OTP
    console.log("5. Step 3: Customer receives accepted status and Start OTP...");
    await pageCustomer.waitForSelector("text=Start-Job 4-Digit Code", { timeout: 10000 });

    const otp = await pageCustomer.evaluate(() => {
      const s = window.__STORE_ADAPTER__?.getState();
      const j = s?.jobs.find((x) => x.description.includes("Bathroom tap"));
      return j?.startOtp;
    });

    if (!otp || otp.length !== 4) {
      throw new Error(`Invalid or missing startOtp: ${otp}`);
    }
    console.log(`   ✓ Found 4-digit security OTP: ${otp}`);

    // Step 4: Worker enters OTP to start the job
    console.log("6. Step 4: Worker enters 4-digit OTP to start job...");
    await pageWorker.waitForSelector("input[placeholder='0000']", { timeout: 10000 });
    await pageWorker.fill("input[placeholder='0000']", otp);
    await pageWorker.click("button:has-text('Verify & Start Job')");

    // Verify status is now In progress
    await pageWorker.waitForSelector("button:has-text('Mark as done')", { timeout: 8000 });
    console.log("   ✓ OTP verified! Status is In progress ('Mark as done' button active)");

    // Step 5: Worker marks job done
    console.log("7. Step 5: Worker marks job done...");
    await pageWorker.click("button:has-text('Mark as done')");
    await pageWorker.waitForSelector("text=Earned this session", { timeout: 8000 });
    console.log("   ✓ Job marked done");

    // Step 6: Customer submits review
    console.log("8. Step 6: Customer reviews the completed job...");
    await pageCustomer.waitForSelector("text=finished the job", { timeout: 10000 });
    const reviewInput = pageCustomer.locator("input[placeholder*='How did it go']").first();
    await reviewInput.fill("Fast arrival, neat repair and very polite!");
    await pageCustomer.click("button:has-text('Submit review')");
    await pageCustomer.waitForSelector("text=You gave 5 out of 5", { timeout: 8000 });
    console.log("   ✓ 5-star review submitted and displayed successfully!");

    console.log("\n🎉 ALL HAPPY-PATH CHECKS PASSED PERFECTLY!");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

runHappyPath().catch((err) => {
  console.error("Happy path test failed:", err);
  process.exit(1);
});
