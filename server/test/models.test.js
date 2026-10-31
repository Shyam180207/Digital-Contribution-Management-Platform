import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import { Member, SavingsGroup, Transaction, User } from '../models/index.js'

const objectId = () => new mongoose.Types.ObjectId()

async function getValidationError(document) {
  try {
    await document.validate()
  } catch (error) {
    assert.ok(error instanceof mongoose.Error.ValidationError)
    return error
  }

  assert.fail('Expected document validation to fail')
}

test('User normalizes usernames and requires a password hash', async () => {
  const user = new User({ username: '  Shyam  ', passwordHash: 'hashed-password' })

  assert.equal(user.username, 'shyam')
  await user.validate()
  const error = await getValidationError(new User({ username: 'shyam' }))
  assert.equal(error.errors.passwordHash.kind, 'required')
  const invalidUsername = await getValidationError(
    new User({ username: 'spaces are not allowed', passwordHash: 'hashed-password' }),
  )
  assert.equal(invalidUsername.errors.username.kind, 'regexp')
})

test('SavingsGroup requires an owner and normalizes its currency', async () => {
  const group = new SavingsGroup({
    owner: objectId(),
    name: '  Sunrise Circle  ',
    currency: 'inr',
  })

  assert.equal(group.name, 'Sunrise Circle')
  assert.equal(group.currency, 'INR')
  await group.validate()
  const error = await getValidationError(new SavingsGroup({ name: 'No owner' }))
  assert.equal(error.errors.owner.kind, 'required')
})

test('Member requires a group and name while allowing an absent phone', async () => {
  const member = new Member({ group: objectId(), name: '  Aarav Sharma  ' })

  assert.equal(member.name, 'Aarav Sharma')
  assert.equal(member.phone, null)
  await member.validate()
  const error = await getValidationError(new Member({ group: objectId() }))
  assert.equal(error.errors.name.kind, 'required')
})

test('Transaction validates references, kind, and positive integer minor-unit amounts', async () => {
  const validTransaction = new Transaction({
    group: objectId(),
    member: objectId(),
    createdBy: objectId(),
    kind: 'contribution',
    amountMinor: 2500,
  })

  await validTransaction.validate()

  for (const amountMinor of [0, -1, 1.5, 99_999_999_999 + 1, Number.MAX_SAFE_INTEGER + 1]) {
    const invalidTransaction = new Transaction({
      group: objectId(),
      member: objectId(),
      createdBy: objectId(),
      kind: 'payout',
      amountMinor,
    })

    const error = await getValidationError(invalidTransaction)
    assert.ok(error.errors.amountMinor)
  }

  const invalidKind = new Transaction({
    group: objectId(),
    member: objectId(),
    createdBy: objectId(),
    kind: 'refund',
    amountMinor: 100,
  })

  const error = await getValidationError(invalidKind)
  assert.equal(error.errors.kind.kind, 'enum')
})

test('model collections and query indexes are declared', () => {
  assert.equal(User.collection.collectionName, 'users')
  assert.equal(SavingsGroup.collection.collectionName, 'savings_groups')
  assert.equal(Member.collection.collectionName, 'members')
  assert.equal(Transaction.collection.collectionName, 'transactions')
  assert.ok(Transaction.schema.indexes().some(([index]) => index.group === 1 && index.createdAt === -1))
})
