import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { sessionManager } from '../lib/SessionManager'

export const scriptCommand: CommandHandler = {
  name: 'script',
  description: 'Save and run sequences of CLI commands',
  usage: 'script <save|run|list|remove> <name> [commands...]',
  aliases: ['scr'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, printer } = context; // Added printer

    if (!printer) {
      return { output: 'Error: Printer not available.', success: false };
    }
    
    if (args.length === 0) {
      const scripts = sessionManager.listScripts()
      return {
        output: `CLI Script Commands:
  script save <name> <command1> <command2> ... - Save a sequence of commands
  script run <name>                            - Run a saved script
  script list                                  - List all saved scripts
  script show <name>                           - Show script contents
  script remove <name>                         - Remove a script
  script clear                                 - Remove all scripts
  script help                                  - Show detailed help

Saved Scripts: ${scripts.length}/50

Examples:
  script save deploy-hello "compile Hello.sol" "deploy Hello.sol --args 'Hello World'"
  script save check-balance "wallet status" "wallet balance" "alchemy balance \$address"
  script run deploy-hello

💡 Scripts run commands in sequence and stop on first error.`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'save':
          if (args.length < 3) {
            return {
              output: `Usage: script save <name> <command1> [command2] [command3] ...

Examples:
  script save deploy-hello "compile Hello.sol" "deploy Hello.sol --args 'Hello World'"
  script save wallet-check "wallet connect" "wallet status" "wallet balance"
  script save token-info "call 0xToken.name()" "call 0xToken.symbol()" "call 0xToken.totalSupply()"

💡 Tips:
  • Use quotes around commands with spaces or special characters
  • Commands run in the order specified
  • Script stops on first command that fails
  • Maximum 50 scripts can be saved`,
              success: false
            }
          }
          
          const scriptName = args[1]
          const commands = args.slice(2)
          
          // Validate script name
          if (!/^[a-zA-Z0-9_-]+$/.test(scriptName)) {
            return {
              output: `❌ Invalid script name: "${scriptName}"

Script names must contain only letters, numbers, hyphens, and underscores.
Examples: deploy-hello, check_balance, tokenInfo`,
              success: false
            }
          }
          
          if (scriptName.length > 50) {
            return {
              output: `❌ Script name too long: "${scriptName}"

Maximum length is 50 characters.`,
              success: false
            }
          }
          
          if (commands.length === 0) {
            return {
              output: `❌ No commands provided for script "${scriptName}"

Provide at least one command to save.`,
              success: false
            }
          }
          
          if (commands.length > 20) {
            return {
              output: `❌ Too many commands in script "${scriptName}"

Maximum 20 commands per script. Consider breaking into smaller scripts.`,
              success: false
            }
          }
          
          // Save the script
          const saved = sessionManager.saveScript(scriptName, commands)
          
          if (!saved) {
            return {
              output: `❌ Failed to save script "${scriptName}"

Possible reasons:
  • Maximum scripts limit reached (50)
  • Storage quota exceeded
  
Remove some scripts first: script remove <name>`,
              success: false
            }
          }
          
          const isUpdate = sessionManager.getScript(scriptName) !== undefined
          
          return {
            output: `✅ ${isUpdate ? 'Updated' : 'Saved'} script "${scriptName}"!

📋 Script Details:
  Name: ${scriptName}
  Commands: ${commands.length}
  
📝 Commands:
${commands.map((cmd, index) => `  ${index + 1}. ${cmd}`).join('\n')}

🚀 Run with: script run ${scriptName}
📊 Total scripts: ${sessionManager.listScripts().length}/50`,
            success: true
          }
        
        case 'run':
          if (args.length < 2) {
            return {
              output: `Usage: script run <name>

Examples:
  script run deploy-hello
  script run check-balance
  
Use "script list" to see available scripts.`,
              success: false
            }
          }
          
          const runScriptName = args[1]
          const scriptCommands = sessionManager.getScript(runScriptName)
          
          if (!scriptCommands) {
            const availableScripts = sessionManager.listScripts()
            return {
              output: `❌ Script "${runScriptName}" not found.

Available scripts: ${availableScripts.length > 0 ? availableScripts.map(s => s.name).join(', ') : 'None'}

Use "script list" to see all scripts or "script save" to create new ones.`,
              success: false
            }
          }
          
          // Execute script commands in sequence
          let output = `🚀 Running script "${runScriptName}" (${scriptCommands.length} commands):\n`
          let allSuccessful = true
          
          for (let i = 0; i < scriptCommands.length; i++) {
            const command = scriptCommands[i]
            output += `\n${(i + 1).toString().padStart(2)}. Executing: ${command}\n`
            
            try {
              // Execute the command using the router
              const result = await commandRouter.dispatch(command, context)
              
              if (result.success) {
                output += `    ✅ Success`
                if (result.output && result.output.length < 200) {
                  output += `: ${result.output.split('\n')[0]}`
                }
              } else {
                output += `    ❌ Failed: ${result.error || 'Unknown error'}`
                allSuccessful = false
                break // Stop on first failure
              }
            } catch (error) {
              output += `    ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
              allSuccessful = false
              break
            }
          }
          
          output += `\n\n📊 Script Execution Summary:`
          output += `\n  Script: ${runScriptName}`
          output += `\n  Status: ${allSuccessful ? '✅ Completed successfully' : '❌ Failed'}`
          output += `\n  Commands: ${scriptCommands.length}`
          
          if (!allSuccessful) {
            output += `\n\n💡 Script stopped on first error. Fix the failing command and try again.`
          }
          
          return {
            output,
            success: allSuccessful
          }
        
        case 'list':
          const scripts = sessionManager.listScripts();
          
          if (scripts.length === 0) {
            await printer.print(`No scripts saved.\n
Create your first script:
  script save my-script "wallet status" "wallet balance"

💡 Scripts help automate common command sequences!`);
            return { output: '', success: true };
          }
          
          await printer.print(`Saved Scripts (${scripts.length}/50):`);
          const headers = ['#', 'Name', 'Commands', 'Preview'];
          const rows = scripts.map((script, index) => [
            (index + 1).toString(),
            script.name,
            script.commands.toString() + (script.commands !== 1 ? ' cmds' : ' cmd'),
            script.preview.length > 40 ? script.preview.substring(0, 37) + '...' : script.preview
          ]);
          await printer.table(headers, rows);
          
          await printer.print(`\n💡 Commands:
  • script run <name> - Execute a script
  • script show <name> - View script contents
  • script remove <name> - Delete a script`);
          return { output: '', success: true };
        
        case 'show':
          if (args.length < 2) {
            return {
              output: `Usage: script show <name>

Examples:
  script show deploy-hello
  script show check-balance`,
              success: false
            }
          }
          
          const showScriptName = args[1]
          const showCommands = sessionManager.getScript(showScriptName)
          
          if (!showCommands) {
            return {
              output: `❌ Script "${showScriptName}" not found.

Use "script list" to see available scripts.`,
              success: false
            }
          }
          
          let showOutput = `📋 Script: ${showScriptName}\n`
          showOutput += `Commands: ${showCommands.length}\n\n`
          
          showCommands.forEach((command, index) => {
            showOutput += `${(index + 1).toString().padStart(2)}. ${command}\n`
          })
          
          showOutput += `\n🚀 Run with: script run ${showScriptName}`
          
          return {
            output: showOutput,
            success: true
          }
        
        case 'remove':
          if (args.length < 2) {
            return {
              output: `Usage: script remove <name>

Examples:
  script remove deploy-hello
  script remove old-script`,
              success: false
            }
          }
          
          const removeScriptName = args[1]
          const removed = sessionManager.removeScript(removeScriptName)
          
          if (!removed) {
            return {
              output: `❌ Script "${removeScriptName}" not found.

Use "script list" to see available scripts.`,
              success: false
            }
          }
          
          return {
            output: `✅ Removed script "${removeScriptName}".

Remaining scripts: ${sessionManager.listScripts().length}`,
            success: true
          }
        
        case 'clear':
          const beforeCount = sessionManager.listScripts().length
          sessionManager.clearScripts()
          
          return {
            output: `✅ Cleared ${beforeCount} scripts.

All scripts have been removed from storage.
Use "script save" to create new scripts.`,
            success: true
          }
        
        case 'help':
          return {
            output: `CLI Script System Help:

OVERVIEW:
  Scripts let you save and run sequences of CLI commands automatically.
  They're perfect for automating repetitive tasks, deployment workflows,
  and complex multi-step operations.

COMMANDS:

1. SAVE SCRIPTS:
   script save <name> <command1> [command2] [command3] ...
   
   Examples:
   • script save deploy-hello "compile Hello.sol" "deploy Hello.sol --args 'Hello World'"
   • script save wallet-check "wallet connect" "wallet status" "wallet balance"
   • script save token-analysis "call 0xToken.name()" "call 0xToken.symbol()" "call 0xToken.totalSupply()"

2. RUN SCRIPTS:
   script run <name>
   
   Examples:
   • script run deploy-hello
   • script run wallet-check

3. MANAGE SCRIPTS:
   script list              - List all saved scripts
   script show <name>       - View script contents
   script remove <name>     - Delete a script
   script clear             - Remove all scripts

SCRIPT FEATURES:
  ✅ Sequential execution (commands run in order)
  ✅ Error handling (stops on first failure)
  ✅ Persistent storage (saved in browser)
  ✅ Command validation
  ✅ Progress tracking

SCRIPT RULES:
  • Maximum 50 scripts total
  • Maximum 20 commands per script
  • Script names: letters, numbers, hyphens, underscores only
  • Commands execute in the exact order specified
  • Script stops immediately if any command fails

COMMON SCRIPT PATTERNS:

1. Deployment Workflow:
   script save deploy-token "compile Token.sol" "deploy Token.sol --args 'MyToken,MTK,18,1000000'" "call \$address.name()"

2. Contract Analysis:
   script save analyze-token "call \$address.name()" "call \$address.symbol()" "call \$address.totalSupply()" "call \$address.decimals()"

3. Wallet Management:
   script save wallet-setup "wallet connect" "wallet status" "smart create --gasless"

4. Testing Sequence:
   script save test-contract "compile Test.sol" "deploy Test.sol" "call \$address.test()" "write \$address.setValue(123)"

5. Event Monitoring:
   script save check-events "logs \$address ERC20 --event Transfer --limit 5" "logs \$address ERC20 --event Approval --limit 5"

VARIABLE SUBSTITUTION:
  Scripts support basic variable patterns:
  • \$address - Use deployed contract address
  • \$wallet - Use connected wallet address
  
  Note: Advanced variable substitution is planned for future versions.

EXECUTION BEHAVIOR:
  • Commands run sequentially
  • Each command must complete successfully
  • First failure stops the entire script
  • Output from each command is shown
  • Final summary indicates success/failure

STORAGE:
  • Scripts saved in browser localStorage
  • Persist across browser sessions
  • Cleared when browser data is cleared
  • Export/import functionality planned

BEST PRACTICES:
  💡 Use descriptive script names
  💡 Keep scripts focused on single workflows
  💡 Test individual commands before scripting
  💡 Use quotes around complex commands
  💡 Break long workflows into smaller scripts

TROUBLESHOOTING:
  • "Script not found" → Check name with "script list"
  • "Command failed" → Test individual commands first
  • "Storage full" → Remove unused scripts
  • "Invalid name" → Use only letters, numbers, hyphens, underscores

EXAMPLES BY USE CASE:

Development Workflow:
  script save dev-cycle "compile MyContract.sol" "deploy MyContract.sol" "call \$address.initialize()"

Token Deployment:
  script save deploy-erc20 "compile Token.sol" "deploy Token.sol --args 'MyToken,MTK,18,1000000'" "call \$address.name()" "call \$address.totalSupply()"

Contract Interaction:
  script save interact-token "call \$address.balanceOf(\$wallet)" "write \$address.transfer('0x123...',1000)" "call \$address.balanceOf(\$wallet)"

Monitoring:
  script save monitor-contract "logs \$address --limit 10" "call \$address.getStatus()" "wallet balance"

💡 Scripts make complex blockchain interactions simple and repeatable!`,
            success: true
          }
        
        default:
          return {
            output: `Unknown script command: ${subcommand}

Available commands: save, run, list, show, remove, clear, help

Examples:
  script save my-script "command1" "command2"
  script run my-script
  script list`,
            success: false
          }
      }
    } catch (error) {
      return {
        output: `Script error: ${error instanceof Error ? error.message : 'Unknown error'}

Use "script help" for detailed usage information.`,
        success: false
      }
    }
  }
}

commandRouter.register(scriptCommand)