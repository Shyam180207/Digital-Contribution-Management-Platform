import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'
import { formatCurrency, formatRelativeTime } from '../data/dashboard.js'

function ActivityFeed({ items, compact = false, onViewAll, onEdit, onDelete }) {
  return (
    <article className={`panel activity-panel ${compact ? 'activity-compact' : ''}`}>
      <div className="panel-heading">
        <div>
          <h2>{compact ? 'Recent activity' : 'All activity'}</h2>
          <p className="panel-description">{compact ? 'The latest from your groups' : 'Contributions, payouts, and new members'}</p>
        </div>
        {compact && <span className="live-indicator"><span /> Live</span>}
      </div>
      {items.length > 0 ? (
        <ul className="activity-list">
          {items.map((item) => (
            <li className="activity-item" key={item.id}>
              <Avatar initials={item.initials} color={item.color} />
              <div className="activity-copy">
                <p><strong>{item.name}</strong> {item.action}</p>
                <span>{item.group} <i>·</i> {formatRelativeTime(item.createdAt)}</span>
              </div>
              {item.amountMinor !== null && (
                <strong className={`activity-amount ${item.kind === 'Payout' ? 'payout' : ''}`}>
                  {item.kind === 'Payout' ? '−' : '+'}{formatCurrency(item.amountMinor, item.currency)}
                </strong>
              )}
              {!compact && onEdit && onDelete && (
                <div className="activity-actions">
                  <button
                    aria-label={`Edit ${item.kind.toLowerCase()} for ${item.name}`}
                    className="row-action"
                    onClick={() => onEdit(item)}
                    type="button"
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    aria-label={`Delete ${item.kind.toLowerCase()} for ${item.name}`}
                    className="row-action row-action-danger"
                    onClick={() => onDelete(item)}
                    type="button"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="empty-state">No activity matches your search.</p>}
      {compact && (
        <button className="text-button activity-link" type="button" onClick={onViewAll}>
          See all activity <Icon name="chevronRight" size={15} />
        </button>
      )}
    </article>
  )
}

export default ActivityFeed
