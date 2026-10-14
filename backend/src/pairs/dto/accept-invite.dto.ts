import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: 'The one-time token returned by invite creation.' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}
