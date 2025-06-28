import React from 'react'
import Terminal from './components/terminal/Terminal'
import ErrorBoundary from './components/common/ErrorBoundary'
import { WalletProvider } from './components/wallet/WalletProvider'

function App() {
  return (
    <WalletProvider>
      <ErrorBoundary>
        <Terminal
          // The welcomeMessage prop is already updated in Terminal.tsx default props
          // welcomeMessage="🚀 Welcome to Stackers! Type 'help' for commands or 'tutorials' to get started."
        />
      </ErrorBoundary>
    </WalletProvider>
  )
}

export default App