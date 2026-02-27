import app from './app'
import { connectDb } from './config/db'

const PORT = Number(process.env.PORT) || 3001

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Database connection failed:', err)
    process.exit(1)
  })
