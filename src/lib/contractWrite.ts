import { createWalletClient, custom, parseEther, parseGwei, formatEther, Address, parseAbi } from 'viem'
import { alchemyViemClient, NETWORK_INFO, alchemyUtils } from './alchemy'

export interface WriteOptions {
  gasLimit?: number
  gasPrice?: string
  value?: string // ETH amount to send
}

export interface WriteResult {
  success: boolean
  transactionHash?: string
  blockNumber?: number
  gasUsed?: number
  gasPrice?: string
  totalCost?: string
  status?: string
  error?: string
}

export interface GasEstimate {
  success: boolean
  gasLimit?: number
  gasPrice?: string
  totalCost?: string
  usdEstimate?: number
  error?: string
}

export interface ParsedWrite {
  success: boolean
  contractAddress?: string
  functionName?: string
  arguments?: string[]
  options?: WriteOptions
  error?: string
}

/**
 * Parse write transaction input with options
 */
export function parseWriteInput(input: string): ParsedWrite {
  try {
    const parts = input.trim().split(/\s+/)
    let callPart = ''
    const options: WriteOptions = {}
    
    // Separate the function call from options
    let i = 0
    while (i < parts.length && !parts[i].startsWith('--')) {
      callPart += (callPart ? ' ' : '') + parts[i]
      i++
    }
    
    // Parse options
    while (i < parts.length) {
      const option = parts[i]
      
      if (option === '--gas-limit' && i + 1 < parts.length) {
        options.gasLimit = parseInt(parts[i + 1])
        i += 2
      } else if (option === '--gas-price' && i + 1 < parts.length) {
        options.gasPrice = parts[i + 1]
        i += 2
      } else if (option === '--value' && i + 1 < parts.length) {
        options.value = parts[i + 1]
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
    
    // Parse arguments
    const args = parseArguments(argsString.trim())
    
    return {
      success: true,
      contractAddress,
      functionName,
      arguments: args,
      options
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse write input'
    }
  }
}

/**
 * Send a write transaction to a smart contract
 */
export async function writeContractFunction(
  contractAddress: string,
  functionName: string,
  args: string[],
  options: WriteOptions = {}
): Promise<WriteResult> {
  try {
    // Check if wallet is available
    if (!window.ethereum) {
      return {
        success: false,
        error: 'No wallet detected. Please install MetaMask or another Web3 wallet.'
      }
    }

    // Create wallet client
    const walletClient = createWalletClient({
      chain: NETWORK_INFO.viemChain,
      transport: custom(window.ethereum)
    })

    // Get accounts
    const accounts = await walletClient.getAddresses()
    if (accounts.length === 0) {
      return {
        success: false,
        error: 'No wallet connected. Please connect your wallet first using "wallet connect".'
      }
    }

    const account = accounts[0]

    // Check wallet balance
    const balance = await alchemyUtils.getBalance(account)
    const balanceEth = parseFloat(balance.eth.toString())
    
    const requiredBalance = options.value ? parseFloat(options.value) + 0.01 : 0.01
    if (balanceEth < requiredBalance) {
      return {
        success: false,
        error: `Insufficient balance. Current: ${balance.formatted}, Required: ~${requiredBalance} ETH`
      }
    }

    // Parse and validate arguments
    const parsedArgs = parseContractArguments(args)
    
    // Create function ABI
    const functionAbi = createWriteFunctionAbi(functionName, parsedArgs.length, !!options.value)
    
    // Prepare transaction parameters
    const txParams: any = {
      address: contractAddress as Address,
      abi: parseAbi([functionAbi]),
      functionName: functionName,
      args: parsedArgs,
      account
    }
    
    // Add value if specified
    if (options.value) {
      txParams.value = parseEther(options.value)
    }
    
    // Estimate gas if not provided
    if (!options.gasLimit) {
      try {
        const estimatedGas = await alchemyViemClient.estimateContractGas(txParams)
        txParams.gas = BigInt(Math.floor(Number(estimatedGas) * 1.2)) // Add 20% buffer
      } catch (error) {
        return {
          success: false,
          error: `Gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    } else {
      txParams.gas = BigInt(options.gasLimit)
    }
    
    // Set gas price if provided
    if (options.gasPrice) {
      txParams.gasPrice = parseGwei(options.gasPrice)
    }

    // Send the transaction
    const hash = await walletClient.writeContract(txParams)

    // Wait for transaction confirmation
    const receipt = await alchemyViemClient.waitForTransactionReceipt({
      hash,
      timeout: 60000 // 60 seconds timeout
    })

    // Calculate total cost
    const totalCostWei = receipt.gasUsed * receipt.effectiveGasPrice
    const totalCostEth = parseFloat(formatEther(totalCostWei))

    return {
      success: true,
      transactionHash: hash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: Number(receipt.gasUsed),
      gasPrice: `${parseFloat(formatEther(receipt.effectiveGasPrice * BigInt(1e9))).toFixed(2)} Gwei`,
      totalCost: `${totalCostEth.toFixed(6)} ETH`,
      status: receipt.status === 'success' ? 'Success' : 'Failed'
    }

  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        return {
          success: false,
          error: 'Transaction was rejected by user'
        }
      }
      
      if (error.message.includes('insufficient funds')) {
        return {
          success: false,
          error: 'Insufficient funds for gas + value'
        }
      }
      
      if (error.message.includes('execution reverted')) {
        return {
          success: false,
          error: 'Transaction would revert - check function logic and arguments'
        }
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transaction error'
    }
  }
}

/**
 * Estimate gas for a write transaction
 */
export async function estimateWriteGas(
  contractAddress: string,
  functionName: string,
  args: string[],
  options: WriteOptions = {}
): Promise<GasEstimate> {
  try {
    // Check if wallet is available
    if (!window.ethereum) {
      return {
        success: false,
        error: 'No wallet detected'
      }
    }

    // Create wallet client
    const walletClient = createWalletClient({
      chain: NETWORK_INFO.viemChain,
      transport: custom(window.ethereum)
    })

    // Get accounts
    const accounts = await walletClient.getAddresses()
    if (accounts.length === 0) {
      return {
        success: false,
        error: 'No wallet connected'
      }
    }

    const account = accounts[0]
    
    // Parse arguments
    const parsedArgs = parseContractArguments(args)
    
    // Create function ABI
    const functionAbi = createWriteFunctionAbi(functionName, parsedArgs.length, !!options.value)
    
    // Prepare estimation parameters
    const estimateParams: any = {
      address: contractAddress as Address,
      abi: parseAbi([functionAbi]),
      functionName: functionName,
      args: parsedArgs,
      account
    }
    
    // Add value if specified
    if (options.value) {
      estimateParams.value = parseEther(options.value)
    }
    
    // Estimate gas
    const estimatedGas = await alchemyViemClient.estimateContractGas(estimateParams)
    const gasLimit = Math.floor(Number(estimatedGas) * 1.2) // Add 20% buffer
    
    // Get current gas price
    const currentGasPrice = await alchemyUtils.getGasPrice()
    const gasPrice = options.gasPrice || `${currentGasPrice.gwei + 1}`
    
    // Calculate total cost
    const totalCostWei = BigInt(gasLimit) * parseGwei(gasPrice)
    const totalCostEth = parseFloat(formatEther(totalCostWei))
    
    // Add value if specified
    const valueEth = options.value ? parseFloat(options.value) : 0
    const totalWithValue = totalCostEth + valueEth
    
    // Rough USD estimate
    const ethUsdPrice = 2000 // Placeholder
    const usdEstimate = totalWithValue * ethUsdPrice

    return {
      success: true,
      gasLimit,
      gasPrice: `${gasPrice} Gwei`,
      totalCost: `${totalCostEth.toFixed(6)} ETH${valueEth > 0 ? ` + ${valueEth} ETH value` : ''}`,
      usdEstimate
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gas estimation failed'
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
        // Likely an address
        return trimmed as Address
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
 * Create a function ABI string for write functions
 */
function createWriteFunctionAbi(functionName: string, argCount: number, isPayable: boolean): string {
  // Common write function patterns
  const commonPatterns: { [key: string]: string } = {
    // No arguments
    'increment': 'function increment()',
    'decrement': 'function decrement()',
    'reset': 'function reset()',
    'pause': 'function pause()',
    'unpause': 'function unpause()',
    'deposit': 'function deposit() payable',
    'withdraw': 'function withdraw()',
    
    // One argument
    'setMessage': 'function setMessage(string)',
    'set': 'function set(uint256)',
    'setUserValue': 'function setUserValue(uint256)',
    'withdraw': 'function withdraw(uint256)',
    'mint': 'function mint(uint256)',
    'burn': 'function burn(uint256)',
    
    // Two arguments
    'transfer': 'function transfer(address,uint256)',
    'approve': 'function approve(address,uint256)',
    'setApprovalForAll': 'function setApprovalForAll(address,bool)',
    
    // Three arguments
    'transferFrom': 'function transferFrom(address,address,uint256)',
    'safeTransferFrom': 'function safeTransferFrom(address,address,uint256)'
  }
  
  // Check for exact match first
  if (commonPatterns[functionName]) {
    let abi = commonPatterns[functionName]
    if (isPayable && !abi.includes('payable')) {
      abi += ' payable'
    }
    return abi
  }
  
  // Generate generic ABI based on argument count
  const argTypes = Array(argCount).fill('uint256').join(',')
  const payableModifier = isPayable ? ' payable' : ''
  return `function ${functionName}(${argTypes})${payableModifier}`
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}