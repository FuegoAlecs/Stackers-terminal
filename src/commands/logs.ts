import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { getContractEvents, getRecentEvents, formatEventLog, COMMON_EVENT_SIGNATURES } from '../lib/eventLogs'
import { abiManager } from '../lib/ABIManager'
import { NETWORK_INFO } from '../lib/alchemy'

export const logsCommand: CommandHandler = {
  name: 'logs',
  description: 'Fetch and decode contract event logs using loaded ABIs',
  usage: 'logs <address> [abi] [options]',
  aliases: ['events'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      const abiCount = abiManager.listABIs().length
      return {
        output: `Contract Event Logs Commands:
  logs <address> [abi]                 - Get recent events from contract
  logs <address> <abi> --event <name>  - Get specific event type
  logs <address> --from <block>        - Get events from specific block
  logs <address> --limit <number>      - Limit number of results
  logs recent                          - Get recent events from all known contracts
  logs help                            - Show detailed help

Options:
  --from <block>     Start from block number (default: last 1000 blocks)
  --to <block>       End at block number (default: latest)
  --event <name>     Filter by specific event name
  --limit <number>   Maximum number of events to return

Examples:
  logs 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b ERC20
  logs 0xABC --event Transfer --limit 10
  logs 0xDEF --from 1000000 --to 1001000

Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})
Loaded ABIs: ${abiCount}

💡 Load contract ABIs first for better event decoding!`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'recent':
          // Get recent events from all known contracts
          const abis = abiManager.listABIs()
          if (abis.length === 0) {
            return {
              output: `No ABIs loaded to fetch events from.

Load some ABIs first:
  decode abi load MyContract '<abi_json>'
  
Then specify contract addresses:
  logs <contract_address> <abi_name>`,
              success: false
            }
          }
          
          return {
            output: `Recent events feature requires specific contract addresses.

Usage:
  logs <contract_address> [abi_name]
  
Available ABIs: ${abis.map(abi => abi.name).join(', ')}

Example:
  logs 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b ERC20`,
            success: true
          }
        
        case 'help':
          return {
            output: `Contract Event Logs Help:

OVERVIEW:
  The logs command fetches and decodes event logs from smart contracts
  using loaded ABIs. It helps you monitor contract activity and understand
  what events have been emitted.

BASIC USAGE:
  logs <contract_address> [abi_name] [options]

EXAMPLES:

1. Get Recent Events:
   logs 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b ERC20
   
2. Get Specific Event Type:
   logs 0xABC ERC20 --event Transfer
   
3. Get Events from Block Range:
   logs 0xDEF --from 1000000 --to 1001000
   
4. Limit Results:
   logs 0x123 --limit 5

OPTIONS:
  --from <block>     Start block number (default: latest - 1000)
  --to <block>       End block number (default: latest)
  --event <name>     Filter by specific event name
  --limit <number>   Maximum events to return (default: unlimited)

ABI INTEGRATION:
  • Load ABIs first: decode abi load MyContract '<abi_json>'
  • Events are automatically decoded using the ABI
  • Without ABI, shows raw log data
  • Use built-in ABIs: ERC20, ERC721

EVENT DECODING:
  ✅ Indexed parameters (from topics)
  ✅ Non-indexed parameters (from data)
  ✅ Parameter names and types
  ✅ Human-readable values
  ✅ Event signatures

COMMON EVENT TYPES:

ERC20 Token Events:
  • Transfer(address,address,uint256) - Token transfers
  • Approval(address,address,uint256) - Spending approvals

ERC721 NFT Events:
  • Transfer(address,address,uint256) - NFT transfers
  • Approval(address,address,uint256) - NFT approvals
  • ApprovalForAll(address,address,bool) - Operator approvals

Contract Management:
  • OwnershipTransferred(address,address) - Owner changes
  • Paused(address) - Contract paused
  • Unpaused(address) - Contract unpaused

DEX/DeFi Events:
  • Swap(...) - Token swaps
  • Mint(...) - Liquidity provision
  • Burn(...) - Liquidity removal

NETWORK INFO:
  Current Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}
  Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

BLOCK RANGES:
  • Default: Last 1000 blocks
  • Use --from and --to for custom ranges
  • Large ranges may take longer to process
  • Some networks have query limits

OUTPUT FORMAT:
  Each event shows:
  • Event name and ABI source
  • Block number and transaction hash
  • Indexed parameters (from topics)
  • Data parameters (from log data)
  • Human-readable parameter values

TROUBLESHOOTING:
  • "No events found" → Check contract address and block range
  • "Event not decoded" → Load the correct ABI
  • "ABI not found" → Use "decode abi list" to see loaded ABIs
  • "Invalid address" → Verify contract address format

WORKFLOW:
  1. Load contract ABI: decode abi load MyContract '<abi>'
  2. Fetch events: logs <address> MyContract
  3. Filter if needed: logs <address> MyContract --event Transfer
  4. Analyze the decoded event data

💡 Pro Tips:
  • Load ABIs for better event decoding
  • Use --limit for faster queries
  • Filter by event type for specific monitoring
  • Check recent blocks for latest activity`,
            success: true
          }
        
        default:
          // Parse contract address and options
          const contractAddress = args[0]
          
          // Validate contract address
          if (!isValidAddress(contractAddress)) {
            return {
              output: `❌ Invalid contract address: ${contractAddress}

Address must be 42 characters long and start with 0x.
Example: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b`,
              success: false
            }
          }
          
          // Parse arguments
          const options = parseLogsOptions(args.slice(1))
          
          // Fetch and decode events
          const result = await getContractEvents(contractAddress, options.abiName, {
            fromBlock: options.fromBlock,
            toBlock: options.toBlock,
            eventName: options.eventName,
            limit: options.limit
          })
          
          if (!result.success) {
            return {
              output: `❌ Failed to fetch events: ${result.error}

💡 Tips:
  • Verify the contract address is correct
  • Load the appropriate ABI: decode abi load <name> <json>
  • Check the block range is valid
  • Ensure the contract has emitted events`,
              success: false
            }
          }
          
          if (result.logs.length === 0) {
            return {
              output: `📭 No events found for contract ${contractAddress}

📊 Search Details:
  Block Range: ${result.fromBlock} → ${result.toBlock}
  Network: ${NETWORK_INFO.name}
  ${options.eventName ? `Event Filter: ${options.eventName}` : 'All Events'}
  ${options.abiName ? `ABI: ${options.abiName}` : 'No ABI specified'}

💡 Possible reasons:
  • Contract hasn't emitted events in this block range
  • Events might be in different blocks (try --from <earlier_block>)
  • Contract might not emit events
  • Wrong contract address`,
              success: true
            }
          }
          
          // Format output
          let output = `📜 Contract Events Found: ${result.logs.length}${result.totalFound > result.logs.length ? ` (showing ${result.logs.length} of ${result.totalFound})` : ''}

📋 Contract Details:
  Address: ${contractAddress}
  Network: ${NETWORK_INFO.name}
  Block Range: ${result.fromBlock} → ${result.toBlock}
  ${options.abiName ? `ABI: ${options.abiName}` : 'ABI: Auto-detected'}
  ${options.eventName ? `Event Filter: ${options.eventName}` : 'Filter: All Events'}

📊 Events:`
          
          result.logs.forEach((log, index) => {
            output += '\n\n' + formatEventLog(log, index)
          })
          
          // Add summary and tips
          const decodedCount = result.logs.filter(log => log.decoded).length
          const undecodedCount = result.logs.length - decodedCount
          
          output += `\n\n📈 Summary:
  ✅ Decoded Events: ${decodedCount}
  ❓ Undecoded Events: ${undecodedCount}
  📦 Total Blocks Scanned: ${result.toBlock - result.fromBlock + 1}`
          
          if (undecodedCount > 0) {
            output += `\n\n💡 To decode more events:
  • Load the contract's ABI: decode abi load ContractName '<abi_json>'
  • Check if events are from other contracts
  • Verify ABI contains the event definitions`
          }
          
          if (result.logs.length >= 50) {
            output += `\n\n⚠️  Large result set. Consider:
  • Using --limit <number> to reduce results
  • Filtering by --event <name> for specific events
  • Using smaller block ranges with --from and --to`
          }
          
          return {
            output,
            success: true
          }
      }
    } catch (error) {
      return {
        output: `Event logs error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Network connectivity issues
  • Invalid block range
  • Contract doesn't exist
  • Alchemy API limitations

Use "logs help" for detailed usage information.`,
        success: false
      }
    }
  }
}

interface LogsOptions {
  abiName?: string
  fromBlock?: number
  toBlock?: number
  eventName?: string
  limit?: number
}

function parseLogsOptions(args: string[]): LogsOptions {
  const options: LogsOptions = {}
  
  // First non-flag argument might be ABI name
  let i = 0
  if (i < args.length && !args[i].startsWith('--')) {
    options.abiName = args[i]
    i++
  }
  
  // Parse flags
  while (i < args.length) {
    const arg = args[i]
    
    if (arg === '--from' && i + 1 < args.length) {
      const blockNum = parseInt(args[i + 1])
      if (!isNaN(blockNum)) {
        options.fromBlock = blockNum
      }
      i += 2
    } else if (arg === '--to' && i + 1 < args.length) {
      const blockNum = parseInt(args[i + 1])
      if (!isNaN(blockNum)) {
        options.toBlock = blockNum
      }
      i += 2
    } else if (arg === '--event' && i + 1 < args.length) {
      options.eventName = args[i + 1]
      i += 2
    } else if (arg === '--limit' && i + 1 < args.length) {
      const limit = parseInt(args[i + 1])
      if (!isNaN(limit) && limit > 0) {
        options.limit = limit
      }
      i += 2
    } else {
      i++
    }
  }
  
  return options
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

commandRouter.register(logsCommand)