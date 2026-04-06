import type { RandomGenerator } from '../engine/types'

/**
 * cyrb128 hash function - generates 128-bit hash from string
 * Returns 4 32-bit numbers for use as PRNG seed
 *
 * Algorithm by Chris Wellons (https://github.com/skeeto/hash-prospector)
 * Licensed under MIT or Unlicense
 *
 * @param str - Input string to hash
 * @returns Tuple of 4 32-bit numbers
 */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let i = 0, k: number
    ; i < str.length
    ; i++) {
    k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}

/**
 * sfc32 PRNG - Small Fast Counter 32-bit
 * High quality PRNG with 128-bit internal state
 *
 * Algorithm by Chris Wellons (https://github.com/skeeto/hash-prospector)
 * Part of the hash-prospector collection
 *
 * @param a - First 32-bit state component
 * @param b - Second 32-bit state component
 * @param c - Third 32-bit state component
 * @param d - Fourth 32-bit state component
 * @returns Random number generator function that produces values in [0, 1)
 */
export function sfc32(
  a: number,
  b: number,
  c: number,
  d: number,
): RandomGenerator {
  return function () {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

/**
 * Creates a deterministic random number generator from a seed string
 * Uses cyrb128 for hashing and sfc32 for PRNG
 *
 * This is useful for:
 * - Deterministic game field generation (multiplayer)
 * - Reproducible random sequences
 * - Seed-based testing
 *
 * @param seed - Seed string (roomId or any string)
 * @returns Random number generator function that produces values in [0, 1)
 * @example
 * ```typescript
 * const random = createSeededRandom('my-seed')
 * const value = random() // 0 <= value < 1
 * ```
 */
export function createSeededRandom(seed: string): RandomGenerator {
  const [a, b, c, d] = cyrb128(seed)
  return sfc32(a, b, c, d)
}
