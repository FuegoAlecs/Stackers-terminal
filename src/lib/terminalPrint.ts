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
export function createPrinter(terminal: TerminalPrinter) {
  return {
    /**
     * Print text with formatting options
     */
    print: async (text: string, options: PrintOptions = {}) => {
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
    success: async (text: string, typing = false) => {
      await printer.print(text, { // Changed this.print to printer.print
        color: 'green',
        icon: ICONS.success,
        typing
      })
    },

    /**
     * Print error message
     */
    error: async (text: string, typing = false) => {
      await printer.print(text, { // Changed this.print to printer.print
        color: 'red',
        icon: ICONS.error,
        typing
      })
    },

    /**
     * Print warning message
     */
    warning: async (text: string, typing = false) => {
      await printer.print(text, { // Changed this.print to printer.print
        color: 'yellow',
        icon: ICONS.warning,
        typing
      })
    },

    /**
     * Print info message
     */
    info: async (text: string, typing = false) => {
      await printer.print(text, { // Changed this.print to printer.print
        color: 'cyan',
        icon: ICONS.info,
        typing
      })
    },

    /**
     * Print header with styling
     */
    header: async (text: string, typing = false) => {
      await printer.print('', { newLine: true }) // Changed this.print to printer.print
      await printer.print('═'.repeat(text.length + 4), { color: 'blue' }) // Changed this.print to printer.print
      await printer.print(`  ${text}  `, {  // Changed this.print to printer.print
        color: 'blue', 
        style: 'bold',
        typing
      })
      await printer.print('═'.repeat(text.length + 4), { color: 'blue' }) // Changed this.print to printer.print
      await printer.print('', { newLine: true }) // Changed this.print to printer.print
    },

    /**
     * Print section divider
     */
    divider: async (text?: string) => {
      if (text) {
        await printer.print(`\n── ${text} ──`, { color: 'gray' }) // Changed this.print to printer.print
      } else {
        await printer.print('─'.repeat(50), { color: 'gray' }) // Changed this.print to printer.print
      }
    },

    /**
     * Print loading spinner
     */
    loading: async (text: string, duration = 2000) => {
      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      let frameIndex = 0
      
      const interval = setInterval(() => {
        const frame = frames[frameIndex % frames.length]
        terminal.write(`\r${frame} ${text}`, false) // terminal.write is fine, not using this.print
        frameIndex++
      }, 100)

      await sleep(duration)
      clearInterval(interval)
      terminal.write(`\r✅ ${text}`, true) // terminal.write is fine
    },

    /**
     * Print progress bar
     */
    progress: async (text: string, steps: number, currentStep: number) => {
      const percentage = Math.round((currentStep / steps) * 100)
      const barLength = 20
      const filledLength = Math.round((percentage / 100) * barLength)
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
      
      await printer.print(`${text} [${bar}] ${percentage}%`, { // Changed this.print to printer.print
        color: percentage === 100 ? 'green' : 'blue',
        newLine: true
      })
    },

    /**
     * Print code block
     */
    code: async (code: string, language = '') => {
      await printer.print(`\n${language ? `${language}:` : 'Code:'}`, {  // Changed this.print to printer.print
        color: 'gray',
        style: 'bold'
      })
      await printer.print('```', { color: 'gray' }) // Changed this.print to printer.print
      await printer.print(code, {  // Changed this.print to printer.print
        color: 'cyan',
        style: 'italic'
      })
      await printer.print('```', { color: 'gray' }) // Changed this.print to printer.print
    },

    /**
     * Print table
     */
    table: async (headers: string[], rows: string[][]) => {
      const colWidths = headers.map((header, i) => 
        Math.max(header.length, ...rows.map(row => (row[i] || '').length))
      )

      // Header
      const headerRow = headers.map((header, i) => 
        header.padEnd(colWidths[i])
      ).join(' │ ')
      
      await printer.print(`┌${'─'.repeat(headerRow.length)}┐`, { color: 'blue' }) // Changed this.print to printer.print
      await printer.print(`│ ${headerRow} │`, { color: 'blue', style: 'bold' }) // Changed this.print to printer.print
      await printer.print(`├${'─'.repeat(headerRow.length)}┤`, { color: 'blue' }) // Changed this.print to printer.print

      // Rows
      for (const row of rows) {
        const formattedRow = row.map((cell, i) => 
          (cell || '').padEnd(colWidths[i])
        ).join(' │ ')
        await printer.print(`│ ${formattedRow} │`, { color: 'white' }) // Changed this.print to printer.print
      }

      await printer.print(`└${'─'.repeat(headerRow.length)}┘`, { color: 'blue' }) // Changed this.print to printer.print
    },

    /**
     * Print step in a process
     */
    step: async (stepNumber: number, totalSteps: number, text: string, typing = false) => {
      const stepText = `[${stepNumber}/${totalSteps}]`
      await printer.print(`${stepText} ${text}`, { // Changed this.print to printer.print
        color: 'blue',
        style: 'bold',
        icon: ICONS.gear,
        typing
      })
    },

    /**
     * Clear terminal
     */
    clear: () => {
      terminal.clear() // terminal.clear is fine
    }
  }
  // Store the printer object itself to be used by its methods
  const printer = {
    print: async (text: string, options: PrintOptions = {}) => {
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

      if (icon) {
        formattedText += icon + ' '
      }
      if (prefix) {
        formattedText += prefix + ' '
      }
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
      if (color || background || style) {
        formattedText += STYLES.reset
      }

      if (typing) {
        await typeText(terminal, formattedText, typingSpeed, newLine)
      } else {
        terminal.write(formattedText, newLine)
      }
    },
    success: async (text: string, typing = false) => {
      await printer.print(text, {
        color: 'green',
        icon: ICONS.success,
        typing
      })
    },
    error: async (text: string, typing = false) => {
      await printer.print(text, {
        color: 'red',
        icon: ICONS.error,
        typing
      })
    },
    warning: async (text: string, typing = false) => {
      await printer.print(text, {
        color: 'yellow',
        icon: ICONS.warning,
        typing
      })
    },
    info: async (text: string, typing = false) => {
      await printer.print(text, {
        color: 'cyan',
        icon: ICONS.info,
        typing
      })
    },
    header: async (text: string, typing = false) => {
      await printer.print('', { newLine: true })
      await printer.print('═'.repeat(text.length + 4), { color: 'blue' })
      await printer.print(`  ${text}  `, {
        color: 'blue',
        style: 'bold',
        typing
      })
      await printer.print('═'.repeat(text.length + 4), { color: 'blue' })
      await printer.print('', { newLine: true })
    },
    divider: async (text?: string) => {
      if (text) {
        await printer.print(`\n── ${text} ──`, { color: 'gray' })
      } else {
        await printer.print('─'.repeat(50), { color: 'gray' })
      }
    },
    loading: async (text: string, duration = 2000) => {
      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      let frameIndex = 0
      const interval = setInterval(() => {
        const frame = frames[frameIndex % frames.length]
        terminal.write(`\r${frame} ${text}`, false)
        frameIndex++
      }, 100)
      await sleep(duration)
      clearInterval(interval)
      terminal.write(`\r✅ ${text}`, true)
    },
    progress: async (text: string, steps: number, currentStep: number) => {
      const percentage = Math.round((currentStep / steps) * 100)
      const barLength = 20
      const filledLength = Math.round((percentage / 100) * barLength)
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
      await printer.print(`${text} [${bar}] ${percentage}%`, {
        color: percentage === 100 ? 'green' : 'blue',
        newLine: true
      })
    },
    code: async (code: string, language = '') => {
      await printer.print(`\n${language ? `${language}:` : 'Code:'}`, {
        color: 'gray',
        style: 'bold'
      })
      await printer.print('```', { color: 'gray' })
      await printer.print(code, {
        color: 'cyan',
        style: 'italic'
      })
      await printer.print('```', { color: 'gray' })
    },
    table: async (headers: string[], rows: string[][]) => {
      const colWidths = headers.map((header, i) =>
        Math.max(header.length, ...rows.map(row => (row[i] || '').length))
      )
      const headerRow = headers.map((header, i) => header.padEnd(colWidths[i])).join(' │ ')
      await printer.print(`┌${'─'.repeat(headerRow.length)}┐`, { color: 'blue' })
      await printer.print(`│ ${headerRow} │`, { color: 'blue', style: 'bold' })
      await printer.print(`├${'─'.repeat(headerRow.length)}┤`, { color: 'blue' })
      for (const row of rows) {
        const formattedRow = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' │ ')
        await printer.print(`│ ${formattedRow} │`, { color: 'white' })
      }
      await printer.print(`└${'─'.repeat(headerRow.length)}┘`, { color: 'blue' })
    },
    step: async (stepNumber: number, totalSteps: number, text: string, typing = false) => {
      const stepText = `[${stepNumber}/${totalSteps}]`
      await printer.print(`${stepText} ${text}`, {
        color: 'blue',
        style: 'bold',
        icon: ICONS.gear,
        typing
      })
    },
    clear: () => {
      terminal.clear()
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