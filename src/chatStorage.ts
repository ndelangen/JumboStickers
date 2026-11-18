import { ConvexError } from 'convex/values'

export type LocalMessage = {
  id: string
  threadId: string
  direction: 'in' | 'out'
  text: string
  sentAt: number
  delivery?: 'pending' | 'sent'
  historyVersion?: number
}

function openHistory(key: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`stickerruil-voorbeeld-${key}`, 2)
    let blocked = false
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) request.result.createObjectStore('messages', { keyPath: 'id' })
      request.result.createObjectStore('status')
    }
    request.onblocked = () => {
      blocked = true
      reject(new Error('The chat history database is still in use.'))
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      if (blocked) database.close()
      else resolve(database)
    }
    request.onerror = () => reject(request.error)
  })
}

async function readOrWrite<T>(key: string, mode: IDBTransactionMode,
  operation: (messages: IDBObjectStore, status: IDBObjectStore) => IDBRequest<T>, saving?: LocalMessage) {
  const database = await openHistory(key)
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(['messages', 'status'], mode)
      const messages = transaction.objectStore('messages')
      const status = transaction.objectStore('status')
      let request: IDBRequest<T>
      if (saving) {
        const retired = status.get('retired')
        retired.onsuccess = () => {
          if (retired.result) {
            transaction.abort()
            return
          }
          const removed = status.get(`removed:${saving.threadId}`)
          removed.onsuccess = () => {
            if ((removed.result ?? -1) >= (saving.historyVersion ?? 0)) transaction.abort()
            else request = operation(messages, status)
          }
        }
      } else {
        request = operation(messages, status)
      }
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? new Error('The chat history transaction was aborted.'))
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

export function localHistory(key: string): Promise<LocalMessage[]> {
  return readOrWrite(key, 'readonly', (store) => store.getAll())
}

export async function saveLocalMessage(key: string, message: LocalMessage) {
  await readOrWrite(key, 'readwrite', (store) => store.put(message), message)
  notifyHistoryChanged(key)
}

async function clearLocalThread(key: string, threadId: string, historyVersion: number) {
  await readOrWrite(key, 'readwrite', (messages, status) => {
    const statusKey = `removed:${threadId}`
    const removed = status.get(statusKey)
    removed.onsuccess = () => {
      status.put(Math.max(removed.result ?? -1, historyVersion), statusKey)
    }
    const scan = messages.openCursor()
    scan.onsuccess = () => {
      const cursor = scan.result
      if (!cursor) return
      const message: LocalMessage = cursor.value
      if (message.threadId === threadId && (message.historyVersion ?? 0) <= historyVersion) cursor.delete()
      cursor.continue()
    }
    return scan
  })
  notifyHistoryChanged(key)
}

type RemoveFromList = (threadId: string, historyVersion: number) => Promise<unknown>

export async function removeThreadWithHistory(key: string, threadId: string, historyVersion: number,
  removeFromList: RemoveFromList, onRemoved?: () => void) {
  const job = `stickerruil.chat-wissen.${key}:${threadId}:${historyVersion}`
  let removed = false
  try {
    removed = localStorage.getItem(job) === 'history'
    if (!removed) localStorage.setItem(job, 'list')
  } catch { /* IndexedDB may still be available. */ }
  const finish = () => {
    try { localStorage.removeItem(job) } catch { /* The removal can safely be repeated. */ }
  }
  if (!removed) {
    try {
      await removeFromList(threadId, historyVersion)
    } catch (cause) {
      if (cause instanceof ConvexError) finish()
      throw cause
    }
    try { localStorage.setItem(job, 'history') } catch { /* Repeating the list removal is safe. */ }
  }
  onRemoved?.()
  await clearLocalThread(key, threadId, historyVersion)
  finish()
}

export function resumeThreadRemovals(key: string, removeFromList: RemoveFromList) {
  const prefix = `stickerruil.chat-wissen.${key}:`
  let jobs: string[]
  try { jobs = Object.keys(localStorage).filter((entry) => entry.startsWith(prefix)) } catch { return }
  for (const job of jobs) {
    const [threadId, version] = job.slice(prefix.length).split(':')
    if (threadId && /^\d+$/u.test(version ?? '')) {
      void removeThreadWithHistory(key, threadId, Number(version), removeFromList)
        .catch(() => { /* Retry on the next visit or focus. */ })
    }
  }
}

export async function clearLocalHistory(key: string) {
  await readOrWrite(key, 'readwrite', (store) => store.clear())
  notifyHistoryChanged(key)
}

export async function retireLocalHistory(key: string) {
  await readOrWrite(key, 'readwrite', (messages, status) => {
    status.put(true, 'retired')
    return messages.clear()
  })
  notifyHistoryChanged(key)
}

function notifyHistoryChanged(key: string) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(`stickerruil-geschiedenis-${key}`)
  channel.postMessage('changed')
  channel.close()
}

export function watchLocalHistory(key: string, refresh: () => void) {
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`stickerruil-geschiedenis-${key}`)
  channel?.addEventListener('message', refresh)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  return () => {
    channel?.close()
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
}
