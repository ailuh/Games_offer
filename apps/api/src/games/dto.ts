import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Max, Min, ValidateIf } from "class-validator";
import { RATING_MAX, RATING_MIN, REVIEW_MAX_LENGTH } from "@app/shared";

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
  // null clears the rating (toggle off); a number must be within range.
  @ValidateIf((dto: SetRatingDto) => dto.rating !== null)
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating!: number | null;
}

export class SetReviewDto {
  // null/empty clears the review; otherwise plain text capped to a sane length.
  @ValidateIf((dto: SetReviewDto) => dto.review !== null)
  @IsString()
  @MaxLength(REVIEW_MAX_LENGTH)
  review!: string | null;
}
