# QuickKaam — Hyperlocal On-Demand Blue-Collar Services (MVP)

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript. No backend or API keys needed.

```bash
npm install
npm run dev   # http://localhost:3000
```

## Demo script (2 min)

1. **Two tabs.** Open `/customer` in one, `/worker` in the other (they sync live via `localStorage`).
2. **Customer:** pick *Plumber* → see nearby workers sorted by distance, with ratings, badges, ETA → **Broadcast to all nearby** → set a budget (e.g. ₹250) → send.
3. **Worker** (acting as Ramesh Yadav): request appears with distance + budget → **Counter-offer** ₹380, or **Accept** at budget for an instant match.
4. **Customer → My bookings:** counter-offers from workers (including simulated ones) stream in → **Accept** one, or raise your budget.
5. **Worker:** Start job → Mark completed. **Customer:** leave a review → worker rating updates.

Toggle *Simulate nearby workers* in the header to turn bot responses off (only real tabs respond).

## How it maps to the requirements

| Requirement | Where |
|---|---|
| Dual-sided role switch | `components/Header.tsx`, `app/customer`, `app/worker` |
| Hyperlocal filtering | `lib/geo.ts` (haversine, ETA), `nearbyWorkers()` in `lib/store.ts` |
| Broadcast matching | `createJob()` notifies online, in-category, in-radius workers (scheduled jobs notify all in range) |
| Flexible pricing | Customer budget + fair-range hint → worker **Accept at budget** (instant match) or **Counter** → customer picks / raises budget |
| Trust & safety (mock) | `Badges` (ID Verified, Background Checked, Skill Certified, Top Rated), rating + review snippets |
| ~30 min window | ETA pill turns green when worker is ≤ 30 min away |

## Project layout

```
app/            routes (/, /customer, /worker)
components/     Header, WorkerCard, BookingDialog, CustomerJobCard, ui
lib/types.ts    domain types
lib/seed.ts     categories + 18 seeded workers (Thane / Bhiwandi / Kalyan)
lib/geo.ts      haversine, ETA, INR formatting, preset locations
lib/store.ts    state + actions (matching, offers, job lifecycle, bots)
```

## Upgrading to Firebase (real-time, multi-device)

`lib/store.ts` is the only persistence layer. Keep the exported action signatures and swap internals:

- `workers`, `jobs` → Firestore collections `workers/{id}`, `jobs/{id}` (offers as a subcollection or array).
- `subscribe()` → `onSnapshot()` listeners; `set()` → `setDoc` / `updateDoc` / `runTransaction`.
- Use a **transaction** in `submitOffer(..., "accept")` so only the first worker wins.
- Add Firebase Auth (phone OTP) with a `role: "customer" | "worker"` claim, and `geofire-common` geohashes for server-side radius queries.
- Broadcast notifications: Cloud Function on `jobs` create → FCM push to workers whose geohash is in range.

## Notes

- Currency is INR; swap `inr()` in `lib/geo.ts` for other locales.
- Fonts (Yatra One for headings and prices, Mukta for text) are self-hosted via `@fontsource`, so the build works offline.
- Design: neighbourhood notice-board theme. Each worker is a flyer; paper colour = trade (`tone` in `lib/seed.ts`); tokens live in `app/globals.css`.
- Demo data is versioned (`hyperlocal:v2` in `lib/store.ts`); bump it when you change the seed so old browser data doesn't mask it.
- Bot timers live in the tab that created the job; reloading mid-broadcast cancels pending bot replies.
