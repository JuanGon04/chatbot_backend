import { Controller, Post, Body } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { ChatDto } from "./dto";
import { ApiBody, ApiOperation, ApiResponse } from "@nestjs/swagger";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({
    summary: "Send a user enquiry to the chatbot",
    description:
      "Receives a natural-language enquiry and returns the chatbot's final response, " +
      "after internally resolving any tool calls (searchProducts, convertCurrencies) " +
      "requested by the underlying LLM.",
  })
  @ApiBody({ type: ChatDto })
  @ApiResponse({
    status: 201,
    description: "The chatbot's final natural-language response.",
    schema: {
      type: "string",
      example: "Here are two phones that might interest you...",
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({
    status: 500,
    description: "Internal error while processing the enquiry.",
  })
  handleChat(@Body() chatDto: ChatDto) {
    return this.chatService.handleUserMessage(chatDto);
  }
}
