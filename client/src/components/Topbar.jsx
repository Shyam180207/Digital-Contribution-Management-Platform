import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'

function Topbar({ search, onSearch, onCreateGroup, onLogout }) {
  const searchRef = useRef(null)

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        onSearch('')
        searchRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [onSearch])

  return (
    <header className="topbar">
      <label className="search-box">
        <Icon name="search" size={19} />
        <span className="sr-only">Search groups, members, and activity</span>
        <input
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search anything..."
          ref={searchRef}
          type="search"
          value={search}
        />
        <kbd>⌘ K</kbd>
      </label>
      <div className="topbar-actions">
        <button className="mobile-create" onClick={onCreateGroup} type="button" aria-label="Create a group">
          <Icon name="plus" />
        </button>
        <button className="icon-button signout-action" onClick={onLogout} type="button" aria-label="Sign out">
          <Icon name="logout" size={18} />
        </button>
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          <Icon name="bell" size={20} />
          <span className="notification-dot" />
        </button>
        <span className="topbar-divider" />
        <span className="topbar-date">Oct 31, 2026</span>
      </div>
    </header>
  )
}

export default Topbar
