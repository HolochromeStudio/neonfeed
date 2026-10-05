/** Provider-agnostic service interfaces (D7). Game code depends only on these. */
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
