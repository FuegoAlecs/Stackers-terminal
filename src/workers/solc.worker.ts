/// <reference lib="webworker" />

// import wrapper from 'solc/wrapper'; // Old import
import * as solcWrapperModule from 'solc/wrapper'; // New import style
import { type CompilationResult } from '../lib/solidity';

// Attempt to get the actual wrapper function, handling CJS/ESM interop
const wrapper = solcWrapperModule.default || solcWrapperModule;

if (typeof wrapper !== 'function') {
  console.error('[Worker] CRITICAL FAILURE: solc/wrapper did not load as a function. Loaded module:', solcWrapperModule);
  // Post error message to main thread to make this visible
  self.postMessage({
    success: false,
    errors: ['[Worker] CRITICAL: solc/wrapper did not load correctly. Compilation disabled.']
  } as CompilationResult);
  // Throwing an error here will terminate the worker, which is appropriate if it can't function.
  throw new Error("[Worker] solc/wrapper did not resolve to a function. Worker cannot operate.");
}

// Keep track of the loaded compiler
let solcCompiler: any = null;

const SOLC_BIN_BASE_URL = 'https://binaries.soliditylang.org/bin/';

// IMPORTANT: This map needs to be maintained with actual full filenames from list.json
// Example: 'soljson-v0.8.26+commit.8a97fa7a.js'
// For now, I will use placeholder commit hashes for versions not explicitly known,
// but these MUST be updated with correct ones for the worker to function reliably.
const solcVersionMap: { [key: string]: string } = {
  '0.8.26': 'soljson-v0.8.26+commit.8a97fa7a.js', // Assuming this is correct from prior logs
  '0.8.20': 'soljson-v0.8.20+commit.a1b79de6.js', // Example, replace with actual
  '0.8.19': 'soljson-v0.8.19+commit.7dd6d404.js', // Example, replace with actual
  '0.8.10': 'soljson-v0.8.10+commit.fc410830.js', // Example, replace with actual
  '0.7.6':  'soljson-v0.7.6+commit.7338295f.js',  // Example, replace with actual
  '0.6.12': 'soljson-v0.6.12+commit.27d51765.js', // Example, replace with actual
  '0.5.17': 'soljson-v0.5.17+commit.d19bba13.js', // Example, replace with actual
  '0.4.26': 'soljson-v0.4.26+commit.4563c3fc.js', // Example, replace with actual
  // Add more versions as needed, ensuring the filename is exact
};

// Function to load a specific solc version using importScripts
async function loadSolc(version: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const fullVersionFilename = solcVersionMap[version];

    if (!fullVersionFilename) {
      const errorMessage = `[Worker] Solidity version ${version} is not mapped to a specific soljson file in solcVersionMap. Cannot load.`;
      console.error(errorMessage);
      reject(new Error(errorMessage));
      return;
    }

    const soljsonUrl = `${SOLC_BIN_BASE_URL}${fullVersionFilename}`;
    console.log(`[Worker] Attempting to load solc from: ${soljsonUrl} for version ${version}`);

    try {
      // Clear any previous Solc global that might exist
      // @ts-ignore
      if (self.Solc) {
        // @ts-ignore
        delete self.Solc;
      }

      importScripts(soljsonUrl); // Synchronously loads and executes the script

      // @ts-ignore - After importScripts, Solc should be in the global scope
      if (self.Solc) {
        // @ts-ignore
        const newCompiler = wrapper(self.Solc);
        // Verify the version of the loaded compiler if possible (it might not match 'version' string exactly)
        console.log('[Worker] Solc loaded and wrapped successfully via importScripts. Actual loaded version:', newCompiler.version());
        solcCompiler = newCompiler; // Assign to the global worker variable
        resolve(solcCompiler);
      } else {
        const errorMessage = `[Worker] Failed to load Solc from ${soljsonUrl}: self.Solc is undefined after importScripts.`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      }
    } catch (e) {
      console.error(`[Worker] Error during importScripts('${soljsonUrl}') or wrapping:`, e);
      reject(e);
    }
  });
}

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;

  if (action === 'compile') {
    const { contractSourceName, sourceCode, solcVersion = '0.8.26' } = payload; // Default to 0.8.26 if not specified

    if (!contractSourceName || !sourceCode) {
      self.postMessage({
        success: false,
        errors: ['[Worker] Missing contractSourceName or sourceCode in payload.']
      } as CompilationResult);
      return;
    }

    try {
      let currentCompilerVersion = null;
      if (solcCompiler && typeof solcCompiler.version === 'function') {
        try {
          currentCompilerVersion = solcCompiler.version();
        } catch (e) {
          console.warn('[Worker] Could not retrieve version from current solcCompiler.');
        }
      }

      // Check if the loaded compiler's version string starts with the requested solcVersion.
      // This handles cases where solcVersion is "0.8.26" and currentCompilerVersion is "0.8.26+commit..."
      if (!solcCompiler || !currentCompilerVersion || !currentCompilerVersion.startsWith(solcVersion)) {
        console.log(`[Worker] Current compiler version (${currentCompilerVersion}) does not match or is not loaded for requested version (${solcVersion}). Reloading.`);
        await loadSolc(solcVersion); // This will update the global solcCompiler
      } else {
        console.log(`[Worker] Using existing solc compiler version: ${currentCompilerVersion}`);
      }

      if (!solcCompiler) {
        // This should ideally be caught by loadSolc failing, but as a safeguard:
        throw new Error(`Solc compiler (version ${solcVersion}) could not be loaded.`);
      }

      // Ensure we are using the correct compiler instance that loadSolc resolved.
      const compilerToUse = solcCompiler;

      const input = {
        language: 'Solidity',
        sources: {
          [contractSourceName]: { // Use the dynamic contract source name
            content: sourceCode
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
      };

      console.log('[Worker] Compiling with input:', JSON.stringify(input, null, 2));
      const output = JSON.parse(solcCompiler.compile(JSON.stringify(input)));
      console.log('[Worker] Compilation output:', JSON.stringify(output, null, 2));

      const errors: string[] = [];
      const warnings: string[] = [];

      if (output.errors) {
        output.errors.forEach((error: any) => {
          if (error.severity === 'error') {
            errors.push(error.formattedMessage || error.message);
          } else {
            warnings.push(error.formattedMessage || error.message);
          }
        });
      }

      if (errors.length > 0) {
        self.postMessage({
          success: false,
          errors,
          warnings: warnings.length > 0 ? warnings : undefined
        } as CompilationResult);
        return;
      }

      const compiledContracts: CompilationResult['contracts'] = {};
      // The key in output.contracts will be the contractSourceName (e.g., 'Hello.sol')
      if (output.contracts && output.contracts[contractSourceName]) {
        for (const contractName in output.contracts[contractSourceName]) {
          const contract = output.contracts[contractSourceName][contractName];
          compiledContracts[contractName] = {
            abi: contract.abi || [],
            bytecode: contract.evm?.bytecode?.object || '',
            deployedBytecode: contract.evm?.deployedBytecode?.object || '',
            gasEstimates: contract.evm?.gasEstimates,
            metadata: contract.metadata
          };
        }
      }

      self.postMessage({
        success: true,
        contracts: compiledContracts,
        warnings: warnings.length > 0 ? warnings : undefined
      } as CompilationResult);

    } catch (error: any) {
      console.error('[Worker] Compilation error:', error);
      self.postMessage({
        success: false,
        errors: [`[Worker] Compilation failed: ${error.message}`]
      } as CompilationResult);
    }
  } else if (action === 'loadVersion') {
    const { solcVersion = '0.8.26' } = payload;
    try {
      await loadSolc(solcVersion);
      self.postMessage({ success: true, action: 'versionLoaded', version: solcCompiler?.version() });
    } catch (error: any) {
      self.postMessage({ success: false, action: 'versionLoadFailed', error: error.message });
    }
  }
};

// Optionally, pre-load a default version when the worker starts
// loadSolc('0.8.26').catch(err => console.error("[Worker] Initial solc load failed:", err));

console.log('[Worker] Solc worker initialized.');
