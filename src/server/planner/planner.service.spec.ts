import { PlannerService } from './planner.service';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';

describe('personal planner and scoped token markets', () => {
  let db: any, service: PlannerService, task: any, completion: any;
  let now: Date;
  const group = { scopeKind: 'GROUP' as const, scopeId: 'group-one' };
  const pair = { scopeKind: 'PAIR' as const, scopeId: 'pair-one' };
  const members = [{ userId: 'alice', user: { email: 'alice@example.test' } }, { userId: 'bob', user: { email: 'bob@example.test' } }];
  beforeEach(() => {
    now = new Date('2026-10-23T18:00:00Z'); completion = null;
    task = { id: 'task', userId: 'alice', title: 'Read', notes: 'Private note', kind: 'TODO', timezone: 'Asia/Kolkata', weekdays: [1,2,3,4,5,6,7], target: 1, progress: 0, dueOn: null, archived: false };
    db = {
      personalTask: { findUnique: jest.fn(async () => ({...task})), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(async ({data}:any) => { Object.assign(task,data); return task; }) },
      taskCompletion: {
        findUnique: jest.fn(async ({where}:any) => completion?.period === where.taskId_period.period ? completion : null),
        create: jest.fn(async ({data}:any) => { completion = { id: 'completion', ...data, awards: [] }; return completion; }),
        delete: jest.fn(async () => { completion = null; }),
      },
      taskTokenProposal: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
      taskAward: { create: jest.fn(async ({data}:any) => { const award={ id:'award', ...data }; completion?.awards.push(award); return award; }) },
      membership: { findMany: jest.fn().mockResolvedValue(members) }, circleMember: { findMany: jest.fn().mockResolvedValue(members) },
      ledgerEntry: { aggregate: jest.fn().mockResolvedValue({_sum:{amount:100}}), create: jest.fn() },
      circleTokenEntry: { aggregate: jest.fn().mockResolvedValue({_sum:{amount:10}}), create: jest.fn() },
      spaceReward: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      spaceRedemption: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({data}:any)=>({id:'redemption',...data})), update: jest.fn() },
    };
    db.runInTransaction = (action:any) => action(db);
    service = new PlannerService(db, { now: () => now });
  });
  it('creates private tasks without looking for partner or group membership', async () => {
    await service.createTask('alice', task);
    expect(db.personalTask.create).toHaveBeenCalledWith({data:{...task,userId:'alice'}});
    expect(db.membership.findMany).not.toHaveBeenCalled();
    expect(db.circleMember.findMany).not.toHaveBeenCalled();
  });
  it('lists only the current accountâ€™s tasks', async () => {
    await service.tasks('alice');
    expect(db.personalTask.findMany.mock.calls[0][0].where).toEqual({userId:'alice'});
  });
  it('prevents another account from completing, editing, archiving, or submitting a task', async () => {
    await expect(service.completeTask('bob','task',{completed:true})).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.editTask('bob','task',task)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.archiveTask('bob','task',true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.propose('bob','task',group,5)).rejects.toBeInstanceOf(NotFoundError);
    expect(db.personalTask.update).not.toHaveBeenCalled();
  });
  it('completes an ordinary task without approvals and lets the owner undo it', async () => {
    expect(await service.completeTask('alice','task',{completed:true})).toMatchObject({completed:true,earned:0});
    await service.completeTask('alice','task',{completed:false});
    expect(db.taskCompletion.delete).toHaveBeenCalledTimes(1);
    expect(db.circleTokenEntry.create).not.toHaveBeenCalled();
  });
  it('awards an approved completion only once and uses the group ledger', async () => {
    db.taskTokenProposal.findMany.mockResolvedValue([{id:'proposal',...group,tokens:5}]);
    expect(await service.completeTask('alice','task',{completed:true})).toMatchObject({earned:5});
    expect(await service.completeTask('alice','task',{completed:true})).toMatchObject({earned:0});
    expect(db.circleTokenEntry.create).toHaveBeenCalledTimes(1);
    expect(db.circleTokenEntry.create.mock.calls[0][0].data).toMatchObject({circleId:'group-one',userId:'alice',amount:5,reason:'TASK_AWARD'});
    expect(db.ledgerEntry.create).not.toHaveBeenCalled();
    await expect(service.completeTask('alice','task',{completed:false})).rejects.toBeInstanceOf(ConflictError);
  });
  it('keeps partner awards in the existing pair wallet', async () => {
    db.taskTokenProposal.findMany.mockResolvedValue([{id:'proposal',...pair,tokens:3}]);
    await service.completeTask('alice','task',{completed:true});
    expect(db.ledgerEntry.create.mock.calls[0][0].data).toMatchObject({pairId:'pair-one',amount:3,reason:'TASK_AWARD'});
    expect(db.circleTokenEntry.create).not.toHaveBeenCalled();
  });
  it('does not retroactively award a completed task when a request is later approved', async () => {
    await service.completeTask('alice','task',{completed:true});
    db.taskTokenProposal.findMany.mockResolvedValue([{id:'proposal',...group,tokens:5}]);
    await service.completeTask('alice','task',{completed:true});
    expect(db.taskAward.create).not.toHaveBeenCalled();
    db.taskTokenProposal.findUnique.mockResolvedValue({id:'proposal',...group,status:'PENDING',task:{...task}});
    await expect(service.decideProposal('bob','proposal',true)).rejects.toBeInstanceOf(ConflictError);
  });
  it('uses each Dailyâ€™s timezone and creates a new period after midnight', async () => {
    task.kind='DAILY';
    await service.completeTask('alice','task',{completed:true});
    expect(completion.period).toBe('2026-10-23');
    now=new Date('2026-10-23T19:00:00Z');
    await service.completeTask('alice','task',{completed:true});
    expect(completion.period).toBe('2026-10-24');
    expect(db.taskCompletion.create).toHaveBeenCalledTimes(2);
  });
  it('rejects unscheduled Daily check-ins and incorrect completion modes', async () => {
    task.kind='DAILY';task.weekdays=[1];
    await expect(service.completeTask('alice','task',{completed:true})).rejects.toBeInstanceOf(ConflictError);
    task.kind='GOAL';
    await expect(service.completeTask('alice','task',{completed:true})).rejects.toBeInstanceOf(BadRequestError);
  });
  it('awards a Goal only when the target is reached and bounds progress', async () => {
    task.kind='GOAL';task.target=2;
    db.taskTokenProposal.findMany.mockResolvedValue([{id:'proposal',...group,tokens:8}]);
    expect(await service.completeTask('alice','task',{delta:1})).toMatchObject({completed:false,earned:0});
    expect(await service.completeTask('alice','task',{delta:1})).toMatchObject({completed:true,earned:8});
    await expect(service.completeTask('alice','task',{delta:1})).rejects.toBeInstanceOf(BadRequestError);
    expect(db.taskAward.create).toHaveBeenCalledTimes(1);
  });
  it('rejects outsider access and locks markets until there are two members', async () => {
    await expect(service.market('outsider',group)).rejects.toBeInstanceOf(ForbiddenError);
    db.circleMember.findMany.mockResolvedValue([members[0]]);
    await expect(service.market('alice',group)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.propose('alice','task',group,5)).rejects.toBeInstanceOf(ConflictError);
    db.membership.findMany.mockResolvedValue([members[0]]);
    await expect(service.market('alice',pair)).rejects.toBeInstanceOf(ConflictError);
  });
  it('requires a different member to approve tokens and rewards', async () => {
    db.taskTokenProposal.findUnique.mockResolvedValue({id:'proposal',...group,status:'PENDING',task});
    await expect(service.decideProposal('alice','proposal',true)).rejects.toBeInstanceOf(ForbiddenError);
    await service.decideProposal('bob','proposal',true);
    expect(db.taskTokenProposal.update.mock.calls[0][0].data).toMatchObject({status:'ACTIVE',approvedById:'bob',approvedAt:now});
    db.spaceReward.findUnique.mockResolvedValue({id:'reward',...group,offeredById:'alice',status:'PENDING'});
    await expect(service.decideReward('alice','reward',true)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('requires reapproval after task terms change but keeps private notes out of that requirement', async () => {
    await service.editTask('alice','task',{...task,notes:'A new private note'});
    expect(db.taskTokenProposal.updateMany).not.toHaveBeenCalled();
    await service.editTask('alice','task',{...task,title:'Different work'});
    expect(db.taskTokenProposal.updateMany).toHaveBeenCalledWith({where:{taskId:'task'},data:{status:'PENDING',approvedById:null,approvedAt:null}});
  });
  it('does not let Group 1 spending borrow the Partner or Group 2 balance', async () => {
    db.spaceReward.findUnique.mockResolvedValue({id:'reward',...group,offeredById:'bob',status:'ACTIVE',cost:15});
    await expect(service.redeem('alice','reward','request-key')).rejects.toBeInstanceOf(ConflictError);
    expect(db.circleTokenEntry.aggregate.mock.calls[0][0].where).toEqual({circleId:'group-one',userId:'alice'});
    expect(db.ledgerEntry.aggregate).not.toHaveBeenCalled();
    expect(db.spaceRedemption.create).not.toHaveBeenCalled();
  });
  it('redeems exactly once for a retry key and debits only the selected group', async () => {
    db.spaceReward.findUnique.mockResolvedValue({id:'reward',...group,offeredById:'bob',status:'ACTIVE',cost:5});
    const result=await service.redeem('alice','reward','request-key');
    db.spaceRedemption.findUnique.mockResolvedValue(result);
    expect(await service.redeem('alice','reward','request-key')).toEqual(result);
    expect(db.spaceRedemption.create).toHaveBeenCalledTimes(1);
    expect(db.circleTokenEntry.create).toHaveBeenCalledTimes(1);
    expect(db.circleTokenEntry.create.mock.calls[0][0].data).toMatchObject({circleId:'group-one',amount:-5,reason:'REWARD_REDEMPTION'});
    expect(db.ledgerEntry.create).not.toHaveBeenCalled();
  });
  it('rejects own offers, unapproved rewards, and reused keys for another reward', async () => {
    db.spaceReward.findUnique.mockResolvedValue({id:'reward',...group,offeredById:'alice',status:'ACTIVE',cost:5});
    await expect(service.redeem('alice','reward','request-key')).rejects.toBeInstanceOf(ForbiddenError);
    db.spaceReward.findUnique.mockResolvedValue({id:'reward',...group,offeredById:'bob',status:'PENDING',cost:5});
    await expect(service.redeem('alice','reward','request-key')).rejects.toBeInstanceOf(ConflictError);
    db.spaceRedemption.findUnique.mockResolvedValue({id:'redemption',rewardId:'other'});
    await expect(service.redeem('alice','reward','request-key')).rejects.toBeInstanceOf(ConflictError);
  });
  it('lets only the offerer fulfill a redeemed reward', async () => {
    db.spaceRedemption.findUnique.mockResolvedValue({id:'redemption',reward:{...group,offeredById:'bob'}});
    await expect(service.fulfill('alice','redemption')).rejects.toBeInstanceOf(ForbiddenError);
    await service.fulfill('bob','redemption');
    expect(db.spaceRedemption.update).toHaveBeenCalledWith({where:{id:'redemption'},data:{status:'FULFILLED',fulfilledAt:now}});
  });
  it('keeps a completed Goal’s target fixed', async () => {
    task.kind='GOAL';
    await service.completeTask('alice','task',{delta:1});
    await expect(service.editTask('alice','task',{...task,target:2})).rejects.toBeInstanceOf(ConflictError);
  });

});
