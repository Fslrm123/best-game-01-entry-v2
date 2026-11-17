// Level-up choices: the upgrade pool, rolling three distinct offers, and
// applying the picked one to the player. Choices are the game's real
// decisions — damage now, or speed, or a second life later.

export const UPGRADES = [
  {
    id: 'heavy-embers', name: 'Heavy Embers', max: 5,
    desc: '+25% bolt damage',
    apply(p) { p.bulletDamage *= 1.25; },
  },
  {
    id: 'rapid-ignition', name: 'Rapid Ignition', max: 5,
    desc: '+18% fire rate',
    apply(p) { p.fireInterval *= 0.85; },
  },
  {
    id: 'twin-flame', name: 'Twin Flame', max: 3,
    desc: '+1 bolt per volley',
    apply(p) { p.projectiles += 1; },
  },
  {
    id: 'piercing-embers', name: 'Piercing Embers', max: 3,
    desc: 'Bolts pierce +1 enemy',
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'swift-boots', name: 'Swift Boots', max: 4,
    desc: '+12% move speed',
    apply(p) { p.speed *= 1.12; },
  },
  {
    id: 'heartwood', name: 'Heartwood', max: 4,
    desc: '+25 max HP, heal 25',
    apply(p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet-core', name: 'Magnet Core', max: 3,
    desc: '+60% shard pull radius',
    apply(p) { p.magnetRadius *= 1.6; },
  },
  {
    id: 'ember-nova', name: 'Ember Nova', max: 3,
    desc: 'A radial burst every 6s',
    apply(p) {
      if (p.novaInterval === 0) { p.novaInterval = 6; p.novaTimer = 6; }
      else { p.novaInterval = Math.max(3.5, p.novaInterval - 1); p.novaCount += 4; }
    },
  },
  {
    id: 'thick-hide', name: 'Thick Hide', max: 3,
    desc: 'Take 12% less damage',
    apply(p) { p.damageTakenFactor *= 0.88; },
  },
  {
    id: 'kindling-regen', name: 'Kindling Regen', max: 3,
    desc: 'Regenerate +0.8 HP / sec',
    apply(p) { p.regenPerSecond += 0.8; },
  },
  {
    id: 'greedy-flame', name: 'Greedy Flame', max: 3,
    desc: '+25% score',
    apply(p) { p.scoreFactor *= 1.25; },
  },
  {
    id: 'phoenix-feather', name: 'Phoenix Feather', max: 1,
    desc: 'Revive once at 50% HP',
    apply(p) { p.phoenix = true; },
  },
];

export function rollUpgradeChoices(rng, taken) {
  const available = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
  const choices = [];
  while (choices.length < 3 && available.length > 0) {
    const index = Math.floor(rng.next() * available.length);
    choices.push(available.splice(index, 1)[0]);
  }
  return choices;
}

export function applyUpgrade(player, upgrade, taken) {
  upgrade.apply(player);
  taken[upgrade.id] = (taken[upgrade.id] || 0) + 1;
}
