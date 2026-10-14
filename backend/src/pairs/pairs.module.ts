import { Global, Module } from '@nestjs/common';
import { PairAccessService } from './pair-access.service';
import { PairsController } from './pairs.controller';
import { PairsService } from './pairs.service';

@Global()
@Module({
  controllers: [PairsController],
  providers: [PairAccessService, PairsService],
  exports: [PairAccessService],
})
export class PairsModule {}
