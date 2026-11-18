import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.interval('expire unread messages', { minutes: 1 }, internal.exchange.expireUnreadMessages)
export default crons
