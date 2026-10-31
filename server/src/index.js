import 'dotenv/config'
import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3001)
const mongoUri = process.env.MONGODB_URI
const sessionSecret = process.env.SESSION_SECRET

if (!mongoUri) throw new Error('MONGODB_URI must be configured before starting the API.')
if (!sessionSecret) throw new Error('SESSION_SECRET must be configured before starting the API.')

await mongoose.connect(mongoUri)

const sessionStore = MongoStore.create({
  client: mongoose.connection.getClient(),
  collectionName: 'sessions',
})
const app = createApp({ sessionStore, sessionSecret })

app.listen(port, '127.0.0.1', () => {
  process.stderr.write(`CommonFund API listening on http://127.0.0.1:${port}\n`)
})
