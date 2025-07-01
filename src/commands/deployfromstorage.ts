import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { deployContract, parseConstructorArgs } from '../lib/deployment' // Assuming parseConstructorArgs is exported
import { NETWORK_INFO } from '../lib/alchemy' // For displaying network info

// Helper interface and function for parsing deployment flags
// This is similar to the one in deploy.ts. Consider refactoring to a shared utility if used in more places.
interface DeploymentFlags {
  constructorArgsStrings: string[]
  gasLimit?: number
  gasPrice?: string // Assuming gasPrice is passed as Gwei string e.g. "20"
}

function parseDeploymentFlags(args: string[]): DeploymentFlags {
  const result: DeploymentFlags = {
    constructorArgsStrings: []
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--args' && i + 1 < args.length) {
      const argsString = args[i + 1]
      result.constructorArgsStrings = argsString.split(',').map(arg => arg.trim())
      i++
    } else if (arg === '--gas-limit' && i + 1 < args.length) {
      const gasLimitNum = parseInt(args[i + 1])
      if (!isNaN(gasLimitNum)) {
        result.gasLimit = gasLimitNum
      }
      i++
    } else if (arg === '--gas-price' && i + 1 < args.length) {
      result.gasPrice = args[i + 1] // Keep as string, let ethers.js handle it
      i++
    } else {
      // If it's not a flag we recognize, it might be an issue or an unnamed arg
      // For now, we assume constructor args are ONLY via --args
      // console.warn(`Unrecognized deployment flag or value: ${arg}`);
    }
  }
  return result
}


export const deployFromStorageCommand: CommandHandler = {
  name: 'deployfromstorage',
  description: 'Deploy a contract previously compiled and stored in session storage.',
  usage: 'deployfromstorage <filename.sol> [ContractNameInFile] --args val1,val2... [--gas-limit X] [--gas-price Y]',
  aliases: ['dfs'],

  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, printer } = context

    if (args.length === 0) {
      printer.error('Usage: deployfromstorage <filename.sol> [ContractNameInFile] [options]')
      printer.info('Example: deployfromstorage MyContract.sol MyContract --args "hello,123"')
      printer.info('Example: deployfromstorage MyContract.sol --args "hello,123" (if ContractNameInFile is MyContract)')
      return { output: '', success: false }
    }

    const contractFilename = args[0]
    if (!contractFilename.endsWith('.sol')) {
      printer.error(`Invalid filename: ${contractFilename}. Must end with .sol`)
      return { output: '', success: false }
    }

    // Determine ContractNameInFile: if second arg is not a flag, it's the ContractNameInFile
    let contractNameInFile = ''
    let optionsArgsStartIndex = 1

    if (args.length > 1 && !args[1].startsWith('--')) {
      contractNameInFile = args[1]
      optionsArgsStartIndex = 2
    } else {
      // Default ContractNameInFile to the base of contractFilename
      contractNameInFile = contractFilename.substring(0, contractFilename.lastIndexOf('.sol'))
    }

    const cliOptionsArgs = args.slice(optionsArgsStartIndex)
    const deploymentOptions = parseDeploymentFlags(cliOptionsArgs)

    printer.info(`Attempting to deploy ${contractNameInFile} from ${contractFilename} (compiled from session storage)...`)

    const abiKey = `compiled:${contractFilename}:${contractNameInFile}:abi`
    const bytecodeKey = `compiled:${contractFilename}:${contractNameInFile}:bytecode`

    const abiString = sessionStorage.getItem(abiKey)
    const bytecode = sessionStorage.getItem(bytecodeKey)

    if (!abiString || !bytecode) {
      printer.error(`ABI or Bytecode for contract '${contractNameInFile}' (from file '${contractFilename}') not found in session storage.`)
      if (!abiString) {
        printer.info(`(Debug: Attempted to retrieve ABI key '${abiKey}')`)
      }
      if (!bytecode) {
        printer.info(`(Debug: Attempted to retrieve bytecode key '${bytecodeKey}')`)
      }
      printer.info(`Please ensure filenames and contract names match exactly (including case).`)
      printer.info(`Compile the contract first using: compilefromstorage ${contractFilename}`)
      return { output: '', success: false }
    }

    // Also good to log what keys ARE being used on a successful path, subtly.
    printer.info(`Using ABI from key '${abiKey}' and bytecode from key '${bytecodeKey}'.`)

    let abi
    try {
      abi = JSON.parse(abiString)
    } catch (e) {
      printer.error(`Failed to parse ABI for ${contractNameInFile} from session storage. Error: ${e instanceof Error ? e.message : String(e)}`)
      return { output: '', success: false }
    }

    let typedConstructorArgs: any[] = []
    if (deploymentOptions.constructorArgsStrings.length > 0) {
        try {
            typedConstructorArgs = parseConstructorArgs(abi, deploymentOptions.constructorArgsStrings)
        } catch (error) {
            printer.error(`❌ Invalid constructor arguments: ${error instanceof Error ? error.message : String(error)}`)
            return { output: '', success: false }
        }
    } else {
        // Check if constructor requires arguments but none were provided
        const constructorAbiEntry = abi.find((entry: any) => entry.type === 'constructor');
        if (constructorAbiEntry && constructorAbiEntry.inputs && constructorAbiEntry.inputs.length > 0) {
            printer.error(`❌ Constructor for ${contractNameInFile} requires arguments, but none were provided via --args.`);
            let requiredArgsMessage = 'Required arguments: ';
            constructorAbiEntry.inputs.forEach((input: any) => {
                requiredArgsMessage += `${input.name} (${input.type}), `;
            });
            printer.info(requiredArgsMessage.slice(0, -2)); // Remove trailing comma and space
            return { output: '', success: false };
        }
    }

    printer.info(`Deploying ${contractNameInFile} with ABI and bytecode from session storage...`)
    // Display network info before deployment attempt
    printer.info(`Target Network: ${NETWORK_INFO.name} (Chain ID: ${NETWORK_INFO.chainId})`)


    const deployResult = await deployContract({
      contractName: contractNameInFile, // This is for display/logging within deployContract if used
      abi,
      bytecode,
      constructorArgs: typedConstructorArgs,
      gasLimit: deploymentOptions.gasLimit,
      gasPrice: deploymentOptions.gasPrice // Pass as string, ethers will handle conversion
    })

    if (!deployResult.success) {
      printer.error(`❌ Deployment failed for ${contractNameInFile}:`)
      printer.print(`${deployResult.error}`) // Assuming error is a formatted string
      printer.info(`Common issues: Insufficient funds, network errors, incorrect constructor arguments, or low gas limit.`)
      return { output: '', success: false }
    }

    let successOutput = `🚀 Contract Deployed Successfully!\n\n`
    successOutput += `📋 Deployment Details:\n`
    successOutput += `  Contract: ${contractNameInFile}\n`
    successOutput += `  From File (Uploaded As): ${contractFilename}\n`
    successOutput += `  Network: ${NETWORK_INFO.name}\n`
    successOutput += `  Chain ID: ${NETWORK_INFO.chainId}\n\n`
    successOutput += `📍 Contract Address:\n  ${deployResult.contractAddress}\n\n`
    successOutput += `🧾 Transaction Details:\n`
    successOutput += `  Hash: ${deployResult.transactionHash}\n`
    successOutput += `  Block: ${deployResult.blockNumber || 'Pending'}\n`
    successOutput += `  Gas Used: ${deployResult.gasUsed?.toLocaleString() || 'N/A'}\n`

    if (deploymentOptions.constructorArgsStrings.length > 0) {
        successOutput += `\n🔧 Constructor Arguments Provided:\n${deploymentOptions.constructorArgsStrings.map((arg, i) => `  [${i}]: ${arg}`).join('\n')}`
    }

    successOutput += `\n\n💡 Next Steps:\n`
    successOutput += `  • Save the contract address for interactions.\n`
    successOutput += `  • Verify on a block explorer (e.g., Etherscan).\n`

    printer.success(successOutput)
    return { output: '', success: true }
  }
}

commandRouter.register(deployFromStorageCommand)
