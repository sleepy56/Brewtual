import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RewardsService } from './rewards.service';

@ApiBearerAuth()
@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  list(@CurrentUser() user: { id: string; email: string }) {
    return this.rewards.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string; email: string }, @Body() dto: CreateRewardDto) {
    return this.rewards.create(user.id, dto);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: { id: string; email: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.rewards.approve(user.id, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: { id: string; email: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.rewards.reject(user.id, id);
  }

  @ApiHeader({ name: 'Idempotency-Key', required: true, description: '8–128 characters; reuse only when retrying the same redemption.' })
  @Post(':id/redeem')
  redeem(
    @CurrentUser() user: { id: string; email: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    return this.rewards.redeem(user.id, id, key ?? '');
  }

  @Get('redemptions')
  redemptions(@CurrentUser() user: { id: string; email: string }) {
    return this.rewards.redemptions(user.id);
  }

  @Post('redemptions/:id/fulfill')
  fulfill(@CurrentUser() user: { id: string; email: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.rewards.fulfill(user.id, id);
  }
}
