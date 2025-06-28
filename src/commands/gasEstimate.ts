import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { estimateContractGas, parseGasEstimateInput, GasEstimateInput } from '../lib/gasEstimation'
import { NETWORK_INFO } from '../lib/alchemy'

export const gasEstimateCommand: CommandHandler = {
  name: 'gasEstimate',
  description: 'Estimate gas usage for contract function calls',
  usage: 'gasEstimate <address.function(args...)> [--from address] [--value eth]',
  aliases: ['gas', 'estimate'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      return {
        output: `Gas Estimation Commands:
  gasEstimate <address.function(args)>     - Estimate gas for function call
  gasEstimate <address.function> --from addr - Estimate from specific address
  gasEstimate <address.function> --value 0.1 - Include ETH value
  gasEstimate help                         - Show detailed help

Examples:
  gasEstimate 0xABC.setMessage("Hello")
  gasEstimate 0xDEF.transfer("0x123...",1000)
  gasEstimate 0x789.deposit() --value 0.1
  gasEstimate 0xCounter.increment() --from 0x123...

Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})

💡 Gas estimation helps you predict transaction costs before sending!`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'help':
          return {
            output: `Gas Estimation Help:

OVERVIEW:
  The gasEstimate command predicts how much gas a contract function call
  will consume before you actually send the transaction. This helps you:
  • Plan transaction costs
  • Detect potential failures
  • Optimize gas usage
  • Set appropriate gas limits

SYNTAX:
  gasEstimate <contract_address>.<function_name>(<arguments>)

OPTIONS:
  --from <address>    Estimate from specific sender address
  --value <eth>       Include ETH value in the transaction
  --block <number>    Estimate at specific block (default: latest)

EXAMPLES:

1. Simple Function Call:
   gasEstimate 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b.name()

2. Function with Parameters:
   gasEstimate 0xABC.setMessage("Hello World")

3. Token Transfer:
   gasEstimate 0xDEF.transfer("0x123...",1000000000000000000)

4. Payable Function:
   gasEstimate 0x789.deposit() --value 0.1

5. From Specific Address:
   gasEstimate 0xCounter.increment() --from 0x123...

6. Complex Function:
   gasEstimate 0xDEX.swapExactTokensForTokens(1000,"0x456","0x789")

ARGUMENT TYPES:
  String:    "Hello World" or 'Hello World'
  Number:    123 or 0x1A (hex)
  Address:   0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b
  Boolean:   true or false
  Array:     [1,2,3] or ["a","b","c"]
  BigInt:    Large numbers automatically handled

COMMON FUNCTIONS:

ERC20 Token Functions:
  • transfer(address,uint256) - Transfer tokens
  • approve(address,uint256) - Approve spending
  • transferFrom(address,address,uint256) - Transfer from allowance

Contract Management:
  • setMessage(string) - Update stored message
  • increment() - Increment counter
  • deposit() - Deposit ETH (payable)
  • withdraw(uint256) - Withdraw amount

ESTIMATION OUTPUT:
  ⛽ Gas Limit: Estimated gas needed
  💰 Gas Price: Current network gas price
  💸 Total Cost: Estimated transaction cost in ETH
  📊 Cost Breakdown: Detailed gas analysis
  ⚠️  Warnings: Potential issues or optimizations

NETWORK INFO:
  Current Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}
  Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

ACCURACY NOTES:
  • Estimates are based on current blockchain state
  • Actual gas usage may vary slightly
  • State changes between estimation and execution can affect results
  • Complex contracts may have variable gas usage

ERROR HANDLING:
  • "Function not found" - Check function name and contract
  • "Execution reverted" - Function would fail with current parameters
  • "Invalid arguments" - Check argument types and values
  • "Contract not found" - Verify contract address

OPTIMIZATION TIPS:
  • Compare gas costs of different approaches
  • Test with various input sizes
  • Consider batch operations for multiple calls
  • Use view functions when possible (no gas cost)

💡 Pro Tips:
  • Always estimate before sending expensive transactions
  • Test edge cases and maximum input sizes
  • Consider gas price fluctuations
  • Use estimation to detect potential failures early`,
            success: true
          }
        
        default:
          // Parse the gas estimation input
          const estimateInput = args.join(' ')
          const parsedInput = parseGasEstimateInput(estimateInput)
          
          if (!parsedInput.success) {
            return {
              output: `❌ Invalid gas estimation syntax: ${parsedInput.error}

Expected format: <address>.<function>(<args>)
Examples:
  • gasEstimate 0xABC.setMessage("Hello")
  • gasEstimate 0xDEF.transfer("0x123...",1000)
  • gasEstimate 0x789.increment()

Use "gasEstimate help" for detailed syntax information.`,
              success: false
            }
          }
          
          // Perform gas estimation
          const result = await estimateContractGas(parsedInput.input!)
          
          if (!result.success) {
            return {
              output: `❌ Gas estimation failed: ${result.error}

Possible causes:
  • Function doesn't exist in contract
  • Invalid arguments provided
  • Transaction would revert
  • Contract not found at address
  • Network connectivity issues

💡 Try:
  • Verify contract address and function name
  • Check argument types and values
  • Use "call ${parsedInput.input!.contractAddress}.${parsedInput.input!.functionName}()" to test read-only version
  • Ensure contract is deployed on ${NETWORK_INFO.name}`,
              success: false
            }
          }
          
          return {
            output: `⛽ Gas Estimation Results:

📋 Function Call Details:
  Contract: ${parsedInput.input!.contractAddress}
  Function: ${parsedInput.input!.functionName}(${parsedInput.input!.arguments?.join(', ') || ''})
  Network: ${NETWORK_INFO.name}
  ${parsedInput.input!.from ? `From: ${parsedInput.input!.from}` : 'From: Default address'}
  ${parsedInput.input!.value ? `Value: ${parsedInput.input!.value} ETH` : 'Value: 0 ETH'}

💰 Gas Analysis:
  Estimated Gas: ${result.gasLimit?.toLocaleString() || 'N/A'}
  Gas Price: ${result.gasPrice || 'N/A'}
  Base Cost: ${result.baseCost || 'N/A'}
  Total Cost: ${result.totalCost || 'N/A'}
  ${result.usdEstimate ? `USD Estimate: $${result.usdEstimate.toFixed(2)}` : ''}

📊 Cost Breakdown:
  Base Transaction: 21,000 gas
  Function Execution: ${result.executionGas?.toLocaleString() || 'N/A'} gas
  ${result.value && parseFloat(result.value) > 0 ? `ETH Transfer: ${result.value} ETH` : ''}
  ${result.gasBuffer ? `Safety Buffer: ${result.gasBuffer}%` : ''}

${result.optimization ? `🔧 Optimization Suggestions:
${result.optimization.map(tip => `  • ${tip}`).join('\n')}` : ''}

${result.warnings && result.warnings.length > 0 ? `⚠️  Warnings:
${result.warnings.map(warning => `  • ${warning}`).join('\n')}` : ''}

${result.comparison ? `📈 Gas Comparison:
  Low Gas Price: ${result.comparison.low}
  Standard: ${result.comparison.standard}
  Fast: ${result.comparison.fast}` : ''}

💡 Next Steps:
  • Use this gas limit for your transaction: ${result.recommendedGasLimit?.toLocaleString() || result.gasLimit?.toLocaleString() || 'N/A'}
  • Current gas price is ${result.gasPriceLevel || 'normal'} for the network
  • Consider gas price fluctuations before sending
  
🚀 Ready to send? Use:
  write ${parsedInput.input!.contractAddress}.${parsedInput.input!.functionName}(${parsedInput.input!.arguments?.join(',') || ''})${parsedInput.input!.value ? ` --value ${parsedInput.input!.value}` : ''}`,
            success: true
          }
      }
    } catch (error) {
      return {
        output: `Gas estimation error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Network connectivity issues
  • Invalid contract address or function
  • Alchemy API limitations
  • Blockchain state changes

Use "gasEstimate help" for syntax examples and troubleshooting tips.`,
        success: false
      }
    }
  }
}

commandRouter.register(gasEstimateCommand)