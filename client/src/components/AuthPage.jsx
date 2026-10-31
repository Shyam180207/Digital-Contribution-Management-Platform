import { useState } from 'react'
import Icon from './Icon.jsx'

function AuthPage({ onAuthenticate }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRegister = mode === 'register'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await onAuthenticate(mode, { username, password })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark"><Icon name="wallet" size={21} /></span>
          <span className="brand-name">common<span>fund</span></span>
        </div>
        <h1 id="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-description">
          {isRegister ? 'Start organizing contributions with your community.' : 'Sign in to your community workspace.'}
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            autoComplete="username"
            id="username"
            maxLength={40}
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            pattern="[A-Za-z0-9_.-]{3,40}"
            required
            value={username}
          />
          <label htmlFor="password">Password</label>
          <input
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            id="password"
            minLength={isRegister ? 10 : 1}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to CommonFund?'}
          {' '}
          <button
            onClick={() => {
              setMode(isRegister ? 'login' : 'register')
              setError('')
            }}
            type="button"
          >
            {isRegister ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default AuthPage
