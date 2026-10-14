import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletService } from './wallet.service';

@ApiBearerAuth()
@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  balance(@CurrentUser() user: { id: string; email: string }) {
    return this.wallet.balance(user.id);
  }

  @Get('ledger')
  ledger(@CurrentUser() user: { id: string; email: string }) {
    return this.wallet.ledger(user.id);
  }

  @Post('settle')
  settle(@CurrentUser() user: { id: string; email: string }) {
    return this.wallet.settle(user.id);
  }
}
