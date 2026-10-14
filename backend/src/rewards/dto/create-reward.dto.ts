import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRewardDto {
  @ApiProperty({ example: 'Choose our weekend activity', maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'Plan it together this weekend', maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  fulfillmentExpectation!: string;

  @ApiProperty({ example: 7, minimum: 1, maximum: 1000000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  cost!: number;
}
