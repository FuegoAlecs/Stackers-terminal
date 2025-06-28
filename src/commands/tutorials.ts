import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'
import { createPrinter, printBanner, ICONS } from '../lib/terminalPrint'
import { NETWORK_INFO } from '../lib/alchemy'

export const tutorialsCommand: CommandHandler = {
  name: 'tutorials',
  description: 'Interactive tutorials for Web3 terminal operations',
  usage: 'tutorials [tutorial-name]',
  aliases: ['tutorial', 'learn', 'guide'],
  
  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { args, terminal } = context
    
    if (!terminal) {
      return {
        output: 'Terminal not available for tutorials',
        success: false
      }
    }

    const printer = createPrinter(terminal)
    
    if (args.length === 0) {
      await showTutorialMenu(printer)
      return { output: '', success: true }
    }
    
    const tutorialName = args[0].toLowerCase()
    
    switch (tutorialName) {
      case 'wallet':
      case 'connect':
        await walletTutorial(printer)
        break
      case 'deploy':
      case 'deployment':
        await deploymentTutorial(printer)
        break
      case 'call':
      case 'calling':
        await contractCallTutorial(printer)
        break
      case 'simulate':
      case 'simulation':
        await simulationTutorial(printer)
        break
      case 'smart':
      case 'smartwallet':
        await smartWalletTutorial(printer)
        break
      case 'events':
      case 'logs':
        await eventLogsTutorial(printer)
        break
      case 'aliases':
      case 'shortcuts':
        await aliasesTutorial(printer)
        break
      case 'scripts':
      case 'automation':
        await scriptsTutorial(printer)
        break
      case 'decode':
      case 'decoding':
        await decodingTutorial(printer)
        break
      case 'complete':
      case 'full':
        await completeTutorial(printer)
        break
      default:
        await printer.error(`Tutorial '${tutorialName}' not found.`)
        await showTutorialMenu(printer)
    }
    
    return { output: '', success: true }
  }
}

async function showTutorialMenu(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'WEB3 TERMINAL TUTORIALS', 'Learn blockchain development step by step')
  
  await printer.info('Welcome to the Web3 Terminal! Choose a tutorial to get started:')
  await printer.print('')
  
  const tutorials = [
    { name: 'wallet', title: 'Wallet Connection', desc: 'Connect MetaMask and manage your wallet', time: '3 min' },
    { name: 'deploy', title: 'Smart Contract Deployment', desc: 'Compile and deploy contracts to blockchain', time: '5 min' },
    { name: 'call', title: 'Contract Interaction', desc: 'Read data from deployed contracts', time: '4 min' },
    { name: 'simulate', title: 'Transaction Simulation', desc: 'Test transactions before sending', time: '4 min' },
    { name: 'smart', title: 'Smart Wallet Setup', desc: 'Create gasless smart wallets', time: '6 min' },
    { name: 'events', title: 'Event Monitoring', desc: 'Track contract events and logs', time: '5 min' },
    { name: 'aliases', title: 'Command Shortcuts', desc: 'Create aliases for faster workflows', time: '3 min' },
    { name: 'scripts', title: 'Workflow Automation', desc: 'Save and run command sequences', time: '4 min' },
    { name: 'decode', title: 'Data Decoding', desc: 'Decode transaction data and events', time: '5 min' },
    { name: 'complete', title: 'Complete Walkthrough', desc: 'Full end-to-end Web3 workflow', time: '20 min' }
  ]
  
  await printer.table(
    ['Command', 'Tutorial', 'Description', 'Time'],
    tutorials.map(t => [
      `tutorials ${t.name}`,
      t.title,
      t.desc,
      t.time
    ])
  )
  
  await printer.print('')
  await printer.info('💡 Tips:')
  await printer.print('  • Start with "tutorials wallet" if you\'re new to Web3')
  await printer.print('  • Each tutorial is interactive and self-paced')
  await printer.print('  • Commands are explained step-by-step')
  await printer.print('  • You can exit any tutorial by running other commands')
  
  await printer.print('')
  await printer.print(`🌐 Current Network: ${NETWORK_INFO.name} (${NETWORK_INFO.isTestnet ? 'Testnet' : 'Mainnet'})`, {
    color: 'blue'
  })
}

async function walletTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'WALLET CONNECTION TUTORIAL', 'Connect and manage your Web3 wallet')
  
  await printer.step(1, 4, 'Understanding Wallets', true)
  await printer.info('Web3 wallets store your private keys and let you interact with blockchains.')
  await printer.print('Popular wallets: MetaMask, Coinbase Wallet, WalletConnect')
  await printer.print('')
  
  await printer.step(2, 4, 'Connecting Your Wallet')
  await printer.code('wallet connect', 'Command')
  await printer.info('This opens a popup to select and connect your wallet.')
  await printer.warning('Make sure you\'re on the correct network!')
  await printer.print('')
  
  await printer.step(3, 4, 'Checking Wallet Status')
  await printer.code('wallet status', 'Command')
  await printer.info('Shows your connection status, address, and network.')
  await printer.print('')
  
  await printer.step(4, 4, 'Managing Your Wallet')
  await printer.print('Useful wallet commands:')
  await printer.code(`wallet balance     # Check ETH balance
wallet address     # Show full address
wallet network     # Network information
wallet disconnect  # Disconnect wallet`, 'Commands')
  
  await printer.print('')
  await printer.success('🎉 Wallet tutorial complete!')
  await printer.info('Try: wallet connect')
  await printer.print('Next: tutorials deploy')
}

async function deploymentTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'SMART CONTRACT DEPLOYMENT', 'Compile and deploy contracts to blockchain')
  
  await printer.step(1, 5, 'Understanding Smart Contracts', true)
  await printer.info('Smart contracts are programs that run on the blockchain.')
  await printer.print('They\'re written in Solidity and compiled to bytecode.')
  await printer.print('')
  
  await printer.step(2, 5, 'Viewing Available Contracts')
  await printer.code('compile list', 'Command')
  await printer.info('Shows sample contracts ready for compilation.')
  await printer.print('')
  
  await printer.step(3, 5, 'Compiling a Contract')
  await printer.code('compile Hello.sol', 'Command')
  await printer.info('Compiles Solidity code into deployable bytecode.')
  await printer.warning('Check for compilation errors before deploying!')
  await printer.print('')
  
  await printer.step(4, 5, 'Estimating Deployment Cost')
  await printer.code('deploy estimate Hello.sol', 'Command')
  await printer.info('Shows gas costs before actual deployment.')
  await printer.print('')
  
  await printer.step(5, 5, 'Deploying the Contract')
  await printer.code('deploy Hello.sol --args "Hello World"', 'Command')
  await printer.info('Deploys contract with constructor arguments.')
  await printer.success('Save the contract address for later use!')
  
  await printer.print('')
  await printer.success('🚀 Deployment tutorial complete!')
  await printer.info('Try: compile Hello.sol')
  await printer.print('Next: tutorials call')
}

async function contractCallTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'CONTRACT INTERACTION', 'Read and write data from smart contracts')
  
  await printer.step(1, 4, 'Understanding Contract Calls', true)
  await printer.info('Contracts have functions you can call to read or write data.')
  await printer.print('• Read functions: Free, don\'t change state')
  await printer.print('• Write functions: Cost gas, modify blockchain')
  await printer.print('')
  
  await printer.step(2, 4, 'Reading Contract Data')
  await printer.code('call 0xContractAddress.name()', 'Command')
  await printer.info('Calls read-only functions to get data.')
  await printer.print('Common read functions:')
  await printer.code(`call 0xToken.name()           # Token name
call 0xToken.symbol()         # Token symbol  
call 0xToken.totalSupply()    # Total supply
call 0xToken.balanceOf(0x...) # Balance of address`, 'Examples')
  
  await printer.step(3, 4, 'Writing to Contracts')
  await printer.code('write 0xContract.setMessage("Hello")', 'Command')
  await printer.warning('Write functions cost gas and are irreversible!')
  await printer.print('')
  
  await printer.step(4, 4, 'Gas Estimation')
  await printer.code('gasEstimate 0xContract.setMessage("Test")', 'Command')
  await printer.info('Always estimate gas before writing to contracts.')
  
  await printer.print('')
  await printer.success('📞 Contract calling tutorial complete!')
  await printer.info('Try calling a deployed contract!')
  await printer.print('Next: tutorials simulate')
}

async function simulationTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'TRANSACTION SIMULATION', 'Test transactions safely before sending')
  
  await printer.step(1, 3, 'Why Simulate Transactions?', true)
  await printer.info('Simulation lets you test transactions without spending gas.')
  await printer.print('Benefits:')
  await printer.print('• Predict gas usage')
  await printer.print('• Detect failures before sending')
  await printer.print('• See state changes and events')
  await printer.print('')
  
  await printer.step(2, 3, 'Simulating Transactions')
  await printer.code('simulate tx {"to":"0x...","data":"0x...","value":"0x0"}', 'Command')
  await printer.info('Provide transaction data in JSON format.')
  await printer.print('')
  
  await printer.step(3, 3, 'Understanding Results')
  await printer.info('Simulation shows:')
  await printer.print('• Gas usage and costs')
  await printer.print('• Return data from functions')
  await printer.print('• Events that would be emitted')
  await printer.print('• State changes')
  await printer.warning('Simulation uses current blockchain state!')
  
  await printer.print('')
  await printer.success('🧪 Simulation tutorial complete!')
  await printer.info('Always simulate complex transactions first!')
  await printer.print('Next: tutorials smart')
}

async function smartWalletTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'SMART WALLET SETUP', 'Create gasless smart wallets with advanced features')
  
  await printer.step(1, 5, 'What are Smart Wallets?', true)
  await printer.info('Smart wallets are contract-based accounts with superpowers:')
  await printer.print('• Gasless transactions (sponsored by Alchemy)')
  await printer.print('• Programmable transaction logic')
  await printer.print('• Better user experience')
  await printer.print('• Account recovery options')
  await printer.print('')
  
  await printer.step(2, 5, 'Prerequisites')
  await printer.warning('You need a connected EOA wallet first!')
  await printer.code('wallet connect', 'Command')
  await printer.info('Smart wallets are controlled by your regular wallet.')
  await printer.print('')
  
  await printer.step(3, 5, 'Creating a Smart Wallet')
  await printer.code('smart create --gasless', 'Command')
  await printer.info('Creates a smart wallet with gasless transactions enabled.')
  await printer.print('')
  
  await printer.step(4, 5, 'Managing Smart Wallet')
  await printer.code(`smart info                    # View wallet details
smart sponsor on              # Enable gasless mode
smart sponsor off             # Disable gasless mode`, 'Commands')
  
  await printer.step(5, 5, 'Sending Transactions')
  await printer.code('smart send 0xContract 0xdata', 'Command')
  await printer.success('Transactions are sponsored - no gas fees!')
  
  await printer.print('')
  await printer.success('🧠 Smart wallet tutorial complete!')
  await printer.info('Try: smart create --gasless')
  await printer.print('Next: tutorials events')
}

async function eventLogsTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'EVENT MONITORING', 'Track contract events and decode logs')
  
  await printer.step(1, 4, 'Understanding Events', true)
  await printer.info('Smart contracts emit events when things happen.')
  await printer.print('Events are like notifications from contracts.')
  await printer.print('Common events: Transfer, Approval, Mint, Burn')
  await printer.print('')
  
  await printer.step(2, 4, 'Loading Contract ABIs')
  await printer.code('decode abi load ERC20 \'[{"type":"event",...}]\'', 'Command')
  await printer.info('ABIs help decode event data into readable format.')
  await printer.print('Built-in ABIs: ERC20, ERC721')
  await printer.print('')
  
  await printer.step(3, 4, 'Fetching Contract Events')
  await printer.code('logs 0xContractAddress ERC20', 'Command')
  await printer.info('Gets recent events from the contract.')
  await printer.print('Options:')
  await printer.code(`logs 0xContract --event Transfer  # Specific event
logs 0xContract --limit 10        # Limit results
logs 0xContract --from 1000000    # From block`, 'Examples')
  
  await printer.step(4, 4, 'Understanding Event Data')
  await printer.info('Events show:')
  await printer.print('• Event name and signature')
  await printer.print('• Indexed parameters (searchable)')
  await printer.print('• Data parameters (additional info)')
  await printer.print('• Block number and transaction hash')
  
  await printer.print('')
  await printer.success('📜 Event monitoring tutorial complete!')
  await printer.info('Try: logs 0xContractAddress ERC20')
  await printer.print('Next: tutorials aliases')
}

async function aliasesTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'COMMAND SHORTCUTS', 'Create aliases for faster workflows')
  
  await printer.step(1, 4, 'Why Use Aliases?', true)
  await printer.info('Aliases create shortcuts for frequently used commands.')
  await printer.print('Benefits:')
  await printer.print('• Faster typing')
  await printer.print('• Consistent commands')
  await printer.print('• Reduced errors')
  await printer.print('')
  
  await printer.step(2, 4, 'Creating Aliases')
  await printer.code('alias bal wallet balance', 'Command')
  await printer.info('Now "bal" runs "wallet balance"!')
  await printer.print('More examples:')
  await printer.code(`alias conn wallet connect
alias greet call 0xContract.greet()
alias deploy-hello deploy Hello.sol --args "Hello"`, 'Examples')
  
  await printer.step(3, 4, 'Managing Aliases')
  await printer.code(`alias list                    # Show all aliases
alias search wallet           # Find wallet aliases
unalias bal                   # Remove alias
alias clear                   # Remove all`, 'Commands')
  
  await printer.step(4, 4, 'Advanced Features')
  await printer.info('Aliases support arguments:')
  await printer.code('alias transfer call 0xToken.transfer', 'Setup')
  await printer.code('transfer 0x123... 1000', 'Usage')
  await printer.info('The arguments get appended to the alias command!')
  
  await printer.print('')
  await printer.success('⚡ Aliases tutorial complete!')
  await printer.info('Try: alias bal wallet balance')
  await printer.print('Next: tutorials scripts')
}

async function scriptsTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'WORKFLOW AUTOMATION', 'Save and run command sequences')
  
  await printer.step(1, 4, 'What are Scripts?', true)
  await printer.info('Scripts are sequences of commands that run automatically.')
  await printer.print('Perfect for:')
  await printer.print('• Deployment workflows')
  await printer.print('• Testing sequences')
  await printer.print('• Monitoring tasks')
  await printer.print('')
  
  await printer.step(2, 4, 'Creating Scripts')
  await printer.code('script save deploy-token "compile Token.sol" "deploy Token.sol --args \'MyToken,MTK\'"', 'Command')
  await printer.info('Commands run in sequence, stopping on first error.')
  await printer.print('')
  
  await printer.step(3, 4, 'Running Scripts')
  await printer.code('script run deploy-token', 'Command')
  await printer.info('Executes all commands in the script automatically.')
  await printer.print('')
  
  await printer.step(4, 4, 'Managing Scripts')
  await printer.code(`script list                   # Show all scripts
script show deploy-token      # View script contents
script remove deploy-token    # Delete script`, 'Commands')
  
  await printer.print('')
  await printer.success('🎬 Scripts tutorial complete!')
  await printer.info('Try creating your first script!')
  await printer.print('Next: tutorials decode')
}

async function decodingTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'DATA DECODING', 'Decode transaction data and events')
  
  await printer.step(1, 4, 'Why Decode Data?', true)
  await printer.info('Blockchain data is encoded in hex format.')
  await printer.print('Decoding reveals:')
  await printer.print('• Function names and parameters')
  await printer.print('• Event details')
  await printer.print('• Return values')
  await printer.print('')
  
  await printer.step(2, 4, 'Loading ABIs for Decoding')
  await printer.code('decode abi load MyContract \'[{"type":"function",...}]\'', 'Command')
  await printer.info('ABIs provide the schema for decoding data.')
  await printer.print('')
  
  await printer.step(3, 4, 'Decoding Different Data Types')
  await printer.code(`decode data 0xa9059cbb...      # Function call data
decode output 0x0000... name    # Function output
decode event '["0x..."]' '0x...' # Event logs`, 'Commands')
  
  await printer.step(4, 4, 'Analyzing Unknown Data')
  await printer.code('decode analyze 0x1234...', 'Command')
  await printer.info('Suggests what type of data it might be.')
  
  await printer.print('')
  await printer.success('🔍 Decoding tutorial complete!')
  await printer.info('Try: decode abi list')
  await printer.print('Next: tutorials complete')
}

async function completeTutorial(printer: ReturnType<typeof createPrinter>) {
  await printBanner(printer, 'COMPLETE WEB3 WALKTHROUGH', 'End-to-end blockchain development workflow')
  
  await printer.info('This tutorial covers a complete Web3 workflow from start to finish.')
  await printer.warning('Estimated time: 20 minutes')
  await printer.print('')
  
  // Phase 1: Setup
  await printer.header('PHASE 1: ENVIRONMENT SETUP')
  await printer.step(1, 10, 'Connect Your Wallet')
  await printer.code('wallet connect', 'Command')
  await printer.info('Connect MetaMask or another Web3 wallet.')
  await printer.print('')
  
  await printer.step(2, 10, 'Check Network and Balance')
  await printer.code(`wallet status
wallet balance`, 'Commands')
  await printer.info(`Ensure you're on ${NETWORK_INFO.name} with some ETH for gas.`)
  await printer.print('')
  
  // Phase 2: Development
  await printer.header('PHASE 2: SMART CONTRACT DEVELOPMENT')
  await printer.step(3, 10, 'Explore Available Contracts')
  await printer.code('compile list', 'Command')
  await printer.info('See what sample contracts are available.')
  await printer.print('')
  
  await printer.step(4, 10, 'Compile a Contract')
  await printer.code('compile Hello.sol', 'Command')
  await printer.info('Compile the Hello World contract.')
  await printer.print('')
  
  await printer.step(5, 10, 'Estimate Deployment Cost')
  await printer.code('deploy estimate Hello.sol', 'Command')
  await printer.info('Check how much gas deployment will cost.')
  await printer.print('')
  
  await printer.step(6, 10, 'Deploy the Contract')
  await printer.code('deploy Hello.sol --args "Hello Blockchain!"', 'Command')
  await printer.success('Save the contract address that gets returned!')
  await printer.print('')
  
  // Phase 3: Interaction
  await printer.header('PHASE 3: CONTRACT INTERACTION')
  await printer.step(7, 10, 'Read Contract Data')
  await printer.code('call 0xYourContractAddress.getMessage()', 'Command')
  await printer.info('Replace with your actual contract address.')
  await printer.print('')
  
  await printer.step(8, 10, 'Write to Contract')
  await printer.code('write 0xYourContractAddress.setMessage("Updated message")', 'Command')
  await printer.warning('This costs gas!')
  await printer.print('')
  
  // Phase 4: Monitoring
  await printer.header('PHASE 4: MONITORING AND ANALYSIS')
  await printer.step(9, 10, 'Monitor Contract Events')
  await printer.code('logs 0xYourContractAddress --limit 5', 'Command')
  await printer.info('See events emitted by your contract.')
  await printer.print('')
  
  await printer.step(10, 10, 'Create Workflow Shortcuts')
  await printer.code(`alias my-contract call 0xYourContractAddress.getMessage
script save check-contract "wallet balance" "my-contract" "logs 0xYourContractAddress --limit 3"`, 'Commands')
  await printer.info('Create shortcuts for common operations.')
  
  await printer.print('')
  await printer.success('🎉 COMPLETE TUTORIAL FINISHED!')
  await printer.print('')
  await printer.info('🎯 What you\'ve learned:')
  await printer.print('✅ Wallet connection and management')
  await printer.print('✅ Smart contract compilation and deployment')
  await printer.print('✅ Contract interaction (read/write)')
  await printer.print('✅ Event monitoring and analysis')
  await printer.print('✅ Workflow automation with aliases and scripts')
  
  await printer.print('')
  await printer.info('🚀 Next steps:')
  await printer.print('• Try tutorials smart for gasless transactions')
  await printer.print('• Explore tutorials decode for data analysis')
  await printer.print('• Build your own contracts and deploy them')
  await printer.print('• Create custom scripts for your workflows')
  
  await printer.print('')
  await printer.print('🌟 Welcome to Web3 development!', { 
    color: 'yellow',
    style: 'bold'
  })
}

commandRouter.register(tutorialsCommand)