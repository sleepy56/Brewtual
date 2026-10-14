import { IsString, IsTimeZone, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePairDto {
  @ApiProperty({ example: 'Our pair', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'Asia/Calcutta', description: 'IANA timezone; fixed for the initial slice.' })
  @IsString()
  @IsTimeZone()
  timezone!: string;
}
