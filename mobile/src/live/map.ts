import type { Goal, Reward, RewardRequest, LedgerEntry } from '../demo';
import type { PersonId } from '../types';

export type ApiPair = { id: string; pairId: string; userId: string; slot: number; pair: { id: string; name: string; timezone: string }; members: { slot: number; user: { id: string; email: string } }[] };
export type ApiGoal = { id: string; title: string; description: string | null; ownerId: string; proposedById: string; status: 'PENDING' | 'ACTIVE' | 'REJECTED'; weekdays: number[]; requiredCount: number; weeklyTokens: number; startsOn: string | null; checkIns: { localDate: string }[] };
export type ApiReward = { id: string; title: string; description: string | null; offeredById: string; fulfillmentExpectation: string; cost: number; status: 'PENDING' | 'ACTIVE' | 'REJECTED' };
export type ApiRedemption = { id: string; rewardId: string; spenderId: string; cost: number; status: 'REQUESTED' | 'FULFILLED'; createdAt: string; reward: ApiReward };
export type ApiLedger = { id: string; userId: string; amount: number; reason: string; sourceId: string; createdAt: string };

export function members(pair: ApiPair) {
  const byId = (id: string): PersonId => pair.members.find(member => member.user.id === id)?.slot === 2 ? 'jamie' : 'alex';
  const names = { alex: pair.members.find(member => member.slot === 1)?.user.email ?? '', jamie: pair.members.find(member => member.slot === 2)?.user.email ?? '' };
  return { byId, names };
}

export function mapGoal(goal: ApiGoal, byId: (id: string) => PersonId, today: string): Goal {
  return { id: goal.id, title: goal.title, description: goal.description ?? '', owner: byId(goal.ownerId), proposer: byId(goal.proposedById), type: 'recurring', days: goal.weekdays.map(day => day - 1), required: goal.requiredCount, tokens: goal.weeklyTokens,
    status: goal.status === 'PENDING' ? 'proposed' : goal.status === 'REJECTED' ? 'rejected' : goal.startsOn && goal.startsOn > today ? 'scheduled' : 'active',
    checks: goal.checkIns.map(check => check.localDate), startDate: goal.startsOn ?? '', glyph: 'leaf' };
}
export function mapReward(reward: ApiReward, byId: (id: string) => PersonId): Reward {
  return { id: reward.id, title: reward.title, description: reward.description ?? '', offerer: byId(reward.offeredById), expectation: reward.fulfillmentExpectation, cost: reward.cost,
    status: reward.status === 'PENDING' ? 'proposed' : reward.status === 'REJECTED' ? 'rejected' : 'active', glyph: 'leaf' };
}
export function mapRequest(item: ApiRedemption, byId: (id: string) => PersonId, timezone = 'UTC'): RewardRequest {
  return { id: item.id, rewardId: item.rewardId, member: byId(item.spenderId), offerer: byId(item.reward.offeredById), title: item.reward.title, cost: item.cost, expectation: item.reward.fulfillmentExpectation, status: item.status === 'FULFILLED' ? 'fulfilled' : 'requested', date: new Date(item.createdAt).toLocaleDateString('en-US', { timeZone: timezone }) };
}
export function mapLedger(item: ApiLedger, requests: RewardRequest[], person: PersonId, timezone = 'UTC'): LedgerEntry {
  const request = requests.find(value => value.id === item.sourceId);
  return { id: item.id, member: person, amount: item.amount, title: request?.title ?? (item.amount > 0 ? 'Weekly goal award' : 'Reward redemption'), detail: item.reason === 'WEEKLY_AWARD' ? 'Closed week award' : 'Approved reward cost', date: new Date(item.createdAt).toLocaleDateString('en-US', { timeZone: timezone }), source: item.sourceId, type: item.amount > 0 ? 'award' : 'reward' };
}
