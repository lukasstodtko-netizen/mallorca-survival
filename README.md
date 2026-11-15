# Mallorca Survival 2027

App del evento de mdnss · The Cycling Madness.
Cada push a `main` se publica automáticamente en https://mallorcasurvival.netlify.app.

- `index.html` · estructura de las 7 secciones
- `app.css` · diseño
- `app.js` · lógica (ruta 3D, horarios, inscripción con Supabase, pago con Stripe)
- `sw.js` · funciona sin cobertura
- `assets/` · ruta, maillot, fuentes, logo y patrón

Precio y enlace de Stripe: constantes `PRICE` y `STRIPE_LINK` al principio de `app.js`.
