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
      effect: 'Deal 6 Bludgeoning damage.',
      damage: 6,
      damageType: 'Bludgeoning',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 7', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 6, 2: 7, 3: 7 }
    }
  },
  {
    id: 'burning_oil',
    name: 'Burning Oil',
    card: {
      name: 'Burning Oil',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 15,
      tags: ['Fire'],
      effect: 'Deal 5 Fire damage. Apply Burning 1.',
      damage: 5,
      damageType: 'Fire',
      statusApply: {
        id: 'burning',
        stacksByLevel: { 1: 1, 2: 2, 3: 2 }
      },
      mastery: ['Level 1: Base', 'Level 2: Apply Burning 2', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 5, 2: 5, 3: 5 }
    }
  },
  {
    id: 'flash_spark',
    name: 'Flash Spark',
    card: {
      name: 'Flash Spark',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 10,
      tags: ['Fire'],
      effect: 'Apply Blinded 1.',
      damage: 0,
      damageType: '',
      statusApply: {
        id: 'blinded',
        stacksByLevel: { 1: 1, 2: 1, 3: 1 }
      },
      rangeByLevel: { 1: 10, 2: 15, 3: 15 },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 15 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'hydraulic_step',
    name: 'Hydraulic Step',
    card: {
      name: 'Hydraulic Step',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      tags: ['Utility'],
      effect: 'Move 10 ft.',
      damage: 0,
      damageType: '',
      movementByLevel: { 1: 10, 2: 15, 3: 15 },
      mastery: ['Level 1: Base', 'Level 2: Movement increases to 15 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'impact_bolt',
    name: 'Impact Bolt',
    card: {
      name: 'Impact Bolt',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 20,
      tags: ['Bludgeoning'],
      effect: 'Deal 6 Bludgeoning damage.',
      damage: 6,
      damageType: 'Bludgeoning',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 7', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 6, 2: 7, 3: 7 }
    }
  },
  {
    id: 'magnetic_pull',
    name: 'Magnetic Pull',
    card: {
      name: 'Magnetic Pull',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 1,
      range: 15,
      tags: ['Utility'],
      effect: 'Pull target 10 ft toward you.',
      damage: 0,
      damageType: '',
      pullDistanceByLevel: { 1: 10, 2: 10, 3: 10 },
      rangeByLevel: { 1: 15, 2: 20, 3: 20 },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 20 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'reinforce_plating',
    name: 'Reinforce Plating',
    card: {
      name: 'Reinforce Plating',
      set: 'Machine',
      type: 'Defense',
      tier: 'Common',
      healthBonus: 2,
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      tags: ['Shield'],
      effect: 'Restore 4 Shield.',
      damage: 0,
      damageType: '',
      shieldRestoreByLevel: { 1: 4, 2: 5, 3: 5 },
      mastery: ['Level 1: Base', 'Level 2: Restore 5 Shield', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'rivet_shot',
    name: 'Rivet Shot',
    card: {
      name: 'Rivet Shot',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 30,
      tags: ['Piercing'],
      effect: 'Deal 6 Piercing damage.',
      damage: 6,
      damageType: 'Piercing',
      rangeByLevel: { 1: 30, 2: 35, 3: 35 },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 35 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 6, 2: 6, 3: 6 }
    }
  },
  {
    id: 'servo_strike',
    name: 'Servo Strike',
    card: {
      name: 'Servo Strike',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal 6 damage and push target 5 ft.',
      damage: 6,
      damageType: 'Bludgeoning',
      pushDistanceByLevel: { 1: 5, 2: 10, 3: 10 },
      mastery: ['Level 1: Base', 'Level 2: Push distance increases to 10 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 6, 2: 6, 3: 6 }
    }
  },
  {
    id: 'sharp_spike',
    name: 'Sharp Spike',
    card: {
      name: 'Sharp Spike',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal 3 Force damage.',
      damage: 3,
      damageType: 'Force',
      mastery: ['Level 1: Base', 'Level 2: Force damage increases to 4', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 3, 2: 4, 3: 4 }
    }
  },
  {
    id: 'spinning_blade',
    name: 'Spinning Blade',
    card: {
      name: 'Spinning Blade',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 5,
      tags: ['Slashing'],
      effect: 'Deal 7 Slashing damage.',
      damage: 7,
      damageType: 'Slashing',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 8', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 7, 2: 8, 3: 8 }
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
