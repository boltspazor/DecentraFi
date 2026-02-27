import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/decentrafi'

export async function connectDb(): Promise<typeof mongoose> {
  return mongoose.connect(uri)
}
