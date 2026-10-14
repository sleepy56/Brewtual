import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty({ example: 'Walk', maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ type: [Number], example: [1, 3, 5], description: 'ISO weekdays: Monday=1 through Sunday=7; unique values.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];

  @ApiProperty({ example: 2, minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  requiredCount!: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: 1000000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  weeklyTokens!: number;
}
