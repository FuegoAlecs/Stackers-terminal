import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const whoamiCommand: CommandHandler = {
  name: 'whoami',
  description: 'Display the current user',
  usage: 'whoami',
  
  execute: (context: CommandContext): CommandResult => {
    return {
      output: 'guest',
      success: true
    }
  }
}

commandRouter.register(whoamiCommand)