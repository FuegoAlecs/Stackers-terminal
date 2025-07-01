// src/lib/commandWalletContext.ts

// This type should ideally match or be compatible with the type returned by `useWallet()`
interface CommandWalletContextValue {
  address?: string;
  isConnected: boolean;
  // Add other properties from useWallet's return type if commands need them
  // e.g., formatAddress, isConnecting, etc.
}

let sharedWalletContext: CommandWalletContextValue | null = null;

export const getCommandWalletContext = (): CommandWalletContextValue | null => {
  return sharedWalletContext;
};

export const setCommandWalletContext = (context: CommandWalletContextValue | null): void => {
  sharedWalletContext = context;
};
