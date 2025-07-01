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

    // Constructor arguments are expected to be correctly typed and ordered in options.constructorArgs
    // The parseConstructorArgs function in commands/deploy.ts should handle string-to-type conversion.

    // Bytecode should be just the contract's creation bytecode.
    const deploymentBytecode = options.bytecode.startsWith('0x') ? options.bytecode : `0x${options.bytecode}`;

    // Estimate gas
    let gasLimit = options.gasLimit
    if (!gasLimit) {
      try {
        const estimatedGasVal = await alchemyViemClient.estimateGas({
          account,
          data: deploymentBytecode as `0x${string}`,
          args: options.constructorArgs // Pass args to estimateGas as well for accuracy
        });
        gasLimit = Math.floor(Number(estimatedGasVal) * 1.2); // Add 20% buffer
      } catch (error) {
        console.error("Gas estimation failed:", error);
        return {
          success: false,
          error: `Gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Consider setting a manual gas limit with --gas-limit.`
        };
      }
    }

    // Get gas price
    let gasPrice = options.gasPrice
    if (!gasPrice) {
      const currentGasPrice = await alchemyUtils.getGasPrice()
      // Ensure gas price is reasonable, add a small margin if desired
      gasPrice = `${Math.max(currentGasPrice.gwei, 1) + 1}`; // Ensure at least 1 Gwei + buffer
    }

    // Deploy the contract
    const hash = await walletClient.deployContract({
      abi: options.abi,
      bytecode: deploymentBytecode as `0x${string}`,
      account,
      args: options.constructorArgs, // Pass constructor arguments here
      gas: BigInt(gasLimit),
      gasPrice: parseGwei(gasPrice)
    });

    // Wait for transaction confirmation
    const receipt = await alchemyViemClient.waitForTransactionReceipt({
      hash,
      timeout: 60000 // 60 seconds timeout, can be adjusted
    });

    if (receipt.status !== 'success') { // Viem uses 'success' or 'reverted'
      return {
        success: false,
        error: `Transaction reverted. Status: ${receipt.status}. Gas used: ${receipt.gasUsed.toString()}. Review transaction on block explorer.`,
        transactionHash: hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed)
      };
    }

    if (!receipt.contractAddress) {
      return {
        success: false,
        error: 'Deployment transaction succeeded but no contract address was found. This can happen if it was not a contract creation or an early revert without proper status.',
        transactionHash: hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed)
      };
    }

    // Calculate total cost
    const totalCostWei = receipt.gasUsed * receipt.effectiveGasPrice;
    const totalCostEth = parseFloat(formatEther(totalCostWei));

    return {
      success: true,
      contractAddress: receipt.contractAddress,
      transactionHash: hash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: Number(receipt.gasUsed),
      gasPrice: `${parseFloat(formatEther(receipt.effectiveGasPrice * BigInt(1e9))).toFixed(2)} Gwei`,
      totalCost: `${totalCostEth.toFixed(6)} ETH`
    };

  } catch (error) {
    // Handle specific timeout error for better user feedback
    if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
      return {
        success: false,
        error: `Transaction confirmation timed out after 60 seconds. It might still be pending or have failed. Check block explorer for hash: ${hash}`,
        transactionHash: hash // Include hash if available
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown deployment error'
    };
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