const API_BASE_URL = (window.PARKEASE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const $ = (id) => document.getElementById(id);
const state = { slots: [], selectedDate: '', adminToken: sessionStorage.getItem('parkEaseAdminToken') || '', adminEmail: sessionStorage.getItem('parkEaseAdminEmail') || '' };

function localDateString(d = new Date()) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}
function toInputDateTime(d) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}
function money(value) {
  return '₹' + Number(value || 0).toFixed(2);
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function showToast(message, error = false) {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast show' + (error ? ' error' : '');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.className = 'toast', 3500);
}
function apiError(data, fallback='Something went wrong') {
  return data && data.error ? data.error : fallback;
}
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (path.startsWith('/admin/') && !path.endsWith('/login') && state.adminToken) headers.Authorization = `Bearer ${state.adminToken}`;
  const response = await fetch(API_BASE_URL + path, { ...options, headers });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(apiError(data, `Request failed (${response.status})`));
  return data;
}

async function loadSlots() {
  try {
    const slots = await api('/slots');
    state.slots = slots;
    populateSlotSelect();
    renderHeroPreview(slots);
    await loadAvailability();
  } catch (err) {
    $('slotGrid').innerHTML = `<div class="empty-card">Could not load slots. Make sure your backend is running on <b>http://localhost:3000</b>.</div>`;
    showToast(err.message, true);
  }
}
function populateSlotSelect() {
  $('slotId').innerHTML = '<option value="">Select a parking slot</option>' +
    state.slots.map(s => `<option value="${s.id}">${escapeHtml(s.slot_number)} — ${escapeHtml(s.location)} (${money(s.hourly_rate)}/hr)</option>`).join('');
}
function renderHeroPreview(slots) {
  const top = slots.slice(0, 3);
  $('heroSlotPreview').innerHTML = top.length ? top.map(s => `
    <div class="mini-slot">
      <div><b>Slot ${escapeHtml(s.slot_number)}</b><span>${escapeHtml(s.location)}</span></div>
      <em>Available</em>
    </div>`).join('') : '<div class="loading-card">No slots found.</div>';
}
async function loadAvailability() {
  const date = $('availabilityDate').value;
  if (!date) return;
  state.selectedDate = date;
  $('slotGrid').innerHTML = '<div class="loading-card">Checking live availability…</div>';
  try {
    const data = await api('/availability?date=' + encodeURIComponent(date));
    renderSlots(data.slots || []);
  } catch (err) {
    $('slotGrid').innerHTML = `<div class="empty-card">${escapeHtml(err.message)}</div>`;
    showToast(err.message, true);
  }
}
function renderSlots(slots) {
  if (!slots.length) {
    $('slotGrid').innerHTML = '<div class="empty-card">No parking slots are configured in the database.</div>';
    return;
  }
  $('slotGrid').innerHTML = slots.map(s => {
    const isFull = s.fully_booked_all_day;
    const hasBookings = (s.busy_windows || []).length > 0;
    const status = isFull ? 'Fully booked' : hasBookings ? 'Has bookings' : 'Available';
    const cls = isFull ? 'full' : hasBookings ? 'busy' : '';
    const windows = (s.busy_windows || []).slice(0, 2).map(w =>
      `${new Date(w.start_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}–${new Date(w.end_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`
    ).join(', ');
    return `<article class="slot-card ${cls}">
      <div class="slot-top">
        <div><div class="slot-number">${escapeHtml(s.slot_number)}</div><div class="slot-location">${escapeHtml(s.location)}</div></div>
        <span class="badge ${cls}">${status}</span>
      </div>
      <div class="rate-row">
        <div><small>HOURLY</small><b>${money(s.hourly_rate)}</b></div>
        <div><small>DAILY</small><b>${money(s.daily_rate)}</b></div>
        <div><div style="font-size:10px;color:#84908b">BOOKINGS</div><b>${s.busy_windows.length}</b></div>
      </div>
      ${windows ? `<div style="font-size:10px;color:#7c8983;margin-bottom:12px">Busy: ${escapeHtml(windows)}</div>` : '<div style="font-size:10px;color:#7c8983;margin-bottom:12px">No bookings for this date.</div>'}
      <button class="slot-action" ${isFull ? 'disabled' : ''} onclick="selectSlot(${s.id})">${isFull ? 'Unavailable' : 'Book this slot'}</button>
    </article>`;
  }).join('');
}
function selectSlot(id) {
  $('slotId').value = id;
  const date = $('availabilityDate').value || localDateString();
  const start = new Date(`${date}T09:00`);
  const end = new Date(`${date}T10:00`);
  $('startTime').value = toInputDateTime(start);
  $('endTime').value = toInputDateTime(end);
  document.querySelector('#booking').scrollIntoView({behavior:'smooth'});
  updatePricePreview();
}

function calculatePreview() {
  const slot = state.slots.find(s => String(s.id) === String($('slotId').value));
  const start = new Date($('startTime').value);
  const end = new Date($('endTime').value);
  if (!slot || isNaN(start) || isNaN(end) || end <= start) return null;
  const hours = (end - start) / 3600000;
  let price;
  if (hours < 24) price = Math.ceil(hours) * Number(slot.hourly_rate);
  else {
    const days = Math.floor(hours / 24);
    const rem = Math.ceil(hours - days * 24);
    price = days * Number(slot.daily_rate) + rem * Number(slot.hourly_rate);
  }
  return price;
}
function updatePricePreview() {
  const price = calculatePreview();
  $('pricePreview').classList.toggle('hidden', price === null);
  if (price !== null) $('priceValue').textContent = money(price);
}

async function submitBooking(e) {
  e.preventDefault();
  const btn = $('bookBtn');
  const message = $('paymentMessage');
  const payload = {
    slot_id: Number($('slotId').value),
    user_name: $('userName').value.trim(),
    user_email: $('userEmail').value.trim(),
    start_time: new Date($('startTime').value).toISOString(),
    end_time: new Date($('endTime').value).toISOString()
  };
  if (!payload.slot_id) return showToast('Please select a parking slot.', true);
  if (new Date(payload.end_time) <= new Date(payload.start_time)) return showToast('End time must be after start time.', true);
  if (typeof window.Razorpay !== 'function') return showToast('Razorpay Checkout did not load. Check your internet connection and refresh.', true);
  btn.disabled = true;
  btn.textContent = 'Preparing secure payment…';
  message.textContent = 'Creating a secure Razorpay test order…';
  try {
    // The server calculates the real price and creates the Razorpay order.
    const order = await api('/api/payments/create-order', { method: 'POST', body: JSON.stringify(payload) });
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'ParkEase',
      description: `Parking reservation — slot ${order.slotNumber}`,
      order_id: order.orderId,
      prefill: { name: payload.user_name, email: payload.user_email },
      notes: { project: 'ParkEase parking booking' },
      theme: { color: '#176b52' },
      handler: async function (response) {
        message.textContent = 'Payment received. Verifying payment securely…';
        try {
          const result = await api('/api/payments/verify-payment', {
            method: 'POST', body: JSON.stringify(response)
          });
          if (!result.verified || !result.booking) throw new Error(result.error || 'Payment could not be verified.');
          const b = result.booking;
          openModal(`
            <div class="success-icon">✓</div>
            <h2>Payment successful!</h2>
            <p>Your Razorpay payment was verified and your parking reservation is confirmed.</p>
            <div class="confirmation">
              <div><span>Booking ID</span><b>#${escapeHtml(b.id)}</b></div>
              <div><span>Payment ID</span><b>${escapeHtml(result.paymentId)}</b></div>
              <div><span>Slot</span><b>${escapeHtml(state.slots.find(s => String(s.id) === String(b.slot_id))?.slot_number || b.slot_id)}</b></div>
              <div><span>From</span><b>${new Date(b.start_time).toLocaleString()}</b></div>
              <div><span>To</span><b>${new Date(b.end_time).toLocaleString()}</b></div>
              <div><span>Total paid</span><b>${money(b.total_price)}</b></div>
            </div>
            <button class="btn btn-primary" style="width:100%;margin-top:18px" onclick="closeModal(); document.querySelector('#manage').scrollIntoView({behavior:'smooth'}); $('bookingId').value='${escapeHtml(b.id)}'; lookupBooking();">Manage this booking</button>
          `);
          $('bookingForm').reset();
          $('pricePreview').classList.add('hidden');
          message.textContent = 'Payment verified. Booking confirmed.';
          await loadAvailability();
        } catch (err) {
          message.textContent = `Payment may have been received, but verification failed: ${err.message} Check Razorpay Dashboard before attempting another payment.`;
          showToast(err.message, true);
        } finally {
          btn.disabled = false; btn.innerHTML = 'Continue to payment <span>→</span>';
        }
      },
      modal: { ondismiss: function () {
        message.textContent = 'Checkout closed. If you completed a payment, check its status before trying again.';
        btn.disabled = false; btn.innerHTML = 'Continue to payment <span>→</span>';
      } }
    });
    checkout.on('payment.failed', function (response) {
      const reason = response && response.error && response.error.description;
      message.textContent = `Payment failed${reason ? ': ' + reason : '.'} You have not received a booking confirmation.`;
      showToast('Razorpay payment failed. Please try again.', true);
      btn.disabled = false; btn.innerHTML = 'Continue to payment <span>→</span>';
    });
    checkout.open();
    message.textContent = `Order created for ${money(order.bookingAmount)}. Complete payment in the Razorpay checkout window.`;
  } catch (err) {
    message.textContent = err.message;
    showToast(err.message, true);
    btn.disabled = false;
    btn.innerHTML = 'Continue to payment <span>→</span>';
  }
}
async function lookupBooking() {
  const id = $('bookingId').value;
  if (!id) return showToast('Enter a booking ID.', true);
  const result = $('bookingResult');
  result.classList.remove('hidden');
  result.innerHTML = 'Loading booking…';
  try {
    const b = await api('/bookings/' + encodeURIComponent(id));
    result.innerHTML = `
      <div class="result-grid">
        <div class="result-item"><small>Booking ID</small><b>#${escapeHtml(b.id)}</b></div>
        <div class="result-item"><small>Status</small><b>${escapeHtml(b.status)}</b></div>
        <div class="result-item"><small>Customer</small><b>${escapeHtml(b.user_name)}</b></div>
        <div class="result-item"><small>Email</small><b>${escapeHtml(b.user_email)}</b></div>
        <div class="result-item"><small>Start</small><b>${new Date(b.start_time).toLocaleString()}</b></div>
        <div class="result-item"><small>End</small><b>${new Date(b.end_time).toLocaleString()}</b></div>
        <div class="result-item"><small>Total</small><b>${money(b.total_price)}</b></div>
      </div>
      ${b.status === 'confirmed' ? `<div class="result-actions"><button class="cancel-btn" onclick="cancelBooking(${b.id})">Cancel booking</button></div>` : '<p style="font-size:11px;color:#7c8983;margin:13px 0 0">This booking is already cancelled.</p>'}
    `;
  } catch (err) {
    result.innerHTML = `<p style="color:#b64e4e;font-size:12px">${escapeHtml(err.message)}</p>`;
  }
}
async function cancelBooking(id) {
  if (!confirm('Cancel this parking booking?')) return;
  try {
    const data = await api('/bookings/' + id, {method:'DELETE'});
    showToast(data.message || 'Booking cancelled.');
    await lookupBooking();
    await loadAvailability();
  } catch (err) {
    showToast(err.message, true);
  }
}

function openAdminLogin() {
  $('modal').classList.remove('admin-modal');
  openModal(`
    <div class="admin-login-head">
      <div class="admin-icon">♙</div>
      <div class="eyebrow">PARK EASE ADMINISTRATION</div>
      <h2>Admin login</h2>
      <p>Sign in with your administrator credentials to access admin tools.</p>
    </div>
    <form id="adminLoginForm" class="admin-login-form">
      <label class="field"><span>Admin email</span><input id="adminEmail" type="email" autocomplete="username" placeholder="admin@example.com" required></label>
      <label class="field"><span>Password</span><input id="adminPassword" type="password" autocomplete="current-password" placeholder="Enter admin password" required></label>
      <p id="adminLoginError" class="admin-login-error hidden" role="alert"></p>
      <button class="btn btn-primary" type="submit" id="adminSubmitBtn" style="width:100%">Sign in as admin</button>
    </form>
    <p class="admin-login-note">Administrator access only. Regular visitors can continue booking parking without signing in.</p>
  `);
  $('adminLoginForm').addEventListener('submit', submitAdminLogin);
}
async function submitAdminLogin(e) {
  e.preventDefault();
  const btn = $('adminSubmitBtn'); const error = $('adminLoginError');
  error.classList.add('hidden'); btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api('/admin/login', {method:'POST', body:JSON.stringify({ email:$('adminEmail').value.trim(), password:$('adminPassword').value })});
    state.adminToken = data.token; state.adminEmail = data.admin.email;
    sessionStorage.setItem('parkEaseAdminToken', state.adminToken); sessionStorage.setItem('parkEaseAdminEmail', state.adminEmail);
    await openAdminDashboard();
  } catch (err) { error.textContent = err.message || 'Unable to sign in.'; error.classList.remove('hidden'); }
  finally { if ($('adminSubmitBtn')) { btn.disabled = false; btn.textContent = 'Sign in as admin'; } }
}
function adminShell(active='overview') {
  const tabs=[['overview','Overview','layout-dashboard'],['slots','Parking slots','car-front'],['bookings','Bookings','calendar-days'],['users','Users','users'],['reports','Reports','chart-no-axes-combined'],['settings','Settings','settings']];
  return `<div class="admin-shell"><aside class="admin-sidebar"><div class="admin-brand"><span class="brand-mark">P</span><div><b>ParkEase</b><small>ADMIN CONSOLE</small></div></div><div class="admin-nav">${tabs.map(t=>`<button class="admin-tab ${active===t[0]?'active':''}" data-admin-tab="${t[0]}"><span>${({'overview':'▦','slots':'▤','bookings':'▣','users':'♙','reports':'▥','settings':'⚙'})[t[0]]}</span>${t[1]}</button>`).join('')}</div><button class="admin-logout" id="adminLogoutBtn">↪ Sign out</button></aside><section class="admin-main"><header class="admin-top"><div><div class="eyebrow">PARKING MANAGEMENT</div><h2 id="adminPageTitle">${tabs.find(t=>t[0]===active)[1]}</h2></div><div class="admin-user"><span class="admin-avatar">A</span><span><b>Administrator</b><small>${escapeHtml(state.adminEmail)}</small></span></div></header><div id="adminPageContent"><div class="admin-loading">Loading admin data…</div></div></section></div>`;
}
async function openAdminDashboard(){openModal(adminShell());$('modal').classList.add('admin-modal');wireAdminShell();await loadAdminPage('overview');}
function wireAdminShell(){document.querySelectorAll('[data-admin-tab]').forEach(b=>b.addEventListener('click',()=>loadAdminPage(b.dataset.adminTab)));$('adminLogoutBtn').addEventListener('click',()=>{state.adminToken='';state.adminEmail='';sessionStorage.removeItem('parkEaseAdminToken');sessionStorage.removeItem('parkEaseAdminEmail');$('modal').classList.remove('admin-modal');closeModal();showToast('Signed out successfully.');});}
function statCard(label,value,sub,icon){return `<article class="admin-stat"><div class="admin-stat-icon">${icon}</div><span>${label}</span><strong>${value}</strong><small>${sub||''}</small></article>`;}
async function loadAdminPage(page){
  if(!state.adminToken){openAdminLogin();return;}
  document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===page));
  const title=({overview:'Dashboard overview',slots:'Parking slot management',bookings:'Booking management',users:'User management',reports:'Reports & revenue',settings:'System settings'})[page];$('adminPageTitle').textContent=title;
  const root=$('adminPageContent');root.innerHTML='<div class="admin-loading">Loading…</div>';
  try{
    if(page==='overview'){const d=await api('/admin/dashboard');root.innerHTML=`<div class="admin-stat-grid">${statCard('Total slots',d.slots.total,'Configured spaces','▤')}${statCard('Available to book',d.slots.active-d.occupiedNow,'Approximate current availability','✓')}${statCard('Total bookings',d.bookings.total,`${d.bookings.confirmed} confirmed`,'▣')}${statCard("Today's revenue",money(d.revenue.today),'All non-cancelled bookings created today','₹')}</div><div class="admin-panel"><div class="admin-panel-head"><div><h3>Recent bookings</h3><p>Latest reservations recorded by the system.</p></div><button class="admin-secondary" data-jump="bookings">View all</button></div>${bookingTable(d.recent,true)}</div><div class="admin-note">Slot availability is calculated from active slots and current booking states. Revenue reflects recorded booking totals, not verified payment transactions.</div>`;root.querySelector('[data-jump="bookings"]').onclick=()=>loadAdminPage('bookings');}
    if(page==='slots'){const slots=await api('/admin/slots');root.innerHTML=`<div class="admin-toolbar"><div><h3>Parking spaces</h3><p>Add spaces, update rates or mark a space for maintenance.</p></div><button class="admin-primary" id="addSlotBtn">＋ Add slot</button></div><div class="admin-panel admin-table-wrap">${slotsTable(slots)}</div><div id="slotEditor"></div>`;$('addSlotBtn').onclick=()=>slotEditor();root.querySelectorAll('[data-edit-slot]').forEach(b=>b.onclick=()=>slotEditor(slots.find(s=>String(s.id)===b.dataset.editSlot)));root.querySelectorAll('[data-delete-slot]').forEach(b=>b.onclick=()=>deleteAdminSlot(b.dataset.deleteSlot));}
    if(page==='bookings'){const rows=await api('/admin/bookings');root.innerHTML=`<div class="admin-toolbar"><div><h3>All reservations</h3><p>Search bookings and manage check-in, check-out and cancellations.</p></div><input class="admin-search" id="bookingSearch" placeholder="Search ID, name, email or slot…"></div><div class="admin-panel admin-table-wrap" id="adminBookingsTable">${bookingTable(rows)}</div>`;$('bookingSearch').addEventListener('input',()=>{const q=$('bookingSearch').value.toLowerCase();const filtered=rows.filter(b=>[b.id,b.user_name,b.user_email,b.slot_number].some(x=>String(x||'').toLowerCase().includes(q)));$('adminBookingsTable').innerHTML=bookingTable(filtered);wireBookingActions();});wireBookingActions();}
    if(page==='users'){const rows=await api('/admin/users');root.innerHTML=`<div class="admin-toolbar"><div><h3>Customers</h3><p>Customer profiles are summarized from booking history.</p></div><input class="admin-search" id="userSearch" placeholder="Search customer…"></div><div class="admin-panel admin-table-wrap" id="adminUsersTable">${usersTable(rows)}</div>`;$('userSearch').addEventListener('input',async()=>{const data=await api('/admin/users?q='+encodeURIComponent($('userSearch').value));$('adminUsersTable').innerHTML=usersTable(data);});}
    if(page==='reports'){const d=await api('/admin/reports');root.innerHTML=`<div class="admin-stat-grid">${statCard('All bookings',d.summary.bookings,'Across all dates','▣')}${statCard('Cancelled',d.summary.cancelled,'Cancelled reservations','×')}${statCard('Recorded revenue',money(d.summary.revenue),'Excludes cancelled bookings','₹')}</div><div class="admin-panel"><div class="admin-panel-head"><div><h3>Daily activity · last 30 days</h3><p>Bookings and recorded revenue by creation date.</p></div><button class="admin-secondary" id="exportDaily">Export CSV</button></div>${dailyReportTable(d.daily)}</div><div class="admin-panel"><div class="admin-panel-head"><div><h3>Slot performance</h3><p>Booking count and revenue by parking slot.</p></div><button class="admin-secondary" id="exportSlots">Export CSV</button></div>${slotReportTable(d.slots)}</div>`;$('exportDaily').onclick=()=>downloadCsv('daily-parking-report.csv',[['Date','Bookings','Revenue'],...d.daily.map(x=>[x.day,x.bookings,x.revenue])]);$('exportSlots').onclick=()=>downloadCsv('parking-slot-report.csv',[['Slot','Bookings','Revenue'],...d.slots.map(x=>[x.slot_number,x.bookings,x.revenue])]);}
    if(page==='settings'){const d=await api('/admin/settings');root.innerHTML=`<div class="admin-panel"><div class="admin-panel-head"><div><h3>Pricing and slot settings</h3><p>Rates are configured per slot. Edit them from Parking Slots.</p></div><button class="admin-primary" id="settingsSlots">Manage slots</button></div><div class="admin-table-wrap">${slotsTable(d.rates,false)}</div></div><div class="admin-panel"><div class="admin-panel-head"><div><h3>Notifications</h3><p>Booking confirmations use AWS SNS when configured.</p></div><span class="admin-status ${d.notifications.snsConfigured?'good':'warn'}">${d.notifications.snsConfigured?'SNS configured':'SNS not configured'}</span></div><p class="admin-help">${d.notifications.snsConfigured?'SNS topic ARN and AWS region are present in backend configuration.':'Set AWS_REGION, SNS_TOPIC_ARN and AWS credentials on the backend environment.'}</p><button class="admin-secondary" id="checkNotifications">Check notification setup</button><p id="notificationMessage" class="admin-help"></p></div><div class="admin-panel"><h3>Administrator session</h3><p class="admin-help">Signed in as ${escapeHtml(state.adminEmail)}. Sessions expire after 8 hours or when you sign out.</p><button class="admin-secondary" id="settingsLogout">Sign out</button></div>`;$('settingsSlots').onclick=()=>loadAdminPage('slots');$('checkNotifications').onclick=async()=>{try{const x=await api('/admin/notifications/test',{method:'POST',body:'{}'});$('notificationMessage').textContent=x.message;}catch(e){$('notificationMessage').textContent=e.message;}};$('settingsLogout').onclick=()=>$('adminLogoutBtn').click();}
  }catch(err){if(/session|sign in|expired/i.test(err.message)){state.adminToken='';sessionStorage.removeItem('parkEaseAdminToken');$('modal').classList.remove('admin-modal');openAdminLogin();return;}root.innerHTML=`<div class="admin-error">${escapeHtml(err.message)} <button class="admin-secondary" id="adminRetry">Retry</button></div>`;$('adminRetry').onclick=()=>loadAdminPage(page);}
}
function bookingTable(rows,compact=false){if(!rows.length)return '<div class="admin-empty">No bookings found.</div>';return `<table class="admin-table"><thead><tr><th>Booking</th><th>Customer</th><th>Slot</th><th>Schedule</th><th>Amount</th><th>Status</th>${compact?'':'<th>Actions</th>'}</tr></thead><tbody>${rows.map(b=>`<tr><td><b>#${b.id}</b><small>${new Date(b.created_at||b.start_time).toLocaleDateString()}</small></td><td>${escapeHtml(b.user_name)}<small>${escapeHtml(b.user_email)}</small></td><td>${escapeHtml(b.slot_number||('Slot '+b.slot_id))}</td><td>${new Date(b.start_time).toLocaleString()}<small>to ${new Date(b.end_time).toLocaleString()}</small></td><td>${money(b.total_price)}</td><td><span class="admin-status ${b.status==='cancelled'?'bad':b.status==='checked_in'?'good':''}">${escapeHtml(b.status)}</span></td>${compact?'':`<td><select class="admin-status-select" data-booking-status="${b.id}"><option ${b.status==='confirmed'?'selected':''} value="confirmed">Confirmed</option><option ${b.status==='checked_in'?'selected':''} value="checked_in">Check in</option><option ${b.status==='checked_out'?'selected':''} value="checked_out">Check out</option><option ${b.status==='cancelled'?'selected':''} value="cancelled">Cancel</option></select></td>`}</tr>`).join('')}</tbody></table>`;}
function slotsTable(rows,editable=true){if(!rows.length)return '<div class="admin-empty">No slots configured.</div>';return `<table class="admin-table"><thead><tr><th>Slot</th><th>Location</th><th>Hourly</th><th>Daily</th><th>Status</th>${editable?'<th>Actions</th>':''}</tr></thead><tbody>${rows.map(s=>`<tr><td><b>${escapeHtml(s.slot_number)}</b></td><td>${escapeHtml(s.location)}</td><td>${money(s.hourly_rate)}</td><td>${money(s.daily_rate)}</td><td><span class="admin-status ${s.status==='active'?'good':'warn'}">${escapeHtml(s.status||'active')}</span></td>${editable?`<td class="admin-actions"><button class="admin-secondary" data-edit-slot="${s.id}">Edit</button><button class="admin-danger" data-delete-slot="${s.id}">Delete</button></td>`:''}</tr>`).join('')}</tbody></table>`;}
function usersTable(rows){if(!rows.length)return '<div class="admin-empty">No customer booking history found.</div>';return `<table class="admin-table"><thead><tr><th>Customer</th><th>Bookings</th><th>Active bookings</th><th>Recorded spend</th><th>Last booking</th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${escapeHtml(u.name)}</b><small>${escapeHtml(u.email)}</small></td><td>${u.total_bookings}</td><td>${u.active_bookings}</td><td>${money(u.total_spent)}</td><td>${u.last_booking?new Date(u.last_booking).toLocaleDateString():'—'}</td></tr>`).join('')}</tbody></table>`;}
function dailyReportTable(rows){return rows.length?`<table class="admin-table"><thead><tr><th>Date</th><th>Bookings</th><th>Revenue</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${new Date(r.day).toLocaleDateString()}</td><td>${r.bookings}</td><td>${money(r.revenue)}</td></tr>`).join('')}</tbody></table>`:'<div class="admin-empty">No activity recorded in the last 30 days.</div>';}
function slotReportTable(rows){return rows.length?`<table class="admin-table"><thead><tr><th>Slot</th><th>Bookings</th><th>Revenue</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.slot_number)}</td><td>${r.bookings}</td><td>${money(r.revenue)}</td></tr>`).join('')}</tbody></table>`:'<div class="admin-empty">No slots available.</div>';}
function slotEditor(slot=null){const root=$('slotEditor');root.innerHTML=`<div class="admin-panel admin-editor"><div class="admin-panel-head"><h3>${slot?'Edit parking slot':'Add parking slot'}</h3><button class="admin-secondary" id="cancelSlotEdit">Close</button></div><form id="slotForm" class="admin-form-grid"><label>Slot number<input name="slot_number" required maxlength="20" value="${escapeHtml(slot?.slot_number||'')}"></label><label>Location<input name="location" required maxlength="100" value="${escapeHtml(slot?.location||'')}"></label><label>Hourly rate (₹)<input name="hourly_rate" type="number" min="0" step="0.01" required value="${slot?.hourly_rate??20}"></label><label>Daily rate (₹)<input name="daily_rate" type="number" min="0" step="0.01" required value="${slot?.daily_rate??150}"></label><label>Status<select name="status"><option value="active" ${slot?.status==='active'?'selected':''}>Active</option><option value="maintenance" ${slot?.status==='maintenance'?'selected':''}>Maintenance</option><option value="inactive" ${slot?.status==='inactive'?'selected':''}>Inactive</option></select></label><div class="admin-form-actions"><button class="admin-primary" type="submit">${slot?'Save changes':'Create slot'}</button></div><p id="slotFormError" class="admin-error hidden"></p></form></div>`;$('cancelSlotEdit').onclick=()=>root.innerHTML='';$('slotForm').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target);const payload=Object.fromEntries(form.entries());payload.hourly_rate=Number(payload.hourly_rate);payload.daily_rate=Number(payload.daily_rate);try{await api('/admin/slots'+(slot?'/'+slot.id:''),{method:slot?'PUT':'POST',body:JSON.stringify(payload)});showToast(slot?'Slot updated.':'Slot created.');await loadAdminPage('slots');await loadSlots();}catch(err){$('slotFormError').textContent=err.message;$('slotFormError').classList.remove('hidden');}};}
async function deleteAdminSlot(id){if(!confirm('Delete this slot? Slots with booking history cannot be deleted.'))return;try{const d=await api('/admin/slots/'+id,{method:'DELETE'});showToast(d.message);await loadAdminPage('slots');await loadSlots();}catch(e){showToast(e.message,true);}}
function wireBookingActions(){document.querySelectorAll('[data-booking-status]').forEach(sel=>sel.onchange=async()=>{const id=sel.dataset.bookingStatus;const status=sel.value;if(status==='cancelled'&&!confirm('Cancel this booking?')){loadAdminPage('bookings');return;}try{await api('/admin/bookings/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});showToast('Booking status updated.');await loadAdminPage('bookings');await loadSlots();}catch(e){showToast(e.message,true);loadAdminPage('bookings');}});}
function downloadCsv(filename,rows){const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}

function openModal(html) {
  $('modalContent').innerHTML = html;
  $('modal').classList.remove('hidden');
  $('modal').setAttribute('aria-hidden','false');
}
function closeModal() {
  $('modal').classList.remove('admin-modal');
  $('modal').classList.add('hidden');
  $('modal').setAttribute('aria-hidden','true');
}

document.addEventListener('DOMContentLoaded', () => {
  $('availabilityDate').value = localDateString();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('startTime').value = toInputDateTime(tomorrow);
  const tomorrowEnd = new Date(tomorrow.getTime() + 3600000);
  $('endTime').value = toInputDateTime(tomorrowEnd);

  loadSlots();
  $('availabilityDate').addEventListener('change', loadAvailability);
  $('bookingForm').addEventListener('submit', submitBooking);
  ['slotId','startTime','endTime'].forEach(id => $(id).addEventListener('change', updatePricePreview));
  $('lookupBtn').addEventListener('click', lookupBooking);
  $('adminLoginBtn').addEventListener('click', () => state.adminToken ? openAdminDashboard() : openAdminLogin());
  $('bookingId').addEventListener('keydown', e => { if(e.key === 'Enter') lookupBooking(); });
  $('modalClose').addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  window.selectSlot = selectSlot; window.lookupBooking = lookupBooking; window.cancelBooking = cancelBooking; window.closeModal = closeModal;
});
