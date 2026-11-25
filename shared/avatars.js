// Avatar options shared by server (validation/defaults), phone (picker) and TV (rendering).
export const AVATAR_CLASSES = [
  { id: 'knight', name: 'Knight', icon: '🛡️' },
  { id: 'mage', name: 'Mage', icon: '🔮' },
  { id: 'rogue', name: 'Rogue', icon: '🗡️' },
  { id: 'barbarian', name: 'Barbarian', icon: '🪓' },
  { id: 'rogueHooded', name: 'Hooded Rogue', icon: '🥷' },
];
// Chosen to be distinct from a couch, in light and dark scenes.
export const AVATAR_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#ec407a', '#7cb342', '#f5f5f5'];
// what the picker and screen readers call them (a hex code read aloud means nothing)
const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Teal', 'Pink', 'Lime', 'White'];
export const colorName = (c) => COLOR_NAMES[AVATAR_COLORS.indexOf(String(c).toLowerCase())] || 'Custom colour';
