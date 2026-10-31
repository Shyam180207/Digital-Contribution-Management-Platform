import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

function EditTransactionModal({ transaction, members, onClose, onSave }) {
  const memberOptions = members.some((member) => member.id === transaction.memberId)
    ? members
    : [{ id: transaction.memberId, name: transaction.name }]
  const [memberId, setMemberId] = useState(transaction.memberId)
  const [kind, setKind] = useState(transaction.kind.toLowerCase())
  const [amount, setAmount] = useState((transaction.amountMinor / 100).toFixed(2))
  const [note, setNote] = useState(transaction.note ?? '')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  async function handleSubmit(event) {
    event.preventDefault()
    const amountMinor = Math.round(Number(amount) * 100)
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 99_999_999_999) {
      setError('Enter a valid positive amount.')
      return
    }

    setError('')
    setIsSaving(true)
    try {
      await onSave(transaction, {
        memberId,
        kind,
        amountMinor,
        note: note.trim(),
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) onClose()
    }}>
      <section aria-labelledby="edit-transaction-title" aria-modal="true" className="modal-card" role="dialog">
        <button aria-label="Close dialog" className="modal-close" disabled={isSaving} onClick={onClose} type="button">
          <Icon name="close" />
        </button>
        <div className="modal-icon"><Icon name="edit" size={20} /></div>
        <h2 id="edit-transaction-title">Edit transaction</h2>
        <p>Update this contribution or payout in {transaction.group}.</p>
        <form className="transaction-form" onSubmit={handleSubmit}>
          <label htmlFor="transaction-member">Member</label>
          <select
            id="transaction-member"
            onChange={(event) => setMemberId(event.target.value)}
            ref={inputRef}
            required
            value={memberId}
          >
            {memberOptions.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
          <label htmlFor="transaction-kind">Type</label>
          <select id="transaction-kind" onChange={(event) => setKind(event.target.value)} value={kind}>
            <option value="contribution">Contribution</option>
            <option value="payout">Payout</option>
          </select>
          <label htmlFor="transaction-amount">Amount</label>
          <input
            id="transaction-amount"
            max="999999999.99"
            min="0.01"
            onChange={(event) => setAmount(event.target.value)}
            required
            step="0.01"
            type="number"
            value={amount}
          />
          <label htmlFor="transaction-note">Note (optional)</label>
          <input
            id="transaction-note"
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            type="text"
            value={note}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="button button-outline" disabled={isSaving} onClick={onClose} type="button">Cancel</button>
            <button className="button button-primary" disabled={isSaving || memberOptions.length === 0} type="submit">
              <Icon name="edit" size={16} /> {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default EditTransactionModal
