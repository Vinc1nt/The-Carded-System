export const CARD_PRESETS = [
  {
    id: 'elemental_stone_guard',
    card: {
      id: 'elemental_stone_guard',
      name: 'Stone Guard',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      effect: 'Restore 3 Shield.',
      shieldRestoreByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      abilityBonusesByLevel: {
        3: {
          constitution: 1
        },
        4: {
          constitution: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield restored increases to 4.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_wind_step',
    card: {
      id: 'elemental_wind_step',
      name: 'Wind Step',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Wind'],
      effect: 'Move 10 ft without triggering opportunity attacks.',
      movementByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      utilityNote: 'Does not trigger opportunity attacks.',
      abilityBonusesByLevel: {
        3: {
          dexterity: 1
        },
        4: {
          dexterity: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Movement increases to 15 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
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
