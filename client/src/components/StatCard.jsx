import Icon from './Icon.jsx'

function StatCard({ label, value, change, comparison, icon, tone, trend }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon icon-${tone}`}><Icon name={icon} size={19} /></div>
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
      <p className="stat-comparison">
        <span className={`stat-change ${trend === 'up' ? 'positive' : ''}`}>{change}</span>
        <span>{comparison}</span>
      </p>
    </article>
  )
}

export default StatCard
