import Avatar from './Avatar.jsx'
import { formatDate } from '../data/dashboard.js'

function MembersTable({ members }) {
  return (
    <section className="panel members-panel">
      <div className="panel-heading">
        <div>
          <h2>All members</h2>
          <p className="panel-description">
            {members.length} {members.length === 1 ? 'member' : 'members'} across your community
          </p>
        </div>
        <button className="button button-outline" type="button" onClick={() => window.alert('Member invitations are coming soon.')}>
          Invite members
        </button>
      </div>
      {members.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table members-table">
            <thead>
              <tr><th>MEMBER</th><th>GROUP</th><th>JOINED</th><th>STATUS</th></tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="group-cell">
                      <Avatar initials={member.initials} color={member.color} />
                      <div><strong>{member.name}</strong><span>{member.phone || 'No phone provided'}</span></div>
                    </div>
                  </td>
                  <td>{member.group}</td>
                  <td>{formatDate(member.joined)}</td>
                  <td><span className={`status-pill ${member.status === 'Active' ? 'status-active' : 'status-pending'}`}>{member.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-state">No members match your search.</p>}
    </section>
  )
}

export default MembersTable
