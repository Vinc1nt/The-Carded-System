import { createServer } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const STANDARD_ACTIONS = {
  move: {
    id: 'move',
    label: 'Move',
    summary: '1 AP → 10 ft (2 squares)',
    apCost: 1,
    detail: 'Standard movement at full speed.',
    logText: 'moves 10 ft.'
  },
  move_difficult: {
    id: 'move_difficult',
    label: 'Move (Difficult Terrain)',
    summary: '1 AP → 5 ft (1 square)',
    apCost: 1,
    detail: 'Movement through difficult terrain or crawling.',
    logText: 'pushes through difficult terrain (5 ft).'
  },
  disengage: {
    id: 'disengage',
    label: 'Disengage',
    summary: '2 AP: Your movement this turn avoids OAs.',
    apCost: 2,
    logText: 'disengages to avoid opportunity attacks.'
  },
  slip: {
    id: 'slip',
    label: 'Slip',
    summary: '1 AP: Move 5 ft without triggering OAs.',
    apCost: 1,
    logText: 'slips 5 ft without provoking.'
  },
  interact: {
    id: 'interact',
    label: 'Interact/Use',
    summary: 'Usually 1 AP per GM.',
    apCost: 1,
    logText: 'takes an interact/use action.'
  },
  guard: {
    id: 'guard',
    label: 'Guard',
    summary: '2 AP → Restore 3 Shield (once/turn).',
    apCost: 2,
    shieldRestore: 3,
    logText: 'guards and restores shield.'
  },
  manual_swap: {
    id: 'manual_swap',
    label: 'Manual Swap',
    summary: '2 AP: Swap cards, new card readies next turn.',
    apCost: 2,
    logText: 'performs a manual card swap.'
  }
};

const trackerState = {
  encounter: {
    name: 'Untitled Encounter',
    round: 1,
    started: false,
    participants: [],
    currentIndex: -1,
    log: []
  },
  reference: {
    standardActions: Object.values(STANDARD_ACTIONS)
  },
  updatedAt: new Date().toISOString()
};

const sseClients = new Map();

const server = createServer(async (req, res) => {
  const { method, url: reqUrl } = req;
  const requestUrl = new URL(reqUrl, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname === '/events') {
    handleSse(req, res);
    return;
  }

  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname, method);
    return;
  }

  await handleStatic(res, pathname);
});

server.listen(PORT, () => {
  console.log(`Carded turn tracker running at http://localhost:${PORT}`);
});

async function handleApi(req, res, pathname, method) {
  try {
    if (method === 'GET' && pathname === '/api/state') {
      return sendJson(res, { state: trackerState });
    }

    if (method === 'POST' && pathname === '/api/participants') {
      const body = await readBody(req);
      const participant = createParticipant(body);
      trackerState.encounter.participants.push(participant);
      sortParticipants();
      ensureCurrentIndex();
      pushLog(`${participant.name} joins the encounter.`);
      touchState();
      broadcastState('participant_added');
      return sendJson(res, { participant });
    }

    if (pathname.startsWith('/api/participants/')) {
      const [, , , participantId, subresource] = pathname.split('/');
      const participant = findParticipant(participantId);

      if (!participant) {
        return sendJson(res, { error: 'Participant not found' }, 404);
      }

      if (method === 'PATCH' && !subresource) {
        const body = await readBody(req);
        Object.assign(participant, sanitizeParticipantUpdate(body, participant));
        clampParticipant(participant);
        sortParticipants();
        touchState();
        broadcastState('participant_updated');
        return sendJson(res, { participant });
      }

      if (method === 'DELETE' && !subresource) {
        trackerState.encounter.participants = trackerState.encounter.participants.filter(
          (member) => member.id !== participantId
        );
        fixCurrentIndexAfterRemoval();
        pushLog(`${participant.name} is removed from the encounter.`);
        touchState();
        broadcastState('participant_removed');
        return sendJson(res, { ok: true });
      }

      if (method === 'POST' && subresource === 'adjust') {
        const body = await readBody(req);
        applyAdjustment(participant, body);
        touchState();
        broadcastState('participant_adjusted');
        return sendJson(res, { participant });
      }
    }

    if (method === 'POST' && pathname === '/api/turn/next') {
      advanceTurn(1);
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/turn/previous') {
      advanceTurn(-1);
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/turn/start') {
      const body = await readBody(req);
      startEncounter(body?.startingRound);
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/actions/standard') {
      const body = await readBody(req);
      const result = executeStandardAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/actions/custom') {
      const body = await readBody(req);
      const participant = resolveActor(body.actorId);
      const text = body.text?.trim();
      if (!text) {
        return sendJson(res, { error: 'Missing text' }, 400);
      }
      pushLog(text, participant?.id || null);
      touchState();
      broadcastState('custom_action');
      return sendJson(res, { ok: true });
    }

    if (method === 'POST' && pathname === '/api/rest/short') {
      const body = await readBody(req);
      const participant = resolveActor(body.participantId);
      if (!participant) {
        return sendJson(res, { error: 'Participant required' }, 400);
      }
      const healAmount = 5 + (participant.stats.con ?? 0);
      participant.hp = Math.min(participant.maxHp, participant.hp + healAmount);
      removeMinorStatus(participant);
      pushLog(`${participant.name} completes a short rest and heals ${healAmount} HP.`);
      touchState();
      broadcastState('short_rest');
      return sendJson(res, { participant });
    }

    if (method === 'POST' && pathname === '/api/rest/long') {
      const body = await readBody(req);
      const participant = resolveActor(body.participantId);
      if (!participant) {
        return sendJson(res, { error: 'Participant required' }, 400);
      }
      participant.hp = participant.maxHp;
      participant.shield = participant.maxShield;
      participant.statuses = [];
      participant.apCurrent = participant.apMax;
      participant.guardUsedThisTurn = false;
      pushLog(`${participant.name} takes a long rest and is fully restored.`);
      touchState();
      broadcastState('long_rest');
      return sendJson(res, { participant });
    }

    return sendJson(res, { error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error', err);
    return sendJson(res, { error: 'Server error' }, 500);
  }
}

function startEncounter(startingRound = 1) {
  trackerState.encounter.round = Number(startingRound) || 1;
  trackerState.encounter.started = true;
  ensureCurrentIndex();
  const actor = getCurrentParticipant();
  if (actor) {
    resetTurn(actor);
    pushLog(`Encounter starts. ${actor.name} takes the first turn.`);
  }
  touchState();
  broadcastState('encounter_started');
}

function executeStandardAction(body) {
  const action = STANDARD_ACTIONS[body.actionId];
  if (!action) {
    return { error: 'Unknown action' };
  }
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  if (action.id === 'guard' && participant.guardUsedThisTurn) {
    return { error: 'Guard already used this turn' };
  }
  if (participant.apCurrent < action.apCost) {
    return { error: 'Not enough AP' };
  }
  participant.apCurrent = Math.max(0, participant.apCurrent - action.apCost);
  if (action.id === 'guard') {
    const before = participant.shield;
    participant.shield = Math.min(participant.maxShield, participant.shield + action.shieldRestore);
    participant.guardUsedThisTurn = true;
    pushLog(
      `${participant.name} guards (${before} → ${participant.shield} Shield).`,
      participant.id
    );
  } else {
    const text = `${participant.name} ${action.logText}`;
    pushLog(text, participant.id);
  }
  touchState();
  broadcastState('standard_action');
  return { participant, action };
}

function applyAdjustment(participant, adjustment) {
  const { hp, shield, ap, status, note } = adjustment;
  if (typeof hp === 'number') {
    participant.hp = clampNumber(hp, 0, participant.maxHp);
  }
  if (typeof shield === 'number') {
    participant.shield = clampNumber(shield, 0, participant.maxShield);
  }
  if (typeof ap === 'number') {
    participant.apCurrent = clampNumber(ap, 0, participant.apMax);
  }
  if (Array.isArray(status)) {
    participant.statuses = status;
  }
  if (typeof note === 'string') {
    participant.notes = note;
  }
  clampParticipant(participant);
}

function sanitizeParticipantUpdate(body, current) {
  const update = {};
  const numericFields = [
    'initiative',
    'apMax',
    'apCurrent',
    'hp',
    'maxHp',
    'shield',
    'maxShield',
    'mastery'
  ];
  for (const field of numericFields) {
    if (typeof body[field] === 'number') {
      update[field] = body[field];
    }
  }
  if (typeof body.name === 'string') update.name = body.name;
  if (typeof body.setFocus === 'string') update.setFocus = body.setFocus;
  if (typeof body.notes === 'string') update.notes = body.notes;
  if (Array.isArray(body.cards)) update.cards = body.cards;
  if (Array.isArray(body.tags)) update.tags = body.tags;
  if (Array.isArray(body.statuses)) update.statuses = body.statuses;
  if (body.stats && typeof body.stats === 'object') {
    update.stats = { ...current.stats, ...body.stats };
  }
  return update;
}

function createParticipant(body = {}) {
  const id = body.id || randomUUID();
  const apMax = typeof body.apMax === 'number' ? body.apMax : 6;
  const maxHp = typeof body.maxHp === 'number' ? body.maxHp : 20;
  const maxShield = typeof body.maxShield === 'number' ? body.maxShield : 0;
  return {
    id,
    name: body.name?.trim() || `Combatant ${trackerState.encounter.participants.length + 1}`,
    initiative: typeof body.initiative === 'number' ? body.initiative : 0,
    apMax,
    apCurrent: typeof body.apCurrent === 'number' ? body.apCurrent : apMax,
    hp: typeof body.hp === 'number' ? body.hp : maxHp,
    maxHp,
    shield: typeof body.shield === 'number' ? body.shield : maxShield,
    maxShield,
    mastery: typeof body.mastery === 'number' ? body.mastery : 1,
    cards: Array.isArray(body.cards) ? body.cards : [],
    tags: Array.isArray(body.tags) ? body.tags : [],
    statuses: Array.isArray(body.statuses) ? body.statuses : [],
    notes: body.notes || '',
    setFocus: body.setFocus || '',
    stats: {
      strength: 0,
      dexterity: 0,
      constitution: 0,
      intelligence: 0,
      wisdom: 0,
      charisma: 0,
      ...(body.stats || {})
    },
    guardUsedThisTurn: false
  };
}

function sortParticipants() {
  trackerState.encounter.participants.sort((a, b) => {
    if (b.initiative === a.initiative) {
      return a.name.localeCompare(b.name);
    }
    return b.initiative - a.initiative;
  });
}

function ensureCurrentIndex() {
  if (trackerState.encounter.currentIndex === -1 && trackerState.encounter.participants.length > 0) {
    trackerState.encounter.currentIndex = 0;
  }
}

function fixCurrentIndexAfterRemoval() {
  const list = trackerState.encounter.participants;
  if (!list.length) {
    trackerState.encounter.currentIndex = -1;
    return;
  }
  trackerState.encounter.currentIndex = trackerState.encounter.currentIndex % list.length;
}

function advanceTurn(direction = 1) {
  const list = trackerState.encounter.participants;
  if (!list.length) return;
  const previousIndex = trackerState.encounter.currentIndex;
  if (previousIndex === -1) {
    trackerState.encounter.currentIndex = 0;
  } else {
    trackerState.encounter.currentIndex =
      (previousIndex + direction + list.length) % list.length;
  }
  if (
    direction > 0 &&
    trackerState.encounter.currentIndex === 0 &&
    previousIndex !== -1
  ) {
    trackerState.encounter.round += 1;
  }
  const actor = getCurrentParticipant();
  if (actor) {
    resetTurn(actor);
    pushLog(`It is now ${actor.name}'s turn (AP ${actor.apCurrent}).`, actor.id);
  }
  touchState();
  broadcastState('turn_advanced');
}

function resetTurn(participant) {
  participant.apCurrent = participant.apMax;
  participant.guardUsedThisTurn = false;
}

function clampParticipant(participant) {
  participant.apCurrent = clampNumber(participant.apCurrent, 0, participant.apMax);
  participant.hp = clampNumber(participant.hp, 0, participant.maxHp);
  participant.shield = clampNumber(participant.shield, 0, participant.maxShield);
}

function getCurrentParticipant() {
  const index = trackerState.encounter.currentIndex;
  if (index < 0) return null;
  return trackerState.encounter.participants[index] || null;
}

function findParticipant(id) {
  return trackerState.encounter.participants.find((entry) => entry.id === id);
}

function resolveActor(id) {
  if (id) {
    return findParticipant(id);
  }
  return getCurrentParticipant();
}

function pushLog(text, participantId = null, meta = {}) {
  const entry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    text,
    participantId,
    meta
  };
  trackerState.encounter.log.push(entry);
  if (trackerState.encounter.log.length > 200) {
    trackerState.encounter.log.shift();
  }
}

function removeMinorStatus(participant) {
  const idx = participant.statuses.findIndex((status) => status.severity === 'minor');
  if (idx !== -1) {
    participant.statuses.splice(idx, 1);
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (err) {
    return {};
  }
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleStatic(res, pathname) {
  let requestedPath = pathname === '/' ? '/index.html' : pathname;
  if (requestedPath === '/player') {
    requestedPath = '/player.html';
  }
  const normalized = path
    .normalize(requestedPath)
    .replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': type });
    res.end(file);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function handleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache'
  });

  const clientId = randomUUID();
  sseClients.set(clientId, res);
  res.write(`data: ${JSON.stringify({ type: 'state', state: trackerState })}\n\n`);

  const keepAlive = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(keepAlive);
      return;
    }
    res.write('event: ping\n');
    res.write('data: {}\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(clientId);
  });
}

function broadcastState(reason) {
  trackerState.updatedAt = new Date().toISOString();
  const payload = `data: ${JSON.stringify({ type: 'state', state: trackerState, reason })}\n\n`;
  for (const [, client] of sseClients) {
    client.write(payload);
  }
}

function touchState() {
  trackerState.updatedAt = new Date().toISOString();
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
