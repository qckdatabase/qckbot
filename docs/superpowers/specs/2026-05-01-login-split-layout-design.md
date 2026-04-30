# Login Page Redesign — Reference-Style Split Layout

## Decision

Adopt the split-panel login layout from `/ai-visibility-check` for the auth route.

## Layout

- Left panel (desktop only): dark navy (`--qck-dark`) with QCK logo, `/ Admin` badge, tagline, and subtle spectral glow blob. Hidden on mobile.
- Right panel: centered sign-in form with Lock icon, "Sign in" heading, email + password fields, and yellow CTA button.
- Both panels share the full viewport height (`100dvh`).

## Components touched

- `app/(auth)/layout.tsx` — split grid structure (no longer a centered card)
- `app/(auth)/layout.module.css` — left branding panel, right form panel, mobile hide/show
- `app/(auth)/login/page.tsx` — no behavior change; only structural class updates
- `app/(auth)/login/page.module.css` — form field, button, and error styling matching reference

## Constraints

- Auth submission logic and API routes unchanged.
- Email + password fields retained (not password-only like reference).
- QCK brand tokens used throughout; no raw hex values added.