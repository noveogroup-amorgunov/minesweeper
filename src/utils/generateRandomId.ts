/**
 * Utility for generating cryptographically secure random IDs
 * Used for room IDs and other unique identifiers
 */

/**
 * Base62 alphabet: 0-9, a-z, A-Z
 */
const BASE62_ALPHABET
  = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Generates a cryptographically secure random ID using Base62 encoding
 * @param length - Length of the ID (default: 10)
 * @returns Base62 ID (0-9, a-z, A-Z)
 */
export function generateRandomId(length = 10): string {
  const result: string[] = []

  // Use crypto.getRandomValues for cryptographically secure randomness
  const randomBytes = new Uint8Array(length)
  crypto.getRandomValues(randomBytes)

  for (let i = 0; i < length; i++) {
    // Map random byte to alphabet index
    result.push(BASE62_ALPHABET[randomBytes[i] % BASE62_ALPHABET.length])
  }

  return result.join('')
}

/**
 * Alias for generateRandomId - generates a room ID
 * @param length - Length of the room ID (default: 10)
 * @returns Base62 room ID
 */
export function generateRoomId(length = 10): string {
  return generateRandomId(length)
}
