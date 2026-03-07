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

const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1 },
  reference: { standardActions: [], sets: [], statuses: [] },
  updatedAt: null
};

const detailSectionState = new Map();

let selectedParticipantId = null;
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
  prevTurn: document.getElementById('prevTurn'),
  nextTurn: document.getElementById('nextTurn'),
  refreshState: document.getElementById('refreshState'),
  gmMenuToggle: document.getElementById('gmMenuToggle'),
  gmMenuPanel: document.getElementById('gmMenuPanel'),
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
  els.prevTurn?.addEventListener('click', () => api('/api/turn/previous', 'POST'));
  els.nextTurn?.addEventListener('click', () => api('/api/turn/next', 'POST'));
  els.refreshState?.addEventListener('click', fetchState);
  els.restAllShort?.addEventListener('click', () => triggerGroupRest('short'));
  els.restAllLong?.addEventListener('click', () => triggerGroupRest('long'));

  els.gmMenuToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    els.gmMenuPanel?.classList.toggle('is-open');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.gm-menu')) {
      els.gmMenuPanel?.classList.remove('is-open');
    }
  });
  els.downloadEncounter?.addEventListener('click', handleEncounterDownload);
  els.uploadEncounter?.addEventListener('change', handleEncounterImport);
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
}

function renderMeta() {
  els.round.textContent = state.encounter.round ?? 1;
  els.count.textContent = state.encounter.participants?.length ?? 0;
}

function renderTurnList() {
  const list = state.encounter.participants || [];
  if (!list.length) {
    els.turnList.textContent = 'No combatants yet.';
    els.turnList.classList.add('empty-state');
    return;
  }
  els.turnList.classList.remove('empty-state');
  els.turnList.innerHTML = '';
  list.forEach((participant, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'turn-row';
    row.dataset.id = participant.id;
    if (participant.id === selectedParticipantId) {
      row.classList.add('is-selected');
    }
    if (index === state.encounter.currentIndex) {
      row.classList.add('is-current');
    }
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

  els.detailPanel.innerHTML = `
    <div class="active-header">
      <div>
        <h2>${participant.name}</h2>
        <p class="muted">Set Focus: ${participant.setFocus || '—'}</p>
      </div>
      <div class="detail-actions">
        <a href="/player?id=${participant.id}" target="_blank" rel="noopener noreferrer">Player View</a>
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
    ${renderStatusSection(participant)}
    ${renderMitigationSection(participant)}
    ${renderActionsSection(participant)}
    ${renderCardsSection(participant)}
    ${renderRelicSection(participant)}
    ${renderAutomationSection(participant)}
    ${renderAdvancedSection(participant, base)}
  `;
  els.detailPanel.dataset.participantId = participant.id;
  wireDetailEvents(participant);
  restoreDetailSections(participant.id);
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
            <label>Severity
              <select name="severity">
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="exceptional">Exceptional</option>
              </select>
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

function renderCardsSection(participant) {
  const cards = participant.cards || [];
  return `
    <details class="collapsible-block" data-section="cards">
      <summary>
        <strong>Cards (${cards.length})</strong>
        <button type="button" data-toggle-card-form>Add Card</button>
      </summary>
      <div class="collapsible-body">
        <div class="cards-grid">
          ${renderCards(participant)}
        </div>
        <div class="card-tooling hidden" data-card-tooling>
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

function renderRelicSection(participant) {
  const relics = participant.relics || [];
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
        <div class="card-tooling hidden" data-relic-tooling>
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
  return `
    <details class="collapsible-block" data-section="automation">
      <summary>
        <div>
          <strong>Automation</strong>
          <span class="muted">Guard +${participant.guardRestore || 3}, Damage +${participant.damageBonus || 0}</span>
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
            ${renderAutomationSetList(automation.setBonuses)}
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

function renderAutomationSetList(entries = []) {
  if (!entries.length) {
    return '<li class="muted">No set bonuses active.</li>';
  }
  return entries
    .map(
      (entry) => `<li>${entry.set} (${entry.pieces}+ pcs): ${entry.effect || summarizeModifiers(entry.modifiers)}</li>`
    )
    .join('');
}

function renderSetOptions() {
  return (state.reference?.sets || [])
    .map((entry) => `<option value="${entry.name}"></option>`)
    .join('');
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

  panel.querySelectorAll('[data-standard]').forEach((button) => {
    button.addEventListener('click', () => handleStandardAction(button.dataset.standard));
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
  panel.querySelector('[data-toggle-status-form]')?.addEventListener('click', () => {
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
      severity: formData.get('severity') || 'minor',
      stacks: Number(formData.get('stacks') || 1),
      notes: formData.get('notes') || ''
    };
    try {
      await api(`/api/participants/${participant.id}`, 'PATCH', {
        statuses: [...(participant.statuses || []), newStatus]
      });
      event.target.reset();
      statusForm.classList.add('hidden');
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-remove-status]').forEach((button, index) => {
    button.addEventListener('click', async () => {
      const updated = (participant.statuses || []).filter((status, idx) => {
        if (status.id) {
          return status.id !== button.dataset.removeStatus;
        }
        return idx !== index;
      });
      try {
        await api(`/api/participants/${participant.id}`, 'PATCH', { statuses: updated });
      } catch (err) {
        notify(err.message);
      }
    });
  });

  const cardTools = panel.querySelector('[data-card-tooling]');
  const cardForm = cardTools?.querySelector('[data-form="card"]');
  panel.querySelector('[data-toggle-card-form]')?.addEventListener('click', () => {
    cardTools?.classList.toggle('hidden');
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
      const response = await api(`/api/participants/${participant.id}`, 'PATCH', {
        cards: [...existingCards, newCard]
      });
      if (response?.participant) {
        updateParticipantInState(response.participant);
      }
      fetchState();
      event.target.reset();
      cardTools?.classList.add('hidden');
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-remove-card]').forEach((button, index) => {
    button.addEventListener('click', async () => {
      const cardId = button.dataset.removeCard;
      const latest = (await getServerParticipant(participant.id)) || participant;
      const sourceCards = latest?.cards || participant.cards || [];
      const updated = sourceCards.filter((card, idx) => {
        if (card.id) {
          return card.id !== cardId;
        }
        return idx !== index;
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
  panel.querySelector('[data-toggle-relic-form]')?.addEventListener('click', () => {
    relicTools?.classList.toggle('hidden');
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
      relicTools?.classList.add('hidden');
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
          ${status.name} (${status.severity}${status.stacks ? ` ×${status.stacks}` : ''})
          ${status.notes ? `<small>${status.notes}</small>` : ''}
          <button type="button" data-remove-status="${status.id || ''}" data-status-index="${index}">✕</button>
        </span>`
    )
    .join('');
}

function renderCards(participant) {
  const cards = participant.cards || [];
  if (!cards.length) {
    return '<p class="empty-state">No cards tracked yet.</p>';
  }
  return cards
    .map(
      (card, index) => `
      <article class="card-item" data-card="${card.id}">
        <h4>${card.name} <small>${card.tier || ''} · ${card.type || ''}</small></h4>
        <p>Set: <strong>${card.set || '—'}</strong> · AP ${card.apCost || 0}</p>
        <p>Tags: ${(card.tags || []).join(', ') || '—'}</p>
        <p>${card.effect || ''}</p>
        ${card.mastery?.length ? `<p>Mastery: ${card.mastery.join(' / ')}</p>` : ''}
        ${card.fusion ? `<p>Fusion: ${card.fusion}</p>` : ''}
        <p>Automation: ${summarizeModifiers(card.modifiers || {})}</p>
        <div class="card-actions">
          <button type="button" data-export-card="${card.id || ''}">Export</button>
          <button type="button" data-remove-card="${card.id || ''}" data-card-index="${index}">Remove</button>
        </div>
      </article>`
    )
    .join('');
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
  const severitySelect = formEl.querySelector('select[name="severity"]');
  const stackInput = formEl.querySelector('input[name="stacks"]');
  const notesInput = formEl.querySelector('input[name="notes"]');
  if (nameInput) nameInput.value = preset.name;
  if (severitySelect) severitySelect.value = preset.severity || 'minor';
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
  if (actionId === 'move') {
    const diffToggle = panel.querySelector('#difficultTerrain');
    if (diffToggle?.checked) {
      resolvedId = 'move_difficult';
    }
  }
  try {
    await api('/api/actions/standard', 'POST', {
      actionId: resolvedId,
      participantId: selectedParticipantId
    });
  } catch (err) {
    notify(err.message);
  }
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
    tags: formData.get('tags') || '',
    effect: formData.get('effect') || '',
    mastery: masteryRaw,
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
    const response = await api(`/api/participants/${participantId}`, 'PATCH', {
      cards: [...existingCards, ...imported]
    });
    if (response?.participant) {
      updateParticipantInState(response.participant);
    }
    notify(`Imported ${imported.length} card${imported.length === 1 ? '' : 's'}.`);
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
  return {
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: (raw.name || 'Imported Card').trim(),
    set: raw.set || '',
    type: raw.type || 'Attack',
    tier: raw.tier || 'Common',
    apCost: toNumber(raw.apCost ?? raw.ap ?? 0),
    range: toNumber(raw.range ?? 0),
    healthBonus: toNumber(raw.healthBonus ?? raw.hpBonus ?? 0),
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

function notify(message) {
  if (!message) return;
  console.warn(message);
  const toast = document.createElement('div');
  toast.className = 'toast';
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
