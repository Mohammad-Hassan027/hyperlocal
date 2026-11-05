import { fmtKm } from "./geo";
import { categoryById } from "./seed";
import type { CategoryId, Worker } from "./types";

export interface ScoredWorker {
  worker: Worker;
  distanceKm: number;
  score: number;
  isBestMatch: boolean;
  matchReason?: string;
}

/**
 * Computes a normalized 0..1 match score for a worker based on:
 * - Distance from customer vs search radius (weight: 30%)
 * - Rating (weight: 25%)
 * - Price fit against customer budget (weight: 20%)
 * - Verified background / skill badges (weight: 15%)
 * - Online availability (weight: 10%)
 */
export function scoreWorker(
  worker: Worker,
  distanceKm: number,
  radiusKm: number,
  budget?: number,
): number {
  // 1. Distance score (closer = higher)
  const effectiveRadius = Math.max(radiusKm, 1);
  const distScore = Math.max(0, Math.min(1, 1 - distanceKm / effectiveRadius));

  // 2. Rating score (normalized from 3.0..5.0 scale)
  const ratingScore = Math.max(0, Math.min(1, (worker.rating - 3) / 2));

  // 3. Price fit score
  let priceScore = 0.75;
  if (budget && budget > 0) {
    if (worker.baseRate <= budget) {
      priceScore = 1.0;
    } else {
      const overRatio = (worker.baseRate - budget) / budget;
      priceScore = Math.max(0, 1 - overRatio);
    }
  }

  // 4. Badges score
  const badges = worker.badges ?? [];
  const badgeScore = Math.min(1, badges.length / 3);

  // 5. Online score
  const onlineScore = worker.online ? 1.0 : 0.4;

  const total =
    distScore * 0.3 +
    ratingScore * 0.25 +
    priceScore * 0.2 +
    badgeScore * 0.15 +
    onlineScore * 0.1;

  return Math.round(total * 1000) / 1000;
}

/**
 * Determines a concise, human-readable sentence-case reason why this worker is the best match.
 */
export function getBestMatchReason(
  worker: Worker,
  distanceKm: number,
  budget?: number,
  category?: CategoryId,
): string {
  const trade = category ? categoryById(category).label.toLowerCase() : "worker";
  const badges = worker.badges ?? [];
  const isVerified =
    badges.includes("id_verified") || badges.includes("background_checked");

  if (isVerified && budget && worker.baseRate <= budget && distanceKm <= 5) {
    return `Nearest verified ${trade} within your budget`;
  }

  if (worker.rating >= 4.7 && isVerified) {
    return "Top-rated with verified background and credentials";
  }

  if (distanceKm <= 2 && worker.online) {
    return `Closest online ${trade}, only ${fmtKm(distanceKm)} away`;
  }

  if (budget && worker.baseRate < budget) {
    return "Under your budget with strong customer ratings";
  }

  return "Best overall combination of proximity, rating and verified credentials";
}

/**
 * Ranks a list of workers by weighted match score, tagging the top candidate as the "Best match".
 */
export function rankWorkers(
  workers: { worker: Worker; distanceKm: number }[],
  radiusKm: number,
  budget?: number,
  category?: CategoryId,
): ScoredWorker[] {
  if (workers.length === 0) return [];

  const scored: ScoredWorker[] = workers.map(({ worker, distanceKm }) => {
    const score = scoreWorker(worker, distanceKm, radiusKm, budget);
    return {
      worker,
      distanceKm,
      score,
      isBestMatch: false,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Top candidate is designated as Best Match if there is a clear match
  if (scored.length > 0) {
    scored[0].isBestMatch = true;
    scored[0].matchReason = getBestMatchReason(
      scored[0].worker,
      scored[0].distanceKm,
      budget,
      category,
    );
  }

  return scored;
}
