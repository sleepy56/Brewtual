import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PrismaService } from '../../src/server/database/prisma.service';
import { createServices } from '../../src/server/services';
import type { Services } from '../../src/server/services';

describe('personal planner with real PostgreSQL transactions', () => {
  const schema=`test_${randomUUID().replace(/-/g,'')}`;
  let db:PrismaService, admin:PrismaClient|undefined, services:Services;
  const alice={id:randomUUID(),email:`alice-${randomUUID()}@example.test`};
  const bob={id:randomUUID(),email:`bob-${randomUUID()}@example.test`};
  const carol={id:randomUUID(),email:`carol-${randomUUID()}@example.test`};
  const now=new Date('2026-10-23T10:00:00Z');
  beforeAll(async()=>{
    const connection=process.env.TEST_DATABASE_URL;
    if(!connection)throw new Error('Set TEST_DATABASE_URL to a disposable local PostgreSQL database.');
    if(!['localhost','127.0.0.1','[::1]'].includes(new URL(connection).hostname))throw new Error('Integration tests require local PostgreSQL, never a hosted database.');
    admin=new PrismaClient({datasourceUrl:connection});
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const scoped=new URL(connection);scoped.searchParams.set('schema',schema);
    const testEnv={...process.env,DATABASE_URL:scoped.toString(),DATABASE_URL_UNPOOLED:scoped.toString()};
    execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{env:testEnv,stdio:'pipe',timeout:30000});
    db=new PrismaService({datasourceUrl:scoped.toString()});
    services=createServices(db,{now:()=>now});
    await db.user.createMany({data:[alice,bob,carol]});
  },60000);
  afterAll(async()=>{
    await db?.$disconnect();
    if(admin){
      if(!/^test_[a-f0-9]{32}$/.test(schema))throw new Error('Unsafe test schema');
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  });
  it('plans alone, approves work, isolates three balances, and serializes token spending',async()=>{
    const planner=services.planner;
    const standalone=await planner.createTask(alice.id,{title:'A solo task',notes:'Private',kind:'TODO',timezone:'UTC',weekdays:[1,2,3,4,5,6,7],dueOn:null,target:1});
    expect((await planner.tasks(alice.id))[0].title).toBe('A solo task');
    await planner.completeTask(alice.id,standalone.id,{completed:true});
    expect((await planner.tasks(alice.id))[0].completed).toBe(true);
    expect(await planner.spaces(alice.id)).toEqual([]);
    await expect(planner.completeTask(bob.id,standalone.id,{completed:true})).rejects.toThrow('not found');

    const pairRecord=await services.pairs.createPair(alice,'Partners','UTC');
    const pair={scopeKind:'PAIR' as const,scopeId:pairRecord.id};
    await expect(planner.market(alice.id,pair)).rejects.toThrow('at least one other');
    const pairCode=await services.circles.code(alice.id,'partner',pair.scopeId);
    await services.circles.join(bob.id,pairCode.code);
    const first=await services.circles.create(alice.id,'Group 1');
    const firstCode=await services.circles.code(alice.id,'group',first.id);
    await services.circles.join(bob.id,firstCode.code);
    const second=await services.circles.create(alice.id,'Group 2');
    const secondCode=await services.circles.code(alice.id,'group',second.id);
    await services.circles.join(carol.id,secondCode.code);
    const group1={scopeKind:'GROUP' as const,scopeId:first.id},group2={scopeKind:'GROUP' as const,scopeId:second.id};
    const task=await planner.createTask(alice.id,{title:'Finish the chapter',notes:'Never shared',kind:'TODO',timezone:'UTC',weekdays:[1,2,3,4,5,6,7],dueOn:null,target:1});
    const proposals=await Promise.all([planner.propose(alice.id,task.id,pair,3),planner.propose(alice.id,task.id,group1,5),planner.propose(alice.id,task.id,group2,7)]);
    await expect(planner.decideProposal(alice.id,proposals[0].id,true)).rejects.toThrow('Another member');
    await planner.decideProposal(bob.id,proposals[0].id,true);
    await planner.decideProposal(bob.id,proposals[1].id,true);
    await planner.decideProposal(carol.id,proposals[2].id,true);
    await Promise.all([planner.completeTask(alice.id,task.id,{completed:true}),planner.completeTask(alice.id,task.id,{completed:true})]);
    expect(await db.taskAward.count({where:{proposalId:{in:proposals.map(p=>p.id)}}})).toBe(3);
    const balances=await planner.spaces(alice.id);
    expect(balances.find(s=>s.scopeId===pair.scopeId)?.balance).toBe(3);
    expect(balances.find(s=>s.scopeId===first.id)?.balance).toBe(5);
    expect(balances.find(s=>s.scopeId===second.id)?.balance).toBe(7);
    await expect(db.circleTokenEntry.updateMany({where:{circleId:first.id},data:{amount:99}})).rejects.toThrow('append-only');
    await expect(db.circleTokenEntry.create({data:{circleId:first.id,userId:alice.id,amount:-1,reason:'TASK_AWARD',sourceId:randomUUID(),idempotencyKey:randomUUID()}})).rejects.toThrow('CircleTokenEntry_amount_check');
    await expect(db.ledgerEntry.create({data:{pairId:pair.scopeId,userId:alice.id,amount:-1,reason:'TASK_AWARD',sourceId:randomUUID(),idempotencyKey:randomUUID()}})).rejects.toThrow('LedgerEntry_amount_check');
    await expect(planner.completeTask(alice.id,task.id,{completed:false})).rejects.toThrow('final');
    const market=await planner.market(bob.id,group1);
    expect(market.proposals[0].task).not.toHaveProperty('notes');
    await expect(planner.market(bob.id,group2)).rejects.toThrow('not a member');
    const reward=await planner.offer(bob.id,{...group1,title:'Coffee',expectation:'Treat you to a coffee',cost:4});
    await planner.decideReward(alice.id,reward.id,true);
    const attempts=await Promise.allSettled([planner.redeem(alice.id,reward.id,'first-request'),planner.redeem(alice.id,reward.id,'other-request')]);
    expect(attempts.filter(a=>a.status==='fulfilled')).toHaveLength(1);
    expect(await db.circleTokenEntry.count({where:{circleId:first.id,userId:alice.id,reason:'REWARD_REDEMPTION'}})).toBe(1);
    const redemption=await db.spaceRedemption.findFirstOrThrow({where:{rewardId:reward.id}});
    await Promise.all([planner.redeem(alice.id,reward.id,redemption.idempotencyKey),planner.redeem(alice.id,reward.id,redemption.idempotencyKey)]);
    expect((await planner.market(alice.id,group1)).balance).toBe(1);
    expect((await planner.market(alice.id,group2)).balance).toBe(7);
    await expect(planner.fulfill(alice.id,redemption.id)).rejects.toThrow('Only the person');
    await planner.fulfill(bob.id,redemption.id);
    expect((await db.spaceRedemption.findUniqueOrThrow({where:{id:redemption.id}})).status).toBe('FULFILLED');
  });
});
