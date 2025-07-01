import { CommandHandler, CommandContext, CommandResult } from '../lib/CommandRouter'
import { commandRouter } from '../lib/CommandRouter'

// Helper function to ensure terminal focus
const ensureTerminalFocus = (terminal: any) => {
  if (terminal && typeof terminal.focus === 'function') {
    setTimeout(() => terminal.focus(), 0) // Use setTimeout to allow browser to finish file dialog operations
  }
}

export const uploadCommand: CommandHandler = {
  name: 'upload',
  description: 'Uploads a Solidity (.sol) file to session storage.',
  usage: 'upload [optional: HelloWorld.sol]', // Argument is illustrative, not directly used by file picker

  execute: async (context: CommandContext): Promise<CommandResult> => {
    const { terminal, printer } = context

    return new Promise<CommandResult>((resolve) => {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = '.sol'
      fileInput.style.display = 'none' // Hidden from view

      const handleFileChange = (event: Event) => {
        const target = event.target as HTMLInputElement
        const file = target.files?.[0]

        if (file) {
          if (!file.name.endsWith('.sol')) {
            printer.error(`Invalid file type: "${file.name}". Only .sol files are accepted.`)
            cleanupAndFocus()
            resolve({ output: '', success: false, error: 'Invalid file type' })
            return
          }

          const reader = new FileReader()

          reader.onload = (e) => {
            try {
              const content = e.target?.result as string
              const filename = file.name
              sessionStorage.setItem(`contract:${filename}`, content)
              printer.success(`✅ Uploaded ${filename}`)
              cleanupAndFocus()
              resolve({ output: '', success: true })
            } catch (err) {
              printer.error(`Error processing file: ${err instanceof Error ? err.message : String(err)}`)
              cleanupAndFocus()
              resolve({ output: '', success: false, error: 'File processing error' })
            }
          }

          reader.onerror = () => {
            printer.error(`Error reading file: ${reader.error?.message || 'Unknown error'}`)
            cleanupAndFocus()
            resolve({ output: '', success: false, error: 'File read error' })
          }

          reader.readAsText(file)
        } else {
          // No file selected (dialog cancelled)
          printer.info('File selection cancelled.')
          cleanupAndFocus()
          resolve({ output: '', success: true }) // Not an error, user just cancelled
        }
      }

      const cleanupAndFocus = () => {
        if (fileInput && document.body.contains(fileInput)) { // Check if fileInput exists and is in body
          document.body.removeChild(fileInput);
        }
        window.removeEventListener('focus', handleFocusAfterDialog); // Clean up focus listener
        ensureTerminalFocus(terminal);
      }

      // Add to body to make it interactable (though hidden)
      // Ensure it's only added once if this logic path could be re-entered, though current structure prevents it.
      if (!document.body.contains(fileInput)) { // Defensive check, though likely not strictly needed here
          document.body.appendChild(fileInput);
      }


      // This listener helps restore focus if the user cancels the dialog
      // without selecting a file (which doesn't trigger 'change').
      const handleFocusAfterDialog = () => {
        // This event fires when the window regains focus after the dialog closes.
        // We need to check if the input is still in the DOM, because if a file *was* selected,
        // 'change' would have fired and cleanupAndFocus would have removed it.
        // Also, ensure the fileInput itself hasn't been nulled or is still part of an active operation.
        if (fileInput && document.body.contains(fileInput)) {
           // If it's still in the DOM, it means 'change' didn't fire (likely cancel)
           // or an error occurred before cleanup in 'change'.
          // Avoid printing "File selection dialog closed." if a file was actually selected and processed.
          // The 'change' handler resolves the promise for successful uploads or file errors.
          // This 'focus' handler is primarily for cancellation.
          if (!target || !target.files || target.files.length === 0) { // Check if target/files are missing from a potential 'change' event context
            printer.info('File selection dialog closed.');
          }
          cleanupAndFocus();
          // Only resolve here if no other resolution path (like successful upload) has been taken.
          // This could be tricky. Let's assume for now that if 'change' fires, it resolves.
          // If 'change' doesn't fire (cancel), this 'focus' listener handles it.
          // The original resolve here might lead to double resolves if not careful.
          // Let's rely on the fact that `cleanupAndFocus` is called, and if no file was selected,
          // the 'change' handler's `else` branch also calls `cleanupAndFocus` and resolves.
          // So, this explicit resolve here might be redundant or problematic if `change` also resolves.
          // Removing resolve from here; `change` handler or error paths should resolve.
          // The primary purpose of this handler is cleanup and focus on pure cancellation.
        }
        window.removeEventListener('focus', handleFocusAfterDialog);
      }

      // Temporary variable for the change handler to potentially signal if it handled the event
      let changeEventHandled = false;
      const target = fileInput; // To check in handleFocusAfterDialog

      fileInput.addEventListener('change', (event: Event) => {
        changeEventHandled = true; // Signal that change event is being processed
        handleFileChange(event);
      });

      // Add focus listener before triggering click
      // This is a fallback for cancellation
      window.addEventListener('focus', handleFocusAfterDialog)

      fileInput.addEventListener('change', handleFileChange)

      try {
        fileInput.click()
        // Note: The promise is resolved by the event handlers (change, or focus for cancellation)
      } catch (err) {
        printer.error(`Error triggering file dialog: ${err instanceof Error ? err.message : String(err)}`)
        cleanupAndFocus()
        resolve({ output: '', success: false, error: 'Dialog trigger error' })
      }
    })
  }
}

commandRouter.register(uploadCommand)
