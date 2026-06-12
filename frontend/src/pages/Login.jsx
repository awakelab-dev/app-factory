import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const STARS = Array.from({ length: 200 }, (_, i) => ({
  id: i,
  x:        ((i * 7919 + 3)    % 10000) / 100,
  y:        ((i * 6271 + 17)   % 10000) / 100,
  size:     ((i * 1543)        % 18)    / 10 + 0.3,
  opacity:  ((i * 2053)        % 6)     / 10 + 0.15,
  duration: (((i * 3467)       % 35)    + 20) / 10,
  delay:    ((i * 1789)        % 60)    / 10,
}));

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    navigate('/dashboard');
  }

  return (
    <div className="login-container">

      {/* ── Lado esquerdo: formulário ── */}
      <div className="login-left">
        <div className="login-form-wrapper">

          <div className="login-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" fill="#7c5cfc" />
              <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" fill="#0d0d1a" />
            </svg>
            <span>AppFactory</span>
          </div>

          <h1 className="login-title">Inicia sesión</h1>
          <p className="login-subtitle">Bienvenido de vuelta</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className="form-forgot">
              <a href="#">¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" className="btn-login">
              Ingresar
            </button>
          </form>

          <div className="login-register">
            <a href="#">No tengo una cuenta</a>
          </div>

          <footer className="login-footer">Desarrollado | 2026</footer>
        </div>
      </div>

      {/* ── Lado direito: noite estrelada + montanhas ── */}
      <div className="login-right">
        <div className="stars-layer">
          {STARS.map(s => (
            <span
              key={s.id}
              className="star"
              style={{
                left:              `${s.x}%`,
                top:               `${s.y}%`,
                width:             `${s.size}px`,
                height:            `${s.size}px`,
                opacity:           s.opacity,
                animationDuration: `${s.duration}s`,
                animationDelay:    `${s.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="nebula" />

        <div className="right-text">
          <h2>Gestión Inteligente</h2>
          <p>AppFactory</p>
        </div>

        <div className="mountain-layer">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="mountain-svg">
            <defs>
              <linearGradient id="mtn1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e1040" />
                <stop offset="100%" stopColor="#0a0a14" />
              </linearGradient>
              <linearGradient id="mtn2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#140d35" />
                <stop offset="100%" stopColor="#0d0d1a" />
              </linearGradient>
            </defs>
            <polygon
              points="0,320 0,230 160,100 340,200 500,60 700,180 860,30 1080,160 1260,80 1440,190 1440,320"
              fill="url(#mtn1)"
            />
            <polygon
              points="0,320 0,270 200,170 420,250 600,140 820,240 1000,120 1220,210 1440,150 1440,320"
              fill="url(#mtn2)"
            />
            <polygon
              points="0,320 0,300 300,260 600,290 900,255 1200,285 1440,265 1440,320"
              fill="#0a0a14"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
