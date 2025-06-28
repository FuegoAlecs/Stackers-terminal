import { alchemy, alchemyUtils, NETWORK_INFO } from './alchemy'
import { parseEther, formatEther, isAddress } from 'viem'

export interface SimulationInput {
  to: string
  data: string
  value?: string
  gas?: string
  gasPrice?: string
  from?: string
}

export interface SimulationResult {
  success: boolean
  gasUsed?: number
  gasLimit?: number
  gasPrice?: string
  totalCost?: string
  returnData?: string
  decodedOutput?: string
  logs?: Array<{
    address: string
    topics: string[]
    data: string
  }>
  stateChanges?: Array<{
    address: string
    slot: string
    value: string
  }>
  error?: string
}

export interface ParsedSimulationInput {
  success: boolean
  input?: SimulationInput
  error?: string
}

/**
 * Parse and validate simulation input JSON
 */
export function parseSimulationInput(jsonInput: string, fromAddress?: string): ParsedSimulationInput {
  try {
    // Parse JSON
    let parsed: any
    try {
      parsed = JSON.parse(jsonInput)
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON format. Expected: {"to":"0x...","data":"0x...","value":"0x0"}'
      }
    }
    
    // Validate required fields
    if (!parsed.to) {
      return {
        success: false,
        error: 'Missing required field "to" (contract address)'
      }
    }
    
    if (!parsed.data) {
      return {
        success: false,
        error: 'Missing required field "data" (transaction data)'
      }
    }
    
    // Validate address format
    if (!isValidAddress(parsed.to)) {
      return {
        success: false,
        error: `Invalid "to" address format: ${parsed.to}`
      }
    }
    
    // Validate data format
    if (!isValidHex(parsed.data)) {
      return {
        success: false,
        error: `Invalid "data" format: ${parsed.data}. Must be hex string starting with 0x`
      }
    }
    
    // Validate optional fields
    if (parsed.value && !isValidHex(parsed.value)) {
      return {
        success: false,
        error: `Invalid "value" format: ${parsed.value}. Must be hex string`
      }
    }
    
    if (parsed.gas && !isValidHex(parsed.gas)) {
      return {
        success: false,
        error: `Invalid "gas" format: ${parsed.gas}. Must be hex string`
      }
    }
    
    if (parsed.gasPrice && !isValidHex(parsed.gasPrice)) {
      return {
        success: false,
        error: `Invalid "gasPrice" format: ${parsed.gasPrice}. Must be hex string`
      }
    }
    
    // Validate from address if provided
    if (fromAddress && !isValidAddress(fromAddress)) {
      return {
        success: false,
        error: `Invalid "from" address format: ${fromAddress}`
      }
    }
    
    const input: SimulationInput = {
      to: parsed.to,
      data: parsed.data,
      value: parsed.value || '0x0',
      gas: parsed.gas,
      gasPrice: parsed.gasPrice,
      from: fromAddress
    }
    
    return {
      success: true,
      input
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse simulation input'
    }
  }
}

/**
 * Simulate a transaction using Alchemy's simulation API
 */
export async function simulateTransaction(input: SimulationInput): Promise<SimulationResult> {
  try {
    // Prepare simulation parameters
    const simulationParams: any = {
      to: input.to,
      data: input.data,
      value: input.value || '0x0'
    }
    
    // Add optional parameters
    if (input.gas) {
      simulationParams.gas = input.gas
    }
    
    if (input.gasPrice) {
      simulationParams.gasPrice = input.gasPrice
    }
    
    // Set from address (use a default if not provided)
    if (input.from) {
      simulationParams.from = input.from
    } else {
      // Use a default address for simulation
      simulationParams.from = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b'
    }
    
    // Try Alchemy's simulation API first
    try {
      const simulation = await alchemy.transact.simulateExecution(simulationParams)
      
      return {
        success: !simulation.calls[0]?.error,
        gasUsed: simulation.calls[0]?.gasUsed ? parseInt(simulation.calls[0].gasUsed, 16) : undefined,
        returnData: simulation.calls[0]?.returnData,
        decodedOutput: tryDecodeOutput(simulation.calls[0]?.returnData),
        logs: simulation.calls[0]?.logs?.map(log => ({
          address: log.address,
          topics: log.topics,
          data: log.data
        })),
        error: simulation.calls[0]?.error
      }
    } catch (alchemyError) {
      // Fallback to eth_call for read-only operations
      console.warn('Alchemy simulation failed, trying eth_call:', alchemyError)
      
      try {
        const result = await alchemy.core.call(simulationParams)
        
        // Estimate gas separately
        let gasEstimate: number | undefined
        try {
          const gasHex = await alchemy.core.estimateGas(simulationParams)
          gasEstimate = parseInt(gasHex.toString(), 16)
        } catch {
          // Gas estimation failed, continue without it
        }
        
        // Get current gas price for cost calculation
        let gasPrice: string | undefined
        let totalCost: string | undefined
        
        try {
          const currentGasPrice = await alchemyUtils.getGasPrice()
          gasPrice = currentGasPrice.formatted
          
          if (gasEstimate) {
            const costWei = BigInt(gasEstimate) * BigInt(Math.floor(currentGasPrice.gwei * 1e9))
            totalCost = `${parseFloat(formatEther(costWei)).toFixed(6)} ETH`
          }
        } catch {
          // Continue without gas price info
        }
        
        return {
          success: true,
          gasUsed: gasEstimate,
          gasLimit: gasEstimate ? Math.floor(gasEstimate * 1.2) : undefined,
          gasPrice,
          totalCost,
          returnData: result,
          decodedOutput: tryDecodeOutput(result),
          logs: [], // eth_call doesn't return logs
          stateChanges: [] // eth_call doesn't return state changes
        }
      } catch (callError) {
        return {
          success: false,
          error: `Simulation failed: ${callError instanceof Error ? callError.message : 'Unknown error'}`
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown simulation error'
    }
  }
}

/**
 * Try to decode output data
 */
function tryDecodeOutput(data?: string): string | undefined {
  if (!data || data === '0x') {
    return undefined
  }
  
  try {
    // Try to decode as string (common for name(), symbol(), etc.)
    if (data.length > 130) { // Minimum length for string encoding
      const decoded = decodeString(data)
      if (decoded) {
        return `"${decoded}"`
      }
    }
    
    // Try to decode as number
    if (data.length === 66) { // 32 bytes = 64 hex chars + 0x
      const number = BigInt(data)
      return number.toString()
    }
    
    // Try to decode as boolean
    if (data === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return 'false'
    } else if (data === '0x0000000000000000000000000000000000000000000000000000000000000001') {
      return 'true'
    }
    
    // Try to decode as address
    if (data.length === 66 && data.startsWith('0x000000000000000000000000')) {
      const address = '0x' + data.slice(26)
      if (isValidAddress(address)) {
        return address
      }
    }
    
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Decode string from ABI-encoded data
 */
function decodeString(data: string): string | undefined {
  try {
    // Remove 0x prefix
    const hex = data.slice(2)
    
    // Skip offset (first 32 bytes) and length (next 32 bytes)
    const lengthHex = hex.slice(64, 128)
    const length = parseInt(lengthHex, 16)
    
    if (length === 0 || length > 1000) { // Sanity check
      return undefined
    }
    
    // Extract string data
    const stringHex = hex.slice(128, 128 + length * 2)
    const decoded = Buffer.from(stringHex, 'hex').toString('utf8')
    
    // Validate that it's printable ASCII/UTF-8
    if (/^[\x20-\x7E\u00A0-\uFFFF]*$/.test(decoded)) {
      return decoded
    }
    
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validate hex string format
 */
function isValidHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]*$/.test(hex)
}

/**
 * Generate common function call data for testing
 */
export const COMMON_FUNCTION_CALLS = {
  // ERC20 functions
  name: '0x06fdde03',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
  totalSupply: '0x18160ddd',
  
  // Common view functions
  owner: '0x8da5cb5b',
  paused: '0x5c975abb',
  
  // Counter functions
  count: '0x06661abd',
  getCount: '0xa87d942c'
}

/**
 * Helper to generate balanceOf call data
 */
export function generateBalanceOfCall(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error('Invalid address for balanceOf call')
  }
  
  // balanceOf(address) = 0x70a08231 + padded address
  const paddedAddress = address.slice(2).padStart(64, '0')
  return `0x70a08231${paddedAddress}`
}

/**
 * Helper to generate transfer call data
 */
export function generateTransferCall(to: string, amount: string): string {
  if (!isValidAddress(to)) {
    throw new Error('Invalid recipient address for transfer call')
  }
  
  // transfer(address,uint256) = 0xa9059cbb + padded address + padded amount
  const paddedTo = to.slice(2).padStart(64, '0')
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0')
  return `0xa9059cbb${paddedTo}${paddedAmount}`
}