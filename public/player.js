import { UI_LIMITS } from './shared/game-config.js';
import { getCardTierMasteryThresholds, getCardTierShieldBonus } from './shared/card-rules.js';
import { ATTRIBUTE_BALANCE, getAttributeScalingFromScores } from './shared/stat-balance.js';
import {
  ARMOR_TYPE_OPTIONS,
  REQUIREMENT_ABILITY_OPTIONS,
  WEAPON_STYLE_OPTIONS,
  hasWeaponBasicAttack
} from './shared/equipment.js';

const DAMAGE_TYPES = [
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder'
];
const MAX_ACTIVE_CARDS = UI_LIMITS.maxActiveCards;

const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1, currentTurnKey: '' },
  reference: { standardActions: [], sets: [], statuses: [], teams: [], characterPresets: [] },
  updatedAt: null
};

const params = new URLSearchParams(window.location.search);
let focusId = params.get('id');
let createMode = params.get('create') === '1';
let activeHelpTopic = 'combat';
let eventSource;
const playerSectionState = new Map();
const playerJournalState = new Map();
const playerManageState = new Map();
const playerCardOpenState = new Map();
const playerDashboardTabState = new Map();
const playerCompactTableState = new Map();
const PLAYER_DASHBOARD_TABS = ['standardActions', 'cards', 'inventory', 'journal', 'notes'];
const HELP_TOPIC_TITLES = {
  statuses: 'Statuses',
  combat: 'Combat Rules',
  stats: 'Stat Rules',
  constructs: 'Constructs',
  standard_actions: 'Standard Actions',
  out_of_combat: 'Out of Combat',
  cards: 'Cards'
};

const els = {
  select: document.getElementById('playerSelect'),
  stats: document.getElementById('playerStats'),
  journal: document.getElementById('playerJournal'),
  journalContent: document.getElementById('playerJournalContent'),
  journalPopup: document.getElementById('journalPopup'),
  cardList: document.getElementById('playerCardList'),
  logList: document.getElementById('playerLogList'),
  turnInfo: document.getElementById('playerTurnInfo'),
  cardForm: document.getElementById('playerCardForm'),
  cardDrawer: document.getElementById('playerCardDrawer'),
  menuToggle: document.getElementById('playerMenuToggle'),
  menuPanel: document.getElementById('playerMenuPanel'),
  helpMenuToggle: document.getElementById('playerHelpMenuToggle'),
  helpMenuPanel: document.getElementById('playerHelpMenuPanel'),
  helpModal: document.getElementById('playerHelpModal'),
  helpModalClose: document.getElementById('playerHelpModalClose'),
  helpModalTitle: document.getElementById('playerHelpModalTitle'),
  helpModalBody: document.getElementById('playerHelpModalBody'),
  helpModalTabs: document.getElementById('playerHelpModalTabs'),
  nextTurn: document.getElementById('playerNextTurn'),
  playerShortRest: document.getElementById('playerShortRest'),
  playerLongRest: document.getElementById('playerLongRest'),
  createCharacter: document.getElementById('playerCreateCharacter'),
  downloadCharacter: document.getElementById('downloadCharacter'),
  uploadCharacter: document.getElementById('uploadCharacter'),
  importCardFile: document.getElementById('playerImportCard'),
  importDeckFile: document.getElementById('playerImportDeck'),
  baseToggle: document.getElementById('playerBaseToggle'),
  baseForm: document.getElementById('playerBaseForm'),
  importRelicFile: document.getElementById('playerImportRelic')
};

const STAT_FIELD_MAP = {
  hp: 'hp',
  shield: 'shield',
  ap: 'apCurrent'
};

document.addEventListener('DOMContentLoaded', () => {
  wireSelect();
  wirePlayerMenu();
  wirePlayerHelp();
  wireTopButtons();
  subscribe();
  fetchState();
});

function wireSelect() {
  els.select.addEventListener('change', () => {
    focusId = els.select.value || null;
    createMode = false;
    updateUrl();
    render();
  });
}

function wirePlayerCardForm() {
  const form = document.getElementById('playerCardForm');
  if (!form) return;
  const tierInput = form.querySelector('[name="tier"]');
  if (tierInput && tierInput.dataset.masteryThresholdSyncBound !== '1') {
    const syncThresholds = () => syncCardMasteryThresholdInputs(form);
    tierInput.addEventListener('change', syncThresholds);
    tierInput.addEventListener('input', syncThresholds);
    tierInput.dataset.masteryThresholdSyncBound = '1';
  }
  syncCardMasteryThresholdInputs(form);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const participant = getFocusedParticipant();
    if (!participant) {
      notify('Select a combatant first.');
      return;
    }
    const formData = new FormData(form);
    const newCard = buildPlayerCardFromForm(formData);
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const existingCards = latest?.cards || [];
    const activeCount = existingCards.filter((card) => isCardActive(card)).length;
    newCard.active = activeCount < MAX_ACTIVE_CARDS;
    const updatedCards = [...existingCards, newCard];
    await patchParticipant(participant.id, { cards: updatedCards });
    form.reset();
    if (!newCard.active) {
      notify(`Active loadout is full (${MAX_ACTIVE_CARDS}). Card added as inactive.`);
    }
    fetchState();
  };
}

function wirePlayerCardImports() {
  const single = document.getElementById('playerImportCard');
  const deck = document.getElementById('playerImportDeck');
  if (single) {
    single.onchange = (event) => handlePlayerCardFile(event, 'card');
  }
  if (deck) {
    deck.onchange = (event) => handlePlayerCardFile(event, 'deck');
  }
}

function togglePlayerDrawer(drawer) {
  if (!drawer) return;
  drawer.open = !drawer.open;
  if (drawer.open) {
    drawer.querySelector('input, select, textarea, button')?.focus();
  }
}

function wirePlayerMenu() {
  if (!els.menuToggle || !els.menuPanel) return;
  els.menuToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    els.helpMenuPanel?.classList.remove('is-open');
    els.menuPanel.classList.toggle('is-open');
  });
  document.addEventListener('click', (event) => {
    if (!els.menuPanel?.classList?.contains('is-open')) return;
    if (event.target.closest('.player-menu')) return;
    els.menuPanel.classList.remove('is-open');
  });
  els.createCharacter?.addEventListener('click', openCharacterCreator);
  els.downloadCharacter?.addEventListener('click', handleCharacterDownload);
  els.uploadCharacter?.addEventListener('change', handleCharacterImport);
  els.baseToggle?.addEventListener('click', () => {
    if (!els.baseForm) return;
    const participant = getFocusedParticipant();
    if (!participant) {
      notify('Select a combatant first.');
      return;
    }
    populatePlayerBaseForm(participant);
    els.baseForm.classList.toggle('hidden');
  });
  els.baseForm?.addEventListener('submit', handlePlayerBaseSubmit);
}

function wirePlayerHelp() {
  els.helpMenuToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    els.menuPanel?.classList.remove('is-open');
    els.helpMenuPanel?.classList.toggle('is-open');
  });
  els.helpMenuPanel?.querySelectorAll('[data-player-help-open]').forEach((button) => {
    button.addEventListener('click', () => {
      openPlayerHelpModal(button.dataset.playerHelpOpen || 'combat');
    });
  });
  els.helpModalClose?.addEventListener('click', closePlayerHelpModal);
  els.helpModalTabs?.querySelectorAll('[data-player-help-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      openPlayerHelpModal(button.dataset.playerHelpTab || 'combat');
    });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.player-help-menu')) {
      els.helpMenuPanel?.classList.remove('is-open');
    }
    if (event.target === els.helpModal) {
      closePlayerHelpModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.helpModal?.classList.contains('hidden')) {
      closePlayerHelpModal();
    }
  });
}

function wireTopButtons() {
  els.nextTurn?.addEventListener('click', async () => {
    try {
      await api('/api/turn/next', 'POST');
    } catch (err) {
      notify(err.message);
    }
  });
  els.playerShortRest?.addEventListener('click', () => handlePlayerRest('short'));
  els.playerLongRest?.addEventListener('click', () => handlePlayerRest('long'));
}

function openPlayerHelpModal(topic = 'combat') {
  activeHelpTopic = HELP_TOPIC_TITLES[topic] ? topic : 'combat';
  renderPlayerHelpModal();
  els.helpMenuPanel?.classList.remove('is-open');
  els.helpModal?.classList.remove('hidden');
}

function closePlayerHelpModal() {
  els.helpModal?.classList.add('hidden');
}

function renderPlayerHelpModal() {
  if (!els.helpModalBody || !els.helpModalTabs) return;
  const title = HELP_TOPIC_TITLES[activeHelpTopic] || 'Help';
  if (els.helpModalTitle) {
    els.helpModalTitle.textContent = title;
  }
  els.helpModalTabs.querySelectorAll('[data-player-help-tab]').forEach((button) => {
    const isActive = button.dataset.playerHelpTab === activeHelpTopic;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  els.helpModalBody.innerHTML = getPlayerHelpTopicContent(activeHelpTopic);
}

function getPlayerHelpTopicContent(topic) {
  if (topic === 'statuses') return renderPlayerStatusHelpContent();
  if (topic === 'stats') return renderPlayerStatRulesHelpContent();
  if (topic === 'standard_actions') return renderPlayerStandardActionHelpContent();
  if (topic === 'constructs') return renderPlayerConstructHelpContent();
  if (topic === 'combat') {
    return `
      <section class="help-section">
        <h3>Damage Types</h3>
        <div class="form-row">
          <div>
            <h4>Physical</h4>
            <ul class="help-list">
              <li>Bludgeoning</li>
              <li>Piercing</li>
              <li>Slashing</li>
            </ul>
          </div>
          <div>
            <h4>Magical / Elemental</h4>
            <ul class="help-list">
              <li>Acid</li>
              <li>Cold</li>
              <li>Fire</li>
              <li>Force</li>
              <li>Lightning</li>
              <li>Necrotic</li>
              <li>Poison</li>
              <li>Psychic</li>
              <li>Radiant</li>
              <li>Thunder</li>
            </ul>
          </div>
        </div>
      </section>
      <section class="help-section">
        <h3>Core Combat Rules</h3>
        <ul class="help-list">
          <li>6 AP system by default.</li>
          <li>Auto-hit attacks.</li>
          <li>Damage goes to Shield first, then HP.</li>
          <li>Persistent Shield during combat.</li>
          <li>Movement starts at 10 ft per AP, plus or minus 5 ft per DEX modifier. Difficult terrain starts at 5 ft per AP.</li>
          <li>Guard can restore Shield but cannot exceed Max Shield.</li>
          <li>Recover action reduces damaging status stacks.</li>
        </ul>
      </section>
      <section class="help-section">
        <h3>Combat Flow</h3>
        <ul class="help-list">
          <li>Start of combat: set Shield to Max Shield.</li>
          <li>Start of turn: resolve status effects and escalation first.</li>
          <li>Take actions by spending AP.</li>
          <li>End of turn: resolve end-of-turn effects.</li>
          <li>End of combat: restore Shield to Max Shield.</li>
        </ul>
      </section>
    `;
  }
  if (topic === 'out_of_combat') {
    return `
      <section class="help-section">
        <h3>Character Foundation</h3>
        <ul class="help-list">
          <li>No classes. Character role grows from cards, mastery, and fusion choices.</li>
          <li>Uses the six standard abilities: STR, DEX, CON, INT, WIS, CHA.</li>
          <li>Creation baseline: +2 to one ability and +1 to a different ability.</li>
          <li>Choose 2 saving throw proficiencies and 5 skill proficiencies.</li>
        </ul>
      </section>
      <section class="help-section">
        <h3>Resting Outside Combat</h3>
        <ul class="help-list">
          <li>Short Rest: heal 5 + CON mod (minimum 1), recover short-rest resources, restore table-defined Shield.</li>
          <li>Long Rest: restore HP, Shield, and long-rest resources.</li>
          <li>Long Rest is the main loadout swap window for cards, relics, and passives.</li>
          <li>If rest is interrupted by combat or hazards, no rest benefits unless at least 50% of duration was completed.</li>
        </ul>
      </section>
    `;
  }
  return `
    <section class="help-section">
      <h3>Core System Philosophy</h3>
      <p>Characters are defined by the cards they collect, master, and fuse. There are no classes.</p>
    </section>
    <section class="help-section">
      <h3>Card Hand</h3>
      <ul class="help-list">
        <li>Up to 10 cards can be active at one time.</li>
      </ul>
    </section>
    <section class="help-section">
      <h3>Card Mastery</h3>
      <table class="help-table">
        <thead>
          <tr><th>Level</th><th>Name</th><th>Effect</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Basic</td><td>Card functions normally.</td></tr>
          <tr><td>2</td><td>Mastered</td><td>Card gains a small improvement.</td></tr>
          <tr><td>3</td><td>Refined</td><td>Card gains a stronger improvement.</td></tr>
          <tr><td>4</td><td>Fusion-Ready</td><td>Card becomes Fusion-eligible and may gain a minor perk.</td></tr>
        </tbody>
      </table>
    </section>
    <section class="help-section">
      <h3>Auto-Hit and Range</h3>
      <ul class="help-list">
        <li>Attacks auto-hit unless prevented by positioning or cover.</li>
        <li>Cards use flat damage modifiers and clear range values.</li>
      </ul>
    </section>
  `;
}

function renderPlayerStatRulesHelpContent() {
  const physicalTypes = ATTRIBUTE_BALANCE.meleeDamageTypes.map((type) => `<li>${escapeHtml(type)}</li>`).join('');
  const magicTypes = ATTRIBUTE_BALANCE.directMagicDamageTypes.map((type) => `<li>${escapeHtml(type)}</li>`).join('');
  return `
    <section class="help-section">
      <h3>Ability Modifier Rule</h3>
      <ul class="help-list">
        <li>Ability modifiers use the standard formula: floor((score - 10) / 2).</li>
        <li>A score of 10 is neutral (+0 modifier).</li>
        <li>Legacy or blank 0 ability scores are treated as 10 for derived stat recalculation and fallback display.</li>
      </ul>
    </section>
    <section class="help-section">
      <h3>Current Stat Scaling</h3>
      <ul class="help-list">
        <li>STR: +${ATTRIBUTE_BALANCE.strengthMeleeDamagePerModifier} melee damage per modifier.</li>
        <li>DEX: +${ATTRIBUTE_BALANCE.dexterityMoveFtPerModifier} ft movement per modifier. Base move is ${ATTRIBUTE_BALANCE.baseMoveFt} ft per AP and difficult terrain starts at ${ATTRIBUTE_BALANCE.difficultMoveFt} ft per AP.</li>
        <li>CON: +${ATTRIBUTE_BALANCE.constitutionMaxHpPerModifier} max HP per modifier.</li>
        <li>WIS: +${ATTRIBUTE_BALANCE.wisdomMaxShieldPerModifier} base Shield per modifier.</li>
        <li>INT: +${ATTRIBUTE_BALANCE.intelligenceMagicDamagePerModifier} direct magic damage per modifier.</li>
        <li>CHA: +${ATTRIBUTE_BALANCE.charismaStatusEffectDamagePerModifier} status effect damage per modifier.</li>
      </ul>
    </section>
    <section class="help-section">
      <h3>Where Scaling Applies</h3>
      <ul class="help-list">
        <li>Movement scaling applies to standard movement, difficult-terrain movement, and card-based movement.</li>
        <li>Melee damage scaling applies to melee physical attacks within ${ATTRIBUTE_BALANCE.meleeRangeFt} ft.</li>
        <li>Direct magic damage scaling applies to non-zone, non-construct attacks that use one of the listed magic damage types.</li>
        <li>Status effect damage scaling applies to damaging statuses and other status-based damage.</li>
      </ul>
    </section>
    <section class="help-section">
      <h3>Damage Types Used For Scaling</h3>
      <div class="form-row">
        <div>
          <h4>Melee Physical</h4>
          <ul class="help-list">${physicalTypes}</ul>
        </div>
        <div>
          <h4>Direct Magic</h4>
          <ul class="help-list">${magicTypes}</ul>
        </div>
      </div>
    </section>
  `;
}

function renderPlayerConstructHelpContent() {
  return `
    <section class="help-section">
      <h3>Core Rules</h3>
      <ul class="help-list">
        <li>Constructs are controlled by their owner and use the owner's team.</li>
        <li>They appear in the owner's active effects and construct sections.</li>
        <li>Constructs are separate combat entities with their own HP, AP, and statuses.</li>
        <li>Construct AP refreshes each time the construct acts.</li>
      </ul>
    </section>
    <section class="help-section">
      <h3>Turn Timing</h3>
      <ul class="help-list">
        <li>Constructs do not act on the turn they are summoned.</li>
        <li>Their duration starts from their first later turn after the summon turn.</li>
        <li>A 2-turn construct summoned this turn gets 2 full later turns before expiring.</li>
        <li>Construct timing is suspended during Pause Button extra turns.</li>
      </ul>
    </section>
    <section class="help-section">
      <h3>Cards and Limits</h3>
      <ul class="help-list">
        <li>If a construct is given cards, it only has the cards explicitly listed on its summon card.</li>
        <li>Construct cards default to Mastery 1 unless the summon card says otherwise.</li>
        <li>Multiple copies of the same construct can be active at once if the owner's cap allows it.</li>
        <li>If a new summon exceeds the owner's construct cap, the oldest active construct is replaced.</li>
      </ul>
    </section>
  `;
}

function renderPlayerStandardActionHelpContent() {
  const actionsById = new Map((state.reference?.standardActions || []).map((action) => [action.id, action]));
  const orderedIds = ['move', 'move_difficult', 'disengage', 'half_cover', 'interact', 'recover', 'cleanse', 'guard'];
  const actions = [];
  orderedIds.forEach((id) => {
    const action = actionsById.get(id);
    if (action) actions.push(action);
  });
  for (const action of state.reference?.standardActions || []) {
    if (!orderedIds.includes(action.id)) actions.push(action);
  }
  if (!actions.length) {
    return `
      <section class="help-section">
        <h3>Standard Actions</h3>
        <p>Standard action rules will appear once the server boots.</p>
      </section>
    `;
  }
  const rows = actions
    .map(
      (action) => `
        <tr>
          <td>${escapeHtml(action.label || action.id || 'Action')}</td>
          <td>${Number(action.apCost || 0)}</td>
          <td>${escapeHtml(action.detail || action.summary || '')}</td>
        </tr>
      `
    )
    .join('');
  return `
    <section class="help-section">
      <h3>Standard Actions</h3>
      <table class="help-table">
        <thead>
          <tr><th>Action</th><th>AP</th><th>Rule</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    <section class="help-section">
      <h3>Notes</h3>
      <ul class="help-list">
        <li>Move scales with DEX. Difficult terrain uses the reduced difficult-terrain distance.</li>
        <li>Guard restores Shield but cannot exceed Max Shield.</li>
        <li>Recover reduces one stack of Bleeding, Poisoned, or Burning.</li>
        <li>Cleanse removes one eligible control or debuff status for 4 AP.</li>
      </ul>
    </section>
  `;
}

function renderPlayerStatusHelpContent() {
  const statuses = state.reference?.statuses || [];
  if (!statuses.length) {
    return '<p class="muted">Status reference is not loaded yet.</p>';
  }
  const uniqueStatusIds = new Set([
    'infernal_brand',
    'blood_curse',
    'curse_of_weakness',
    'mind_shield',
    'enlarge',
    'reduce',
    'two_step',
    'haste_matrix',
    'haste_crash',
    'polymorphed'
  ]);
  const normalizeTags = (status) =>
    (Array.isArray(status?.tags) ? status.tags : []).map((tag) => String(tag || '').trim().toLowerCase());
  const classifyStatusGroup = (status) => {
    const tags = normalizeTags(status);
    const statusId = String(status?.id || '').trim().toLowerCase();
    if (uniqueStatusIds.has(statusId) || tags.includes('custom')) return 'unique';
    if (tags.includes('damaging')) return 'damage';
    if (tags.includes('control')) return 'control';
    if (tags.includes('debuff')) return 'debuff';
    if (tags.includes('buff')) return 'buff';
    return 'other';
  };
  const renderStatusEntry = (status) => {
    const tags = Array.isArray(status.tags) && status.tags.length ? status.tags.join(', ') : 'None';
    const stacks = Number.isFinite(Number(status.defaultStacks)) ? Number(status.defaultStacks) : 1;
    return `
      <article class="help-status-item">
        <h4>${escapeHtml(status.name || 'Status')}</h4>
        <p><strong>Default Stacks:</strong> ${stacks}</p>
        <p><strong>Tags:</strong> ${escapeHtml(tags)}</p>
        <p>${escapeHtml(status.description || 'No description available.')}</p>
      </article>
    `;
  };
  const grouped = { damage: [], control: [], debuff: [], buff: [], unique: [], other: [] };
  statuses.forEach((status) => {
    grouped[classifyStatusGroup(status)].push(status);
  });
  const sectionConfigs = [
    { id: 'damage', title: 'Damaging' },
    { id: 'control', title: 'Control' },
    { id: 'debuff', title: 'Debuff' },
    { id: 'buff', title: 'Buff / Other Rules Effects' },
    { id: 'unique', title: 'Unique To A Card' },
    { id: 'other', title: 'Other' }
  ];
  const entries = sectionConfigs
    .map(({ id, title }) => {
      const items = grouped[id]
        .slice()
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }));
      if (!items.length) return '';
      return `
        <section class="help-section">
          <h4>${escapeHtml(title)}</h4>
          <div class="help-status-grid">${items.map(renderStatusEntry).join('')}</div>
        </section>
      `;
    })
    .join('');
  return `
    <section class="help-section">
      <h3>Status Reference</h3>
      <p>These are the active status definitions used by the tracker, grouped by status type.</p>
      ${entries}
    </section>
  `;
}

function subscribe() {
  eventSource?.close?.();
  eventSource = new EventSource('/events');
  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'state') {
        applyState(payload.state);
      }
    } catch (err) {
      console.error('Unable to parse player event', err);
    }
  };
  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(subscribe, 5000);
  };
}

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.state) {
      applyState(data.state);
    }
  } catch (err) {
    console.error('Unable to fetch player state', err);
  }
}

function applyState(nextState) {
  if (!nextState) return;
  state.encounter = nextState.encounter || state.encounter;
  state.reference = nextState.reference || state.reference;
  state.updatedAt = nextState.updatedAt;

  const participants = state.encounter.participants || [];
  if (!participants.find((p) => p.id === focusId)) {
    focusId = createMode ? null : (participants[0]?.id || null);
    updateUrl();
  }

  render();
}

function render() {
  renderSelectOptions();
  const creating = createMode && !focusId;
  renderStats();
  renderJournal();
  if (!creating) {
    renderCards();
  }
  renderLog();
  renderTurnInfo();
}

function getPlayerDashboardTab(participantId) {
  const saved = participantId ? playerDashboardTabState.get(participantId) : null;
  return PLAYER_DASHBOARD_TABS.includes(saved) ? saved : 'standardActions';
}

function setPlayerDashboardTab(participantId, tabId) {
  if (!participantId || !PLAYER_DASHBOARD_TABS.includes(tabId)) return;
  playerDashboardTabState.set(participantId, tabId);
}

function getPlayerCompactTableExpanded(participantId, key) {
  const snapshot = participantId ? playerCompactTableState.get(participantId) : null;
  return Boolean(snapshot?.[key]);
}

function togglePlayerCompactTableExpanded(participantId, key) {
  if (!participantId || !key) return;
  const current = playerCompactTableState.get(participantId) || {};
  playerCompactTableState.set(participantId, {
    ...current,
    [key]: !current[key]
  });
}

function renderSelectOptions() {
  const participants = state.encounter.participants || [];
  const options = [];
  if (createMode && !focusId) {
    options.push('<option value="">Character Creator</option>');
  }
  options.push(
    ...participants.map(
      (participant) =>
        `<option value="${participant.id}" ${participant.id === focusId ? 'selected' : ''}>${participant.name}</option>`
    )
  );
  els.select.innerHTML = options
    .join('');
  if (!participants.length) {
    els.select.innerHTML = '<option value="">No combatants</option>';
  }
  if (createMode && !focusId) {
    els.select.value = '';
  } else if (focusId) {
    els.select.value = focusId;
  }
}

function renderStats() {
  rememberPlayerSections();
  rememberPlayerCardDetails();
  const participant = getFocusedParticipant();
  if (!participant) {
    const hasCombatants = (state.encounter.participants || []).length > 0;
    if (createMode) {
      renderCharacterCreator();
    } else {
      els.stats.innerHTML = `
        <div class="player-empty">
          <h2>${hasCombatants ? 'Select Your Character' : 'Waiting for the GM'}</h2>
          <p>${hasCombatants ? 'Pick a combatant from the dropdown or import your saved character.' : 'The GM has not added any combatants yet.'}</p>
          <button type="button" data-player-open-menu>Import Character</button>
        </div>`;
      els.stats.querySelector('[data-player-open-menu]')?.addEventListener('click', openPlayerMenu);
    }
    return;
  }
  const manageState = getPlayerManageState(participant.id);
  const showZoneSection = participantHasActiveZoneCard(participant);
  const showConstructSection = participantHasActiveConstructCard(participant);
  const activeTab = getPlayerDashboardTab(participant.id);
  const savesExpanded = getPlayerCompactTableExpanded(participant.id, 'saves');
  const skillsExpanded = getPlayerCompactTableExpanded(participant.id, 'skills');
  els.stats.innerHTML = `
    <div class="player-board">
      <section class="player-dashboard-card player-turn-order-card">
        ${renderPlayerTurnTrack()}
      </section>
      <div class="panel-header player-dashboard-nameplate">
        <div>
          <h2>${participant.name}</h2>
        </div>
      </div>
      <div class="player-dashboard-top">
        <section class="player-dashboard-card player-vitals-card">
          <div class="vitals-grid player-dashboard-vitals">
            ${renderPlayerVital('HP', participant.hp, participant.maxHp, 'hp')}
            ${renderPlayerVital('Shield', participant.shield, participant.maxShield, 'shield')}
            ${renderPlayerVital('AP', participant.apCurrent, participant.apMax, 'ap')}
          </div>
          <div class="player-bonus-strip">
            <span class="player-bonus-chip">Guard Restore ${participant.guardRestore || 3}</span>
            <span class="player-bonus-chip">Damage Bonus ${formatSignedValue(participant.damageBonus || 0)}</span>
            <span class="player-bonus-chip">Shield Regen ${Number(getPlayerEquipmentSummary(participant).shieldRegen || 0)}/turn</span>
            ${
              participant.constructs?.length
                ? `<span class="player-bonus-chip">Constructs ${participant.constructs.length}${
                    Number(participant?.derivedBonuses?.machineConstructs?.maxActive || 0) > 0
                      ? ` / ${Number(participant.derivedBonuses.machineConstructs.maxActive)}`
                      : ''
                  }</span>`
                : ''
            }
          </div>
        </section>
        <section class="player-dashboard-card player-active-status-card">
          <div class="panel-header">
            <div>
              <h3>Active Effects</h3>
              <p class="muted">Round ${state.encounter.round}</p>
            </div>
            <label class="team-select-inline">
              Team
              <select data-player-team-select>
                ${renderPlayerTeamOptions(participant)}
              </select>
            </label>
          </div>
          ${renderPlayerActiveStatusSummary(participant)}
        </section>
      </div>
      <div class="player-dashboard-body">
        <div class="player-dashboard-side player-dashboard-side-primary">
          <section class="player-dashboard-card">
            <div class="panel-header">
              <h3>Stats</h3>
              <label class="player-proficiency-inline">Proficiency Bonus
                <input type="number" data-proficiency-input value="${participant.proficiencyBonus ?? 2}" />
              </label>
            </div>
            ${renderAbilityTable(participant)}
          </section>
          ${renderPlayerMitigationPanel(participant, manageState.mitigation)}
        </div>
        <div class="player-dashboard-side player-dashboard-side-secondary">
          <section class="player-dashboard-card player-compact-table-card">
            <div class="section-header">
              <h3>Saving Throws</h3>
              <button type="button" data-player-compact-toggle="saves">${savesExpanded ? 'Hide Prof' : 'Show Prof'}</button>
            </div>
            ${renderSavingThrows(participant, { expanded: savesExpanded })}
          </section>
          <section class="player-dashboard-card player-compact-table-card">
            <div class="section-header">
              <h3>Skills</h3>
              <button type="button" data-player-compact-toggle="skills">${skillsExpanded ? 'Hide Prof/Expert' : 'Show Prof/Expert'}</button>
            </div>
            ${renderSkillsTable(participant, { expanded: skillsExpanded })}
          </section>
        </div>
        <section class="player-dashboard-card player-tab-card">
          <div class="player-tab-bar" role="tablist" aria-label="Player dashboard sections">
            ${renderPlayerDashboardTabs(participant.id, activeTab)}
          </div>
          <div class="player-tab-panels">
            ${renderPlayerDashboardTabPanel(
              'standardActions',
              activeTab,
              renderPlayerStandardActionsTab(participant, showZoneSection, showConstructSection)
            )}
            ${renderPlayerDashboardTabPanel('cards', activeTab, renderPlayerCardsTab(participant))}
            ${renderPlayerDashboardTabPanel('inventory', activeTab, renderPlayerInventoryTab())}
            ${renderPlayerDashboardTabPanel(
              'journal',
              activeTab,
              `
                <section class="player-tab-section">
                  <div class="panel-header">
                    <h3>Journal</h3>
                  </div>
                  <div id="playerJournalContent" class="journal-columns"></div>
                </section>
              `
            )}
            ${renderPlayerDashboardTabPanel('notes', activeTab, renderPlayerNotesTab(participant))}
          </div>
        </section>
        <div class="player-abilities-bridge">
          ${renderPlayerAbilitiesPanel(participant, manageState.abilities)}
        </div>
      </div>
    </div>
  `;
  cachePlayerSectionRefs();
  wirePlayerSheetEvents(participant);
  restorePlayerSections(participant.id);
}

function renderPlayerDashboardTabs(participantId, activeTab) {
  const labels = {
    standardActions: 'Standard Actions',
    cards: 'Cards',
    inventory: 'Inventory',
    journal: 'Journal',
    notes: 'Notes'
  };
  return PLAYER_DASHBOARD_TABS.map(
    (tabId) => `
      <button
        type="button"
        class="player-tab-button ${tabId === activeTab ? 'is-active' : ''}"
        data-player-dashboard-tab="${tabId}"
        data-player-dashboard-owner="${participantId}"
        role="tab"
        aria-selected="${tabId === activeTab ? 'true' : 'false'}"
      >
        ${labels[tabId] || tabId}
      </button>
    `
  ).join('');
}

function renderPlayerDashboardTabPanel(tabId, activeTab, content) {
  return `
    <div class="player-tab-panel ${tabId === activeTab ? 'is-active' : ''}" data-player-tab-panel="${tabId}" role="tabpanel">
      ${content}
    </div>
  `;
}

function renderPlayerActiveStatusSummary(participant) {
  const entries = [];
  (participant.statuses || []).forEach((status) => {
    const stacks = Math.max(1, Number(status?.stacks || 1));
    const turns = Math.max(0, Number(status?.remainingTurns || 0));
    entries.push({
      label: `${status.name || 'Status'}${stacks > 1 ? ` ×${stacks}` : ''}`,
      meta: turns > 0 ? `${turns} turn${turns === 1 ? '' : 's'} left` : ''
    });
  });
  (participant.constructs || []).forEach((construct) => {
    const turns = Math.max(0, Number(construct?.remainingTurns || 0));
    entries.push({
      label: `Construct: ${construct.name || 'Construct'}`,
      meta: turns > 0 ? `${turns} turn${turns === 1 ? '' : 's'} left` : ''
    });
  });
  (participant.zones || []).forEach((zone) => {
    const turns = Math.max(0, Number(zone?.remainingTurns || 0));
    entries.push({
      label: `Zone: ${zone.name || 'Zone'}`,
      meta: turns > 0 ? `${turns} turn${turns === 1 ? '' : 's'} left` : ''
    });
  });
  if (!entries.length) {
    return '<p class="muted">No active statuses, constructs, or zones.</p>';
  }
  return `
    <div class="player-status-summary-list">
      ${entries
        .map(
          (entry) => `
            <article class="player-status-summary-card">
              <strong>${escapeHtml(entry.label)}</strong>
              ${entry.meta ? `<small>${escapeHtml(entry.meta)}</small>` : ''}
            </article>
          `
        )
        .join('')}
    </div>
  `;
}

function renderPlayerMitigationPanel(participant, manageMode = false) {
  return `
    <section class="player-dashboard-card">
      <div class="section-header">
        <h3>Resistances, Vulnerabilities, & Immunities</h3>
        <button type="button" data-player-toggle-mitigation-manage>${manageMode ? 'Done' : 'Manage'}</button>
      </div>
      ${renderPlayerDamageGroup('Resistances', participant.resistances, 'resistance', manageMode)}
      ${renderPlayerDamageGroup('Vulnerabilities', participant.vulnerabilities, 'vulnerability', manageMode)}
      ${renderPlayerDamageGroup('Immunities', getPlayerImmunityEntries(participant), 'immunity', manageMode)}
      ${
        manageMode
          ? `
            <div class="form-row">
              <form data-resistance-form class="stacked-form compact-form">
                <label class="compact-label">Add Resistance
                  <select name="resistance">
                    ${renderResistanceOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
              <form data-vulnerability-form class="stacked-form compact-form">
                <label class="compact-label">Add Vulnerability
                  <select name="vulnerability">
                    ${renderDamageTypeOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
              <form data-immunity-form class="stacked-form compact-form">
                <label class="compact-label">Add Immunity
                  <select name="immunity">
                    ${renderImmunityOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
            </div>
          `
          : ''
      }
    </section>
  `;
}

function renderPlayerAbilitiesPanel(participant, manageMode = false) {
  return `
    <section class="player-dashboard-card">
      <div class="section-header">
        <h3>Abilities</h3>
        <button type="button" data-player-toggle-ability-manage>${manageMode ? 'Done' : 'Manage'}</button>
      </div>
      <div class="ability-list">
        ${renderPlayerAbilityEntries(participant, manageMode)}
      </div>
      ${renderPlayerTextListEditor(
        'Proficiencies',
        participant.proficiencies || [],
        'proficiency',
        manageMode,
        getPlayerDerivedSetValues(participant, 'proficiencies')
      )}
      ${renderPlayerTextListEditor(
        'Languages',
        participant.languages || [],
        'language',
        manageMode,
        getPlayerDerivedSetValues(participant, 'languages')
      )}
      ${
        manageMode
          ? `
            <form data-player-ability-form class="stacked-form">
              <label>Name
                <input type="text" name="name" placeholder="Ability name" />
              </label>
              <label>Description
                <textarea name="description" rows="2" placeholder="Describe the ability..." required></textarea>
              </label>
              <button type="submit">Add Ability</button>
            </form>
          `
          : ''
      }
    </section>
  `;
}

function renderPlayerStandardActionsTab(participant, showZoneSection, showConstructSection) {
  return `
    <section class="player-tab-section">
      <div class="panel-header">
        <h3>Standard Actions</h3>
      </div>
      <label class="checkbox-row">
        <input type="checkbox" data-player-difficult />
        <span>Difficult terrain (Move = ${getPlayerMoveDistanceFt(participant, { difficultTerrain: true })} ft)</span>
      </label>
      <div class="standard-actions-grid">
        ${renderPlayerStandardActionButtons(participant)}
      </div>
    </section>
    ${renderPlayerStatusSection(participant)}
    ${showZoneSection ? renderPlayerZoneSection() : ''}
    ${showConstructSection ? renderPlayerConstructSection() : ''}
  `;
}

function renderPlayerCardsTab(participant) {
  const { active, total } = getPlayerCardBuckets(participant || {});
  return `
    <section class="player-tab-section">
      <div class="panel-header">
        <h3>Cards & Loadout</h3>
        <p class="muted">${active.length}/${MAX_ACTIVE_CARDS} active · ${total} total</p>
      </div>
      <div id="playerCardList" class="card-list empty-state">Cards for the selected combatant will show here.</div>
      <details id="playerCardDrawer" class="player-tool-drawer" data-player-card-details-key="cardTools">
        <summary><strong>Card Tools</strong></summary>
        <div class="collapsible-body">
          <div class="card-import">
            <label class="file-upload">
              Import Card
              <input type="file" id="playerImportCard" accept="application/json" />
            </label>
            <label class="file-upload">
              Import Card Deck
              <input type="file" id="playerImportDeck" accept="application/json" />
            </label>
            <p class="muted help-text">Upload single cards or a {"cards": []} deck file.</p>
          </div>
          <form id="playerCardForm" class="stacked-form">
            <div class="form-row">
              <label>Name
                <input type="text" name="name" required />
              </label>
              <label>Set
                <input type="text" name="set" placeholder="Machine" />
              </label>
              <label>Type
                <input type="text" name="type" placeholder="Attack" />
              </label>
              <label>Tier
                <input type="text" name="tier" placeholder="Common" />
              </label>
            </div>
            <div class="form-row">
              <label>AP Cost
                <input type="number" name="apCost" value="2" />
              </label>
              <label>Range
                <input type="number" name="range" value="5" />
              </label>
              <label>Health Bonus
                <input type="number" name="healthBonus" value="0" />
              </label>
              <label>Shield Bonus
                <input type="number" name="shieldBonus" placeholder="Auto by tier" />
              </label>
              <label>Damage
                <input type="number" name="damage" value="0" />
              </label>
              <label>Damage Type
                <select name="damageType">
                  ${renderDamageTypeOptions(true)}
                </select>
              </label>
              <label>Construct Duration
                <input type="number" name="constructDurationTurns" value="1" min="1" />
              </label>
            </div>
            <div class="form-row">
              <label>Construct Mode
                <select name="constructMode">
                  <option value="">Auto</option>
                  <option value="damage">Damage</option>
                  <option value="status">Status</option>
                  <option value="utility">Utility</option>
                </select>
              </label>
              <label>Construct Status
                <select name="constructStatusId">
                  <option value="">None</option>
                  ${renderStatusPresetOptions()}
                </select>
              </label>
              <label>Status Stacks
                <input type="number" name="constructStatusStacks" value="1" min="1" />
              </label>
            </div>
            <div class="form-row">
              <label>Max HP Bonus
                <input type="number" name="modMaxHp" value="0" />
              </label>
              <label>Max Shield Bonus
                <input type="number" name="modMaxShield" value="0" />
              </label>
              <label>AP Max Bonus
                <input type="number" name="modApMax" value="0" />
              </label>
            </div>
            <div class="form-row">
              <label>Guard Bonus
                <input type="number" name="modGuard" value="0" />
              </label>
              <label>Damage Bonus
                <input type="number" name="modDamage" value="0" />
              </label>
            </div>
            <label>Tags
              <input type="text" name="tags" placeholder="Melee, Shield" />
            </label>
            <label>Effect
              <textarea name="effect" rows="2" placeholder="Describe the effect"></textarea>
            </label>
            <div class="form-row">
              <label>Mastery to L2 uses
                <input type="number" name="masteryTo2" value="10" min="1" />
              </label>
              <label>Mastery to L3 uses
                <input type="number" name="masteryTo3" value="25" min="2" />
              </label>
              <label>Mastery to L4 uses
                <input type="number" name="masteryTo4" value="50" min="3" />
              </label>
            </div>
            <button type="submit">Add Card</button>
          </form>
        </div>
      </details>
    </section>
    ${renderPlayerSetSection(participant)}
  `;
}

function renderPlayerInventoryTab() {
  return `
    <section class="player-tab-section player-inventory-tab">
      <div class="player-inventory-grid">
        <section class="player-dashboard-card player-subpanel">
          <div class="section-header">
            <h3>Relics & Artifacts</h3>
            <button type="button" data-player-toggle-relic>Add Relic</button>
          </div>
          <div id="playerRelicList" class="relic-list empty-state">No relics yet.</div>
          <details id="playerRelicDrawer" class="player-tool-drawer" data-player-card-details-key="relicTools">
            <summary><strong>Relic Tools</strong></summary>
            <div class="collapsible-body">
              <div class="card-import">
                <label class="file-upload">
                  Import Relics
                  <input type="file" id="playerImportRelic" accept="application/json" />
                </label>
              </div>
              <form id="playerRelicForm" class="stacked-form">
                <div class="form-row">
                  <label>Name
                    <input type="text" name="name" required />
                  </label>
                  <label>HP Bonus
                    <input type="number" name="hp" value="0" />
                  </label>
                  <label>AP Bonus
                    <input type="number" name="ap" value="0" />
                  </label>
                </div>
                <div class="form-row">
                  <label>Ability Focus
                    <input type="text" name="ability" placeholder="Machine, Shield, etc." />
                  </label>
                  <label>Description
                    <input type="text" name="description" placeholder="What does it do?" />
                  </label>
                </div>
                <button type="submit">Add Relic</button>
              </form>
            </div>
          </details>
        </section>
        <section class="player-dashboard-card player-subpanel">
          <div class="section-header">
            <h3>Equipment</h3>
            <button type="button" data-player-toggle-equipment>Edit Equipment</button>
          </div>
          <div id="playerWeaponArmorList" class="relic-list">No equipment configured.</div>
          <details id="playerEquipmentDrawer" class="player-tool-drawer" data-player-card-details-key="equipmentTools">
            <summary><strong>Equipment Tools</strong></summary>
            <div class="collapsible-body">
              <div id="playerEquipmentEditor"></div>
            </div>
          </details>
        </section>
        <section class="player-dashboard-card player-subpanel">
          <div class="section-header">
            <h3>Items & Supplies</h3>
            <button type="button" data-player-toggle-inventory>Add Item</button>
          </div>
          <div id="playerInventoryList" class="relic-list empty-state">No inventory items yet.</div>
          <form id="playerInventoryForm" class="stacked-form hidden">
            <div class="form-row">
              <label>Item
                <input type="text" name="name" placeholder="Potion" required />
              </label>
              <label>Qty
                <input type="number" name="quantity" min="1" value="1" />
              </label>
            </div>
            <label>Description
              <input type="text" name="description" placeholder="Optional details" />
            </label>
            <label>Tags
              <input type="text" name="tags" placeholder="Consumable, Quest, Crafting, Weapon, Armour" />
            </label>
            <button type="submit">Add Item</button>
          </form>
        </section>
        <section class="player-dashboard-card player-subpanel">
          <div class="section-header">
            <h3>Currencies</h3>
            <button type="button" data-player-toggle-currency>Add Currency</button>
          </div>
          <div id="playerCurrencyList" class="relic-list empty-state">No currencies yet.</div>
          <form id="playerCurrencyForm" class="stacked-form hidden">
            <div class="form-row">
              <label>Name
                <input type="text" name="name" placeholder="Gold" required />
              </label>
              <label>Starting Amount
                <input type="number" name="amount" min="0" value="0" />
              </label>
            </div>
            <button type="submit">Add Currency</button>
          </form>
        </section>
      </div>
    </section>
  `;
}

function renderPlayerNotesTab(participant) {
  return `
    <section class="player-tab-section">
      <div class="section-header">
        <h3>Notes</h3>
        <button type="button" data-player-save-notes>Save</button>
      </div>
      <textarea data-player-notes rows="14" placeholder="Add notes for the GM or reminders">${participant.notes || ''}</textarea>
    </section>
  `;
}

function renderCharacterCreator() {
  els.stats.innerHTML = `
    <div class="panel player-sheet">
      <div class="panel-header">
        <div>
          <h2>Create Character</h2>
          <p class="muted">Fill out the base character details, stats, and proficiencies to add this character to the encounter.</p>
        </div>
      </div>
      <form id="playerCreateForm" class="stacked-form">
        <div class="form-row">
          <label>Character Preset
            <select name="characterPresetId" data-player-character-preset>
              ${renderCharacterPresetOptions(true)}
            </select>
          </label>
          <button type="button" data-player-create-from-preset>Create From Preset</button>
        </div>
        <p class="muted small-note">Use a saved preset for standard NPCs or previously built characters, or fill the form manually below.</p>
        <div class="form-row">
          <label>Name
            <input type="text" name="name" placeholder="New Character" required />
          </label>
          <label>Set Focus
            <input type="text" name="setFocus" placeholder="Machine, Elemental..." />
          </label>
        </div>
        <div class="form-row">
          <label>Max HP
            <input type="number" name="maxHp" value="20" />
          </label>
          <label>Max Shield
            <input type="number" name="maxShield" value="0" />
          </label>
          <label>Max AP
            <input type="number" name="apMax" value="6" />
          </label>
        </div>
        <div class="form-row">
          <label>Proficiency Bonus
            <input type="number" name="proficiencyBonus" value="2" />
          </label>
          <label>Team
            <select name="team">
              <option value="">Unassigned</option>
              <option value="Team 1">Team 1</option>
              <option value="Team 2">Team 2</option>
              <option value="Team 3">Team 3</option>
              <option value="Team 4">Team 4</option>
            </select>
          </label>
        </div>
        <div class="ability-input-grid">
          ${ABILITIES.map(
            ({ key, label }) => `
              <label>${label}
                <input type="number" name="${key}" value="10" />
              </label>`
          ).join('')}
        </div>
        <div class="player-create-grid">
          <section class="player-create-section">
            <div class="player-create-section-header">
              <h3>Saving Throw Proficiencies</h3>
              <small class="muted">Typical baseline: choose 2.</small>
            </div>
            <div class="player-create-option-grid player-create-option-grid-compact">
              ${ABILITIES.map(
                ({ key, label }) => `
                  <label class="checkbox-row player-create-check">
                    <input type="checkbox" name="savingThrowProficiencies" value="${key}" />
                    <span>${label}</span>
                  </label>`
              ).join('')}
            </div>
          </section>
          <section class="player-create-section">
            <div class="player-create-section-header">
              <h3>Skill Proficiencies</h3>
              <small class="muted">Typical baseline: choose 5. Expert is optional.</small>
            </div>
            <div class="player-create-option-grid">
              ${SKILLS.map(
                ([skill, ability, key]) => `
                  <div class="player-create-skill-row">
                    <div class="player-create-skill-meta">
                      <strong>${escapeHtml(skill)}</strong>
                      <small class="muted">${abilityLabel(ability)}</small>
                    </div>
                    <label class="checkbox-row player-create-check">
                      <input type="checkbox" name="skillProficiencies" value="${key}" />
                      <span>Prof</span>
                    </label>
                    <label class="checkbox-row player-create-check">
                      <input type="checkbox" name="skillExpertise" value="${key}" />
                      <span>Expert</span>
                    </label>
                  </div>`
              ).join('')}
            </div>
          </section>
        </div>
        <div class="form-row">
          <label>Proficiencies
            <input type="text" name="proficiencies" placeholder="Light Armour, Herbalism Kit, Smith's Tools" />
          </label>
          <label>Languages
            <input type="text" name="languages" placeholder="Common, Elvish" />
          </label>
        </div>
        <div class="player-create-grid">
          <section class="player-create-section">
            <div class="player-create-section-header">
              <h3>Equipment</h3>
              <small class="muted">Optional starting weapon, armour, and shield.</small>
            </div>
            <div class="stacked-form">
              <div class="damage-group-header">
                <h4>Weapon</h4>
              </div>
              <div class="form-row">
                <label>Name
                  <input type="text" name="weaponName" placeholder="Iron Sword" />
                </label>
                <label>Style
                  <select name="weaponStyle">
                    ${renderEquipmentSelectOptions(WEAPON_STYLE_OPTIONS, 'melee')}
                  </select>
                </label>
                <label>Hands
                  <select name="weaponHands">
                    <option value="1" selected>1</option>
                    <option value="2">2</option>
                  </select>
                </label>
              </div>
              <div class="form-row">
                <label>Basic AP
                  <input type="number" name="weaponBasicAttackApCost" value="2" min="0" />
                </label>
                <label>Basic Damage
                  <input type="number" name="weaponBasicAttackDamage" value="" min="0" placeholder="0" />
                </label>
                <label>Damage Type
                  <select name="weaponDamageType">
                    ${renderEquipmentDamageTypeOptions('Slashing')}
                  </select>
                </label>
              </div>
              <div class="form-row">
                <label>Card Bonus
                  <input type="number" name="weaponCardBonusDamage" value="" min="0" placeholder="Auto by weapon type" />
                </label>
                <label>Requirement
                  <select name="weaponRequirementAbility">
                    ${renderEquipmentSelectOptions(REQUIREMENT_ABILITY_OPTIONS, 'none')}
                  </select>
                </label>
                <label>Req Score
                  <input type="number" name="weaponRequirementScore" value="" min="0" placeholder="Optional" />
                </label>
              </div>
              <label>Proficiency Group
                <input type="text" name="weaponProficiencyGroup" placeholder="Melee Weapons, Arcane Implements..." />
              </label>
              <div class="damage-group-header">
                <h4>Armour</h4>
              </div>
              <div class="form-row">
                <label>Name
                  <input type="text" name="armorName" placeholder="Chain Shirt" />
                </label>
                <label>Type
                  <select name="armorType">
                    ${renderEquipmentSelectOptions(ARMOR_TYPE_OPTIONS, 'light')}
                  </select>
                </label>
              </div>
              <div class="damage-group-header">
                <h4>Shield</h4>
              </div>
              <label>Name
                <input type="text" name="shieldName" placeholder="Tower Shield" />
              </label>
            </div>
          </section>
        </div>
        <label>Resistances
          <select name="resistances" multiple size="6">
            ${renderResistanceOptions(false)}
          </select>
          <small class="muted">Use Cmd/Ctrl-click to select multiple.</small>
        </label>
        <label>Vulnerabilities
          <select name="vulnerabilities" multiple size="6">
            ${renderDamageTypeOptions(false)}
          </select>
          <small class="muted">Use Cmd/Ctrl-click to select multiple.</small>
        </label>
        <label>Immunities
          <select name="immunities" multiple size="8">
            ${renderImmunityOptions(false)}
          </select>
          <small class="muted">Use Cmd/Ctrl-click to select multiple.</small>
        </label>
        <label>Notes
          <textarea name="notes" rows="2" placeholder="Backstory, reminders, etc."></textarea>
        </label>
        <button type="submit" class="primary">Create Character</button>
      </form>
    </div>
  `;
  wireCharacterCreator();
}

function renderPlayerVital(label, value, max, key) {
  if (typeof max === 'number') {
    return `
      <div class="vital-card">
        <h4>${label}</h4>
        <div class="value">${value} / ${max}</div>
        ${key ? renderInlineAdjust(key) : ''}
      </div>`;
  }
  return `
    <div class="vital-card">
      <h4>${label}</h4>
      <div class="value">${value}</div>
    </div>`;
}

function renderPlayerConstructVital(participant) {
  if (!participantHasActiveConstructCard(participant)) {
    return '';
  }
  const constructs = participant?.constructs || [];
  const cap = Number(participant?.derivedBonuses?.machineConstructs?.maxActive || 1);
  const names = constructs.map((entry) => entry.name).filter(Boolean);
  const label = names.length ? names.join(', ') : 'None active';
  return `
    <div class="vital-card">
      <h4>Constructs</h4>
      <div class="value">${constructs.length} / ${cap}</div>
      <small class="muted">${escapeHtml(label)}</small>
    </div>
  `;
}

function cachePlayerSectionRefs() {
  els.cardList = document.getElementById('playerCardList');
  els.cardForm = document.getElementById('playerCardForm');
  els.cardDrawer = document.getElementById('playerCardDrawer');
  els.importCardFile = document.getElementById('playerImportCard');
  els.importDeckFile = document.getElementById('playerImportDeck');
  els.importRelicFile = document.getElementById('playerImportRelic');
  els.journalContent = document.getElementById('playerJournalContent');
}

function renderPlayerTurnTrack() {
  const entries = getPlayerTurnEntries();
  if (!entries.length) return '';
  return `
    <div class="player-turn-track">
      ${entries
        .map(
          (entry, index) => `
            <div class="turn-pill ${(state.encounter.currentTurnKey && getPlayerTurnEntryKey(entry) === state.encounter.currentTurnKey) || (!state.encounter.currentTurnKey && index === (state.encounter.currentIndex ?? -1)) ? 'is-active' : ''} ${entry.participantId === focusId ? 'is-focus' : ''}">
              <span>${escapeHtml(
                entry.kind === 'zone'
                  ? `${entry.zone?.name || 'Zone'}`
                  : entry.kind === 'construct'
                    ? `${entry.construct?.name || 'Construct'} (${entry.participant?.name || 'Owner'})`
                    : entry.participant?.name || 'Combatant'
              )}</span>
            </div>`
        )
        .join('')}
    </div>
  `;
}

function getPlayerTurnEntryKey(entry = {}) {
  if (entry.kind === 'construct') {
    return `construct:${entry.participantId}:${entry.constructId}`;
  }
  if (entry.kind === 'zone') {
    return `zone:${entry.participantId}:${entry.zoneId}`;
  }
  return `participant:${entry.participantId}`;
}

function playerConstructHasManualTurn(construct = {}) {
  return construct?.manualTurns === true || (Array.isArray(construct?.cardObjects) && construct.cardObjects.length > 0);
}

function getPlayerTurnEntries() {
  const entries = [];
  for (const participant of state.encounter.participants || []) {
    entries.push({ kind: 'participant', participantId: participant.id, participant, zone: null });
    for (const construct of participant.constructs || []) {
      if (!construct?.id || !playerConstructHasManualTurn(construct)) continue;
      entries.push({
        kind: 'construct',
        participantId: participant.id,
        constructId: construct.id,
        participant,
        construct,
        zone: null
      });
    }
    for (const zone of participant.zones || []) {
      entries.push({
        kind: 'zone',
        participantId: participant.id,
        zoneId: zone.id,
        participant,
        zone
      });
    }
  }
  return entries;
}

function wireCharacterCreator() {
  const form = document.getElementById('playerCreateForm');
  if (!form) return;
  form.querySelector('[data-player-create-from-preset]')?.addEventListener('click', async () => {
    const presetId = String(form.querySelector('[data-player-character-preset]')?.value || '').trim();
    if (!presetId) {
      notify('Select a character preset.');
      return;
    }
    try {
      const result = await api(`/api/presets/characters/${presetId}/spawn`, 'POST');
      if (result?.participant?.id) {
        focusId = result.participant.id;
        createMode = false;
        updateUrl({ create: false });
        fetchState();
        notify('Character created from preset.');
      }
    } catch (err) {
      notify(`Preset creation failed: ${err.message}`);
    }
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = buildParticipantFromCreateForm(formData);
    try {
      const result = await api('/api/import/participant', 'POST', { participant: payload });
      if (result?.participant?.id) {
        focusId = result.participant.id;
        createMode = false;
        updateUrl({ create: false });
        fetchState();
        notify('Character created.');
      }
    } catch (err) {
      notify(`Creation failed: ${err.message}`);
    }
  };
}

function buildParticipantFromCreateForm(formData) {
  const stats = {};
  ABILITIES.forEach(({ key }) => {
    stats[key] = Number(formData.get(key) || 0);
  });
  const savingThrows = {};
  const selectedSavingThrows = new Set(
    formData.getAll('savingThrowProficiencies').map((value) => String(value || '').trim()).filter(Boolean)
  );
  ABILITIES.forEach(({ key }) => {
    savingThrows[key] = selectedSavingThrows.has(key);
  });
  const proficientSkills = new Set(
    formData.getAll('skillProficiencies').map((value) => String(value || '').trim()).filter(Boolean)
  );
  const expertSkills = new Set(
    formData.getAll('skillExpertise').map((value) => String(value || '').trim()).filter(Boolean)
  );
  const skills = {};
  SKILLS.forEach(([, , key]) => {
    const expert = expertSkills.has(key);
    const proficient = expert || proficientSkills.has(key);
    skills[key] = { proficient, expert };
  });
  const proficiencyBonus = Number(formData.get('proficiencyBonus') || 0);
  const maxHp = Number(formData.get('maxHp') || 0);
  const maxShield = Number(formData.get('maxShield') || 0);
  const apMax = Number(formData.get('apMax') || 0);
  const resistances = dedupeTypes(formData.getAll('resistances'));
  const vulnerabilities = dedupeTypes(formData.getAll('vulnerabilities'));
  const immunities = dedupeTypes(formData.getAll('immunities'));
  return {
    name: formData.get('name')?.trim() || 'New Character',
    team: formData.get('team') || '',
    setFocus: formData.get('setFocus') || '',
    maxHp,
    maxShield,
    apMax,
    proficiencyBonus,
    stats,
    savingThrows,
    skills,
    equipment: buildEquipmentPayloadFromCreateForm(formData),
    proficiencies: normalizeTextInputList(formData.get('proficiencies')),
    languages: normalizeTextInputList(formData.get('languages')),
    notes: formData.get('notes') || '',
    resistances,
    vulnerabilities,
    immunities
  };
}

function normalizeTextInputList(value) {
  return String(value || '')
    .split(/,|\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function renderEquipmentSelectOptions(options = [], selectedValue = '') {
  return options
    .map(({ value, label }) => `<option value="${value}" ${String(selectedValue || '') === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function renderEquipmentDamageTypeOptions(selectedValue = '', allowBlank = false) {
  const options = allowBlank ? ['<option value="">None</option>'] : [];
  options.push(
    ...DAMAGE_TYPES.map(
      (type) => `<option value="${type}" ${String(selectedValue || '') === type ? 'selected' : ''}>${type}</option>`
    )
  );
  return options.join('');
}

function getPlayerEquipmentSummary(participant = {}) {
  return participant?.derivedBonuses?.equipment || {
    weapon: participant?.equipment?.weapon || null,
    armor: participant?.equipment?.armor || null,
    shield: participant?.equipment?.shield || null,
    moveApCost: 1,
    shieldRegen: 0,
    weaponApPenalty: 0,
    weaponPenaltyReasons: [],
    canHide: true
  };
}

function buildEquipmentSlotPayloadFromFormData(formData, slot = '') {
  const readOptionalNumber = (name) => {
    const raw = String(formData.get(name) ?? '').trim();
    return raw ? Number(raw) : undefined;
  };
  if (slot === 'weapon') {
    const name = String(formData.get('weaponName') || '').trim();
    if (!name) return null;
    return {
      name,
      weaponStyle: String(formData.get('weaponStyle') || 'melee'),
      basicAttackDamage: readOptionalNumber('weaponBasicAttackDamage'),
      basicAttackApCost: readOptionalNumber('weaponBasicAttackApCost'),
      basicAttackDamageType: String(formData.get('weaponDamageType') || ''),
      cardBonusDamage: readOptionalNumber('weaponCardBonusDamage'),
      requirementAbility: String(formData.get('weaponRequirementAbility') || 'none'),
      requirementScore: readOptionalNumber('weaponRequirementScore'),
      hands: readOptionalNumber('weaponHands'),
      proficiencyGroup: String(formData.get('weaponProficiencyGroup') || '').trim()
    };
  }
  if (slot === 'armor') {
    const name = String(formData.get('armorName') || '').trim();
    if (!name) return null;
    return {
      name,
      armorType: String(formData.get('armorType') || 'light')
    };
  }
  if (slot === 'shield') {
    const name = String(formData.get('shieldName') || '').trim();
    if (!name) return null;
    return { name };
  }
  return null;
}

function buildEquipmentPayloadFromCreateForm(formData) {
  return {
    weapon: buildEquipmentSlotPayloadFromFormData(formData, 'weapon'),
    armor: buildEquipmentSlotPayloadFromFormData(formData, 'armor'),
    shield: buildEquipmentSlotPayloadFromFormData(formData, 'shield')
  };
}

function renderPlayerEquipmentSlotCard(title, item = null, lines = []) {
  if (!item) {
    return `
      <article class="relic-card">
        <h4>${title}</h4>
        <p class="muted">None equipped.</p>
      </article>
    `;
  }
  return `
    <article class="relic-card">
      <h4>${escapeHtml(item.name || title)}</h4>
      <p><strong>${title}</strong></p>
      ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
    </article>
  `;
}

function renderPlayerEquipmentSummary(participant = {}) {
  const summary = getPlayerEquipmentSummary(participant);
  const weapon = summary.weapon;
  const armor = summary.armor;
  const shield = summary.shield;
  const weaponLines = weapon
    ? [
        `${String(weapon.weaponStyle || '').replace(/^./, (char) => char.toUpperCase()) || 'Weapon'}${hasWeaponBasicAttack(weapon) ? ` · ${Number(weapon.basicAttackApCost || 0)} AP / ${Number(weapon.basicAttackDamage || 0)} ${weapon.basicAttackDamageType || 'damage'}` : ' · No basic attack'}`,
        `Card Bonus +${Number(weapon.cardBonusDamage || 0)} · ${weapon.proficiencyGroup || 'No proficiency group'}`,
        summary.weaponPenaltyReasons?.length ? `Penalty: +${Number(summary.weaponApPenalty || 0)} AP (${summary.weaponPenaltyReasons.join(', ')})` : 'Penalty: none'
      ]
    : [];
  const armorLines = armor
    ? [
        `${String(armor.armorType || '').replace(/^./, (char) => char.toUpperCase())} Armour`,
        `Shield +${Number(armor.maxShieldBonus || 0)} · Regen +${Number(armor.shieldRegen || 0)}/turn`,
        Number(armor.dexterityPenalty || 0) > 0 ? `DEX ${formatSignedValue(-Number(armor.dexterityPenalty || 0))}` : 'DEX unchanged'
      ]
    : [];
  const shieldLines = shield
    ? [
        `Shield +${Number(shield.maxShieldBonus || 0)} · Regen +${Number(shield.shieldRegen || 0)}/turn`,
        'Uses 1 hand'
      ]
    : [];
  const notes = [];
  notes.push(`Hands ${Number(summary.handsUsed || 0)}/${Number(summary.handsAvailable || 2)}`);
  notes.push(`Shield Regen ${Number(summary.shieldRegen || 0)}/turn`);
  if (Number(summary.moveApCost || 1) > 1) {
    notes.push(`Move actions cost ${Number(summary.moveApCost || 1)} AP`);
  }
  if (summary.canHide === false) {
    notes.push('Cannot become Hidden');
  }
  return `
    <div class="cards-grid player-card-grid">
      ${renderPlayerEquipmentSlotCard('Weapon', weapon, weaponLines)}
      ${renderPlayerEquipmentSlotCard('Armour', armor, armorLines)}
      ${renderPlayerEquipmentSlotCard('Shield', shield, shieldLines)}
    </div>
    <div class="player-bonus-strip">
      ${notes.map((note) => `<span class="player-bonus-chip">${escapeHtml(note)}</span>`).join('')}
    </div>
  `;
}

function renderPlayerEquipmentEditor(participant = {}) {
  const summary = getPlayerEquipmentSummary(participant);
  const weapon = summary.weapon || {};
  const armor = summary.armor || {};
  const shield = summary.shield || {};
  return `
    <div class="stacked-form">
      <form data-player-equipment-form="weapon" class="stacked-form">
        <div class="damage-group-header">
          <h4>Weapon</h4>
        </div>
        <div class="form-row">
          <label>Name
            <input type="text" name="weaponName" value="${escapeHtml(weapon.name || '')}" placeholder="Iron Sword" />
          </label>
          <label>Style
            <select name="weaponStyle">
              ${renderEquipmentSelectOptions(WEAPON_STYLE_OPTIONS, weapon.weaponStyle || 'melee')}
            </select>
          </label>
          <label>Hands
            <select name="weaponHands">
              <option value="1" ${Number(weapon.hands || 1) === 1 ? 'selected' : ''}>1</option>
              <option value="2" ${Number(weapon.hands || 1) === 2 ? 'selected' : ''}>2</option>
            </select>
          </label>
        </div>
        <div class="form-row">
          <label>Basic AP
            <input type="number" name="weaponBasicAttackApCost" value="${Number(weapon.basicAttackApCost ?? 2)}" min="0" />
          </label>
          <label>Basic Damage
            <input type="number" name="weaponBasicAttackDamage" value="${weapon.basicAttackDamage ?? ''}" min="0" placeholder="0" />
          </label>
          <label>Damage Type
            <select name="weaponDamageType">
              ${renderEquipmentDamageTypeOptions(weapon.basicAttackDamageType || 'Slashing')}
            </select>
          </label>
        </div>
        <div class="form-row">
          <label>Card Bonus
            <input type="number" name="weaponCardBonusDamage" value="${weapon.cardBonusDamage ?? ''}" min="0" placeholder="Auto by weapon type" />
          </label>
          <label>Requirement
            <select name="weaponRequirementAbility">
              ${renderEquipmentSelectOptions(REQUIREMENT_ABILITY_OPTIONS, weapon.requirementAbility || 'none')}
            </select>
          </label>
          <label>Req Score
            <input type="number" name="weaponRequirementScore" value="${weapon.requirementScore ?? ''}" min="0" placeholder="Optional" />
          </label>
        </div>
        <label>Proficiency Group
          <input type="text" name="weaponProficiencyGroup" value="${escapeHtml(weapon.proficiencyGroup || '')}" placeholder="Melee Weapons, Arcane Implements..." />
        </label>
        <div class="card-actions">
          <button type="submit">Save Weapon</button>
          <button type="button" data-player-clear-equipment="weapon">Clear Weapon</button>
        </div>
      </form>
      <form data-player-equipment-form="armor" class="stacked-form">
        <div class="damage-group-header">
          <h4>Armour</h4>
        </div>
        <div class="form-row">
          <label>Name
            <input type="text" name="armorName" value="${escapeHtml(armor.name || '')}" placeholder="Chain Shirt" />
          </label>
          <label>Type
            <select name="armorType">
              ${renderEquipmentSelectOptions(ARMOR_TYPE_OPTIONS, armor.armorType || 'light')}
            </select>
          </label>
        </div>
        <div class="card-actions">
          <button type="submit">Save Armour</button>
          <button type="button" data-player-clear-equipment="armor">Clear Armour</button>
        </div>
      </form>
      <form data-player-equipment-form="shield" class="stacked-form">
        <div class="damage-group-header">
          <h4>Shield</h4>
        </div>
        <label>Name
          <input type="text" name="shieldName" value="${escapeHtml(shield.name || '')}" placeholder="Tower Shield" />
        </label>
        <div class="card-actions">
          <button type="submit">Save Shield</button>
          <button type="button" data-player-clear-equipment="shield">Clear Shield</button>
        </div>
      </form>
    </div>
  `;
}

function renderPlayerWeaponAttackPanel(participant = {}) {
  const summary = getPlayerEquipmentSummary(participant);
  const weapon = summary.weapon;
  if (!weapon) {
    return '<p class="muted small-note">No weapon equipped.</p>';
  }
  if (!hasWeaponBasicAttack(weapon)) {
    return `<p class="muted small-note">${escapeHtml(weapon.name || 'Equipped implement')} has no basic attack. Matching Spell cards still gain its card bonus.</p>`;
  }
  const targets = getPlayerEncounterTargetables()
    .filter((entry) => entry.id !== participant.id)
    .filter((entry) => isPlayerEnemyForUi(participant, entry))
    .map((entry) => `<option value="${entry.id}">${escapeHtml(formatPlayerTargetableLabel(entry))}</option>`)
    .join('');
  const apCost = Math.max(1, Number(weapon.basicAttackApCost || 0) + Math.max(0, Number(summary.weaponApPenalty || 0)));
  return `
    <div class="damage-group">
      <div class="damage-group-header">
        <h4>Weapon Attack</h4>
        <small class="muted">${escapeHtml(weapon.name || 'Weapon')} · ${Number(weapon.basicAttackDamage || 0)} ${escapeHtml(weapon.basicAttackDamageType || 'damage')}</small>
      </div>
      <div class="form-row">
        <label>Target
          <select data-player-weapon-target>
            <option value="">Select target…</option>
            ${targets}
          </select>
        </label>
        <button type="button" data-player-weapon-attack>Basic Attack (${apCost} AP)</button>
      </div>
      <p class="muted small-note">
        Card Bonus +${Number(weapon.cardBonusDamage || 0)} on matching ${escapeHtml(summary.weaponMatchType || 'weapon')} cards
        ${summary.weaponPenaltyReasons?.length ? ` · Penalty +${Number(summary.weaponApPenalty || 0)} AP (${escapeHtml(summary.weaponPenaltyReasons.join(', '))})` : ''}
      </p>
    </div>
  `;
}

function renderPlayerStandardActionsSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="standardActions">
      <summary><strong>Standard Actions</strong></summary>
      <div class="collapsible-body">
        ${renderPlayerWeaponAttackPanel(participant)}
        <label class="checkbox-row">
          <input type="checkbox" data-player-difficult />
          <span>Difficult terrain (Move = ${getPlayerMoveDistanceFt(participant, { difficultTerrain: true })} ft)</span>
        </label>
        <div class="standard-actions-grid">
          ${renderPlayerStandardActionButtons(participant)}
        </div>
      </div>
    </details>
  `;
}

function renderPlayerStandardActionButtons(participant) {
  const actionsById = new Map((state.reference?.standardActions || []).map((action) => [action.id, action]));
  const order = ['move', 'disengage', 'half_cover', 'interact', 'recover', 'cleanse', 'guard'];
  const actions = order.map((id) => actionsById.get(id)).filter(Boolean);
  if (!actions.length) {
    return '<p class="empty-state">Standard actions will appear once the server boots.</p>';
  }
  return actions
    .map(
      (action) => `
      <div class="standard-action-item">
        <button type="button" data-player-standard="${action.id}">${action.label} (${action.id === 'move' ? Math.max(1, Number(getPlayerEquipmentSummary(participant).moveApCost || 1)) : action.apCost} AP)</button>
        <small class="muted small-note">${escapeHtml(getPlayerStandardActionSummary(action, participant))}</small>
      </div>`
    )
    .join('');
}

function renderPlayerCardsSection(participant) {
  const { active, total } = getPlayerCardBuckets(participant || {});
  return `
    <details class="player-collapsible" data-player-section="cards">
      <summary><strong>Cards & Loadout (${active.length}/${MAX_ACTIVE_CARDS} active · ${total} total)</strong></summary>
      <div class="collapsible-body">
        <div id="playerCardList" class="card-list empty-state">Cards for the selected combatant will show here.</div>
        <details id="playerCardDrawer">
          <summary>Card Tools</summary>
          <div class="card-import">
            <label class="file-upload">
              Import Card
              <input type="file" id="playerImportCard" accept="application/json" />
            </label>
            <label class="file-upload">
              Import Card Deck
              <input type="file" id="playerImportDeck" accept="application/json" />
            </label>
            <p class="muted help-text">Upload single cards or a {"cards": []} deck file.</p>
          </div>
          <form id="playerCardForm" class="stacked-form">
            <div class="form-row">
              <label>Name
                <input type="text" name="name" required />
              </label>
              <label>Set
                <input type="text" name="set" placeholder="Machine" />
              </label>
              <label>Type
                <input type="text" name="type" placeholder="Attack" />
              </label>
              <label>Tier
                <input type="text" name="tier" placeholder="Common" />
              </label>
            </div>
            <div class="form-row">
              <label>AP Cost
                <input type="number" name="apCost" value="2" />
              </label>
              <label>Range
                <input type="number" name="range" value="5" />
              </label>
              <label>Health Bonus
                <input type="number" name="healthBonus" value="0" />
              </label>
              <label>Shield Bonus
                <input type="number" name="shieldBonus" placeholder="Auto by tier" />
              </label>
              <label>Damage
                <input type="number" name="damage" value="0" />
              </label>
              <label>Damage Type
                <select name="damageType">
                  ${renderDamageTypeOptions(true)}
                </select>
              </label>
              <label>Construct Duration
                <input type="number" name="constructDurationTurns" value="1" min="1" />
              </label>
            </div>
            <div class="form-row">
              <label>Construct Mode
                <select name="constructMode">
                  <option value="">Auto</option>
                  <option value="damage">Damage</option>
                  <option value="status">Status</option>
                  <option value="utility">Utility</option>
                </select>
              </label>
              <label>Construct Status
                <select name="constructStatusId">
                  <option value="">None</option>
                  ${renderStatusPresetOptions()}
                </select>
              </label>
              <label>Status Stacks
                <input type="number" name="constructStatusStacks" value="1" min="1" />
              </label>
            </div>
            <div class="form-row">
              <label>Max HP Bonus
                <input type="number" name="modMaxHp" value="0" />
              </label>
              <label>Max Shield Bonus
                <input type="number" name="modMaxShield" value="0" />
              </label>
              <label>AP Max Bonus
                <input type="number" name="modApMax" value="0" />
              </label>
            </div>
            <div class="form-row">
              <label>Guard Bonus
                <input type="number" name="modGuard" value="0" />
              </label>
              <label>Damage Bonus
                <input type="number" name="modDamage" value="0" />
              </label>
            </div>
            <label>Tags
              <input type="text" name="tags" placeholder="Melee, Shield" />
            </label>
            <label>Effect
              <textarea name="effect" rows="2" placeholder="Describe the effect"></textarea>
            </label>
            <div class="form-row">
              <label>Mastery to L2 uses
                <input type="number" name="masteryTo2" value="10" min="1" />
              </label>
              <label>Mastery to L3 uses
                <input type="number" name="masteryTo3" value="25" min="2" />
              </label>
              <label>Mastery to L4 uses
                <input type="number" name="masteryTo4" value="50" min="3" />
              </label>
            </div>
            <button type="submit">Add Card</button>
          </form>
        </details>
      </div>
    </details>
  `;
}

function renderPlayerStatusSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="statuses">
      <summary><strong>Active Effects</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Active Effects</h4>
          <button type="button" data-player-toggle-status>Manage</button>
        </div>
        <div class="status-list">${renderStatuses(participant)}</div>
        ${renderPlayerStatusForm()}
      </div>
    </details>
  `;
}

function renderPlayerZoneSection() {
  return `
    <details class="player-collapsible" data-player-section="zones">
      <summary><strong>Zones</strong></summary>
      <div class="collapsible-body">
        <div id="playerZoneList" class="card-list empty-state">No active zones.</div>
      </div>
    </details>
  `;
}

function renderPlayerDamageSection(participant, manageMode = false) {
  return `
    <details class="player-collapsible" data-player-section="mitigation">
      <summary><strong>Resistances, Vulnerabilities, & Immunities</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Resistances, Vulnerabilities, & Immunities</h4>
          <button type="button" data-player-toggle-mitigation-manage>${manageMode ? 'Done' : 'Manage'}</button>
        </div>
        ${renderPlayerDamageGroup('Resistances', participant.resistances, 'resistance', manageMode)}
        ${renderPlayerDamageGroup('Vulnerabilities', participant.vulnerabilities, 'vulnerability', manageMode)}
        ${renderPlayerDamageGroup('Immunities', getPlayerImmunityEntries(participant), 'immunity', manageMode)}
        ${
          manageMode
            ? `
            <div class="form-row">
              <form data-resistance-form class="stacked-form compact-form">
                <label class="compact-label">Add Resistance
                  <select name="resistance">
                    ${renderResistanceOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
              <form data-vulnerability-form class="stacked-form compact-form">
                <label class="compact-label">Add Vulnerability
                  <select name="vulnerability">
                    ${renderDamageTypeOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
              <form data-immunity-form class="stacked-form compact-form">
                <label class="compact-label">Add Immunity
                  <select name="immunity">
                    ${renderImmunityOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
            </div>
          `
            : ''
        }
      </div>
    </details>
  `;
}

function renderPlayerDamageGroup(label, values = [], key, manageMode = false) {
  const entries = (values || []).map((value, index) =>
    typeof value === 'object' && value !== null
      ? {
          label: String(value.label || '').trim(),
          removeIndex: Number.isInteger(value.removeIndex) ? value.removeIndex : index,
          removable: value.removable !== false
        }
      : {
          label: String(value || '').trim(),
          removeIndex: index,
          removable: true
        }
  );
  const list = entries
    .filter((entry) => entry.label)
    .map(
      (entry) => `
        <span class="tag-pill">
          ${escapeHtml(entry.label)}
          ${manageMode && entry.removable ? `<button type="button" aria-label="Remove" data-player-remove-${key}="${entry.removeIndex}">×</button>` : ''}
        </span>`
    )
    .join('');
  return `
    <div class="damage-group">
      <div class="damage-group-header">
        <h4>${label}</h4>
      </div>
      <div class="tag-list">
        ${list || '<span class="muted">None</span>'}
      </div>
    </div>
  `;
}

function renderPlayerAbilitiesSection(participant, manageMode = false) {
  return `
    <details class="player-collapsible" data-player-section="abilitiesText">
      <summary><strong>Abilities</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Abilities</h4>
          <button type="button" data-player-toggle-ability-manage>${manageMode ? 'Done' : 'Manage'}</button>
        </div>
        <div class="ability-list">
          ${renderPlayerAbilityEntries(participant, manageMode)}
        </div>
        ${renderPlayerTextListEditor(
          'Proficiencies',
          participant.proficiencies || [],
          'proficiency',
          manageMode,
          getPlayerDerivedSetValues(participant, 'proficiencies')
        )}
        ${renderPlayerTextListEditor(
          'Languages',
          participant.languages || [],
          'language',
          manageMode,
          getPlayerDerivedSetValues(participant, 'languages')
        )}
        ${
          manageMode
            ? `
            <form data-player-ability-form class="stacked-form">
              <label>Name
                <input type="text" name="name" placeholder="Ability name" />
              </label>
              <label>Description
                <textarea name="description" rows="2" placeholder="Describe the ability..." required></textarea>
              </label>
              <button type="submit">Add Ability</button>
            </form>
          `
            : ''
        }
      </div>
    </details>
  `;
}

function renderPlayerTextListEditor(label, values = [], key = 'entry', manageMode = false, derivedValues = []) {
  const pills = (values || [])
    .map(
      (value, index) => `
        <span class="tag-pill">
          ${escapeHtml(value)}
          ${
            manageMode
              ? `<button type="button" aria-label="Remove" data-player-remove-${key}="${index}">×</button>`
              : ''
          }
        </span>`
    )
    .join('');
  const derived = filterPlayerManualOverlap(values, derivedValues)
    .map((value) => `<span class="tag-pill">${escapeHtml(value)}</span>`)
    .join('');
  return `
    <div class="damage-group">
      <div class="damage-group-header">
        <h4>${label}</h4>
      </div>
      <div class="tag-list">
        ${pills || (!derived ? '<span class="muted">None</span>' : '')}
      </div>
      ${derived ? `<p class="muted small-note">From sets</p><div class="tag-list">${derived}</div>` : ''}
      ${
        manageMode
          ? `
          <form data-player-${key}-form>
            <label class="compact-label">Add ${label.slice(0, -1)}
              <input type="text" name="${key}" placeholder="Add ${label.slice(0, -1).toLowerCase()}" />
            </label>
            <button type="submit">Add</button>
          </form>
        `
          : ''
      }
    </div>
  `;
}

function renderPlayerAbilityEntries(participant, manageMode = false) {
  const entries = participant.abilities || [];
  if (!entries.length) {
    return '<p class="muted">No abilities recorded yet.</p>';
  }
  return entries
    .map(
      (entry, index) => `
      <article class="journal-entry">
        <strong>${entry.name || `Ability ${index + 1}`}</strong>
        <p>${entry.description || 'No description.'}</p>
        ${
          manageMode
            ? `
            <div class="card-actions">
              <button type="button" data-player-remove-ability="${entry.id || ''}" data-player-ability-index="${index}">Remove</button>
            </div>
          `
            : ''
        }
      </article>`
    )
    .join('');
}

function journalFieldName(category) {
  return category === 'achievement' ? 'achievements' : 'quests';
}

function renderJournal() {
  rememberPlayerJournalSections();
  els.journalContent = document.getElementById('playerJournalContent');
  if (!els.journalContent) return;
  const participant = getFocusedParticipant();
  if (!participant || (createMode && !focusId)) {
    els.journalContent.innerHTML = '<p class="empty-state">Journal becomes available once a character is selected.</p>';
    hideJournalPopup();
    return;
  }
  const quests = (participant.quests || []).filter((entry) => entry.acknowledged);
  const achievements = (participant.achievements || []).filter((entry) => entry.acknowledged);
  els.journalContent.innerHTML = `
    ${renderPlayerJournalGroup('Quests', quests, 'No quests yet.', 'quest')}
    ${renderPlayerJournalGroup('Achievements', achievements, 'No achievements yet.', 'achievement')}
  `;
  renderJournalPopup(participant);
  restorePlayerJournalSections(participant.id);
}

function rememberPlayerSections() {
  const current = getFocusedParticipant();
  if (!current || !els.stats) return;
  const snapshot = {};
  els.stats.querySelectorAll('details[data-player-section]').forEach((node) => {
    snapshot[node.dataset.playerSection] = node.open;
  });
  playerSectionState.set(current.id, snapshot);
}

function rememberPlayerCardDetails() {
  const current = getFocusedParticipant();
  if (!current || !els.stats) return;
  const snapshot = {};
  els.stats.querySelectorAll('details[data-player-card-details-key]').forEach((node) => {
    snapshot[node.dataset.playerCardDetailsKey] = node.open;
  });
  playerCardOpenState.set(current.id, snapshot);
}

function restorePlayerSections(participantId) {
  if (!participantId || !els.stats) return;
  const snapshot = playerSectionState.get(participantId);
  if (!snapshot) return;
  els.stats.querySelectorAll('details[data-player-section]').forEach((node) => {
    const key = node.dataset.playerSection;
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      node.open = Boolean(snapshot[key]);
    }
  });
}

function restorePlayerCardDetails(participantId) {
  if (!participantId || !els.stats) return;
  const snapshot = playerCardOpenState.get(participantId);
  if (!snapshot) return;
  els.stats.querySelectorAll('details[data-player-card-details-key]').forEach((node) => {
    const key = node.dataset.playerCardDetailsKey;
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      node.open = Boolean(snapshot[key]);
    }
  });
}

function rememberPlayerJournalSections() {
  const current = getFocusedParticipant();
  if (!current || !els.journalContent) return;
  const snapshot = {};
  els.journalContent.querySelectorAll('details[data-journal-section]').forEach((node) => {
    snapshot[node.dataset.journalSection] = node.open;
  });
  playerJournalState.set(current.id, snapshot);
}

function restorePlayerJournalSections(participantId) {
  if (!participantId || !els.journalContent) return;
  const snapshot = playerJournalState.get(participantId);
  if (!snapshot) return;
  els.journalContent.querySelectorAll('details[data-journal-section]').forEach((node) => {
    const key = node.dataset.journalSection;
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      node.open = Boolean(snapshot[key]);
    }
  });
}

function renderPlayerJournalGroup(label, entries, emptyText, category) {
  return `
    <details class="player-collapsible journal-collapsible" data-journal-section="${category}">
      <summary><strong>${label} (${entries.length})</strong></summary>
      <div class="collapsible-body journal-list">
        ${renderPlayerJournalEntries(entries, emptyText, category)}
      </div>
    </details>
  `;
}

function renderPlayerJournalEntries(entries, emptyText, category) {
  if (!entries.length) {
    return `<p class="muted">${emptyText}</p>`;
  }
  return entries
    .map(
      (entry) => `
      <article class="journal-entry">
        <strong>${escapeHtml(entry.title || 'Entry')}</strong>
        ${renderPlayerJournalDetails(entry, category)}
      </article>`
    )
    .join('');
}

function renderPlayerJournalDetails(entry, category, options = {}) {
  const template = entry?.template || {};
  const popup = Boolean(options.popup);
  if (category === 'quest' && Object.keys(template).length) {
    const objectives = [template.objectivePrimary, template.objectiveSecondary].filter(Boolean);
    const rewards = [template.rewardPrimary, template.rewardBonus].filter(Boolean);
    return `
      <div class="journal-template ${popup ? 'journal-template-terminal' : ''}">
        ${template.narrative ? `<p><strong>Description:</strong> ${escapeHtml(template.narrative)}</p>` : ''}
        ${
          objectives.length
            ? `<div class="journal-template-block"><strong>Objective:</strong><ul>${objectives
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}</ul></div>`
            : ''
        }
        ${template.difficulty ? `<p><strong>Difficulty:</strong> ${escapeHtml(template.difficulty)}</p>` : ''}
        ${
          rewards.length
            ? `<div class="journal-template-block"><strong>Rewards:</strong><ul>${rewards
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}</ul></div>`
            : ''
        }
        ${template.failureCondition ? `<p><strong>Failure:</strong> ${escapeHtml(template.failureCondition)}</p>` : ''}
      </div>
    `;
  }
  if (category === 'achievement' && Object.keys(template).length) {
    return `
      <div class="journal-template ${popup ? 'journal-template-terminal' : ''}">
        ${template.requirement ? `<p><strong>Requirement:</strong> ${escapeHtml(template.requirement)}</p>` : ''}
        ${template.reward ? `<p><strong>Reward:</strong> ${escapeHtml(template.reward)}</p>` : ''}
        ${template.flavor ? `<p><strong>Description:</strong> ${escapeHtml(template.flavor)}</p>` : ''}
      </div>
    `;
  }
  return entry.description ? `<p>${escapeHtml(entry.description)}</p>` : '';
}

function getPendingJournalEntry(participant) {
  const queue = [];
  (participant.quests || []).forEach((entry) => {
    if (!entry.acknowledged) queue.push({ ...entry, category: 'quest' });
  });
  (participant.achievements || []).forEach((entry) => {
    if (!entry.acknowledged) queue.push({ ...entry, category: 'achievement' });
  });
  queue.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  return queue[0] || null;
}

function renderJournalPopup(participant) {
  const popup = els.journalPopup;
  if (!popup) return;
  const pending = getPendingJournalEntry(participant);
  if (!pending) {
    hideJournalPopup();
    return;
  }
  popup.innerHTML = `
    <div class="journal-popup-card">
      <h3>${pending.category === 'achievement' ? 'ACHIEVEMENT EARNED' : 'QUEST FOUND'}</h3>
      <h4>${escapeHtml(pending.title || 'Untitled')}</h4>
      ${renderPlayerJournalDetails(pending, pending.category, { popup: true })}
      <div class="card-actions">
        <button type="button" data-journal-ack="${pending.id}" data-journal-category="${pending.category}" class="primary">
          ${pending.category === 'achievement' ? 'Log Achievement' : 'Accept Quest'}
        </button>
        ${
          pending.category === 'quest'
            ? `<button type="button" data-journal-reject="${pending.id}" data-journal-category="${pending.category}" class="danger">Reject Quest</button>`
            : ''
        }
      </div>
    </div>
  `;
  popup.classList.remove('hidden');
  popup.querySelector('[data-journal-ack]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await api('/api/journal/ack', 'POST', {
        participantId: participant.id,
        category: button.dataset.journalCategory,
        entryId: button.dataset.journalAck
      });
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  popup.querySelector('[data-journal-reject]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await api('/api/journal/entry', 'DELETE', {
        participantId: participant.id,
        category: button.dataset.journalCategory,
        entryId: button.dataset.journalReject
      });
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
}

function hideJournalPopup() {
  const popup = els.journalPopup;
  if (!popup) return;
  popup.classList.add('hidden');
  popup.innerHTML = '';
}

function renderPlayerSetSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="sets">
      <summary><strong>Set Tracker</strong></summary>
      <div class="collapsible-body">
        ${renderSetTracker(participant)}
      </div>
    </details>
  `;
}

function renderPlayerConstructSection() {
  return `
    <details class="player-collapsible" data-player-section="constructs">
      <summary><strong>Constructs</strong></summary>
      <div class="collapsible-body">
        <div id="playerConstructList" class="card-list empty-state">No active constructs.</div>
      </div>
    </details>
  `;
}

function renderPlayerRelicSection() {
  return `
    <details class="player-collapsible" data-player-section="relics">
      <summary><strong>Relics & Artifacts</strong></summary>
      <div class="collapsible-body">
        <div id="playerRelicList" class="relic-list empty-state">No relics yet.</div>
        <details id="playerRelicDrawer">
          <summary>Relic Tools</summary>
          <div class="card-import">
            <label class="file-upload">
              Import Relics
              <input type="file" id="playerImportRelic" accept="application/json" />
            </label>
          </div>
          <form id="playerRelicForm" class="stacked-form">
            <div class="form-row">
              <label>Name
                <input type="text" name="name" required />
              </label>
              <label>HP Bonus
                <input type="number" name="hp" value="0" />
              </label>
              <label>AP Bonus
                <input type="number" name="ap" value="0" />
              </label>
            </div>
            <div class="form-row">
              <label>Ability Focus
                <input type="text" name="ability" placeholder="Machine, Shield, etc." />
              </label>
              <label>Description
                <input type="text" name="description" placeholder="What does it do?" />
              </label>
            </div>
            <button type="submit">Add Relic</button>
          </form>
        </details>
      </div>
    </details>
  `;
}

function renderPlayerNotesSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="notes">
      <summary><strong>Notes</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Notes</h4>
          <button type="button" data-player-save-notes>Save</button>
        </div>
        <textarea data-player-notes rows="3" placeholder="Add notes for the GM or reminders">${participant.notes || ''}</textarea>
      </div>
    </details>
  `;
}

function renderPlayerInventorySection() {
  return `
    <details class="player-collapsible" data-player-section="inventory">
      <summary><strong>Inventory</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Currencies</h4>
          <button type="button" data-player-toggle-currency>Add Currency</button>
        </div>
        <div id="playerCurrencyList" class="relic-list empty-state">No currencies yet.</div>
        <form id="playerCurrencyForm" class="stacked-form hidden">
          <div class="form-row">
            <label>Name
              <input type="text" name="name" placeholder="Gold" required />
            </label>
            <label>Starting Amount
              <input type="number" name="amount" min="0" value="0" />
            </label>
          </div>
          <button type="submit">Add Currency</button>
        </form>
        <div class="section-header">
          <h4>Items</h4>
          <button type="button" data-player-toggle-inventory>Add Item</button>
        </div>
        <div id="playerInventoryList" class="relic-list empty-state">No inventory items yet.</div>
        <form id="playerInventoryForm" class="stacked-form hidden">
          <div class="form-row">
            <label>Item
              <input type="text" name="name" placeholder="Potion" required />
            </label>
            <label>Qty
              <input type="number" name="quantity" min="1" value="1" />
            </label>
          </div>
          <label>Description
            <input type="text" name="description" placeholder="Optional details" />
          </label>
          <label>Tags
            <input type="text" name="tags" placeholder="Consumable, Quest, Crafting" />
          </label>
          <button type="submit">Add Item</button>
        </form>
      </div>
    </details>
  `;
}

function renderInlineAdjust(fieldKey) {
  return `
    <div class="inline-adjust">
      <button type="button" data-inline-adjust="${fieldKey}" data-delta="-1">-1</button>
      <button type="button" data-inline-adjust="${fieldKey}" data-delta="1">+1</button>
      <input type="number" data-inline-input="${fieldKey}" placeholder="Set" />
      <button type="button" data-inline-set="${fieldKey}">Set</button>
    </div>
  `;
}

const ABILITIES = [
  { key: 'strength', label: 'STR' },
  { key: 'dexterity', label: 'DEX' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom', label: 'WIS' },
  { key: 'charisma', label: 'CHA' }
];

function renderAbilityTable(participant) {
  const rows = ABILITIES.map(({ key, label }) => {
    const value = getPlayerEffectiveAbilityScore(participant, key);
    const bonus = getPlayerAbilityBonus(participant, key);
    const mod = abilityMod(value);
    return `
      <tr>
        <th>${label}</th>
        <td><input type="number" class="ability-score-input" data-ability-input="${key}" value="${value}" /></td>
        <td>${bonus ? formatSignedValue(bonus) : '0'}</td>
        <td>${formatMod(mod)}</td>
      </tr>`;
  }).join('');
  return `
    <table class="player-table">
      <thead>
        <tr><th>Ability</th><th>Score</th><th>Bonus</th><th>Mod</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function populatePlayerBaseForm(participant) {
  if (!els.baseForm || !participant) return;
  const nameInput = els.baseForm.querySelector('input[name="name"]');
  if (nameInput) {
    nameInput.value = String(participant.name || '');
  }
  const pairs = [
    ['hp', participant.hp],
    ['maxHp', participant.maxHp],
    ['shield', participant.shield],
    ['maxShield', participant.maxShield],
    ['apCurrent', participant.apCurrent ?? participant.apMax],
    ['apMax', participant.apMax]
  ];
  pairs.forEach(([key, value]) => {
    const input = els.baseForm.querySelector(`input[name="${key}"]`);
    if (input) input.value = Number(value ?? 0);
  });
}

async function handlePlayerBaseSubmit(event) {
  event.preventDefault();
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    return;
  }
  const formData = new FormData(event.target);
  const payload = {
    name: String(formData.get('name') ?? participant.name ?? '').trim() || participant.name || 'Combatant',
    hp: Number(formData.get('hp') ?? participant.hp ?? 0),
    maxHp: Number(formData.get('maxHp') ?? participant.maxHp ?? 0),
    shield: Number(formData.get('shield') ?? participant.shield ?? 0),
    maxShield: Number(formData.get('maxShield') ?? participant.maxShield ?? 0),
    apCurrent: Number(formData.get('apCurrent') ?? participant.apCurrent ?? participant.apMax ?? 0),
    apMax: Number(formData.get('apMax') ?? participant.apMax ?? 0)
  };
  try {
    await patchParticipant(participant.id, payload);
    fetchState();
    els.baseForm?.classList.add('hidden');
  } catch (err) {
    notify(err.message);
  }
}

async function handlePlayerRest(type) {
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    return;
  }
  try {
    await api(`/api/rest/${type}`, 'POST', { participantId: participant.id });
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

async function handlePlayerStandardAction(actionId) {
  if (!actionId) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    return;
  }
  let resolvedId = actionId;
  let standardPayload = {};
  if (actionId === 'move') {
    const difficultToggle = els.stats.querySelector('[data-player-difficult]');
    if (difficultToggle?.checked) {
      resolvedId = 'move_difficult';
    }
  }
  if (actionId === 'recover') {
    const target = choosePlayerRecoverTarget(participant);
    if (target === null) {
      return;
    }
    standardPayload = target || {};
  }
  if (actionId === 'cleanse') {
    const target = choosePlayerCleanseTarget(participant);
    if (target === null) {
      return;
    }
    standardPayload = target || {};
  }
  try {
    await api('/api/actions/standard', 'POST', {
      actionId: resolvedId,
      participantId: participant.id,
      ...standardPayload
    });
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

async function handlePlayerWeaponAttack() {
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    return;
  }
  const targetId = String(els.stats.querySelector('[data-player-weapon-target]')?.value || '').trim();
  if (!targetId) {
    notify('Select a target for the weapon attack.');
    return;
  }
  try {
    await api('/api/actions/weapon-attack', 'POST', {
      participantId: participant.id,
      targetId
    });
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

function normalizeRecoverToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function detectRecoverType(status) {
  const fields = [status?.presetId, status?.name, status?.id];
  for (const field of fields) {
    const token = normalizeRecoverToken(field);
    if (token.includes('bleeding')) return 'bleeding';
    if (token.includes('poisoned')) return 'poisoned';
    if (token.includes('burning')) return 'burning';
  }
  return null;
}

function listPlayerRecoverableStatuses(participant) {
  return (participant?.statuses || [])
    .map((status, index) => {
      const type = detectRecoverType(status);
      if (!type) return null;
      return {
        status,
        index,
        type,
        label: `${status.name || type}${status.stacks ? ` ×${status.stacks}` : ''}`
      };
    })
    .filter(Boolean);
}

function choosePlayerRecoverTarget(participant) {
  const recoverable = listPlayerRecoverableStatuses(participant);
  if (!recoverable.length) {
    notify('No Bleeding, Poisoned, or Burning stacks to recover.');
    return null;
  }
  if (recoverable.length === 1) {
    const [entry] = recoverable;
    return {
      recoverStatusIndex: entry.index,
      recoverStatusId: entry.status.id,
      recoverStatusName: entry.status.name,
      recoverStatusType: entry.type
    };
  }
  const message = [
    'Choose status to reduce by 1 stack:',
    ...recoverable.map((entry, index) => `${index + 1}. ${entry.label}`)
  ].join('\n');
  const raw = window.prompt(message, '1');
  if (raw == null) return null;
  const choice = Number(raw);
  if (!Number.isInteger(choice) || choice < 1 || choice > recoverable.length) {
    notify('Invalid selection. Recover cancelled.');
    return null;
  }
  const picked = recoverable[choice - 1];
  return {
    recoverStatusIndex: picked.index,
    recoverStatusId: picked.status.id,
    recoverStatusName: picked.status.name,
    recoverStatusType: picked.type
  };
}

function detectPlayerCleanseType(status) {
  const fields = [status?.presetId, status?.name, status?.id];
  for (const field of fields) {
    const token = normalizeRecoverToken(field);
    if (token.includes('rooted') || token.includes('root')) return 'rooted';
    if (token.includes('restrained') || token.includes('restrain')) return 'restrained';
    if (token.includes('silenced') || token.includes('silence')) return 'silenced';
    if (token.includes('charmed') || token.includes('charm')) return 'charmed';
    if (token.includes('frightened') || token.includes('frighten')) return 'frightened';
    if (token.includes('infernalbrand')) return 'infernal_brand';
    if (token.includes('bloodcurse')) return 'blood_curse';
    if (token.includes('curseofweakness')) return 'curse_of_weakness';
    if (token.includes('suppressed') || token.includes('suppress')) return 'suppressed';
    if (token.includes('stunned') || token.includes('stun')) return 'stunned';
    if (token.includes('paralysed') || token.includes('paralyzed') || token.includes('paralyse') || token.includes('paralyze')) return 'paralysed';
  }
  return null;
}

function getPlayerCleanseApCost(type) {
  return 4;
}

function listPlayerCleanseableStatuses(participant) {
  return (participant?.statuses || [])
    .map((status, index) => {
      const type = detectPlayerCleanseType(status);
      if (!type) return null;
      const apCost = getPlayerCleanseApCost(type);
      return {
        status,
        index,
        type,
        apCost,
        label: `${status.name || type}${status.stacks ? ` ×${status.stacks}` : ''} (${apCost} AP)`
      };
    })
    .filter(Boolean);
}

function choosePlayerCleanseTarget(participant) {
  const cleanseable = listPlayerCleanseableStatuses(participant);
  if (!cleanseable.length) {
    notify('No eligible control/debuff status to cleanse.');
    return null;
  }
  if (cleanseable.length === 1) {
    const [entry] = cleanseable;
    return {
      cleanseStatusIndex: entry.index,
      cleanseStatusId: entry.status.id,
      cleanseStatusName: entry.status.name,
      cleanseStatusType: entry.type
    };
  }
  const message = [
    'Choose status to remove completely:',
    ...cleanseable.map((entry, index) => `${index + 1}. ${entry.label}`)
  ].join('\n');
  const raw = window.prompt(message, '1');
  if (raw == null) return null;
  const choice = Number(raw);
  if (!Number.isInteger(choice) || choice < 1 || choice > cleanseable.length) {
    notify('Invalid selection. Cleanse cancelled.');
    return null;
  }
  const picked = cleanseable[choice - 1];
  return {
    cleanseStatusIndex: picked.index,
    cleanseStatusId: picked.status.id,
    cleanseStatusName: picked.status.name,
    cleanseStatusType: picked.type
  };
}

async function handlePlayerDamageForm(event, participant, field, inputName) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const value = String(formData.get(inputName) || '').trim();
  if (!value) {
    notify('Select a damage type.');
    return;
  }
  try {
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const source = Array.isArray(latest?.[field]) ? latest[field] : [];
    const existing = [...source];
    const duplicate = existing.find((entry) => entry.toLowerCase() === value.toLowerCase());
    if (duplicate) {
      notify('Already listed.');
      return;
    }
    await patchParticipant(participant.id, { [field]: [...existing, value] });
    fetchState();
    const select = event.target.querySelector('select');
    if (select) select.value = '';
  } catch (err) {
    notify(err.message);
  }
}

async function handlePlayerDamageRemove(participant, field, index) {
  if (index < 0 || Number.isNaN(index)) return;
  try {
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const source = Array.isArray(latest?.[field]) ? latest[field] : [];
    const existing = [...source];
    if (index >= existing.length) return;
    existing.splice(index, 1);
    await patchParticipant(participant.id, { [field]: existing });
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

function renderSavingThrows(participant, options = {}) {
  const expanded = options.expanded === true;
  const rows = ABILITIES.map(({ key, label }) => {
    const mod = abilityMod(getPlayerEffectiveAbilityScore(participant, key));
    const proficient = Boolean(participant.savingThrows?.[key]);
    const total = mod + (proficient ? participant.proficiencyBonus || 0 : 0);
    return `
      <tr>
        <th>${label}</th>
        ${expanded ? `<td><input type="checkbox" data-save-toggle="${key}" ${proficient ? 'checked' : ''} /></td>` : ''}
        <td>${formatMod(total)}</td>
      </tr>`;
  }).join('');
  return `
    <table class="player-table player-table-compact">
      <thead>
        <tr><th>Ability</th>${expanded ? '<th>Prof</th>' : ''}<th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

const SKILLS = [
  ['Acrobatics', 'dexterity', 'acrobatics'],
  ['Animal Handling', 'wisdom', 'animalHandling'],
  ['Arcana', 'intelligence', 'arcana'],
  ['Athletics', 'strength', 'athletics'],
  ['Deception', 'charisma', 'deception'],
  ['History', 'intelligence', 'history'],
  ['Insight', 'wisdom', 'insight'],
  ['Intimidation', 'charisma', 'intimidation'],
  ['Investigation', 'intelligence', 'investigation'],
  ['Medicine', 'wisdom', 'medicine'],
  ['Nature', 'intelligence', 'nature'],
  ['Perception', 'wisdom', 'perception'],
  ['Performance', 'charisma', 'performance'],
  ['Persuasion', 'charisma', 'persuasion'],
  ['Religion', 'intelligence', 'religion'],
  ['Sleight of Hand', 'dexterity', 'sleightOfHand'],
  ['Stealth', 'dexterity', 'stealth'],
  ['Survival', 'wisdom', 'survival']
];

function renderSkillsTable(participant, options = {}) {
  const expanded = options.expanded === true;
  const prof = participant.proficiencyBonus || 0;
  const rows = SKILLS.map(([skill, ability, key]) => {
    const mod = abilityMod(getPlayerEffectiveAbilityScore(participant, ability));
    const entry = getSkillState(participant, key);
    const total = mod + prof * (entry.expert ? 2 : entry.proficient ? 1 : 0);
    return `
      <tr>
        <th>${skill}</th>
        ${expanded ? `<td><input type="checkbox" data-skill-toggle="${key}" data-toggle-type="proficient" ${entry.proficient ? 'checked' : ''} /></td>` : ''}
        ${expanded ? `<td><input type="checkbox" data-skill-toggle="${key}" data-toggle-type="expert" ${entry.expert ? 'checked' : ''} /></td>` : ''}
        <td>${formatMod(total)}</td>
      </tr>`;
  }).join('');
  return `
    <table class="player-table player-table-compact">
      <thead>
        <tr><th>Skill</th>${expanded ? '<th>Prof</th><th>Expert</th>' : ''}<th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function abilityLabel(key) {
  const match = ABILITIES.find((entry) => entry.key === key);
  return match ? match.label : key?.toUpperCase();
}

function formatMod(value) {
  const num = Number(value) || 0;
  return num >= 0 ? `+${num}` : `${num}`;
}

function formatSignedValue(value = 0) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '+0';
  return `${amount >= 0 ? '+' : ''}${Math.round(amount)}`;
}

function getPlayerAbilityBonus(participant = {}, ability = '') {
  const amount = Number(participant?.derivedBonuses?.abilityBonuses?.[ability] || 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function getPlayerEffectiveAbilityScore(participant = {}, ability = '') {
  const derived = Number(participant?.derivedBonuses?.effectiveStats?.[ability]);
  if (Number.isFinite(derived)) {
    return Math.round(derived);
  }
  const base = Number(participant?.stats?.[ability] ?? 0);
  const safeBase = Number.isFinite(base) && Math.round(base) !== 0 ? Math.round(base) : 10;
  return safeBase + getPlayerAbilityBonus(participant, ability);
}

function getPlayerAttributeScaling(participant = {}) {
  const derived = participant?.derivedBonuses?.attributeScaling;
  if (derived && typeof derived === 'object') {
    return derived;
  }
  const scores = {
    strength: getPlayerEffectiveAbilityScore(participant, 'strength'),
    dexterity: getPlayerEffectiveAbilityScore(participant, 'dexterity'),
    constitution: getPlayerEffectiveAbilityScore(participant, 'constitution'),
    intelligence: getPlayerEffectiveAbilityScore(participant, 'intelligence'),
    wisdom: getPlayerEffectiveAbilityScore(participant, 'wisdom'),
    charisma: getPlayerEffectiveAbilityScore(participant, 'charisma')
  };
  return getAttributeScalingFromScores(scores);
}

function getPlayerMoveDistanceFt(participant = {}, options = {}) {
  const scaling = getPlayerAttributeScaling(participant);
  const value = options.difficultTerrain === true ? scaling.moveDifficultFt : scaling.moveFt;
  return Math.max(0, Math.round(Number(value || 0)));
}

function renderPlayerAttributeScalingNote(participant = {}) {
  const scaling = getPlayerAttributeScaling(participant);
  return `
    <p class="muted small-note">
      STR melee ${formatSignedValue(scaling.meleeDamageBonus || 0)} damage ·
      DEX move ${getPlayerMoveDistanceFt(participant)} ft (${getPlayerMoveDistanceFt(participant, { difficultTerrain: true })} ft difficult) ·
      CON ${formatSignedValue(scaling.maxHpBonus || 0)} max HP ·
      WIS ${formatSignedValue(scaling.maxShieldBonus || 0)} base Shield ·
      INT magic ${formatSignedValue(scaling.magicDamageBonus || 0)} damage ·
      CHA status damage ${formatSignedValue(scaling.statusEffectDamageBonus || 0)}
    </p>
  `;
}

function getPlayerStandardActionSummary(action = {}, participant = {}) {
  if (action.id === 'move') {
    return `${Math.max(1, Number(getPlayerEquipmentSummary(participant).moveApCost || 1))} AP -> ${getPlayerMoveDistanceFt(participant)} ft`;
  }
  if (action.id === 'guard') {
    return `2 AP -> Restore ${Math.max(0, Math.round(Number(participant?.guardRestore ?? 3)))} Shield`;
  }
  return action.summary || '';
}

function getTierMasteryThresholdDefaults(tier = 'Common') {
  const defaults = getCardTierMasteryThresholds(tier);
  const level2 = Math.max(1, Math.round(Number(defaults?.level2 ?? 10)));
  const level3 = Math.max(level2 + 1, Math.round(Number(defaults?.level3 ?? level2 + 1)));
  const level4 = Math.max(level3 + 1, Math.round(Number(defaults?.level4 ?? level3 + 1)));
  return { level2, level3, level4 };
}

function syncCardMasteryThresholdInputs(formEl) {
  if (!formEl) return;
  const tierInput = formEl.querySelector('[name="tier"]');
  const to2Input = formEl.querySelector('[name="masteryTo2"]');
  const to3Input = formEl.querySelector('[name="masteryTo3"]');
  const to4Input = formEl.querySelector('[name="masteryTo4"]');
  if (!to2Input || !to3Input || !to4Input) return;
  const defaults = getTierMasteryThresholdDefaults(tierInput?.value || 'Common');
  to2Input.value = String(defaults.level2);
  to3Input.value = String(defaults.level3);
  to4Input.value = String(defaults.level4);
}

function abilityMod(score = 0) {
  return Math.floor((Number(score) - 10) / 2);
}

function getSkillState(participant, key) {
  return participant.skills?.[key] || { proficient: false, expert: false };
}

function isCardActive(card = {}) {
  return card?.active !== false;
}

function participantHasActiveConstructCard(participant = {}) {
  return getPlayerCardBuckets(participant).active.some(({ card }) => isConstructCard(card));
}

function participantHasActiveZoneCard(participant = {}) {
  return getPlayerCardBuckets(participant).active.some(({ card }) =>
    isZoneCard(card, Number(card?.masteryLevel || 1))
  );
}

function getPlayerCardBuckets(participant = {}) {
  const entries = (participant.cards || []).map((card, index) => ({ card, index }));
  const active = [];
  const inactive = [];
  entries.forEach((entry) => {
    if (isCardActive(entry.card)) {
      active.push(entry);
    } else {
      inactive.push(entry);
    }
  });
  return { active, inactive, total: entries.length };
}

function getPlayerTeamOptionValues(participant = null) {
  const options = [];
  const pushUnique = (value) => {
    const team = String(value || '').trim();
    if (!team || options.includes(team)) return;
    options.push(team);
  };
  for (const entry of state.reference?.teams || []) {
    pushUnique(entry);
  }
  for (const entry of state.encounter?.participants || []) {
    pushUnique(entry?.team);
  }
  if (participant) {
    pushUnique(participant.team);
  }
  return options;
}

function renderPlayerTeamOptions(participant = null) {
  const options = ['<option value="">Unassigned</option>'];
  for (const team of getPlayerTeamOptionValues(participant)) {
    const selected = String(participant?.team || '').trim() === team ? ' selected' : '';
    options.push(`<option value="${escapeHtml(team)}"${selected}>${escapeHtml(team)}</option>`);
  }
  return options.join('');
}

function getPlayerAllies(participant) {
  if (!participant?.id) return [];
  const sourceId = participant.id;
  const sourceTeam = String(participant.team || '').trim().toLowerCase();
  const manualIds = new Set(participant?.setRuntime?.allies?.targetIds || []);
  return (state.encounter.participants || []).filter((entry) => {
    if (!entry || entry.id === sourceId) return false;
    const sameTeam =
      sourceTeam &&
      String(entry.team || '')
        .trim()
        .toLowerCase() === sourceTeam;
    return sameTeam || manualIds.has(entry.id);
  });
}

function getPlayerEncounterTargetables() {
  const entries = [];
  for (const participant of state.encounter.participants || []) {
    if (!participant?.id) continue;
    entries.push({ ...participant, entityKind: 'participant' });
    for (const construct of participant.constructs || []) {
      if (!construct?.id) continue;
      entries.push({
        ...construct,
        entityKind: 'construct',
        ownerId: participant.id,
        ownerName: participant.name || 'Owner',
        team: participant.team || ''
      });
    }
  }
  return entries;
}

function getPlayerEncounterTargetableById(id) {
  const targetId = String(id || '').trim();
  if (!targetId) return null;
  return getPlayerEncounterTargetables().find((entry) => entry.id === targetId) || null;
}

function getPlayerConstructOwnerOrdinal(entry) {
  if (!entry || String(entry.entityKind || '').toLowerCase() !== 'construct') return 0;
  const ownerId = String(entry.ownerId || '').trim();
  const owner = (state.encounter.participants || []).find((participant) => participant?.id === ownerId);
  if (!owner) return 0;
  const constructs = Array.isArray(owner.constructs) ? owner.constructs : [];
  const index = constructs.findIndex((construct) => construct?.id === entry.id);
  return index >= 0 ? index + 1 : 0;
}

function formatPlayerTargetableLabel(entry) {
  if (!entry) return '';
  if (String(entry.entityKind || '').toLowerCase() === 'construct') {
    const ordinal = getPlayerConstructOwnerOrdinal(entry);
    return `${entry.name || 'Construct'} (${entry.ownerName || 'Owner'} #${ordinal || 1})`;
  }
  return entry.name || '';
}

function getPlayerEncounterZones() {
  const entries = [];
  for (const participant of state.encounter.participants || []) {
    if (!participant?.id) continue;
    for (const zone of participant.zones || []) {
      if (!zone?.id) continue;
      entries.push({
        ...zone,
        ownerId: participant.id,
        ownerName: participant.name || 'Owner'
      });
    }
  }
  return entries.sort((left, right) => {
    const ownerCompare = String(left.ownerName || '').localeCompare(String(right.ownerName || ''));
    if (ownerCompare !== 0) return ownerCompare;
    const orderCompare = Number(left.createdOrder || 0) - Number(right.createdOrder || 0);
    if (orderCompare !== 0) return orderCompare;
    return String(left.name || '').localeCompare(String(right.name || ''));
  });
}

function formatPlayerZoneLabel(entry) {
  if (!entry) return '';
  return `${entry.name || 'Zone'} (${entry.ownerName || 'Owner'})`;
}

function isPlayerTargetableAlly(participant, target) {
  if (!participant?.id || !target?.id) return false;
  if (String(target.entityKind || '').toLowerCase() === 'construct') {
    if (target.ownerId === participant.id) return true;
    return getPlayerAllies(participant).some((ally) => ally.id === target.ownerId);
  }
  if (participant.id === target.id) return false;
  return getPlayerAllies(participant).some((ally) => ally.id === target.id);
}

function isPlayerEnemyForUi(participant, target) {
  if (!participant?.id || !target?.id) return false;
  if (String(target.entityKind || '').toLowerCase() === 'construct') {
    if (target.ownerId === participant.id) return false;
    return !isPlayerTargetableAlly(participant, target);
  }
  if (participant.id === target.id) return false;
  return !isPlayerTargetableAlly(participant, target);
}

function mergePlayerUniqueText(existing = [], value = '') {
  const token = String(value || '').trim();
  if (!token) return existing;
  const already = existing.some((entry) => String(entry || '').trim().toLowerCase() === token.toLowerCase());
  if (already) return existing;
  return [...existing, token];
}

function playerHasSetBonus(participant = {}, setName = '', pieces = 1) {
  const target = String(setName || '').trim().toLowerCase();
  if (!target) return false;
  const count = getPlayerCardBuckets(participant).active.reduce((total, { card }) => {
    return String(card?.set || '').trim().toLowerCase() === target ? total + 1 : total;
  }, 0);
  return count >= Math.max(1, Number(pieces || 1));
}

function renderSetTracker(participant) {
  const counts = {};
  for (const { card } of getPlayerCardBuckets(participant).active) {
    if (!card.set) continue;
    counts[card.set] = (counts[card.set] || 0) + 1;
  }
  const entries = Object.entries(counts);
  const rows = entries
    .map(([setName, count]) => {
      const ref = (state.reference.sets || []).find((entry) => entry.name === setName);
      const bonuses = ref?.bonuses || [];
      const list = bonuses
        .map(
          (bonus) => `
            <li class="${count >= bonus.pieces ? 'active' : ''}">
              ${bonus.pieces} pcs — ${bonus.effect || summarizeModifiers(bonus.modifiers || {})}
              ${count >= bonus.pieces ? renderPlayerSetBonusStatus(setName, bonus, participant) : ''}
              ${count >= bonus.pieces ? renderPlayerSetActivationButton(setName, bonus, participant) : ''}
              ${renderPlayerSetBonusMeta(bonus)}
            </li>`
        )
        .join('');
      return `
        <div class="set-block">
          <div class="set-header">
            <strong>${setName}</strong>
            <span>${count} card${count === 1 ? '' : 's'}</span>
          </div>
          <ul class="set-list">${list}</ul>
        </div>`;
    })
    .join('');
  const allyManager =
    playerHasSetBonus(participant, 'Divine', 3) || playerHasSetBonus(participant, 'Nature', 5)
      ? renderPlayerSetAllyTargetManager(participant)
      : '';
  if (!rows) {
    return allyManager || '<p class="muted">No set bonuses equipped.</p>';
  }
  return `${rows}${allyManager}`;
}

function renderPlayerSetAllyTargetManager(participant) {
  const allyIds = participant?.setRuntime?.allies?.targetIds || [];
  const automaticAllies = getPlayerAllies(participant).filter((entry) => !allyIds.includes(entry.id));
  const participants = state.encounter.participants || [];
  const assigned = allyIds
    .map((id) => participants.find((entry) => entry.id === id))
    .filter(Boolean);
  const options = participants
    .filter((entry) => entry.id !== participant.id && !allyIds.includes(entry.id))
    .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`)
    .join('');
  const pills = assigned
    .map(
      (entry) => `
        <span class="status-pill">
          ${escapeHtml(entry.name)}
          <button type="button" data-player-set-ally-remove="${entry.id}">Remove</button>
        </span>`
    )
    .join('');
  return `
    <div class="set-block">
      <div class="set-header">
        <strong>Set Ally Targets</strong>
        <span>${assigned.length + automaticAllies.length} total</span>
      </div>
      <p class="muted small-note">Characters on the same team are auto-allies. Manual allies are optional overrides.</p>
      ${
        automaticAllies.length
          ? `<p class="muted small-note">Auto-allies: ${escapeHtml(automaticAllies.map((entry) => entry.name).join(', '))}</p>`
          : ''
      }
      <div class="status-list">
        ${pills || '<span class="muted">No allies selected.</span>'}
      </div>
      <div class="form-row">
        <label>Add Ally
          <select data-player-set-ally-add>
            <option value="">Select ally…</option>
            ${options}
          </select>
        </label>
        <button type="button" data-player-set-ally-add-button>Add</button>
      </div>
    </div>
  `;
}

function renderPlayerSetBonusStatus(setName, bonus, participant) {
  const abilityId = bonus?.activatable?.id || bonus?.id;
  const machine = participant.setRuntime?.machine || {};
  if (bonus.id === 'machine_5_auto_loader') {
    if (machine.autoLoaderPrimed) {
      return ' <small class="muted">[Primed]</small>';
    }
    return ` <small class="muted">[${machine.autoLoaderTriggeredTurn ? 'Triggered this turn' : 'Ready'}]</small>`;
  }
  if (abilityId === 'arcane_7_temp_copy') {
    return participant?.setRuntime?.arcane?.copyUsedEncounter
      ? ' <small class="muted">[Used this encounter]</small>'
      : ' <small class="muted">[Ready]</small>';
  }
  if (abilityId === 'arcane_10_modify_card') {
    const modified = participant?.setRuntime?.arcane?.modifiedCard;
    return modified?.cardId
      ? ` <small class="muted">[Active: ${escapeHtml(modified.mode || 'modified')}]</small>`
      : ' <small class="muted">[Ready]</small>';
  }
  if (abilityId === 'divine_10_sacred_overcharge') {
    return participant?.setRuntime?.divine?.sacredOverchargeUsed
      ? ' <small class="muted">[Used this long rest]</small>'
      : ' <small class="muted">[Ready]</small>';
  }
  if (abilityId === 'divine_5_cleanse_heal') {
    return ' <small class="muted">[Select ally and activate]</small>';
  }
  return '';
}

function renderPlayerSetActivationButton(setName, bonus, participant) {
  if (!bonus?.activatable?.id) return '';
  void setName;
  const canActivate = canPlayerActivateSetBonus(bonus, participant);
  const disabled = canActivate ? '' : ' disabled';
  return ` <button type="button" data-player-activate-set="${bonus.activatable.id}"${disabled}>Activate</button>`;
}

function canPlayerActivateSetBonus(bonus, participant) {
  const abilityId = bonus?.activatable?.id || bonus?.id;
  if (!abilityId || !participant) return false;
  if (abilityId === 'arcane_7_temp_copy') {
    const used = Boolean(participant?.setRuntime?.arcane?.copyUsedEncounter);
    const activeCount = getPlayerCardBuckets(participant).active.length;
    return !used && activeCount < MAX_ACTIVE_CARDS;
  }
  if (abilityId === 'arcane_10_modify_card') {
    const modified = participant?.setRuntime?.arcane?.modifiedCard;
    return !modified?.cardId;
  }
  if (abilityId === 'divine_10_sacred_overcharge') {
    const used = Boolean(participant?.setRuntime?.divine?.sacredOverchargeUsed);
    const allies = getPlayerAllies(participant);
    return !used && allies.length > 0;
  }
  if (abilityId === 'divine_5_cleanse_heal') {
    const allies = getPlayerAllies(participant);
    return allies.length > 0;
  }
  return false;
}

function buildPlayerSetActivationPayload(participant, abilityId) {
  const id = String(abilityId || '').trim();
  if (!id || !participant?.id) return null;
  const payload = {
    participantId: participant.id,
    abilityId: id
  };
  if (id === 'arcane_7_temp_copy') {
    const cardId = promptForPlayerSetCardSelection(participant, 'Arcane Copy');
    if (!cardId) return null;
    payload.cardId = cardId;
    return payload;
  }
  if (id === 'arcane_10_modify_card') {
    const cardId = promptForPlayerSetCardSelection(participant, 'Arcane Card Modification');
    if (!cardId) return null;
    const mode = promptForPlayerArcaneMode();
    if (!mode) return null;
    payload.cardId = cardId;
    payload.mode = mode;
    return payload;
  }
  if (id === 'divine_5_cleanse_heal') {
    const targetId = promptForPlayerSetAllySelection(participant, 'Divine Cleanse');
    if (!targetId) return null;
    payload.targetId = targetId;
    return payload;
  }
  return payload;
}

function promptForPlayerSetCardSelection(participant, label) {
  const activeCards = getPlayerCardBuckets(participant).active;
  if (!activeCards.length) {
    notify('No active cards available.');
    return '';
  }
  const lines = activeCards.map(({ card }, index) => `${index + 1}. ${card.name}`).join('\n');
  const raw = window.prompt(`${label}\n${lines}\nEnter card number:`) || '';
  const selectedIndex = Number(raw);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > activeCards.length) {
    notify('Invalid card selection.');
    return '';
  }
  return activeCards[selectedIndex - 1].card.id;
}

function promptForPlayerArcaneMode() {
  const raw = window.prompt(
    'Arcane modification mode:\n1 = range (+10 ft)\n2 = radius (+5 ft)\n3 = damage (+2)\n4 = ap (-1, min 1)\nEnter 1-4:'
  );
  const modeMap = {
    1: 'range',
    2: 'radius',
    3: 'damage',
    4: 'ap'
  };
  const mode = modeMap[Number(raw)];
  if (!mode) {
    notify('Invalid mode selection.');
    return '';
  }
  return mode;
}

function promptForPlayerSetAllySelection(participant, label) {
  const allyOptions = getPlayerAllies(participant);
  if (!allyOptions.length) {
    notify('No allies available.');
    return '';
  }
  const lines = allyOptions.map((entry, index) => `${index + 1}. ${entry.name}`).join('\n');
  const raw = window.prompt(`${label}\n${lines}\nEnter ally number:`) || '';
  const selectedIndex = Number(raw);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > allyOptions.length) {
    notify('Invalid ally selection.');
    return '';
  }
  return allyOptions[selectedIndex - 1].id;
}

async function resolvePlayerMasteryChoicePrompt(participantId, promptPayload) {
  if (!participantId || !promptPayload || typeof promptPayload !== 'object') return;
  const cardId = String(promptPayload.cardId || '').trim();
  const options = Array.isArray(promptPayload.options) ? promptPayload.options : [];
  if (!cardId || !options.length) return;
  const lines = options
    .map((option, index) => `${index + 1}. ${option.label || option.id || `Option ${index + 1}`}`)
    .join('\n');
  const raw = window.prompt(
    `Mastery choice for ${promptPayload.cardName || 'card'}:\n${lines}\nEnter option number:`,
    '1'
  );
  if (raw == null) {
    notify('Mastery choice deferred. You can choose it on the next use.');
    return;
  }
  const selectedIndex = Number(raw);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > options.length) {
    notify('Invalid mastery choice. Selection was not saved.');
    return;
  }
  const selectedOption = options[selectedIndex - 1];
  await api('/api/cards/mastery-choice', 'POST', {
    participantId,
    cardId,
    choiceId: selectedOption.id
  });
  notify(`${promptPayload.cardName || 'Card'} mastery path set: ${selectedOption.label || selectedOption.id}.`);
}

async function resolvePlayerCardStatusSelectionPrompt(participant, card, targetId, targetIds = []) {
  const removeCount = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'removeStatusCountByLevel',
        Number(card?.masteryLevel || 1),
        Number(card?.removeStatusCount ?? card?.cleanseStatusCount ?? 0)
      )
    )
  );
  const fixedRemoveIds = Array.isArray(card?.removeStatusIds)
    ? card.removeStatusIds
    : String(card?.removeStatusIds || card?.removeStatusId || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
  if (removeCount <= 0 || fixedRemoveIds.length) return [];
  const optionalSelection = card?.removeStatusSelectionOptional === true;
  const selfOnly = isSelfTargetCard(card);
  const targetMode = getCardTargetMode(card);
  let recipients = [];
  if (selfOnly) {
    recipients = [participant];
  } else if (targetMode === 'single') {
    const resolved = getPlayerEncounterTargetableById(targetId);
    if (resolved) recipients = [resolved];
  } else if (targetMode === 'multi_select') {
    recipients = targetIds.map((id) => getPlayerEncounterTargetableById(id)).filter(Boolean);
  }
  if (recipients.length !== 1) return [];
  const target = recipients[0];
  const statuses = Array.isArray(target?.statuses)
    ? target.statuses.filter((entry) => Number(entry?.stacks || 0) > 0 || entry?.name)
    : [];
  if (!statuses.length) {
    if (optionalSelection) return [];
    notify(`${target.name} has no removable statuses.`);
    return null;
  }
  const lines = statuses
    .map((status, index) => `${index + 1}. ${status.name}${status.stacks ? ` x${status.stacks}` : ''}`)
    .join('\n');
  const raw = window.prompt(
    `${card.name || 'Card'} on ${target.name}:\n${lines}\nEnter up to ${removeCount} status number${
      removeCount === 1 ? '' : 's'
    } to remove (comma-separated)${optionalSelection ? ', or leave blank for none' : ''}:`,
    statuses.slice(0, removeCount).map((_, index) => String(index + 1)).join(', ')
  );
  if (raw == null) {
    notify('Card use canceled.');
    return null;
  }
  const selectedIndexes = Array.from(
    new Set(
      String(raw || '')
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= statuses.length)
    )
  ).slice(0, removeCount);
  if (!selectedIndexes.length) {
    if (optionalSelection) return [];
    notify('No statuses selected. Card use canceled.');
    return null;
  }
  return selectedIndexes
    .map((index) => statuses[index - 1]?.id || statuses[index - 1]?.presetId || statuses[index - 1]?.name || '')
    .filter(Boolean);
}

async function resolvePlayerCardContestedOutcomePrompt(participant, card, targetId, contestedChoiceId, targetIds = []) {
  const options = getPlayerCardContestedOptions(card);
  if (!options.length) {
    return { contestedChoiceId: '', contestedOutcome: '', contestedTargetOutcomes: {} };
  }
  const resolvedChoiceId = contestedChoiceId || getPlayerCardDefaultContestedChoiceId(card);
  if (!resolvedChoiceId) {
    notify(`Choose a ${card.name} effect first.`);
    return null;
  }
  const targetMode = getCardTargetMode(card);
  if (targetMode === 'multi_select' && card?.contestedEffect?.promptMode === 'per_target_checkbox') {
    const selectedTargets = Array.from(
      new Map(
        (Array.isArray(targetIds) ? targetIds : [])
          .map((id) => getPlayerEncounterTargetableById(id))
          .filter(Boolean)
          .map((entry) => [entry.id, entry])
      ).values()
    );
    if (!selectedTargets.length) {
      return { contestedChoiceId: resolvedChoiceId, contestedOutcome: '', contestedTargetOutcomes: {} };
    }
    const hostileOnly = card?.contestedEffect?.hostileOnly !== false;
    const promptedTargets = hostileOnly
      ? selectedTargets.filter((entry) => isPlayerEnemyForUi(participant, entry))
      : selectedTargets;
    if (!promptedTargets.length) {
      return { contestedChoiceId: resolvedChoiceId, contestedOutcome: '', contestedTargetOutcomes: {} };
    }
    const selectedOption = options.find((entry) => entry.id === resolvedChoiceId);
    const outcomeMap = await showPlayerCardContestedTargetOutcomeDialog({
      title: `Resolve ${card.name}`,
      effectLabel: selectedOption?.label || resolvedChoiceId,
      checkboxLabel: String(card?.contestedEffect?.promptCheckboxLabel || 'Successful').trim() || 'Successful',
      targets: promptedTargets.map((entry) => ({
        id: entry.id,
        label: formatPlayerTargetableLabel(entry)
      }))
    });
    if (outcomeMap == null) return null;
    return {
      contestedChoiceId: resolvedChoiceId,
      contestedOutcome: '',
      contestedTargetOutcomes: outcomeMap
    };
  }
  const target = getPlayerEncounterTargetableById(targetId);
  if (!target) {
    return { contestedChoiceId: resolvedChoiceId, contestedOutcome: '', contestedTargetOutcomes: {} };
  }
  const hostileOnly = card?.contestedEffect?.hostileOnly !== false;
  if (!hostileOnly || !isPlayerEnemyForUi(participant, target)) {
    return { contestedChoiceId: resolvedChoiceId, contestedOutcome: 'success', contestedTargetOutcomes: {} };
  }
  const selectedOption = options.find((entry) => entry.id === resolvedChoiceId);
  const message = [
    `Resolve contested cast for ${card.name}.`,
    `Target: ${formatPlayerTargetableLabel(target)}`,
    `Effect: ${selectedOption?.label || resolvedChoiceId}`,
    '',
    '1. Successful',
    '2. Unsuccessful / target resisted',
    '',
    'Enter outcome number:'
  ].join('\n');
  const raw = window.prompt(message, '1');
  if (raw == null) return null;
  const choice = Number(String(raw).trim());
  if (choice === 1) {
    return { contestedChoiceId: resolvedChoiceId, contestedOutcome: 'success', contestedTargetOutcomes: {} };
  }
  if (choice === 2) {
    return { contestedChoiceId: resolvedChoiceId, contestedOutcome: 'resisted', contestedTargetOutcomes: {} };
  }
  notify('Invalid contested outcome. Card use cancelled.');
  return null;
}

function showPlayerCardContestedTargetOutcomeDialog({ title = 'Resolve contested cast', effectLabel = '', checkboxLabel = 'Successful', targets = [] } = {}) {
  const rows = Array.isArray(targets) ? targets.filter((entry) => entry?.id && entry?.label) : [];
  if (!rows.length) return Promise.resolve({});
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'help-modal card-outcome-modal';
    overlay.innerHTML = `
      <div class="help-modal-card card-outcome-card">
        <div class="help-modal-header">
          <h2>${escapeHtml(title)}</h2>
          <button type="button" data-player-card-outcome-cancel>Cancel</button>
        </div>
        <div class="help-modal-body">
          ${effectLabel ? `<p class="muted">Effect: ${escapeHtml(effectLabel)}</p>` : ''}
          <div class="card-outcome-list">
            ${rows
              .map(
                (entry) => `
                  <label class="card-outcome-row">
                    <span>${escapeHtml(entry.label)}</span>
                    <span class="card-outcome-checkbox">
                      <input type="checkbox" data-player-card-outcome-target="${entry.id}" checked />
                      <span>${escapeHtml(checkboxLabel)}</span>
                    </span>
                  </label>`
              )
              .join('')}
          </div>
        </div>
        <div class="form-row card-outcome-actions">
          <button type="button" data-player-card-outcome-confirm>Confirm</button>
        </div>
      </div>`;
    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });
    overlay.querySelector('[data-player-card-outcome-cancel]')?.addEventListener('click', () => close(null));
    overlay.querySelector('[data-player-card-outcome-confirm]')?.addEventListener('click', () => {
      const outcomeMap = {};
      overlay.querySelectorAll('[data-player-card-outcome-target]').forEach((input) => {
        const targetKey = input.dataset.playerCardOutcomeTarget || '';
        if (!targetKey) return;
        outcomeMap[targetKey] = input.checked ? 'success' : 'resisted';
      });
      close(outcomeMap);
    });
    document.body.appendChild(overlay);
  });
}

function getPendingPlayerMasteryChoicePrompt(card = {}, level = Number(card?.masteryLevel || 1)) {
  const options = Array.isArray(card?.masteryChoiceOptions) ? card.masteryChoiceOptions : [];
  if (Math.max(1, Math.min(4, Number(level || 1))) < 2) return null;
  if (options.length < 2) return null;
  if (String(card?.masteryChoiceSelected || '').trim()) return null;
  return {
    cardId: String(card?.id || '').trim(),
    cardName: card?.name || 'card',
    options: options.map((option, index) => ({
      id: String(option?.id || '').trim() || `choice_${index + 1}`,
      label: option?.label || option?.name || option?.id || `Option ${index + 1}`
    }))
  };
}

function renderPlayerStatusForm() {
  return `
    <form data-player-status-form class="stacked-form hidden">
      <label>Preset
        <select name="preset" data-status-preset>
          <option value="">Custom</option>
          ${renderStatusPresetOptions()}
        </select>
      </label>
      <div class="form-row">
        <label>Name
          <input type="text" name="name" placeholder="Bleeding" required />
        </label>
        <label>Stacks
          <input type="number" name="stacks" value="1" min="1" />
        </label>
      </div>
      <label>Notes
        <input type="text" name="notes" placeholder="Automation or reminders" />
      </label>
      <button type="submit">Add Status</button>
    </form>
  `;
}

function renderStatusPresetOptions() {
  return (state.reference?.statuses || [])
    .map((status) => `<option value="${status.id}">${status.name}</option>`)
    .join('');
}

function renderCards() {
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No cards tracked for this combatant.</p>';
  } else {
    const { active, inactive } = getPlayerCardBuckets(participant);
    listEl.classList.remove('empty-state');
    listEl.innerHTML = `
      <div class="cards-grid player-card-grid">
        ${renderPlayerCardsList(participant, active, { inactive: false })}
      </div>
      ${renderPlayerInactiveCardsDropdown(participant, inactive)}
    `;
  }
  renderPlayerZones(participant);
  renderPlayerConstructs(participant);
  renderRelics(participant);
  renderInventory(participant);
  wirePlayerCardForm();
  wirePlayerCardImports();
  wirePlayerCardUses(participant);
  wirePlayerCardExports(participant);
  wirePlayerCardActivation(participant);
  restorePlayerCardDetails(participant?.id);
}

function renderPlayerInactiveCardsDropdown(participant, inactiveEntries = []) {
  const options = inactiveEntries
    .map(({ card, index }) => {
      const effect = formatCardEffectAtMastery(card, participant);
      return `<option value="${index}" data-card-id="${card.id || ''}" data-card-index="${index}">${escapeHtml(
        `${card.name || `Card ${index + 1}`} · AP ${Number(card.apCost || 0)} · ${effect || '—'}`
      )}</option>`;
    })
    .join('');
  return `
    <details class="inactive-cards-dropdown" data-player-card-details-key="inactiveCards">
      <summary><strong>Inactive Cards (${inactiveEntries.length})</strong></summary>
      <div class="collapsible-body">
        ${
          inactiveEntries.length
            ? `
            <div class="inactive-picker">
              <label>Inactive Card
                <select data-player-inactive-card-select>
                  ${options}
                </select>
              </label>
              <div class="card-actions">
                <button type="button" data-player-activate-selected-card>Activate Card</button>
              </div>
            </div>
          `
            : '<p class="muted">No inactive cards.</p>'
        }
      </div>
    </details>
  `;
}

function renderPlayerCardsList(participant, entries = [], options = {}) {
  if (!entries.length) {
    return `<p class="empty-state">${options.inactive ? 'No inactive cards.' : 'No active cards tracked yet.'}</p>`;
  }
  return entries
    .map(({ card, index }) => {
      const cardKey = card.id || `card-${index}`;
      const pauseLocked = isPauseButtonUsedLongRest(card);
      const useDisabledAttr = pauseLocked ? 'disabled' : '';
      const activeActions = `
              <button type="button" data-player-use-card="${card.id}" ${useDisabledAttr}>Use</button>
              <button type="button" data-player-deactivate-card="${card.id}" data-player-card-index="${index}">Deactivate</button>
              <button type="button" data-player-export-card="${card.id}">Export Card</button>`;
      const inactiveActions = `
              <button type="button" data-player-activate-card="${card.id}" data-player-card-index="${index}">Activate</button>
              <button type="button" data-player-export-card="${card.id}">Export Card</button>`;
      const compactEffect = formatCardEffectAtMastery(card, participant);
      return `
          <article class="card-item" data-player-card="${card.id}" data-player-card-index="${index}">
            <details class="card-collapse" data-player-card-details-key="${escapeHtml(cardKey)}">
              <summary>
                <div class="card-summary-row">
                  <div class="card-summary-main">
                    <span class="card-summary-ap">AP ${Number(card.apCost || 0)}</span>
                    <span class="card-summary-effect">${escapeHtml(compactEffect || '—')}</span>
                  </div>
                  ${options.inactive ? '' : `<button type="button" class="card-summary-action" data-player-use-card="${card.id}" ${useDisabledAttr}>Use</button>`}
                </div>
              </summary>
              <div class="card-collapse-body">
                <h4>${card.name}</h4>
                <p>• ${card.type || '—'} · ${card.tier || '—'}${options.inactive ? ' · Inactive' : ''}</p>
                ${pauseLocked ? '<p class="muted">Used this long rest.</p>' : ''}
                ${renderPlayerCardAttributeTable(card, participant)}
                ${renderConstructMetaLine(card, participant)}
                ${renderMasteryLines(card)}
                ${card.fusion ? `<p>Fusion: ${card.fusion}</p>` : ''}
                ${card.setBonuses ? `<p>Set Bonuses: ${card.setBonuses}</p>` : ''}
                <p>Mastery Level: ${card.masteryLevel || 1} (${Math.min(card.masteryUses || 0, card.masteryThresholds?.level4 || getTierMasteryThresholdDefaults(card.tier).level4)}/${card.masteryThresholds?.level4 || getTierMasteryThresholdDefaults(card.tier).level4} uses)</p>
                <p>Automation: ${summarizeModifiers(card.modifiers || {})}</p>
                ${
                  options.inactive
                    ? ''
                    : renderPlayerCardTargetControl(card, participant)
                }
                <label>Set Mastery
                  <select data-player-card-mastery="${card.id}" data-player-card-index="${index}">
                    <option value="1" ${Number(card.masteryLevel || 1) === 1 ? 'selected' : ''}>Level 1</option>
                    <option value="2" ${Number(card.masteryLevel || 1) === 2 ? 'selected' : ''}>Level 2</option>
                    <option value="3" ${Number(card.masteryLevel || 1) === 3 ? 'selected' : ''}>Level 3</option>
                    <option value="4" ${Number(card.masteryLevel || 1) >= 4 ? 'selected' : ''}>Level 4</option>
                  </select>
                </label>
                <div class="card-actions">
                  ${options.inactive ? inactiveActions : activeActions}
                </div>
              </div>
            </details>
          </article>`;
    })
    .join('');
}

function getPlayerCardTargetEntityKinds(card = {}) {
  const source = Array.isArray(card?.targetEntityKinds)
    ? card.targetEntityKinds
    : String(card?.targetEntityKinds || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
  const allowed = Array.from(
    new Set(
      source
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter((entry) => entry === 'participant' || entry === 'construct')
    )
  );
  return allowed.length ? allowed : null;
}

function getPlayerCardContestedOptions(card = {}) {
  const source = card?.contestedEffect;
  if (!source || typeof source !== 'object' || !Array.isArray(source.options)) return [];
  return source.options
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || '').trim();
      const label = String(entry.label || entry.name || entry.statusName || id).trim();
      return id ? { id, label: label || id } : null;
    })
    .filter(Boolean);
}

function getPlayerCardDefaultContestedChoiceId(card = {}) {
  const options = getPlayerCardContestedOptions(card);
  return options.length === 1 ? options[0].id : '';
}

function renderPlayerCardContestedControl(card = {}) {
  const options = getPlayerCardContestedOptions(card);
  if (!options.length) return '';
  if (options.length === 1) return '';
  const label = String(card?.contestedEffect?.choiceLabel || 'Effect').trim() || 'Effect';
  return `<label>${escapeHtml(label)}
    <select data-player-card-contested-choice="${card.id || ''}">
      <option value="">Select effect…</option>
      ${options.map((entry) => `<option value="${entry.id}">${escapeHtml(entry.label)}</option>`).join('')}
    </select>
  </label>`;
}

function getPlayerCardPerTargetInputs(card = {}) {
  if (!Array.isArray(card?.perTargetInputs)) return [];
  return card.perTargetInputs
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || '').trim();
      const label = String(entry.label || id).trim();
      const type = String(entry.type || 'text').trim().toLowerCase();
      if (!id || !label || !['number', 'checkbox', 'text'].includes(type)) return null;
      return {
        id,
        label,
        type,
        min: Number.isFinite(Number(entry.min)) ? Number(entry.min) : null,
        max: Number.isFinite(Number(entry.max)) ? Number(entry.max) : null,
        step: Number.isFinite(Number(entry.step)) ? Number(entry.step) : null,
        defaultValue: entry.defaultValue,
        defaultChecked: entry.defaultChecked === true
      };
    })
    .filter(Boolean);
}

function getSelectedPlayerCardTargetIds(article, card = {}) {
  if (!article || !card?.id) return [];
  const targetMode = getCardTargetMode(card);
  if (targetMode === 'multi_select') {
    return Array.from(article.querySelector(`[data-player-card-targets="${card.id}"]`)?.selectedOptions || [])
      .map((option) => option.value)
      .filter(Boolean);
  }
  const targetId = article.querySelector(`[data-player-card-target="${card.id}"]`)?.value || '';
  return targetId ? [targetId] : [];
}

function renderPlayerCardPerTargetInputControl(cardId, targetId, field, value) {
  if (field.type === 'checkbox') {
    return `<label class="compact-label">
      <span>${escapeHtml(field.label)}</span>
      <input
        type="checkbox"
        data-player-card-target-detail="${cardId}"
        data-player-card-target-id="${targetId}"
        data-player-card-target-field="${field.id}"
        ${value ? 'checked' : ''}
      />
    </label>`;
  }
  return `<label class="compact-label">
    <span>${escapeHtml(field.label)}</span>
    <input
      type="${field.type}"
      data-player-card-target-detail="${cardId}"
      data-player-card-target-id="${targetId}"
      data-player-card-target-field="${field.id}"
      value="${escapeHtml(String(value ?? ''))}"
      ${field.min != null ? `min="${field.min}"` : ''}
      ${field.max != null ? `max="${field.max}"` : ''}
      ${field.step != null ? `step="${field.step}"` : ''}
    />
  </label>`;
}

function renderPlayerCardPerTargetDetailSection(card = {}, targetIds = [], existingValues = {}) {
  const fields = getPlayerCardPerTargetInputs(card);
  if (!fields.length) return '';
  if (!targetIds.length) {
    return '<p class="muted small-note">Select target(s) to configure additional card details.</p>';
  }
  return `
    <div class="card-target-detail-list">
      ${targetIds
        .map((targetId) => {
          const target = getPlayerEncounterTargetableById(targetId);
          if (!target) return '';
          return `
            <div class="card-target-detail-card">
              <strong>${escapeHtml(formatPlayerTargetableLabel(target))}</strong>
              <div class="form-row">
                ${fields
                  .map((field) => {
                    const stored = existingValues?.[targetId]?.[field.id];
                    const fallback = field.type === 'checkbox' ? field.defaultChecked : field.defaultValue ?? '';
                    return renderPlayerCardPerTargetInputControl(card.id || '', targetId, field, stored ?? fallback);
                  })
                  .join('')}
              </div>
            </div>`;
        })
        .join('')}
    </div>`;
}

function syncPlayerCardPerTargetInputs(article, card = {}) {
  if (!article || !card?.id) return;
  const container = article.querySelector(`[data-player-card-target-detail-container="${card.id}"]`);
  if (!container) return;
  const existingValues = {};
  container.querySelectorAll(`[data-player-card-target-detail="${card.id}"]`).forEach((input) => {
    const targetId = input.dataset.playerCardTargetId || '';
    const fieldId = input.dataset.playerCardTargetField || '';
    if (!targetId || !fieldId) return;
    if (!existingValues[targetId]) existingValues[targetId] = {};
    existingValues[targetId][fieldId] = input.type === 'checkbox' ? input.checked : input.value;
  });
  container.innerHTML = renderPlayerCardPerTargetDetailSection(card, getSelectedPlayerCardTargetIds(article, card), existingValues);
}

function collectPlayerCardPerTargetDetails(article, card = {}) {
  const fields = getPlayerCardPerTargetInputs(card);
  if (!article || !card?.id || !fields.length) return [];
  const detailsByTarget = new Map();
  article.querySelectorAll(`[data-player-card-target-detail="${card.id}"]`).forEach((input) => {
    const targetId = String(input.dataset.playerCardTargetId || '').trim();
    const fieldId = String(input.dataset.playerCardTargetField || '').trim();
    if (!targetId || !fieldId) return;
    if (!detailsByTarget.has(targetId)) {
      detailsByTarget.set(targetId, { targetId });
    }
    detailsByTarget.get(targetId)[fieldId] = input.type === 'checkbox' ? input.checked : input.value;
  });
  return Array.from(detailsByTarget.values());
}

function formatPlayerCardTargetSelectionLabel(card = {}, multiTargetCap = 0) {
  const minimum = Number.isFinite(Number(card.multiTargetMin)) ? Math.max(1, Math.round(Number(card.multiTargetMin))) : 0;
  if (minimum > 0 && minimum === multiTargetCap) {
    return `Targets (pick ${multiTargetCap})`;
  }
  return `Targets (up to ${multiTargetCap})`;
}

function renderPlayerCardCustomEffectControl(card = {}) {
  const effectId = String(card.customCardEffect || '').trim().toLowerCase();
  if (effectId === 'arcane_no') {
    const zones = getPlayerEncounterZones();
    return `<label>Zone to Cancel
      <select data-player-card-zone="${card.id}">
        <option value="">${zones.length ? 'Select zone…' : 'No active zones'}</option>
        ${zones.map((entry) => `<option value="${entry.id}">${escapeHtml(formatPlayerZoneLabel(entry))}</option>`).join('')}
      </select>
    </label>`;
  }
  if (effectId === 'demonic_ray_of_enfeeblement' && Number(card.masteryLevel || 1) >= 3) {
    return `<label class="checkbox-label">
      <input type="checkbox" data-player-card-use-hp-sacrifice="${card.id}" />
      Sacrifice 10 HP to apply Weakened 2 instead.
    </label>`;
  }
  return '';
}

function renderPlayerCardTargetControl(card = {}, participant = {}) {
  const selfOnly = isSelfTargetCard(card);
  const targetMode = getCardTargetMode(card);
  const allowSelfTarget = card.allowSelfTarget !== false;
  const targetEntityKinds = getPlayerCardTargetEntityKinds(card);
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const secondaryDamage = getCardSecondaryDamage(card);
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const showSecondaryTarget = secondaryDamage > 0 && secondaryTargetMode === 'adjacent';
  const hasContestedOptions = getPlayerCardContestedOptions(card).length > 0;
  const arcaneSplitEnabled =
    playerHasSetBonus(participant, 'Arcane', 5) && !selfOnly && targetMode === 'single' && !hasContestedOptions;
  const arcaneShiftEnabled =
    playerHasSetBonus(participant, 'Arcane', 3) &&
    (getCardDisplayDamage(card) > 0 || secondaryDamage > 0);
  const contestedControl = renderPlayerCardContestedControl(card);
  const arcaneControls = renderPlayerArcaneCardControls(card, participant, {
    splitEnabled: arcaneSplitEnabled,
    shiftEnabled: arcaneShiftEnabled
  });
  const customEffectControl = renderPlayerCardCustomEffectControl(card);
  const constructTargetAssist = renderPlayerConstructTargetAssistForCard(card, participant);
  const perTargetDetailContainer = getPlayerCardPerTargetInputs(card).length
    ? `<div data-player-card-target-detail-container="${card.id}">${renderPlayerCardPerTargetDetailSection(card)}</div>`
    : '';
  if (targetMode === 'none') {
    return [constructTargetAssist, customEffectControl, contestedControl, perTargetDetailContainer, arcaneControls].filter(Boolean).join('');
  }
  const selfId = participant.id || '';
  if (selfOnly || targetMode === 'all_others') {
    const label = targetMode === 'all_others' ? 'All other combatants' : 'Self';
    const value = targetMode === 'all_others' ? '' : selfId;
    return `<label>Target
      <select data-player-card-target="${card.id}" disabled>
        <option value="${value}" selected>${label}</option>
      </select>
    </label>
    ${
      showSecondaryTarget
        ? `<label>${escapeHtml(card.secondaryTargetLabel || 'Secondary Target')}
      <select data-player-card-secondary-target="${card.id}">
        <option value="">Select target…</option>
        ${renderPlayerTargetOptions(participant.id, false)}
      </select>
    </label>`
        : ''
    }
    ${constructTargetAssist}
    ${customEffectControl}
    ${contestedControl}
    ${perTargetDetailContainer}
    ${arcaneControls}`;
  }
  if (targetMode === 'multi_select') {
    return `<label>${escapeHtml(formatPlayerCardTargetSelectionLabel(card, multiTargetCap))}
    <select data-player-card-targets="${card.id}" multiple size="${Math.max(3, Math.min(6, multiTargetCap + 1))}">
      ${renderPlayerTargetOptions(participant.id, allowSelfTarget, 'all', participant, targetEntityKinds)}
    </select>
  </label>
  ${customEffectControl}
  ${contestedControl}
  ${perTargetDetailContainer}
  ${arcaneControls}`;
  }
  return `<label>Target
    <select data-player-card-target="${card.id}">
      <option value="">Select target…</option>
      ${renderPlayerTargetOptions(
        participant.id,
        allowSelfTarget,
        card.targetAlliesOnly === true ? 'allies' : card.targetEnemiesOnly === true ? 'enemies' : 'all',
        participant,
        targetEntityKinds
      )}
    </select>
  </label>
  ${constructTargetAssist}
  ${
    showSecondaryTarget
      ? `<label>${escapeHtml(card.secondaryTargetLabel || 'Secondary Target')}
    <select data-player-card-secondary-target="${card.id}">
      <option value="">Select target…</option>
      ${renderPlayerTargetOptions(participant.id, false)}
    </select>
      </label>`
      : ''
  }
  ${customEffectControl}
  ${contestedControl}
  ${perTargetDetailContainer}
  ${arcaneControls}`;
}

function renderPlayerArcaneCardControls(card = {}, participant = {}, options = {}) {
  const cardId = card.id || '';
  const controls = [];
  if (options.splitEnabled) {
    controls.push(`
      <label>Arcane Split Target
        <select data-player-card-arcane-split-target="${cardId}">
          <option value="">No split</option>
          ${renderPlayerTargetOptions(participant.id, false)}
        </select>
      </label>`);
  }
  if (options.shiftEnabled) {
    controls.push(`
      <label>Arcane Damage Type
        <select data-player-card-override-damage-type="${cardId}">
          <option value="">No change</option>
          ${DAMAGE_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
        </select>
      </label>`);
  }
  if (!controls.length) return '';
  return `<div class="form-row">${controls.join('')}</div>`;
}

function renderPlayerTargetOptions(actorId, includeSelf = false, filterMode = 'all', participant = null, allowedEntityKinds = null) {
  const options = [];
  if (includeSelf && actorId) {
    options.push(`<option value="${actorId}">Self</option>`);
  }
  for (const entry of getPlayerEncounterTargetables()) {
    if (entry.id === actorId) continue;
    const kind = String(entry?.entityKind || 'participant').toLowerCase();
    if (Array.isArray(allowedEntityKinds) && allowedEntityKinds.length && !allowedEntityKinds.includes(kind)) continue;
    if (filterMode === 'allies' && participant && !isPlayerTargetableAlly(participant, entry)) continue;
    if (filterMode === 'enemies' && participant && !isPlayerEnemyForUi(participant, entry)) continue;
    options.push(`<option value="${entry.id}">${escapeHtml(formatPlayerTargetableLabel(entry))}</option>`);
  }
  return options.join('');
}

function renderPlayerCardAttributeTable(card = {}, participant = {}) {
  const rows = [
    ['Set', card.set || '—'],
    ['Type', card.type || '—'],
    ['Tier', card.tier || '—'],
    ['Health Bonus', formatSignedValue(card.healthBonus || 0)],
    ['Shield Bonus', formatSignedValue(card.shieldBonus || 0)],
    ['AP Cost', Number(card.apCost || 0)],
    ['Range', formatCardRange(card)],
    ['Tags', (card.tags || []).join(', ') || '—']
  ];
  const chargesMax = Math.max(0, Math.round(Number(card.chargesMax ?? card.maxCharges ?? card.charges ?? 0) || 0));
  const chargesCurrent = chargesMax > 0
    ? Math.max(0, Math.round(Number(card.chargesCurrent ?? card.remainingCharges ?? chargesMax) || 0))
    : 0;
  if (chargesMax > 0) {
    rows.push(['Charges', `${chargesCurrent}/${chargesMax}`]);
  }
  rows.push(['Effect', formatCardEffectAtMastery(card, participant)]);
  const body = rows
    .map(
      ([label, value]) => `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${escapeHtml(String(value ?? '—'))}</td>
      </tr>`
    )
    .join('');
  return `
    <table class="card-attribute-table">
      <thead>
        <tr><th>Attribute</th><th>Description</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderCardEffectLine(card = {}) {
  const effect = String(card.effect || '').trim();
  if (!effect) return '';
  if (isRedundantDamageEffect(card, effect)) return '';
  return `<p>${effect}</p>`;
}

function formatCardRange(card = {}) {
  const text = String(card.rangeText || '').trim();
  if (text) return text;
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const range = getCardScaledEffectValue(card, 'rangeByLevel', level, Number(card.range || 0));
  return `${range} ft`;
}

function isSelfTargetCard(card = {}) {
  const text = String(card.rangeText || '').trim().toLowerCase();
  if (text === 'self') return true;
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const range = getCardScaledEffectValue(card, 'rangeByLevel', level, Number(card.range || 0));
  return Number(range || 0) <= 0;
}

function getCardTargetMode(card = {}) {
  const token = String(card.targetMode || '').trim().toLowerCase();
  if (token === 'none' || token === 'untargeted' || token === 'no_target') return 'none';
  if (token === 'all_others' || token === 'all-targets') return 'all_others';
  if (token === 'multi' || token === 'multi_select' || token === 'multi_up_to_3' || token === 'up_to_3') {
    return 'multi_select';
  }
  return 'single';
}

function getCardMultiTargetCap(card = {}) {
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const fallback = Number.isFinite(Number(card.multiTargetMax))
    ? Math.max(1, Math.round(Number(card.multiTargetMax)))
    : 3;
  const value = getCardScaledEffectValue(card, 'multiTargetMaxByLevel', level, fallback);
  return Number.isFinite(Number(value)) ? Math.max(1, Math.round(Number(value))) : fallback;
}

function getCardSecondaryTargetMode(card = {}) {
  const token = String(card.secondaryTargetMode || '').trim().toLowerCase();
  if (token === 'same' || token === 'adjacent') return token;
  return '';
}

function getCardSecondaryDamage(card = {}) {
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const value = getCardScaledEffectValue(card, 'secondaryDamageByLevel', level, Number(card.secondaryDamage || 0));
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function resolveStatusName(statusId = '', statusName = '') {
  if (statusName) return statusName;
  const match = (state.reference?.statuses || []).find((entry) => entry.id === statusId);
  return match?.name || statusId || 'Status';
}

function getStatusApplyAtMastery(card = {}, level = 1) {
  const source = card.statusApply;
  if (!source || typeof source !== 'object') return null;
  const id = String(source.id || source.statusId || '').trim();
  const name = resolveStatusName(id, String(source.name || '').trim());
  let stacks = Math.max(
    1,
    Math.round(
      getCardScaledValue(source.stacksByLevel, level, Number(source.stacks ?? source.defaultStacks ?? 1))
    )
  );
  stacks = Math.max(1, Math.round(getCardScaledEffectValue(card, 'statusApplyStacksByLevel', level, stacks)));
  if (!id && !name) return null;
  return { id, name, stacks };
}

function getPlayerCardContestedEffectSummary(card = {}, level = 1) {
  const source = card?.contestedEffect;
  if (!source || typeof source !== 'object' || !Array.isArray(source.options)) return '';
  const options = source.options
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const label = String(entry.label || entry.name || entry.statusName || entry.id || '').trim();
      if (!label) return null;
      const durationTurns = Math.max(
        0,
        Math.round(
          getCardScaledValue(
            entry.durationTurnsByLevel,
            level,
            Number(entry.durationTurns ?? source.durationTurns ?? 0)
          )
        )
      );
      return {
        label,
        notes: String(entry.statusNotes || entry.notes || '').trim(),
        statusStacks: Math.max(
          1,
          Math.round(
            getCardScaledValue(
              entry.statusStacksByLevel,
              level,
              Number(entry.statusStacks || 1)
            )
          )
        ),
        durationTurns
      };
    })
    .filter(Boolean);
  if (!options.length) return '';
  const parts = [
    options.length === 1
      ? `On success, apply ${options[0].label}${options[0].statusStacks > 1 ? ` ${options[0].statusStacks}` : ''}${
          options[0].durationTurns > 0 ? ` for ${options[0].durationTurns} turn${options[0].durationTurns === 1 ? '' : 's'}` : ''
        }.`
      : `Choose ${options
          .map((entry) => `${entry.label}${entry.statusStacks > 1 ? ` ${entry.statusStacks}` : ''}${entry.durationTurns > 0 ? ` (${entry.durationTurns} turn${entry.durationTurns === 1 ? '' : 's'})` : ''}`)
          .join(' or ')}.`
  ];
  options.forEach((entry) => {
    if (entry.notes) {
      parts.push(`${entry.label}: ${entry.notes}`);
    }
  });
  if (source.hostileOnly !== false) {
    const resistedDamage = Math.max(
      0,
      Math.round(getCardScaledValue(source.resistedCasterDamageByLevel, level, Number(source.resistedCasterDamage || 0)))
    );
    const resistedType = String(source.resistedDamageType || 'Psychic').trim();
    if (resistedDamage > 0) {
      parts.push(`If hostile target resists, caster takes ${resistedDamage}${resistedType ? ` ${resistedType}` : ''} damage.`);
    }
  }
  return parts.join(' ');
}

function formatCardEffectAtMastery(card = {}, participant = {}) {
  const fallback = String(card.effect || '').trim();
  if (isConstructCard(card)) {
    return fallback || '—';
  }
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  if (isZoneCard(card, level)) {
    const radius = Math.max(0, Math.round(getCardScaledEffectValue(card, 'zoneRadiusByLevel', level, Number(card.zoneRadius || 0))));
    const duration = Math.max(0, Math.round(Number(card.zoneDurationTurns || 0)));
    const zoneDamage = getCardDisplayDamage(card);
    const zoneHeal = Math.max(0, Math.round(getCardScaledEffectValue(card, 'zoneHealByLevel', level, Number(card.zoneHeal || 0))));
    const zoneShield = Math.max(0, Math.round(getCardScaledEffectValue(card, 'zoneShieldRestoreByLevel', level, Number(card.zoneShieldRestore || 0))));
    const zoneStatus = getStatusApplyAtMastery(card, level);
    const parts = [`Create zone (${radius} ft radius${duration > 0 ? `, ${duration} turn${duration === 1 ? '' : 's'}` : ''}).`];
    if (zoneDamage > 0) {
      parts.push(`Deals ${zoneDamage}${card.damageType ? ` ${card.damageType}` : ''} damage each turn.`);
    }
    if (zoneStatus) {
      parts.push(`Applies ${zoneStatus.name} ${zoneStatus.stacks} each turn.`);
    }
    if (zoneHeal > 0) {
      parts.push(`Restores ${zoneHeal} HP${card.zoneHealAlliesOnly !== false ? ' to allies' : ''} each turn.`);
    }
    if (zoneShield > 0) {
      parts.push(`Restores ${zoneShield} Shield${card.zoneShieldRestoreAlliesOnly !== false ? ' to allies' : ''} each turn.`);
    }
    return parts.join(' ');
  }
  const targetMode = getCardTargetMode(card);
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const customEffectId = String(card.customCardEffect || '').trim().toLowerCase();
  const parts = [];
  if (customEffectId === 'arcane_two_step') {
    const duration = level >= 2 ? 3 : 2;
    parts.push(`Gain Two Step for ${duration} turn${duration === 1 ? '' : 's'}. End of each turn, resolve a 10 ft forward horizontal teleport if space permits.`);
  } else if (customEffectId === 'arcane_haste_matrix') {
    const duration = level >= 2 ? 3 : 2;
    parts.push(`Target ally gains +2 AP at the start of each turn for ${duration} turn${duration === 1 ? '' : 's'}. When it ends, Haste Crash applies (-4 AP on the next turn). Each creature can only be targeted twice per encounter.`);
  } else if (customEffectId === 'arcane_pause_button') {
    const duration = level >= 2 ? 2 : 1;
    const pauseAp = level >= 2 ? 4 : 2;
    parts.push(
      `After this turn, time pauses for ${duration} extra turn${duration === 1 ? '' : 's'}. You may act with ${pauseAp} AP each paused turn. Zone timing, construct timing, incoming delayed effects, and round-based triggers are suspended during the pause. Then forfeit your next normal turn. Once per long rest.`
    );
  }
  const damage = getCardDisplayDamage(card);
  const secondaryDamage = getCardSecondaryDamage(card);
  const secondaryType = card.secondaryDamageType || card.damageType || '';
  if (damage > 0) {
    if (targetMode === 'all_others') {
      parts.push(`Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage to all targets.`);
    } else if (targetMode === 'multi_select') {
      parts.push(`Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage to up to ${multiTargetCap} targets.`);
    } else if (secondaryDamage > 0 && secondaryTargetMode === 'adjacent') {
      parts.push(
        `Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage to target and ${secondaryDamage}${
          secondaryType ? ` ${secondaryType}` : ''
        } damage to adjacent enemy.`
      );
    } else if (secondaryDamage > 0 && secondaryTargetMode === 'same') {
      parts.push(
        `Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage and ${secondaryDamage}${
          secondaryType ? ` ${secondaryType}` : ''
        } damage.`
      );
    } else {
      parts.push(`Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage.`);
    }
  } else if (secondaryDamage > 0) {
    parts.push(`Deal ${secondaryDamage}${secondaryType ? ` ${secondaryType}` : ''} damage.`);
  }
  const shield = Math.max(0, Math.round(getCardScaledEffectValue(card, 'shieldRestoreByLevel', level, 0)));
  if (shield > 0) {
    parts.push(`Restore ${shield} Shield.`);
  }
  const heal = Math.max(0, Math.round(getCardScaledEffectValue(card, 'healByLevel', level, Number(card.heal || 0))));
  if (heal > 0) {
    parts.push(`Restore ${heal} HP.`);
  }
  const move = Math.max(0, Math.round(getCardScaledEffectValue(card, 'movementByLevel', level, 0)));
  if (move > 0) {
    parts.push(`Move ${move} ft.`);
  }
  const pull = Math.max(0, Math.round(getCardScaledEffectValue(card, 'pullDistanceByLevel', level, 0)));
  if (pull > 0) {
    parts.push(`Pull target ${pull} ft.`);
  }
  const push = Math.max(0, Math.round(getCardScaledEffectValue(card, 'pushDistanceByLevel', level, 0)));
  if (push > 0) {
    parts.push(`Push target ${push} ft.`);
  }
  const statusApply = getStatusApplyAtMastery(card, level);
  if (statusApply) {
    if (targetMode === 'all_others') {
      parts.push(`Apply ${statusApply.name} ${statusApply.stacks} to all targets.`);
    } else if (targetMode === 'multi_select') {
      parts.push(`Apply ${statusApply.name} ${statusApply.stacks} to each selected target.`);
    } else {
      parts.push(`Apply ${statusApply.name} ${statusApply.stacks}.`);
    }
  }
  const contestedSummary = getPlayerCardContestedEffectSummary(card, level);
  if (contestedSummary) {
    parts.push(contestedSummary);
  }
  const shieldBonus = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'bonusDamageIfTargetHasShieldByLevel', level, Number(card.bonusDamageIfTargetHasShield || 0)))
  );
  if (shieldBonus > 0) {
    parts.push(`If target has Shield, deal +${shieldBonus} damage.`);
  }
  const notActedBonus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'bonusDamageIfTargetNotActedByLevel', level, Number(card.bonusDamageIfTargetNotActed || 0))
    )
  );
  if (notActedBonus > 0) {
    parts.push(`If target has not acted yet this round, deal +${notActedBonus} damage.`);
  }
  const belowHalfHpBonus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'bonusDamageIfTargetBelowHalfHpByLevel', level, Number(card.bonusDamageIfTargetBelowHalfHp || 0))
    )
  );
  if (belowHalfHpBonus > 0) {
    parts.push(`If target is below half HP, deal +${belowHalfHpBonus} damage.`);
  }
  const fullyBlockedDirectHp = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'directHpDamageOnFullyBlockedByLevel', level, Number(card.directHpDamageOnFullyBlocked || 0))
    )
  );
  if (fullyBlockedDirectHp > 0) {
    parts.push(`If Fully Blocked, deal ${fullyBlockedDirectHp} damage directly to HP.`);
  }
  const nextAttackBonus = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'nextAttackDamageBonusByLevel', level, Number(card.nextAttackDamageBonus || 0)))
  );
  if (nextAttackBonus > 0) {
    parts.push(`Target gains +${nextAttackBonus} damage on their next attack.`);
  }
  const nextTurnAp = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'grantTargetApNextTurnByLevel', level, Number(card.grantTargetApNextTurn || 0))
    )
  );
  if (nextTurnAp > 0) {
    parts.push(`Target gains +${nextTurnAp} AP on their next turn.`);
  }
  const selfNextTurnAp = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'selfApNextTurnByLevel', level, Number(card.selfApNextTurn || 0)))
  );
  if (selfNextTurnAp > 0) {
    parts.push(`Gain +${selfNextTurnAp} AP on your next turn.`);
  }
  const apGainNow = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'apGainByLevel', level, Number(card.apGain || 0)))
  );
  const selfHpLoss = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'selfHpLossByLevel', level, Number(card.selfHpLoss || 0)))
  );
  if (selfHpLoss > 0) {
    parts.push(`Lose ${selfHpLoss} HP.`);
  }
  if (apGainNow > 0) {
    parts.push(`Gain +${apGainNow} AP this turn.`);
  }
  const removeStatusCount = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'removeStatusCountByLevel', level, Number(card.removeStatusCount ?? card.cleanseStatusCount ?? 0))
    )
  );
  if (removeStatusCount > 0) {
    parts.push(`Remove up to ${removeStatusCount} status effect${removeStatusCount === 1 ? '' : 's'}.`);
  }
  const selfHpLossPerRemovedStatus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'selfHpLossPerRemovedStatusByLevel',
        level,
        Number(card.selfHpLossPerRemovedStatus || 0)
      )
    )
  );
  if (selfHpLossPerRemovedStatus > 0 && removeStatusCount > 0) {
    parts.push(`Lose +${selfHpLossPerRemovedStatus} HP per removed status.`);
  }
  const utilityNote = String(card.utilityNote || '').trim();
  if (utilityNote) {
    parts.push(utilityNote);
  }
  if (parts.length) {
    return parts.join(' ');
  }
  return fallback || '—';
}

function getCardScaledValue(source, level = 1, fallback = 0) {
  if (source == null) return fallback;
  const parsedLevel = Math.max(1, Math.min(4, Number(level || 1)));
  if (typeof source === 'number') return Number.isFinite(source) ? source : fallback;
  if (typeof source === 'string') {
    const parsed = Number(source);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof source !== 'object') return fallback;
  const direct = Number(source[parsedLevel]);
  if (Number.isFinite(direct)) return direct;
  const named = Number(source[`level${parsedLevel}`]);
  if (Number.isFinite(named)) return named;
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

function getCardActiveMasteryChoiceOptions(card = {}, level = 1) {
  const choices = Array.isArray(card.masteryChoiceOptions) ? card.masteryChoiceOptions : [];
  if (!choices.length) return [];
  const selectedId = String(card.masteryChoiceSelected || '').trim();
  const hasSelected = Boolean(selectedId && choices.some((entry) => entry?.id === selectedId));
  if (!hasSelected) return [];
  const currentLevel = Math.max(1, Math.min(4, Number(level || card.masteryLevel || 1)));
  const active = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue;
    const unlockLevel = Math.max(2, Math.min(4, Number(choice.unlockLevel || 2)));
    const deferredUnlockLevel = Math.max(
      unlockLevel,
      Math.min(4, Number(choice.deferredUnlockLevel || unlockLevel + 1))
    );
    const activeFromLevel = choice.id === selectedId ? unlockLevel : deferredUnlockLevel;
    if (currentLevel >= activeFromLevel) {
      active.push(choice);
    }
  }
  return active;
}

function getCardScaledEffectValue(card = {}, effectKey = '', level = 1, fallback = 0) {
  const key = String(effectKey || '').trim();
  if (!key) return fallback;
  const base = getCardScaledValue(card?.[key], level, fallback);
  const activeChoices = getCardActiveMasteryChoiceOptions(card, level);
  if (!activeChoices.length) return base;
  let override = null;
  for (const choice of activeChoices) {
    const scaled = getCardScaledValue(choice.effects?.[key], level, Number.NaN);
    if (!Number.isFinite(scaled)) continue;
    override = override == null ? Number(scaled) : Math.max(override, Number(scaled));
  }
  return override == null ? base : override;
}

function isConstructCard(card = {}) {
  if (card?.isConstruct === false) return false;
  if (card?.isZone === true) return false;
  if (card?.isConstruct === true) return true;
  const tags = Array.isArray(card?.tags) ? card.tags : [];
  return tags.some((tag) => {
    const token = String(tag || '').trim().toLowerCase();
    return token === 'construct' || token === 'turret';
  });
}

function isZoneCard(card = {}, level = 1) {
  if (card?.isZone === true) return true;
  const radius = getCardScaledEffectValue(card, 'zoneRadiusByLevel', level, Number(card.zoneRadius || 0));
  if (Number(radius || 0) > 0) return true;
  if (Number(card.zoneDurationTurns || 0) > 0) return true;
  return false;
}

function detectConstructMode(card = {}) {
  const explicit = String(card?.constructMode || '').trim().toLowerCase();
  if (explicit === 'damage' || explicit === 'status' || explicit === 'utility') return explicit;
  if (card?.constructStatusId || card?.constructStatusName) return 'status';
  return getCardDisplayDamage(card) > 0 ? 'damage' : 'utility';
}

function getConstructSetBonus(participant = {}) {
  const summary = participant?.derivedBonuses?.machineConstructs || {};
  const damageBonus = Number(summary.damageBonus || 0);
  const durationBonusTurns = Number(summary.durationBonusTurns || 0);
  return {
    damageBonus: Number.isFinite(damageBonus) ? Math.max(0, Math.round(damageBonus)) : 0,
    durationBonusTurns: Number.isFinite(durationBonusTurns) ? Math.max(0, Math.round(durationBonusTurns)) : 0
  };
}

function renderCardDamageLine(card = {}, participant = {}) {
  const baseDamage = getCardDisplayDamage(card);
  const secondaryDamage = getCardSecondaryDamage(card);
  const secondaryType = card.secondaryDamageType || card.damageType || '';
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const targetMode = getCardTargetMode(card);
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const typeText = card.damageType || '';
  if (!isConstructCard(card)) {
    if (baseDamage > 0 && secondaryDamage > 0 && secondaryTargetMode === 'adjacent') {
      return `<p>Damage: ${baseDamage} ${typeText} (target) + ${secondaryDamage} ${secondaryType} (adjacent)</p>`;
    }
    if (baseDamage > 0 && secondaryDamage > 0) {
      return `<p>Damage: ${baseDamage} ${typeText} + ${secondaryDamage} ${secondaryType}</p>`;
    }
    if (targetMode === 'all_others' && baseDamage > 0) {
      return `<p>Damage: ${baseDamage} ${typeText} (all targets)</p>`;
    }
    if (targetMode === 'multi_select' && baseDamage > 0) {
      return `<p>Damage: ${baseDamage} ${typeText} (up to ${multiTargetCap} targets)</p>`;
    }
    if (secondaryDamage > 0) {
      return `<p>Damage: ${secondaryDamage} ${secondaryType}</p>`;
    }
    return `<p>Damage: ${baseDamage} ${typeText}</p>`;
  }
  const mode = detectConstructMode(card);
  const constructBonus = getConstructSetBonus(participant).damageBonus;
  if (mode === 'utility') {
    return '<p>Damage: —</p>';
  }
  if (mode === 'status') {
    return `<p>Damage: ${constructBonus > 0 ? `+${constructBonus} Force` : '—'}</p>`;
  }
  if (!constructBonus) {
    return `<p>Damage: ${baseDamage} ${typeText}</p>`;
  }
  const boosted = Math.max(0, baseDamage + constructBonus);
  return `<p>Damage: ${baseDamage} ${typeText} <span class="muted">(Construct +${constructBonus} => ${boosted})</span></p>`;
}

function isPauseButtonUsedLongRest(card = {}) {
  const customEffectId = String(card?.customCardEffect || '').trim().toLowerCase();
  if (customEffectId !== 'arcane_pause_button') return false;
  return card?.effectState?.pauseButtonUsedLongRest === true;
}

function renderConstructMetaLine(card = {}, participant = {}) {
  if (!isConstructCard(card)) return '';
  const mode = detectConstructMode(card);
  const baseDuration = Math.max(
    0,
    Math.round(
      Number(
        getCardScaledValue(
          card.constructDurationTurnsByLevel,
          Number(card.masteryLevel || 1),
          Number(card.constructDurationTurns ?? 1)
        )
      ) || 0
    )
  );
  const durationBonus = getConstructSetBonus(participant).durationBonusTurns;
  const effective = baseDuration > 0 ? Math.max(1, baseDuration + durationBonus) : 0;
  const detail = durationBonus ? `${baseDuration} (+${durationBonus})` : `${baseDuration}`;
  const statusId = String(card.constructStatusId || '').trim();
  const statusName = String(card.constructStatusName || '').trim();
  const statusLabel = statusName || statusId;
  const stacks = Math.max(1, Number(card.constructStatusStacks || 1));
  const constructAp = Math.max(0, Math.round(Number(card.constructAp ?? 2) || 0));
  const constructHp = Math.max(
    1,
    Math.round(
      Number(
        getCardScaledValue(
          card.constructMaxHpByLevel,
          Number(card.masteryLevel || 1),
          Number(card.constructMaxHp ?? 1)
        )
      ) || 1
    )
  );
  const constructCards = Array.isArray(card.constructCards)
    ? card.constructCards
    : String(card.constructLinkedCard || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  const modeText = mode === 'status'
    ? `Status: ${statusLabel || 'Unknown'} x${stacks}`
    : mode === 'utility'
      ? (() => {
          const shieldRestore = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructShieldRestoreByLevel, Number(card.masteryLevel || 1), Number(card.constructShieldRestore || 0))
            )
          );
          const auraRadiusFt = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructAuraRadiusByLevel, Number(card.masteryLevel || 1), Number(card.constructAuraRadiusFt || 0))
            )
          );
          const visionRangeFt = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructVisionRangeByLevel, Number(card.masteryLevel || 1), Number(card.constructVisionRangeFt || 0))
            )
          );
          const utilityKind = String(card.constructUtilityKind || '').trim().toLowerCase();
          const heal = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructHealByLevel, Number(card.masteryLevel || 1), Number(card.constructHeal || 0))
            )
          );
          if (shieldRestore > 0) {
            const targetLabel = card.constructShieldRestoreAlliesOnly === true ? 'allies' : 'self';
            const auraText = auraRadiusFt > 0 ? ` within ${auraRadiusFt} ft` : '';
            return `Utility: restore ${shieldRestore} Shield to ${targetLabel}${auraText}`;
          }
          if (heal > 0) {
            const targetLabel = card.constructHealTargetOnly === true
              ? 'target'
              : card.constructHealAlliesOnly === true
                ? 'allies'
                : 'self';
            const triggerText = card.constructTriggerOnTargetTurn === true ? ' on target turn' : '';
            return `Utility: restore ${heal} HP to ${targetLabel}${triggerText}`;
          }
          if (utilityKind === 'scout') {
            return visionRangeFt > 0 ? `Scout utility (${visionRangeFt} ft vision)` : 'Scout utility';
          }
          if (utilityKind === 'factory') {
            return 'Factory utility';
          }
          return 'Utility construct';
        })()
      : 'Damage construct';
  const durationText = effective > 0
    ? `Duration ${detail} turn${effective === 1 ? '' : 's'} (effective ${effective})`
    : 'Duration until removed';
  return `<p>Construct: ${modeText} • ${durationText} • HP ${constructHp} • AP ${constructAp}${constructCards.length ? ` • Cards: ${constructCards.join(', ')}` : ''}</p>`;
}

function renderPlayerZones(participant) {
  const listEl = document.getElementById('playerZoneList');
  if (!listEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view zones.</p>';
    return;
  }
  const zones = participant.zones || [];
  if (!zones.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No active zones.</p>';
    return;
  }
  listEl.classList.remove('empty-state');
  listEl.innerHTML = `
    <div class="cards-grid construct-grid">
      ${zones
        .map((zone) => {
          const assigned = Array.isArray(zone.targetIds) ? zone.targetIds : [];
          const targets = assigned
            .map((targetId) => (state.encounter.participants || []).find((entry) => entry.id === targetId))
            .filter(Boolean);
          const targetNames = targets.map((entry) => entry.name);
          const targetPills = targets
            .map(
              (target) => `
                <span class="status-pill">
                  ${escapeHtml(target.name)}
                  <button type="button" data-player-zone-remove-target="${zone.id || ''}" data-player-zone-target-id="${target.id}">Remove</button>
                </span>`
            )
            .join('');
          const options = (state.encounter.participants || [])
            .filter((entry) => !assigned.includes(entry.id))
            .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`)
            .join('');
          const remaining =
            Number(zone.remainingTurns || 0) > 0
              ? ` · ${zone.remainingTurns} turn${zone.remainingTurns === 1 ? '' : 's'} left`
              : '';
          const enterDamage = Math.max(0, Number(zone.enterDamage || 0));
          const enterStatusName = String(zone.enterStatusName || zone.enterStatusId || '').trim();
          const enterStatusStacks = Math.max(1, Number(zone.enterStatusStacks || 1));
          const triggerMode = String(zone.triggerMode || '').trim().replace(/_/g, ' ');
          const triggerParts = [];
          if (zone.triggerOnTargetAdd) {
            if (enterDamage > 0) {
              triggerParts.push(`Trigger: ${enterDamage} ${escapeHtml(zone.enterDamageType || zone.damageType || 'damage')}`);
            }
            if (enterStatusName) {
              triggerParts.push(`Trigger: ${escapeHtml(enterStatusName)} ${enterStatusStacks}`);
            }
            if (triggerMode) {
              triggerParts.push(`Mode: ${escapeHtml(triggerMode)}`);
            }
            if (zone.consumeOnTrigger) {
              triggerParts.push('Single-use trigger');
            }
          }
          if (Number(zone.detectDc || 0) > 0) {
            triggerParts.push(`Detect DC ${Number(zone.detectDc)}`);
          }
          const triggerText = triggerParts.length
            ? `<p class="muted small-note">${triggerParts.join(' · ')}</p>`
            : '';
          const sustainParts = [];
          if (Number(zone.shieldRestore || 0) > 0) {
            sustainParts.push(
              `Restore ${Number(zone.shieldRestore)} Shield${zone.shieldRestoreAlliesOnly !== false ? ' (allies)' : ''}`
            );
          }
          if (Number(zone.heal || 0) > 0) {
            sustainParts.push(`Restore ${Number(zone.heal)} HP${zone.healAlliesOnly !== false ? ' (allies)' : ''}`);
          }
          const sustainText = sustainParts.length
            ? `<p class="muted small-note">${sustainParts.join(' · ')}</p>`
            : '';
          return `
            <article class="card-item construct-item">
              <h4>${escapeHtml(zone.name || 'Zone')}</h4>
              <p>${Number(zone.damage || 0)} ${escapeHtml(zone.damageType || 'damage')} · ${Number(zone.radiusFt || 0)} ft radius${remaining}</p>
              ${triggerText}
              ${sustainText}
              <p class="muted small-note">Currently in zone: ${targetNames.length ? escapeHtml(targetNames.join(', ')) : 'No targets assigned'}</p>
              <div class="status-list">
                ${targetPills || '<span class="muted">No targets assigned.</span>'}
              </div>
              <div class="form-row">
                <label>Add Target
                  <select data-player-zone-add-target="${zone.id || ''}">
                    <option value="">Select target…</option>
                    ${options}
                  </select>
                </label>
                <button type="button" data-player-zone-add-target-button="${zone.id || ''}">Add</button>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function isRedundantDamageEffect(card = {}, effectText = '') {
  const normalized = effectText.toLowerCase().replace(/\s+/g, ' ').trim();
  const plainDamagePattern = /^deal\s+\d*\s*[a-z]+\s+damage\.?$/;
  if (!plainDamagePattern.test(normalized)) return false;
  const damageType = String(card.damageType || '').toLowerCase().trim();
  if (!damageType) return false;
  return normalized.includes(damageType);
}

function renderMasteryLines(card = {}) {
  const lines = Array.isArray(card.mastery) ? card.mastery : [];
  if (!lines.length) return '';
  const items = lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');
  if (!items) return '';
  return `
    <div class="mastery-block">
      <strong>Mastery</strong>
      <ul class="mastery-list">${items}</ul>
    </div>
  `;
}

function getCardDisplayDamage(card = {}) {
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const byLevel = card.masteryDamageByLevel || {};
  const base = Number(card.damage || 0);
  let damage = Number(
    byLevel[level] ??
      byLevel[`level${level}`] ??
      (level >= 4
        ? byLevel[4] ?? byLevel.level4
        : level >= 3
          ? byLevel[3] ?? byLevel.level3
          : level >= 2
            ? byLevel[2] ?? byLevel.level2
            : byLevel[1] ?? byLevel.level1) ??
      base
  );
  if (!Number.isFinite(damage)) {
    damage = base;
  }
  let overrideDamage = null;
  for (const option of getCardActiveMasteryChoiceOptions(card, level)) {
    const damageByLevel = option.effects?.damageByLevel;
    const override = Number(damageByLevel?.[level] ?? damageByLevel?.[`level${level}`]);
    if (Number.isFinite(override)) {
      overrideDamage = overrideDamage == null ? Math.round(override) : Math.max(overrideDamage, Math.round(override));
    }
    const damageBonusByLevel = option.effects?.damageBonusByLevel;
    const bonus = Number(damageBonusByLevel?.[level] ?? damageBonusByLevel?.[`level${level}`]);
    if (Number.isFinite(bonus)) {
      damage += Math.round(bonus);
    }
  }
  if (overrideDamage != null) {
    damage = overrideDamage;
  }
  return Math.max(0, Math.round(damage));
}

function wirePlayerCardExports(participant) {
  if (!participant) return;
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  listEl.querySelectorAll('[data-player-export-card]').forEach((button) => {
    button.onclick = () => {
      const cards = participant?.cards || [];
      const card = cards.find((entry) => entry.id === button.dataset.playerExportCard);
      if (!card) {
        notify('Card not found.');
        return;
      }
      downloadJson(card, `${slugify(participant?.name || 'card')}-${slugify(card.name)}.json`);
    };
  });
}

function wirePlayerCardUses(participant) {
  if (!participant) return;
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  listEl.querySelectorAll('[data-player-card-target], [data-player-card-targets]').forEach((control) => {
    const cardId = control.dataset.playerCardTarget || control.dataset.playerCardTargets;
    if (!cardId) return;
    const card = (participant.cards || []).find((entry) => entry.id === cardId);
    if (!card) return;
    const article = control.closest('.card-item');
    syncPlayerCardPerTargetInputs(article, card);
    control.onchange = () => syncPlayerCardPerTargetInputs(article, card);
  });
  listEl.querySelectorAll('[data-player-use-card]').forEach((button) => {
    button.onclick = async (event) => {
      if (button.closest('summary')) {
        event.preventDefault();
        event.stopPropagation();
      }
      const cardId = button.dataset.playerUseCard;
      if (!cardId) return;
      const article = button.closest('.card-item');
      const targetId = article?.querySelector(`[data-player-card-target="${cardId}"]`)?.value || '';
      const targetIds = Array.from(
        article?.querySelector(`[data-player-card-targets="${cardId}"]`)?.selectedOptions || []
      ).map((option) => option.value);
      const secondaryTargetId = article?.querySelector(`[data-player-card-secondary-target="${cardId}"]`)?.value || '';
      const arcaneSplitTargetId = article?.querySelector(`[data-player-card-arcane-split-target="${cardId}"]`)?.value || '';
      const overrideDamageType = article?.querySelector(`[data-player-card-override-damage-type="${cardId}"]`)?.value || '';
      const zoneId = article?.querySelector(`[data-player-card-zone="${cardId}"]`)?.value || '';
      const useHpSacrifice = article?.querySelector(`[data-player-card-use-hp-sacrifice="${cardId}"]`)?.checked === true;
      const card = (participant.cards || []).find((entry) => entry.id === cardId) || {};
      const contestedChoiceId =
        article?.querySelector(`[data-player-card-contested-choice="${cardId}"]`)?.value || getPlayerCardDefaultContestedChoiceId(card);
      const targetDetails = collectPlayerCardPerTargetDetails(article, card);
      try {
        const selectedRemoveStatusIds = await resolvePlayerCardStatusSelectionPrompt(participant, card, targetId, targetIds);
        if (selectedRemoveStatusIds == null) return;
        const contestedResolution = await resolvePlayerCardContestedOutcomePrompt(
          participant,
          card,
          targetId,
          contestedChoiceId,
          targetIds
        );
        if (contestedResolution == null) return;
        const result = await api('/api/actions/card', 'POST', {
          participantId: participant.id,
          cardId,
          targetId,
          targetIds,
          secondaryTargetId,
          arcaneSplitTargetId,
          overrideDamageType,
          zoneId,
          useHpSacrifice,
          selectedRemoveStatusIds,
          targetDetails,
          contestedChoiceId: contestedResolution.contestedChoiceId,
          contestedOutcome: contestedResolution.contestedOutcome,
          contestedTargetOutcomes: contestedResolution.contestedTargetOutcomes
        });
        await resolvePlayerMasteryChoicePrompt(participant.id, result?.masteryChoicePrompt);
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-card-mastery]').forEach((select) => {
    select.onchange = async () => {
      const cardId = select.dataset.playerCardMastery;
      const fallbackIndex = Number(select.dataset.playerCardIndex);
      const level = Number(select.value || 1);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const cards = [...(latest?.cards || participant.cards || [])];
      let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= cards.length) return;
      cards[idx] = applyManualMastery(cards[idx], level);
      const response = await patchParticipant(participant.id, { cards });
      const savedCards = response?.participant?.cards || cards;
      const savedCard =
        savedCards.find((entry) => cardId && entry.id === cardId) ||
        (Number.isInteger(idx) ? savedCards[idx] : null) ||
        cards[idx];
      await resolvePlayerMasteryChoicePrompt(participant.id, getPendingPlayerMasteryChoicePrompt(savedCard, level));
      fetchState();
    };
  });
}

function wirePlayerCardActivation(participant) {
  if (!participant) return;
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  listEl.querySelectorAll('[data-player-deactivate-card]').forEach((button) => {
    button.onclick = async () => {
      const cardId = button.dataset.playerDeactivateCard;
      const fallbackIndex = Number(button.dataset.playerCardIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const cards = [...(latest?.cards || participant.cards || [])];
      let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= cards.length) return;
      cards[idx] = { ...cards[idx], active: false };
      await patchParticipant(participant.id, { cards });
      fetchState();
    };
  });
  listEl.querySelectorAll('[data-player-activate-card]').forEach((button) => {
    button.onclick = async () => {
      const cardId = button.dataset.playerActivateCard;
      const fallbackIndex = Number(button.dataset.playerCardIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const cards = [...(latest?.cards || participant.cards || [])];
      const activeCount = cards.filter((entry) => isCardActive(entry)).length;
      if (activeCount >= MAX_ACTIVE_CARDS) {
        notify(`Deactivate a card first. Max ${MAX_ACTIVE_CARDS} active cards.`);
        return;
      }
      let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= cards.length) return;
      cards[idx] = { ...cards[idx], active: true };
      await patchParticipant(participant.id, { cards });
      fetchState();
    };
  });
  listEl.querySelector('[data-player-activate-selected-card]')?.addEventListener('click', async () => {
    const select = listEl.querySelector('[data-player-inactive-card-select]');
    const option = select?.selectedOptions?.[0];
    if (!option) {
      notify('Choose an inactive card first.');
      return;
    }
    const cardId = option.dataset.cardId || '';
    const fallbackIndex = Number(option.dataset.cardIndex);
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const cards = [...(latest?.cards || participant.cards || [])];
    const activeCount = cards.filter((entry) => isCardActive(entry)).length;
    if (activeCount >= MAX_ACTIVE_CARDS) {
      notify(`Deactivate a card first. Max ${MAX_ACTIVE_CARDS} active cards.`);
      return;
    }
    let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
    if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
    if (idx < 0 || idx >= cards.length) return;
    cards[idx] = { ...cards[idx], active: true };
    await patchParticipant(participant.id, { cards });
    notify(`${cards[idx].name || 'Card'} activated.`);
    fetchState();
  });
}

function renderPlayerConstructs(participant) {
  const listEl = document.getElementById('playerConstructList');
  if (!listEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view constructs.</p>';
    return;
  }
  const constructs = participant.constructs || [];
  const summary = participant.derivedBonuses?.machineConstructs || {};
  const cap = Number(summary.maxActive || 1);
  if (!constructs.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = `<p class="empty-state">No active constructs (0/${cap}).</p>`;
    return;
  }
  listEl.classList.remove('empty-state');
  const currentTurnEntry = getCurrentTurnEntry();
  listEl.innerHTML = `
    <p class="muted small-note">Active ${constructs.length}/${cap} • Bonus +${summary.damageBonus || 0} damage, +${summary.durationBonusTurns || 0} duration.</p>
    <div class="cards-grid construct-grid">
      ${constructs
        .map((construct) => {
          const isConstructTurn =
            currentTurnEntry?.kind === 'construct' &&
            currentTurnEntry.participantId === participant.id &&
            currentTurnEntry.constructId === construct.id;
          const assignedTargets = Array.isArray(construct.targetIds)
            ? construct.targetIds
                .map((targetId) => formatPlayerTargetableLabel(getPlayerEncounterTargetableById(targetId)))
                .filter(Boolean)
            : [];
          const targetMarkup = assignedTargets.length
            ? `<p class="muted small-note">Assigned targets: ${escapeHtml(assignedTargets.join(', '))}</p>`
            : `
              <label>Target
                <select data-player-construct-target="${construct.id || ''}">
                  <option value="">Select target…</option>
                  ${getPlayerEncounterTargetables()
                    .filter((entry) => entry.id !== participant.id && entry.id !== construct.id)
                    .map(
                      (entry) =>
                        `<option value="${entry.id}" ${entry.id === construct.targetId ? 'selected' : ''}>${escapeHtml(formatPlayerTargetableLabel(entry))}</option>`
                    )
                    .join('')}
                </select>
              </label>
              ${renderPlayerConstructPriorityHint(participant, construct)}`;
          return `
            <article class="card-item construct-item">
              <h4>${escapeHtml(construct.name || 'Construct')}</h4>
              <p>${escapeHtml(renderConstructCardSummary(construct))}</p>
              <p>${
                Number(construct.remainingTurns || 0) > 0
                  ? `Turns Remaining: ${Number(construct.remainingTurns || 0)}`
                  : 'Duration: Until removed'
              }</p>
              <p>HP: ${Number(construct.hp || 0)}/${Number(construct.maxHp || 0)} • AP: ${Number(construct.apCurrent || 0)}/${Number(construct.apMax || 0)}</p>
              <p>Cards: ${escapeHtml((Array.isArray(construct.cards) && construct.cards.length ? construct.cards.join(', ') : '—'))}</p>
              ${targetMarkup}
              <div class="card-actions">
                <button type="button" data-player-construct-move="${construct.id || ''}" ${Number(construct.apCurrent || 0) < 1 || (playerConstructHasManualTurn(construct) && !isConstructTurn) ? 'disabled' : ''}>Move ${Number(construct.moveFt || 10)} ft (1 AP)</button>
                <button type="button" data-player-remove-construct="${construct.id || ''}">Remove</button>
              </div>
              ${isConstructTurn ? renderPlayerConstructTurnPanel(participant, construct) : ''}
            </article>`;
        })
        .join('')}
    </div>
  `;
  listEl.querySelectorAll('[data-player-construct-target]').forEach((select) => {
    select.onchange = async () => {
      const constructId = select.dataset.playerConstructTarget;
      const targetId = select.value || '';
      if (!constructId || !targetId) return;
      try {
        await api('/api/constructs/target', 'POST', {
          participantId: participant.id,
          constructId,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-remove-construct]').forEach((button) => {
    button.onclick = async () => {
      const constructId = button.dataset.playerRemoveConstruct;
      if (!constructId) return;
      try {
        await api('/api/constructs/remove', 'POST', {
          participantId: participant.id,
          constructId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-construct-move]').forEach((button) => {
    button.onclick = async () => {
      const constructId = button.dataset.playerConstructMove;
      if (!constructId) return;
      try {
        await api('/api/constructs/move', 'POST', {
          participantId: participant.id,
          constructId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-construct-standard]').forEach((button) => {
    button.onclick = async () => {
      const actionId = button.dataset.playerConstructStandard;
      const constructId = button.dataset.playerConstructId;
      if (!actionId || !constructId) return;
      try {
        await api('/api/actions/standard', 'POST', {
          actionId,
          participantId: participant.id,
          constructId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-construct-use-card]').forEach((button) => {
    button.onclick = async () => {
      const constructId = button.dataset.playerConstructUseCard;
      const cardId = button.dataset.playerConstructCardId;
      if (!constructId || !cardId) return;
      const article = button.closest('.construct-turn-panel');
      const targetId = article?.querySelector(`[data-player-construct-card-target="${constructId}:${cardId}"]`)?.value || '';
      try {
        await api('/api/actions/card', 'POST', {
          participantId: participant.id,
          constructId,
          cardId,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-construct-pass-turn]').forEach((button) => {
    button.onclick = async () => {
      const constructId = button.dataset.playerConstructPassTurn;
      const activeEntry = getCurrentTurnEntry();
      if (
        !constructId ||
        activeEntry?.kind !== 'construct' ||
        activeEntry.constructId !== constructId ||
        activeEntry.participantId !== participant.id
      ) {
        return;
      }
      try {
        await api('/api/turn/next', 'POST');
      } catch (err) {
        notify(err.message);
      }
    };
  });
}

function getPlayerLowestHpEnemyTarget(participant) {
  return getPlayerEncounterTargetables()
    .filter((entry) => Number(entry.hp || 0) > 0)
    .filter((entry) => isPlayerEnemyForUi(participant, entry))
    .sort((left, right) => {
      const hpCompare = Number(left.hp || 0) - Number(right.hp || 0);
      if (hpCompare !== 0) return hpCompare;
      const maxHpCompare = Number(left.maxHp || 0) - Number(right.maxHp || 0);
      if (maxHpCompare !== 0) return maxHpCompare;
      return String(left.name || '').localeCompare(String(right.name || ''));
    })[0] || null;
}

function renderPlayerConstructPriorityHint(participant, construct = {}) {
  if (String(construct.targetPriority || '').trim().toLowerCase() !== 'lowest_hp_enemy') {
    return '';
  }
  const target = getPlayerLowestHpEnemyTarget(participant);
  if (!target) return '<p class="muted small-note">Target assist: no enemy target available.</p>';
  return `<p class="muted small-note">Target assist: closest to death is ${escapeHtml(formatPlayerTargetableLabel(target))}.</p>`;
}

function renderPlayerConstructTargetAssistForCard(card = {}, participant = {}) {
  if (String(card.constructTargetPriority || '').trim().toLowerCase() !== 'lowest_hp_enemy') {
    return '';
  }
  const target = getPlayerLowestHpEnemyTarget(participant);
  if (!target) return '<p class="muted small-note">Target assist: no enemy target available.</p>';
  return `<p class="muted small-note">Target assist: closest to death is ${escapeHtml(formatPlayerTargetableLabel(target))}.</p>`;
}

function renderPlayerConstructTurnStandardButtons(construct = {}) {
  const actionsById = new Map((state.reference?.standardActions || []).map((action) => [action.id, action]));
  const order = ['disengage', 'half_cover', 'interact', 'recover', 'cleanse', 'guard'];
  return order
    .map((id) => actionsById.get(id))
    .filter(Boolean)
    .map(
      (action) =>
        `<button type="button" data-player-construct-standard="${action.id}" data-player-construct-id="${construct.id || ''}">${escapeHtml(action.label)} (${Number(action.apCost || 0)} AP)</button>`
    )
    .join('');
}

function renderPlayerConstructTurnCards(participant, construct = {}) {
  const cards = Array.isArray(construct.cardObjects) ? construct.cardObjects : [];
  if (!cards.length) return '';
  return cards
    .map((card) => {
      const filterMode = card.targetAlliesOnly === true ? 'allies' : card.targetEnemiesOnly === true ? 'enemies' : 'all';
      return `
        <div class="card-item">
          <strong>${escapeHtml(card.name || 'Card')}</strong>
          <p>${escapeHtml(card.effect || renderConstructCardSummary({ damage: card.damage || 0, damageType: card.damageType || '' }))}</p>
          ${
            getCardTargetMode(card) !== 'none'
              ? `<label>Target
                  <select data-player-construct-card-target="${construct.id || ''}:${card.id || ''}">
                    <option value="">Select target…</option>
                    ${getPlayerEncounterTargetables()
                      .filter((entry) => entry.id !== construct.id)
                      .filter((entry) => {
                        if (filterMode === 'allies') return isPlayerTargetableAlly(participant, entry);
                        if (filterMode === 'enemies') return isPlayerEnemyForUi(participant, entry);
                        return true;
                      })
                      .filter((entry) => {
                        const allowedKinds = getPlayerCardTargetEntityKinds(card);
                        if (!Array.isArray(allowedKinds) || !allowedKinds.length) return true;
                        const kind = String(entry.entityKind || 'participant').toLowerCase();
                        return allowedKinds.includes(kind);
                      })
                      .map(
                        (entry) =>
                          `<option value="${entry.id}" ${entry.id === construct.targetId ? 'selected' : ''}>${escapeHtml(formatPlayerTargetableLabel(entry))}</option>`
                      )
                      .join('')}
                  </select>
                </label>
                ${renderPlayerConstructPriorityHint(participant, construct)}`
              : ''
          }
          <div class="card-actions">
            <button type="button" data-player-construct-use-card="${construct.id || ''}" data-player-construct-card-id="${card.id || ''}" ${Number(construct.apCurrent || 0) < Number(card.apCost || 0) ? 'disabled' : ''}>Use ${escapeHtml(card.name || 'Card')} (${Number(card.apCost || 0)} AP)</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderPlayerConstructTurnPanel(participant, construct = {}) {
  if (construct?.summonSicknessTurn === true) {
    return `
      <div class="construct-turn-panel">
        <p class="muted small-note">This construct was summoned this turn and cannot act yet.</p>
        <div class="card-actions">
          <button type="button" data-player-construct-pass-turn="${construct.id || ''}">Pass Turn</button>
        </div>
      </div>
    `;
  }
  const standardButtons = renderPlayerConstructTurnStandardButtons(construct);
  const cardMarkup = renderPlayerConstructTurnCards(participant, construct);
  return `
    <div class="construct-turn-panel">
      <p class="muted small-note">Construct turn active. Use a card, move, take a standard action, or pass.</p>
      ${cardMarkup}
      ${standardButtons ? `<div class="button-grid">${standardButtons}</div>` : ''}
      <div class="card-actions">
        <button type="button" data-player-construct-pass-turn="${construct.id || ''}">Pass Turn</button>
      </div>
    </div>
  `;
}

function renderConstructCardSummary(construct = {}) {
  if (Array.isArray(construct.cardObjects) && construct.cardObjects.length) {
    return `Card actions: ${construct.cardObjects.map((card) => card.name).filter(Boolean).join(', ')}`;
  }
  const mode = String(construct.mode || '').toLowerCase();
  if (mode === 'status') {
    const statusLabel = construct.statusName || construct.statusId || 'Status';
    const stacks = Math.max(1, Number(construct.statusStacks || 1));
    const force = Number(construct.damage || 0);
    return force > 0
      ? `Applies ${statusLabel} x${stacks} + ${force} Force`
      : `Applies ${statusLabel} x${stacks}`;
  }
  if (mode === 'utility') {
    const shieldRestore = Math.max(0, Number(construct.shieldRestore || 0));
    const heal = Math.max(0, Number(construct.heal || 0));
    const auraRadiusFt = Math.max(0, Number(construct.auraRadiusFt || 0));
    const utilityKind = String(construct.utilityKind || '').trim().toLowerCase();
    const visionRangeFt = Math.max(0, Number(construct.visionRangeFt || 0));
    const detectDc = Math.max(0, Number(construct.detectDc || 0));
    if (shieldRestore > 0) {
      const targetLabel = construct.shieldRestoreAlliesOnly ? 'allies' : 'self';
      const auraText = auraRadiusFt > 0 ? ` within ${auraRadiusFt} ft` : '';
      return `Utility: restore ${shieldRestore} Shield to ${targetLabel}${auraText}`;
    }
    if (heal > 0) {
      const targetLabel = construct.healTargetOnly
        ? 'target'
        : construct.healAlliesOnly
          ? 'allies'
          : 'self';
      const triggerText = construct.triggerOnTargetTurn ? ' on target turn' : '';
      return `Utility: restore ${heal} HP to ${targetLabel}${triggerText}`;
    }
    if (utilityKind === 'scout') {
      const details = [];
      if (visionRangeFt > 0) details.push(`vision ${visionRangeFt} ft`);
      if (detectDc > 0) details.push(`detect DC ${detectDc}`);
      if (construct.utilityNote) details.push(String(construct.utilityNote));
      return details.length ? `Scout utility (${details.join(', ')})` : 'Scout utility';
    }
    if (utilityKind === 'factory') {
      return construct.utilityNote
        ? `Factory utility (${String(construct.utilityNote)})`
        : 'Factory utility';
    }
    return construct.utilityNote
      ? `Utility construct (${String(construct.utilityNote)})`
      : 'Utility construct';
  }
  return `Damage: ${Number(construct.damage || 0)} ${construct.damageType || ''}`.trim();
}

function renderRelics(participant) {
  const listEl = document.getElementById('playerRelicList');
  const formEl = document.getElementById('playerRelicForm');
  const drawerEl = document.getElementById('playerRelicDrawer');
  const importInput = document.getElementById('playerImportRelic');
  if (importInput) {
    importInput.onchange = (event) => handlePlayerRelicFile(event, drawerEl);
  }
  if (!listEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view relics.</p>';
    if (formEl) {
      formEl.onsubmit = null;
    }
    return;
  }
  const relics = participant?.relics || [];
  if (!relics.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No relics tracked.</p>';
  } else {
    listEl.classList.remove('empty-state');
    listEl.innerHTML = relics
      .map(
        (relic, index) => `
          <article class="relic-card">
            <h4>${relic.name}</h4>
            <p>HP ${relic.hp ?? 0} · AP ${relic.ap ?? 0} · Focus: ${relic.ability || '—'}</p>
            <p>${relic.description || ''}</p>
            <button type="button" data-remove-relic="${index}">Remove</button>
          </article>`
      )
      .join('');
  }
  listEl.querySelectorAll('[data-remove-relic]').forEach((button) => {
    button.onclick = async () => {
      const index = Number(button.dataset.removeRelic);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currentRelics = latest?.relics || relics;
      const updated = currentRelics.filter((_, idx) => idx !== index);
      await patchParticipant(participant.id, { relics: updated });
      fetchState();
    };
  });
  if (formEl) {
    formEl.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(formEl);
      const newRelic = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name: data.get('name'),
        hp: Number(data.get('hp') || 0),
        ap: Number(data.get('ap') || 0),
        ability: data.get('ability') || '',
        description: data.get('description') || ''
      };
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currentRelics = latest?.relics || relics;
      await patchParticipant(participant.id, { relics: [...currentRelics, newRelic] });
      formEl.reset();
      if (drawerEl) drawerEl.open = false;
      fetchState();
    };
  }
}

function isPlayerEquipmentItem(item = {}) {
  const tokens = [item.name, item.description, ...(Array.isArray(item.tags) ? item.tags : [])]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return /\b(weapon|weapons|armor|armour|equipment|shield|sword|dagger|axe|bow|staff|spear|mace|hammer|mail|plate|helmet|helm|gauntlet)\b/.test(tokens);
}

function renderPlayerInventoryCards(items = [], emptyText = 'No inventory items yet.') {
  if (!items.length) {
    return `<p class="empty-state">${emptyText}</p>`;
  }
  return items
    .map(
      ({ item, index }) => `
        <article class="relic-card">
          <h4>${escapeHtml(item.name || `Item ${index + 1}`)}</h4>
          <p>Qty ${Number(item.quantity || 1)}</p>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
          ${(item.tags || []).length ? `<p>Tags: ${escapeHtml((item.tags || []).join(', '))}</p>` : ''}
          <button type="button" data-remove-inventory="${item.id || ''}" data-inventory-index="${index}">Remove</button>
        </article>`
    )
    .join('');
}

function renderInventory(participant) {
  const listEl = document.getElementById('playerInventoryList');
  const formEl = document.getElementById('playerInventoryForm');
  const currencyListEl = document.getElementById('playerCurrencyList');
  const currencyFormEl = document.getElementById('playerCurrencyForm');
  const equipmentListEl = document.getElementById('playerWeaponArmorList');
  const equipmentDrawerEl = document.getElementById('playerEquipmentDrawer');
  const equipmentEditorEl = document.getElementById('playerEquipmentEditor');
  if (!listEl || !currencyListEl || !equipmentListEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view inventory.</p>';
    currencyListEl.classList.add('empty-state');
    currencyListEl.innerHTML = '<p class="empty-state">Select a combatant to view currencies.</p>';
    equipmentListEl.classList.remove('empty-state');
    equipmentListEl.innerHTML = '<p class="empty-state">Select a combatant to view equipment.</p>';
    if (equipmentEditorEl) equipmentEditorEl.innerHTML = '';
    if (formEl) formEl.onsubmit = null;
    if (currencyFormEl) currencyFormEl.onsubmit = null;
    return;
  }
  const items = participant?.inventory || [];
  const currencies = participant?.currencies || [];
  const generalItems = items.map((item, index) => ({ item, index }));
  listEl.classList.toggle('empty-state', generalItems.length === 0);
  listEl.innerHTML = renderPlayerInventoryCards(generalItems, 'No items or supplies tracked.');
  equipmentListEl.classList.remove('empty-state');
  equipmentListEl.innerHTML = renderPlayerEquipmentSummary(participant);
  if (equipmentEditorEl) {
    equipmentEditorEl.innerHTML = renderPlayerEquipmentEditor(participant);
  }
  if (!currencies.length) {
    currencyListEl.classList.add('empty-state');
    currencyListEl.innerHTML = '<p class="empty-state">No currencies yet.</p>';
  } else {
    currencyListEl.classList.remove('empty-state');
    currencyListEl.innerHTML = currencies
      .map(
        (currency, index) => `
          <article class="currency-tab">
            <div class="currency-tab-header">
              <strong>${escapeHtml(currency.name || `Currency ${index + 1}`)}</strong>
              <span>${Number(currency.amount || 0)}</span>
            </div>
            <div class="currency-tab-controls">
              <input type="number" min="1" step="1" value="1" data-player-currency-input="${currency.id || ''}" data-player-currency-index="${index}" />
              <button type="button" data-player-currency-adjust="add" data-player-currency-id="${currency.id || ''}" data-player-currency-index="${index}">Add</button>
              <button type="button" data-player-currency-adjust="remove" data-player-currency-id="${currency.id || ''}" data-player-currency-index="${index}">Remove</button>
              <button type="button" data-player-remove-currency="${currency.id || ''}" data-player-currency-index="${index}">Delete</button>
            </div>
          </article>`
      )
      .join('');
  }
  listEl.querySelectorAll('[data-remove-inventory]').forEach((button) => {
    button.onclick = async () => {
      const itemId = button.dataset.removeInventory;
      const fallbackIndex = Number(button.dataset.inventoryIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const inventory = [...(latest?.inventory || participant.inventory || [])];
      let idx = inventory.findIndex((item) => itemId && item.id === itemId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= inventory.length) return;
      inventory.splice(idx, 1);
      await patchParticipant(participant.id, { inventory });
      fetchState();
    };
  });
  currencyListEl.querySelectorAll('[data-player-currency-adjust]').forEach((button) => {
    button.onclick = async () => {
      const direction = button.dataset.playerCurrencyAdjust === 'remove' ? -1 : 1;
      const currencyId = button.dataset.playerCurrencyId;
      const fallbackIndex = Number(button.dataset.playerCurrencyIndex);
      const amountInput = button
        .closest('.currency-tab')
        ?.querySelector('[data-player-currency-input]');
      const step = Math.max(1, Math.round(Number(amountInput?.value || 1)));
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currencies = [...(latest?.currencies || participant.currencies || [])];
      let idx = currencies.findIndex((entry) => currencyId && entry.id === currencyId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= currencies.length) return;
      const current = Math.max(0, Number(currencies[idx].amount || 0));
      const next = direction > 0 ? current + step : Math.max(0, current - step);
      currencies[idx] = { ...currencies[idx], amount: next };
      await patchParticipant(participant.id, { currencies });
      fetchState();
    };
  });
  currencyListEl.querySelectorAll('[data-player-remove-currency]').forEach((button) => {
    button.onclick = async () => {
      const currencyId = button.dataset.playerRemoveCurrency;
      const fallbackIndex = Number(button.dataset.playerCurrencyIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currencies = [...(latest?.currencies || participant.currencies || [])];
      let idx = currencies.findIndex((entry) => currencyId && entry.id === currencyId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= currencies.length) return;
      currencies.splice(idx, 1);
      await patchParticipant(participant.id, { currencies });
      fetchState();
    };
  });
  if (formEl) {
    formEl.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(formEl);
      const name = String(data.get('name') || '').trim();
      if (!name) {
        notify('Item name is required.');
        return;
      }
      const newItem = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name,
        quantity: Math.max(1, Number(data.get('quantity') || 1)),
        description: String(data.get('description') || '').trim(),
        tags: String(data.get('tags') || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      };
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currentInventory = latest?.inventory || participant.inventory || [];
      await patchParticipant(participant.id, { inventory: [...currentInventory, newItem] });
      formEl.reset();
      formEl.classList.add('hidden');
      fetchState();
    };
  }
  if (currencyFormEl) {
    currencyFormEl.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(currencyFormEl);
      const name = String(data.get('name') || '').trim();
      if (!name) {
        notify('Currency name is required.');
        return;
      }
      const amount = Math.max(0, Math.round(Number(data.get('amount') || 0)));
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currencies = [...(latest?.currencies || participant.currencies || [])];
      const existingIndex = currencies.findIndex(
        (entry) => String(entry.name || '').trim().toLowerCase() === name.toLowerCase()
      );
      if (existingIndex >= 0) {
        const current = Math.max(0, Number(currencies[existingIndex].amount || 0));
        currencies[existingIndex] = {
          ...currencies[existingIndex],
          amount: current + amount
        };
      } else {
        currencies.push({
          id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name,
          amount
        });
      }
      await patchParticipant(participant.id, { currencies });
      currencyFormEl.reset();
      currencyFormEl.classList.add('hidden');
      notify(existingIndex >= 0 ? `${name} updated.` : `${name} added.`);
      fetchState();
    };
  }
  equipmentEditorEl?.querySelectorAll('[data-player-equipment-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const slot = String(form.dataset.playerEquipmentForm || '').trim();
      if (!slot) return;
      const formData = new FormData(form);
      const slotPayload = buildEquipmentSlotPayloadFromFormData(formData, slot);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const equipment = {
        ...(latest?.equipment || participant.equipment || {})
      };
      equipment[slot] = slotPayload;
      await patchParticipant(participant.id, { equipment });
      if (equipmentDrawerEl) equipmentDrawerEl.open = false;
      fetchState();
    });
  });
  equipmentEditorEl?.querySelectorAll('[data-player-clear-equipment]').forEach((button) => {
    button.addEventListener('click', async () => {
      const slot = String(button.dataset.playerClearEquipment || '').trim();
      if (!slot) return;
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const equipment = {
        ...(latest?.equipment || participant.equipment || {}),
        [slot]: null
      };
      await patchParticipant(participant.id, { equipment });
      fetchState();
    });
  });
}

function renderLog() {
  const participant = getFocusedParticipant();
  if (!participant) {
    els.logList.innerHTML = createMode
      ? '<p class="empty-state">Create a character to start tracking actions.</p>'
      : '<p class="empty-state">No log entries.</p>';
    return;
  }
  const relevant = (state.encounter.log || []).filter((entry) => entry.participantId === participant.id);
  if (!relevant.length) {
    els.logList.innerHTML = '<p class="empty-state">No actions logged for this combatant yet.</p>';
    return;
  }
  els.logList.innerHTML = relevant
    .slice(-15)
    .reverse()
    .map(
      (entry) => `
        <div class="log-entry">
          <time>${new Date(entry.at).toLocaleTimeString()}</time>
          <div>${entry.text}</div>
        </div>`
    )
    .join('');
}

function renderTurnInfo() {
  const currentEntry = getCurrentTurnEntry();
  if (!currentEntry) {
    els.turnInfo.textContent = 'No turn active.';
    return;
  }
  if (currentEntry.kind === 'zone') {
    const owner = currentEntry.participant;
    const zone = currentEntry.zone;
    const isFocused = owner?.id && owner.id === focusId;
    els.turnInfo.innerHTML = isFocused
      ? `<strong>Your zone effect turn:</strong> ${escapeHtml(zone?.name || 'Zone')}`
      : `Current turn: ${escapeHtml(owner?.name || 'Combatant')} zone (${escapeHtml(zone?.name || 'Zone')})`;
    return;
  }
  if (currentEntry.kind === 'construct') {
    const owner = currentEntry.participant;
    const construct = currentEntry.construct;
    const isFocused = owner?.id && owner.id === focusId;
    els.turnInfo.innerHTML = isFocused
      ? `<strong>Your construct turn:</strong> ${escapeHtml(construct?.name || 'Construct')} (${Number(construct?.apCurrent || 0)}/${Number(construct?.apMax || 0)} AP)`
      : `Current turn: ${escapeHtml(owner?.name || 'Combatant')} construct (${escapeHtml(construct?.name || 'Construct')})`;
    return;
  }
  const current = currentEntry.participant;
  if (!current) {
    els.turnInfo.textContent = 'No turn active.';
    return;
  }
  const isTurn = focusId && current.id === focusId;
  els.turnInfo.innerHTML = isTurn
    ? `<strong>Your turn!</strong> Spend ${current.apCurrent} of ${current.apMax} AP.`
    : `Current turn: ${current.name}`;
}

function renderStatuses(participant) {
  const statuses = participant.statuses || [];
  if (!statuses.length) {
    return '<span class="muted">None</span>';
  }
  return statuses
    .map(
      (status, index) => {
        const key = status.id || `index-${index}`;
        const remainingTurns = Math.max(0, Number(status?.remainingTurns || 0));
        const meta = [
          remainingTurns > 0 ? `${remainingTurns} turn${remainingTurns === 1 ? '' : 's'} left` : '',
          status.notes || ''
        ]
          .filter(Boolean)
          .join(' • ');
        const showStacks = Number(status?.stacks || 0) > 1 || remainingTurns <= 0;
        return `
        <span class="status-pill">
          ${status.name}${showStacks && status.stacks ? ` ×${status.stacks}` : ''}
          ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
          <button type="button" data-player-status-stack="${key}" data-player-status-index="${index}" data-player-status-delta="-1">-</button>
          <button type="button" data-player-status-stack="${key}" data-player-status-index="${index}" data-player-status-delta="1">+</button>
          <button type="button" data-player-remove-status="${key}" data-player-status-index="${index}">✕</button>
        </span>`;
      })
    .join('');
}

function summarizeModifiers(modifiers = {}) {
  const labels = {
    maxHp: 'HP',
    maxShield: 'Shield',
    apMax: 'AP',
    guardRestore: 'Guard',
    damageBonus: 'Damage'
  };
  const summary = Object.entries(labels)
    .map(([key, label]) => {
      const value = modifiers[key] || 0;
      if (!value) return null;
      return `${label} ${value > 0 ? '+' : ''}${value}`;
    })
    .filter(Boolean)
    .join(', ');
  return summary || '—';
}

function summarizePlayerSetAbilityBonuses(abilityBonuses = {}) {
  const labels = {
    strength: 'STR',
    dexterity: 'DEX',
    constitution: 'CON',
    intelligence: 'INT',
    wisdom: 'WIS',
    charisma: 'CHA'
  };
  return Object.entries(labels)
    .map(([key, label]) => {
      const value = Number(abilityBonuses?.[key] || 0);
      if (!value) return null;
      return `${label} ${value > 0 ? '+' : ''}${value}`;
    })
    .filter(Boolean)
    .join(', ');
}

function renderPlayerSetBonusMeta(bonus = {}) {
  const details = [
    summarizePlayerSetAbilityBonuses(bonus.abilityBonuses),
    Array.isArray(bonus.proficiencies) && bonus.proficiencies.length
      ? `Proficiencies: ${bonus.proficiencies.join(', ')}`
      : '',
    Array.isArray(bonus.languages) && bonus.languages.length
      ? `Languages: ${bonus.languages.join(', ')}`
      : ''
  ].filter(Boolean);
  return details.length ? `<br><small class="muted">${escapeHtml(details.join(' · '))}</small>` : '';
}

function getPlayerDerivedSetValues(participant = {}, key = 'proficiencies') {
  return Array.isArray(participant?.derivedBonuses?.setGrants?.[key]) ? participant.derivedBonuses.setGrants[key] : [];
}

function filterPlayerManualOverlap(values = [], derivedValues = []) {
  const existing = new Set((values || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
  return (derivedValues || []).filter((value) => {
    const key = String(value || '').trim().toLowerCase();
    return key && !existing.has(key);
  });
}

function getPlayerManageState(participantId) {
  const snapshot = participantId ? playerManageState.get(participantId) : null;
  return {
    mitigation: Boolean(snapshot?.mitigation),
    abilities: Boolean(snapshot?.abilities)
  };
}

function togglePlayerManageState(participantId, key) {
  if (!participantId || !key) return;
  const current = getPlayerManageState(participantId);
  playerManageState.set(participantId, {
    ...current,
    [key]: !current[key]
  });
}

function wirePlayerSheetEvents(participant) {
  const panel = els.stats;
  panel.querySelectorAll('[data-player-dashboard-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.playerDashboardTab;
      if (!tabId) return;
      setPlayerDashboardTab(participant.id, tabId);
      render();
    });
  });
  panel.querySelectorAll('[data-player-compact-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.playerCompactToggle;
      if (!key) return;
      togglePlayerCompactTableExpanded(participant.id, key);
      render();
    });
  });
  panel.querySelector('[data-player-team-select]')?.addEventListener('change', async (event) => {
    const team = String(event.currentTarget.value || '').trim();
    await patchParticipant(participant.id, { team });
    fetchState();
  });
  panel.querySelectorAll('[data-player-standard]').forEach((button) => {
    button.onclick = () => handlePlayerStandardAction(button.dataset.playerStandard);
  });
  panel.querySelector('[data-player-weapon-attack]')?.addEventListener('click', () => {
    handlePlayerWeaponAttack();
  });
  panel.querySelectorAll('[data-player-activate-set]').forEach((button) => {
    button.onclick = async () => {
      if (button.disabled) return;
      try {
        const activation = buildPlayerSetActivationPayload(participant, button.dataset.playerActivateSet);
        if (!activation) return;
        await api('/api/set/activate', 'POST', activation);
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-player-set-ally-add-button]').forEach((button) => {
    button.onclick = async () => {
      const select = panel.querySelector('[data-player-set-ally-add]');
      const targetId = select?.value || '';
      if (!targetId) return;
      try {
        await api('/api/set/allies/add', 'POST', {
          participantId: participant.id,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-player-set-ally-remove]').forEach((button) => {
    button.onclick = async () => {
      const targetId = button.dataset.playerSetAllyRemove;
      if (!targetId) return;
      try {
        await api('/api/set/allies/remove', 'POST', {
          participantId: participant.id,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-inline-adjust]').forEach((button) => {
    button.onclick = () => {
      const delta = Number(button.dataset.delta || 0);
      handleStatAdjustment(button.dataset.inlineAdjust, delta);
    };
  });
  panel.querySelectorAll('[data-inline-set]').forEach((button) => {
    button.onclick = () => {
      const field = button.dataset.inlineSet;
      const input = panel.querySelector(`[data-inline-input="${field}"]`);
      const value = Number(input?.value);
      if (!Number.isFinite(value)) {
        notify('Enter a value before setting the stat.');
        return;
      }
      handleStatSet(field, value);
      if (input) input.value = '';
    };
  });
  panel.querySelectorAll('[data-ability-input]').forEach((input) => {
    input.onchange = async () => {
      const ability = input.dataset.abilityInput;
      const totalValue = Number(input.value || 0);
      const bonus = getPlayerAbilityBonus(participant, ability);
      const value = Math.round((Number.isFinite(totalValue) ? totalValue : 0) - bonus);
      participant.stats = participant.stats || {};
      participant.stats[ability] = value;
      await patchParticipant(participant.id, { stats: { [ability]: value } });
      fetchState();
    };
  });
  const profInput = panel.querySelector('[data-proficiency-input]');
  if (profInput) {
    profInput.onchange = async () => {
      const value = Number(profInput.value || 0);
      participant.proficiencyBonus = value;
      await patchParticipant(participant.id, { proficiencyBonus: value });
      fetchState();
    };
  }
  panel.querySelectorAll('[data-save-toggle]').forEach((checkbox) => {
    checkbox.onchange = async () => {
      const saves = getSavingThrowsSnapshot(participant);
      saves[checkbox.dataset.saveToggle] = checkbox.checked;
      await patchParticipant(participant.id, {
        savingThrows: saves
      });
      fetchState();
    };
  });
  panel.querySelectorAll('[data-skill-toggle]').forEach((checkbox) => {
    checkbox.onchange = async () => {
      const skill = checkbox.dataset.skillToggle;
      const type = checkbox.dataset.toggleType;
      const skills = getSkillsSnapshot(participant);
      const current = skills[skill] || getSkillState(participant, skill);
      const next = {
        proficient: type === 'proficient' ? checkbox.checked : current.proficient,
        expert: type === 'expert' ? checkbox.checked : current.expert
      };
      if (next.expert && !next.proficient) {
        next.proficient = true;
      }
      skills[skill] = next;
      await patchParticipant(participant.id, { skills });
      fetchState();
    };
  });

  panel.querySelector('[data-player-toggle-mitigation-manage]')?.addEventListener('click', () => {
    togglePlayerManageState(participant.id, 'mitigation');
    render();
  });
  panel.querySelector('[data-player-toggle-ability-manage]')?.addEventListener('click', () => {
    togglePlayerManageState(participant.id, 'abilities');
    render();
  });

  panel.querySelector('[data-resistance-form]')?.addEventListener('submit', (event) =>
    handlePlayerDamageForm(event, participant, 'resistances', 'resistance')
  );
  panel.querySelectorAll('[data-player-remove-resistance]').forEach((button) => {
    button.onclick = () =>
      handlePlayerDamageRemove(participant, 'resistances', Number(button.dataset.playerRemoveResistance));
  });
  panel.querySelector('[data-vulnerability-form]')?.addEventListener('submit', (event) =>
    handlePlayerDamageForm(event, participant, 'vulnerabilities', 'vulnerability')
  );
  panel.querySelectorAll('[data-player-remove-vulnerability]').forEach((button) => {
    button.onclick = () =>
      handlePlayerDamageRemove(participant, 'vulnerabilities', Number(button.dataset.playerRemoveVulnerability));
  });
  panel.querySelector('[data-immunity-form]')?.addEventListener('submit', (event) =>
    handlePlayerDamageForm(event, participant, 'immunities', 'immunity')
  );
  panel.querySelectorAll('[data-player-remove-immunity]').forEach((button) => {
    button.onclick = () =>
      handlePlayerDamageRemove(participant, 'immunities', Number(button.dataset.playerRemoveImmunity));
  });

  const abilityForm = panel.querySelector('[data-player-ability-form]');
  abilityForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const description = String(formData.get('description') || '').trim();
    if (!description) {
      notify('Ability description is required.');
      return;
    }
    const newAbility = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      name: String(formData.get('name') || '').trim() || 'Ability',
      description,
      automation: {}
    };
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const current = latest?.abilities || participant.abilities || [];
    await patchParticipant(participant.id, { abilities: [...current, newAbility] });
    event.target.reset();
    fetchState();
  });
  panel.querySelectorAll('[data-player-remove-ability]').forEach((button) => {
    button.onclick = async () => {
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const abilities = [...(latest?.abilities || participant.abilities || [])];
      const targetId = button.dataset.playerRemoveAbility;
      const fallbackIndex = Number(button.dataset.playerAbilityIndex);
      let idx = abilities.findIndex((entry) => targetId && entry.id === targetId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= abilities.length) return;
      abilities.splice(idx, 1);
      await patchParticipant(participant.id, { abilities });
      fetchState();
    };
  });
  panel.querySelector('[data-player-proficiency-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const token = String(formData.get('proficiency') || '').trim();
    if (!token) return;
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const current = Array.isArray(latest?.proficiencies) ? latest.proficiencies : [];
    const proficiencies = mergePlayerUniqueText(current, token);
    await patchParticipant(participant.id, { proficiencies });
    event.target.reset();
    fetchState();
  });
  panel.querySelectorAll('[data-player-remove-proficiency]').forEach((button) => {
    button.onclick = async () => {
      const index = Number(button.dataset.playerRemoveProficiency);
      if (!Number.isInteger(index) || index < 0) return;
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const proficiencies = [...(latest?.proficiencies || [])];
      if (index >= proficiencies.length) return;
      proficiencies.splice(index, 1);
      await patchParticipant(participant.id, { proficiencies });
      fetchState();
    };
  });
  panel.querySelector('[data-player-language-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const token = String(formData.get('language') || '').trim();
    if (!token) return;
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const current = Array.isArray(latest?.languages) ? latest.languages : [];
    const languages = mergePlayerUniqueText(current, token);
    await patchParticipant(participant.id, { languages });
    event.target.reset();
    fetchState();
  });
  panel.querySelectorAll('[data-player-remove-language]').forEach((button) => {
    button.onclick = async () => {
      const index = Number(button.dataset.playerRemoveLanguage);
      if (!Number.isInteger(index) || index < 0) return;
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const languages = [...(latest?.languages || [])];
      if (index >= languages.length) return;
      languages.splice(index, 1);
      await patchParticipant(participant.id, { languages });
      fetchState();
    };
  });

  const statusForm = panel.querySelector('[data-player-status-form]');
  panel.querySelector('[data-player-toggle-status]')?.addEventListener('click', () => {
    statusForm?.classList.toggle('hidden');
  });
  statusForm?.querySelector('[data-status-preset]')?.addEventListener('change', (event) => {
    applyPlayerStatusPreset(event.currentTarget, statusForm);
  });
  statusForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const currentStatuses = latest?.statuses || participant.statuses || [];
    const newStatus = buildStatusFromForm(formData);
    await patchParticipant(participant.id, { statuses: [...currentStatuses, newStatus] });
    event.target.reset();
    statusForm.classList.add('hidden');
    fetchState();
  });
  panel.querySelectorAll('[data-player-status-stack]').forEach((button) => {
    button.onclick = async () => {
      const delta = Number(button.dataset.playerStatusDelta || 0);
      if (!delta) return;
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const statuses = [...(latest?.statuses || participant.statuses || [])];
      const targetId = button.dataset.playerStatusStack;
      const fallbackIndex = Number(button.dataset.playerStatusIndex);
      let idx = statuses.findIndex((status, index) => {
        const key = status.id || `index-${index}`;
        return key === targetId;
      });
      if (idx < 0 && Number.isInteger(fallbackIndex)) {
        idx = fallbackIndex;
      }
      if (idx < 0 || idx >= statuses.length) return;
      const current = Math.max(1, Number(statuses[idx].stacks || 1));
      const next = current + delta;
      if (next <= 0) {
        statuses.splice(idx, 1);
      } else {
        statuses[idx] = { ...statuses[idx], stacks: next };
      }
      await patchParticipant(participant.id, { statuses });
      fetchState();
    };
  });
  panel.querySelectorAll('[data-player-remove-status]').forEach((button) => {
    button.onclick = async () => {
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const statuses = [...(latest?.statuses || participant.statuses || [])];
      const targetId = button.dataset.playerRemoveStatus;
      const fallbackIndex = Number(button.dataset.playerStatusIndex);
      let idx = statuses.findIndex((status, index) => {
        const key = status.id || `index-${index}`;
        return key === targetId;
      });
      if (idx < 0 && Number.isInteger(fallbackIndex)) {
        idx = fallbackIndex;
      }
      if (idx < 0 || idx >= statuses.length) return;
      statuses.splice(idx, 1);
      await patchParticipant(participant.id, { statuses });
      fetchState();
    };
  });
  panel.querySelectorAll('[data-player-zone-add-target-button]').forEach((button) => {
    button.onclick = async () => {
      const zoneId = button.dataset.playerZoneAddTargetButton;
      const select = panel.querySelector(`[data-player-zone-add-target="${zoneId}"]`);
      const targetId = select?.value || '';
      if (!zoneId || !targetId) return;
      try {
        await api('/api/zones/target/add', 'POST', {
          participantId: participant.id,
          zoneId,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-player-zone-remove-target]').forEach((button) => {
    button.onclick = async () => {
      const zoneId = button.dataset.playerZoneRemoveTarget;
      const targetId = button.dataset.playerZoneTargetId;
      if (!zoneId || !targetId) return;
      try {
        await api('/api/zones/target/remove', 'POST', {
          participantId: participant.id,
          zoneId,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  const inventoryForm = panel.querySelector('#playerInventoryForm');
  const currencyForm = panel.querySelector('#playerCurrencyForm');
  const relicDrawer = panel.querySelector('#playerRelicDrawer');
  const equipmentDrawer = panel.querySelector('#playerEquipmentDrawer');
  panel.querySelector('[data-player-toggle-inventory]')?.addEventListener('click', () => {
    inventoryForm?.classList.toggle('hidden');
  });
  panel.querySelector('[data-player-toggle-currency]')?.addEventListener('click', () => {
    currencyForm?.classList.toggle('hidden');
  });
  panel.querySelector('[data-player-toggle-relic]')?.addEventListener('click', () => {
    togglePlayerDrawer(relicDrawer);
  });
  panel.querySelector('[data-player-toggle-equipment]')?.addEventListener('click', () => {
    togglePlayerDrawer(equipmentDrawer);
  });
  const notesButton = panel.querySelector('[data-player-save-notes]');
  const notesInput = panel.querySelector('[data-player-notes]');
  notesButton?.addEventListener('click', async () => {
    await patchParticipant(participant.id, { notes: notesInput?.value || '' });
    fetchState();
  });
}

async function handleStatAdjustment(fieldKey, delta) {
  if (!fieldKey || !Number.isFinite(delta)) return;
  const participant = getFocusedParticipant();
  if (!participant) return;
  const field = STAT_FIELD_MAP[fieldKey];
  if (!field) return;
  const latest = (await fetchParticipantFromServer(participant.id)) || participant;
  const current = field === 'apCurrent' ? latest.apCurrent : latest[field];
  const payload = {};
  payload[field === 'apCurrent' ? 'apCurrent' : field] = Number(current || 0) + delta;
  await patchParticipant(participant.id, payload);
  fetchState();
}

async function handleStatSet(fieldKey, value) {
  if (!fieldKey || !Number.isFinite(value)) return;
  const participant = getFocusedParticipant();
  if (!participant) return;
  const field = STAT_FIELD_MAP[fieldKey];
  if (!field) return;
  const payload = {};
  payload[field === 'apCurrent' ? 'apCurrent' : field] = value;
  await patchParticipant(participant.id, payload);
  fetchState();
}

function getParticipantSnapshot(participantId) {
  if (!participantId) return null;
  return state.encounter.participants?.find((participant) => participant.id === participantId) || null;
}

function getFocusedParticipant() {
  return getParticipantSnapshot(focusId);
}

function getCurrentTurnEntry() {
  const entries = getPlayerTurnEntries();
  if (!entries.length) return null;
  const key = String(state.encounter.currentTurnKey || '');
  if (key) {
    const match = entries.find((entry) => getPlayerTurnEntryKey(entry) === key);
    return match || null;
  }
  const index = state.encounter.currentIndex;
  if (index != null && index >= 0 && index < entries.length) {
    return entries[index] || null;
  }
  return entries[0] || null;
}

function getCurrentParticipant() {
  const entry = getCurrentTurnEntry();
  return entry?.participant || null;
}

function updateUrl(options = {}) {
  if (typeof options.create === 'boolean') {
    createMode = options.create;
  }
  const url = new URL(window.location.href);
  if (focusId) {
    url.searchParams.set('id', focusId);
  } else {
    url.searchParams.delete('id');
  }
  if (createMode) {
    url.searchParams.set('create', '1');
  } else {
    url.searchParams.delete('create');
  }
  window.history.replaceState(null, '', url);
}

async function patchParticipant(participantId, payload) {
  try {
    const response = await api(`/api/participants/${participantId}`, 'PATCH', payload);
    if (response?.participant) {
      mergeParticipant(response.participant);
    }
    return response;
  } catch (err) {
    notify(err.message);
    return null;
  }
}

function buildPlayerCardFromForm(formData) {
  const card = {
    name: formData.get('name'),
    set: formData.get('set') || '',
    type: formData.get('type') || 'Attack',
    tier: formData.get('tier') || 'Common',
    apCost: formData.get('apCost'),
    range: formData.get('range'),
    shieldBonus: formData.get('shieldBonus'),
    damage: formData.get('damage'),
    damageType: formData.get('damageType'),
    constructDurationTurns: formData.get('constructDurationTurns') || 1,
    constructMode: formData.get('constructMode') || '',
    constructStatusId: formData.get('constructStatusId') || '',
    constructStatusStacks: formData.get('constructStatusStacks') || 1,
    tags: formData.get('tags') || '',
    effect: formData.get('effect') || '',
    healthBonus: formData.get('healthBonus'),
    masteryThresholds: {
      level2: formData.get('masteryTo2'),
      level3: formData.get('masteryTo3'),
      level4: formData.get('masteryTo4')
    },
    modifiers: {
      maxHp: formData.get('modMaxHp'),
      maxShield: formData.get('modMaxShield'),
      apMax: formData.get('modApMax'),
      guardRestore: formData.get('modGuard'),
      damageBonus: formData.get('modDamage')
    }
  };
  return normalizeCardPayload(card);
}

function applyManualMastery(card, level) {
  const next = { ...(card || {}) };
  const selected = Math.max(1, Math.min(4, Number(level || 1)));
  const tierDefaults = getTierMasteryThresholdDefaults(next.tier);
  const thresholds = next.masteryThresholds || {};
  const to2 = Math.max(1, Number(thresholds.level2 ?? tierDefaults.level2));
  const to3 = Math.max(to2 + 1, Number(thresholds.level3 ?? tierDefaults.level3));
  const to4 = Math.max(to3 + 1, Number(thresholds.level4 ?? tierDefaults.level4));
  let uses = Math.max(0, Number(next.masteryUses || 0));
  if (selected === 1) uses = Math.min(uses, to2 - 1);
  if (selected === 2) uses = Math.max(to2, Math.min(uses, to3 - 1));
  if (selected === 3) uses = Math.max(to3, Math.min(uses, to4 - 1));
  if (selected === 4) uses = Math.max(uses, to4);
  next.masteryLevel = selected;
  next.masteryUses = uses;
  next.masteryThresholds = { level2: to2, level3: to3, level4: to4 };
  return next;
}

function buildStatusFromForm(formData) {
  return {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    presetId: formData.get('preset') || '',
    name: formData.get('name'),
    stacks: Number(formData.get('stacks') || 1),
    notes: formData.get('notes') || ''
  };
}

function normalizeCardPayload(raw = {}) {
  const tier = String(raw.tier || 'Common').trim() || 'Common';
  const tierDefaults = getTierMasteryThresholdDefaults(tier);
  const masteryThresholds = {
    level2: toNumber(raw.masteryThresholds?.level2 ?? raw.masteryTo2 ?? tierDefaults.level2, tierDefaults.level2),
    level3: toNumber(raw.masteryThresholds?.level3 ?? raw.masteryTo3 ?? tierDefaults.level3, tierDefaults.level3),
    level4: toNumber(raw.masteryThresholds?.level4 ?? raw.masteryTo4 ?? tierDefaults.level4, tierDefaults.level4)
  };
  masteryThresholds.level2 = Math.max(1, Math.round(masteryThresholds.level2));
  masteryThresholds.level3 = Math.max(masteryThresholds.level2 + 1, Math.round(masteryThresholds.level3));
  masteryThresholds.level4 = Math.max(masteryThresholds.level3 + 1, Math.round(masteryThresholds.level4));
  const masteryLevel = Math.max(1, Math.min(4, Math.round(toNumber(raw.masteryLevel ?? 1, 1))));
  const masteryUses = Math.max(0, Math.round(toNumber(raw.masteryUses ?? 0, 0)));
  const baseDamage = Math.max(0, Math.round(toNumber(raw.damage ?? raw.baseDamage ?? 0, 0)));
  const explicitShieldSource = raw.shieldBonus ?? raw.bonusShield;
  const explicitShieldBonus =
    explicitShieldSource === '' || explicitShieldSource == null ? Number.NaN : Number(explicitShieldSource);
  const shieldBonus = Number.isFinite(explicitShieldBonus)
    ? explicitShieldBonus
    : getCardTierShieldBonus(tier);
  return {
    ...raw,
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: (raw.name || 'Imported Card').trim(),
    set: raw.set || '',
    type: raw.type || 'Attack',
    tier,
    active: raw.active !== false,
    apCost: toNumber(raw.apCost ?? raw.ap ?? 0),
    range: toNumber(raw.range ?? 0),
    rangeText: String(raw.rangeText || '').trim(),
    rangeByLevel: raw.rangeByLevel && typeof raw.rangeByLevel === 'object' ? { ...raw.rangeByLevel } : undefined,
    healthBonus: toNumber(raw.healthBonus ?? raw.hpBonus ?? 0),
    shieldBonus,
    damage: baseDamage,
    damageType: raw.damageType || raw.damage_type || '',
    secondaryDamage: toNumber(raw.secondaryDamage ?? 0),
    secondaryDamageByLevel:
      raw.secondaryDamageByLevel && typeof raw.secondaryDamageByLevel === 'object'
        ? { ...raw.secondaryDamageByLevel }
        : undefined,
    secondaryDamageType: String(raw.secondaryDamageType || '').trim(),
    secondaryTargetMode: String(raw.secondaryTargetMode || '').trim().toLowerCase(),
    secondaryTargetLabel: String(raw.secondaryTargetLabel || '').trim(),
    targetMode: String(raw.targetMode || '').trim().toLowerCase(),
    multiTargetMax: toNumber(raw.multiTargetMax ?? 0),
    multiTargetMaxByLevel:
      raw.multiTargetMaxByLevel && typeof raw.multiTargetMaxByLevel === 'object'
        ? { ...raw.multiTargetMaxByLevel }
        : undefined,
    bonusDamageIfTargetHasShieldByLevel:
      raw.bonusDamageIfTargetHasShieldByLevel && typeof raw.bonusDamageIfTargetHasShieldByLevel === 'object'
        ? { ...raw.bonusDamageIfTargetHasShieldByLevel }
        : undefined,
    directHpDamageOnFullyBlockedByLevel:
      raw.directHpDamageOnFullyBlockedByLevel && typeof raw.directHpDamageOnFullyBlockedByLevel === 'object'
        ? { ...raw.directHpDamageOnFullyBlockedByLevel }
        : undefined,
    nextAttackDamageBonusByLevel:
      raw.nextAttackDamageBonusByLevel && typeof raw.nextAttackDamageBonusByLevel === 'object'
        ? { ...raw.nextAttackDamageBonusByLevel }
        : undefined,
    allowSelfTarget: raw.allowSelfTarget !== false,
    constructDurationTurns: Math.max(
      1,
      Math.round(toNumber(raw.constructDurationTurns ?? raw.constructDuration ?? raw.durationTurns ?? 1, 1))
    ),
    constructMode: String(raw.constructMode || raw.mode || '').trim().toLowerCase(),
    constructStatusId: String(raw.constructStatusId ?? raw.statusId ?? '').trim(),
    constructStatusName: String(raw.constructStatusName ?? raw.statusName ?? '').trim(),
    constructStatusStacks: Math.max(
      1,
      Math.round(toNumber(raw.constructStatusStacks ?? raw.statusStacks ?? 1, 1))
    ),
    constructAp: Math.max(0, Math.round(toNumber(raw.constructAp ?? raw.constructApMax ?? 2, 2))),
    constructMaxHp: Math.max(1, Math.round(toNumber(raw.constructMaxHp ?? raw.constructHp ?? 1, 1))),
    constructMoveFt: Math.max(5, Math.round(toNumber(raw.constructMoveFt ?? raw.constructMove ?? 10, 10))),
    constructCards: Array.isArray(raw.constructCards)
      ? raw.constructCards.map((value) => String(value || '').trim()).filter(Boolean)
      : String(raw.constructCards || raw.constructLinkedCard || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
    constructLinkedCard: String(raw.constructLinkedCard || '').trim(),
    statusApply:
      raw.statusApply && typeof raw.statusApply === 'object'
        ? {
            id: String(raw.statusApply.id || '').trim(),
            name: String(raw.statusApply.name || '').trim(),
            notes: String(raw.statusApply.notes || '').trim(),
            stacksByLevel:
              raw.statusApply.stacksByLevel && typeof raw.statusApply.stacksByLevel === 'object'
                ? { ...raw.statusApply.stacksByLevel }
                : undefined
          }
        : undefined,
    movementByLevel:
      raw.movementByLevel && typeof raw.movementByLevel === 'object' ? { ...raw.movementByLevel } : undefined,
    pullDistanceByLevel:
      raw.pullDistanceByLevel && typeof raw.pullDistanceByLevel === 'object'
        ? { ...raw.pullDistanceByLevel }
        : undefined,
    pushDistanceByLevel:
      raw.pushDistanceByLevel && typeof raw.pushDistanceByLevel === 'object'
        ? { ...raw.pushDistanceByLevel }
        : undefined,
    shieldRestoreByLevel:
      raw.shieldRestoreByLevel && typeof raw.shieldRestoreByLevel === 'object'
        ? { ...raw.shieldRestoreByLevel }
        : undefined,
    healByLevel:
      raw.healByLevel && typeof raw.healByLevel === 'object'
        ? { ...raw.healByLevel }
        : undefined,
    heal: toNumber(raw.heal ?? 0),
    chargesMax: Math.max(0, Math.round(toNumber(raw.chargesMax ?? raw.maxCharges ?? raw.charges ?? 0, 0))),
    chargesCurrent: Math.max(
      0,
      Math.round(
        toNumber(
          raw.chargesCurrent ?? raw.remainingCharges ?? raw.chargesMax ?? raw.maxCharges ?? raw.charges ?? 0,
          0
        )
      )
    ),
    masteryLevel,
    masteryUses,
    masteryThresholds,
    masteryDamageByLevel: {
      1: toNumber(raw.masteryDamageByLevel?.[1] ?? raw.masteryDamageByLevel?.level1 ?? raw.damageLevel1 ?? baseDamage, baseDamage),
      2: toNumber(raw.masteryDamageByLevel?.[2] ?? raw.masteryDamageByLevel?.level2 ?? raw.damageLevel2 ?? baseDamage, baseDamage),
      3: toNumber(raw.masteryDamageByLevel?.[3] ?? raw.masteryDamageByLevel?.level3 ?? raw.damageLevel3 ?? baseDamage, baseDamage),
      4: toNumber(
        raw.masteryDamageByLevel?.[4] ??
          raw.masteryDamageByLevel?.level4 ??
          raw.damageLevel4 ??
          raw.masteryDamageByLevel?.[3] ??
          raw.masteryDamageByLevel?.level3 ??
          raw.damageLevel3 ??
          baseDamage,
        baseDamage
      )
    },
    abilityBonusesByLevel:
      raw.abilityBonusesByLevel && typeof raw.abilityBonusesByLevel === 'object'
        ? { ...raw.abilityBonusesByLevel }
        : undefined,
    masteryChoiceOptions: Array.isArray(raw.masteryChoiceOptions)
      ? raw.masteryChoiceOptions.map((entry) => ({
          ...(entry || {}),
          effects:
            entry?.effects && typeof entry.effects === 'object'
              ? { ...entry.effects }
              : entry?.effects
        }))
      : undefined,
    masteryChoiceSelected: String(raw.masteryChoiceSelected || '').trim(),
    tags: normalizeTagList(raw.tags),
    effect: raw.effect || '',
    mastery: normalizeMasteryInput(raw.mastery),
    fusion: raw.fusion || '',
    modifiers: {
      maxHp: toNumber(raw.modifiers?.maxHp ?? raw.modMaxHp ?? 0),
      maxShield: toNumber(raw.modifiers?.maxShield ?? raw.modMaxShield ?? 0),
      apMax: toNumber(raw.modifiers?.apMax ?? raw.modApMax ?? 0),
      guardRestore: toNumber(raw.modifiers?.guardRestore ?? raw.modGuard ?? 0),
      damageBonus: toNumber(raw.modifiers?.damageBonus ?? raw.modDamage ?? 0)
    }
  };
}

function normalizeTagList(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }
  return String(tags)
    .split(/,|\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeMasteryInput(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((line) => String(line).trim()).filter(Boolean);
  }
  return String(input)
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getStatusPreset(id) {
  if (!id) return null;
  return (state.reference?.statuses || []).find((entry) => entry.id === id) || null;
}

function applyPlayerStatusPreset(selectEl, formEl) {
  const preset = getStatusPreset(selectEl?.value);
  if (!preset || !formEl) return;
  const nameInput = formEl.querySelector('input[name="name"]');
  const stackInput = formEl.querySelector('input[name="stacks"]');
  const notesInput = formEl.querySelector('input[name="notes"]');
  if (nameInput) nameInput.value = preset.name;
  if (stackInput && typeof preset.defaultStacks === 'number') stackInput.value = preset.defaultStacks;
  if (notesInput) notesInput.value = preset.description || '';
}

function getSavingThrowsSnapshot(participant) {
  const snapshot = {};
  ABILITIES.forEach(({ key }) => {
    snapshot[key] = Boolean(participant.savingThrows?.[key]);
  });
  return snapshot;
}

function getSkillsSnapshot(participant) {
  const snapshot = {};
  SKILLS.forEach(([, , key]) => {
    const entry = getSkillState(participant, key);
    snapshot[key] = { ...entry };
  });
  return snapshot;
}

async function handleCharacterDownload() {
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant to export.');
    return;
  }
  const latest = (await fetchParticipantFromServer(participant.id)) || participant;
  downloadJson(latest, `${slugify(latest?.name || 'character')}.json`);
  els.menuPanel?.classList.remove('is-open');
}

async function handleCharacterImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const participantData = payload.participant || payload;
    if (!participantData || typeof participantData !== 'object') {
      throw new Error('Invalid character file.');
    }
    const result = await api('/api/import/participant', 'POST', { participant: participantData });
    if (result?.participant?.id) {
      focusId = result.participant.id;
      createMode = false;
      updateUrl({ create: false });
      notify('Character imported.');
    }
    fetchState();
  } catch (err) {
    notify(`Import failed: ${err.message}`);
  } finally {
    event.target.value = '';
    els.menuPanel?.classList.remove('is-open');
  }
}

async function handlePlayerCardFile(event, mode = 'card') {
  const file = event.target.files?.[0];
  if (!file) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    event.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const cards = extractCardsFromPayload(payload).map((card) => normalizeCardPayload(card));
    if (!cards.length) {
      throw new Error('No cards found in file.');
    }
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const existing = latest?.cards || [];
    if (mode === 'deck') {
      let remainingSlots = MAX_ACTIVE_CARDS;
      cards.forEach((card) => {
        if (card.active === false) return;
        if (remainingSlots > 0) {
          card.active = true;
          remainingSlots -= 1;
        } else {
          card.active = false;
        }
      });
    } else {
      let remainingSlots = Math.max(
        0,
        MAX_ACTIVE_CARDS - existing.filter((card) => isCardActive(card)).length
      );
      cards.forEach((card) => {
        if (card.active === false) return;
        if (remainingSlots > 0) {
          card.active = true;
          remainingSlots -= 1;
        } else {
          card.active = false;
        }
      });
    }
    const updated = mode === 'deck' ? cards : [...existing, ...cards];
    await patchParticipant(participant.id, { cards: updated });
    fetchState();
    notify(`Imported ${cards.length} card${cards.length === 1 ? '' : 's'}.`);
    if (cards.some((card) => card.active === false)) {
      notify(`Only ${MAX_ACTIVE_CARDS} cards can be active. Extra imports were set inactive.`);
    }
  } catch (err) {
    notify(`Card import failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
}

function extractCardsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.cards)) return payload.cards;
  if (payload.card && Array.isArray(payload.card)) return payload.card;
  if (payload.card && typeof payload.card === 'object') return [payload.card];
  if (typeof payload === 'object' && (payload.name || payload.set)) return [payload];
  return [];
}

async function handlePlayerRelicFile(event, drawerEl = null) {
  const file = event.target.files?.[0];
  if (!file) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    event.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const relics = extractRelicsFromPayload(payload).map((relic) => normalizeRelicPayload(relic));
    if (!relics.length) {
      throw new Error('No relics found in file.');
    }
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const existing = latest?.relics || [];
    await patchParticipant(participant.id, { relics: [...existing, ...relics] });
    if (drawerEl) drawerEl.open = false;
    fetchState();
    notify(`Imported ${relics.length} relic${relics.length === 1 ? '' : 's'}.`);
  } catch (err) {
    notify(`Relic import failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
}

function extractRelicsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.relics)) return payload.relics;
  if (payload.relic && Array.isArray(payload.relic)) return payload.relic;
  if (payload.relic && typeof payload.relic === 'object') return [payload.relic];
  if (typeof payload === 'object' && (payload.name || payload.description)) return [payload];
  return [];
}

function normalizeRelicPayload(raw = {}) {
  return {
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: (raw.name || 'Imported Relic').trim(),
    ability: raw.ability || raw.focus || '',
    description: raw.description || raw.notes || '',
    hp: Number(raw.hp ?? raw.hpBonus ?? 0),
    ap: Number(raw.ap ?? raw.apBonus ?? 0),
    modifiers: {
      maxHp: Number(raw.modifiers?.maxHp ?? raw.modMaxHp ?? 0),
      maxShield: Number(raw.modifiers?.maxShield ?? raw.modMaxShield ?? 0),
      apMax: Number(raw.modifiers?.apMax ?? raw.modApMax ?? 0),
      guardRestore: Number(raw.modifiers?.guardRestore ?? raw.modGuard ?? 0),
      damageBonus: Number(raw.modifiers?.damageBonus ?? raw.modDamage ?? 0)
    }
  };
}

async function handlePlayerEquipmentFile(event, drawerEl = null) {
  const file = event.target.files?.[0];
  if (!file) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    event.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const items = extractInventoryEntriesFromPayload(payload).map((item) => normalizeEquipmentInventoryEntry(item));
    if (!items.length) {
      throw new Error('No weapons or armour found in file.');
    }
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const existing = latest?.inventory || [];
    await patchParticipant(participant.id, { inventory: [...existing, ...items] });
    if (drawerEl) drawerEl.open = false;
    fetchState();
    notify(`Imported ${items.length} weapon/armour item${items.length === 1 ? '' : 's'}.`);
  } catch (err) {
    notify(`Weapon/armour import failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
}

function extractInventoryEntriesFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const keys = ['inventory', 'items', 'equipment', 'weapons', 'armor', 'armour', 'gear'];
  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }
  const singularKeys = ['item', 'equipment', 'weapon', 'armor', 'armour'];
  for (const key of singularKeys) {
    if (payload[key] && typeof payload[key] === 'object') {
      return [payload[key]];
    }
  }
  if (typeof payload === 'object' && (payload.name || payload.title)) return [payload];
  return [];
}

function normalizeEquipmentInventoryEntry(raw = {}) {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : String(raw.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
  const typeHints = [raw.type, raw.category, raw.slot]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const allTags = [...typeHints, ...tags].filter(
    (tag, index, entries) => entries.findIndex((entry) => entry.toLowerCase() === tag.toLowerCase()) === index
  );
  const name = String(raw.name || raw.title || '').trim() || 'Imported Equipment';
  const normalized = {
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name,
    quantity: Math.max(1, Math.round(Number(raw.quantity ?? raw.qty ?? 1) || 1)),
    description: String(raw.description || raw.notes || '').trim(),
    tags: allTags
  };
  if (!isPlayerEquipmentItem(normalized)) {
    normalized.tags.unshift('Equipment');
  }
  return normalized;
}

async function fetchParticipantFromServer(participantId) {
  try {
    const response = await api(`/api/participants/${participantId}/export`);
    return response?.participant || null;
  } catch (err) {
    notify(err.message);
    return getParticipantSnapshot(participantId);
  }
}

function mergeParticipant(participant) {
  if (!participant?.id) return;
  const list = Array.isArray(state.encounter.participants)
    ? [...state.encounter.participants]
    : [];
  const index = list.findIndex((entry) => entry.id === participant.id);
  if (index >= 0) {
    list[index] = participant;
  } else {
    list.push(participant);
  }
  state.encounter.participants = list;
  render();
}

async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function notify(message) {
  if (message) {
    console.warn(message);
  }
}

function dedupeTypes(list = []) {
  const values = Array.isArray(list) ? list : [list];
  const normalized = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = String(value).trim();
    if (!trimmed) continue;
    if (!normalized.find((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      normalized.push(trimmed);
    }
  }
  return normalized;
}

function normalizeMitigationToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function getPlayerDerivedImmunities(participant = {}) {
  const hasMindShield = (participant?.statuses || []).some((status) => {
    const token = normalizeMitigationToken(status?.presetId || status?.name || status?.id || '');
    return token === 'mindshield';
  });
  return hasMindShield ? ['Charmed', 'Frightened'] : [];
}

function getPlayerImmunityEntries(participant = {}) {
  const manual = (participant?.immunities || []).map((value, index) => ({
    label: String(value || '').trim(),
    removeIndex: index,
    removable: true
  }));
  const taken = new Set(manual.map((entry) => normalizeMitigationToken(entry.label)));
  const derived = getPlayerDerivedImmunities(participant)
    .filter((value) => {
      const token = normalizeMitigationToken(value);
      if (!token || taken.has(token)) return false;
      taken.add(token);
      return true;
    })
    .map((value) => ({
      label: value,
      removeIndex: -1,
      removable: false
    }));
  return [...manual, ...derived];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDamageTypeOptions(includePlaceholder = false) {
  const options = includePlaceholder ? '<option value="">Select type…</option>' : '';
  return (
    options +
    DAMAGE_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')
  );
}

function renderResistanceOptions(includePlaceholder = false) {
  const statusNames = (state.reference?.statuses || []).map((entry) => String(entry?.name || '').trim()).filter(Boolean);
  const values = dedupeTypes([...DAMAGE_TYPES, ...statusNames]);
  const options = includePlaceholder ? '<option value="">Select resistance…</option>' : '';
  return options + values.map((value) => `<option value="${value}">${value}</option>`).join('');
}

function renderCharacterPresetOptions(includePlaceholder = false) {
  const presets = [...(state.reference?.characterPresets || [])].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );
  const options = includePlaceholder ? '<option value="">Select preset…</option>' : '';
  return options + presets.map((preset) => `<option value="${preset.id}">${escapeHtml(preset.name || 'Character Preset')}</option>`).join('');
}

function renderImmunityOptions(includePlaceholder = false) {
  const statusNames = (state.reference?.statuses || []).map((entry) => String(entry?.name || '').trim()).filter(Boolean);
  const values = dedupeTypes([...DAMAGE_TYPES, ...statusNames]);
  const options = includePlaceholder ? '<option value="">Select immunity…</option>' : '';
  return options + values.map((value) => `<option value="${value}">${value}</option>`).join('');
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return (value || 'record')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'record';
}

function openPlayerMenu() {
  els.menuPanel?.classList.add('is-open');
}

function openCharacterCreator() {
  focusId = null;
  createMode = true;
  updateUrl({ create: true });
  els.menuPanel?.classList.remove('is-open');
  render();
}
