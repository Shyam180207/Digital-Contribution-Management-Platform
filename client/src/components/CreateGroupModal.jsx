import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSubmit(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName) onCreate(trimmedName)
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
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Neighborhood Savings Circle"
            ref={inputRef}
            required
            value={name}
          />
          <div className="modal-actions">
            <button className="button button-outline" onClick={onClose} type="button">Cancel</button>
            <button className="button button-primary" disabled={!name.trim()} type="submit">
              <Icon name="plus" size={17} /> Create group
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default CreateGroupModal
