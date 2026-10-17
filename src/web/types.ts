export type Pair = {
  pairId: string;
  pair: { id: string; name: string; timezone: string };
  members: { slot: number; user: { id: string; email: string } }[];
};
export type Goal = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  proposedById: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  weekdays: number[];
  requiredCount: number;
  weeklyTokens: number;
  startsOn: string | null;
  checkIns: { localDate: string }[];
};
export type Reward = {
  id: string;
  title: string;
  description: string | null;
  offeredById: string;
  fulfillmentExpectation: string;
  cost: number;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
};
export type Redemption = {
  id: string;
  rewardId: string;
  spenderId: string;
  cost: number;
  status: 'REQUESTED' | 'FULFILLED';
  createdAt: string;
  reward: Reward;
};
export type Ledger = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
  sourceId: string;
};
