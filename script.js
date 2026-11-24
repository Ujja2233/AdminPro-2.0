
/* =====================================================
   ADMINPRO 3.0
   Firebase Authentication + Business Dashboard
   HTML, CSS, Vanilla JavaScript
===================================================== */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

/* =====================================================
   1. FIREBASE CONFIGURATION
   Replace these values with your Firebase project config.
===================================================== */


const firebaseConfig = {
  apiKey: "AIzaSyBOLoBBS13qrfZM_hB_yfCjGdhvcPilRJw",
  authDomain: "adminpro-dashboard-2961b.firebaseapp.com",
  projectId: "adminpro-dashboard-2961b",
  storageBucket: "adminpro-dashboard-2961b.firebasestorage.app",
  messagingSenderId: "649772070435",
  appId: "1:649772070435:web:f2964ea843c36aaf7c2396",
  measurementId: "G-0QDFW3M2Z6"
};

const firebaseConfigured =
  firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
  firebaseConfig.authDomain !== "YOUR_PROJECT_ID.firebaseapp.com" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

async function googleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    console.log("Google Login Successful:", result.user);

    alert("Welcome " + result.user.displayName);

  } catch (error) {
    console.error("Google Login Error:", error.code, error.message);
    alert(error.message);
  }
}

const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope("email");
let currentUser = null;
let currentUid = null;
let chartDays = 30;
let customers = [];
let products = [];
let orders = [];
let notifications = [];

/* =====================================================
   2. GENERAL HELPERS
===================================================== */

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const money = value =>
  "₹" + Number(value || 0).toLocaleString("en-IN");

const uid = prefix =>
  prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

const today = () => new Date().toISOString().slice(0, 10);

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[c]);

function userKey(key) {
  if (!currentUid) throw new Error("No authenticated user.");
  return `adminpro_${currentUid}_${key}`;
}

function loadUserData(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(userKey(key)));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function storeUserData(key, value) {
  localStorage.setItem(userKey(key), JSON.stringify(value));
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  $("#toastContainer").appendChild(element);
  setTimeout(() => element.remove(), 3200);
}

function showAuthMessage(message, type = "error") {
  $("#authError").classList.add("hidden");
  $("#authSuccess").classList.add("hidden");

  const target = type === "success" ? $("#authSuccess") : $("#authError");
  target.textContent = message;
  target.classList.remove("hidden");
}

function clearAuthMessages() {
  $("#authError").classList.add("hidden");
  $("#authSuccess").classList.add("hidden");
}

function friendlyAuthError(error) {
  const messages = {
    "auth/email-already-in-use":"This email is already registered. Please sign in.",
    "auth/invalid-email":"Please enter a valid email address.",
    "auth/weak-password":"Your password is too weak. Use at least 8 characters.",
    "auth/invalid-credential":"Incorrect email or password.",
    "auth/user-not-found":"No account was found with this email.",
    "auth/wrong-password":"Incorrect password.",
    "auth/popup-closed-by-user":"The sign-in window was closed before completion.",
    "auth/popup-blocked":"Your browser blocked the sign-in popup. Allow popups and try again.",
    "auth/account-exists-with-different-credential":"An account already exists with this email using another sign-in method.",
    "auth/unauthorized-domain":"This website domain is not authorized in Firebase Authentication.",
    "auth/operation-not-allowed":"This sign-in provider is not enabled in Firebase.",
    "auth/network-request-failed":"Network error. Check your internet connection.",
    "auth/too-many-requests":"Too many attempts. Please wait and try again."
  };

  return messages[error.code] || error.message || "Something went wrong. Please try again.";
}

function setButtonLoading(button, loading, label) {
  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : label;
}

/* =====================================================
   3. AUTH SCREEN SWITCHING
===================================================== */

function showLoginScreen() {
  clearAuthMessages();
  $("#authTitle").textContent = "Welcome back";
  $("#authSubtitle").textContent = "Sign in to continue to your workspace.";
  $("#loginForm").classList.remove("hidden");
  $("#signupForm").classList.add("hidden");
  $("#loginSwitch").classList.remove("hidden");
  $("#signupSwitch").classList.add("hidden");
}

function showSignupScreen() {
  clearAuthMessages();
  $("#authTitle").textContent = "Create your account";
  $("#authSubtitle").textContent = "Register to start using your AdminPro workspace.";
  $("#loginForm").classList.add("hidden");
  $("#signupForm").classList.remove("hidden");
  $("#loginSwitch").classList.add("hidden");
  $("#signupSwitch").classList.remove("hidden");
}

$("#showSignup").addEventListener("click", showSignupScreen);
$("#showLogin").addEventListener("click", showLoginScreen);

$$("[data-toggle]").forEach(button => {
  button.addEventListener("click", () => {
    const input = $("#" + button.dataset.toggle);
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.textContent = isPassword ? "Hide" : "Show";
  });
});

/* =====================================================
   4. EMAIL AND PASSWORD SIGNUP
===================================================== */

$("#signupForm").addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessages();

  const name = $("#signupName").value.trim();
  const email = $("#signupEmail").value.trim();
  const password = $("#signupPassword").value;
  const confirmPassword = $("#confirmPassword").value;

  if (name.length < 2) {
    showAuthMessage("Please enter your full name.");
    return;
  }

  if (password.length < 8) {
    showAuthMessage("Password must contain at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showAuthMessage("Passwords do not match.");
    return;
  }

  if (!$("#acceptTerms").checked) {
    showAuthMessage("Please accept the usage terms.");
    return;
  }

  if (!firebaseConfigured) {
    showAuthMessage("Add your Firebase configuration in script.js before registering.");
    return;
  }

  const button = $("#signupSubmit");
  setButtonLoading(button, true, "Create account");

  try {
    await setPersistence(auth, browserLocalPersistence);

    const result = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(result.user, { displayName: name });

    try {
      await sendEmailVerification(result.user);
      showAuthMessage("Account created! A verification email has been sent.", "success");
    } catch (verificationError) {
      console.warn("Verification email could not be sent:", verificationError);
    }

    // Firebase auth state listener opens the dashboard.
  } catch (error) {
    showAuthMessage(friendlyAuthError(error));
  } finally {
    setButtonLoading(button, false, "Create account");
  }
});

/* =====================================================
   5. EMAIL AND PASSWORD LOGIN
===================================================== */

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessages();

  if (!firebaseConfigured) {
    showAuthMessage("Add your Firebase configuration in script.js before signing in.");
    return;
  }

  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;
  const button = $("#loginSubmit");

  setButtonLoading(button, true, "Sign in");

  try {
    await setPersistence(
      auth,
      $("#rememberMe").checked
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showAuthMessage(friendlyAuthError(error));
  } finally {
    setButtonLoading(button, false, "Sign in");
  }
});

/* =====================================================
   6. GOOGLE AND FACEBOOK OAUTH
===================================================== */

async function socialLogin(provider) {
  clearAuthMessages();

  if (!firebaseConfigured) {
    showAuthMessage("Configure Firebase before using social sign-in.");
    return;
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, provider);

    const user = result.user;
    const isNewUser = result._tokenResponse?.isNewUser;

    if (isNewUser) {
      toast("Welcome! Your new account has been created.");
    } else {
      toast("Signed in successfully.");
    }

    console.log("Social authentication successful:", user.uid);
  } catch (error) {
    showAuthMessage(friendlyAuthError(error));
  }
}

$("#googleLogin").addEventListener("click", () => {
  socialLogin(googleProvider);
});

$("#facebookLogin").addEventListener("click", () => {
  socialLogin(facebookProvider);
});

/* =====================================================
   7. FORGOT PASSWORD
===================================================== */

$("#forgotPassword").addEventListener("click", async () => {
  clearAuthMessages();

  const email = $("#loginEmail").value.trim();

  if (!email) {
    showAuthMessage("Enter your email address first, then select Forgot password.");
    $("#loginEmail").focus();
    return;
  }

  if (!firebaseConfigured) {
    showAuthMessage("Configure Firebase before resetting your password.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMessage("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    showAuthMessage(friendlyAuthError(error));
  }
});

/* =====================================================
   8. LOGOUT AND PROTECTED DASHBOARD
===================================================== */

async function logout() {
  try {
    await signOut(auth);
    $("#profileMenu").classList.add("hidden");
    showLoginScreen();
    toast("You have signed out.");
  } catch (error) {
    toast(friendlyAuthError(error));
  }
}

$("#logoutBtn").addEventListener("click", logout);
$("#settingsLogoutBtn").addEventListener("click", logout);

function providerName(user) {
  const provider = user.providerData?.[0]?.providerId || "password";

  if (provider === "google.com") return "Google";
  if (provider === "facebook.com") return "Facebook";
  if (provider === "password") return "Email and password";

  return provider;
}

function updateUserInterface(user) {
  const name = user.displayName || user.email?.split("@")[0] || "User";
  const email = user.email || "No email";
  const initials = name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join("").toUpperCase();

  $("#welcomeName").textContent = name.split(" ")[0];
  $("#sidebarUserName").textContent = name;
  $("#sidebarUserEmail").textContent = email;
  $("#sidebarAvatar").textContent = initials;
  $("#topAvatar").textContent = initials;
  $("#profileMenuName").textContent = name;
  $("#profileMenuEmail").textContent = email;
  $("#settingsName").textContent = name;
  $("#settingsEmail").textContent = email;
  $("#settingsAvatar").textContent = initials;
  $("#profileDisplayName").textContent = name;
  $("#profileDisplayEmail").textContent = email;
  $("#profileVerified").textContent = user.emailVerified ? "Verified" : "Not verified";
  $("#profileProvider").textContent = providerName(user);
  $("#authProviderLabel").textContent = providerName(user) + " account";
}

function openDashboard(user) {
  currentUser = user;
  currentUid = user.uid;

  $("#authScreen").classList.add("hidden");
  $("#dashboardApp").classList.remove("hidden");

  updateUserInterface(user);
  loadAccountData();
  initializeDashboard();

  // Refresh profile data from Firebase.
  $("#refreshProfileBtn").onclick = async () => {
    try {
      await user.reload();
      currentUser = auth.currentUser;
      updateUserInterface(currentUser);
      toast("Profile refreshed.");
    } catch (error) {
      toast(friendlyAuthError(error));
    }
  };
}

function closeDashboard() {
  currentUser = null;
  currentUid = null;
  $("#dashboardApp").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
  $("#profileMenu").classList.add("hidden");
  showLoginScreen();
}

onAuthStateChanged(auth, user => {
  if (user) {
    openDashboard(user);
  } else {
    closeDashboard();
  }
});

/* =====================================================
   9. USER-SCOPED SAMPLE DATA
===================================================== */

const initialCustomers = [
  {id:"CUS-101",name:"Rahul Sharma",email:"rahul@email.com",phone:"9876543210"},
  {id:"CUS-102",name:"Priya Singh",email:"priya@email.com",phone:"9876543211"},
  {id:"CUS-103",name:"Aman Kumar",email:"aman@email.com",phone:"9876543212"},
  {id:"CUS-104",name:"Neha Verma",email:"neha@email.com",phone:"9876543213"},
  {id:"CUS-105",name:"Rohit Das",email:"rohit@email.com",phone:"9876543214"}
];

const initialProducts = [
  {id:"PRD-101",name:"Laptop Pro",category:"Electronics",price:55000,stock:12},
  {id:"PRD-102",name:"Wireless Headphones",category:"Electronics",price:2500,stock:5},
  {id:"PRD-103",name:"Smart Watch",category:"Accessories",price:4200,stock:18},
  {id:"PRD-104",name:"Premium T-Shirt",category:"Fashion",price:1200,stock:35},
  {id:"PRD-105",name:"Mechanical Keyboard",category:"Accessories",price:1800,stock:3},
  {id:"PRD-106",name:"Monitor",category:"Electronics",price:12000,stock:9},
  {id:"PRD-107",name:"Office Chair",category:"Home",price:7500,stock:0}
];

const initialOrders = [
  {id:"ORD-1001",customerId:"CUS-101",customer:"Rahul Sharma",productId:"PRD-101",product:"Laptop Pro",date:today(),amount:55000,status:"Completed",stockReserved:false},
  {id:"ORD-1002",customerId:"CUS-102",customer:"Priya Singh",productId:"PRD-102",product:"Wireless Headphones",date:today(),amount:2500,status:"Pending",stockReserved:true},
  {id:"ORD-1003",customerId:"CUS-103",customer:"Aman Kumar",productId:"PRD-103",product:"Smart Watch",date:today(),amount:4200,status:"Processing",stockReserved:true},
  {id:"ORD-1004",customerId:"CUS-104",customer:"Neha Verma",productId:"PRD-104",product:"Premium T-Shirt",date:today(),amount:1200,status:"Completed",stockReserved:false},
  {id:"ORD-1005",customerId:"CUS-105",customer:"Rohit Das",productId:"PRD-106",product:"Monitor",date:today(),amount:12000,status:"Pending",stockReserved:true}
];

function loadAccountData() {
  customers = loadUserData("customers", initialCustomers);
  products = loadUserData("products", initialProducts);
  orders = loadUserData("orders", initialOrders);
  notifications = loadUserData("notifications", []);
}

function saveAll() {
  if (!currentUid) return;
  storeUserData("customers", customers);
  storeUserData("products", products);
  storeUserData("orders", orders);
  storeUserData("notifications", notifications);
}

/* =====================================================
   10. NOTIFICATION CENTER
===================================================== */

function addNotification(title,message,icon="🔔") {
  notifications.unshift({
    id:uid("NOT"),title,message,icon,
    time:new Date().toISOString(),read:false
  });

  notifications = notifications.slice(0,100);
  saveAll();
  renderNotifications();
}

function renderNotifications() {
  const unread = notifications.filter(n=>!n.read).length;

  $("#navNotificationCount").textContent = unread;
  $("#navNotificationCount").classList.toggle("hidden",unread===0);

  $("#notificationList").innerHTML = notifications.length
    ? notifications.map(n=>`
      <article class="notification-item ${n.read?"":"unread"}">
        <div class="notification-symbol">${escapeHTML(n.icon)}</div>
        <div class="notification-content">
          <strong>${escapeHTML(n.title)}</strong>
          <p>${escapeHTML(n.message)}</p>
          <small>${new Date(n.time).toLocaleString()}</small>
          <div class="notification-actions">
            ${!n.read?`<button class="text-btn" data-notify-read="${escapeHTML(n.id)}">Mark read</button>`:""}
            <button class="text-btn" data-notify-delete="${escapeHTML(n.id)}">Delete</button>
          </div>
        </div>
      </article>`).join("")
    : `<p class="subtitle">No notifications yet.</p>`;

  $("#quickNotificationList").innerHTML = notifications.slice(0,4).map(n=>`
    <div class="notification-item ${n.read?"":"unread"}">
      <div class="notification-symbol">${escapeHTML(n.icon)}</div>
      <div class="notification-content"><strong>${escapeHTML(n.title)}</strong><p>${escapeHTML(n.message)}</p></div>
    </div>`).join("") || `<p class="subtitle">No recent notifications.</p>`;
}

function checkStockAlerts() {
  products.forEach(product=>{
    const key = "stock-alert-" + product.id;
    const previous = loadUserData(key,"");
    const current = product.stock<=0?"out":product.stock<=5?"low":"normal";

    if (current!==previous && current!=="normal") {
      addNotification(
        current==="out"?"Product out of stock":"Low stock alert",
        product.name+" has "+product.stock+" units remaining.",
        "📦"
      );
    }
    storeUserData(key,current);
  });
}

$("#notificationBtn").addEventListener("click",()=>{
  $("#quickNotifications").classList.toggle("hidden");
});

$("#openAllNotifications").addEventListener("click",()=>{
  navigate("notifications");
  $("#quickNotifications").classList.add("hidden");
});

$("#markAllRead").addEventListener("click",()=>{
  notifications.forEach(n=>n.read=true);
  saveAll();renderNotifications();toast("All notifications marked as read.");
});

$("#clearNotifications").addEventListener("click",()=>{
  if(!confirm("Delete all notifications?"))return;
  notifications=[];saveAll();renderNotifications();toast("Notifications cleared.");
});

$("#notificationList").addEventListener("click",e=>{
  const readId=e.target.dataset.notifyRead;
  const deleteId=e.target.dataset.notifyDelete;

  if(readId){const n=notifications.find(x=>x.id===readId);if(n)n.read=true;}
  if(deleteId)notifications=notifications.filter(x=>x.id!==deleteId);

  saveAll();renderNotifications();
});

/* =====================================================
   11. CUSTOMER MANAGEMENT
===================================================== */

function customerStats(id) {
  const list=orders.filter(o=>o.customerId===id);
  return {
    count:list.length,
    spent:list.filter(o=>o.status==="Completed").reduce((s,o)=>s+Number(o.amount),0)
  };
}

function renderCustomers(query="") {
  const filtered=customers.filter(c=>
    [c.name,c.email,c.phone,c.id].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  $("#customerCount").textContent=customers.length;

  $("#customerTable").innerHTML=filtered.length?filtered.map(c=>{
    const stats=customerStats(c.id);
    return `<tr>
      <td><strong>${escapeHTML(c.name)}</strong></td>
      <td>${escapeHTML(c.email)}</td><td>${escapeHTML(c.phone)}</td>
      <td>${stats.count}</td><td>${money(stats.spent)}</td>
      <td><button class="text-btn" data-customer-edit="${escapeHTML(c.id)}">Edit</button>
      <button class="text-btn" data-customer-delete="${escapeHTML(c.id)}">Delete</button></td>
    </tr>`;
  }).join(""):`<tr><td colspan="6">No customers found.</td></tr>`;
}

function openCustomerModal(customer=null) {
  $("#customerForm").reset();
  $("#customerId").value=customer?.id||"";
  $("#customerName").value=customer?.name||"";
  $("#customerEmail").value=customer?.email||"";
  $("#customerPhone").value=customer?.phone||"";
  $("#customerModalTitle").textContent=customer?"Edit Customer":"Add Customer";
  $("#customerModal").classList.remove("hidden");
}

$("#addCustomerBtn").addEventListener("click",()=>openCustomerModal());

$("#customerForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("#customerId").value;
  const name=$("#customerName").value.trim();
  const email=$("#customerEmail").value.trim();
  const phone=$("#customerPhone").value.trim();

  if(customers.some(c=>c.email.toLowerCase()===email.toLowerCase()&&c.id!==id)){
    toast("This email already exists.");return;
  }

  if(id){
    const customer=customers.find(c=>c.id===id);
    if(customer)Object.assign(customer,{name,email,phone});
    toast("Customer updated.");
  }else{
    customers.unshift({id:uid("CUS"),name,email,phone});
    addNotification("New customer added",name+" joined your customer directory.","👤");
    toast("Customer added.");
  }

  saveAll();renderCustomers($("#customerSearch").value);updateDashboard();
  $("#customerModal").classList.add("hidden");
});

$("#customerTable").addEventListener("click",e=>{
  const edit=e.target.dataset.customerEdit;
  const del=e.target.dataset.customerDelete;

  if(edit)openCustomerModal(customers.find(c=>c.id===edit));

  if(del){
    const customer=customers.find(c=>c.id===del);
    if(!customer)return;
    if(orders.some(o=>o.customerId===del)){toast("Customer has order history and cannot be deleted.");return;}
    if(!confirm("Delete "+customer.name+"?"))return;
    customers=customers.filter(c=>c.id!==del);
    saveAll();renderCustomers($("#customerSearch").value);updateDashboard();toast("Customer deleted.");
  }
});

$("#customerSearch").addEventListener("input",e=>renderCustomers(e.target.value));

/* =====================================================
   12. PRODUCT AND INVENTORY MANAGEMENT
===================================================== */

function stockStatus(stock) {
  if(stock<=0)return["Out of stock","out-stock"];
  if(stock<=5)return["Low stock","low-stock"];
  return["In stock","active-stock"];
}

function renderProducts(query="") {
  const filtered=products.filter(p=>
    [p.name,p.category,p.id].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  $("#productCount").textContent=products.length;
  $("#stockCount").textContent=products.reduce((s,p)=>s+Number(p.stock),0);
  $("#stockAlerts").textContent=products.filter(p=>p.stock<=5).length;
  $("#stockValue").textContent=money(products.reduce((s,p)=>s+p.price*p.stock,0));

  $("#productTable").innerHTML=filtered.length?filtered.map(p=>{
    const [label,cls]=stockStatus(p.stock);
    return `<tr>
      <td><strong>${escapeHTML(p.name)}</strong></td><td>${escapeHTML(p.category)}</td>
      <td>${money(p.price)}</td><td>${p.stock}</td><td><span class="status ${cls}">${label}</span></td>
      <td><button class="text-btn" data-product-edit="${escapeHTML(p.id)}">Edit</button>
      <button class="text-btn" data-product-delete="${escapeHTML(p.id)}">Delete</button></td>
    </tr>`;
  }).join(""):`<tr><td colspan="6">No products found.</td></tr>`;
}

function openProductModal(product=null) {
  $("#productForm").reset();
  $("#productId").value=product?.id||"";
  $("#productName").value=product?.name||"";
  $("#productCategory").value=product?.category||"Electronics";
  $("#productPrice").value=product?.price??"";
  $("#productStock").value=product?.stock??"";
  $("#productModalTitle").textContent=product?"Edit Product":"Add Product";
  $("#productModal").classList.remove("hidden");
}

$("#addProductBtn").addEventListener("click",()=>openProductModal());

$("#productForm").addEventListener("submit",e=>{
  e.preventDefault();

  const id=$("#productId").value;
  const name=$("#productName").value.trim();
  const category=$("#productCategory").value;
  const price=Number($("#productPrice").value);
  const stock=Number($("#productStock").value);

  if(!name||!Number.isFinite(price)||price<=0||!Number.isInteger(stock)||stock<0){
    toast("Enter valid product details.");return;
  }

  if(id){
    const p=products.find(x=>x.id===id);
    if(p)Object.assign(p,{name,category,price,stock});
    toast("Product updated.");
  }else{
    products.unshift({id:uid("PRD"),name,category,price,stock});
    addNotification("New product added",name+" was added to inventory.","📦");
    toast("Product added.");
  }

  saveAll();checkStockAlerts();renderProducts($("#productSearch").value);
  updateDashboard();$("#productModal").classList.add("hidden");
});

$("#productTable").addEventListener("click",e=>{
  const edit=e.target.dataset.productEdit;
  const del=e.target.dataset.productDelete;

  if(edit)openProductModal(products.find(p=>p.id===edit));

  if(del){
    const product=products.find(p=>p.id===del);
    if(!product)return;
    if(orders.some(o=>o.productId===del)){toast("Product has order history and cannot be deleted.");return;}
    if(!confirm("Delete "+product.name+"?"))return;
    products=products.filter(p=>p.id!==del);
    saveAll();renderProducts($("#productSearch").value);updateDashboard();toast("Product deleted.");
  }
});

$("#productSearch").addEventListener("input",e=>renderProducts(e.target.value));

/* =====================================================
   13. ORDER MANAGEMENT
===================================================== */

function fillOrderOptions() {
  $("#orderCustomer").innerHTML=customers.map(c=>
    `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`
  ).join("");

  $("#orderProduct").innerHTML=products.filter(p=>p.stock>0).map(p=>
    `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} — ${money(p.price)}</option>`
  ).join("");
}

function renderOrders(query="") {
  const filtered=orders.filter(o=>
    [o.id,o.customer,o.product,o.status,o.date].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  $("#orderTable").innerHTML=filtered.length?filtered.map(o=>`
    <tr><td>${escapeHTML(o.id)}</td><td>${escapeHTML(o.customer)}</td>
    <td>${escapeHTML(o.product)}</td><td>${escapeHTML(o.date)}</td>
    <td>${money(o.amount)}</td><td><span class="status ${escapeHTML(o.status)}">${escapeHTML(o.status)}</span></td>
    <td><select class="action-select" data-order-status="${escapeHTML(o.id)}">
      <option value="">Change</option>
      ${["Pending","Processing","Completed","Cancelled"].map(s=>
        `<option value="${s}" ${o.status===s?"disabled":""}>${s}</option>`
      ).join("")}
    </select></td></tr>`).join(""):`<tr><td colspan="7">No orders found.</td></tr>`;

  $("#recentOrderTable").innerHTML=orders.slice(0,5).map(o=>`
    <tr><td>${escapeHTML(o.id)}</td><td>${escapeHTML(o.customer)}</td>
    <td>${money(o.amount)}</td><td><span class="status ${escapeHTML(o.status)}">${escapeHTML(o.status)}</span></td></tr>
  `).join("");
}

function changeOrderStatus(id,status) {
  const order=orders.find(o=>o.id===id);
  if(!order||!status)return;

  if(order.status==="Cancelled"||order.status==="Completed"){
    toast("This order is already finalized.");return;
  }

  if(status==="Cancelled"){
    const product=products.find(p=>p.id===order.productId);
    if(product&&order.stockReserved){product.stock+=1;order.stockReserved=false;}
  }

  order.status=status;
  saveAll();
  addNotification("Order status updated",order.id+" is now "+status+".","📦");
  refreshAll();toast("Order status updated.");
}

$("#orderTable").addEventListener("change",e=>{
  if(e.target.matches("[data-order-status]")){
    changeOrderStatus(e.target.dataset.orderStatus,e.target.value);
  }
});

$("#orderSearch").addEventListener("input",e=>renderOrders(e.target.value));

$("#addOrderBtn").addEventListener("click",()=>{
  fillOrderOptions();
  if(!customers.length||!products.some(p=>p.stock>0)){toast("Add a customer and an in-stock product first.");return;}
  $("#orderForm").reset();
  $("#orderAmount").value=products.find(p=>p.id===$("#orderProduct").value)?.price||"";
  $("#orderModal").classList.remove("hidden");
});

$("#orderProduct").addEventListener("change",()=>{
  const p=products.find(p=>p.id===$("#orderProduct").value);
  if(p)$("#orderAmount").value=p.price;
});

$("#orderForm").addEventListener("submit",e=>{
  e.preventDefault();

  const customer=customers.find(c=>c.id===$("#orderCustomer").value);
  const product=products.find(p=>p.id===$("#orderProduct").value);
  const amount=Number($("#orderAmount").value);
  const status=$("#orderStatus").value;

  if(!customer||!product||product.stock<=0||!Number.isFinite(amount)||amount<=0){
    toast("Invalid order details or insufficient stock.");return;
  }

  product.stock-=1;

  orders.unshift({
    id:uid("ORD"),customerId:customer.id,customer:customer.name,
    productId:product.id,product:product.name,date:today(),
    amount,status,stockReserved:status!=="Cancelled"
  });

  saveAll();
  addNotification("New order received",customer.name+" placed an order.","🛍");
  checkStockAlerts();
  $("#orderModal").classList.add("hidden");
  refreshAll();toast("New order created.");
});

/* =====================================================
   14. DASHBOARD STATISTICS
===================================================== */

function getRevenue() {
  return orders.filter(o=>o.status==="Completed").reduce((s,o)=>s+Number(o.amount),0);
}

function updateDashboard() {
  const revenue=getRevenue();

  $("#revenue").textContent=money(revenue);
  $("#customers").textContent=customers.length;
  $("#totalOrders").textContent=orders.length;
  $("#chartTotal").textContent=money(revenue);
  $("#conversion").textContent="4.85%";
  $("#goalRevenue").textContent=money(revenue);

  const progress=Math.min(100,revenue/500000*100);
  $("#goalProgress").style.width=progress+"%";
  $("#goalPercent").textContent=progress.toFixed(1)+"% achieved";

  $("#analyticsRevenue").textContent=money(revenue);
  $("#averageOrder").textContent=money(orders.length?revenue/orders.length:0);
  $("#pendingOrders").textContent=orders.filter(o=>o.status==="Pending").length;
  $("#lowStockCount").textContent=products.filter(p=>p.stock<=5).length;

  $("#overviewInsight").textContent=
    `${customers.length} customers, ${orders.length} orders and ${money(revenue)} completed revenue.`;

  $("#assistantSnapshot").innerHTML=`
    <div class="snapshot-row"><span>Revenue</span><strong>${money(revenue)}</strong></div>
    <div class="snapshot-row"><span>Customers</span><strong>${customers.length}</strong></div>
    <div class="snapshot-row"><span>Orders</span><strong>${orders.length}</strong></div>
    <div class="snapshot-row"><span>Products</span><strong>${products.length}</strong></div>
    <div class="snapshot-row"><span>Low stock</span><strong>${products.filter(p=>p.stock<=5).length}</strong></div>
  `;

  $("#reportSummary").innerHTML=`
    <p>Total revenue: <strong>${money(revenue)}</strong></p>
    <p>Total customers: <strong>${customers.length}</strong></p>
    <p>Total orders: <strong>${orders.length}</strong></p>
    <p>Total products: <strong>${products.length}</strong></p>
    <p>Pending orders: <strong>${orders.filter(o=>o.status==="Pending").length}</strong></p>
  `;
}

/* =====================================================
   15. ANALYTICS CHARTS
===================================================== */

function filteredOrdersByDays(days) {
  if(days===365){
    const year=new Date().getFullYear();
    return orders.filter(o=>new Date(o.date).getFullYear()===year);
  }

  const cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-days+1);
  cutoff.setHours(0,0,0,0);

  return orders.filter(o=>new Date(o.date+"T00:00:00")>=cutoff);
}

function analyticsData(days) {
  const list=filteredOrdersByDays(days).filter(o=>o.status==="Completed");

  if(days===365){
    const year=new Date().getFullYear();
    return Array.from({length:12},(_,i)=>{
      const month=year+"-"+String(i+1).padStart(2,"0");
      return list.filter(o=>o.date.startsWith(month)).reduce((s,o)=>s+Number(o.amount),0);
    });
  }

  const buckets=days===7?7:days===30?4:6;

  return Array.from({length:buckets},(_,i)=>{
    const start=Math.floor(i*days/buckets);
    const end=Math.floor((i+1)*days/buckets);

    return list.filter(o=>{
      const age=Math.floor((new Date().setHours(0,0,0,0)-new Date(o.date+"T00:00:00").getTime())/86400000);
      return age>=start&&age<end;
    }).reduce((s,o)=>s+Number(o.amount),0);
  }).reverse();
}

function drawLineChart(canvasId,values,labels) {
  const canvas=$("#"+canvasId);
  if(!canvas)return;

  const ctx=canvas.getContext("2d");
  const width=canvas.getBoundingClientRect().width;
  const height=220;
  const dpr=window.devicePixelRatio||1;
  if(!width)return;

  canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);

  const dark=document.body.classList.contains("dark");
  const textColor=dark?"#aab1cc":"#9296aa";
  const gridColor=dark?"#353a52":"#eceef5";
  const pad={left:48,right:15,top:16,bottom:32};
  const chartW=width-pad.left-pad.right;
  const chartH=height-pad.top-pad.bottom;
  const max=Math.max(...values,1)*1.2;

  ctx.font="10px Arial";ctx.textAlign="right";

  for(let i=0;i<=4;i++){
    const y=pad.top+chartH*i/4;
    ctx.beginPath();ctx.strokeStyle=gridColor;
    ctx.moveTo(pad.left,y);ctx.lineTo(width-pad.right,y);ctx.stroke();
    ctx.fillStyle=textColor;ctx.fillText(money(max*(4-i)/4),pad.left-6,y+3);
  }

  const points=values.map((v,i)=>({
    x:pad.left+chartW/Math.max(values.length-1,1)*i,
    y:pad.top+chartH-(v/max)*chartH
  }));

  const gradient=ctx.createLinearGradient(0,pad.top,0,height);
  gradient.addColorStop(0,"rgba(113,96,239,.27)");
  gradient.addColorStop(1,"rgba(113,96,239,0)");

  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  points.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(points.at(-1).x,height-pad.bottom);
  ctx.lineTo(points[0].x,height-pad.bottom);
  ctx.closePath();ctx.fillStyle=gradient;ctx.fill();

  ctx.beginPath();
  points.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
  ctx.strokeStyle="#7967ef";ctx.lineWidth=3;ctx.lineJoin="round";ctx.stroke();

  points.forEach(p=>{
    ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle="#7967ef";ctx.fill();
  });

  labels.forEach((label,i)=>{
    const x=pad.left+chartW/Math.max(labels.length-1,1)*i;
    ctx.fillStyle=textColor;ctx.textAlign="center";ctx.fillText(label,x,height-9);
  });
}

function drawDoughnut() {
  const canvas=$("#salesChart");
  if(!canvas)return;

  const ctx=canvas.getContext("2d");
  const width=canvas.getBoundingClientRect().width;
  const height=220;
  const dpr=window.devicePixelRatio||1;
  if(!width)return;

  canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);

  const totals={};
  orders.filter(o=>o.status==="Completed").forEach(o=>{
    const p=products.find(p=>p.id===o.productId);
    const category=p?.category||"Other";
    totals[category]=(totals[category]||0)+Number(o.amount);
  });

  const entries=Object.entries(totals);
  const colors=["#7865ed","#4b9fe8","#ffad64","#43c9a0","#e879b2"];
  const total=entries.reduce((s,x)=>s+x[1],0);
  const cx=width/2,cy=height/2,r=Math.min(width,height)*.32;
  let start=-Math.PI/2;

  if(!total){
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle="#9ba3c155";ctx.lineWidth=24;ctx.stroke();
  }else{
    entries.forEach((entry,i)=>{
      const angle=entry[1]/total*Math.PI*2;
      ctx.beginPath();ctx.arc(cx,cy,r,start,start+angle);
      ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=24;ctx.stroke();
      start+=angle;
    });
  }

  ctx.textAlign="center";
  ctx.fillStyle=document.body.classList.contains("dark")?"#f3f4ff":"#20233a";
  ctx.font="bold 20px Arial";ctx.fillText(total?"100%":"0%",cx,cy+4);
  ctx.font="10px Arial";ctx.fillStyle="#9296aa";ctx.fillText("Revenue",cx,cy+21);

  $("#salesLegend").innerHTML=entries.length?entries.map((entry,i)=>`
    <span class="legend-item"><i class="legend-dot" style="background:${colors[i%colors.length]}"></i>${escapeHTML(entry[0])}</span>
  `).join(""):"No completed sales yet.";
}

function renderOverviewCharts() {
  const values=analyticsData(chartDays);
  const labels=chartDays===7
    ?["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Day 7"]
    :chartDays===30
      ?["Week 1","Week 2","Week 3","Week 4"]
      :chartDays===90
        ?["Period 1","Period 2","Period 3","Period 4","Period 5","Period 6"]
        :["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  drawLineChart("revenueChart",values,labels);
  drawDoughnut();
}

function renderAnalytics() {
  const days=Number($("#analyticsFilter").value);
  const values=analyticsData(days);
  const labels=days===7
    ?["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Day 7"]
    :days===30
      ?["Week 1","Week 2","Week 3","Week 4"]
      :days===90
        ?["Period 1","Period 2","Period 3","Period 4","Period 5","Period 6"]
        :["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  drawLineChart("analyticsChart",values,labels);

  const health=[
    ["Order completion",orders.length?Math.round(orders.filter(o=>o.status==="Completed").length/orders.length*100):0],
    ["Stock availability",products.length?Math.round(products.filter(p=>p.stock>5).length/products.length*100):0],
    ["Customer coverage",customers.length?Math.min(100,Math.round(new Set(orders.map(o=>o.customerId)).size/customers.length*100)):0]
  ];

  $("#healthMetrics").innerHTML=health.map(([name,value])=>`
    <div><div class="health-item"><span>${name}</span><strong>${value}%</strong></div>
    <div class="progress-track"><span style="width:${value}%"></span></div></div>
  `).join("");

  const categoryTotals={};
  products.forEach(p=>categoryTotals[p.category]=(categoryTotals[p.category]||0)+p.stock);
  const max=Math.max(...Object.values(categoryTotals),1);

  $("#categoryBars").innerHTML=Object.entries(categoryTotals).map(([name,value])=>`
    <div class="category-row"><span>${escapeHTML(name)}</span>
    <div class="category-track"><span style="width:${value/max*100}%"></span></div><strong>${value}</strong></div>
  `).join("")||"No categories yet.";
}

$("#dateFilter").addEventListener("change",e=>{
  chartDays=Number(e.target.value);renderOverviewCharts();
});
$("#analyticsFilter").addEventListener("change",renderAnalytics);

/* =====================================================
   16. LOCAL BUSINESS ASSISTANT
===================================================== */

function assistantAnswer(question) {
  const q=question.toLowerCase();
  const revenue=getRevenue();
  const pending=orders.filter(o=>o.status==="Pending").length;
  const completed=orders.filter(o=>o.status==="Completed").length;
  const low=products.filter(p=>p.stock<=5);

  const best=[...products].sort((a,b)=>{
    const aCount=orders.filter(o=>o.productId===a.id&&o.status==="Completed").length;
    const bCount=orders.filter(o=>o.productId===b.id&&o.status==="Completed").length;
    return bCount-aCount;
  })[0];

  if(q.includes("revenue")||q.includes("earning")||q.includes("income"))
    return `Your completed order revenue is ${money(revenue)} from ${completed} completed orders.`;

  if(q.includes("stock")||q.includes("inventory"))
    return low.length?"Products needing attention:\n"+low.map(p=>`${p.name}: ${p.stock} units`).join("\n"):"All products currently have more than 5 units in stock.";

  if(q.includes("pending"))
    return `You currently have ${pending} pending orders out of ${orders.length} total orders.`;

  if(q.includes("customer"))
    return `You have ${customers.length} registered customers and ${orders.length} recorded orders.`;

  if(q.includes("best")||q.includes("popular")||q.includes("selling"))
    return best?`${best.name} currently ranks highest by completed order count.`:"There is not enough sales data yet.";

  if(q.includes("summary")||q.includes("business")||q.includes("report"))
    return `BUSINESS SUMMARY\n\nRevenue: ${money(revenue)}\nCustomers: ${customers.length}\nOrders: ${orders.length}\nCompleted: ${completed}\nPending: ${pending}\nProducts: ${products.length}\nLow stock: ${low.length}\n\nRecommendation: Review pending orders and restock products with low inventory.`;

  if(q.includes("order"))
    return `Orders: ${orders.length}\nCompleted: ${completed}\nPending: ${pending}\nProcessing: ${orders.filter(o=>o.status==="Processing").length}\nCancelled: ${orders.filter(o=>o.status==="Cancelled").length}`;

  if(q.includes("profit"))
    return "Your dashboard tracks revenue, not profit. Add purchase costs and operating expenses to calculate profit accurately.";

  return "I can answer questions about revenue, orders, customers, inventory, low stock and business summaries.";
}

function sendChat(question) {
  if(!question.trim())return;

  const userBubble=document.createElement("div");
  userBubble.className="chat-bubble user";
  userBubble.textContent=question;
  $("#chatMessages").appendChild(userBubble);

  const botBubble=document.createElement("div");
  botBubble.className="chat-bubble bot";
  botBubble.textContent=assistantAnswer(question);
  $("#chatMessages").appendChild(botBubble);

  $("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;
}

$("#chatForm").addEventListener("submit",e=>{
  e.preventDefault();sendChat($("#chatInput").value);$("#chatInput").value="";
});

$$(".suggestions button").forEach(btn=>{
  btn.addEventListener("click",()=>sendChat(btn.dataset.question));
});

/* =====================================================
   17. REPORTS: PDF, EXCEL-COMPATIBLE XLS, CSV
===================================================== */

function generatePDF() {
  const html=`<!DOCTYPE html><html><head><title>AdminPro Business Report</title>
  <style>
  body{font-family:Arial;padding:35px;color:#222}h1{color:#5946ce}
  .summary{display:flex;gap:20px;flex-wrap:wrap}.box{padding:15px;border:1px solid #ddd;border-radius:8px}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th,td{border:1px solid #ddd;padding:10px;text-align:left;font-size:12px}
  th{background:#eee}footer{margin-top:35px;color:#777;font-size:11px}
  </style></head><body>
  <h1>AdminPro – Business Report</h1><p>Account: ${escapeHTML(currentUser?.email)}</p>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <div class="summary">
  <div class="box">Revenue<h2>${money(getRevenue())}</h2></div>
  <div class="box">Customers<h2>${customers.length}</h2></div>
  <div class="box">Orders<h2>${orders.length}</h2></div>
  <div class="box">Products<h2>${products.length}</h2></div></div>
  <h2>Order Details</h2><table><tr><th>Order</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th></tr>
  ${orders.map(o=>`<tr><td>${escapeHTML(o.id)}</td><td>${escapeHTML(o.customer)}</td><td>${escapeHTML(o.product)}</td><td>${money(o.amount)}</td><td>${escapeHTML(o.status)}</td></tr>`).join("")}
  </table><h2>Inventory</h2><table><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr>
  ${products.map(p=>`<tr><td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.category)}</td><td>${money(p.price)}</td><td>${p.stock}</td></tr>`).join("")}
  </table><footer>AdminPro 3.0 · Generated locally from this signed-in account's dashboard.</footer>
  <script>window.onload=()=>window.print();<\/script></body></html>`;

  const win=window.open("","_blank");
  if(!win){toast("Allow pop-ups to generate your PDF report.");return;}
  win.document.open();win.document.write(html);win.document.close();
}

function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function excelCell(value) {
  const numeric=typeof value==="number"&&Number.isFinite(value);
  return `<Cell><Data ss:Type="${numeric?"Number":"String"}">${escapeHTML(value)}</Data></Cell>`;
}

function excelSheet(name,headers,rows) {
  return `<Worksheet ss:Name="${escapeHTML(name)}"><Table>
  ${[headers,...rows].map(row=>`<Row>${row.map(excelCell).join("")}</Row>`).join("")}
  </Table></Worksheet>`;
}

function exportExcel() {
  const xml=`<?xml version="1.0"?>
  <?mso-application progid="Excel.Sheet"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${excelSheet("Orders",["Order ID","Customer","Product","Date","Amount","Status"],orders.map(o=>[o.id,o.customer,o.product,o.date,Number(o.amount),o.status]))}
  ${excelSheet("Customers",["ID","Name","Email","Phone"],customers.map(c=>[c.id,c.name,c.email,c.phone]))}
  ${excelSheet("Products",["ID","Product","Category","Price","Stock"],products.map(p=>[p.id,p.name,p.category,Number(p.price),Number(p.stock)]))}
  ${excelSheet("Summary",["Metric","Value"],[["Revenue",getRevenue()],["Customers",customers.length],["Orders",orders.length],["Products",products.length]])}
  </Workbook>`;

  downloadBlob(new Blob(["\uFEFF",xml],{type:"application/vnd.ms-excel;charset=utf-8"}),"AdminPro-Business-Report.xls");
  toast("Excel-compatible workbook downloaded.");
}

function exportCSV() {
  const rows=[
    ["Order ID","Customer","Product","Date","Amount","Status"],
    ...orders.map(o=>[o.id,o.customer,o.product,o.date,o.amount,o.status])
  ];

  const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
  downloadBlob(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}),"AdminPro-Orders.csv");
  toast("CSV downloaded.");
}

$$("[data-action]").forEach(button=>{
  button.addEventListener("click",()=>{
    if(button.dataset.action==="pdf")generatePDF();
    if(button.dataset.action==="excel")exportExcel();
    if(button.dataset.action==="csv")exportCSV();
  });
});

/* =====================================================
   18. GLOBAL SEARCH
===================================================== */

$("#globalSearch").addEventListener("input",e=>{
  const query=e.target.value.trim();
  const page=$(".page-section:not(.hidden)")?.id;

  if(page==="page-orders"){$("#orderSearch").value=query;renderOrders(query);}
  if(page==="page-customers"){$("#customerSearch").value=query;renderCustomers(query);}
  if(page==="page-products"){$("#productSearch").value=query;renderProducts(query);}
});

/* =====================================================
   19. NAVIGATION
===================================================== */

const pageInfo={
  overview:["Dashboard Overview","Your business overview at a glance."],
  analytics:["Advanced Analytics","Understand your business performance."],
  customers:["Customer Management","Manage customer relationships."],
  products:["Product Inventory","Manage your products and stock."],
  orders:["Order Management","Track and manage transactions."],
  reports:["Reports Center","Generate business reports."],
  notifications:["Notification Center","Stay updated with business activities."],
  assistant:["AI Business Assistant","Explore your business data using smart insights."],
  settings:["My Profile & Settings","Manage your account and preferences."]
};

function navigate(page) {
  if(!pageInfo[page])return;

  $$(".page-section").forEach(s=>s.classList.add("hidden"));
  $("#page-"+page).classList.remove("hidden");

  $$(".nav-link").forEach(link=>link.classList.toggle("active",link.dataset.page===page));

  $("#pageTitle").textContent=pageInfo[page][0];
  $("#pageSubtitle").textContent=pageInfo[page][1];
  $("#sidebar").classList.remove("open");
  $("#quickNotifications").classList.add("hidden");

  if(page==="analytics")renderAnalytics();
  if(page==="customers")renderCustomers($("#customerSearch").value);
  if(page==="products")renderProducts($("#productSearch").value);
  if(page==="orders")renderOrders($("#orderSearch").value);
  if(page==="notifications")renderNotifications();
  if(page==="overview")requestAnimationFrame(renderOverviewCharts);
}

$$("[data-page]").forEach(link=>{
  link.addEventListener("click",()=>{
    if(!currentUser)return;
    navigate(link.dataset.page);
  });
});

/* =====================================================
   20. PROFILE MENU
===================================================== */

$("#profileMenuBtn").addEventListener("click",()=>{
  $("#profileMenu").classList.toggle("hidden");
});

$("#topAvatar").addEventListener("click",()=>{
  $("#profileMenu").classList.toggle("hidden");
});

$("#profileSettingsBtn").addEventListener("click",()=>{
  $("#profileMenu").classList.add("hidden");
  navigate("settings");
});

/* =====================================================
   21. THEME
===================================================== */

function updateThemeIcon() {
  $("#themeBtn").textContent=document.body.classList.contains("dark")?"☀":"☾";
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  if(currentUid)storeUserData("theme",document.body.classList.contains("dark")?"dark":"light");
  updateThemeIcon();
  requestAnimationFrame(()=>{renderOverviewCharts();renderAnalytics();});
}

$("#themeBtn").addEventListener("click",toggleTheme);
$("#settingsTheme").addEventListener("click",toggleTheme);

/* =====================================================
   22. MODAL CLOSE
===================================================== */

$$("[data-close]").forEach(button=>{
  button.addEventListener("click",()=>{
    $("#"+button.dataset.close).classList.add("hidden");
  });
});

$$(".modal-overlay").forEach(modal=>{
  modal.addEventListener("click",e=>{
    if(e.target===modal)modal.classList.add("hidden");
  });
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    $$(".modal-overlay").forEach(m=>m.classList.add("hidden"));
    $("#quickNotifications").classList.add("hidden");
    $("#profileMenu").classList.add("hidden");
  }
});

/* =====================================================
   23. BACKUP AND RESET CURRENT USER DATA
===================================================== */

$("#backupBtn").addEventListener("click",()=>{
  const backup={
    account:{uid:currentUid,email:currentUser?.email},
    customers,products,orders,notifications,
    exportedAt:new Date().toISOString()
  };

  downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),"AdminPro-Backup.json");
  toast("Your account backup downloaded.");
});

$("#resetBtn").addEventListener("click",()=>{
  if(!confirm("Reset all demo business records for this account? This cannot be undone."))return;

  ["customers","products","orders","notifications"].forEach(key=>{
    localStorage.removeItem(userKey(key));
  });

  Object.keys(localStorage)
    .filter(key=>key.startsWith(`adminpro_${currentUid}_stock-alert-`))
    .forEach(key=>localStorage.removeItem(key));

  loadAccountData();
  initializeDashboard();
  toast("Your demo business data has been reset.");
});

/* =====================================================
   24. REFRESH AND INITIALIZE DASHBOARD
===================================================== */

function refreshAll() {
  saveAll();
  updateDashboard();
  renderCustomers($("#customerSearch").value);
  renderProducts($("#productSearch").value);
  renderOrders($("#orderSearch").value);
  renderNotifications();
  renderOverviewCharts();
  renderAnalytics();
}

function initializeDashboard() {
  if(!currentUser||!currentUid)return;

  const theme=loadUserData("theme","light");
  document.body.classList.toggle("dark",theme==="dark");
  updateThemeIcon();

  $("#globalSearch").value="";
  $("#customerSearch").value="";
  $("#productSearch").value="";
  $("#orderSearch").value="";

  checkStockAlerts();
  refreshAll();
  navigate("overview");

  console.log("AdminPro 3.0 ready for Firebase user:",currentUid);
}

/* =====================================================
   25. MOBILE SIDEBAR AND RESIZE
===================================================== */

$("#menuBtn").addEventListener("click",()=>{
  $("#sidebar").classList.toggle("open");
});

let resizeTimer;

window.addEventListener("resize",()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    if(currentUser){
      renderOverviewCharts();
      renderAnalytics();
    }
  },180);
});



