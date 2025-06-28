import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const pwdCommand: CommandHandler = {
  name: 'pwd',
  description: 'Print the current working directory',
  usage: 'pwd',
  
  execute: (context: CommandContext): CommandResult => {
    return {
      output: '/home/user',
      success: true
    }
  }
}

commandRouter.register(pwdCommand)