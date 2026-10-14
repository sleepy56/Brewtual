import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalsService } from './goals.service';

@ApiBearerAuth()
@ApiTags('goals')
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@CurrentUser() user: { id: string; email: string }) {
    return this.goals.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string; email: string }, @Body() dto: CreateGoalDto) {
    return this.goals.create(user.id, dto);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: { id: string; email: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.goals.approve(user.id, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: { id: string; email: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.goals.reject(user.id, id);
  }

  @Post(':id/check-ins')
  checkIn(@CurrentUser() user: { id: string; email: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.goals.checkIn(user.id, id);
  }

  @Delete(':id/check-ins/today')
  undoToday(@CurrentUser() user: { id: string; email: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.goals.undoToday(user.id, id);
  }
}
