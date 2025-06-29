import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const echoCommand: CommandHandler = {
  name: 'echo',
  description: 'Display a line of text',
  usage: 'echo [text...]',
  
  execute: (context: CommandContext): CommandResult => {
    const { args } = context
    
    if (args.length === 0) {
      return { output: '', success: true }
    }
    
    return {
      output: args.join(' '), // Original behavior: just join args with space
      success: true
    }
  }
}

commandRouter.register(echoCommand)