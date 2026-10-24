import { Prisma, LedgerReason } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import type { Clock } from '../domain/clock';
import { localDate, localWeekday } from '../domain/calendar';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import type { CreatePersonalTask, EditPersonalTask, Space } from '../schemas';

type Tx = Prisma.TransactionClient;
const scopeWhere = (space: Space) => ({ scopeKind: space.scopeKind, scopeId: space.scopeId });

export class PlannerService {
  constructor(private db: PrismaService, private clock: Clock) {}

  private async idempotentWrite<T>(action: (tx: Tx) => Promise<T>): Promise<T> {
    try { return await this.db.runInTransaction(action); }
    catch (error) {
      // A simultaneous retry can lose the unique-key race after reading no row.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return this.db.runInTransaction(action);
      throw error;
    }
  }

  async members(tx: Tx, userId: string, space: Space, connected = true) {
    const members = space.scopeKind === 'PAIR'
      ? await tx.membership.findMany({ where: { pairId: space.scopeId }, select: { userId: true, user: { select: { email: true } } } })
      : await tx.circleMember.findMany({ where: { circleId: space.scopeId }, select: { userId: true, user: { select: { email: true } } } });
    if (!members.some(member => member.userId === userId)) throw new ForbiddenError('You are not a member of this space.');
    if (connected && members.length < 2) throw new ConflictError('Connect at least one other person to unlock this market.');
    return members;
  }

  async balance(tx: Tx, userId: string, space: Space) {
    const aggregate = space.scopeKind === 'PAIR'
      ? await tx.ledgerEntry.aggregate({ where: { pairId: space.scopeId, userId }, _sum: { amount: true } })
      : await tx.circleTokenEntry.aggregate({ where: { circleId: space.scopeId, userId }, _sum: { amount: true } });
    return aggregate._sum.amount ?? 0;
  }

  async credit(tx: Tx, userId: string, space: Space, amount: number, reason: LedgerReason, sourceId: string, key: string) {
    const data = { userId, amount, reason, sourceId, idempotencyKey: key };
    if (space.scopeKind === 'PAIR') return tx.ledgerEntry.create({ data: { ...data, pairId: space.scopeId } });
    return tx.circleTokenEntry.create({ data: { ...data, circleId: space.scopeId } });
  }

  async spaces(userId: string) {
    const [pair, circles] = await Promise.all([
      this.db.membership.findUnique({ where: { userId }, include: { pair: { include: { memberships: { select: { userId: true, user: { select: { email: true } } } } } } } }),
      this.db.circle.findMany({ where: { members: { some: { userId } } }, include: { members: { select: { userId: true, user: { select: { email: true } } } } }, orderBy: { createdAt: 'asc' } }),
    ]);
    const all = [
      ...(pair ? [{ scopeKind: 'PAIR' as const, scopeId: pair.pairId, name: pair.pair.name, members: pair.pair.memberships }] : []),
      ...circles.map(circle => ({ scopeKind: 'GROUP' as const, scopeId: circle.id, name: circle.name, members: circle.members })),
    ];
    return Promise.all(all.map(async space => ({ ...space, connected: space.members.length >= 2, balance: await this.balance(this.db, userId, space) })));
  }

  async tasks(userId: string) {
    const tasks = await this.db.personalTask.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' },
      include: {
        completions: { orderBy: { createdAt: 'desc' }, take: 14, include: { _count: { select: { awards: true } } } },
        proposals: true,
      },
    });
    return tasks.map(task => {
      const today = localDate(this.clock.now(), task.timezone);
      const period = task.kind === 'DAILY' ? today : 'once';
      const completion = task.completions.find(item => item.period === period);
      return { ...task, today, dueToday: task.kind !== 'DAILY' || task.weekdays.includes(localWeekday(today)), completed: !!completion, rewarded: !!completion?._count.awards };
    });
  }

  async createTask(userId: string, data: CreatePersonalTask) {
    return this.db.personalTask.create({ data: { ...data, userId } });
  }

  async ownedTask(tx: Tx, userId: string, id: string) {
    const task = await tx.personalTask.findUnique({ where: { id } });
    if (!task || task.userId !== userId) throw new NotFoundError('Task not found.');
    return task;
  }

  async editTask(userId: string, id: string, data: EditPersonalTask) {
    return this.db.runInTransaction(async tx => {
      const task = await this.ownedTask(tx, userId, id);
      if ((task.kind !== 'GOAL' && data.target !== 1) || data.target < task.progress) throw new BadRequestError('The target must cover your current progress.');
      if (task.kind === 'GOAL' && data.target !== task.target && await tx.taskCompletion.findUnique({ where: { taskId_period: { taskId: id, period: 'once' } } })) {
        throw new ConflictError('A completed goal keeps its original target. Create a new goal for the next milestone.');
      }
      // Notes remain private; changes to the agreed work need fresh approval.
      if (task.title !== data.title || task.target !== data.target || task.weekdays.join(',') !== data.weekdays.join(',') || task.dueOn !== data.dueOn) {
        await tx.taskTokenProposal.updateMany({ where: { taskId: id }, data: { status: 'PENDING', approvedById: null, approvedAt: null } });
      }
      return tx.personalTask.update({ where: { id }, data });
    });
  }

  async archiveTask(userId: string, id: string, archived: boolean) {
    await this.ownedTask(this.db, userId, id);
    return this.db.personalTask.update({ where: { id }, data: { archived } });
  }

  async completeTask(userId: string, id: string, change: { completed: boolean } | { delta: number }) {
    return this.idempotentWrite(async tx => {
      const task = await this.ownedTask(tx, userId, id);
      if (task.archived) throw new ConflictError('Restore this task before updating it.');
      const today = localDate(this.clock.now(), task.timezone);
      const period = task.kind === 'DAILY' ? today : 'once';
      if (task.kind === 'DAILY' && !task.weekdays.includes(localWeekday(today))) throw new ConflictError('This Daily is not scheduled for today.');
      if ((task.kind === 'GOAL') !== ('delta' in change)) throw new BadRequestError('Use steps for Goals and checkboxes for tasks and Dailies.');
      const progress = 'delta' in change ? task.progress + change.delta : change.completed ? 1 : 0;
      if (progress < 0 || progress > task.target) throw new BadRequestError('Progress must stay between zero and the target.');
      const existing = await tx.taskCompletion.findUnique({ where: { taskId_period: { taskId: id, period } }, include: { awards: true } });
      const complete = progress === task.target;
      if (!complete && existing) {
        if (existing.awards.length) throw new ConflictError('This completion earned tokens and is final.');
        await tx.taskCompletion.delete({ where: { id: existing.id } });
      }
      await tx.personalTask.update({ where: { id }, data: { progress: task.kind === 'DAILY' ? 0 : progress } });
      if (!complete || existing) return { completed: complete, progress, earned: 0 };
      const completion = await tx.taskCompletion.create({ data: { taskId: id, period, createdAt: this.clock.now() } });
      const proposals = await tx.taskTokenProposal.findMany({ where: { taskId: id, status: 'ACTIVE', approvedAt: { lte: this.clock.now() } } });
      let earned = 0;
      for (const proposal of proposals) {
        // Only current membership with another person can back a completion.
        try { await this.members(tx, userId, proposal); }
        catch (error) { if (error instanceof ForbiddenError || error instanceof ConflictError) continue; throw error; }
        const award = await tx.taskAward.create({ data: { completionId: completion.id, proposalId: proposal.id, tokens: proposal.tokens } });
        await this.credit(tx, userId, proposal, proposal.tokens, 'TASK_AWARD', award.id, `task:${completion.id}:${proposal.id}`);
        earned += proposal.tokens;
      }
      return { completed: true, progress, earned };
    });
  }

  async propose(userId: string, taskId: string, space: Space, tokens: number) {
    return this.db.runInTransaction(async tx => {
      await this.members(tx, userId, space);
      const task = await this.ownedTask(tx, userId, taskId);
      if (task.archived || (task.kind !== 'DAILY' && task.progress >= task.target)) throw new ConflictError('Request tokens before completing this task.');
      const existing = await tx.taskTokenProposal.findUnique({ where: { taskId_scopeKind_scopeId: { taskId, ...scopeWhere(space) } } });
      if (existing && existing.status !== 'REJECTED') throw new ConflictError('This task already has a request in that space.');
      return tx.taskTokenProposal.upsert({
        where: { taskId_scopeKind_scopeId: { taskId, ...scopeWhere(space) } },
        create: { taskId, ...scopeWhere(space), tokens },
        update: { tokens, status: 'PENDING', approvedById: null, approvedAt: null },
      });
    });
  }

  async decideProposal(userId: string, id: string, approve: boolean) {
    return this.db.runInTransaction(async tx => {
      const proposal = await tx.taskTokenProposal.findUnique({ where: { id }, include: { task: true } });
      if (!proposal) throw new NotFoundError('Request not found.');
      await this.members(tx, userId, proposal);
      if (proposal.task.userId === userId) throw new ForbiddenError('Another member must approve your tokens.');
      if (proposal.status !== 'PENDING' || proposal.task.archived) throw new ConflictError('This request is no longer pending.');
      if (approve && proposal.task.kind !== 'DAILY' && proposal.task.progress >= proposal.task.target) throw new ConflictError('Already-completed work cannot earn tokens retroactively.');
      return tx.taskTokenProposal.update({ where: { id }, data: { status: approve ? 'ACTIVE' : 'REJECTED', approvedById: userId, approvedAt: approve ? this.clock.now() : null } });
    });
  }

  async market(userId: string, space: Space) {
    const members = await this.members(this.db, userId, space);
    const [balance, proposals, rewards, redemptions, ledger] = await Promise.all([
      this.balance(this.db, userId, space),
      this.db.taskTokenProposal.findMany({ where: { ...scopeWhere(space), task: { archived: false } }, include: { task: { select: { id: true, title: true, kind: true, userId: true, progress: true, target: true, weekdays: true, dueOn: true } } }, orderBy: { createdAt: 'desc' } }),
      this.db.spaceReward.findMany({ where: scopeWhere(space), orderBy: { createdAt: 'desc' } }),
      this.db.spaceRedemption.findMany({ where: { reward: scopeWhere(space) }, include: { reward: true }, orderBy: { createdAt: 'desc' } }),
      space.scopeKind === 'PAIR'
        ? this.db.ledgerEntry.findMany({ where: { pairId: space.scopeId, userId }, orderBy: { createdAt: 'desc' }, take: 30 })
        : this.db.circleTokenEntry.findMany({ where: { circleId: space.scopeId, userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    return { members, balance, proposals, rewards, redemptions, ledger };
  }

  async offer(userId: string, data: Space & { title: string; expectation: string; cost: number }) {
    await this.members(this.db, userId, data);
    return this.db.spaceReward.create({ data: { ...data, offeredById: userId } });
  }

  async decideReward(userId: string, id: string, approve: boolean) {
    return this.db.runInTransaction(async tx => {
      const reward = await tx.spaceReward.findUnique({ where: { id } });
      if (!reward) throw new NotFoundError('Reward not found.');
      await this.members(tx, userId, reward);
      if (reward.offeredById === userId) throw new ForbiddenError('Another member must approve your offer.');
      if (reward.status !== 'PENDING') throw new ConflictError('This offer has already been reviewed.');
      return tx.spaceReward.update({ where: { id }, data: { status: approve ? 'ACTIVE' : 'REJECTED', approvedById: userId } });
    });
  }

  async redeem(userId: string, id: string, key: string) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key)) throw new BadRequestError('A valid idempotency key is required.');
    return this.idempotentWrite(async tx => {
      const reward = await tx.spaceReward.findUnique({ where: { id } });
      if (!reward) throw new NotFoundError('Reward not found.');
      await this.members(tx, userId, reward);
      const existing = await tx.spaceRedemption.findUnique({ where: { spenderId_idempotencyKey: { spenderId: userId, idempotencyKey: key } } });
      if (existing) {
        if (existing.rewardId !== id) throw new ConflictError('This request key belongs to another reward.');
        return existing;
      }
      if (reward.status !== 'ACTIVE') throw new ConflictError('This reward has not been approved.');
      if (reward.offeredById === userId) throw new ForbiddenError('You cannot redeem your own offer.');
      if (await this.balance(tx, userId, reward) < reward.cost) throw new ConflictError('Not enough tokens in this space.');
      const redemption = await tx.spaceRedemption.create({ data: { rewardId: id, spenderId: userId, cost: reward.cost, idempotencyKey: key } });
      await this.credit(tx, userId, reward, -reward.cost, 'REWARD_REDEMPTION', redemption.id, `market:${redemption.id}`);
      return redemption;
    });
  }

  async fulfill(userId: string, id: string) {
    return this.db.runInTransaction(async tx => {
      const redemption = await tx.spaceRedemption.findUnique({ where: { id }, include: { reward: true } });
      if (!redemption) throw new NotFoundError('Plan not found.');
      await this.members(tx, userId, redemption.reward);
      if (redemption.reward.offeredById !== userId) throw new ForbiddenError('Only the person who offered this reward can mark it fulfilled.');
      return tx.spaceRedemption.update({ where: { id }, data: { status: 'FULFILLED', fulfilledAt: this.clock.now() } });
    });
  }
}
