# admin-campbali

Admin for the Camp Bali website: products, categories, testimonials, FAQs, milestones,
site settings and the Site Editor (the website shown live, click a text or photo to change it).

Saving only changes the draft. The website changes when someone clicks **Publish**.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values
npm run dev            # http://localhost:5173
```

| Variable | What it is |
| --- | --- |
| `VITE_API_URL` | The backend API, e.g. `https://api.example.com/api` |
| `VITE_SITE_URL` | The public website (used by the Site Editor and for image previews) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key. Never the service role key |

The backend must allow this admin's address in `CORS_ORIGINS`, and the website must have it
in `NEXT_PUBLIC_ADMIN_ORIGIN` so the Site Editor can talk to it.

## Deploy (Vercel)

Framework preset: Vite. Build command `npm run build`, output `dist`. `vercel.json` sends every
route to `index.html` so links like `/products/…` work on reload. Set the variables above in
the Vercel project.
