export class ABIManager {
  private abis: Map<string, any[]> = new Map()
  private readonly storageKey = 'terminal-abis'
  private readonly maxABIs = 50

  constructor() {
    this.loadFromStorage()
    this.loadCommonABIs()
  }

  /**
   * Load an ABI with a name
   */
  loadABI(name: string, abi: any[]): boolean {
    try {
      // Validate ABI format
      if (!Array.isArray(abi)) {
        return false
      }

      // Basic ABI validation
      for (const item of abi) {
        if (!item.type || !['function', 'event', 'constructor', 'fallback', 'receive'].includes(item.type)) {
          return false
        }
      }

      // Check size limit
      if (!this.abis.has(name) && this.abis.size >= this.maxABIs) {
        return false
      }

      this.abis.set(name, abi)
      this.saveToStorage()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get ABI by name
   */
  getABI(name: string): any[] | undefined {
    return this.abis.get(name)
  }

  /**
   * List all loaded ABIs
   */
  listABIs(): Array<{ name: string; functions: number; events: number }> {
    return Array.from(this.abis.entries()).map(([name, abi]) => {
      const functions = abi.filter(item => item.type === 'function').length
      const events = abi.filter(item => item.type === 'event').length
      return { name, functions, events }
    })
  }

  /**
   * Remove ABI
   */
  removeABI(name: string): boolean {
    const existed = this.abis.has(name)
    this.abis.delete(name)
    if (existed) {
      this.saveToStorage()
    }
    return existed
  }

  /**
   * Clear all ABIs
   */
  clear(): void {
    this.abis.clear()
    this.saveToStorage()
    this.loadCommonABIs() // Reload common ABIs
  }

  /**
   * Get function signature from ABI
   */
  getFunctionBySelector(selector: string): { name: string; abi: any; abiName: string } | null {
    for (const [abiName, abi] of this.abis) {
      for (const item of abi) {
        if (item.type === 'function') {
          const signature = this.getFunctionSignature(item)
          const computedSelector = this.computeSelector(signature)
          if (computedSelector === selector.toLowerCase()) {
            return { name: abiName, abi: item, abiName }
          }
        }
      }
    }
    return null
  }

  /**
   * Get event signature from ABI
   */
  getEventByTopic(topic: string): { name: string; abi: any; abiName: string } | null {
    for (const [abiName, abi] of this.abis) {
      for (const item of abi) {
        if (item.type === 'event') {
          const signature = this.getEventSignature(item)
          const computedTopic = this.computeEventTopic(signature)
          if (computedTopic === topic.toLowerCase()) {
            return { name: abiName, abi: item, abiName }
          }
        }
      }
    }
    return null
  }

  /**
   * Search for functions by name
   */
  searchFunctions(query: string): Array<{ abiName: string; function: any; signature: string }> {
    const results: Array<{ abiName: string; function: any; signature: string }> = []
    const lowerQuery = query.toLowerCase()

    for (const [abiName, abi] of this.abis) {
      for (const item of abi) {
        if (item.type === 'function' && item.name?.toLowerCase().includes(lowerQuery)) {
          results.push({
            abiName,
            function: item,
            signature: this.getFunctionSignature(item)
          })
        }
      }
    }

    return results
  }

  /**
   * Export ABIs as JSON
   */
  export(): string {
    const data = {
      abis: Object.fromEntries(this.abis),
      timestamp: new Date().toISOString(),
      count: this.abis.size
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import ABIs from JSON
   */
  import(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    try {
      const data = JSON.parse(jsonData)
      const errors: string[] = []
      let imported = 0

      if (!data.abis || typeof data.abis !== 'object') {
        return {
          success: false,
          imported: 0,
          errors: ['Invalid format: missing or invalid abis object']
        }
      }

      for (const [name, abi] of Object.entries(data.abis)) {
        if (!Array.isArray(abi)) {
          errors.push(`Skipped ${name}: ABI must be an array`)
          continue
        }

        if (this.abis.size + imported >= this.maxABIs) {
          errors.push(`Skipped ${name}: maximum ABIs limit reached`)
          break
        }

        if (this.loadABI(name, abi as any[])) {
          imported++
        } else {
          errors.push(`Skipped ${name}: invalid ABI format`)
        }
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
   * Get function signature
   */
  private getFunctionSignature(func: any): string {
    const inputs = func.inputs || []
    const types = inputs.map((input: any) => input.type).join(',')
    return `${func.name}(${types})`
  }

  /**
   * Get event signature
   */
  private getEventSignature(event: any): string {
    const inputs = event.inputs || []
    const types = inputs.map((input: any) => input.type).join(',')
    return `${event.name}(${types})`
  }

  /**
   * Compute function selector (first 4 bytes of keccak256)
   */
  private computeSelector(signature: string): string {
    // This is a simplified implementation
    // In production, use a proper keccak256 implementation
    return '0x' + this.simpleHash(signature).slice(0, 8)
  }

  /**
   * Compute event topic (keccak256 of signature)
   */
  private computeEventTopic(signature: string): string {
    return '0x' + this.simpleHash(signature)
  }

  /**
   * Simple hash function (placeholder for keccak256)
   */
  private simpleHash(input: string): string {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0')
  }

  /**
   * Load common ABIs
   */
  private loadCommonABIs(): void {
    // ERC20 ABI
    const erc20ABI = [
      {
        "type": "function",
        "name": "name",
        "inputs": [],
        "outputs": [{"type": "string", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "symbol",
        "inputs": [],
        "outputs": [{"type": "string", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "decimals",
        "inputs": [],
        "outputs": [{"type": "uint8", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "totalSupply",
        "inputs": [],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "balanceOf",
        "inputs": [{"type": "address", "name": "account"}],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "transfer",
        "inputs": [
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "approve",
        "inputs": [
          {"type": "address", "name": "spender"},
          {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "transferFrom",
        "inputs": [
          {"type": "address", "name": "from"},
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "amount"}
        ],
        "outputs": [{"type": "bool", "name": ""}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "allowance",
        "inputs": [
          {"type": "address", "name": "owner"},
          {"type": "address", "name": "spender"}
        ],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "event",
        "name": "Transfer",
        "inputs": [
          {"type": "address", "name": "from", "indexed": true},
          {"type": "address", "name": "to", "indexed": true},
          {"type": "uint256", "name": "value", "indexed": false}
        ]
      },
      {
        "type": "event",
        "name": "Approval",
        "inputs": [
          {"type": "address", "name": "owner", "indexed": true},
          {"type": "address", "name": "spender", "indexed": true},
          {"type": "uint256", "name": "value", "indexed": false}
        ]
      }
    ]

    // ERC721 ABI (basic)
    const erc721ABI = [
      {
        "type": "function",
        "name": "name",
        "inputs": [],
        "outputs": [{"type": "string", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "symbol",
        "inputs": [],
        "outputs": [{"type": "string", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "tokenURI",
        "inputs": [{"type": "uint256", "name": "tokenId"}],
        "outputs": [{"type": "string", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "ownerOf",
        "inputs": [{"type": "uint256", "name": "tokenId"}],
        "outputs": [{"type": "address", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "balanceOf",
        "inputs": [{"type": "address", "name": "owner"}],
        "outputs": [{"type": "uint256", "name": ""}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "approve",
        "inputs": [
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "tokenId"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "transferFrom",
        "inputs": [
          {"type": "address", "name": "from"},
          {"type": "address", "name": "to"},
          {"type": "uint256", "name": "tokenId"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      }
    ]

    this.abis.set('ERC20', erc20ABI)
    this.abis.set('ERC721', erc721ABI)
  }

  /**
   * Save ABIs to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        abis: Object.fromEntries(this.abis),
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save ABIs to localStorage:', error)
    }
  }

  /**
   * Load ABIs from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (!stored) return

      const data = JSON.parse(stored)
      if (data.abis && typeof data.abis === 'object') {
        this.abis = new Map(Object.entries(data.abis))
      }
    } catch (error) {
      console.warn('Failed to load ABIs from localStorage:', error)
      localStorage.removeItem(this.storageKey)
    }
  }
}

// Singleton instance
export const abiManager = new ABIManager()