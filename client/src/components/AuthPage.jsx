import { useState } from 'react'
import Icon from './Icon.jsx'

function AuthPage({ initialError = '', onAuthenticate }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(initialError)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRegister = mode === 'register'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

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
        <a className="button button-google" href="/api/auth/google">
          <span aria-hidden="true" className="google-mark">G</span>
          Continue with Google
        </a>
        <div aria-hidden="true" className="auth-divider"><span>or</span></div>
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
          <div className="auth-password-field">
            <input
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              id="password"
              maxLength={128}
              minLength={isRegister ? 10 : 1}
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="password-visibility"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
            </button>
          </div>
          {isRegister && (
            <>
              <p className="auth-password-hint">Use 10–128 characters for your password.</p>
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                autoComplete="new-password"
                id="confirm-password"
                maxLength={128}
                minLength={10}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
              />
            </>
          )}
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
              setConfirmPassword('')
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
