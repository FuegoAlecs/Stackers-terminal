import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { alchemyUtils, viemUtils, NETWORK_INFO, checkAlchemyConnection } from '../lib/alchemy'

export const alchemyCommand: CommandHandler = {
  name: 'alchemy',
  description: 'Interact with Alchemy API and Base Sepolia network',
  usage: 'alchemy <subcommand> [args...]',
  aliases: ['al'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
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
        
        case 'nfts':
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy nfts <address>\nExample: alchemy nfts 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const nftAddress = args[1]
          const nfts = await alchemyUtils.getNFTs(nftAddress)
          
          if (nfts.ownedNfts.length === 0) {
            return {
              output: `No NFTs found for address: ${nftAddress}`,
              success: true
            }
          }
          
          const nftList = nfts.ownedNfts.slice(0, 5).map((nft, index) => 
            `${index + 1}. ${nft.title || 'Untitled'} (${nft.contract.address})`
          ).join('\n')
          
          return {
            output: `NFTs owned by ${nftAddress}:
Total: ${nfts.totalCount}
Showing first 5:
${nftList}

${nfts.totalCount > 5 ? `... and ${nfts.totalCount - 5} more` : ''}`,
            success: true
          }
        
        case 'tokens':
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy tokens <address>\nExample: alchemy tokens 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const tokenAddress = args[1]
          const tokens = await alchemyUtils.getTokenBalances(tokenAddress)
          
          const nonZeroTokens = tokens.tokenBalances.filter(token => 
            token.tokenBalance && token.tokenBalance !== '0x0'
          )
          
          if (nonZeroTokens.length === 0) {
            return {
              output: `No token balances found for address: ${tokenAddress}`,
              success: true
            }
          }
          
          const tokenList = nonZeroTokens.slice(0, 10).map((token, index) => {
            const balance = parseInt(token.tokenBalance || '0', 16)
            return `${index + 1}. ${token.contractAddress}: ${balance}`
          }).join('\n')
          
          return {
            output: `Token Balances for ${tokenAddress}:
${tokenList}

Note: Showing raw balances. Use token-specific decimals for accurate amounts.`,
            success: true
          }
        
        case 'history':
          if (args.length < 2) {
            return {
              output: 'Usage: alchemy history <address>\nExample: alchemy history 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const historyAddress = args[1]
          const history = await alchemyUtils.getTransactionHistory(historyAddress)
          
          if (history.transfers.length === 0) {
            return {
              output: `No transaction history found for address: ${historyAddress}`,
              success: true
            }
          }
          
          const recentTxs = history.transfers.slice(0, 5).map((tx, index) => {
            const value = tx.value ? `${parseFloat(tx.value.toString())} ${tx.asset}` : 'N/A'
            return `${index + 1}. ${tx.hash?.slice(0, 10)}... | ${value} | Block: ${tx.blockNum}`
          }).join('\n')
          
          return {
            output: `Recent Transactions for ${historyAddress}:
${recentTxs}

Total found: ${history.transfers.length}`,
            success: true
          }
        
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