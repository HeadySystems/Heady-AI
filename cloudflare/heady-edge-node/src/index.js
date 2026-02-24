import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
    return c.json({
        status: 'online',
        service: 'heady-edge-node',
        nodes: ['memory', 'swarm', 'manager'],
        region: c.req.raw.cf?.colo || 'unknown'
    })
})

// === Edge Memory (Vectorize + AI) ===
app.post('/api/memory/search', async (c) => {
    const { query, limit = 5 } = await c.req.json()

    if (!c.env.HEADY_AI || !c.env.HEADY_MEMORY_VECS) {
        return c.json({ error: "Bindings not active", fallback: true })
    }

    // 1. Generate text embeddings on the edge using BAAI model
    const embeddings = await c.env.HEADY_AI.run('@cf/baai/bge-large-en-v1.5', {
        text: [query]
    })

    // 2. Query the Vectorize Index
    const matches = await c.env.HEADY_MEMORY_VECS.query(
        embeddings.data[0],
        { topK: limit, returnMetadata: true }
    )

    return c.json({ success: true, matches: matches.matches })
})

// === Edge KV Cache (Manager Proxy) ===
app.get('/api/manager/health', async (c) => {
    if (c.env.HEADY_KV_CACHE) {
        const cached = await c.env.HEADY_KV_CACHE.get('manager_health', 'json')
        if (cached) return c.json({ ...cached, source: 'edge-kv-cache' })
    }

    return c.json({ status: 'healthy', source: 'origin-stub' })
})

// === Edge Swarm Queue ===
app.post('/api/swarm/forage', async (c) => {
    const task = await c.req.json()

    if (c.env.SWARM_QUEUE) {
        await c.env.SWARM_QUEUE.send(task)
        return c.json({ success: true, message: "Task pushed to global edge queue" })
    }

    return c.json({ success: false, error: "Queue binding missing" })
})

export default app
