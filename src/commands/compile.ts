import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { 
  compileSolidity, 
  getAvailableContracts, 
  getContractSource,
  formatBytecode,
  formatABI,
  getContractSize,
  estimateDeploymentGas,
  SAMPLE_CONTRACTS
} from '../lib/solidity'

export const compileCommand: CommandHandler = {
  name: 'compile',
  description: 'Compile Solidity contracts using solc-js',
  usage: 'compile <contract.sol> [options]',
  aliases: ['solc'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      const availableContracts = getAvailableContracts()
      return {
        output: `Solidity Compiler Commands:
  compile <contract.sol>     - Compile a Solidity contract
  compile list              - List available sample contracts
  compile show <contract>   - Show contract source code
  compile help              - Show detailed help

Available Sample Contracts:
${availableContracts.map(name => `  • ${name}`).join('\n')}

Examples:
  compile Hello.sol         - Compile the Hello contract
  compile Counter.sol       - Compile the Counter contract
  compile show Hello.sol    - View Hello.sol source code

💡 Contracts are compiled with optimization enabled (200 runs)`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'list':
          const contracts = getAvailableContracts()
          const contractList = contracts.map(name => {
            const source = SAMPLE_CONTRACTS[name]
            const lines = source.content.split('\n').length
            return `  ${name.padEnd(20)} ${lines} lines`
          }).join('\n')
          
          return {
            output: `Available Sample Contracts:
${contractList}

Use "compile <contract.sol>" to compile a contract
Use "compile show <contract.sol>" to view source code`,
            success: true
          }
        
        case 'show':
          if (args.length < 2) {
            return {
              output: 'Usage: compile show <contract.sol>\nExample: compile show Hello.sol',
              success: false
            }
          }
          
          const contractToShow = args[1]
          const sourceCode = getContractSource(contractToShow)
          
          if (!sourceCode) {
            const available = getAvailableContracts()
            return {
              output: `Contract '${contractToShow}' not found.
Available contracts: ${available.join(', ')}`,
              success: false
            }
          }
          
          const lines = sourceCode.split('\n')
          const numberedLines = lines.map((line, index) => 
            `${(index + 1).toString().padStart(3)}: ${line}`
          ).join('\n')
          
          return {
            output: `Source code for ${contractToShow}:
${'='.repeat(50)}
${numberedLines}
${'='.repeat(50)}
Lines: ${lines.length} | Use "compile ${contractToShow}" to compile`,
            success: true
          }
        
        case 'help':
          return {
            output: `Solidity Compiler Help:

COMMANDS:
  compile <contract.sol>    - Compile a Solidity contract
  compile list             - List all available contracts
  compile show <contract>  - Display contract source code
  compile help             - Show this help message

COMPILATION FEATURES:
  • Uses solc-js for in-browser compilation
  • Optimization enabled (200 runs)
  • Generates ABI and bytecode
  • Gas estimation for deployment
  • Error and warning reporting
  • Contract size analysis

AVAILABLE CONTRACTS:
${getAvailableContracts().map(name => `  • ${name} - ${SAMPLE_CONTRACTS[name].content.split('\n')[2]?.replace('//', '').trim() || 'Smart contract'}`).join('\n')}

EXAMPLES:
  compile Hello.sol        - Compile Hello contract
  compile Counter.sol      - Compile Counter with events
  compile Token.sol        - Compile ERC20-like token
  compile show Hello.sol   - View Hello.sol source

OUTPUT INCLUDES:
  • Contract ABI (Application Binary Interface)
  • Bytecode for deployment
  • Deployed bytecode
  • Gas estimates
  • Contract size in bytes
  • Compilation warnings/errors`,
            success: true
          }
        
        default:
          // Treat as contract name to compile
          const contractName = args[0]
          
          if (!contractName.endsWith('.sol')) {
            return {
              output: `Invalid contract name: ${contractName}
Contract names must end with .sol
Available contracts: ${getAvailableContracts().join(', ')}`,
              success: false
            }
          }
          
          // Show compilation progress
          const result = await compileSolidity(contractName)
          
          if (!result.success) {
            let errorOutput = `❌ Compilation failed for ${contractName}:\n`
            
            if (result.errors) {
              errorOutput += '\nERRORS:\n'
              errorOutput += result.errors.map(error => `  • ${error}`).join('\n')
            }
            
            if (result.warnings) {
              errorOutput += '\nWARNINGS:\n'
              errorOutput += result.warnings.map(warning => `  • ${warning}`).join('\n')
            }
            
            return {
              output: errorOutput,
              success: false
            }
          }
          
          if (!result.contracts || Object.keys(result.contracts).length === 0) {
            return {
              output: `No contracts found in ${contractName}`,
              success: false
            }
          }
          
          // Format compilation results
          let output = `✅ Successfully compiled ${contractName}\n`
          
          if (result.warnings && result.warnings.length > 0) {
            output += `\n⚠️  WARNINGS:\n`
            output += result.warnings.map(warning => `  • ${warning}`).join('\n')
            output += '\n'
          }
          
          // Process each contract
          Object.entries(result.contracts).forEach(([contractName, contract]) => {
            const bytecodeSize = getContractSize(contract.bytecode)
            const estimatedGas = estimateDeploymentGas(contract.bytecode)
            
            output += `\n${'='.repeat(60)}`
            output += `\nContract: ${contractName}`
            output += `\nSize: ${bytecodeSize} bytes`
            output += `\nEstimated deployment gas: ${estimatedGas.toLocaleString()}`
            output += `\n${'='.repeat(60)}`
            
            // ABI
            output += `\n\n📋 ABI (Application Binary Interface):`
            output += `\n${'-'.repeat(40)}`
            output += `\n${formatABI(contract.abi)}`
            
            // Bytecode (truncated for readability)
            output += `\n\n🔧 Deployment Bytecode:`
            output += `\n${'-'.repeat(40)}`
            const truncatedBytecode = contract.bytecode.length > 200 
              ? `${contract.bytecode.substring(0, 200)}...\n[Truncated - ${contract.bytecode.length} total characters]`
              : contract.bytecode
            output += `\n${truncatedBytecode}`
            
            // Gas estimates if available
            if (contract.gasEstimates) {
              output += `\n\n⛽ Gas Estimates:`
              output += `\n${'-'.repeat(40)}`
              output += `\n${JSON.stringify(contract.gasEstimates, null, 2)}`
            }
          })
          
          output += `\n\n💡 Tips:`
          output += `\n  • Use "compile show ${args[0]}" to view source code`
          output += `\n  • ABI is needed for contract interaction`
          output += `\n  • Bytecode is used for contract deployment`
          output += `\n  • Consider gas costs for deployment on mainnet`
          
          return {
            output,
            success: true
          }
      }
    } catch (error) {
      return {
        output: `Compilation error: ${error instanceof Error ? error.message : 'Unknown error'}
This might be due to:
  • Invalid Solidity syntax
  • Missing dependencies
  • Compiler version mismatch
  
Try "compile list" to see available contracts or "compile help" for more information.`,
        success: false
      }
    }
  }
}

commandRouter.register(compileCommand)