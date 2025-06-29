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
    if (isProcessing) return;
    setIsProcessing(true);

    // --- TEMPORARY DEBUG ---
    if (xtermRef.current) {
      xtermRef.current.write(`\r\n[DEBUG] handleCommand received: ${command}\r\n`);
    } else {
      console.error("[DEBUG] xtermRef.current is NULL in handleCommand start");
    }
    // --- END TEMPORARY DEBUG ---

    try {
      addToHistory(command);
      const printer = createPrinter({
        write: writeToTerminal,
        clear: () => xtermRef.current?.clear()
      });

      // --- TEMPORARY DEBUG ---
      if (xtermRef.current) {
        xtermRef.current.write(`[DEBUG] Printer created. Dispatching: ${command}\r\n`);
      } else {
        console.error("[DEBUG] xtermRef.current is NULL before dispatch");
      }
      // --- END TEMPORARY DEBUG ---
      
      // Show loading for longer commands (moved after initial debug prints)
      const isLongCommand = ['deploy', 'compile', 'logs', 'simulate'].some(cmd => 
        command.toLowerCase().startsWith(cmd)
      );
      if (isLongCommand) {
        await printer.loading('Processing command...', 1000);
      }

      const result = await commandRouter.dispatch(command, {
        terminal: xtermRef.current,
        printer
      });

      // --- TEMPORARY DEBUG ---
      if (xtermRef.current) {
        xtermRef.current.write(`[DEBUG] Dispatch returned. Success: ${result.success}, Output present: ${!!result.output}, Error present: ${!!result.error}\r\n`);
      } else {
        console.error("[DEBUG] xtermRef.current is NULL after dispatch");
      }
      // --- END TEMPORARY DEBUG ---
      
      if (result.output) {
        await formatCommandOutput(result, printer);
      }
      if (!result.success && result.error) {
        await printer.error(result.error);
      }
    } catch (error) {
      // --- TEMPORARY DEBUG ---
      if (xtermRef.current) {
        xtermRef.current.write(`[DEBUG] CAUGHT ERROR: ${String(error)}\r\n`);
      } else {
        console.error("[DEBUG] xtermRef.current is NULL in CATCH block of handleCommand", error);
      }
      // --- END TEMPORARY DEBUG ---
      const errorPrinter = createPrinter({ // Create a new printer for the catch block
        write: writeToTerminal,
        clear: () => xtermRef.current?.clear()
      });
      await errorPrinter.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
      // --- TEMPORARY DEBUG ---
      if (xtermRef.current) {
        // xtermRef.current.write(`[DEBUG] In finally block. Writing prompt.\r\n`); // This might be too noisy
      } else {
         console.error("[DEBUG] xtermRef.current is NULL in FINALLY block of handleCommand");
      }
      // --- END TEMPORARY DEBUG ---
      writePrompt();
      setCurrentLine('');
      setHistoryIndex(-1);
      setTempCommand('');
    }
  };

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
    console.log(`[DEBUG_KEYPRESS] handleKeyPress called. Key: "${ev.key}", Ctrl: ${ev.ctrlKey}, Alt: ${ev.altKey}, Meta: ${ev.metaKey}`);
    const term = xtermRef.current;

    console.log(`[DEBUG_KEYPRESS] Before guard: term exists? ${!!term}, isProcessing? ${isProcessing}`);
    if (!term || isProcessing) {
      console.log(`[DEBUG_KEYPRESS] Guard prevented further execution. term: ${term}, isProcessing: ${isProcessing}`);
      return;
    }

    switch (ev.key) {
      case 'Enter':
        console.log('[DEBUG_KEYPRESS] "Enter" key detected.');
        ev.preventDefault();
        writeToTerminal(''); // Echo newline visually in terminal

        console.log(`[DEBUG_KEYPRESS] Current line before trim: "${currentLine}"`);
        if (currentLine.trim().length > 0) { // Only process if there's a command
          console.log(`[DEBUG_KEYPRESS] Non-empty command: "${currentLine.trim()}". Calling handleCommand.`);
          handleCommand(currentLine);
        } else {
          console.log('[DEBUG_KEYPRESS] Empty command. Writing new prompt.');
          // If the line is empty, just show a new prompt without processing
          setCurrentLine('');
          setHistoryIndex(-1);
          setTempCommand('');
          writePrompt();
        }
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
    console.log('[DEBUG_EFFECT] useEffect run started. welcomeMessage:', welcomeMessage);

    if (!terminalRef.current) {
      console.log('[DEBUG_EFFECT] terminalRef.current (div) is NULL, returning.');
      return;
    }
    console.log('[DEBUG_EFFECT] terminalRef.current (div) exists.');

    // Initialize xterm with enhanced theme
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block', // Ensure block cursor
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: '#0a0a0a', // Dark background
        foreground: '#ffffff', // White text
        cursor: '#00ff00',     // Green cursor
        cursorAccent: '#000000', // Background of the cursor character (black for green char)
        selection: 'rgba(255, 255, 255, 0.3)', // Light selection
        black: '#000000',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#f5c945', // Brighter yellow
        blue: '#74c0fc',
        magenta: '#f06292',
        cyan: '#4dd0e1',
        white: '#ffffff',
        brightBlack: '#686868',
        brightRed: '#ff8a80',
        brightGreen: '#69f0ae',
        brightYellow: '#ffee58', // Brighter yellow
        brightBlue: '#82b1ff',
        brightMagenta: '#ff80ab',
        brightCyan: '#84ffff',
        brightWhite: '#ffffff'
      },
      allowTransparency: true // If you want to use background from CSS
    });
    console.log('[DEBUG_EFFECT] XTerm instance created.');

    // Initialize fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    console.log('[DEBUG_EFFECT] FitAddon loaded.');

    // Open terminal
    try {
      term.open(terminalRef.current);
      console.log('[DEBUG_EFFECT] term.open() called successfully.');
    } catch (e) {
      console.error('[DEBUG_EFFECT] Error calling term.open():', e);
      return; // Stop if term.open fails
    }


    // Initial fit, possibly defer slightly to ensure layout is stable
    requestAnimationFrame(() => {
      if (fitAddonRef.current) { // Check if still mounted
         fitAddonRef.current.fit();
         console.log('[DEBUG_EFFECT] fitAddon.fit() called in requestAnimationFrame.');
      } else {
        console.log('[DEBUG_EFFECT] fitAddonRef.current is NULL in requestAnimationFrame.');
      }
    });

    // Store references
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    console.log('[DEBUG_EFFECT] xtermRef.current and fitAddonRef.current assigned.');
    if (xtermRef.current) {
      console.log('[DEBUG_EFFECT] xtermRef.current is now an XTerm object.');
    } else {
      console.error('[DEBUG_EFFECT] xtermRef.current is STILL NULL after assignment attempt.');
    }


    // Set up event listeners
    console.log('[DEBUG_EFFECT] Setting up term.onKey listener...');
    term.onKey(({ key, domEvent }) => {
      // console.log('[DEBUG_EFFECT] term.onKey fired. Key:', key); // This might be too noisy for every key
      handleKeyPress(key, domEvent);
    });
    console.log('[DEBUG_EFFECT] term.onKey listener SET.');

    // Enhanced welcome message with colors
    const printer = createPrinter({
      write: writeToTerminal,
      clear: () => { if(xtermRef.current) xtermRef.current.clear(); }
    });

    const showWelcome = async () => {
      console.log('[DEBUG_EFFECT] showWelcome() called.');
      const stackersAscii = [ // Restored variable name and content
        "  _________ __             __      __                     ",
        " /   _____//  |______ ____ |  | ___/  |_  ____   ____ ___ ",
        " \\_____  \\\\   __\\__  \\\\__  \\|  |/    \\   __\\/ __ \\ /    \\\\  \\",
        " /        \\|  |  / __ \\_/ __ \\|  |   |  ||  | \\  ___/|   |  \\/ __ \\",
        "/_______  /|__| (____  (____  /__|___|  /|__|  \\___  >___|  (____  /",
        "        \\/            \\/     \\/        \\/           \\/     \\/     \\/ "
      ];

      const titlePadding = ' '.repeat(Math.max(0, Math.floor((80 - stackersAscii[0].length) / 2)));
      const originalBorderLength = stackersAscii[0].length + 0;

      await printer.print('🚀' + '═'.repeat(76) + '🚀', { color: 'blue', style: 'bold' });
      for (const line of stackersAscii) {
        await printer.print(titlePadding + line, {
          color: 'blue',
          style: 'bold',
          typing: false,
        });
      }
      await printer.print('🚀' + '═'.repeat(76) + '🚀', { color: 'blue', style: 'bold' });

      const subtitle = "Your Onchain CLI Experience";
      const subtitlePadding = ' '.repeat(Math.max(0, Math.floor((80 - subtitle.length) / 2)));
      await printer.print(subtitlePadding + subtitle, {
        color: 'cyan',
        style: 'bold',
        typing: true,
        typingSpeed: 30
      });
      await printer.print('', { newLine: true });
      
      await printer.info(welcomeMessage, true);
      await printer.print('');
      await printer.print('💡 Quick Start Commands:', { color: 'yellow', style: 'bold' });
      await printer.print('  📚 tutorials        - Interactive learning guides');
      await printer.print('  💰 wallet connect   - Connect your Web3 wallet');
      await printer.print('  📊 wallet status    - Check current wallet status');
      await printer.print('  📋 help             - Show all available commands');
      await printer.print('  🔗 alias            - Create command shortcuts');
      await printer.print('  🎬 script           - Automate command sequences');
      await printer.print('');
      writePrompt();
      console.log('[DEBUG_EFFECT] showWelcome() finished.');
    };

    showWelcome();

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);
    console.log('[DEBUG_EFFECT] Resize listener added.');

    // Cleanup
    return () => {
      console.log('[DEBUG_EFFECT] useEffect cleanup function running.');
      window.removeEventListener('resize', handleResize);
      console.log('[DEBUG_EFFECT] Resize listener removed.');
      if (xtermRef.current) {
        console.log('[DEBUG_EFFECT] Disposing xtermRef.current.');
        xtermRef.current.dispose();
        xtermRef.current = null; // Explicitly set to null
        console.log('[DEBUG_EFFECT] xtermRef.current disposed and nulled.');
      } else {
        console.log('[DEBUG_EFFECT] xtermRef.current was already null in cleanup.');
      }
      if (fitAddonRef.current) {
        // fitAddon does not have a dispose method. Nullifying the ref is enough.
        fitAddonRef.current = null;
        console.log('[DEBUG_EFFECT] fitAddonRef.current nulled.');
      }
    };
  }, [welcomeMessage]);

  // Update prompt when wallet connection changes
  useEffect(() => {
    if (xtermRef.current && !isProcessing && currentLine === '') { // Only rewrite prompt if not processing and line is empty
      // This logic might need refinement to avoid disrupting user input
      // For now, let's ensure prompt is updated after command execution or initial load.
      // The prompt is naturally rewritten after each command in handleCommand's finally block.
      // And initially by showWelcome.
    }
  }, [walletContext.isConnected, walletContext.address, isProcessing, currentLine]); // Added dependencies

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
        // DEBUG style removed: style={{ border: '1px solid red', minHeight: '100px' }}
      />
    </div>
  )
}

export default Terminal