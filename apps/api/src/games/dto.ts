import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { RATING_MAX, RATING_MIN } from "@app/shared";

export class CreateGameDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsString()
  steamUrl?: string;

  @IsOptional()
  @IsBoolean()
  hasDemo?: boolean;
}

export class IngestGameDto {
  @IsString()
  text!: string;
}

export class SetPlayedDto {
  @IsBoolean()
  played!: boolean;
}

export class SetRatingDto {
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating!: number;
}
