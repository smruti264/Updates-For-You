# UPDATES FOR YOU — Attendance Register

A front-end (HTML + CSS + JS) attendance/routine app, now backed by a real
**Supabase (Postgres) database** instead of browser `localStorage`.

## 1. Create a Supabase project
1. Go to https://supabase.com → **New project** (free tier is enough).
2. Wait for it to finish provisioning.

## 2. Create the tables
1. In your Supabase project, open **SQL Editor → New query**.
2. Paste the entire contents of `schema.sql` (included in this folder) and click **Run**.
   This creates the `institutions`, `teachers`, `students`, `routine`, `holidays`
   and `attendance` tables, sets open access policies, and inserts the same demo
   data as before (`CUTM001` / `1234`, etc).

## 3. Connect the app to your project
1. In Supabase: **Settings → API**. Copy the **Project URL** and the **anon public** key.
2. Open `app.js` and edit the top two lines:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```

## 4. Run it
- Open `index.html` directly in a browser, or
- Upload the folder to a GitHub repository and enable **GitHub Pages**.

All data (institutions, teachers, students, routine, holidays, attendance) now
lives in Supabase, so it's shared across devices and browsers instantly — no
more per-browser `localStorage` copies.

## Demo accounts
- Institution: `CUTM001` / Password `1234`
- Teacher: `T001` / `Ananya Das` / Password `teacher123` / Institution `CUTM001`
- Student: `S001` / `Rahul Kumar` / Password `student123` / Institution `CUTM001`

## Important security note
`schema.sql` sets **open** Row Level Security policies — anyone with your
`anon` key (which is public, visible in the browser) can read and write every
row. This matches the app's current login (plain ID/name/password matching,
no real session tokens), so it's fine for a prototype/demo.

Before using this for real institutions with real student data, you should:
- Add **Supabase Auth** and rewrite the RLS policies to check `auth.uid()`
- Hash passwords instead of storing them as plain text
- Restrict each institution's data to its own authenticated admin/teachers/students
- Add server-side validation for attendance (currently trusted from the browser)
- Add audit logs and rate limiting

The rest of the app (UI, routine builder, attendance flow, CSV/text downloads,
dark/light theme) is unchanged from the original prototype.
