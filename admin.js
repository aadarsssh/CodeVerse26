/**
 * CodeVerse Hackathon 2026 - Admin Portal Logic
 */

(() => {
  'use strict';

  let teams = [];
  let currentFilter = 'ALL';
  let searchQuery = '';
  let activeRejectRid = null;

  // DOM Elements
  const $teamsContainer = document.getElementById('admin-teams-container');
  const $statTotal = document.getElementById('stat-total');
  const $statPending = document.getElementById('stat-pending');
  const $statVerified = document.getElementById('stat-verified');
  const $statRejected = document.getElementById('stat-rejected');
  const $statAmount = document.getElementById('stat-amount');
  const $searchInput = document.getElementById('admin-search-input');
  const $filterTabs = document.querySelectorAll('.filter-tab');
  const $btnExportCsv = document.getElementById('btn-export-csv');

  // Modals
  const $proofModal = document.getElementById('proof-modal');
  const $proofModalContent = document.getElementById('proof-modal-content');
  const $proofModalCaption = document.getElementById('proof-modal-caption');
  const $proofModalDownload = document.getElementById('proof-modal-download');
  const $btnCloseProofModal = document.getElementById('btn-close-proof-modal');

  const $rejectModal = document.getElementById('reject-modal');
  const $rejectModalTeamName = document.getElementById('reject-modal-team-name');
  const $rejectRemarks = document.getElementById('reject-remarks');
  const $btnCancelReject = document.getElementById('btn-cancel-reject');
  const $btnConfirmReject = document.getElementById('btn-confirm-reject');
  const $btnCloseRejectModal = document.getElementById('btn-close-reject-modal');

  const $toastContainer = document.getElementById('admin-toast-container');

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `btn btn-sm`;
    toast.style.background = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)';
    toast.style.color = '#fff';
    toast.style.boxShadow = 'var(--shadow-md)';
    toast.innerText = message;
    $toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  window.copyText = function(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`✓ Copied ${label}`, 'success');
    }).catch(() => {
      showToast(`Copied ${label}`, 'success');
    });
  };

  async function fetchTeams() {
    try {
      const res = await fetch('/api/admin/registrations');
      if (res.ok) {
        teams = await res.json();
        render();
        return;
      }
    } catch (e) {
      console.log("Loading teams from offline mock store...");
    }

    // Fallback to localStorage mock
    const mockDB = JSON.parse(localStorage.getItem('codeverse2026_mock_teams') || '{}');
    teams = Object.values(mockDB);
    if (teams.length === 0) {
      // Seed a sample team if completely empty
      seedDemoData();
    }
    render();
  }

  function seedDemoData() {
    const demo = {
      "CV26-DEMO01": {
        registration_id: "CV26-DEMO01",
        team_name: "Quantum Coders",
        college_name: "Indian Institute of Information Technology",
        track: "AI & Intelligent Systems",
        project_title: "Autonomous Drone Path Optimization",
        member_count: 4,
        expected_amount: 600,
        status: "VERIFICATION_PENDING",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        members: [
          { position: 1, is_leader: true, full_name: "Aarav Sharma", reg_no: "22BCS012", email: "aarav@iiit.ac.in", phone: "9876543210" },
          { position: 2, is_leader: false, full_name: "Priya Patel", reg_no: "22BCS019", email: "priya@iiit.ac.in", phone: "9876543211" },
          { position: 3, is_leader: false, full_name: "Rohan Gupta", reg_no: "22BCS034", email: "rohan@iiit.ac.in", phone: "9876543212" },
          { position: 4, is_leader: false, full_name: "Neha Verma", reg_no: "22BCS041", email: "neha@iiit.ac.in", phone: "9876543213" }
        ],
        payment: {
          method: "UPI",
          txn_id: "419283019283",
          txn_date: new Date().toISOString().slice(0, 10),
          amount_paid: 600,
          proof_url: "assets/qr-code.svg",
          status: "PENDING"
        }
      }
    };
    localStorage.setItem('codeverse2026_mock_teams', JSON.stringify(demo));
    teams = Object.values(demo);
  }

  async function updateStatus(rid, newStatus, remarks = '') {
    try {
      const res = await fetch(`/api/admin/registrations/${rid}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, remarks })
      });
      if (res.ok) {
        showToast(`Team ${rid} status updated to ${newStatus}`, 'success');
        await fetchTeams();
        return;
      }
    } catch (e) {
      console.log("Updating in offline mock store...");
    }

    // Fallback update
    const mockDB = JSON.parse(localStorage.getItem('codeverse2026_mock_teams') || '{}');
    if (mockDB[rid]) {
      mockDB[rid].status = newStatus === 'VERIFIED' ? 'CONFIRMED' : newStatus === 'REJECTED' ? 'PAYMENT_REJECTED' : newStatus;
      if (mockDB[rid].payment) {
        mockDB[rid].payment.status = newStatus;
        if (remarks) mockDB[rid].payment.admin_remarks = remarks;
      }
      localStorage.setItem('codeverse2026_mock_teams', JSON.stringify(mockDB));
      showToast(`Team ${rid} status updated to ${newStatus}`, 'success');
      await fetchTeams();
    }
  }

  function renderStats() {
    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let amount = 0;

    teams.forEach(t => {
      if (t.status === 'VERIFICATION_PENDING') pending++;
      else if (t.status === 'CONFIRMED') verified++;
      else if (t.status === 'PAYMENT_REJECTED') rejected++;

      if (t.payment && t.payment.amount_paid) {
        amount += Number(t.payment.amount_paid);
      }
    });

    $statTotal.innerText = teams.length;
    $statPending.innerText = pending;
    $statVerified.innerText = verified;
    $statRejected.innerText = rejected;
    $statAmount.innerText = `₹${amount.toLocaleString('en-IN')}`;
  }

  function getFilteredTeams() {
    return teams.filter(t => {
      // Filter by tab
      if (currentFilter !== 'ALL' && t.status !== currentFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const rid = (t.registration_id || '').toLowerCase();
        const name = (t.team_name || '').toLowerCase();
        const college = (t.college_name || '').toLowerCase();
        const leader = (t.members && t.members[0] ? t.members[0].full_name : '').toLowerCase();
        const utr = (t.payment && t.payment.txn_id ? t.payment.txn_id : '').toLowerCase();

        return rid.includes(q) || name.includes(q) || college.includes(q) || leader.includes(q) || utr.includes(q);
      }
      return true;
    });
  }

  function render() {
    renderStats();
    const filtered = getFilteredTeams();

    if (filtered.length === 0) {
      $teamsContainer.innerHTML = `
        <div style="padding: 48px; text-align: center; color: var(--text-secondary);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
          <h4 style="color:#fff; margin-bottom: 4px;">No team registrations found</h4>
          <p style="font-size:0.85rem;">Try adjusting your search criteria or filter tabs.</p>
        </div>
      `;
      return;
    }

    $teamsContainer.innerHTML = filtered.map(t => {
      const leader = t.members && t.members[0] ? t.members[0] : { full_name: "Unknown", phone: "-", email: "-" };
      const p = t.payment;
      const rid = t.registration_id;

      let statusBadge = '<span class="badge-status pending">⏳ Pending Verification</span>';
      if (t.status === 'CONFIRMED') {
        statusBadge = '<span class="badge-status confirmed">✓ Verified</span>';
      } else if (t.status === 'PAYMENT_REJECTED') {
        statusBadge = '<span class="badge-status rejected">✕ Rejected</span>';
      } else if (t.status === 'PAYMENT_PENDING') {
        statusBadge = '<span class="badge-status" style="background:rgba(255,255,255,0.08); color:var(--text-secondary);">Awaiting Payment</span>';
      }

      return `
        <div class="admin-team-row" id="row-${rid}">
          <div class="team-main-meta">
            <!-- Left Info -->
            <div class="team-info-group">
              <div class="team-name-title">
                <span>${t.team_name}</span>
                <span class="role-tag leader" style="font-family:var(--font-mono);">${rid}</span>
                ${statusBadge}
              </div>
              <div class="sub-meta">
                <span>🏛️ <b>${t.college_name}</b></span>
                <span>🎯 Track: <b>${t.track}</b></span>
                <span>👑 Leader: <b>${leader.full_name}</b> (${leader.phone})</span>
              </div>
            </div>

            <!-- Payment Summary Card -->
            <div class="payment-meta-badge">
              ${p ? `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="color:var(--text-muted); font-size:0.75rem;">METHOD</span>
                  <b>${p.method}</b>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="color:var(--text-muted); font-size:0.75rem;">UTR / TXN</span>
                  <code style="font-family:var(--font-mono); color:var(--accent-cyan);">${p.txn_id}</code>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="color:var(--text-muted); font-size:0.75rem;">PAID</span>
                  <b style="color:var(--success);">₹${p.amount_paid}</b>
                </div>
                ${p.proof_url ? `
                  <button type="button" class="proof-thumbnail-btn" onclick="window.viewProof('${rid}', '${p.proof_url}')">
                    📷 View Screenshot Proof
                  </button>
                ` : ''}
              ` : `
                <span style="color:var(--text-muted); font-size:0.8rem;">No payment submitted yet</span>
              `}
            </div>

            <!-- Actions -->
            <div class="action-button-group">
              <button type="button" class="btn-sm btn-verify" onclick="window.confirmVerify('${rid}')" ${t.status === 'CONFIRMED' ? 'disabled' : ''}>
                ✓ Approve
              </button>
              <button type="button" class="btn-sm btn-reject" onclick="window.openRejectModal('${rid}', '${t.team_name}')" ${t.status === 'PAYMENT_REJECTED' ? 'disabled' : ''}>
                ✕ Reject
              </button>
              <button type="button" class="btn-sm btn-secondary" onclick="window.toggleDrawer('${rid}')">
                👥 ${t.member_count || (t.members ? t.members.length : 4)} Members ▾
              </button>
            </div>
          </div>

          <!-- Expandable Team Members Drawer -->
          <div class="members-drawer" id="drawer-${rid}">
            <h5 style="font-size:0.82rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
              Team Members Roster (${t.members ? t.members.length : 0} Members)
            </h5>
            <div style="overflow-x: auto;">
              <table class="roster-table" style="margin:0;">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Role</th>
                    <th>Name</th>
                    <th>Reg No</th>
                    <th>College Email</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  ${(t.members || []).map((m, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><span class="role-tag ${idx === 0 ? 'leader' : 'member'}">${idx === 0 ? 'Leader' : 'Member'}</span></td>
                      <td><b>${m.full_name}</b></td>
                      <td><code>${m.reg_no}</code></td>
                      <td>${m.email}</td>
                      <td>${m.phone}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ${p && p.admin_remarks ? `
              <div style="margin-top:10px; font-size:0.82rem; color:var(--danger); background:var(--danger-bg); padding:8px 12px; border-radius:4px;">
                <b>Rejection Reason:</b> ${p.admin_remarks}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Window Action Handlers
  window.toggleDrawer = function(rid) {
    const $drawer = document.getElementById(`drawer-${rid}`);
    if ($drawer) {
      $drawer.classList.toggle('open');
    }
  };

  window.confirmVerify = function(rid) {
    if (confirm(`Approve payment verification for team ${rid}?`)) {
      updateStatus(rid, 'VERIFIED');
    }
  };

  window.openRejectModal = function(rid, teamName) {
    activeRejectRid = rid;
    $rejectModalTeamName.innerText = `${teamName} (${rid})`;
    $rejectRemarks.value = '';
    $rejectModal.classList.add('open');
  };

  window.viewProof = function(rid, proofUrl) {
    $proofModalCaption.innerText = `Registration ID: ${rid}`;
    $proofModalDownload.href = proofUrl;
    $proofModalContent.innerHTML = `<img src="${proofUrl}" alt="Proof" style="max-width:100%; max-height:420px; object-fit:contain;" />`;
    $proofModal.classList.add('open');
  };

  // Modal Close Events
  $btnCloseProofModal.onclick = () => $proofModal.classList.remove('open');
  $btnCloseRejectModal.onclick = () => $rejectModal.classList.remove('open');
  $btnCancelReject.onclick = () => $rejectModal.classList.remove('open');

  $btnConfirmReject.onclick = () => {
    const remarks = $rejectRemarks.value.trim();
    if (!remarks) {
      alert("Please provide a reason for rejecting the payment.");
      return;
    }
    $rejectModal.classList.remove('open');
    updateStatus(activeRejectRid, 'REJECTED', remarks);
  };

  // Search & Filter Events
  $searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    render();
  };

  $filterTabs.forEach(tab => {
    tab.onclick = () => {
      $filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      render();
    };
  });

  // Export CSV
  $btnExportCsv.onclick = () => {
    if (teams.length === 0) {
      showToast("No teams to export", "error");
      return;
    }

    const headers = [
      "Registration ID",
      "Team Name",
      "College",
      "Track",
      "Member Count",
      "Leader Name",
      "Leader Email",
      "Leader Phone",
      "Payment Status",
      "Payment Method",
      "Transaction ID",
      "Amount Paid",
      "Submitted At"
    ];

    const rows = teams.map(t => {
      const leader = t.members && t.members[0] ? t.members[0] : {};
      const p = t.payment || {};
      return [
        `"${t.registration_id || ''}"`,
        `"${(t.team_name || '').replace(/"/g, '""')}"`,
        `"${(t.college_name || '').replace(/"/g, '""')}"`,
        `"${(t.track || '').replace(/"/g, '""')}"`,
        t.member_count || (t.members ? t.members.length : 0),
        `"${(leader.full_name || '').replace(/"/g, '""')}"`,
        `"${leader.email || ''}"`,
        `"${leader.phone || ''}"`,
        `"${t.status || ''}"`,
        `"${p.method || ''}"`,
        `"${p.txn_id || ''}"`,
        p.amount_paid || 0,
        `"${t.created_at || ''}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CodeVerse2026_Teams_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("✓ CSV exported successfully", "success");
  };

  fetchTeams();
})();
