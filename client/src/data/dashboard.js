export const stats = [
  {
    label: 'Total contributions',
    value: '₹ 2,48,500',
    change: '+12.8%',
    comparison: 'vs. last month',
    icon: 'arrowDownLeft',
    tone: 'lavender',
    trend: 'up',
  },
  {
    label: 'Active members',
    value: '128',
    change: '+8',
    comparison: 'new this month',
    icon: 'users',
    tone: 'peach',
    trend: 'up',
  },
  {
    label: 'Active groups',
    value: '12',
    change: '2',
    comparison: 'groups starting soon',
    icon: 'layers',
    tone: 'mint',
    trend: 'neutral',
  },
  {
    label: 'Payouts this month',
    value: '₹ 64,000',
    change: '4',
    comparison: 'payouts completed',
    icon: 'arrowUpRight',
    tone: 'blue',
    trend: 'neutral',
  },
]

export const groups = [
  { id: 'sunrise-circle', name: 'Sunrise Savings Circle', members: 12, target: 120000, progress: 78, color: 'lavender', initials: 'SS' },
  { id: 'greenfield-coop', name: 'Greenfield Co-op', members: 24, target: 240000, progress: 62, color: 'mint', initials: 'GC' },
  { id: 'neighborhood-fund', name: 'Neighborhood Fund', members: 8, target: 80000, progress: 91, color: 'peach', initials: 'NF' },
  { id: 'makers-collective', name: 'Makers Collective', members: 16, target: 160000, progress: 45, color: 'blue', initials: 'MC' },
  { id: 'garden-savers', name: 'Garden Savers', members: 10, target: 100000, progress: 35, color: 'yellow', initials: 'GS' },
]

export const members = [
  { id: 'member-1', name: 'Aarav Sharma', email: 'aarav.sharma@email.com', group: 'Sunrise Savings Circle', joined: 'Oct 12, 2026', status: 'Active', initials: 'AS', color: 'lavender' },
  { id: 'member-2', name: 'Meera Patel', email: 'meera.patel@email.com', group: 'Greenfield Co-op', joined: 'Oct 10, 2026', status: 'Active', initials: 'MP', color: 'peach' },
  { id: 'member-3', name: 'Ishaan Kumar', email: 'ishaan.kumar@email.com', group: 'Neighborhood Fund', joined: 'Oct 08, 2026', status: 'Active', initials: 'IK', color: 'mint' },
  { id: 'member-4', name: 'Ananya Reddy', email: 'ananya.reddy@email.com', group: 'Makers Collective', joined: 'Oct 04, 2026', status: 'Pending', initials: 'AR', color: 'blue' },
  { id: 'member-5', name: 'Rohan Gupta', email: 'rohan.gupta@email.com', group: 'Sunrise Savings Circle', joined: 'Sep 28, 2026', status: 'Active', initials: 'RG', color: 'yellow' },
  { id: 'member-6', name: 'Diya Nair', email: 'diya.nair@email.com', group: 'Garden Savers', joined: 'Sep 23, 2026', status: 'Active', initials: 'DN', color: 'rose' },
]

export const activities = [
  { id: 'activity-1', name: 'Aarav Sharma', action: 'contributed', amount: 2500, group: 'Sunrise Savings Circle', time: '10 min ago', kind: 'Contribution', initials: 'AS', color: 'lavender' },
  { id: 'activity-2', name: 'Meera Patel', action: 'received a payout', amount: 12000, group: 'Greenfield Co-op', time: '42 min ago', kind: 'Payout', initials: 'MP', color: 'peach' },
  { id: 'activity-3', name: 'Ishaan Kumar', action: 'contributed', amount: 5000, group: 'Neighborhood Fund', time: '1 hour ago', kind: 'Contribution', initials: 'IK', color: 'mint' },
  { id: 'activity-4', name: 'Ananya Reddy', action: 'joined', amount: null, group: 'Makers Collective', time: '2 hours ago', kind: 'New member', initials: 'AR', color: 'blue' },
  { id: 'activity-5', name: 'Rohan Gupta', action: 'contributed', amount: 2500, group: 'Sunrise Savings Circle', time: '3 hours ago', kind: 'Contribution', initials: 'RG', color: 'yellow' },
  { id: 'activity-6', name: 'Diya Nair', action: 'contributed', amount: 3000, group: 'Garden Savers', time: 'Yesterday', kind: 'Contribution', initials: 'DN', color: 'rose' },
]

export const contributionSeries = {
  Week: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [38, 55, 44, 72, 60, 85, 68],
    total: '₹ 42,800',
    change: '+8.2%',
  },
  Month: {
    labels: ['1 Oct', '5 Oct', '10 Oct', '15 Oct', '20 Oct', '25 Oct', '31 Oct'],
    values: [28, 44, 38, 64, 53, 78, 70],
    total: '₹ 2,48,500',
    change: '+12.8%',
  },
  Year: {
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    values: [24, 39, 34, 57, 67, 82],
    total: '₹ 18,42,000',
    change: '+18.4%',
  },
}

export function formatCurrency(amount) {
  return `₹ ${amount.toLocaleString('en-IN')}`
}
