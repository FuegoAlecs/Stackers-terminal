import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { aliasManager } from '../lib/AliasManager'

export const unaliasCommand: CommandHandler = {
  name: 'unalias',
  description: 'Remove command aliases',
  usage: 'unalias <name> | unalias -a',
  
  execute: (context: CommandContext): CommandResult => {
    const { args } = context
    
    if (args.length === 0) {
      return {
        output: `Usage: unalias <alias_name>

Examples:
  unalias greet           - Remove the "greet" alias
  unalias deploy-hello    - Remove the "deploy-hello" alias
  unalias -a              - Remove all aliases (same as "alias clear")

💡 Use "alias list" to see all available aliases to remove.`,
        success: false
      }
    }
    
    const aliasName = args[0]
    
    // Handle -a flag (remove all)
    if (aliasName === '-a' || aliasName === '--all') {
      const count = aliasManager.size()
      
      if (count === 0) {
        return {
          output: 'No aliases to remove.',
          success: true
        }
      }
      
      aliasManager.clear()
      
      return {
        output: `✅ Removed all ${count} aliases successfully.

All aliases have been cleared from storage.
Use "alias <name> <command>" to create new aliases.`,
        success: true
      }
    }
    
    // Validate alias name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(aliasName)) {
      return {
        output: `❌ Invalid alias name format: "${aliasName}"

Alias names must start with a letter or underscore and contain only
letters, numbers, and underscores.`,
        success: false
      }
    }
    
    // Check if alias exists
    if (!aliasManager.has(aliasName)) {
      const suggestions = aliasManager.getSuggestions(aliasName.substring(0, 3))
      let suggestionText = ''
      
      if (suggestions.length > 0) {
        suggestionText = `\n\nDid you mean one of these?
${suggestions.slice(0, 5).map(s => `  • ${s}`).join('\n')}`
      }
      
      return {
        output: `❌ Alias "${aliasName}" does not exist.

Use "alias list" to see all available aliases.${suggestionText}`,
        success: false
      }
    }
    
    // Get the command before removing for confirmation
    const aliasCommand = aliasManager.get(aliasName)
    
    // Remove the alias
    const success = aliasManager.remove(aliasName)
    
    if (!success) {
      return {
        output: `❌ Failed to remove alias "${aliasName}".

This might be due to storage issues. Try again.`,
        success: false
      }
    }
    
    return {
      output: `✅ Removed alias "${aliasName}" successfully!

Removed: ${aliasName} → ${aliasCommand}

Remaining aliases: ${aliasManager.size()}
Use "alias list" to see remaining aliases.`,
      success: true
    }
  }
}

commandRouter.register(unaliasCommand)