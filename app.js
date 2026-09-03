/* ============================================================
   SUPABASE CONFIG — fill these in from your Supabase project:
   Dashboard → Settings → API → Project URL / anon public key
   ============================================================ */
const SUPABASE_URL = "https://lrhuceoknqcxmxkbejcf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyaHVjZW9rbnFjeG14a2JlamNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjY3MTAsImV4cCI6MjEwNDAwMjcxMH0.PLcOJwZzg5t6T8dMaoSJZ1B50aht5ge_1ODfqJ6KnaE";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DB_NOT_CONFIGURED = SUPABASE_URL.includes("YOUR-PROJECT-REF");

let db = { institutions: [] };
let session = null;
let selectedRole = "institution";
let activePage = "overview";
let currentRoutineDay = new Date().getDay();

/* ---------------- row <-> app object mapping ---------------- */
function teacherFromRow(t){return {id:t.id,name:t.name,password:t.password,subject:t.subject||""}}
function teacherToRow(instId,t){return {inst_id:instId,id:t.id,name:t.name,password:t.password,subject:t.subject||""}}
function studentFromRow(s){return {id:s.id,name:s.name,password:s.password,className:s.class_name||""}}
function studentToRow(instId,s){return {inst_id:instId,id:s.id,name:s.name,password:s.password,class_name:s.className||""}}
function routineFromRow(r){return {id:r.id,start:r.start_time,end:r.end_time,subject:r.subject,teacherId:r.teacher_id||"",className:r.class_name||""}}
function routineToRow(instId,r){return {id:r.id,inst_id:instId,start_time:r.start,end_time:r.end,subject:r.subject,teacher_id:r.teacherId||null,class_name:r.className||null}}
function attKey(a){return `${a.date}_${a.periodId}_${a.studentId}`}
function attToRow(instId,a){return {id:attKey(a),inst_id:instId,student_id:a.studentId,teacher_id:a.teacherId,subject:a.subject,date:a.date,status:a.status,class_name:a.className,period_id:a.periodId}}

async function assembleInstitution(row){
  const [tRes,sRes,rRes,hRes,aRes] = await Promise.all([
    sb.from("teachers").select("*").eq("inst_id",row.id),
    sb.from("students").select("*").eq("inst_id",row.id),
    sb.from("routine").select("*").eq("inst_id",row.id),
    sb.from("holidays").select("*").eq("inst_id",row.id),
    sb.from("attendance").select("*").eq("inst_id",row.id)
  ]);
  const holidays={}; (hRes.data||[]).forEach(h=>holidays[h.date]={reason:h.reason});
  const attendance={}; (aRes.data||[]).forEach(a=>{attendance[a.id]={studentId:a.student_id,teacherId:a.teacher_id,subject:a.subject,date:a.date,status:a.status,className:a.class_name,periodId:a.period_id}});
  return {
    id:row.id, name:row.name, type:row.type, adminPin:row.admin_pin, createdAt:row.created_at,
    teachers:(tRes.data||[]).map(teacherFromRow),
    students:(sRes.data||[]).map(studentFromRow),
    routine:(rRes.data||[]).map(routineFromRow).sort((a,b)=>a.start.localeCompare(b.start)),
    holidays, attendance
  };
}

function inst(){return db.institutions.find(x=>x.id===session?.instId)}
function showHome(){hideViews();document.getElementById("homeView").classList.add("active");document.getElementById("logoutBtn").classList.add("hidden")}
function openLogin(){hideViews();document.getElementById("loginView").classList.add("active")}
function hideViews(){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"))}
function setAuthMode(mode){const reg=mode==="register";document.getElementById("registrationPanel").classList.toggle("hidden",!reg);document.getElementById("loginPanel").classList.toggle("hidden",reg);document.getElementById("loginModeBtn").classList.toggle("active",!reg);document.getElementById("registerModeBtn").classList.toggle("active",reg);document.getElementById("loginTitle").textContent=reg?"Register School / College":"Choose login type";}

async function handleRegister(e){
  e.preventDefault();
  const name=document.getElementById("regName").value.trim(),
        id=document.getElementById("regId").value.trim().toUpperCase().replace(/\s+/g,""),
        password=document.getElementById("regPassword").value,
        password2=document.getElementById("regPassword2").value,
        type=document.getElementById("regType").value;
  if(password!==password2)return toast("Passwords do not match.","bad");
  if(password.length<4)return toast("Password must be at least 4 characters.","bad");
  const {data:existing}=await sb.from("institutions").select("id").eq("id",id).maybeSingle();
  if(existing)return toast("That institution ID is already registered.","bad");
  const {error}=await sb.from("institutions").insert({id,name,type,admin_pin:password});
  if(error)return toast("Registration failed: "+error.message,"bad");
  const now=Date.now();
  const defaultRoutine=[
    ["09:00","10:00","1st Class"],["10:00","11:00","2nd Class"],["11:00","12:00","3rd Class"],
    ["12:00","13:00","Lunch Break"],["13:00","14:00","4th Class"],["14:00","15:00","5th Class"],["15:00","16:00","6th Class"]
  ].map((x,i)=>({id:"R"+(now+i),start:x[0],end:x[1],subject:x[2],teacherId:"",className:""}));
  await sb.from("routine").insert(defaultRoutine.map(r=>routineToRow(id,r)));
  document.getElementById("instId").value=id;
  document.getElementById("adminPin").value=password;
  toast("Institution registered successfully. You can now log in.","good");
  setAuthMode("login"); selectRole("institution");
}

function selectRole(role){
  selectedRole=role;
  document.querySelectorAll(".role").forEach(b=>b.classList.toggle("active",b.dataset.role===role));
  document.getElementById("institutionFields").classList.toggle("hidden",role!=="institution");
  document.getElementById("userFields").classList.toggle("hidden",role==="institution");
  document.getElementById("loginTitle").textContent=role==="institution"?"School / College Login":role==="teacher"?"Teacher Login":"Student Login";
  document.getElementById("adminPin").required=role==="institution";
  document.getElementById("instId").required=role==="institution";
  if(document.getElementById("userPassword"))document.getElementById("userPassword").required=role!=="institution";
  if(document.getElementById("userId"))document.getElementById("userId").required=role!=="institution";
  if(document.getElementById("userName"))document.getElementById("userName").required=role!=="institution";
  if(document.getElementById("userInstId"))document.getElementById("userInstId").required=role!=="institution";
}

async function handleLogin(e){
  e.preventDefault();
  if(DB_NOT_CONFIGURED)return toast("Database not configured yet. Add your Supabase URL/key in app.js.","bad");
  const iid=(selectedRole==="institution"?document.getElementById("instId").value:document.getElementById("userInstId").value).trim().toUpperCase();
  const {data:instRow}=await sb.from("institutions").select("*").eq("id",iid).maybeSingle();
  if(!instRow)return toast("Institution not found. Use CUTM001 for the demo.","bad");
  if(selectedRole==="institution"){
    if(document.getElementById("adminPin").value!==instRow.admin_pin)return toast("Incorrect institution password.","bad");
    session={role:"institution",instId:iid,name:instRow.name};
  }else{
    const id=document.getElementById("userId").value.trim().toUpperCase(),
          name=document.getElementById("userName").value.trim().toLowerCase(),
          password=document.getElementById("userPassword").value;
    const table=selectedRole==="teacher"?"teachers":"students";
    const {data:rows}=await sb.from(table).select("*").eq("inst_id",iid);
    const u=(rows||[]).find(x=>x.id.toUpperCase()===id && x.name.toLowerCase()===name && x.password===password);
    if(!u)return toast("ID, name, password or institution is incorrect.","bad");
    session={role:selectedRole,instId:iid,id:u.id,name:u.name};
  }
  const full=await assembleInstitution(instRow);
  db.institutions=[full];
  activePage="overview"; hideViews();document.getElementById("dashboardView").classList.add("active");document.getElementById("logoutBtn").classList.remove("hidden");renderShell();renderPage();
}
function logout(){session=null;showHome()}

function renderShell(){
  const role=session.role;
  document.getElementById("sideName").textContent=session.name;
  document.getElementById("sideRole").textContent=role==="institution"?"Administrator":role==="teacher"?"Teacher":"Student";
  document.getElementById("sideAvatar").textContent=session.name.charAt(0).toUpperCase();
  const nav=role==="institution"
    ? [["overview","▦","Overview"],["teachers","♙","Teachers"],["students","♙","Students"],["routine","◫","Routine Builder"],["holidays","◷","Holidays"],["settings","⚙","Institution"]]
    : role==="teacher"
    ? [["overview","▦","My Dashboard"],["routine","◫","My Routine"],["attendance","✓","Give Attendance"]]
    : [["overview","▦","My Dashboard"],["routine","◫","Weekly Routine"],["attendance","◔","My Attendance"]];
  document.getElementById("sideNav").innerHTML=nav.map(n=>`<button class="nav-btn ${activePage===n[0]?"active":""}" onclick="go('${n[0]}')">${n[1]} &nbsp; ${n[2]}</button>`).join("");
}
function go(page){activePage=page;renderShell();renderPage();document.querySelector(".sidebar")?.classList.remove("open")}
function toggleSidebar(){document.querySelector(".sidebar")?.classList.toggle("open")}
function renderPage(){
  const c=document.getElementById("dashboardContent");
  if(session.role==="institution") c.innerHTML=institutionPage();
  if(session.role==="teacher") c.innerHTML=teacherPage();
  if(session.role==="student") c.innerHTML=studentPage();
}
function pageTitle(title,sub,buttons=""){return `<div class="page-title"><div><div class="eyebrow">UPDATES FOR YOU</div><h1>${title}</h1><p>${sub}</p></div><div class="actions">${buttons}</div></div>`}
function institutionPage(){
 const I=inst();
 if(activePage==="teachers") return pageTitle("Teachers","Add, edit and manage teacher accounts.")+teacherManager(I);
 if(activePage==="students") return pageTitle("Students","Manage student IDs, names and classes.")+studentManager(I);
 if(activePage==="routine") return pageTitle("Routine Builder","Build your own Monday–Saturday timetable.",`<button class="btn primary" onclick="addRoutine()">+ Add Period</button> <button class="btn" onclick="downloadRoutine()">Download Weekly Routine</button>`)+routineManager(I);
 if(activePage==="holidays") return pageTitle("Holiday Calendar","Sunday is universal holiday. Add institution-specific holidays.",`<button class="btn primary" onclick="addHoliday()">+ Add Holiday</button>`)+holidayManager(I);
 if(activePage==="settings") return pageTitle("Institution","Profile and basic configuration.")+settingsManager(I);
 return pageTitle("Administrator Dashboard",`Welcome back. ${I.name}.`)+adminOverview(I);
}
function adminOverview(I){
 const todayName=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
 const todayHoliday=new Date().getDay()===0?{reason:"Universal Sunday holiday"}:I.holidays[dateKey()]||null;
 return `<div class="stats">
  <div class="stat"><small>Teachers</small><strong>${I.teachers.length}</strong></div>
  <div class="stat"><small>Students</small><strong>${I.students.length}</strong></div>
  <div class="stat"><small>Periods / day</small><strong>${I.routine.filter(x=>x.subject!=="Lunch Break").length}</strong></div>
  <div class="stat"><small>Today</small><strong>${todayName}</strong></div>
 </div>
 <div class="grid2">
  <div class="card"><div class="card-head"><h3>Today's Status</h3><span class="badge ${todayHoliday?"red":"green"}">${todayHoliday?"HOLIDAY":"WORKING DAY"}</span></div>
   ${todayHoliday?`<div class="holiday"><b>Reason:</b> ${esc(todayHoliday.reason)}</div>`:`<p class="muted">Normal working day. Teachers can mark attendance only during their assigned active class period.</p>`}
  </div>
  <div class="card"><div class="card-head"><h3>Quick Actions</h3></div>
   <div class="actions"><button class="btn primary" onclick="go('routine')">Edit Routine</button><button class="btn" onclick="go('teachers')">Add Teacher</button><button class="btn" onclick="go('students')">Add Student</button><button class="btn" onclick="go('holidays')">Set Holiday</button></div>
  </div>
 </div>
 <div class="card"><div class="card-head"><h3>Today's Routine</h3><span class="badge purple">${todayName}</span></div>${routineHTML(I,"all")}</div>`;
}
function teacherManager(I){
 return `<div class="card"><div class="card-head"><h3>Teacher Directory</h3><button class="btn primary" onclick="addTeacher()">+ Add Teacher</button></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Subjects</th><th>Action</th></tr></thead><tbody>${I.teachers.map(t=>`<tr><td><b>${esc(t.id)}</b></td><td>${esc(t.name)}</td><td>${esc(t.subject)}</td><td><button class="btn" onclick="editTeacher('${t.id}')">Edit</button> <button class="btn danger" onclick="deleteTeacher('${t.id}')">Delete</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
function studentManager(I){
 return `<div class="card"><div class="card-head"><h3>Student Directory</h3><button class="btn primary" onclick="addStudent()">+ Add Student</button></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Action</th></tr></thead><tbody>${I.students.map(s=>`<tr><td><b>${esc(s.id)}</b></td><td>${esc(s.name)}</td><td>${esc(s.className)}</td><td><button class="btn" onclick="editStudent('${s.id}')">Edit</button> <button class="btn danger" onclick="deleteStudent('${s.id}')">Delete</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
function routineManager(I){
 return `<div class="card"><div class="card-head"><h3>Weekly Timetable</h3><span class="badge gray">Monday – Saturday</span></div>
 <div class="routine">${I.routine.map(r=>`<div class="routine-row"><div class="routine-time">${r.start} – ${r.end}</div><div><div class="routine-sub">${esc(r.subject)}</div><div class="routine-teacher">${r.teacherId?esc(teacherName(I,r.teacherId)):"Break"} • ${esc(r.className||"")}</div></div><div class="actions"><button class="btn" onclick="editRoutine('${r.id}')">Edit</button><button class="btn danger" onclick="deleteRoutine('${r.id}')">×</button></div></div>`).join("")}</div>
 <p class="demo-note">This demo uses the same period structure for Monday–Saturday. You can extend the data model to store a separate routine for each day.</p></div>`;
}
function holidayManager(I){
 const entries=Object.entries(I.holidays);
 return `<div class="card"><div class="card-head"><h3>Declared Holidays</h3></div>${entries.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Reason</th><th>Action</th></tr></thead><tbody>${entries.sort().map(([d,h])=>`<tr><td>${d}</td><td>${esc(h.reason)}</td><td><button class="btn danger" onclick="removeHoliday('${d}')">Remove</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No custom holidays. Sunday remains the universal holiday.</div>`}</div>`;
}
function settingsManager(I){
 return `<div class="card"><h3>Institution Profile</h3><div class="form-grid">
 <label class="wide">Institution name<input id="setName" value="${esc(I.name)}"></label>
 <label>Institution ID<input value="${esc(I.id)}" disabled></label><label>Type<select id="setType"><option ${I.type==="School"?"selected":""}>School</option><option ${I.type==="College"?"selected":""}>College</option></select></label>
 <label>Admin PIN<input id="setPin" value="${esc(I.adminPin)}"></label>
 </div><button class="btn primary" style="margin-top:14px" onclick="saveSettings()">Save Changes</button></div>`;
}
function teacherPage(){
 const I=inst(), T=I.teachers.find(t=>t.id===session.id), active=getCurrentPeriod(I);
 if(activePage==="attendance") return teacherAttendancePage();
 return pageTitle("Teacher Dashboard",`Hello ${T.name}. Your attendance controls are time-restricted.`)+
 `<div class="stats"><div class="stat"><small>Teacher ID</small><strong>${T.id}</strong></div><div class="stat"><small>Today</small><strong>${dayName()}</strong></div><div class="stat"><small>Current time</small><strong>${clock()}</strong></div><div class="stat"><small>Assigned periods</small><strong>${I.routine.filter(r=>r.teacherId===T.id).length}</strong></div></div>
 <div class="grid2"><div class="card"><div class="card-head"><h3>Current Class</h3>${active?`<span class="badge green">LIVE NOW</span>`:`<span class="badge gray">NO CLASS</span>`}</div>${active&&active.teacherId===T.id?`<div class="routine-row current"><div class="routine-time">${active.start} – ${active.end}</div><div><div class="routine-sub">${esc(active.subject)}</div><div class="routine-teacher">${esc(active.className)}</div></div><button class="btn primary" onclick="go('attendance')">Give Attendance</button></div>`:`<div class="empty">${active?`Current period: ${esc(active.subject)} (${esc(active.start)}–${esc(active.end)}). It is not your assigned class.`:"No class is running right now."}</div>`}</div>
 <div class="card"><h3>My Subjects</h3><p class="muted">${esc(T.subject)}</p></div></div>
 <div class="card"><div class="card-head"><h3>My Daily Routine</h3><button class="btn" onclick="downloadRoutine()">Download</button></div>${routineHTML(I,T.id)}</div>`;
}
function studentPage(){
 const I=inst(), S=I.students.find(s=>s.id===session.id);
 if(activePage==="attendance") return studentAttendance(I,S);
 return pageTitle("Student Dashboard",`Welcome ${S.name}. Check your routine and attendance.`)+
 `<div class="stats"><div class="stat"><small>Student ID</small><strong>${S.id}</strong></div><div class="stat"><small>Class</small><strong>${esc(S.className)}</strong></div><div class="stat"><small>Today</small><strong>${dayName()}</strong></div><div class="stat"><small>Attendance</small><strong>${attendancePercent(I,S.id)}%</strong></div></div>
 <div class="grid2"><div class="card"><div class="card-head"><h3>Today's Routine</h3><button class="btn" onclick="downloadRoutine()">Download</button></div>${routineHTML(I,"all")}</div><div class="card"><div class="card-head"><h3>Attendance</h3><span class="badge purple">${attendancePercent(I,S.id)}%</span></div>${attendanceSummary(I,S.id)}</div></div>`;
}
function studentAttendance(I,S){return pageTitle("My Attendance","Subject-wise attendance summary.",`<button class="btn" onclick="downloadAttendance('${S.id}')">Download CSV</button>`)+attendanceSummary(I,S.id,true)}
function attendanceSummary(I,sid,full=false){
 const records=Object.values(I.attendance).filter(x=>x.studentId===sid), subjects=[...new Set(I.routine.filter(r=>r.subject!=="Lunch Break").map(r=>r.subject))];
 const rows=subjects.map(sub=>{const a=records.filter(r=>r.subject===sub),p=a.filter(r=>r.status==="present").length;return `<tr><td>${esc(sub)}</td><td>${p}</td><td>${a.length-p}</td><td>${a.length?Math.round(p/a.length*100):100}%</td></tr>`}).join("");
 return `<div class="table-wrap"><table><thead><tr><th>Subject</th><th>Present</th><th>Absent</th><th>%</th></tr></thead><tbody>${rows||"<tr><td colspan=4>No attendance records yet.</td></tr>"}</tbody></table></div>${full?`<div class="card" style="margin-top:16px"><h3>Recent Records</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Subject</th><th>Status</th></tr></thead><tbody>${records.slice(-20).reverse().map(r=>`<tr><td>${r.date}</td><td>${esc(r.subject)}</td><td><span class="badge ${r.status==="present"?"green":"red"}">${r.status.toUpperCase()}</span></td></tr>`).join("")||"<tr><td colspan=3>No records.</td></tr>"}</tbody></table></div></div>`:""}`;
}
function routineHTML(I,filter){
 let rows=filter==="all"?I.routine:I.routine.filter(r=>r.teacherId===filter);
 const active=getCurrentPeriod(I);
 return `<div class="routine">${rows.map(r=>`<div class="routine-row ${active&&active.id===r.id?"current":""}"><div class="routine-time">${r.start} – ${r.end}</div><div><div class="routine-sub">${esc(r.subject)}</div><div class="routine-teacher">${r.teacherId?esc(teacherName(I,r.teacherId)):"Break"} • ${esc(r.className||"")}</div></div>${active&&active.id===r.id?'<span class="badge green">NOW</span>':""}</div>`).join("")}</div>`;
}
function getCurrentPeriod(I){
 const t=new Date(); const mins=t.getHours()*60+t.getMinutes();
 return I.routine.find(r=>{const [a,b]=[r.start,r.end].map(x=>{let [h,m]=x.split(":").map(Number);return h*60+m});return mins>=a&&mins<b});
}
function clock(){return new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
function dayName(){return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]}
function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function teacherName(I,id){return I.teachers.find(t=>t.id===id)?.name||id}
function attendancePercent(I,sid){const a=Object.values(I.attendance).filter(x=>x.studentId===sid);if(!a.length)return 100;return Math.round(a.filter(x=>x.status==="present").length/a.length*100)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

/* ---------------- mutations: local cache + write-through to Supabase ---------------- */
async function addTeacher(){
 const I=inst(); const id=prompt("Teacher ID:",`T${String(I.teachers.length+1).padStart(3,"0")}`);if(!id)return;
 const name=prompt("Teacher name:");if(!name)return;
 const password=prompt("Create teacher password:","teacher123");if(!password)return;
 const subject=prompt("Subjects taught:","Mathematics");if(!subject)return;
 const t={id:id.toUpperCase(),name,password,subject};
 const {error}=await sb.from("teachers").insert(teacherToRow(I.id,t));
 if(error)return toast("Failed to add teacher: "+error.message,"bad");
 I.teachers.push(t); renderPage(); toast("Teacher added.","good");
}
async function editTeacher(id){
 const I=inst(); const t=I.teachers.find(x=>x.id===id);
 const n=prompt("Teacher name:",t.name);if(n)t.name=n;
 const p=prompt("Password (blank keeps current):","");if(p)t.password=p;
 const s=prompt("Subjects:",t.subject);if(s)t.subject=s;
 const {error}=await sb.from("teachers").update({name:t.name,password:t.password,subject:t.subject}).eq("inst_id",I.id).eq("id",id);
 if(error)return toast("Update failed: "+error.message,"bad");
 renderPage();
}
async function deleteTeacher(id){
 if(!confirm("Delete this teacher?"))return; const I=inst();
 await sb.from("routine").update({teacher_id:null}).eq("inst_id",I.id).eq("teacher_id",id);
 const {error}=await sb.from("teachers").delete().eq("inst_id",I.id).eq("id",id);
 if(error)return toast("Delete failed: "+error.message,"bad");
 I.teachers=I.teachers.filter(x=>x.id!==id); I.routine.forEach(r=>{if(r.teacherId===id)r.teacherId=""});
 renderPage();toast("Teacher deleted.")
}
async function addStudent(){
 const I=inst(),id=prompt("Student ID:",`S${String(I.students.length+1).padStart(3,"0")}`);if(!id)return;
 const name=prompt("Student name:");if(!name)return;
 const password=prompt("Create student password:","student123");if(!password)return;
 const cls=prompt("Class / semester:", "Class 10-A");if(!cls)return;
 const s={id:id.toUpperCase(),name,password,className:cls};
 const {error}=await sb.from("students").insert(studentToRow(I.id,s));
 if(error)return toast("Failed to add student: "+error.message,"bad");
 I.students.push(s); renderPage(); toast("Student added.","good");
}
async function editStudent(id){
 const I=inst(); const s=I.students.find(x=>x.id===id);
 const n=prompt("Student name:",s.name);if(n)s.name=n;
 const p=prompt("Password (blank keeps current):","");if(p)s.password=p;
 const c=prompt("Class / semester:",s.className);if(c)s.className=c;
 const {error}=await sb.from("students").update({name:s.name,password:s.password,class_name:s.className}).eq("inst_id",I.id).eq("id",id);
 if(error)return toast("Update failed: "+error.message,"bad");
 renderPage();
}
async function deleteStudent(id){
 if(!confirm("Delete this student?"))return; const I=inst();
 await sb.from("attendance").delete().eq("inst_id",I.id).eq("student_id",id);
 const {error}=await sb.from("students").delete().eq("inst_id",I.id).eq("id",id);
 if(error)return toast("Delete failed: "+error.message,"bad");
 I.students=I.students.filter(x=>x.id!==id);
 Object.keys(I.attendance).forEach(k=>{if(I.attendance[k].studentId===id)delete I.attendance[k]});
 renderPage();toast("Student deleted.")
}
async function addRoutine(){
 const I=inst();const start=prompt("Start time (HH:MM):","16:00");if(!start)return;
 const end=prompt("End time (HH:MM):","17:00");if(!end)return;
 const subject=prompt("Subject / activity:","Web Development");if(!subject)return;
 const teacherId=prompt("Teacher ID (blank for break):",I.teachers[0]?.id||"");
 const cls=prompt("Class / semester:","Class 10-A");
 const r={id:"R"+Date.now(),start,end,subject,teacherId:(teacherId||"").toUpperCase(),className:cls};
 const {error}=await sb.from("routine").insert(routineToRow(I.id,r));
 if(error)return toast("Failed to add period: "+error.message,"bad");
 I.routine.push(r); I.routine.sort((a,b)=>a.start.localeCompare(b.start));
 renderPage();toast("Period added.","good");
}
async function editRoutine(id){
 const I=inst(); const r=I.routine.find(x=>x.id===id);
 const v=prompt("Subject:",r.subject);if(v)r.subject=v;
 const st=prompt("Start time:",r.start);if(st)r.start=st;
 const en=prompt("End time:",r.end);if(en)r.end=en;
 const t=prompt("Teacher ID:",r.teacherId);if(t!==null)r.teacherId=t.toUpperCase();
 const c=prompt("Class:",r.className);if(c)r.className=c;
 const {error}=await sb.from("routine").update({subject:r.subject,start_time:r.start,end_time:r.end,teacher_id:r.teacherId||null,class_name:r.className}).eq("id",id);
 if(error)return toast("Update failed: "+error.message,"bad");
 I.routine.sort((a,b)=>a.start.localeCompare(b.start)); renderPage();
}
async function deleteRoutine(id){
 if(!confirm("Delete this period?"))return; const I=inst();
 const {error}=await sb.from("routine").delete().eq("id",id);
 if(error)return toast("Delete failed: "+error.message,"bad");
 I.routine=I.routine.filter(x=>x.id!==id); renderPage();
}
async function addHoliday(){
 const I=inst(); const d=prompt("Holiday date (YYYY-MM-DD):",dateKey());if(!d)return;
 const reason=prompt("Specific reason:");if(!reason)return;
 const {error}=await sb.from("holidays").upsert({inst_id:I.id,date:d,reason});
 if(error)return toast("Failed to save holiday: "+error.message,"bad");
 I.holidays[d]={reason}; renderPage();toast("Holiday saved.","good");
}
async function removeHoliday(d){
 const I=inst();
 const {error}=await sb.from("holidays").delete().eq("inst_id",I.id).eq("date",d);
 if(error)return toast("Failed: "+error.message,"bad");
 delete I.holidays[d]; renderPage();
}
async function saveSettings(){
 const I=inst();
 I.name=document.getElementById("setName").value;
 I.type=document.getElementById("setType").value;
 I.adminPin=document.getElementById("setPin").value;
 const {error}=await sb.from("institutions").update({name:I.name,type:I.type,admin_pin:I.adminPin}).eq("id",I.id);
 if(error)return toast("Update failed: "+error.message,"bad");
 session.name=I.name; renderShell(); renderPage(); toast("Institution profile updated.","good");
}
async function markAttendance(){
 const I=inst(), active=getCurrentPeriod(I);
 if(new Date().getDay()===0)return toast("Sunday is a universal holiday.","bad");
 if(!active||active.teacherId!==session.id)return toast("You can only access attendance for your class during its current time slot.","bad");
 const students=I.students.filter(s=>s.className===active.className); if(!students.length)return toast("No students found for this class.","bad");
 const d=dateKey();
 const recs=students.map(s=>{const el=document.querySelector(`[data-att="${s.id}"]`);const status=el?.value||"present";return {studentId:s.id,teacherId:session.id,subject:active.subject,date:d,status,className:s.className,periodId:active.id}});
 const {error}=await sb.from("attendance").upsert(recs.map(r=>attToRow(I.id,r)),{onConflict:"id"});
 if(error)return toast("Failed to save attendance: "+error.message,"bad");
 recs.forEach(r=>{I.attendance[attKey(r)]=r});
 toast("Attendance saved successfully.","good");renderPage()
}
function attendanceForm(I,T){
 const a=getCurrentPeriod(I);
 if(new Date().getDay()===0)return `<div class="card"><div class="holiday"><b>Sunday:</b> Universal holiday. Attendance is unavailable.</div></div>`;
 if(!a||a.teacherId!==T.id)return `<div class="card"><div class="empty">${a?`Current class is <b>${esc(a.subject)}</b>, assigned to ${esc(teacherName(I,a.teacherId))}.`:"No class is currently running."}<br><br>Attendance opens automatically when your assigned class is active.</div></div>`;
 const students=I.students.filter(s=>s.className===a.className);
 return `<div class="card"><div class="card-head"><div><h3>${esc(a.subject)} • ${esc(a.className)}</h3><p class="demo-note">${a.start} – ${a.end} • ${students.length} students</p></div><span class="badge green">LIVE NOW</span></div>
 <div class="table-wrap"><table><thead><tr><th>ID</th><th>Student</th><th>Status</th></tr></thead><tbody>${students.map(s=>`<tr><td>${s.id}</td><td>${esc(s.name)}</td><td><select data-att="${s.id}"><option value="present">Present</option><option value="absent">Absent</option></select></td></tr>`).join("")}</tbody></table></div><button class="btn primary" style="margin-top:15px" onclick="markAttendance()">Save Attendance</button></div>`;
}
function teacherAttendancePage(){
 const I=inst(),T=I.teachers.find(t=>t.id===session.id);
 return pageTitle("Give Attendance","Attendance is enabled only for your currently running class.")+attendanceForm(I,T);
}
function pdfHeader(doc,title,subtitle){
 doc.setFillColor(124,92,255);doc.rect(0,0,doc.internal.pageSize.getWidth(),34,"F");
 doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(16);doc.text("UPDATES FOR YOU",14,15);
 doc.setFontSize(11);doc.setFont("helvetica","normal");doc.text(title,14,24);
 doc.setFontSize(9);doc.text(subtitle,14,30);
 doc.setTextColor(20,20,30);
}
function downloadRoutine(){
 const I=inst();
 const doc=new jspdf.jsPDF();
 pdfHeader(doc,I.name,"Weekly Routine • Monday – Saturday (same schedule each working day) • Sunday: Universal Holiday");
 const rows=I.routine.map(r=>[r.start+" – "+r.end,r.subject,r.teacherId?teacherName(I,r.teacherId):"Break",r.className||""]);
 doc.autoTable({startY:40,head:[["Time","Subject","Teacher","Class"]],body:rows,theme:"grid",headStyles:{fillColor:[139,108,255]},styles:{fontSize:9}});
 doc.save("updates-for-you-weekly-routine.pdf");
}
function downloadAttendance(sid){
 const I=inst(),S=I.students.find(s=>s.id===sid);
 const records=Object.values(I.attendance).filter(x=>x.studentId===sid).sort((a,b)=>a.date.localeCompare(b.date));
 const doc=new jspdf.jsPDF();
 pdfHeader(doc,I.name,`Attendance Record • ${S?S.name+" ("+S.id+")":sid}`);
 const rows=records.map(r=>[r.date,r.subject,r.status.toUpperCase(),teacherName(I,r.teacherId),r.className]);
 doc.autoTable({startY:40,head:[["Date","Subject","Status","Teacher","Class"]],body:rows,theme:"grid",headStyles:{fillColor:[139,108,255]},styles:{fontSize:9}});
 const p=records.length?records.filter(r=>r.status==="present").length:0;
 const pct=records.length?Math.round(p/records.length*100):100;
 const y=doc.lastAutoTable.finalY+10;
 doc.setFontSize(10);doc.text(`Total: ${records.length}  •  Present: ${p}  •  Absent: ${records.length-p}  •  Percentage: ${pct}%`,14,y);
 doc.save(`attendance-${sid}.pdf`);
}
function toggleTheme(){document.body.classList.toggle("light");localStorage.setItem("UFY_THEME",document.body.classList.contains("light")?"light":"dark")}
function toast(msg,kind=""){const t=document.createElement("div");t.className="toast "+(kind==="good"?"good":"");t.textContent=msg;document.getElementById("toast").appendChild(t);setTimeout(()=>t.remove(),3000)}
if(localStorage.getItem("UFY_THEME")==="light")document.body.classList.add("light");
setInterval(()=>{if(session&&document.getElementById("dashboardView").classList.contains("active"))renderPage()},30000);
window.addEventListener("load",()=>{
 selectRole("institution");
 if(DB_NOT_CONFIGURED)toast("Add your Supabase URL & anon key at the top of app.js to enable the database.","bad");
});
