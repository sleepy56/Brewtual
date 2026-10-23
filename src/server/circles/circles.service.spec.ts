import { CirclesService } from './circles.service';
import { ForbiddenError, ConflictError, NotFoundError } from '../http/errors';
describe('friend circles and connection codes', () => {
 const userId='alice', circleId='circle';
 let db:any, service:CirclesService;
 beforeEach(()=>{
  db={circleMember:{findUnique:jest.fn().mockResolvedValue({})},circleGoal:{findUnique:jest.fn(),findFirst:jest.fn(),update:jest.fn()},connectionCode:{findUnique:jest.fn(),create:jest.fn(),update:jest.fn()},membership:{findUnique:jest.fn(),count:jest.fn(),create:jest.fn()},circleCheer:{upsert:jest.fn()},circlePledge:{upsert:jest.fn()},circleOffer:{findFirst:jest.fn()},circle:{findUnique:jest.fn().mockResolvedValue({})}};
  db.runInTransaction=(fn:any)=>fn(db);service=new CirclesService(db);
 });
 it('rejects access from nonmembers before reading or writing circle data',async()=>{
  db.circleMember.findUnique.mockResolvedValue(null);
  await expect(service.cheer(userId,circleId,'goal')).rejects.toBeInstanceOf(ForbiddenError);
  expect(db.circleGoal.findFirst).not.toHaveBeenCalled();
 });
 it('prevents progress changes by another member and bounds owner progress',async()=>{
  db.circleGoal.findUnique.mockResolvedValue({circleId,ownerId:'bob',target:7});
  await expect(service.progress(userId,circleId,'goal',1)).rejects.toBeInstanceOf(ForbiddenError);
  db.circleGoal.findUnique.mockResolvedValue({circleId,ownerId:userId,target:7});
  await expect(service.progress(userId,circleId,'goal',8)).rejects.toBeInstanceOf(ConflictError);
  expect(db.circleGoal.update).not.toHaveBeenCalled();
 });
 it('checks that cheers and pledges belong to the selected circle',async()=>{
  db.circleGoal.findFirst.mockResolvedValue(null);db.circleOffer.findFirst.mockResolvedValue(null);
  await expect(service.cheer(userId,circleId,'elsewhere')).rejects.toBeInstanceOf(NotFoundError);
  await expect(service.pledge(userId,circleId,'elsewhere')).rejects.toBeInstanceOf(NotFoundError);
  expect(db.circlePledge.upsert).not.toHaveBeenCalled();
 });
 it('stores only a hash of a multi-use group code',async()=>{
  const result=await service.code(userId,'group',circleId);
  expect(result.code).toMatch(/^GROUP-/);
  const stored=db.connectionCode.create.mock.calls[0][0].data;
  expect(stored.hash).not.toContain(result.code);expect(stored.hash).toHaveLength(64);
  db.connectionCode.findUnique.mockResolvedValue({...stored,usedAt:null});
  db.circleMember.upsert=jest.fn();
  await service.join('bob',result.code);await service.join('carol',result.code);
  expect(db.circleMember.upsert).toHaveBeenCalledTimes(2);
  expect(db.connectionCode.update).not.toHaveBeenCalled();
 });
 it('rejects expired and already-used codes',async()=>{
  db.connectionCode.findUnique.mockResolvedValue({expiresAt:new Date(0)});
  await expect(service.join(userId,'bad')).rejects.toBeInstanceOf(NotFoundError);
  db.connectionCode.findUnique.mockResolvedValue({expiresAt:new Date(Date.now()+10000),usedAt:new Date()});
  await expect(service.join(userId,'used')).rejects.toBeInstanceOf(NotFoundError);
 });
 it('prevents a third person joining a partner space',async()=>{
  db.connectionCode.findUnique.mockResolvedValue({kind:'partner',creatorId:'bob',targetId:'pair',expiresAt:new Date(Date.now()+10000)});
  db.membership.findUnique.mockResolvedValue(null);db.membership.count.mockResolvedValue(2);
  await expect(service.join(userId,'PAIR-test')).rejects.toBeInstanceOf(ConflictError);
  expect(db.membership.create).not.toHaveBeenCalled();
 });
});
