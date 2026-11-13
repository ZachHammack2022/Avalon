// Scene registry. buildScene(name) returns a fresh scene definition (see campfire.js for the shape).
import { campfireScene } from './campfire.js';
import { bridgeScene, woodsScene, vaultScene, dragonScene, throneScene } from './quests.js';

const REGISTRY = {
  campfire: () => campfireScene({ night: false }),
  night: () => campfireScene({ night: true }),
  bridge: bridgeScene, woods: woodsScene, vault: vaultScene, dragon: dragonScene, throne: throneScene,
};
export const SCENE_NAMES = Object.keys(REGISTRY);

export function buildScene(name) {
  const f = REGISTRY[name];
  if (!f) throw new Error(`unknown scene "${name}"`);
  return f();
}
