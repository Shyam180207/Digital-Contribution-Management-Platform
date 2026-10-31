import mongoose from 'mongoose'

const receiptSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 120 },
    mimeType: {
      type: String,
      enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      required: true,
    },
    size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
)

const transactionSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavingsGroup',
      required: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    kind: {
      type: String,
      enum: ['contribution', 'payout'],
      required: true,
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      max: 99_999_999_999,
      validate: {
        validator: Number.isSafeInteger,
        message: 'amountMinor must be a safe integer',
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    receipt: { type: receiptSchema, default: undefined },
  },
  {
    collection: 'transactions',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
)

transactionSchema.index({ group: 1, createdAt: -1 })
transactionSchema.index({ member: 1, createdAt: -1 })

const Transaction = mongoose.models.Transaction
  || mongoose.model('Transaction', transactionSchema)

export default Transaction
