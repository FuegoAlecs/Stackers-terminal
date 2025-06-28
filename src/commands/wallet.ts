import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { alchemyUtils, NETWORK_INFO } from '../lib/alchemy'
import { smartWalletManager } from '../lib/smartWallet'

// We'll need to access wallet state from the terminal
// This will be handled through a global wallet context
let walletContext: any = null

export const setWalletContext = (context: any) => {
  walletContext = context
}

export const walletCommand: CommandHandler = {
  name: 'wallet',
  description: 'EOA wallet operations (connect, disconnect, status)',
  usage: 'wallet <connect|disconnect|status|balance>',
  aliases: ['w'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      const smartWalletStatus = smartWalletManager.isInitialized() ? '✅ Active' : '❌ Not created'
      
      return {
        output: `EOA Wallet Commands:
  wallet connect     - Connect your EOA wallet (MetaMask, etc.)
  wallet disconnect  - Disconnect wallet
  wallet status      - Show connection status
  wallet balance     - Show wallet balance (using Alchemy)
  wallet address     - Show full wallet address
  wallet network     - Show current network info

Smart Wallet Status: ${smartWalletStatus}
  smart create       - Create smart wallet from this EOA
  smart info         - View smart wallet details

Aliases: w connect, w status, etc.
Network: ${NETWORK_INFO.name} (${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'})

💡 EOA wallets are your traditional Ethereum accounts.
   Smart wallets provide gasless transactions and advanced features.`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    if (!walletContext) {
      return {
        output: 'Error: Wallet context not available. Please ensure wallet provider is initialized.',
        success: false
      }
    }
    
    const { address, isConnected, isConnecting, connectWallet, disconnectWallet, formatAddress } = walletContext
    
    switch (subcommand) {
      case 'connect':
        if (isConnected) {
          return {
            output: `Already connected to EOA wallet: ${formatAddress(address)}

💡 To create a smart wallet from this EOA:
   smart create --gasless`,
            success: true
          }
        }
        
        if (isConnecting) {
          return {
            output: 'Wallet connection in progress...',
            success: true
          }
        }
        
        try {
          connectWallet()
          return {
            output: `Opening wallet connection modal...
Please select your preferred wallet from the popup.

After connecting, you can:
  • Use this EOA wallet directly
  • Create a smart wallet: "smart create --gasless"`,
            success: true
          }
        } catch (error) {
          return {
            output: `Failed to open wallet connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
            success: false
          }
        }
      
      case 'disconnect':
        if (!isConnected) {
          return {
            output: 'No EOA wallet connected',
            success: true
          }
        }
        
        try {
          disconnectWallet()
          
          // Also disconnect smart wallet if active
          if (smartWalletManager.isInitialized()) {
            smartWalletManager.disconnect()
          }
          
          return {
            output: `EOA wallet disconnected successfully
${smartWalletManager.isInitialized() ? 'Smart wallet also disconnected' : ''}`,
            success: true
          }
        } catch (error) {
          return {
            output: `Failed to disconnect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
            success: false
          }
        }
      
      case 'status':
        if (isConnecting) {
          return {
            output: 'Status: Connecting...',
            success: true
          }
        }
        
        if (isConnected) {
          const smartWalletInfo = smartWalletManager.isInitialized() 
            ? await smartWalletManager.getWalletInfo().catch(() => null)
            : null
          
          return {
            output: `EOA Wallet Status: Connected ✅
Address: ${formatAddress(address)}
Full Address: ${address}
Network: ${NETWORK_INFO.name}
Chain ID: ${NETWORK_INFO.chainId}
Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

Smart Wallet Status: ${smartWalletInfo ? '✅ Active' : '❌ Not created'}
${smartWalletInfo ? `Smart Address: ${smartWalletInfo.address}
Gasless Mode: ${smartWalletInfo.gasless ? '✅ Enabled' : '❌ Disabled'}` : 'Use "smart create" to create a smart wallet'}

💡 You have both EOA and smart wallet capabilities available!`,
            success: true
          }
        }
        
        return {
          output: `EOA Wallet Status: Not connected ❌
Network: ${NETWORK_INFO.name}
Use "wallet connect" to connect your wallet

Smart Wallet Status: ❌ Not available (requires connected EOA)`,
          success: true
        }
      
      case 'address':
        if (!isConnected) {
          return {
            output: 'No wallet connected. Use "wallet connect" first.',
            success: false
          }
        }
        
        const smartWalletInfo = smartWalletManager.isInitialized() 
          ? await smartWalletManager.getWalletInfo().catch(() => null)
          : null
        
        return {
          output: `EOA Wallet Address:
Full Address: ${address}
Short Address: ${formatAddress(address)}
Network: ${NETWORK_INFO.name}

${smartWalletInfo ? `Smart Wallet Address:
Full Address: ${smartWalletInfo.address}
Short Address: ${formatAddress(smartWalletInfo.address)}
Relationship: Smart wallet controlled by EOA` : 'No smart wallet created'}`,
          success: true
        }
      
      case 'balance':
        if (!isConnected) {
          return {
            output: 'No wallet connected. Use "wallet connect" first.',
            success: false
          }
        }
        
        try {
          const balance = await alchemyUtils.getBalance(address)
          const gasPrice = await alchemyUtils.getGasPrice()
          
          let smartWalletBalance = ''
          if (smartWalletManager.isInitialized()) {
            try {
              const smartInfo = await smartWalletManager.getWalletInfo()
              smartWalletBalance = `
Smart Wallet Balance: ${smartInfo.balance}
Smart Wallet Address: ${formatAddress(smartInfo.address)}`
            } catch {
              smartWalletBalance = '\nSmart Wallet: Error fetching balance'
            }
          }
          
          return {
            output: `EOA Wallet Balance (${NETWORK_INFO.name}):
Address: ${formatAddress(address)}
Balance: ${balance.formatted}
Wei: ${balance.wei}${smartWalletBalance}

Network Info:
Gas Price: ${gasPrice.formatted}
Chain ID: ${NETWORK_INFO.chainId}

💡 Tips:
  • Use "alchemy tokens ${address}" to see token balances
  • Create smart wallet for gasless transactions: "smart create --gasless"`,
            success: true
          }
        } catch (error) {
          return {
            output: `Failed to fetch balance: ${error instanceof Error ? error.message : 'Unknown error'}
Make sure you're connected to ${NETWORK_INFO.name} and your API key is valid.`,
            success: false
          }
        }
      
      case 'network':
        return {
          output: `Current Network Configuration:
Name: ${NETWORK_INFO.name}
Chain ID: ${NETWORK_INFO.chainId}
Type: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}
RPC: ${NETWORK_INFO.viemChain.rpcUrls.default.http[0]}

${isConnected ? `Connected EOA Wallet: ${formatAddress(address)}` : 'No EOA wallet connected'}
${smartWalletManager.isInitialized() ? 'Smart Wallet: ✅ Active' : 'Smart Wallet: ❌ Not created'}

💡 This app supports both EOA and smart wallets on ${NETWORK_INFO.name}`,
          success: true
        }
      
      default:
        return {
          output: `Unknown wallet command: ${subcommand}
Available commands: connect, disconnect, status, address, balance, network

For smart wallet features, use:
  smart create, smart info, smart sponsor, etc.`,
          success: false
        }
    }
  }
}

commandRouter.register(walletCommand)