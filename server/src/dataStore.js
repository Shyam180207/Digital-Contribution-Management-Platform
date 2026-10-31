import Member from '../models/Member.js'
import SavingsGroup from '../models/SavingsGroup.js'
import Transaction from '../models/Transaction.js'
import { HttpError } from './httpError.js'

const avatarColors = ['lavender', 'mint', 'peach', 'blue', 'yellow', 'rose']

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function startOfWeek(date) {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)
  result.setUTCDate(result.getUTCDate() - 6)
  return result
}

export function createDataStore({
  GroupModel = SavingsGroup,
  MemberModel = Member,
  TransactionModel = Transaction,
} = {}) {
  async function getOwnedGroupIds(userId) {
    const groups = await GroupModel.find({ owner: userId }).select('_id').lean()
    return groups.map((group) => group._id)
  }

  return {
    async getDashboard(userId, now = new Date()) {
      const groups = await GroupModel.find({ owner: userId })
        .sort({ createdAt: -1 })
        .lean()
      const groupIds = groups.map((group) => group._id)
      const monthStart = startOfMonth(now)
      const weekStart = startOfWeek(now)

      const [memberCounts, balances, activeMembers, contributionsThisMonth, payoutsThisMonth, chartRows, memberRows, transactionRows] = await Promise.all([
        MemberModel.aggregate([
          { $match: { group: { $in: groupIds } } },
          { $group: { _id: '$group', count: { $sum: 1 } } },
        ]),
        TransactionModel.aggregate([
          { $match: { group: { $in: groupIds } } },
          {
            $group: {
              _id: '$group',
              contributionsMinor: {
                $sum: { $cond: [{ $eq: ['$kind', 'contribution'] }, '$amountMinor', 0] },
              },
              payoutsMinor: {
                $sum: { $cond: [{ $eq: ['$kind', 'payout'] }, '$amountMinor', 0] },
              },
            },
          },
        ]),
        MemberModel.countDocuments({ group: { $in: groupIds } }),
        TransactionModel.countDocuments({
          group: { $in: groupIds },
          kind: 'contribution',
          createdAt: { $gte: monthStart },
        }),
        TransactionModel.countDocuments({
          group: { $in: groupIds },
          kind: 'payout',
          createdAt: { $gte: monthStart },
        }),
        TransactionModel.aggregate([
          {
            $match: {
              group: { $in: groupIds },
              kind: 'contribution',
              createdAt: { $gte: weekStart },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        MemberModel.find({ group: { $in: groupIds } })
          .sort({ createdAt: -1 })
          .limit(100)
          .populate('group', 'name')
          .lean(),
        TransactionModel.find({ group: { $in: groupIds } })
          .sort({ createdAt: -1 })
          .limit(8)
          .populate('member', 'name')
          .populate('group', 'name currency')
          .lean(),
      ])

      const memberCountByGroup = new Map(memberCounts.map((entry) => [String(entry._id), entry.count]))
      const balanceByGroup = new Map(balances.map((entry) => [String(entry._id), entry]))
      const chartByDate = new Map(chartRows.map((entry) => [entry._id, entry.count]))
      const chartLabels = []
      const chartValues = []

      for (let offset = 0; offset < 7; offset += 1) {
        const day = new Date(weekStart)
        day.setUTCDate(day.getUTCDate() + offset)
        const dateKey = day.toISOString().slice(0, 10)
        chartLabels.push(day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }))
        chartValues.push(chartByDate.get(dateKey) ?? 0)
      }

      return {
        summary: {
          activeGroups: groups.length,
          activeMembers,
          contributionsThisMonth,
          payoutsThisMonth,
        },
        groups: groups.map((group, index) => {
          const balance = balanceByGroup.get(String(group._id))
          return {
            id: String(group._id),
            name: group.name,
            currency: group.currency,
            members: memberCountByGroup.get(String(group._id)) ?? 0,
            balanceMinor: (balance?.contributionsMinor ?? 0) - (balance?.payoutsMinor ?? 0),
            color: avatarColors[index % avatarColors.length],
            initials: initials(group.name),
          }
        }),
        members: memberRows.map((member, index) => ({
          id: String(member._id),
          name: member.name,
          phone: member.phone,
          group: member.group?.name ?? 'Group unavailable',
          joined: member.createdAt,
          status: 'Active',
          initials: initials(member.name),
          color: avatarColors[index % avatarColors.length],
        })),
        activities: transactionRows.map((transaction, index) => ({
          id: String(transaction._id),
          name: transaction.member?.name ?? 'Unknown member',
          action: transaction.kind === 'payout' ? 'received a payout' : 'contributed',
          amountMinor: transaction.amountMinor,
          currency: transaction.group?.currency ?? 'USD',
          group: transaction.group?.name ?? 'Group unavailable',
          createdAt: transaction.createdAt,
          kind: transaction.kind === 'payout' ? 'Payout' : 'Contribution',
          initials: initials(transaction.member?.name),
          color: avatarColors[index % avatarColors.length],
        })),
        chart: { labels: chartLabels, values: chartValues },
      }
    },

    async createGroup(userId, groupData) {
      const group = await GroupModel.create({ ...groupData, owner: userId })
      return {
        id: String(group._id),
        name: group.name,
        currency: group.currency,
        members: 0,
        balanceMinor: 0,
        color: avatarColors[0],
        initials: initials(group.name),
      }
    },

    async createMember(userId, groupId, memberData) {
      const group = await GroupModel.findOne({ _id: groupId, owner: userId })
        .select('_id')
        .lean()
      if (!group) throw new HttpError(404, 'Group not found.')

      const member = await MemberModel.create({ ...memberData, group: group._id })
      return {
        id: String(member._id),
        name: member.name,
        phone: member.phone,
        group: String(group._id),
        joined: member.createdAt,
      }
    },

    async listMembers(userId) {
      const groupIds = await getOwnedGroupIds(userId)
      return MemberModel.find({ group: { $in: groupIds } })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('group', 'name')
        .lean()
    },
  }
}
