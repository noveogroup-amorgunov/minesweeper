/**
 * Error class for OPFS-related errors
 */
export class OPFSError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'OPFSError'
  }
}

/**
 * Check if OPFS is supported in current browser
 */
export function isOPFSSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'storage' in navigator
    && 'getDirectory' in navigator.storage
}

/**
 * Get OPFS root directory handle
 * @returns Promise<FileSystemDirectoryHandle>
 * @throws OPFSError if OPFS is not supported or access denied
 */
export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  if (!isOPFSSupported()) {
    throw new OPFSError('OPFS is not supported in this browser')
  }
  try {
    return navigator.storage.getDirectory()
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new OPFSError('Browser storage access denied', error)
    }
    throw new OPFSError('Failed to access OPFS', error)
  }
}

/**
 * Write data to a file in OPFS atomically
 * @param filename - Name of the file
 * @param data - Data to write as ArrayBuffer
 * @throws OPFSError on write failure
 */
export async function writeFile(filename: string, data: ArrayBuffer): Promise<void> {
  try {
    const root = await getOPFSRoot()
    const fileHandle = await root.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(data)
    await writable.close()
  }
  catch (error) {
    if (error instanceof OPFSError) {
      throw error
    }
    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError') {
        throw new OPFSError('Not enough storage space', error)
      }
    }
    throw new OPFSError(`Failed to write file: ${filename}`, error)
  }
}

/**
 * Read data from a file in OPFS
 * @param filename - Name of the file
 * @returns Promise<ArrayBuffer | null> - File contents or null if file doesn't exist
 * @throws OPFSError on read failure (except NotFoundError)
 */
export async function readFile(filename: string): Promise<ArrayBuffer | null> {
  try {
    const root = await getOPFSRoot()
    const fileHandle = await root.getFileHandle(filename)
    const file = await fileHandle.getFile()
    return file.arrayBuffer()
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return null
    }
    if (error instanceof OPFSError) {
      throw error
    }
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new OPFSError('Browser storage access denied', error)
    }
    throw new OPFSError(`Failed to read file: ${filename}`, error)
  }
}

/**
 * Check if a file exists in OPFS
 * @param filename - Name of the file
 * @returns Promise<boolean> - true if file exists, false otherwise
 * @throws OPFSError only for critical errors, returns false on NotFoundError
 */
export async function fileExists(filename: string): Promise<boolean> {
  try {
    if (!isOPFSSupported()) {
      return false
    }
    const root = await getOPFSRoot()
    await root.getFileHandle(filename)
    return true
  }
  catch {
    return false
  }
}

/**
 * Delete a file from OPFS
 * @param filename - Name of the file to delete
 * @throws OPFSError on deletion failure (except NotFoundError which is silent)
 */
export async function deleteFile(filename: string): Promise<void> {
  try {
    const root = await getOPFSRoot()
    await root.removeEntry(filename)
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      // File doesn't exist, that's fine
      return
    }
    if (error instanceof OPFSError) {
      throw error
    }
    throw new OPFSError(`Failed to delete file: ${filename}`, error)
  }
}

/**
 * List available files in OPFS matching a pattern
 * @param pattern - Optional regex pattern to filter filenames
 * @returns Promise<string[]> - Array of matching filenames
 */
export async function listFiles(pattern?: RegExp): Promise<string[]> {
  const files: string[] = []

  try {
    if (!isOPFSSupported()) {
      return files
    }
    const root = await getOPFSRoot()

    // @ts-expect-error - values() is part of FileSystemDirectoryHandle API
    for await (const entry of root.values()) {
      if (entry.kind === 'file') {
        if (!pattern || pattern.test(entry.name)) {
          files.push(entry.name)
        }
      }
    }

    return files
  }
  catch {
    return files
  }
}
