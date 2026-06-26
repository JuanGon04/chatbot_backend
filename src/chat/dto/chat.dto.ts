import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

export class ChatDto {
  @ApiProperty({
    description: "The user enquiry to send to the chatbot.",
    example: "I am looking for a phone",
  })
  @IsString()
  @IsNotEmpty()
  @Type(() => String)
  message!: string;
}
