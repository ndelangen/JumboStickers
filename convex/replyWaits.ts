import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, type MutationCtx, type QueryCtx } from './_generated/server'

const replyWaitMs = 7 * 24 * 60 * 60 * 1000

function collectorPair(a: Id<'collectors'>, b: Id<'collectors'>) {
  return a < b ? { first: a, second: b } : { first: b, second: a }
}

function replyWait(ctx: QueryCtx | MutationCtx, { first, second }: ReturnType<typeof collectorPair>) {
  return ctx.db.query('replyWaits').withIndex('by_first_and_second', (q) =>
    q.eq('first', first).eq('second', second)).unique()
}

export async function isWaitingForReply(ctx: QueryCtx, viewer: Id<'collectors'>, seller: Id<'collectors'>) {
  const waiting = await replyWait(ctx, collectorPair(viewer, seller))
  return waiting?.sender === viewer && waiting.overdue
}

export async function removeReplyWait(ctx: MutationCtx, waiting: Doc<'replyWaits'>) {
  if (waiting.deadlineJob) await ctx.scheduler.cancel(waiting.deadlineJob)
  await ctx.db.delete('replyWaits', waiting._id)
}

export async function recordMessageForReplyFilter(ctx: MutationCtx, sender: Id<'collectors'>, recipient: Id<'collectors'>) {
  const pair = collectorPair(sender, recipient)
  const waiting = await replyWait(ctx, pair)
  if (waiting?.sender === sender) return
  // A new row gives each turn its own deadline, even when the same sender starts waiting again.
  if (waiting) await removeReplyWait(ctx, waiting)
  const id = await ctx.db.insert('replyWaits', { ...pair, sender, overdue: false })
  const deadlineJob = await ctx.scheduler.runAfter(replyWaitMs, internal.replyWaits.markOverdue, { id })
  await ctx.db.patch('replyWaits', id, { deadlineJob })
}

export const markOverdue = internalMutation({
  args: { id: v.id('replyWaits') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const waiting = await ctx.db.get('replyWaits', id)
    if (waiting && !waiting.overdue) await ctx.db.patch('replyWaits', id, { overdue: true, deadlineJob: undefined })
    return null
  },
})
