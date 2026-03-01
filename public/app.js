const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1 },
  reference: { standardActions: [] },
  updatedAt: null
};

let selectedParticipantId = null;
let eventSource;

const els = {
  round: document.querySelector('[data-round]'),
  count: document.querySelector('[data-count]'),
  currentTurnSummary: document.getElementById('currentTurnSummary'),
  turnList: document.getElementById('turnList'),
  detailPanel: document.getElementById('detailPanel'),
  standardActions: document.getElementById('standardActions'),
  difficultTerrain: document.getElementById('difficultTerrain'),
  addForm: document.getElementById('addParticipantForm'),
  customActionForm: document.getElementById('customActionForm'),
  refreshState: document.getElementById('refreshState'),
  restButtons: document.querySelectorAll('[data-rest]'),
  nextTurn: document.getElementById('nextTurn'),
  prevTurn: document.getElementById('prevTurn'),
  startEncounter: document.getElementById('startEncounter')
};

document.addEventListener('DOMContentLoaded', () => {
  wireForms();
  subscribeToEvents();
  fetchState();
});

function wireForms() {
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
    } catch (err) {
      notify(err.message);
    }
  });

  els.customActionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const text = data.get('text')?.trim();
    if (!text) return;
    try {
      await api('/api/actions/custom', 'POST', {
        actorId: selectedParticipantId,
        text
      });
      event.target.reset();
    } catch (err) {
      notify(err.message);
    }
  });

  els.refreshState?.addEventListener('click', fetchState);
  els.nextTurn?.addEventListener('click', () => api('/api/turn/next', 'POST'));
  els.prevTurn?.addEventListener('click', () => api('/api/turn/previous', 'POST'));
  els.startEncounter?.addEventListener('click', () => api('/api/turn/start', 'POST'));

  els.restButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const type = button.dataset.rest;
      const targetId = resolveSelectedId();
      if (!targetId) {
        notify('Select a combatant or choose the current turn.');
        return;
      }
      try {
        await api(`/api/rest/${type}`, 'POST', { participantId: targetId });
      } catch (err) {
        notify(err.message);
      }
    });
  });
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
  renderStandardActions();
  renderDetailPanel();
  renderLog();
}

function renderMeta() {
  els.round.textContent = state.encounter.round ?? 1;
  els.count.textContent = state.encounter.participants?.length ?? 0;
  const current = getCurrentParticipant();
  if (!current) {
    els.currentTurnSummary.textContent = 'No combatant selected.';
    return;
  }
  els.currentTurnSummary.innerHTML = `Current turn: <strong>${current.name}</strong> — AP ${current.apCurrent}/${current.apMax}, HP ${current.hp}/${current.maxHp}, Shield ${current.shield}/${current.maxShield}`;
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

function renderStandardActions() {
  const actions = (state.reference?.standardActions || []).filter(
    (action) => action.id !== 'move_difficult'
  );
  if (!actions.length) {
    els.standardActions.innerHTML = '<p class="empty-state">Standard actions will appear once the server boots.</p>';
    return;
  }
  if (els.standardActions.dataset.rendered) return;
  els.standardActions.innerHTML = '';
  actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${action.label} (${action.apCost} AP)`;
    button.title = action.summary;
    button.dataset.actionId = action.id;
    button.addEventListener('click', () => handleStandardAction(action.id));
    els.standardActions.appendChild(button);
  });
  els.standardActions.dataset.rendered = 'true';
}

async function handleStandardAction(actionId) {
  if (actionId === 'move' && els.difficultTerrain.checked) {
    actionId = 'move_difficult';
  }
  try {
    await api('/api/actions/standard', 'POST', {
      actionId,
      participantId: resolveSelectedId()
    });
  } catch (err) {
    notify(err.message);
  }
}

function renderDetailPanel() {
  const participant = getSelectedParticipant();
  if (!participant) {
    els.detailPanel.classList.add('empty-state');
    els.detailPanel.innerHTML = 'Select a combatant to edit their stats, cards, and statuses.';
    return;
  }
  els.detailPanel.classList.remove('empty-state');
  const stats = participant.stats || {};
  els.detailPanel.innerHTML = `
    <div class="section-header">
      <div>
        <h3>${participant.name}</h3>
        <p class="muted">Set Focus: ${participant.setFocus || '—'}</p>
      </div>
      <div class="detail-actions">
        <a href="/player?id=${participant.id}" target="_blank" rel="noopener noreferrer">Open Player View</a>
      </div>
    </div>
    <form data-form="participant" class="stacked-form">
      <label>Name
        <input type="text" name="name" value="${participant.name}" />
      </label>
      <div class="stats-grid">
        ${renderNumberInput('Initiative', 'initiative', participant.initiative)}
        ${renderNumberInput('Mastery', 'mastery', participant.mastery)}
        ${renderNumberInput('AP Max', 'apMax', participant.apMax)}
        ${renderNumberInput('AP Current', 'apCurrent', participant.apCurrent)}
      </div>
      <div class="stats-grid">
        ${renderNumberInput('HP', 'hp', participant.hp)}
        ${renderNumberInput('Max HP', 'maxHp', participant.maxHp)}
        ${renderNumberInput('Shield', 'shield', participant.shield)}
        ${renderNumberInput('Max Shield', 'maxShield', participant.maxShield)}
      </div>
      <div class="stats-grid">
        ${renderNumberInput('STR', 'strength', stats.strength || 0)}
        ${renderNumberInput('DEX', 'dexterity', stats.dexterity || 0)}
        ${renderNumberInput('CON', 'constitution', stats.constitution || 0)}
        ${renderNumberInput('INT', 'intelligence', stats.intelligence || 0)}
        ${renderNumberInput('WIS', 'wisdom', stats.wisdom || 0)}
        ${renderNumberInput('CHA', 'charisma', stats.charisma || 0)}
      </div>
      <label>Set Focus
        <input type="text" name="setFocus" value="${participant.setFocus || ''}" placeholder="Machine, Elemental, etc." />
      </label>
      <label>Tags
        <input type="text" name="tags" value="${(participant.tags || []).join(', ')}" placeholder="Melee, Shield, Bleed" />
      </label>
      <label>Notes
        <textarea name="notes" rows="3">${participant.notes || ''}</textarea>
      </label>
      <div class="form-row">
        <button type="submit" class="primary">Save Changes</button>
        <button type="button" class="danger" data-remove>Remove</button>
      </div>
    </form>
    <div>
      <div class="section-header">
        <h3>Statuses</h3>
      </div>
      <div class="status-list">
        ${renderStatuses(participant)}
      </div>
      <form data-form="status" class="stacked-form">
        <div class="form-row">
          <label>Name
            <input type="text" name="name" placeholder="Bleeding" required />
          </label>
          <label>Severity
            <select name="severity">
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
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
    <div>
      <div class="section-header">
        <h3>Cards</h3>
      </div>
      <div class="card-list">
        ${renderCards(participant)}
      </div>
      <form data-form="card" class="stacked-form">
        <div class="form-row">
          <label>Name
            <input type="text" name="name" required />
          </label>
          <label>Set
            <input type="text" name="set" />
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
        <label>Set Bonuses (3 / 5 pcs)
          <input type="text" name="setBonuses" placeholder="3 pcs: ..., 5 pcs: ..." />
        </label>
        <button type="submit">Add Card</button>
      </form>
    </div>
  `;

  wireDetailEvents(participant);
}

function wireDetailEvents(participant) {
  const panel = els.detailPanel;
  const participantForm = panel.querySelector('[data-form="participant"]');
  const statusForm = panel.querySelector('[data-form="status"]');
  const cardForm = panel.querySelector('[data-form="card"]');
  const removeButton = panel.querySelector('[data-remove]');

  participantForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = {
      name: formData.get('name') || participant.name,
      initiative: Number(formData.get('initiative') || participant.initiative || 0),
      mastery: Number(formData.get('mastery') || participant.mastery || 1),
      apMax: Number(formData.get('apMax') || participant.apMax || 6),
      apCurrent: Number(formData.get('apCurrent') || participant.apCurrent || 0),
      hp: Number(formData.get('hp') || participant.hp || 0),
      maxHp: Number(formData.get('maxHp') || participant.maxHp || 0),
      shield: Number(formData.get('shield') || participant.shield || 0),
      maxShield: Number(formData.get('maxShield') || participant.maxShield || 0),
      setFocus: formData.get('setFocus') || '',
      tags: (formData.get('tags') || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: formData.get('notes') || ''
    };
    payload.stats = {
      strength: Number(formData.get('strength') || 0),
      dexterity: Number(formData.get('dexterity') || 0),
      constitution: Number(formData.get('constitution') || 0),
      intelligence: Number(formData.get('intelligence') || 0),
      wisdom: Number(formData.get('wisdom') || 0),
      charisma: Number(formData.get('charisma') || 0)
    };
    try {
      await api(`/api/participants/${participant.id}`, 'PATCH', payload);
    } catch (err) {
      notify(err.message);
    }
  });

  removeButton?.addEventListener('click', async () => {
    if (!confirm(`Remove ${participant.name}?`)) return;
    try {
      await api(`/api/participants/${participant.id}`, 'DELETE');
    } catch (err) {
      notify(err.message);
    }
  });

  statusForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newStatus = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
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
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-remove-status]').forEach((button) => {
    button.addEventListener('click', async () => {
      const statusId = button.dataset.removeStatus;
      const statusIndex = Number(button.dataset.statusIndex);
      const updated = (participant.statuses || []).filter((status, index) => {
        if (status.id) {
          return status.id !== statusId;
        }
        return index !== statusIndex;
      });
      try {
        await api(`/api/participants/${participant.id}`, 'PATCH', { statuses: updated });
      } catch (err) {
        notify(err.message);
      }
    });
  });

  cardForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newCard = buildCardFromForm(formData);
    try {
      await api(`/api/participants/${participant.id}`, 'PATCH', {
        cards: [...(participant.cards || []), newCard]
      });
      event.target.reset();
    } catch (err) {
      notify(err.message);
    }
  });

  panel.querySelectorAll('[data-remove-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const cardId = button.dataset.removeCard;
      const updated = (participant.cards || []).filter((card, index) => {
        if (card.id) {
          return card.id !== cardId;
        }
        return index !== Number(button.dataset.cardIndex);
      });
      try {
        await api(`/api/participants/${participant.id}`, 'PATCH', { cards: updated });
      } catch (err) {
        notify(err.message);
      }
    });
  });
}

function buildCardFromForm(formData) {
  const masteryRaw = formData.get('mastery') || '';
  const mastery = masteryRaw
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: formData.get('name'),
    set: formData.get('set') || '',
    type: formData.get('type') || 'Attack',
    tier: formData.get('tier') || 'Common',
    apCost: Number(formData.get('apCost') || 0),
    range: Number(formData.get('range') || 0),
    healthBonus: Number(formData.get('healthBonus') || 0),
    tags: (formData.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    effect: formData.get('effect') || '',
    mastery,
    fusion: formData.get('fusion') || '',
    setBonuses: (formData.get('setBonuses') || '').trim()
  };
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
        <h4>${card.name} <small>${card.tier || ''} ${card.type || ''}</small></h4>
        <p>Set: <strong>${card.set || '—'}</strong></p>
        <p>AP ${card.apCost || 0} · Range ${card.range || 0} ft · HP +${card.healthBonus || 0}</p>
        <p>Tags: ${(card.tags || []).join(', ') || '—'}</p>
        <p>${card.effect || ''}</p>
        ${card.mastery?.length ? `<p>Mastery: ${card.mastery.join(' / ')}</p>` : ''}
        ${card.fusion ? `<p>Fusion: ${card.fusion}</p>` : ''}
        ${card.setBonuses ? `<p>Set Bonuses: ${card.setBonuses}</p>` : ''}
        <button type="button" data-remove-card="${card.id || ''}" data-card-index="${index}">Remove Card</button>
      </article>`
    )
    .join('');
}

function renderLog() {
  const log = state.encounter.log || [];
  if (!log.length) {
    document.getElementById('logList').innerHTML = '<p class="empty-state">No actions logged yet.</p>';
    return;
  }
  document.getElementById('logList').innerHTML = log
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

function getSelectedParticipant() {
  return state.encounter.participants?.find((entry) => entry.id === selectedParticipantId) || null;
}

function getCurrentParticipant() {
  const index = state.encounter.currentIndex;
  if (index == null || index < 0) return null;
  return state.encounter.participants?.[index] ?? null;
}

function resolveSelectedId() {
  return selectedParticipantId || getCurrentParticipant()?.id || null;
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
