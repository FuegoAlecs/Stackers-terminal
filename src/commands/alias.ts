import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { aliasManager } from '../lib/AliasManager'

export const aliasCommand: CommandHandler = {
  name: 'alias',
  description: 'Create and manage command aliases',
  usage: 'alias [name] [command] | alias list | alias clear',
  
  execute: async (context: CommandContext): Promise<CommandResult> => { // Changed to async
    const { args, printer } = context; // Added printer

    if (!printer) {
      return { output: 'Error: Printer not available.', success: false };
    }
    
    if (args.length === 0) {
      // Show all aliases
      const allAliases = aliasManager.getAll(); // Renamed to avoid conflict
      
      if (allAliases.length === 0) {
        // Using printer.print for multi-line informational message
        await printer.print(`No aliases defined.\n
💡 Alias Commands:
  alias <name> <command>  - Create an alias
  alias list              - List all aliases
  alias search <text>     - Search aliases
  alias clear             - Clear all aliases
  alias export            - Export aliases as JSON
  alias import <json>     - Import aliases from JSON

Examples:
  alias greet call 0xABC.greet()
  alias bal wallet balance
  alias deploy-hello deploy Hello.sol --gasless`);
        return { output: '', success: true };
      }
      
      await printer.print(`Current Aliases (${allAliases.length}):`);
      const headers = ['Name', 'Command'];
      const rows = allAliases
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(alias => [alias.name, alias.command]);
      await printer.table(headers, rows);
      
      await printer.print(`\n💡 Use "alias <name> <command>" to create new aliases`);
      await printer.print(`   Use "unalias <name>" to remove aliases`);
      return { output: '', success: true };
    }
    
    const subcommand = args[0].toLowerCase();
    
    switch (subcommand) {
      case 'list':
        const listAliases = aliasManager.getAll(); // Renamed to avoid conflict
        
        if (listAliases.length === 0) {
          await printer.print('No aliases defined.');
          return { output: '', success: true };
        }
        
        await printer.print(`All Aliases (${listAliases.length}/${aliasManager.size()}):`);
        const listHeaders = ['#', 'Name', 'Command'];
        const listRows = listAliases
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((alias, index) => [(index + 1).toString(), alias.name, alias.command]);
        await printer.table(listHeaders, listRows);
        
        await printer.print(`\n💡 Tips:
  • Use aliases to create shortcuts for complex commands
  • Aliases persist across terminal sessions
  • Use "alias search <text>" to find specific aliases`);
        return { output: '', success: true };
      
      case 'search':
        if (args.length < 2) {
          return {
            output: `Usage: alias search <text>

Examples:
  alias search wallet
  alias search deploy
  alias search "smart create"`,
            success: false
          }
        }
        
        const searchText = args.slice(1).join(' ');
        const results = aliasManager.search(searchText);
        
        if (results.length === 0) {
          await printer.print(`No aliases found containing: "${searchText}"\n
💡 Try:
  • Different search terms
  • Partial alias names
  • alias list - to see all aliases`);
          return { output: '', success: true };
        }
        
        await printer.print(`Search results for "${searchText}" (${results.length} found):`);
        const searchHeaders = ['#', 'Name', 'Command'];
        const searchRows = results
          .map((result, index) => [(index + 1).toString(), result.name, result.command]);
        await printer.table(searchHeaders, searchRows);
        
        await printer.print(`\n💡 Use any of these aliases by typing the alias name`);
        return { output: '', success: true };
      
      case 'clear':
        const count = aliasManager.size()
        aliasManager.clear()
        
        return {
          output: `✅ Cleared ${count} aliases successfully.

All aliases have been removed from storage.
Use "alias <name> <command>" to create new aliases.`,
          success: true
        }
      
      case 'export':
        const exportData = aliasManager.export()
        
        return {
          output: `Alias Export Data:

${exportData}

💡 Save this data to import later with "alias import <json>"
   This includes all ${aliasManager.size()} aliases with timestamp.`,
          success: true
        }
      
      case 'import':
        if (args.length < 2) {
          return {
            output: `Usage: alias import <json_data>

Example:
  alias import '{"aliases":{"greet":"call 0xABC.greet()"},"timestamp":"..."}'

💡 Use "alias export" to get the correct JSON format`,
            success: false
          }
        }
        
        const jsonData = args.slice(1).join(' ')
        const importResult = aliasManager.import(jsonData)
        
        if (!importResult.success) {
          return {
            output: `❌ Failed to import aliases.

Errors:
${importResult.errors.map(err => `  • ${err}`).join('\n')}

Expected format:
{
  "aliases": {
    "alias_name": "command",
    "another_alias": "another command"
  },
  "timestamp": "...",
  "count": 123
}`,
            success: false
          }
        }
        
        let output = `✅ Successfully imported ${importResult.imported} aliases!`
        
        if (importResult.errors.length > 0) {
          output += `\n\n⚠️  Warnings:
${importResult.errors.map(err => `  • ${err}`).join('\n')}`
        }
        
        output += `\n\nTotal aliases: ${aliasManager.size()}
Use "alias list" to see all aliases.`
        
        return {
          output,
          success: true
        }
      
      case 'help':
        return {
          output: `Alias Command Help:

OVERVIEW:
  Aliases let you create shortcuts for frequently used commands.
  They're stored in your browser's localStorage and persist across sessions.

BASIC USAGE:
  alias <name> <command>  - Create an alias
  alias                   - List all aliases
  unalias <name>          - Remove an alias

MANAGEMENT:
  alias list              - List all aliases with numbers
  alias search <text>     - Search aliases by name or command
  alias clear             - Remove all aliases
  alias export            - Export aliases as JSON
  alias import <json>     - Import aliases from JSON

EXAMPLES:

1. Simple Command Shortcuts:
   alias bal wallet balance
   alias conn wallet connect
   alias disc wallet disconnect

2. Contract Interaction Shortcuts:
   alias greet call 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b.greet()
   alias name call 0xABC.name()
   alias supply call 0xDEF.totalSupply()

3. Complex Command Shortcuts:
   alias deploy-hello deploy Hello.sol --args "Hello World"
   alias create-smart smart create --gasless
   alias estimate-gas gasEstimate 0xABC.setMessage("test")

4. Multi-word Commands:
   alias "check balance" wallet balance
   alias "smart info" smart info

FEATURES:
  ✅ Persistent storage (localStorage)
  ✅ Recursion prevention
  ✅ Reserved name protection
  ✅ Search functionality
  ✅ Export/import capability
  ✅ Tab completion support
  ✅ Argument passing

ARGUMENT PASSING:
  Aliases can accept additional arguments:
  
  alias transfer call 0xToken.transfer
  transfer 0x123... 1000  # Becomes: call 0xToken.transfer 0x123... 1000

RULES & LIMITATIONS:
  • Alias names must be alphanumeric + underscore
  • Cannot start with numbers
  • Cannot use reserved command names
  • Maximum 100 aliases
  • Maximum 50 characters per alias name
  • Recursive aliases are prevented
  • Commands are expanded when alias is used

RESERVED NAMES:
  Cannot create aliases for: help, clear, echo, date, history, alias,
  unalias, wallet, smart, alchemy, call, write, deploy, compile, etc.

STORAGE:
  • Aliases are stored in browser localStorage
  • Persist across browser sessions
  • Cleared when browser data is cleared
  • Use export/import for backup

TIPS:
  💡 Create aliases for your most-used commands
  💡 Use descriptive names for complex operations
  💡 Export aliases before clearing browser data
  💡 Share aliases with team using export/import
  💡 Use search to find existing aliases before creating new ones

EXAMPLES BY USE CASE:

Wallet Operations:
  alias conn "wallet connect"
  alias bal "wallet balance"
  alias addr "wallet address"

Smart Wallet:
  alias sw "smart info"
  alias gasless "smart sponsor on"
  alias nogasless "smart sponsor off"

Contract Calls:
  alias token-name "call 0xToken.name()"
  alias token-supply "call 0xToken.totalSupply()"
  alias my-balance "call 0xToken.balanceOf"

Development:
  alias build "compile Hello.sol"
  alias deploy-test "deploy Hello.sol --args 'Test Message'"
  alias sim-call "simulate tx"`,
          success: true
        }
      
      default:
        // Create alias: alias <name> <command>
        if (args.length < 2) {
          return {
            output: `Usage: alias <name> <command>

Examples:
  alias greet call 0xABC.greet()
  alias bal wallet balance
  alias deploy-hello deploy Hello.sol --args "Hello World"

Use "alias help" for detailed information.`,
            success: false
          }
        }
        
        const aliasName = args[0]
        const aliasCommand = args.slice(1).join(' ')
        
        // Validate alias name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(aliasName)) {
          return {
            output: `❌ Invalid alias name: "${aliasName}"

Alias names must:
  • Start with a letter or underscore
  • Contain only letters, numbers, and underscores
  • Be 50 characters or less

Valid examples: greet, my_command, deployHello, check_balance`,
            success: false
          }
        }
        
        if (aliasName.length > 50) {
          return {
            output: `❌ Alias name too long: "${aliasName}"

Maximum length is 50 characters.`,
            success: false
          }
        }
        
        // Check if it's a reserved name
        const reserved = [
          'help', 'clear', 'echo', 'date', 'history', 'alias', 'unalias',
          'wallet', 'smart', 'alchemy', 'call', 'write', 'deploy', 'compile',
          'simulate', 'gasEstimate', 'whoami', 'pwd', 'ls'
        ]
        
        if (reserved.includes(aliasName.toLowerCase())) {
          return {
            output: `❌ Cannot create alias for reserved command: "${aliasName}"

Reserved commands: ${reserved.join(', ')}

Choose a different alias name.`,
            success: false
          }
        }
        
        // Check for recursion
        if (aliasCommand.trim().split(/\s+/)[0] === aliasName) {
          return {
            output: `❌ Cannot create recursive alias: "${aliasName}"

An alias cannot call itself directly.
Example of invalid alias: alias greet greet --verbose`,
            success: false
          }
        }
        
        // Check size limit
        if (!aliasManager.has(aliasName) && aliasManager.size() >= 100) {
          return {
            output: `❌ Maximum aliases limit reached (100).

Remove some aliases first:
  • alias list - see all aliases
  • unalias <name> - remove specific alias
  • alias clear - remove all aliases`,
            success: false
          }
        }
        
        // Create the alias
        const success = aliasManager.set(aliasName, aliasCommand)
        
        if (!success) {
          return {
            output: `❌ Failed to create alias "${aliasName}".

This might be due to:
  • Recursive alias detection
  • Storage limitations
  • Invalid command format

Try a different alias name or command.`,
            success: false
          }
        }
        
        const isUpdate = aliasManager.has(aliasName)
        
        return {
          output: `✅ ${isUpdate ? 'Updated' : 'Created'} alias "${aliasName}"!

Alias: ${aliasName}
Command: ${aliasCommand}

💡 Usage:
  • Type "${aliasName}" to run: ${aliasCommand}
  • Add arguments: "${aliasName} arg1 arg2" runs: ${aliasCommand} arg1 arg2
  • Use "unalias ${aliasName}" to remove this alias

Total aliases: ${aliasManager.size()}/100`,
          success: true
        }
    }
  }
}

commandRouter.register(aliasCommand)