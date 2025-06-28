import { createPublicClient, http, parseAbi, Address } from 'viem'
import { alchemyViemClient, NETWORK_INFO } from './alchemy'

export interface CallResult {
  success: boolean
  result?: any
  returnType?: string
  gasUsed?: number
  blockNumber?: number
  error?: string
}

export interface ContractInfo {
  success: boolean
  isContract: boolean
  bytecodeSize: number
  error?: string
}

export interface ParsedCall {
  success: boolean
  contractAddress?: string
  functionName?: string
  arguments?: string[]
  error?: string
}

/**
 * Parse function call input like "0xABC.greet()" or "0xDEF.balanceOf(0x123)"
 */
export function parseCallInput(input: string): ParsedCall {
  try {
    // Remove extra whitespace
    const cleanInput = input.trim()
    
    // Check for basic pattern: address.function(args)
    const callPattern = /^(0x[a-fA-F0-9]{40})\.([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/
    const match = cleanInput.match(callPattern)
    
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
    
    // Parse arguments
    const args = parseArguments(argsString.trim())
    
    return {
      success: true,
      contractAddress,
      functionName,
      arguments: args
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse call input'
    }
  }
}

/**
 * Parse function arguments from string
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
 * Call a read-only function on a smart contract
 */
export async function callContractFunction(
  contractAddress: string,
  functionName: string,
  args: string[]
): Promise<CallResult> {
  try {
    // Validate contract address
    if (!isValidAddress(contractAddress)) {
      return {
        success: false,
        error: 'Invalid contract address format'
      }
    }
    
    // Check if contract exists
    const contractInfo = await getContractInfo(contractAddress)
    if (!contractInfo.success || !contractInfo.isContract) {
      return {
        success: false,
        error: 'No contract found at the specified address'
      }
    }
    
    // Parse and validate arguments
    const parsedArgs = parseContractArguments(args)
    
    // Create a minimal ABI for the function call
    // We'll try common function signatures and let viem handle the encoding
    const functionAbi = createFunctionAbi(functionName, parsedArgs.length)
    
    try {
      // Attempt the contract call
      const result = await alchemyViemClient.readContract({
        address: contractAddress as Address,
        abi: parseAbi([functionAbi]),
        functionName: functionName,
        args: parsedArgs
      })
      
      // Get current block number for reference
      const blockNumber = await alchemyViemClient.getBlockNumber()
      
      return {
        success: true,
        result,
        blockNumber: Number(blockNumber),
        returnType: inferReturnType(result)
      }
    } catch (contractError) {
      // Try alternative function signatures if the first attempt fails
      const alternativeAbis = getAlternativeFunctionAbis(functionName, parsedArgs.length)
      
      for (const altAbi of alternativeAbis) {
        try {
          const result = await alchemyViemClient.readContract({
            address: contractAddress as Address,
            abi: parseAbi([altAbi]),
            functionName: functionName,
            args: parsedArgs
          })
          
          const blockNumber = await alchemyViemClient.getBlockNumber()
          
          return {
            success: true,
            result,
            blockNumber: Number(blockNumber),
            returnType: inferReturnType(result)
          }
        } catch {
          // Continue to next alternative
          continue
        }
      }
      
      // If all attempts failed, return the original error
      throw contractError
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during contract call'
    }
  }
}

/**
 * Get basic information about a contract
 */
export async function getContractInfo(contractAddress: string): Promise<ContractInfo> {
  try {
    if (!isValidAddress(contractAddress)) {
      return {
        success: false,
        isContract: false,
        bytecodeSize: 0,
        error: 'Invalid address format'
      }
    }
    
    // Get contract bytecode
    const bytecode = await alchemyViemClient.getBytecode({
      address: contractAddress as Address
    })
    
    const isContract = bytecode !== undefined && bytecode !== '0x'
    const bytecodeSize = bytecode ? (bytecode.length - 2) / 2 : 0
    
    return {
      success: true,
      isContract,
      bytecodeSize
    }
  } catch (error) {
    return {
      success: false,
      isContract: false,
      bytecodeSize: 0,
      error: error instanceof Error ? error.message : 'Failed to get contract info'
    }
  }
}

/**
 * Parse contract function arguments
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
    
    // Handle hex numbers
    if (trimmed.startsWith('0x')) {
      if (trimmed.length === 42) {
        // Likely an address
        return trimmed
      } else {
        // Likely a hex number
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
    
    // Return as string if nothing else matches
    return trimmed
  })
}

/**
 * Create a function ABI string for common function patterns
 */
function createFunctionAbi(functionName: string, argCount: number): string {
  // Common read-only function patterns
  const commonPatterns: { [key: string]: string } = {
    // No arguments
    'name': 'function name() view returns (string)',
    'symbol': 'function symbol() view returns (string)',
    'decimals': 'function decimals() view returns (uint8)',
    'totalSupply': 'function totalSupply() view returns (uint256)',
    'count': 'function count() view returns (uint256)',
    'get': 'function get() view returns (uint256)',
    'getCount': 'function getCount() view returns (uint256)',
    'message': 'function message() view returns (string)',
    'owner': 'function owner() view returns (address)',
    'paused': 'function paused() view returns (bool)',
    
    // One argument
    'balanceOf': 'function balanceOf(address) view returns (uint256)',
    'getUser': 'function getUser(uint256) view returns (string)',
    'getValue': 'function getValue(uint256) view returns (uint256)',
    'userValues': 'function userValues(address) view returns (uint256)',
    'getUserValue': 'function getUserValue(address) view returns (uint256)',
    
    // Two arguments
    'allowance': 'function allowance(address,address) view returns (uint256)'
  }
  
  // Check for exact match first
  if (commonPatterns[functionName]) {
    return commonPatterns[functionName]
  }
  
  // Generate generic ABI based on argument count
  const argTypes = Array(argCount).fill('uint256').join(',')
  return `function ${functionName}(${argTypes}) view returns (uint256)`
}

/**
 * Get alternative function ABI patterns to try
 */
function getAlternativeFunctionAbis(functionName: string, argCount: number): string[] {
  const alternatives: string[] = []
  
  // Try different return types
  const returnTypes = ['string', 'address', 'bool', 'bytes32', 'uint8', 'uint128']
  
  for (const returnType of returnTypes) {
    if (argCount === 0) {
      alternatives.push(`function ${functionName}() view returns (${returnType})`)
    } else if (argCount === 1) {
      // Try different single argument types
      const argTypes = ['address', 'uint256', 'string', 'bytes32']
      for (const argType of argTypes) {
        alternatives.push(`function ${functionName}(${argType}) view returns (${returnType})`)
      }
    } else if (argCount === 2) {
      // Common two-argument patterns
      alternatives.push(`function ${functionName}(address,address) view returns (${returnType})`)
      alternatives.push(`function ${functionName}(address,uint256) view returns (${returnType})`)
      alternatives.push(`function ${functionName}(uint256,uint256) view returns (${returnType})`)
    }
  }
  
  return alternatives
}

/**
 * Infer the return type from the result
 */
function inferReturnType(result: any): string {
  if (typeof result === 'string') {
    if (result.startsWith('0x') && result.length === 42) {
      return 'address'
    }
    return 'string'
  }
  
  if (typeof result === 'bigint') {
    return 'uint256'
  }
  
  if (typeof result === 'boolean') {
    return 'bool'
  }
  
  if (Array.isArray(result)) {
    return 'array'
  }
  
  return 'unknown'
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}