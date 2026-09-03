-- ============================================================
-- UPDATES FOR YOU — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists institutions (
  id text primary key,
  name text not null,
  type text not null,
  admin_pin text not null,
  created_at timestamptz default now()
);

create table if not exists teachers (
  inst_id text references institutions(id) on delete cascade,
  id text not null,
  name text not null,
  password text not null,
  subject text,
  primary key (inst_id, id)
);

create table if not exists students (
  inst_id text references institutions(id) on delete cascade,
  id text not null,
  name text not null,
  password text not null,
  class_name text,
  primary key (inst_id, id)
);

create table if not exists routine (
  id text primary key,
  inst_id text references institutions(id) on delete cascade,
  start_time text,
  end_time text,
  subject text,
  teacher_id text,
  class_name text
);

create table if not exists holidays (
  inst_id text references institutions(id) on delete cascade,
  date text not null,
  reason text,
  primary key (inst_id, date)
);

create table if not exists attendance (
  id text primary key,
  inst_id text references institutions(id) on delete cascade,
  student_id text,
  teacher_id text,
  subject text,
  date text,
  status text,
  class_name text,
  period_id text
);

-- ------------------------------------------------------------
-- Row Level Security: OPEN policies (matches current app, which
-- has no real login tokens — only ID/password text matching).
-- This means anyone with your anon key can read/write ALL rows.
-- Fine for a prototype/demo. Before real production use, add
-- Supabase Auth and rewrite these policies to check auth.uid().
-- ------------------------------------------------------------
alter table institutions enable row level security;
alter table teachers     enable row level security;
alter table students     enable row level security;
alter table routine      enable row level security;
alter table holidays     enable row level security;
alter table attendance   enable row level security;

create policy "open institutions" on institutions for all using (true) with check (true);
create policy "open teachers"     on teachers     for all using (true) with check (true);
create policy "open students"     on students     for all using (true) with check (true);
create policy "open routine"      on routine      for all using (true) with check (true);
create policy "open holidays"     on holidays     for all using (true) with check (true);
create policy "open attendance"   on attendance   for all using (true) with check (true);

-- ------------------------------------------------------------
-- Demo data (same as the old localStorage demo)
-- ------------------------------------------------------------
insert into institutions (id, name, type, admin_pin) values
  ('CUTM001','Centurion University Demo Campus','College','1234')
on conflict (id) do nothing;

insert into teachers (inst_id, id, name, password, subject) values
  ('CUTM001','T001','Ananya Das','teacher123','Mathematics, Computer Science'),
  ('CUTM001','T002','Rohit Mishra','teacher123','Physics, Chemistry'),
  ('CUTM001','T003','Priya Nanda','teacher123','English, Sports')
on conflict (inst_id, id) do nothing;

insert into students (inst_id, id, name, password, class_name) values
  ('CUTM001','S001','Rahul Kumar','student123','Class 10-A'),
  ('CUTM001','S002','Sneha Das','student123','Class 10-A'),
  ('CUTM001','S003','Amit Sahoo','student123','Class 10-A'),
  ('CUTM001','S004','Riya Patel','student123','Class 10-A')
on conflict (inst_id, id) do nothing;

insert into routine (id, inst_id, start_time, end_time, subject, teacher_id, class_name) values
  ('R1','CUTM001','09:00','10:00','Mathematics','T001','Class 10-A'),
  ('R2','CUTM001','10:00','11:00','Physics','T002','Class 10-A'),
  ('R3','CUTM001','11:00','12:00','English','T003','Class 10-A'),
  ('R4','CUTM001','12:00','13:00','Lunch Break','','' ),
  ('R5','CUTM001','13:00','14:00','Computer Science','T001','Class 10-A'),
  ('R6','CUTM001','14:00','15:00','Chemistry','T002','Class 10-A'),
  ('R7','CUTM001','15:00','16:00','Sports','T003','Class 10-A')
on conflict (id) do nothing;
