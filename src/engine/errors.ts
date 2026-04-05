export class SaveFileError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'SaveFileError'
  }
}

export class SaveFileCorruptedError extends SaveFileError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'SaveFileCorruptedError'
  }
}

export class SaveVersionError extends SaveFileError {
  constructor(public readonly version: number) {
    super(`Unsupported save file version: ${version}`)
    this.name = 'SaveVersionError'
  }
}

export class SaveValidationError extends SaveFileError {
  constructor(message: string) {
    super(message)
    this.name = 'SaveValidationError'
  }
}
