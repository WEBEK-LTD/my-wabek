import type { Conversation } from './types'

/** Conversations seen in lists, so a chat opens instantly (the API has no single-conversation GET). */
const cache = new Map<string, Conversation>()

export const rememberConversation = (c: Conversation) => { cache.set(c.id, c) }
export const rememberConversations = (list: Conversation[]) => { for (const c of list) cache.set(c.id, c) }
export const cachedConversation = (id: string) => cache.get(id) || null
