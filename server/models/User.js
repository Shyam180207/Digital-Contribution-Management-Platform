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
      required() {
        return !this.googleSub
      },
      select: false,
    },
    googleSub: {
      type: String,
      maxlength: 255,
      select: false,
    },
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
)

userSchema.index({ username: 1 }, { unique: true })
userSchema.index({ googleSub: 1 }, { unique: true, sparse: true })
userSchema.virtual('groups', {
  ref: 'SavingsGroup',
  localField: '_id',
  foreignField: 'owner',
})

const User = mongoose.models.User || mongoose.model('User', userSchema)

export default User
