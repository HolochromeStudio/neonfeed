/**
 * Provider-agnostic service interfaces (D7). Game code depends only on these.
 *
 * Review note (A14): no provider coupling exists. `src/**` has no imports of any SDK (only 'phaser'), and a grep for
 * firebase/admob/gtag/revenuecat/capacitor/appsflyer finds nothing; the only consumers are GameFlow (type-only
 * AnalyticsService) and main.ts (the default `services` registry, all no-ops).
 * Gaps before a real analytics/ads/IAP adapter:
 *  - Analytics: no consent/opt-out gate, no user/session id, no flush/shutdown (batching adapters need pagehide), no
 *    event-name catalogue or param schema (params are flat primitives only).
 *  - Ads: no load()/preload, no error/no-fill reason (boolean only), no pause-audio/pause-game hooks around
 *    showRewarded, no frequency cap or COPPA/consent flags.
 *  - Purchases: no entitlement/ownership query, no consumable-vs-permanent distinction, no pending/deferred or
 *    cancelled-vs-failed result (boolean only), no receipt/validation hook, restore() returns bare ids; granting
 *    results into MetaSave (unlocks) is unowned.
 *  - Leaderboard: no player identity/auth, no "around me" query, no rejected-score reason.
 *  - Registry: register() is whole-service replace with no async init()/ready state and no error isolation
 *    (a throwing provider propagates into game code; wrap adapters or add a safe-proxy).
 */
export type AnalyticsParams = Record<string, string | number | boolean>;

export interface AnalyticsService {
  track(event: string, params?: AnalyticsParams): void;
}
export interface AdService {
  isRewardedReady(): boolean;
  /** Resolves true if the reward should be granted. */
  showRewarded(placement: string): Promise<boolean>;
}
export interface PurchaseService {
  getProducts(): Promise<{ id: string; price: string }[]>;
  purchase(productId: string): Promise<boolean>;
  restore(): Promise<string[]>;
}
export interface LeaderboardService {
  submitScore(board: string, score: number): Promise<void>;
  getTop(board: string, limit: number): Promise<{ name: string; score: number }[]>;
}

export class NoOpAnalyticsService implements AnalyticsService {
  track(): void { /* noop */ }
}
export class NoOpAdService implements AdService {
  isRewardedReady(): boolean { return false; }
  async showRewarded(): Promise<boolean> { return false; }
}
export class NoOpPurchaseService implements PurchaseService {
  async getProducts(): Promise<{ id: string; price: string }[]> { return []; }
  async purchase(): Promise<boolean> { return false; }
  async restore(): Promise<string[]> { return []; }
}
export class NoOpLeaderboardService implements LeaderboardService {
  async submitScore(): Promise<void> { /* noop */ }
  async getTop(): Promise<{ name: string; score: number }[]> { return []; }
}

export interface Services {
  analytics: AnalyticsService;
  ads: AdService;
  purchases: PurchaseService;
  leaderboard: LeaderboardService;
}

const noOps = (): Services => ({
  analytics: new NoOpAnalyticsService(),
  ads: new NoOpAdService(),
  purchases: new NoOpPurchaseService(),
  leaderboard: new NoOpLeaderboardService(),
});

export class ServiceRegistry {
  private s: Services = noOps();
  get analytics(): AnalyticsService { return this.s.analytics; }
  get ads(): AdService { return this.s.ads; }
  get purchases(): PurchaseService { return this.s.purchases; }
  get leaderboard(): LeaderboardService { return this.s.leaderboard; }
  register(overrides: Partial<Services>): void { this.s = { ...this.s, ...overrides }; }
  reset(): void { this.s = noOps(); }
}

/** Default shared registry. */
export const services = new ServiceRegistry();
