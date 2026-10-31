import mongoose from 'mongoose'

const memberSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavingsGroup',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },
  },
  {
    collection: 'members',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
)

memberSchema.index({ group: 1 })
memberSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'member',
})

const Member = mongoose.models.Member || mongoose.model('Member', memberSchema)

export default Member
