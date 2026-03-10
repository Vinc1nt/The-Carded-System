export const CARD_PRESETS = [
  {
    id: 'auto_hammer',
    name: 'Auto Hammer',
    card: {
      name: 'Auto Hammer',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal Bludgeoning damage.',
      damage: 8,
      damageType: 'Bludgeoning',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 9', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 8, 2: 9, 3: 9 }
    }
  }
];

export const RARITY_ORDER = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Epic',
  'Legendary',
  'Unique'
];
