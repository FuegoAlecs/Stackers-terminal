// REMOVED: import solc from 'solc'

// Ensure this type is defined and exported, matching the worker's expectation.
// The worker already imports this, so it should be fine.
export interface CompilationResult {
  success: boolean
  contracts?: {
    [contractName: string]: {
      abi: any[]
      bytecode: string
      deployedBytecode: string
      gasEstimates?: any
      metadata?: string
    }
  }
  errors?: string[]
  warnings?: string[]
}

export interface ContractSource {
  name: string
  content: string
}

// Sample contracts for demonstration
export const SAMPLE_CONTRACTS: { [key: string]: ContractSource } = {
  'Hello.sol': {
    name: 'Hello.sol',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Hello {
    string public message;
    address public owner;
    
    event MessageChanged(string newMessage, address changedBy);
    
    constructor(string memory _message) {
        message = _message;
        owner = msg.sender;
    }
    
    function setMessage(string memory _newMessage) public {
        require(bytes(_newMessage).length > 0, "Message cannot be empty");
        message = _newMessage;
        emit MessageChanged(_newMessage, msg.sender);
    }
    
    function getMessage() public view returns (string memory) {
        return message;
    }
    
    function getOwner() public view returns (address) {
        return owner;
    }
}`
  },
  'Counter.sol': {
    name: 'Counter.sol',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 public count;
    address public owner;
    
    event CountIncremented(uint256 newCount);
    event CountDecremented(uint256 newCount);
    event CountReset();
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        count = 0;
        owner = msg.sender;
    }
    
    function increment() public {
        count += 1;
        emit CountIncremented(count);
    }
    
    function decrement() public {
        require(count > 0, "Count cannot go below zero");
        count -= 1;
        emit CountDecremented(count);
    }
    
    function reset() public onlyOwner {
        count = 0;
        emit CountReset();
    }
    
    function getCount() public view returns (uint256) {
        return count;
    }
}`
  },
  'SimpleStorage.sol': {
    name: 'SimpleStorage.sol',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private storedData;
    mapping(address => uint256) public userValues;
    
    event DataStored(uint256 value, address storedBy);
    event UserValueSet(address user, uint256 value);
    
    function set(uint256 x) public {
        storedData = x;
        emit DataStored(x, msg.sender);
    }
    
    function get() public view returns (uint256) {
        return storedData;
    }
    
    function setUserValue(uint256 value) public {
        userValues[msg.sender] = value;
        emit UserValueSet(msg.sender, value);
    }
    
    function getUserValue(address user) public view returns (uint256) {
        return userValues[user];
    }
}`
  },
  'Token.sol': {
    name: 'Token.sol',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _totalSupply * 10**_decimals;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    
    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        require(to != address(0), "Cannot transfer to zero address");
        
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }
    
    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        require(to != address(0), "Cannot transfer to zero address");
        
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}`
  }
}

// Create a single worker instance to be reused
// Vite specific: Uses `type: 'module'` for modern worker syntax
let solcWorker: Worker | null = null;

function getSolcWorker(): Worker {
  if (!solcWorker) {
    console.log('[Main] Creating Solc Worker');
    solcWorker = new Worker(new URL('../workers/solc.worker.ts', import.meta.url), {
      type: 'module'
    });

    solcWorker.onmessageerror = (event) => {
      console.error('[Main] Error message from Solc Worker:', event);
    };
    solcWorker.onerror = (event) => {
      console.error('[Main] Uncaught error in Solc Worker:', event.message, event.error);
    };
  }
  return solcWorker;
}


/**
 * Pre-initializes the Solc worker and loads a specific compiler version.
 * Call this early if you know a specific version will be needed.
 */
export async function initializeSolcWorker(solcVersion: string = '0.8.26'): Promise<{success: boolean, version?: string, error?: string}> {
  const worker = getSolcWorker();
  return new Promise((resolve) => {
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.action === 'versionLoaded' || event.data.action === 'versionLoadFailed') {
        resolve(event.data);
      }
    };
    worker.postMessage({ action: 'loadVersion', payload: { solcVersion } });
  });
}


/**
 * Compile Solidity source code using the Web Worker
 */
export async function compileSolidity(
  contractSourceName: string, // Renamed from contractName to match worker's expectation
  sourceCode?: string,
  solcVersion: string = '0.8.26' // Allow specifying solc version
): Promise<CompilationResult> {
  const worker = getSolcWorker();

  // Use provided source code or get from samples
  let finalSourceCode: string;
  if (sourceCode) {
    finalSourceCode = sourceCode;
  } else if (SAMPLE_CONTRACTS[contractSourceName]) {
    finalSourceCode = SAMPLE_CONTRACTS[contractSourceName].content;
  } else {
    return {
      success: false,
      errors: [`Contract source '${contractSourceName}' not found in available samples or provided code.`]
    };
  }

  return new Promise<CompilationResult>((resolve, reject) => {
    const messageId = Date.now() + Math.random(); // Simple unique ID for the message

    const messageHandler = (event: MessageEvent) => {
      // Ensure we're handling the response for *this* request if multiple are in flight
      // For now, assuming one compilation at a time or worker handles queueing.
      // A more robust solution would involve matching a request ID.
      // The current worker processes one message at a time.
      console.log('[Main] Received message from worker:', event.data);
      if (event.data && typeof event.data.success === 'boolean') { // Check if it's a CompilationResult like message
        worker.removeEventListener('message', messageHandler); // Clean up listener
        resolve(event.data as CompilationResult);
      }
    };

    const errorHandler = (event: ErrorEvent) => {
      console.error('[Main] Error from Solc Worker during compilation:', event);
      worker.removeEventListener('message', messageHandler); // Clean up listener
      worker.removeEventListener('error', errorHandler);
      reject({
        success: false,
        errors: [`Worker error during compilation: ${event.message}`]
      } as CompilationResult);
    };

    worker.addEventListener('message', messageHandler);
    worker.addEventListener('error', errorHandler); // Catch general worker errors for this operation

    console.log(`[Main] Posting 'compile' message to worker for ${contractSourceName} with version ${solcVersion}`);
    worker.postMessage({
      action: 'compile',
      payload: {
        contractSourceName, // This is the filename e.g. "Hello.sol"
        sourceCode: finalSourceCode,
        solcVersion
      }
    });
  });
}

/**
 * Compile Solidity source code directly using the Web Worker.
 * This is intended for use when the source code is already available (e.g., from sessionStorage).
 */
export async function compileSoliditySource(
  sourceCode: string,
  contractFilename: string, // The original filename, e.g., "MyContract.sol"
  solcVersion: string = '0.8.26'
): Promise<CompilationResult> {
  const worker = getSolcWorker();

  if (!sourceCode || sourceCode.trim() === '') {
    return {
      success: false,
      errors: ['Cannot compile empty source code.']
    };
  }

  return new Promise<CompilationResult>((resolve, reject) => {
    const messageHandler = (event: MessageEvent) => {
      console.log('[Main] Received message from worker (compileSoliditySource):', event.data);
      if (event.data && typeof event.data.success === 'boolean') {
        worker.removeEventListener('message', messageHandler);
        resolve(event.data as CompilationResult);
      }
    };

    const errorHandler = (event: ErrorEvent) => {
      console.error('[Main] Error from Solc Worker during compilation (compileSoliditySource):', event);
      worker.removeEventListener('message', messageHandler);
      worker.removeEventListener('error', errorHandler);
      reject({
        success: false,
        errors: [`Worker error during compilation: ${event.message}`]
      } as CompilationResult);
    };

    worker.addEventListener('message', messageHandler);
    worker.addEventListener('error', errorHandler);

    console.log(`[Main] Posting 'compile' message to worker for ${contractFilename} (from source) with version ${solcVersion}`);
    worker.postMessage({
      action: 'compile',
      payload: {
        contractSourceName: contractFilename, // Pass the original filename
        sourceCode: sourceCode,
        solcVersion
      }
    });
  });
}


/**
 * Get available contract names
 */
export function getAvailableContracts(): string[] {
  return Object.keys(SAMPLE_CONTRACTS)
}

/**
 * Get contract source code
 */
export function getContractSource(contractName: string): string | null {
  return SAMPLE_CONTRACTS[contractName]?.content || null
}

/**
 * Format bytecode for display
 */
export function formatBytecode(bytecode: string): string {
  if (!bytecode) return 'No bytecode generated'
  
  // Add 0x prefix if not present
  const formattedBytecode = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`
  
  // Format in chunks for readability
  const chunks = formattedBytecode.match(/.{1,64}/g) || []
  return chunks.join('\n')
}

/**
 * Format ABI for display
 */
export function formatABI(abi: any[]): string {
  if (!abi || abi.length === 0) return 'No ABI generated'
  
  return JSON.stringify(abi, null, 2)
}

/**
 * Get contract size in bytes
 */
export function getContractSize(bytecode: string): number {
  if (!bytecode) return 0
  
  // Remove 0x prefix and calculate size
  const cleanBytecode = bytecode.replace(/^0x/, '')
  return cleanBytecode.length / 2
}

/**
 * Estimate deployment gas cost (rough estimate)
 */
export function estimateDeploymentGas(bytecode: string): number {
  const size = getContractSize(bytecode)
  // Rough estimate: 21000 base + 200 gas per byte
  return 21000 + (size * 200)
}