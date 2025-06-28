import { alchemy, alchemyViemClient, NETWORK_INFO } from './alchemy'
import { abiManager } from './ABIManager'
import { decodeEventData } from './decoder'

export interface EventFilter {
  address: string
  fromBlock?: number | 'latest'
  toBlock?: number | 'latest'
  topics?: string[]
  limit?: number
}

export interface DecodedEventLog {
  address: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  eventName?: string
  abiName?: string
  signature?: string
  inputs?: Array<{
    name: string
    type: string
    value: any
    indexed: boolean
  }>
  topics: string[]
  data: string
  decoded: boolean
}

export interface EventLogsResult {
  success: boolean
  logs: DecodedEventLog[]
  totalFound: number
  fromBlock: number
  toBlock: number
  error?: string
}

/**
 * Fetch and decode event logs from a contract
 */
export async function getContractEvents(
  contractAddress: string,
  abiName?: string,
  options: {
    fromBlock?: number | 'latest'
    toBlock?: number | 'latest'
    eventName?: string
    limit?: number
  } = {}
): Promise<EventLogsResult> {
  try {
    // Validate contract address
    if (!isValidAddress(contractAddress)) {
      return {
        success: false,
        logs: [],
        totalFound: 0,
        fromBlock: 0,
        toBlock: 0,
        error: 'Invalid contract address format'
      }
    }

    // Get ABI for decoding
    let contractABI: any[] | undefined
    let resolvedAbiName = ''

    if (abiName) {
      contractABI = abiManager.getABI(abiName)
      if (!contractABI) {
        return {
          success: false,
          logs: [],
          totalFound: 0,
          fromBlock: 0,
          toBlock: 0,
          error: `ABI "${abiName}" not found. Use "decode abi list" to see available ABIs.`
        }
      }
      resolvedAbiName = abiName
    } else {
      // Try to find a suitable ABI
      const availableABIs = abiManager.listABIs()
      if (availableABIs.length > 0) {
        // Use the first available ABI as fallback
        contractABI = abiManager.getABI(availableABIs[0].name)
        resolvedAbiName = availableABIs[0].name
      }
    }

    // Set default block range
    const currentBlock = await alchemyViemClient.getBlockNumber()
    const fromBlock = options.fromBlock === 'latest' ? Number(currentBlock) : 
                     (options.fromBlock || Math.max(0, Number(currentBlock) - 1000))
    const toBlock = options.toBlock === 'latest' ? Number(currentBlock) : 
                   (options.toBlock || Number(currentBlock))

    // Build event filter
    const filter: any = {
      address: contractAddress,
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`
    }

    // Add event-specific topics if specified
    if (options.eventName && contractABI) {
      const eventABI = contractABI.find(item => 
        item.type === 'event' && item.name === options.eventName
      )
      
      if (eventABI) {
        const eventSignature = getEventSignature(eventABI)
        const eventTopic = computeEventTopic(eventSignature)
        filter.topics = [eventTopic]
      } else {
        return {
          success: false,
          logs: [],
          totalFound: 0,
          fromBlock,
          toBlock,
          error: `Event "${options.eventName}" not found in ABI "${resolvedAbiName}"`
        }
      }
    }

    // Fetch logs using Alchemy
    const logs = await alchemy.core.getLogs(filter)

    // Limit results if specified
    const limitedLogs = options.limit ? logs.slice(0, options.limit) : logs

    // Decode logs
    const decodedLogs: DecodedEventLog[] = limitedLogs.map(log => {
      const baseLog: DecodedEventLog = {
        address: log.address,
        blockNumber: parseInt(log.blockNumber || '0', 16),
        transactionHash: log.transactionHash || '',
        logIndex: parseInt(log.logIndex || '0', 16),
        topics: log.topics || [],
        data: log.data || '0x',
        decoded: false
      }

      // Try to decode if we have an ABI
      if (contractABI && log.topics && log.topics.length > 0) {
        const decodedEvent = decodeEventData(log.topics, log.data || '0x')
        
        if (decodedEvent.success) {
          return {
            ...baseLog,
            eventName: decodedEvent.eventName,
            abiName: resolvedAbiName,
            signature: decodedEvent.signature,
            inputs: decodedEvent.inputs,
            decoded: true
          }
        }
      }

      return baseLog
    })

    return {
      success: true,
      logs: decodedLogs,
      totalFound: logs.length,
      fromBlock,
      toBlock
    }

  } catch (error) {
    return {
      success: false,
      logs: [],
      totalFound: 0,
      fromBlock: 0,
      toBlock: 0,
      error: error instanceof Error ? error.message : 'Unknown error fetching logs'
    }
  }
}

/**
 * Get recent events from multiple contracts
 */
export async function getRecentEvents(
  contracts: Array<{ address: string; abiName?: string }>,
  blockRange: number = 1000
): Promise<EventLogsResult> {
  try {
    const currentBlock = await alchemyViemClient.getBlockNumber()
    const fromBlock = Math.max(0, Number(currentBlock) - blockRange)
    
    const allLogs: DecodedEventLog[] = []
    let totalFound = 0

    for (const contract of contracts) {
      const result = await getContractEvents(contract.address, contract.abiName, {
        fromBlock,
        toBlock: Number(currentBlock)
      })

      if (result.success) {
        allLogs.push(...result.logs)
        totalFound += result.totalFound
      }
    }

    // Sort by block number and log index
    allLogs.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return b.blockNumber - a.blockNumber // Most recent first
      }
      return b.logIndex - a.logIndex
    })

    return {
      success: true,
      logs: allLogs,
      totalFound,
      fromBlock,
      toBlock: Number(currentBlock)
    }

  } catch (error) {
    return {
      success: false,
      logs: [],
      totalFound: 0,
      fromBlock: 0,
      toBlock: 0,
      error: error instanceof Error ? error.message : 'Unknown error fetching recent events'
    }
  }
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
 * Compute event topic (simplified keccak256)
 */
function computeEventTopic(signature: string): string {
  // This is a simplified implementation
  // In production, use a proper keccak256 implementation
  let hash = 0
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0')
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Format event log for display
 */
export function formatEventLog(log: DecodedEventLog, index: number): string {
  let output = `${(index + 1).toString().padStart(3)}. `
  
  if (log.decoded && log.eventName) {
    output += `${log.eventName} (${log.abiName})\n`
    output += `     Block: ${log.blockNumber} | Tx: ${log.transactionHash.slice(0, 10)}...\n`
    
    if (log.inputs && log.inputs.length > 0) {
      const indexedParams = log.inputs.filter(input => input.indexed)
      const dataParams = log.inputs.filter(input => !input.indexed)
      
      if (indexedParams.length > 0) {
        output += `     Indexed: `
        output += indexedParams.map(p => `${p.name}=${p.value}`).join(', ')
        output += '\n'
      }
      
      if (dataParams.length > 0) {
        output += `     Data: `
        output += dataParams.map(p => `${p.name}=${p.value}`).join(', ')
        output += '\n'
      }
    }
  } else {
    output += `Unknown Event\n`
    output += `     Block: ${log.blockNumber} | Tx: ${log.transactionHash.slice(0, 10)}...\n`
    output += `     Topics: ${log.topics.length} | Data: ${log.data.length > 10 ? log.data.slice(0, 10) + '...' : log.data}\n`
  }
  
  return output
}

/**
 * Common event signatures for reference
 */
export const COMMON_EVENT_SIGNATURES = {
  // ERC20 Events
  Transfer: 'Transfer(address,address,uint256)',
  Approval: 'Approval(address,address,uint256)',
  
  // ERC721 Events
  TransferNFT: 'Transfer(address,address,uint256)',
  ApprovalNFT: 'Approval(address,address,uint256)',
  ApprovalForAll: 'ApprovalForAll(address,address,bool)',
  
  // Common Contract Events
  OwnershipTransferred: 'OwnershipTransferred(address,address)',
  Paused: 'Paused(address)',
  Unpaused: 'Unpaused(address)',
  
  // DEX Events
  Swap: 'Swap(address,uint256,uint256,uint256,uint256,address)',
  Mint: 'Mint(address,uint256,uint256)',
  Burn: 'Burn(address,uint256,uint256,address)'
}