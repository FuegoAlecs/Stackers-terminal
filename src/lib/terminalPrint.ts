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
  // Ensure write method specifies use of \r\n for new lines via its implementation in Terminal.tsx
  write: (text: string, newLine?: boolean) => void;
  clear: () => void;
  getDimensions: () => { cols: number; rows: number };
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
        // typeText will call terminal.write, which should handle \r\n
        await typeText(terminal, formattedText, typingSpeed, newLine);
      } else {
        // terminal.write (from Terminal.tsx) is expected to handle \r\n if newLine is true
        terminal.write(formattedText, newLine);
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
        const frame = frames[frameIndex % frames.length];
        // Ensure \r is used for carriage return, and terminal.write handles final newLine if any
        terminal.write(`\r${frame} ${text}`, false); // false for newLine, as we are overwriting the line
        frameIndex++;
      }, 100);

      await sleep(duration);
      clearInterval(interval);
      // Ensure final line is written correctly with \r\n if newLine is true
      terminal.write(`\r✅ ${text}`, true); // true for newLine to move to next line after completion
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
      const sanitizedHeaders = headers.map(h => String(h ?? '')); // Keep this
      const sanitizedRows = rows.map(row => row.map(cell => String(cell ?? ''))); // Keep this
      // The duplicate declarations of cols, sanitizedHeaders, and sanitizedRows were here. Removed them.

      const calculatedColWidths = tableOptions.colWidths || this.calculateColWidths(sanitizedHeaders, sanitizedRows, cols);

      const cliTable = new Table({
        head: sanitizedHeaders,
        colAligns: sanitizedHeaders.map(() => 'left'),
        wordWrap: true, // cli-table3 handles word wrapping
        wrapOnWordBoundary: true, // Prefer wrapping at word boundaries
        ...tableOptions,
        colWidths: calculatedColWidths,
        style: {
          head: ['blue', 'bold'],
          border: ['blue'],
          compact: tableOptions.style?.compact === true, // Respect user's compact option
          ...tableOptions.style,
        },
      });

      cliTable.push(...sanitizedRows);
      const tableString = cliTable.toString();

      // Output table string line by line. terminal.write (from Terminal.tsx) handles \r\n.
      // cli-table3 already includes \n in its output.
      // We pass `true` for newLine to ensure each line from the table starts on a new terminal line.
      tableString.split('\n').forEach(line => {
        terminal.write(line, true);
      });
      // No need for an extra blank line here unless specifically desired for all tables.
    },

    /**
     * Calculate column widths trying to fit into terminal width.
     * This helper function attempts to distribute column widths intelligently.
     */
    calculateColWidths: function(headers: string[], rows: string[][], termWidth: number): number[] {
      const numColumns = headers.length;
      if (numColumns === 0) return [];

      const MIN_COL_WIDTH = 10; // Minimum practical width for a column with some content + padding
      const COLUMN_PADDING_CHARS = 3; // For `| value ` or ` value |` (space + border + space)

      // Calculate the maximum width needed for each column based on its content
      const contentWidths = headers.map((header, i) => {
        const headerLen = stripAnsi(header || '').length;
        const maxRowLen = Math.max(0, ...rows.map(row => stripAnsi(row[i] || '').length));
        return Math.max(headerLen, maxRowLen);
      });

      // Total width available for cell content (excluding padding/borders)
      const availableWidthForContent = termWidth - (numColumns * COLUMN_PADDING_CHARS) -1; // -1 for the final border

      if (availableWidthForContent <= numColumns * MIN_COL_WIDTH) {
        // Not enough space for even minimal columns, distribute what's available or return min widths.
        // cli-table3's wordWrap will have to do heavy lifting.
        const fallbackWidth = Math.max(1, Math.floor(availableWidthForContent / numColumns));
        return headers.map(() => Math.max(MIN_COL_WIDTH, fallbackWidth));
      }

      let allocatedWidths = contentWidths.map(w => Math.max(w, MIN_COL_WIDTH));
      let currentTotalContentWidth = allocatedWidths.reduce((sum, w) => sum + w, 0);

      // If total content width is too large, shrink proportionally
      if (currentTotalContentWidth > availableWidthForContent) {
        const overflow = currentTotalContentWidth - availableWidthForContent;
        let totalReducibleAmount = 0;
        allocatedWidths.forEach(w => {
          if (w > MIN_COL_WIDTH) {
            totalReducibleAmount += (w - MIN_COL_WIDTH);
          }
        });

        if (totalReducibleAmount > 0) {
          for (let i = 0; i < allocatedWidths.length; i++) {
            if (allocatedWidths[i] > MIN_COL_WIDTH) {
              const reductionRatio = (allocatedWidths[i] - MIN_COL_WIDTH) / totalReducibleAmount;
              const reduction = Math.floor(overflow * reductionRatio);
              allocatedWidths[i] = Math.max(MIN_COL_WIDTH, allocatedWidths[i] - reduction);
            }
          }
        }
        // Recalculate, if still overflowing due to flooring, assign remaining to MIN_COL_WIDTH or distribute evenly
        currentTotalContentWidth = allocatedWidths.reduce((sum, w) => sum + w, 0);
        if (currentTotalContentWidth > availableWidthForContent) {
             const newFallbackWidth = Math.max(1, Math.floor(availableWidthForContent / numColumns));
             return headers.map(() => Math.max(MIN_COL_WIDTH, newFallbackWidth));
        }

      }
      // If total content width is smaller, distribute slack (optional, cli-table3 might handle this well)
      // For now, let's return the calculated or shrunk widths.
      // Ensure no width is less than MIN_COL_WIDTH.
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
        // Calculate max width for the value string on the first line
        const firstLineValueMaxWidth = cols - indentString.length - actualKeyWidth - separator.length -1; // -1 for cursor/safety

        const wrappedValueLines = wordWrap(valueString, firstLineValueMaxWidth > 0 ? firstLineValueMaxWidth : cols - indentString.length -1);

        // Print the key part (styled) without a new line
        await this.print(`${indentString}${item.key.padEnd(actualKeyWidth)}`, { ...keyStyle, newLine: false });
        // Print the separator and the first line of the value
        await this.print(`${separator}${wrappedValueLines[0] || ''}`, { ...valueStyle, newLine: true });


        // Print subsequent wrapped lines of the value, indented appropriately
        const subsequentLineIndent = ' '.repeat(indentString.length + actualKeyWidth + separator.length);
        const subsequentLineMaxWidth = cols - subsequentLineIndent.length -1;

        for (let i = 1; i < wrappedValueLines.length; i++) {
           const reWrappedSubsequentLines = wordWrap(wrappedValueLines[i], subsequentLineMaxWidth > 0 ? subsequentLineMaxWidth : 1);
           for (const subLine of reWrappedSubsequentLines) {
            await this.print(`${subsequentLineIndent}${subLine}`, valueStyle);
           }
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
    // terminal.write (from Terminal.tsx) handles \r\n if newLine is true (but here it's false)
    terminal.write(text[i], false);
    await sleep(speed);
  }
  if (newLine) {
    // terminal.write (from Terminal.tsx) handles \r\n if newLine is true
    terminal.write('', true); // This will effectively write \r\n
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
 * Simple word wrapping utility. Preserves ANSI codes.
 * Wraps text to a specified maximum width.
 */
function wordWrap(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text]; // Cannot wrap to zero or negative width

  const lines: string[] = [];
  let currentLine = "";

  // ANSI escape codes can be complex. This regex is a common one.
  const ansiEscapeRegex = /\x1b\[[0-9;]*[mGKH]/g;
  const stripAnsi = (str: string) => str.replace(ansiEscapeRegex, '');

  // Split the text by newlines first to handle existing line breaks.
  const inputLines = text.split('\n');

  for (const inputLine of inputLines) {
    // If a line is empty, preserve it as an empty line in the output.
    if (inputLine === "") {
      lines.push("");
      currentLine = ""; // Reset currentLine for the next paragraph/block
      continue;
    }

    // Process words in the current input line
    // Using a regex to split by space while preserving spaces allows for reconstruction.
    // This also helps in handling sequences of spaces.
    const wordsAndSpaces = inputLine.split(/(\s+)/);
    let tempLine = currentLine; // Use tempLine to build up the line before adding to currentLine

    for (const part of wordsAndSpaces) {
      if (part === "") continue; // Skip empty parts resulting from split

      const isSpace = /^\s+$/.test(part);
      const visiblePartLength = stripAnsi(part).length;
      const visibleTempLineLength = stripAnsi(tempLine).length;

      if (visibleTempLineLength + visiblePartLength > maxWidth && visibleTempLineLength > 0) {
        // Line would exceed maxWidth. Push current tempLine.
        lines.push(tempLine.trimEnd());
        // Start new line. If 'part' is not space, it's the first word of the new line.
        // If 'part' is space, it might be leading indentation for the new line if preserved,
        // or trimmed if we always trim leading space on new wrapped lines.
        tempLine = isSpace ? "" : part; // Or handle leading spaces more explicitly if needed
      } else {
        // Part fits, add to tempLine
        tempLine += part;
      }
    }
    // Add any remaining part of tempLine to lines
    if (tempLine.length > 0) {
      lines.push(tempLine.trimEnd());
    }
    currentLine = ""; // Reset for next inputLine, ensuring it doesn't carry over
  }

  // If the original text was empty or only newlines, lines might be empty.
  // Ensure at least one empty string if input was empty, or preserve newline structure.
  if (text.length > 0 && lines.length === 0 && currentLine === "") {
    lines.push("");
  } else if (currentLine.length > 0) { // Catch any final segment not pushed
    lines.push(currentLine.trimEnd());
  }

  // Post-processing: trim leading spaces from lines that were wrapped,
  // unless they are intentional indentations (which this simple version doesn't distinguish well).
  // For now, a simple trimStart on each line is reasonable.
  return lines.map(l => l.trimStart());
}

// Helper function to strip ANSI codes (already defined in calculateColWidths scope, ensure it's accessible or duplicated)
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*[mGKH]/g, '');


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