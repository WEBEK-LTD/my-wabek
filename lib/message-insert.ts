/**
 * Safe message insert helper.
 *
 * Tries to insert with all fields (including media_mime_type / media_filename
 * which were added in migration 020). If Supabase rejects because the
 * columns don't exist yet (migration not run), falls back to inserting
 * without those columns so the message is never lost.
 *
 * This makes the code forward-compatible with the migration and
 * backward-compatible with databases where it hasn't been run yet.
 */

import { supabaseAdmin } from './supabase'
import { v4 as uuidv4 } from 'uuid'

export interface MessageRow {
  id?: string
  user_id: string
  instance_id: string
  contact_id: string | null
  wa_message_id: string | null
  direction: 'inbound' | 'outbound'
  type: string
  content: string
  status: string
  media_url?: string | null
  media_mime_type?: string | null
  media_filename?: string | null
  meta?: Record<string, unknown>
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === '23505' || /duplicate key/i.test(error.message || ''))
}

/**
 * Insert a message row. `duplicate: true` means a row with the same
 * wa_message_id already exists (unique index) — callers processing inbound
 * webhooks use it to skip re-processing a redelivered message.
 */
export async function insertMessage(row: MessageRow): Promise<{ id: string; error?: string; duplicate?: boolean }> {
  const db = supabaseAdmin()
  const id = row.id || uuidv4()

  // Full insert (migration 020 applied — columns exist)
  const full = {
    id,
    user_id:        row.user_id,
    instance_id:    row.instance_id,
    contact_id:     row.contact_id,
    wa_message_id:  row.wa_message_id,
    direction:      row.direction,
    type:           row.type || 'text',
    content:        row.content,
    status:         row.status,
    media_url:      row.media_url ?? null,
    media_mime_type: row.media_mime_type ?? null,
    media_filename: row.media_filename ?? null,
    ...(row.meta ? { meta: row.meta } : {}),
  }

  const { error } = await db.from('messages').insert(full)

  if (!error) return { id }
  if (isUniqueViolation(error)) return { id, error: 'duplicate', duplicate: true }

  // If the error is about missing columns (migration not run yet),
  // retry without the new media columns so the message is never lost.
  const isColumnError =
    error.message?.includes('media_filename') ||
    error.message?.includes('media_mime_type') ||
    error.message?.includes('column') ||
    error.message?.includes('schema cache')

  if (isColumnError) {
    console.warn('[message-insert] media columns not in schema yet, retrying without them:', error.message)
    const fallback = {
      id,
      user_id:       row.user_id,
      instance_id:   row.instance_id,
      contact_id:    row.contact_id,
      wa_message_id: row.wa_message_id,
      direction:     row.direction,
      type:          row.type || 'text',
      content:       row.content,
      status:        row.status,
      media_url:     row.media_url ?? null,
      ...(row.meta ? { meta: row.meta } : {}),
    }
    const { error: fallbackErr } = await db.from('messages').insert(fallback)
    if (fallbackErr) {
      if (isUniqueViolation(fallbackErr)) return { id, error: 'duplicate', duplicate: true }
      console.error('[message-insert] fallback insert also failed:', fallbackErr.message)
      return { id, error: fallbackErr.message }
    }
    return { id }
  }

  console.error('[message-insert] insert failed:', error.message)
  return { id, error: error.message }
}
