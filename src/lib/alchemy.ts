import { Alchemy, Network, AlchemySettings } from 'alchemy-sdk'
import { createPublicClient, http, PublicClient } from 'viem'
import { baseSepolia, base } from 'viem/chains'

// Environment configuration
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development'

if (!ALCHEMY_API_KEY) {
  console.warn('VITE_ALCHEMY_API_KEY not found in environment variables')
}

// Network configuration based on environment
const getNetworkConfig = () => {
  if (ENVIRONMENT === 'production') {
    return {
      alchemyNetwork: Network.BASE_MAINNET,
      viemChain: base,
      chainId: 8453,
      name: 'Base Mainnet'
    }
  } else {
    return {
      alchemyNetwork: Network.BASE_SEPOLIA,
      viemChain: baseSepolia,
      chainId: 84532,
      name: 'Base Sepolia'
    }
  }
}

const networkConfig = getNetworkConfig()

// Alchemy SDK configuration
const alchemySettings: AlchemySettings = {
  apiKey: ALCHEMY_API_KEY,
  network: networkConfig.alchemyNetwork,
}

// Initialize Alchemy SDK
export const alchemy = new Alchemy(alchemySettings)

// Viem public client configuration
export const publicClient: PublicClient = createPublicClient({
  chain: networkConfig.viemChain,
  transport: http(`https://${networkConfig.viemChain.rpcUrls.alchemy?.http[0]}/${ALCHEMY_API_KEY}`)
})

// Alternative viem client using Alchemy's enhanced API
export const alchemyViemClient: PublicClient = createPublicClient({
  chain: networkConfig.viemChain,
  transport: http(`https://${networkConfig.alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`)
})

// Utility functions for common operations
export const alchemyUtils = {
  /**
   * Get the current network configuration
   */
  getNetworkInfo: () => ({
    ...networkConfig,
    isTestnet: ENVIRONMENT !== 'production'
  }),

  /**
   * Get ETH balance for an address
   */
  getBalance: async (address: string) => {
    try {
      const balance = await alchemy.core.getBalance(address)
      return {
        wei: balance.toString(),
        eth: parseFloat(balance.toString()) / 1e18,
        formatted: `${(parseFloat(balance.toString()) / 1e18).toFixed(6)} ETH`
      }
    } catch (error) {
      console.error('Error fetching balance:', error)
      throw error
    }
  },

  /**
   * Get transaction count (nonce) for an address
   */
  getTransactionCount: async (address: string) => {
    try {
      return await alchemy.core.getTransactionCount(address)
    } catch (error) {
      console.error('Error fetching transaction count:', error)
      throw error
    }
  },

  /**
   * Get transaction by hash
   */
  getTransaction: async (hash: string) => {
    try {
      return await alchemy.core.getTransaction(hash)
    } catch (error) {
      console.error('Error fetching transaction:', error)
      throw error
    }
  },

  /**
   * Get transaction receipt
   */
  getTransactionReceipt: async (hash: string) => {
    try {
      return await alchemy.core.getTransactionReceipt(hash)
    } catch (error) {
      console.error('Error fetching transaction receipt:', error)
      throw error
    }
  },

  /**
   * Get current gas price
   */
  getGasPrice: async () => {
    try {
      const gasPrice = await alchemy.core.getGasPrice()
      return {
        wei: gasPrice.toString(),
        gwei: parseFloat(gasPrice.toString()) / 1e9,
        formatted: `${(parseFloat(gasPrice.toString()) / 1e9).toFixed(2)} Gwei`
      }
    } catch (error) {
      console.error('Error fetching gas price:', error)
      throw error
    }
  },

  /**
   * Get block by number
   */
  getBlock: async (blockNumber?: number) => {
    try {
      return await alchemy.core.getBlock(blockNumber || 'latest')
    } catch (error) {
      console.error('Error fetching block:', error)
      throw error
    }
  },

  /**
   * Get NFTs owned by an address
   */
  getNFTs: async (address: string) => {
    try {
      return await alchemy.nft.getNftsForOwner(address)
    } catch (error) {
      console.error('Error fetching NFTs:', error)
      throw error
    }
  },

  /**
   * Get token balances for an address
   */
  getTokenBalances: async (address: string) => {
    try {
      return await alchemy.core.getTokenBalances(address)
    } catch (error) {
      console.error('Error fetching token balances:', error)
      throw error
    }
  },

  /**
   * Search for transactions by address
   */
  getTransactionHistory: async (address: string, fromBlock?: string, toBlock?: string) => {
    try {
      return await alchemy.core.getAssetTransfers({
        fromAddress: address,
        fromBlock: fromBlock || '0x0',
        toBlock: toBlock || 'latest',
        category: ['external', 'internal', 'erc20', 'erc721', 'erc1155']
      })
    } catch (error) {
      console.error('Error fetching transaction history:', error)
      throw error
    }
  }
}

// Viem-specific utilities
export const viemUtils = {
  /**
   * Get balance using viem
   */
  getBalance: async (address: `0x${string}`) => {
    try {
      const balance = await publicClient.getBalance({ address })
      return {
        wei: balance.toString(),
        eth: parseFloat(balance.toString()) / 1e18,
        formatted: `${(parseFloat(balance.toString()) / 1e18).toFixed(6)} ETH`
      }
    } catch (error) {
      console.error('Error fetching balance with viem:', error)
      throw error
    }
  },

  /**
   * Get current block number
   */
  getBlockNumber: async () => {
    try {
      return await publicClient.getBlockNumber()
    } catch (error) {
      console.error('Error fetching block number:', error)
      throw error
    }
  },

  /**
   * Get gas price using viem
   */
  getGasPrice: async () => {
    try {
      const gasPrice = await publicClient.getGasPrice()
      return {
        wei: gasPrice.toString(),
        gwei: parseFloat(gasPrice.toString()) / 1e9,
        formatted: `${(parseFloat(gasPrice.toString()) / 1e9).toFixed(2)} Gwei`
      }
    } catch (error) {
      console.error('Error fetching gas price with viem:', error)
      throw error
    }
  }
}

// Export network information
export const NETWORK_INFO = networkConfig

// Health check function
export const checkAlchemyConnection = async (): Promise<{ success: boolean; message: string }> => {
  if (!ALCHEMY_API_KEY) {
    return { success: false, message: 'VITE_ALCHEMY_API_KEY is not set in environment variables.' };
  }
  try {
    // Attempt a more specific call that's likely to require a valid API key,
    // for example, getting transaction history for a zero address (should be cheap and fast).
    // Replace with a better check if Alchemy provides a dedicated health/auth check endpoint.
    await alchemy.core.getAssetTransfers({
        fromAddress: '0x0000000000000000000000000000000000000000', // Zero address
        maxCount: 1, // We only need to see if the call authenticates
        category: ['external']
    });
    return { success: true, message: 'Successfully connected to Alchemy and validated API key.' };
  } catch (error: any) {
    let errorMessage = 'Alchemy connection failed.';
    if (error.message) {
      errorMessage += ` Details: ${error.message}`;
    }
    // Check for common API key related errors if possible (pseudo-code, actual error structure may vary)
    if (error.code === -32000 || (error.message && error.message.includes('API key'))) {
        errorMessage = 'Alchemy API key is invalid or does not have permissions.';
    }
    console.error('Alchemy connection failed:', error);
    return { success: false, message: errorMessage };
  }
}

// Export configured instances
export { alchemy as alchemySDK }
export default alchemy