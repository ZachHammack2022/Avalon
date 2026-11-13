// Logical asset names -> URLs under /assets/kaykit. Pure (testable in Node).
//   'knight' | 'mage' | 'rogue' | 'barbarian' | 'rogueHooded'     player classes
//   'skeleton_warrior' | 'skeleton_minion' | 'skeleton_rogue' | 'skeleton_mage'
//   'dungeon:<name>'   Dungeon Remastered  (e.g. dungeon:torch_lit, dungeon:chest_gold)
//   'hex:<name>'       Medieval Hexagon    (e.g. hex:tree_single_A, hex:building_bridge_A)
//   'prop:<name>'      Adventurers' props  (e.g. prop:mug_full, prop:sword_1handed)
//   'skprop:<name>'    Skeleton props
export const BASE = '/assets/kaykit';

export const CHARACTER_FILES = {
  knight: 'characters/Knight.glb', mage: 'characters/Mage.glb', rogue: 'characters/Rogue.glb',
  barbarian: 'characters/Barbarian.glb', rogueHooded: 'characters/Rogue_Hooded.glb',
  skeleton_warrior: 'skeletons/Skeleton_Warrior.glb', skeleton_minion: 'skeletons/Skeleton_Minion.glb',
  skeleton_rogue: 'skeletons/Skeleton_Rogue.glb', skeleton_mage: 'skeletons/Skeleton_Mage.glb',
};

export function resolveAsset(name) {
  if (CHARACTER_FILES[name]) return `${BASE}/${CHARACTER_FILES[name]}`;
  const m = /^(dungeon|hex|prop|skprop):(.+)$/.exec(name);
  if (!m) return null;
  const [, kind, n] = m;
  if (kind === 'dungeon') return `${BASE}/dungeon/${n}.glb`;
  if (kind === 'hex') return `${BASE}/hex/${n}.gltf`;
  if (kind === 'prop') return `${BASE}/props/${n}.gltf`;
  return `${BASE}/skeleton-props/${n}.gltf`;
}

/** Everything the built-in scenes load; `npm run assets:check` verifies each file exists. */
export const CORE_ASSETS = [
  'knight', 'mage', 'rogue', 'barbarian', 'rogueHooded',
  'skeleton_warrior', 'skeleton_minion', 'skeleton_rogue', 'skeleton_mage',
  'prop:mug_full', 'prop:sword_1handed', 'prop:arrow', 'prop:smokebomb', 'prop:spellbook_open', 'prop:shield_badge_color',
  'dungeon:torch_lit', 'dungeon:chest_gold', 'dungeon:coin_stack_large', 'dungeon:coin', 'dungeon:floor_tile_large', 'dungeon:wall', 'dungeon:wall_doorway',
  'dungeon:pillar', 'dungeon:column', 'dungeon:key', 'dungeon:keyring', 'dungeon:candle_lit', 'dungeon:barrel_large', 'dungeon:table_long', 'dungeon:banner_red',
  'hex:tree_single_A', 'hex:tree_single_B', 'hex:trees_A_small', 'hex:trees_B_medium', 'hex:rock_single_A', 'hex:rock_single_B', 'hex:hills_A', 'hex:mountain_A',
  'hex:building_bridge_A', 'hex:building_castle_blue', 'hex:building_tower_A_blue', 'hex:tent', 'hex:flag_red', 'hex:barrel', 'hex:crate_A_big', 'hex:hex_grass', 'hex:hex_water',
];

// Relative on purpose: resolves to /shared/anims.js in the browser (extra ../ clamp at the URL root) and to ./shared in Node tests.
export { ANIMS } from '../../../shared/anims.js';
