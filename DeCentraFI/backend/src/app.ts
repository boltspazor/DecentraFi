import express from 'express'
import cors from 'cors'
import campaignRoutes from './routes/campaignRoutes.js'
import contributionRoutes from './routes/contributionRoutes.js'
import userRoutes from './routes/userRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import recommendationRoutes from './routes/recommendationRoutes.js'
import qfRoutes from './routes/qfRoutes.js'
import creatorRoutes from './routes/creatorRoutes.js'
import { pool } from './config/db.js'

const app = express()

function corsOrigins(): true | string[] {
  const raw = process.env.FRONTEND_URL?.trim()
  if (!raw) return true
  const list = raw
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return list.length > 0 ? list : true
}

app.use(
  cors({
    origin: corsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ status: 'ok', database: 'connected' })
  } catch {
    res.status(503).json({ status: 'degraded', database: 'disconnected' })
  }
})
app.use('/api/campaigns', campaignRoutes)
app.use('/api/contributions', contributionRoutes)
app.use('/api/user', userRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/qf', qfRoutes)
app.use('/api/creators', creatorRoutes)

export default app
