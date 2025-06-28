import { commandHistory } from './CommandHistory'
import { aliasManager } from './AliasManager'

export interface CommandContext {
  args: string[]
  rawInput: string
  terminal?: any
  printer?: any
  history?: string[]
}

export interface CommandResult {
  output: string
  success: boolean
  error?: string
}

export interface CommandHandler {
  name: string
  description: string
  usage?: string
  aliases?: string[]
  execute: (context: CommandContext) => Promise<CommandResult> | CommandResult
}

export class CommandRouter {
  private handlers = new Map<string, CommandHandler>()
  private aliases = new Map<string, string>()

  constructor() {
    this.loadCommands()
  }

  /**
   * Register a command handler
   */
  register(handler: CommandHandler): void {
    this.handlers.set(handler.name.toLowerCase(), handler)
    
    // Register aliases
    if (handler.aliases) {
      handler.aliases.forEach(alias => {
        this.aliases.set(alias.toLowerCase(), handler.name.toLowerCase())
      })
    }
  }

  /**
   * Parse and execute a command with history and alias support
   */
  async dispatch(input: string, context: Partial<CommandContext> = {}): Promise<CommandResult> {
    const trimmedInput = input.trim()
    
    if (!trimmedInput) {
      return { output: '', success: true }
    }

    // First, expand user-defined aliases
    const aliasExpanded = aliasManager.expand(trimmedInput)
    let finalInput = aliasExpanded
    let aliasUsed = aliasExpanded !== trimmedInput

    // Then check for history expansion (!! and !n)
    const expansion = commandHistory.expandCommand(finalInput)
    if (expansion) {
      finalInput = expansion.expanded
      
      // Show what command is being repeated, including alias expansion
      const expandedResult = await this.executeCommand(finalInput, context)
      
      let expansionNote = `Repeating: ${expansion.expanded}`
      if (aliasUsed) {
        expansionNote = `Alias expanded: ${trimmedInput} → ${aliasExpanded}\n${expansionNote}`
      }
      
      const output = expandedResult.output 
        ? `${expansionNote}\n\n${expandedResult.output}`
        : expansionNote
      
      return {
        ...expandedResult,
        output
      }
    }

    // Handle history expansion errors
    if (trimmedInput === '!!' || trimmedInput.match(/^!(-?\d+|.+)$/)) {
      if (trimmedInput === '!!') {
        return {
          output: 'No previous command to repeat.\nUse "history" to see available commands.',
          success: false,
          error: 'NO_HISTORY'
        }
      }
      
      const indexMatch = trimmedInput.match(/^!(-?\d+)$/)
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10)
        if (index < 0) {
          return {
            output: `No command found at position ${Math.abs(index)} from end.\nUse "history" to see available commands.`,
            success: false,
            error: 'INVALID_HISTORY_INDEX'
          }
        } else {
          return {
            output: `No command found at index ${index}.\nUse "history" to see available commands.`,
            success: false,
            error: 'INVALID_HISTORY_INDEX'
          }
        }
      }
      
      const textMatch = trimmedInput.match(/^!(.+)$/)
      if (textMatch) {
        const searchText = textMatch[1]
        return {
          output: `No previous command found starting with "${searchText}".\nUse "history search ${searchText}" to find matching commands.`,
          success: false,
          error: 'NO_MATCHING_HISTORY'
        }
      }
    }

    // Execute the command (with alias expansion if applicable)
    const result = await this.executeCommand(finalInput, context)
    
    // Add successful commands to history (but not history commands themselves)
    if (result.success || !result.error?.includes('COMMAND_NOT_FOUND')) {
      commandHistory.add(trimmedInput) // Add original input to history, not expanded
    }
    
    // Show alias expansion note if an alias was used
    if (aliasUsed && result.output) {
      const aliasNote = `Alias expanded: ${trimmedInput} → ${aliasExpanded}\n\n`
      result.output = aliasNote + result.output
    }
    
    return result
  }

  /**
   * Execute a command without history tracking
   */
  private async executeCommand(input: string, context: Partial<CommandContext> = {}): Promise<CommandResult> {
    const [commandName, ...args] = this.parseCommand(input)
    const normalizedName = commandName.toLowerCase()
    
    // Check for built-in command alias
    const actualCommand = this.aliases.get(normalizedName) || normalizedName
    const handler = this.handlers.get(actualCommand)

    if (!handler) {
      return {
        output: `Command not found: ${commandName}. Type "help" for available commands.`,
        success: false,
        error: 'COMMAND_NOT_FOUND'
      }
    }

    try {
      const commandContext: CommandContext = {
        args,
        rawInput: input,
        history: commandHistory.getAll(),
        ...context
      }

      const result = await handler.execute(commandContext)
      return result
    } catch (error) {
      return {
        output: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        error: 'EXECUTION_ERROR'
      }
    }
  }

  /**
   * Get all registered commands
   */
  getCommands(): CommandHandler[] {
    return Array.from(this.handlers.values())
  }

  /**
   * Get command suggestions for tab completion
   */
  getSuggestions(partial: string): string[] {
    const lowerPartial = partial.toLowerCase()
    const commands = Array.from(this.handlers.keys())
    const builtInAliases = Array.from(this.aliases.keys())
    const userAliases = aliasManager.getSuggestions(partial)
    
    // Add history expansion suggestions
    const historyExpansions = ['!!']
    const recentHistory = commandHistory.getRecent(10)
    recentHistory.forEach((cmd, index) => {
      const historyIndex = commandHistory.size() - recentHistory.length + index + 1
      historyExpansions.push(`!${historyIndex}`)
    })
    
    return [...commands, ...builtInAliases, ...userAliases, ...historyExpansions]
      .filter(name => name.startsWith(lowerPartial))
      .sort()
  }

  /**
   * Parse command string into command name and arguments
   */
  private parseCommand(input: string): string[] {
    const parts: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < input.length; i++) {
      const char = input[i]
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true
        quoteChar = char
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false
        quoteChar = ''
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current)
          current = ''
        }
      } else {
        current += char
      }
    }

    if (current) {
      parts.push(current)
    }

    return parts
  }

  /**
   * Load all command handlers
   */
  private async loadCommands(): Promise<void> {
    // Dynamic imports will be handled by individual command files
    // This method can be extended to auto-discover commands
  }

  /**
   * Get command history instance
   */
  getHistory(): typeof commandHistory {
    return commandHistory
  }

  /**
   * Get alias manager instance
   */
  getAliasManager(): typeof aliasManager {
    return aliasManager
  }
}

// Singleton instance
export const commandRouter = new CommandRouter()