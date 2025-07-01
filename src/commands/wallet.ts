import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { alchemyUtils, NETWORK_INFO } from '../lib/alchemy'
import { smartWalletManager } from '../lib/smartWallet'

// We'll need to access wallet state from the terminal
// This will be handled through a global wallet context
// Remove local context: let walletContext: any = null
// Remove local setter: export const setWalletContext = (context: any) => { walletContext = context }
import { getCommandWalletContext } from '../lib/commandWalletContext'; // New import

export const walletCommand: CommandHandler = {
  name: 'wallet',
  description: 'EOA wallet operations (connect, disconnect, status)',
  usage: 'wallet <connect|disconnect|status|balance>',
  aliases: ['w'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, printer } = context; // Added printer

    if (!printer) {
      // This case should ideally not happen if context always provides a printer.
      // However, good to have a fallback or clear error.
      return { output: 'Error: Printer not available for wallet command.', success: false };
    }
    
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
    
    const currentWalletContext = getCommandWalletContext(); // Use the shared context getter

    if (!currentWalletContext) {
      return {
        output: 'Error: Wallet context not available. Please ensure wallet provider is initialized correctly in Terminal.tsx.',
        success: false
      }
    }
    
    const { address, isConnected, isConnecting, connectWallet, disconnectWallet, formatAddress } = currentWalletContext;
    
    switch (subcommand) {
      case 'connect': { // Added scope
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
      } // Close 'connect' scope
      
      case 'disconnect': { // Added scope
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
      } // Close 'disconnect' scope
      
      case 'status': { // Added scope for status
        // The duplicated isConnecting check was an error from a previous merge, removing one.
        if (isConnecting) {
          await printer.print('Status: Connecting...');
          return { output: '', success: true };
        }

        if (isConnected) {
          const eoaStatusData = [
            { key: 'EOA Wallet Status', value: 'Connected ✅' },
            { key: 'Address', value: formatAddress(address) },
            { key: 'Full Address', value: address },
            { key: 'Network', value: NETWORK_INFO.name },
            { key: 'Chain ID', value: NETWORK_INFO.chainId.toString() },
            { key: 'Environment', value: NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet' }
          ];
          await printer.printKeyValues(eoaStatusData);

          await printer.print(''); // Blank line for separation

          const smartWalletInfo = smartWalletManager.isInitialized() 
            ? await smartWalletManager.getWalletInfo().catch(() => null)
            : null;
          
          const swStatusData = [
            { key: 'Smart Wallet Status', value: smartWalletInfo ? '✅ Active' : '❌ Not created' }
          ];
          if (smartWalletInfo) {
            swStatusData.push({ key: 'Smart Address', value: smartWalletInfo.address });
            swStatusData.push({ key: 'Gasless Mode', value: smartWalletInfo.gasless ? '✅ Enabled' : '❌ Disabled' });
          } else {
            swStatusData.push({key: '', value: 'Use "smart create" to create a smart wallet.'});
          }
          await printer.printKeyValues(swStatusData);

          await printer.print('\n💡 You have both EOA and smart wallet capabilities available!');
          return { output: '', success: true };
        }

        // Not connected
        const notConnectedData = [
            { key: 'EOA Wallet Status', value: 'Not connected ❌' },
            { key: 'Network', value: NETWORK_INFO.name }
        ];
        await printer.printKeyValues(notConnectedData);
        await printer.print('Use "wallet connect" to connect your wallet');
        await printer.print('\nSmart Wallet Status: ❌ Not available (requires connected EOA)');
        return { output: '', success: true };
      } // Closing status case

      case 'address': { // Added scope
        if (!isConnected) {
          return {
            output: 'No wallet connected. Use "wallet connect" first.',
            success: false
          }
        }
        
        const smartWalletInfo = smartWalletManager.isInitialized() 
          ? await smartWalletManager.getWalletInfo().catch(() => null)
          : null;
        
        await printer.print('EOA Wallet Address:');
        const eoaAddressData = [
          { key: 'Full Address', value: address },
          { key: 'Short Address', value: formatAddress(address) },
          { key: 'Network', value: NETWORK_INFO.name }
        ];
        await printer.printKeyValues(eoaAddressData, { indent: 0 });

        if (smartWalletInfo) {
          await printer.print('\nSmart Wallet Address:');
          const swAddressData = [
            { key: 'Full Address', value: smartWalletInfo.address },
            { key: 'Short Address', value: formatAddress(smartWalletInfo.address) },
            { key: 'Relationship', value: 'Smart wallet controlled by EOA' }
          ];
          await printer.printKeyValues(swAddressData, { indent: 0 });
        } else {
          await printer.print('\nNo smart wallet created');
        }
        return { output: '', success: true };
      } // Close 'address' scope
      
      case 'balance': { // Added scope
        if (!isConnected) {
          return {
            output: 'No wallet connected. Use "wallet connect" first.',
            success: false
          }
        }
        
        try {
          const balanceResult = await alchemyUtils.getBalance(address);
          const gasPriceResult = await alchemyUtils.getGasPrice();
          
          await printer.print(`EOA Wallet Balance (${NETWORK_INFO.name}):`);
          const eoaBalanceData = [
            { key: 'Address', value: formatAddress(address) },
            { key: 'Balance', value: balanceResult.formatted },
            { key: 'Wei', value: balanceResult.wei.toString() }
          ];
          await printer.printKeyValues(eoaBalanceData);

          if (smartWalletManager.isInitialized()) {
            try {
              const smartInfo = await smartWalletManager.getWalletInfo();
              await printer.print('\nSmart Wallet Balance:');
              const swBalanceData = [
                { key: 'Balance', value: smartInfo.balance },
                { key: 'Address', value: formatAddress(smartInfo.address) }
              ];
              await printer.printKeyValues(swBalanceData);
            } catch {
              await printer.print('\nSmart Wallet: Error fetching balance');
            }
          }
          
          await printer.print('\nNetwork Info:');
          const networkData = [
            { key: 'Gas Price', value: gasPriceResult.formatted },
            { key: 'Chain ID', value: NETWORK_INFO.chainId.toString() }
          ];
          await printer.printKeyValues(networkData);

          await printer.print(`\n💡 Tips:
  • Use "alchemy tokens ${address}" to see token balances
  • Create smart wallet for gasless transactions: "smart create --gasless"`);
          return { output: '', success: true };

        } catch (error) {
          await printer.error(`Failed to fetch balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
          await printer.print(`Make sure you're connected to ${NETWORK_INFO.name} and your API key is valid.`);
          return { output: '', success: false };
        }
      }
      
      case 'network': {
        await printer.print('Current Network Configuration:');
        const netData = [
          { key: 'Name', value: NETWORK_INFO.name },
          { key: 'Chain ID', value: NETWORK_INFO.chainId.toString() },
          { key: 'Type', value: NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet' },
          { key: 'RPC', value: NETWORK_INFO.viemChain.rpcUrls.default.http[0] }
        ];
        await printer.printKeyValues(netData);

        await printer.print(`\n${isConnected ? `Connected EOA Wallet: ${formatAddress(address)}` : 'No EOA wallet connected'}`);
        await printer.print(`${smartWalletManager.isInitialized() ? 'Smart Wallet: ✅ Active' : 'Smart Wallet: ❌ Not created'}`);

        await printer.print(`\n💡 This app supports both EOA and smart wallets on ${NETWORK_INFO.name}`);
        return { output: '', success: true };
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