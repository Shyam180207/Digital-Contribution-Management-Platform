import mongoose from 'mongoose'

const savingsGroupSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/,
    },
  },
  {
    collection: 'savings_groups',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
)

savingsGroupSchema.index({ owner: 1 })

const SavingsGroup = mongoose.models.SavingsGroup
  || mongoose.model('SavingsGroup', savingsGroupSchema)

export default SavingsGroup
