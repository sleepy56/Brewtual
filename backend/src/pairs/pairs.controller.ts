import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreatePairDto } from './dto/create-pair.dto';
import { PairsService } from './pairs.service';

@ApiBearerAuth()
@ApiTags('pairs')
@Controller('pairs')
export class PairsController {
  constructor(private readonly pairs: PairsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePairDto) {
    return this.pairs.createPair(user, dto.name, dto.timezone);
  }

  @Get('current')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.pairs.current(user.id);
  }

  @Post('invites')
  createInvite(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInviteDto) {
    return this.pairs.createInvite(user, dto.email);
  }

  @Post('invites/accept')
  acceptInvite(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcceptInviteDto) {
    return this.pairs.acceptInvite(user, dto.token);
  }
}
