# QuickKaam — Hyperlocal On-Demand Blue-Collar Services (MVP)

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript · Firebase Modular SDK / LocalStorage Fallback.

```bash
npm install
npm run dev   # http://localhost:3000
```

## Architecture: Dual StoreAdapter

QuickKaam uses a unified `StoreAdapter` interface (`lib/store/types.ts`) with two interchangeable implementations:

1. **`FirestoreAdapter` (`lib/store/firestore.ts`)**:
   - Uses the latest Firebase modular SDK (v11+).
   - Real-time multi-device sync via Firestore `onSnapshot` listeners on `workers/{id}` and `jobs/{id}`.
   - Anonymous Authentication via `signInAnonymously(auth)`.
   - Concurrency safety: `submitOffer(..., "accept")` and `acceptOffer` run in a Firestore `runTransaction` so only the first accept wins and a job is never assigned twice.
   - Client-side bot responses run only in the client that created the job and are idempotent.
   - Activated automatically whenever `NEXT_PUBLIC_FIREBASE_*` environment variables are present.

2. **`LocalStorageAdapter` (`lib/store/local.ts`)**:
   - Zero-configuration local fallback when Firebase environment variables are missing.
   - Synchronizes across tabs on the same device via standard browser `storage` events.

All hook and action signatures in `lib/store.ts` (`useStore`, `createJob`, `submitOffer`, `acceptOffer`, `updateBudget`, `cancelJob`, `advanceJob`, `submitReview`, `setOnline`, `setBaseRate`, `resetDemo`) remain identical across both adapters.

---

## Firebase Setup Steps

To connect QuickKaam to Firebase so customers on one device and workers on another see each other live:

### 1. Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Name your project (e.g. `quickkaam-demo`).

### 2. Enable Anonymous Authentication
1. In the left navigation, open **Build → Authentication**.
2. Click **Get Started**, choose the **Sign-in method** tab.
3. Enable **Anonymous** auth and click **Save**.

### 3. Create Cloud Firestore Database
1. In the left navigation, open **Build → Firestore Database**.
2. Click **Create database**, choose a location (e.g., `asia-south1` for Mumbai).
3. Start in **Production mode** (we deploy custom rules in the next step).

### 4. Deploy Firestore Security Rules
Deploy `firestore.rules` using the Firebase CLI or paste the contents into the Firestore Rules editor in the console:
```bash
firebase deploy --only firestore:rules
```
The rules in `firestore.rules`:
- Require authentication (`request.auth != null`).
- Validate the job status transition order (`open` → `accepted` → `in_progress` → `completed`, or `open`/`accepted` → `cancelled`).
- Guarantee `assignedWorkerId` and `finalPrice` are immutable once set.

### 5. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the values from your Firebase Project Settings (**Project Settings → General → Your apps → Web app (`</>`)**):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Restart the dev server (`npm run dev`). The app will automatically connect to Firebase!

---

## Demo Script (2 min)

1. **Two devices / browser windows:** Open `/customer` on one device, `/worker` on the other.
2. **Customer:** Pick *Plumber* → see nearby workers sorted by distance → **Broadcast to all nearby** → set a budget (e.g. ₹250) → send request.
3. **Worker:** The request appears live in real time. **Counter-offer** with your own price, or **Take it** for an instant match.
4. **Customer:** Counter-offers stream in live. Click **Accept**, or raise your budget.
5. **Worker:** Start the job → Mark as done.
6. **Customer:** Leave a star rating and review. Worker rating updates live.

Use **Reset demo data** in the header to delete all jobs and reseed workers behind a confirmation prompt.

---

## Multi-Device Verification with Playwright

To run automated end-to-end multi-device testing with isolated Playwright browser contexts:
```bash
npm run test:e2e
```
This tests:
1. Job broadcast from customer context appearing live in the worker context.
2. Counter-offer from worker context appearing live in the customer context.
3. Simultaneous acceptance test: two worker contexts attempting to accept the same job at the same time, verifying that `runTransaction` ensures exactly one winner and the job is never double-assigned.
