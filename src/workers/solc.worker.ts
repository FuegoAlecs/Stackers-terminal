/// <reference lib="webworker" />

import wrapper from 'solc/wrapper';
import { type CompilationResult } from '../lib/solidity'; // Assuming CompilationResult is exported

// Keep track of the loaded compiler
let solcCompiler: any = null;

// Function to load a specific solc version
async function loadSolc(version: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check if https://binaries.soliditylang.org/bin/list.json contains the full version string
    // For now, we'll assume the short version string is enough, but this might need adjustment
    // e.g. for 0.8.26 it might be 'soljson-v0.8.26+commit.8a97fa7a.js'
    // We'll try to construct it, but a lookup against list.json would be more robust.
    // However, `loadRemoteVersion` in solc should handle finding the full path.
    try {
      console.log(`[Worker] Attempting to load solc version: ${version} using wrapper.loadRemoteVersion`);
      // @ts-ignore - solc types might not perfectly match worker context for loadRemoteVersion
      wrapper.loadRemoteVersion(version, (err: Error | null, compilerInstance: any) => {
        if (err) {
          console.error(`[Worker] CRITICAL: loadRemoteVersion callback error for version ${version}:`, err);
          reject(err);
        } else {
          console.log(`[Worker] loadRemoteVersion callback for ${version}: typeof compilerInstance = ${typeof compilerInstance}`);
          const instanceVersion = compilerInstance && typeof compilerInstance.version === 'function' ? compilerInstance.version() : 'Instance has no version function or instance undefined';
          console.log(`[Worker] loadRemoteVersion callback for ${version}: compilerInstance.version? ${instanceVersion}`);
          console.log(`[Worker] loadRemoteVersion callback for ${version}: typeof compilerInstance.compile = ${compilerInstance ? typeof compilerInstance.compile : 'compilerInstance undefined'}`);

          console.log(`[Worker] Assigning to global solcCompiler for version ${version}.`);
          solcCompiler = compilerInstance;
          if (solcCompiler && typeof solcCompiler.version === 'function') {
            console.log(`[Worker] Global solcCompiler is now version: ${solcCompiler.version()}`);
          } else {
            console.warn(`[Worker] Global solcCompiler may not be correctly assigned or is not a valid compiler object after loading ${version}.`);
          }
          resolve(compilerInstance);
        }
      });
    } catch (e) {
      console.error('[Worker] Exception during loadRemoteVersion call:', e);
      reject(e);
    }
  });
}

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;

  if (action === 'compile') {
    const { contractSourceName, sourceCode, solcVersion = '0.8.26' } = payload;

    if (!contractSourceName || !sourceCode) {
      self.postMessage({
        success: false,
        errors: ['[Worker] Missing contractSourceName or sourceCode in payload.']
      } as CompilationResult);
      return;
    }

    try {
      if (!solcCompiler || (solcCompiler && solcCompiler.version() !== solcVersion && !solcCompiler.version().startsWith(solcVersion))) {
        // A more robust check would be to compare the full version string if available
        // For now, if major.minor.patch is different, reload.
        console.log(`[Worker] Current compiler version ${solcCompiler?.version()} does not match requested ${solcVersion}. Reloading.`);
        await loadSolc(solcVersion);
      }

      // Enhanced logging before checking !solcCompiler
      console.log(`[Worker] Pre-compile check: typeof solcCompiler = ${typeof solcCompiler}`);
      const currentVersion = solcCompiler && typeof solcCompiler.version === 'function' ? solcCompiler.version() : 'No version function or solcCompiler undefined';
      console.log(`[Worker] Pre-compile check: solcCompiler.version? ${currentVersion}`);
      console.log(`[Worker] Pre-compile check: typeof solcCompiler.compile = ${solcCompiler ? typeof solcCompiler.compile : 'solcCompiler undefined'}`);
      if (solcCompiler) {
        try {
          console.log(`[Worker] Pre-compile check: solcCompiler keys: ${Object.keys(solcCompiler).join(', ')}`);
        } catch (kerr) {
          console.error(`[Worker] Pre-compile check: Error getting Object.keys(solcCompiler): ${kerr}`);
        }
      }


      if (!solcCompiler) {
        // This error will be caught by the try-catch block below
        throw new Error('[Worker] CRITICAL: Solc compiler is not loaded or defined before compile attempt.');
      }

      // Additional check for compile function
      if (typeof solcCompiler.compile !== 'function') {
        throw new Error(`[Worker] CRITICAL: solcCompiler.compile is not a function. Type is ${typeof solcCompiler.compile}. Compiler version: ${currentVersion}`);
      }


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
