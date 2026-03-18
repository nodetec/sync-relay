import { Hono } from "hono"
import { setCookie, deleteCookie } from "hono/cookie"
import { and, count, desc, eq, inArray, lt, sql } from "drizzle-orm"
import type { DB } from "../db"
import type { AccessControl } from "../access"
import type { Storage } from "../relay/storage"
import type { ConnectionManager } from "../connections"
import { blobs, blobOwners, events, inviteCodes, users } from "../schema"
import { generateCode } from "../access"
import { adminAuth } from "./middleware"
import * as blobDb from "../blossom/db"
import { DEFAULT_STORAGE_LIMIT_BYTES } from "../blossom/db"
import * as s3 from "../blossom/s3"

const SESSION_COOKIE = "admin_session"

type AdminDeps = {
  db: DB
  access: AccessControl
  storage: Storage
  connections: ConnectionManager
  adminToken: string
}

export function adminRoutes(deps: AdminDeps): Hono {
  const { db, access, storage, connections, adminToken } = deps
  const app = new Hono()

  // JSON API: unauthenticated endpoints
  app.post("/api/login", async (c) => {
    const body = await c.req.json<{ token?: string }>()
    if (body.token !== adminToken) {
      return c.json({ error: "invalid token" }, 401)
    }
    setCookie(c, SESSION_COOKIE, adminToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/admin",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return c.json({ ok: true })
  })

  app.post("/api/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/admin" })
    return c.json({ ok: true })
  })

  // Protected API routes
  app.use("/api/*", adminAuth(adminToken))

  // Stats
  app.get("/api/stats", async (c) => {
    const [eventCount, blobCount, blobTotalSize] = await Promise.all([
      storage.getEventCount(),
      blobDb.getBlobCount(db),
      blobDb.getBlobTotalSize(db),
    ])
    return c.json({
      connections: connections.size,
      events: eventCount,
      blobs: blobCount,
      blobStorage: blobTotalSize,
    })
  })

  // Allowlist API
  app.get("/api/allow", async (c) => {
    const [pubkeys, usageMap] = await Promise.all([
      access.list(),
      blobDb.getStorageUsageByPubkey(db),
    ])
    return c.json({
      default_storage_limit_bytes: DEFAULT_STORAGE_LIMIT_BYTES,
      pubkeys: pubkeys.map((p) => ({
        ...p,
        storage_used_bytes: usageMap.get(p.pubkey) ?? 0,
      })),
    })
  })

  app.post("/api/allow", async (c) => {
    const body = await c.req.json<{ pubkey?: string; expires_at?: number | null; storage_limit_bytes?: number | null }>()
    if (!body.pubkey || !/^[a-f0-9]{64}$/.test(body.pubkey)) {
      return c.json({ error: "invalid pubkey: must be 64-char hex" }, 400)
    }
    const expiresAt = body.expires_at ?? null
    await access.allow(body.pubkey, expiresAt, body.storage_limit_bytes)
    return c.json({ allowed: true, pubkey: body.pubkey, expires_at: expiresAt })
  })

  app.delete("/api/allow/:pubkey", async (c) => {
    const pubkey = c.req.param("pubkey")
    if (!pubkey || !/^[a-f0-9]{64}$/.test(pubkey)) {
      return c.json({ error: "invalid pubkey" }, 400)
    }
    const revoked = await access.revoke(pubkey)
    return c.json({ revoked }, revoked ? 200 : 404)
  })

  app.patch("/api/allow/:pubkey/storage-limit", async (c) => {
    const pubkey = c.req.param("pubkey")
    if (!pubkey || !/^[a-f0-9]{64}$/.test(pubkey)) {
      return c.json({ error: "invalid pubkey" }, 400)
    }
    const body = await c.req.json<{ storage_limit_bytes: number | null }>()
    await access.setStorageLimit(pubkey, body.storage_limit_bytes)
    return c.json({ pubkey, storage_limit_bytes: body.storage_limit_bytes })
  })

  // Invite Codes API
  app.get("/api/invite-codes", async (c) => {
    const rows = await db
      .select()
      .from(inviteCodes)
      .orderBy(desc(inviteCodes.createdAt))
    return c.json({
      invite_codes: rows.map((r) => ({
        id: r.id,
        code: r.code,
        max_uses: r.maxUses,
        use_count: r.useCount,
        expires_at: r.expiresAt,
        revoked: r.revoked,
        created_at: r.createdAt,
      })),
    })
  })

  app.post("/api/invite-codes", async (c) => {
    const body = await c.req.json<{ max_uses?: number; expires_at?: number | null }>()
    const code = generateCode()
    const maxUses = body.max_uses ?? 1
    const expiresAt = body.expires_at ?? null
    const [row] = await db.insert(inviteCodes).values({ code, maxUses, expiresAt }).returning()
    return c.json({
      id: row.id,
      code: row.code,
      max_uses: row.maxUses,
      use_count: row.useCount,
      expires_at: row.expiresAt,
      created_at: row.createdAt,
    })
  })

  app.delete("/api/invite-codes/:id", async (c) => {
    const id = parseInt(c.req.param("id"), 10)
    if (isNaN(id)) return c.json({ error: "invalid id" }, 400)
    await db.update(inviteCodes).set({ revoked: true }).where(eq(inviteCodes.id, id))
    return c.json({ revoked: true })
  })

  // Blobs API
  app.get("/api/blobs", async (c) => {
    const cursor = c.req.query("cursor") // epoch seconds cursor
    const limit = 50

    // Step 1: paginate blobs only
    let blobQuery = db
      .select({ sha256: blobs.sha256, size: blobs.size, type: blobs.type, uploadedAt: blobs.uploadedAt })
      .from(blobs)
      .$dynamic()

    if (cursor) {
      blobQuery = blobQuery.where(lt(blobs.uploadedAt, Number(cursor)))
    }

    const blobRows = await blobQuery.orderBy(desc(blobs.uploadedAt)).limit(limit)
    if (blobRows.length === 0) {
      return c.json({ blobs: [], next_cursor: null })
    }

    // Step 2: fetch owners for this page of blobs
    const hashes = blobRows.map((r) => r.sha256)
    const ownerRows = await db
      .select({ sha256: blobOwners.sha256, pubkey: blobOwners.pubkey })
      .from(blobOwners)
      .where(inArray(blobOwners.sha256, hashes))

    const ownerMap = new Map<string, string[]>()
    for (const r of ownerRows) {
      const list = ownerMap.get(r.sha256) ?? []
      list.push(r.pubkey)
      ownerMap.set(r.sha256, list)
    }

    const items = blobRows.map((r) => ({
      sha256: r.sha256,
      size: r.size,
      type: r.type,
      uploaded_at: r.uploadedAt,
      owners: ownerMap.get(r.sha256) ?? [],
    }))
    const nextCursor = items.length === limit ? String(items[items.length - 1].uploaded_at) : null

    return c.json({ blobs: items, next_cursor: nextCursor })
  })

  app.delete("/api/blobs/:sha256", async (c) => {
    const sha256 = c.req.param("sha256")
    if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) {
      return c.json({ error: "invalid sha256" }, 400)
    }
    await s3.deleteBlob(sha256)
    await blobDb.deleteBlob(db, sha256)
    return c.json({ deleted: true })
  })

  // Events API
  app.get("/api/events", async (c) => {
    const kindParam = c.req.query("kind")
    const pubkeyParam = c.req.query("pubkey")
    const cursor = c.req.query("cursor") // created_at unix timestamp
    const limit = 50

    const conditions = []
    if (kindParam !== undefined) conditions.push(eq(events.kind, Number(kindParam)))
    if (pubkeyParam !== undefined) conditions.push(eq(events.pubkey, pubkeyParam))
    if (cursor !== undefined) conditions.push(lt(events.createdAt, Number(cursor)))

    let query = db
      .select({
        id: events.id,
        pubkey: events.pubkey,
        kind: events.kind,
        createdAt: events.createdAt,
        content: events.content,
      })
      .from(events)
      .$dynamic()

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    const rows = await query.orderBy(desc(events.createdAt)).limit(limit)

    const items = rows.map((r) => ({
      id: r.id,
      pubkey: r.pubkey,
      kind: r.kind,
      created_at: r.createdAt,
      content: r.content.length > 200 ? r.content.slice(0, 200) + "…" : r.content,
    }))
    const nextCursor = items.length === limit ? String(items[items.length - 1].created_at) : null

    return c.json({ events: items, next_cursor: nextCursor })
  })

  // DELETE /api/events — bulk delete events by IDs
  app.delete("/api/events", async (c) => {
    const body = await c.req.json<{ ids: string[] }>()
    if (!body.ids?.length) return c.json({ deleted: 0 })

    await db.delete(events).where(inArray(events.id, body.ids))
    return c.json({ deleted: body.ids.length })
  })

  // Users API — per-user storage and event stats
  app.get("/api/users", async (c) => {
    const [blobStats, eventCounts] = await Promise.all([
      // Blob stats via Drizzle (users → blob_owners → blobs)
      db.select({
          pubkey: users.pubkey,
          storageLimitBytes: users.storageLimitBytes,
          storageUsedBytes: sql<number>`COALESCE(SUM(${blobs.size}), 0)`,
          blobCount: sql<number>`COUNT(DISTINCT ${blobOwners.sha256})`,
        })
        .from(users)
        .leftJoin(blobOwners, eq(blobOwners.pubkey, users.pubkey))
        .leftJoin(blobs, eq(blobs.sha256, blobOwners.sha256))
        .groupBy(users.pubkey, users.storageLimitBytes)
        .orderBy(sql`COALESCE(SUM(${blobs.size}), 0) DESC`),
      // Event counts per user (gift wraps use recipient column)
      db.select({
          userPubkey: sql<string>`COALESCE(${events.recipient}, ${events.pubkey})`,
          eventCount: count(),
        })
        .from(events)
        .groupBy(sql`COALESCE(${events.recipient}, ${events.pubkey})`),
    ])
    const eventCountMap = new Map<string, number>()
    for (const r of eventCounts) {
      eventCountMap.set(r.userPubkey, Number(r.eventCount))
    }

    return c.json({
      users: blobStats.map((r) => ({
        pubkey: r.pubkey,
        storage_used_bytes: Number(r.storageUsedBytes),
        storage_limit_bytes: r.storageLimitBytes,
        blob_count: Number(r.blobCount),
        event_count: eventCountMap.get(r.pubkey) ?? 0,
      })),
      default_storage_limit_bytes: DEFAULT_STORAGE_LIMIT_BYTES,
    })
  })

  // Connections API
  app.get("/api/connections", (c) => {
    const conns: { id: string; authedPubkeys: string[] }[] = []
    for (const [id, state] of connections.entries()) {
      conns.push({
        id,
        authedPubkeys: Array.from(state.authedPubkeys),
      })
    }
    return c.json({ connections: conns })
  })

  return app
}
