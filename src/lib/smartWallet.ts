import { 
  createSmartAccountClient,
  type SmartAccountClient,
  type SmartAccountSigner,
  getDefaultSimpleAccountFactoryAddress,
  type UserOperationRequest
} from '@alchemy/aa-core'
import { 
  createAlchemySmartAccountClient,
  AlchemyPaymasterAndDataMiddleware,
  AlchemyGasManagerMiddleware
} from '@alchemy/aa-alchemy'
import { 
  createLightAccount,
  type CreateLightAccountParams,
  type LightAccount
} from "@account-kit/smart-contracts";
import { createWalletClient, custom, type WalletClient, type Address } from 'viem'
import { NETWORK_INFO } from './alchemy'

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY
const GAS_MANAGER_POLICY_ID = import.meta.env.VITE_ALCHEMY_GAS_POLICY_ID || 'default'

export interface SmartWalletConfig {
  owner: Address
  accountAddress?: Address
  gasless: boolean
}

export interface SmartWalletInfo {
  address: Address
  owner: Address
  isDeployed: boolean
  gasless: boolean
  balance: string
  nonce: number
}

export interface UserOperation {
  hash: string
  sender: Address
  nonce: bigint
  callData: string
  gasEstimate: {
    preVerificationGas: bigint
    verificationGasLimit: bigint
    callGasLimit: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  }
  sponsored: boolean
}

export class SmartWalletManager {
  private client: SmartAccountClient | null = null
  private config: SmartWalletConfig | null = null
  private walletClient: WalletClient | null = null

  /**
   * Initialize smart wallet with owner EOA
   */
  async initialize(ownerAddress: Address, gasless: boolean = false): Promise<void> {
    try {
      if (!window.ethereum) {
        throw new Error('No wallet detected')
      }

      // Create wallet client for signing
      this.walletClient = createWalletClient({
        chain: NETWORK_INFO.viemChain,
        transport: custom(window.ethereum)
      })

      // Create smart account signer from EOA
      const signer: SmartAccountSigner = {
        signerType: 'local',
        inner: this.walletClient,
        getAddress: async () => ownerAddress,
        signMessage: async ({ message }) => {
          return await this.walletClient!.signMessage({
            account: ownerAddress,
            message: typeof message === 'string' ? message : message.raw
          })
        },
        signTypedData: async (params) => {
          return await this.walletClient!.signTypedData({
            account: ownerAddress,
            ...params
          })
        }
      }

      // Create smart account client
      if (gasless && ALCHEMY_API_KEY) {
        // Use Alchemy's paymaster for gasless transactions
        this.client = await createAlchemySmartAccountClient({
          apiKey: ALCHEMY_API_KEY,
          chain: NETWORK_INFO.viemChain,
          signer,
          gasManagerConfig: {
            policyId: GAS_MANAGER_POLICY_ID
          }
        })
      } else {
        // Standard smart account without gasless features
      const account: LightAccount = await createLightAccount({
          transport: custom(window.ethereum),
          chain: NETWORK_INFO.viemChain,
          signer,
          factoryAddress: getDefaultSimpleAccountFactoryAddress(NETWORK_INFO.viemChain),
          salt: 0n
      } as CreateLightAccountParams); // Added type assertion for params
        this.client = createSmartAccountClient({
          transport: custom(window.ethereum),
          chain: NETWORK_INFO.viemChain,
          account: account
        })
      }

      this.config = {
        owner: ownerAddress,
        accountAddress: await this.client.getAddress(),
        gasless
      }

    } catch (error) {
      throw new Error(`Failed to initialize smart wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get smart wallet information
   */
  async getWalletInfo(): Promise<SmartWalletInfo> {
    if (!this.client || !this.config) {
      throw new Error('Smart wallet not initialized')
    }

    try {
      const address = await this.client.getAddress()
      const balance = await this.client.getBundlerClient().getBalance({ address })
      const nonce = await this.client.getEntryPointNonce()

      // Check if account is deployed
      const bytecode = await this.client.getBundlerClient().getBytecode({ address })
      const isDeployed = bytecode !== undefined && bytecode !== '0x'

      return {
        address,
        owner: this.config.owner,
        isDeployed,
        gasless: this.config.gasless,
        balance: `${parseFloat(balance.toString()) / 1e18} ETH`,
        nonce: Number(nonce)
      }
    } catch (error) {
      throw new Error(`Failed to get wallet info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send a user operation
   */
  async sendUserOperation(
    to: Address,
    data: string,
    value: bigint = 0n
  ): Promise<UserOperation> {
    if (!this.client) {
      throw new Error('Smart wallet not initialized')
    }

    try {
      // Build user operation request
      const userOpRequest: UserOperationRequest = {
        target: to,
        data: data as `0x${string}`,
        value
      }

      // Send user operation
      const { hash } = await this.client.sendUserOperation(userOpRequest)

      // Get user operation details
      const userOp = await this.client.getUserOperationByHash(hash)
      
      if (!userOp) {
        throw new Error('Failed to retrieve user operation details')
      }

      return {
        hash,
        sender: userOp.sender as Address,
        nonce: BigInt(userOp.nonce),
        callData: userOp.callData,
        gasEstimate: {
          preVerificationGas: BigInt(userOp.preVerificationGas),
          verificationGasLimit: BigInt(userOp.verificationGasLimit),
          callGasLimit: BigInt(userOp.callGasLimit),
          maxFeePerGas: BigInt(userOp.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas)
        },
        sponsored: this.config?.gasless || false
      }
    } catch (error) {
      throw new Error(`Failed to send user operation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Estimate user operation gas
   */
  async estimateUserOperationGas(
    to: Address,
    data: string,
    value: bigint = 0n
  ): Promise<{
    preVerificationGas: bigint
    verificationGasLimit: bigint
    callGasLimit: bigint
    totalGas: bigint
    maxFeePerGas: bigint
    totalCost: string
    sponsored: boolean
  }> {
    if (!this.client) {
      throw new Error('Smart wallet not initialized')
    }

    try {
      const userOpRequest: UserOperationRequest = {
        target: to,
        data: data as `0x${string}`,
        value
      }

      // Estimate gas for user operation
      const gasEstimate = await this.client.estimateUserOperationGas(userOpRequest)
      
      const totalGas = gasEstimate.preVerificationGas + 
                      gasEstimate.verificationGasLimit + 
                      gasEstimate.callGasLimit

      const totalCostWei = totalGas * gasEstimate.maxFeePerGas
      const totalCostEth = parseFloat(totalCostWei.toString()) / 1e18

      return {
        preVerificationGas: gasEstimate.preVerificationGas,
        verificationGasLimit: gasEstimate.verificationGasLimit,
        callGasLimit: gasEstimate.callGasLimit,
        totalGas,
        maxFeePerGas: gasEstimate.maxFeePerGas,
        totalCost: `${totalCostEth.toFixed(6)} ETH`,
        sponsored: this.config?.gasless || false
      }
    } catch (error) {
      throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Toggle gasless mode
   */
  async toggleGasless(enabled: boolean): Promise<void> {
    if (!this.config) {
      throw new Error('Smart wallet not initialized')
    }

    // Re-initialize with new gasless setting
    await this.initialize(this.config.owner, enabled)
  }

  /**
   * Get current configuration
   */
  getConfig(): SmartWalletConfig | null {
    return this.config
  }

  /**
   * Check if wallet is initialized
   */
  isInitialized(): boolean {
    return this.client !== null && this.config !== null
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.client = null
    this.config = null
    this.walletClient = null
  }
}

// Singleton instance
export const smartWalletManager = new SmartWalletManager()

/**
 * Helper function to format user operation for display
 */
export function formatUserOperation(userOp: UserOperation): string {
  const totalGas = userOp.gasEstimate.preVerificationGas + 
                  userOp.gasEstimate.verificationGasLimit + 
                  userOp.gasEstimate.callGasLimit

  const totalCostWei = totalGas * userOp.gasEstimate.maxFeePerGas
  const totalCostEth = parseFloat(totalCostWei.toString()) / 1e18

  return `User Operation Details:
Hash: ${userOp.hash}
Sender: ${userOp.sender}
Nonce: ${userOp.nonce}
Sponsored: ${userOp.sponsored ? '✅ Yes (Gasless)' : '❌ No'}

Gas Breakdown:
  Pre-verification: ${userOp.gasEstimate.preVerificationGas.toLocaleString()}
  Verification: ${userOp.gasEstimate.verificationGasLimit.toLocaleString()}
  Call Gas: ${userOp.gasEstimate.callGasLimit.toLocaleString()}
  Total Gas: ${totalGas.toLocaleString()}
  Max Fee: ${userOp.gasEstimate.maxFeePerGas.toLocaleString()} wei
  Total Cost: ${totalCostEth.toFixed(6)} ETH${userOp.sponsored ? ' (Sponsored)' : ''}`
}