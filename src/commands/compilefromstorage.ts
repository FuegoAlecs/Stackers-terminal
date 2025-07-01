import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import {
  compileSoliditySource,
  formatABI,
  getContractSize,
  estimateDeploymentGas,
  CompilationResult // Import CompilationResult type
} from '../lib/solidity'

export const compileFromStorageCommand: CommandHandler = {
  name: 'compilefromstorage',
  description: 'Compile a Solidity contract from session storage.',
  usage: 'compilefromstorage <contractname.sol>',
  aliases: ['cfs'], // Short alias

  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, printer } = context

    if (args.length === 0) {
      return {
        output: 'Usage: compilefromstorage <contractname.sol>\nExample: compilefromstorage MyContract.sol',
        success: false,
      }
    }

    const contractFilename = args[0]
    if (!contractFilename.endsWith('.sol')) {
      printer.error(`Invalid filename: ${contractFilename}. Must end with .sol`)
      return { output: '', success: false }
    }

    const sourceCodeKey = `contract:${contractFilename}`
    printer.info(`[DEBUG] Attempting to fetch from sessionStorage with key: "${sourceCodeKey}"`)

    const directGetItemResult = sessionStorage.getItem(sourceCodeKey)
    printer.info(`[DEBUG] Direct result of sessionStorage.getItem("${sourceCodeKey}"):`)
    printer.info(`  Type: ${typeof directGetItemResult}`)
    printer.info(`  Value: ${directGetItemResult === null ? 'null' : `"${directGetItemResult}"`}`) // Show quotes for string, explicitly 'null' for null

    printer.info(`[DEBUG] Iterating through all sessionStorage keys:`)
    let foundInLoop = false;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k === null) { // Should not happen with spec-compliant sessionStorage
        printer.info(`  [Loop ${i}] sessionStorage.key(${i}) returned null`)
        continue;
      }
      const v = sessionStorage.getItem(k)
      printer.info(`  [Loop ${i}] Key: "${k}" | Value snippet: "${v ? v.substring(0, 30) + (v.length > 30 ? '...' : '') : String(v)}"`)
      if (k === sourceCodeKey) {
        printer.info(`    🎉 [Loop ${i}] Found matching key: "${k}"`)
        printer.info(`    Value from loop getItem: "${v}"`)
        foundInLoop = true;
      }
    }
    if (!foundInLoop) {
        printer.info(`[DEBUG] Target key "${sourceCodeKey}" was NOT found during direct iteration of sessionStorage keys.`)
    }


    const sourceCode = directGetItemResult // Use the value we logged

    if (!sourceCode) { // Check if it's null, undefined, or empty string
      printer.error(`Contract source for '${contractFilename}' not found or is empty in session storage.`)
      printer.info(`(Debug: Attempted to retrieve key '${sourceCodeKey}')`)
      printer.info(`Please ensure the filename matches exactly (including case) what 'lsuploads' shows and that the file had content.`)
      printer.info(`Use "upload ${contractFilename}" to upload it, or "lsuploads" to see available contracts.`)
      return { output: '', success: false }
    }

    printer.info(`Compiling ${contractFilename} from session storage (using key '${sourceCodeKey}', content length: ${sourceCode.length})...`)

    const compilationResult: CompilationResult = await compileSoliditySource(sourceCode, contractFilename);

    if (!compilationResult.success || !compilationResult.contracts || Object.keys(compilationResult.contracts).length === 0) {
      let errorOutput = `❌ Compilation failed for ${contractFilename}:\n`
      if (compilationResult.errors && compilationResult.errors.length > 0) {
        errorOutput += '\nERRORS:\n' + compilationResult.errors.map((e: any) => `  • ${typeof e === 'string' ? e : JSON.stringify(e)}`).join('\n')
      } else if (!compilationResult.contracts || Object.keys(compilationResult.contracts).length === 0 && compilationResult.success) {
        // Case where solc succeeded but found no contract artifacts (e.g. only interfaces/libraries without deployed code)
        errorOutput += 'Compilation was successful, but no deployable contracts were found.\n';
        errorOutput += 'This can happen if the Solidity file contains only interfaces, libraries, or abstract contracts.\n';
      }

      if (compilationResult.warnings && compilationResult.warnings.length > 0) {
        errorOutput += '\nWARNINGS:\n' + compilationResult.warnings.map((w: any) => `  • ${typeof w === 'string' ? w : JSON.stringify(w)}`).join('\n')
      }
      printer.error(errorOutput)
      return { output: '', success: false }
    }

    let outputText = `✅ Successfully compiled ${contractFilename} from session storage.\n`

    if (compilationResult.warnings && compilationResult.warnings.length > 0) {
        outputText += `\n⚠️  WARNINGS:\n`
        outputText += compilationResult.warnings.map((w: any) => `  • ${typeof w === 'string' ? w : JSON.stringify(w)}`).join('\n')
        outputText += '\n'
    }

    Object.entries(compilationResult.contracts).forEach(([contractNameInFile, contractData]) => {
      // The key `contractNameInFile` is the name of the contract as defined in the Solidity file (e.g., "Hello" from "Hello.sol").
      // We use `contractFilename` (e.g., "Hello.sol") for sessionStorage key uniqueness concerning the uploaded file.
      if (contractData.abi && contractData.bytecode) {
        const abiKey = `compiled:${contractFilename}:${contractNameInFile}:abi`
        const bytecodeKey = `compiled:${contractFilename}:${contractNameInFile}:bytecode`

        try {
          sessionStorage.setItem(abiKey, JSON.stringify(contractData.abi))
          sessionStorage.setItem(bytecodeKey, contractData.bytecode)
          outputText += `\nStored ABI for ${contractNameInFile} in sessionStorage (key: ${abiKey})`
          outputText += `\nStored Bytecode for ${contractNameInFile} in sessionStorage (key: ${bytecodeKey})`
        } catch (e) {
          // This error should be displayed using the printer for consistency
          printer.error(`Failed to store ABI/Bytecode for ${contractNameInFile} in sessionStorage: ${e instanceof Error ? e.message : String(e)}`)
          // Potentially add to outputText as well or decide if this is a fatal error for the command
        }

        const bytecodeSize = getContractSize(contractData.bytecode)
        const estimatedGas = estimateDeploymentGas(contractData.bytecode)

        outputText += `\n\n${'='.repeat(60)}`
        outputText += `\nContract: ${contractNameInFile} (from ${contractFilename})`
        outputText += `\nSize: ${bytecodeSize} bytes`
        outputText += `\nEstimated deployment gas: ${estimatedGas.toLocaleString()}`
        outputText += `\n${'='.repeat(60)}`

        outputText += `\n\n📋 ABI (Application Binary Interface):`
        outputText += `\n${'-'.repeat(40)}`
        outputText += `\n${formatABI(contractData.abi)}`

        outputText += `\n\n🔧 Deployment Bytecode:`
        outputText += `\n${'-'.repeat(40)}`
        const truncatedBytecode = contractData.bytecode.length > 200
          ? `${contractData.bytecode.substring(0, 200)}...\n[Truncated - ${contractData.bytecode.length} total characters]`
          : contractData.bytecode
        outputText += `\n${truncatedBytecode}`

        if (contractData.gasEstimates) {
          outputText += `\n\n⛽ Gas Estimates:`
          outputText += `\n${'-'.repeat(40)}`
          outputText += `\n${JSON.stringify(contractData.gasEstimates, null, 2)}`
        }
      } else {
        // Handle cases where a contract might be in the output but lacks ABI or bytecode (e.g. a library not linked)
         outputText += `\n\nNOTE: Contract ${contractNameInFile} from ${contractFilename} did not produce ABI or bytecode and was not stored.`
      }
    })

    outputText += `\n\n💡 Tips:`
    outputText += `\n  • Use "lsuploads" to see uploaded source files.`
    outputText += `\n  • Use "deployfromstorage ${contractFilename} <constructor_args...>" to deploy.`

    printer.print(outputText) // Use printer.print for multi-line formatted output
    return { output: '', success: true } // Main output is handled by printer.print
  }
}

commandRouter.register(compileFromStorageCommand)
