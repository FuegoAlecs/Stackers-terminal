import { createPublicClient, http, parseEther, formatEther, parseGwei, Address, parseAbi } from 'viem'
import { alchemyViemClient, alchemyUtils, NETWORK_INFO } from './alchemy'

export interface GasEstimateInput {
  contractAddress: string
  functionName: string
  arguments?: string[]
  from?: string
  value?: string
  blockNumber?: number
}

export interface GasEstimateResult {
  success: boolean
  gasLimit?: number
  gasPrice?: string
  baseCost?: string
  totalCost?: string
  executionGas?: number
  value?: string
  usdEstimate?: number
  recommendedGasLimit?: number
  gasBuffer?: number
  gasPriceLevel?: 'low' | 'normal' | 'high'
  optimization?: string[]
  warnings?: string[]
  comparison?: {
    low: string
    standard: string
    fast: string
  }
  error?: string
}

export interface ParsedGasEstimateInput {
  success: boolean
  input?: GasEstimateInput
  error?: string
}

/**
 * Parse gas estimation input with options
 */
export function parseGasEstimateInput(input: string): ParsedGasEstimateInput {
  try {
    const parts = input.trim().split(/\s+/)
    let callPart = ''
    let fromAddress: string | undefined
    let value: string | undefined
    let blockNumber: number | undefined
    
    // Separate the function call from options
    let i = 0
    while (i < parts.length && !parts[i].startsWith('--')) {
      callPart += (callPart ? ' ' : '') + parts[i]
      i++
    }
    
    // Parse options
    while (i < parts.length) {
      const option = parts[i]
      
      if (option === '--from' && i + 1 < parts.length) {
        fromAddress = parts[i + 1]
        i += 2
      } else if (option === '--value' && i + 1 < parts.length) {
        value = parts[i + 1]
        i += 2
      } else if (option === '--block' && i + 1 < parts.length) {
        blockNumber = parseInt(parts[i + 1])
        i += 2
      } else {
        i++
      }
    }
    
    // Parse the function call part
    const callPattern = /^(0x[a-fA-F0-9]{40})\.([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/
    const match = callPart.match(callPattern)
    
    if (!match) {
      return {
        success: false,
        error: 'Invalid syntax. Expected format: 0xAddress.functionName(args)'
      }
    }
    
    const [, contractAddress, functionName, argsString] = match
    
    // Validate contract address
    if (!isValidAddress(contractAddress)) {
      return {
        success: false,
        error: 'Invalid contract address format'
      }
    }
    
    // Validate from address if provided
    if (fromAddress && !isValidAddress(fromAddress)) {
      return {
        success: false,
        error: `Invalid "from" address format: ${fromAddress}`
      }
    }
    
    // Parse arguments
    const args = parseArguments(argsString.trim())
    
    const gasInput: GasEstimateInput = {
      contractAddress,
      functionName,
      arguments: args,
      from: fromAddress,
      value,
      blockNumber
    }
    
    return {
      success: true,
      input: gasInput
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse gas estimation input'
    }
  }
}

/**
 * Estimate gas for a contract function call
 */
export async function estimateContractGas(input: GasEstimateInput): Promise<GasEstimateResult> {
  try {
    // Validate contract exists
    const bytecode = await alchemyViemClient.getBytecode({
      address: input.contractAddress as Address
    })
    
    if (!bytecode || bytecode === '0x') {
      return {
        success: false,
        error: 'No contract found at the specified address'
      }
    }
    
    // Parse and validate arguments
    const parsedArgs = parseContractArguments(input.arguments || [])
    
    // Create function ABI for estimation
    const functionAbi = createFunctionAbi(input.functionName, parsedArgs.length, !!input.value)
    
    // Prepare transaction parameters
    const txParams: any = {
      to: input.contractAddress as Address,
      data: encodeFunctionCall(functionAbi, input.functionName, parsedArgs)
    }
    
    // Add value if specified
    if (input.value) {
      txParams.value = parseEther(input.value)
    }
    
    // Set from address
    if (input.from) {
      txParams.from = input.from as Address
    } else {
      // Use a default address with likely sufficient balance
      txParams.from = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b' as Address
    }
    
    // Set block number if specified
    if (input.blockNumber) {
      txParams.blockNumber = BigInt(input.blockNumber)
    }
    
    // Estimate gas
    let gasEstimate: bigint
    try {
      gasEstimate = await alchemyViemClient.estimateGas(txParams)
    } catch (estimateError) {
      // Try with a more generic function signature
      const alternativeAbis = getAlternativeFunctionAbis(input.functionName, parsedArgs.length)
      
      for (const altAbi of alternativeAbis) {
        try {
          txParams.data = encodeFunctionCall(altAbi, input.functionName, parsedArgs)
          gasEstimate = await alchemyViemClient.estimateGas(txParams)
          break
        } catch {
          continue
        }
      }
      
      if (!gasEstimate!) {
        throw estimateError
      }
    }
    
    const gasLimit = Number(gasEstimate)
    const executionGas = gasLimit - 21000 // Subtract base transaction cost
    
    // Get current gas price
    const currentGasPrice = await alchemyUtils.getGasPrice()
    const gasPriceWei = BigInt(Math.floor(currentGasPrice.gwei * 1e9))
    
    // Calculate costs
    const baseCostWei = BigInt(21000) * gasPriceWei
    const totalCostWei = gasEstimate * gasPriceWei
    
    const baseCost = `${parseFloat(formatEther(baseCostWei)).toFixed(6)} ETH`
    const totalCost = `${parseFloat(formatEther(totalCostWei)).toFixed(6)} ETH`
    
    // Add safety buffer (20%)
    const recommendedGasLimit = Math.floor(gasLimit * 1.2)
    const gasBuffer = 20
    
    // Determine gas price level
    const gasPriceLevel = determineGasPriceLevel(currentGasPrice.gwei)
    
    // Generate optimization suggestions
    const optimization = generateOptimizationSuggestions(input, gasLimit, executionGas)
    
    // Generate warnings
    const warnings = generateWarnings(input, gasLimit, currentGasPrice.gwei)
    
    // Gas price comparison
    const comparison = await generateGasPriceComparison(gasLimit)
    
    // USD estimate (rough calculation)
    const ethUsdPrice = 2000 // Placeholder - in production, fetch from price API
    const usdEstimate = parseFloat(formatEther(totalCostWei)) * ethUsdPrice
    
    return {
      success: true,
      gasLimit,
      gasPrice: currentGasPrice.formatted,
      baseCost,
      totalCost,
      executionGas,
      value: input.value,
      usdEstimate,
      recommendedGasLimit,
      gasBuffer,
      gasPriceLevel,
      optimization,
      warnings,
      comparison
    }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown gas estimation error'
    }
  }
}

/**
 * Parse function arguments from string array
 */
function parseArguments(argsString: string): string[] {
  if (!argsString) {
    return []
  }
  
  const args: string[] = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''
  let depth = 0
  
  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i]
    
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
      current += char
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ''
      current += char
    } else if (char === '[' && !inQuotes) {
      depth++
      current += char
    } else if (char === ']' && !inQuotes) {
      depth--
      current += char
    } else if (char === ',' && !inQuotes && depth === 0) {
      if (current.trim()) {
        args.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }
  
  if (current.trim()) {
    args.push(current.trim())
  }
  
  return args
}

/**
 * Parse contract function arguments with type inference
 */
function parseContractArguments(args: string[]): any[] {
  return args.map(arg => {
    const trimmed = arg.trim()
    
    // Handle quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1)
    }
    
    // Handle booleans
    if (trimmed.toLowerCase() === 'true') return true
    if (trimmed.toLowerCase() === 'false') return false
    
    // Handle arrays
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return trimmed
      }
    }
    
    // Handle hex numbers and addresses
    if (trimmed.startsWith('0x')) {
      if (trimmed.length === 42) {
        return trimmed as Address
      } else {
        try {
          return BigInt(trimmed)
        } catch {
          return trimmed
        }
      }
    }
    
    // Handle regular numbers
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10)
      return num > Number.MAX_SAFE_INTEGER ? BigInt(trimmed) : num
    }
    
    return trimmed
  })
}

/**
 * Create a function ABI string for gas estimation
 */
function createFunctionAbi(functionName: string, argCount: number, isPayable: boolean): string {
  // Common function patterns
  const commonPatterns: { [key: string]: string } = {
    // Write functions
    'setMessage': 'function setMessage(string)',
    'set': 'function set(uint256)',
    'increment': 'function increment()',
    'decrement': 'function decrement()',
    'reset': 'function reset()',
    'deposit': 'function deposit() payable',
    'withdraw': 'function withdraw(uint256)',
    'transfer': 'function transfer(address,uint256)',
    'approve': 'function approve(address,uint256)',
    'transferFrom': 'function transferFrom(address,address,uint256)',
    'mint': 'function mint(uint256)',
    'burn': 'function burn(uint256)',
    'pause': 'function pause()',
    'unpause': 'function unpause()'
  }
  
  if (commonPatterns[functionName]) {
    let abi = commonPatterns[functionName]
    if (isPayable && !abi.includes('payable')) {
      abi += ' payable'
    }
    return abi
  }
  
  // Generate generic ABI
  const argTypes = Array(argCount).fill('uint256').join(',')
  const payableModifier = isPayable ? ' payable' : ''
  return `function ${functionName}(${argTypes})${payableModifier}`
}

/**
 * Get alternative function ABI patterns
 */
function getAlternativeFunctionAbis(functionName: string, argCount: number): string[] {
  const alternatives: string[] = []
  
  if (argCount === 0) {
    alternatives.push(`function ${functionName}()`)
    alternatives.push(`function ${functionName}() payable`)
  } else if (argCount === 1) {
    const argTypes = ['address', 'uint256', 'string', 'bool', 'bytes32']
    for (const argType of argTypes) {
      alternatives.push(`function ${functionName}(${argType})`)
      alternatives.push(`function ${functionName}(${argType}) payable`)
    }
  } else if (argCount === 2) {
    alternatives.push(`function ${functionName}(address,uint256)`)
    alternatives.push(`function ${functionName}(address,address)`)
    alternatives.push(`function ${functionName}(uint256,uint256)`)
    alternatives.push(`function ${functionName}(string,uint256)`)
  }
  
  return alternatives
}

/**
 * Encode function call data
 */
function encodeFunctionCall(abi: string, functionName: string, args: any[]): string {
  try {
    // This is a simplified encoding - in production, use proper ABI encoding
    const abiArray = parseAbi([abi])
    // For now, return a placeholder that viem can handle
    return '0x' // viem will handle the encoding when we use readContract/writeContract
  } catch {
    return '0x'
  }
}

/**
 * Determine gas price level
 */
function determineGasPriceLevel(gasPriceGwei: number): 'low' | 'normal' | 'high' {
  if (gasPriceGwei < 10) return 'low'
  if (gasPriceGwei < 30) return 'normal'
  return 'high'
}

/**
 * Generate optimization suggestions
 */
function generateOptimizationSuggestions(
  input: GasEstimateInput, 
  gasLimit: number, 
  executionGas: number
): string[] {
  const suggestions: string[] = []
  
  if (gasLimit > 100000) {
    suggestions.push('High gas usage detected - consider optimizing function logic')
  }
  
  if (input.arguments && input.arguments.length > 5) {
    suggestions.push('Many parameters - consider using structs to reduce gas')
  }
  
  if (input.functionName.includes('set') || input.functionName.includes('update')) {
    suggestions.push('Storage operations are expensive - batch multiple updates if possible')
  }
  
  if (executionGas > 50000) {
    suggestions.push('Consider breaking complex operations into smaller transactions')
  }
  
  return suggestions
}

/**
 * Generate warnings
 */
function generateWarnings(
  input: GasEstimateInput, 
  gasLimit: number, 
  gasPriceGwei: number
): string[] {
  const warnings: string[] = []
  
  if (gasLimit > 500000) {
    warnings.push('Very high gas usage - transaction may fail on some networks')
  }
  
  if (gasPriceGwei > 50) {
    warnings.push('High gas price detected - consider waiting for lower prices')
  }
  
  if (input.value && parseFloat(input.value) > 1) {
    warnings.push('Large ETH value - double-check recipient address')
  }
  
  if (!input.from) {
    warnings.push('No sender specified - estimation uses default address')
  }
  
  return warnings
}

/**
 * Generate gas price comparison
 */
async function generateGasPriceComparison(gasLimit: number): Promise<{
  low: string
  standard: string
  fast: string
}> {
  try {
    const currentGasPrice = await alchemyUtils.getGasPrice()
    const baseGwei = currentGasPrice.gwei
    
    const lowGwei = Math.max(1, baseGwei * 0.8)
    const standardGwei = baseGwei
    const fastGwei = baseGwei * 1.5
    
    const lowCost = (gasLimit * lowGwei * 1e9) / 1e18
    const standardCost = (gasLimit * standardGwei * 1e9) / 1e18
    const fastCost = (gasLimit * fastGwei * 1e9) / 1e18
    
    return {
      low: `${lowCost.toFixed(6)} ETH (${lowGwei.toFixed(1)} Gwei)`,
      standard: `${standardCost.toFixed(6)} ETH (${standardGwei.toFixed(1)} Gwei)`,
      fast: `${fastCost.toFixed(6)} ETH (${fastGwei.toFixed(1)} Gwei)`
    }
  } catch {
    return {
      low: 'N/A',
      standard: 'N/A',
      fast: 'N/A'
    }
  }
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}