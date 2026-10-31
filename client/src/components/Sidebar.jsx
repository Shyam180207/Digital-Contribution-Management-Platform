import Icon from './Icon.jsx'

const navigation = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'groups', label: 'My groups', icon: 'layers' },
  { id: 'members', label: 'Members', icon: 'users' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
]

function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={() => onNavigate('overview')} aria-label="CommonFund home">
        <span className="brand-mark"><Icon name="wallet" size={21} /></span>
        <span className="brand-name">common<span>fund</span></span>
      </a>

      <div className="workspace-switcher">
        <span className="workspace-avatar">S</span>
        <span className="workspace-copy">
          <strong>Shyam’s workspace</strong>
          <small>Personal account</small>
        </span>
        <Icon name="chevronDown" size={16} />
      </div>

      <p className="nav-label">WORKSPACE</p>
      <nav className="side-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <button
            aria-current={activePage === item.id ? 'page' : undefined}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
            {item.id === 'groups' && <span className="nav-count">12</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <span className="help-icon">?</span>
          <strong>Need a hand?</strong>
          <p>We’re here to help you get started.</p>
          <button type="button" onClick={() => window.alert('Help center coming soon.')}>
            Visit help center <Icon name="chevronRight" size={14} />
          </button>
        </div>
        <button className="profile-button" type="button" aria-label="Account profile">
          <span className="profile-avatar">SK</span>
          <span className="profile-copy"><strong>Shyam Kumar</strong><small>Community admin</small></span>
          <Icon name="chevronDown" size={16} />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
