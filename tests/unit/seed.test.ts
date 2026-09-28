import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// src/seed.ts runs on import (top-level await) and ends with process.exit, so each test re-imports it
// with a fresh mocked Payload and turns process.exit into a thrown value carrying the exit code.
const { payloadMock } = vi.hoisted(() => ({
  payloadMock: {
    count: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    logger: { info: vi.fn() },
  },
}))

vi.mock('payload', () => ({ getPayload: async () => payloadMock }))
vi.mock('@payload-config', () => ({ default: {} }))
// No files are read or written: no seed images exist, and the placeholder JPEG is "written" by a stub.
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(async () => undefined),
    access: vi.fn(async () => undefined),
    readdir: vi.fn(async () => []),
  },
}))
vi.mock('sharp', () => ({ default: () => ({ jpeg: () => ({ toFile: async () => undefined }) }) }))

class Exit {
  constructor(readonly code: number | undefined) {}
}

async function runSeed(argv: string[] = []) {
  vi.resetModules()
  process.argv = ['node', 'seed.ts', ...argv]
  try {
    await import('@/seed')
  } catch (e) {
    if (e instanceof Exit) return e.code
    throw e
  }
  throw new Error('seed.ts did not call process.exit')
}

const originalArgv = process.argv
let log: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Exit(code)
  }) as typeof process.exit)
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  payloadMock.find.mockResolvedValue({ docs: [] })
  payloadMock.create.mockImplementation(async ({ collection }: { collection: string }) => ({ id: `${collection}-id` }))
})

afterEach(() => {
  process.argv = originalArgv
  vi.restoreAllMocks()
})

describe('seed', () => {
  it('writes 4 products and 4 pages into an empty database and says so', async () => {
    payloadMock.count.mockResolvedValueOnce({ totalDocs: 0 }).mockResolvedValueOnce({ totalDocs: 4 })

    expect(await runSeed()).toBe(0)
    expect(log).toHaveBeenCalledWith('Seeded 4 products, 4 pages')
    const created = payloadMock.create.mock.calls.map(([args]) => args.collection)
    expect(created.filter((c) => c === 'products')).toHaveLength(4)
    expect(created.filter((c) => c === 'pages')).toHaveLength(4)
  })

  it('exits 1 with an error when the database still has no products afterwards', async () => {
    payloadMock.count.mockResolvedValue({ totalDocs: 0 })

    expect(await runSeed()).toBe(1)
    expect(error).toHaveBeenCalledWith('Seed failed: 4 products written, 0 in the database.')
    expect(log).not.toHaveBeenCalledWith(expect.stringMatching(/^Seeded/))
  })

  it('refuses to run when products exist and --force is not passed', async () => {
    payloadMock.count.mockResolvedValue({ totalDocs: 2 })

    expect(await runSeed()).toBe(1)
    expect(error).toHaveBeenCalledWith('Refusing to seed: products already exist. Pass --force to upsert anyway.')
    expect(payloadMock.create).not.toHaveBeenCalled()
  })

  it('with --force upserts existing products and skips existing pages', async () => {
    payloadMock.count.mockResolvedValue({ totalDocs: 4 })
    payloadMock.find.mockResolvedValue({ docs: [{ id: 'existing-id' }] })

    expect(await runSeed(['--force'])).toBe(0)
    expect(payloadMock.update).toHaveBeenCalledTimes(4)
    expect(payloadMock.create).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('Seeded 4 products, 0 pages')
  })
})
