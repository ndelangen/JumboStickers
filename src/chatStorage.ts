export type LocalMessage = {
  id: string
  threadId: string
  direction: 'in' | 'out'
  text: string
  sentAt: number
  delivery?: 'pending' | 'sent'
}

function openHistory(key: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`stickerruil-voorbeeld-${key}`, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('messages', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readOrWrite<T>(key: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openHistory(key)
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('messages', mode)
      const request = operation(transaction.objectStore('messages'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error)
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
  await readOrWrite(key, 'readwrite', (store) => store.put(message))
  notifyHistoryChanged(key)
}

export async function clearLocalHistory(key: string) {
  await readOrWrite(key, 'readwrite', (store) => store.clear())
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
