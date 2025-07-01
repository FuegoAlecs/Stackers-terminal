import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { sessionManager } from '../lib/SessionManager'

export const sessionCommand: CommandHandler = {
  name: 'session',
  description: 'Manage terminal session data (wallet, history, aliases, scripts)',
  usage: 'session <info|export|import|reset> [options]',
  aliases: ['sess'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, printer } = context; // Added printer

    if (!printer) {
      return { output: 'Error: Printer not available.', success: false };
    }
    
    if (args.length === 0) {
      const stats = sessionManager.getStats()
      return {
        output: `Terminal Session Commands:
  session info                    - Show session information and statistics
  session export                  - Export session data as JSON
  session import <json>           - Import session data from JSON
  session reset                   - Reset session to defaults
  session help                    - Show detailed help

📊 Current Session Stats:
  Command History: ${stats.historySize} commands
  Aliases: ${stats.aliasCount} shortcuts
  ABIs: ${stats.abiCount} loaded
  Scripts: ${stats.scriptCount} saved
  Last Updated: ${stats.sessionAge}

💡 Session data persists across browser sessions and includes all your
   terminal customizations, command history, and saved configurations.`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'info': { // Added scope
          const session = sessionManager.getSession();
          const stats = sessionManager.getStats();
          
          await printer.print('📊 Terminal Session Information:\n');

          await printer.print('🔗 Wallet Status:');
          const walletStatusData = [
            { key: 'Connected', value: session.wallet.isConnected ? '✅ Yes' : '❌ No' },
            { key: 'Address', value: session.wallet.address || 'Not connected' },
            { key: 'Network', value: session.wallet.networkName || 'Unknown' },
            { key: 'Chain ID', value: session.wallet.chainId?.toString() || '' }
          ];
          await printer.printKeyValues(walletStatusData, { indent: 2 });

          await printer.print('\n🧠 Smart Wallet:');
          const smartWalletData = [
            { key: 'Initialized', value: session.smartWallet.isInitialized ? '✅ Yes' : '❌ No' },
            { key: 'Address', value: session.smartWallet.address || 'Not created' },
            { key: 'Gasless Mode', value: session.smartWallet.gasless ? '✅ Enabled' : '❌ Disabled' },
            { key: 'Owner', value: session.smartWallet.owner || '' }
          ];
          await printer.printKeyValues(smartWalletData, { indent: 2 });

          await printer.print('\n📚 Data Summary:');
          const dataSummary = [
            { key: 'Command History', value: `${stats.historySize}/${1000} commands` },
            { key: 'Aliases', value: `${stats.aliasCount}/100 shortcuts` },
            { key: 'ABIs', value: `${stats.abiCount}/50 loaded` },
            { key: 'Scripts', value: `${stats.scriptCount}/50 saved` }
          ];
          await printer.printKeyValues(dataSummary, { indent: 2 });

          await printer.print('\n⏰ Session Details:');
          const sessionDetails = [
            { key: 'Last Updated', value: new Date(stats.lastUpdated).toLocaleString() },
            { key: 'Session Age', value: stats.sessionAge },
            { key: 'Storage', value: 'Browser localStorage' }
          ];
          await printer.printKeyValues(sessionDetails, { indent: 2 });

          await printer.print('\n💾 Data Persistence:');
          await printer.print('  ✅ Command history and aliases');
          await printer.print('  ✅ Loaded ABIs and contract data');
          await printer.print('  ✅ Saved scripts and workflows');
          await printer.print('  ✅ Wallet connection preferences');
          await printer.print('  ✅ Smart wallet configuration');

          await printer.print('\n🔧 Management:');
          await printer.print('  • session export - Backup your session');
          await printer.print('  • session import - Restore from backup');
          await printer.print('  • session reset - Start fresh');

          return { output: '', success: true };
        } // Close case 'info'
        
        case 'export':
          const exportData = sessionManager.export()
          
          return {
            output: `📦 Session Export Data:

${exportData}

💡 Save this data to restore your session later:
  • Copy the JSON above
  • Save to a file for backup
  • Use "session import <json>" to restore
  
🔒 Privacy Note:
  • Wallet addresses are included (no private keys)
  • Command history may contain sensitive data
  • Review before sharing`,
            success: true
          }
        
        case 'import':
          if (args.length < 2) {
            return {
              output: `Usage: session import <json_data>

Example:
  session import '{"wallet":{"isConnected":true,...},"aliases":{...},...}'

💡 Use "session export" to get the correct JSON format.
⚠️  This will replace your current session data!`,
              success: false
            }
          }
          
          const jsonData = args.slice(1).join(' ')
          const importResult = sessionManager.import(jsonData)
          
          if (!importResult.success) {
            return {
              output: `❌ Failed to import session data.

Errors:
${importResult.errors.map(err => `  • ${err}`).join('\n')}

Expected format from "session export" command.`,
              success: false
            }
          }
          
          const newStats = sessionManager.getStats()
          
          return {
            output: `✅ Session data imported successfully!

📊 Imported Data:
  Command History: ${newStats.historySize} commands
  Aliases: ${newStats.aliasCount} shortcuts
  ABIs: ${newStats.abiCount} loaded
  Scripts: ${newStats.scriptCount} saved

🔄 Session has been restored from backup.
All your previous terminal customizations are now active.`,
            success: true
          }
        
        case 'reset':
          // Confirm reset (in a real implementation, you might want a confirmation)
          const beforeStats = sessionManager.getStats()
          sessionManager.reset()
          
          return {
            output: `🔄 Session reset to defaults!

📊 Cleared Data:
  Command History: ${beforeStats.historySize} commands removed
  Aliases: ${beforeStats.aliasCount} shortcuts removed
  ABIs: ${beforeStats.abiCount} ABIs removed
  Scripts: ${beforeStats.scriptCount} scripts removed
  Wallet: Connection status cleared
  Smart Wallet: Configuration cleared

✨ Fresh Start:
  • All customizations have been removed
  • Built-in ABIs (ERC20, ERC721) will be reloaded
  • Terminal is ready for new configuration
  
💡 Use "session export" before reset to backup your data!`,
            success: true
          }
        
        case 'help':
          return {
            output: `Terminal Session Management Help:

OVERVIEW:
  The session system tracks and persists all your terminal data including
  wallet connections, command history, aliases, loaded ABIs, and saved scripts.
  This ensures your customizations persist across browser sessions.

COMMANDS:

1. SESSION INFO:
   session info
   
   Shows comprehensive session status including:
   • Wallet connection details
   • Smart wallet configuration
   • Data storage statistics
   • Last update timestamp

2. EXPORT SESSION:
   session export
   
   Creates a JSON backup of all session data:
   • Wallet connection state
   • Command history
   • All aliases and shortcuts
   • Loaded ABIs
   • Saved scripts
   
3. IMPORT SESSION:
   session import <json_data>
   
   Restores session from exported JSON:
   • Replaces current session data
   • Restores all customizations
   • Maintains data integrity

4. RESET SESSION:
   session reset
   
   Clears all session data:
   • Removes command history
   • Clears all aliases
   • Removes loaded ABIs (except built-ins)
   • Deletes saved scripts
   • Resets wallet connection state

SESSION DATA INCLUDES:

🔗 Wallet Information:
  • Connection status
  • Wallet address
  • Network details
  • Chain ID

🧠 Smart Wallet:
  • Initialization status
  • Smart wallet address
  • Gasless mode setting
  • Owner relationship

📚 Terminal Data:
  • Command history (last 1000 commands)
  • User-defined aliases (up to 100)
  • Loaded contract ABIs (up to 50)
  • Saved command scripts (up to 50)

STORAGE DETAILS:
  • Location: Browser localStorage
  • Persistence: Across browser sessions
  • Size Limits: Browser-dependent (~5-10MB)
  • Privacy: Local only, not transmitted

DATA PERSISTENCE:
  ✅ Survives browser restart
  ✅ Survives tab closure
  ✅ Survives page refresh
  ❌ Cleared with browser data
  ❌ Not shared between browsers

BACKUP STRATEGY:
  1. Regular exports: session export
  2. Save JSON to file
  3. Version control for team sharing
  4. Import when needed: session import

PRIVACY CONSIDERATIONS:
  • Wallet addresses are stored (no private keys)
  • Command history may contain sensitive data
  • ABIs and scripts are stored locally
  • No data is transmitted to external servers

USE CASES:

1. Backup Before Major Changes:
   session export  # Save current state
   # Make changes...
   session import <backup>  # Restore if needed

2. Team Collaboration:
   session export  # Share terminal setup
   # Team member: session import <shared_data>

3. Fresh Start:
   session reset  # Clean slate
   # Reconfigure as needed

4. Migration:
   session export  # On old browser
   session import <data>  # On new browser

TROUBLESHOOTING:
  • "Import failed" → Check JSON format
  • "Storage full" → Clear browser data or reset session
  • "Data lost" → Check if browser cleared localStorage
  • "Slow performance" → Consider resetting large sessions

BEST PRACTICES:
  💡 Export session before major changes
  💡 Regular backups for important configurations
  💡 Review exported data before sharing
  💡 Use reset for fresh starts
  💡 Monitor session size for performance

TECHNICAL DETAILS:
  • Storage: localStorage API
  • Format: JSON with versioning
  • Validation: Schema checking on import
  • Limits: Browser localStorage quotas
  • Fallbacks: Graceful degradation

💡 Session management ensures your terminal setup is never lost!`,
            success: true
          }
        
        default:
          return {
            output: `Unknown session command: ${subcommand}

Available commands: info, export, import, reset, help

Examples:
  session info
  session export
  session reset`,
            success: false
          }
      }
    } catch (error) {
      return {
        output: `Session error: ${error instanceof Error ? error.message : 'Unknown error'}

Use "session help" for detailed usage information.`,
        success: false
      }
    }
  }
}

commandRouter.register(sessionCommand)