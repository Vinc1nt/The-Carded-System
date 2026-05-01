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
      apCost: 2,
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
  },
  {
    id: 'elemental_flicker',
    card: {
      id: 'elemental_flicker',
      name: 'Flicker',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      effect: 'Apply Burning 1.',
      targetEnemiesOnly: true,
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'burning_to_2',
          label: 'Burning increases to 2',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: {
                dexterity: 1
              },
              3: {
                dexterity: 1
              },
              4: {
                dexterity: 1
              }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Burning increases to 2 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_analysis',
    card: {
      id: 'arcane_analysis',
      name: 'Analysis',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 5,
      rangeText: 'Touch',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Reveal properties of magical items, relics, or enchantments you are holding. Requires currency per cast. Cost scales with complexity.',
      masteryChoiceOptions: [
        {
          id: 'identify_curses',
          label: 'Can identify curses',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Can identify curses or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_eye',
    card: {
      id: 'arcane_arcane_eye',
      name: 'Arcane Eye',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Unveil Arcane Eye on your limb that reveals hidden enemies and traps within 15 ft. Duration 2 turns. Cannot use limb to hold items or cast while spell is active.',
      masteryChoiceOptions: [
        {
          id: 'radius_to_25',
          label: 'Radius increases to 25 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Radius increases to 25 ft or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_message',
    card: {
      id: 'arcane_arcane_message',
      name: 'Arcane Message',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Unlimited',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: "Send a short message to an ally anywhere or a creature within line of sight. Recipient does not need to understand caster's language. Limited to 6 words.",
      masteryChoiceOptions: [
        {
          id: 'receive_one_word_reply',
          label: 'Can receive 1-word answer',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'charisma_plus_1',
          label: 'CHA +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { charisma: 1 },
              3: { charisma: 1 },
              4: { charisma: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Can receive 1-word answer or CHA +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_sense',
    card: {
      id: 'arcane_arcane_sense',
      name: 'Arcane Sense',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Detect magic effects, hidden traps, or magical objects within 30 ft. Caster may not move for 10 minutes. Caster may be moved by external forces.',
      masteryChoiceOptions: [
        {
          id: 'range_to_60',
          label: 'Range increases to 60 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Range increases to 60 ft or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_blink_step',
    card: {
      id: 'arcane_blink_step',
      name: 'Blink Step',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 3,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Teleport 15 ft. Caster must have line of sight to destination.',
      masteryChoiceOptions: [
        {
          id: 'teleport_to_20',
          label: 'Teleport increases to 20 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Teleport increases to 20 ft or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_force_push',
    card: {
      id: 'arcane_force_push',
      name: 'Force Push',
      set: 'Arcane',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Force'],
      damage: 6,
      damageType: 'Force',
      effect: 'Deal 6 Force damage and push the target 10 ft.',
      pushDistanceByLevel: {
        1: 10
      },
      masteryChoiceOptions: [
        {
          id: 'push_to_15',
          label: 'Push increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            pushDistanceByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'strength_plus_1',
          label: 'STR +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { strength: 1 },
              3: { strength: 1 },
              4: { strength: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Push increases to 15 ft or STR +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_locate_presence',
    card: {
      id: 'arcane_locate_presence',
      name: 'Locate Presence',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Caster can sense the direction of the nearest hidden creature within 40 ft.',
      masteryChoiceOptions: [
        {
          id: 'range_to_60',
          label: 'Range increases to 60 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Range increases to 60 ft or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_mage_arm_tm',
    card: {
      id: 'arcane_mage_arm_tm',
      name: 'Mage Arm (TM)',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Interact with objects at range (pull levers, open containers, retrieve items).',
      masteryChoiceOptions: [
        {
          id: 'range_to_40',
          label: 'Range increases to 40 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Range increases to 40 ft or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_gravity_spike',
    card: {
      id: 'arcane_gravity_spike',
      name: 'Gravity Spike',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      damage: 1,
      damageType: 'Force',
      effect: 'Create Gravity Zone (Radius 10 ft). Creatures inside move at half speed and take 1 Force damage each turn. Duration 2 turns.',
      utilityNote: 'Manually assign creatures inside the zone. Remove the Gravity Spike status manually when a creature leaves the zone.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      statusApply: {
        name: 'Gravity Spike',
        notes: 'Move at half speed while inside Gravity Zone.',
        stacksByLevel: {
          1: 1
        }
      },
      zoneEnterStatusApply: {
        name: 'Gravity Spike',
        notes: 'Move at half speed while inside Gravity Zone.',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'radius_to_15',
          label: 'Radius increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            zoneRadiusByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Radius increases to 15 ft or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_mind_shield',
    card: {
      id: 'arcane_mind_shield',
      name: 'Mind Shield',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Gain immunity to Charmed and Frightened. Duration 2 turns.',
      statusApply: {
        id: 'mind_shield',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'gain_2_shield',
          label: 'Gain 2 Shield as well',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            shieldRestoreByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Gain 2 Shield as well or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_size_shift',
    card: {
      id: 'arcane_size_shift',
      name: 'Size Shift',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect:
        'Choose a creature to Enlarge or Reduce. Enlarge: +2 damage on melee attacks. Reduce: -2 damage on attacks. If targeting a hostile creature, resolve a contested Wisdom check; if resisted, the caster takes 2 Psychic damage. Duration 2 turns.',
      targetMode: 'single',
      targetEntityKinds: ['participant'],
      contestedEffect: {
        choiceLabel: 'Size Shift',
        hostileOnly: true,
        resistedCasterDamageByLevel: {
          1: 2
        },
        resistedDamageType: 'Psychic',
        options: [
          {
            id: 'enlarge',
            label: 'Enlarge',
            statusId: 'enlarge',
            statusName: 'Enlarge',
            statusNotes: '+2 damage on melee attacks.',
            durationTurnsByLevel: {
              1: 2,
              2: 3,
              3: 3,
              4: 3
            },
            clearStatuses: ['reduce']
          },
          {
            id: 'reduce',
            label: 'Reduce',
            statusId: 'reduce',
            statusName: 'Reduce',
            statusNotes: '-2 damage on attacks.',
            durationTurnsByLevel: {
              1: 2,
              2: 3,
              3: 3,
              4: 3
            },
            clearStatuses: ['enlarge']
          }
        ]
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 3 turns.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_rift',
    card: {
      id: 'arcane_arcane_rift',
      name: 'Arcane Rift',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 30,
      rangeByLevel: {
        1: 30,
        2: 50,
        3: 50,
        4: 50
      },
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Utility'],
      effect:
        'Teleport two creatures within 10 ft of each other up to card range. For each unwilling creature, the caster takes 1.5x the teleported distance as Psychic damage.',
      targetMode: 'multi_select',
      multiTargetMin: 2,
      multiTargetMax: 2,
      targetEntityKinds: ['participant'],
      customCardEffect: 'arcane_rift',
      backlashDamageType: 'Psychic',
      perTargetInputs: [
        {
          id: 'distanceFt',
          label: 'Teleport distance (ft)',
          type: 'number',
          min: 0,
          step: 5,
          defaultValue: 10
        },
        {
          id: 'willing',
          label: 'Willing',
          type: 'checkbox',
          defaultChecked: true
        }
      ],
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 50 ft.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_confusing_sight',
    card: {
      id: 'arcane_confusing_sight',
      name: 'Confusing Sight',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Utility'],
      effect:
        'Enemies within Radius 10 ft become Frightened 1. Each targeted hostile creature may resist with a contested WIS vs WIS check.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      targetEntityKinds: ['participant'],
      areaRadiusByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      contestedEffect: {
        choiceLabel: 'Effect',
        hostileOnly: true,
        promptMode: 'per_target_checkbox',
        promptCheckboxLabel: 'Successful',
        options: [
          {
            id: 'frightened',
            label: 'Frightened',
            statusId: 'frightened',
            statusName: 'Frightened',
            statusStacks: 1
          }
        ]
      },
      abilityBonusesByLevel: {
        3: { wisdom: 2 },
        4: { wisdom: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Radius increases to 15 ft.',
        'Level 3: WIS +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_force_wall',
    card: {
      id: 'arcane_force_wall',
      name: 'Force Wall',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 15,
      healthBonus: 2,
      shieldBonus: 3,
      tags: ['Construct'],
      effect: 'Create Force Wall, 10 ft wide (HP 20) blocking movement and attacks through it. Duration 2 turns.',
      isConstruct: true,
      constructMode: 'utility',
      constructAllowUntargetedDeploy: true,
      constructAp: 0,
      constructMaxHp: 20,
      constructMaxHpByLevel: {
        1: 20,
        2: 30,
        3: 30,
        4: 30
      },
      constructDurationTurns: 2,
      constructDurationTurnsByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      constructUtilityNote: 'Blocks movement and attacks through it.',
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: HP increases to 30 and duration increases to 3 turns.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_cage',
    card: {
      id: 'arcane_arcane_cage',
      name: 'Arcane Cage',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Construct'],
      effect:
        'Trap a target in an Arcane Barrier (HP 20) for 2 turns unless cast again. No card effects may leave the barrier, and no effects may enter it. Unwilling creatures may attempt to break out via contested checks.',
      targetMode: 'single',
      targetEntityKinds: ['participant'],
      allowSelfTarget: false,
      isConstruct: true,
      constructMode: 'utility',
      constructTargetRequired: true,
      constructAp: 0,
      constructMaxHp: 20,
      constructDurationTurns: 2,
      constructDurationTurnsByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      constructUtilityNote:
        'Arcane Barrier around assigned target. Initial and later breakout contests are GM-resolved.',
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 3 turns.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_no',
    card: {
      id: 'arcane_no',
      name: 'No',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Cancel a zone effect within range.',
      targetMode: 'none',
      customCardEffect: 'arcane_no',
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: May be used as a reaction up to 3 times before your next turn. Reaction cost becomes 4 AP and can reverse the immediately previous card; any shortfall becomes AP debt on future turns.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_two_step',
    card: {
      id: 'arcane_two_step',
      name: 'Two Step',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect:
        'Gain Two Step for 2 turns. At the end of each turn, teleport 10 ft forward horizontally. If the space is occupied, you do not teleport.',
      targetMode: 'none',
      customCardEffect: 'arcane_two_step',
      durationTurnsByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 3 turns.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_haste_matrix',
    card: {
      id: 'arcane_haste_matrix',
      name: 'Haste Matrix',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Very Rare',
      apCost: 3,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Utility'],
      effect:
        'Target ally gains +2 AP each turn for 2 turns. When the duration ends, the target suffers Haste Crash (-4 AP on its next turn). Each creature can only be targeted by this card twice per encounter.',
      targetMode: 'single',
      targetEntityKinds: ['participant'],
      allowSelfTarget: false,
      targetAlliesOnly: true,
      customCardEffect: 'arcane_haste_matrix',
      durationTurnsByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 3 turns.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_polymorph_matrix',
    card: {
      id: 'arcane_polymorph_matrix',
      name: 'Polymorph Matrix',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Utility'],
      effect:
        'Transform a creature into another creature the caster has seen before for 3 turns. Unwilling creatures may attempt to resist with a contested Int/Wis check.',
      targetMode: 'single',
      targetEntityKinds: ['participant'],
      customCardEffect: 'arcane_polymorph_matrix',
      perTargetInputs: [
        {
          id: 'formName',
          label: 'Chosen Form',
          type: 'text'
        }
      ],
      contestedEffect: {
        hostileOnly: true,
        options: [
          {
            id: 'polymorph',
            label: 'Polymorph',
            statusName: 'Polymorphed',
            statusNotes: 'GM resolves transformed statistics and capabilities.',
            durationTurnsByLevel: {
              1: 3,
              2: 4,
              3: 4,
              4: 4
            }
          }
        ]
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 4 turns.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_maze_of_the_mind',
    card: {
      id: 'arcane_maze_of_the_mind',
      name: 'Maze of the Mind',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Epic',
      apCost: 4,
      range: 20,
      healthBonus: 3,
      shieldBonus: 3,
      tags: ['Psychic'],
      effect:
        'The target becomes Suppressed 1 (cannot play cards). Target may attempt to resist. Int/Wis vs Int/Wis.',
      targetMode: 'single',
      targetEntityKinds: ['participant'],
      allowSelfTarget: false,
      contestedEffect: {
        hostileOnly: true,
        options: [
          {
            id: 'suppressed',
            label: 'Suppressed',
            statusId: 'suppressed',
            statusName: 'Suppressed',
            statusNotes: 'Cannot play cards while active.',
            statusStacksByLevel: {
              1: 1,
              2: 2,
              3: 2,
              4: 2
            }
          }
        ]
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Suppressed 2.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_pause_button',
    card: {
      id: 'arcane_pause_button',
      name: 'Pause Button',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Legendary',
      apCost: 5,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect:
        'After this turn, time pauses for 1 extra turn. You may act with 2 AP while the world is paused. Zone timing, construct timing, incoming delayed effects, and round-based triggers are suspended during the pause. Afterward, forfeit your next normal turn. Once per long rest.',
      targetMode: 'none',
      customCardEffect: 'arcane_pause_button',
      durationTurnsByLevel: {
        1: 1,
        2: 2,
        3: 2,
        4: 2
      },
      pauseApByLevel: {
        1: 2,
        2: 4,
        3: 4,
        4: 4
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 2 turns. You may use 4 AP while the world is paused.',
        'Level 3: -',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_cleansing_light',
    card: {
      id: 'divine_cleansing_light',
      name: 'Cleansing Light',
      set: 'Divine',
      type: 'Utility',
      tier: 'Common',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Remove one status effect from an ally fully.',
      utilityNote: 'Choose which status effects to remove from the target.',
      targetAlliesOnly: true,
      removeStatusCountByLevel: {
        1: 1,
        2: 2,
        3: 2,
        4: 2
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Remove two statuses instead.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_healing_touch',
    card: {
      id: 'nature_healing_touch',
      name: 'Healing Touch',
      set: 'Nature',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      charges: 4,
      range: 5,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 4 HP to an ally.',
      targetAlliesOnly: true,
      healByLevel: {
        1: 4,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 6 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_light_bandage',
    card: {
      id: 'nature_light_bandage',
      name: 'Light Bandage',
      set: 'Nature',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      charges: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 5 HP and remove Bleeding.',
      targetAlliesOnly: true,
      healByLevel: {
        1: 5,
        2: 7,
        3: 7,
        4: 7
      },
      removeStatusIds: ['bleeding'],
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 7 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_revitalize',
    card: {
      id: 'divine_revitalize',
      name: 'Revitalize',
      set: 'Divine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      charges: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 6 HP to an ally.',
      targetAlliesOnly: true,
      healByLevel: {
        1: 6,
        2: 8,
        3: 8,
        4: 8
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 8 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_guardian_halo',
    card: {
      id: 'divine_guardian_halo',
      name: 'Guardian Halo',
      set: 'Divine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Grant an ally 8 Shield.',
      targetAlliesOnly: true,
      shieldRestoreByLevel: {
        1: 8,
        2: 10,
        3: 10,
        4: 10
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield increases to 10.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_natures_renewal',
    card: {
      id: 'nature_natures_renewal',
      name: "Nature's Renewal",
      set: 'Nature',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      charges: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 4 HP to allies within Radius 10 ft.',
      utilityNote: 'Manually select allies within the 10 ft radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetAlliesOnly: true,
      healByLevel: {
        1: 4,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 6 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_lightning_strike',
    card: {
      id: 'nature_lightning_strike',
      name: 'Lightning Strike',
      set: 'Nature',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 4,
      range: 30,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Lightning'],
      damage: 10,
      damageType: 'Lightning',
      secondaryDamage: 5,
      secondaryDamageByLevel: {
        1: 5,
        2: 7,
        3: 7,
        4: 7
      },
      effect: 'Deal 10 Lightning damage to target and 5 damage to enemies within 10 ft.',
      utilityNote: 'Manually select the main target and any enemies within 10 ft. Mark exactly one selected enemy as the primary strike target.',
      customCardEffect: 'nature_lightning_strike',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 10,
      areaRadiusByLevel: {
        1: 10
      },
      perTargetInputs: [
        {
          id: 'primary',
          label: 'Primary target',
          type: 'checkbox',
          defaultChecked: false
        }
      ],
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Splash damage increases to 7.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_healing_spring',
    card: {
      id: 'elemental_healing_spring',
      name: 'Healing Spring',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      charges: 3,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Water'],
      effect: 'Create Healing Zone (Radius 10 ft). Allies restore 4 HP each turn for 2 turns.',
      utilityNote: 'Assign allies inside the zone to receive healing each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetAlliesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      zoneHealByLevel: {
        1: 4,
        2: 6,
        3: 6,
        4: 6
      },
      zoneHealAlliesOnly: true,
      abilityBonusesByLevel: {
        3: {
          wisdom: 2
        },
        4: {
          wisdom: 2
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 6 HP.',
        'Level 3: WIS +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_stone_strike',
    card: {
      id: 'elemental_stone_strike',
      name: 'Stone Strike',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      damage: 7,
      damageType: 'Bludgeoning',
      effect: 'Deal 7 Bludgeoning damage.',
      masteryDamageByLevel: {
        1: 7,
        2: 8,
        3: 8,
        4: 8
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_shield_slam',
    card: {
      id: 'machine_shield_slam',
      name: 'Shield Slam',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Bludgeoning'],
      damage: 7,
      damageType: 'Bludgeoning',
      effect: 'Deal 7 Bludgeoning damage. Push the target 10 ft.',
      pushDistanceByLevel: {
        1: 10
      },
      masteryChoiceOptions: [
        {
          id: 'push_to_15',
          label: 'Push increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            pushDistanceByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'strength_plus_1',
          label: 'STR +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { strength: 1 },
              3: { strength: 1 },
              4: { strength: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Push increases to 15 ft or STR +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_auto_hammer',
    card: {
      id: 'machine_auto_hammer',
      name: 'Auto Hammer',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Bludgeoning'],
      damage: 6,
      damageType: 'Bludgeoning',
      effect: 'Deal 6 Bludgeoning damage.',
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_burning_oil',
    card: {
      id: 'machine_burning_oil',
      name: 'Burning Oil',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 5,
      damageType: 'Fire',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 5 Fire damage. Apply Burning 1.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 1,
          2: 2,
          3: 2,
          4: 2
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Burning 2.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_flash_spark',
    card: {
      id: 'machine_flash_spark',
      name: 'Flash Spark',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Apply Blinded 1.',
      statusApply: {
        id: 'blinded',
        stacksByLevel: {
          1: 1
        }
      },
      rangeByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { wisdom: 1 },
        4: { wisdom: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 15 ft.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_hammer_blow',
    card: {
      id: 'machine_hammer_blow',
      name: 'Hammer Blow',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 1,
      shieldBonus: 2,
      tags: ['Bludgeoning'],
      damage: 6,
      damageType: 'Bludgeoning',
      effect: 'Deal 6 Bludgeoning damage and push target 5 ft.',
      pushDistanceByLevel: {
        1: 5,
        2: 10,
        3: 10,
        4: 10
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Push distance increases to 10 ft.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_hydraulic_step',
    card: {
      id: 'machine_hydraulic_step',
      name: 'Hydraulic Step',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Move 10 ft.',
      movementByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Movement increases to 15 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_impact_bolt',
    card: {
      id: 'machine_impact_bolt',
      name: 'Impact Bolt',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Bludgeoning'],
      damage: 6,
      damageType: 'Bludgeoning',
      effect: 'Deal 6 Bludgeoning damage.',
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_magnetic_pull',
    card: {
      id: 'machine_magnetic_pull',
      name: 'Magnetic Pull',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      allowSelfTarget: false,
      effect: 'Pull target 10 ft toward you.',
      pullDistanceByLevel: {
        1: 10
      },
      rangeByLevel: {
        1: 15,
        2: 20,
        3: 20,
        4: 20
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 20 ft.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_reinforce_plating',
    card: {
      id: 'machine_reinforce_plating',
      name: 'Reinforce Plating',
      set: 'Machine',
      type: 'Defense',
      tier: 'Common',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Shield'],
      effect: 'Restore 4 Shield.',
      shieldRestoreByLevel: {
        1: 4,
        2: 5,
        3: 5,
        4: 5
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Restore 5 Shield.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_rivet_shot',
    card: {
      id: 'machine_rivet_shot',
      name: 'Rivet Shot',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 6,
      damageType: 'Piercing',
      effect: 'Deal 6 Piercing damage.',
      rangeByLevel: {
        1: 30,
        2: 35,
        3: 35,
        4: 35
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 35 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_sharp_spike',
    card: {
      id: 'machine_sharp_spike',
      name: 'Sharp Spike',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 3,
      damageType: 'Piercing',
      effect: 'Deal 3 Piercing damage.',
      masteryDamageByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Piercing damage increases to 4.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_spring_recoil',
    card: {
      id: 'machine_spring_recoil',
      name: 'Spring Recoil',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Bludgeoning'],
      damage: 7,
      damageType: 'Bludgeoning',
      effect: 'Deal 7 Bludgeoning damage. Push the target 10 ft.',
      pushDistanceByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Push increases to 15 ft.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_spinning_blade',
    card: {
      id: 'machine_spinning_blade',
      name: 'Spinning Blade',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Slashing'],
      damage: 7,
      damageType: 'Slashing',
      effect: 'Deal 7 Slashing damage.',
      masteryDamageByLevel: {
        1: 7,
        2: 8,
        3: 8,
        4: 8
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_flame_touch',
    card: {
      id: 'elemental_flame_touch',
      name: 'Flame Touch',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 7,
      damageType: 'Fire',
      effect: 'Deal 7 Fire damage.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_8',
          label: 'Damage increases to 8',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 8,
              3: 8,
              4: 8
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 8 or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_wind_slash',
    card: {
      id: 'elemental_wind_slash',
      name: 'Wind Slash',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Wind'],
      damage: 6,
      damageType: 'Slashing',
      effect: 'Deal 6 Slashing damage. Push target 5 ft.',
      pushDistanceByLevel: {
        1: 5,
        2: 10,
        3: 10,
        4: 10
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Push increases to 10 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_iron_rampart',
    card: {
      id: 'machine_iron_rampart',
      name: 'Iron Rampart',
      set: 'Machine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Construct'],
      effect: 'Deploy Rampart Construct (HP 8). Allies within 5 ft gain 2 Shield each turn. Duration: 2 turns.',
      utilityNote: 'Select the allies you want the construct to support. GM handles range feasibility.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetAlliesOnly: true,
      isConstruct: true,
      constructMode: 'utility',
      constructTargetRequired: true,
      constructDurationTurns: 2,
      constructMaxHp: 8,
      constructAuraRadiusFt: 5,
      constructShieldRestoreByLevel: {
        1: 2
      },
      constructShieldRestoreAlliesOnly: true,
      masteryChoiceOptions: [
        {
          id: 'shield_to_3',
          label: 'Shield increases to 3',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            constructShieldRestoreByLevel: {
              2: 3,
              3: 3,
              4: 3
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Shield increases to 3 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_boosted_dash',
    card: {
      id: 'machine_boosted_dash',
      name: 'Boosted Dash',
      set: 'Machine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Move 20 ft.',
      movementByLevel: {
        1: 20,
        2: 25,
        3: 25,
        4: 25
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Movement increases to 25 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_chain_hook',
    card: {
      id: 'machine_chain_hook',
      name: 'Chain Hook',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 6,
      damageType: 'Piercing',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 6 Piercing damage and apply Rooted 1.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 1
        }
      },
      rangeByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 15 ft.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_chain_launcher',
    card: {
      id: 'machine_chain_launcher',
      name: 'Chain Launcher',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 6,
      damageType: 'Piercing',
      effect: 'Deal 6 Piercing damage and pull target 10 ft toward you.',
      pullDistanceByLevel: {
        1: 10
      },
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_flame_injector',
    card: {
      id: 'machine_flame_injector',
      name: 'Flame Injector',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 7,
      damageType: 'Fire',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 7 Fire damage. Apply Burning 2.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 2,
          2: 3,
          3: 3,
          4: 3
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Burning 3.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_reinforced_guard',
    card: {
      id: 'machine_reinforced_guard',
      name: 'Reinforced Guard',
      set: 'Machine',
      type: 'Defense',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Shield'],
      effect: 'Restore 5 Shield.',
      shieldRestoreByLevel: {
        1: 5,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Restore 6 Shield.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_serrated_gear',
    card: {
      id: 'machine_serrated_gear',
      name: 'Serrated Gear',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Slashing'],
      damage: 7,
      damageType: 'Slashing',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 7 Slashing damage. Apply Bleeding 2.',
      masteryDamageByLevel: {
        1: 7,
        2: 8,
        3: 8,
        4: 8
      },
      statusApply: {
        id: 'bleeding',
        stacksByLevel: {
          1: 2
        }
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_shock_ram',
    card: {
      id: 'machine_shock_ram',
      name: 'Shock Ram',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Bludgeoning'],
      damage: 5,
      damageType: 'Bludgeoning',
      secondaryDamage: 4,
      secondaryDamageByLevel: {
        1: 4,
        2: 5,
        3: 5,
        4: 5
      },
      secondaryDamageType: 'Lightning',
      secondaryTargetMode: 'same',
      effect: 'Deal 5 Bludgeoning damage and 4 Lightning damage.',
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Lightning damage increases to 5.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_spark_burst',
    card: {
      id: 'machine_spark_burst',
      name: 'Spark Burst',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 15,
      rangeText: '15 ft cone',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 7,
      damageType: 'Fire',
      effect: 'Deal 7 Fire damage to all targets. Apply Burning 2.',
      utilityNote: 'Manually select enemies inside the 15 ft cone.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 2,
          2: 3,
          3: 3,
          4: 3
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Burning 3.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_suppression_shot',
    card: {
      id: 'machine_suppression_shot',
      name: 'Suppression Shot',
      set: 'Machine',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 6,
      damageType: 'Piercing',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 6 Piercing damage and apply Weakened 1.',
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      statusApply: {
        id: 'weakened',
        stacksByLevel: {
          1: 1
        }
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_earth_spike',
    card: {
      id: 'elemental_earth_spike',
      name: 'Earth Spike',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 25,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      damage: 8,
      effect: 'Deal 8 damage. Apply Rooted 1.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 1,
          2: 2,
          3: 2,
          4: 2
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Rooted increases to 2.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_fortress_stance',
    card: {
      id: 'divine_fortress_stance',
      name: 'Fortress Stance',
      set: 'Divine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 2,
      tags: ['Utility'],
      effect: 'Restore 6 Shield. For the next 2 turns, your Guard action restores +1 Shield.',
      shieldRestoreByLevel: {
        1: 6,
        2: 8,
        3: 8,
        4: 8
      },
      guardActionBonusByLevel: {
        1: 1
      },
      guardActionBonusTurnsByLevel: {
        1: 2
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield restored increases to 8.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_sight_unseen',
    card: {
      id: 'divine_sight_unseen',
      name: 'Sight Unseen',
      set: 'Divine',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 0,
      rangeText: 'Self',
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Utility'],
      effect: 'You can see invisible creatures and illusions. Duration 3 turns.',
      utilityNote: 'At Mastery 2, manually select allies within 10 ft to share the effect.',
      customCardEffect: 'divine_sight_unseen',
      durationTurnsByLevel: {
        1: 3,
        2: 3,
        3: 3,
        4: 3
      },
      allyShareRadiusFtByLevel: {
        1: 0,
        2: 10,
        3: 10,
        4: 10
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 2
        },
        4: {
          wisdom: 2
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Allies within 10 ft gain the effect.',
        'Level 3: WIS +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'beast_savage_strike',
    card: {
      id: 'beast_savage_strike',
      name: 'Savage Strike',
      set: 'Beast',
      type: 'Attack',
      tier: 'Rare',
      apCost: 3,
      range: 5,
      healthBonus: 3,
      shieldBonus: 2,
      tags: ['Slashing'],
      damage: 10,
      damageType: 'Slashing',
      effect: 'Deal 10 Slashing damage. If the target has Shield remaining, deal +4 damage.',
      bonusDamageIfTargetHasShieldByLevel: {
        1: 4
      },
      masteryChoiceOptions: [
        {
          id: 'bonus_damage_to_6',
          label: 'Bonus damage increases to +6',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            bonusDamageIfTargetHasShieldByLevel: {
              2: 6,
              3: 6,
              4: 6
            }
          }
        },
        {
          id: 'strength_plus_2',
          label: 'STR +2',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { strength: 2 },
              3: { strength: 2 },
              4: { strength: 2 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Bonus damage increases to +6 or STR +2.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_earthquake',
    card: {
      id: 'elemental_earthquake',
      name: 'Earthquake',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Rare',
      apCost: 4,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Earth'],
      damage: 10,
      effect: 'Deal 10 damage to enemies within Radius 10 ft. Apply Prone.',
      utilityNote: 'Manually select enemies within the 10 ft radius. Prone is tracked as a removable status note.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 10,
      areaRadiusByLevel: {
        1: 10
      },
      masteryDamageByLevel: {
        1: 10,
        2: 11,
        3: 11,
        4: 11
      },
      statusApply: {
        name: 'Prone',
        notes: 'Removable note from Earthquake.',
        stacksByLevel: {
          1: 1
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 11.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_dagger_flurry',
    card: {
      id: 'shadow_dagger_flurry',
      name: 'Dagger Flurry',
      set: 'Shadow',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 4,
      damageType: 'Piercing',
      targetMode: 'multi_select',
      multiTargetMax: 2,
      effect: 'Deal 4 Piercing damage to up to 2 targets.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_5',
          label: 'Damage increases to 5 each',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 5,
              3: 5,
              4: 5
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 5 each or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_static_chain',
    card: {
      id: 'elemental_static_chain',
      name: 'Static Chain',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 25,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 3,
      damageType: 'Lightning',
      targetMode: 'multi_select',
      multiTargetMin: 2,
      multiTargetMax: 2,
      effect: 'Deal 3 Lightning damage to two targets.',
      masteryDamageByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 4 each.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_fear_me',
    card: {
      id: 'demonic_fear_me',
      name: 'Fear Me',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Psychic'],
      effect:
        'Target becomes Frightened 1 for 2 turns. Creatures may attempt to resist with contested WIS vs WIS.',
      targetMode: 'single',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      targetEntityKinds: ['participant'],
      contestedEffect: {
        hostileOnly: true,
        options: [
          {
            id: 'frightened',
            label: 'Frightened',
            statusId: 'frightened',
            statusName: 'Frightened',
            statusStacksByLevel: {
              1: 1,
              2: 2,
              3: 2,
              4: 2
            },
            durationTurnsByLevel: {
              1: 2,
              2: 2,
              3: 2,
              4: 2
            }
          }
        ]
      },
      abilityBonusesByLevel: {
        3: { charisma: 1 },
        4: { charisma: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Frightened 2.',
        'Level 3: CHA +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_fire_of_retribution',
    card: {
      id: 'demonic_fire_of_retribution',
      name: 'Fire of Retribution',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 4,
      damageType: 'Fire',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 4 Fire damage. If the target damaged you last turn, deal +3 damage.',
      bonusDamageIfTargetDamagedCasterLastTurnByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Bonus damage increases to +4.',
        'Level 3: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 3.'
    }
  },
  {
    id: 'demonic_infernal_brand',
    card: {
      id: 'demonic_infernal_brand',
      name: 'Infernal Brand',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Curse'],
      effect: 'Mark target with Infernal Brand. Your attacks deal +2 damage to that target. Duration 2 turns.',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      customCardEffect: 'demonic_infernal_brand',
      infernalBrandBonusDamageByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      durationTurnsByLevel: {
        1: 2,
        2: 2,
        3: 2,
        4: 2
      },
      abilityBonusesByLevel: {
        3: { charisma: 1 },
        4: { charisma: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Bonus damage increases to +3.',
        'Level 3: CHA +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_summon_imp',
    card: {
      id: 'demonic_summon_imp',
      name: 'Summon Imp',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Construct', 'Fire'],
      targetMode: 'none',
      effect:
        'Summon an Imp construct with Spitfire. It does nothing on the turn it is summoned. On later Imp turns, the GM chooses its Spitfire target.',
      isConstruct: true,
      constructMode: 'utility',
      constructManualTurns: true,
      constructDurationTurns: 2,
      constructDurationTurnsByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      constructAp: 2,
      constructMaxHp: 6,
      constructMaxHpByLevel: {
        1: 6,
        2: 6,
        3: 8,
        4: 8
      },
      constructMoveFt: 10,
      constructCards: ['demonic_spitfire'],
      constructCardMasteryLevel: 1,
      constructTargetPriority: 'lowest_hp_enemy',
      mastery: [
        'Level 1: Summon an Imp with Spitfire (Imp card mastery defaults to 1). The Imp does not act on the turn it is summoned.',
        'Level 2: Duration increases to 3 later turns.',
        'Level 3: Imp HP increases to 8.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_spitfire',
    card: {
      id: 'demonic_spitfire',
      name: 'Spitfire',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 4,
      damageType: 'Fire',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 4 Fire damage.',
      masteryDamageByLevel: {
        1: 4,
        2: 5,
        3: 5,
        4: 5
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 5.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_the_common_cold',
    card: {
      id: 'demonic_the_common_cold',
      name: 'The Common Cold',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 25,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Poison'],
      damage: 4,
      damageType: 'Poison',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 4 Poison damage and apply Poisoned 1.',
      masteryDamageByLevel: {
        1: 4,
        2: 5,
        3: 5,
        4: 5
      },
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 1
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 5.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_beguiling_whisper',
    card: {
      id: 'demonic_beguiling_whisper',
      name: 'Beguiling Whisper',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 25,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Apply Charmed 1. Creatures may attempt to resist with contested WIS vs WIS.',
      targetMode: 'single',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      targetEntityKinds: ['participant'],
      contestedEffect: {
        hostileOnly: true,
        options: [
          {
            id: 'charmed',
            label: 'Charmed',
            statusId: 'charmed',
            statusName: 'Charmed',
            statusStacksByLevel: {
              1: 1,
              2: 1,
              3: 1,
              4: 1
            },
            durationTurnsByLevel: {
              1: 1,
              2: 2,
              3: 2,
              4: 2
            }
          }
        ]
      },
      abilityBonusesByLevel: {
        3: { charisma: 1 },
        4: { charisma: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 2 turns.',
        'Level 3: CHA +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_blood_curse',
    card: {
      id: 'demonic_blood_curse',
      name: 'Blood Curse',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Curse'],
      effect: 'Target loses 3 HP each turn for 2 turns.',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      targetEntityKinds: ['participant'],
      customCardEffect: 'demonic_blood_curse',
      bloodCurseHpLossByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      durationTurnsByLevel: {
        1: 2,
        2: 2,
        3: 2,
        4: 2
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 4 per turn.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_infernal_offering',
    card: {
      id: 'demonic_infernal_offering',
      name: 'Infernal Offering',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 5,
      rangeText: '5 ft',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Lose 5 HP to restore 1 HP to an ally.',
      targetAlliesOnly: true,
      selfHpLossByLevel: {
        1: 5,
        2: 5,
        3: 5,
        4: 5
      },
      healByLevel: {
        1: 1,
        2: 1,
        3: 1,
        4: 1
      },
      removeStatusCountByLevel: {
        2: 99,
        3: 99,
        4: 99
      },
      removeStatusSelectionOptional: true,
      selfHpLossPerRemovedStatusByLevel: {
        2: 5,
        3: 5,
        4: 5
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: You may also remove status effects from the ally. Lose 5 additional HP per status removed.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_infernal_pact',
    card: {
      id: 'demonic_infernal_pact',
      name: 'Infernal Pact',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Lose 12 HP to gain +3 AP this turn.',
      selfHpLossByLevel: {
        1: 12,
        2: 12,
        3: 12,
        4: 12
      },
      apGainByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Gain +4 AP instead.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_curse_of_weakness',
    card: {
      id: 'demonic_curse_of_weakness',
      name: 'Curse of Weakness',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Curse'],
      effect: 'Apply Weakened 1.',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      targetEntityKinds: ['participant'],
      statusApply: {
        id: 'weakened',
        stacksByLevel: {
          1: 1,
          2: 2,
          3: 2,
          4: 2
        }
      },
      abilityBonusesByLevel: {
        3: { charisma: 1 },
        4: { charisma: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Weakened 2 instead of Weakened 1.',
        'Level 3: CHA +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_soul_rend',
    card: {
      id: 'demonic_soul_rend',
      name: 'Soul Rend',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 10,
      rangeText: '10 ft',
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Necrotic'],
      damage: 8,
      damageType: 'Necrotic',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 8 Necrotic damage. If the target is afflicted with Frightened, deal +4 damage.',
      bonusDamageIfTargetHasStatusId: 'frightened',
      bonusDamageIfTargetHasStatusByLevel: {
        1: 4,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Bonus damage increases to +6.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_gaze_into_the_abyss',
    card: {
      id: 'demonic_gaze_into_the_abyss',
      name: 'Gaze into the Abyss',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 10,
      rangeText: 'Radius 10 ft',
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Necrotic'],
      damage: 5,
      damageType: 'Necrotic',
      effect: 'Deal 5 Necrotic damage to enemies within Radius 10 ft. Blinded enemies are immune to this effect.',
      utilityNote: 'Manually select enemies within the 10 ft radius. Blinded enemies are unaffected.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      customCardEffect: 'demonic_gaze_into_the_abyss',
      masteryDamageByLevel: {
        1: 5,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 6.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_rabies',
    card: {
      id: 'demonic_rabies',
      name: 'Rabies',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Rare',
      apCost: 2,
      range: 5,
      rangeText: '5 ft',
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Poison'],
      damage: 6,
      damageType: 'Poison',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 6 Poison damage and apply Poisoned 2.',
      masteryDamageByLevel: {
        1: 6,
        2: 8,
        3: 8,
        4: 8
      },
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 2,
          2: 2,
          3: 2,
          4: 2
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_ray_of_enfeeblement',
    card: {
      id: 'demonic_ray_of_enfeeblement',
      name: 'Ray of Enfeeblement',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Very Rare',
      apCost: 5,
      range: 20,
      rangeText: '20 ft ray',
      rangeByLevel: {
        1: 20,
        2: 25,
        3: 25,
        4: 25
      },
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Curse'],
      effect: 'Shoot out a 20 ft ray of entropy. Creatures in the path are afflicted with Weakened 1.',
      utilityNote: 'Manually select creatures in the ray. At Mastery 3+, you may sacrifice 10 HP to apply Weakened 2 instead.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      allowSelfTarget: false,
      targetEntityKinds: ['participant'],
      customCardEffect: 'demonic_ray_of_enfeeblement',
      statusApply: {
        id: 'weakened',
        stacksByLevel: {
          1: 1,
          2: 1,
          3: 1,
          4: 1
        }
      },
      abilityBonusesByLevel: {
        3: { charisma: 1 },
        4: { charisma: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 25 ft.',
        'Level 3: You may sacrifice 10 HP to inflict Weakened 2 instead of Weakened 1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_abyssal_rift',
    card: {
      id: 'demonic_abyssal_rift',
      name: 'Abyssal Rift',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Void'],
      effect: 'Create Abyss Zone (Radius 10 ft). Enemies inside take 6 Necrotic damage each turn. Duration: 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      damage: 6,
      damageType: 'Necrotic',
      zoneRadiusByLevel: {
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Radius increases to 15 ft.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_crown_of_madness',
    card: {
      id: 'demonic_crown_of_madness',
      name: 'Crown of Madness',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Psychic'],
      effect:
        'Target must attack the nearest creature on their next turn. Creatures may attempt to resist with contested WIS vs WIS.',
      utilityNote: 'Track the compelled nearest-creature attack manually while the effect is active.',
      targetMode: 'single',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      targetEntityKinds: ['participant'],
      contestedEffect: {
        hostileOnly: true,
        options: [
          {
            id: 'crown_of_madness',
            label: 'Crown of Madness',
            statusId: 'crown_of_madness',
            statusName: 'Crown of Madness',
            statusNotes: 'Must attack the nearest creature on its turn. GM resolves targeting.',
            statusStacksByLevel: {
              1: 1,
              2: 1,
              3: 1,
              4: 1
            },
            durationTurnsByLevel: {
              1: 1,
              2: 2,
              3: 2,
              4: 2
            }
          }
        ]
      },
      abilityBonusesByLevel: {
        3: { charisma: 2 },
        4: { charisma: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration increases to 2 turns.',
        'Level 3: CHA +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_dengue_fever',
    card: {
      id: 'demonic_dengue_fever',
      name: 'Dengue Fever',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Rare',
      apCost: 2,
      range: 25,
      healthBonus: 3,
      shieldBonus: 1,
      tags: ['Poison'],
      damage: 8,
      damageType: 'Poison',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 8 Poison damage and apply Poisoned 2.',
      masteryDamageByLevel: {
        1: 8,
        2: 10,
        3: 10,
        4: 10
      },
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 2,
          2: 2,
          3: 2,
          4: 2
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 10.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_from_beyond_the_grave',
    card: {
      id: 'demonic_from_beyond_the_grave',
      name: 'From Beyond the Grave',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Rare',
      apCost: 4,
      range: 25,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Psychic'],
      damage: 7,
      damageType: 'Psychic',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 7 Psychic damage and apply Frightened 1.',
      masteryDamageByLevel: {
        1: 7,
        2: 9,
        3: 9,
        4: 9
      },
      statusApply: {
        id: 'frightened',
        stacksByLevel: {
          1: 1,
          2: 1,
          3: 1,
          4: 1
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 9 Psychic.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_hunger_of_the_void',
    card: {
      id: 'demonic_hunger_of_the_void',
      name: 'Hunger of the Void',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Void'],
      effect: 'Create Void Zone (Radius 10 ft). Enemies inside take 5 Necrotic damage each turn. Duration: 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      damage: 5,
      damageType: 'Necrotic',
      masteryDamageByLevel: {
        1: 5,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 6.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_summon_hellhound',
    card: {
      id: 'demonic_summon_hellhound',
      name: 'Summon Hellhound',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 10,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Construct'],
      effect:
        'Summon Hellhound with 4 AP and 14 HP that lasts for 2 turns. It has the Flame Bite card. It takes its turn directly after yours and attacks the nearest enemy.',
      utilityNote: 'The Hellhound acts on its own construct turn. Nearest-enemy targeting remains manual until battlefield positions are tracked.',
      isConstruct: true,
      constructMode: 'utility',
      constructManualTurns: true,
      constructDurationTurns: 2,
      constructAp: 4,
      constructMaxHp: 14,
      constructMaxHpByLevel: {
        1: 14,
        2: 20,
        3: 20,
        4: 20
      },
      constructMoveFt: 10,
      constructCards: ['demonic_flame_bite'],
      constructCardMasteryLevel: 1,
      abilityBonusesByLevel: {
        3: { charisma: 2 },
        4: { charisma: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Hellhound HP increases to 20.',
        'Level 3: CHA +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_summon_void_demon',
    card: {
      id: 'demonic_summon_void_demon',
      name: 'Summon Void Demon',
      set: 'Demonic',
      type: 'Utility',
      tier: 'Rare',
      apCost: 5,
      range: 10,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Construct'],
      effect:
        'Summon Void Demon with 5 AP and 18 HP that lasts 2 turns. It has the Void Slash card. It acts after your turn and attacks the enemy closest to death.',
      utilityNote: 'The Void Demon acts on its own construct turn. Lowest-HP enemy targeting is the intended default.',
      isConstruct: true,
      constructMode: 'utility',
      constructManualTurns: true,
      constructDurationTurns: 2,
      constructAp: 5,
      constructMaxHp: 18,
      constructMaxHpByLevel: {
        1: 18,
        2: 24,
        3: 24,
        4: 24
      },
      constructMoveFt: 10,
      constructCards: ['demonic_void_slash'],
      constructCardMasteryLevel: 1,
      abilityBonusesByLevel: {
        3: { charisma: 2 },
        4: { charisma: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Void Demon HP increases to 24.',
        'Level 3: CHA +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_toiling_flames',
    card: {
      id: 'demonic_toiling_flames',
      name: 'Toiling Flames',
      set: 'Demonic',
      type: 'Defense',
      tier: 'Rare',
      apCost: 4,
      range: 0,
      rangeText: 'Self',
      healthBonus: 2,
      shieldBonus: 3,
      tags: ['Necrotic'],
      effect: 'Dark flames surround you. Melee attackers take 5 Necrotic damage while this is active. Duration: 2 turns.',
      customCardEffect: 'demonic_toiling_flames',
      durationTurnsByLevel: {
        1: 2,
        2: 2,
        3: 2,
        4: 2
      },
      retaliationDamageByLevel: {
        1: 5,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_ebola',
    card: {
      id: 'demonic_ebola',
      name: 'Ebola',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Very Rare',
      apCost: 3,
      range: 25,
      healthBonus: 4,
      shieldBonus: 1,
      tags: ['Poison'],
      damage: 10,
      damageType: 'Poison',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 10 Poison damage and apply Poisoned 3.',
      masteryDamageByLevel: {
        1: 10,
        2: 13,
        3: 13,
        4: 13
      },
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 3,
          2: 3,
          3: 3,
          4: 3
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 13.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_anthrax',
    card: {
      id: 'demonic_anthrax',
      name: 'Anthrax',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Rare',
      apCost: 4,
      range: 25,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Poison'],
      damage: 10,
      damageType: 'Poison',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 10 Poison damage and apply Poisoned 5.',
      masteryDamageByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 5,
          2: 5,
          3: 5,
          4: 5
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 15.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_flame_bite',
    card: {
      id: 'demonic_flame_bite',
      name: 'Flame Bite',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Rare',
      apCost: 2,
      range: 5,
      rangeText: 'Melee (5 ft)',
      healthBonus: 2,
      shieldBonus: 0,
      tags: ['Attack', 'Fire'],
      damage: 5,
      damageType: 'Fire',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 5 Fire damage and apply 1 Burning.',
      masteryDamageByLevel: {
        1: 5,
        2: 7,
        3: 7,
        4: 7
      },
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 1,
          2: 1,
          3: 1,
          4: 1
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'demonic_void_slash',
    card: {
      id: 'demonic_void_slash',
      name: 'Void Slash',
      set: 'Demonic',
      type: 'Attack',
      tier: 'Rare',
      apCost: 2,
      range: 5,
      rangeText: 'Melee (5 ft)',
      healthBonus: 2,
      shieldBonus: 0,
      tags: ['Attack', 'Void'],
      damage: 6,
      damageType: 'Necrotic',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 6 Necrotic damage to a target. If the target is below 50% HP, deal +2 additional damage.',
      masteryDamageByLevel: {
        1: 6,
        2: 8,
        3: 8,
        4: 8
      },
      bonusDamageIfTargetBelowHalfHpByLevel: {
        1: 2,
        2: 2,
        3: 2,
        4: 2
      },
      abilityBonusesByLevel: {
        3: { charisma: 2 },
        4: { charisma: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: CHA +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_poison_dart',
    card: {
      id: 'nature_poison_dart',
      name: 'Poison Dart',
      set: 'Nature',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Poison'],
      damage: 5,
      damageType: 'Poison',
      effect: 'Deal 5 Poison damage. Apply Poisoned 2.',
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'poisoned_to_3',
          label: 'Poisoned increases to 3',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 3,
              3: 3,
              4: 3
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Poisoned increases to 3 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_dust_cloud',
    card: {
      id: 'shadow_dust_cloud',
      name: 'Dust Cloud',
      set: 'Shadow',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Create Obscuring Cloud (Radius 10 ft). Creatures inside gain Blinded 1. Duration: 2 turns.',
      utilityNote: 'Manually select creatures inside the cloud to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      statusApply: {
        id: 'blinded',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'radius_to_15',
          label: 'Radius increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            zoneRadiusByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Radius increases to 15 ft or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_backstab',
    card: {
      id: 'shadow_backstab',
      name: 'Backstab',
      set: 'Shadow',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 8,
      damageType: 'Piercing',
      effect: 'Deal 8 Piercing damage. If the target has not acted yet this round, deal +4 damage.',
      bonusDamageIfTargetNotActedByLevel: {
        1: 4
      },
      masteryChoiceOptions: [
        {
          id: 'bonus_damage_to_6',
          label: 'Bonus damage increases to +6',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            bonusDamageIfTargetNotActedByLevel: {
              2: 6,
              3: 6,
              4: 6
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Bonus damage increases to +6 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_venom_cloud',
    card: {
      id: 'nature_venom_cloud',
      name: 'Venom Cloud',
      set: 'Nature',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Poison'],
      effect: 'Create Poison Zone (Radius 10 ft). Enemies inside gain Poisoned 2 each turn. Duration: 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'poisoned_to_3',
          label: 'Poisoned increases to 3',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 3,
              3: 3,
              4: 3
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Poisoned increases to 3 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_storm_charge',
    card: {
      id: 'elemental_storm_charge',
      name: 'Storm Charge',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 0,
      rangeText: 'Self',
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Lightning'],
      effect: 'Gain +2 AP on your next turn.',
      selfApNextTurnByLevel: {
        1: 2
      },
      apGainByLevel: {
        2: 1,
        3: 1,
        4: 1
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Gain +1 AP this turn as well.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_assassinate',
    card: {
      id: 'shadow_assassinate',
      name: 'Assassinate',
      set: 'Shadow',
      type: 'Attack',
      tier: 'Rare',
      apCost: 4,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Piercing'],
      damage: 14,
      damageType: 'Piercing',
      effect: 'Deal 14 Piercing damage. If the target is below half HP, deal +6 damage.',
      bonusDamageIfTargetBelowHalfHpByLevel: {
        1: 6
      },
      masteryChoiceOptions: [
        {
          id: 'bonus_damage_to_8',
          label: 'Bonus damage increases to +8',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            bonusDamageIfTargetBelowHalfHpByLevel: {
              2: 8,
              3: 8,
              4: 8
            }
          }
        },
        {
          id: 'dexterity_plus_2',
          label: 'DEX +2',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 2 },
              3: { dexterity: 2 },
              4: { dexterity: 2 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Bonus damage increases to +8 or DEX +2.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_smoke_veil',
    card: {
      id: 'shadow_smoke_veil',
      name: 'Smoke Veil',
      set: 'Shadow',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 4,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'You cannot be targeted by ranged attacks until your next turn. You may still be hit by indirect area damage.',
      rangedUntargetableTurnsByLevel: {
        1: 1
      },
      masteryChoiceOptions: [
        {
          id: 'movement_10',
          label: 'Gain 10 ft free movement',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            movementByLevel: {
              2: 10,
              3: 10,
              4: 10
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Gain 10 ft free movement or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_acid_spit',
    card: {
      id: 'elemental_acid_spit',
      name: 'Acid Spit',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 25,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Acid'],
      damage: 5,
      damageType: 'Acid',
      effect: 'Deal 5 Acid damage. Apply Poisoned 1.',
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 1,
          2: 2,
          3: 2,
          4: 2
        }
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
        'Level 2: Poisoned increases to 2.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_dust_cloud',
    card: {
      id: 'elemental_dust_cloud',
      name: 'Dust Cloud',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      effect: 'Apply Blinded 1 to enemies within 5 ft radius.',
      utilityNote: 'Manually select enemies inside the cloud radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 5,
      areaRadiusByLevel: {
        1: 5,
        2: 10,
        3: 10,
        4: 10
      },
      statusApply: {
        id: 'blinded',
        stacksByLevel: {
          1: 1
        }
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
        'Level 2: Radius increases to 10 ft.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_flame_burst',
    card: {
      id: 'elemental_flame_burst',
      name: 'Flame Burst',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 3,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 6,
      damageType: 'Fire',
      effect: 'Deal 6 Fire damage to enemies within 10 ft.',
      utilityNote: 'Manually select enemies inside the burst radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 10,
      areaRadiusByLevel: {
        1: 10
      },
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: {
          intelligence: 1
        },
        4: {
          intelligence: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_fire_bolt',
    card: {
      id: 'elemental_fire_bolt',
      name: 'Fire Bolt',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 6,
      damageType: 'Fire',
      effect: 'Deal 6 Fire damage. Apply Burning 1.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'burning_to_2',
          label: 'Burning increases to 2',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Burning increases to 2 or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_ice_patch',
    card: {
      id: 'elemental_ice_patch',
      name: 'Ice Patch',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Cold'],
      effect: 'Create difficult terrain zone in 5 ft radius for 5 turns.',
      utilityNote: 'Area is difficult terrain. Manual positioning and movement enforcement still apply.',
      isZone: true,
      zoneTickOnTurn: false,
      zoneRadius: 5,
      zoneRadiusByLevel: {
        1: 5,
        2: 10,
        3: 10,
        4: 10
      },
      zoneDurationTurns: 5,
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
        'Level 2: Radius increases to 10 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_ice_shard',
    card: {
      id: 'elemental_ice_shard',
      name: 'Ice Shard',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Cold'],
      damage: 6,
      damageType: 'Cold',
      effect: 'Deal 6 Cold damage. Apply Rooted 1.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'damage_to_7',
          label: 'Damage increases to 7',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 7,
              3: 7,
              4: 7
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 7 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_lightning_spark',
    card: {
      id: 'elemental_lightning_spark',
      name: 'Lightning Spark',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 6,
      damageType: 'Lightning',
      effect: 'Deal 6 Lightning damage.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_7',
          label: 'Damage increases to 7',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 7,
              3: 7,
              4: 7
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 7 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_jolt',
    card: {
      id: 'elemental_jolt',
      name: 'Jolt',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 1,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 3,
      damageType: 'Lightning',
      effect: 'Deal 3 Lightning damage.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_4',
          label: 'Damage increases to 4',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 4,
              3: 4,
              4: 4
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 4 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_flame_wave',
    card: {
      id: 'elemental_flame_wave',
      name: 'Flame Wave',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 8,
      damageType: 'Fire',
      effect: 'Deal 8 Fire damage. Apply Burning 2.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 2,
          2: 3,
          3: 3,
          4: 3
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Burning increases to 3.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_chain_lightning',
    card: {
      id: 'elemental_chain_lightning',
      name: 'Chain Lightning',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 6,
      damageType: 'Lightning',
      targetMode: 'multi_select',
      multiTargetMax: 3,
      effect: 'Deal 6 Lightning damage to up to 3 targets.',
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7 each.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_acid_pool',
    card: {
      id: 'elemental_acid_pool',
      name: 'Acid Pool',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Acid'],
      damage: 4,
      damageType: 'Acid',
      effect: 'Create an Acid Zone (Radius 10 ft). Enemies inside take 4 Acid damage each turn for 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      masteryDamageByLevel: {
        1: 4,
        2: 5,
        3: 5,
        4: 5
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 5.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_blinding_display',
    card: {
      id: 'elemental_blinding_display',
      name: 'Blinding Display',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      effect: 'Create Flash Burst (Radius 10 ft). Enemies become Blinded 1.',
      utilityNote: 'Manually select enemies inside the flash burst radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 10,
      areaRadiusByLevel: {
        1: 10
      },
      statusApply: {
        id: 'blinded',
        stacksByLevel: {
          1: 1
        },
        durationTurnsByLevel: {
          1: 1,
          2: 2,
          3: 2,
          4: 2
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Duration 2 turns.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_fire_ring',
    card: {
      id: 'elemental_fire_ring',
      name: 'Fire Ring',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 4,
      damageType: 'Fire',
      effect: 'Create a Fire Zone (Radius 10 ft). Enemies inside take 4 Fire damage per turn for 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      masteryDamageByLevel: {
        1: 4,
        2: 5,
        3: 5,
        4: 5
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 5.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_ice_armour',
    card: {
      id: 'elemental_ice_armour',
      name: 'Ice Armour',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 2,
      tags: ['Cold'],
      effect: 'Restore 4 Shield.',
      shieldRestoreByLevel: {
        1: 4,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield restored increases to 6.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_stone_wall',
    card: {
      id: 'elemental_stone_wall',
      name: 'Stone Wall',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      effect: 'Create a 10 ft long earthen wall with 30 HP. 2 characters may hide behind the stone wall and benefit from full cover.',
      isConstruct: true,
      constructMode: 'utility',
      constructAllowUntargetedDeploy: true,
      constructAp: 0,
      constructMaxHp: 30,
      constructMaxHpByLevel: {
        1: 30,
        2: 40,
        3: 40,
        4: 40
      },
      constructDurationTurns: 0,
      constructUtilityNote: '10 ft earthen wall. Up to 2 characters may hide behind it and benefit from full cover. Persists until removed or destroyed.',
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Wall HP increases to 40.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_thunderclap',
    card: {
      id: 'elemental_thunderclap',
      name: 'Thunderclap',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 7,
      damageType: 'Lightning',
      effect: 'Deal 7 Lightning damage to enemies within 10 ft radius.',
      utilityNote: 'Manually select enemies within the 10 ft radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 10,
      areaRadiusByLevel: {
        1: 10
      },
      masteryDamageByLevel: {
        1: 7,
        2: 8,
        3: 8,
        4: 8
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_wind_gust',
    card: {
      id: 'elemental_wind_gust',
      name: 'Wind Gust',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Wind'],
      effect: 'Push target 15 ft.',
      pushDistanceByLevel: {
        1: 15,
        2: 20,
        3: 20,
        4: 20
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Push increases to 20 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_blizzard',
    card: {
      id: 'elemental_blizzard',
      name: 'Blizzard',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Rare',
      apCost: 4,
      range: 30,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Cold'],
      damage: 8,
      damageType: 'Cold',
      effect: 'Deal 8 Cold damage to enemies within Radius 15 ft. Apply Rooted 1.',
      utilityNote: 'Manually select enemies within the 15 ft radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 15,
      areaRadiusByLevel: {
        1: 15
      },
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 1,
          2: 2,
          3: 2,
          4: 2
        }
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Rooted increases to 2.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_ice_lance',
    card: {
      id: 'elemental_ice_lance',
      name: 'Ice Lance',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Cold'],
      damage: 7,
      damageType: 'Cold',
      effect: 'Deal 7 Cold damage. Apply Rooted 2.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 2
        }
      },
      masteryDamageByLevel: {
        1: 7,
        2: 8,
        3: 8,
        4: 8
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_acid_rain',
    card: {
      id: 'elemental_acid_rain',
      name: 'Acid Rain',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 30,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Acid'],
      damage: 6,
      damageType: 'Acid',
      effect: 'Create Acid Zone (Radius 15 ft). Enemies inside take 6 Acid damage each turn for 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 15,
      zoneDurationTurns: 2,
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_stoneguard',
    card: {
      id: 'elemental_stoneguard',
      name: 'Stoneguard',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 0,
      rangeText: 'Self',
      healthBonus: 2,
      shieldBonus: 3,
      tags: ['Earth'],
      effect: 'Restore 8 Shield to yourself.',
      shieldRestoreByLevel: {
        1: 8,
        2: 10,
        3: 10,
        4: 10
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield restored increases to 10.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_cyclone',
    card: {
      id: 'elemental_cyclone',
      name: 'Cyclone',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Wind'],
      effect: 'Pull enemies within Radius 10 ft toward the center.',
      utilityNote: 'Manually select enemies within the radius. Pull distance and final positioning are GM-enforced.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadiusByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      pullDistanceByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Radius increases to 15 ft.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_ice_cage',
    card: {
      id: 'elemental_ice_cage',
      name: 'Ice Cage',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Cold'],
      effect: 'Apply Restrained.',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      statusApply: {
        id: 'restrained',
        stacksByLevel: {
          1: 1
        }
      },
      iceCageRootedStacksByLevel: {
        1: 0,
        2: 2,
        3: 2,
        4: 2
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Rooted 2 as well.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_inferno',
    card: {
      id: 'elemental_inferno',
      name: 'Inferno',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Rare',
      apCost: 4,
      range: 25,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Fire'],
      damage: 12,
      damageType: 'Fire',
      effect: 'Deal 12 Fire damage. Apply Burning 3.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 3,
          2: 4,
          3: 4,
          4: 4
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Burning increases to 4.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_lava_field',
    card: {
      id: 'elemental_lava_field',
      name: 'Lava Field',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Rare',
      apCost: 4,
      range: 25,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Fire'],
      damage: 6,
      damageType: 'Fire',
      effect: 'Create Fire Zone (Radius 15 ft). Enemies inside take 6 Fire damage each turn for 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 15,
      zoneDurationTurns: 2,
      masteryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 7.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_thunderstorm',
    card: {
      id: 'elemental_thunderstorm',
      name: 'Thunderstorm',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Rare',
      apCost: 4,
      range: 30,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Lightning'],
      damage: 9,
      damageType: 'Lightning',
      effect: 'Deal 9 Lightning damage to enemies within Radius 15 ft.',
      utilityNote: 'Manually select enemies within the 15 ft radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 15,
      areaRadiusByLevel: {
        1: 15
      },
      masteryDamageByLevel: {
        1: 9,
        2: 10,
        3: 10,
        4: 10
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 10.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_cold_snap',
    card: {
      id: 'elemental_cold_snap',
      name: 'Cold Snap',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Very Rare',
      apCost: 4,
      range: 30,
      healthBonus: 3,
      shieldBonus: 3,
      tags: ['Cold'],
      damage: 10,
      damageType: 'Cold',
      effect: 'Deal 10 Cold damage. Apply Fatigued 1.',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      statusApply: {
        id: 'fatigued',
        stacksByLevel: {
          1: 1
        }
      },
      masteryDamageByLevel: {
        1: 10,
        2: 12,
        3: 12,
        4: 12
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 12.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_lightning_strike',
    card: {
      id: 'elemental_lightning_strike',
      name: 'Lightning Strike',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Very Rare',
      apCost: 4,
      range: 0,
      rangeText: 'Self',
      healthBonus: 3,
      shieldBonus: 3,
      tags: ['Lightning'],
      damage: 12,
      damageType: 'Lightning',
      effect: 'Deal 12 Lightning damage to enemies within Radius 15 ft.',
      utilityNote: 'Manually select enemies within the 15 ft radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 15,
      areaRadiusByLevel: {
        1: 15
      },
      masteryDamageByLevel: {
        1: 12,
        2: 14,
        3: 14,
        4: 14
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 14.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_stone_bulwark',
    card: {
      id: 'elemental_stone_bulwark',
      name: 'Stone Bulwark',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Very Rare',
      apCost: 4,
      range: 0,
      rangeText: 'Self',
      healthBonus: 3,
      shieldBonus: 4,
      tags: ['Earth'],
      effect: 'Restore 12 Shield.',
      shieldRestoreByLevel: {
        1: 12,
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield restored increases to 15.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_tempest',
    card: {
      id: 'elemental_tempest',
      name: 'Tempest',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Very Rare',
      apCost: 3,
      range: 0,
      rangeText: 'Self',
      healthBonus: 3,
      shieldBonus: 3,
      tags: ['Wind'],
      effect: 'Push enemies within Radius 15 ft away 15 ft.',
      utilityNote: 'Manually select enemies within the radius. Push distance and final positioning are GM-enforced.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 15,
      areaRadiusByLevel: {
        1: 15
      },
      pushDistanceByLevel: {
        1: 15,
        2: 20,
        3: 20,
        4: 20
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Push increases to 20 ft.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_toxic_mist',
    card: {
      id: 'elemental_toxic_mist',
      name: 'Toxic Mist',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Very Rare',
      apCost: 3,
      range: 25,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Acid'],
      effect: 'Create Poison Zone (Radius 10 ft). Apply Poisoned 2 to enemies inside, each turn, for 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 2,
          2: 3,
          3: 3,
          4: 3
        }
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Poison increases to 3.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_volcanic_eruption',
    card: {
      id: 'elemental_volcanic_eruption',
      name: 'Volcanic Eruption',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Very Rare',
      apCost: 5,
      range: 30,
      healthBonus: 3,
      shieldBonus: 3,
      tags: ['Fire'],
      damage: 16,
      damageType: 'Fire',
      effect: 'Deal 16 Fire damage. Apply Burning 4.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 4,
          2: 5,
          3: 5,
          4: 5
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Burning increases to 5.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_flame_lance',
    card: {
      id: 'elemental_flame_lance',
      name: 'Flame Lance',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Epic',
      apCost: 5,
      range: 30,
      healthBonus: 4,
      shieldBonus: 4,
      tags: ['Fire'],
      damage: 20,
      damageType: 'Fire',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 20 Fire damage. Apply Burning 5.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 5,
          2: 6,
          3: 6,
          4: 6
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Burning increases to 6.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_solar_flare',
    card: {
      id: 'elemental_solar_flare',
      name: 'Solar Flare',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Legendary',
      apCost: 6,
      range: 35,
      healthBonus: 5,
      shieldBonus: 5,
      tags: ['Fire'],
      damage: 24,
      damageType: 'Fire',
      secondaryDamage: 12,
      secondaryDamageByLevel: {
        1: 12,
        2: 14,
        3: 14,
        4: 14
      },
      effect: 'Deal 24 Fire damage to target. Enemies within Radius 10 ft take 12 Fire damage.',
      utilityNote: 'Manually select the main target and any enemies within 10 ft. Mark exactly one selected enemy as the primary strike target.',
      customCardEffect: 'nature_lightning_strike',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 10,
      areaRadiusByLevel: {
        1: 10
      },
      perTargetInputs: [
        {
          id: 'primary',
          label: 'Primary target',
          type: 'checkbox',
          defaultChecked: false
        }
      ],
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Radius damage increases to 14.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_wind_wall',
    card: {
      id: 'nature_wind_wall',
      name: 'Wind Wall',
      set: 'Nature',
      type: 'Defense',
      tier: 'Rare',
      apCost: 4,
      range: 15,
      healthBonus: 2,
      shieldBonus: 3,
      tags: ['Construct'],
      effect: 'Create Wind Barrier (HP 20) that blocks ranged attacks. Duration 2 turns.',
      isConstruct: true,
      constructMode: 'utility',
      constructAllowUntargetedDeploy: true,
      targetMode: 'none',
      constructAp: 0,
      constructMaxHp: 20,
      constructMaxHpByLevel: {
        1: 20,
        2: 30,
        3: 30,
        4: 30
      },
      constructDurationTurns: 2,
      constructUtilityNote: 'Wind Barrier blocks ranged attacks. Duration 2 turns.',
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: HP increases to 30.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_anchoring_harpoon',
    card: {
      id: 'machine_anchoring_harpoon',
      name: 'Anchoring Harpoon',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      apCost: 2,
      range: 25,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Piercing'],
      damage: 7,
      damageType: 'Piercing',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 7 Piercing damage. Apply Rooted 1.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 1
        }
      },
      rangeByLevel: {
        1: 25,
        2: 30,
        3: 30,
        4: 30
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 30 ft.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_hydraulic_slam',
    card: {
      id: 'machine_hydraulic_slam',
      name: 'Hydraulic Slam',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      apCost: 2,
      range: 5,
      healthBonus: 3,
      shieldBonus: 2,
      tags: ['Bludgeoning'],
      damage: 9,
      damageType: 'Bludgeoning',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 9 Bludgeoning damage and push target 10 ft.',
      masteryDamageByLevel: {
        1: 9,
        2: 10,
        3: 10,
        4: 10
      },
      pushDistanceByLevel: {
        1: 10
      },
      abilityBonusesByLevel: {
        3: { strength: 2 },
        4: { strength: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 10.',
        'Level 3: STR +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_industrial_crusher',
    card: {
      id: 'machine_industrial_crusher',
      name: 'Industrial Crusher',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      apCost: 3,
      range: 5,
      healthBonus: 3,
      shieldBonus: 2,
      tags: ['Bludgeoning'],
      damage: 12,
      damageType: 'Bludgeoning',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 12 Bludgeoning damage. Apply Weakened 1.',
      masteryDamageByLevel: {
        1: 12,
        2: 13,
        3: 13,
        4: 13
      },
      statusApply: {
        id: 'weakened',
        stacksByLevel: {
          1: 1
        }
      },
      abilityBonusesByLevel: {
        3: { strength: 2 },
        4: { strength: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 13.',
        'Level 3: STR +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_oil_bomb',
    card: {
      id: 'machine_oil_bomb',
      name: 'Oil Bomb',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      apCost: 3,
      range: 20,
      healthBonus: 2,
      shieldBonus: 2,
      tags: ['Fire'],
      damage: 7,
      damageType: 'Fire',
      effect: 'Deal 7 Fire damage to enemies within Radius 5 ft. Apply Burning 2.',
      utilityNote: 'Manually select enemies within the 5 ft radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      areaRadius: 5,
      areaRadiusByLevel: {
        1: 5
      },
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 2,
          2: 3,
          3: 3,
          4: 3
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Apply Burning 3.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_overclock_strike',
    card: {
      id: 'machine_overclock_strike',
      name: 'Overclock Strike',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      apCost: 2,
      range: 5,
      healthBonus: 3,
      shieldBonus: 2,
      tags: ['Slashing'],
      damage: 8,
      damageType: 'Slashing',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 8 Slashing damage. Restore 2 Shield.',
      selfShieldRestoreByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Restore 3 Shield.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_whirling_gear',
    card: {
      id: 'machine_whirling_gear',
      name: 'Whirling Gear',
      set: 'Machine',
      type: 'Attack',
      tier: 'Rare',
      apCost: 3,
      range: 5,
      healthBonus: 3,
      shieldBonus: 2,
      tags: ['Slashing'],
      damage: 9,
      damageType: 'Slashing',
      secondaryDamage: 6,
      secondaryDamageByLevel: {
        1: 6,
        2: 7,
        3: 7,
        4: 7
      },
      secondaryDamageType: 'Slashing',
      secondaryTargetMode: 'adjacent',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 9 Slashing damage to target and 6 Slashing damage to an adjacent enemy.',
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Secondary damage increases to 7.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_iron_maelstrom',
    card: {
      id: 'machine_iron_maelstrom',
      name: 'Iron Maelstrom',
      set: 'Machine',
      type: 'Attack',
      tier: 'Very Rare',
      apCost: 3,
      range: 5,
      rangeText: 'Adjacent',
      healthBonus: 4,
      shieldBonus: 2,
      tags: ['Slashing'],
      damage: 10,
      damageType: 'Slashing',
      effect: 'Deal 10 Slashing damage to all adjacent enemies.',
      utilityNote: 'Manually select adjacent enemies.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      masteryDamageByLevel: {
        1: 10,
        2: 11,
        3: 11,
        4: 11
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 11.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_magnetic_prison',
    card: {
      id: 'machine_magnetic_prison',
      name: 'Magnetic Prison',
      set: 'Machine',
      type: 'Utility',
      tier: 'Very Rare',
      apCost: 3,
      range: 10,
      healthBonus: 3,
      shieldBonus: 2,
      tags: ['Utility'],
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Apply Restrained.',
      statusApply: {
        id: 'restrained',
        stacksByLevel: {
          1: 1
        }
      },
      rangeByLevel: {
        1: 10,
        2: 15,
        3: 15,
        4: 15
      },
      abilityBonusesByLevel: {
        3: { wisdom: 2 },
        4: { wisdom: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 15 ft.',
        'Level 3: WIS +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_pressure_drill',
    card: {
      id: 'machine_pressure_drill',
      name: 'Pressure Drill',
      set: 'Machine',
      type: 'Attack',
      tier: 'Very Rare',
      apCost: 2,
      range: 5,
      healthBonus: 4,
      shieldBonus: 2,
      tags: ['Piercing'],
      damage: 9,
      damageType: 'Piercing',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 9 Piercing damage. Apply Bleeding 3.',
      masteryDamageByLevel: {
        1: 9,
        2: 10,
        3: 10,
        4: 10
      },
      statusApply: {
        id: 'bleeding',
        stacksByLevel: {
          1: 3
        }
      },
      abilityBonusesByLevel: {
        3: { dexterity: 2 },
        4: { dexterity: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 10.',
        'Level 3: DEX +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_reinforced_bulwark',
    card: {
      id: 'machine_reinforced_bulwark',
      name: 'Reinforced Bulwark',
      set: 'Machine',
      type: 'Defense',
      tier: 'Very Rare',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 3,
      shieldBonus: 3,
      tags: ['Shield'],
      effect: 'Restore 7 Shield.',
      shieldRestoreByLevel: {
        1: 7,
        2: 8,
        3: 8,
        4: 8
      },
      abilityBonusesByLevel: {
        3: { constitution: 2 },
        4: { constitution: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Restore 8 Shield.',
        'Level 3: CON +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_thermal_barrage',
    card: {
      id: 'machine_thermal_barrage',
      name: 'Thermal Barrage',
      set: 'Machine',
      type: 'Attack',
      tier: 'Very Rare',
      apCost: 3,
      range: 30,
      healthBonus: 3,
      shieldBonus: 2,
      tags: ['Fire'],
      damage: 8,
      damageType: 'Fire',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 8 Fire damage. Apply Burning 3.',
      masteryDamageByLevel: {
        1: 8,
        2: 9,
        3: 9,
        4: 9
      },
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 3
        }
      },
      abilityBonusesByLevel: {
        3: { intelligence: 2 },
        4: { intelligence: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Fire damage increases to 9.',
        'Level 3: INT +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_titan_breaker',
    card: {
      id: 'machine_titan_breaker',
      name: 'Titan Breaker',
      set: 'Machine',
      type: 'Attack',
      tier: 'Legendary',
      apCost: 3,
      range: 5,
      healthBonus: 6,
      shieldBonus: 5,
      tags: ['Bludgeoning'],
      damage: 16,
      damageType: 'Bludgeoning',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 16 Bludgeoning damage. If the target has Shield, deal +4 damage. If the attack is Fully Blocked, deal 6 damage directly to HP.',
      masteryDamageByLevel: {
        1: 16,
        2: 17,
        3: 17,
        4: 17
      },
      bonusDamageIfTargetHasShieldByLevel: {
        1: 4
      },
      directHpDamageOnFullyBlockedByLevel: {
        1: 6
      },
      abilityBonusesByLevel: {
        3: { strength: 2 },
        4: { strength: 2 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 17.',
        'Level 3: STR +2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_chainsaw',
    card: {
      id: 'machine_chainsaw',
      name: 'Chainsaw',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 10,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Utility'],
      damage: 4,
      damageType: 'Slashing',
      targetEnemiesOnly: true,
      allowSelfTarget: false,
      effect: 'Deal 4 Slashing damage.',
      masteryDamageByLevel: {
        1: 4,
        2: 5,
        3: 5,
        4: 5
      },
      abilityBonusesByLevel: {
        3: { strength: 1 },
        4: { strength: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 5.',
        'Level 3: STR +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_diagnostic_scanner',
    card: {
      id: 'machine_diagnostic_scanner',
      name: 'Diagnostic Scanner',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 20,
      targetMode: 'none',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Scan a device, mechanism, or structure. Reveal 1 hidden mechanisms, traps, weak points, or magical signatures within range every 10 minutes.',
      rangeByLevel: {
        1: 20,
        2: 30,
        3: 30,
        4: 30
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 30 ft.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_lesser_drone',
    card: {
      id: 'machine_lesser_drone',
      name: 'Lesser Drone',
      set: 'Machine',
      type: 'Utility',
      tier: 'Rare',
      apCost: 3,
      range: 10,
      targetMode: 'none',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Construct'],
      effect: 'Deploy a combat construct with 4 AP and 2 HP that lasts for 2 turns. It has the Sharp Spike card. You may command it on your turn.',
      utilityNote: 'Implemented with the current separate construct-turn model rather than acting on the owner turn.',
      isConstruct: true,
      constructMode: 'utility',
      constructManualTurns: true,
      constructDurationTurns: 2,
      constructAp: 4,
      constructMaxHp: 2,
      constructMaxHpByLevel: {
        1: 2,
        2: 4,
        3: 4,
        4: 4
      },
      constructMoveFt: 10,
      constructCards: ['machine_sharp_spike'],
      constructCardMasteryLevel: 1,
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Increase HP to 4.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_mechanical_assistance',
    card: {
      id: 'machine_mechanical_assistance',
      name: 'Mechanical Assistance',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      targetAlliesOnly: true,
      allowSelfTarget: false,
      effect: 'An ally gains +2 damage on their next attack.',
      nextAttackDamageBonusByLevel: {
        1: 2,
        2: 3,
        3: 3,
        4: 3
      },
      abilityBonusesByLevel: {
        3: { wisdom: 1 },
        4: { wisdom: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Bonus increases to +3 damage.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_multi_tool',
    card: {
      id: 'machine_multi_tool',
      name: 'Multi-Tool',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 5,
      rangeText: 'Touch',
      targetMode: 'none',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Gain advantage or +2 bonus on checks to repair, unlock, dismantle, or assemble mechanical objects.',
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Bonus increases to +4.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_portable_winch',
    card: {
      id: 'machine_portable_winch',
      name: 'Portable Winch',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 20,
      targetMode: 'none',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Deploy a grappling winch capable of pulling objects or characters up to 200 kg. Useful for climbing, lifting debris, or traversing gaps.',
      rangeByLevel: {
        1: 20,
        2: 30,
        3: 30,
        4: 30
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Range increases to 30 ft.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_rapid_fire',
    card: {
      id: 'machine_rapid_fire',
      name: 'Rapid Fire',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 3,
      damageType: 'Piercing',
      targetMode: 'multi_select',
      multiTargetMax: 3,
      targetEnemiesOnly: true,
      effect: 'Deal 3 Piercing damage to up to 3 targets.',
      masteryDamageByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      abilityBonusesByLevel: {
        3: { dexterity: 1 },
        4: { dexterity: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 4 each.',
        'Level 3: DEX +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_scrap_mine',
    card: {
      id: 'machine_scrap_mine',
      name: 'Scrap Mine',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 10,
      targetMode: 'none',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Trap'],
      effect: 'Place a mine that deals 6 damage when triggered. Detect DC 10 to perceive trap.',
      utilityNote: 'Represents a single-space trap. Add a zone target manually when a creature triggers it.',
      isZone: true,
      zoneTickOnTurn: false,
      zoneRadius: 5,
      zoneDurationTurns: 0,
      zoneEnterDamageByLevel: {
        1: 6,
        2: 8,
        3: 8,
        4: 8
      },
      zoneDetectDcByLevel: {
        1: 10
      },
      zoneTriggerOnTargetAdd: true,
      zoneConsumeOnTrigger: true,
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 8.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_scrap_turret',
    card: {
      id: 'machine_scrap_turret',
      name: 'Scrap Turret',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 3,
      range: 10,
      targetMode: 'none',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Construct'],
      damage: 3,
      effect: 'Deploy a turret that deals 3 damage to the nearest enemy within 15 ft at the start of your turn for 2 turns. It has 6 HP.',
      utilityNote: 'Assign a target manually in the construct panel. Nearest-enemy and 15 ft range checks are GM-enforced until battlefield positions are tracked.',
      isConstruct: true,
      constructMode: 'damage',
      constructAllowUntargetedDeploy: true,
      constructDurationTurns: 2,
      constructAp: 0,
      constructMaxHp: 6,
      constructMoveFt: 0,
      masteryDamageByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      abilityBonusesByLevel: {
        3: { intelligence: 1 },
        4: { intelligence: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Damage increases to 4.',
        'Level 3: INT +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_shield_distributor',
    card: {
      id: 'machine_shield_distributor',
      name: 'Shield Distributor',
      set: 'Machine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 10,
      healthBonus: 1,
      shieldBonus: 2,
      tags: ['Shield'],
      targetAlliesOnly: true,
      allowSelfTarget: false,
      effect: 'Grant an ally 3 Shield.',
      shieldRestoreByLevel: {
        1: 3,
        2: 4,
        3: 4,
        4: 4
      },
      abilityBonusesByLevel: {
        3: { constitution: 1 },
        4: { constitution: 1 }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield increases to 4.',
        'Level 3: CON +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  }
];

const LINEAR_MASTERY_CHOICE_EXCEPTIONS = new Set(['arcane_pause_button', 'demonic_fire_of_retribution']);

function clonePlain(value) {
  if (!value || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeChoiceToken(value = '', fallback = '') {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return token || fallback;
}

function stripMasteryPrefix(line = '', level = 1) {
  return String(line || '')
    .replace(new RegExp(`^Level\\s*${level}\\s*:\\s*`, 'i'), '')
    .trim()
    .replace(/\.$/, '');
}

function getScaledMapNumber(source, level = 1, fallback = 0) {
  const parsedLevel = Math.max(1, Math.min(4, Number(level || 1)));
  if (!source || typeof source !== 'object') return fallback;
  const exact = Number(source[parsedLevel] ?? source[`level${parsedLevel}`]);
  if (Number.isFinite(exact)) return exact;
  for (let probe = parsedLevel - 1; probe >= 1; probe -= 1) {
    const lowered = Number(source[probe] ?? source[`level${probe}`]);
    if (Number.isFinite(lowered)) return lowered;
  }
  for (let probe = parsedLevel + 1; probe <= 4; probe += 1) {
    const raised = Number(source[probe] ?? source[`level${probe}`]);
    if (Number.isFinite(raised)) return raised;
  }
  return fallback;
}

function getMapNumberAtOrBefore(source, level = 1, fallback = 0) {
  const parsedLevel = Math.max(1, Math.min(4, Number(level || 1)));
  if (!source || typeof source !== 'object') return fallback;
  const exact = Number(source[parsedLevel] ?? source[`level${parsedLevel}`]);
  if (Number.isFinite(exact)) return exact;
  for (let probe = parsedLevel - 1; probe >= 1; probe -= 1) {
    const lowered = Number(source[probe] ?? source[`level${probe}`]);
    if (Number.isFinite(lowered)) return lowered;
  }
  return fallback;
}

function normalizeAbilityBonusEntry(entry = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const normalized = {};
  for (const [key, value] of Object.entries(entry)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed === 0) continue;
    normalized[key] = Math.round(parsed);
  }
  return Object.keys(normalized).length ? normalized : null;
}

function hasAbilityBonusEntry(entry = {}) {
  return Boolean(normalizeAbilityBonusEntry(entry));
}

function getScaledAbilityBonusEntry(source, level = 1) {
  const parsedLevel = Math.max(1, Math.min(4, Number(level || 1)));
  if (!source || typeof source !== 'object') return null;
  const direct = normalizeAbilityBonusEntry(source[parsedLevel] || source[`level${parsedLevel}`]);
  if (direct) return direct;
  for (let probe = parsedLevel - 1; probe >= 1; probe -= 1) {
    const lowered = normalizeAbilityBonusEntry(source[probe] || source[`level${probe}`]);
    if (lowered) return lowered;
  }
  for (let probe = parsedLevel + 1; probe <= 4; probe += 1) {
    const raised = normalizeAbilityBonusEntry(source[probe] || source[`level${probe}`]);
    if (raised) return raised;
  }
  return null;
}

function getAbilityBonusEntryAtOrBefore(source, level = 1) {
  const parsedLevel = Math.max(1, Math.min(4, Number(level || 1)));
  if (!source || typeof source !== 'object') return null;
  const direct = normalizeAbilityBonusEntry(source[parsedLevel] || source[`level${parsedLevel}`]);
  if (direct) return direct;
  for (let probe = parsedLevel - 1; probe >= 1; probe -= 1) {
    const lowered = normalizeAbilityBonusEntry(source[probe] || source[`level${probe}`]);
    if (lowered) return lowered;
  }
  return null;
}

function numericChoiceStartLevel(source, fallback = 0) {
  const base = Number(getMapNumberAtOrBefore(source, 1, fallback));
  for (let level = 2; level <= 4; level += 1) {
    if (Number(getMapNumberAtOrBefore(source, level, fallback)) !== base) return level;
  }
  return 0;
}

function abilityChoiceStartLevel(source) {
  const base = getAbilityBonusEntryAtOrBefore(source, 1);
  for (let level = 2; level <= 4; level += 1) {
    const current = getAbilityBonusEntryAtOrBefore(source, level);
    if (JSON.stringify(current || null) !== JSON.stringify(base || null)) return level;
  }
  return 0;
}

function buildChoiceNumberMap(source, fallback = 0, startLevel = 2) {
  const effect = {};
  for (let level = 2; level <= 4; level += 1) {
    const sourceLevel = level < startLevel ? startLevel : level;
    effect[level] = Math.round(Number(getScaledMapNumber(source, sourceLevel, fallback)) || 0);
  }
  return effect;
}

function buildChoiceAbilityMap(source, startLevel = 2) {
  const effect = {};
  for (let level = 2; level <= 4; level += 1) {
    const sourceLevel = level < startLevel ? startLevel : level;
    const entry = getScaledAbilityBonusEntry(source, sourceLevel);
    if (!entry) continue;
    effect[level] = clonePlain(entry);
  }
  return Object.keys(effect).length ? effect : null;
}

function makeBaseNumberMap(source, fallback = 0) {
  return { 1: Math.round(Number(getMapNumberAtOrBefore(source, 1, fallback)) || 0) };
}

function makeBaseAbilityMap(source) {
  const entry = getAbilityBonusEntryAtOrBefore(source, 1);
  return entry ? { 1: clonePlain(entry) } : null;
}

function contestedChoiceEffectKey(optionId = '', suffix = '') {
  const token = normalizeChoiceToken(optionId, 'option');
  return `contested_${token}_${suffix}`;
}

function cardByLevelFallback(card = {}, key = '') {
  switch (key) {
    case 'masteryDamageByLevel':
      return Number(card.damage || 0);
    case 'rangeByLevel':
      return Number(card.range || 0);
    case 'areaRadiusByLevel':
      return Number(card.areaRadius || 0);
    case 'zoneRadiusByLevel':
      return Number(card.zoneRadius || 0);
    case 'constructDurationTurnsByLevel':
      return Number(card.constructDurationTurns ?? card.constructDuration ?? card.durationTurns ?? 1);
    case 'constructMaxHpByLevel':
      return Number(card.constructMaxHp || 0);
    case 'durationTurnsByLevel':
      return Number(card.durationTurns || 0);
    case 'pauseApByLevel':
      return Number(card.pauseAp || 0);
    case 'healByLevel':
      return Number(card.heal || 0);
    default:
      return 0;
  }
}

function assignChoiceEffect(target, branch = '', key = '', value = null) {
  if (!target?.[branch] || !key || !value || typeof value !== 'object') return;
  target[branch][key] = clonePlain(value);
}

function hasChoiceEffects(effects = {}) {
  return Boolean(effects && typeof effects === 'object' && Object.keys(effects).length);
}

function applySpecialLinearChoiceFields(card = {}, choiceEffects = {}) {
  const cardId = String(card.id || '').trim();
  if (cardId === 'arcane_no') {
    card.offTurnReactionEnabledByLevel = { 1: 0 };
    assignChoiceEffect(choiceEffects, 'optionA', 'offTurnReactionEnabledByLevel', { 2: 1, 3: 1, 4: 1 });
  }
  if (cardId === 'demonic_ray_of_enfeeblement') {
    card.hpSacrificeWeakenedStacksByLevel = { 1: 1 };
    assignChoiceEffect(choiceEffects, 'optionB', 'hpSacrificeWeakenedStacksByLevel', { 2: 2, 3: 2, 4: 2 });
  }
}

export function applyDefaultMasteryChoiceBehavior(card = {}) {
  if (!card || typeof card !== 'object') return card;
  if (Array.isArray(card.masteryChoiceOptions) && card.masteryChoiceOptions.length) return card;
  if (LINEAR_MASTERY_CHOICE_EXCEPTIONS.has(String(card.id || '').trim())) return card;
  const masteryLines = Array.isArray(card.mastery) ? card.mastery.map((line) => String(line || '').trim()).filter(Boolean) : [];
  if (masteryLines.length < 4) return card;
  const level2Label = stripMasteryPrefix(masteryLines[1], 2);
  const level3Label = stripMasteryPrefix(masteryLines[2], 3);
  if (!level2Label || !level3Label || level3Label === '-' || /unlocks fusion eligibility/i.test(level3Label)) {
    return card;
  }

  const choiceEffects = { optionA: {}, optionB: {} };
  const topLevelKeys = Object.keys(card).filter((key) => key.endsWith('ByLevel') && key !== 'abilityBonusesByLevel');
  for (const key of topLevelKeys) {
    const source = card[key];
    if (!source || typeof source !== 'object') continue;
    const fallback = cardByLevelFallback(card, key);
    const startLevel = numericChoiceStartLevel(source, fallback);
    if (startLevel !== 2 && startLevel !== 3) continue;
    const branch = startLevel === 2 ? 'optionA' : 'optionB';
    assignChoiceEffect(choiceEffects, branch, key, buildChoiceNumberMap(source, fallback, startLevel));
    card[key] = makeBaseNumberMap(source, fallback);
  }

  if (card.abilityBonusesByLevel && typeof card.abilityBonusesByLevel === 'object') {
    const startLevel = abilityChoiceStartLevel(card.abilityBonusesByLevel);
    if (startLevel === 2 || startLevel === 3) {
      const branch = startLevel === 2 ? 'optionA' : 'optionB';
      const effect = buildChoiceAbilityMap(card.abilityBonusesByLevel, startLevel);
      if (effect) {
        assignChoiceEffect(choiceEffects, branch, 'abilityBonusesByLevel', effect);
        card.abilityBonusesByLevel = makeBaseAbilityMap(card.abilityBonusesByLevel);
      }
    }
  }

  if (card.statusApply && typeof card.statusApply === 'object') {
    const stackFallback = Number(card.statusApply.stacks ?? card.statusApply.defaultStacks ?? 1);
    const stackStart = numericChoiceStartLevel(card.statusApply.stacksByLevel, stackFallback);
    if (stackStart === 2 || stackStart === 3) {
      const branch = stackStart === 2 ? 'optionA' : 'optionB';
      assignChoiceEffect(
        choiceEffects,
        branch,
        'statusApplyStacksByLevel',
        buildChoiceNumberMap(card.statusApply.stacksByLevel, stackFallback, stackStart)
      );
      card.statusApply.stacksByLevel = makeBaseNumberMap(card.statusApply.stacksByLevel, stackFallback);
    }
    const durationFallback = Number(card.statusApply.durationTurns ?? 0);
    const durationStart = numericChoiceStartLevel(card.statusApply.durationTurnsByLevel, durationFallback);
    if (durationStart === 2 || durationStart === 3) {
      const branch = durationStart === 2 ? 'optionA' : 'optionB';
      assignChoiceEffect(
        choiceEffects,
        branch,
        'statusApplyDurationTurnsByLevel',
        buildChoiceNumberMap(card.statusApply.durationTurnsByLevel, durationFallback, durationStart)
      );
      card.statusApply.durationTurnsByLevel = makeBaseNumberMap(card.statusApply.durationTurnsByLevel, durationFallback);
    }
  }

  if (card.contestedEffect && typeof card.contestedEffect === 'object' && Array.isArray(card.contestedEffect.options)) {
    for (const entry of card.contestedEffect.options) {
      if (!entry || typeof entry !== 'object') continue;
      const optionId = String(entry.id || '').trim();
      if (!optionId) continue;
      const stackFallback = Number(entry.statusStacks ?? 1);
      const stackStart = numericChoiceStartLevel(entry.statusStacksByLevel, stackFallback);
      if (stackStart === 2 || stackStart === 3) {
        const branch = stackStart === 2 ? 'optionA' : 'optionB';
        assignChoiceEffect(
          choiceEffects,
          branch,
          contestedChoiceEffectKey(optionId, 'statusStacksByLevel'),
          buildChoiceNumberMap(entry.statusStacksByLevel, stackFallback, stackStart)
        );
        entry.statusStacksByLevel = makeBaseNumberMap(entry.statusStacksByLevel, stackFallback);
      }
      const durationFallback = Number(entry.durationTurns ?? card.contestedEffect.durationTurns ?? 0);
      const durationStart = numericChoiceStartLevel(entry.durationTurnsByLevel, durationFallback);
      if (durationStart === 2 || durationStart === 3) {
        const branch = durationStart === 2 ? 'optionA' : 'optionB';
        assignChoiceEffect(
          choiceEffects,
          branch,
          contestedChoiceEffectKey(optionId, 'durationTurnsByLevel'),
          buildChoiceNumberMap(entry.durationTurnsByLevel, durationFallback, durationStart)
        );
        entry.durationTurnsByLevel = makeBaseNumberMap(entry.durationTurnsByLevel, durationFallback);
      }
    }
  }

  applySpecialLinearChoiceFields(card, choiceEffects);
  if (!hasChoiceEffects(choiceEffects.optionA) || !hasChoiceEffects(choiceEffects.optionB)) {
    return card;
  }

  card.masteryChoiceOptions = [
    {
      id: normalizeChoiceToken(level2Label, 'choice_1'),
      label: level2Label,
      unlockLevel: 2,
      deferredUnlockLevel: 3,
      effects: clonePlain(choiceEffects.optionA)
    },
    {
      id: normalizeChoiceToken(level3Label, 'choice_2'),
      label: level3Label,
      unlockLevel: 2,
      deferredUnlockLevel: 3,
      effects: clonePlain(choiceEffects.optionB)
    }
  ];
  card.mastery = [
    'Level 1: Base.',
    `Level 2: Choose ${level2Label} or ${level3Label}.`,
    'Level 3: Gain the option not chosen at Level 2.',
    masteryLines[3] || 'Level 4: Unlocks fusion eligibility.'
  ];
  return card;
}

for (const entry of CARD_PRESETS) {
  if (!entry?.card) continue;
  applyDefaultMasteryChoiceBehavior(entry.card);
}

export const RARITY_ORDER = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Epic',
  'Legendary',
  'Unique'
];
