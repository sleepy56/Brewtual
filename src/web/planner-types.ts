export type PlannerSpace = {
  scopeKind: 'PAIR' | 'GROUP'; scopeId: string; name: string;
  members: { userId: string; user: { email: string } }[];
  connected: boolean; balance: number;
};
export type PersonalTask = {
  id: string; userId: string; title: string; notes: string;
  kind: 'TODO' | 'DAILY' | 'GOAL'; timezone: string; weekdays: number[];
  dueOn: string | null; target: number; progress: number; archived: boolean;
  today: string; dueToday: boolean; completed: boolean; rewarded: boolean;
  proposals: { id: string; scopeKind: 'PAIR' | 'GROUP'; scopeId: string; tokens: number; status: 'PENDING' | 'ACTIVE' | 'REJECTED' }[];
};
export type MarketReward = {
  id: string; title: string; expectation: string; cost: number;
  offeredById: string; status: 'PENDING' | 'ACTIVE' | 'REJECTED';
};
export type MarketData = {
  balance: number; members: PlannerSpace['members'];
  proposals: { id: string; tokens: number; status: 'PENDING' | 'ACTIVE' | 'REJECTED'; approvedById: string | null;
    task: Pick<PersonalTask, 'id' | 'title' | 'kind' | 'userId' | 'progress' | 'target' | 'weekdays' | 'dueOn'> }[];
  rewards: MarketReward[];
  redemptions: { id: string; spenderId: string; status: 'REQUESTED' | 'FULFILLED'; cost: number; reward: MarketReward }[];
  ledger: { id: string; amount: number; reason: string; createdAt: string }[];
};
