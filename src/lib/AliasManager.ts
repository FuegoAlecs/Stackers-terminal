export class AliasManager {
  private aliases: Map<string, string> = new Map()
  private readonly storageKey = 'terminal-aliases'
  private readonly maxAliases = 100

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Create or update an alias
   */
  set(name: string, command: string): boolean {
    // Validate alias name
    if (!this.isValidAliasName(name)) {
      return false
    }

    // Prevent recursive aliases
    if (this.wouldCreateRecursion(name, command)) {
      return false
    }

    // Check size limit
    if (!this.aliases.has(name) && this.aliases.size >= this.maxAliases) {
      return false
    }

    this.aliases.set(name, command)
    this.saveToStorage()
    return true
  }

  /**
   * Remove an alias
   */
  remove(name: string): boolean {
    const existed = this.aliases.has(name)
    this.aliases.delete(name)
    if (existed) {
      this.saveToStorage()
    }
    return existed
  }

  /**
   * Get alias command
   */
  get(name: string): string | undefined {
    return this.aliases.get(name)
  }

  /**
   * Check if alias exists
   */
  has(name: string): boolean {
    return this.aliases.has(name)
  }

  /**
   * Get all aliases
   */
  getAll(): Array<{ name: string; command: string }> {
    return Array.from(this.aliases.entries()).map(([name, command]) => ({
      name,
      command
    }))
  }

  /**
   * Clear all aliases
   */
  clear(): void {
    this.aliases.clear()
    this.saveToStorage()
  }

  /**
   * Get aliases count
   */
  size(): number {
    return this.aliases.size
  }

  /**
   * Expand alias if it exists
   */
  expand(input: string): string {
    const parts = input.trim().split(/\s+/)
    if (parts.length === 0) return input

    const firstWord = parts[0]
    const aliasCommand = this.aliases.get(firstWord)
    
    if (aliasCommand) {
      // Replace the alias with its command, keeping any additional arguments
      const remainingArgs = parts.slice(1).join(' ')
      return remainingArgs ? `${aliasCommand} ${remainingArgs}` : aliasCommand
    }

    return input
  }

  /**
   * Search aliases by name or command
   */
  search(query: string): Array<{ name: string; command: string }> {
    const results: Array<{ name: string; command: string }> = []
    const lowerQuery = query.toLowerCase()

    for (const [name, command] of this.aliases) {
      if (name.toLowerCase().includes(lowerQuery) || 
          command.toLowerCase().includes(lowerQuery)) {
        results.push({ name, command })
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Export aliases as JSON
   */
  export(): string {
    const data = {
      aliases: Object.fromEntries(this.aliases),
      timestamp: new Date().toISOString(),
      count: this.aliases.size
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import aliases from JSON
   */
  import(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    try {
      const data = JSON.parse(jsonData)
      const errors: string[] = []
      let imported = 0

      if (!data.aliases || typeof data.aliases !== 'object') {
        return {
          success: false,
          imported: 0,
          errors: ['Invalid format: missing or invalid aliases object']
        }
      }

      for (const [name, command] of Object.entries(data.aliases)) {
        if (typeof command !== 'string') {
          errors.push(`Skipped ${name}: command must be a string`)
          continue
        }

        if (!this.isValidAliasName(name)) {
          errors.push(`Skipped ${name}: invalid alias name`)
          continue
        }

        if (this.wouldCreateRecursion(name, command)) {
          errors.push(`Skipped ${name}: would create recursion`)
          continue
        }

        if (this.aliases.size + imported >= this.maxAliases) {
          errors.push(`Skipped ${name}: maximum aliases limit reached`)
          break
        }

        this.aliases.set(name, command)
        imported++
      }

      if (imported > 0) {
        this.saveToStorage()
      }

      return {
        success: imported > 0,
        imported,
        errors
      }
    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  /**
   * Get alias suggestions for tab completion
   */
  getSuggestions(partial: string): string[] {
    const lowerPartial = partial.toLowerCase()
    return Array.from(this.aliases.keys())
      .filter(name => name.startsWith(lowerPartial))
      .sort()
  }

  /**
   * Validate alias name
   */
  private isValidAliasName(name: string): boolean {
    // Must be non-empty, alphanumeric + underscore, not start with number
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && 
           name.length <= 50 &&
           !this.isReservedName(name)
  }

  /**
   * Check if name is reserved (built-in commands)
   */
  private isReservedName(name: string): boolean {
    const reserved = [
      'help', 'clear', 'echo', 'date', 'history', 'alias', 'unalias',
      'wallet', 'smart', 'alchemy', 'call', 'write', 'deploy', 'compile',
      'simulate', 'gasEstimate', 'whoami', 'pwd', 'ls'
    ]
    return reserved.includes(name.toLowerCase())
  }

  /**
   * Check if alias would create recursion
   */
  private wouldCreateRecursion(name: string, command: string): boolean {
    const commandParts = command.trim().split(/\s+/)
    if (commandParts.length === 0) return false

    const firstWord = commandParts[0]
    
    // Direct recursion
    if (firstWord === name) {
      return true
    }

    // Indirect recursion - check if command starts with another alias
    // that eventually leads back to this name
    const visited = new Set<string>()
    return this.checkRecursion(firstWord, name, visited)
  }

  /**
   * Recursively check for alias cycles
   */
  private checkRecursion(currentAlias: string, targetName: string, visited: Set<string>): boolean {
    if (visited.has(currentAlias)) {
      return true // Cycle detected
    }

    const aliasCommand = this.aliases.get(currentAlias)
    if (!aliasCommand) {
      return false // Not an alias, no recursion
    }

    const commandParts = aliasCommand.trim().split(/\s+/)
    if (commandParts.length === 0) return false

    const firstWord = commandParts[0]
    if (firstWord === targetName) {
      return true // Would create recursion
    }

    visited.add(currentAlias)
    return this.checkRecursion(firstWord, targetName, visited)
  }

  /**
   * Save aliases to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        aliases: Object.fromEntries(this.aliases),
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save aliases to localStorage:', error)
    }
  }

  /**
   * Load aliases from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (!stored) return

      const data = JSON.parse(stored)
      if (data.aliases && typeof data.aliases === 'object') {
        this.aliases = new Map(Object.entries(data.aliases))
      }
    } catch (error) {
      console.warn('Failed to load aliases from localStorage:', error)
      // Clear corrupted data
      localStorage.removeItem(this.storageKey)
    }
  }
}

// Singleton instance
export const aliasManager = new AliasManager()