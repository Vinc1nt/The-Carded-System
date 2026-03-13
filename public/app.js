import { UI_LIMITS } from './shared/game-config.js';
import { getCardTierShieldBonus } from './shared/card-rules.js';

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
const HELP_TOPIC_TITLES = Object.freeze({
  statuses: 'Statuses',
  combat: 'Combat Rules',
  out_of_combat: 'Out of Combat',
  cards: 'Cards'
});

const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1, currentTurnKey: '' },
  reference: { standardActions: [], sets: [], statuses: [], teams: [] },
  updatedAt: null
};

const detailSectionState = new Map();
const detailDrawerState = new Map();

let selectedParticipantId = null;
let activeHelpTopic = 'combat';
let eventSource;

const els = {
  round: document.querySelector('[data-round]'),
  count: document.querySelector('[data-count]'),
  turnList: document.getElementById('turnList'),
  detailPanel: document.getElementById('detailPanel'),
  logList: document.getElementById('logList'),
  addForm: document.getElementById('addParticipantForm'),
  addDrawer: document.getElementById('addDrawer'),
  toggleAddForm: document.getElementById('toggleAddForm'),
  logPanel: document.querySelector('.log-panel'),
  toggleLog: document.getElementById('toggleLog'),
  startEncounter: document.getElementById('startEncounter'),
  endEncounter: document.getElementById('endEncounter'),
  prevTurn: document.getElementById('prevTurn'),
  nextTurn: document.getElementById('nextTurn'),
  refreshState: document.getElementById('refreshState'),
  gmMenuToggle: document.getElementById('gmMenuToggle'),
  gmMenuPanel: document.getElementById('gmMenuPanel'),
  helpMenuToggle: document.getElementById('helpMenuToggle'),
  helpMenuPanel: document.getElementById('helpMenuPanel'),
  journalMenuToggle: document.getElementById('journalMenuToggle'),
  journalMenuPanel: document.getElementById('journalMenuPanel'),
  helpModal: document.getElementById('helpModal'),
  helpModalClose: document.getElementById('helpModalClose'),
  helpModalTitle: document.getElementById('helpModalTitle'),
  helpModalBody: document.getElementById('helpModalBody'),
  helpModalTabs: document.getElementById('helpModalTabs'),
  downloadEncounter: document.getElementById('downloadEncounter'),
  uploadEncounter: document.getElementById('uploadEncounter'),
  restAllShort: document.getElementById('restAllShort'),
  restAllLong: document.getElementById('restAllLong')
};

document.addEventListener('DOMContentLoaded', () => {
  wireGlobalEvents();
  subscribeToEvents();
  fetchState();
});

function wireGlobalEvents() {
  els.addForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const payload = {
      name: data.get('name'),
      team: data.get('team') || '',
      initiative: Number(data.get('initiative') || 0),
      maxHp: Number(data.get('maxHp') || 0),
      maxShield: Number(data.get('maxShield') || 0),
      apMax: Number(data.get('apMax') || 6),
      setFocus: data.get('setFocus') || ''
    };
    payload.hp = payload.maxHp;
    payload.shield = payload.maxShield;
    try {
      await api('/api/participants', 'POST', payload);
      event.target.reset();
      els.addDrawer?.classList.remove('open');
    } catch (err) {
      notify(err.message);
    }
  });

  els.toggleAddForm?.addEventListener('click', () => {
    els.addDrawer?.classList.toggle('open');
  });

  els.toggleLog?.addEventListener('click', () => {
    els.logPanel?.classList.toggle('collapsed');
    els.toggleLog.textContent = els.logPanel?.classList.contains('collapsed') ? 'Show' : 'Hide';
  });

  els.startEncounter?.addEventListener('click', () => api('/api/turn/start', 'POST'));
  els.endEncounter?.addEventListener('click', () => api('/api/turn/end', 'POST'));
  els.prevTurn?.addEventListener('click', () => api('/api/turn/previous', 'POST'));
  els.nextTurn?.addEventListener('click', () => api('/api/turn/next', 'POST'));
  els.refreshState?.addEventListener('click', fetchState);
  els.restAllShort?.addEventListener('click', () => triggerGroupRest('short'));
  els.restAllLong?.addEventListener('click', () => triggerGroupRest('long'));

  els.gmMenuToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    els.helpMenuPanel?.classList.remove('is-open');
    els.journalMenuPanel?.classList.remove('is-open');
    els.gmMenuPanel?.classList.toggle('is-open');
  });
  els.journalMenuToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    els.helpMenuPanel?.classList.remove('is-open');
    els.gmMenuPanel?.classList.remove('is-open');
    els.journalMenuPanel?.classList.toggle('is-open');
  });
  els.helpMenuToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    els.gmMenuPanel?.classList.remove('is-open');
    els.journalMenuPanel?.classList.remove('is-open');
    els.helpMenuPanel?.classList.toggle('is-open');
  });
  els.helpMenuPanel?.querySelectorAll('[data-help-open]').forEach((button) => {
    button.addEventListener('click', () => {
      openHelpModal(button.dataset.helpOpen || 'combat');
    });
  });
  els.helpModalClose?.addEventListener('click', closeHelpModal);
  els.helpModalTabs?.querySelectorAll('[data-help-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      openHelpModal(button.dataset.helpTab || 'combat');
    });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.gm-menu')) {
      els.gmMenuPanel?.classList.remove('is-open');
      els.journalMenuPanel?.classList.remove('is-open');
      els.helpMenuPanel?.classList.remove('is-open');
    }
    if (event.target === els.helpModal) {
      closeHelpModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.helpModal?.classList.contains('hidden')) {
      closeHelpModal();
    }
  });
  els.downloadEncounter?.addEventListener('click', handleEncounterDownload);
  els.uploadEncounter?.addEventListener('change', handleEncounterImport);
  wireGlobalJournalForms();
}

function openHelpModal(topic = 'combat') {
  activeHelpTopic = HELP_TOPIC_TITLES[topic] ? topic : 'combat';
  renderHelpModal();
  els.helpMenuPanel?.classList.remove('is-open');
  els.helpModal?.classList.remove('hidden');
}

function closeHelpModal() {
  els.helpModal?.classList.add('hidden');
}

function renderHelpModal() {
  if (!els.helpModalBody || !els.helpModalTabs) return;
  const title = HELP_TOPIC_TITLES[activeHelpTopic] || 'Help';
  if (els.helpModalTitle) {
    els.helpModalTitle.textContent = title;
  }
  els.helpModalTabs.querySelectorAll('[data-help-tab]').forEach((button) => {
    const isActive = button.dataset.helpTab === activeHelpTopic;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  els.helpModalBody.innerHTML = getHelpTopicContent(activeHelpTopic);
}

function getHelpTopicContent(topic) {
  if (topic === 'statuses') {
    return renderStatusHelpContent();
  }
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
          <li>Auto-hit attacks (no advantage/disadvantage).</li>
          <li>Damage goes to Shield first, then HP.</li>
          <li>Persistent Shield during combat.</li>
          <li>Movement: 1 AP = 10 ft. Difficult terrain: 1 AP = 5 ft.</li>
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
        <h3>Backgrounds and Story Perks</h3>
        <ul class="help-list">
          <li>Backgrounds define weapon/tool/language proficiencies.</li>
          <li>Each character starts with 1 story perk.</li>
          <li>Story perks should be flavorful and situational, not major combat power.</li>
        </ul>
      </section>
      <section class="help-section">
        <h3>Resting Outside Combat</h3>
        <ul class="help-list">
          <li>Short Rest (about 10-15 min): heal 5 + CON mod (minimum 1), recover short-rest resources, restore half Max Shield (table rules).</li>
          <li>Long Rest (about 6-8 hrs): restore HP, Shield, and long-rest resources.</li>
          <li>Long Rest is also the main loadout swap window (cards, relics, passives).</li>
          <li>If rest is interrupted by combat/hazards/strenuous activity, no rest benefits unless at least 50% of duration completed.</li>
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
          <tr><td>3</td><td>Refined</td><td>Card becomes Fusion-eligible and may gain a minor perk.</td></tr>
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

function renderStatusHelpContent() {
  const statuses = state.reference?.statuses || [];
  if (!statuses.length) {
    return '<p class="muted">Status reference is not loaded yet.</p>';
  }
  const entries = statuses
    .map((status) => {
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
    })
    .join('');
  return `
    <section class="help-section">
      <h3>Status Reference</h3>
      <p>These are the active status definitions used by the tracker.</p>
      <div class="help-status-grid">${entries}</div>
    </section>
  `;
}

function subscribeToEvents() {
  eventSource?.close?.();
  eventSource = new EventSource('/events');
  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'state') {
        updateState(payload.state);
      }
    } catch (err) {
      console.warn('Unable to parse server event', err);
    }
  };
  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(subscribeToEvents, 4000);
  };
}

async function fetchState() {
  try {
    const response = await fetch('/api/state');
    const data = await response.json();
    if (data.state) {
      updateState(data.state);
    }
  } catch (err) {
    console.error('Unable to fetch state', err);
  }
}

function updateState(nextState) {
  if (!nextState) return;
  state.encounter = nextState.encounter || state.encounter;
  state.reference = nextState.reference || state.reference;
  state.updatedAt = nextState.updatedAt;

  const participants = state.encounter.participants || [];
  if (!participants.find((entry) => entry.id === selectedParticipantId)) {
    selectedParticipantId = participants[0]?.id || null;
  }

  render();
}

function render() {
  renderMeta();
  renderTurnList();
  renderDetailPanel();
  renderLog();
  renderGlobalJournalTargetOptions();
}

function renderMeta() {
  els.round.textContent = state.encounter.round ?? 1;
  els.count.textContent = state.encounter.participants?.length ?? 0;
}

function renderGlobalJournalTargetOptions() {
  const selects = document.querySelectorAll('[data-global-journal-participant]');
  if (!selects.length) return;
  const participants = state.encounter.participants || [];
  const fallbackId =
    (participants.find((entry) => entry.id === selectedParticipantId) || participants[0] || {}).id || '';
  selects.forEach((select) => {
    const previous = select.value;
    if (!participants.length) {
      select.innerHTML = '<option value="">No players available</option>';
      select.value = '';
      updateGlobalJournalTargetVisibility(select.closest('form'));
      return;
    }
    select.innerHTML = participants
      .map(
        (entry) =>
          `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`
      )
      .join('');
    if (participants.some((entry) => entry.id === previous)) {
      select.value = previous;
    } else {
      select.value = fallbackId;
    }
    updateGlobalJournalTargetVisibility(select.closest('form'));
  });
}

function wireGlobalJournalForms() {
  document.querySelectorAll('[data-global-journal-form]').forEach((form) => {
    const category = form.dataset.globalJournalForm;
    const targetSelect = form.querySelector('[data-global-journal-target]');
    targetSelect?.addEventListener('change', () => updateGlobalJournalTargetVisibility(form));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = buildJournalPayloadFromForm(form, category);
      if (payload.error) {
        notify(payload.error);
        return;
      }
      const formData = new FormData(form);
      const target = String(formData.get('target') || 'participant').toLowerCase() === 'all' ? 'all' : 'participant';
      const participantId = String(formData.get('participantId') || '').trim();
      if (target === 'participant' && !participantId) {
        notify('Select a player or choose "All Players".');
        return;
      }
      try {
        const participantSelect = form.querySelector('[data-global-journal-participant]');
        const participantName =
          participantSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Selected player';
        await api('/api/journal/entry', 'POST', {
          target,
          participantId: target === 'participant' ? participantId : undefined,
          category,
          ...payload
        });
        const currentTarget = target;
        const currentParticipant = participantId;
        form.reset();
        if (targetSelect) targetSelect.value = currentTarget;
        renderGlobalJournalTargetOptions();
        const participantSelectAfter = form.querySelector('[data-global-journal-participant]');
        if (participantSelectAfter && currentTarget === 'participant') {
          const stillExists = Array.from(participantSelectAfter.options).some((option) => option.value === currentParticipant);
          participantSelectAfter.value = stillExists ? currentParticipant : participantSelectAfter.value;
        }
        updateGlobalJournalTargetVisibility(form);
        const itemLabel = category === 'achievement' ? 'Achievement' : 'Quest';
        if (currentTarget === 'all') {
          notify(`${itemLabel} sent to all players.`, 'success');
        } else {
          notify(`${itemLabel} sent to ${participantName}.`, 'success');
        }
      } catch (err) {
        notify(err.message);
      }
    });
    updateGlobalJournalTargetVisibility(form);
  });
}

function updateGlobalJournalTargetVisibility(form) {
  if (!form) return;
  const target = String(form.querySelector('[data-global-journal-target]')?.value || 'participant').toLowerCase();
  const participantSelect = form.querySelector('[data-global-journal-participant]');
  if (!participantSelect) return;
  const disable = target === 'all' || participantSelect.options.length === 0;
  participantSelect.disabled = disable;
  const label = participantSelect.closest('label');
  label?.classList.toggle('is-disabled', disable);
}

function getTurnEntryKey(entry = {}) {
  if (entry.kind === 'zone') {
    return `zone:${entry.participantId}:${entry.zoneId}`;
  }
  return `participant:${entry.participantId}`;
}

function getEncounterTurnEntries() {
  const entries = [];
  for (const participant of state.encounter.participants || []) {
    entries.push({ kind: 'participant', participantId: participant.id, participant, zone: null });
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

function renderTurnList() {
  const entries = getEncounterTurnEntries();
  if (!entries.length) {
    els.turnList.textContent = 'No combatants yet.';
    els.turnList.classList.add('empty-state');
    return;
  }
  els.turnList.classList.remove('empty-state');
  els.turnList.innerHTML = '';
  entries.forEach((entry, index) => {
    const participant = entry.participant;
    if (!participant) return;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `turn-row${entry.kind === 'zone' ? ' turn-row-zone' : ''}`;
    row.dataset.id = participant.id;
    const turnKey = getTurnEntryKey(entry);
    row.dataset.turnKey = turnKey;
    if (participant.id === selectedParticipantId) {
      row.classList.add('is-selected');
    }
    if (state.encounter.currentTurnKey && turnKey === state.encounter.currentTurnKey) {
      row.classList.add('is-current');
    } else if (!state.encounter.currentTurnKey && index === state.encounter.currentIndex) {
      row.classList.add('is-current');
    }
    if (entry.kind === 'zone') {
      const zone = entry.zone || {};
      const targetCount = Array.isArray(zone.targetIds) ? zone.targetIds.length : 0;
      const remaining =
        Number(zone.remainingTurns || 0) > 0
          ? ` • ${zone.remainingTurns} turn${zone.remainingTurns === 1 ? '' : 's'} left`
          : '';
      row.innerHTML = `
        <strong>${escapeHtml(zone.name || 'Zone Effect')}</strong>
        <div class="statline">
          <span>Zone (${escapeHtml(participant.name)})</span>
          <span>${Number(zone.damage || 0)} ${escapeHtml(zone.damageType || 'damage')}</span>
          <span>${Number(zone.radiusFt || 0)} ft radius</span>
        </div>
        <div class="statline">${targetCount} target${targetCount === 1 ? '' : 's'}${remaining}</div>
      `;
    } else {
      row.innerHTML = `
        <strong>${participant.name}</strong>
        <div class="statline">
          <span>Init ${participant.initiative ?? 0}</span>
          <span>AP ${participant.apCurrent}/${participant.apMax}</span>
          <span>HP ${participant.hp}/${participant.maxHp}</span>
          <span>Shield ${participant.shield}/${participant.maxShield}</span>
        </div>
        <div class="statline">${formatStatusesSummary(participant)}</div>
      `;
    }
    row.addEventListener('click', () => {
      selectedParticipantId = participant.id;
      renderDetailPanel();
      highlightSelection();
    });
    els.turnList.appendChild(row);
  });
}

function highlightSelection() {
  document.querySelectorAll('.turn-row').forEach((row) => {
    row.classList.toggle('is-selected', row.dataset.id === selectedParticipantId);
  });
}

function renderDetailPanel() {
  const previousId = els.detailPanel.dataset.participantId;
  if (previousId) {
    rememberDetailSections(previousId);
  }
  const participant = getSelectedParticipant();
  if (!participant) {
    els.detailPanel.classList.add('empty-state');
    els.detailPanel.innerHTML = 'Select a combatant to manage their turn, automation, and cards.';
    els.detailPanel.dataset.participantId = '';
    return;
  }
  els.detailPanel.classList.remove('empty-state');
  const automation = participant.derivedBonuses || {};
  const base = automation.base || participant.baseStats || {};
  const drawers = getDrawerState(participant.id);

  els.detailPanel.innerHTML = `
    <div class="active-header">
      <div>
        <h2>${participant.name}</h2>
        <p class="muted">Set Focus: ${participant.setFocus || '—'}</p>
      </div>
      <div class="detail-actions">
        <label class="team-select-inline">
          Team
          <select data-team-select>
            ${renderTeamOptions(participant)}
          </select>
        </label>
        <a href="/player?id=${participant.id}" target="_blank" rel="noopener noreferrer">Player View</a>
        <a href="/cards?participantId=${participant.id}" target="_blank" rel="noopener noreferrer">Card Library</a>
        <button type="button" data-toggle-base-stats>Edit Base Stats</button>
        <button type="button" data-export-character>Export Character</button>
        <button type="button" data-export-deck>Export Deck</button>
        <button type="button" class="danger" data-remove>Remove</button>
      </div>
    </div>
    ${renderBaseStatsPanel(participant)}
    <div class="vitals-grid">
      ${renderVitalCard('HP', participant.hp, participant.maxHp, 'hp')}
      ${renderVitalCard('Shield', participant.shield, participant.maxShield, 'shield')}
      ${renderVitalCard('AP', participant.apCurrent, participant.apMax, 'ap')}
    </div>
    ${renderActionsSection(participant)}
    ${renderStatusSection(participant)}
    ${renderZoneSection(participant)}
    ${renderCardsSection(participant, drawers)}
    ${renderSetTrackerSection(participant)}
    ${renderConstructSection(participant)}
    ${renderMitigationSection(participant)}
    ${renderAbilitiesSection(participant)}
    ${renderInventorySection(participant, drawers)}
    ${renderRelicSection(participant, drawers)}
    ${renderJournalSection(participant)}
    ${renderAutomationSection(participant)}
    ${renderAdvancedSection(participant, base)}
  `;
  els.detailPanel.dataset.participantId = participant.id;
  wireDetailEvents(participant);
  if (previousId && previousId === participant.id) {
    restoreDetailSections(participant.id);
  }
}

function renderVitalCard(label, current, max, key) {
  return `
    <div class="vital-card">
      <h4>${label}</h4>
      <div class="value">${current}/${max}</div>
      <div class="stat-controls">
        <button type="button" data-adjust-target="${key}" data-delta="-1">-1</button>
        <button type="button" data-adjust-target="${key}" data-delta="1">+1</button>
        <button type="button" data-adjust-target="${key}" data-reset="max">Reset</button>
      </div>
    </div>`;
}

function renderStatusSection(participant) {
  return `
    <details class="collapsible-block" data-section="statuses">
      <summary>
        <div>
          <strong>Statuses</strong>
          <div class="status-summary">${renderStatusSummary(participant)}</div>
        </div>
        <button type="button" data-toggle-status-form>Add Status</button>
      </summary>
      <div class="collapsible-body">
        <div class="status-list">
          ${renderStatuses(participant)}
        </div>
        <form data-form="status" class="stacked-form hidden">
          <label>Preset
            <select name="preset" data-status-preset>
              <option value="">Custom</option>
              ${renderStatusOptions()}
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
            <input type="text" name="notes" placeholder="Ends on save DC 14" />
          </label>
          <button type="submit">Add Status</button>
        </form>
      </div>
    </details>
  `;
}

function renderZoneSection(participant) {
  const zones = participant.zones || [];
  return `
    <details class="collapsible-block" data-section="zones">
      <summary><strong>Zones</strong></summary>
      <div class="collapsible-body">
        <div class="cards-grid construct-grid">
          ${renderZoneCards(participant, zones)}
        </div>
      </div>
    </details>
  `;
}

function renderZoneCards(participant, zones = []) {
  if (!zones.length) {
    return '<p class="muted">No active zones.</p>';
  }
  return zones
    .map((zone) => {
      const targetIds = Array.isArray(zone.targetIds) ? zone.targetIds : [];
      const targetBadges = targetIds
        .map((targetId) => {
          const target = (state.encounter.participants || []).find((entry) => entry.id === targetId);
          if (!target) return '';
          return `
            <span class="status-pill">
              ${escapeHtml(target.name)}
              <button type="button" data-zone-remove-target="${zone.id || ''}" data-zone-target-id="${target.id}">Remove</button>
            </span>`;
        })
        .filter(Boolean)
        .join('');
      const targetNames = targetIds
        .map((targetId) => (state.encounter.participants || []).find((entry) => entry.id === targetId)?.name || '')
        .filter(Boolean);
      const options = (state.encounter.participants || [])
        .filter((entry) => !targetIds.includes(entry.id))
        .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`)
        .join('');
      const remaining =
        Number(zone.remainingTurns || 0) > 0
          ? ` · ${zone.remainingTurns} turn${zone.remainingTurns === 1 ? '' : 's'} left`
          : '';
      return `
        <article class="card-item construct-item">
          <h4>${escapeHtml(zone.name || 'Zone')}</h4>
          <p>${Number(zone.damage || 0)} ${escapeHtml(zone.damageType || 'damage')} · ${Number(zone.radiusFt || 0)} ft radius${remaining}</p>
          <p class="muted small-note">Currently in zone: ${targetNames.length ? escapeHtml(targetNames.join(', ')) : 'No targets assigned'}</p>
          <div class="status-list">
            ${targetBadges || '<span class="muted">No targets assigned.</span>'}
          </div>
          <div class="form-row">
            <label>Add Target
              <select data-zone-add-target="${zone.id || ''}">
                <option value="">Select target…</option>
                ${options}
              </select>
            </label>
            <button type="button" data-zone-add-target-button="${zone.id || ''}">Add</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderActionsSection(participant) {
  return `
    <details class="collapsible-block" data-section="actions">
      <summary>
        <strong>Standard Actions</strong>
      </summary>
      <div class="collapsible-body">
        <label class="checkbox-row">
          <input type="checkbox" id="difficultTerrain" />
          <span>Difficult terrain (Move = 5 ft)</span>
        </label>
        <div class="button-grid" id="standardActions">
          ${renderStandardActionButtons()}
        </div>
        <div class="rest-controls">
          <button type="button" data-rest="short">Short Rest</button>
          <button type="button" data-rest="long">Long Rest</button>
        </div>
        <form id="customActionForm" class="stacked-form">
          <label>Log a custom action
            <textarea name="text" rows="2" placeholder="Describe the action or ruling"></textarea>
          </label>
          <button type="submit">Log Entry</button>
        </form>
      </div>
    </details>
  `;
}

function renderCardsSection(participant, drawers = {}) {
  const { active, inactive, total } = getCardBuckets(participant);
  const toolingClass = drawers.card ? 'card-tooling' : 'card-tooling hidden';
  return `
    <details class="collapsible-block" data-section="cards">
      <summary>
        <strong>Cards (${active.length}/${MAX_ACTIVE_CARDS} active · ${total} total)</strong>
        <button type="button" data-toggle-card-form>Add Card</button>
      </summary>
      <div class="collapsible-body">
        <div class="cards-grid">
          ${renderCards(participant, active, { inactive: false })}
        </div>
        ${renderInactiveCardsDropdown(participant, inactive)}
        <div class="${toolingClass}" data-card-tooling>
          <div class="card-import">
            <label class="file-upload">
              Import cards (.json)
              <input type="file" accept="application/json" data-card-import />
            </label>
            <p class="muted help-text">Upload a single card object or {"cards": []} list with automation fields.</p>
          </div>
          <form data-form="card" class="stacked-form">
          <datalist id="setOptions">
            ${renderSetOptions()}
          </datalist>
          <div class="form-row">
            <label>Name
              <input type="text" name="name" required />
            </label>
            <label>Set
              <input type="text" name="set" list="setOptions" />
            </label>
            <label>Type
              <input type="text" name="type" placeholder="Attack" />
            </label>
            <label>Tier
              <input type="text" name="tier" placeholder="Rare" />
            </label>
          </div>
          <div class="form-row">
            <label>AP Cost
              <input type="number" step="0.1" name="apCost" value="2" />
            </label>
            <label>Range (ft)
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
                ${renderStatusOptions()}
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
            <input type="text" name="tags" placeholder="Piercing, Bleed" />
          </label>
          <label>Effect
            <textarea name="effect" rows="2" placeholder="Describe the effect"></textarea>
          </label>
          <label>Mastery Progression
            <textarea name="mastery" rows="2" placeholder="Level 1: ..., Level 2: ..."></textarea>
          </label>
          <div class="form-row">
            <label>Mastery to L2 uses
              <input type="number" name="masteryTo2" value="25" min="1" />
            </label>
            <label>Mastery to L3 uses
              <input type="number" name="masteryTo3" value="55" min="2" />
            </label>
          </div>
          <label>Fusion Notes
            <input type="text" name="fusion" placeholder="Fusion with..." />
          </label>
          <button type="submit">Add Card</button>
        </form>
        </div>
      </div>
    </details>
  `;
}

function renderInactiveCardsDropdown(participant, inactiveEntries = []) {
  const options = inactiveEntries
    .map(({ card, index }) => {
      const effect = formatCardEffectAtMastery(card, participant);
      return `<option value="${index}" data-card-id="${card.id || ''}" data-card-index="${index}">${escapeHtml(
        `${card.name || `Card ${index + 1}`} · AP ${Number(card.apCost || 0)} · ${effect || '—'}`
      )}</option>`;
    })
    .join('');
  return `
    <details class="inactive-cards-dropdown" data-section="inactiveCards">
      <summary><strong>Inactive Cards (${inactiveEntries.length})</strong></summary>
      <div class="collapsible-body">
        ${
          inactiveEntries.length
            ? `
            <div class="inactive-picker">
              <label>Inactive Card
                <select data-inactive-card-select>
                  ${options}
                </select>
              </label>
              <div class="card-actions">
                <button type="button" data-activate-selected-card>Activate Card</button>
              </div>
            </div>
          `
            : '<p class="muted">No inactive cards.</p>'
        }
      </div>
    </details>
  `;
}

function renderRelicSection(participant, drawers = {}) {
  const relics = participant.relics || [];
  const toolingClass = drawers.relic ? 'card-tooling' : 'card-tooling hidden';
  return `
    <details class="collapsible-block" data-section="relics">
      <summary>
        <strong>Relics (${relics.length})</strong>
        <button type="button" data-toggle-relic-form>Add Relic</button>
      </summary>
      <div class="collapsible-body">
        <div class="cards-grid relic-grid">
          ${renderRelicCards(participant)}
        </div>
        <div class="${toolingClass}" data-relic-tooling>
          <div class="card-import">
            <label class="file-upload">
              Import relics (.json)
              <input type="file" accept="application/json" data-relic-import />
            </label>
          </div>
          <form data-form="relic" class="stacked-form">
            <div class="form-row">
              <label>Name
                <input type="text" name="name" required />
              </label>
              <label>Ability Focus
                <input type="text" name="ability" placeholder="Machine, Shield, etc." />
              </label>
            </div>
            <div class="form-row">
              <label>HP Bonus
                <input type="number" name="hp" value="0" />
              </label>
              <label>AP Bonus
                <input type="number" name="ap" value="0" />
              </label>
            </div>
            <label>Description
              <input type="text" name="description" placeholder="What does it do?" />
            </label>
            <button type="submit">Add Relic</button>
          </form>
        </div>
      </div>
    </details>
  `;
}

function renderMitigationSection(participant) {
  return `
    <details class="collapsible-block" data-section="mitigation">
      <summary>
        <strong>Resistances & Vulnerabilities</strong>
      </summary>
      <div class="collapsible-body">
        ${renderMitigationGroup('Resistances', participant.resistances, 'resistance')}
        ${renderMitigationGroup('Vulnerabilities', participant.vulnerabilities, 'vulnerability')}
        <p class="muted small-note">Resistances halve incoming damage; vulnerabilities double it. Recover (1 AP) removes 1 stack of Bleeding, Poisoned, or Burning.</p>
      </div>
    </details>
  `;
}

function renderInventorySection(participant, drawers = {}) {
  const items = participant.inventory || [];
  const currencies = participant.currencies || [];
  const toolingClass = drawers.inventory ? 'card-tooling' : 'card-tooling hidden';
  const currencyToolingClass = drawers.inventoryCurrency ? 'card-tooling' : 'card-tooling hidden';
  return `
    <details class="collapsible-block" data-section="inventory">
      <summary>
        <strong>Inventory (${items.length} items · ${currencies.length} currencies)</strong>
        <div class="summary-actions">
          <button type="button" data-toggle-currency-form>Add Currency</button>
          <button type="button" data-toggle-inventory-form>Add Item</button>
        </div>
      </summary>
      <div class="collapsible-body">
        <div class="inventory-currency-group">
          <h4>Currencies</h4>
          <div class="currency-list">
            ${renderCurrencyEntries(participant)}
          </div>
          <div class="${currencyToolingClass}" data-currency-tooling>
            <form data-form="currency" class="stacked-form">
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
          </div>
        </div>
        <div class="inventory-items-group">
          <h4>Items</h4>
        </div>
        <div class="ability-list">
          ${renderInventoryEntries(participant)}
        </div>
        <div class="${toolingClass}" data-inventory-tooling>
          <form data-form="inventory" class="stacked-form">
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
      </div>
    </details>
  `;
}

function renderCurrencyEntries(participant) {
  const currencies = participant.currencies || [];
  if (!currencies.length) {
    return '<p class="muted">No currencies yet.</p>';
  }
  return currencies
    .map(
      (currency, index) => `
        <article class="currency-tab">
          <div class="currency-tab-header">
            <strong>${escapeHtml(currency.name || `Currency ${index + 1}`)}</strong>
            <span>${Number(currency.amount || 0)}</span>
          </div>
          <div class="currency-tab-controls">
            <input type="number" min="1" step="1" value="1" data-currency-input="${currency.id || ''}" data-currency-index="${index}" />
            <button type="button" data-currency-adjust="add" data-currency-id="${currency.id || ''}" data-currency-index="${index}">Add</button>
            <button type="button" data-currency-adjust="remove" data-currency-id="${currency.id || ''}" data-currency-index="${index}">Remove</button>
            <button type="button" data-remove-currency="${currency.id || ''}" data-currency-index="${index}">Delete</button>
          </div>
        </article>`
    )
    .join('');
}

function renderInventoryEntries(participant) {
  const items = participant.inventory || [];
  if (!items.length) {
    return '<p class="muted">No inventory items yet.</p>';
  }
  return items
    .map(
      (item, index) => `
        <article class="journal-entry">
          <strong>${escapeHtml(item.name || `Item ${index + 1}`)}</strong>
          <p>Qty: ${Number(item.quantity || 1)}</p>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
          ${(item.tags || []).length ? `<p>Tags: ${escapeHtml((item.tags || []).join(', '))}</p>` : ''}
          <div class="card-actions">
            <button type="button" data-remove-inventory="${item.id || ''}" data-inventory-index="${index}">Remove</button>
          </div>
        </article>`
    )
    .join('');
}

function renderMitigationGroup(label, values = [], key) {
  const list = (values || [])
    .map(
      (value, index) => `
        <span class="tag-pill">
          ${value}
          <button type="button" aria-label="Remove" data-remove-${key}="${index}">×</button>
        </span>`
    )
    .join('');
  return `
    <div class="damage-group">
      <div class="damage-group-header">
        <h4>${label}</h4>
        <small class="muted">${key === 'resistance' ? 'Halves incoming damage' : 'Doubles incoming damage'}</small>
      </div>
      <div class="tag-list">
        ${list || '<span class="muted">None</span>'}
      </div>
      <form data-form="${key}">
        <label class="compact-label">Add ${label.slice(0, -1)}
          <select name="${key}">
            ${renderDamageTypeOptions(true)}
          </select>
        </label>
        <button type="submit">Add</button>
      </form>
    </div>
  `;
}

function renderSetTrackerSection(participant) {
  const cards = getCardBuckets(participant).active.map((entry) => entry.card);
  const counts = {};
  cards.forEach((card) => {
    const setName = String(card.set || '').trim();
    if (!setName) return;
    counts[setName] = (counts[setName] || 0) + 1;
  });
  const setEntries = state.reference?.sets || [];
  const rows = setEntries
    .map((setEntry) => {
      const count = counts[setEntry.name] || 0;
      if (!count) return null;
      const bonuses = (setEntry.bonuses || [])
        .map((bonus) => {
          const isActive = count >= bonus.pieces;
          const status = isActive ? renderSetBonusStatus(bonus, participant) : '';
          const activation = isActive ? renderSetActivationButton(bonus, participant, 'data-activate-set') : '';
          return `<li class="${isActive ? 'active' : ''}">${bonus.pieces} pcs — ${bonus.effect || summarizeModifiers(bonus.modifiers || {})}${status}${activation}</li>`;
        })
        .join('');
      return `
        <div class="set-block">
          <div class="set-header">
            <strong>${setEntry.name}</strong>
            <span>${count} card${count === 1 ? '' : 's'}</span>
          </div>
          <ul class="set-list">${bonuses || '<li class="muted">No bonuses configured.</li>'}</ul>
        </div>`;
    })
    .filter(Boolean)
    .join('');
  const allyManager =
    participantHasSetBonus(participant, 'Divine', 3) || participantHasSetBonus(participant, 'Nature', 5)
      ? renderSetAllyTargetManager(participant)
      : '';

  return `
    <details class="collapsible-block" data-section="setTracker">
      <summary><strong>Set Tracker</strong></summary>
      <div class="collapsible-body">
        ${rows || '<p class="muted">No set bonuses equipped.</p>'}
        ${allyManager}
      </div>
    </details>
  `;
}

function renderSetAllyTargetManager(participant) {
  const allyIds = participant?.setRuntime?.allies?.targetIds || [];
  const automaticAllies = getParticipantAllies(participant).filter((entry) => !allyIds.includes(entry.id));
  const participants = state.encounter.participants || [];
  const assigned = allyIds
    .map((id) => participants.find((entry) => entry.id === id))
    .filter(Boolean);
  const options = participants
    .filter((entry) => entry.id !== participant.id && !allyIds.includes(entry.id))
    .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`)
    .join('');
  const assignedBadges = assigned
    .map(
      (entry) => `
        <span class="status-pill">
          ${escapeHtml(entry.name)}
          <button type="button" data-set-ally-remove="${entry.id}">Remove</button>
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
        ${assignedBadges || '<span class="muted">No allies selected.</span>'}
      </div>
      <div class="form-row">
        <label>Add Ally
          <select data-set-ally-add>
            <option value="">Select ally…</option>
            ${options}
          </select>
        </label>
        <button type="button" data-set-ally-add-button>Add</button>
      </div>
    </div>
  `;
}

function renderConstructSection(participant) {
  const constructs = participant.constructs || [];
  const summary = participant.derivedBonuses?.machineConstructs || {};
  const cap = Number(summary.maxActive || 1);
  const hasConstructCard = getCardBuckets(participant).active.some(({ card }) => isConstructCard(card));
  if (!hasConstructCard) {
    return '';
  }
  return `
    <details class="collapsible-block" data-section="constructs">
      <summary>
        <strong>Constructs (${constructs.length}/${cap})</strong>
      </summary>
      <div class="collapsible-body">
        <p class="muted small-note">Machine construct bonuses: +${summary.damageBonus || 0} damage, +${summary.durationBonusTurns || 0} turn duration.</p>
        <div class="cards-grid construct-grid">
          ${renderConstructCards(participant)}
        </div>
      </div>
    </details>
  `;
}

function renderConstructCards(participant) {
  const constructs = participant.constructs || [];
  if (!constructs.length) {
    return '<p class="muted">No active constructs.</p>';
  }
  return constructs
    .map(
      (construct) => `
        <article class="card-item construct-item">
          <h4>${escapeHtml(construct.name || 'Construct')}</h4>
          <p>${escapeHtml(renderConstructCardSummary(construct))}</p>
          <p>Turns Remaining: ${Number(construct.remainingTurns || 0)}</p>
          <p>HP: ${Number(construct.hp || 0)}/${Number(construct.maxHp || 0)} • AP: ${Number(construct.apCurrent || 0)}/${Number(construct.apMax || 0)}</p>
          <p>Cards: ${escapeHtml((Array.isArray(construct.cards) && construct.cards.length ? construct.cards.join(', ') : '—'))}</p>
          <label>Target
            <select data-construct-target="${construct.id || ''}">
              <option value="">Select target…</option>
              ${(state.encounter.participants || [])
                .filter((entry) => entry.id !== participant.id)
                .map(
                  (entry) =>
                    `<option value="${entry.id}" ${entry.id === construct.targetId ? 'selected' : ''}>${entry.name}</option>`
                )
                .join('')}
            </select>
          </label>
          <div class="card-actions">
            <button type="button" data-construct-move="${construct.id || ''}" ${Number(construct.apCurrent || 0) < 1 ? 'disabled' : ''}>Move ${Number(construct.moveFt || 10)} ft (1 AP)</button>
            <button type="button" data-remove-construct="${construct.id || ''}">Remove</button>
          </div>
        </article>`
    )
    .join('');
}

function renderConstructCardSummary(construct = {}) {
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
    return 'Utility construct';
  }
  return `Damage: ${Number(construct.damage || 0)} ${construct.damageType || ''}`.trim();
}

function renderAbilitiesSection(participant) {
  return `
    <details class="collapsible-block" data-section="abilitiesText">
      <summary>
        <strong>Abilities</strong>
      </summary>
      <div class="collapsible-body">
        ${renderAbilityTextListEditor('Proficiencies', participant.proficiencies || [], 'proficiency')}
        ${renderAbilityTextListEditor('Languages', participant.languages || [], 'language')}
        <div class="ability-list">
          ${renderAbilityEntries(participant)}
        </div>
        <form data-form="ability" class="stacked-form">
          <div class="form-row">
            <label>Name
              <input type="text" name="name" placeholder="Passive Focus" />
            </label>
          </div>
          <label>Description
            <textarea name="description" rows="2" placeholder="Describe the ability effect..." required></textarea>
          </label>
          <button type="submit">Add Ability</button>
        </form>
      </div>
    </details>
  `;
}

function renderAbilityTextListEditor(label, values = [], key = 'entry') {
  const pills = (values || [])
    .map(
      (value, index) => `
        <span class="tag-pill">
          ${escapeHtml(value)}
          <button type="button" aria-label="Remove" data-remove-${key}="${index}">×</button>
        </span>`
    )
    .join('');
  return `
    <div class="damage-group">
      <div class="damage-group-header">
        <h4>${label}</h4>
      </div>
      <div class="tag-list">
        ${pills || '<span class="muted">None</span>'}
      </div>
      <form data-form="${key}">
        <label class="compact-label">Add ${label.slice(0, -1)}
          <input type="text" name="${key}" placeholder="Add ${label.slice(0, -1).toLowerCase()}" />
        </label>
        <button type="submit">Add</button>
      </form>
    </div>
  `;
}

function renderAbilityEntries(participant) {
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
          <div class="card-actions">
            <button type="button" data-remove-ability="${entry.id || ''}" data-ability-index="${index}">Remove</button>
          </div>
        </article>`
    )
    .join('');
}

function renderJournalSection(participant) {
  return `
    <details class="collapsible-block" data-section="journal">
      <summary>
        <strong>Journal</strong>
      </summary>
      <div class="collapsible-body">
        ${renderJournalManagerGroup(participant, 'quest', 'Quests')}
        ${renderJournalManagerGroup(participant, 'achievement', 'Achievements')}
      </div>
    </details>
  `;
}

function renderJournalManagerGroup(participant, category, label) {
  const field = journalFieldName(category);
  const entries = participant[field] || [];
  const list = entries.length
    ? entries
      .map(
        (entry) => `
          <article class="journal-entry">
            <strong>${escapeHtml(entry.title || label.slice(0, -1))}</strong>
            ${renderJournalEntryDetails(entry, category)}
            <div class="journal-meta">
              <small class="muted">${entry.acknowledged ? 'Acknowledged' : 'Pending acknowledgement'}</small>
            </div>
            <div class="card-actions">
              <button type="button" data-journal-remove="${entry.id}" data-journal-category="${category}">Remove</button>
              <button type="button" data-journal-remove-all="${entry.id}" data-journal-category="${category}">Remove from All</button>
            </div>
          </article>`
      )
      .join('')
    : '<p class="muted">None yet.</p>';
  return `
    <div class="journal-manager-group">
      <h4>${label}</h4>
      <div class="journal-list">
        ${list}
      </div>
      <form data-journal-form="${category}" class="stacked-form">
        ${renderJournalTemplateFields(category, label)}
        <div class="card-actions">
          <button type="submit">Add to Player</button>
          <button type="button" data-journal-add-all="${category}">Add to All Players</button>
        </div>
      </form>
    </div>
  `;
}

function journalFieldName(category) {
  return category === 'achievement' ? 'achievements' : 'quests';
}

function renderJournalTemplateFields(category, label) {
  if (category === 'quest') {
    return `
      <label>Quest Name
        <input type="text" name="title" placeholder="Quest title" required />
      </label>
      <label>Description / Hook
        <textarea name="narrative" rows="2" placeholder="Short narrative hook"></textarea>
      </label>
      <div class="form-row">
        <label>Primary Objective
          <input type="text" name="objectivePrimary" placeholder="Primary task" />
        </label>
        <label>Secondary Objective
          <input type="text" name="objectiveSecondary" placeholder="Optional secondary task" />
        </label>
      </div>
      <div class="form-row">
        <label>Difficulty
          <select name="difficulty">
            <option value="">Select difficulty…</option>
            <option>Common</option>
            <option>Uncommon</option>
            <option>Rare</option>
            <option>Very Rare</option>
            <option>Epic</option>
          </select>
        </label>
        <label>Primary Reward
          <input type="text" name="rewardPrimary" placeholder="XP / Card Shards / Relic / Currency / Unlock" />
        </label>
      </div>
      <div class="form-row">
        <label>Bonus Reward
          <input type="text" name="rewardBonus" placeholder="Optional bonus reward" />
        </label>
        <label>Failure Condition
          <input type="text" name="failureCondition" placeholder="Optional failure condition" />
        </label>
      </div>
    `;
  }
  return `
    <label>${label.slice(0, -1)} Title
      <input type="text" name="title" placeholder="${label.slice(0, -1)} name" required />
    </label>
    <label>Requirement
      <textarea name="requirement" rows="2" placeholder="What the player did"></textarea>
    </label>
    <label>Reward
      <input type="text" name="reward" placeholder="Passive Bonus / Title / Card / Relic" />
    </label>
    <label>Description / Flavor
      <textarea name="flavor" rows="2" placeholder="Flavor text about the accomplishment"></textarea>
    </label>
  `;
}

function renderJournalEntryDetails(entry, category) {
  const template = entry?.template || {};
  if (category === 'quest' && Object.keys(template).length) {
    const objectives = [template.objectivePrimary, template.objectiveSecondary].filter(Boolean);
    const rewards = [template.rewardPrimary, template.rewardBonus].filter(Boolean);
    return `
      <div class="journal-template">
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
      <div class="journal-template">
        ${template.requirement ? `<p><strong>Requirement:</strong> ${escapeHtml(template.requirement)}</p>` : ''}
        ${template.reward ? `<p><strong>Reward:</strong> ${escapeHtml(template.reward)}</p>` : ''}
        ${template.flavor ? `<p><strong>Description:</strong> ${escapeHtml(template.flavor)}</p>` : ''}
      </div>
    `;
  }
  return entry.description ? `<p>${escapeHtml(entry.description)}</p>` : '';
}

function buildJournalPayloadFromForm(form, category) {
  const formData = new FormData(form);
  const title = String(formData.get('title') || '').trim();
  if (!title) {
    return { error: 'Title is required.' };
  }
  if (category === 'quest') {
    const template = {
      narrative: String(formData.get('narrative') || '').trim(),
      objectivePrimary: String(formData.get('objectivePrimary') || '').trim(),
      objectiveSecondary: String(formData.get('objectiveSecondary') || '').trim(),
      difficulty: String(formData.get('difficulty') || '').trim(),
      rewardPrimary: String(formData.get('rewardPrimary') || '').trim(),
      rewardBonus: String(formData.get('rewardBonus') || '').trim(),
      failureCondition: String(formData.get('failureCondition') || '').trim()
    };
    return {
      title,
      description: buildJournalDescriptionFromTemplate('quest', template),
      template
    };
  }
  const template = {
    requirement: String(formData.get('requirement') || '').trim(),
    reward: String(formData.get('reward') || '').trim(),
    flavor: String(formData.get('flavor') || '').trim()
  };
  return {
    title,
    description: buildJournalDescriptionFromTemplate('achievement', template),
    template,
    automation: {}
  };
}

function buildJournalDescriptionFromTemplate(category, template) {
  if (category === 'quest') {
    const objectives = [template.objectivePrimary, template.objectiveSecondary].filter(Boolean);
    const rewards = [template.rewardPrimary, template.rewardBonus].filter(Boolean);
    const parts = [];
    if (template.narrative) parts.push(`Description: ${template.narrative}`);
    if (objectives.length) parts.push(`Objectives: ${objectives.join(' | ')}`);
    if (template.difficulty) parts.push(`Difficulty: ${template.difficulty}`);
    if (rewards.length) parts.push(`Rewards: ${rewards.join(' | ')}`);
    if (template.failureCondition) parts.push(`Failure: ${template.failureCondition}`);
    return parts.join('\n');
  }
  const parts = [];
  if (template.requirement) parts.push(`Requirement: ${template.requirement}`);
  if (template.reward) parts.push(`Reward: ${template.reward}`);
  if (template.flavor) parts.push(`Description: ${template.flavor}`);
  return parts.join('\n');
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

function renderBaseStatsPanel(participant) {
  return `
    <div class="base-edit-panel hidden" data-base-panel>
      <form data-form="baseStats" class="stacked-form">
        <div class="form-row">
          <label>HP (current / max)
            <div class="dual-inputs">
              <input type="number" name="hp" value="${participant.hp || 0}" />
              <input type="number" name="maxHp" value="${participant.maxHp || 0}" />
            </div>
          </label>
          <label>Shield (current / max)
            <div class="dual-inputs">
              <input type="number" name="shield" value="${participant.shield || 0}" />
              <input type="number" name="maxShield" value="${participant.maxShield || 0}" />
            </div>
          </label>
          <label>AP (current / max)
            <div class="dual-inputs">
              <input type="number" name="apCurrent" value="${participant.apCurrent ?? participant.apMax ?? 0}" />
              <input type="number" name="apMax" value="${participant.apMax || 0}" />
            </div>
          </label>
        </div>
        <div class="form-row align-end">
          <button type="submit" class="primary">Save Base Stats</button>
        </div>
      </form>
    </div>
  `;
}

function renderAutomationSection(participant) {
  const automation = participant.derivedBonuses || {};
  const construct = automation.machineConstructs || {};
  return `
    <details class="collapsible-block" data-section="automation">
      <summary>
        <div>
          <strong>Automation</strong>
          <span class="muted">Guard +${participant.guardRestore || 3}, Damage +${participant.damageBonus || 0}, Constructs ${construct.maxActive || 1}</span>
        </div>
      </summary>
      <div class="collapsible-body automation-summary">
        <div>
          <strong>Card modifiers</strong>
          <ul>
            ${renderAutomationList(automation.cardModifiers)}
          </ul>
        </div>
        <div>
          <strong>Set bonuses</strong>
          <ul>
            ${renderAutomationSetList(automation.setBonuses, participant)}
          </ul>
        </div>
        <div>
          <strong>Construct runtime</strong>
          <ul>
            <li>Max active: ${construct.maxActive || 1}</li>
            <li>Damage bonus: +${construct.damageBonus || 0}</li>
            <li>Duration bonus: +${construct.durationBonusTurns || 0} turn(s)</li>
          </ul>
        </div>
      </div>
    </details>
  `;
}

function renderAdvancedSection(participant, base) {
  return `
    <details class="advanced-editor" data-section="advanced">
      <summary>Advanced Stats & Notes</summary>
      <form data-form="participant">
        <div class="form-row">
          <label>Base HP
            <input type="number" name="maxHp" value="${base.maxHp || participant.maxHp}" />
          </label>
          <label>Base Shield
            <input type="number" name="maxShield" value="${base.maxShield || participant.maxShield}" />
          </label>
          <label>Base AP
            <input type="number" name="apMax" value="${base.apMax || participant.apMax}" />
          </label>
        </div>
        <div class="form-row">
          <label>Base Guard Restore
            <input type="number" name="baseGuardRestore" value="${base.guardRestore || 3}" />
          </label>
          <label>Base Damage Bonus
            <input type="number" name="baseDamageBonus" value="${base.damageBonus || 0}" />
          </label>
        </div>
        <div class="stats-grid">
          ${renderNumberInput('Initiative', 'initiative', participant.initiative)}
          ${renderNumberInput('Mastery', 'mastery', participant.mastery)}
          ${renderNumberInput('STR', 'strength', participant.stats?.strength || 0)}
          ${renderNumberInput('DEX', 'dexterity', participant.stats?.dexterity || 0)}
          ${renderNumberInput('CON', 'constitution', participant.stats?.constitution || 0)}
          ${renderNumberInput('INT', 'intelligence', participant.stats?.intelligence || 0)}
          ${renderNumberInput('WIS', 'wisdom', participant.stats?.wisdom || 0)}
          ${renderNumberInput('CHA', 'charisma', participant.stats?.charisma || 0)}
        </div>
        <label>Tags
          <input type="text" name="tags" value="${(participant.tags || []).join(', ')}" placeholder="Melee, Shield, Bleed" />
        </label>
        <label>Notes
          <textarea name="notes" rows="3">${participant.notes || ''}</textarea>
        </label>
        <button type="submit" class="primary">Save Changes</button>
      </form>
    </details>
  `;
}

function renderStatusSummary(participant) {
  const statuses = participant.statuses || [];
  if (!statuses.length) return '<span class="muted">None</span>';
  return statuses
    .map((status) => `<span class="status-chip">${status.name}${status.stacks ? ` ×${status.stacks}` : ''}</span>`)
    .join('');
}

function renderStandardActionButtons() {
  const actions = (state.reference?.standardActions || []).filter((action) => action.id !== 'move_difficult');
  if (!actions.length) {
    return '<p class="empty-state">Standard actions will appear once the server boots.</p>';
  }
  return actions
    .map(
      (action) => `<button type="button" data-standard="${action.id}">${action.label} (${action.apCost} AP)</button>`
    )
    .join('');
}

function renderAutomationList(entries = []) {
  if (!entries.length) {
    return '<li class="muted">No card modifiers.</li>';
  }
  return entries
    .map((entry) => `<li>${entry.name}: ${summarizeModifiers(entry.modifiers)}</li>`)
    .join('');
}

function renderAutomationSetList(entries = [], participant) {
  if (!entries.length) {
    return '<li class="muted">No set bonuses active.</li>';
  }
  return entries
    .map((entry) => {
      const effect = entry.effect || summarizeModifiers(entry.modifiers);
      const status = renderSetBonusStatus(entry, participant);
      const activation = renderSetActivationButton(entry, participant, 'data-activate-set');
      return `<li>${entry.set} (${entry.pieces}+ pcs): ${effect}${status}${activation}</li>`;
    })
    .join('');
}

function renderSetBonusStatus(entry, participant) {
  const abilityId = entry?.activatable?.id || entry?.id;
  const machine = participant?.setRuntime?.machine || {};
  if (entry.id === 'machine_5_auto_loader') {
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

function renderSetActivationButton(entry, participant, attrName) {
  if (!entry?.activatable?.id) return '';
  const canActivate = canActivateSetBonus(entry, participant);
  const label = 'Activate';
  const disabled = canActivate ? '' : ' disabled';
  return ` <button type="button" ${attrName}="${entry.activatable.id}"${disabled}>${label}</button>`;
}

function canActivateSetBonus(entry, participant) {
  const abilityId = entry?.activatable?.id || entry?.id;
  if (!abilityId || !participant) return false;
  if (abilityId === 'arcane_7_temp_copy') {
    const used = Boolean(participant?.setRuntime?.arcane?.copyUsedEncounter);
    const activeCount = getCardBuckets(participant).active.length;
    return !used && activeCount < MAX_ACTIVE_CARDS;
  }
  if (abilityId === 'arcane_10_modify_card') {
    const modified = participant?.setRuntime?.arcane?.modifiedCard;
    return !modified?.cardId;
  }
  if (abilityId === 'divine_10_sacred_overcharge') {
    const used = Boolean(participant?.setRuntime?.divine?.sacredOverchargeUsed);
    const allies = getParticipantAllies(participant);
    return !used && allies.length > 0;
  }
  if (abilityId === 'divine_5_cleanse_heal') {
    const allies = getParticipantAllies(participant);
    return allies.length > 0;
  }
  return false;
}

function buildSetActivationPayload(participant, abilityId) {
  const id = String(abilityId || '').trim();
  if (!id || !participant?.id) return null;
  const payload = {
    participantId: participant.id,
    abilityId: id
  };
  if (id === 'arcane_7_temp_copy') {
    const cardId = promptForSetCardSelection(participant, 'Arcane Copy');
    if (!cardId) return null;
    payload.cardId = cardId;
    return payload;
  }
  if (id === 'arcane_10_modify_card') {
    const cardId = promptForSetCardSelection(participant, 'Arcane Card Modification');
    if (!cardId) return null;
    const mode = promptForArcaneModifyMode();
    if (!mode) return null;
    payload.cardId = cardId;
    payload.mode = mode;
    return payload;
  }
  if (id === 'divine_5_cleanse_heal') {
    const targetId = promptForSetAllySelection(participant, 'Divine Cleanse');
    if (!targetId) return null;
    payload.targetId = targetId;
    return payload;
  }
  return payload;
}

function promptForSetCardSelection(participant, label) {
  const activeCards = getCardBuckets(participant).active;
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

function promptForArcaneModifyMode() {
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

function promptForSetAllySelection(participant, label) {
  const allyOptions = getParticipantAllies(participant);
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

function renderSetOptions() {
  return (state.reference?.sets || [])
    .map((entry) => `<option value="${entry.name}"></option>`)
    .join('');
}

function getTeamOptionValues(participant = null) {
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

function renderTeamOptions(participant = null) {
  const options = ['<option value="">Unassigned</option>'];
  for (const team of getTeamOptionValues(participant)) {
    const selected = String(participant?.team || '').trim() === team ? ' selected' : '';
    options.push(`<option value="${escapeHtml(team)}"${selected}>${escapeHtml(team)}</option>`);
  }
  return options.join('');
}

function getParticipantAllies(participant) {
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

function mergeUniqueText(existing = [], value = '') {
  const token = String(value || '').trim();
  if (!token) return existing;
  const already = existing.some((entry) => String(entry || '').trim().toLowerCase() === token.toLowerCase());
  if (already) return existing;
  return [...existing, token];
}

function isCardActive(card = {}) {
  return card?.active !== false;
}

function getCardBuckets(participant = {}) {
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

function participantHasSetBonus(participant = {}, setName = '', pieces = 1) {
  const target = String(setName || '').trim().toLowerCase();
  if (!target) return false;
  const count = getCardBuckets(participant).active.reduce((total, { card }) => {
    return String(card?.set || '').trim().toLowerCase() === target ? total + 1 : total;
  }, 0);
  return count >= Math.max(1, Number(pieces || 1));
}

function getDrawerState(participantId) {
  if (!participantId) {
    return { card: false, relic: false, inventory: false, inventoryCurrency: false };
  }
  const existing = detailDrawerState.get(participantId);
  if (existing) return existing;
  const initial = { card: false, relic: false, inventory: false, inventoryCurrency: false };
  detailDrawerState.set(participantId, initial);
  return initial;
}

function setDrawerState(participantId, key, isOpen) {
  if (!participantId) return;
  const current = getDrawerState(participantId);
  const next = { ...current, [key]: Boolean(isOpen) };
  detailDrawerState.set(participantId, next);
}

function renderStatusOptions() {
  return (state.reference?.statuses || [])
    .map((status) => `<option value="${status.id}">${status.name}</option>`)
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
      const value = modifiers?.[key] || 0;
      if (!value) return null;
      return `${label} ${value > 0 ? '+' : ''}${value}`;
    })
    .filter(Boolean)
    .join(', ');
  return summary || '—';
}

function wireDetailEvents(participant) {
  const panel = els.detailPanel;
  panel.querySelector('[data-remove]')?.addEventListener('click', async () => {
    if (!confirm(`Remove ${participant.name}?`)) return;
    try {
      await api(`/api/participants/${participant.id}`, 'DELETE');
    } catch (err) {
      notify(err.message);
    }
  });
  panel.querySelector('[data-export-character]')?.addEventListener('click', async () => {
    const latest = (await getServerParticipant(participant.id)) || participant;
    if (!latest) {
      notify('Unable to export character.');
      return;
    }
    downloadJson(latest, `${slugify(latest.name)}.json`);
  });
  panel.querySelector('[data-export-deck]')?.addEventListener('click', async () => {
    const latest = (await getServerParticipant(participant.id)) || participant;
    if (!latest) {
      notify('Unable to export deck.');
      return;
    }
    downloadJson({ cards: latest.cards || [] }, `${slugify(latest.name)}-deck.json`);
  });
  panel.querySelector('[data-team-select]')?.addEventListener('change', async (event) => {
    const team = String(event.currentTarget.value || '').trim();
    try {
      await api(`/api/participants/${participant.id}`, 'PATCH', { team });
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-standard]').forEach((button) => {
    button.addEventListener('click', () => handleStandardAction(button.dataset.standard));
  });

  panel.querySelectorAll('[data-activate-set]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      try {
        const activation = buildSetActivationPayload(participant, button.dataset.activateSet);
        if (!activation) return;
        await api('/api/set/activate', 'POST', activation);
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelectorAll('[data-set-ally-add-button]').forEach((button) => {
    button.addEventListener('click', async () => {
      const select = panel.querySelector('[data-set-ally-add]');
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
    });
  });

  panel.querySelectorAll('[data-set-ally-remove]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.dataset.setAllyRemove;
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
    });
  });

  panel.querySelectorAll('[data-construct-target]').forEach((select) => {
    select.addEventListener('change', async () => {
      const constructId = select.dataset.constructTarget;
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
    });
  });

  panel.querySelectorAll('[data-remove-construct]').forEach((button) => {
    button.addEventListener('click', async () => {
      const constructId = button.dataset.removeConstruct;
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
    });
  });

  panel.querySelectorAll('[data-construct-move]').forEach((button) => {
    button.addEventListener('click', async () => {
      const constructId = button.dataset.constructMove;
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
    });
  });

  const basePanel = panel.querySelector('[data-base-panel]');
  const baseForm = basePanel?.querySelector('[data-form="baseStats"]');
  panel.querySelector('[data-toggle-base-stats]')?.addEventListener('click', () => {
    populateBaseForm(basePanel, participant);
    basePanel?.classList.toggle('hidden');
  });
  baseForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = {
      hp: Number(formData.get('hp') ?? participant.hp ?? 0),
      maxHp: Number(formData.get('maxHp') ?? participant.maxHp ?? 0),
      shield: Number(formData.get('shield') ?? participant.shield ?? 0),
      maxShield: Number(formData.get('maxShield') ?? participant.maxShield ?? 0),
      apCurrent: Number(formData.get('apCurrent') ?? participant.apCurrent ?? participant.apMax ?? 0),
      apMax: Number(formData.get('apMax') ?? participant.apMax ?? 0)
    };
    try {
      const response = await api(`/api/participants/${participant.id}`, 'PATCH', payload);
      if (response?.participant) {
        updateParticipantInState(response.participant);
      } else {
        fetchState();
      }
      basePanel?.classList.add('hidden');
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-rest]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api(`/api/rest/${button.dataset.rest}`, 'POST', { participantId: participant.id });
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelector('#customActionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const text = data.get('text')?.trim();
    if (!text) return;
    try {
      await api('/api/actions/custom', 'POST', { actorId: participant.id, text });
      event.target.reset();
    } catch (err) {
      notify(err.message);
    }
  });

  const statusForm = panel.querySelector('[data-form="status"]');
  panel.querySelector('[data-toggle-status-form]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    statusForm?.classList.toggle('hidden');
  });
  statusForm?.querySelector('[data-status-preset]')?.addEventListener('change', (event) => {
    applyStatusPreset(event.currentTarget, statusForm);
  });
  statusForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newStatus = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      presetId: formData.get('preset') || '',
      name: formData.get('name'),
      stacks: Number(formData.get('stacks') || 1),
      notes: formData.get('notes') || ''
    };
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const currentStatuses = latest?.statuses || participant.statuses || [];
      await api(`/api/participants/${participant.id}`, 'PATCH', {
        statuses: [...currentStatuses, newStatus]
      });
      event.target.reset();
      statusForm.classList.add('hidden');
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-status-stack]').forEach((button) => {
    button.addEventListener('click', async () => {
      const delta = Number(button.dataset.statusDelta || 0);
      if (!delta) return;
      const targetId = button.dataset.statusStack;
      const fallbackIndex = Number(button.dataset.statusIndex);
      const latest = (await getServerParticipant(participant.id)) || participant;
      const statuses = [...(latest?.statuses || participant.statuses || [])];
      let idx = statuses.findIndex((status) => targetId && status.id === targetId);
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
      try {
        await api(`/api/participants/${participant.id}`, 'PATCH', { statuses });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelectorAll('[data-remove-status]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.dataset.removeStatus;
      const fallbackIndex = Number(button.dataset.statusIndex);
      const latest = (await getServerParticipant(participant.id)) || participant;
      const statuses = [...(latest?.statuses || participant.statuses || [])];
      let idx = statuses.findIndex((status) => targetId && status.id === targetId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) {
        idx = fallbackIndex;
      }
      if (idx < 0 || idx >= statuses.length) return;
      statuses.splice(idx, 1);
      try {
        await api(`/api/participants/${participant.id}`, 'PATCH', { statuses });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelectorAll('[data-zone-add-target-button]').forEach((button) => {
    button.addEventListener('click', async () => {
      const zoneId = button.dataset.zoneAddTargetButton;
      const select = panel.querySelector(`[data-zone-add-target="${zoneId}"]`);
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
    });
  });

  panel.querySelectorAll('[data-zone-remove-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const zoneId = button.dataset.zoneRemoveTarget;
      const targetId = button.dataset.zoneTargetId;
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
    });
  });

  const cardTools = panel.querySelector('[data-card-tooling]');
  const cardForm = cardTools?.querySelector('[data-form="card"]');
  panel.querySelector('[data-toggle-card-form]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpening = cardTools?.classList.contains('hidden');
    cardTools?.classList.toggle('hidden');
    setDrawerState(participant.id, 'card', isOpening);
  });
  cardTools?.querySelector('[data-card-import]')?.addEventListener('change', (event) => {
    importCardsFromFile(event.currentTarget, participant.id);
  });
  cardForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newCard = buildCardFromForm(formData);
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const existingCards = latest?.cards || participant.cards || [];
      const activeCount = existingCards.filter((card) => isCardActive(card)).length;
      newCard.active = activeCount < MAX_ACTIVE_CARDS;
      const response = await api(`/api/participants/${participant.id}`, 'PATCH', {
        cards: [...existingCards, newCard]
      });
      if (response?.participant) {
        updateParticipantInState(response.participant);
      }
      fetchState();
      event.target.reset();
      setDrawerState(participant.id, 'card', true);
      if (!newCard.active) {
        notify(`Active loadout is full (${MAX_ACTIVE_CARDS}). Card added as inactive.`);
      }
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-remove-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const cardId = button.dataset.removeCard;
      const fallbackIndex = Number(button.dataset.cardIndex);
      const latest = (await getServerParticipant(participant.id)) || participant;
      const sourceCards = latest?.cards || participant.cards || [];
      const updated = sourceCards.filter((card, idx) => {
        if (card.id) {
          return card.id !== cardId;
        }
        return idx !== fallbackIndex;
      });
      try {
        const response = await api(`/api/participants/${participant.id}`, 'PATCH', { cards: updated });
        if (response?.participant) {
          updateParticipantInState(response.participant);
        }
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelectorAll('[data-deactivate-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const cardId = button.dataset.deactivateCard;
      const fallbackIndex = Number(button.dataset.cardIndex);
      const latest = (await getServerParticipant(participant.id)) || participant;
      const cards = [...(latest?.cards || participant.cards || [])];
      let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= cards.length) return;
      cards[idx] = { ...cards[idx], active: false };
      try {
        await api(`/api/participants/${participant.id}`, 'PATCH', { cards });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelectorAll('[data-activate-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const cardId = button.dataset.activateCard;
      const fallbackIndex = Number(button.dataset.cardIndex);
      const latest = (await getServerParticipant(participant.id)) || participant;
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
      try {
        await api(`/api/participants/${participant.id}`, 'PATCH', { cards });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelector('[data-activate-selected-card]')?.addEventListener('click', async () => {
    const select = panel.querySelector('[data-inactive-card-select]');
    const option = select?.selectedOptions?.[0];
    if (!option) {
      notify('Choose an inactive card first.');
      return;
    }
    const cardId = option.dataset.cardId || '';
    const fallbackIndex = Number(option.dataset.cardIndex);
    const latest = (await getServerParticipant(participant.id)) || participant;
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
    try {
      await api(`/api/participants/${participant.id}`, 'PATCH', { cards });
      notify(`${cards[idx].name || 'Card'} activated.`, 'success');
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  panel.querySelectorAll('[data-use-card]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      if (button.closest('summary')) {
        event.preventDefault();
        event.stopPropagation();
      }
      const cardId = button.dataset.useCard;
      if (!cardId) return;
      const article = button.closest('[data-card]');
      const targetId = article?.querySelector(`[data-card-target="${cardId}"]`)?.value || '';
      const targetIds = Array.from(
        article?.querySelector(`[data-card-targets="${cardId}"]`)?.selectedOptions || []
      ).map((option) => option.value);
      const secondaryTargetId = article?.querySelector(`[data-card-secondary-target="${cardId}"]`)?.value || '';
      const arcaneSplitTargetId = article?.querySelector(`[data-card-arcane-split-target="${cardId}"]`)?.value || '';
      const overrideDamageType = article?.querySelector(`[data-card-override-damage-type="${cardId}"]`)?.value || '';
      try {
        await api('/api/actions/card', 'POST', {
          participantId: participant.id,
          cardId,
          targetId,
          targetIds,
          secondaryTargetId,
          arcaneSplitTargetId,
          overrideDamageType
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelectorAll('[data-card-mastery]').forEach((select) => {
    select.addEventListener('change', async () => {
      const cardId = select.dataset.cardMastery;
      const cardIndex = Number(select.dataset.cardIndex);
      const level = Number(select.value || 1);
      try {
        const latest = (await getServerParticipant(participant.id)) || participant;
        const cards = [...(latest?.cards || participant.cards || [])];
        let idx = cards.findIndex((card) => cardId && card.id === cardId);
        if (idx < 0 && Number.isInteger(cardIndex)) idx = cardIndex;
        if (idx < 0 || idx >= cards.length) return;
        cards[idx] = applyManualMastery(cards[idx], level);
        await api(`/api/participants/${participant.id}`, 'PATCH', { cards });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelectorAll('[data-export-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const cards = latest?.cards || participant.cards || [];
      const card = cards.find((entry) => entry.id === button.dataset.exportCard);
      if (!card) {
        notify('Card not found for export.');
        return;
      }
      downloadJson(card, `${slugify(latest?.name || participant.name)}-${slugify(card.name)}.json`);
    });
  });

  const relicTools = panel.querySelector('[data-relic-tooling]');
  const relicForm = relicTools?.querySelector('[data-form="relic"]');
  panel.querySelector('[data-toggle-relic-form]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpening = relicTools?.classList.contains('hidden');
    relicTools?.classList.toggle('hidden');
    setDrawerState(participant.id, 'relic', isOpening);
  });
  relicTools?.querySelector('[data-relic-import]')?.addEventListener('change', (event) => {
    importRelicsFromFile(event.currentTarget, participant.id);
  });
  relicForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newRelic = buildRelicFromForm(formData);
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const existing = latest?.relics || participant.relics || [];
      const response = await api(`/api/participants/${participant.id}`, 'PATCH', {
        relics: [...existing, newRelic]
      });
      if (response?.participant) {
        updateParticipantInState(response.participant);
      }
      fetchState();
      event.target.reset();
      setDrawerState(participant.id, 'relic', true);
    } catch (err) {
      notify(err.message);
    }
  });
  panel.querySelectorAll('[data-remove-relic]').forEach((button, index) => {
    button.addEventListener('click', async () => {
      const relicId = button.dataset.removeRelic;
      const latest = (await getServerParticipant(participant.id)) || participant;
      const source = latest?.relics || participant.relics || [];
      const updated = source.filter((relic, idx) => {
        if (relic.id) {
          return relic.id !== relicId;
        }
        return idx !== index;
      });
      try {
        const response = await api(`/api/participants/${participant.id}`, 'PATCH', { relics: updated });
        if (response?.participant) {
          updateParticipantInState(response.participant);
        }
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  const inventoryTooling = panel.querySelector('[data-inventory-tooling]');
  const inventoryForm = inventoryTooling?.querySelector('[data-form="inventory"]');
  const currencyTooling = panel.querySelector('[data-currency-tooling]');
  const currencyForm = currencyTooling?.querySelector('[data-form="currency"]');
  panel.querySelector('[data-toggle-inventory-form]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpening = inventoryTooling?.classList.contains('hidden');
    inventoryTooling?.classList.toggle('hidden');
    setDrawerState(participant.id, 'inventory', isOpening);
  });
  panel.querySelector('[data-toggle-currency-form]')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpening = currencyTooling?.classList.contains('hidden');
    currencyTooling?.classList.toggle('hidden');
    setDrawerState(participant.id, 'inventoryCurrency', isOpening);
  });
  inventoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = String(formData.get('name') || '').trim();
    if (!name) {
      notify('Item name is required.');
      return;
    }
    const newItem = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      name,
      quantity: Math.max(1, Number(formData.get('quantity') || 1)),
      description: String(formData.get('description') || '').trim(),
      tags: String(formData.get('tags') || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    };
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const existing = latest?.inventory || participant.inventory || [];
      await api(`/api/participants/${participant.id}`, 'PATCH', { inventory: [...existing, newItem] });
      event.target.reset();
      setDrawerState(participant.id, 'inventory', true);
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  currencyForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = String(formData.get('name') || '').trim();
    if (!name) {
      notify('Currency name is required.');
      return;
    }
    const amount = Math.max(0, Math.round(Number(formData.get('amount') || 0)));
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const currencies = [...(latest?.currencies || participant.currencies || [])];
      const existingIndex = currencies.findIndex(
        (entry) => String(entry.name || '').trim().toLowerCase() === name.toLowerCase()
      );
      if (existingIndex >= 0) {
        const currentAmount = Math.max(0, Number(currencies[existingIndex].amount || 0));
        currencies[existingIndex] = {
          ...currencies[existingIndex],
          amount: currentAmount + amount
        };
      } else {
        currencies.push({
          id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name,
          amount
        });
      }
      await api(`/api/participants/${participant.id}`, 'PATCH', { currencies });
      event.target.reset();
      setDrawerState(participant.id, 'inventoryCurrency', true);
      notify(existingIndex >= 0 ? `${name} updated.` : `${name} added.`, 'success');
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  panel.querySelectorAll('[data-remove-inventory]').forEach((button) => {
    button.addEventListener('click', async () => {
      const itemId = button.dataset.removeInventory;
      const fallbackIndex = Number(button.dataset.inventoryIndex);
      try {
        const latest = (await getServerParticipant(participant.id)) || participant;
        const inventory = [...(latest?.inventory || participant.inventory || [])];
        let idx = inventory.findIndex((item) => itemId && item.id === itemId);
        if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
        if (idx < 0 || idx >= inventory.length) return;
        inventory.splice(idx, 1);
        await api(`/api/participants/${participant.id}`, 'PATCH', { inventory });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelectorAll('[data-currency-adjust]').forEach((button) => {
    button.addEventListener('click', async () => {
      const direction = button.dataset.currencyAdjust === 'remove' ? -1 : 1;
      const currencyId = button.dataset.currencyId;
      const fallbackIndex = Number(button.dataset.currencyIndex);
      const amountInput = button
        .closest('.currency-tab')
        ?.querySelector('[data-currency-input]');
      const step = Math.max(1, Math.round(Number(amountInput?.value || 1)));
      try {
        const latest = (await getServerParticipant(participant.id)) || participant;
        const currencies = [...(latest?.currencies || participant.currencies || [])];
        let idx = currencies.findIndex((currency) => currencyId && currency.id === currencyId);
        if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
        if (idx < 0 || idx >= currencies.length) return;
        const current = Math.max(0, Number(currencies[idx].amount || 0));
        const next = direction > 0 ? current + step : Math.max(0, current - step);
        currencies[idx] = { ...currencies[idx], amount: next };
        await api(`/api/participants/${participant.id}`, 'PATCH', { currencies });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelectorAll('[data-remove-currency]').forEach((button) => {
    button.addEventListener('click', async () => {
      const currencyId = button.dataset.removeCurrency;
      const fallbackIndex = Number(button.dataset.currencyIndex);
      try {
        const latest = (await getServerParticipant(participant.id)) || participant;
        const currencies = [...(latest?.currencies || participant.currencies || [])];
        let idx = currencies.findIndex((currency) => currencyId && currency.id === currencyId);
        if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
        if (idx < 0 || idx >= currencies.length) return;
        currencies.splice(idx, 1);
        await api(`/api/participants/${participant.id}`, 'PATCH', { currencies });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  const resistanceForm = panel.querySelector('[data-form="resistance"]');
  resistanceForm?.addEventListener('submit', (event) =>
    handleMitigationSubmit(event, participant, 'resistances', 'resistance')
  );
  panel.querySelectorAll('[data-remove-resistance]').forEach((button) => {
    button.addEventListener('click', () =>
      handleMitigationRemove(participant, 'resistances', Number(button.dataset.removeResistance))
    );
  });
  const vulnerabilityForm = panel.querySelector('[data-form="vulnerability"]');
  vulnerabilityForm?.addEventListener('submit', (event) =>
    handleMitigationSubmit(event, participant, 'vulnerabilities', 'vulnerability')
  );
  panel.querySelectorAll('[data-remove-vulnerability]').forEach((button) => {
    button.addEventListener('click', () =>
      handleMitigationRemove(participant, 'vulnerabilities', Number(button.dataset.removeVulnerability))
    );
  });

  const abilityForm = panel.querySelector('[data-form="ability"]');
  abilityForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const description = String(formData.get('description') || '').trim();
    if (!description) {
      notify('Ability description is required.');
      return;
    }
    const newEntry = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      name: String(formData.get('name') || '').trim() || 'Ability',
      description,
      automation: {}
    };
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const abilities = [...(latest?.abilities || participant.abilities || []), newEntry];
      await api(`/api/participants/${participant.id}`, 'PATCH', { abilities });
      event.target.reset();
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  panel.querySelectorAll('[data-remove-ability]').forEach((button) => {
    button.addEventListener('click', async () => {
      const entryId = button.dataset.removeAbility;
      const fallbackIndex = Number(button.dataset.abilityIndex);
      try {
        const latest = (await getServerParticipant(participant.id)) || participant;
        const abilities = [...(latest?.abilities || participant.abilities || [])];
        let idx = abilities.findIndex((entry) => entryId && entry.id === entryId);
        if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
        if (idx < 0 || idx >= abilities.length) return;
        abilities.splice(idx, 1);
        await api(`/api/participants/${participant.id}`, 'PATCH', { abilities });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelector('[data-form="proficiency"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const token = String(formData.get('proficiency') || '').trim();
    if (!token) return;
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const current = Array.isArray(latest?.proficiencies) ? latest.proficiencies : [];
      const proficiencies = mergeUniqueText(current, token);
      await api(`/api/participants/${participant.id}`, 'PATCH', { proficiencies });
      event.target.reset();
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  panel.querySelectorAll('[data-remove-proficiency]').forEach((button) => {
    button.addEventListener('click', async () => {
      const index = Number(button.dataset.removeProficiency);
      if (!Number.isInteger(index) || index < 0) return;
      try {
        const latest = (await getServerParticipant(participant.id)) || participant;
        const proficiencies = [...(latest?.proficiencies || [])];
        if (index >= proficiencies.length) return;
        proficiencies.splice(index, 1);
        await api(`/api/participants/${participant.id}`, 'PATCH', { proficiencies });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });
  panel.querySelector('[data-form="language"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const token = String(formData.get('language') || '').trim();
    if (!token) return;
    try {
      const latest = (await getServerParticipant(participant.id)) || participant;
      const current = Array.isArray(latest?.languages) ? latest.languages : [];
      const languages = mergeUniqueText(current, token);
      await api(`/api/participants/${participant.id}`, 'PATCH', { languages });
      event.target.reset();
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  panel.querySelectorAll('[data-remove-language]').forEach((button) => {
    button.addEventListener('click', async () => {
      const index = Number(button.dataset.removeLanguage);
      if (!Number.isInteger(index) || index < 0) return;
      try {
        const latest = (await getServerParticipant(participant.id)) || participant;
        const languages = [...(latest?.languages || [])];
        if (index >= languages.length) return;
        languages.splice(index, 1);
        await api(`/api/participants/${participant.id}`, 'PATCH', { languages });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelectorAll('[data-journal-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const category = form.dataset.journalForm;
      const payload = buildJournalPayloadFromForm(form, category);
      if (payload.error) {
        notify(payload.error);
        return;
      }
      try {
        await api('/api/journal/entry', 'POST', {
          target: 'participant',
          participantId: participant.id,
          category,
          ...payload
        });
        form.reset();
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelectorAll('[data-journal-add-all]').forEach((button) => {
    button.addEventListener('click', async () => {
      const category = button.dataset.journalAddAll;
      const form = button.closest('form[data-journal-form]');
      if (!form) return;
      const payload = buildJournalPayloadFromForm(form, category);
      if (payload.error) {
        notify(payload.error);
        return;
      }
      try {
        await api('/api/journal/entry', 'POST', {
          target: 'all',
          category,
          ...payload
        });
        form.reset();
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelectorAll('[data-journal-remove]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api('/api/journal/entry', 'DELETE', {
          target: 'participant',
          participantId: participant.id,
          category: button.dataset.journalCategory,
          entryId: button.dataset.journalRemove
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelectorAll('[data-journal-remove-all]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api('/api/journal/entry', 'DELETE', {
          target: 'all',
          category: button.dataset.journalCategory,
          entryId: button.dataset.journalRemoveAll
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    });
  });

  panel.querySelector('[data-form="participant"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = {
      initiative: Number(formData.get('initiative') || participant.initiative || 0),
      mastery: Number(formData.get('mastery') || participant.mastery || 1),
      apMax: Number(formData.get('apMax') || participant.apMax || 6),
      maxHp: Number(formData.get('maxHp') || participant.maxHp || 0),
      maxShield: Number(formData.get('maxShield') || participant.maxShield || 0),
      baseGuardRestore: Number(formData.get('baseGuardRestore') || 3),
      baseDamageBonus: Number(formData.get('baseDamageBonus') || 0),
      tags: (formData.get('tags') || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: formData.get('notes') || ''
    };
    payload.stats = {
      strength: Number(formData.get('strength') || participant.stats?.strength || 0),
      dexterity: Number(formData.get('dexterity') || participant.stats?.dexterity || 0),
      constitution: Number(formData.get('constitution') || participant.stats?.constitution || 0),
      intelligence: Number(formData.get('intelligence') || participant.stats?.intelligence || 0),
      wisdom: Number(formData.get('wisdom') || participant.stats?.wisdom || 0),
      charisma: Number(formData.get('charisma') || participant.stats?.charisma || 0)
    };
    try {
      await api(`/api/participants/${participant.id}`, 'PATCH', payload);
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-adjust-target]').forEach((button) => {
    button.addEventListener('click', () => handleAdjust(button, participant));
  });
}

async function handleAdjust(button, participant) {
  const target = button.dataset.adjustTarget;
  const mapping = { hp: 'hp', shield: 'shield', ap: 'ap' };
  const maxMapping = { hp: 'maxHp', shield: 'maxShield', ap: 'apMax' };
  const field = mapping[target];
  if (!field) return;
  const payload = {};
  if (button.dataset.reset === 'max') {
    payload[field] = participant[maxMapping[target]];
  } else {
    const delta = Number(button.dataset.delta || 0);
    const currentValue = field === 'ap' ? participant.apCurrent : participant[field];
    const newValue = currentValue + delta;
    if (field === 'ap') {
      payload.ap = newValue;
    } else {
      payload[field] = newValue;
    }
  }
  try {
    const result = await api(`/api/participants/${participant.id}/adjust`, 'POST', payload);
    if (result?.participant) {
      updateParticipantInState(result.participant);
    } else {
      fetchState();
    }
  } catch (err) {
    notify(err.message);
  }
}

function renderStatuses(participant) {
  const statuses = participant.statuses || [];
  if (!statuses.length) {
    return '<span class="muted">No statuses</span>';
  }
  return statuses
    .map(
      (status, index) => `
        <span class="status-pill">
          ${status.name}${status.stacks ? ` ×${status.stacks}` : ''}
          ${status.notes ? `<small>${status.notes}</small>` : ''}
          <button type="button" data-status-stack="${status.id || ''}" data-status-index="${index}" data-status-delta="-1">-</button>
          <button type="button" data-status-stack="${status.id || ''}" data-status-index="${index}" data-status-delta="1">+</button>
          <button type="button" data-remove-status="${status.id || ''}" data-status-index="${index}">✕</button>
        </span>`
    )
    .join('');
}

function renderCards(participant, entries = [], options = {}) {
  if (!entries.length) {
    return `<p class="empty-state">${options.inactive ? 'No inactive cards.' : 'No active cards tracked yet.'}</p>`;
  }
  return entries
    .map(({ card, index }) => {
      const activeActions = `
          <button type="button" data-use-card="${card.id || ''}">Use</button>
          <button type="button" data-deactivate-card="${card.id || ''}" data-card-index="${index}">Deactivate</button>
          <button type="button" data-export-card="${card.id || ''}">Export</button>
          <button type="button" data-remove-card="${card.id || ''}" data-card-index="${index}">Remove</button>`;
      const inactiveActions = `
          <button type="button" data-activate-card="${card.id || ''}" data-card-index="${index}">Activate</button>
          <button type="button" data-export-card="${card.id || ''}">Export</button>
          <button type="button" data-remove-card="${card.id || ''}" data-card-index="${index}">Remove</button>`;
      const compactEffect = formatCardEffectAtMastery(card, participant);
      return `
      <article class="card-item" data-card="${card.id}" data-card-index="${index}">
        <details class="card-collapse">
          <summary>
            <div class="card-summary-row">
              <div class="card-summary-main">
                <span class="card-summary-ap">AP ${Number(card.apCost || 0)}</span>
                <span class="card-summary-effect">${escapeHtml(compactEffect || '—')}</span>
              </div>
              ${options.inactive ? '' : `<button type="button" class="card-summary-action" data-use-card="${card.id || ''}">Use</button>`}
            </div>
          </summary>
          <div class="card-collapse-body">
            <h4>${card.name}</h4>
            <p>• ${card.type || '—'} · ${card.tier || '—'}${options.inactive ? ' · Inactive' : ''}</p>
            ${renderCardAttributeTable(card, participant)}
            ${renderConstructMetaLine(card, participant)}
            ${renderMasteryLines(card)}
            ${card.fusion ? `<p>Fusion: ${card.fusion}</p>` : ''}
            <p>Mastery Level: ${card.masteryLevel || 1} (${card.masteryUses || 0}/${card.masteryThresholds?.level3 || 55} uses)</p>
            <p>Automation: ${summarizeModifiers(card.modifiers || {})}</p>
            ${
              options.inactive
                ? ''
                : renderCardTargetControl(card, participant)
            }
            <label>Set Mastery
              <select data-card-mastery="${card.id || ''}" data-card-index="${index}">
                <option value="1" ${Number(card.masteryLevel || 1) === 1 ? 'selected' : ''}>Level 1</option>
                <option value="2" ${Number(card.masteryLevel || 1) === 2 ? 'selected' : ''}>Level 2</option>
                <option value="3" ${Number(card.masteryLevel || 1) >= 3 ? 'selected' : ''}>Level 3</option>
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

function renderCardTargetControl(card = {}, participant = {}) {
  const selfOnly = isSelfTargetCard(card);
  const targetMode = getCardTargetMode(card);
  const allowSelfTarget = card.allowSelfTarget !== false;
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const secondaryDamage = getCardSecondaryDamage(card);
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const showSecondaryTarget = secondaryDamage > 0 && secondaryTargetMode === 'adjacent';
  const arcaneSplitEnabled =
    participantHasSetBonus(participant, 'Arcane', 5) && !selfOnly && targetMode === 'single';
  const arcaneShiftEnabled =
    participantHasSetBonus(participant, 'Arcane', 3) &&
    (getCardDisplayDamage(card) > 0 || secondaryDamage > 0);
  const arcaneControls = renderArcaneCardControls(card, participant, {
    splitEnabled: arcaneSplitEnabled,
    shiftEnabled: arcaneShiftEnabled
  });
  const selfId = participant.id || '';
  if (selfOnly || targetMode === 'all_others') {
    const label = targetMode === 'all_others' ? 'All other combatants' : 'Self';
    const value = targetMode === 'all_others' ? '' : selfId;
    return `<label>Target
      <select data-card-target="${card.id || ''}" disabled>
        <option value="${value}" selected>${label}</option>
      </select>
    </label>
    ${
      showSecondaryTarget
        ? `<label>${escapeHtml(card.secondaryTargetLabel || 'Secondary Target')}
      <select data-card-secondary-target="${card.id || ''}">
        <option value="">Select target…</option>
        ${renderParticipantTargetOptions(participant.id, false)}
      </select>
    </label>`
        : ''
    }
    ${arcaneControls}`;
  }
  if (targetMode === 'multi_select') {
    return `<label>Targets (up to ${multiTargetCap})
      <select data-card-targets="${card.id || ''}" multiple size="${Math.max(3, Math.min(6, multiTargetCap + 1))}">
        ${renderParticipantTargetOptions(participant.id, allowSelfTarget)}
      </select>
    </label>
    ${arcaneControls}`;
  }
  return `<label>Target
    <select data-card-target="${card.id || ''}">
      <option value="">Select target…</option>
      ${renderParticipantTargetOptions(participant.id, allowSelfTarget)}
    </select>
  </label>
  ${
    showSecondaryTarget
      ? `<label>${escapeHtml(card.secondaryTargetLabel || 'Secondary Target')}
    <select data-card-secondary-target="${card.id || ''}">
      <option value="">Select target…</option>
      ${renderParticipantTargetOptions(participant.id, false)}
    </select>
  </label>`
      : ''
  }
  ${arcaneControls}`;
}

function renderArcaneCardControls(card = {}, participant = {}, options = {}) {
  const cardId = card.id || '';
  const controls = [];
  if (options.splitEnabled) {
    controls.push(`
      <label>Arcane Split Target
        <select data-card-arcane-split-target="${cardId}">
          <option value="">No split</option>
          ${renderParticipantTargetOptions(participant.id, false)}
        </select>
      </label>`);
  }
  if (options.shiftEnabled) {
    controls.push(`
      <label>Arcane Damage Type
        <select data-card-override-damage-type="${cardId}">
          <option value="">No change</option>
          ${DAMAGE_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
        </select>
      </label>`);
  }
  if (!controls.length) return '';
  return `<div class="form-row">${controls.join('')}</div>`;
}

function renderParticipantTargetOptions(actorId, includeSelf = false) {
  const options = [];
  if (includeSelf && actorId) {
    options.push(`<option value="${actorId}">Self</option>`);
  }
  for (const entry of state.encounter.participants || []) {
    if (entry.id === actorId) continue;
    options.push(`<option value="${entry.id}">${entry.name}</option>`);
  }
  return options.join('');
}

function renderCardAttributeTable(card = {}, participant = {}) {
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

function formatSignedValue(value = 0) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '+0';
  return `${amount >= 0 ? '+' : ''}${Math.round(amount)}`;
}

function formatCardRange(card = {}) {
  const text = String(card.rangeText || '').trim();
  if (text) return text;
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const range = getCardScaledValue(card.rangeByLevel, level, Number(card.range || 0));
  return `${range} ft`;
}

function isSelfTargetCard(card = {}) {
  const text = String(card.rangeText || '').trim().toLowerCase();
  if (text === 'self') return true;
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const range = getCardScaledValue(card.rangeByLevel, level, Number(card.range || 0));
  return Number(range || 0) <= 0;
}

function getCardTargetMode(card = {}) {
  const token = String(card.targetMode || '').trim().toLowerCase();
  if (token === 'all_others' || token === 'all-targets') return 'all_others';
  if (token === 'multi' || token === 'multi_select' || token === 'multi_up_to_3' || token === 'up_to_3') {
    return 'multi_select';
  }
  return 'single';
}

function getCardMultiTargetCap(card = {}) {
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const fallback = Number.isFinite(Number(card.multiTargetMax))
    ? Math.max(1, Math.round(Number(card.multiTargetMax)))
    : 3;
  const value = getCardScaledValue(card.multiTargetMaxByLevel, level, fallback);
  return Number.isFinite(Number(value)) ? Math.max(1, Math.round(Number(value))) : fallback;
}

function getCardSecondaryTargetMode(card = {}) {
  const token = String(card.secondaryTargetMode || '').trim().toLowerCase();
  if (token === 'same' || token === 'adjacent') return token;
  return '';
}

function getCardSecondaryDamage(card = {}) {
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const value = getCardScaledValue(card.secondaryDamageByLevel, level, Number(card.secondaryDamage || 0));
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function getCardScaledValue(source, level = 1, fallback = 0) {
  if (source == null) return fallback;
  const parsedLevel = Math.max(1, Math.min(3, Number(level || 1)));
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
  return fallback;
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
  const stacks = Math.max(
    1,
    Math.round(
      getCardScaledValue(source.stacksByLevel, level, Number(source.stacks ?? source.defaultStacks ?? 1))
    )
  );
  if (!id && !name) return null;
  return { id, name, stacks };
}

function formatCardEffectAtMastery(card = {}, participant = {}) {
  const fallback = String(card.effect || '').trim();
  if (isConstructCard(card)) {
    return fallback || '—';
  }
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const targetMode = getCardTargetMode(card);
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const parts = [];
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
  const shield = Math.max(0, Math.round(getCardScaledValue(card.shieldRestoreByLevel, level, 0)));
  if (shield > 0) {
    parts.push(`Restore ${shield} Shield.`);
  }
  const heal = Math.max(0, Math.round(getCardScaledValue(card.healByLevel, level, Number(card.heal || 0))));
  if (heal > 0) {
    parts.push(`Restore ${heal} HP.`);
  }
  const move = Math.max(0, Math.round(getCardScaledValue(card.movementByLevel, level, 0)));
  if (move > 0) {
    parts.push(`Move ${move} ft.`);
  }
  const pull = Math.max(0, Math.round(getCardScaledValue(card.pullDistanceByLevel, level, 0)));
  if (pull > 0) {
    parts.push(`Pull target ${pull} ft.`);
  }
  const push = Math.max(0, Math.round(getCardScaledValue(card.pushDistanceByLevel, level, 0)));
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
  const shieldBonus = Math.max(
    0,
    Math.round(getCardScaledValue(card.bonusDamageIfTargetHasShieldByLevel, level, Number(card.bonusDamageIfTargetHasShield || 0)))
  );
  if (shieldBonus > 0) {
    parts.push(`If target has Shield, deal +${shieldBonus} damage.`);
  }
  const fullyBlockedDirectHp = Math.max(
    0,
    Math.round(
      getCardScaledValue(
        card.directHpDamageOnFullyBlockedByLevel,
        level,
        Number(card.directHpDamageOnFullyBlocked || 0)
      )
    )
  );
  if (fullyBlockedDirectHp > 0) {
    parts.push(`If Fully Blocked, deal ${fullyBlockedDirectHp} damage directly to HP.`);
  }
  const nextAttackBonus = Math.max(
    0,
    Math.round(getCardScaledValue(card.nextAttackDamageBonusByLevel, level, Number(card.nextAttackDamageBonus || 0)))
  );
  if (nextAttackBonus > 0) {
    parts.push(`Target gains +${nextAttackBonus} damage on their next attack.`);
  }
  if (parts.length) {
    return parts.join(' ');
  }
  return fallback || '—';
}

function renderCardEffectLine(card = {}) {
  const effect = String(card.effect || '').trim();
  if (!effect) return '';
  if (isRedundantDamageEffect(card, effect)) return '';
  return `<p>${effect}</p>`;
}

function isConstructCard(card = {}) {
  if (card?.isConstruct === true) return true;
  const tags = Array.isArray(card?.tags) ? card.tags : [];
  return tags.some((tag) => {
    const token = String(tag || '').trim().toLowerCase();
    return token === 'construct' || token === 'turret';
  });
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

function renderConstructMetaLine(card = {}, participant = {}) {
  if (!isConstructCard(card)) return '';
  const mode = detectConstructMode(card);
  const baseDuration = Math.max(1, Number(card.constructDurationTurns || 1));
  const durationBonus = getConstructSetBonus(participant).durationBonusTurns;
  const effective = Math.max(1, baseDuration + durationBonus);
  const detail = durationBonus ? `${baseDuration} (+${durationBonus})` : `${baseDuration}`;
  const statusId = String(card.constructStatusId || '').trim();
  const statusName = String(card.constructStatusName || '').trim();
  const statusLabel = statusName || statusId;
  const stacks = Math.max(1, Number(card.constructStatusStacks || 1));
  const constructAp = Math.max(0, Math.round(Number(card.constructAp ?? 2) || 0));
  const constructHp = Math.max(1, Math.round(Number(card.constructMaxHp ?? 1) || 1));
  const constructCards = Array.isArray(card.constructCards)
    ? card.constructCards
    : String(card.constructLinkedCard || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  const modeText = mode === 'status'
    ? `Status: ${statusLabel || 'Unknown'} x${stacks}`
    : mode === 'utility'
      ? 'Utility construct'
      : 'Damage construct';
  return `<p>Construct: ${modeText} • Duration ${detail} turn${effective === 1 ? '' : 's'} (effective ${effective}) • HP ${constructHp} • AP ${constructAp}${constructCards.length ? ` • Cards: ${constructCards.join(', ')}` : ''}</p>`;
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
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const byLevel = card.masteryDamageByLevel || {};
  const base = Number(card.damage || 0);
  const levelDamage = Number(
    byLevel[level] ??
      byLevel[`level${level}`] ??
      (level >= 3 ? byLevel[3] ?? byLevel.level3 : level >= 2 ? byLevel[2] ?? byLevel.level2 : byLevel[1] ?? byLevel.level1) ??
      base
  );
  return Number.isFinite(levelDamage) ? Math.max(0, Math.round(levelDamage)) : Math.max(0, Math.round(base));
}

function renderRelicCards(participant) {
  const relics = participant.relics || [];
  if (!relics.length) {
    return '<p class="empty-state">No relics added.</p>';
  }
  return relics
    .map(
      (relic, index) => `
        <article class="relic-card">
          <h4>${relic.name}</h4>
          <p>HP ${relic.hp ?? 0} · AP ${relic.ap ?? 0} · Focus: ${relic.ability || '—'}</p>
          <p>${relic.description || ''}</p>
          <div class="card-actions">
            <button type="button" data-remove-relic="${relic.id || ''}" data-relic-index="${index}">Remove</button>
          </div>
        </article>`
    )
    .join('');
}

function populateBaseForm(panel, participant) {
  if (!panel) return;
  const pairs = [
    ['hp', participant.hp],
    ['maxHp', participant.maxHp],
    ['shield', participant.shield],
    ['maxShield', participant.maxShield],
    ['apCurrent', participant.apCurrent ?? participant.apMax],
    ['apMax', participant.apMax]
  ];
  pairs.forEach(([key, value]) => {
    const input = panel.querySelector(`input[name="${key}"]`);
    if (input) input.value = Number(value ?? 0);
  });
}

function renderNumberInput(label, name, value = 0) {
  return `
    <label>${label}
      <input type="number" name="${name}" value="${value ?? 0}" />
    </label>`;
}

function formatStatusesSummary(participant) {
  const statuses = participant.statuses || [];
  if (!statuses.length) return 'No statuses';
  return statuses
    .map((status) => `${status.name}${status.stacks ? `(${status.stacks})` : ''}`)
    .join(', ');
}

function renderLog() {
  const log = state.encounter.log || [];
  if (!log.length) {
    els.logList.innerHTML = '<p class="empty-state">No actions logged yet.</p>';
    return;
  }
  els.logList.innerHTML = log
    .slice()
    .reverse()
    .map((entry) => {
      const actor = state.encounter.participants.find((p) => p.id === entry.participantId);
      const actorName = actor ? actor.name : '—';
      return `
        <div class="log-entry">
          <time>${new Date(entry.at).toLocaleTimeString()}</time>
          <div><strong>${actorName}</strong> — ${entry.text}</div>
        </div>`;
    })
    .join('');
}

function getParticipantSnapshot(participantId) {
  if (!participantId) return null;
  return state.encounter.participants?.find((entry) => entry.id === participantId) || null;
}

function getSelectedParticipant() {
  return getParticipantSnapshot(selectedParticipantId);
}

function getStatusPresetById(id) {
  if (!id) return null;
  return (state.reference?.statuses || []).find((entry) => entry.id === id) || null;
}

function applyStatusPreset(selectEl, formEl) {
  const preset = getStatusPresetById(selectEl?.value);
  if (!preset || !formEl) {
    return;
  }
  const nameInput = formEl.querySelector('input[name="name"]');
  const stackInput = formEl.querySelector('input[name="stacks"]');
  const notesInput = formEl.querySelector('input[name="notes"]');
  if (nameInput) nameInput.value = preset.name;
  if (stackInput && typeof preset.defaultStacks === 'number') stackInput.value = preset.defaultStacks;
  if (notesInput) notesInput.value = preset.description || '';
}

function rememberDetailSections(participantId) {
  if (!participantId) return;
  const nextState = {};
  els.detailPanel.querySelectorAll('details[data-section], details.advanced-editor').forEach((node) => {
    const key = node.dataset.section || node.dataset.sectionKey || node.id || node.className;
    if (!key) return;
    nextState[key] = node.open;
  });
  detailSectionState.set(participantId, nextState);
}

function restoreDetailSections(participantId) {
  if (!participantId) return;
  const stored = detailSectionState.get(participantId);
  if (!stored) return;
  els.detailPanel.querySelectorAll('details[data-section], details.advanced-editor').forEach((node) => {
    const key = node.dataset.section || node.dataset.sectionKey || node.id || node.className;
    if (stored[key]) {
      node.open = true;
    }
  });
}

async function handleStandardAction(actionId) {
  const panel = els.detailPanel;
  let resolvedId = actionId;
  let recoverPayload = {};
  if (actionId === 'move') {
    const diffToggle = panel.querySelector('#difficultTerrain');
    if (diffToggle?.checked) {
      resolvedId = 'move_difficult';
    }
  }
  if (actionId === 'recover') {
    const participant = getSelectedParticipant();
    const target = chooseRecoverTarget(participant);
    if (target === null) {
      return;
    }
    recoverPayload = target || {};
  }
  try {
    await api('/api/actions/standard', 'POST', {
      actionId: resolvedId,
      participantId: selectedParticipantId,
      ...recoverPayload
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

function listRecoverableStatuses(participant) {
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

function chooseRecoverTarget(participant) {
  const recoverable = listRecoverableStatuses(participant);
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

function buildCardFromForm(formData) {
  const masteryRaw = formData.get('mastery') || '';
  const card = {
    name: formData.get('name'),
    set: formData.get('set') || '',
    type: formData.get('type') || 'Attack',
    tier: formData.get('tier') || 'Common',
    apCost: formData.get('apCost'),
    range: formData.get('range'),
    healthBonus: formData.get('healthBonus'),
    shieldBonus: formData.get('shieldBonus'),
    damage: formData.get('damage'),
    damageType: formData.get('damageType'),
    constructDurationTurns: formData.get('constructDurationTurns') || 1,
    constructMode: formData.get('constructMode') || '',
    constructStatusId: formData.get('constructStatusId') || '',
    constructStatusStacks: formData.get('constructStatusStacks') || 1,
    tags: formData.get('tags') || '',
    effect: formData.get('effect') || '',
    mastery: masteryRaw,
    masteryThresholds: {
      level2: formData.get('masteryTo2'),
      level3: formData.get('masteryTo3')
    },
    fusion: formData.get('fusion') || '',
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
  const selected = Math.max(1, Math.min(3, Number(level || 1)));
  const thresholds = next.masteryThresholds || {};
  const to2 = Math.max(1, Number(thresholds.level2 || 25));
  const to3 = Math.max(to2 + 1, Number(thresholds.level3 || 55));
  let uses = Math.max(0, Number(next.masteryUses || 0));
  if (selected === 1) uses = Math.min(uses, to2 - 1);
  if (selected === 2) uses = Math.max(to2, Math.min(uses, to3 - 1));
  if (selected === 3) uses = Math.max(uses, to3);
  next.masteryLevel = selected;
  next.masteryUses = uses;
  next.masteryThresholds = { level2: to2, level3: to3 };
  return next;
}

async function importCardsFromFile(input, participantId) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const imported = extractCardsFromPayload(payload).map((card) => normalizeCardPayload(card));
    if (!imported.length) {
      notify('No cards found in file.');
      return;
    }
    const latest = (await getServerParticipant(participantId)) || getParticipantSnapshot(participantId);
    const existingCards = latest?.cards || [];
    let remainingSlots = Math.max(
      0,
      MAX_ACTIVE_CARDS - existingCards.filter((card) => isCardActive(card)).length
    );
    imported.forEach((card) => {
      if (card.active === false) return;
      if (remainingSlots > 0) {
        card.active = true;
        remainingSlots -= 1;
      } else {
        card.active = false;
      }
    });
    const response = await api(`/api/participants/${participantId}`, 'PATCH', {
      cards: [...existingCards, ...imported]
    });
    if (response?.participant) {
      updateParticipantInState(response.participant);
    }
    notify(`Imported ${imported.length} card${imported.length === 1 ? '' : 's'}.`);
    if (imported.some((card) => card.active === false)) {
      notify(`Only ${MAX_ACTIVE_CARDS} cards can be active. Extra imports were set inactive.`);
    }
    fetchState();
  } catch (err) {
    notify(`Card import failed: ${err.message}`);
  } finally {
    input.value = '';
  }
}

function extractCardsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.cards)) return payload.cards;
  if (payload.card && Array.isArray(payload.card)) return payload.card;
  if (payload.card && typeof payload.card === 'object') return [payload.card];
  if (typeof payload === 'object') return [payload];
  return [];
}

function normalizeCardPayload(raw = {}) {
  const masteryThresholds = {
    level2: toNumber(raw.masteryThresholds?.level2 ?? raw.masteryTo2 ?? 25, 25),
    level3: toNumber(raw.masteryThresholds?.level3 ?? raw.masteryTo3 ?? 55, 55)
  };
  masteryThresholds.level2 = Math.max(1, Math.round(masteryThresholds.level2));
  masteryThresholds.level3 = Math.max(masteryThresholds.level2 + 1, Math.round(masteryThresholds.level3));
  const masteryLevel = Math.max(1, Math.min(3, Math.round(toNumber(raw.masteryLevel ?? 1, 1))));
  const masteryUses = Math.max(0, Math.round(toNumber(raw.masteryUses ?? 0, 0)));
  const baseDamage = Math.max(0, Math.round(toNumber(raw.damage ?? raw.baseDamage ?? 0, 0)));
  const tier = String(raw.tier || 'Common').trim() || 'Common';
  const explicitShieldSource = raw.shieldBonus ?? raw.bonusShield;
  const explicitShieldBonus =
    explicitShieldSource === '' || explicitShieldSource == null ? Number.NaN : Number(explicitShieldSource);
  const shieldBonus = Number.isFinite(explicitShieldBonus)
    ? explicitShieldBonus
    : getCardTierShieldBonus(tier);
  return {
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
      3: toNumber(raw.masteryDamageByLevel?.[3] ?? raw.masteryDamageByLevel?.level3 ?? raw.damageLevel3 ?? baseDamage, baseDamage)
    },
    tags: normalizeTagList(raw.tags),
    effect: raw.effect || '',
    mastery: normalizeMasteryInput(raw.mastery ?? raw.masteryLevels),
    fusion: raw.fusion || raw.fusionNotes || '',
    modifiers: {
      maxHp: toNumber(raw.modifiers?.maxHp ?? raw.modMaxHp ?? raw.maxHpBonus ?? 0),
      maxShield: toNumber(raw.modifiers?.maxShield ?? raw.modMaxShield ?? raw.maxShieldBonus ?? 0),
      apMax: toNumber(raw.modifiers?.apMax ?? raw.modApMax ?? raw.apMaxBonus ?? 0),
      guardRestore: toNumber(raw.modifiers?.guardRestore ?? raw.modGuard ?? raw.guardBonus ?? 0),
      damageBonus: toNumber(raw.modifiers?.damageBonus ?? raw.modDamage ?? raw.damageBonus ?? 0)
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

function buildRelicFromForm(formData) {
  return normalizeRelicPayload({
    name: formData.get('name'),
    ability: formData.get('ability'),
    description: formData.get('description'),
    hp: formData.get('hp'),
    ap: formData.get('ap')
  });
}

async function importRelicsFromFile(input, participantId) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const imported = extractRelicsFromPayload(payload).map((relic) => normalizeRelicPayload(relic));
    if (!imported.length) {
      notify('No relics found in file.');
      return;
    }
    const latest = (await getServerParticipant(participantId)) || getParticipantSnapshot(participantId);
    const existing = latest?.relics || [];
    const response = await api(`/api/participants/${participantId}`, 'PATCH', {
      relics: [...existing, ...imported]
    });
    if (response?.participant) {
      updateParticipantInState(response.participant);
    }
    notify(`Imported ${imported.length} relic${imported.length === 1 ? '' : 's'}.`);
    fetchState();
  } catch (err) {
    notify(`Relic import failed: ${err.message}`);
  } finally {
    input.value = '';
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
    hp: toNumber(raw.hp ?? raw.hpBonus ?? raw.modifiers?.maxHp ?? 0),
    ap: toNumber(raw.ap ?? raw.apBonus ?? raw.modifiers?.apMax ?? 0),
    modifiers: {
      maxHp: toNumber(raw.modifiers?.maxHp ?? raw.modMaxHp ?? 0),
      maxShield: toNumber(raw.modifiers?.maxShield ?? raw.modMaxShield ?? 0),
      apMax: toNumber(raw.modifiers?.apMax ?? raw.modApMax ?? 0),
      guardRestore: toNumber(raw.modifiers?.guardRestore ?? raw.modGuard ?? 0),
      damageBonus: toNumber(raw.modifiers?.damageBonus ?? raw.modDamage ?? 0)
    }
  };
}

async function handleMitigationSubmit(event, participant, field, inputName) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const value = String(formData.get(inputName) || '').trim();
  if (!value) {
    notify('Select a damage type.');
    return;
  }
  try {
    const latest = (await getServerParticipant(participant.id)) || participant;
    const existing = Array.isArray(latest?.[field]) ? [...latest[field]] : [];
    const duplicate = existing.find((entry) => entry.toLowerCase() === value.toLowerCase());
    if (duplicate) {
      notify('Already listed.');
      return;
    }
    const response = await api(`/api/participants/${participant.id}`, 'PATCH', {
      [field]: [...existing, value]
    });
    if (response?.participant) {
      updateParticipantInState(response.participant);
    }
    fetchState();
    const select = event.target.querySelector('select');
    if (select) select.value = '';
  } catch (err) {
    notify(err.message);
  }
}

async function handleMitigationRemove(participant, field, index) {
  if (index < 0 || Number.isNaN(index)) return;
  try {
    const latest = (await getServerParticipant(participant.id)) || participant;
    const existing = Array.isArray(latest?.[field]) ? [...latest[field]] : [];
    if (index >= existing.length) return;
    existing.splice(index, 1);
    const response = await api(`/api/participants/${participant.id}`, 'PATCH', {
      [field]: existing
    });
    if (response?.participant) {
      updateParticipantInState(response.participant);
    }
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function notify(message, type = 'info') {
  if (!message) return;
  console.warn(message);
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

async function triggerGroupRest(type) {
  try {
    await api(`/api/rest/${type}/all`, 'POST');
    notify(`${type === 'short' ? 'Short' : 'Long'} rest triggered for everyone.`);
  } catch (err) {
    notify(err.message);
  }
}

async function handleEncounterDownload() {
  try {
    const data = await api('/api/export/encounter');
    if (data?.encounter) {
      downloadJson(data.encounter, `encounter-${new Date().toISOString().slice(0, 10)}.json`);
      els.gmMenuPanel?.classList.remove('is-open');
      els.helpMenuPanel?.classList.remove('is-open');
    } else {
      notify('Unable to export encounter.');
    }
  } catch (err) {
    notify(err.message);
  }
}

async function handleEncounterImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const encounter = payload.encounter || payload;
    if (!encounter || typeof encounter !== 'object') {
      throw new Error('Invalid encounter file.');
    }
    await api('/api/import/encounter', 'POST', { encounter });
    notify('Encounter imported.');
  } catch (err) {
    notify(`Encounter import failed: ${err.message}`);
  } finally {
    event.target.value = '';
    els.gmMenuPanel?.classList.remove('is-open');
    els.helpMenuPanel?.classList.remove('is-open');
  }
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

async function getServerParticipant(participantId) {
  if (!participantId) return null;
  try {
    const response = await api(`/api/participants/${participantId}/export`);
    return response?.participant || null;
  } catch (err) {
    notify(err.message);
    return getParticipantSnapshot(participantId);
  }
}

function updateParticipantInState(nextParticipant) {
  if (!nextParticipant?.id) return;
  const list = Array.isArray(state.encounter.participants) ? [...state.encounter.participants] : [];
  const index = list.findIndex((entry) => entry.id === nextParticipant.id);
  if (index >= 0) {
    list[index] = nextParticipant;
  } else {
    list.push(nextParticipant);
  }
  state.encounter.participants = list;
  render();
}
