import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { smartWalletManager, formatUserOperation } from '../lib/smartWallet'
import { NETWORK_INFO } from '../lib/alchemy'
import { useWallet } from '../hooks/useWallet'

// We'll need access to the regular wallet context
let walletContext: any = null

export const setWalletContext = (context: any) => {
  walletContext = context
}

export const smartWalletCommand: CommandHandler = {
  name: 'smart',
  description: 'Smart wallet operations with gasless transactions',
  usage: 'smart <create|info|sponsor|send> [options]',
  aliases: ['sw'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      return {
        output: `Smart Wallet Commands:
  smart create [--gasless]     - Create a smart wallet from connected EOA
  smart info                   - Show smart wallet information
  smart sponsor on|off         - Toggle gasless mode
  smart send <to> <data>       - Send user operation
  smart estimate <to> <data>   - Estimate user operation gas
  smart help                   - Show detailed help

Current Status: ${smartWalletManager.isInitialized() ? '✅ Initialized' : '❌ Not initialized'}
Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})

💡 Smart wallets enable gasless transactions and advanced features!`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'create':
          // Check if regular wallet is connected
          if (!walletContext || !walletContext.isConnected) {
            return {
              output: `❌ No EOA wallet connected.

To create a smart wallet:
1. First connect your EOA wallet: wallet connect
2. Then create smart wallet: smart create

Smart wallets are created from your existing EOA wallet as the owner.`,
              success: false
            }
          }
          
          // Parse gasless flag
          const gaslessEnabled = args.includes('--gasless')
          
          try {
            await smartWalletManager.initialize(walletContext.address, gaslessEnabled)
            const info = await smartWalletManager.getWalletInfo()
            
            return {
              output: `🚀 Smart Wallet Created Successfully!

📋 Smart Wallet Details:
  Address: ${info.address}
  Owner (EOA): ${info.owner}
  Network: ${NETWORK_INFO.name}
  
🔧 Configuration:
  Gasless Mode: ${info.gasless ? '✅ Enabled' : '❌ Disabled'}
  Deployed: ${info.isDeployed ? '✅ Yes' : '⏳ Will deploy on first transaction'}
  Balance: ${info.balance}
  Nonce: ${info.nonce}

${info.gasless ? `💰 Gasless Features:
  • Transactions sponsored by Alchemy
  • No ETH needed for gas fees
  • Seamless user experience` : `💡 Standard Mode:
  • You pay gas fees in ETH
  • Use "smart sponsor on" to enable gasless mode`}

🎯 Next Steps:
  • smart info - View wallet details
  • smart send <to> <data> - Send transactions
  • smart sponsor on - Enable gasless mode
  
⚠️  Note: Keep your EOA wallet connected as it controls the smart wallet.`,
              success: true
            }
          } catch (error) {
            return {
              output: `❌ Failed to create smart wallet: ${error instanceof Error ? error.message : 'Unknown error'}

Common issues:
  • Network connectivity problems
  • Invalid Alchemy API key
  • Insufficient permissions
  
Check your configuration and try again.`,
              success: false
            }
          }
        
        case 'info':
          if (!smartWalletManager.isInitialized()) {
            return {
              output: `❌ Smart wallet not initialized.

Use "smart create" to create a smart wallet first.`,
              success: false
            }
          }
          
          try {
            const info = await smartWalletManager.getWalletInfo()
            const config = smartWalletManager.getConfig()
            
            return {
              output: `📱 Smart Wallet Information:

📍 Addresses:
  Smart Wallet: ${info.address}
  Owner (EOA): ${info.owner}
  Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})

💰 Balance & Status:
  Balance: ${info.balance}
  Nonce: ${info.nonce}
  Deployed: ${info.isDeployed ? '✅ Yes' : '⏳ Pending first transaction'}

⚙️  Configuration:
  Gasless Mode: ${info.gasless ? '✅ Enabled (Sponsored transactions)' : '❌ Disabled (You pay gas)'}
  Account Type: Smart Contract Account (ERC-4337)
  Factory: Simple Account Factory

${info.gasless ? `🎁 Gasless Benefits:
  • Zero gas fees for transactions
  • Sponsored by Alchemy Gas Manager
  • Better user experience
  • No need to hold ETH for gas` : `💡 Gas Payment:
  • You pay gas fees in ETH
  • Standard transaction costs apply
  • Enable gasless: "smart sponsor on"`}

🔧 Available Actions:
  • smart send <to> <data> - Send user operations
  • smart estimate <to> <data> - Estimate gas costs
  • smart sponsor on/off - Toggle gasless mode

📊 Technical Details:
  • ERC-4337 Account Abstraction
  • Bundler: Alchemy
  • Entry Point: ${NETWORK_INFO.viemChain.contracts?.entryPoint?.address || 'Standard'}`,
              success: true
            }
          } catch (error) {
            return {
              output: `❌ Failed to get wallet info: ${error instanceof Error ? error.message : 'Unknown error'}`,
              success: false
            }
          }
        
        case 'sponsor':
          if (!smartWalletManager.isInitialized()) {
            return {
              output: `❌ Smart wallet not initialized.

Use "smart create" to create a smart wallet first.`,
              success: false
            }
          }
          
          if (args.length < 2) {
            const config = smartWalletManager.getConfig()
            return {
              output: `Usage: smart sponsor <on|off>

Current gasless mode: ${config?.gasless ? '✅ Enabled' : '❌ Disabled'}

Examples:
  smart sponsor on   - Enable gasless transactions
  smart sponsor off  - Disable gasless transactions`,
              success: false
            }
          }
          
          const sponsorMode = args[1].toLowerCase()
          
          if (sponsorMode !== 'on' && sponsorMode !== 'off') {
            return {
              output: `Invalid sponsor mode: ${sponsorMode}

Valid options:
  smart sponsor on   - Enable gasless transactions
  smart sponsor off  - Disable gasless transactions`,
              success: false
            }
          }
          
          const enableGasless = sponsorMode === 'on'
          
          try {
            await smartWalletManager.toggleGasless(enableGasless)
            const info = await smartWalletManager.getWalletInfo()
            
            return {
              output: `${enableGasless ? '🎁' : '💰'} Gasless Mode ${enableGasless ? 'Enabled' : 'Disabled'}!

📋 Updated Configuration:
  Smart Wallet: ${info.address}
  Gasless Mode: ${info.gasless ? '✅ Enabled' : '❌ Disabled'}
  
${enableGasless ? `🎉 Gasless Benefits Activated:
  • All transactions are now sponsored
  • No ETH needed for gas fees
  • Seamless transaction experience
  • Powered by Alchemy Gas Manager` : `💡 Standard Mode Activated:
  • You will pay gas fees in ETH
  • Standard transaction costs apply
  • Full control over gas settings`}

🚀 Ready to send transactions with ${enableGasless ? 'zero gas costs' : 'standard gas fees'}!`,
              success: true
            }
          } catch (error) {
            return {
              output: `❌ Failed to toggle gasless mode: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Network connectivity issues
  • Alchemy API limitations
  • Invalid gas manager configuration`,
              success: false
            }
          }
        
        case 'send':
          if (!smartWalletManager.isInitialized()) {
            return {
              output: `❌ Smart wallet not initialized.

Use "smart create" to create a smart wallet first.`,
              success: false
            }
          }
          
          if (args.length < 3) {
            return {
              output: `Usage: smart send <to> <data> [value]

Examples:
  smart send 0xABC 0x1234
  smart send 0xDEF 0x5678 0.1
  
Parameters:
  to    - Contract address to call
  data  - Transaction data (hex)
  value - ETH amount to send (optional, default: 0)`,
              success: false
            }
          }
          
          const to = args[1]
          const data = args[2]
          const value = args[3] ? BigInt(parseFloat(args[3]) * 1e18) : 0n
          
          // Validate inputs
          if (!to.match(/^0x[a-fA-F0-9]{40}$/)) {
            return {
              output: `❌ Invalid address format: ${to}

Address must be 40 hex characters starting with 0x`,
              success: false
            }
          }
          
          if (!data.match(/^0x[a-fA-F0-9]*$/)) {
            return {
              output: `❌ Invalid data format: ${data}

Data must be hex string starting with 0x`,
              success: false
            }
          }
          
          try {
            const userOp = await smartWalletManager.sendUserOperation(to as any, data, value)
            
            return {
              output: `🚀 User Operation Sent Successfully!

${formatUserOperation(userOp)}

📋 Transaction Details:
  To: ${to}
  Data: ${data}
  Value: ${value > 0n ? `${parseFloat(value.toString()) / 1e18} ETH` : '0 ETH'}

⏳ Status: Pending confirmation...

💡 User operations are processed by bundlers and may take a few moments to confirm.
   Use block explorers to track the transaction hash.`,
              success: true
            }
          } catch (error) {
            return {
              output: `❌ Failed to send user operation: ${error instanceof Error ? error.message : 'Unknown error'}

Common issues:
  • Insufficient balance for non-gasless transactions
  • Invalid transaction data
  • Network connectivity problems
  • Gas manager policy restrictions`,
              success: false
            }
          }
        
        case 'estimate':
          if (!smartWalletManager.isInitialized()) {
            return {
              output: `❌ Smart wallet not initialized.

Use "smart create" to create a smart wallet first.`,
              success: false
            }
          }
          
          if (args.length < 3) {
            return {
              output: `Usage: smart estimate <to> <data> [value]

Examples:
  smart estimate 0xABC 0x1234
  smart estimate 0xDEF 0x5678 0.1`,
              success: false
            }
          }
          
          const estimateTo = args[1]
          const estimateData = args[2]
          const estimateValue = args[3] ? BigInt(parseFloat(args[3]) * 1e18) : 0n
          
          try {
            const estimate = await smartWalletManager.estimateUserOperationGas(
              estimateTo as any, 
              estimateData, 
              estimateValue
            )
            
            return {
              output: `⛽ User Operation Gas Estimate:

📋 Transaction Details:
  To: ${estimateTo}
  Data: ${estimateData}
  Value: ${estimateValue > 0n ? `${parseFloat(estimateValue.toString()) / 1e18} ETH` : '0 ETH'}

💰 Gas Breakdown:
  Pre-verification Gas: ${estimate.preVerificationGas.toLocaleString()}
  Verification Gas: ${estimate.verificationGasLimit.toLocaleString()}
  Call Gas: ${estimate.callGasLimit.toLocaleString()}
  Total Gas: ${estimate.totalGas.toLocaleString()}
  
💸 Cost Estimate:
  Max Fee Per Gas: ${estimate.maxFeePerGas.toLocaleString()} wei
  Total Cost: ${estimate.totalCost}${estimate.sponsored ? ' (Sponsored - FREE!)' : ''}

${estimate.sponsored ? `🎁 This transaction will be sponsored!
  • Zero cost to you
  • Paid by Alchemy Gas Manager
  • No ETH required for gas` : `💡 You will pay gas fees
  • Ensure sufficient ETH balance
  • Consider enabling gasless: "smart sponsor on"`}

🚀 Ready to send? Use: smart send ${estimateTo} ${estimateData}${estimateValue > 0n ? ` ${parseFloat(estimateValue.toString()) / 1e18}` : ''}`,
              success: true
            }
          } catch (error) {
            return {
              output: `❌ Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`,
              success: false
            }
          }
        
        case 'help':
          return {
            output: `Smart Wallet Help - Account Abstraction (ERC-4337):

OVERVIEW:
  Smart wallets provide advanced features beyond regular EOA wallets:
  • Gasless transactions (sponsored by Alchemy)
  • Programmable transaction logic
  • Better user experience
  • Account recovery options

COMMANDS:
  smart create [--gasless]     - Create smart wallet from connected EOA
  smart info                   - Show wallet details and status
  smart sponsor on|off         - Toggle gasless transaction mode
  smart send <to> <data> [val] - Send user operation
  smart estimate <to> <data>   - Estimate gas costs
  smart help                   - Show this help

SETUP PROCESS:
  1. Connect EOA wallet: "wallet connect"
  2. Create smart wallet: "smart create --gasless"
  3. Send transactions: "smart send 0xABC 0x1234"

GASLESS TRANSACTIONS:
  When enabled, all transaction fees are sponsored by Alchemy:
  • No ETH needed for gas
  • Seamless user experience
  • Powered by Alchemy Gas Manager
  • Toggle with "smart sponsor on/off"

EXAMPLES:

1. Create Gasless Smart Wallet:
   smart create --gasless

2. Send Contract Call:
   smart send 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b 0x06fdde03

3. Send ETH with Transaction:
   smart send 0xRecipient 0x 0.1

4. Estimate Gas First:
   smart estimate 0xContract 0xdata

5. Toggle Gasless Mode:
   smart sponsor on    # Enable gasless
   smart sponsor off   # Disable gasless

TECHNICAL DETAILS:
  • ERC-4337 Account Abstraction standard
  • Simple Account implementation
  • Alchemy bundler and paymaster
  • Your EOA wallet controls the smart wallet
  • Deterministic address generation

BENEFITS:
  ✅ Gasless transactions (when enabled)
  ✅ Better UX for dApp users
  ✅ Programmable transaction logic
  ✅ Batch transactions (future feature)
  ✅ Account recovery (future feature)

NETWORK INFO:
  Current Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}
  Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

REQUIREMENTS:
  • Connected EOA wallet (MetaMask, etc.)
  • Valid Alchemy API key
  • Network support for ERC-4337

LIMITATIONS:
  • Requires bundler support
  • Gas manager policy limits
  • Some dApps may not support smart wallets yet
  • Additional complexity vs. EOA wallets

💡 Smart wallets represent the future of Ethereum accounts!`,
            success: true
          }
        
        default:
          return {
            output: `Unknown smart wallet command: ${subcommand}

Available commands: create, info, sponsor, send, estimate, help

Examples:
  smart create --gasless
  smart info
  smart sponsor on`,
            success: false
          }
      }
    } catch (error) {
      return {
        output: `Smart wallet error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Network connectivity issues
  • Invalid Alchemy configuration
  • Smart wallet not initialized
  • ERC-4337 bundler problems

Use "smart help" for detailed information.`,
        success: false
      }
    }
  }
}

commandRouter.register(smartWalletCommand)