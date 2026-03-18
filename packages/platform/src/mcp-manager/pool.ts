import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

type PoolEntry = {
  client: Client
  refs: number
  created: number
}

const pool = new Map<string, PoolEntry>()

export async function acquire(name: string, config: any): Promise<Client> {
  const existing = pool.get(name)
  if (existing) {
    existing.refs++
    return existing.client
  }

  const client = new Client({ name: `enterprise-${name}`, version: "1.0.0" }, {})
  let transport: InstanceType<typeof StdioClientTransport>

  if (config.type === "stdio") {
    const [cmd, ...args] = config.command ?? []
    transport = new StdioClientTransport({ command: cmd, args, env: config.environment })
  } else {
    const url = new URL(config.url)
    transport =
      config.transport === "sse"
        ? new SSEClientTransport(url)
        : new StreamableHTTPClientTransport(url, {
            requestInit: { headers: config.headers ?? {} },
          })
  }

  await client.connect(transport)
  pool.set(name, { client, refs: 1, created: Date.now() })
  return client
}

export async function release(name: string) {
  const entry = pool.get(name)
  if (!entry) return
  entry.refs--
  if (entry.refs <= 0) {
    try {
      await entry.client.close()
    } catch {}
    pool.delete(name)
  }
}

export function status() {
  const result: Record<string, { refs: number; age: number }> = {}
  for (const [name, entry] of pool) {
    result[name] = { refs: entry.refs, age: Date.now() - entry.created }
  }
  return result
}

export async function closeAll() {
  for (const [, entry] of pool) {
    try {
      await entry.client.close()
    } catch {}
  }
  pool.clear()
}
