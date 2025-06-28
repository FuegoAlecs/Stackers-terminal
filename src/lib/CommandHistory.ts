export class CommandHistory {
  private history: string[] = []
  private maxSize: number = 1000

  /**
   * Add a command to history
   */
  add(command: string): void {
    const trimmed = command.trim()
    if (!trimmed) return

    // Don't add duplicate consecutive commands
    if (this.history.length > 0 && this.history[this.history.length - 1] === trimmed) {
      return
    }

    // Don't add history commands themselves to avoid recursion
    if (trimmed.startsWith('history') || trimmed.startsWith('!!') || trimmed.startsWith('!')) {
      return
    }

    this.history.push(trimmed)

    // Keep history within size limit
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize)
    }
  }

  /**
   * Get all history entries
   */
  getAll(): string[] {
    return [...this.history]
  }

  /**
   * Get recent history entries
   */
  getRecent(count: number): string[] {
    return this.history.slice(-count)
  }

  /**
   * Get command by index (1-based)
   */
  getByIndex(index: number): string | null {
    if (index < 1 || index > this.history.length) {
      return null
    }
    return this.history[index - 1]
  }

  /**
   * Get last command
   */
  getLast(): string | null {
    if (this.history.length === 0) {
      return null
    }
    return this.history[this.history.length - 1]
  }

  /**
   * Get command by negative index (from end)
   */
  getFromEnd(index: number): string | null {
    if (index < 1 || index > this.history.length) {
      return null
    }
    return this.history[this.history.length - index]
  }

  /**
   * Search history for commands containing text
   */
  search(text: string): Array<{ index: number; command: string }> {
    const results: Array<{ index: number; command: string }> = []
    
    this.history.forEach((command, index) => {
      if (command.toLowerCase().includes(text.toLowerCase())) {
        results.push({
          index: index + 1,
          command
        })
      }
    })
    
    return results
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = []
  }

  /**
   * Get history size
   */
  size(): number {
    return this.history.length
  }

  /**
   * Export history as JSON
   */
  export(): string {
    return JSON.stringify({
      history: this.history,
      timestamp: new Date().toISOString(),
      size: this.history.length
    }, null, 2)
  }

  /**
   * Import history from JSON
   */
  import(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData)
      if (Array.isArray(data.history)) {
        this.history = data.history.slice(-this.maxSize)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Parse history expansion commands (!! and !n)
   */
  expandCommand(input: string): { expanded: string; original: string } | null {
    const trimmed = input.trim()
    
    // Handle !! (repeat last command)
    if (trimmed === '!!') {
      const lastCommand = this.getLast()
      if (lastCommand) {
        return {
          expanded: lastCommand,
          original: trimmed
        }
      }
      return null
    }
    
    // Handle !n (repeat command by index)
    const indexMatch = trimmed.match(/^!(\d+)$/)
    if (indexMatch) {
      const index = parseInt(indexMatch[1], 10)
      const command = this.getByIndex(index)
      if (command) {
        return {
          expanded: command,
          original: trimmed
        }
      }
      return null
    }
    
    // Handle !-n (repeat command from end)
    const negativeMatch = trimmed.match(/^!-(\d+)$/)
    if (negativeMatch) {
      const index = parseInt(negativeMatch[1], 10)
      const command = this.getFromEnd(index)
      if (command) {
        return {
          expanded: command,
          original: trimmed
        }
      }
      return null
    }
    
    // Handle !text (repeat last command starting with text)
    const textMatch = trimmed.match(/^!(.+)$/)
    if (textMatch) {
      const searchText = textMatch[1]
      
      // Search from end to find most recent match
      for (let i = this.history.length - 1; i >= 0; i--) {
        if (this.history[i].startsWith(searchText)) {
          return {
            expanded: this.history[i],
            original: trimmed
          }
        }
      }
      return null
    }
    
    return null
  }
}

// Singleton instance
export const commandHistory = new CommandHistory()