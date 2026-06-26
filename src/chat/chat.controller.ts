import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatDto } from './dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  handleChat(@Body() chatDto: ChatDto) {
    return this.chatService.handleUserMessage(chatDto);
  }

}
