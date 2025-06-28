import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const dateCommand: CommandHandler = {
  name: 'date',
  description: 'Display the current date and time',
  usage: 'date [format]',
  
  execute: (context: CommandContext): CommandResult => {
    const { args } = context
    const now = new Date()
    
    if (args.length > 0) {
      const format = args[0].toLowerCase()
      
      switch (format) {
        case 'iso':
          return { output: now.toISOString(), success: true }
        case 'utc':
          return { output: now.toUTCString(), success: true }
        case 'local':
          return { output: now.toLocaleString(), success: true }
        case 'time':
          return { output: now.toLocaleTimeString(), success: true }
        case 'date':
          return { output: now.toLocaleDateString(), success: true }
        default:
          return {
            output: `Unknown format: ${format}. Available formats: iso, utc, local, time, date`,
            success: false
          }
      }
    }
    
    return {
      output: now.toLocaleString(),
      success: true
    }
  }
}

commandRouter.register(dateCommand)