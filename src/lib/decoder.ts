import { abiManager } from './ABIManager'

export interface DecodedFunction {
  success: boolean
  functionName?: string
  abiName?: string
  signature?: string
  inputs?: Array<{
    name: string
    type: string
    value: any
  }>
  selector?: string
  error?: string
}

export interface DecodedOutput {
  success: boolean
  functionName?: string
  abiName?: string
  outputs?: Array<{
    name: string
    type: string
    value: any
  }>
  rawValue?: string
  error?: string
}

export interface DecodedEvent {
  success: boolean
  eventName?: string
  abiName?: string
  signature?: string
  inputs?: Array<{
    name: string
    type: string
    value: any
    indexed: boolean
  }>
  topic?: string
  error?: string
}

/**
 * Decode function call data
 */
export function decodeFunctionData(hexData: string): DecodedFunction {
  try {
    // Validate hex format
    if (!hexData.startsWith('0x') || hexData.length < 10) {
      return {
        success: false,
        error: 'Invalid hex data format. Must start with 0x and be at least 10 characters (4-byte selector + data)'
      }
    }

    // Extract function selector (first 4 bytes)
    const selector = hexData.slice(0, 10).toLowerCase()
    const inputData = hexData.slice(10)

    // Find function in loaded ABIs
    const functionInfo = abiManager.getFunctionBySelector(selector)
    
    if (!functionInfo) {
      return {
        success: false,
        selector,
        error: `Function selector ${selector} not found in loaded ABIs. Use "decode abi list" to see available ABIs.`
      }
    }

    // Decode input parameters
    const inputs = functionInfo.abi.inputs || []
    const decodedInputs = decodeParameters(inputs, inputData)

    return {
      success: true,
      functionName: functionInfo.abi.name,
      abiName: functionInfo.abiName,
      signature: getFunctionSignature(functionInfo.abi),
      selector,
      inputs: decodedInputs.map((value, index) => ({
        name: inputs[index]?.name || `param${index}`,
        type: inputs[index]?.type || 'unknown',
        value: formatDecodedValue(value, inputs[index]?.type)
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown decoding error'
    }
  }
}

/**
 * Decode function output data
 */
export function decodeFunctionOutput(hexData: string, functionName: string, abiName?: string): DecodedOutput {
  try {
    // Validate hex format
    if (!hexData.startsWith('0x')) {
      return {
        success: false,
        error: 'Invalid hex data format. Must start with 0x'
      }
    }

    // Find function in ABIs
    let functionABI: any = null
    let foundAbiName = ''

    if (abiName) {
      const abi = abiManager.getABI(abiName)
      if (abi) {
        functionABI = abi.find(item => item.type === 'function' && item.name === functionName)
        foundAbiName = abiName
      }
    } else {
      // Search all ABIs
      const abis = abiManager.listABIs()
      for (const abiInfo of abis) {
        const abi = abiManager.getABI(abiInfo.name)
        if (abi) {
          const func = abi.find(item => item.type === 'function' && item.name === functionName)
          if (func) {
            functionABI = func
            foundAbiName = abiInfo.name
            break
          }
        }
      }
    }

    if (!functionABI) {
      return {
        success: false,
        error: `Function "${functionName}" not found in ${abiName ? `ABI "${abiName}"` : 'any loaded ABI'}`
      }
    }

    // Decode output parameters
    const outputs = functionABI.outputs || []
    const outputData = hexData.slice(2) // Remove 0x prefix
    
    if (outputs.length === 0) {
      return {
        success: true,
        functionName,
        abiName: foundAbiName,
        outputs: [],
        rawValue: hexData
      }
    }

    const decodedOutputs = decodeParameters(outputs, outputData)

    return {
      success: true,
      functionName,
      abiName: foundAbiName,
      outputs: decodedOutputs.map((value, index) => ({
        name: outputs[index]?.name || `output${index}`,
        type: outputs[index]?.type || 'unknown',
        value: formatDecodedValue(value, outputs[index]?.type)
      })),
      rawValue: hexData
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown decoding error'
    }
  }
}

/**
 * Decode event log data
 */
export function decodeEventData(topics: string[], data: string): DecodedEvent {
  try {
    if (!topics || topics.length === 0) {
      return {
        success: false,
        error: 'No topics provided for event decoding'
      }
    }

    // First topic is the event signature hash
    const eventTopic = topics[0].toLowerCase()
    
    // Find event in loaded ABIs
    const eventInfo = abiManager.getEventByTopic(eventTopic)
    
    if (!eventInfo) {
      return {
        success: false,
        topic: eventTopic,
        error: `Event topic ${eventTopic} not found in loaded ABIs`
      }
    }

    // Decode event parameters
    const inputs = eventInfo.abi.inputs || []
    const indexedInputs = inputs.filter(input => input.indexed)
    const nonIndexedInputs = inputs.filter(input => !input.indexed)

    const decodedInputs: Array<{
      name: string
      type: string
      value: any
      indexed: boolean
    }> = []

    // Decode indexed parameters from topics (skip first topic which is event signature)
    let topicIndex = 1
    for (const input of indexedInputs) {
      if (topicIndex < topics.length) {
        const value = decodeParameter(input.type, topics[topicIndex].slice(2))
        decodedInputs.push({
          name: input.name || `indexed${topicIndex - 1}`,
          type: input.type,
          value: formatDecodedValue(value, input.type),
          indexed: true
        })
        topicIndex++
      }
    }

    // Decode non-indexed parameters from data
    if (nonIndexedInputs.length > 0 && data && data !== '0x') {
      const decodedData = decodeParameters(nonIndexedInputs, data.slice(2))
      decodedData.forEach((value, index) => {
        const input = nonIndexedInputs[index]
        decodedInputs.push({
          name: input.name || `data${index}`,
          type: input.type,
          value: formatDecodedValue(value, input.type),
          indexed: false
        })
      })
    }

    return {
      success: true,
      eventName: eventInfo.abi.name,
      abiName: eventInfo.abiName,
      signature: getEventSignature(eventInfo.abi),
      topic: eventTopic,
      inputs: decodedInputs
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown event decoding error'
    }
  }
}

/**
 * Decode multiple parameters from hex data
 */
function decodeParameters(types: any[], hexData: string): any[] {
  if (types.length === 0) return []
  
  const results: any[] = []
  let offset = 0
  
  for (const type of types) {
    const value = decodeParameter(type.type, hexData.slice(offset))
    results.push(value)
    
    // Calculate offset for next parameter (simplified)
    if (isDynamicType(type.type)) {
      offset += 64 // Dynamic types use 32 bytes for offset pointer
    } else {
      offset += getStaticTypeSize(type.type) * 2 // Each byte = 2 hex chars
    }
  }
  
  return results
}

/**
 * Decode a single parameter
 */
function decodeParameter(type: string, hexData: string): any {
  try {
    if (!hexData) return null
    
    // Ensure we have enough data
    const minLength = getStaticTypeSize(type) * 2
    if (hexData.length < minLength) {
      hexData = hexData.padEnd(minLength, '0')
    }
    
    if (type === 'address') {
      return '0x' + hexData.slice(-40).toLowerCase()
    } else if (type.startsWith('uint') || type.startsWith('int')) {
      const value = BigInt('0x' + hexData.slice(0, 64))
      return type.startsWith('int') && value > BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
        ? value - BigInt('0x10000000000000000000000000000000000000000000000000000000000000000')
        : value
    } else if (type === 'bool') {
      return hexData.slice(-2) !== '00'
    } else if (type === 'string') {
      return decodeString(hexData)
    } else if (type.startsWith('bytes')) {
      if (type === 'bytes') {
        return '0x' + hexData
      } else {
        const size = parseInt(type.slice(5))
        return '0x' + hexData.slice(0, size * 2)
      }
    } else {
      // Fallback for unknown types
      return '0x' + hexData.slice(0, 64)
    }
  } catch {
    return hexData
  }
}

/**
 * Decode string from hex data
 */
function decodeString(hexData: string): string {
  try {
    // For dynamic strings, first 32 bytes is length, then data
    if (hexData.length > 64) {
      const lengthHex = hexData.slice(0, 64)
      const length = parseInt(lengthHex, 16)
      const stringHex = hexData.slice(64, 64 + length * 2)
      return Buffer.from(stringHex, 'hex').toString('utf8')
    } else {
      // Try to decode as fixed string
      const cleanHex = hexData.replace(/00+$/, '') // Remove trailing zeros
      return Buffer.from(cleanHex, 'hex').toString('utf8')
    }
  } catch {
    return hexData
  }
}

/**
 * Check if type is dynamic
 */
function isDynamicType(type: string): boolean {
  return type === 'string' || 
         type === 'bytes' || 
         type.endsWith('[]') ||
         type.includes('[') && type.includes(']')
}

/**
 * Get static type size in bytes
 */
function getStaticTypeSize(type: string): number {
  if (type === 'address' || type === 'bool') return 32
  if (type.startsWith('uint') || type.startsWith('int')) return 32
  if (type.startsWith('bytes') && type !== 'bytes') {
    const size = parseInt(type.slice(5))
    return Math.ceil(size / 32) * 32 // Padded to 32-byte boundary
  }
  return 32 // Default
}

/**
 * Format decoded value for display
 */
function formatDecodedValue(value: any, type: string): string {
  if (value === null || value === undefined) {
    return 'null'
  }
  
  if (typeof value === 'bigint') {
    if (type === 'address') {
      return value.toString(16).padStart(40, '0')
    }
    return value.toString()
  }
  
  if (typeof value === 'boolean') {
    return value.toString()
  }
  
  if (typeof value === 'string') {
    if (type === 'address' && !value.startsWith('0x')) {
      return '0x' + value
    }
    return value
  }
  
  return value.toString()
}

/**
 * Get function signature
 */
function getFunctionSignature(func: any): string {
  const inputs = func.inputs || []
  const types = inputs.map((input: any) => input.type).join(',')
  return `${func.name}(${types})`
}

/**
 * Get event signature
 */
function getEventSignature(event: any): string {
  const inputs = event.inputs || []
  const types = inputs.map((input: any) => input.type).join(',')
  return `${event.name}(${types})`
}

/**
 * Auto-detect data type and suggest decoding method
 */
export function analyzeHexData(hexData: string): {
  type: 'function' | 'output' | 'event' | 'unknown'
  suggestions: string[]
} {
  if (!hexData.startsWith('0x')) {
    return {
      type: 'unknown',
      suggestions: ['Data must start with 0x']
    }
  }
  
  const suggestions: string[] = []
  
  if (hexData.length >= 10) {
    const selector = hexData.slice(0, 10)
    const functionInfo = abiManager.getFunctionBySelector(selector)
    
    if (functionInfo) {
      return {
        type: 'function',
        suggestions: [
          `decode data ${hexData}`,
          `Found function: ${functionInfo.abi.name} in ${functionInfo.abiName} ABI`
        ]
      }
    } else {
      suggestions.push(`Unknown function selector: ${selector}`)
      suggestions.push('Try loading the appropriate ABI first')
    }
  }
  
  if (hexData.length === 66 || hexData.length % 64 === 2) {
    suggestions.push('Might be function output data')
    suggestions.push('Use: decode output <hex> <functionName> [abiName]')
  }
  
  return {
    type: 'unknown',
    suggestions
  }
}