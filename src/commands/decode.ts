import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { abiManager } from '../lib/ABIManager'
import { 
  decodeFunctionData, 
  decodeFunctionOutput, 
  decodeEventData, 
  analyzeHexData 
} from '../lib/decoder'

export const decodeCommand: CommandHandler = {
  name: 'decode',
  description: 'Decode hex data using loaded ABIs (calldata, outputs, events)',
  usage: 'decode <data|output|event|abi> <hex> [options]',
  aliases: ['dec'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args } = context
    
    if (args.length === 0) {
      const abiCount = abiManager.listABIs().length
      return {
        output: `Hex Data Decoder Commands:
  decode data <hex>                    - Decode function call data
  decode output <hex> <function> [abi] - Decode function output
  decode event <topics> <data>         - Decode event log data
  decode analyze <hex>                 - Analyze hex data type
  decode abi list                      - List loaded ABIs
  decode abi load <name> <json>        - Load ABI from JSON
  decode abi remove <name>             - Remove loaded ABI
  decode abi export                    - Export all ABIs
  decode abi import <json>             - Import ABIs from JSON
  decode help                          - Show detailed help

Loaded ABIs: ${abiCount} (including ERC20, ERC721)

Examples:
  decode data 0xa9059cbb000000000000000000000000742d35cc...
  decode output 0x0000000000000000000000000000000000000000000000000000000000000001 approve ERC20
  decode abi load MyContract '[{"type":"function","name":"test"...}]'

💡 Load ABIs first to decode contract-specific data!`,
        success: true
      }
    }
    
    const subcommand = args[0].toLowerCase()
    
    try {
      switch (subcommand) {
        case 'data':
          if (args.length < 2) {
            return {
              output: `Usage: decode data <hex>

Examples:
  decode data 0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d4c9db96c4b4d8b0000000000000000000000000000000000000000000000000de0b6b3a7640000
  decode data 0x06fdde03
  decode data 0x70a08231000000000000000000000000742d35cc6634c0532925a3b8d4c9db96c4b4d8b

The hex data should include the 4-byte function selector and encoded parameters.`,
              success: false
            }
          }
          
          const hexData = args[1]
          const result = decodeFunctionData(hexData)
          
          if (!result.success) {
            return {
              output: `❌ Failed to decode function data: ${result.error}

💡 Tips:
  • Ensure hex data starts with 0x and includes function selector
  • Load the appropriate ABI first: decode abi load <name> <json>
  • Use "decode abi list" to see available ABIs
  • Try "decode analyze ${hexData}" for suggestions`,
              success: false
            }
          }
          
          let output = `✅ Function Call Decoded Successfully:

📋 Function Details:
  Function: ${result.functionName}
  ABI: ${result.abiName}
  Signature: ${result.signature}
  Selector: ${result.selector}

📥 Input Parameters:`
          
          if (result.inputs && result.inputs.length > 0) {
            result.inputs.forEach((input, index) => {
              output += `\n  ${index + 1}. ${input.name} (${input.type}): ${input.value}`
            })
          } else {
            output += '\n  No parameters'
          }
          
          output += `\n\n💡 This function call would execute: ${result.signature}`
          
          return {
            output,
            success: true
          }
        
        case 'output':
          if (args.length < 3) {
            return {
              output: `Usage: decode output <hex> <functionName> [abiName]

Examples:
  decode output 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000 balanceOf ERC20
  decode output 0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000054d79546f6b656e000000000000000000000000000000000000000000000000 name ERC20
  decode output 0x0000000000000000000000000000000000000000000000000000000000000001 approve

If abiName is not specified, will search all loaded ABIs for the function.`,
              success: false
            }
          }
          
          const outputHex = args[1]
          const functionName = args[2]
          const abiName = args[3]
          
          const outputResult = decodeFunctionOutput(outputHex, functionName, abiName)
          
          if (!outputResult.success) {
            return {
              output: `❌ Failed to decode output: ${outputResult.error}

💡 Tips:
  • Ensure the function name is correct
  • Load the appropriate ABI if not already loaded
  • Use "decode abi list" to see available ABIs and functions`,
              success: false
            }
          }
          
          let outputDisplay = `✅ Function Output Decoded Successfully:

📋 Function Details:
  Function: ${outputResult.functionName}
  ABI: ${outputResult.abiName}
  Raw Value: ${outputResult.rawValue}

📤 Output Values:`
          
          if (outputResult.outputs && outputResult.outputs.length > 0) {
            outputResult.outputs.forEach((output, index) => {
              outputDisplay += `\n  ${index + 1}. ${output.name} (${output.type}): ${output.value}`
            })
          } else {
            outputDisplay += '\n  No return values (void function)'
          }
          
          return {
            output: outputDisplay,
            success: true
          }
        
        case 'event':
          if (args.length < 3) {
            return {
              output: `Usage: decode event <topics> <data>

Examples:
  decode event '["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000742d35cc6634c0532925a3b8d4c9db96c4b4d8b","0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d"]' '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000'
  
Topics should be a JSON array of hex strings.
Data should be a hex string (can be empty: '0x').`,
              success: false
            }
          }
          
          try {
            const topicsStr = args[1]
            const eventData = args[2] || '0x'
            
            const topics = JSON.parse(topicsStr)
            if (!Array.isArray(topics)) {
              throw new Error('Topics must be an array')
            }
            
            const eventResult = decodeEventData(topics, eventData)
            
            if (!eventResult.success) {
              return {
                output: `❌ Failed to decode event: ${eventResult.error}

💡 Tips:
  • Ensure topics is a valid JSON array of hex strings
  • Load the appropriate ABI containing the event definition
  • First topic should be the event signature hash`,
                success: false
              }
            }
            
            let eventDisplay = `✅ Event Decoded Successfully:

📋 Event Details:
  Event: ${eventResult.eventName}
  ABI: ${eventResult.abiName}
  Signature: ${eventResult.signature}
  Topic: ${eventResult.topic}

📊 Event Data:`
            
            if (eventResult.inputs && eventResult.inputs.length > 0) {
              const indexedParams = eventResult.inputs.filter(input => input.indexed)
              const dataParams = eventResult.inputs.filter(input => !input.indexed)
              
              if (indexedParams.length > 0) {
                eventDisplay += '\n\n  📌 Indexed Parameters:'
                indexedParams.forEach((input, index) => {
                  eventDisplay += `\n    ${index + 1}. ${input.name} (${input.type}): ${input.value}`
                })
              }
              
              if (dataParams.length > 0) {
                eventDisplay += '\n\n  📄 Data Parameters:'
                dataParams.forEach((input, index) => {
                  eventDisplay += `\n    ${index + 1}. ${input.name} (${input.type}): ${input.value}`
                })
              }
            } else {
              eventDisplay += '\n  No parameters'
            }
            
            return {
              output: eventDisplay,
              success: true
            }
          } catch (error) {
            return {
              output: `❌ Invalid event data format: ${error instanceof Error ? error.message : 'Unknown error'}

Expected format:
  decode event '["0xtopic1","0xtopic2"]' '0xdata'`,
              success: false
            }
          }
        
        case 'analyze':
          if (args.length < 2) {
            return {
              output: `Usage: decode analyze <hex>

Examples:
  decode analyze 0xa9059cbb000000000000000000000000742d35cc...
  decode analyze 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000`,
              success: false
            }
          }
          
          const analyzeHex = args[1]
          const analysis = analyzeHexData(analyzeHex)
          
          return {
            output: `🔍 Hex Data Analysis:

Data: ${analyzeHex}
Type: ${analysis.type}

💡 Suggestions:
${analysis.suggestions.map(suggestion => `  • ${suggestion}`).join('\n')}

Available Commands:
  • decode data <hex> - For function call data
  • decode output <hex> <function> [abi] - For function outputs
  • decode event <topics> <data> - For event logs`,
            success: true
          }
        
        case 'abi':
          return await handleABICommands(args.slice(1))
        
        case 'help':
          return {
            output: `Hex Data Decoder Help:

OVERVIEW:
  The decode command helps you decode hex-encoded blockchain data using
  Application Binary Interfaces (ABIs). It supports function calls, outputs,
  and event logs.

COMMANDS:

1. DECODE FUNCTION CALL DATA:
   decode data <hex>
   
   Decodes transaction calldata including function selector and parameters.
   
   Examples:
   • decode data 0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d4c9db96c4b4d8b0000000000000000000000000000000000000000000000000de0b6b3a7640000
   • decode data 0x06fdde03  (name() function)
   • decode data 0x95d89b41  (symbol() function)

2. DECODE FUNCTION OUTPUT:
   decode output <hex> <functionName> [abiName]
   
   Decodes return data from function calls.
   
   Examples:
   • decode output 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000 balanceOf ERC20
   • decode output 0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000054d79546f6b656e000000000000000000000000000000000000000000000000 name

3. DECODE EVENT LOGS:
   decode event <topics> <data>
   
   Decodes event log data from transaction receipts.
   
   Example:
   • decode event '["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]' '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000'

4. ABI MANAGEMENT:
   decode abi list                     - List all loaded ABIs
   decode abi load <name> <json>       - Load ABI from JSON
   decode abi remove <name>            - Remove specific ABI
   decode abi export                   - Export all ABIs as JSON
   decode abi import <json>            - Import ABIs from JSON
   decode abi clear                    - Remove all ABIs (except built-ins)

ABI LOADING EXAMPLES:

1. Load ERC20 ABI:
   decode abi load MyToken '[{"type":"function","name":"transfer","inputs":[{"type":"address","name":"to"},{"type":"uint256","name":"amount"}],"outputs":[{"type":"bool"}]}]'

2. Load from contract verification:
   Copy ABI JSON from Etherscan and use:
   decode abi load ContractName '<paste_abi_json_here>'

BUILT-IN ABIS:
  • ERC20 - Standard token functions and events
  • ERC721 - NFT functions and events

DATA TYPES SUPPORTED:
  • address - Ethereum addresses
  • uint256, uint8, etc. - Unsigned integers
  • int256, int8, etc. - Signed integers
  • bool - Boolean values
  • string - UTF-8 strings
  • bytes, bytes32, etc. - Byte arrays
  • Arrays and complex types

WORKFLOW:
  1. Load appropriate ABI: decode abi load MyContract '<abi_json>'
  2. Decode your data: decode data 0x1234...
  3. Analyze results and understand the function call

TIPS:
  • Always load ABIs before decoding contract-specific data
  • Use "decode analyze" to get suggestions for unknown data
  • Function selectors are the first 4 bytes of calldata
  • Event topics contain indexed parameters
  • Export ABIs to backup your loaded contracts

COMMON FUNCTION SELECTORS:
  • 0x06fdde03 - name()
  • 0x95d89b41 - symbol()
  • 0x313ce567 - decimals()
  • 0x18160ddd - totalSupply()
  • 0x70a08231 - balanceOf(address)
  • 0xa9059cbb - transfer(address,uint256)
  • 0x095ea7b3 - approve(address,uint256)

TROUBLESHOOTING:
  • "Function selector not found" → Load the correct ABI
  • "Invalid hex format" → Ensure data starts with 0x
  • "Function not found" → Check function name spelling
  • "Decoding failed" → Verify data format and ABI match`,
            success: true
          }
        
        default:
          return {
            output: `Unknown decode command: ${subcommand}

Available commands: data, output, event, analyze, abi, help

Examples:
  decode data 0xa9059cbb000000000000000000000000742d35cc...
  decode abi list
  decode help`,
            success: false
          }
      }
    } catch (error) {
      return {
        output: `Decode error: ${error instanceof Error ? error.message : 'Unknown error'}

Use "decode help" for detailed usage information.`,
        success: false
      }
    }
  }
}

async function handleABICommands(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      output: `ABI Management Commands:
  decode abi list              - List all loaded ABIs
  decode abi load <name> <json> - Load ABI from JSON
  decode abi remove <name>     - Remove specific ABI
  decode abi export            - Export all ABIs
  decode abi import <json>     - Import ABIs from JSON
  decode abi clear             - Clear all ABIs (except built-ins)
  decode abi search <function> - Search for functions across ABIs

Use "decode help" for detailed information.`,
      success: true
    }
  }
  
  const subcommand = args[0].toLowerCase()
  
  switch (subcommand) {
    case 'list':
      const abis = abiManager.listABIs()
      
      if (abis.length === 0) {
        return {
          output: 'No ABIs loaded. Use "decode abi load <name> <json>" to load ABIs.',
          success: true
        }
      }
      
      let output = `Loaded ABIs (${abis.length}):\n\n`
      abis.forEach((abi, index) => {
        output += `${(index + 1).toString().padStart(2)}. ${abi.name.padEnd(20)} ${abi.functions} functions, ${abi.events} events\n`
      })
      
      output += `\n💡 Use "decode abi search <function>" to find specific functions`
      
      return {
        output,
        success: true
      }
    
    case 'load':
      if (args.length < 3) {
        return {
          output: `Usage: decode abi load <name> <json>

Examples:
  decode abi load MyToken '[{"type":"function","name":"transfer",...}]'
  decode abi load MyContract '<paste_full_abi_json_here>'

The JSON should be a valid ABI array from contract compilation or verification.`,
          success: false
        }
      }
      
      const abiName = args[1]
      const abiJson = args.slice(2).join(' ')
      
      try {
        const abi = JSON.parse(abiJson)
        const success = abiManager.loadABI(abiName, abi)
        
        if (!success) {
          return {
            output: `❌ Failed to load ABI "${abiName}".

Possible issues:
  • Invalid ABI format
  • Maximum ABIs limit reached (50)
  • ABI validation failed

Ensure the JSON is a valid ABI array.`,
            success: false
          }
        }
        
        const functions = abi.filter((item: any) => item.type === 'function').length
        const events = abi.filter((item: any) => item.type === 'event').length
        
        return {
          output: `✅ Successfully loaded ABI "${abiName}"!

📊 ABI Statistics:
  Functions: ${functions}
  Events: ${events}
  Total Items: ${abi.length}

🎯 Ready to decode data for this contract!
  • decode data <hex> - Decode function calls
  • decode output <hex> <function> ${abiName} - Decode outputs`,
          success: true
        }
      } catch (error) {
        return {
          output: `❌ Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}

Expected format: '[{"type":"function","name":"...","inputs":[...],"outputs":[...]}]'`,
          success: false
        }
      }
    
    case 'remove':
      if (args.length < 2) {
        return {
          output: `Usage: decode abi remove <name>

Examples:
  decode abi remove MyToken
  decode abi remove MyContract

Use "decode abi list" to see available ABIs.`,
          success: false
        }
      }
      
      const removeAbiName = args[1]
      const removed = abiManager.removeABI(removeAbiName)
      
      if (!removed) {
        return {
          output: `❌ ABI "${removeAbiName}" not found.

Use "decode abi list" to see available ABIs.`,
          success: false
        }
      }
      
      return {
        output: `✅ Successfully removed ABI "${removeAbiName}".

Remaining ABIs: ${abiManager.listABIs().length}`,
        success: true
      }
    
    case 'clear':
      const beforeCount = abiManager.listABIs().length
      abiManager.clear()
      const afterCount = abiManager.listABIs().length
      
      return {
        output: `✅ Cleared ${beforeCount - afterCount} custom ABIs.

Built-in ABIs (ERC20, ERC721) have been reloaded.
Remaining ABIs: ${afterCount}`,
        success: true
      }
    
    case 'export':
      const exportData = abiManager.export()
      
      return {
        output: `ABI Export Data:

${exportData}

💡 Save this data to import later with "decode abi import <json>"`,
        success: true
      }
    
    case 'import':
      if (args.length < 2) {
        return {
          output: `Usage: decode abi import <json>

Example:
  decode abi import '{"abis":{"MyToken":[...],"MyContract":[...]},"timestamp":"..."}'

💡 Use "decode abi export" to get the correct format.`,
          success: false
        }
      }
      
      const importJson = args.slice(1).join(' ')
      const importResult = abiManager.import(importJson)
      
      if (!importResult.success) {
        return {
          output: `❌ Failed to import ABIs.

Errors:
${importResult.errors.map(err => `  • ${err}`).join('\n')}`,
          success: false
        }
      }
      
      let importOutput = `✅ Successfully imported ${importResult.imported} ABIs!`
      
      if (importResult.errors.length > 0) {
        importOutput += `\n\n⚠️  Warnings:
${importResult.errors.map(err => `  • ${err}`).join('\n')}`
      }
      
      importOutput += `\n\nTotal ABIs: ${abiManager.listABIs().length}`
      
      return {
        output: importOutput,
        success: true
      }
    
    case 'search':
      if (args.length < 2) {
        return {
          output: `Usage: decode abi search <function>

Examples:
  decode abi search transfer
  decode abi search balance
  decode abi search approve`,
          success: false
        }
      }
      
      const searchQuery = args[1]
      const searchResults = abiManager.searchFunctions(searchQuery)
      
      if (searchResults.length === 0) {
        return {
          output: `No functions found containing "${searchQuery}".

💡 Try:
  • Different search terms
  • Loading more ABIs with "decode abi load"
  • "decode abi list" to see available ABIs`,
          success: true
        }
      }
      
      let searchOutput = `Search results for "${searchQuery}" (${searchResults.length} found):\n\n`
      
      searchResults.forEach((result, index) => {
        searchOutput += `${(index + 1).toString().padStart(2)}. ${result.abiName}: ${result.signature}\n`
      })
      
      searchOutput += `\n💡 Use these functions with:
  • decode output <hex> <functionName> <abiName>
  • call <address>.<functionName>(...)`
      
      return {
        output: searchOutput,
        success: true
      }
    
    default:
      return {
        output: `Unknown ABI command: ${subcommand}

Available commands: list, load, remove, export, import, clear, search`,
        success: false
      }
  }
}

commandRouter.register(decodeCommand)