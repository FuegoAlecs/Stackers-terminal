import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { writeContractFunction, parseWriteInput, estimateWriteGas } from '../lib/contractWrite'
import { NETWORK_INFO } from '../lib/alchemy'

export const writeCommand: CommandHandler = {
  name: 'write',
  description: 'Send write transactions to deployed smart contracts',
  usage: 'write <address.function(args...)> [options]',
  aliases: ['tx', 'send'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      return {
        output: `Smart Contract Write Transaction Commands:
  write <address.function(args)>     - Send a write transaction
  write estimate <address.function>  - Estimate gas for transaction
  write help                         - Show detailed help

Examples:
  write 0xABC.setMessage("Hello World")
  write 0xDEF.transfer("0x123...",1000)
  write 0x789.approve("0xSpender",500)
  write 0xCounter.increment()

Transaction Options:
  --gas-limit <number>    - Set custom gas limit
  --gas-price <gwei>      - Set custom gas price
  --value <eth>           - Send ETH with transaction

Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})

⚠️  Requirements:
  • Connected wallet with sufficient balance
  • Valid contract address and function
  • Correct function arguments
  • Sufficient gas for transaction

💡 Note: Write transactions modify blockchain state and cost gas.`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'estimate':
          if (args.length < 2) {
            return {
              output: 'Usage: write estimate <address.function(args)>\nExample: write estimate 0xABC.setMessage("Hello")',
              success: false
            }
          }
          
          const estimateInput = args.slice(1).join(' ')
          const parsedEstimate = parseWriteInput(estimateInput)
          
          if (!parsedEstimate.success) {
            return {
              output: `❌ Invalid transaction syntax: ${parsedEstimate.error}

Expected format: <address>.<function>(<args>)
Examples:
  • 0xABC.setMessage("Hello")
  • 0xDEF.transfer("0x123...",1000)
  • 0x789.increment()`,
              success: false
            }
          }
          
          const gasEstimate = await estimateWriteGas(
            parsedEstimate.contractAddress!,
            parsedEstimate.functionName!,
            parsedEstimate.arguments!,
            parsedEstimate.options
          )
          
          if (!gasEstimate.success) {
            return {
              output: `❌ Gas estimation failed: ${gasEstimate.error}

Possible causes:
  • Function doesn't exist or isn't payable
  • Invalid arguments provided
  • Transaction would revert
  • Insufficient wallet balance`,
              success: false
            }
          }
          
          return {
            output: `⛽ Gas Estimation for Transaction:

📋 Transaction Details:
  Contract: ${parsedEstimate.contractAddress}
  Function: ${parsedEstimate.functionName}(${parsedEstimate.arguments?.join(', ') || ''})
  Network: ${NETWORK_INFO.name}

💰 Cost Breakdown:
  Gas Limit: ${gasEstimate.gasLimit?.toLocaleString() || 'N/A'}
  Gas Price: ${gasEstimate.gasPrice || 'N/A'}
  Total Cost: ${gasEstimate.totalCost || 'N/A'}
  USD Estimate: ${gasEstimate.usdEstimate ? `$${gasEstimate.usdEstimate.toFixed(2)}` : 'N/A'}

${parsedEstimate.options?.value ? `💸 ETH Value: ${parsedEstimate.options.value} ETH` : ''}

⚠️  Important:
  • Gas estimation may differ from actual usage
  • Transaction may fail if conditions change
  • Always verify function arguments before sending

💡 To send the transaction: write ${estimateInput}`,
            success: true
          }
        
        case 'help':
          return {
            output: `Smart Contract Write Transaction Help:

SYNTAX:
  write <contract_address>.<function_name>(<arguments>)

EXAMPLES:
  write 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b.setMessage("Hello")
  write 0xABC.transfer("0x123...",1000)
  write 0xDEF.approve("0xSpender",500)
  write 0x789.increment()
  write 0xCounter.reset()

ARGUMENT TYPES:
  String:    "Hello World" or 'Hello World'
  Number:    123 or 0x1A (hex)
  Address:   0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b
  Boolean:   true or false
  Array:     [1,2,3] or ["a","b","c"]
  Bytes:     0x1234abcd

TRANSACTION OPTIONS:
  --gas-limit <number>    Set custom gas limit
  --gas-price <gwei>      Set custom gas price in Gwei
  --value <eth>           Send ETH with the transaction

EXAMPLES WITH OPTIONS:
  write 0xABC.setMessage("Hello") --gas-limit 100000
  write 0xDEF.transfer("0x123",100) --gas-price 25
  write 0x789.deposit() --value 0.1

COMMON CONTRACT FUNCTIONS:
  ERC20 Tokens:
    • transfer(address,uint256)
    • approve(address,uint256)
    • transferFrom(address,address,uint256)

  Simple Contracts:
    • setMessage(string)
    • increment()
    • decrement()
    • reset()
    • deposit() [payable]
    • withdraw(uint256)

REQUIREMENTS:
  ✅ Connected wallet (use "wallet connect")
  ✅ Sufficient ETH balance for gas
  ✅ Correct network (${NETWORK_INFO.name})
  ✅ Valid contract address
  ✅ Correct function signature and arguments

TRANSACTION PROCESS:
  1. Parse function call and arguments
  2. Estimate gas requirements
  3. Submit transaction to network
  4. Wait for confirmation
  5. Display transaction hash and status

NETWORK INFO:
  Current Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}
  Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

TROUBLESHOOTING:
  • "Insufficient funds" → Check wallet balance
  • "Transaction reverted" → Verify function logic
  • "Invalid arguments" → Check argument types
  • "Function not found" → Verify function exists
  • "Gas estimation failed" → Function may not be payable

⚠️  IMPORTANT:
  • Write transactions cost gas and are irreversible
  • Always test on testnet first
  • Double-check all arguments before sending
  • Keep transaction hashes for reference`,
            success: true
          }
        
        default:
          // Parse the write transaction
          const writeInput = args.join(' ')
          const parsedWrite = parseWriteInput(writeInput)
          
          if (!parsedWrite.success) {
            return {
              output: `❌ Invalid transaction syntax: ${parsedWrite.error}

Expected format: <address>.<function>(<args>)
Examples:
  • 0xABC.setMessage("Hello World")
  • 0xDEF.transfer("0x123...",1000)
  • 0x789.increment()

Use "write help" for detailed syntax information.`,
              success: false
            }
          }
          
          // Execute the write transaction
          const result = await writeContractFunction(
            parsedWrite.contractAddress!,
            parsedWrite.functionName!,
            parsedWrite.arguments!,
            parsedWrite.options
          )
          
          if (!result.success) {
            return {
              output: `❌ Transaction failed: ${result.error}

Common causes:
  • Insufficient wallet balance for gas
  • Transaction would revert (check function logic)
  • Invalid function arguments
  • Network connectivity issues
  • User rejected transaction

💡 Try:
  • "wallet balance" - Check your balance
  • "write estimate ${writeInput}" - Estimate gas first
  • Verify function arguments and contract address`,
              success: false
            }
          }
          
          return {
            output: `🚀 Transaction Sent Successfully!

📋 Transaction Details:
  Contract: ${parsedWrite.contractAddress}
  Function: ${parsedWrite.functionName}(${parsedWrite.arguments?.join(', ') || ''})
  Network: ${NETWORK_INFO.name}

🧾 Transaction Hash:
  ${result.transactionHash}

⏳ Status: ${result.status || 'Pending confirmation...'}

${result.blockNumber ? `📦 Block Number: ${result.blockNumber}` : '⏱️  Waiting for confirmation...'}

⛽ Gas Information:
  Gas Used: ${result.gasUsed?.toLocaleString() || 'Pending...'}
  Gas Price: ${result.gasPrice || 'Pending...'}
  Total Cost: ${result.totalCost || 'Calculating...'}

${parsedWrite.options?.value ? `💸 ETH Sent: ${parsedWrite.options.value} ETH` : ''}

🔗 Useful Commands:
  alchemy tx ${result.transactionHash}  - View transaction details
  wallet balance                        - Check remaining balance

💡 Transaction is being processed by the network. 
   It may take a few moments to confirm.`,
            success: true
          }
      }
    } catch (error) {
      return {
        output: `Write transaction error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Network connectivity issues
  • Wallet not connected
  • Insufficient balance for gas
  • Invalid contract or function

Use "wallet status" to check your connection.`,
        success: false
      }
    }
  }
}

commandRouter.register(writeCommand)