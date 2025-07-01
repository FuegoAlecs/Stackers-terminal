// Import all commands to ensure they are registered
import './help'
import './clear'
import './echo'
import './date'
import './call'
import './write'
import './gasEstimate'
import './simulate'
import './smartWallet'
import './whoami'
import './pwd'
import './ls'
import './history'
import './alias'
import './unalias'
import './wallet'
import './alchemy'
import './compile'
import './deploy'
import './decode'
import './logs'
import './script'
import './session'
import './tutorials'
import './upload' // Add new upload command
import './lsuploads' // Add new lsuploads command
import './compilefromstorage' // Add new compilefromstorage command
import './deployfromstorage' // Add new deployfromstorage command

// Export the command router for use in components
export { commandRouter } from '../lib/CommandRouter'
export type { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'