import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { cn } from '../../lib/utils'
import { commandRouter } from '../../commands'
import { useWallet } from '../../hooks/useWallet'
import { useSession } from '../../hooks/useSession'
import { setWalletContext } from '../../commands/wallet'
import { commandHistory } from '../../lib/CommandHistory'
import { aliasManager } from '../../lib/AliasManager'
import { createPrinter, formatCommandOutput } from '../../lib/terminalPrint'

interface TerminalProps {
  className?: string
  prompt?: string
  welcomeMessage?: string
}

const Terminal: React.FC<TerminalProps> = ({
  className,
  prompt = '$ ',
  welcomeMessage = "🚀 Welcome to Stackers! Type 'help' for commands or 'tutorials' to get started."
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [currentLine, setCurrentLine] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [tempCommand, setTempCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Get wallet context and session
  const walletContext = useWallet()
  const { session, updateWallet, updateSmartWallet, addToHistory } = useSession()

  // Set wallet context for commands to use
  useEffect(() => {
    setWalletContext(walletContext)
  }, [walletContext])

  // Update session when wallet changes
  useEffect(() => {
    updateWallet({
      address: walletContext.address,
      isConnected: walletContext.isConnected,
      // Add network info when available
    })
  }, [walletContext.address, walletContext.isConnected, updateWallet])

  const writeToTerminal = (text: string, newLine = true) => {
    if (xtermRef.current) {
      xtermRef.current.write(text + (newLine ? '\r\n' : ''))
    }
  }

  const writePrompt = () => {
    // Show wallet status in prompt if connected
    const { isConnected, formatAddress, address } = walletContext
    const walletPrompt = isConnected ? `[${formatAddress(address)}] ` : ''
    writeToTerminal(`${walletPrompt}${prompt}`, false)
  }

  const clearCurrentLine = () => {
    const term = xtermRef.current
    if (!term) return

    const { isConnected, formatAddress, address } = walletContext
    const walletPrompt = isConnected ? `[${formatAddress(address)}] ` : ''
    const fullPrompt = `${walletPrompt}${prompt}`
    
    // Clear the line and rewrite prompt
    term.write('\r' + ' '.repeat(fullPrompt.length + currentLine.length))
    term.write('\r' + fullPrompt)
  }

  const handleCommand = async (command: string) => {
    if (isProcessing) return
    
    setIsProcessing(true)
    
    try {
      // Add to session history
      addToHistory(command)
      
      // Create printer for enhanced output
      const printer = createPrinter({
        write: writeToTerminal,
        clear: () => xtermRef.current?.clear()
      })
      
      // Show loading for longer commands
      const isLongCommand = ['deploy', 'compile', 'logs', 'simulate'].some(cmd => 
        command.toLowerCase().startsWith(cmd)
      )
      
      if (isLongCommand) {
        await printer.loading('Processing command...', 1000)
      }
      
      // Execute command using the router (which handles history and aliases)
      const result = await commandRouter.dispatch(command, {
        terminal: xtermRef.current,
        printer
      })
      
      if (result.output) {
        // Use enhanced formatting for command output
        await formatCommandOutput(result, printer)
      }
      
      if (!result.success && result.error) {
        await printer.error(result.error)
      }
    } catch (error) {
      const printer = createPrinter({
        write: writeToTerminal,
        clear: () => xtermRef.current?.clear()
      })
      await printer.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
      // Show new prompt
      writePrompt()
      setCurrentLine('')
      setHistoryIndex(-1)
      setTempCommand('')
    }
  }

  const navigateHistory = (direction: 'up' | 'down') => {
    const term = xtermRef.current
    if (!term) return

    const history = session.commandHistory
    
    if (direction === 'up') {
      if (history.length === 0) return
      
      // Save current command if we're at the bottom
      if (historyIndex === -1) {
        setTempCommand(currentLine)
      }
      
      const newIndex = historyIndex === -1 
        ? history.length - 1 
        : Math.max(0, historyIndex - 1)
      
      setHistoryIndex(newIndex)
      const historicalCommand = history[newIndex]
      
      clearCurrentLine()
      term.write(historicalCommand)
      setCurrentLine(historicalCommand)
    } else {
      if (historyIndex === -1) return
      
      const newIndex = historyIndex + 1
      
      if (newIndex >= history.length) {
        // Return to current command
        setHistoryIndex(-1)
        clearCurrentLine()
        term.write(tempCommand)
        setCurrentLine(tempCommand)
        setTempCommand('')
      } else {
        setHistoryIndex(newIndex)
        const historicalCommand = history[newIndex]
        
        clearCurrentLine()
        term.write(historicalCommand)
        setCurrentLine(historicalCommand)
      }
    }
  }

  const handleKeyPress = (key: string, ev: KeyboardEvent) => {
    const term = xtermRef.current;
    if (!term || isProcessing) return;

    switch (ev.key) {
      case 'Enter':
        ev.preventDefault();
        writeToTerminal(''); // Echo newline visually in terminal
        if (currentLine.trim().length > 0) { // Only process if there's a command
          handleCommand(currentLine); // Restore the actual call to handleCommand
        } else {
          // If the line is empty, just show a new prompt without processing
          setCurrentLine('');
          setHistoryIndex(-1);
          setTempCommand('');
          writePrompt();
        }
        // Note: setCurrentLine, setHistoryIndex, setTempCommand, writePrompt are called inside handleCommand's finally block
        break;

      case 'Backspace':
        ev.preventDefault();
        if (currentLine.length > 0) {
          setCurrentLine(prev => prev.slice(0, -1));
          term.write('\b \b'); // Visual backspace
        }
        break;

      case 'ArrowUp':
        ev.preventDefault();
        navigateHistory('up');
        break;

      case 'ArrowDown':
        ev.preventDefault();
        navigateHistory('down');
        break;

      case 'Tab':
        ev.preventDefault();
        if (currentLine.trim()) {
          const suggestions = commandRouter.getSuggestions(currentLine.trim());
          if (suggestions.length === 1) {
            const completion = suggestions[0].substring(currentLine.length);
            term.write(completion);
            setCurrentLine(prev => prev + completion);
          } else if (suggestions.length > 1) {
            writeToTerminal('');
            writeToTerminal(suggestions.join('  '));
            writePrompt();
            term.write(currentLine);
          }
        }
        break;

      case 'Escape':
        ev.preventDefault();
        clearCurrentLine();
        setCurrentLine('');
        setHistoryIndex(-1);
        setTempCommand('');
        break;

      // Home and End could be restored if needed, but are less critical for core functionality.

      default:
        // Handle printable characters (including space, via ev.key)
        if (ev.key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
          term.write(ev.key);
          setCurrentLine(prev => prev + ev.key);
          // Reset history navigation when typing (will be relevant when history is restored)
          // if (historyIndex !== -1) {
          //   setHistoryIndex(-1);
          //   setTempCommand('');
          // }
        }
        break;
    }
  };

  useEffect(() => {
    if (!terminalRef.current) {
      // console.error("DEBUG: terminalRef.current is null in useEffect");
      return;
    }

    // console.log("DEBUG: Initializing XTerm basic");
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      theme: { background: '#0a0a0a', foreground: '#ffffff' } // Minimal theme
    });

    try {
      term.open(terminalRef.current);
      // console.log("DEBUG: XTerm opened");
    } catch (e) {
      // console.error("DEBUG: Error opening XTerm:", e);
      return;
    }

    term.write("A"); // Write a single character
    xtermRef.current = term;

    // Restore fitAddon and resize listener
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    requestAnimationFrame(() => { // Keep deferred fit
      fitAddon.fit();
    });
    fitAddonRef.current = fitAddon;

    // Restore onKey listener
    term.onKey(({ key, domEvent }) => {
      handleKeyPress(key, domEvent);
    });

    // Restore Enhanced welcome message with colors
    const printer = createPrinter({
      write: writeToTerminal,
      clear: () => term.clear()
    });

    const showWelcome = async () => {
      await printer.print('🚀 ' + '═'.repeat(50) + ' 🚀', { color: 'blue', style: 'bold' })
      await printer.print('      WELCOME TO STACKERS      ', {
        color: 'blue', 
        style: 'bold',
        typing: true,
        typingSpeed: 50
      })
      await printer.print('   Your Onchain CLI Experience   ', {
        color: 'cyan',
        style: 'bold',
        typing: true,
        typingSpeed: 30
      })
      await printer.print('🚀 ' + '═'.repeat(50) + ' 🚀', { color: 'blue', style: 'bold' })
      await printer.print('')
      
      await printer.info(welcomeMessage, true) // welcomeMessage prop is already updated
      await printer.print('')
      await printer.print('💡 Quick Start Commands:', { color: 'yellow', style: 'bold' })
      await printer.print('  📚 tutorials        - Interactive learning guides')
      await printer.print('  💰 wallet connect   - Connect your Web3 wallet')
      await printer.print('  📊 wallet status    - Check current wallet status')
      await printer.print('  📋 help             - Show all available commands')
      await printer.print('  🔗 alias            - Create command shortcuts')
      await printer.print('  🎬 script           - Automate command sequences')
      await printer.print('')
      writePrompt()
    }
    showWelcome();

    // Restore resize listener
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      // console.log("DEBUG: XTerm disposed");
    };
  }, []); // Empty dependency array means this runs once on mount

  // Update prompt when wallet connection changes
  // Temporarily commenting out to reduce variables during debug
  useEffect(() => {
    // This will trigger a re-render of the prompt on wallet state changes
  }, [walletContext.isConnected, walletContext.address])

  return (
    <div className={cn(
      'w-screen h-screen flex flex-col bg-black', // Full screen, flex column
      className
    )}>
      {/* Terminal Header Removed */}
      
      {/* Terminal Content */}
      <div 
        ref={terminalRef} 
        className="flex-grow w-full focus:outline-none p-2" // flex-grow to take available space
        style={{ border: '1px solid red', minHeight: '100px' }} // DEBUG: Force visibility and min size
      />
    </div>
  )
}

export default Terminal