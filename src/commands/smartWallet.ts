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
    const { args, printer } = context; // Added printer

    if (!printer) {
      return { output: 'Error: Printer not available.', success: false };
    }
    
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
            await smartWalletManager.initialize(walletContext.address, gaslessEnabled);
            const info = await smartWalletManager.getWalletInfo();
            
            await printer.print('🚀 Smart Wallet Created Successfully!\n');

            await printer.print('📋 Smart Wallet Details:');
            const detailsData = [
              { key: 'Address', value: info.address },
              { key: 'Owner (EOA)', value: info.owner },
              { key: 'Network', value: NETWORK_INFO.name }
            ];
            await printer.printKeyValues(detailsData, { indent: 2 });

            await printer.print('\n🔧 Configuration:');
            const configData = [
              { key: 'Gasless Mode', value: info.gasless ? '✅ Enabled' : '❌ Disabled' },
              { key: 'Deployed', value: info.isDeployed ? '✅ Yes' : '⏳ Will deploy on first transaction' },
              { key: 'Balance', value: info.balance },
              { key: 'Nonce', value: info.nonce.toString() }
            ];
            await printer.printKeyValues(configData, { indent: 2 });

            if (info.gasless) {
              await printer.print('\n💰 Gasless Features:');
              await printer.print('  • Transactions sponsored by Alchemy');
              await printer.print('  • No ETH needed for gas fees');
              await printer.print('  • Seamless user experience');
            } else {
              await printer.print('\n💡 Standard Mode:');
              await printer.print('  • You pay gas fees in ETH');
              await printer.print('  • Use "smart sponsor on" to enable gasless mode');
            }

            await printer.print('\n🎯 Next Steps:');
            await printer.print('  • smart info - View wallet details');
            await printer.print('  • smart send <to> <data> - Send transactions');
            await printer.print('  • smart sponsor on - Enable gasless mode');
            await printer.print('\n⚠️  Note: Keep your EOA wallet connected as it controls the smart wallet.');
            return { output: '', success: true };

          } catch (error) {
            await printer.error(`❌ Failed to create smart wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
            await printer.print(`\nCommon issues:
  • Network connectivity problems
  • Invalid Alchemy API key
  • Insufficient permissions`);
            await printer.print('\nCheck your configuration and try again.');
            return { output: '', success: false };
          }
        } // Close case 'create'
        
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
            const info = await smartWalletManager.getWalletInfo();
            // const config = smartWalletManager.getConfig(); // config is not used directly here

            await printer.print('📱 Smart Wallet Information:\n');

            await printer.print('📍 Addresses:');
            const addressData = [
              { key: 'Smart Wallet', value: info.address },
              { key: 'Owner (EOA)', value: info.owner },
              { key: 'Network', value: `${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})` }
            ];
            await printer.printKeyValues(addressData, { indent: 2 });

            await printer.print('\n💰 Balance & Status:');
            const balanceStatusData = [
              { key: 'Balance', value: info.balance },
              { key: 'Nonce', value: info.nonce.toString() },
              { key: 'Deployed', value: info.isDeployed ? '✅ Yes' : '⏳ Pending first transaction' }
            ];
            await printer.printKeyValues(balanceStatusData, { indent: 2 });

            await printer.print('\n⚙️  Configuration:');
            const configDisplayData = [ // Renamed from configData to avoid conflict
              { key: 'Gasless Mode', value: info.gasless ? '✅ Enabled (Sponsored transactions)' : '❌ Disabled (You pay gas)' },
              { key: 'Account Type', value: 'Smart Contract Account (ERC-4337)' },
              { key: 'Factory', value: 'Simple Account Factory' } // Assuming this is static or from config
            ];
            await printer.printKeyValues(configDisplayData, { indent: 2 });
            
            if (info.gasless) {
              await printer.print('\n🎁 Gasless Benefits:');
              await printer.print('  • Zero gas fees for transactions');
              await printer.print('  • Sponsored by Alchemy Gas Manager');
              await printer.print('  • Better user experience');
              await printer.print('  • No need to hold ETH for gas');
            } else {
              await printer.print('\n💡 Gas Payment:');
              await printer.print('  • You pay gas fees in ETH');
              await printer.print('  • Standard transaction costs apply');
              await printer.print('  • Enable gasless: "smart sponsor on"');
            }

            await printer.print('\n🔧 Available Actions:');
            await printer.print('  • smart send <to> <data> - Send user operations');
            await printer.print('  • smart estimate <to> <data> - Estimate gas costs');
            await printer.print('  • smart sponsor on/off - Toggle gasless mode');

            await printer.print('\n📊 Technical Details:');
            const techDetailsData = [
                {key: 'Standard', value: 'ERC-4337 Account Abstraction'},
                {key: 'Bundler', value: 'Alchemy'},
                {key: 'Entry Point', value: NETWORK_INFO.viemChain.contracts?.entryPoint?.address || 'Standard'}
            ];
            await printer.printKeyValues(techDetailsData, {indent: 2});

            return { output: '', success: true };

          } catch (error) {
            await printer.error(`❌ Failed to get wallet info: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { output: '', success: false };
          }
        } // Close case 'info'
        
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
            );
            
            await printer.print('⛽ User Operation Gas Estimate:\n');

            await printer.print('📋 Transaction Details:');
            const txDetailsData = [
              { key: 'To', value: estimateTo },
              { key: 'Data', value: estimateData },
              { key: 'Value', value: estimateValue > 0n ? `${parseFloat(estimateValue.toString()) / 1e18} ETH` : '0 ETH' }
            ];
            await printer.printKeyValues(txDetailsData, { indent: 2 });

            await printer.print('\n💰 Gas Breakdown:');
            const gasBreakdownData = [
              { key: 'Pre-verification Gas', value: estimate.preVerificationGas.toLocaleString() },
              { key: 'Verification Gas', value: estimate.verificationGasLimit.toLocaleString() },
              { key: 'Call Gas', value: estimate.callGasLimit.toLocaleString() },
              { key: 'Total Gas', value: estimate.totalGas.toLocaleString() }
            ];
            await printer.printKeyValues(gasBreakdownData, { indent: 2 });

            await printer.print('\n💸 Cost Estimate:');
            const costEstimateData = [
              { key: 'Max Fee Per Gas', value: `${estimate.maxFeePerGas.toLocaleString()} wei` },
              { key: 'Total Cost', value: `${estimate.totalCost}${estimate.sponsored ? ' (Sponsored - FREE!)' : ''}` }
            ];
            await printer.printKeyValues(costEstimateData, { indent: 2 });

            if (estimate.sponsored) {
              await printer.print('\n🎁 This transaction will be sponsored!');
              await printer.print('  • Zero cost to you');
              await printer.print('  • Paid by Alchemy Gas Manager');
              await printer.print('  • No ETH required for gas');
            } else {
              await printer.print('\n💡 You will pay gas fees');
              await printer.print('  • Ensure sufficient ETH balance');
              await printer.print('  • Consider enabling gasless: "smart sponsor on"');
            }

            await printer.print(`\n🚀 Ready to send? Use: smart send ${estimateTo} ${estimateData}${estimateValue > 0n ? ` ${parseFloat(estimateValue.toString()) / 1e18}` : ''}`);
            return { output: '', success: true };

          } catch (error) {
            await printer.error(`❌ Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { output: '', success: false };
          }
        } // Close case 'estimate'
        
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