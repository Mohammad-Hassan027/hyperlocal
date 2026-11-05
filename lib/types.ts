export type CategoryId =
  | "plumber"
  | "electrician"
  | "cleaner"
  | "carpenter"
  | "painter"
  | "ac-repair"
  | "mover"
  | "helper";

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
  /** Photocopy-paper colour used for this trade across the UI */
  tone: string;
  skilled: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
  label?: string;
}

export type Badge =
  | "id_verified"
  | "background_checked"
  | "skill_certified"
  | "top_rated";

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface Worker {
  id: string;
  name: string;
  emoji: string;
  bio: string;
  categories: CategoryId[];
  /** Base visit rate in INR */
  baseRate: number;
  rating: number;
  jobsDone: number;
  badges: Badge[];
  reviews: Review[];
  online: boolean;
  loc: LatLng;
}

export type JobMode = "on-demand" | "scheduled";
export type JobStatus =
  | "open"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Offer {
  id: string;
  workerId: string;
  price: number;
  kind: "accept" | "counter";
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
}

export interface Job {
  id: string;
  category: CategoryId;
  description: string;
  mode: JobMode;
  scheduledFor?: string;
  /** Customer's proposed budget in INR */
  budget: number;
  radiusKm: number;
  customerLoc: LatLng;
  status: JobStatus;
  broadcastTo: string[];
  offers: Offer[];
  assignedWorkerId?: string;
  finalPrice?: number;
  createdAt: number;
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
  review?: { rating: number; text: string };
}

export interface CreateJobInput {
  category: CategoryId;
  description: string;
  mode: JobMode;
  scheduledFor?: string;
  budget: number;
  radiusKm: number;
  /** Book a specific worker instead of broadcasting to everyone nearby */
  preferredWorkerId?: string;
}

export interface AppState {
  workers: Worker[];
  jobs: Job[];
  location: LatLng;
  /** Which seeded worker the Worker view is acting as (demo identity) */
  myWorkerId: string;
  /** Simulated nearby workers auto-respond to broadcasts */
  bots: boolean;
  /** Demo travel speed: 1 (real-time) or 20 (stage demo ~25s arrival) */
  demoSpeed: number;
}
