import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  authenticate,
  createGroup as createGroupRequest,
  deleteTransaction as deleteTransactionRequest,
  deleteTransactionReceipt as deleteTransactionReceiptRequest,
  getDashboard,
  getSession,
  signOut,
  suggestTransactionNote as suggestTransactionNoteRequest,
  uploadTransactionReceipt as uploadTransactionReceiptRequest,
  updateTransaction as updateTransactionRequest,
} from './api.js'
import ActivityFeed from './components/ActivityFeed.jsx'
import AuthPage from './components/AuthPage.jsx'
import ContributionChart from './components/ContributionChart.jsx'
import CreateGroupModal from './components/CreateGroupModal.jsx'
import EditTransactionModal from './components/EditTransactionModal.jsx'
import GroupsTable from './components/GroupsTable.jsx'
import Icon from './components/Icon.jsx'
import MembersTable from './components/MembersTable.jsx'
import Sidebar from './components/Sidebar.jsx'
import StatCard from './components/StatCard.jsx'
import Topbar from './components/Topbar.jsx'
import { createStats } from './data/dashboard.js'
import './App.css'

const pageTitles = {
  overview: ['Community overview', 'Here’s what’s happening with your community today.'],
  groups: ['Your groups', 'Manage the savings groups you’re part of.'],
  members: ['Community members', 'Keep track of the people in your savings groups.'],
  activity: ['Recent activity', 'A closer look at contributions and payouts.'],
}

const googleSignInErrors = {
  cancelled: 'Google sign-in was cancelled.',
  failed: 'Google sign-in could not be completed. Please try again.',
  state: 'Google sign-in could not be verified. Please start again.',
}

function App() {
  const [activePage, setActivePage] = useState('overview')
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [notice, setNotice] = useState('')
  const [user, setUser] = useState(null)
  const [csrfToken, setCsrfToken] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const oauthError = new URLSearchParams(window.location.search).get('oauthError')

  const refreshDashboard = useCallback(async () => {
    const data = await getDashboard()
    setDashboard(data)
    setError('')
    return data
  }, [])

  const handleRefreshDashboard = useCallback(async () => {
    try {
      await refreshDashboard()
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [refreshDashboard])

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const sessionData = await getSession()
        if (!active) return
        setCsrfToken(sessionData.csrfToken ?? '')
        setUser(sessionData.user)
        if (sessionData.user) {
          const dashboardData = await getDashboard()
          if (!active) return
          setDashboard(dashboardData)
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()
    return () => { active = false }
  }, [])

  const filteredGroups = useMemo(
    () => (dashboard?.groups ?? []).filter((group) => group.name.toLowerCase().includes(search.toLowerCase())),
    [dashboard, search],
  )
  const filteredMembers = useMemo(
    () => (dashboard?.members ?? []).filter((member) => (
      `${member.name} ${member.phone ?? ''} ${member.group}`.toLowerCase().includes(search.toLowerCase())
    )),
    [dashboard, search],
  )
  const filteredActivities = useMemo(
    () => (dashboard?.activities ?? []).filter((activity) => (
      `${activity.name} ${activity.group} ${activity.kind}`.toLowerCase().includes(search.toLowerCase())
    )),
    [dashboard, search],
  )

  const handleAuthenticate = useCallback(async (mode, credentials) => {
    const result = await authenticate(mode, credentials, csrfToken)
    setUser(result.user)
    setCsrfToken(result.csrfToken)
    try {
      const dashboardData = await getDashboard()
      setDashboard(dashboardData)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [csrfToken])

  const handleLogout = useCallback(async () => {
    try {
      await signOut(csrfToken)
      setUser(null)
      setDashboard(null)
      setCsrfToken('')
      setSearch('')
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [csrfToken])

  const handleCreateGroup = useCallback(async (groupName, currency) => {
    const result = await createGroupRequest(groupName, currency, csrfToken)
    setDashboard((current) => current && ({
      ...current,
      groups: [result.group, ...current.groups],
      summary: { ...current.summary, activeGroups: current.summary.activeGroups + 1 },
    }))
    setIsCreateOpen(false)
    setNotice(`${groupName} was saved to your account.`)
    window.setTimeout(() => setNotice(''), 4000)
    try {
      await refreshDashboard()
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [csrfToken, refreshDashboard])

  const handleUpdateTransaction = useCallback(async (activity, transaction) => {
    await updateTransactionRequest(activity.groupId, activity.id, transaction, csrfToken)
    setEditingActivity(null)
    setNotice('Transaction updated.')
    try {
      await refreshDashboard()
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [csrfToken, refreshDashboard])

  const handleSuggestTransactionNote = useCallback(async (kind) => {
    const result = await suggestTransactionNoteRequest(kind, csrfToken)
    return result.note
  }, [csrfToken])

  const handleDeleteTransaction = useCallback(async (activity) => {
    const confirmed = window.confirm(`Delete this ${activity.kind.toLowerCase()} for ${activity.name}?`)
    if (!confirmed) return

    try {
      await deleteTransactionRequest(activity.groupId, activity.id, csrfToken)
      setNotice('Transaction deleted.')
      await refreshDashboard()
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [csrfToken, refreshDashboard])

  const handleUploadTransactionReceipt = useCallback(async (activity, file) => {
    const result = await uploadTransactionReceiptRequest(
      activity.groupId,
      activity.id,
      file,
      csrfToken,
    )
    setNotice('Receipt uploaded.')
    try {
      await refreshDashboard()
    } catch (requestError) {
      setError(requestError.message)
    }
    return result.receipt
  }, [csrfToken, refreshDashboard])

  const handleDeleteTransactionReceipt = useCallback(async (activity) => {
    await deleteTransactionReceiptRequest(activity.groupId, activity.id, csrfToken)
    setNotice('Receipt removed.')
    try {
      await refreshDashboard()
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [csrfToken, refreshDashboard])

  const stats = dashboard ? createStats(dashboard.summary) : []
  const [title, subtitle] = pageTitles[activePage]

  if (loading) {
    return <main className="app-loading" role="status">Loading your CommonFund workspace…</main>
  }

  if (!user) {
    return (
      <>
        {error && (
          <div className="startup-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()}>Retry connection</button>
          </div>
        )}
        {!error && (
          <AuthPage
            initialError={googleSignInErrors[oauthError] ?? ''}
            onAuthenticate={handleAuthenticate}
          />
        )}
      </>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onLogout={handleLogout}
        user={user}
      />
      <main className="main-content">
        <Topbar
          search={search}
          onSearch={setSearch}
          onCreateGroup={() => setIsCreateOpen(true)}
          onLogout={handleLogout}
        />
        <div className="page-content">
          <header className="page-heading">
            <div>
              <p className="eyebrow">{activePage === 'overview' ? 'YOUR COMMUNITY' : 'COMMONFUND COMMUNITY'}</p>
              <h1>{title}</h1>
              <p className="page-subtitle">{subtitle}</p>
            </div>
            {activePage === 'overview' && (
              <button className="button button-primary heading-action" onClick={() => setIsCreateOpen(true)} type="button">
                <Icon name="plus" />
                <span>New group</span>
              </button>
            )}
          </header>

          {error && (
            <div className="api-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={handleRefreshDashboard}>Retry</button>
            </div>
          )}
          {notice && <p className="notice" role="status">{notice}</p>}

          {dashboard && activePage === 'overview' && (
            <>
              <section className="stats-grid" aria-label="Community overview">
                {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
              </section>
              <section className="overview-grid" aria-label="Contribution overview and recent activity">
                <ContributionChart series={dashboard.chart} />
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

          {dashboard && activePage === 'groups' && (
            <GroupsTable
              groups={filteredGroups}
              onViewAll={() => setActivePage('overview')}
              onCreate={() => setIsCreateOpen(true)}
            />
          )}

          {dashboard && activePage === 'members' && <MembersTable members={filteredMembers} />}
          {dashboard && activePage === 'activity' && (
            <ActivityFeed
              items={filteredActivities}
              onDelete={handleDeleteTransaction}
              onEdit={setEditingActivity}
            />
          )}
        </div>
      </main>
      {isCreateOpen && (
        <CreateGroupModal
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateGroup}
        />
      )}
      {editingActivity && (
        <EditTransactionModal
          members={(dashboard?.members ?? []).filter((member) => member.groupId === editingActivity.groupId)}
          onClose={() => setEditingActivity(null)}
          onDeleteReceipt={handleDeleteTransactionReceipt}
          onSave={handleUpdateTransaction}
          onSuggestNote={handleSuggestTransactionNote}
          onUploadReceipt={handleUploadTransactionReceipt}
          transaction={editingActivity}
        />
      )}
    </div>
  )
}

export default App
