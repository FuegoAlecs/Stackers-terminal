import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { callContractFunction, parseCallInput, getContractInfo } from '../lib/contractCall'
import { NETWORK_INFO } from '../lib/alchemy'

export const callCommand: CommandHandler = {
  name: 'call',
  description: 'Call read-only functions on deployed smart contracts',
  usage: 'call <address.function(args...)> [options]',
  aliases: ['read', 'view'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      return {
        output: `Smart Contract Function Call Commands:
  call <address.function()>           - Call a read-only function
  call <address.function(arg1,arg2)>  - Call function with arguments
  call info <address>                 - Get contract information
  call help                           - Show detailed help

Examples:
  call 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b.balanceOf(0x123...)
  call 0xABC123.name()
  call 0xDEF456.totalSupply()
  call 0x789.getUser(123)

Supported Argument Types:
  • Strings: "Hello World"
  • Numbers: 123, 0x1A
  • Addresses: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b
  • Booleans: true, false
  • Arrays: [1,2,3] or ["a","b","c"]

Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})

💡 Note: This command only works with read-only (view/pure) functions.`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'info':
          if (args.length < 2) {
            return {
              output: 'Usage: call info <contract_address>\nExample: call info 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b',
              success: false
            }
          }
          
          const contractAddress = args[1]
          if (!isValidAddress(contractAddress)) {
            return {
              output: `Invalid contract address: ${contractAddress}
Address must be 42 characters long and start with 0x`,
              success: false
            }
          }
          
          const contractInfo = await getContractInfo(contractAddress)
          
          if (!contractInfo.success) {
            return {
              output: `❌ Failed to get contract info: ${contractInfo.error}`,
              success: false
            }
          }
          
          return {
            output: `📋 Contract Information:
Address: ${contractAddress}
Network: ${NETWORK_INFO.name}
Chain ID: ${NETWORK_INFO.chainId}

📊 Contract Details:
  Bytecode Size: ${contractInfo.bytecodeSize} bytes
  ${contractInfo.isContract ? '✅ Valid contract' : '❌ No contract at this address'}
  
💡 To call functions, you need the contract's ABI. Common function patterns:
  • ERC20 tokens: name(), symbol(), totalSupply(), balanceOf(address)
  • Counters: count(), getCount()
  • Storage: get(), getValue()
  
Example: call ${contractAddress}.name()`,
            success: true
          }
        
        case 'help':
          return {
            output: `Smart Contract Function Call Help:

SYNTAX:
  call <contract_address>.<function_name>(<arguments>)

EXAMPLES:
  call 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b.name()
  call 0xABC.balanceOf("0x123...")
  call 0xDEF.getUser(123)
  call 0x789.allowance("0xOwner","0xSpender")

ARGUMENT TYPES:
  String:    "Hello World" or 'Hello World'
  Number:    123 or 0x1A (hex)
  Address:   0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b
  Boolean:   true or false
  Array:     [1,2,3] or ["a","b","c"]
  Bytes:     0x1234abcd

COMMON CONTRACT FUNCTIONS:
  ERC20 Tokens:
    • name() → string
    • symbol() → string  
    • decimals() → uint8
    • totalSupply() → uint256
    • balanceOf(address) → uint256
    • allowance(address,address) → uint256

  Simple Contracts:
    • count() → uint256
    • get() → uint256
    • message() → string
    • owner() → address

LIMITATIONS:
  • Only read-only (view/pure) functions
  • Requires contract to be deployed
  • Function must exist in contract
  • Arguments must match function signature

NETWORK INFO:
  Current Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}
  Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

TROUBLESHOOTING:
  • "Function not found" → Check function name spelling
  • "Invalid arguments" → Verify argument types and count
  • "Contract not found" → Verify contract address
  • "Execution reverted" → Function may have failed internally

💡 Tips:
  • Use "call info <address>" to verify contract exists
  • Start with simple functions like name() or symbol()
  • Check contract documentation for available functions`,
            success: true
          }
        
        default:
          // Parse the function call
          const callInput = args.join(' ')
          const parsedCall = parseCallInput(callInput)
          
          if (!parsedCall.success) {
            return {
              output: `❌ Invalid call syntax: ${parsedCall.error}

Expected format: <address>.<function>(<args>)
Examples:
  • 0xABC.name()
  • 0xDEF.balanceOf("0x123...")
  • 0x789.getUser(123)

Use "call help" for detailed syntax information.`,
              success: false
            }
          }
          
          // Execute the contract call
          const result = await callContractFunction(
            parsedCall.contractAddress!,
            parsedCall.functionName!,
            parsedCall.arguments!
          )
          
          if (!result.success) {
            return {
              output: `❌ Contract call failed: ${result.error}

Possible causes:
  • Function doesn't exist in contract
  • Invalid arguments provided
  • Contract execution reverted
  • Network connectivity issues

💡 Try:
  • call info ${parsedCall.contractAddress} - Check if contract exists
  • Verify function name and arguments
  • Check if function is view/pure (read-only)`,
              success: false
            }
          }
          
          return {
            output: `✅ Contract Call Successful:

📋 Call Details:
  Contract: ${parsedCall.contractAddress}
  Function: ${parsedCall.functionName}(${parsedCall.arguments?.join(', ') || ''})
  Network: ${NETWORK_INFO.name}

📤 Result:
  ${formatCallResult(result.result, result.returnType)}

⛽ Gas Used: ${result.gasUsed?.toLocaleString() || 'N/A'} (estimated)
🕒 Block: ${result.blockNumber || 'Latest'}

${result.returnType ? `📝 Return Type: ${result.returnType}` : ''}`,
            success: true
          }
      }
    } catch (error) {
      return {
        output: `Contract call error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Invalid contract address or function name
  • Network connectivity issues
  • Function execution failure
  • Incorrect argument types

Use "call help" for syntax examples and troubleshooting tips.`,
        success: false
      }
    }
  }
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function formatCallResult(result: any, returnType?: string): string {
  if (result === null || result === undefined) {
    return 'null'
  }
  
  if (typeof result === 'string') {
    return `"${result}"`
  }
  
  if (typeof result === 'bigint') {
    return `${result.toString()} (${result.toString(16)})`
  }
  
  if (typeof result === 'boolean') {
    return result ? 'true' : 'false'
  }
  
  if (Array.isArray(result)) {
    return `[${result.map(item => formatCallResult(item)).join(', ')}]`
  }
  
  if (typeof result === 'object') {
    try {
      return JSON.stringify(result, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2)
    } catch {
      return result.toString()
    }
  }
  
  return result.toString()
}

commandRouter.register(callCommand)