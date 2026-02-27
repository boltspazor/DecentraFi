import express from 'express'
import cors from 'cors'
import campaignRoutes from './routes/campaignRoutes.js'
import contributionRoutes from './routes/contributionRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api/campaigns', campaignRoutes)
app.use('/api/contributions', contributionRoutes)

export default app
