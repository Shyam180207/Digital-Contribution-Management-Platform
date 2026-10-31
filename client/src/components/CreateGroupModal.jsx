import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    setError('')
    setIsSaving(true)
    try {
      await onCreate(trimmedName, currency)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section aria-labelledby="create-group-title" aria-modal="true" className="modal-card" role="dialog">
        <button aria-label="Close dialog" className="modal-close" onClick={onClose} type="button"><Icon name="close" /></button>
        <div className="modal-icon"><Icon name="layers" size={22} /></div>
        <h2 id="create-group-title">Create a savings group</h2>
        <p>Bring your community together and start saving toward a shared goal.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="group-name">Group name</label>
          <input
            id="group-name"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Neighborhood Savings Circle"
            ref={inputRef}
            required
            value={name}
          />
          <label htmlFor="group-currency">Currency</label>
          <select
            id="group-currency"
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          >
            <option value="USD">USD — US Dollar</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="KES">KES — Kenyan Shilling</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — Pound Sterling</option>
          </select>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="button button-outline" disabled={isSaving} onClick={onClose} type="button">Cancel</button>
            <button className="button button-primary" disabled={!name.trim() || isSaving} type="submit">
              <Icon name="plus" size={17} /> {isSaving ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default CreateGroupModal
