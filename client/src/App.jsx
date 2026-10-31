import { useCallback, useMemo, useState } from 'react'
import ActivityFeed from './components/ActivityFeed.jsx'
import CreateGroupModal from './components/CreateGroupModal.jsx'
import GroupsTable from './components/GroupsTable.jsx'
import Icon from './components/Icon.jsx'
import MembersTable from './components/MembersTable.jsx'
import Sidebar from './components/Sidebar.jsx'
import StatCard from './components/StatCard.jsx'
import Topbar from './components/Topbar.jsx'
import ContributionChart from './components/ContributionChart.jsx'
import { activities, groups, members, stats } from './data/dashboard.js'
import './App.css'

const pageTitles = {
  overview: ['Good morning, Shyam', 'Here’s what’s happening with your community today.'],
  groups: ['Your groups', 'Manage the savings groups you’re part of.'],
  members: ['Community members', 'Keep track of the people in your savings groups.'],
  activity: ['Recent activity', 'A closer look at contributions and payouts.'],
}

function App() {
  const [activePage, setActivePage] = useState('overview')
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [groupList, setGroupList] = useState(groups)
  const [notice, setNotice] = useState('')

  const filteredGroups = useMemo(
    () => groupList.filter((group) => group.name.toLowerCase().includes(search.toLowerCase())),
    [groupList, search],
  )
  const filteredMembers = useMemo(
    () => members.filter((member) => (
      `${member.name} ${member.email} ${member.group}`.toLowerCase().includes(search.toLowerCase())
    )),
    [search],
  )
  const filteredActivities = useMemo(
    () => activities.filter((activity) => (
      `${activity.name} ${activity.group} ${activity.kind}`.toLowerCase().includes(search.toLowerCase())
    )),
    [search],
  )

  const handleCloseCreate = useCallback(() => setIsCreateOpen(false), [])

  const handleCreateGroup = useCallback((groupName) => {
    setGroupList((current) => [
      {
        id: `group-${Date.now()}`,
        name: groupName,
        members: 1,
        target: 25000,
        progress: 0,
        color: 'mint',
        initials: groupName.slice(0, 2).toUpperCase(),
      },
      ...current,
    ])
    setIsCreateOpen(false)
    setNotice(`${groupName} was added to your groups.`)
    window.setTimeout(() => setNotice(''), 4000)
  }, [])

  const [title, subtitle] = pageTitles[activePage]

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        <Topbar
          search={search}
          onSearch={setSearch}
          onCreateGroup={() => setIsCreateOpen(true)}
        />
        <div className="page-content">
          <header className="page-heading">
            <div>
              <p className="eyebrow">{activePage === 'overview' ? 'FRIDAY, OCTOBER 31, 2026' : 'COMMONFUND COMMUNITY'}</p>
              <h1>{title}</h1>
              <p className="page-subtitle">{subtitle}</p>
            </div>
            {activePage === 'overview' && (
              <button className="button button-primary heading-action" onClick={() => setIsCreateOpen(true)}>
                <Icon name="plus" />
                <span>New group</span>
              </button>
            )}
          </header>

          {notice && <p className="notice" role="status">{notice}</p>}

          {activePage === 'overview' && (
            <>
              <section className="stats-grid" aria-label="Community overview">
                {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
              </section>
              <section className="overview-grid" aria-label="Contribution overview and recent activity">
                <ContributionChart />
                <ActivityFeed
                  items={filteredActivities.slice(0, 5)}
                  compact
                  onViewAll={() => setActivePage('activity')}
                />
              </section>
              <GroupsTable
                groups={filteredGroups.slice(0, 4)}
                onViewAll={() => setActivePage('groups')}
                onCreate={() => setIsCreateOpen(true)}
                compact
              />
            </>
          )}

          {activePage === 'groups' && (
            <GroupsTable
              groups={filteredGroups}
              onViewAll={() => setActivePage('overview')}
              onCreate={() => setIsCreateOpen(true)}
            />
          )}

          {activePage === 'members' && <MembersTable members={filteredMembers} />}
          {activePage === 'activity' && <ActivityFeed items={filteredActivities} />}
        </div>
      </main>
      {isCreateOpen && (
        <CreateGroupModal
          onClose={handleCloseCreate}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  )
}

export default App
