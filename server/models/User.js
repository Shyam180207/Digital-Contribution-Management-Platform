import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_.-]{3,40}$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
)

userSchema.index({ username: 1 }, { unique: true })

const User = mongoose.models.User || mongoose.model('User', userSchema)

export default User
