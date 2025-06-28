import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const clearCommand: CommandHandler = {
  name: 'clear',
  description: 'Clear the terminal screen',
  usage: 'clear',
  aliases: ['cls'],
  
  execute: (context: CommandContext): CommandResult => {
    // The terminal component will handle the actual clearing
    if (context.terminal) {
      context.terminal.clear()
    }
    
    return {
      output: '',
      success: true
    }
  }
}

commandRouter.register(clearCommand)