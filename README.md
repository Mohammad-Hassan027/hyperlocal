# ⚡ QuickKaam

**Hyperlocal skilled-worker booking for Bharat. Post a job, get a quote, start in 30 minutes.**

> 🚧 **Demo project — all verification badges, identity checks, and ratings are simulated.**
> Nothing is stored permanently; no real money moves.

---

## The Problem

Hiring a plumber in a Mumbai suburb takes 3–4 phone calls, opaque pricing, and a leap of faith.
QuickKaam flips the script: the **customer names their budget**; nearby workers accept or counter in real time.
Everyone sees the same live status — open → quoted → accepted → in-progress → done → reviewed.

---

## ▶ Live Demo

**[quickkaam.vercel.app](https://quickkaam.vercel.app)** ← open in two tabs (Customer + Worker) to see live sync

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser["Browser (React 19 / Next.js 16 App Router)"]
        UI["Pages\n/ · /customer · /worker\n/admin · /worker/join\n/track/[jobId]"]
        STORE["useStore hook\n(useSyncExternalStore)"]
        UI <--> STORE
    end

    subgraph Adapters["Dual StoreAdapter (lib/store/types.ts)"]
        direction TB
        FSA["FirestoreAdapter\nlib/store/firestore.ts\n• onSnapshot live sync\n• runTransaction (concurrency)\n• Anonymous Auth\n• Graceful fallback on error"]
        LSA["LocalStorageAdapter\nlib/store/local.ts\n• Zero-config offline\n• Cross-tab via storage events\n• Bot simulation built-in"]
        FSA -. "falls back to" .-> LSA
    end

    subgraph Firebase["Firebase (optional)"]
        AUTH["Anonymous Auth"]
        FS["Cloud Firestore\nworkers · jobs collections"]
    end

    STORE --> Adapters
    FSA --> AUTH
    FSA --> FS
```

**How the adapter is chosen:**
- `NEXT_PUBLIC_FIREBASE_*` env vars present → `FirestoreAdapter` (real-time, multi-device)
- Vars missing or Firestore permission error → `LocalStorageAdapter` (offline, same-device tabs)
- A `🔌 Demo mode (offline)` chip appears in the header when the fallback is active

---

## 5-Command Setup

```bash
# 1 — Clone
git clone https://github.com/Mohammad-Hassan027/hyperlocal.git
cd hyperlocal

# 2 — Install
npm install

# 3 — (Optional) Firebase — copy and fill in your project keys
cp .env.example .env.local
#   then edit .env.local with your NEXT_PUBLIC_FIREBASE_* values
#   skip this step to run fully offline with the LocalStorageAdapter

# 4 — Dev server
npm run dev        # http://localhost:3000

# 5 — Tests
npm run lint       # 0 errors
npm run test:unit  # 2/2 pass
npm run test:matching  # 6/6 pass
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | No | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | No | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | No | Firestore project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | No | `<project>.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase messaging sender |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | No | Firebase app ID |

> All six vars are optional. Without them the app runs in full offline demo mode — zero external dependencies.

**Vercel:** add these in **Project → Settings → Environment Variables** (all environments), then trigger a redeploy.

---

## Demo Script (5 steps, ~2 min)

Open **two browser tabs** (or two devices on the same network):

| Tab | URL | Role |
|---|---|---|
| Tab A | `/customer` | Customer posting a job |
| Tab B | `/worker` | Worker w1 (Rahul Sharma, Plumber) |

1. **Tab A — Post a job:**  
   Select *Plumber* → click **Broadcast to 8 nearby** → description: `"Leaking kitchen tap"` → budget `₹250` → **Submit**

2. **Tab B — See it live:**  
   The job appears instantly. Click **Take it (₹250)** or enter a counter (`₹300`) and click **Counter**.

3. **Tab A — Accept:**  
   The offer arrives in real time. Click **Accept**. A **4-digit Start Code** appears on screen.

4. **Tab B — Start the job:**  
   Enter the 4-digit code from Tab A → **Verify & Start Job**. Status flips to *In progress*.

5. **Tab B → Tab A — Finish:**  
   Worker clicks **Mark as done** → Customer leaves a ⭐⭐⭐⭐⭐ review.

**Demo tools** (top-right menu): toggle bot workers on/off, change demo speed (1× / 20×), reset all data, run **Judge Mode** (full 90-second captioned auto-play).

---

## What is Real vs Mock

| Feature | Status | Notes |
|---|---|---|
| Live job sync between devices | ✅ Real | Firestore `onSnapshot` |
| Concurrent-accept safety | ✅ Real | Firestore `runTransaction` |
| Anonymous auth | ✅ Real | Firebase Anonymous Auth |
| Offline fallback | ✅ Real | `LocalStorageAdapter` with cross-tab events |
| OTP start flow | ✅ Real logic | 4-digit code generated & verified in-app |
| Worker identity / ID check | 🟡 Mock | File upload accepted but not stored or verified |
| Background check badges | 🟡 Mock | Admin toggles badges — no real checks run |
| Phone numbers | 🟡 Mock | Masked until accepted; dummy numbers only |
| Payments | ❌ Not implemented | Agreed price shown; no payment gateway |
| SMS / push notifications | 🟡 Simulated | In-app toast only; no real push |
| GPS location | 🟡 Simulated | Worker movement animated between seed points |

---

## Roadmap

- [ ] Real payment via Razorpay
- [ ] SMS OTP via Twilio / MSG91
- [ ] Worker background-check API (IDfy / Aadhaar bridge)
- [ ] Native Android / iOS app (React Native + Expo)
- [ ] Dynamic pricing based on demand surge
- [ ] Multi-language support (Hindi, Marathi)
- [ ] Worker earnings dashboard & weekly payout

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, webpack) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript 5 |
| State | `useSyncExternalStore` with dual adapter |
| Realtime DB | Firebase Firestore v11 |
| Maps | Leaflet.js (dynamic import, SSR-safe) |
| Testing | Playwright (E2E), Vitest (unit), Node `--test` |
| CI | GitHub Actions |
| Deploy | Vercel |

---

## Project Structure

```
app/
  page.tsx            ← Landing /
  customer/           ← Customer booking flow
  worker/             ← Worker dashboard
  worker/join/        ← Worker onboarding (mock)
  admin/              ← Badge management
  track/[jobId]/      ← Live-share tracking + SOS
components/
  CustomerView.tsx    ← Map + worker cards + booking
  WorkerCard.tsx      ← Worker card with match score
  CustomerJobCard.tsx ← Job status + OTP + review
  BookingDialog.tsx   ← Budget / schedule modal
  Header.tsx          ← Nav + demo tools + judge mode
  JudgeModeOverlay.tsx← Captioned auto-demo banner
  ErrorBoundary.tsx   ← Per-route error catch
lib/
  store.ts            ← useStore hook (selector memoization)
  store/local.ts      ← LocalStorageAdapter
  store/firestore.ts  ← FirestoreAdapter + graceful fallback
  matching.ts         ← Worker ranking algorithm
  judge.ts            ← Judge mode orchestration
  geo.ts              ← Haversine, preset locations
  seed.ts             ← 34 seed workers across 3 areas
tests/
  happy-path.mjs      ← Playwright E2E happy path
  matching.test.ts    ← Vitest unit tests
  firestore-adapter.test.mjs ← Concurrency tests
```

---

## Running Tests

```bash
npm run lint             # ESLint (0 errors)
npm run test:unit        # Node --test (Firestore concurrency)
npm run test:matching    # Vitest (matching algorithm)
npm run test:e2e:happy   # Playwright full happy path
```

---

## License

MIT — built as a demo/portfolio project. See [AGENTS.md](./AGENTS.md) for contributor guidelines.
