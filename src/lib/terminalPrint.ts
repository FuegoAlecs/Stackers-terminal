export interface PrintOptions {
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'cyan' | 'white' | 'gray'
  background?: 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'cyan' | 'black'
  style?: 'bold' | 'dim' | 'italic' | 'underline'
  typing?: boolean
  typingSpeed?: number
  newLine?: boolean
  prefix?: string
  icon?: string
}

import Table from 'cli-table3';

// Duplicate PrintOptions interface removed. The first one is kept.

// Only one TerminalPrinter interface should exist. Keeping the one with getDimensions.
export interface TerminalPrinter {
  write: (text: string, newLine?: boolean) => void
  clear: () => void
  getDimensions: () => { cols: number; rows: number } // Added to get terminal dimensions
}

// ANSI color codes for xterm.js
const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  reset: '\x1b[0m'
}

const BACKGROUNDS = {
  red: '\x1b[41m',
  green: '\x1b[42m',
  yellow: '\x1b[43m',
  blue: '\x1b[44m',
  purple: '\x1b[45m',
  cyan: '\x1b[46m',
  black: '\x1b[40m'
}

const STYLES = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  reset: '\x1b[0m'
}

// Common icons for different message types
export const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  loading: '⏳',
  rocket: '🚀',
  fire: '🔥',
  star: '⭐',
  heart: '❤️',
  lightning: '⚡',
  gear: '⚙️',
  book: '📚',
  money: '💰',
  shield: '🛡️',
  key: '🔑',
  link: '🔗',
  chart: '📊',
  terminal: '💻',
  wallet: '👛',
  contract: '📜',
  gas: '⛽',
  block: '🧱',
  diamond: '💎'
}

/**
 * Create a reusable print function for terminal output
 */
export function createPrinter(terminal: TerminalPrinter) { // terminal: TerminalPrinter (includes getDimensions)
  const printer = {
    /**
     * Print text with formatting options
     */
    print: async function (text: string, options: PrintOptions = {}) {
      const {
        color,
        background,
        style,
        typing = false,
        typingSpeed = 30,
        newLine = true,
        prefix,
        icon
      } = options

      let formattedText = ''

      // Add icon if specified
      if (icon) {
        formattedText += icon + ' '
      }

      // Add prefix if specified
      if (prefix) {
        formattedText += prefix + ' '
      }

      // Apply styling
      if (style) {
        formattedText += STYLES[style]
      }

      if (background) {
        formattedText += BACKGROUNDS[background]
      }

      if (color) {
        formattedText += COLORS[color]
      }

      formattedText += text

      // Reset formatting
      if (color || background || style) {
        formattedText += STYLES.reset
      }

      if (typing) {
        await typeText(terminal, formattedText, typingSpeed, newLine)
      } else {
        terminal.write(formattedText, newLine)
      }
    },

    /**
     * Print success message
     */
    success: async function (text: string, typing = false) {
      await this.print(text, {
        color: 'green',
        icon: ICONS.success,
        typing
      })
    },

    /**
     * Print error message
     */
    error: async function (text: string, typing = false) {
      await this.print(text, {
        color: 'red',
        icon: ICONS.error,
        typing
      })
    },

    /**
     * Print warning message
     */
    warning: async function (text: string, typing = false) {
      await this.print(text, {
        color: 'yellow',
        icon: ICONS.warning,
        typing
      })
    },

    /**
     * Print info message
     */
    info: async function (text: string, typing = false) {
      await this.print(text, {
        color: 'cyan',
        icon: ICONS.info,
        typing
      })
    },

    /**
     * Print header with styling
     */
    header: async function (text: string, typing = false) {
      await this.print('', { newLine: true })
      await this.print('═'.repeat(text.length + 4), { color: 'blue' })
      await this.print(`  ${text}  `, {
        color: 'blue',
        style: 'bold',
        typing
      })
      await this.print('═'.repeat(text.length + 4), { color: 'blue' })
      await this.print('', { newLine: true })
    },

    /**
     * Print section divider
     */
    divider: async function (text?: string) {
      if (text) {
        await this.print(`\n── ${text} ──`, { color: 'gray' })
      } else {
        await this.print('─'.repeat(50), { color: 'gray' })
      }
    },

    /**
     * Print loading spinner
     */
    loading: async function (text: string, duration = 2000) {
      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      let frameIndex = 0
      
      // `this` is not relevant for terminal.write directly
      const interval = setInterval(() => {
        const frame = frames[frameIndex % frames.length]
        terminal.write(`\r${frame} ${text}`, false)
        frameIndex++
      }, 100)

      await sleep(duration)
      clearInterval(interval)
      terminal.write(`\r✅ ${text}`, true)
    },

    /**
     * Print progress bar
     */
    progress: async function (text: string, steps: number, currentStep: number) {
      const percentage = Math.round((currentStep / steps) * 100)
      const barLength = 20
      const filledLength = Math.round((percentage / 100) * barLength)
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
      
      await this.print(`${text} [${bar}] ${percentage}%`, {
        color: percentage === 100 ? 'green' : 'blue',
        newLine: true
      })
    },

    /**
     * Print code block
     */
    code: async function (codeText: string, language = '') { // Renamed 'code' param to 'codeText' to avoid conflict
      await this.print(`\n${language ? `${language}:` : 'Code:'}`, {
        color: 'gray',
        style: 'bold'
      })
      await this.print('```', { color: 'gray' })
      await this.print(codeText, { // Use 'codeText'
        color: 'cyan',
        style: 'italic'
      })
      await this.print('```', { color: 'gray' })
    },

    /**
     * Print table
     */
    table: async function (headers: string[], rows: string[][], tableOptions: Table.TableConstructorOptions = {}) {
      const { cols } = terminal.getDimensions();
      // Ensure headers and rows are arrays of strings, convert if necessary (e.g. null/undefined to '')
      const sanitizedHeaders = headers.map(h => String(h ?? ''));
      const sanitizedRows = rows.map(row => row.map(cell => String(cell ?? '')));

      const cliTable = new Table({
        head: sanitizedHeaders,
        colAligns: sanitizedHeaders.map(() => 'left'), // Default to left alignment
        wordWrap: true,
        wrapOnWordBoundary: true, // Changed to true for better readability
        ...tableOptions, // Allow overriding default options
        // Attempt to set reasonable column widths based on terminal size
        // This is a basic approach; more sophisticated logic might be needed
        colWidths: tableOptions.colWidths || this.calculateColWidths(sanitizedHeaders, sanitizedRows, cols),
        style: {
          head: ['blue', 'bold'], // Apply some default styling
          border: ['blue'],
          compact: false, // Use compact for less padding if needed, true by default with cli-table3
          ...tableOptions.style,
        },
      });

      cliTable.push(...sanitizedRows);
      const tableString = cliTable.toString();
      
      // cli-table3 output includes newlines, so print each line separately without adding extra newlines
      // or ensure the print function handles multi-line strings correctly.
      // The current print function adds \r\n if newLine is true (default).
      // We can split the table string and print each line.
      tableString.split('\n').forEach(line => {
        // We need to use terminal.write directly here or a version of this.print that doesn't add extra \r\n
        // For now, let's assume this.print handles it if newLine is false for subsequent lines.
        // However, cli-table3's output is already formatted with newlines.
        terminal.write(line, true); // Write line by line, ensuring each gets its own line.
      });
      // Add a final blank line for spacing after the table if desired
      // await this.print('', { newLine: true });
    },

    /**
     * Calculate column widths trying to fit into terminal width.
     * This is a helper that might need further refinement.
     */
    calculateColWidths: function(headers: string[], rows: string[][], termWidth: number): (number | null)[] {
      const numColumns = headers.length;
      if (numColumns === 0) return [];

      const MIN_COL_WIDTH = 5; // Minimum width for any column
      const COLUMN_PADDING = 3; // Characters per column for borders/padding like `| c |`

      // Calculate ideal width for each column based on content
      const idealWidths = headers.map((header, i) => {
        const headerLength = (header || '').length;
        const maxRowContentLength = Math.max(0, ...rows.map(row => (row[i] || '').length));
        return Math.max(headerLength, maxRowContentLength, MIN_COL_WIDTH);
      });

      const totalIdealContentWidth = idealWidths.reduce((sum, w) => sum + w, 0);
      const totalRequiredWidth = totalIdealContentWidth + (numColumns * COLUMN_PADDING) + 1; // +1 for the last border

      let allocatedWidths = [...idealWidths];

      if (totalRequiredWidth > termWidth) {
        // Not enough space, need to shrink columns
        const overflow = totalRequiredWidth - termWidth;
        let totalReducibleWidth = 0; // Sum of widths of columns that can be shrunk

        idealWidths.forEach(w => {
          if (w > MIN_COL_WIDTH) {
            totalReducibleWidth += (w - MIN_COL_WIDTH);
          }
        });

        if (totalReducibleWidth <= 0) { // Cannot shrink any further
          // All columns are at MIN_COL_WIDTH or less, distribute termWidth somewhat evenly
          // This is a fallback, cli-table3's wordWrap will be crucial here.
          const evenWidth = Math.max(MIN_COL_WIDTH, Math.floor((termWidth - (numColumns * COLUMN_PADDING) -1) / numColumns));
          return headers.map(() => evenWidth);
        }

        let currentOverflow = overflow;
        for (let i = 0; i < allocatedWidths.length; i++) {
          if (allocatedWidths[i] > MIN_COL_WIDTH) {
            const proportion = (allocatedWidths[i] - MIN_COL_WIDTH) / totalReducibleWidth;
            const reduction = Math.round(overflow * proportion);
            allocatedWidths[i] = Math.max(MIN_COL_WIDTH, allocatedWidths[i] - reduction);
            currentOverflow -= reduction; // Track remaining overflow to distribute if rounding caused issues
          }
        }
        // If there's still overflow due to rounding, try to remove it from widest columns
        // This part can be made more sophisticated if needed.
        // For now, the above proportional reduction is the primary mechanism.

      } else if (totalRequiredWidth < termWidth) {
        // Extra space available, distribute it.
        // For simplicity, we can let cli-table3 use the ideal widths and manage the extra space,
        // or proportionally increase them. Let's stick to ideal widths if they fit.
        // Or, distribute the slack.
        const slack = termWidth - totalRequiredWidth;
        let totalFlexibleWidth = idealWidths.reduce((sum, w) => sum + w, 0); // or based on some other metric
        if (totalFlexibleWidth > 0) {
            for (let i = 0; i < allocatedWidths.length; i++) {
                const proportion = allocatedWidths[i] / totalFlexibleWidth;
                allocatedWidths[i] += Math.floor(slack * proportion);
            }
        }
      }
      // Ensure final widths are at least MIN_COL_WIDTH
      return allocatedWidths.map(w => Math.max(w, MIN_COL_WIDTH));
    },

    /**
     * Print step in a process
     */
    step: async function (stepNumber: number, totalSteps: number, text: string, typing = false) {
      const stepText = `[${stepNumber}/${totalSteps}]`
      await this.print(`${stepText} ${text}`, {
        color: 'blue',
        style: 'bold',
        icon: ICONS.gear,
        typing
      })
    },

    /**
     * Clear terminal
     */
    clear: function () { // `this` is not relevant for terminal.clear directly
      terminal.clear()
    },

    /**
     * Formats and prints an array of help items as a table.
     */
    printHelpTable: async function (
      rows: HelpTableRow[],
      commandHeader = 'COMMAND',
      descriptionHeader = 'DESCRIPTION',
      usageHeader = 'USAGE',
      tableOptions: Table.TableConstructorOptions = {}
    ) {
      if (!rows || rows.length === 0) {
        await this.print('No commands to display.');
        return;
      }

      // Determine if 'usage' is present and should be displayed as a separate column or combined.
      // For simplicity with cli-table3, we can have distinct columns.
      const hasUsage = rows.some(row => typeof row.usage === 'string' && row.usage.length > 0);

      const headers = hasUsage
        ? [commandHeader, usageHeader, descriptionHeader]
        : [commandHeader, descriptionHeader];

      const tableRows = rows.map(row => {
        return hasUsage
          ? [row.command, row.usage || '', row.description]
          : [row.command, row.description];
      });

      // Default options for help table to make it compact and clean
      const defaultHelpTableOptions: Table.TableConstructorOptions = {
        chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
               , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
               , 'left': ' ' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
               , 'right': '' , 'right-mid': '' , 'middle': ' ' },
        style: {
          head: ['bold'], // Keep headers bold, no specific color by default here
          border: [], // No borders by default for help
          compact: true,
          'padding-left': 0,
          'padding-right': 2 // Add some padding between columns
        },
        // Let cli-table3 handle colWidths automatically for help tables, it's usually good for this.
        // colWidths: [null, null, null] or [null, null] based on hasUsage
        ...tableOptions // User can override these defaults
      };

      await this.table(headers, tableRows, defaultHelpTableOptions);
    }, // End of printHelpTable

    printKeyValues: async function (
      this: ReturnType<typeof createPrinter>, // Important for `this.print`
      data: Array<{ key: string; value: any }>,
      options: KeyValuePrintOptions = {}
    ): Promise<void> {
      const { cols } = terminal.getDimensions();
      const {
        indent = 0,
        keyStyle = { style: 'bold' }, // Default key style
        valueStyle = {},
        separator = ': '
      } = options;

      const indentString = ' '.repeat(indent);

      let actualKeyWidth = options.keyWidth || 0;
      if (!options.keyWidth) {
        data.forEach(item => {
          if (item.key.length > actualKeyWidth) {
            actualKeyWidth = item.key.length;
          }
        });
      }

      for (const item of data) {
        const keyPart = `${indentString}${item.key.padEnd(actualKeyWidth)}`;
        const valueString = String(item.value);

        const valueMaxWidth = cols - keyPart.length - separator.length -1; // -1 for safety/cursor

        const wrappedValueLines = wordWrap(valueString, valueMaxWidth > 0 ? valueMaxWidth : 1); // Ensure positive maxWidth

        // Print the key and the first line of the value
        await this.print(
          `${keyPart}${separator}${wrappedValueLines[0] || ''}`,
          { ...keyStyle, ...valueStyle } // Combine styles, valueStyle can override keyStyle for the value part if needed
                                        // Or, more simply, apply keyStyle only to keyPart and valueStyle to value
        );
        // A more precise styling would involve printing key and value parts separately if styles differ.
        // For now, let's assume a combined approach or rely on user passing specific options.
        // Corrected approach for distinct key/value styling:
        // await this.print(`${keyPart}`, { ...keyStyle, newLine: false });
        // await this.print(`${separator}${wrappedValueLines[0] || ''}`, { ...valueStyle, newLine: true });


        // Print subsequent wrapped lines of the value
        for (let i = 1; i < wrappedValueLines.length; i++) {
          await this.print(
            `${indentString}${' '.repeat(actualKeyWidth)}${separator.replace(/./g, ' ')}${wrappedValueLines[i]}`,
            valueStyle
          );
        }
      }
    }
  }; // End of printer object definition

  return printer as PrinterInstance; // Cast to PrinterInstance
}

/**
 * Type text character by character
 */
async function typeText(
  terminal: TerminalPrinter, 
  text: string, 
  speed: number, 
  newLine: boolean
): Promise<void> {
  for (let i = 0; i < text.length; i++) {
    terminal.write(text[i], false)
    await sleep(speed)
  }
  if (newLine) {
    terminal.write('', true)
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Format command output with consistent styling
 */
export function formatCommandOutput(
  result: { success: boolean; output: string; error?: string },
  printer: ReturnType<typeof createPrinter>
) {
  if (result.success) {
    // If the output is intended to be a table, it should have been handled by the command itself
    // using printer.table(). This function is for general output.
    return printer.print(result.output, { color: 'white' })
  } else {
    return printer.error(result.error || result.output)
  }
}

/**
 * Create animated banner
 */
export async function printBanner(
  printer: ReturnType<typeof createPrinter>,
  title: string,
  subtitle?: string
) {
  await printer.print('', { newLine: true })
  await printer.print('🚀 ' + '═'.repeat(title.length + 6) + ' 🚀', { 
    color: 'blue',
    style: 'bold'
  })
  await printer.print(`   ${title}   `, { 
    color: 'blue',
    style: 'bold',
    typing: true,
    typingSpeed: 50
  })
  if (subtitle) {
    await printer.print(`   ${subtitle}   `, { 
      color: 'cyan',
      typing: true,
      typingSpeed: 30
    })
  }
  await printer.print('🚀 ' + '═'.repeat(title.length + 6) + ' 🚀', { 
    color: 'blue',
    style: 'bold'
  })
  await printer.print('', { newLine: true })
}

// Interface for help table rows
export interface HelpTableRow {
  command: string;
  description: string;
  usage?: string; // Optional, can be combined with command or shown separately
}

// formatHelpTable function is removed as printHelpTable now uses printer.table directly.

/**
 * Simple word wrapping utility
 */
function wordWrap(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text]; // Avoid infinite loops or errors with no width
  const lines: string[] = [];
  let currentLine = '';

  // Strip ANSI codes for length calculation during wrapping, but keep them in the output.
  // This is a simplified ANSI stripper, might not cover all edge cases.
  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*[mGKH]/g, '');

  // Split by words, keeping track of original spacing to roughly preserve it.
  // This regex splits by space but also captures sequences of spaces.
  const words = text.split(/(\s+)/);

  for (const word of words) {
    if (word.match(/^\s+$/)) { // if it's just whitespace
      currentLine += word;
      continue;
    }
    const visibleWordLength = stripAnsi(word).length;
    const visibleLineLength = stripAnsi(currentLine).length;

    if (visibleLineLength + visibleWordLength > maxWidth && visibleLineLength > 0) {
      lines.push(currentLine.trimEnd()); // Trim trailing space from the completed line
      currentLine = word;
    } else {
      currentLine += word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine.trimEnd());
  }
  return lines.map(l => l.trimStart()); // Trim leading space from new lines
}

// Add printKeyValues to the printer object
export interface KeyValuePrintOptions {
  indent?: number;
  keyWidth?: number; // Explicit width for the key column
  valueStyle?: PrintOptions; // Style for the value part
  keyStyle?: PrintOptions; // Style for the key part (e.g., bold)
  separator?: string; // Default ": "
}

// Extend the return type of createPrinter to include printKeyValues
export type PrinterInstance = ReturnType<typeof createPrinter> & {
   printKeyValues: (data: Array<{ key: string; value: any }>, options?: KeyValuePrintOptions) => Promise<void>;
};


// Modify createPrinter to add printKeyValues
// (This requires changing how createPrinter is defined or its return type)
// For simplicity, I'll add it to the returned object directly.
// The type PrinterInstance above helps ensure TypeScript knows about it.
// The actual modification will be in the createPrinter's return block.