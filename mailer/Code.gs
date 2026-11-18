function doPost(event) {
  const reply = (status) => ContentService.createTextOutput(JSON.stringify({ status }))
    .setMimeType(ContentService.MimeType.JSON)
  let mail
  try { mail = JSON.parse(event.postData.contents) } catch { return reply('denied') }
  const store = PropertiesService.getScriptProperties()
  const secret = store.getProperty('DIGEST_MAILER_SECRET')
  if (!secret || !mail || mail.secret !== secret ||
      typeof mail.id !== 'string' || !/^[a-z0-9]{20,60}$/u.test(mail.id) ||
      typeof mail.recipient !== 'string' || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/u.test(mail.recipient) ||
      mail.subject !== 'Nieuwe ruilkansen in Zwolle' || typeof mail.body !== 'string' || mail.body.length > 20000 ||
      (mail.htmlBody !== undefined && (typeof mail.htmlBody !== 'string' || mail.htmlBody.length > 30000))) {
    return reply('denied')
  }
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const key = 'ruilmail:' + mail.id
    if (store.getProperty(key)) return reply('duplicate')
    const now = Date.now()
    const properties = store.getProperties()
    for (const property of Object.keys(properties)) {
      if (property.startsWith('ruilmail:') && now - Number(properties[property]) > 172800000) store.deleteProperty(property)
    }
    if (MailApp.getRemainingDailyQuota() < 1) return reply('quota')

    store.setProperty(key, String(now))
    const message = { to: mail.recipient, subject: mail.subject, body: mail.body, name: 'Stickerruil Zwolle' }
    if (mail.htmlBody) message.htmlBody = mail.htmlBody
    MailApp.sendEmail(message)
    return reply('sent')
  } finally {
    lock.releaseLock()
  }
}
