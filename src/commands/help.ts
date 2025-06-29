import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const helpCommand: CommandHandler = {
  name: 'help',
  description: 'Show available commands and their descriptions',
  usage: 'help [command]',
  aliases: ['h', '?'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, printer } = context;

    if (!printer) {
      return { output: 'Error: Printer not available in context.', success: false };
    }
    
    const allCommands = commandRouter.getCommands();

    if (args.length > 0) {
      // Show help for specific command
      const commandName = args[0].toLowerCase();
      const command = allCommands.find(cmd =>
        cmd.name === commandName || (cmd.aliases && cmd.aliases.includes(commandName))
      );
      
      if (!command) {
        await printer.error(`Command not found: ${commandName}`);
        return { output: '', success: false }; // Output handled by printer.error
      }
      
      // Using printer for structured output of specific command help
      await printer.print(`\n${STYLES.bold}${command.name}${STYLES.reset} - ${command.description}`);
      if (command.usage) {
        await printer.print(`  ${STYLES.bold}Usage:${STYLES.reset} ${command.usage}`);
      }
      if (command.aliases && command.aliases.length > 0) {
        await printer.print(`  ${STYLES.bold}Aliases:${STYLES.reset} ${command.aliases.join(', ')}`);
      }
      await printer.print(''); // Extra newline for spacing
      
      return { output: '', success: true }; // Output is handled by direct printer calls
    }
    
    // Show all commands using the new helpTable method
    await printer.print("\nAvailable commands:\n");

    const helpRows = allCommands
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cmd => ({
        command: cmd.name, // Or cmd.usage if preferred for the first column
        description: cmd.description,
        usage: cmd.usage // Pass usage for formatHelpTable to decide
      }));
    
    // Explicitly define headers for clarity if needed, or rely on defaults in printHelpTable/formatHelpTable
    await printer.printHelpTable(helpRows, 'COMMAND', 'DESCRIPTION', 'USAGE');

    await printer.print(`\nType "help <command>" for detailed information about a specific command.`);
    await printer.print("Use <Tab> for autocompletion and <Up/Down> arrows to navigate history.\n");

    return { output: '', success: true }; // Output is handled by direct printer calls
  }
};

// STYLES constant for direct use if needed (assuming it's exported or accessible)
// For now, direct ANSI codes might be used or this needs proper import if STYLES is from terminalPrint
const STYLES = {
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

// Auto-register the command
commandRouter.register(helpCommand);