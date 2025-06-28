import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { simulateTransaction, parseSimulationInput, SimulationInput } from '../lib/simulation'
import { NETWORK_INFO } from '../lib/alchemy'

export const simulateCommand: CommandHandler = {
  name: 'simulate',
  description: 'Simulate transactions using Alchemy simulation API',
  usage: 'simulate tx <JSON> [--from address]',
  aliases: ['sim'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      return {
        output: `Transaction Simulation Commands:
  simulate tx <JSON>              - Simulate a transaction
  simulate tx <JSON> --from addr  - Simulate from specific address
  simulate help                   - Show detailed help and examples

JSON Format:
  {"to": "0x...", "data": "0x...", "value": "0x0"}

Examples:
  simulate tx {"to":"0xABC","data":"0x1234","value":"0x0"}
  simulate tx {"to":"0xDEF","data":"0x5678"} --from 0x123...

Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})

💡 Use simulation to test transactions before sending them!`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'tx':
          if (args.length < 2) {
            return {
              output: `Usage: simulate tx <JSON> [--from address]

JSON Format:
  {"to": "0x...", "data": "0x...", "value": "0x0"}

Examples:
  simulate tx {"to":"0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b","data":"0x06fdde03","value":"0x0"}
  simulate tx {"to":"0xABC","data":"0x1234"} --from 0x123...

Required fields:
  • to: Contract address (0x...)
  • data: Transaction data (0x...)
  
Optional fields:
  • value: ETH value to send (default: "0x0")
  • gas: Gas limit (default: auto-estimate)
  • gasPrice: Gas price in wei (default: current)`,
              success: false
            }
          }
          
          // Parse JSON input and flags
          const { jsonInput, fromAddress } = parseSimulationFlags(args.slice(1))
          
          if (!jsonInput) {
            return {
              output: `❌ No JSON input provided.

Expected format: simulate tx {"to":"0x...","data":"0x...","value":"0x0"}

Example:
  simulate tx {"to":"0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b","data":"0x06fdde03","value":"0x0"}`,
              success: false
            }
          }
          
          // Parse the simulation input
          const parsedInput = parseSimulationInput(jsonInput, fromAddress)
          
          if (!parsedInput.success) {
            return {
              output: `❌ Invalid simulation input: ${parsedInput.error}

Expected JSON format:
{
  "to": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b",
  "data": "0x06fdde03",
  "value": "0x0"
}

Required fields:
  • to: Contract address
  • data: Transaction data (function call)
  
Optional fields:
  • value: ETH amount (default: "0x0")
  • gas: Gas limit (hex)
  • gasPrice: Gas price in wei (hex)`,
              success: false
            }
          }
          
          // Run the simulation
          const result = await simulateTransaction(parsedInput.input!)
          
          if (!result.success) {
            return {
              output: `❌ Simulation failed: ${result.error}

Possible causes:
  • Invalid contract address
  • Invalid transaction data
  • Transaction would revert
  • Network connectivity issues
  • Insufficient balance for simulation

💡 Tips:
  • Verify contract address exists
  • Check transaction data format
  • Ensure sufficient balance if value > 0`,
              success: false
            }
          }
          
          return {
            output: `🧪 Transaction Simulation Results:

📋 Simulation Details:
  To: ${parsedInput.input!.to}
  From: ${parsedInput.input!.from || 'Auto-detected'}
  Value: ${parsedInput.input!.value || '0x0'} (${parseInt(parsedInput.input!.value || '0x0', 16)} wei)
  Network: ${NETWORK_INFO.name}

${result.success ? '✅' : '❌'} Status: ${result.success ? 'SUCCESS' : 'FAILED'}

⛽ Gas Information:
  Gas Used: ${result.gasUsed?.toLocaleString() || 'N/A'}
  Gas Limit: ${result.gasLimit?.toLocaleString() || 'N/A'}
  Gas Price: ${result.gasPrice || 'N/A'}
  Total Cost: ${result.totalCost || 'N/A'}

📤 Transaction Data:
  Data: ${parsedInput.input!.data}
  Size: ${(parsedInput.input!.data.length - 2) / 2} bytes

${result.returnData ? `📥 Return Data:
  Raw: ${result.returnData}
  ${result.decodedOutput ? `Decoded: ${result.decodedOutput}` : 'Unable to decode output'}` : ''}

${result.logs && result.logs.length > 0 ? `📜 Events Emitted:
${result.logs.map((log, i) => `  ${i + 1}. ${log.address}: ${log.topics.join(', ')}`).join('\n')}` : '📜 No events emitted'}

${result.stateChanges && result.stateChanges.length > 0 ? `🔄 State Changes:
${result.stateChanges.map((change, i) => `  ${i + 1}. ${change.address}: ${change.slot} → ${change.value}`).join('\n')}` : '🔄 No state changes detected'}

${result.error ? `⚠️  Error Details:
  ${result.error}` : ''}

💡 Simulation completed successfully! This shows what would happen if you sent this transaction.`,
            success: true
          }
        
        case 'help':
          return {
            output: `Transaction Simulation Help:

OVERVIEW:
  The simulate command uses Alchemy's simulation API to test transactions
  before sending them to the blockchain. This helps you:
  • Predict gas usage
  • Detect transaction failures
  • See state changes and events
  • Test contract interactions safely

SYNTAX:
  simulate tx <JSON> [--from address]

JSON FORMAT:
{
  "to": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b",
  "data": "0x06fdde03",
  "value": "0x0"
}

REQUIRED FIELDS:
  to     - Contract address to call
  data   - Transaction data (encoded function call)

OPTIONAL FIELDS:
  value     - ETH amount to send (hex, default: "0x0")
  gas       - Gas limit (hex, default: auto-estimate)
  gasPrice  - Gas price in wei (hex, default: current)

EXAMPLES:

1. Simple Contract Call:
   simulate tx {"to":"0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b","data":"0x06fdde03"}

2. Function Call with Parameters:
   simulate tx {"to":"0xABC","data":"0xa9059cbb000000000000000000000000123..."}

3. Payable Function Call:
   simulate tx {"to":"0xDEF","data":"0x1234","value":"0x16345785d8a0000"}

4. Simulate from Specific Address:
   simulate tx {"to":"0x789","data":"0x5678"} --from 0x123...

5. With Custom Gas Settings:
   simulate tx {"to":"0xABC","data":"0x1234","gas":"0x7530","gasPrice":"0x4a817c800"}

GENERATING TRANSACTION DATA:
  Use tools like:
  • Ethers.js: contract.interface.encodeFunctionData("functionName", [args])
  • Web3.js: contract.methods.functionName(args).encodeABI()
  • Cast: cast calldata "functionName(types)" args

COMMON FUNCTION SIGNATURES:
  • name(): 0x06fdde03
  • symbol(): 0x95d89b41
  • totalSupply(): 0x18160ddd
  • balanceOf(address): 0x70a08231 + padded address
  • transfer(address,uint256): 0xa9059cbb + padded params

SIMULATION OUTPUT:
  ✅ Success/Failure status
  ⛽ Gas usage and cost estimates
  📥 Return data and decoded output
  📜 Events that would be emitted
  🔄 State changes that would occur
  ⚠️  Error details if transaction fails

NETWORK INFO:
  Current Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}
  Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

USE CASES:
  • Test contract functions before calling
  • Estimate gas for complex transactions
  • Debug failing transactions
  • Verify transaction effects
  • Test with different parameters

LIMITATIONS:
  • Simulation uses current blockchain state
  • Results may differ if state changes before actual transaction
  • Some advanced contract behaviors may not be fully simulated
  • Requires valid contract addresses and data

💡 Pro Tips:
  • Always simulate complex transactions first
  • Use simulation to optimize gas usage
  • Test edge cases and error conditions
  • Verify return values match expectations`,
            success: true
          }
        
        default:
          return {
            output: `Unknown simulate command: ${subcommand}
Available commands: tx, help

Examples:
  simulate tx {"to":"0x...","data":"0x..."}
  simulate help`,
            success: false
          }
      }
    } catch (error) {
      return {
        output: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Invalid JSON format
  • Network connectivity issues
  • Invalid transaction parameters
  • Alchemy API limitations

Use "simulate help" for detailed syntax and examples.`,
        success: false
      }
    }
  }
}

interface SimulationFlags {
  jsonInput?: string
  fromAddress?: string
}

function parseSimulationFlags(args: string[]): SimulationFlags {
  const result: SimulationFlags = {}
  
  let i = 0
  while (i < args.length) {
    const arg = args[i]
    
    if (arg === '--from' && i + 1 < args.length) {
      result.fromAddress = args[i + 1]
      i += 2
    } else if (arg.startsWith('{')) {
      // Try to reconstruct JSON that might be split across arguments
      let jsonStr = arg
      let j = i + 1
      
      // Keep adding arguments until we have a complete JSON object
      while (j < args.length && !jsonStr.includes('}')) {
        jsonStr += ' ' + args[j]
        j++
      }
      
      // If we still don't have a closing brace, add the next argument
      if (!jsonStr.includes('}') && j < args.length) {
        jsonStr += ' ' + args[j]
        j++
      }
      
      result.jsonInput = jsonStr
      i = j
    } else {
      i++
    }
  }
  
  return result
}

commandRouter.register(simulateCommand)