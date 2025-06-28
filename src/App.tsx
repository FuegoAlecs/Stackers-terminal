import React from 'react'
import { Home, Code, Zap, Terminal as TerminalIcon } from 'lucide-react'
import ErrorBoundary from './components/common/ErrorBoundary'
import { Layout, Header, Main } from './components/layout/Layout'
import { Card, CardHeader, CardContent } from './components/ui/Card'
import Button from './components/ui/Button'
import Terminal from './components/terminal/Terminal'
import { WalletProvider } from './components/wallet/WalletProvider'
import { APP_NAME } from './lib/constants'

function App() {
  return (
    <WalletProvider>
      <ErrorBoundary>
        <Layout>
          <Header>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <div className="flex items-center">
                  <Code className="h-8 w-8 text-blue-600 mr-3" />
                  <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
                </div>
                <nav className="flex space-x-4">
                  <Button variant="ghost" size="sm">
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </Button>
                  <Button variant="ghost" size="sm">
                    About
                  </Button>
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </nav>
              </div>
            </div>
          </Header>

          <Main>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              {/* Hero Section */}
              <div className="text-center mb-16">
                <div className="flex justify-center mb-6">
                  <div className="flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full">
                    <Zap className="h-10 w-10 text-blue-600" />
                  </div>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  Web3 Terminal Experience
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
                  Built with Vite, TypeScript, TailwindCSS, and Web3 wallet integration.
                  Connect your wallet and interact with blockchain through the terminal.
                </p>
                <div className="flex justify-center space-x-4">
                  <Button size="lg">
                    Explore Commands
                  </Button>
                  <Button variant="outline" size="lg">
                    Connect Wallet
                  </Button>
                </div>
              </div>

              {/* Terminal Demo Section */}
              <div className="mb-16">
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
                      <TerminalIcon className="h-8 w-8 text-gray-700" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Web3 Interactive Terminal
                  </h2>
                  <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Try wallet commands like "wallet connect", "wallet status", or "wallet disconnect".
                    The terminal shows your connected wallet address in the prompt.
                  </p>
                </div>
                
                <div className="max-w-4xl mx-auto">
                  <Terminal 
                    className="w-full"
                    welcomeMessage="🚀 Welcome to the Web3 Terminal! Type 'help' for commands or 'wallet connect' to get started."
                  />
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid md:grid-cols-3 gap-8 mb-16">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                      <Code className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      TypeScript Ready
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Full TypeScript support with proper type definitions,
                      interfaces, and development experience.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <Zap className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Web3 Integration
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Wagmi + RainbowKit integration with support for MetaMask,
                      WalletConnect, Coinbase Wallet, and more.
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                      <TerminalIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Terminal Commands
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Browser-based terminal with wallet commands, history,
                      tab completion, and real-time wallet status.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Start */}
              <div className="bg-gray-900 rounded-2xl p-8 text-white">
                <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
                <p className="text-gray-300 mb-6">
                  Connect your wallet and start exploring Web3 through the terminal.
                  Try commands like "wallet connect", "wallet status", or "wallet balance".
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button variant="secondary">
                    Browse Commands
                  </Button>
                  <Button variant="outline">
                    Read Documentation
                  </Button>
                </div>
              </div>
            </div>
          </Main>
        </Layout>
      </ErrorBoundary>
    </WalletProvider>
  )
}

export default App