import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString } from "class-validator";

export class ChatDto {
  @ApiProperty({ example: "User message" })
  @IsString()
  @Type(() => String)
  message!: string;
}
