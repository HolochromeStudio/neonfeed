// Plain view-model interfaces for the UI scenes. The UI never imports RunSystem / PerkSystem /
// EconomySystem / BountySystem: the Lead maps their state into these shapes, passes them through
// scene init params and listens to the callbacks (or the scene `events` emitter, same payloads).

export type Rarity = 'common' | 'rare' | 'legendary';

/** Procedural pictograms (8x8) the UI can draw without art files. */
export type IconKind = 'draw' | 'dodge' | 'life' | 'coin' | 'luck' | 'aim' | 'star' | 'lock';

export interface IconRef {
  /** Procedural pictogram. */
  kind?: IconKind;
  /** Optional frame of the 'town' atlas (drawn instead of the pictogram when present). */
  frame?: string;
}

export interface PerkCardVM {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** Short category badge: DRAW, DODGE, LIFE ... (shown as text plus a shape). */
  tag?: string;
  icon?: IconRef;
}

export type ShopItemKind = 'perk' | 'item' | 'service';

export interface ShopItemVM {
  id: string;
  name: string;
  description: string;
  kind: ShopItemKind;
  price: number;
  rarity?: Rarity;
  icon?: IconRef;
  sold?: boolean;
}

export interface PerkChipVM {
  id: string;
  name: string;
  rarity: Rarity;
  icon?: IconRef;
}

export interface BountyProgressVM {
  label: string;
  progress: number;
  goal: number;
}

export type RunOutcome = 'death' | 'victory';

export interface RunSummaryVM {
  outcome: RunOutcome;
  /** Id in src/data/wanted.ts of the defeated target (victory) or the killer (death). */
  targetId: string;
  duelsWon: number;
  bestReactionMs: number | null;
  perfectDraws: number;
  regionName: string;
  /** Cause-of-death line (RULE F4), e.g. "Shot while aiming". */
  causeLine?: string;
  coinsEarned: number;
  perks: PerkChipVM[];
  bounties?: BountyProgressVM[];
}

export type MenuAction = 'duel' | 'continue' | 'new_run' | 'saloon' | 'bounties' | 'practice' | 'settings';
export type ResultsAction = 'retry' | 'continue' | 'saloon' | 'menu';

/** Options every UI scene accepts. */
export interface UiSceneOptions {
  /** Left-hand mode: mirrors side-anchored buttons. */
  leftHanded?: boolean;
  /** Reduce motion: no flutter, tween or stamp slam. */
  reduceMotion?: boolean;
  /** Override device insets (CSS px) - previews/tests. */
  insetOverride?: { top: number; right: number; bottom: number; left: number };
}

export interface MainMenuData extends UiSceneOptions {
  coins: number;
  /** A run is in progress: primary becomes CONTINUE RUN and DUEL becomes NEW RUN. */
  hasRun?: boolean;
  /** One line under the primary button, e.g. "DUST CREEK 3/7". */
  runLabel?: string;
  onAction?: (action: MenuAction) => void;
}

export interface RewardData extends UiSceneOptions {
  title?: string;
  subtitle?: string;
  coins?: number;
  cards: PerkCardVM[];
  rerollCost?: number;
  skipCoins?: number;
  onPick?: (id: string) => void;
  onReroll?: () => void;
  onSkip?: () => void;
}

export interface ShopData extends UiSceneOptions {
  title?: string;
  coins: number;
  items: ShopItemVM[];
  rerollCost?: number;
  /** Return false to refuse the purchase (e.g. insufficient funds); anything else marks it bought. */
  onBuy?: (id: string) => boolean | void;
  onReroll?: () => void;
  onLeave?: () => void;
}

export interface ResultsData extends UiSceneOptions {
  summary: RunSummaryVM;
  /** Victory with more to play: primary becomes CONTINUE. */
  canContinue?: boolean;
  onAction?: (action: ResultsAction) => void;
}

/** Scene events emitted in addition to the callbacks. */
export const UI_EVENTS = {
  menuAction: 'ui:menu-action',
  rewardPick: 'ui:reward-pick',
  rewardReroll: 'ui:reward-reroll',
  rewardSkip: 'ui:reward-skip',
  shopBuy: 'ui:shop-buy',
  shopReroll: 'ui:shop-reroll',
  shopLeave: 'ui:shop-leave',
  resultsAction: 'ui:results-action',
} as const;
