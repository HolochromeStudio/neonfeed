// Narrative content: barks, bosses, regions, events, saloon talk, ending.
// Dependency-free typed data. effectKey values are plain string ids for the Roguelite system.

export const ENEMY_IDS = [
  'rookie', 'bandit', 'gunslinger', 'coward', 'drunk', 'sheriff',
  'dual_wielder', 'sniper', 'knife_thrower', 'train_guard', 'horse_rider', 'bounty_hunter',
] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export const BOSS_IDS = ['mad_dog_mcgraw', 'the_undertaker', 'lady_luck', 'el_diablo'] as const;
export type BossId = (typeof BOSS_IDS)[number];

export interface EnemyDialogue {
  id: EnemyId;
  intro: string[];
  defeat: string[];
  victory: string[];
}

export interface BossDialogue {
  id: BossId;
  entrance: string[];
  phaseChange: string[];
  defeat: string[];
  victory: string[];
}

export const ENEMY_DIALOGUE: EnemyDialogue[] = [
  { id: 'rookie', intro: ['Heard you are fast.', 'Let us see about that.'], defeat: ['Ma is gonna be real mad...'], victory: ['I did it! I actually did it!'] },
  { id: 'bandit', intro: ['Empty your pockets, stranger.', 'Or I empty you.'], defeat: ['Should have stuck to stagecoaches.'], victory: ['Obliged for the donation.'] },
  { id: 'gunslinger', intro: ['Another one come to die.', 'I will make it quick.'], defeat: ['Twelfth notch... that was mine.'], victory: ['Make it twelve.'] },
  { id: 'coward', intro: ['W-wait, I never wanted this!', 'Fine. Fine! Draw!'], defeat: ['Do not shoot! I am already down!'], victory: ['Ha! Never turn your back on me.'] },
  { id: 'drunk', intro: ['*hic* Which one of you is the real one?'], defeat: ['Next round is on me...'], victory: ['Barkeep! I won! Whiskey!'] },
  { id: 'sheriff', intro: ['Law of the land, friend.', 'And I am the law.'], defeat: ['Tin star never weighed this much.'], victory: ['Case closed. Cell for the body.'] },
  { id: 'dual_wielder', intro: ['One gun for you.', 'One gun for your shadow.'], defeat: ['Should have... brought a third.'], victory: ['Double the bullets, double the fun.'] },
  { id: 'sniper', intro: ['I have had you in my sights since town.'], defeat: ['Did not see that one coming.'], victory: ['Clean. Quiet. Done.'] },
  { id: 'knife_thrower', intro: ['Guns are loud.', 'Blades are polite.'], defeat: ['Ought to have kept my hands steadier.'], victory: ['Right between the lines.'] },
  { id: 'train_guard', intro: ['This cargo is not for you.', 'Step off the platform.'], defeat: ['The gold... was not even mine.'], victory: ['Next stop: somewhere you are not.'] },
  { id: 'horse_rider', intro: ['Yaaah! Hold still, partner!', 'My horse wants a word!'], defeat: ['Easy, girl... easy... I walk home.'], victory: ['Ride on, buckaroo, ride on!'] },
  { id: 'bounty_hunter', intro: ['Your face is on my wall.', 'Time to take it down.'], defeat: ['So the hunter becomes the poster.'], victory: ['Paid in full.'] },
];

export const BOSS_DIALOGUE: BossDialogue[] = [
  {
    id: 'mad_dog_mcgraw',
    entrance: ['Smell that? Smoke and fear.', 'Mad Dog is hungry tonight.'],
    phaseChange: ['Now you made me MAD!', 'Bark, bark, BANG!'],
    defeat: ['Put the dog... down easy...'],
    victory: ['Another town for the fire.'],
  },
  {
    id: 'the_undertaker',
    entrance: ['Already measured you.', 'Pine or oak? Choose quickly.'],
    phaseChange: ['Dig the hole deeper.', 'I never miss an appointment.'],
    defeat: ['Odd... to be the one in the box.'],
    victory: ['Rest easy. I will see to the rest.'],
  },
  {
    id: 'lady_luck',
    entrance: ['Place your bets, darling.', 'You are looking unlucky.'],
    phaseChange: ['Oh, I was holding back.', 'Snake eyes, sugar.'],
    defeat: ['The house... finally folds.'],
    victory: ['Luck was never on your side.'],
  },
  {
    id: 'el_diablo',
    entrance: ['You walked into hell on your own.', 'I almost admire that.'],
    phaseChange: ['The flames answer to me!', 'Burn, little gunslinger!'],
    defeat: ['Impossible... the Devil does not bleed.'],
    victory: ['Your soul was already mine.'],
  },
];

export type RegionId = 'dust_creek' | 'canyon' | 'railroad' | 'saloon' | 'goldspire' | 'widows_peak' | 'blackwater_bay';

export interface RegionFlavour {
  id: RegionId;
  name: string;
  tagline: string;
  description: string;
}

export const REGIONS: RegionFlavour[] = [
  { id: 'dust_creek', name: 'Dust Creek', tagline: 'Where every legend starts.', description: 'A dry town with one street and too many open graves. Easy marks, easier mistakes.' },
  { id: 'canyon', name: 'Canyon', tagline: 'Echoes carry. So do bullets.', description: 'Red walls, narrow trails, and snipers who love the view.' },
  { id: 'railroad', name: 'Railroad', tagline: 'The iron road pays in lead.', description: 'Pacific Line gold rolls through here. Everyone wants a piece of the train.' },
  { id: 'saloon', name: 'Saloon', tagline: 'Whiskey, cards, and bad ideas.', description: 'Piano music, poker smoke, and a stranger who has been staring at you since you walked in.' },
  { id: 'goldspire', name: 'Goldspire', tagline: 'All that glitters will shoot you.', description: 'A boomtown built on a vein of gold and a mountain of lies.' },
  { id: 'widows_peak', name: "Widow's Peak", tagline: 'Few climb down.', description: 'Cold wind, cold graves, and a mountain that keeps what it takes.' },
  { id: 'blackwater_bay', name: 'Blackwater Bay', tagline: 'The end of the road.', description: 'Fog on the water and a red lantern burning in the last house on the pier.' },
];

export interface EventChoice {
  label: string;
  outcomeText: string;
  effectKey: string;
}

export interface RandomEvent {
  id: string;
  title: string;
  text: string;
  choices: EventChoice[];
}

export const RANDOM_EVENTS: RandomEvent[] = [
  { id: 'wounded_stranger', title: 'Wounded Stranger', text: 'A stranger lies bleeding by the trail, clutching a pouch.', choices: [
    { label: 'Help him', outcomeText: 'He pays you in thanks and a few coins.', effectKey: 'heal_small_gain_coins_small' },
    { label: 'Rob him', outcomeText: 'The pouch is yours. Your conscience, less so.', effectKey: 'gain_coins_medium_lose_reputation' },
    { label: 'Ride on', outcomeText: 'The desert keeps its own counsel.', effectKey: 'none' } ] },
  { id: 'snake_oil', title: 'Snake Oil', text: 'A peddler waves a bottle and swears it cures everything.', choices: [
    { label: 'Buy it (15 coins)', outcomeText: 'Tastes terrible. Feels... sharper.', effectKey: 'pay_15_buff_focus' },
    { label: 'Haggle', outcomeText: 'He gives you half the bottle and a dirty look.', effectKey: 'buff_focus_small' },
    { label: 'Decline', outcomeText: 'He spits and moves on.', effectKey: 'none' } ] },
  { id: 'rigged_card_game', title: 'Card Game', text: 'Three men invite you to a friendly hand. Too friendly.', choices: [
    { label: 'Play fair', outcomeText: 'You win some and lose some.', effectKey: 'coinflip_coins_small' },
    { label: 'Cheat', outcomeText: 'An ace from your sleeve. They do not notice. This time.', effectKey: 'cheat_gamble_coins_large' },
    { label: 'Walk away', outcomeText: 'Wise. Their sleeves were heavy.', effectKey: 'none' } ] },
  { id: 'abandoned_wagon', title: 'Abandoned Wagon', text: 'A wagon sits empty on the trail, wheel broken, crate still tied on.', choices: [
    { label: 'Search it', outcomeText: 'Spare ammunition and a flask.', effectKey: 'gain_item_random_common' },
    { label: 'Check for traps', outcomeText: 'A tripwire. You cut it and take the loot safely.', effectKey: 'gain_item_random_common_safe' } ] },
  { id: 'lost_horse', title: 'Lost Horse', text: 'A saddled horse wanders up, no rider in sight.', choices: [
    { label: 'Take it', outcomeText: 'Fine animal. Someone may come looking.', effectKey: 'gain_coins_medium_bounty_risk' },
    { label: 'Return it', outcomeText: 'The owner rewards your honesty.', effectKey: 'gain_reputation_small' },
    { label: 'Leave it', outcomeText: 'The horse wanders on.', effectKey: 'none' } ] },
  { id: 'preacher_blessing', title: 'Roadside Preacher', text: 'A preacher offers a blessing for the road. Donations welcome.', choices: [
    { label: 'Donate 10 coins', outcomeText: 'You feel a little lighter.', effectKey: 'pay_10_heal_medium' },
    { label: 'Take the blessing free', outcomeText: 'He sighs but blesses you anyway.', effectKey: 'heal_small' },
    { label: 'Ignore him', outcomeText: 'He prays for you louder.', effectKey: 'none' } ] },
  { id: 'dusty_shrine', title: 'Dusty Shrine', text: 'A small desert shrine, a bowl of old coins at its feet.', choices: [
    { label: 'Leave a coin', outcomeText: 'The wind changes. Good sign.', effectKey: 'pay_5_buff_luck' },
    { label: 'Take the coins', outcomeText: 'Easy money. The wind turns cold.', effectKey: 'gain_coins_small_debuff_luck' } ] },
  { id: 'bandit_ambush', title: 'Ambush', text: 'Rocks shift above the trail. Bandits, and not shy ones.', choices: [
    { label: 'Pay the toll (20 coins)', outcomeText: 'They let you pass, grinning.', effectKey: 'pay_20' },
    { label: 'Fight', outcomeText: 'Guns out. No turning back.', effectKey: 'start_duel_bandit_bonus' },
    { label: 'Run for it', outcomeText: 'You make it. Mostly.', effectKey: 'lose_hp_small' } ] },
  { id: 'old_prospector_map', title: 'Prospector\'s Map', text: 'A dying prospector presses a torn map into your hand.', choices: [
    { label: 'Follow the map', outcomeText: 'A small cache, buried deep.', effectKey: 'gain_coins_large_lose_hp_small' },
    { label: 'Sell the map', outcomeText: 'A saloon man pays for the rumour.', effectKey: 'gain_coins_small' },
    { label: 'Burn it', outcomeText: 'Some secrets are best ash.', effectKey: 'none' } ] },
  { id: 'stray_dog', title: 'Stray Dog', text: 'A thin dog follows you for a mile, eyes on your jerky.', choices: [
    { label: 'Share your jerky', outcomeText: 'He barks at a hidden ambusher later. Good dog.', effectKey: 'buff_awareness' },
    { label: 'Shoo him', outcomeText: 'He trots off, offended.', effectKey: 'none' } ] },
  { id: 'saloon_brawl', title: 'Brawl', text: 'A fight erupts in the saloon. A chair flies toward you.', choices: [
    { label: 'Join in', outcomeText: 'Bruised, but you pocket a few coins from the floor.', effectKey: 'lose_hp_small_gain_coins_small' },
    { label: 'Duck and watch', outcomeText: 'Free entertainment.', effectKey: 'none' },
    { label: 'Fire a shot in the air', outcomeText: 'Silence. The barkeep nods thanks.', effectKey: 'gain_reputation_small' } ] },
  { id: 'gold_in_the_creek', title: 'Glint in the Creek', text: 'Something shiny glints at the bottom of the creek.', choices: [
    { label: 'Wade in', outcomeText: 'Nuggets! And one very annoyed snake.', effectKey: 'gain_coins_medium_lose_hp_small' },
    { label: 'Pan carefully', outcomeText: 'Slow but safe.', effectKey: 'gain_coins_small' } ] },
  { id: 'gunsmith_offer', title: 'Travelling Gunsmith', text: 'A gunsmith offers to tune your revolver on the road.', choices: [
    { label: 'Pay 30 coins', outcomeText: 'Smoother draw. Truer aim.', effectKey: 'pay_30_upgrade_weapon' },
    { label: 'Trade a favour', outcomeText: 'He wants a message delivered. A small tune-up in return.', effectKey: 'upgrade_weapon_small_quest' },
    { label: 'No thanks', outcomeText: 'Your gun is fine. Probably.', effectKey: 'none' } ] },
];

export type NpcRole = 'bartender' | 'prospector' | 'townsfolk';

export interface SaloonConversation {
  id: string;
  npc: NpcRole;
  speaker: string;
  lines: string[];
}

export const SALOON_CONVERSATIONS: SaloonConversation[] = [
  { id: 'bartender_welcome', npc: 'bartender', speaker: 'Bartender', lines: ['What will it be, stranger?', 'Water is free. Trouble costs extra.'] },
  { id: 'bartender_rumor_diablo', npc: 'bartender', speaker: 'Bartender', lines: ['They say El Diablo drinks nothing.', 'Not even my whiskey. Insulting.'] },
  { id: 'bartender_tab', npc: 'bartender', speaker: 'Bartender', lines: ['Pay your tab before the next duel.', 'Dead men do not settle accounts.'] },
  { id: 'prospector_vein', npc: 'prospector', speaker: 'Old Prospector', lines: ['Found a vein once, near Goldspire.', 'Then the vein found me.'] },
  { id: 'prospector_map', npc: 'prospector', speaker: 'Old Prospector', lines: ['Mark my words: gold is cursed.', 'Just ask the people who found it.'] },
  { id: 'prospector_canyon', npc: 'prospector', speaker: 'Old Prospector', lines: ['Never shout in the canyon.', 'Snipers hear everything.'] },
  { id: 'townsfolk_widow', npc: 'townsfolk', speaker: 'Townswoman', lines: ['My husband went up Widow\'s Peak.', 'You will have to pardon my low expectations.'] },
  { id: 'townsfolk_lady_luck', npc: 'townsfolk', speaker: 'Townswoman', lines: ['Lady Luck once won my house at cards.', 'I still admire her.'] },
  { id: 'townsfolk_hope', npc: 'townsfolk', speaker: 'Townswoman', lines: ['We are tired of the bandits and the burning.', 'If you can end it, we will remember you.'] },
  { id: 'townsfolk_advice', npc: 'townsfolk', speaker: 'Townswoman', lines: ['Fast hands win a duel.', 'Calm ones win the war.'] },
];

export const ENDING_LINES: string[] = [
  'The Devil is dead, and the smoke clears over Blackwater Bay.',
  'The towns will tell it a hundred ways, and none will be true enough.',
  'You ride on. The poster in your pocket has your name on it now.',
];

const ENEMY_BY_ID: Record<string, EnemyDialogue> = Object.fromEntries(ENEMY_DIALOGUE.map((e) => [e.id, e]));
const BOSS_BY_ID: Record<string, BossDialogue> = Object.fromEntries(BOSS_DIALOGUE.map((b) => [b.id, b]));
const REGION_BY_ID: Record<string, RegionFlavour> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
const EVENT_BY_ID: Record<string, RandomEvent> = Object.fromEntries(RANDOM_EVENTS.map((e) => [e.id, e]));

/** Intro lines for an enemy or boss id. Empty array if unknown. */
export function getIntro(id: string): string[] {
  return ENEMY_BY_ID[id]?.intro ?? BOSS_BY_ID[id]?.entrance ?? [];
}
export function getDefeat(id: string): string[] {
  return ENEMY_BY_ID[id]?.defeat ?? BOSS_BY_ID[id]?.defeat ?? [];
}
export function getVictory(id: string): string[] {
  return ENEMY_BY_ID[id]?.victory ?? BOSS_BY_ID[id]?.victory ?? [];
}
export function getBossDialogue(id: string): BossDialogue | undefined {
  return BOSS_BY_ID[id];
}
export function getRegion(id: string): RegionFlavour | undefined {
  return REGION_BY_ID[id];
}
export function getEvent(id: string): RandomEvent | undefined {
  return EVENT_BY_ID[id];
}
/** Deterministic pick: caller supplies a 0..1 value from the seeded RNG (no Math.random here). */
export function pickFrom<T>(items: readonly T[], r01: number): T {
  return items[Math.min(items.length - 1, Math.floor(r01 * items.length))];
}
