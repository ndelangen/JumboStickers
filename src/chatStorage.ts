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
    const request = indexedDB.open(`stickerruil-voorbeeld-${key}`, 2)
    let blocked = false
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) request.result.createObjectStore('messages', { keyPath: 'id' })
      request.result.createObjectStore('status')
    }
    request.onblocked = () => {
      blocked = true
      reject(new Error('Chatgeschiedenis is nog in gebruik.'))
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
  operation: (messages: IDBObjectStore, status: IDBObjectStore) => IDBRequest<T>, requireActive = false) {
  const database = await openHistory(key)
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(['messages', 'status'], mode)
      const messages = transaction.objectStore('messages')
      const status = transaction.objectStore('status')
      let request: IDBRequest<T>
      if (requireActive) {
        const retired = status.get('retired')
        retired.onsuccess = () => {
          if (retired.result) transaction.abort()
          else request = operation(messages, status)
        }
      } else {
        request = operation(messages, status)
      }
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? new Error('Deze chatgeschiedenis is gesloten.'))
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
  await readOrWrite(key, 'readwrite', (store) => store.put(message), true)
  notifyHistoryChanged(key)
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
