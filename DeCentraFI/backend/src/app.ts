import express from 'express'
import cors from 'cors'
import campaignRoutes from './routes/campaignRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api/campaigns', campaignRoutes)

export default app
