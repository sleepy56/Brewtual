import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInviteDto {
  @ApiProperty({ example: 'bob@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
