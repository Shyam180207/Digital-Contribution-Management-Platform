import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'
import { formatCurrency } from '../data/dashboard.js'

function GroupsTable({ groups, onViewAll, onCreate, compact = false }) {
  return (
    <section className="panel groups-panel">
      <div className="panel-heading">
        <div>
          <h2>{compact ? 'Your savings groups' : 'All groups'}</h2>
          <p className="panel-description">{compact ? 'A quick look at your active circles' : `${groups.length} groups in your community`}</p>
        </div>
        <div className="panel-actions">
          {!compact && (
            <button className="button button-outline" onClick={onCreate} type="button">
              <Icon name="plus" size={17} /> New group
            </button>
          )}
          <button className="text-button" onClick={onViewAll} type="button">
            {compact ? 'View all' : 'Back to overview'} <Icon name="chevronRight" size={15} />
          </button>
        </div>
      </div>
      {groups.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table groups-table">
            <thead>
              <tr><th>GROUP NAME</th><th>MEMBERS</th><th>BALANCE</th><th>CURRENCY</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <div className="group-cell">
                      <Avatar initials={group.initials} color={group.color} size="group" />
                      <div><strong>{group.name}</strong><span>Active group</span></div>
                    </div>
                  </td>
                  <td className="member-count">
                    <Icon name="users" size={16} /> {group.members} {group.members === 1 ? 'member' : 'members'}
                  </td>
                  <td className="goal-cell">{formatCurrency(group.balanceMinor, group.currency)}</td>
                  <td>{group.currency}</td>
                  <td><button className="row-action" type="button" aria-label={`Open ${group.name}`}><Icon name="chevronRight" size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-state">No groups found. Try a different search or create a group.</p>}
    </section>
  )
}

export default GroupsTable
