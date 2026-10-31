export function createStats(summary) {
  return [
    {
      label: 'Contributions this month',
      value: summary.contributionsThisMonth.toLocaleString('en-IN'),
      change: 'This month',
      comparison: 'contribution records',
      icon: 'arrowDownLeft',
      tone: 'lavender',
      trend: 'up',
    },
    {
      label: 'Community members',
      value: summary.activeMembers.toLocaleString('en-IN'),
      change: 'Across',
      comparison: 'your groups',
      icon: 'users',
      tone: 'peach',
      trend: 'neutral',
    },
    {
      label: 'Savings groups',
      value: summary.activeGroups.toLocaleString('en-IN'),
      change: 'Owned by',
      comparison: 'your account',
      icon: 'layers',
      tone: 'mint',
      trend: 'neutral',
    },
    {
      label: 'Payouts this month',
      value: summary.payoutsThisMonth.toLocaleString('en-IN'),
      change: 'This month',
      comparison: 'payout records',
      icon: 'arrowUpRight',
      tone: 'blue',
      trend: 'neutral',
    },
  ]
}

export function formatCurrency(amountMinor, currency = 'USD') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

export function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date) {
  if (!date) return ''
  const difference = new Date(date).getTime() - Date.now()
  const units = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ]
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  for (const [unit, milliseconds] of units) {
    if (Math.abs(difference) >= milliseconds) {
      return formatter.format(Math.round(difference / milliseconds), unit)
    }
  }
  return formatter.format(Math.round(difference / 1000), 'second')
}
