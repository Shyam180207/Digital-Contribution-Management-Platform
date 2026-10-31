import 'dotenv/config'
import mongoose from 'mongoose'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'
const mongoUri = process.env.MONGODB_URI
const jwtSecret = process.env.JWT_SECRET

if (!mongoUri) throw new Error('MONGODB_URI must be configured before starting the API.')
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.')
}

await mongoose.connect(mongoUri)

const app = createApp({ jwtSecret })

app.listen(port, host, () => {
  process.stderr.write(`CommonFund API listening on http://${host}:${port}\n`)
})
