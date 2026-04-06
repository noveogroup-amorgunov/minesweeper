import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateRandomId, generateRoomId } from './generateRandomId'

// Mock crypto.getRandomValues for deterministic tests
const mockRandomValues = vi.fn((array: Uint8Array) => {
  // Fill with predictable values for testing
  for (let i = 0; i < array.length; i++) {
    array[i] = (i * 7) % 256
  }
  return array
})

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: mockRandomValues,
  },
  writable: true,
  configurable: true,
})

describe('generateRandomId', () => {
  beforeEach(() => {
    mockRandomValues.mockClear()
  })

  it('should return string of default length 10', () => {
    const id = generateRandomId()
    expect(id).toHaveLength(10)
  })

  it('should return string of specified length', () => {
    const id15 = generateRandomId(15)
    expect(id15).toHaveLength(15)

    const id5 = generateRandomId(5)
    expect(id5).toHaveLength(5)
  })

  it('should contain only Base62 characters', () => {
    const id = generateRandomId(100)
    const base62Regex = /^[0-9a-z]+$/i
    expect(id).toMatch(base62Regex)
  })

  it('should use crypto.getRandomValues', () => {
    generateRandomId()
    expect(mockRandomValues).toHaveBeenCalled()
  })

  it('should return different values on multiple calls', () => {
    // Since we mock with predictable values, let's change the mock behavior
    let counter = 0
    mockRandomValues.mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = (counter + i) % 256
      }
      counter += 10
      return array
    })

    const id1 = generateRandomId()
    const id2 = generateRandomId()

    expect(id1).not.toBe(id2)
  })

  it('should handle edge case: length = 1', () => {
    const id = generateRandomId(1)
    expect(id).toHaveLength(1)
    expect(id).toMatch(/^[0-9a-z]$/i)
  })

  it('should handle edge case: length = 20', () => {
    const id = generateRandomId(20)
    expect(id).toHaveLength(20)
  })
})

describe('generateRoomId', () => {
  beforeEach(() => {
    mockRandomValues.mockClear()
  })

  it('should return string of default length 10', () => {
    const roomId = generateRoomId()
    expect(roomId).toHaveLength(10)
  })

  it('should return string of specified length', () => {
    const roomId15 = generateRoomId(15)
    expect(roomId15).toHaveLength(15)

    const roomId5 = generateRoomId(5)
    expect(roomId5).toHaveLength(5)
  })

  it('should contain only Base62 characters', () => {
    const roomId = generateRoomId(100)
    const base62Regex = /^[0-9a-z]+$/i
    expect(roomId).toMatch(base62Regex)
  })

  it('should use crypto.getRandomValues', () => {
    generateRoomId()
    expect(mockRandomValues).toHaveBeenCalled()
  })
})
