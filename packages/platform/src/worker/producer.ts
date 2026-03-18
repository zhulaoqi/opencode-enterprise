import { chatQueue, type ChatJob } from "./queue"

export async function enqueue(job: ChatJob): Promise<string> {
  const result = await chatQueue.add("chat", job, {
    priority: job.source === "web" ? 1 : 2,
  })
  return result.id ?? ""
}

export async function stats() {
  const [waiting, active, completed, failed] = await Promise.all([
    chatQueue.getWaitingCount(),
    chatQueue.getActiveCount(),
    chatQueue.getCompletedCount(),
    chatQueue.getFailedCount(),
  ])
  return { waiting, active, completed, failed }
}
