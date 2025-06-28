import solc from 'solc'

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

/**
 * Compile Solidity source code using solc-js
 */
export async function compileSolidity(
  contractName: string,
  sourceCode?: string
): Promise<CompilationResult> {
  try {
    // Use provided source code or get from samples
    let source: string
    if (sourceCode) {
      source = sourceCode
    } else if (SAMPLE_CONTRACTS[contractName]) {
      source = SAMPLE_CONTRACTS[contractName].content
    } else {
      return {
        success: false,
        errors: [`Contract '${contractName}' not found in available contracts`]
      }
    }

    // Prepare the input for the compiler
    const input = {
      language: 'Solidity',
      sources: {
        [contractName]: {
          content: source
        }
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.gasEstimates', 'metadata']
          }
        },
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }

    // Compile the contract
    const output = JSON.parse(solc.compile(JSON.stringify(input)))

    // Check for errors
    const errors: string[] = []
    const warnings: string[] = []

    if (output.errors) {
      output.errors.forEach((error: any) => {
        if (error.severity === 'error') {
          errors.push(error.formattedMessage || error.message)
        } else {
          warnings.push(error.formattedMessage || error.message)
        }
      })
    }

    // If there are compilation errors, return them
    if (errors.length > 0) {
      return {
        success: false,
        errors,
        warnings
      }
    }

    // Extract compiled contracts
    const contracts: { [contractName: string]: any } = {}
    
    if (output.contracts && output.contracts[contractName]) {
      Object.keys(output.contracts[contractName]).forEach(contract => {
        const compiledContract = output.contracts[contractName][contract]
        contracts[contract] = {
          abi: compiledContract.abi || [],
          bytecode: compiledContract.evm?.bytecode?.object || '',
          deployedBytecode: compiledContract.evm?.deployedBytecode?.object || '',
          gasEstimates: compiledContract.evm?.gasEstimates,
          metadata: compiledContract.metadata
        }
      })
    }

    return {
      success: true,
      contracts,
      warnings: warnings.length > 0 ? warnings : undefined
    }

  } catch (error) {
    return {
      success: false,
      errors: [`Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    }
  }
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