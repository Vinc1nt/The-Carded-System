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
  },
  {
    id: 'anchor_harpoon',
    name: 'Anchor Harpoon',
    card: {
      name: 'Anchor Harpoon',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 2,
      range: 20,
      tags: ['Piercing'],
      effect: 'Deal 6 Piercing damage and pull target 10 ft toward you.',
      damage: 6,
      damageType: 'Piercing',
      pullDistanceByLevel: { 1: 10, 2: 10, 3: 10 },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 7', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 6, 2: 7, 3: 7 }
    }
  },
  {
    id: 'boosted_dash',
    name: 'Boosted Dash',
    card: {
      name: 'Boosted Dash',
      set: 'Machine',
      type: 'Utility',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      tags: ['Utility'],
      effect: 'Move 20 ft.',
      damage: 0,
      damageType: '',
      movementByLevel: { 1: 20, 2: 25, 3: 25 },
      mastery: ['Level 1: Base', 'Level 2: Movement increases to 25 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'chain_hook',
    name: 'Chain Hook',
    card: {
      name: 'Chain Hook',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 2,
      range: 10,
      tags: ['Piercing'],
      effect: 'Deal 6 Piercing damage and apply Rooted 1.',
      damage: 6,
      damageType: 'Piercing',
      rangeByLevel: { 1: 10, 2: 15, 3: 15 },
      statusApply: {
        id: 'rooted',
        stacksByLevel: { 1: 1, 2: 1, 3: 1 }
      },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 15 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 6, 2: 6, 3: 6 }
    }
  },
  {
    id: 'flame_injector',
    name: 'Flame Injector',
    card: {
      name: 'Flame Injector',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 2,
      range: 5,
      tags: ['Fire'],
      effect: 'Deal 7 Fire damage. Apply Burning 2.',
      damage: 7,
      damageType: 'Fire',
      statusApply: {
        id: 'burning',
        stacksByLevel: { 1: 2, 2: 3, 3: 3 }
      },
      mastery: ['Level 1: Base', 'Level 2: Apply Burning 3', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 7, 2: 7, 3: 7 }
    }
  },
  {
    id: 'reinforced_guard',
    name: 'Reinforced Guard',
    card: {
      name: 'Reinforced Guard',
      set: 'Machine',
      type: 'Defense',
      tier: 'Uncommon',
      healthBonus: 2,
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      tags: ['Shield'],
      effect: 'Restore 5 Shield.',
      damage: 0,
      damageType: '',
      shieldRestoreByLevel: { 1: 5, 2: 6, 3: 6 },
      mastery: ['Level 1: Base', 'Level 2: Restore 6 Shield', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'serrated_gear',
    name: 'Serrated Gear',
    card: {
      name: 'Serrated Gear',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 2,
      range: 5,
      tags: ['Slashing'],
      effect: 'Deal 7 Slashing damage. Apply Bleeding 2.',
      damage: 7,
      damageType: 'Slashing',
      statusApply: {
        id: 'bleeding',
        stacksByLevel: { 1: 2, 2: 2, 3: 2 }
      },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 8', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 7, 2: 8, 3: 8 }
    }
  },
  {
    id: 'shock_ram',
    name: 'Shock Ram',
    card: {
      name: 'Shock Ram',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 2,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal 5 Bludgeoning damage and 4 Lightning damage.',
      damage: 5,
      damageType: 'Bludgeoning',
      secondaryDamageByLevel: { 1: 4, 2: 5, 3: 5 },
      secondaryDamageType: 'Lightning',
      secondaryTargetMode: 'same',
      mastery: ['Level 1: Base', 'Level 2: Lightning damage increases to 5', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 5, 2: 5, 3: 5 }
    }
  },
  {
    id: 'spark_burst',
    name: 'Spark Burst',
    card: {
      name: 'Spark Burst',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 3,
      range: 15,
      rangeText: '15 ft cone',
      tags: ['Fire'],
      effect: 'Deal 7 Fire damage to all targets. Apply Burning 2.',
      damage: 7,
      damageType: 'Fire',
      targetMode: 'all_others',
      statusApply: {
        id: 'burning',
        stacksByLevel: { 1: 2, 2: 3, 3: 3 }
      },
      mastery: ['Level 1: Base', 'Level 2: Apply Burning 3', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 7, 2: 7, 3: 7 }
    }
  },
  {
    id: 'suppression_shot',
    name: 'Suppression Shot',
    card: {
      name: 'Suppression Shot',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 2,
      range: 30,
      tags: ['Piercing'],
      effect: 'Deal 6 Piercing damage and apply Weakened 1.',
      damage: 6,
      damageType: 'Piercing',
      statusApply: {
        id: 'weakened',
        stacksByLevel: { 1: 1, 2: 1, 3: 1 }
      },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 7', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 6, 2: 7, 3: 7 }
    }
  },
  {
    id: 'whirling_gear',
    name: 'Whirling Gear',
    card: {
      name: 'Whirling Gear',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      healthBonus: 1,
      apCost: 3,
      range: 5,
      tags: ['Slashing'],
      effect: 'Deal 9 Slashing damage to target and 6 Slashing damage to an adjacent enemy.',
      damage: 9,
      damageType: 'Slashing',
      secondaryDamageByLevel: { 1: 6, 2: 7, 3: 7 },
      secondaryDamageType: 'Slashing',
      secondaryTargetMode: 'adjacent',
      secondaryTargetLabel: 'Adjacent Enemy',
      mastery: ['Level 1: Base', 'Level 2: Secondary damage increases to 7', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 9, 2: 9, 3: 9 }
    }
  },
  {
    id: 'chain_launcher',
    name: 'Chain Launcher',
    card: {
      name: 'Chain Launcher',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 2,
      range: 25,
      tags: ['Piercing'],
      effect: 'Deal 7 Piercing damage. Apply Rooted 1.',
      damage: 7,
      damageType: 'Piercing',
      rangeByLevel: { 1: 25, 2: 30, 3: 30 },
      statusApply: {
        id: 'rooted',
        stacksByLevel: { 1: 1, 2: 1, 3: 1 }
      },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 30 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 7, 2: 7, 3: 7 }
    }
  },
  {
    id: 'hydraulic_slam',
    name: 'Hydraulic Slam',
    card: {
      name: 'Hydraulic Slam',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 2,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal 9 Bludgeoning damage and push target 10 ft.',
      damage: 9,
      damageType: 'Bludgeoning',
      pushDistanceByLevel: { 1: 10, 2: 10, 3: 10 },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 10', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 9, 2: 10, 3: 10 }
    }
  },
  {
    id: 'industrial_crusher',
    name: 'Industrial Crusher',
    card: {
      name: 'Industrial Crusher',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal 12 Bludgeoning damage. Apply Weakened 1.',
      damage: 12,
      damageType: 'Bludgeoning',
      statusApply: {
        id: 'weakened',
        stacksByLevel: { 1: 1, 2: 1, 3: 1 }
      },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 13', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 12, 2: 13, 3: 13 }
    }
  },
  {
    id: 'oil_bomb',
    name: 'Oil Bomb',
    card: {
      name: 'Oil Bomb',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 20,
      rangeText: '20 ft (5 ft radius)',
      tags: ['Fire'],
      effect: 'Deal 7 Fire damage to all enemies in 5 ft radius. Apply Burning 2.',
      damage: 7,
      damageType: 'Fire',
      targetMode: 'all_others',
      statusApply: {
        id: 'burning',
        stacksByLevel: { 1: 2, 2: 3, 3: 3 }
      },
      mastery: ['Level 1: Base', 'Level 2: Apply Burning 3', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 7, 2: 7, 3: 7 }
    }
  },
  {
    id: 'overclock_strike',
    name: 'Overclock Strike',
    card: {
      name: 'Overclock Strike',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 2,
      range: 5,
      tags: ['Slashing'],
      effect: 'Deal 8 Slashing damage. Restore 2 Shield.',
      damage: 8,
      damageType: 'Slashing',
      shieldRestoreByLevel: { 1: 2, 2: 3, 3: 3 },
      mastery: ['Level 1: Base', 'Level 2: Restore 3 Shield', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 8, 2: 8, 3: 8 }
    }
  },
  {
    id: 'iron_maelstrom',
    name: 'Iron Maelstrom',
    card: {
      name: 'Iron Maelstrom',
      set: 'Machine',
      type: 'Attack',
      tier: 'Very Rare',
      healthBonus: 3,
      apCost: 3,
      range: 5,
      rangeText: '5 ft (adjacent)',
      tags: ['Slashing'],
      effect: 'Deal 10 Slashing damage to all adjacent enemies.',
      damage: 10,
      damageType: 'Slashing',
      targetMode: 'all_others',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 11', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 10, 2: 11, 3: 11 }
    }
  },
  {
    id: 'magnetic_prison',
    name: 'Magnetic Prison',
    card: {
      name: 'Magnetic Prison',
      set: 'Machine',
      type: 'Utility',
      tier: 'Very Rare',
      healthBonus: 3,
      apCost: 3,
      range: 10,
      tags: ['Utility'],
      effect: 'Apply Restrained 1.',
      damage: 0,
      damageType: '',
      rangeByLevel: { 1: 10, 2: 15, 3: 15 },
      statusApply: {
        id: 'restrained',
        stacksByLevel: { 1: 1, 2: 1, 3: 1 }
      },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 15 ft', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'pressure_drill',
    name: 'Pressure Drill',
    card: {
      name: 'Pressure Drill',
      set: 'Machine',
      type: 'Attack',
      tier: 'Very Rare',
      healthBonus: 3,
      apCost: 2,
      range: 5,
      tags: ['Piercing'],
      effect: 'Deal 9 Piercing damage. Apply Bleeding 3.',
      damage: 9,
      damageType: 'Piercing',
      statusApply: {
        id: 'bleeding',
        stacksByLevel: { 1: 3, 2: 3, 3: 3 }
      },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 10', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 9, 2: 10, 3: 10 }
    }
  },
  {
    id: 'reinforced_bulwark',
    name: 'Reinforced Bulwark',
    card: {
      name: 'Reinforced Bulwark',
      set: 'Machine',
      type: 'Defense',
      tier: 'Very Rare',
      healthBonus: 3,
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      tags: ['Shield'],
      effect: 'Restore 7 Shield.',
      damage: 0,
      damageType: '',
      shieldRestoreByLevel: { 1: 7, 2: 8, 3: 8 },
      mastery: ['Level 1: Base', 'Level 2: Restore 8 Shield', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'thermal_barrage',
    name: 'Thermal Barrage',
    card: {
      name: 'Thermal Barrage',
      set: 'Machine',
      type: 'Attack',
      tier: 'Very Rare',
      healthBonus: 3,
      apCost: 3,
      range: 30,
      tags: ['Fire'],
      effect: 'Deal 8 Fire damage. Apply Burning 3.',
      damage: 8,
      damageType: 'Fire',
      statusApply: {
        id: 'burning',
        stacksByLevel: { 1: 3, 2: 3, 3: 3 }
      },
      mastery: ['Level 1: Base', 'Level 2: Fire Damage increases to 9', 'Level 3: Unlocks fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 8, 2: 9, 3: 9 }
    }
  },
  {
    id: 'chainsaw',
    name: 'Chainsaw',
    card: {
      name: 'Chainsaw',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 10,
      tags: ['Utility'],
      effect: 'Deal 4 Slashing damage.',
      damage: 4,
      damageType: 'Slashing',
      mastery: ['Level 1: Base', 'Level 2: Bonus increases to +3 damage', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 4, 2: 4, 3: 4 }
    }
  },
  {
    id: 'diagnostic_scanner',
    name: 'Diagnostic Scanner',
    card: {
      name: 'Diagnostic Scanner',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 1,
      range: 20,
      tags: ['Utility'],
      effect:
        'Scan a device, mechanism, or structure. Reveal 1 hidden mechanism, trap, weak point, or magical signature within range every 10 minutes.',
      damage: 0,
      damageType: '',
      rangeByLevel: { 1: 20, 2: 30, 3: 30 },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 30 ft', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'mechanical_assistance',
    name: 'Mechanical Assistance',
    card: {
      name: 'Mechanical Assistance',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 10,
      tags: ['Utility'],
      effect: 'An ally gains +2 damage on their next attack.',
      damage: 0,
      damageType: '',
      allowSelfTarget: false,
      nextAttackDamageBonusByLevel: { 1: 2, 2: 3, 3: 3 },
      mastery: ['Level 1: Base', 'Level 2: Bonus increases to +3 damage', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'multi_tool',
    name: 'Multi-Tool',
    card: {
      name: 'Multi-Tool',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 1,
      range: 5,
      rangeText: 'Touch',
      tags: ['Utility'],
      effect: 'Gain +2 bonus on checks to repair, unlock, dismantle, or assemble mechanical objects.',
      damage: 0,
      damageType: '',
      mastery: ['Level 1: Base', 'Level 2: Bonus increases to +4', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'portable_winch',
    name: 'Portable Winch',
    card: {
      name: 'Portable Winch',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 20,
      tags: ['Utility'],
      effect: 'Deploy a grappling winch capable of pulling objects or characters up to 200 kg.',
      damage: 0,
      damageType: '',
      rangeByLevel: { 1: 20, 2: 30, 3: 30 },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 30 ft', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    card: {
      name: 'Rapid Fire',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 30,
      tags: ['Piercing'],
      effect: 'Deal 3 Piercing damage to up to three targets.',
      damage: 3,
      damageType: 'Piercing',
      targetMode: 'multi_select',
      multiTargetMaxByLevel: { 1: 3, 2: 3, 3: 3 },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 4 each', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 3, 2: 4, 3: 4 }
    }
  },
  {
    id: 'scrap_mine',
    name: 'Scrap Mine',
    card: {
      name: 'Scrap Mine',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 10,
      tags: ['Trap'],
      effect: 'Place a mine that deals 6 damage when triggered (DC 10 to perceive).',
      damage: 0,
      damageType: '',
      trapDamageByLevel: { 1: 6, 2: 8, 3: 8 },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 8', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'scrap_turret',
    name: 'Scrap Turret',
    card: {
      name: 'Scrap Turret',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 3,
      range: 10,
      tags: ['Construct'],
      effect: 'Deploy a turret that deals 3 damage to the nearest enemy at the start of your turn for 2 turns.',
      damage: 3,
      damageType: 'Piercing',
      constructDurationTurns: 2,
      constructMode: 'damage',
      constructMaxHp: 6,
      constructRange: 15,
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 4', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 3, 2: 4, 3: 4 }
    }
  },
  {
    id: 'shield_distributor',
    name: 'Shield Distributor',
    card: {
      name: 'Shield Distributor',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      healthBonus: 1,
      apCost: 2,
      range: 10,
      tags: ['Shield'],
      effect: 'Grant an ally 3 Shield.',
      damage: 0,
      damageType: '',
      allowSelfTarget: false,
      shieldRestoreByLevel: { 1: 3, 2: 4, 3: 4 },
      mastery: ['Level 1: Base', 'Level 2: Shield increases to 4', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'lesser_drone',
    name: 'Lesser Drone',
    card: {
      name: 'Lesser Drone',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 1,
      apCost: 3,
      range: 10,
      tags: ['Construct'],
      effect: 'Deploy a combat construct with 4 AP and 2 HP for 2 turns. It uses Chainsaw.',
      damage: 5,
      damageType: 'Slashing',
      constructDurationTurns: 2,
      constructMode: 'damage',
      constructAp: 4,
      constructMaxHp: 2,
      constructLinkedCard: 'Chainsaw',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 6', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 5, 2: 6, 3: 6 }
    }
  },
  {
    id: 'titan_breaker',
    name: 'Titan Breaker',
    card: {
      name: 'Titan Breaker',
      set: 'Machine',
      type: 'Attack',
      tier: 'Legendary',
      healthBonus: 5,
      apCost: 3,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal 16 Bludgeoning damage. If target has Shield, deal +4 damage. If Fully Blocked, deal 6 damage directly to HP.',
      damage: 16,
      damageType: 'Bludgeoning',
      bonusDamageIfTargetHasShieldByLevel: { 1: 4, 2: 4, 3: 4 },
      directHpDamageOnFullyBlockedByLevel: { 1: 6, 2: 6, 3: 6 },
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 17', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 16, 2: 17, 3: 17 }
    }
  },
  {
    id: 'acid_spill',
    name: 'Acid Spill',
    card: {
      name: 'Acid Spill',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 15,
      tags: ['Acid'],
      effect: 'Create an acid zone with a 10 ft radius that deals 4 damage to creatures that enter or start their turn in it.',
      damage: 4,
      damageType: 'Acid',
      targetMode: 'multi_select',
      multiTargetMaxByLevel: { 1: 10, 2: 10, 3: 10 },
      zoneRadiusByLevel: { 1: 10, 2: 15, 3: 15 },
      mastery: ['Level 1: Base', 'Level 2: Radius increases to 15 ft', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 4, 2: 4, 3: 4 }
    }
  },
  {
    id: 'c4n1n3',
    name: 'C4N1N3',
    card: {
      name: 'C4N1N3',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 1,
      apCost: 3,
      range: 10,
      tags: ['Construct'],
      effect: 'Deploy a combat construct with 4 AP and 8 HP that lasts for 2 turns. It has the Chainsaw card. You may command it on your turn.',
      damage: 5,
      damageType: 'Slashing',
      constructDurationTurns: 2,
      constructMode: 'damage',
      constructAp: 4,
      constructMaxHp: 8,
      constructCards: ['Chainsaw'],
      constructLinkedCard: 'Chainsaw',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 6', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 5, 2: 6, 3: 6 }
    }
  },
  {
    id: 'compressed_spring',
    name: 'Compressed Spring',
    card: {
      name: 'Compressed Spring',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 10,
      rangeText: '10 ft (adjacent)',
      tags: ['Slashing'],
      effect: 'Deal 8 Slashing damage to all adjacent enemies.',
      damage: 8,
      damageType: 'Slashing',
      targetMode: 'all_others',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 9', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 8, 2: 9, 3: 9 }
    }
  },
  {
    id: 'electrified_floor',
    name: 'Electrified Floor',
    card: {
      name: 'Electrified Floor',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 20,
      tags: ['Lightning'],
      effect: 'Create a 10 ft radius zone that deals 4 Lightning damage to all creatures inside it for 2 turns.',
      damage: 4,
      damageType: 'Lightning',
      targetMode: 'multi_select',
      multiTargetMaxByLevel: { 1: 10, 2: 10, 3: 10 },
      zoneRadiusByLevel: { 1: 10, 2: 15, 3: 15 },
      zoneDurationTurns: 2,
      mastery: ['Level 1: Base', 'Level 2: Radius increases to 15 ft', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 4, 2: 4, 3: 4 }
    }
  },
  {
    id: 'environmental_scanner',
    name: 'Environmental Scanner',
    card: {
      name: 'Environmental Scanner',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 2,
      range: 30,
      tags: ['Utility'],
      effect: 'Detect hazards, toxins, radiation, structural instability, or environmental dangers within range.',
      damage: 0,
      damageType: '',
      rangeByLevel: { 1: 30, 2: 50, 3: 50 },
      mastery: ['Level 1: Base', 'Level 2: Range increases to 50 ft', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'heavy_loader',
    name: 'Heavy Loader',
    card: {
      name: 'Heavy Loader',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 5,
      tags: ['Bludgeoning'],
      effect: 'Deal 13 Bludgeoning damage.',
      damage: 13,
      damageType: 'Bludgeoning',
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 14', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 13, 2: 14, 3: 14 }
    }
  },
  {
    id: 'repair_field',
    name: 'Repair Field',
    card: {
      name: 'Repair Field',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 10,
      tags: ['Utility'],
      effect: 'Restore 4 HP to allies in a 10 ft radius.',
      damage: 0,
      damageType: '',
      targetMode: 'multi_select',
      multiTargetMaxByLevel: { 1: 10, 2: 10, 3: 10 },
      healByLevel: { 1: 4, 2: 6, 3: 6 },
      chargesMax: 4,
      chargesCurrent: 4,
      mastery: ['Level 1: Base', 'Level 2: Healing increases to 6 HP', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'signal_beacon',
    name: 'Signal Beacon',
    card: {
      name: 'Signal Beacon',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 2,
      range: 30,
      tags: ['Utility'],
      effect: 'Deploy a beacon that broadcasts signals visible or detectable across long distances.',
      damage: 0,
      damageType: '',
      mastery: ['Level 1: Base', 'Level 2: Beacon radius doubles', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
    }
  },
  {
    id: 'small_arc_turret',
    name: 'Small Arc Turret',
    card: {
      name: 'Small Arc Turret',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 10,
      tags: ['Construct'],
      effect: 'Deploy a turret zone in a 10 ft square. Creatures inside take 3 damage at the start of their turn for 2 turns. It has 10 HP.',
      damage: 3,
      damageType: 'Lightning',
      constructDurationTurns: 2,
      constructMode: 'damage',
      constructAp: 2,
      constructMaxHp: 10,
      constructCards: [],
      mastery: ['Level 1: Base', 'Level 2: Damage increases to 4', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 },
      masteryDamageByLevel: { 1: 3, 2: 4, 3: 4 }
    }
  },
  {
    id: 'steel_barricade',
    name: 'Steel Barricade',
    card: {
      name: 'Steel Barricade',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      healthBonus: 2,
      apCost: 3,
      range: 0,
      rangeText: 'Self',
      tags: ['Utility'],
      effect: 'Restore 3 Shield to all allies within 10 ft.',
      damage: 0,
      damageType: '',
      targetMode: 'all_others',
      shieldRestoreByLevel: { 1: 3, 2: 4, 3: 4 },
      mastery: ['Level 1: Base', 'Level 2: Shield restored increases to 4', 'Level 3: Unlocks Fusion eligibility'],
      masteryThresholds: { level2: 25, level3: 55 }
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
