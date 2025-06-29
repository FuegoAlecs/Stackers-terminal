import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const helpCommand: CommandHandler = {
  name: 'help',
  description: 'Show available commands and their descriptions',
  usage: 'help [command]',
  aliases: ['h', '?'],
  
  execute: (context: CommandContext): CommandResult => {
    const { args } = context
    // let debugOutput = "DEBUG: help command execute started\n"; // REMOVED DEBUG LINE
    
    if (args.length > 0) {
      // Show help for specific command
      const commandName = args[0].toLowerCase()
      const commands = commandRouter.getCommands()
      const command = commands.find(cmd => 
        cmd.name === commandName || cmd.aliases?.includes(commandName)
      )
      
      if (!command) {
        return {
          output: `Command not found: ${commandName}`,
          success: false
        }
      }
      
      let output = `${command.name} - ${command.description}`
      if (command.usage) {
        output += `\nUsage: ${command.usage}`
      }
      if (command.aliases && command.aliases.length > 0) {
        output += `\nAliases: ${command.aliases.join(', ')}`
      }
      
      return { output, success: true }
    }
    
    // Show all commands
    const commands = commandRouter.getCommands()
    const maxNameLength = Math.max(...commands.map(cmd => cmd.name.length))
    
    const commandList = commands
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cmd => {
        const name = cmd.name.padEnd(maxNameLength + 2)
        return `  ${name} ${cmd.description}`
      })
      .join('\n')
    
    return {
      output: `Available commands:\n${commandList}\n\nType "help <command>" for detailed information about a specific command.`,
      success: true
    }
  }
}

// Auto-register the command
commandRouter.register(helpCommand)