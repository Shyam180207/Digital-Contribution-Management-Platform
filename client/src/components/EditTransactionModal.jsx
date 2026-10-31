import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

function EditTransactionModal({
  transaction,
  members,
  onClose,
  onSave,
  onUploadReceipt,
  onDeleteReceipt,
}) {
  const memberOptions = members.some((member) => member.id === transaction.memberId)
    ? members
    : [{ id: transaction.memberId, name: transaction.name }]
  const [memberId, setMemberId] = useState(transaction.memberId)
  const [kind, setKind] = useState(transaction.kind.toLowerCase())
  const [amount, setAmount] = useState((transaction.amountMinor / 100).toFixed(2))
  const [note, setNote] = useState(transaction.note ?? '')
  const [receipt, setReceipt] = useState(transaction.receipt ?? null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemovingReceipt, setIsRemovingReceipt] = useState(false)
  const isBusy = isSaving || isUploading || isRemovingReceipt
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onClose])

  async function handleReceiptUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setIsUploading(true)
    try {
      setReceipt(await onUploadReceipt(transaction, file))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleReceiptDelete() {
    setError('')
    setIsRemovingReceipt(true)
    try {
      await onDeleteReceipt(transaction)
      setReceipt(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsRemovingReceipt(false)
    }
  }

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
      if (event.target === event.currentTarget && !isBusy) onClose()
    }}>
      <section aria-labelledby="edit-transaction-title" aria-modal="true" className="modal-card" role="dialog">
        <button aria-label="Close dialog" className="modal-close" disabled={isBusy} onClick={onClose} type="button">
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
          <label htmlFor="transaction-receipt">Receipt</label>
          <div className="receipt-control">
            {receipt ? (
              <div className="receipt-current">
                <a
                  download
                  href={`/api/groups/${transaction.groupId}/transactions/${transaction.id}/receipt`}
                >
                  {receipt.fileName}
                </a>
                <button
                  className="text-button"
                  disabled={isBusy}
                  onClick={handleReceiptDelete}
                  type="button"
                >
                  {isRemovingReceipt ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ) : <p className="receipt-empty">No receipt attached</p>}
            <input
              accept="application/pdf,image/jpeg,image/png,image/webp"
              aria-describedby="transaction-receipt-hint"
              disabled={isBusy}
              id="transaction-receipt"
              onChange={handleReceiptUpload}
              type="file"
            />
            <p className="receipt-hint" id="transaction-receipt-hint">
              PDF, JPEG, PNG, or WebP; up to 5 MB.
            </p>
            {isUploading && <p className="receipt-hint" role="status">Uploading receipt…</p>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="button button-outline" disabled={isBusy} onClick={onClose} type="button">Cancel</button>
            <button className="button button-primary" disabled={isBusy || memberOptions.length === 0} type="submit">
              <Icon name="edit" size={16} /> {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default EditTransactionModal
