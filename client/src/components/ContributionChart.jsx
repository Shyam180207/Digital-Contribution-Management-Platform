import Icon from './Icon.jsx'

function ContributionChart({ series }) {
  const maximum = Math.max(1, ...series.values)
  const points = series.values.map((value, index) => {
    const x = (index / Math.max(1, series.values.length - 1)) * 600
    const y = 158 - (value / maximum) * 132
    return [x, y]
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const area = `${line} L 600 170 L 0 170 Z`
  const total = series.values.reduce((sum, value) => sum + value, 0)

  return (
    <article className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div>
          <div className="panel-title-row">
            <h2>Contribution activity</h2>
            <button className="info-button" type="button" aria-label="Contribution activity information">i</button>
          </div>
          <p className="panel-description">Daily contribution records from your groups</p>
        </div>
        <span className="chart-period-label">Last 7 days</span>
      </div>
      <div className="chart-summary">
        <strong>{total.toLocaleString('en-IN')}</strong>
        <span className="chart-change"><Icon name="arrowUpRight" size={14} />{series.values.at(-1) ?? 0}</span>
        <span className="chart-summary-label">contributions this week</span>
      </div>
      <div className="chart-wrap">
        <div className="chart-y-labels" aria-hidden="true">
          <span>{maximum}</span><span>{Math.round(maximum * .67)}</span><span>{Math.round(maximum * .33)}</span><span>0</span>
        </div>
        <svg
          aria-label="Daily contribution records for the last seven days"
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
        {series.labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
      </div>
    </article>
  )
}

export default ContributionChart
