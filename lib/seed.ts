import type { Badge, Category, CategoryId, Review, Worker } from "./types";

export const CATEGORIES: Category[] = [
  { id: "plumber", label: "Plumber", emoji: "🔧", tone: "#cfe4f7", skilled: true },
  { id: "electrician", label: "Electrician", emoji: "⚡", tone: "#fbe38a", skilled: true },
  { id: "cleaner", label: "Cleaner", emoji: "🧹", tone: "#cdebc9", skilled: false },
  { id: "carpenter", label: "Carpenter", emoji: "🪚", tone: "#e9d3b4", skilled: true },
  { id: "painter", label: "Painter", emoji: "🎨", tone: "#f7c6d3", skilled: true },
  { id: "ac-repair", label: "AC repair", emoji: "❄️", tone: "#c4eae7", skilled: true },
  { id: "mover", label: "Mover", emoji: "📦", tone: "#f7cfa8", skilled: false },
  { id: "helper", label: "Helper", emoji: "🙌", tone: "#dad3f2", skilled: false },
];

export const categoryById = (id: CategoryId) =>
  CATEGORIES.find((c) => c.id === id)!;

const REVIEW_POOL: Omit<Review, "id" | "date">[] = [
  { author: "Anita K.", rating: 5, text: "Arrived in 20 minutes and fixed it cleanly." },
  { author: "Rahul S.", rating: 5, text: "Fair price, no surprises. Very polite." },
  { author: "Meera P.", rating: 4, text: "Good work, slightly late but communicated well." },
  { author: "Imran Q.", rating: 5, text: "Knew exactly what the problem was. Highly recommend." },
  { author: "Divya N.", rating: 4, text: "Neat work and cleaned up after." },
  { author: "Suresh T.", rating: 3, text: "Job done, took longer than quoted." },
];

function reviews(seed: number, n = 3): Review[] {
  return Array.from({ length: n }, (_, i) => {
    const r = REVIEW_POOL[(seed + i) % REVIEW_POOL.length];
    return {
      ...r,
      id: `rv-${seed}-${i}`,
      date: new Date(Date.UTC(2026, 8, 20 - i * 6)).toISOString().slice(0, 10),
    };
  });
}

interface W {
  id: string;
  name: string;
  emoji: string;
  bio: string;
  cats: CategoryId[];
  rate: number;
  rating: number;
  jobs: number;
  badges: Badge[];
  online: boolean;
  lat: number;
  lng: number;
  area: string;
}

const RAW: W[] = [
  // Thane cluster
  { id: "w1", name: "Ramesh Yadav", emoji: "👷", bio: "12 yrs fixing leaks, tanks and bathroom fittings.", cats: ["plumber"], rate: 350, rating: 4.8, jobs: 412, badges: ["id_verified", "background_checked", "top_rated"], online: true, lat: 19.2215, lng: 72.9702, area: "Thane West" },
  { id: "w2", name: "Imtiyaz Shaikh", emoji: "🧑‍🔧", bio: "Wiring, MCB, fans and inverter installs.", cats: ["electrician"], rate: 400, rating: 4.6, jobs: 288, badges: ["id_verified", "skill_certified"], online: true, lat: 19.2102, lng: 72.9855, area: "Thane West" },
  { id: "w3", name: "Savita More", emoji: "🧼", bio: "Deep home cleaning, kitchens and bathrooms.", cats: ["cleaner"], rate: 300, rating: 4.9, jobs: 530, badges: ["id_verified", "background_checked", "top_rated"], online: true, lat: 19.2301, lng: 72.9889, area: "Thane West" },
  { id: "w4", name: "Prakash Jadhav", emoji: "🪵", bio: "Furniture repair, modular fitting, door locks.", cats: ["carpenter"], rate: 450, rating: 4.4, jobs: 190, badges: ["id_verified"], online: false, lat: 19.2056, lng: 72.9650, area: "Thane West" },
  { id: "w5", name: "Dinesh Kamble", emoji: "🎨", bio: "Interior and touch-up painting, clean finish.", cats: ["painter", "helper"], rate: 500, rating: 4.3, jobs: 145, badges: ["id_verified", "background_checked"], online: true, lat: 19.2350, lng: 72.9620, area: "Thane West" },
  { id: "w6", name: "Farhan Ansari", emoji: "❄️", bio: "Split/window AC service, gas refill, repairs.", cats: ["ac-repair", "electrician"], rate: 600, rating: 4.7, jobs: 341, badges: ["id_verified", "skill_certified", "top_rated"], online: true, lat: 19.2140, lng: 72.9990, area: "Thane West" },
  { id: "w19", name: "Anil Bhosale", emoji: "🔧", bio: "Leaks, blocked drains and water-tank fittings.", cats: ["plumber"], rate: 330, rating: 4.4, jobs: 150, badges: ["id_verified"], online: true, lat: 19.2250, lng: 72.9830, area: "Thane West" },
  { id: "w20", name: "Raju Nair", emoji: "📦", bio: "Mini tempo and two helpers for flat shifting.", cats: ["mover", "helper"], rate: 850, rating: 4.3, jobs: 120, badges: ["id_verified", "background_checked"], online: true, lat: 19.2180, lng: 72.9760, area: "Thane West" },
  { id: "w21", name: "Pooja Desai", emoji: "🧼", bio: "Kitchen and bathroom deep clean, same-day slots.", cats: ["cleaner"], rate: 290, rating: 4.6, jobs: 205, badges: ["id_verified", "background_checked"], online: true, lat: 19.2270, lng: 72.9740, area: "Thane West" },
  { id: "w22", name: "Sameer Kulkarni", emoji: "⚡", bio: "Short circuits, geysers, MCB and doorbell fixes.", cats: ["electrician"], rate: 420, rating: 4.5, jobs: 175, badges: ["id_verified", "skill_certified"], online: true, lat: 19.2330, lng: 72.9910, area: "Thane West" },
  { id: "w23", name: "Vinod Gupta", emoji: "🪚", bio: "Beds, wardrobes, door and hinge repairs.", cats: ["carpenter"], rate: 440, rating: 4.5, jobs: 210, badges: ["id_verified", "background_checked"], online: true, lat: 19.2090, lng: 72.9810, area: "Thane West" },
  { id: "w24", name: "Naeem Sheikh", emoji: "❄️", bio: "AC service, gas top-up and noisy-unit repairs.", cats: ["ac-repair"], rate: 580, rating: 4.4, jobs: 130, badges: ["id_verified"], online: true, lat: 19.2200, lng: 72.9700, area: "Thane West" },
  { id: "w25", name: "Lata Rane", emoji: "🎨", bio: "Touch-ups, single rooms and damp-patch fixes.", cats: ["painter"], rate: 470, rating: 4.4, jobs: 110, badges: ["id_verified"], online: true, lat: 19.2120, lng: 72.9920, area: "Thane West" },
  // Bhiwandi cluster
  { id: "w7", name: "Salim Momin", emoji: "🔧", bio: "Pipeline, motor pump and tap repairs.", cats: ["plumber"], rate: 320, rating: 4.5, jobs: 260, badges: ["id_verified", "background_checked"], online: true, lat: 19.2945, lng: 73.0560, area: "Bhiwandi" },
  { id: "w8", name: "Nitin Patil", emoji: "⚡", bio: "Industrial & residential electrical faults.", cats: ["electrician"], rate: 380, rating: 4.2, jobs: 120, badges: ["id_verified"], online: true, lat: 19.3010, lng: 73.0702, area: "Bhiwandi" },
  { id: "w9", name: "Kavita Gaikwad", emoji: "🧹", bio: "Move-in/out cleaning and sofa shampoo.", cats: ["cleaner", "helper"], rate: 280, rating: 4.7, jobs: 310, badges: ["id_verified", "background_checked"], online: true, lat: 19.2880, lng: 73.0690, area: "Bhiwandi" },
  { id: "w10", name: "Zakir Hussain", emoji: "📦", bio: "Tempo + 2 helpers for local shifting.", cats: ["mover", "helper"], rate: 900, rating: 4.4, jobs: 205, badges: ["id_verified"], online: true, lat: 19.3050, lng: 73.0480, area: "Bhiwandi" },
  { id: "w11", name: "Ganesh Mhatre", emoji: "🪚", bio: "Doors, windows, wardrobe and shelves.", cats: ["carpenter", "painter"], rate: 420, rating: 4.1, jobs: 98, badges: ["id_verified"], online: false, lat: 19.2990, lng: 73.0800, area: "Bhiwandi" },
  { id: "w12", name: "Arif Khan", emoji: "❄️", bio: "AC installs, uninstalls and cooling issues.", cats: ["ac-repair"], rate: 550, rating: 4.5, jobs: 177, badges: ["id_verified", "skill_certified"], online: true, lat: 19.2790, lng: 73.0520, area: "Bhiwandi" },
  // Kalyan cluster
  { id: "w13", name: "Vijay Shinde", emoji: "👷", bio: "Bathroom leakage and drainage specialist.", cats: ["plumber"], rate: 340, rating: 4.6, jobs: 233, badges: ["id_verified", "background_checked", "skill_certified"], online: true, lat: 19.2430, lng: 73.1260, area: "Kalyan" },
  { id: "w14", name: "Rohit Salvi", emoji: "⚡", bio: "Home wiring, switchboards and lighting.", cats: ["electrician"], rate: 390, rating: 4.8, jobs: 402, badges: ["id_verified", "background_checked", "skill_certified", "top_rated"], online: true, lat: 19.2350, lng: 73.1400, area: "Kalyan" },
  { id: "w15", name: "Sunita Pawar", emoji: "🧽", bio: "Daily and one-time house cleaning.", cats: ["cleaner"], rate: 260, rating: 4.5, jobs: 188, badges: ["id_verified"], online: true, lat: 19.2500, lng: 73.1190, area: "Kalyan" },
  { id: "w16", name: "Mukesh Chauhan", emoji: "🎨", bio: "Whole-room painting, waterproofing coat.", cats: ["painter"], rate: 480, rating: 4.7, jobs: 215, badges: ["id_verified", "background_checked", "top_rated"], online: true, lat: 19.2380, lng: 73.1450, area: "Kalyan" },
  { id: "w17", name: "Babu Rao", emoji: "🙌", bio: "Loading, unloading, shifting and odd jobs.", cats: ["helper", "mover"], rate: 250, rating: 4.0, jobs: 76, badges: [], online: true, lat: 19.2290, lng: 73.1330, area: "Kalyan" },
  { id: "w18", name: "Tariq Ali", emoji: "🪵", bio: "Custom furniture and quick carpentry fixes.", cats: ["carpenter"], rate: 430, rating: 4.6, jobs: 260, badges: ["id_verified", "background_checked"], online: true, lat: 19.2470, lng: 73.1380, area: "Kalyan" },
];

export const SEED_WORKERS: Worker[] = RAW.map((w, i) => ({
  id: w.id,
  name: w.name,
  emoji: w.emoji,
  bio: w.bio,
  categories: w.cats,
  baseRate: w.rate,
  rating: w.rating,
  jobsDone: w.jobs,
  badges: w.badges,
  reviews: reviews(i),
  online: w.online,
  loc: { lat: w.lat, lng: w.lng, label: w.area },
}));
