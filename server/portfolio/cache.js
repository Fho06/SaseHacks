import { hasRedisProvider, portfolioConfig } from "./config.js"

const memoryCache = new Map()
const warningKeys = new Set()

let redisBackend = null
let redisBackendInitPromise = null

function warnOnce(key, message) {
  if (warningKeys.has(key)) return
  warningKeys.add(key)
  console.warn(`[portfolio-cache] ${message}`)
}

function readMemoryCache(key) {
  const item = memoryCache.get(key)
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key)
    return null
  }
  return item.value
}

function writeMemoryCache(key, value, ttlMs) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  })
  return value
}

async function createNodeRedisBackend() {
  if (!portfolioConfig.redisUrl) return null

  try {
    const redisModule = await import("redis")
    if (typeof redisModule?.createClient !== "function") {
      warnOnce("redis-module", "redis package is unavailable; using in-memory cache fallback.")
      return null
    }

    const client = redisModule.createClient({ url: portfolioConfig.redisUrl })
    client.on("error", (error) => {
      const message = error instanceof Error ? error.message : "Unknown Redis client error."
      warnOnce("redis-client-error", `Redis client error: ${message}`)
    })
    await client.connect()

    return {
      provider: "redis",
      async get(key) {
        const payload = await client.get(key)
        if (typeof payload !== "string") return null
        try {
          return JSON.parse(payload)
        } catch {
          return null
        }
      },
      async set(key, value, ttlMs) {
        const payload = JSON.stringify(value)
        await client.set(key, payload, {
          PX: Math.max(1, Number(ttlMs) || 1)
        })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Redis connection error."
    warnOnce("redis-connect", `Failed to initialize Redis from REDIS_URL (${message}). Falling back.`)
    return null
  }
}

async function createUpstashRedisBackend() {
  if (!portfolioConfig.upstashRedisUrl || !portfolioConfig.upstashRedisToken) return null

  const baseUrl = portfolioConfig.upstashRedisUrl.replace(/\/+$/, "")
  const authHeader = `Bearer ${portfolioConfig.upstashRedisToken}`

  async function runCommand(command) {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    })
    if (!response.ok) {
      throw new Error(`Upstash request failed with ${response.status}`)
    }
    const payload = await response.json()
    return payload?.result ?? null
  }

  try {
    await runCommand(["PING"])

    return {
      provider: "upstash",
      async get(key) {
        const payload = await runCommand(["GET", key])
        if (typeof payload !== "string") return null
        try {
          return JSON.parse(payload)
        } catch {
          return null
        }
      },
      async set(key, value, ttlMs) {
        const payload = JSON.stringify(value)
        await runCommand(["SET", key, payload, "PX", String(Math.max(1, Number(ttlMs) || 1))])
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Upstash connection error."
    warnOnce("upstash-connect", `Failed to initialize Upstash Redis (${message}). Falling back.`)
    return null
  }
}

async function initializeRedisBackend() {
  if (redisBackend !== null) return redisBackend
  if (redisBackendInitPromise) return redisBackendInitPromise

  if (!hasRedisProvider()) {
    redisBackend = null
    return redisBackend
  }

  redisBackendInitPromise = (async () => {
    const nodeRedis = await createNodeRedisBackend()
    if (nodeRedis) return nodeRedis

    const upstash = await createUpstashRedisBackend()
    if (upstash) return upstash

    warnOnce("cache-fallback", "No Redis backend could be initialized; using in-memory cache fallback.")
    return null
  })()

  redisBackend = await redisBackendInitPromise
  redisBackendInitPromise = null
  return redisBackend
}

export function readCache(key) {
  return readMemoryCache(key)
}

export function writeCache(key, value, ttlMs) {
  return writeMemoryCache(key, value, ttlMs)
}

export async function cacheWrap(key, ttlMs, loader) {
  const localCached = readMemoryCache(key)
  if (localCached !== null) return localCached

  const backend = await initializeRedisBackend()
  if (backend) {
    try {
      const remoteCached = await backend.get(key)
      if (remoteCached !== null) {
        writeMemoryCache(key, remoteCached, ttlMs)
        return remoteCached
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Redis read error."
      warnOnce("redis-read", `Redis cache read failed (${message}). Using in-memory fallback.`)
    }
  }

  const value = await loader()
  writeMemoryCache(key, value, ttlMs)

  if (backend) {
    try {
      await backend.set(key, value, ttlMs)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Redis write error."
      warnOnce("redis-write", `Redis cache write failed (${message}). Using in-memory fallback.`)
    }
  }

  return value
}
