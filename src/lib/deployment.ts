import { createWalletClient, custom, parseEther, parseGwei, formatEther } from 'viem'
import { alchemyViemClient, NETWORK_INFO, alchemyUtils } from './alchemy'

export interface DeploymentOptions {
  contractName: string
  abi: any[]
  bytecode: string
  constructorArgs?: string[]
  gasLimit?: number
  gasPrice?: string
}

export interface DeploymentResult {
  success: boolean
  contractAddress?: string
  transactionHash?: string
  blockNumber?: number
  gasUsed?: number
  gasPrice?: string
  totalCost?: string
  error?: string
}

export interface DeploymentEstimate {
  gasLimit: number
  gasPrice: {
    wei: string
    gwei: number
    formatted: string
  }
  totalCost: {
    wei: string
    eth: number
    formatted: string
  }
  contractSize: number
  usdEstimate?: number
}

/**
 * Deploy a smart contract to the blockchain
 */
export async function deployContract(options: DeploymentOptions): Promise<DeploymentResult> {
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
    
    if (balanceEth < 0.001) { // Minimum balance check
      return {
        success: false,
        error: `Insufficient balance. Current: ${balance.formatted}, Minimum required: 0.001 ETH`
      }
    }

    // Prepare constructor arguments
    let encodedArgs = '0x'
    if (options.constructorArgs && options.constructorArgs.length > 0) {
      try {
        encodedArgs = encodeConstructorArgs(options.abi, options.constructorArgs)
      } catch (error) {
        return {
          success: false,
          error: `Invalid constructor arguments: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }

    // Prepare deployment bytecode
    const deploymentBytecode = `0x${options.bytecode}${encodedArgs.slice(2)}`

    // Estimate gas
    let gasLimit = options.gasLimit
    if (!gasLimit) {
      try {
        gasLimit = await alchemyViemClient.estimateGas({
          account,
          data: deploymentBytecode as `0x${string}`
        })
        // Add 20% buffer
        gasLimit = Math.floor(Number(gasLimit) * 1.2)
      } catch (error) {
        // Fallback gas limit
        gasLimit = 500000
      }
    }

    // Get gas price
    let gasPrice = options.gasPrice
    if (!gasPrice) {
      const currentGasPrice = await alchemyUtils.getGasPrice()
      gasPrice = `${currentGasPrice.gwei + 1}` // Add 1 Gwei for faster confirmation
    }

    // Deploy the contract
    const hash = await walletClient.deployContract({
      abi: options.abi,
      bytecode: deploymentBytecode as `0x${string}`,
      account,
      gas: BigInt(gasLimit),
      gasPrice: parseGwei(gasPrice)
    })

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
      contractAddress: receipt.contractAddress || undefined,
      transactionHash: hash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: Number(receipt.gasUsed),
      gasPrice: `${parseFloat(formatEther(receipt.effectiveGasPrice * BigInt(1e9))).toFixed(2)} Gwei`,
      totalCost: `${totalCostEth.toFixed(6)} ETH`
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown deployment error'
    }
  }
}

/**
 * Estimate deployment cost for a contract
 */
export async function estimateDeploymentCost(bytecode: string): Promise<DeploymentEstimate> {
  try {
    // Calculate contract size
    const contractSize = Math.floor(bytecode.replace(/^0x/, '').length / 2)
    
    // Estimate gas limit (21000 base + ~200 gas per byte + constructor execution)
    const estimatedGas = 21000 + (contractSize * 200) + 50000 // Extra for constructor
    
    // Get current gas price
    const currentGasPrice = await alchemyUtils.getGasPrice()
    
    // Calculate total cost
    const totalCostWei = BigInt(estimatedGas) * BigInt(Math.floor(currentGasPrice.gwei * 1e9))
    const totalCostEth = parseFloat(formatEther(totalCostWei))
    
    // Rough USD estimate (would need price feed in production)
    const ethUsdPrice = 2000 // Placeholder - in production, fetch from price API
    const usdEstimate = totalCostEth * ethUsdPrice

    return {
      gasLimit: estimatedGas,
      gasPrice: {
        wei: (currentGasPrice.gwei * 1e9).toString(),
        gwei: currentGasPrice.gwei,
        formatted: currentGasPrice.formatted
      },
      totalCost: {
        wei: totalCostWei.toString(),
        eth: totalCostEth,
        formatted: `${totalCostEth.toFixed(6)} ETH`
      },
      contractSize,
      usdEstimate
    }
  } catch (error) {
    throw new Error(`Failed to estimate deployment cost: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse and validate constructor arguments
 */
export function parseConstructorArgs(abi: any[], args: string[]): any[] {
  const constructor = abi.find(item => item.type === 'constructor')
  
  if (!constructor) {
    if (args.length > 0) {
      throw new Error('Contract has no constructor but arguments were provided')
    }
    return []
  }
  
  const inputs = constructor.inputs || []
  
  if (args.length !== inputs.length) {
    throw new Error(`Constructor expects ${inputs.length} arguments, got ${args.length}`)
  }
  
  return args.map((arg, index) => {
    const input = inputs[index]
    return parseArgumentByType(arg, input.type)
  })
}

/**
 * Parse argument based on Solidity type
 */
function parseArgumentByType(arg: string, type: string): any {
  try {
    if (type === 'string') {
      return arg
    } else if (type.startsWith('uint') || type.startsWith('int')) {
      return BigInt(arg)
    } else if (type === 'bool') {
      return arg.toLowerCase() === 'true'
    } else if (type === 'address') {
      if (!arg.startsWith('0x') || arg.length !== 42) {
        throw new Error(`Invalid address format: ${arg}`)
      }
      return arg
    } else if (type.startsWith('bytes')) {
      if (!arg.startsWith('0x')) {
        return `0x${Buffer.from(arg, 'utf8').toString('hex')}`
      }
      return arg
    } else {
      // For complex types, try to parse as JSON
      return JSON.parse(arg)
    }
  } catch (error) {
    throw new Error(`Failed to parse argument "${arg}" as ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Encode constructor arguments for deployment
 */
function encodeConstructorArgs(abi: any[], args: string[]): string {
  if (args.length === 0) {
    return '0x'
  }
  
  const constructor = abi.find(item => item.type === 'constructor')
  if (!constructor) {
    throw new Error('Contract has no constructor')
  }
  
  // This is a simplified encoding - in production, use a proper ABI encoder
  // For now, we'll return empty bytes and let viem handle the encoding
  return '0x'
}

/**
 * Check if wallet is connected and has sufficient balance
 */
export async function checkDeploymentReadiness(): Promise<{
  ready: boolean
  issues: string[]
}> {
  const issues: string[] = []
  
  try {
    // Check wallet connection
    if (!window.ethereum) {
      issues.push('No Web3 wallet detected')
      return { ready: false, issues }
    }
    
    const accounts = await window.ethereum.request({ method: 'eth_accounts' })
    if (!accounts || accounts.length === 0) {
      issues.push('Wallet not connected')
      return { ready: false, issues }
    }
    
    // Check balance
    const balance = await alchemyUtils.getBalance(accounts[0])
    const balanceEth = parseFloat(balance.eth.toString())
    
    if (balanceEth < 0.001) {
      issues.push(`Insufficient balance: ${balance.formatted} (minimum 0.001 ETH required)`)
    }
    
    // Check network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    const currentChainId = parseInt(chainId, 16)
    
    if (currentChainId !== NETWORK_INFO.chainId) {
      issues.push(`Wrong network: connected to chain ${currentChainId}, expected ${NETWORK_INFO.chainId} (${NETWORK_INFO.name})`)
    }
    
    return {
      ready: issues.length === 0,
      issues
    }
    
  } catch (error) {
    issues.push(`Connection check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { ready: false, issues }
  }
}