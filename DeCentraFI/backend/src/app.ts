import express from 'express'
import cors from 'cors'
import campaignRoutes from './routes/campaignRoutes.js'
import contributionRoutes from './routes/contributionRoutes.js'
import userRoutes from './routes/userRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api/campaigns', campaignRoutes)
app.use('/api/contributions', contributionRoutes)
app.use('/api/user', userRoutes)
app.use('/api/analytics', analyticsRoutes)

export default app
