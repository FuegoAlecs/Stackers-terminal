import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const echoCommand: CommandHandler = {
  name: 'echo',
  description: 'Display a line of text',
  usage: 'echo [text...]',
  
  execute: (context: CommandContext): CommandResult => {
    const { args } = context
    
    if (args.length > 0 && args[0] === '--multiline-test') {
      return {
        output: "This is line one.\n  This is line two (indented).\n    This is line three (more indented).\nAnd this is line four.",
        success: true
      }
    }

    if (args.length === 0) {
      return { output: '', success: true }
    }
    
    // Original echo behavior: join args, but replace literal \\n with actual \n for testing
    const outputString = args.join(' ').replace(/\\n/g, '\n');
    return {
      output: outputString,
      success: true
    }
  }
}

commandRouter.register(echoCommand)