import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM posts').first()
  return c.text(`CafeWoo 咖啡看板 - ${row?.cnt} posts loaded`)
})

export default app
