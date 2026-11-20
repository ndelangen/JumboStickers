import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.cron('daily trade email', '0,5,10,15,20,25 14,15 * * *', internal.digest.begin, {})
crons.interval('expire unread messages', { minutes: 5 }, internal.exchange.expireUnreadMessages, {})

export default crons
