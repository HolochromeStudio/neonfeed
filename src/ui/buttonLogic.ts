// Pure press/release state machine for plank buttons and purchase confirmation.
// UX_FLOW 2: trigger on pointer-up inside the target; cancel if the pointer leaves.

import { PRICE_CONFIRM_ABOVE } from './layout';

export type ButtonPhase = 'idle' | 'pressed' | 'disabled';
export interface ButtonState { phase: ButtonPhase; pointerId: number | null }
export type ButtonEvent =
  | { type: 'down'; id: number }
  | { type: 'up'; id: number }
  | { type: 'leave'; id: number }
  | { type: 'enable' }
  | { type: 'disable' };
export type ButtonFeedback = 'click' | 'denied' | null;
export interface ButtonResult { state: ButtonState; fire: boolean; feedback: ButtonFeedback }

export const initialButton = (enabled = true): ButtonState => ({ phase: enabled ? 'idle' : 'disabled', pointerId: null });

export function reduceButton(s: ButtonState, e: ButtonEvent): ButtonResult {
  switch (e.type) {
    case 'enable': return { state: s.phase === 'disabled' ? initialButton(true) : s, fire: false, feedback: null };
    case 'disable': return { state: initialButton(false), fire: false, feedback: null };
    case 'down':
      if (s.phase === 'disabled') return { state: s, fire: false, feedback: 'denied' };
      if (s.phase === 'pressed') return { state: s, fire: false, feedback: null }; // second finger ignored
      return { state: { phase: 'pressed', pointerId: e.id }, fire: false, feedback: 'click' };
    case 'up':
      if (s.phase === 'pressed' && s.pointerId === e.id) return { state: initialButton(true), fire: true, feedback: null };
      return { state: s, fire: false, feedback: null };
    case 'leave':
      if (s.phase === 'pressed' && s.pointerId === e.id) return { state: initialButton(true), fire: false, feedback: null };
      return { state: s, fire: false, feedback: null };
  }
}

export function needsConfirm(price: number): boolean {
  return price > PRICE_CONFIRM_ABOVE;
}

export interface ConfirmState { armedId: string | null; armedAt: number }
export const CONFIRM_WINDOW_MS = 3000;
export const initialConfirm = (): ConfirmState => ({ armedId: null, armedAt: 0 });

/** Second tap on the same item within the window confirms purchases above 50 coins. */
export function purchaseTap(s: ConfirmState, itemId: string, price: number, now: number): { state: ConfirmState; action: 'arm' | 'buy' } {
  if (!needsConfirm(price)) return { state: initialConfirm(), action: 'buy' };
  if (s.armedId === itemId && now - s.armedAt <= CONFIRM_WINDOW_MS) return { state: initialConfirm(), action: 'buy' };
  return { state: { armedId: itemId, armedAt: now }, action: 'arm' };
}

export function canAfford(coins: number, price: number): boolean {
  return Number.isFinite(coins) && coins >= price;
}
