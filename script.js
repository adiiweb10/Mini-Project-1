const CONFIG = {
  USE_API: true,
  API_BASE_URL: "http://127.0.0.1:5000/api"
};


const categories = [
  {id:1,name:"Water Leakage",severity:9,department:"Water Department"},
  {id:2,name:"Garbage Overflow",severity:7,department:"Sanitation Department"},
  {id:3,name:"Streetlight",severity:6,department:"Electrical Department"},
  {id:4,name:"Road Damage",severity:8,department:"Road Department"},
  {id:5,name:"Criminal Activity",severity:10,department:"Police Department"}
];

const departments = [
  "Water Department",
  "Sanitation Department",
  "Electrical Department",
  "Road Department",
  "Police Department"
];

const statusOrder = ["Submitted","Under Review","In Progress","Resolved"];
const allStatuses = ["Submitted","Under Review","In Progress","Resolved","Rejected"];
let currentComplaintId = null;

function getJSON(key, fallback){
  try{return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));}
  catch{return fallback;}
}
function setJSON(key, value){localStorage.setItem(key, JSON.stringify(value));}
function getUser(){return getJSON("sc_user", null);}
function setUser(user){
  if(user && user.role==="officer") user={...user, role:"field_officer"};
  localStorage.setItem("sc_user", JSON.stringify(user));
}
function getUsers(){return getJSON("sc_users", []);}
function saveUsers(list){setJSON("sc_users", list);}
function getEmployees(){return getJSON("sc_employees", []);}
function saveEmployees(list){setJSON("sc_employees", list);}
function getOfficers(){return getJSON("sc_officers", []);}
function saveOfficers(list){setJSON("sc_officers", list);}
function complaints(){return getJSON("sc_complaints", []);}
function saveComplaints(list){setJSON("sc_complaints", list);}
function getAdmin(){return getUsers().find(u=>u.role==="admin") || null;}
function getOfficerForDepartment(department){return getOfficers().find(o=>o.department===department) || null;}
function departmentForCategory(category){return categories.find(c=>c.name===category)?.department || "General Department";}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function getComplaintCode(c){
  if(!c) return "";
  if(c.trackingId) return c.trackingId;
  if(typeof c.id === "number" && c.id < 1000) return `CMP-${String(c.id).padStart(4, "0")}`;
  return `CMP-${String(c.id).slice(-6)}`;
}
function generateOfficerId(department){
  const codeMap = {
    "Water Department": "WAT",
    "Sanitation Department": "SAN",
    "Electrical Department": "ELE",
    "Road Department": "ROA",
    "Police Department": "POL"
  };
  const prefix = codeMap[department] || "OFF";
  const num = Math.floor(100 + Math.random() * 900);
  return `OFF-${prefix}-${num}`;
}
function isComplaintOwner(c, u){
  if(!u || !c) return false;
  const uEmail = String(u.email || "").toLowerCase().trim();
  const uMobile = String(u.mobile || "").trim();
  const uId = u.id ? String(u.id) : "";
  const uKey = String(userKey(u) ?? "").toLowerCase();   // fixed line

  const cOwnerKey = c.ownerKey ? String(c.ownerKey).toLowerCase() : "";
  const cOwnerId = c.ownerId ? String(c.ownerId) : "";
  const cEmail = String(c.citizenEmail || "").toLowerCase().trim();
  const cMobile = String(c.ownerMobile || "").trim();

  if(uId && (cOwnerId === uId || cOwnerKey === uId.toLowerCase())) return true;
  if(uKey && cOwnerKey && cOwnerKey === uKey) return true;
  if(uEmail && (cEmail === uEmail || cOwnerKey === uEmail)) return true;
  if(uMobile && (cMobile === uMobile || cOwnerKey === uMobile)) return true;

  return false;
}
function copyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>{
      toast(`Copied ${text} to clipboard!`);
    }).catch(()=>{
      toast(`Tracking ID: ${text}`);
    });
  }else{
    toast(`Tracking ID: ${text}`);
  }
}
function priorityScore(c){
  const cat=categories.find(x=>x.name===c.category);
  const severity=cat?.severity||5;
  const safetyBoost = c.safety ? 25 : 0;
  const upvotesScore = Number(c.upvotes||0) * 1.5;
  const ageScore = Number(c.age||0) * 0.5;
  return +(severity * 3.5 + safetyBoost + upvotesScore + ageScore).toFixed(1);
}
function priorityTier(score){return score>=50?"Critical":score>=35?"High":score>=20?"Medium":"Low";}
function statusClass(s){return String(s||"Submitted").toLowerCase().replaceAll(" ","-");}
function roleHome(role){return role==="admin"?"admin":role==="field_officer"?"officer":role==="employee"?"employee":"citizen";}
function photoSrc(p){return p?(p.startsWith("http")||p.startsWith("data:")?p:"http://localhost:5000"+p):"";}
function navigate(route){
  const user=getUser();
  const publicRoutes=["home","login","register"];
  if(!user && !publicRoutes.includes(route)) route="login";
  if(user && (route==="login"||route==="register")) route=roleHome(user.role);
  if(user && route==="admin" && user.role!=="admin") route=roleHome(user.role);
  if(user && route==="officer" && user.role!=="field_officer") route=roleHome(user.role);
  if(user && route==="employee" && user.role!=="employee") route=roleHome(user.role);
  render(route);
}
function toast(message){
  const root=document.getElementById("toastRoot");
  root.innerHTML=`<div class="toast">${esc(message)}</div>`;
  setTimeout(()=>root.innerHTML="",2600);
}

function toggleUserDropdown(event){
  if(event) event.stopPropagation();
  const card = document.getElementById("userDropdownCard");
  const btn = document.getElementById("userMenuBtn");
  if(!card) return;
  const isHidden = card.style.display === "none";
  card.style.display = isHidden ? "block" : "none";
  if(btn) btn.setAttribute("aria-expanded", isHidden ? "true" : "false");
}

document.addEventListener("click", (e)=>{
  const container = document.querySelector(".user-menu-container");
  const card = document.getElementById("userDropdownCard");
  if(card && card.style.display !== "none" && container && !container.contains(e.target)){
    card.style.display = "none";
    const btn = document.getElementById("userMenuBtn");
    if(btn) btn.setAttribute("aria-expanded", "false");
  }
});

function scrollToQueue(){
  const u=getUser();
  if(u?.role!=="admin")return;
  navigate("admin");
  setTimeout(()=>{
    const el=document.getElementById("priorityQueueSection");
    if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
  },60);
}

function navbar(){
  const u=getUser(), n=document.getElementById("navbarActions");
  if(!u){
    n.innerHTML=`<a class="nav-home-link" href="#/" onclick="navigate('home');return false;">Home</a>
      <a class="button button-ghost" href="#/login" onclick="navigate('login');return false;">Login</a>
      <a class="button button-primary" href="#/register" onclick="navigate('register');return false;">Register</a>`;
    return;
  }
  let links="";
  if(u.role==="admin"){
    links=`<a href="#/admin" onclick="navigate('admin');return false;">Admin Dashboard</a>
      <a class="nav-queue-link" href="#/admin#queue" onclick="scrollToQueue();return false;">⚡ Live Priority Queue</a>`;
  }else if(u.role==="field_officer"){
    links=`<a href="#/officer" onclick="navigate('officer');return false;">Officer Dashboard</a>`;
  }else if(u.role==="employee"){
    links=`<a href="#/employee" onclick="navigate('employee');return false;">My Tasks</a>`;
  }else{
    links=`<a href="#/citizen" onclick="navigate('citizen');return false;">My Complaints</a>
      <a class="nav-button" href="#/new" onclick="navigate('new');return false;">+ New Complaint</a>`;
  }
  const roleLabel = u.role === "admin" ? "System Admin" : u.role === "field_officer" ? (u.department || "Field Officer") : u.role === "employee" ? ((u.department || "") + " Employee").trim() : "Citizen";
  const initial = esc((u.name || u.email || "U").charAt(0).toUpperCase());

  n.innerHTML=links+`
    <div class="user-menu-container">
      <button type="button" class="user-pill-btn" id="userMenuBtn" onclick="toggleUserDropdown(event)" title="View user profile" aria-haspopup="true" aria-expanded="false">
        <span class="user-avatar-badge">${initial}</span>
        <span class="user-pill-name">${esc(u.name||u.email||u.mobile)}</span>
        <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
      <div class="user-dropdown-card" id="userDropdownCard" style="display:none;" onclick="event.stopPropagation()">
        <div class="user-dropdown-header">
          <div class="user-avatar-large">${initial}</div>
          <div class="user-dropdown-meta">
            <strong class="user-dropdown-name">${esc(u.name || "User")}</strong>
            <span class="user-role-badge">${esc(roleLabel)}</span>
          </div>
        </div>
        <div class="user-dropdown-body">
          ${u.employeeId ? `<div class="user-info-item"><span class="info-label">🪪 Employee ID</span><span class="info-value">#${esc(u.employeeId)}</span></div>` : ''}
          ${u.mobile ? `<div class="user-info-item"><span class="info-label">📱 Mobile</span><span class="info-value">${esc(u.mobile)}</span></div>` : ''}
          ${u.email ? `<div class="user-info-item"><span class="info-label">✉️ Email</span><span class="info-value">${esc(u.email)}</span></div>` : ''}
          ${u.location ? `<div class="user-info-item"><span class="info-label">📍 Location</span><span class="info-value">${esc(u.location)}</span></div>` : ''}
          ${u.department ? `<div class="user-info-item"><span class="info-label">🏢 Department</span><span class="info-value">${esc(u.department)}</span></div>` : ''}
        </div>
        <div class="user-dropdown-footer">
          <button type="button" class="button button-ghost full logout-btn" onclick="logout(); return false;">Logout</button>
        </div>
      </div>
    </div>
    <button type="button" class="button button-ghost" onclick="logout(); return false;">Logout</button>`;
}

async function syncApiData(){
  if(!CONFIG.USE_API) return;
  try {
    const list = await apiRequest("/complaints");
    if(Array.isArray(list)){
      saveComplaints(list.map(c => ({
        id: c.id,
        trackingId: c.trackingId || c.tracking_id || ("CMP-" + c.id),
        ownerKey: String(c.ownerId || c.citizenEmail || ""),
        ownerId: c.ownerId,
        ownerName: c.ownerName,
        ownerMobile: c.ownerMobile,
        citizenEmail: c.citizenEmail,
        title: c.title,
        category: c.category,
        department: c.department,
        description: c.description,
        location: c.location,
        safety: c.safety,
        upvotes: c.upvotes || 0,
        status: c.status,
        photo: c.photo ? (c.photo.startsWith("http") || c.photo.startsWith("data:") ? c.photo : ("http://localhost:5000" + c.photo)) : "",
        createdAt: c.createdAt,
        age: c.createdAt ? Math.max(0, Math.floor((Date.now()-new Date(c.createdAt).getTime())/86400000)) : 0,
        assignedOfficer: c.assignedOfficer,
        assignedEmployee: c.assignedEmployee || null,
        proofPhoto: c.proofPhoto || "",
        employeeRemark: c.employeeRemark || "",
        proofStatus: c.proofStatus || "",
        proofSubmittedAt: c.proofSubmittedAt || null
      })));
    }
  } catch(e) {}

  try {
    const officers = await apiRequest("/officers");
    if(Array.isArray(officers)){
      saveOfficers(officers.map(o => ({
        id: o.id,
        employeeId: o.employeeId || o.employee_id,
        name: o.name,
        mobile: o.mobile,
        email: o.email,
        department: o.department,
        role: "field_officer"
      })));
    }
  } catch(e) {}

  try {
    const me = getUser();
    if(me && (me.role === "field_officer" || me.role === "admin")){
      const emps = await apiRequest("/officers/employees");
      if(Array.isArray(emps)) saveEmployees(emps);
    }
  } catch(e) {}
}

async function render(route){
  const app=document.getElementById("app");
  const u=getUser();
  if(!u && !["home","login","register"].includes(route)) route="login";
  
  if(CONFIG.USE_API){
    await syncApiData();
  }

  if(route==="home") app.innerHTML=homePage();
  else if(route==="login") app.innerHTML=loginPage();
  else if(route==="register") app.innerHTML=registerPage();
  else if(route==="citizen") app.innerHTML=citizenPage();
  else if(route==="new") app.innerHTML=newComplaintPage();
  else if(route==="detail") app.innerHTML=detailPage(currentComplaintId);
  else if(route==="admin") app.innerHTML=adminPage();
  else if(route==="officer") app.innerHTML=officerPage();
  else if(route==="employee") app.innerHTML=employeePage();
  else app.innerHTML=homePage();
  navbar();
  bindPage(route);
}

function homePage(){
 return `<div class="public-home">
  <section class="hero-section">
   <div class="hero-content">
    <span class="eyebrow">SMART CITIZEN • CIVIC SERVICES</span>
    <h1>Report Problems.<br>Get Them Resolved.<br>Improve Your City.</h1>
    <p>Report civic problems such as potholes, garbage, water leakage and streetlight issues. Our priority system helps authorities handle important complaints first.</p>
    <div class="hero-actions"><button class="button button-primary" onclick="navigate('login')">Login</button><button class="button button-ghost" onclick="navigate('register')">Register</button></div>
   </div>
   <div class="hero-card"><div class="hero-card-icon">🏙️</div><h2>Smart Complaint Management</h2>
    ${["Submit civic complaints","View your complaints after login","Department-wise field officers","Priority-based resolution"].map(x=>`<div class="hero-feature"><span>✓</span><p>${x}</p></div>`).join("")}
   </div>
  </section>
  <section class="public-info">
   <div class="info-card"><div class="info-icon">📝</div><h3>Report & Track</h3><p>Citizens receive a unique Complaint ID after registration for seamless end-to-end tracking.</p></div>
   <div class="info-card"><div class="info-icon">👨‍💼</div><h3>One Officer Per Department</h3><p>The admin creates and controls one field-officer login for each department.</p></div>
   <div class="info-card"><div class="info-icon">⚡</div><h3>Smart Priority</h3><p>Complaints are prioritized according to severity, community support, age and safety impact.</p></div>
  </section>
 </div>`;
}

function loginPage(){
 return `<div class="auth-layout">
  <section class="auth-intro">
   <span class="eyebrow">SMART CITIZEN PORTAL</span>
   <h1>One Portal.<br>Right Access.</h1>
   <p>Sign in with your registered email or mobile. Field officers can also use their Officer ID assigned by Admin.</p>
   <div class="feature-list">
    <span>✓ Citizen complaint portal</span>
    <span>✓ One system administrator</span>
    <span>✓ Department-wise field officers</span>
    <span>✓ Secure role-based access</span>
   </div>
   <div class="login-role-cards">
    <div class="login-role-card">
     <span class="login-role-icon">👤</span>
     <strong>Citizen / Admin</strong>
     <small>Email, mobile or Employee ID + password</small>
    </div>
    <div class="login-role-card login-role-officer">
     <span class="login-role-icon">🪪</span>
     <strong>Field Officer</strong>
     <small>Officer ID (e.g. OFF-WAT-101) or email + password</small>
    </div>
   </div>
  </section>

  <div class="login-tabs-wrap">
   <div class="login-tabs">
    <button type="button" class="login-tab active" id="tabCitizen" onclick="switchLoginTab('citizen')">
     👤 Citizen / Admin
    </button>
    <button type="button" class="login-tab" id="tabOfficer" onclick="switchLoginTab('officer')">
     🪪 Field Officer
    </button>
   </div>

   <!-- Citizen / Admin Login -->
   <form class="form-card login-tab-panel" id="loginFormCitizen" style="display:block">
    <span class="eyebrow">CITIZEN & ADMIN LOGIN</span>
    <h2>Sign In</h2>
    <p class="muted">Citizens, admin and field employees: use your registered email, mobile number or Employee ID (e.g. EMP-WAT-EAST).</p>
    <div id="authError"></div>
    <label>Email or Mobile Number
     <input id="loginIdentifier" type="text" placeholder="e.g. user@email.com or 9876543210" autocomplete="username" required>
    </label>
    <label>Password
     <input id="loginPassword" type="password" placeholder="Enter your password" autocomplete="current-password" required>
    </label>
    <button class="button button-primary full" id="loginButton">Sign In</button>
    <div class="login-divider"><span>OR</span></div>
    <p class="form-footer">New citizen? <a href="#/register" onclick="navigate('register');return false;">Register here</a></p>
   </form>

   <!-- Field Officer Login -->
   <form class="form-card login-tab-panel officer-login-panel" id="loginFormOfficer" style="display:none">
    <span class="eyebrow">FIELD OFFICER LOGIN</span>
    <h2>Officer Sign In</h2>
    <p class="muted">Use your <strong>Officer ID</strong> (assigned by Admin) or registered email/mobile.</p>
    <div class="officer-login-hint">
     <span class="officer-id-example">🪪 OFF-WAT-101</span>
     <span class="officer-id-example">🪪 OFF-POL-204</span>
     <span class="officer-id-example">🪪 OFF-SAN-309</span>
    </div>
    <div id="authErrorOfficer"></div>
    <label>Officer ID, Email or Mobile
     <input id="officerLoginIdentifier" type="text" placeholder="e.g. OFF-WAT-101 or officer@dept.gov.in" autocomplete="username" required>
    </label>
    <label>Password
     <input id="officerLoginPassword" type="password" placeholder="Enter your password" autocomplete="current-password" required>
    </label>
    <button class="button button-primary full" id="officerLoginButton" onclick="handleOfficerLogin(event)">Officer Sign In</button>
    <p class="form-footer" style="margin-top:16px">Officer accounts are created by the <strong>System Admin</strong> only.</p>
   </form>
  </div>
 </div>`;
}
function switchLoginTab(tab){
 const citizen=document.getElementById("loginFormCitizen");
 const officer=document.getElementById("loginFormOfficer");
 const tabC=document.getElementById("tabCitizen");
 const tabO=document.getElementById("tabOfficer");
 if(!citizen||!officer)return;
 if(tab==="citizen"){
  citizen.style.display="block"; officer.style.display="none";
  tabC.classList.add("active"); tabO.classList.remove("active");
 }else{
  citizen.style.display="none"; officer.style.display="block";
  tabC.classList.remove("active"); tabO.classList.add("active");
  document.getElementById("officerLoginIdentifier")?.focus();
 }
}
async function handleOfficerLogin(e){
 e.preventDefault();
 const btn=document.getElementById("officerLoginButton"), err=document.getElementById("authErrorOfficer");
 btn.disabled=true; btn.textContent="Sending OTP..."; err.innerHTML="";
 const identifier=(document.getElementById("officerLoginIdentifier").value||"").trim();
 const password=document.getElementById("officerLoginPassword").value;
 try{
  await apiRequest("/auth/send-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier,password})});
  pendingLogin={identifier,password,officer:true};
  showOtpBox(err);
 }catch(ex){
  if(ex.message.includes("wait 30 seconds")){
   pendingLogin={identifier,password,officer:true};
   showOtpBox(err);
  }else{
   err.innerHTML=`<div class="alert error">${esc(ex.message)}</div>`;
  }
 }
 finally{btn.disabled=false; btn.textContent="Officer Sign In";}
}


function registerPage(){
 const adminExists=!!getAdmin();
 return `<div class="center-page"><form class="form-card form-card-wide" id="registerForm">
  <span class="eyebrow">ACCOUNT REGISTRATION</span><h2>Create an account</h2><p class="muted">Citizens can register themselves. The system allows exactly one Admin; Field Officers are created by the Admin.</p><div id="authError"></div>
  <label>Account Type
    <select id="registerRole" name="role">
      <option value="citizen">Citizen</option>
      ${!adminExists?'<option value="admin">System Admin (one account only)</option>':''}
    </select>
  </label>
  <div id="registerFields">
   <div class="field-grid"><label>Full Name<input name="name" placeholder="Enter full name" required></label>
   <label>Mobile Number<input name="mobile" type="tel" maxlength="10" pattern="[0-9]{10}" placeholder="10-digit mobile number" required></label></div>
   <label>Email Address<input name="email" type="email" placeholder="example@email.com" required></label>
   <label>Location<input name="location" placeholder="Area / Village / City" required></label>
   <div class="field-grid"><label>Password<input name="password" type="password" minlength="6" placeholder="Minimum 6 characters" required></label>
   <label>Confirm Password<input name="confirm_password" type="password" minlength="6" placeholder="Re-enter password" required></label></div>
  </div>
  <div id="adminNotice" class="role-notice" style="display:${adminExists?"none":"block"}">Admin registration is available only while no Admin account exists. After one Admin is created, this option disappears.</div>
  <button class="button button-primary full" id="registerButton">Create Account</button>
  <p class="form-footer">Already registered? <a href="#/login" onclick="navigate('login');return false;">Sign in</a></p>
 </form></div>`;
}

function citizenPage(){
 const u=getUser();
 if(!u) return `<div class="alert error">Please login to view your complaints.</div>`;
 const list=complaints().filter(c => isComplaintOwner(c, u));
 const counts={}; list.forEach(c=>counts[c.status]=(counts[c.status]||0)+1);
 return `<section class="page-heading"><div><span class="eyebrow">CITIZEN PORTAL</span><h1>My Complaints</h1><p class="muted">Track and trace every civic issue you have reported.</p></div><button class="button button-primary" onclick="navigate('new')">+ Report a Problem</button></section>
 <div class="stats-grid"><div class="stat-card"><span>Total</span><strong>${list.length}</strong></div><div class="stat-card"><span>Under Review</span><strong>${counts["Under Review"]||0}</strong></div><div class="stat-card"><span>In Progress</span><strong>${counts["In Progress"]||0}</strong></div><div class="stat-card"><span>Resolved</span><strong>${counts["Resolved"]||0}</strong></div></div>
 <section class="panel citizen-filter-panel" style="margin-bottom:24px;">
  <div class="filters" style="display:flex;gap:12px;flex-wrap:wrap;">
   <input id="citizenSearch" placeholder="🔍 Trace complaint by ID (e.g. CMP-1001), Title, or Area..." style="flex:2;min-width:240px;">
   <select id="citizenStatus" style="flex:1;min-width:130px;">
     <option value="">All Statuses</option>
     ${allStatuses.map(s=>`<option>${s}</option>`).join("")}
   </select>
   <select id="citizenCategory" style="flex:1;min-width:130px;">
     <option value="">All Categories</option>
     ${categories.map(c=>`<option>${c.name}</option>`).join("")}
   </select>
  </div>
 </section>
 <div id="citizenCardsWrap"></div>`;
}

function renderCitizenCards(){
 const root = document.getElementById("citizenCardsWrap");
 if(!root) return;
 const u = getUser();
 if(!u) return;
 const search = (document.getElementById("citizenSearch")?.value || "").toLowerCase().trim();
 const cat = document.getElementById("citizenCategory")?.value || "";
 const st = document.getElementById("citizenStatus")?.value || "";

 const allMyComplaints = complaints().filter(c => isComplaintOwner(c, u));
 const filtered = allMyComplaints.filter(c => {
   const code = getComplaintCode(c).toLowerCase();
   const matchesSearch = !search || 
     c.title.toLowerCase().includes(search) || 
     c.location.toLowerCase().includes(search) || 
     code.includes(search) || 
     String(c.id).includes(search);
   const matchesCat = !cat || c.category === cat;
   const matchesStatus = !st || c.status === st;
   return matchesSearch && matchesCat && matchesStatus;
 });

 if(!allMyComplaints.length){
   root.innerHTML = `<div class="empty-state"><h3>No complaints reported yet</h3><p>You haven't reported any civic complaints yet. Click below to submit your first complaint.</p><button class="button button-primary" onclick="navigate('new')">+ Report a Problem</button></div>`;
   return;
 }

 if(!filtered.length){
   root.innerHTML = `<div class="empty-state"><h3>No matching complaints found</h3><p>No complaint matches "${esc(search || cat || st)}". Try another Complaint ID or clear filters.</p><button class="button button-ghost" onclick="document.getElementById('citizenSearch').value='';document.getElementById('citizenCategory').value='';document.getElementById('citizenStatus').value='';renderCitizenCards();">Reset Filters</button></div>`;
   return;
 }

 root.innerHTML = `<div class="card-grid">${filtered.map(complaintCard).join("")}</div>`;
}

function complaintCard(c){
 const s=priorityScore(c), p=priorityTier(s);
 const code=getComplaintCode(c);
 const idx=statusOrder.indexOf(c.status);
 return `<article class="complaint-card"><div class="card-top">
  <div class="card-tags"><span class="category-chip">${esc(c.category)}</span><span class="tracking-chip" title="Click to copy Complaint ID" onclick="event.stopPropagation();copyText('${code}')">#${code}</span></div>
  <span class="status-badge status-${statusClass(c.status)}">${esc(c.status)}</span>
 </div>
 <h3>${esc(c.title)}</h3><p class="muted clamp">${esc(c.description)}</p>
 <div class="card-mini-track" title="Current Stage: ${esc(c.status)}">
  <span class="mini-track-step ${idx>=0?'active':''}" title="Submitted">1</span>
  <span class="mini-track-line ${idx>=1?'active':''}"></span>
  <span class="mini-track-step ${idx>=1?'active':''}" title="Under Review">2</span>
  <span class="mini-track-line ${idx>=2?'active':''}"></span>
  <span class="mini-track-step ${idx>=2?'active':''}" title="In Progress">3</span>
  <span class="mini-track-line ${idx>=3?'active':''}"></span>
  <span class="mini-track-step ${idx>=3?'active':''}" title="Resolved">✓</span>
 </div>
 <div class="card-meta"><span>📍 ${esc(c.location)}</span><span>👍 ${c.upvotes||0}</span></div>
 <div class="card-bottom"><span class="priority-pill priority-${p.toLowerCase()}">${p}</span><button class="button button-ghost" onclick="openDetail(${c.id})">Trace & View →</button></div></article>`;
}
function newComplaintPage(){
 const u = getUser();
 return `<div class="center-page"><form class="form-card complaint-form" id="complaintForm"><span class="eyebrow">NEW COMPLAINT</span><h1>Report a civic problem</h1><p class="muted">Provide accurate information so the priority engine can rank the issue fairly.</p><div id="complaintError"></div>
 <label>Complaint title<input name="title" maxlength="150" placeholder="e.g. Large pothole near main road" required></label>
 <label>Category<select name="category" required><option value="">Select category</option>${categories.map(c=>`<option>${c.name}</option>`).join("")}</select></label>
 <label>Description<textarea name="description" rows="5" placeholder="Describe the problem, its size/impact and useful details." required></textarea></label>
 <label>Location<input name="location" placeholder="Address / landmark / area" required></label>
 <label>Citizen Email ID<input type="email" name="citizen_email" value="${esc(u?.email||"")}" placeholder="Enter your email address for updates" required></label>
 <label>Photo (optional)<input type="file" name="photo" accept="image/*" id="photoInput"><span id="photoPreview"></span></label>
 <div class="form-actions"><button type="button" class="button button-ghost" onclick="navigate('citizen')">Cancel</button><button class="button button-primary" id="complaintButton">Submit Complaint</button></div></form></div>`;
}
function detailPage(id){
 const c=complaints().find(x=>x.id===Number(id));
 if(!c)return `<div class="alert error">Complaint not found.</div>`;
 const score=priorityScore(c), p=priorityTier(score), idx=statusOrder.indexOf(c.status), u=getUser();
 const canUpvote=u?.role==="citizen";
 const canOfficerUpdate=u?.role==="field_officer" && u.department===departmentForCategory(c.category);
 const canAdminUpdate=u?.role==="admin";
 const code=getComplaintCode(c);
 const officer=getOfficerForDepartment(departmentForCategory(c.category));
 return `<div class="back-row"><button class="button button-ghost" onclick="navigate('${u?.role==='admin'?'admin':u?.role==='field_officer'?'officer':u?.role==='employee'?'employee':'citizen'}')">← Back</button></div>
  <div class="tracking-banner">
   <div>
    <span class="tracking-label">COMPLAINT TRACKING ID</span>
    <div class="tracking-code">#${code}</div>
   </div>
   <button type="button" class="button button-ghost tracking-copy-btn" onclick="copyText('${code}')">📋 Copy Tracking ID</button>
  </div>
  <section class="detail-header"><div><span class="category-chip">${esc(c.category)}</span><h1>${esc(c.title)}</h1><p class="muted">📍 ${esc(c.location)} • ${esc(departmentForCategory(c.category))}${c.citizenEmail?` • ✉️ ${esc(c.citizenEmail)}`:''}</p></div><span class="status-badge status-${statusClass(c.status)}">${esc(c.status)}</span></section>
  <div class="detail-grid"><article class="panel"><h2>Complaint</h2><p class="description">${esc(c.description)}</p>${c.photo?`<img class="complaint-photo" src="${c.photo}" alt="Complaint evidence">`:""}
  <div class="timeline">${statusOrder.map((s,i)=>`<div class="timeline-item ${i<=idx?"done":""}"><span class="timeline-dot"></span><div><strong>${s}</strong><small>${i<=idx?"Status reached":"Waiting for this stage"}</small></div></div>`).join("")}</div></article>
  <aside class="side-stack"><div class="panel priority-panel"><span class="muted">Current priority</span><strong class="big-score">${score.toFixed(1)}</strong><span class="priority-pill priority-${p.toLowerCase()}">${p}</span><p class="small-muted">Priority is dynamically calculated from category severity, safety hazard impact, community upvotes, and age.</p></div>
  <div class="panel"><h3>Assignment</h3><p class="small-muted"><strong>Assigned Employee:</strong> ${c.assignedEmployee?esc(c.assignedEmployee.name)+" ("+esc(c.assignedEmployee.zone)+" Zone)":"Not assigned yet"}</p><p class="small-muted"><strong>Department:</strong> ${esc(departmentForCategory(c.category))}</p><p class="small-muted"><strong>Field Officer:</strong> ${esc(officer?.name||"Not assigned yet")}${officer?.employeeId ? ` <span class="tracking-chip" style="margin-left:4px;" title="Click to copy Officer ID" onclick="copyText('${officer.employeeId}')">#${esc(officer.employeeId)}</span>` : ''}</p></div>
  ${canUpvote?`<div class="panel"><h3>Community support</h3><div class="vote-number">👍 ${c.upvotes||0}</div><p class="small-muted">If affected by the same issue, add your support instead of creating a duplicate.</p><button class="button button-primary full" onclick="upvote(${c.id})">👍 Upvote this issue</button></div>`:""}
  ${canOfficerUpdate?`<div class="panel"><h3>Assign to employee</h3><p class="small-muted">Choose the employee of the zone where this problem is located.</p><select id="assignEmployee" class="full-select"><option value="">-- Select zone employee --</option>${getEmployees().filter(e=>e.department===u.department).map(e=>`<option value="${e.id}" ${c.assignedEmployee&&c.assignedEmployee.id===e.id?"selected":""}>${esc(e.zone)} Zone - ${esc(e.name)} (${e.openTasks||0} open)</option>`).join("")}</select><button class="button button-primary full" onclick="assignEmployee(${c.id})">Assign Task</button></div>`:""}
  ${canAdminUpdate||canOfficerUpdate?`<div class="panel"><h3>Update status</h3><select id="detailStatus" class="full-select">${allStatuses.map(s=>`<option ${s===c.status?"selected":""}>${s}</option>`).join("")}</select><button class="button button-primary full" style="margin-top:10px" onclick="changeStatus(${c.id},document.getElementById('detailStatus').value)">Update Status</button></div>`:""}
  ${proofPanel(c,u)}
  <div class="panel score-breakdown"><h3>Priority Score Factors</h3><div><span>Category Severity × 3.5</span><strong>${((categories.find(x=>x.name===c.category)?.severity||5)*3.5).toFixed(1)}</strong></div><div><span>Safety Hazard Boost</span><strong>${c.safety?"+25.0":"0.0"}</strong></div><div><span>Community Support (${c.upvotes||0} upvotes × 1.5)</span><strong>${((c.upvotes||0)*1.5).toFixed(1)}</strong></div><div><span>Ticket Age (${c.age||0} days × 0.5)</span><strong>${((c.age||0)*.5).toFixed(1)}</strong></div></div></aside></div>`;
}

function adminPage(){
 const u=getUser();
 if(u?.role!=="admin")return `<div class="alert error">Admin access required.</div>`;
 const list=complaints().sort((a,b)=>priorityScore(b)-priorityScore(a));
 const critical=list.filter(c=>priorityScore(c)>=50).length, prog=list.filter(c=>c.status==="In Progress").length, safety=list.filter(c=>c.safety).length;
 const officers=getOfficers();
 return `<section class="page-heading"><div><span class="eyebrow">SYSTEM ADMINISTRATOR</span><h1>Admin Dashboard</h1><p class="muted">Manage complaints, departments and field-officer access.</p></div><button class="button button-ghost" onclick="render('admin')">↻ Refresh</button></section>
 <div class="stats-grid"><div class="stat-card"><span>Queue Size</span><strong>${list.length}</strong></div><div class="stat-card stat-critical"><span>Critical</span><strong>${critical}</strong></div><div class="stat-card"><span>In Progress</span><strong>${prog}</strong></div><div class="stat-card"><span>Safety Hazards</span><strong>${safety}</strong></div></div>
 <section class="panel officer-management"><div class="panel-heading"><div><h2>Department Field Officers</h2><p class="small-muted">Only one field-officer login can exist for each department. The Admin controls these accounts.</p></div></div>
 <div class="officer-grid">${departments.map(dept=>{const o=getOfficerForDepartment(dept);return `<div class="officer-card"><div><span class="eyebrow">${esc(dept)}</span><h3>${esc(o?.name||"No officer assigned")}</h3><p class="small-muted">${o?`${o.employeeId ? `<span class="tracking-chip" style="display:inline-block;margin-bottom:6px" title="Click to copy Officer ID" onclick="copyText('${o.employeeId}')">#${esc(o.employeeId)}</span><br>` : ''}📱 ${esc(o.mobile)}<br>✉ ${esc(o.email)}`:"This department has no field-officer login yet."}</p></div><div>${o?`<button class="button button-ghost" onclick="removeOfficer('${encodeURIComponent(dept)}')">Remove Officer</button>`:`<button class="button button-primary" onclick="showOfficerForm('${encodeURIComponent(dept)}')">Create Officer Login</button>`}</div></div>`}).join("")}</div>
 <div id="officerFormRoot"></div></section>
 <section class="panel queue-panel" id="priorityQueueSection"><div class="panel-heading"><div><h2>Live Priority Queue</h2><p class="small-muted">All complaints, sorted highest priority first.</p></div><div class="filters"><input id="adminSearch" placeholder="Search complaint or ID (e.g. CMP-1001)"><select id="adminCategory"><option value="">All categories</option>${categories.map(c=>`<option>${c.name}</option>`).join("")}</select><select id="adminStatus"><option value="">All status</option>${allStatuses.map(s=>`<option>${s}</option>`).join("")}</select></div></div><div id="adminTableWrap"></div></section>`;
}
function officerPage(){
 const u=getUser();
 if(u?.role!=="field_officer")return `<div class="alert error">Field Officer access required.</div>`;
 const dept=u.department;
 const list=complaints().filter(c=>departmentForCategory(c.category)===dept).sort((a,b)=>priorityScore(b)-priorityScore(a));
 const total=list.length, critical=list.filter(c=>priorityScore(c)>=50).length;
 const prog=list.filter(c=>c.status==="In Progress").length;
 const resolved=list.filter(c=>c.status==="Resolved").length;
 const pending=list.filter(c=>c.status==="Submitted"||c.status==="Under Review").length;
 const initial=esc((u.name||"O").charAt(0).toUpperCase());
 return `
 <div class="officer-profile-banner">
  <div class="officer-profile-avatar">${initial}</div>
  <div class="officer-profile-info">
   <span class="eyebrow">FIELD OFFICER LOGIN</span>
   <h2>${esc(u.name||"Officer")}</h2>
   <div class="officer-profile-meta">
    ${u.employeeId ? `<span class="tracking-chip" title="Click to copy your Officer ID" onclick="copyText('${u.employeeId}')">🪪 #${esc(u.employeeId)}</span>` : ''}
    <span class="officer-dept-badge">🏢 ${esc(dept)}</span>
    ${u.mobile ? `<span>📱 ${esc(u.mobile)}</span>` : ''}
    ${u.email ? `<span>✉️ ${esc(u.email)}</span>` : ''}
   </div>
  </div>
  <button class="button button-ghost" onclick="render('officer')">↻ Refresh</button>
 </div>

 <div class="stats-grid">
  <div class="stat-card"><span>Total Assigned</span><strong>${total}</strong></div>
  <div class="stat-card stat-critical"><span>🔴 Critical</span><strong>${critical}</strong></div>
  <div class="stat-card"><span>⏳ Pending</span><strong>${pending}</strong></div>
  <div class="stat-card"><span>🔧 In Progress</span><strong>${prog}</strong></div>
  <div class="stat-card"><span>✅ Resolved</span><strong>${resolved}</strong></div>
 </div>

 <section class="panel" style="margin-bottom:24px;">
  <div class="panel-heading"><div>
   <h2>👷 Zone-wise Employees</h2>
   <p class="small-muted">Your 5 field employees for <strong>${esc(dept)}</strong>. Assign each complaint to the employee of the zone where the problem is located.</p>
  </div></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">
   ${getEmployees().filter(e=>e.department===dept).map(e=>`<div class="stat-card"><span>📍 ${esc(e.zone)} Zone</span><strong style="font-size:1.05rem;display:block;">${esc(e.name)}</strong><small class="small-muted" style="display:block;margin-top:4px;">${e.openTasks||0} open task${(e.openTasks||0)===1?"":"s"}</small><div style="margin-top:10px;">${e.hasLogin?`<span class="tracking-chip" title="Employee login ID - click to copy" onclick="copyText('${esc(e.loginId)}')">🪪 ${esc(e.loginId)}</span><br>`:""}<button type="button" class="button button-ghost button-sm" style="margin-top:6px;" onclick="showEmployeeLoginForm(${e.id})">${e.hasLogin?"Reset login":"Create login"}</button></div></div>`).join("") || '<div class="small-muted">No employees found. Run seed.py or the employees SQL.</div>'}
  </div>
  <div id="employeeLoginRoot"></div>
 </section>

 <section class="panel queue-panel">
  <div class="panel-heading">
   <div>
    <h2>📋 My Assigned Complaints</h2>
    <p class="small-muted">Complaints routed to <strong>${esc(dept)}</strong> — sorted by priority. Update status directly from this queue.</p>
   </div>
   <div class="filters">
    <input id="officerSearch" placeholder="Search by title, location or ID…" oninput="renderOfficerTable()">
    <select id="officerStatus" onchange="renderOfficerTable()">
     <option value="">All statuses</option>
     ${allStatuses.map(s=>`<option>${s}</option>`).join("")}
    </select>
   </div>
  </div>
  <div id="officerTableWrap"></div>
 </section>`;
}
function officerUpdateStatus(id,status){
 const u=getUser();
 if(!u||u.role!=="field_officer"){toast("Officer login required.");return;}
 const list=complaints(),c=list.find(x=>x.id===Number(id));
 if(!c){toast("Complaint not found.");return;}
 if(departmentForCategory(c.category)!==u.department){toast("This complaint belongs to another department.");return;}
 if(!status){toast("Please select a status.");return;}
 c.status=status;c.updatedBy=u.name;c.updatedAt=new Date().toISOString();
 saveComplaints(list);
 toast(`✅ Complaint #${getComplaintCode(c)} updated to "${status}"`);
 renderOfficerTable();
}
function renderOfficerTable(){
 const root=document.getElementById("officerTableWrap"); if(!root)return;
 const u=getUser();
 const search=(document.getElementById("officerSearch")?.value||"").toLowerCase();
 const st=document.getElementById("officerStatus")?.value||"";
 const list=complaints()
  .filter(c=>departmentForCategory(c.category)===u.department)
  .filter(c=>{
   const code=getComplaintCode(c).toLowerCase();
   const matchSearch=!search||c.title.toLowerCase().includes(search)||c.location.toLowerCase().includes(search)||code.includes(search);
   const matchStatus=!st||c.status===st;
   return matchSearch&&matchStatus;
  })
  .sort((a,b)=>priorityScore(b)-priorityScore(a));

 if(!list.length){
  root.innerHTML=`<div class="empty-state"><h3>No complaints found</h3><p>No complaints are currently assigned to ${esc(u.department)}. Try clearing filters.</p></div>`;
  return;
 }

 root.innerHTML=`<div class="officer-complaint-list">${list.map((c,i)=>{
  const score=priorityScore(c),tier=priorityTier(score),code=getComplaintCode(c),idx=statusOrder.indexOf(c.status);
  const barWidth=Math.min(100,Math.round((score/100)*100));
  return `<div class="officer-complaint-card priority-border-${tier.toLowerCase()}">
   <div class="occ-header">
    <div class="occ-left">
     <span class="tracking-chip" title="Click to copy" onclick="copyText('${code}')">#${code}</span>
     <span class="priority-pill priority-${tier.toLowerCase()}">${tier}</span>
     <span class="occ-rank">Queue #${i+1}</span>
    </div>
    <span class="status-badge status-${statusClass(c.status)}">${esc(c.status)}</span>
   </div>
   <h3 class="occ-title">${esc(c.title)}</h3>
   <p class="occ-desc muted clamp">${esc(c.description)}</p>
   <div class="occ-meta">
    <span>📍 ${esc(c.location)}</span>
    <span>🏷️ ${esc(c.category)}</span>
    ${c.safety?'<span class="safety-tag">⚠️ Safety Hazard</span>':''}
    <span>👍 ${c.upvotes||0} upvotes</span>
    <span>📅 Age: ${c.age||0} days</span>
   </div>
   <div class="occ-priority-bar">
    <span class="priority-score-label">Priority Score:</span>
    <div class="priority-bar-track"><div class="priority-bar-fill priority-fill-${tier.toLowerCase()}" style="width:${barWidth}%"></div></div>
    <strong class="priority-score-val">${score.toFixed(1)} pts</strong>
   </div>
   <div class="occ-mini-track">
    ${statusOrder.map((s,si)=>`<div class="mini-stage ${si<=idx?'active':''}" title="${s}"><span class="mini-stage-dot">${si<statusOrder.length-1?si+1:'✓'}</span><small>${s}</small></div>${si<statusOrder.length-1?'<div class="mini-stage-line '+(si<idx?'active':'')+'"></div>':''}`).join('')}
   </div>
   <div class="occ-actions">
    <button class="button button-ghost button-sm" onclick="openDetail(${c.id})">🔍 View Full Details →</button>
    <div class="occ-update-row">
     <label class="occ-update-label">Update Progress:</label>
     <select class="compact-select" id="sel_${c.id}">
      ${allStatuses.map(s=>`<option ${s===c.status?"selected":""}>${s}</option>`).join("")}
     </select>
     <button class="button button-primary button-sm" onclick="officerUpdateStatus(${c.id},document.getElementById('sel_${c.id}').value)">✓ Save</button>
    </div>
   </div>
  </div>`;
 }).join("")}</div>`;
}
function renderAdminTable(){
 const root=document.getElementById("adminTableWrap"); if(!root)return;
 const search=(document.getElementById("adminSearch")?.value||"").toLowerCase(), cat=document.getElementById("adminCategory")?.value||"", st=document.getElementById("adminStatus")?.value||"";
 const list=complaints().filter(c=>(!search||c.title.toLowerCase().includes(search)||c.location.toLowerCase().includes(search)||getComplaintCode(c).toLowerCase().includes(search))&&( !cat||c.category===cat)&&(!st||c.status===st)).sort((a,b)=>priorityScore(b)-priorityScore(a));
 root.innerHTML=queueTable(list,true);
}
function renderOfficerTable(){
 const root=document.getElementById("officerTableWrap"); if(!root)return;
 const u=getUser();
 const list=complaints().filter(c=>departmentForCategory(c.category)===u.department).sort((a,b)=>priorityScore(b)-priorityScore(a));
 root.innerHTML=queueTable(list,true);
}
function queueTable(list, canUpdate){
 return `<div class="table-wrap"><table class="queue-table"><thead><tr><th>Complaint ID</th><th>Rank</th><th>Complaint</th><th>Category</th><th>Score</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Trace Problem</th><th>Action</th></tr></thead><tbody>${list.map((c,i)=>{let p=priorityTier(priorityScore(c));let code=getComplaintCode(c);return `<tr><td><span class="tracking-chip" title="Click to copy" onclick="copyText('${code}')">#${code}</span></td><td><strong>#${i+1}</strong></td><td><button class="table-title" onclick="openDetail(${c.id})">${esc(c.title)}</button><small>📍 ${esc(c.location)}</small></td><td>${esc(c.category)}<small>${esc(departmentForCategory(c.category))}</small></td><td><strong>${priorityScore(c).toFixed(1)}</strong></td><td><span class="priority-pill priority-${p.toLowerCase()}">${p}</span></td><td><span class="status-badge status-${statusClass(c.status)}">${esc(c.status)}</span>${c.proofStatus==="Submitted"?'<small>📷 Proof submitted</small>':""}</td><td>${getUser()?.role==="field_officer"?`<select class="compact-select" onchange="assignEmployeeInline(${c.id},this.value)"><option value="">Assign to…</option>${getEmployees().filter(e=>e.department===getUser().department).map(e=>`<option value="${e.id}" ${c.assignedEmployee&&c.assignedEmployee.id===e.id?"selected":""}>${esc(e.zone)} - ${esc(e.name)}</option>`).join("")}</select>`:(c.assignedEmployee?esc(c.assignedEmployee.name)+" ("+esc(c.assignedEmployee.zone)+")":"-")}</td><td><button type="button" class="button button-sm trace-btn" onclick="openDetail(${c.id})" title="Trace resolution history and timeline">🔍 Trace Problem →</button></td><td>${canUpdate?`<select class="compact-select" onchange="changeStatus(${c.id},this.value)">${allStatuses.map(s=>`<option ${s===c.status?"selected":""}>${s}</option>`).join("")}</select>`:"-"}</td></tr>`}).join("")}</tbody></table>${!list.length?'<div class="empty-state">No complaints found.</div>':""}</div>`;
}
function showOfficerForm(encodedDepartment){
 const dept=decodeURIComponent(encodedDepartment);
 const root=document.getElementById("officerFormRoot");
 if(!root)return;
 if(getOfficerForDepartment(dept)){toast("This department already has an officer.");return;}
 root.innerHTML=`<form class="panel inline-form" id="officerForm"><div><span class="eyebrow">CREATE FIELD OFFICER</span><h3>${esc(dept)}</h3><p class="small-muted">This creates the single field-officer login for this department.</p></div><input type="hidden" name="department" value="${esc(dept)}"><div class="field-grid"><label>Officer Name<input name="name" required placeholder="Full name"></label><label>Mobile Number<input name="mobile" type="tel" maxlength="10" pattern="[0-9]{10}" required placeholder="10-digit mobile"></label></div><label>Email Address<input name="email" type="email" required placeholder="officer@example.com"></label><div class="field-grid"><label>Password<input name="password" type="password" minlength="6" required placeholder="Minimum 6 characters"></label><label>Confirm Password<input name="confirm_password" type="password" minlength="6" required placeholder="Re-enter password"></label></div><div id="officerError"></div><div class="form-actions"><button type="button" class="button button-ghost" onclick="document.getElementById('officerFormRoot').innerHTML=''">Cancel</button><button class="button button-primary">Create Officer Login</button></div></form>`;
 root.querySelector("form").addEventListener("submit",handleOfficerCreate);
 root.scrollIntoView({behavior:"smooth",block:"center"});
}
async function handleOfficerCreate(e){
 e.preventDefault();
 const data=Object.fromEntries(new FormData(e.target).entries()), err=document.getElementById("officerError"); err.innerHTML="";
 if(getUser()?.role!=="admin")return;
 if(data.password!==data.confirm_password){err.innerHTML='<div class="alert error">Passwords do not match.</div>';return;}
 if(!/^[0-9]{10}$/.test(data.mobile)){err.innerHTML='<div class="alert error">Enter a valid 10-digit mobile number.</div>';return;}
 try{
  if(CONFIG.USE_API){
   const result = await apiRequest("/officers", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:data.name, mobile:data.mobile, email:data.email, department:data.department, password:data.password})});
   const empId = result.officer?.employeeId || result.officer?.employee_id;
   toast(`🎉 ${data.department} officer registered! Employee ID: #${empId}`);
  }else{
   const officers=getOfficers(), users=getUsers();
   if(officers.some(o=>o.department===data.department)){err.innerHTML='<div class="alert error">This department already has one field officer.</div>';return;}
   if(users.some(u=>u.email.toLowerCase()===data.email.toLowerCase())){err.innerHTML='<div class="alert error">Email is already in use.</div>';return;}
   if(users.some(u=>u.mobile===data.mobile)){err.innerHTML='<div class="alert error">Mobile number is already in use.</div>';return;}
   const empId = generateOfficerId(data.department);
   const officer={id:"officer_"+Date.now(),employeeId:empId,name:data.name,mobile:data.mobile,email:data.email,location:"",password:data.password,role:"field_officer",department:data.department,createdBy:getUser().email};
   officers.push(officer); saveOfficers(officers);
   users.push(officer); saveUsers(users);
   toast(`🎉 ${data.department} officer registered! Employee ID: #${empId}`);
  }
  render("admin");
 }catch(ex){if(err)err.innerHTML=`<div class="alert error">${esc(ex.message)}</div>`;}
}
async function removeOfficer(encodedDepartment){
 const dept=decodeURIComponent(encodedDepartment), officer=getOfficerForDepartment(dept);
 if(!confirm(`Remove the field officer login for ${dept}?`))return;
 try{
  if(CONFIG.USE_API){
   const officers = await apiRequest("/officers");
   const target = officers.find(o=>o.department===dept);
   if(target) await apiRequest(`/officers/${target.id}`, {method:"DELETE"});
  }else{
   if(!officer)return;
   saveOfficers(getOfficers().filter(o=>o.department!==dept));
   saveUsers(getUsers().filter(u=>u.id!==officer.id));
  }
  toast(`${dept} officer login removed.`);render("admin");
 }catch(ex){toast(ex.message);}
}
function openDetail(id){currentComplaintId=id;navigate("detail");}
async function upvote(id){
 if(getUser()?.role!=="citizen")return toast("Only citizens can upvote complaints.");
 try{
  if(CONFIG.USE_API){
   const res = await apiRequest(`/complaints/${id}/upvote`, {method:"POST"});
   toast("Your support has been added!");
  }else{
   const list=complaints(), c=list.find(x=>x.id===Number(id)); if(!c)return;
   c.upvotes=(c.upvotes||0)+1; saveComplaints(list); toast("Your support has been added!");
  }
  render("detail");
 }catch(ex){toast(ex.message);}
}
async function assignEmployeeInline(id,value){
 const employee_id=Number(value||0);
 if(!employee_id) return;
 try{
  const res=await apiRequest(`/complaints/${id}/assign-employee`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employee_id})});
  toast(res.message||"Task assigned.");
  render("officer");
 }catch(ex){toast(ex.message);}
}
async function assignEmployee(id){
 const sel=document.getElementById("assignEmployee");
 const employee_id=Number(sel?.value||0);
 if(!employee_id){toast("Please select an employee first.");return;}
 try{
  const res=await apiRequest(`/complaints/${id}/assign-employee`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employee_id})});
  toast(res.message||"Task assigned.");
  render("detail");
 }catch(ex){toast(ex.message);}
}
async function changeStatus(id,status){
 const u=getUser();
 if(!u || !["admin","field_officer"].includes(u.role)){toast("You do not have permission to update status.");return;}
 try{
  if(CONFIG.USE_API){
   await apiRequest(`/complaints/${id}/status`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status})});
  }else{
   const list=complaints(), c=list.find(x=>x.id===Number(id)); if(!c)return;
   if(u.role==="field_officer" && departmentForCategory(c.category)!==u.department){toast("This complaint belongs to another department.");return;}
   c.status=status; c.updatedBy=u.name; c.updatedAt=new Date().toISOString(); saveComplaints(list);
  }
  toast("Complaint status updated."); render(u.role==="admin"?"admin":"officer");
 }catch(ex){toast(ex.message);}
}

function bindPage(route){
 if(route==="citizen"){
  ["citizenSearch","citizenCategory","citizenStatus"].forEach(id=>document.getElementById(id)?.addEventListener("input",renderCitizenCards));
  renderCitizenCards();
 }
 if(route==="login"){
  document.getElementById("loginFormCitizen")?.addEventListener("submit",handleLogin);
  document.getElementById("loginFormOfficer")?.addEventListener("submit",handleOfficerLogin);
 }
 if(route==="register"){
  document.getElementById("registerForm")?.addEventListener("submit",handleRegister);
  document.getElementById("registerRole")?.addEventListener("change",toggleRegisterRole);
  toggleRegisterRole();
 }
 if(route==="new"){
  document.getElementById("complaintForm")?.addEventListener("submit",handleComplaint);
  document.getElementById("photoInput")?.addEventListener("change",e=>{
    const file=e.target.files[0], root=document.getElementById("photoPreview");
    if(!file){root.innerHTML="";return;}
    const r=new FileReader(); r.onload=()=>root.innerHTML=`<img class="photo-preview" src="${r.result}" alt="Preview">`; r.readAsDataURL(file);
  });
 }
 if(route==="admin"){
  ["adminSearch","adminCategory","adminStatus"].forEach(id=>document.getElementById(id)?.addEventListener("input",renderAdminTable));
  renderAdminTable();
 }
 if(route==="officer"){
  renderOfficerTable();
  document.getElementById("officerSearch")?.addEventListener("input",renderOfficerTable);
  document.getElementById("officerStatus")?.addEventListener("change",renderOfficerTable);
 }
}

/* ===================== FIELD EMPLOYEE FEATURES ===================== */
function proofPanel(c,u){
 if(!c.proofPhoto) return "";
 const canReview=u?.role==="field_officer" && u.department===departmentForCategory(c.category) && c.proofStatus==="Submitted";
 return `<div class="panel"><h3>📷 Work Proof</h3>
  <img class="complaint-photo" src="${photoSrc(c.proofPhoto)}" alt="Work proof photo">
  ${c.employeeRemark?`<p class="small-muted"><strong>Employee remark:</strong> ${esc(c.employeeRemark)}</p>`:""}
  <p class="small-muted"><strong>Review status:</strong> ${esc(c.proofStatus||"-")}${c.proofSubmittedAt?" • "+new Date(c.proofSubmittedAt).toLocaleString():""}</p>
  ${canReview?`<div style="display:flex;gap:8px;margin-top:10px;"><button class="button button-primary full" onclick="reviewProof(${c.id},'approve')">✓ Approve & Resolve</button><button class="button button-ghost full" onclick="reviewProof(${c.id},'reject')">↩ Send back</button></div>`:""}
 </div>`;
}
async function reviewProof(id,action){
 try{
  const res=await apiRequest(`/complaints/${id}/review-proof`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
  toast(res.message||"Review saved.");
  render("detail");
 }catch(ex){toast(ex.message);}
}
function showEmployeeLoginForm(empId){
 const emp=getEmployees().find(e=>e.id===Number(empId));
 const root=document.getElementById("employeeLoginRoot");
 if(!emp||!root)return;
 root.innerHTML=`<form class="panel inline-form" id="employeeLoginForm" style="margin-top:16px;">
  <div><span class="eyebrow">${emp.hasLogin?"RESET EMPLOYEE LOGIN":"CREATE EMPLOYEE LOGIN"}</span><h3>${esc(emp.name)} • ${esc(emp.zone)} Zone</h3>
  <p class="small-muted">Login ID will be <strong>EMP-${esc((departmentCode(emp.department)))}-${esc(emp.zone.toUpperCase())}</strong>. The employee signs in with this ID, email or mobile + password (OTP is sent to the email below).</p></div>
  <input type="hidden" name="employee_id" value="${emp.id}">
  <div class="field-grid"><label>Mobile Number<input name="mobile" type="tel" maxlength="10" pattern="[0-9]{10}" required value="${esc(emp.mobile||"")}" placeholder="10-digit mobile"></label>
  <label>Email Address<input name="email" type="email" required placeholder="employee@example.com"></label></div>
  <div class="field-grid"><label>Password<input name="password" type="password" minlength="6" required placeholder="Minimum 6 characters"></label>
  <label>Confirm Password<input name="confirm_password" type="password" minlength="6" required placeholder="Re-enter password"></label></div>
  <div id="employeeLoginError"></div>
  <div class="form-actions"><button type="button" class="button button-ghost" onclick="document.getElementById('employeeLoginRoot').innerHTML=''">Cancel</button><button class="button button-primary">${emp.hasLogin?"Reset Login":"Create Login"}</button></div>
 </form>`;
 root.querySelector("form").addEventListener("submit",handleEmployeeLoginCreate);
 root.scrollIntoView({behavior:"smooth",block:"center"});
}
function departmentCode(dept){return ({"Water Department":"WAT","Sanitation Department":"SAN","Electrical Department":"ELE","Road Department":"ROA","Police Department":"POL"})[dept]||"OFF";}
async function handleEmployeeLoginCreate(e){
 e.preventDefault();
 const data=Object.fromEntries(new FormData(e.target).entries()), err=document.getElementById("employeeLoginError"); err.innerHTML="";
 if(getUser()?.role!=="field_officer")return;
 if(data.password!==data.confirm_password){err.innerHTML='<div class="alert error">Passwords do not match.</div>';return;}
 if(!/^[0-9]{10}$/.test(data.mobile)){err.innerHTML='<div class="alert error">Enter a valid 10-digit mobile number.</div>';return;}
 try{
  const res=await apiRequest(`/officers/employees/${data.employee_id}/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mobile:data.mobile,email:data.email,password:data.password})});
  toast(res.message||"Employee login saved.");
  render("officer");
 }catch(ex){err.innerHTML=`<div class="alert error">${esc(ex.message)}</div>`;}
}
function employeePage(){
 const u=getUser();
 if(u?.role!=="employee")return `<div class="alert error">Field Employee access required.</div>`;
 const list=complaints().sort((a,b)=>priorityScore(b)-priorityScore(a));
 const open=list.filter(c=>c.status!=="Resolved"&&c.status!=="Rejected");
 const awaiting=list.filter(c=>c.proofStatus==="Submitted").length;
 const done=list.filter(c=>c.status==="Resolved").length;
 const initial=esc((u.name||"E").charAt(0).toUpperCase());
 return `
 <div class="officer-profile-banner">
  <div class="officer-profile-avatar">${initial}</div>
  <div class="officer-profile-info">
   <span class="eyebrow">FIELD EMPLOYEE</span>
   <h2>${esc(u.name||"Employee")}</h2>
   <div class="officer-profile-meta">
    ${u.employeeId?`<span class="tracking-chip" title="Click to copy" onclick="copyText('${esc(u.employeeId)}')">🪪 #${esc(u.employeeId)}</span>`:""}
    <span class="officer-dept-badge">🏢 ${esc(u.department||"")}</span>
    ${u.mobile?`<span>📱 ${esc(u.mobile)}</span>`:""}
   </div>
  </div>
  <button class="button button-ghost" onclick="render('employee')">↻ Refresh</button>
 </div>
 <div class="stats-grid">
  <div class="stat-card"><span>My Open Tasks</span><strong>${open.length}</strong></div>
  <div class="stat-card"><span>📷 Awaiting Review</span><strong>${awaiting}</strong></div>
  <div class="stat-card"><span>✅ Resolved</span><strong>${done}</strong></div>
 </div>
 <section class="panel">
  <div class="panel-heading"><div><h2>📋 My Assigned Tasks</h2><p class="small-muted">Tasks assigned to you by your department officer, highest priority first. When the work is finished, upload a photo as proof.</p></div></div>
  ${list.length?list.map(employeeTaskCard).join(""):`<div class="empty-state"><h3>No tasks assigned yet</h3><p>Your officer will assign complaints from your zone to you.</p></div>`}
 </section>`;
}
function employeeTaskCard(c){
 const score=priorityScore(c), tier=priorityTier(score), code=getComplaintCode(c);
 const finished=c.status==="Resolved"||c.status==="Rejected";
 const waiting=c.proofStatus==="Submitted";
 let action="";
 if(finished){
  action=`<p class="small-muted">✅ This task is ${esc(c.status)}.</p>`;
 }else if(waiting){
  action=`<p class="small-muted">📷 Proof submitted - waiting for your officer's review.</p>`;
 }else{
  action=`${c.proofStatus==="Rejected"?'<div class="alert error">Your last proof was sent back by the officer. Please redo the work and upload a new photo.</div>':""}
   <div style="display:grid;gap:8px;margin-top:10px;">
    <label class="occ-update-label">Completion photo
     <input type="file" accept="image/*" id="proofFile_${c.id}" onchange="previewProof(${c.id},this)">
    </label>
    <div id="proofPreview_${c.id}"></div>
    <textarea id="proofRemark_${c.id}" rows="2" placeholder="Short remark about the work done (optional)" style="width:100%;"></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
     ${c.status!=="In Progress"?`<button class="button button-ghost button-sm" onclick="employeeStartWork(${c.id})">🔧 Start Work</button>`:""}
     <button class="button button-primary button-sm" onclick="submitProof(${c.id})">📤 Submit Proof</button>
    </div>
   </div>`;
 }
 return `<div class="officer-complaint-card priority-border-${tier.toLowerCase()}" style="margin-bottom:14px;">
  <div class="occ-header"><div class="occ-left"><span class="tracking-chip" onclick="copyText('${code}')">#${code}</span><span class="priority-pill priority-${tier.toLowerCase()}">${tier}</span></div><span class="status-badge status-${statusClass(c.status)}">${esc(c.status)}</span></div>
  <h3 class="occ-title">${esc(c.title)}</h3>
  <p class="occ-desc muted">${esc(c.description)}</p>
  <div class="occ-meta"><span>📍 ${esc(c.location)}</span><span>🏷️ ${esc(c.category)}</span>${c.safety?'<span class="safety-tag">⚠️ Safety Hazard</span>':""}</div>
  ${c.photo?`<img class="photo-preview" src="${photoSrc(c.photo)}" alt="Complaint photo">`:""}
  ${c.proofPhoto?`<p class="small-muted" style="margin-top:8px;">Your last proof:</p><img class="photo-preview" src="${photoSrc(c.proofPhoto)}" alt="Proof">`:""}
  <div style="margin-top:10px;"><button class="button button-ghost button-sm" onclick="openDetail(${c.id})">🔍 View Full Details →</button></div>
  ${action}
 </div>`;
}
function previewProof(id,input){
 const file=input.files[0], root=document.getElementById("proofPreview_"+id);
 if(!root)return;
 if(!file){root.innerHTML="";return;}
 const r=new FileReader(); r.onload=()=>root.innerHTML=`<img class="photo-preview" src="${r.result}" alt="Preview">`; r.readAsDataURL(file);
}
async function employeeStartWork(id){
 try{
  await apiRequest(`/complaints/${id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"In Progress"})});
  toast("Marked In Progress.");
  render("employee");
 }catch(ex){toast(ex.message);}
}
async function submitProof(id){
 const file=document.getElementById("proofFile_"+id)?.files[0];
 const remark=(document.getElementById("proofRemark_"+id)?.value||"").trim();
 if(!file){toast("Please choose a photo first.");return;}
 if(!file.type.startsWith("image/")){toast("Only image files are allowed.");return;}
 const body=new FormData(); body.append("photo",file); body.append("remark",remark);
 try{
  const res=await apiRequest(`/complaints/${id}/proof`,{method:"POST",body});
  toast(res.message||"Proof submitted.");
  render("employee");
 }catch(ex){toast(ex.message);}
}

function toggleRegisterRole(){
 const role=document.getElementById("registerRole")?.value;
 const fields=document.getElementById("registerFields"), notice=document.getElementById("adminNotice");
 if(!fields)return;
 fields.style.display="block";
 if(notice)notice.style.display=role==="admin"?"block":"none";
 const roleText=document.querySelector("#registerForm .eyebrow");
 if(roleText)roleText.textContent=role==="admin"?"ONE SYSTEM ADMIN REGISTRATION":"CITIZEN REGISTRATION";
 const heading=document.querySelector("#registerForm h2");
 if(heading)heading.textContent=role==="admin"?"Create the system admin account":"Create your citizen account";
}

async function apiRequest(path,options={}){
 const token=localStorage.getItem("sc_token");
 const headers={...(options.headers||{})}; if(token)headers.Authorization=`Bearer ${token}`;
 const response=await fetch(CONFIG.API_BASE_URL+path,{...options,headers});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.message||data.error||"Request failed.");
 return data;
}

let pendingLogin = null;

async function handleLogin(e){
 e.preventDefault();
 const btn=document.getElementById("loginButton"), err=document.getElementById("authError");
 btn.disabled=true; btn.textContent="Sending OTP..."; err.innerHTML="";
 const identifier=document.getElementById("loginIdentifier").value.trim(), password=document.getElementById("loginPassword").value;
 try{
  await apiRequest("/auth/send-otp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier,password})});
  pendingLogin={identifier,password,officer:false};
  showOtpBox(err);
 }catch(ex){
  if(ex.message.includes("wait 30 seconds")){
   pendingLogin={identifier,password,officer:false};
   showOtpBox(err);
  }else{
   err.innerHTML=`<div class="alert error">${esc(ex.message)}</div>`;
  }
 }
 finally{btn.disabled=false; btn.textContent="Sign In";}
}

function showOtpBox(el){
 el.innerHTML=`<div class="alert">OTP sent to your registered email. Valid for 5 minutes.</div>
  <input id="loginOtp" type="text" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit OTP" autocomplete="one-time-code" style="width:100%;margin:8px 0;">
  <button type="button" class="button button-primary full" onclick="verifyLoginOtp()">Verify OTP</button>
  <div id="otpMsg"></div>`;
 document.getElementById("loginOtp").focus();
}

async function verifyLoginOtp(){
 const otp=document.getElementById("loginOtp").value.trim(), msg=document.getElementById("otpMsg");
 const json={"Content-Type":"application/json"};
 try{
  const {identifier,password,officer}=pendingLogin;
  await apiRequest("/auth/verify-otp",{method:"POST",headers:json,body:JSON.stringify({identifier,otp})});
  const data=await apiRequest("/auth/login",{method:"POST",headers:json,body:JSON.stringify({identifier,password})});
  const user=data.user||{};
  if(officer && user.role!=="officer" && user.role!=="field_officer") throw new Error("This is not a Field Officer account. Use the Citizen / Admin tab.");
  localStorage.setItem("sc_token",data.access_token||data.token||"");
  setUser(user);
  pendingLogin=null;
  toast("Login successful.");
  navigate(roleHome(getUser().role));
 }catch(ex){msg.innerHTML=`<div class="alert error">${esc(ex.message)}</div>`;}
}

async function handleRegister(e){
 e.preventDefault();
 const data=Object.fromEntries(new FormData(e.target).entries()), err=document.getElementById("authError"), btn=document.getElementById("registerButton");
 err.innerHTML="";
 const role=data.role||"citizen";
 if(role==="admin" && getAdmin()){err.innerHTML='<div class="alert error">An Admin account already exists. Only one Admin is allowed.</div>';return;}
 if(data.password!==data.confirm_password){err.innerHTML='<div class="alert error">Password and confirm password do not match.</div>';return;}
 if(!/^[0-9]{10}$/.test(data.mobile)){err.innerHTML='<div class="alert error">Enter a valid 10-digit mobile number.</div>';return;}
 btn.disabled=true;btn.textContent="Creating...";
 try{
  if(CONFIG.USE_API){
   const payload={name:data.name,mobile:data.mobile,email:data.email,location:data.location,password:data.password,role};
   await apiRequest("/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  }else{
   const users=getUsers();
   if(users.some(x=>(x.email||"").toLowerCase()===data.email.toLowerCase()))throw new Error("Email is already registered.");
   if(users.some(x=>x.mobile===data.mobile))throw new Error("Mobile number is already registered.");
   const user={id:role+"_"+Date.now(),name:data.name,mobile:data.mobile,email:data.email,location:data.location,password:data.password,role};
   users.push(user); saveUsers(users);
  }
  toast(role==="admin"?"Admin account created successfully. Please login.":"Account created successfully. Please login."); navigate("login");
 }catch(ex){err.innerHTML=`<div class="alert error">${esc(ex.message)}</div>`;}
 finally{btn.disabled=false;btn.textContent="Create Account";}
}

async function handleComplaint(e){
 e.preventDefault();
 const fd=new FormData(e.target),data=Object.fromEntries(fd.entries()),user=getUser(),btn=document.getElementById("complaintButton"),err=document.getElementById("complaintError");
 err.innerHTML="";btn.disabled=true;btn.textContent="Submitting...";
 try{
  if(CONFIG.USE_API){
   const body=new FormData(); body.append("title",data.title); body.append("description",data.description); body.append("category_id",categories.find(x=>x.name===data.category)?.id||""); body.append("location_text",data.location); body.append("citizen_email",data.citizen_email||user?.email||""); body.append("is_safety_hazard",data.safety==="on"); if(fd.get("photo"))body.append("photo",fd.get("photo"));
   const result=await apiRequest("/complaints",{method:"POST",body}); const id=result.id||result.complaint?.id; const trackingCode = result.tracking_id || result.complaint?.tracking_id || ("CMP-" + id); toast(`🎉 Complaint registered! ID: #${trackingCode}`); if(id){currentComplaintId=id;navigate("detail");}else navigate("citizen");
  }else{
   const list=complaints();
   const trackingId = "CMP-" + Math.floor(100000 + Math.random() * 900000);
   let c={
    id: Date.now(),
    trackingId: trackingId,
    ownerKey: userKey(user),
    ownerId: user?.id || "",
    ownerName: user?.name || "",
    ownerMobile: user?.mobile || "",
    citizenEmail: data.citizen_email || user?.email || "",
    title: data.title,
    category: data.category,
    department: departmentForCategory(data.category),
    description: data.description,
    location: data.location,
    safety: data.safety === "on",
    upvotes: 0,
    age: 0,
    status: "Submitted",
    photo: "",
    createdAt: new Date().toISOString(),
    assignedOfficer: getOfficerForDepartment(departmentForCategory(data.category))?.id || null
   };
   const file=fd.get("photo"); if(file&&file.size)c.photo=await fileToDataURL(file);
   list.push(c);saveComplaints(list);currentComplaintId=c.id;toast(`🎉 Complaint registered! Tracking ID: #${trackingId}`);navigate("detail");
  }
 }catch(ex){err.innerHTML=`<div class="alert error">${esc(ex.message)}</div>`;}
 finally{btn.disabled=false;btn.textContent="Submit Complaint";}
}
function logout(){
  // Remove both demo login state and API authentication token.
  localStorage.removeItem("sc_user");
  localStorage.removeItem("sc_token");

  // Clear the current complaint selection so protected data is not reopened.
  currentComplaintId = null;

  // Return to the public home page immediately.
  navigate("home");

  // Keep the browser URL on the public home route.
  if(location.hash !== "#/" && history.replaceState){
    history.replaceState(null, "", "#/" );
  }

  toast("Logged out successfully.");
}

function userKey(user){return user?.id || (user?.email||user?.mobile||"").toLowerCase();}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}

function seedDemo(){
 if(!localStorage.getItem("sc_demo_seeded")){
  saveComplaints([
   {id:1,trackingId:"CMP-1001",ownerKey:"demo-citizen",citizenEmail:"citizen1@example.com",title:"Large pothole near main road",category:"Road Damage",department:"Road Department",description:"A large pothole has developed near the main road and is dangerous for vehicles.",location:"Main Road, Ward 3",safety:true,upvotes:8,age:3,status:"Under Review",photo:""},
   {id:2,trackingId:"CMP-1002",ownerKey:"demo-citizen",citizenEmail:"citizen2@example.com",title:"Garbage overflowing",category:"Garbage Overflow",department:"Sanitation Department",description:"Garbage has not been collected for several days.",location:"Shivaji Nagar",safety:false,upvotes:5,age:2,status:"Submitted",photo:""},
   {id:3,trackingId:"CMP-1003",ownerKey:"demo-citizen",citizenEmail:"citizen3@example.com",title:"Streetlight not working",category:"Streetlight",department:"Electrical Department",description:"Streetlight near the bus stop has not been working for one week.",location:"Bus Stop Road",safety:true,upvotes:3,age:6,status:"In Progress",photo:""}
  ]);
  localStorage.setItem("sc_demo_seeded","1");
 }
}

window.addEventListener("DOMContentLoaded",()=>{seedDemo();const u=getUser();navigate(u?roleHome(u.role):"home");});
window.addEventListener("hashchange",()=>{
 const h=location.hash.replace("#/","")||"home";
 const route=h.startsWith("complaint/")?"detail":h;
 if(route==="detail"){currentComplaintId=Number(h.split("/")[1]);render("detail");}else render(route);
});  

