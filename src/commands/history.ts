import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { commandHistory } from '../lib/CommandHistory'

export const historyCommand: CommandHandler = {
  name: 'history',
  description: 'Show command history and support command repetition',
  usage: 'history [count|clear|search <text>|export|import]',
  aliases: ['hist'],
  
  execute: (context: CommandContext): CommandResult => {
    const { args } = context
    
    if (args.length === 0) {
      // Show last 20 commands by default
      const recentHistory = commandHistory.getRecent(20)
      
      if (recentHistory.length === 0) {
        return {
          output: `No command history available.

💡 Command History Features:
  • history [count] - Show last N commands
  • !! - Repeat last command
  • !<number> - Repeat command by index
  • !<text> - Repeat last command starting with text
  • history clear - Clear all history
  • history search <text> - Search command history`,
          success: true
        }
      }
      
      const totalCommands = commandHistory.size()
      const startIndex = Math.max(1, totalCommands - recentHistory.length + 1)
      
      const output = recentHistory
        .map((cmd, index) => {
          const lineNumber = (startIndex + index).toString().padStart(4)
          return `${lineNumber}  ${cmd}`
        })
        .join('\n')
      
      return {
        output: `Command History (showing last ${recentHistory.length} of ${totalCommands} commands):

${output}

💡 Quick Commands:
  !!        - Repeat last command
  !${totalCommands}       - Repeat command #${totalCommands}
  !wallet   - Repeat last command starting with "wallet"
  history 50 - Show last 50 commands`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    switch (subcommand) {
      case 'clear':
        commandHistory.clear()
        return {
          output: '✅ Command history cleared successfully.',
          success: true
        }
      
      case 'search':
        if (args.length < 2) {
          return {
            output: `Usage: history search <text>

Examples:
  history search wallet
  history search "smart create"
  history search deploy`,
            success: false
          }
        }
        
        const searchText = args.slice(1).join(' ')
        const results = commandHistory.search(searchText)
        
        if (results.length === 0) {
          return {
            output: `No commands found containing: "${searchText}"

💡 Try:
  • Different search terms
  • Partial command names
  • history - to see all recent commands`,
            success: true
          }
        }
        
        const searchOutput = results
          .map(result => `${result.index.toString().padStart(4)}  ${result.command}`)
          .join('\n')
        
        return {
          output: `Search results for "${searchText}" (${results.length} found):

${searchOutput}

💡 Use !<number> to repeat any of these commands`,
          success: true
        }
      
      case 'export':
        const exportData = commandHistory.export()
        return {
          output: `Command History Export:

${exportData}

💡 Save this data to import later with "history import <json>"`,
          success: true
        }
      
      case 'import':
        if (args.length < 2) {
          return {
            output: `Usage: history import <json_data>

Example:
  history import '{"history":["command1","command2"],"timestamp":"..."}'`,
            success: false
          }
        }
        
        const jsonData = args.slice(1).join(' ')
        const importSuccess = commandHistory.import(jsonData)
        
        if (importSuccess) {
          return {
            output: `✅ Command history imported successfully.
Total commands: ${commandHistory.size()}`,
            success: true
          }
        } else {
          return {
            output: `❌ Failed to import history. Invalid JSON format.

Expected format:
{
  "history": ["command1", "command2", ...],
  "timestamp": "...",
  "size": 123
}`,
            success: false
          }
        }
      
      case 'help':
        return {
          output: `Command History Help:

BASIC USAGE:
  history           - Show last 20 commands
  history <count>   - Show last N commands
  history clear     - Clear all history
  history search <text> - Search for commands

COMMAND REPETITION:
  !!               - Repeat last command
  !<number>        - Repeat command by index (e.g., !15)
  !-<number>       - Repeat command from end (e.g., !-2 for 2nd last)
  !<text>          - Repeat last command starting with text

EXAMPLES:

1. View History:
   history          # Last 20 commands
   history 50       # Last 50 commands
   history search wallet # Find wallet commands

2. Repeat Commands:
   !!               # Repeat: wallet status
   !25              # Repeat command #25
   !-3              # Repeat 3rd command from end
   !wallet          # Repeat last "wallet ..." command
   !smart           # Repeat last "smart ..." command

3. Management:
   history clear    # Clear all history
   history export   # Export history as JSON
   history import '...' # Import history from JSON

FEATURES:
  ✅ Automatic command tracking
  ✅ Duplicate filtering (consecutive duplicates ignored)
  ✅ History expansion (!! and !n)
  ✅ Search functionality
  ✅ Export/import capability
  ✅ Size limits (max 1000 commands)

NOTES:
  • History commands themselves are not saved
  • Empty commands are ignored
  • Consecutive duplicate commands are filtered
  • History persists during session only
  • Use export/import for persistence across sessions

KEYBOARD SHORTCUTS:
  • Up Arrow: Navigate through history
  • Down Arrow: Navigate forward in history
  • Tab: Command completion (not history-based)

💡 Pro Tips:
  • Use !<partial> to quickly repeat recent commands
  • Search before repeating: "history search deploy" then "!15"
  • Export history before closing terminal for important sessions`,
          success: true
        }
      
      default:
        // Try to parse as a number for showing N recent commands
        const count = parseInt(subcommand)
        if (!isNaN(count) && count > 0) {
          const requestedCount = Math.min(count, commandHistory.size())
          const recentHistory = commandHistory.getRecent(requestedCount)
          
          if (recentHistory.length === 0) {
            return {
              output: 'No command history available.',
              success: true
            }
          }
          
          const totalCommands = commandHistory.size()
          const startIndex = Math.max(1, totalCommands - recentHistory.length + 1)
          
          const output = recentHistory
            .map((cmd, index) => {
              const lineNumber = (startIndex + index).toString().padStart(4)
              return `${lineNumber}  ${cmd}`
            })
            .join('\n')
          
          return {
            output: `Command History (last ${recentHistory.length} commands):

${output}

Total commands in history: ${totalCommands}`,
            success: true
          }
        }
        
        return {
          output: `Unknown history command: ${subcommand}

Available commands:
  history [count]     - Show recent commands
  history clear       - Clear history
  history search <text> - Search commands
  history export      - Export history
  history import <json> - Import history
  history help        - Show detailed help

Examples:
  history 30
  history search wallet
  history clear`,
          success: false
        }
    }
  }
}

commandRouter.register(historyCommand)