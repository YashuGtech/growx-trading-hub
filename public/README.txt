Growx — Frontend Source Package
====================================

This is the complete static frontend of the Growx trading platform.

INCLUDED
--------
  * index.html              Landing page
  * accounts.html           Funded account tiers
  * checkout.html           Order review & terms
  * payment.html            Payment network selector
  * wallet.html             Send USDT (wallet step)
  * verify.html             Transaction proof upload
  * waiting.html            24h verification countdown
  * login.html              Sign in
  * signup.html             Create account
  * dashboard.html          Authenticated trader dashboard
  * contact.html            Contact form + downloads link
  * download.html           Source code download
  * assets/css/main.css         Design system (variables, layout, components)
  * assets/css/animations.css   Reveal / pulse / count-up animations
  * assets/js/main.js           Core interactivity (forms, modal, auth, toast)
  * assets/js/animations.js     Particle / parallax / orbit effects

EXCLUDED
--------
  * screenshots/            Mockup PNGs — not part of the running site

RUNNING
-------
  Just open `index.html` in any modern browser. No build step.
  The site is fully static and depends only on Google Fonts.

NOTES
-----
  * Tailored for USDT-funded prop trading flow.
  * User state (sign-up, selected plan, payment) is held in localStorage.
  * The design system is documented inline in `assets/css/main.css`.
