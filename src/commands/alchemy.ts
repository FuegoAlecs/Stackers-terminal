import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { alchemyUtils, viemUtils, NETWORK_INFO, checkAlchemyConnection } from '../lib/alchemy'

export const alchemyCommand: CommandHandler = {
  name: 'alchemy',
  description: 'Interact with Alchemy API and Base Sepolia network',
  usage: 'alchemy <subcommand> [args...]',
  aliases: ['al'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, printer } = context; // Added printer

    if (!printer) {
      return { output: 'Error: Printer not available.', success: false };
    }
    
    if (args.length === 0) {
      return {
        output: `Alchemy Commands:
  alchemy status           - Check Alchemy connection and network info
  alchemy balance <addr>   - Get ETH balance for address
  alchemy gas             - Get current gas price
  alchemy block [number]  - Get block information
  alchemy tx <hash>       - Get transaction details
  alchemy nfts <addr>     - Get NFTs owned by address
  alchemy tokens <addr>   - Get token balances for address
  alchemy history <addr>  - Get transaction history for address

Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})
Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

Aliases: al status, al balance, etc.`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'status':
          const isConnected = await checkAlchemyConnection()
          return {
            output: `Alchemy Connection: ${isConnected ? '✅ Connected' : '❌ Failed'}
Network: ${NETWORK_INFO.name}
Chain ID: ${NETWORK_INFO.chainId}
Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}
RPC Endpoint: ${NETWORK_INFO.viemChain.rpcUrls.default.http[0]}

${isConnected ? 'Ready to execute blockchain queries!' : 'Check your API key configuration.'}`,
            success: isConnected
          }
        
        case 'balance':
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy balance <address>\nExample: alchemy balance 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const address = args[1]
          if (!address.startsWith('0x') || address.length !== 42) {
            return {
              output: 'Invalid Ethereum address format. Address should start with 0x and be 42 characters long.',
              success: false
            }
          }
          
          const balance = await alchemyUtils.getBalance(address)
          return {
            output: `Balance for ${address}:
ETH: ${balance.formatted}
Wei: ${balance.wei}
Network: ${NETWORK_INFO.name}`,
            success: true
          }
        
        case 'gas':
          const gasPrice = await alchemyUtils.getGasPrice()
          const viemGasPrice = await viemUtils.getGasPrice()
          return {
            output: `Current Gas Price (${NETWORK_INFO.name}):
Alchemy SDK: ${gasPrice.formatted}
Viem Client: ${viemGasPrice.formatted}
Wei: ${gasPrice.wei}`,
            success: true
          }
        
        case 'block':
          const blockNumber = args.length > 1 ? parseInt(args[1]) : undefined
          const block = await alchemyUtils.getBlock(blockNumber)
          return {
            output: `Block Information:
Number: ${block.number}
Hash: ${block.hash}
Timestamp: ${new Date(block.timestamp * 1000).toISOString()}
Transactions: ${block.transactions.length}
Gas Used: ${block.gasUsed?.toString() || 'N/A'}
Gas Limit: ${block.gasLimit?.toString() || 'N/A'}`,
            success: true
          }
        
        case 'tx':
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy tx <transaction_hash>\nExample: alchemy tx 0x1234...',
              success: false
            }
          }
          
          const txHash = args[1]
          const transaction = await alchemyUtils.getTransaction(txHash)
          
          if (!transaction) {
            return {
              output: `Transaction not found: ${txHash}`,
              success: false
            }
          }
          
          return {
            output: `Transaction Details:
Hash: ${transaction.hash}
From: ${transaction.from}
To: ${transaction.to || 'Contract Creation'}
Value: ${parseFloat(transaction.value?.toString() || '0') / 1e18} ETH
Gas Price: ${parseFloat(transaction.gasPrice?.toString() || '0') / 1e9} Gwei
Block: ${transaction.blockNumber}
Status: ${transaction.blockNumber ? 'Confirmed' : 'Pending'}`,
            success: true
          }
        
        case 'nfts': { // Added block scope
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy nfts <address>\nExample: alchemy nfts 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const nftAddress = args[1];
          const nfts = await alchemyUtils.getNFTs(nftAddress);
          
          if (nfts.ownedNfts.length === 0) {
            await printer.print(`No NFTs found for address: ${nftAddress}`);
            return { output: '', success: true };
          }
          
          await printer.print(`NFTs owned by ${nftAddress} (Total: ${nfts.totalCount}):`);
          const headers = ['#', 'Title', 'Contract Address'];
          const rows = nfts.ownedNfts.slice(0, 10).map((nft, index) => [ // Show up to 10
            (index + 1).toString(),
            nft.name || nft.title || 'Untitled', // Prefer name, then title
            nft.contract.address
          ]);
          await printer.table(headers, rows);

          if (nfts.totalCount > 10) {
            await printer.print(`\n... and ${nfts.totalCount - 10} more. Increase limit in code if needed.`);
          }
          return { output: '', success: true };
        } // Closed block scope for nfts
        
        case 'tokens': { // Added block scope
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy tokens <address>\nExample: alchemy tokens 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const tokenAddress = args[1];
          const tokenBalancesResult = await alchemyUtils.getTokenBalances(tokenAddress); // Renamed variable
          
          const nonZeroTokens = tokenBalancesResult.tokenBalances.filter(token =>
            token.tokenBalance && token.tokenBalance !== '0x0' && token.tokenBalance !== '0' // Added '0' check
          );
          
          if (nonZeroTokens.length === 0) {
            await printer.print(`No token balances found for address: ${tokenAddress}`);
            return { output: '', success: true };
          }
          
          await printer.print(`Token Balances for ${tokenAddress}:`);
          // Consider adding token symbols or names if available and decimals for formatted balance
          const headers = ['#', 'Contract Address', 'Raw Balance'];
          const rows = nonZeroTokens.slice(0, 15).map((token, index) => { // Show up to 15
            // Assuming balance is hex. If it can be decimal string, adjust parsing.
            const balance = BigInt(token.tokenBalance || '0').toString(); // Keep as full number string
            return [
              (index + 1).toString(),
              token.contractAddress,
              balance
            ];
          });
          await printer.table(headers, rows);
          
          if (nonZeroTokens.length > 15) {
            await printer.print(`\n... and ${nonZeroTokens.length - 15} more tokens.`);
          }
          await printer.print(`\nNote: Showing raw integer balances. Use token-specific decimals for accurate display.`);
          return { output: '', success: true };
        } // Closed block scope for tokens
        
        case 'history': { // Added block scope
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy history <address>\nExample: alchemy history 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const historyAddress = args[1];
          const historyResult = await alchemyUtils.getTransactionHistory(historyAddress); // Renamed
          
          if (historyResult.transfers.length === 0) {
            await printer.print(`No transaction history found for address: ${historyAddress}`);
            return { output: '', success: true };
          }
          
          await printer.print(`Recent Transactions for ${historyAddress} (Total found: ${historyResult.transfers.length}):`);
          const headers = ['#', 'Hash', 'Value', 'Asset', 'Block'];
          const rows = historyResult.transfers.slice(0, 10).map((tx, index) => { // show up to 10
            const valueDisplay = tx.value ? parseFloat(tx.value.toString()).toLocaleString() : 'N/A';
            return [
              (index + 1).toString(),
              `${tx.hash?.slice(0, 10)}...${tx.hash?.slice(-4) || ''}`,
              valueDisplay,
              tx.asset || 'N/A',
              tx.blockNum?.toString() || 'N/A'
            ];
          });
          await printer.table(headers, rows);

          if (historyResult.transfers.length > 10) {
            await printer.print(`\n... and ${historyResult.transfers.length - 10} more transactions.`);
          }
          return { output: '', success: true };
        } // Closed block scope for history
        
        default:
          return {
            output: `Unknown alchemy command: ${subcommand}
Available commands: status, balance, gas, block, tx, nfts, tokens, history`,
            success: false
          }
      }
    } catch (error) {
      return {
        output: `Alchemy API Error: ${error instanceof Error ? error.message : 'Unknown error'}
Check your API key and network connection.`,
        success: false
      }
    }
  }
}

commandRouter.register(alchemyCommand)