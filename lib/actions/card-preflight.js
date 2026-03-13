export function resolveCardActionContext(body = {}, deps = {}) {
  const { resolveActor, isCardActive } = deps;
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const cardId = String(body.cardId || '').trim();
  if (!cardId) {
    return { error: 'cardId is required' };
  }
  const cardIndex = (participant.cards || []).findIndex((entry) => String(entry.id) === cardId);
  if (cardIndex === -1) {
    return { error: 'Card not found' };
  }
  const card = participant.cards[cardIndex];
  if (!isCardActive(card)) {
    return { error: 'Card is inactive. Activate it in loadout first.' };
  }
  return { participant, card, cardIndex };
}

