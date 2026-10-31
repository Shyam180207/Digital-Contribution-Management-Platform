function Avatar({ initials, color = 'lavender', size = 'normal' }) {
  return <span className={`avatar avatar-${color} avatar-${size}`} aria-hidden="true">{initials}</span>
}

export default Avatar
