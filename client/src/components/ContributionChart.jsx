import { useState } from 'react'
import { contributionSeries } from '../data/dashboard.js'
import Icon from './Icon.jsx'

function ContributionChart() {
  const [period, setPeriod] = useState('Month')
  const series = contributionSeries[period]
  const points = series.values.map((value, index) => {
    const x = (index / (series.values.length - 1)) * 600
    const y = 158 - value * 1.28
    return [x, y]
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const area = `${line} L 600 170 L 0 170 Z`

  return (
    <article className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div>
          <div className="panel-title-row">
            <h2>Contribution overview</h2>
            <button className="info-button" type="button" aria-label="Contribution overview information">i</button>
          </div>
          <p className="panel-description">Track how your community is growing</p>
        </div>
        <div className="period-switch" aria-label="Chart time period">
          {Object.keys(contributionSeries).map((range) => (
            <button
              aria-pressed={period === range}
              className={period === range ? 'selected' : ''}
              key={range}
              onClick={() => setPeriod(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-summary">
        <strong>{series.total}</strong>
        <span className="chart-change"><Icon name="arrowUpRight" size={14} />{series.change}</span>
        <span className="chart-summary-label">collected this {period.toLowerCase()}</span>
      </div>
      <div className="chart-wrap">
        <div className="chart-y-labels" aria-hidden="true">
          <span>₹ 30k</span><span>₹ 20k</span><span>₹ 10k</span><span>₹ 0</span>
        </div>
        <svg
          aria-label={`${period} contribution trend chart`}
          className="contribution-chart"
          role="img"
          viewBox="0 0 600 180"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7660d8" stopOpacity=".2" />
              <stop offset="100%" stopColor="#7660d8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[10, 58, 106, 154].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} className="chart-grid-line" />)}
          <path d={area} fill="url(#chartFill)" />
          <path d={line} className="chart-line" />
          {points.map(([x, y], index) => (
            <circle className={index === points.length - 1 ? 'chart-point current' : 'chart-point'} cx={x} cy={y} key={index} r={index === points.length - 1 ? 5 : 2.5} />
          ))}
        </svg>
      </div>
      <div className="chart-x-labels">
        {series.labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </article>
  )
}

export default ContributionChart
