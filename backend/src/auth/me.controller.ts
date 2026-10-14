import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './auth.types';

@ApiBearerAuth()
@ApiTags('identity')
@Controller()
export class MeController {
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
