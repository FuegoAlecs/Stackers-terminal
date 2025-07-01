/// <reference lib="webworker" />

import { solidityCompiler, getCompilerVersions, SolcVersion } from '@agnostico/browser-solidity-compiler';
import { type CompilationResult } from '../lib/solidity';

interface CompilerBuild {
  path: string;
  version: string;
  build: string;
  longVersion: string;
  keccak256: string;
  sha256: string;
  urls: string[];
  [key: string]: any; // For other properties like 'latestRelease'
}

interface CompilerVersionList {
  releases: Record<string, string>;
  builds: CompilerBuild[];
  latestRelease: string;
}

let compilerVersionList: CompilerVersionList | null = null;
let versionLoadPromise: Promise<CompilerVersionList | null> | null = null;

async function loadSolidityVersions(): Promise<CompilerVersionList | null> {
  if (compilerVersionList) {
    return compilerVersionList;
  }
  if (versionLoadPromise) {
    return versionLoadPromise;
  }

  console.log('[Worker] Fetching Solidity compiler versions...');
  versionLoadPromise = getCompilerVersions()
    .then((versions: any) => { // Type from library is SolcVersion, but it's an object with builds, releases, latestRelease
      console.log('[Worker] Successfully fetched compiler versions.');
      compilerVersionList = versions as CompilerVersionList;
      return compilerVersionList;
    })
    .catch(error => {
      console.error('[Worker] Failed to fetch compiler versions:', error);
      versionLoadPromise = null; // Reset promise so it can be tried again
      throw error; // Re-throw to be caught by caller
    });
  return versionLoadPromise;
}

// Pre-warm the compiler versions list
loadSolidityVersions().catch(err => {
  console.error('[Worker] Initial pre-warm of compiler versions failed:', err);
});

function findFullCompilerPath(shortVersion: string): string | null {
  if (!compilerVersionList || !compilerVersionList.builds) {
    console.error('[Worker] Compiler versions not loaded or invalid structure.');
    return null;
  }
  // The 'builds' array contains objects with a 'path' (e.g., "soljson-v0.8.26+commit.8a97fa7a.js")
  // and a 'version' (e.g., "0.8.26").
  // We need to find the build that matches the shortVersion.
  const foundBuild = compilerVersionList.builds.find(build => build.version === shortVersion);

  if (foundBuild) {
    return `https://binaries.soliditylang.org/bin/${foundBuild.path}`;
  }
  console.warn(`[Worker] Full compiler path for short version "${shortVersion}" not found.`);
  // Fallback: try to find latest release if exact match fails and version is a major.minor (e.g. "0.8")
  if (shortVersion.match(/^\d+\.\d+$/) && compilerVersionList.latestRelease) {
      const latestReleaseBuild = compilerVersionList.builds.find(build => build.version === compilerVersionList!.latestRelease);
      if (latestReleaseBuild && latestReleaseBuild.version.startsWith(shortVersion)) {
          console.warn(`[Worker] Using latest release ${latestReleaseBuild.version} as fallback for ${shortVersion}`);
          return `https://binaries.soliditylang.org/bin/${latestReleaseBuild.path}`;
      }
  }
  // Fallback: try to find the first one that contains the version string (less precise)
   const lessPreciseMatch = compilerVersionList.builds.find(build => build.path.includes(`v${shortVersion}`));
   if (lessPreciseMatch) {
    console.warn(`[Worker] Using less precise match ${lessPreciseMatch.path} for version ${shortVersion}`);
    return `https://binaries.soliditylang.org/bin/${lessPreciseMatch.path}`;
   }

  return null;
}

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;

  if (action === 'compile') {
    const { contractSourceName, sourceCode, solcVersion = '0.8.26' } = payload; // Default to a recent version

    if (!contractSourceName || !sourceCode) {
      self.postMessage({
        success: false,
        errors: ['[Worker] Missing contractSourceName or sourceCode in payload.']
      } as CompilationResult);
      return;
    }

    try {
      await loadSolidityVersions(); // Ensure versions are loaded

      const fullCompilerPath = findFullCompilerPath(solcVersion);
      if (!fullCompilerPath) {
        throw new Error(`[Worker] Failed to find compiler path for version ${solcVersion}.`);
      }

      console.log(`[Worker] Compiling ${contractSourceName} using ${fullCompilerPath}`);

      const output = await solidityCompiler({
        version: fullCompilerPath, // This should be the full URL to the soljson file
        contractBody: sourceCode,
        options: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          outputSelection: {
            '*': {
              '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'evm.gasEstimates', 'metadata'],
            },
          },
        },
      });

      console.log('[Worker] Raw compilation output:', output);

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

      // @agnostico/browser-solidity-compiler might return status: false for errors
      if (output.status === false && errors.length === 0) {
          errors.push('Compilation failed. Check compiler output for details.');
          // Sometimes the actual errors are in output.result.errors
          if (output.result?.errors) {
             output.result.errors.forEach((error: any) => {
                if (error.severity === 'error') {
                    errors.push(error.formattedMessage || error.message);
                } else if (error.severity === 'warning') {
                    warnings.push(error.formattedMessage || error.message);
                }
            });
          }
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
      // The output structure from @agnostico/browser-solidity-compiler:
      // output.contracts: { ContractName1: { abi, evm: { bytecode: { object: "..." } }, ... } }
      // OR output.result.contracts: { "filename.sol" : { ContractName1: { ... } } }

      let contractsData = output.contracts;
      if (!contractsData && output.result?.contracts) {
        // If contracts are nested under filename, extract them.
        // Assuming single file compilation, take the first entry.
        const fileNameKey = Object.keys(output.result.contracts)[0];
        if (fileNameKey) {
          contractsData = output.result.contracts[fileNameKey];
        }
      }

      if (contractsData) {
        for (const contractName in contractsData) {
          const contract = contractsData[contractName];
          compiledContracts[contractName] = {
            abi: contract.abi || [],
            bytecode: contract.evm?.bytecode?.object || '',
            deployedBytecode: contract.evm?.deployedBytecode?.object || '',
            gasEstimates: contract.evm?.gasEstimates,
            metadata: contract.metadata,
          };
        }
      }

      if (Object.keys(compiledContracts).length === 0 && errors.length === 0) {
        warnings.push('[Worker] Compilation was successful, but no deployable contracts were found.');
      }

      self.postMessage({
        success: true,
        contracts: compiledContracts,
        warnings: warnings.length > 0 ? warnings : undefined,
      } as CompilationResult);

    } catch (error: any) {
      console.error('[Worker] Uncaught error during compilation process:', error);
      self.postMessage({
        success: false,
        errors: [`[Worker] Compilation failed: ${error.message || 'Unknown error during compilation'}`],
      } as CompilationResult);
    }
  } else if (action === 'loadVersion') {
    // This action is mostly to pre-warm or check versions
    try {
      const versions = await loadSolidityVersions();
      self.postMessage({
        success: true,
        action: 'versionLoaded',
        latestRelease: versions?.latestRelease,
        numberOfBuilds: versions?.builds?.length || 0,
      });
    } catch (error: any) {
      self.postMessage({
        success: false,
        action: 'versionLoadFailed',
        error: error.message,
      });
    }
  } else {
    console.warn(`[Worker] Unknown action: ${action}`);
    self.postMessage({ success: false, errors: [`[Worker] Unknown action: ${action}`] });
  }
};

console.log('[Worker] New solc.worker.ts initialized with @agnostico/browser-solidity-compiler.');
