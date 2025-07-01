import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { compileSolidity, getAvailableContracts } from '../lib/solidity'
import { deployContract, estimateDeploymentCost, parseConstructorArgs } from '../lib/deployment'
import { NETWORK_INFO } from '../lib/alchemy'

export const deployCommand: CommandHandler = {
  name: 'deploy',
  description: 'Deploy compiled smart contracts to the blockchain',
  usage: 'deploy <contract.sol> [--args arg1,arg2,...] [--gas-limit number] [--gas-price gwei]',
  aliases: ['dep'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      const availableContracts = getAvailableContracts()
      return {
        output: `Smart Contract Deployment Commands:
  deploy <contract.sol>              - Deploy a compiled contract
  deploy <contract.sol> --args a,b,c - Deploy with constructor arguments
  deploy list                        - List deployable contracts
  deploy estimate <contract.sol>     - Estimate deployment cost
  deploy help                        - Show detailed help

Available Contracts:
${availableContracts.map(name => `  • ${name}`).join('\n')}

Examples:
  deploy Hello.sol --args "Hello World"
  deploy Token.sol --args "MyToken,MTK,18,1000000"
  deploy Counter.sol
  deploy SimpleStorage.sol --gas-limit 500000

Network: ${NETWORK_INFO.name} (${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'})
Chain ID: ${NETWORK_INFO.chainId}

⚠️  Note: You must have a connected wallet with sufficient balance to deploy contracts.`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'list':
          const contracts = getAvailableContracts()
          const contractInfo = contracts.map(name => {
            // Get basic info about each contract
            return `  ${name.padEnd(20)} - Ready for deployment`
          }).join('\n')
          
          return {
            output: `Deployable Smart Contracts:
${contractInfo}

Network: ${NETWORK_INFO.name}
Chain ID: ${NETWORK_INFO.chainId}

Use "deploy <contract.sol>" to deploy a contract
Use "deploy estimate <contract.sol>" to estimate costs`,
            success: true
          }
        
        case 'estimate': {
          if (args.length < 2) {
            return {
              output: 'Usage: deploy estimate <contract.sol>\nExample: deploy estimate Hello.sol',
              success: false
            }
          }
          
          const contractToEstimate = args[1]
          
          // Compile the contract first
          const compileResult = await compileSolidity(contractToEstimate)
          
          if (!compileResult.success) {
            return {
              output: `❌ Cannot estimate deployment cost - compilation failed:
${compileResult.errors?.join('\n') || 'Unknown compilation error'}`,
              success: false
            }
          }
          
          const contractNames = Object.keys(compileResult.contracts || {})
          if (contractNames.length === 0) {
            return {
              output: `No contracts found in ${contractToEstimate}`,
              success: false
            }
          }
          
          const mainContract = compileResult.contracts![contractNames[0]]
          const estimate = await estimateDeploymentCost(mainContract.bytecode)
          
          return {
            output: `💰 Deployment Cost Estimate for ${contractToEstimate}:

Contract: ${contractNames[0]}
Network: ${NETWORK_INFO.name}
Chain ID: ${NETWORK_INFO.chainId}

📊 Cost Breakdown:
  Gas Limit: ${estimate.gasLimit.toLocaleString()}
  Gas Price: ${estimate.gasPrice.formatted}
  Total Cost: ${estimate.totalCost.formatted}
  USD Estimate: ${estimate.usdEstimate ? `$${estimate.usdEstimate.toFixed(2)}` : 'N/A'}

📏 Contract Size:
  Bytecode: ${estimate.contractSize} bytes
  ${estimate.contractSize > 24576 ? '⚠️  Warning: Contract size exceeds 24KB limit!' : '✅ Contract size within limits'}

⛽ Gas Details:
  Base Gas: 21,000
  Creation Gas: ${(estimate.gasLimit - 21000).toLocaleString()}
  
💡 Tips:
  • Gas prices fluctuate - check current network conditions
  • Consider deploying during low-traffic periods
  • Test deployment on testnet first`,
            success: true
          }
        }
        
        case 'help':
          return {
            output: `Smart Contract Deployment Help:

COMMANDS:
  deploy <contract.sol>              - Deploy a contract
  deploy <contract.sol> --args a,b,c - Deploy with constructor arguments
  deploy list                        - List available contracts
  deploy estimate <contract.sol>     - Estimate deployment costs
  deploy help                        - Show this help

CONSTRUCTOR ARGUMENTS:
  Use --args flag to pass constructor parameters:
  • String arguments: --args "Hello World"
  • Multiple args: --args "arg1,arg2,arg3"
  • Numbers: --args "123,456"
  • Addresses: --args "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b"

GAS OPTIONS:
  --gas-limit <number>    - Set custom gas limit
  --gas-price <gwei>      - Set custom gas price in Gwei

EXAMPLES:
  deploy Hello.sol --args "Hello Blockchain!"
  deploy Token.sol --args "MyToken,MTK,18,1000000"
  deploy Counter.sol --gas-limit 300000
  deploy SimpleStorage.sol --gas-price 20

REQUIREMENTS:
  ✅ Connected wallet with sufficient balance
  ✅ Valid contract source code
  ✅ Correct constructor arguments (if any)
  ✅ Sufficient gas for deployment

NETWORK INFO:
  Current Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}
  Environment: ${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'}

DEPLOYMENT PROCESS:
  1. Compile contract source code
  2. Validate constructor arguments
  3. Estimate gas requirements
  4. Submit deployment transaction
  5. Wait for confirmation
  6. Return contract address

⚠️  IMPORTANT:
  • Always test on testnet first
  • Double-check constructor arguments
  • Ensure sufficient wallet balance
  • Contract deployment is irreversible`,
            success: true
          }
        
        default: {
          // Treat as contract name to deploy
          const contractName = args[0]
          
          if (!contractName.endsWith('.sol')) {
            return {
              output: `Invalid contract name: ${contractName}
Contract names must end with .sol
Available contracts: ${getAvailableContracts().join(', ')}`,
              success: false
            }
          }
          
          // Parse deployment flags
          const deploymentArgs = parseDeploymentFlags(args.slice(1))
          
          // Compile the contract first
          const compileResult = await compileSolidity(contractName)
          
          if (!compileResult.success) {
            return {
              output: `❌ Deployment failed - compilation error:
${compileResult.errors?.join('\n') || 'Unknown compilation error'}

Fix compilation errors and try again.`,
              success: false
            }
          }
          
          const contractNames = Object.keys(compileResult.contracts || {})
          if (contractNames.length === 0) {
            return {
              output: `No contracts found in ${contractName}`,
              success: false
            }
          }
          
          const mainContract = compileResult.contracts![contractNames[0]];
          const mainContractName = contractNames[0];

          // Parse CLI string args into typed args using ABI
          let typedConstructorArgs: any[];
          try {
            // deploymentArgs.args are strings from parseDeploymentFlags
            typedConstructorArgs = parseConstructorArgs(mainContract.abi, deploymentArgs.args);
          } catch (error) {
            return {
              output: `❌ Invalid constructor arguments: ${error instanceof Error ? error.message : 'Unknown error'}`,
              success: false,
            };
          }
          
          // Deploy the contract
          const deployResult = await deployContract({
            contractName: mainContractName,
            abi: mainContract.abi,
            bytecode: mainContract.bytecode,
            constructorArgs: typedConstructorArgs, // Pass the correctly typed args
            gasLimit: deploymentArgs.gasLimit,
            gasPrice: deploymentArgs.gasPrice
          });
          
          if (!deployResult.success) {
            return {
              output: `❌ Deployment failed:
${deployResult.error}

Common issues:
  • Insufficient wallet balance
  • Invalid constructor arguments
  • Network congestion
  • Gas limit too low

Try "deploy estimate ${contractName}" to check costs.`,
              success: false
            }
          }
          
          return {
            output: `🚀 Contract Deployed Successfully!

📋 Deployment Details:
  Contract: ${mainContractName}
  File: ${contractName}
  Network: ${NETWORK_INFO.name}
  Chain ID: ${NETWORK_INFO.chainId}

📍 Contract Address:
  ${deployResult.contractAddress}

🧾 Transaction Details:
  Hash: ${deployResult.transactionHash}
  Block: ${deployResult.blockNumber || 'Pending'}
  Gas Used: ${deployResult.gasUsed?.toLocaleString() || 'N/A'}
  Gas Price: ${deployResult.gasPrice || 'N/A'}
  Total Cost: ${deployResult.totalCost || 'N/A'}

${deploymentArgs.args.length > 0 ? `🔧 Constructor Arguments:
${deploymentArgs.args.map((arg, i) => `  [${i}]: ${arg}`).join('\n')}` : ''}

💡 Next Steps:
  • Save the contract address for future interactions
  • Verify the contract on a block explorer
  • Test contract functions using the terminal
  • Consider setting up a frontend interface

🔗 Useful Commands:
  alchemy tx ${deployResult.transactionHash}  - View transaction details
  wallet balance                              - Check remaining balance`,
            success: true
          }
        }
      }
    } catch (error) {
      return {
        output: `Deployment error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be due to:
  • Network connectivity issues
  • Insufficient wallet balance
  • Invalid constructor arguments
  • Gas estimation problems

Try "wallet status" to check your connection and balance.`,
        success: false
      }
    }
  }
}

interface DeploymentFlags {
  args: string[]
  gasLimit?: number
  gasPrice?: string
}

function parseDeploymentFlags(args: string[]): DeploymentFlags {
  const result: DeploymentFlags = {
    args: []
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--args' && i + 1 < args.length) {
      // Parse constructor arguments
      const argsString = args[i + 1]
      result.args = argsString.split(',').map(arg => arg.trim())
      i++ // Skip next argument
    } else if (arg === '--gas-limit' && i + 1 < args.length) {
      result.gasLimit = parseInt(args[i + 1])
      i++ // Skip next argument
    } else if (arg === '--gas-price' && i + 1 < args.length) {
      result.gasPrice = args[i + 1]
      i++ // Skip next argument
    }
  }
  
  return result
}

commandRouter.register(deployCommand)