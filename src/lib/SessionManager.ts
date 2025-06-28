export interface SessionData {
  wallet: {
    address?: string
    isConnected: boolean
    chainId?: number
    networkName?: string
  }
  smartWallet: {
    address?: string
    isInitialized: boolean
    gasless: boolean
    owner?: string
  }
  aliases: { [key: string]: string }
  commandHistory: string[]
  abis: { [key: string]: any[] }
  scripts: { [key: string]: string[] }
  lastUpdated: string
}

export class SessionManager {
  private readonly storageKey = 'terminal-session'
  private readonly maxHistorySize = 1000
  private readonly maxScripts = 50
  private session: SessionData

  constructor() {
    this.session = this.getDefaultSession()
    this.loadFromStorage()
  }

  /**
   * Get default session structure
   */
  private getDefaultSession(): SessionData {
    return {
      wallet: {
        isConnected: false
      },
      smartWallet: {
        isInitialized: false,
        gasless: false
      },
      aliases: {},
      commandHistory: [],
      abis: {},
      scripts: {},
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Update wallet information
   */
  updateWallet(walletInfo: Partial<SessionData['wallet']>): void {
    this.session.wallet = { ...this.session.wallet, ...walletInfo }
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Update smart wallet information
   */
  updateSmartWallet(smartWalletInfo: Partial<SessionData['smartWallet']>): void {
    this.session.smartWallet = { ...this.session.smartWallet, ...smartWalletInfo }
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Add command to history
   */
  addToHistory(command: string): void {
    const trimmed = command.trim()
    if (!trimmed) return

    // Don't add duplicate consecutive commands
    if (this.session.commandHistory.length > 0 && 
        this.session.commandHistory[this.session.commandHistory.length - 1] === trimmed) {
      return
    }

    this.session.commandHistory.push(trimmed)

    // Keep history within size limit
    if (this.session.commandHistory.length > this.maxHistorySize) {
      this.session.commandHistory = this.session.commandHistory.slice(-this.maxHistorySize)
    }

    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return [...this.session.commandHistory]
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.session.commandHistory = []
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Set alias
   */
  setAlias(name: string, command: string): void {
    this.session.aliases[name] = command
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Remove alias
   */
  removeAlias(name: string): boolean {
    if (this.session.aliases[name]) {
      delete this.session.aliases[name]
      this.session.lastUpdated = new Date().toISOString()
      this.saveToStorage()
      return true
    }
    return false
  }

  /**
   * Get all aliases
   */
  getAliases(): { [key: string]: string } {
    return { ...this.session.aliases }
  }

  /**
   * Clear all aliases
   */
  clearAliases(): void {
    this.session.aliases = {}
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Save script
   */
  saveScript(name: string, commands: string[]): boolean {
    if (Object.keys(this.session.scripts).length >= this.maxScripts && !this.session.scripts[name]) {
      return false
    }

    this.session.scripts[name] = [...commands]
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
    return true
  }

  /**
   * Get script
   */
  getScript(name: string): string[] | undefined {
    return this.session.scripts[name] ? [...this.session.scripts[name]] : undefined
  }

  /**
   * List all scripts
   */
  listScripts(): Array<{ name: string; commands: number; preview: string }> {
    return Object.entries(this.session.scripts).map(([name, commands]) => ({
      name,
      commands: commands.length,
      preview: commands.length > 0 ? commands[0] : ''
    }))
  }

  /**
   * Remove script
   */
  removeScript(name: string): boolean {
    if (this.session.scripts[name]) {
      delete this.session.scripts[name]
      this.session.lastUpdated = new Date().toISOString()
      this.saveToStorage()
      return true
    }
    return false
  }

  /**
   * Clear all scripts
   */
  clearScripts(): void {
    this.session.scripts = {}
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Update ABI data
   */
  updateABIs(abis: { [key: string]: any[] }): void {
    this.session.abis = { ...abis }
    this.session.lastUpdated = new Date().toISOString()
    this.saveToStorage()
  }

  /**
   * Get session data
   */
  getSession(): SessionData {
    return { ...this.session }
  }

  /**
   * Get session statistics
   */
  getStats(): {
    historySize: number
    aliasCount: number
    abiCount: number
    scriptCount: number
    lastUpdated: string
    sessionAge: string
  } {
    const now = new Date()
    const lastUpdate = new Date(this.session.lastUpdated)
    const ageMs = now.getTime() - lastUpdate.getTime()
    const ageMinutes = Math.floor(ageMs / 60000)
    const ageHours = Math.floor(ageMinutes / 60)
    const ageDays = Math.floor(ageHours / 24)

    let sessionAge = ''
    if (ageDays > 0) {
      sessionAge = `${ageDays} day${ageDays > 1 ? 's' : ''} ago`
    } else if (ageHours > 0) {
      sessionAge = `${ageHours} hour${ageHours > 1 ? 's' : ''} ago`
    } else if (ageMinutes > 0) {
      sessionAge = `${ageMinutes} minute${ageMinutes > 1 ? 's' : ''} ago`
    } else {
      sessionAge = 'Just now'
    }

    return {
      historySize: this.session.commandHistory.length,
      aliasCount: Object.keys(this.session.aliases).length,
      abiCount: Object.keys(this.session.abis).length,
      scriptCount: Object.keys(this.session.scripts).length,
      lastUpdated: this.session.lastUpdated,
      sessionAge
    }
  }

  /**
   * Export session data
   */
  export(): string {
    return JSON.stringify({
      ...this.session,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }, null, 2)
  }

  /**
   * Import session data
   */
  import(jsonData: string): { success: boolean; errors: string[] } {
    try {
      const data = JSON.parse(jsonData)
      const errors: string[] = []

      // Validate structure
      if (!data.wallet || !data.smartWallet) {
        errors.push('Invalid session format: missing wallet data')
      }

      if (!Array.isArray(data.commandHistory)) {
        errors.push('Invalid command history format')
      }

      if (typeof data.aliases !== 'object') {
        errors.push('Invalid aliases format')
      }

      if (errors.length > 0) {
        return { success: false, errors }
      }

      // Import data with validation
      this.session = {
        wallet: data.wallet || this.getDefaultSession().wallet,
        smartWallet: data.smartWallet || this.getDefaultSession().smartWallet,
        aliases: data.aliases || {},
        commandHistory: Array.isArray(data.commandHistory) ? 
          data.commandHistory.slice(-this.maxHistorySize) : [],
        abis: data.abis || {},
        scripts: data.scripts || {},
        lastUpdated: new Date().toISOString()
      }

      this.saveToStorage()
      return { success: true, errors: [] }

    } catch (error) {
      return {
        success: false,
        errors: [`JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  /**
   * Reset session to defaults
   */
  reset(): void {
    this.session = this.getDefaultSession()
    this.saveToStorage()
  }

  /**
   * Save session to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.session))
    } catch (error) {
      console.warn('Failed to save session to localStorage:', error)
    }
  }

  /**
   * Load session from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (!stored) return

      const data = JSON.parse(stored)
      
      // Merge with default session to handle missing fields
      this.session = {
        ...this.getDefaultSession(),
        ...data,
        lastUpdated: data.lastUpdated || new Date().toISOString()
      }

      // Validate and clean up data
      if (!Array.isArray(this.session.commandHistory)) {
        this.session.commandHistory = []
      }

      if (typeof this.session.aliases !== 'object') {
        this.session.aliases = {}
      }

      if (typeof this.session.scripts !== 'object') {
        this.session.scripts = {}
      }

    } catch (error) {
      console.warn('Failed to load session from localStorage:', error)
      localStorage.removeItem(this.storageKey)
      this.session = this.getDefaultSession()
    }
  }
}

// Singleton instance
export const sessionManager = new SessionManager()