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

      const minContentWidths = headers.map((header, i) =>
        Math.max(
          (header || '').length,
          ...rows.map(row => (row[i] || '').length)
        )
      );

      const totalMinContentWidth = minContentWidths.reduce((sum, w) => sum + w, 0);
      const borderAndPadding = (numColumns * 3) + 1; // Approximate space for borders/padding per column

      if (totalMinContentWidth + borderAndPadding <= termWidth) {
        // If everything fits, use content widths, but allow cli-table3 to manage if some are small
        return minContentWidths.map(w => Math.max(w, 5)); // Ensure a minimum width
      }

      // Attempt to distribute widths, prioritizing columns with more content
      // This is a naive distribution. cli-table3's own wrapping might be better.
      // We can also return nulls to let cli-table3 decide automatically based on `wordWrap`.
      // For now, let cli-table3 handle it if it overflows.
      // Returning null for colWidths tells cli-table3 to auto-size.
      // However, we can provide initial hints based on content.

      // If we want to force fit, we'd need more complex logic.
      // For now, let's provide the minContentWidths and let cli-table3 wrap.
      // If termWidth is very small, even this might not be enough.
      // A more robust solution is to let cli-table3 do its thing with wordWrap=true
      // and only specify colWidths if you have specific requirements.
      // Let's try returning null to let cli-table3 do the heavy lifting with wordWrap.
      // This is generally better than trying to micromanage it here without full context.
      return headers.map(() => null); // Let cli-table3 auto-calculate based on content and wordWrap
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
      commandHeader?: string,
      commandHeader = 'COMMAND',
      descriptionHeader = 'DESCRIPTION',
      usageHeader = 'USAGE', // Retained for clarity, maps to a header name
      tableOptions: Table.TableConstructorOptions = {} // Allow passing cli-table3 options
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
    }
  }
  return printer
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