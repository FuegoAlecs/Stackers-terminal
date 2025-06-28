import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

export const lsCommand: CommandHandler = {
  name: 'ls',
  description: 'List directory contents',
  usage: 'ls [options]',
  aliases: ['dir'],
  
  execute: (context: CommandContext): CommandResult => {
    const { args } = context
    const showDetails = args.includes('-l') || args.includes('--long')
    const showHidden = args.includes('-a') || args.includes('--all')
    
    const files = [
      { name: 'documents', type: 'directory', size: '4096', date: '2024-01-15' },
      { name: 'downloads', type: 'directory', size: '4096', date: '2024-01-14' },
      { name: 'pictures', type: 'directory', size: '4096', date: '2024-01-13' },
      { name: 'videos', type: 'directory', size: '4096', date: '2024-01-12' },
      { name: 'readme.txt', type: 'file', size: '1024', date: '2024-01-11' },
      { name: 'config.json', type: 'file', size: '512', date: '2024-01-10' }
    ]
    
    const hiddenFiles = [
      { name: '.bashrc', type: 'file', size: '256', date: '2024-01-09' },
      { name: '.profile', type: 'file', size: '128', date: '2024-01-08' }
    ]
    
    let allFiles = [...files]
    if (showHidden) {
      allFiles = [...files, ...hiddenFiles]
    }
    
    if (showDetails) {
      const output = allFiles
        .map(file => {
          const type = file.type === 'directory' ? 'd' : '-'
          const permissions = file.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--'
          const size = file.size.padStart(8)
          return `${type}${permissions} 1 user user ${size} ${file.date} ${file.name}`
        })
        .join('\n')
      
      return { output, success: true }
    } else {
      const output = allFiles
        .map(file => file.name)
        .join('  ')
      
      return { output, success: true }
    }
  }
}

commandRouter.register(lsCommand)