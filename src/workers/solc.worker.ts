/// <reference lib="webworker" />

import wrapper from 'solc/wrapper';
import { type CompilationResult } from '../lib/solidity';

let solcCompilerInstance: any = null;
let loadedCompilerVersion: string | null = null;
// To keep track of ongoing load operations for a specific version
const loadingPromises: Map<string, Promise<any>> = new Map();


async function loadSolcVersion(version: string): Promise<any> {
  console.log(`[Worker] Request to load solc version: ${version}`);
  if (solcCompilerInstance && loadedCompilerVersion === version) {
    console.log(`[Worker] Compiler version ${version} is already loaded.`);
    return solcCompilerInstance;
  }

  if (loadingPromises.has(version)) {
    console.log(`[Worker] Compiler version ${version} is currently being loaded. Waiting...`);
    return loadingPromises.get(version);
  }

  console.log(`[Worker] No existing instance or promise for ${version}. Starting new load.`);
  const loadPromise = new Promise((resolve, reject) => {
    // @ts-ignore Argument of type ... is not assignable to parameter of type 'SolcBuildCb'.
    wrapper.loadRemoteVersion(version, (err: Error | null, compiler: any) => {
      loadingPromises.delete(version); // Remove promise once operation is complete
      if (err) {
        console.error(`[Worker] Error loading solc version ${version}:`, err);
        // If this version failed, don't keep a potentially broken instance
        if (loadedCompilerVersion === version) {
            solcCompilerInstance = null;
            loadedCompilerVersion = null;
        }
        reject(err);
      } else if (!compiler || typeof compiler.compile !== 'function') {
        console.error(`[Worker] Loaded solc version ${version} is not a valid compiler object. Type: ${typeof compiler}, Keys: ${compiler ? Object.keys(compiler).join(', ') : 'null'}`);
        if (loadedCompilerVersion === version) {
            solcCompilerInstance = null;
            loadedCompilerVersion = null;
        }
        reject(new Error(`Invalid compiler object loaded for version ${version}.`));
      } else {
        console.log(`[Worker] Solc version ${version} loaded successfully. Compiler keys: ${Object.keys(compiler).join(', ')}`);
        solcCompilerInstance = compiler;
        loadedCompilerVersion = version; // Store the version string that was successfully loaded
        resolve(compiler);
      }
    });
  });

  loadingPromises.set(version, loadPromise);
  return loadPromise;
}

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;

  if (action === 'compile') {
    const { contractSourceName, sourceCode, solcVersion = '0.8.26' } = payload;

    if (!contractSourceName || !sourceCode) {
      self.postMessage({
        success: false,
        errors: ['[Worker] Missing contractSourceName or sourceCode in payload.'],
      } as CompilationResult);
      return;
    }

    let compiler;
    try {
      console.log(`[Worker] Ensuring solc version ${solcVersion} is loaded for compilation of ${contractSourceName}.`);
      compiler = await loadSolcVersion(solcVersion);
      console.log(`[Worker] Compiler for version ${solcVersion} obtained. Typeof compiler: ${typeof compiler}`);
      if (!compiler || typeof compiler.compile !== 'function') {
          throw new Error(`Loaded compiler for ${solcVersion} is invalid or missing 'compile' method.`);
      }
    } catch (error: any) {
      console.error(`[Worker] Failed to load/get compiler version ${solcVersion}:`, error);
      self.postMessage({
        success: false,
        errors: [`[Worker] Failed to load Solidity compiler version ${solcVersion}: ${error.message}`],
      } as CompilationResult);
      return;
    }

    try {
      const input = {
        language: 'Solidity',
        sources: {
          [contractSourceName]: { // Use the dynamic contract source name (e.g., "MyContract.sol")
            content: sourceCode,
          },
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.gasEstimates', 'metadata'],
            },
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      };

      console.log(`[Worker] Compiling ${contractSourceName} with solc version ${loadedCompilerVersion} (requested ${solcVersion}). Input:`, JSON.stringify(input, null, 2));

      // Ensure compile is called on the validated compiler instance
      const outputJson = compiler.compile(JSON.stringify(input));
      const output = JSON.parse(outputJson);

      console.log('[Worker] Compilation output:', JSON.stringify(output, null, 2));

      const errors: string[] = [];
      const warnings: string[] = [];

      if (output.errors) {
        output.errors.forEach((error: any) => {
          if (error.severity === 'error') {
            errors.push(error.formattedMessage || error.message);
          } else if (error.severity === 'warning') {
            warnings.push(error.formattedMessage || error.message);
          }
        });
      }

      if (errors.length > 0) {
        self.postMessage({
          success: false,
          errors,
          warnings: warnings.length > 0 ? warnings : undefined,
        } as CompilationResult);
        return;
      }

      const compiledContracts: CompilationResult['contracts'] = {};
      // output.contracts is an object where keys are filenames ("MyContract.sol")
      // and values are objects of contract names within that file.
      if (output.contracts && output.contracts[contractSourceName]) {
        for (const contractName in output.contracts[contractSourceName]) {
          const contract = output.contracts[contractSourceName][contractName];
          compiledContracts[contractName] = {
            abi: contract.abi || [],
            bytecode: contract.evm?.bytecode?.object || '',
            deployedBytecode: contract.evm?.deployedBytecode?.object || '',
            gasEstimates: contract.evm?.gasEstimates,
            metadata: contract.metadata,
          };
        }
      } else {
        console.warn(`[Worker] No contracts found in output for source file key "${contractSourceName}". Output contracts keys: ${output.contracts ? Object.keys(output.contracts) : 'undefined'}`);
        if (errors.length === 0) { // If no compilation errors but also no contracts for this file key
             warnings.push(`Compilation successful, but no contract artifacts found directly under the source name "${contractSourceName}". This might indicate an issue with how contracts are named or structured in the source file relative to the filename, or an unexpected output structure from the compiler.`);
        }
      }

      if (Object.keys(compiledContracts).length === 0 && errors.length === 0) {
        warnings.push('Compilation was successful, but no deployable contracts were found in the output.');
      }

      self.postMessage({
        success: true,
        contracts: compiledContracts,
        warnings: warnings.length > 0 ? warnings : undefined,
      } as CompilationResult);

    } catch (error: any) {
      console.error(`[Worker] Uncaught error during compilation of ${contractSourceName} with version ${solcVersion}:`, error);
      // Check if the error object itself might be the solc error output
      let errorMessages = [`[Worker] Compilation failed: ${error.message || 'Unknown error'}`];
      if (error.errors && Array.isArray(error.errors)) {
        errorMessages = error.errors.map((e: any) => e.formattedMessage || e.message);
      }
      self.postMessage({
        success: false,
        errors: errorMessages,
      } as CompilationResult);
    }
  } else if (action === 'loadVersion') {
    const { solcVersion = '0.8.26' } = payload;
    try {
      await loadSolcVersion(solcVersion);
      self.postMessage({
        success: true,
        action: 'versionLoaded',
        version: loadedCompilerVersion, // Actual loaded version
      });
    } catch (error: any) {
      self.postMessage({
        success: false,
        action: 'versionLoadFailed',
        error: error.message,
        version: solcVersion,
      });
    }
  } else {
    console.warn(`[Worker] Unknown action: ${action}`);
    self.postMessage({ success: false, errors: [`[Worker] Unknown action: ${action}`] });
  }
};

console.log('[Worker] solc.worker.ts initialized, using solc/wrapper.');

// Example: Pre-load a default version if desired, error is caught by the function
// loadSolcVersion('0.8.26').catch(err => console.warn('[Worker] Optional pre-load failed:', err.message));
