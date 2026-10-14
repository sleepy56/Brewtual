import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './auth/public.decorator';
import { PrismaService } from './database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get()
  live() { return { status: 'ok' }; }
  @Public()
  @Get('ready')
  async ready() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ready' }; }
    catch { throw new ServiceUnavailableException('Database is unavailable'); }
  }
}
