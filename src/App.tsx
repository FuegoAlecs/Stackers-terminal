import React from 'react'
import ErrorBoundary from './components/common/ErrorBoundary'
import Terminal from './components/terminal/Terminal'
import { WalletProvider } from './components/wallet/WalletProvider'

function App() {
  return (
    <WalletProvider>
      <ErrorBoundary>
        {/* The Terminal component will be styled to be full screen via CSS */}
        <Terminal
          // className will be handled by global styles or Terminal's own styles for fullscreen
          welcomeMessage="🚀 Welcome to the Web3 Terminal! Type 'help' for commands or 'wallet connect' to get started."
        />
      </ErrorBoundary>
    </WalletProvider>
  )
}

export default App