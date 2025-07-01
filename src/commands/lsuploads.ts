import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const lsUploadsCommand: CommandHandler = {
  name: 'lsuploads',
  description: 'Lists uploaded contracts currently stored in this session.',
  usage: 'lsuploads',

  execute: (context: CommandContext): CommandResult => {
    const { printer } = context
    const contractFilenames: string[] = []

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith('contract:')) {
        contractFilenames.push(key.substring('contract:'.length))
      }
    }

    if (contractFilenames.length > 0) {
      let output = 'Uploaded contracts in current session:\n'
      contractFilenames.forEach(filename => {
        output += `  - ${filename}\n`
      })
      printer.print(output)
    } else {
      printer.info('No contracts found in the current session. Use "upload" to add some.')
    }

    return { output: '', success: true } // Command output is handled by printer directly
  }
}

commandRouter.register(lsUploadsCommand)
