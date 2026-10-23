import { Authenticator } from './auth/authenticate';
import { AuthService } from './auth/auth.service';
import { VerificationMailService } from './auth/verification-mail.service';
import { validateEnvironment } from './config';
import { PrismaService } from './database/prisma.service';
import { Clock } from './domain/clock';
import { GoalsService } from './goals/goals.service';
import { PairAccessService } from './pairs/pair-access.service';
import { PairsService } from './pairs/pairs.service';
import { RewardsService } from './rewards/rewards.service';
import { WalletService } from './wallet/wallet.service';
import { CirclesService } from './circles/circles.service';

export function createServices(
  db = new PrismaService(),
  clock = new Clock(),
  mail = new VerificationMailService(),
) {
  const access = new PairAccessService(db);
  return {
    db,
    circles: new CirclesService(db),
    auth: new AuthService(db, mail),
    identity: new Authenticator(db),
    pairs: new PairsService(db, access),
    goals: new GoalsService(db, access, clock),
    rewards: new RewardsService(db, access, clock),
    wallet: new WalletService(db, access, clock),
  };
}
export type Services = ReturnType<typeof createServices>;

const shared = globalThis as typeof globalThis & { pairHabitsServices?: Services };
export function getServices(): Services {
  if (!shared.pairHabitsServices) {
    validateEnvironment(process.env);
    shared.pairHabitsServices = createServices();
  }
  return shared.pairHabitsServices;
}
