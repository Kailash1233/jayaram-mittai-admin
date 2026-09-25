'use client';
import { useState, useTransition } from 'react';
import { login } from '@/lib/actions';
import { Field, Notice, Submit } from './ui';
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMessage('');
        start(async () => {
          try {
            const r = await login({ email, password });
            if (!r.ok) setMessage(r.message);
          } catch {
            setMessage('Unable to reach the sign-in service. Try again.');
          }
        });
      }}
    >
      <Field label="Email address">
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@jayaram.example"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />
      </Field>
      <Notice kind="error" message={message} />
      <Submit busy={pending}>Sign in to workspace</Submit>
    </form>
  );
}
