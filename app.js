/**
 * CodeVerse Hackathon 2026 - Student Registration & Payment Flow
 */

(() => {
  'use strict';

  // ---- Central State ----
  const STORAGE_KEY = 'codeverse2026_draft_v1';
  let config = {
    event_title: "CodeVerse Hackathon 2026",
    min_members: 4,
    max_members: 6,
    fee_per_member: 150,
    currency_symbol: "₹",
    tracks: [
      "AI & Intelligent Systems",
      "Web3 & Decentralized Apps",
      "FinTech & Cybersecurity",
      "Smart Cities & IoT",
      "Healthcare & BioTech",
      "Open Innovation"
    ],
    payment_methods: {
      bank: {
        account_holder: "CODEVERSE HACKATHON 2026",
        bank_name: "State Bank of India",
        account_number: "418902839410",
        ifsc: "SBIN0004821",
        branch: "University Campus Branch"
      },
      upi: {
        upi_id: "codeverse2026@sbi",
        qr_code_svg: "assets/qr-code.svg"
      }
    }
  };

  let state = {
    step: 1,
    registrationId: null,
    status: null,
    team: {
      name: "",
      college: "",
      track: "AI & Intelligent Systems",
      projectTitle: "",
      members: [
        { is_leader: true, full_name: "", reg_no: "", email: "", phone: "" },
        { is_leader: false, full_name: "", reg_no: "", email: "", phone: "" },
        { is_leader: false, full_name: "", reg_no: "", email: "", phone: "" },
        { is_leader: false, full_name: "", reg_no: "", email: "", phone: "" }
      ]
    },
    payment: {
      method: "UPI",
      txn_id: "",
      txn_date: new Date().toISOString().slice(0, 10),
      amount_paid: 600,
      proofFile: null,
      proofPreviewUrl: null
    },
    errors: {},
    isSubmitting: false
  };

  // ---- DOM Elements ----
  const $screenMount = document.getElementById('screen-mount');
  const $stepper = document.getElementById('registration-stepper');
  const $bottomBar = document.getElementById('sticky-bottom-bar');
  const $btnBarPrev = document.getElementById('btn-bar-prev');
  const $btnBarNext = document.getElementById('btn-bar-next');
  const $barCaption = document.getElementById('bar-caption');
  const $barSummary = document.getElementById('bar-summary');
  const $toastContainer = document.getElementById('toast-container');

  // ---- Toast Notification Helper ----
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `btn btn-sm`;
    toast.style.background = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)';
    toast.style.color = '#fff';
    toast.style.boxShadow = 'var(--shadow-md)';
    toast.style.animation = 'fadeIn 0.2s ease';
    toast.innerText = message;
    $toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ---- Copy to Clipboard Helper ----
  window.copyText = function(text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`✓ Copied ${label} to clipboard!`, 'success');
      }).catch(() => fallbackCopy(text, label));
    } else {
      fallbackCopy(text, label);
    }
  };

  function fallbackCopy(text, label) {
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    showToast(`✓ Copied ${label} to clipboard!`, 'success');
  }

  // ---- State Persistence ----
  function saveDraft() {
    try {
      const dataToSave = {
        step: state.step,
        registrationId: state.registrationId,
        status: state.status,
        team: state.team,
        payment: {
          method: state.payment.method,
          txn_id: state.payment.txn_id,
          txn_date: state.payment.txn_date,
          amount_paid: state.payment.amount_paid
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn("Unable to save draft", e);
    }
  }

  function loadDraft() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.team && Array.isArray(parsed.team.members)) {
          state.team = parsed.team;
          state.registrationId = parsed.registrationId || null;
          state.status = parsed.status || null;
          if (parsed.payment) {
            state.payment.method = parsed.payment.method || "UPI";
            state.payment.txn_id = parsed.payment.txn_id || "";
            state.payment.txn_date = parsed.payment.txn_date || new Date().toISOString().slice(0, 10);
          }
          if (state.registrationId && state.step === 1) {
            state.step = 4; // resume at payment if already registered
          }
        }
      }
    } catch (e) {
      console.warn("Unable to parse draft", e);
    }
  }

  // ---- Validation Functions ----
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());
  }

  function validatePhone(phone) {
    const cleaned = String(phone).replace(/[\s\-+]/g, '');
    return /^\d{10,12}$/.test(cleaned);
  }

  function validateStep1() {
    const errs = {};
    if (!state.team.name.trim()) errs.team_name = "Team name is required.";
    else if (state.team.name.trim().length < 3) errs.team_name = "Team name must be at least 3 characters.";

    if (!state.team.college.trim()) errs.team_college = "College/Institution name is required.";
    if (!state.team.track) errs.team_track = "Please select a hackathon track.";

    // Leader info
    const leader = state.team.members[0];
    if (!leader.full_name.trim()) errs.leader_name = "Leader's full name is required.";
    if (!leader.reg_no.trim()) errs.leader_reg = "Leader's registration/roll number is required.";
    if (!leader.email.trim()) errs.leader_email = "Leader's college email is required.";
    else if (!validateEmail(leader.email)) errs.leader_email = "Enter a valid email address.";

    if (!leader.phone.trim()) errs.leader_phone = "Leader's 10-digit phone number is required.";
    else if (!validatePhone(leader.phone)) errs.leader_phone = "Enter a valid 10-digit phone number.";

    state.errors = errs;
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs = {};
    const count = state.team.members.length;
    if (count < config.min_members || count > config.max_members) {
      errs.team_count = `A team must have between ${config.min_members} and ${config.max_members} members. (Currently: ${count})`;
    }

    const emails = [];
    const phones = [];
    const regNos = [];

    state.team.members.forEach((m, idx) => {
      const prefix = `member_${idx}`;
      if (!m.full_name.trim()) errs[`${prefix}_name`] = "Full name is required.";
      if (!m.reg_no.trim()) errs[`${prefix}_reg`] = "Registration/Roll number is required.";
      if (!m.email.trim()) errs[`${prefix}_email`] = "Email address is required.";
      else if (!validateEmail(m.email)) errs[`${prefix}_email`] = "Enter a valid email address.";

      if (!m.phone.trim()) errs[`${prefix}_phone`] = "Phone number is required.";
      else if (!validatePhone(m.phone)) errs[`${prefix}_phone`] = "Enter a valid 10-digit phone number.";

      // Check duplicates
      const emailLower = m.email.trim().toLowerCase();
      const phoneClean = m.phone.trim().replace(/[\s\-+]/g, '');
      const regClean = m.reg_no.trim().toLowerCase();

      if (emailLower) {
        if (emails.includes(emailLower)) errs[`${prefix}_email`] = "This email is already used by another team member.";
        else emails.push(emailLower);
      }

      if (phoneClean) {
        if (phones.includes(phoneClean)) errs[`${prefix}_phone`] = "This phone number is already used by another member.";
        else phones.push(phoneClean);
      }

      if (regClean) {
        if (regNos.includes(regClean)) errs[`${prefix}_reg`] = "This registration number is already used by another member.";
        else regNos.push(regClean);
      }
    });

    state.errors = errs;
    return Object.keys(errs).length === 0;
  }

  function validateStep5() {
    const errs = {};
    const txn = state.payment.txn_id.trim();
    if (!txn) {
      errs.txn_id = "Transaction ID / UTR Number is required.";
    } else if (!/^[A-Za-z0-9\-_/]{6,40}$/.test(txn)) {
      errs.txn_id = "Enter the UTR / transaction ID exactly as shown in your payment app (6–40 characters).";
    }

    if (!state.payment.txn_date) {
      errs.txn_date = "Payment date is required.";
    }

    if (!state.payment.amount_paid || Number(state.payment.amount_paid) <= 0) {
      errs.amount_paid = "Please enter the amount paid.";
    }

    state.errors = errs;
    return Object.keys(errs).length === 0;
  }

  // ---- Navigation Handlers ----
  function goToStep(targetStep) {
    if (targetStep < state.step) {
      state.step = targetStep;
      state.errors = {};
      saveDraft();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Forward validation
    if (state.step === 1 && !validateStep1()) {
      render();
      showToast("Please correct the errors in Step 1", "error");
      focusFirstError();
      return;
    }

    if (state.step === 2 && !validateStep2()) {
      render();
      showToast("Please correct the errors in Step 2", "error");
      focusFirstError();
      return;
    }

    if (state.step === 3 && targetStep === 4) {
      // Create team in backend or mock
      handleCreateTeam();
      return;
    }

    if (state.step === 4 && targetStep === 5) {
      state.step = 5;
      saveDraft();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (state.step === 5 && targetStep === 6) {
      if (!validateStep5()) {
        render();
        showToast("Please provide valid transaction details", "error");
        focusFirstError();
        return;
      }
      handleSubmitPayment();
      return;
    }

    state.step = targetStep;
    state.errors = {};
    saveDraft();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function focusFirstError() {
    setTimeout(() => {
      const errEl = document.querySelector('[aria-invalid="true"]');
      if (errEl) errEl.focus();
    }, 50);
  }

  // ---- Dynamic Team Member Manipulation ----
  function addMember() {
    if (state.team.members.length >= config.max_members) {
      showToast(`Maximum team size is ${config.max_members} members.`, 'error');
      return;
    }
    state.team.members.push({
      is_leader: false,
      full_name: "",
      reg_no: "",
      email: "",
      phone: ""
    });
    // recalculate fee
    state.payment.amount_paid = state.team.members.length * config.fee_per_member;
    saveDraft();
    render();
  }

  function removeMember(index) {
    if (state.team.members.length <= config.min_members) {
      showToast(`Minimum team size is ${config.min_members} members. Cannot remove.`, 'error');
      return;
    }
    if (index === 0) {
      showToast("Team Leader cannot be removed.", "error");
      return;
    }
    state.team.members.splice(index, 1);
    state.payment.amount_paid = state.team.members.length * config.fee_per_member;
    saveDraft();
    render();
  }

  // ---- Backend & Offline API Layer ----
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        config = Object.assign(config, data);
      }
    } catch (e) {
      console.log("Using local configuration defaults.");
    }
  }

  async function handleCreateTeam() {
    state.isSubmitting = true;
    render();

    const payload = {
      team_name: state.team.name.trim(),
      college_name: state.team.college.trim(),
      track: state.team.track,
      project_title: state.team.projectTitle.trim(),
      members: state.team.members.map((m, idx) => ({
        position: idx + 1,
        is_leader: idx === 0,
        full_name: m.full_name.trim(),
        reg_no: m.reg_no.trim().toUpperCase(),
        email: m.email.trim().toLowerCase(),
        phone: m.phone.trim()
      }))
    };

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        state.registrationId = data.registration_id;
        state.status = data.status || "PAYMENT_PENDING";
        state.step = 4;
        state.isSubmitting = false;
        saveDraft();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast("Team details saved! Please proceed with payment.", "success");
      } else {
        const err = await res.json();
        state.isSubmitting = false;
        if (res.status === 409) {
          state.errors = { team_name: err.detail || "A team with this name is already registered." };
          state.step = 1;
        } else {
          showToast(err.detail || "Registration failed. Please check your details.", "error");
        }
        render();
      }
    } catch (e) {
      // Fallback for static client testing
      console.warn("Backend API not reachable, running mock fallback:", e);
      simulateClientTeamCreation(payload);
    }
  }

  function simulateClientTeamCreation(payload) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rid = "CV26-";
    for (let i = 0; i < 6; i++) {
      rid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    state.registrationId = rid;
    state.status = "PAYMENT_PENDING";
    state.step = 4;
    state.isSubmitting = false;
    saveDraft();

    // Store in localStorage mock DB for admin visibility
    const mockDB = JSON.parse(localStorage.getItem('codeverse2026_mock_teams') || '{}');
    mockDB[rid] = {
      registration_id: rid,
      team_name: payload.team_name,
      college_name: payload.college_name,
      track: payload.track,
      project_title: payload.project_title,
      member_count: payload.members.length,
      expected_amount: payload.members.length * config.fee_per_member,
      status: "PAYMENT_PENDING",
      members: payload.members,
      payment: null,
      created_at: new Date().toISOString()
    };
    localStorage.setItem('codeverse2026_mock_teams', JSON.stringify(mockDB));

    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("Team details saved! Please proceed with payment.", "success");
  }

  async function handleSubmitPayment() {
    state.isSubmitting = true;
    render();

    const formData = new FormData();
    formData.append('method', state.payment.method);
    formData.append('txn_id', state.payment.txn_id.trim().toUpperCase());
    formData.append('txn_date', state.payment.txn_date);
    formData.append('amount_paid', String(state.payment.amount_paid));
    if (state.payment.proofFile) {
      formData.append('proof', state.payment.proofFile);
    }

    try {
      const res = await fetch(`/api/registrations/${state.registrationId}/payment`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        state.status = "VERIFICATION_PENDING";
        state.step = 6;
        state.isSubmitting = false;
        saveDraft();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast("Payment submitted successfully!", "success");
      } else {
        const err = await res.json();
        state.isSubmitting = false;
        if (res.status === 409) {
          state.errors = { txn_id: err.detail || "This transaction ID has already been submitted." };
        } else {
          showToast(err.detail || "Error submitting payment. Please try again.", "error");
        }
        render();
      }
    } catch (e) {
      // Fallback for static mock
      console.warn("Backend API not reachable, running mock fallback:", e);
      simulateClientPaymentSubmission();
    }
  }

  function simulateClientPaymentSubmission() {
    const rid = state.registrationId;
    const mockDB = JSON.parse(localStorage.getItem('codeverse2026_mock_teams') || '{}');
    if (mockDB[rid]) {
      mockDB[rid].payment = {
        method: state.payment.method,
        txn_id: state.payment.txn_id.trim().toUpperCase(),
        txn_date: state.payment.txn_date,
        amount_paid: Number(state.payment.amount_paid),
        proof_url: state.payment.proofPreviewUrl || null,
        status: "PENDING",
        created_at: new Date().toISOString()
      };
      mockDB[rid].status = "VERIFICATION_PENDING";
      localStorage.setItem('codeverse2026_mock_teams', JSON.stringify(mockDB));
    }
    state.status = "VERIFICATION_PENDING";
    state.step = 6;
    state.isSubmitting = false;
    saveDraft();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("Payment submitted successfully!", "success");
  }

  async function checkRegistrationStatus(rid) {
    try {
      const res = await fetch(`/api/registrations/${rid}`);
      if (res.ok) {
        const data = await res.json();
        state.registrationId = data.registration_id;
        state.team.name = data.team_name;
        state.status = data.status;
        state.step = 6;
        render();
        return;
      }
    } catch (e) {
      const mockDB = JSON.parse(localStorage.getItem('codeverse2026_mock_teams') || '{}');
      if (mockDB[rid]) {
        state.registrationId = rid;
        state.team.name = mockDB[rid].team_name;
        state.status = mockDB[rid].status;
        state.step = 6;
        render();
        return;
      }
    }
    showToast("Registration ID not found.", "error");
  }

  // ---- Stepper UI Updater ----
  function updateStepper() {
    for (let i = 1; i <= 6; i++) {
      const node = document.getElementById(`step-node-${i}`);
      const divider = document.getElementById(`divider-${i - 1}`);

      if (!node) continue;
      node.classList.remove('active', 'completed');

      if (i === state.step) {
        node.classList.add('active');
      } else if (i < state.step) {
        node.classList.add('completed');
        node.onclick = () => goToStep(i);
      } else {
        node.onclick = null;
      }

      if (divider) {
        if (i <= state.step) divider.classList.add('filled');
        else divider.classList.remove('filled');
      }
    }
  }

  // ---- Render Screens ----
  function render() {
    updateStepper();

    // Bottom action bar controls
    if (state.step <= 5) {
      $bottomBar.style.display = 'block';
      $btnBarPrev.style.display = state.step > 1 ? 'inline-flex' : 'none';
      $btnBarPrev.onclick = () => goToStep(state.step - 1);

      if (state.step === 1) {
        $barCaption.innerText = "Step 1 of 5";
        $barSummary.innerText = "Team & Leader Details";
        $btnBarNext.innerText = "Continue to Members →";
        $btnBarNext.onclick = () => goToStep(2);
      } else if (state.step === 2) {
        $barCaption.innerText = "Step 2 of 5";
        $barSummary.innerText = `${state.team.members.length} Members (${config.min_members} to ${config.max_members} required)`;
        $btnBarNext.innerText = "Review Details →";
        $btnBarNext.onclick = () => goToStep(3);
      } else if (state.step === 3) {
        $barCaption.innerText = "Step 3 of 5";
        $barSummary.innerText = "Review & Total Fee";
        $btnBarNext.innerText = state.isSubmitting ? "Saving Team..." : "Proceed to Payment →";
        $btnBarNext.disabled = state.isSubmitting;
        $btnBarNext.onclick = () => goToStep(4);
      } else if (state.step === 4) {
        $barCaption.innerText = "Step 4 of 5";
        $barSummary.innerText = `Fee: ₹${state.team.members.length * config.fee_per_member}`;
        $btnBarNext.innerText = "I have paid — Enter UTR →";
        $btnBarNext.onclick = () => goToStep(5);
      } else if (state.step === 5) {
        $barCaption.innerText = "Step 5 of 5";
        $barSummary.innerText = "Submit Payment Verification";
        $btnBarNext.innerText = state.isSubmitting ? "Submitting..." : "Submit Registration ✓";
        $btnBarNext.disabled = state.isSubmitting;
        $btnBarNext.onclick = () => goToStep(6);
      }
    } else {
      $bottomBar.style.display = 'none';
    }

    // Render screen view
    switch (state.step) {
      case 1:
        $screenMount.innerHTML = renderStep1();
        bindStep1Events();
        break;
      case 2:
        $screenMount.innerHTML = renderStep2();
        bindStep2Events();
        break;
      case 3:
        $screenMount.innerHTML = renderStep3();
        bindStep3Events();
        break;
      case 4:
        $screenMount.innerHTML = renderStep4();
        bindStep4Events();
        break;
      case 5:
        $screenMount.innerHTML = renderStep5();
        bindStep5Events();
        break;
      case 6:
        $screenMount.innerHTML = renderStep6();
        bindStep6Events();
        break;
      default:
        $screenMount.innerHTML = renderStep1();
        bindStep1Events();
    }
  }

  // ==========================================
  // SCREEN 1: Team & Leader Details
  // ==========================================
  function renderStep1() {
    const leader = state.team.members[0];
    const e = state.errors;

    return `
      <div class="hero-block">
        <div class="hero-pill"><span class="dot"></span> Registration Open • 4 to 6 Members</div>
        <h2 class="hero-title">CodeVerse Hackathon 2026</h2>
        <p class="hero-desc">Enter your team details and team leader information. The leader will act as the primary contact for hackathon announcements.</p>
      </div>

      <div class="glass-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">🚀 Team Information</h3>
            <p class="card-subtitle">General team details and hackathon category</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="inp-team-name">Team Name <span class="req">*</span></label>
            <input type="text" id="inp-team-name" placeholder="e.g. ByteBusters" value="${state.team.name}" aria-invalid="${!!e.team_name}">
            <div class="input-feedback">${e.team_name || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-team-college">College / University <span class="req">*</span></label>
            <input type="text" id="inp-team-college" placeholder="e.g. National Institute of Technology" value="${state.team.college}" aria-invalid="${!!e.team_college}">
            <div class="input-feedback">${e.team_college || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-team-track">Hackathon Track / Domain <span class="req">*</span></label>
            <select id="inp-team-track" aria-invalid="${!!e.team_track}">
              ${config.tracks.map(t => `<option value="${t}" ${state.team.track === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <div class="input-feedback">${e.team_track || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-team-project">Project / Problem Idea <span class="hint">Optional</span></label>
            <input type="text" id="inp-team-project" placeholder="e.g. AI-driven solar grid load balancer" value="${state.team.projectTitle || ''}">
            <div class="input-feedback"></div>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">👑 Team Leader Details</h3>
            <p class="card-subtitle">Member #1 (Primary coordinator for OTPs, check-ins, and hackathon communications)</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="inp-leader-name">Full Name <span class="req">*</span></label>
            <input type="text" id="inp-leader-name" placeholder="e.g. Aadarsh Sharma" value="${leader.full_name}" aria-invalid="${!!e.leader_name}">
            <div class="input-feedback">${e.leader_name || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-leader-reg">College Registration / Roll No <span class="req">*</span></label>
            <input type="text" id="inp-leader-reg" placeholder="e.g. 22BCE10921" value="${leader.reg_no}" aria-invalid="${!!e.leader_reg}">
            <div class="input-feedback">${e.leader_reg || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-leader-email">College Email Address <span class="req">*</span></label>
            <input type="email" id="inp-leader-email" placeholder="e.g. aadarsh@university.edu.in" value="${leader.email}" aria-invalid="${!!e.leader_email}">
            <div class="input-feedback">${e.leader_email || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-leader-phone">Phone Number (WhatsApp) <span class="req">*</span></label>
            <input type="tel" id="inp-leader-phone" placeholder="e.g. 9876543210" value="${leader.phone}" maxlength="12" aria-invalid="${!!e.leader_phone}">
            <div class="input-feedback">${e.leader_phone || ''}</div>
          </div>
        </div>
      </div>
    `;
  }

  function bindStep1Events() {
    const $name = document.getElementById('inp-team-name');
    const $college = document.getElementById('inp-team-college');
    const $track = document.getElementById('inp-team-track');
    const $project = document.getElementById('inp-team-project');

    const $lName = document.getElementById('inp-leader-name');
    const $lReg = document.getElementById('inp-leader-reg');
    const $lEmail = document.getElementById('inp-leader-email');
    const $lPhone = document.getElementById('inp-leader-phone');

    $name.oninput = (e) => { state.team.name = e.target.value; saveDraft(); };
    $college.oninput = (e) => { state.team.college = e.target.value; saveDraft(); };
    $track.onchange = (e) => { state.team.track = e.target.value; saveDraft(); };
    $project.oninput = (e) => { state.team.projectTitle = e.target.value; saveDraft(); };

    $lName.oninput = (e) => { state.team.members[0].full_name = e.target.value; saveDraft(); };
    $lReg.oninput = (e) => { state.team.members[0].reg_no = e.target.value; saveDraft(); };
    $lEmail.oninput = (e) => { state.team.members[0].email = e.target.value; saveDraft(); };
    $lPhone.oninput = (e) => { state.team.members[0].phone = e.target.value; saveDraft(); };
  }

  // ==========================================
  // SCREEN 2: Dynamic Team Members (4 to 6)
  // ==========================================
  function renderStep2() {
    const count = state.team.members.length;
    const isAtMax = count >= config.max_members;
    const isAtMin = count <= config.min_members;
    const e = state.errors;

    return `
      <div class="counter-banner">
        <div class="counter-info">
          <div class="counter-badge">${count} / ${config.max_members}</div>
          <div class="counter-text">
            <b>Team Size: ${count} Members</b>
            <p>CodeVerse Hackathon 2026 requires minimum ${config.min_members} and maximum ${config.max_members} members per team.</p>
          </div>
        </div>
        <div style="font-size: 0.85rem; font-weight: 600; color: ${isAtMax ? 'var(--warning)' : 'var(--accent-cyan)'};">
          ${isAtMax ? 'Maximum Reached' : `${config.max_members - count} slots available`}
        </div>
      </div>

      ${e.team_count ? `<div class="security-alert" style="background: var(--danger-bg); border-color: var(--danger-border); border-left-color: var(--danger);"><div class="text"><p style="color:var(--danger);">${e.team_count}</p></div></div>` : ''}

      <div class="glass-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">👥 Team Roster</h3>
            <p class="card-subtitle">Add details for all members. Member #1 is your designated Team Leader.</p>
          </div>
        </div>

        <div id="members-list-container">
          ${state.team.members.map((member, idx) => {
            const isLeader = idx === 0;
            const prefix = `member_${idx}`;

            return `
              <div class="member-card ${isLeader ? 'leader-card' : ''}" id="card-member-${idx}">
                <div class="member-card-header">
                  <div class="member-card-title">
                    <span>${isLeader ? '👑 Team Leader' : `👤 Member #${idx + 1}`}</span>
                    <span class="role-tag ${isLeader ? 'leader' : 'member'}">${isLeader ? 'Leader' : `Position ${idx + 1}`}</span>
                  </div>
                  ${!isLeader ? `
                    <button type="button" class="btn-remove-member" data-index="${idx}" ${isAtMin ? 'disabled title="Minimum 4 members required"' : ''}>
                      ✕ Remove
                    </button>
                  ` : ''}
                </div>

                <div class="form-grid">
                  <div class="form-group">
                    <label>Full Name <span class="req">*</span></label>
                    <input type="text" class="inp-m-name" data-index="${idx}" placeholder="Full Name" value="${member.full_name}" aria-invalid="${!!e[`${prefix}_name`]}">
                    <div class="input-feedback">${e[`${prefix}_name`] || ''}</div>
                  </div>

                  <div class="form-group">
                    <label>College Reg / Roll No <span class="req">*</span></label>
                    <input type="text" class="inp-m-reg" data-index="${idx}" placeholder="e.g. 22BCE1092" value="${member.reg_no}" aria-invalid="${!!e[`${prefix}_reg`]}">
                    <div class="input-feedback">${e[`${prefix}_reg`] || ''}</div>
                  </div>

                  <div class="form-group">
                    <label>College Email <span class="req">*</span></label>
                    <input type="email" class="inp-m-email" data-index="${idx}" placeholder="member@university.edu.in" value="${member.email}" aria-invalid="${!!e[`${prefix}_email`]}">
                    <div class="input-feedback">${e[`${prefix}_email`] || ''}</div>
                  </div>

                  <div class="form-group">
                    <label>Phone Number <span class="req">*</span></label>
                    <input type="tel" class="inp-m-phone" data-index="${idx}" placeholder="10-digit number" value="${member.phone}" maxlength="12" aria-invalid="${!!e[`${prefix}_phone`]}">
                    <div class="input-feedback">${e[`${prefix}_phone`] || ''}</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <button type="button" class="btn-add-member" id="btn-add-team-member" ${isAtMax ? 'disabled' : ''}>
          <span>+</span> Add Team Member (${count} / ${config.max_members})
        </button>
      </div>
    `;
  }

  function bindStep2Events() {
    const $btnAdd = document.getElementById('btn-add-team-member');
    if ($btnAdd) {
      $btnAdd.onclick = () => addMember();
    }

    document.querySelectorAll('.btn-remove-member').forEach(btn => {
      btn.onclick = (e) => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        removeMember(idx);
      };
    });

    document.querySelectorAll('.inp-m-name').forEach(inp => {
      inp.oninput = (e) => {
        const idx = parseInt(inp.getAttribute('data-index'), 10);
        state.team.members[idx].full_name = e.target.value;
        saveDraft();
      };
    });

    document.querySelectorAll('.inp-m-reg').forEach(inp => {
      inp.oninput = (e) => {
        const idx = parseInt(inp.getAttribute('data-index'), 10);
        state.team.members[idx].reg_no = e.target.value;
        saveDraft();
      };
    });

    document.querySelectorAll('.inp-m-email').forEach(inp => {
      inp.oninput = (e) => {
        const idx = parseInt(inp.getAttribute('data-index'), 10);
        state.team.members[idx].email = e.target.value;
        saveDraft();
      };
    });

    document.querySelectorAll('.inp-m-phone').forEach(inp => {
      inp.oninput = (e) => {
        const idx = parseInt(inp.getAttribute('data-index'), 10);
        state.team.members[idx].phone = e.target.value;
        saveDraft();
      };
    });
  }

  // ==========================================
  // SCREEN 3: Review Details & Fee Breakdown
  // ==========================================
  function renderStep3() {
    const leader = state.team.members[0];
    const memberCount = state.team.members.length;
    const totalFee = memberCount * config.fee_per_member;

    return `
      <div class="hero-block">
        <div class="hero-pill"><span class="dot"></span> Step 3 • Verification</div>
        <h2 class="hero-title">Review Registration Details</h2>
        <p class="hero-desc">Please verify all information before proceeding to the payment instructions. You will receive a unique Registration ID upon proceeding.</p>
      </div>

      <div class="glass-card">
        <div class="card-header">
          <h3 class="card-title">📋 Team Overview</h3>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.navGoToStep(1)">Edit Team</button>
        </div>

        <div class="review-summary-box">
          <div class="review-row">
            <span class="label">Team Name</span>
            <span class="value" style="color:var(--accent-cyan); font-size:1.05rem;">${state.team.name}</span>
          </div>
          <div class="review-row">
            <span class="label">College / University</span>
            <span class="value">${state.team.college}</span>
          </div>
          <div class="review-row">
            <span class="label">Selected Track</span>
            <span class="value">${state.team.track}</span>
          </div>
          ${state.team.projectTitle ? `
            <div class="review-row">
              <span class="label">Project / Idea Title</span>
              <span class="value">${state.team.projectTitle}</span>
            </div>
          ` : ''}
          <div class="review-row">
            <span class="label">Team Leader</span>
            <span class="value">${leader.full_name} (${leader.email})</span>
          </div>
        </div>

        <div class="card-header" style="margin-top: 24px;">
          <h3 class="card-title">👥 Team Roster (${memberCount} Members)</h3>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.navGoToStep(2)">Edit Members</button>
        </div>

        <div style="overflow-x: auto;">
          <table class="roster-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Role</th>
                <th>Full Name</th>
                <th>Reg / Roll No</th>
                <th>College Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              ${state.team.members.map((m, idx) => `
                <tr>
                  <td><b>${idx + 1}</b></td>
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

        <div class="fee-highlight-badge" style="margin-top: 20px;">
          <div>
            <div class="fee-title">Total Registration Fee</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">${memberCount} members × ₹${config.fee_per_member} / member</div>
          </div>
          <div class="fee-val">₹${totalFee}</div>
        </div>

        <div style="display:flex; align-items:flex-start; gap:10px; margin-top:14px;">
          <input type="checkbox" id="chk-conduct" checked style="width:auto; margin-top:4px;">
          <label for="chk-conduct" style="font-weight:400; font-size:0.85rem; color:var(--text-secondary);">
            I certify that all details submitted are accurate and our team agrees to abide by the CodeVerse Hackathon 2026 Code of Conduct.
          </label>
        </div>
      </div>
    `;
  }

  function bindStep3Events() {
    window.navGoToStep = (s) => goToStep(s);
  }

  // ==========================================
  // SCREEN 4: Payment Instructions & Details
  // ==========================================
  function renderStep4() {
    const memberCount = state.team.members.length;
    const totalFee = memberCount * config.fee_per_member;
    const b = config.payment_methods.bank;
    const u = config.payment_methods.upi;

    return `
      <div class="hero-block">
        <div class="hero-pill"><span class="dot"></span> Step 4 • Payment Instructions</div>
        <h2 class="hero-title">Complete Your Team Payment</h2>
        <p class="hero-desc">Choose either UPI or Direct Bank Transfer to complete the registration fee payment. Keep your UTR or Transaction ID handy.</p>
      </div>

      <!-- Security Disclaimer Alert -->
      <div class="security-alert">
        <div class="icon">🛡️</div>
        <div class="text">
          <h4>Security Notice: Banking Credentials Are Never Requested</h4>
          <p>CodeVerse Organizers will <b>NEVER</b> ask you for your UPI PIN, banking password, OTP, debit/credit card PIN, or CVV. Pay securely through your bank or official UPI app, and only enter the transaction reference number (UTR) on the next page.</p>
        </div>
      </div>

      <!-- Amount Highlight -->
      <div class="fee-highlight-badge">
        <div>
          <div class="fee-title">Payable Registration Amount</div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">Registration ID: <b>${state.registrationId || 'Pending'}</b> (${memberCount} Members)</div>
        </div>
        <div class="fee-val">₹${totalFee}</div>
      </div>

      <!-- Payment Methods Grid -->
      <div class="payment-grid">
        <!-- Option 1: UPI -->
        <div class="pay-card">
          <div class="pay-card-badge">Instant</div>
          <h3>⚡ Option 1: Pay via UPI</h3>
          <p class="desc">Scan the official QR code using Google Pay, PhonePe, Paytm, or BHIM.</p>

          <div class="qr-container">
            <div class="qr-frame">
              <img src="${u.qr_code_svg}" alt="CodeVerse 2026 UPI QR Code" class="qr-image" />
            </div>
            <a href="${u.qr_code_svg}" download="CodeVerse2026_QR.svg" class="btn btn-secondary btn-sm" style="margin-top:10px;">
              📥 Download QR Code
            </a>
          </div>

          <div class="copy-row">
            <div class="details">
              <span class="field-name">UPI ID / VPA</span>
              <span class="field-val">${u.upi_id}</span>
            </div>
            <button type="button" class="btn-copy" onclick="copyText('${u.upi_id}', 'UPI ID')">Copy</button>
          </div>
        </div>

        <!-- Option 2: Bank Transfer -->
        <div class="pay-card">
          <div class="pay-card-badge">NEFT / IMPS / RTGS</div>
          <h3>🏛️ Option 2: Bank Transfer</h3>
          <p class="desc">Direct transfer to CodeVerse Hackathon institutional bank account.</p>

          <div class="copy-row">
            <div class="details">
              <span class="field-name">Account Holder Name</span>
              <span class="field-val">${b.account_holder}</span>
            </div>
            <button type="button" class="btn-copy" onclick="copyText('${b.account_holder}', 'Account Holder Name')">Copy</button>
          </div>

          <div class="copy-row">
            <div class="details">
              <span class="field-name">Bank Name</span>
              <span class="field-val">${b.bank_name}</span>
            </div>
            <button type="button" class="btn-copy" onclick="copyText('${b.bank_name}', 'Bank Name')">Copy</button>
          </div>

          <div class="copy-row">
            <div class="details">
              <span class="field-name">Account Number</span>
              <span class="field-val">${b.account_number}</span>
            </div>
            <button type="button" class="btn-copy" onclick="copyText('${b.account_number}', 'Account Number')">Copy</button>
          </div>

          <div class="copy-row">
            <div class="details">
              <span class="field-name">IFSC Code</span>
              <span class="field-val">${b.ifsc}</span>
            </div>
            <button type="button" class="btn-copy" onclick="copyText('${b.ifsc}', 'IFSC Code')">Copy</button>
          </div>

          <div class="copy-row">
            <div class="details">
              <span class="field-name">Account Type</span>
              <span class="field-val">${b.branch || 'Current Account'}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <h4 style="font-family:var(--font-heading); margin-bottom:8px;">📌 After completing the transfer:</h4>
        <ul style="padding-left:20px; font-size:0.88rem; color:var(--text-secondary); line-height:1.7;">
          <li>Note down the <b>12-digit UTR Number / Transaction Reference ID</b> shown on your payment confirmation screen.</li>
          <li>Take a screenshot of the successful transaction for quicker manual verification.</li>
          <li>Click the button below to submit your transaction details.</li>
        </ul>
      </div>
    `;
  }

  function bindStep4Events() {}

  // ==========================================
  // SCREEN 5: Submit Transaction & Proof
  // ==========================================
  function renderStep5() {
    const memberCount = state.team.members.length;
    const totalFee = memberCount * config.fee_per_member;
    const p = state.payment;
    const e = state.errors;

    return `
      <div class="hero-block">
        <div class="hero-pill"><span class="dot"></span> Step 5 • Verification Submission</div>
        <h2 class="hero-title">Submit Transaction Details</h2>
        <p class="hero-desc">Enter the transaction ID / UTR number from your payment app so organizers can verify your registration.</p>
      </div>

      <div class="glass-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">💳 Payment Details</h3>
            <p class="card-subtitle">Registration ID: <b style="color:var(--accent-cyan); font-family:var(--font-mono);">${state.registrationId || 'CV26-TEMP'}</b></p>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="inp-pay-method">Payment Mode Used <span class="req">*</span></label>
            <select id="inp-pay-method">
              <option value="UPI" ${p.method === 'UPI' ? 'selected' : ''}>UPI (Google Pay, PhonePe, Paytm, BHIM)</option>
              <option value="BANK_TRANSFER" ${p.method === 'BANK_TRANSFER' ? 'selected' : ''}>Bank Transfer (NEFT / IMPS / RTGS)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="inp-txn-id">Transaction ID / UTR Number <span class="req">*</span></label>
            <input type="text" id="inp-txn-id" placeholder="e.g. 419208392810" value="${p.txn_id}" style="font-family:var(--font-mono); text-transform:uppercase;" aria-invalid="${!!e.txn_id}">
            <div class="input-feedback">${e.txn_id || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-txn-date">Payment Date <span class="req">*</span></label>
            <input type="date" id="inp-txn-date" value="${p.txn_date}" max="${new Date().toISOString().slice(0, 10)}" aria-invalid="${!!e.txn_date}">
            <div class="input-feedback">${e.txn_date || ''}</div>
          </div>

          <div class="form-group">
            <label for="inp-amount-paid">Amount Paid (₹) <span class="req">*</span></label>
            <input type="number" id="inp-amount-paid" value="${p.amount_paid || totalFee}" aria-invalid="${!!e.amount_paid}">
            <div class="input-feedback">${e.amount_paid || ''}</div>
          </div>

          <!-- Proof Upload Dropzone -->
          <div class="form-group col-span-2">
            <label>Payment Screenshot / Receipt <span class="hint">Optional but accelerates verification</span></label>
            
            <div class="dropzone" id="proof-dropzone">
              <div class="icon">📷</div>
              <p class="lead">Drag and drop payment screenshot, or click to browse</p>
              <p class="sub">Supports PNG, JPG, WebP, or PDF up to 5 MB</p>
              <input type="file" id="inp-proof-file" accept="image/png,image/jpeg,image/webp,application/pdf" style="display:none;">
            </div>

            ${p.proofPreviewUrl ? `
              <div class="preview-box" id="proof-preview-container">
                <img src="${p.proofPreviewUrl}" class="preview-thumb" alt="Proof preview">
                <div class="preview-details">
                  <div class="preview-name">${p.proofFile ? p.proofFile.name : 'Uploaded Receipt'}</div>
                  <div class="preview-size">${p.proofFile ? (p.proofFile.size / 1024).toFixed(1) + ' KB' : 'Ready'}</div>
                </div>
                <button type="button" class="btn-remove-file" id="btn-remove-proof">✕</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function bindStep5Events() {
    const $method = document.getElementById('inp-pay-method');
    const $txn = document.getElementById('inp-txn-id');
    const $date = document.getElementById('inp-txn-date');
    const $amount = document.getElementById('inp-amount-paid');

    $method.onchange = (e) => { state.payment.method = e.target.value; saveDraft(); };
    $txn.oninput = (e) => { state.payment.txn_id = e.target.value.toUpperCase(); saveDraft(); };
    $date.onchange = (e) => { state.payment.txn_date = e.target.value; saveDraft(); };
    $amount.oninput = (e) => { state.payment.amount_paid = e.target.value; saveDraft(); };

    // Dropzone upload
    const $dropzone = document.getElementById('proof-dropzone');
    const $fileInput = document.getElementById('inp-proof-file');
    const $btnRemove = document.getElementById('btn-remove-proof');

    if ($dropzone && $fileInput) {
      $dropzone.onclick = () => $fileInput.click();

      $dropzone.ondragover = (e) => {
        e.preventDefault();
        $dropzone.classList.add('drag-active');
      };
      $dropzone.ondragleave = () => $dropzone.classList.remove('drag-active');
      $dropzone.ondrop = (e) => {
        e.preventDefault();
        $dropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleProofFile(e.dataTransfer.files[0]);
        }
      };

      $fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          handleProofFile(e.target.files[0]);
        }
      };
    }

    if ($btnRemove) {
      $btnRemove.onclick = () => {
        state.payment.proofFile = null;
        state.payment.proofPreviewUrl = null;
        render();
      };
    }
  }

  function handleProofFile(file) {
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size must be under 5 MB.", "error");
      return;
    }
    state.payment.proofFile = file;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        state.payment.proofPreviewUrl = e.target.result;
        render();
      };
      reader.readAsDataURL(file);
    } else {
      // PDF representation
      state.payment.proofPreviewUrl = 'assets/qr-code.svg';
      render();
    }
  }

  // ==========================================
  // SCREEN 6: Final Confirmation Screen
  // ==========================================
  function renderStep6() {
    const leader = state.team.members[0];
    const memberCount = state.team.members.length;
    const rid = state.registrationId || "CV26-DEMO";
    const status = state.status || "VERIFICATION_PENDING";

    let statusBadge = '<span class="badge-status pending">⏳ Pending Verification</span>';
    if (status === 'CONFIRMED') {
      statusBadge = '<span class="badge-status confirmed">✓ Confirmed & Verified</span>';
    } else if (status === 'PAYMENT_REJECTED') {
      statusBadge = '<span class="badge-status rejected">✕ Payment Rejected</span>';
    }

    return `
      <div class="ticket-wrapper">
        <div class="success-icon-badge">✓</div>
        <h2 class="ticket-title">Registration Submitted Successfully</h2>
        <p class="ticket-subtitle">Your team registration for <b>CodeVerse Hackathon 2026</b> has been received and is currently under payment verification.</p>

        <div class="rid-display-box">
          <span class="rid-label">Your Unique Registration ID</span>
          <span class="rid-code">${rid}</span>
          <button type="button" class="btn-copy" style="margin-top:6px;" onclick="copyText('${rid}', 'Registration ID')">
            Copy Registration ID
          </button>
        </div>

        <div class="review-summary-box" style="text-align:left; max-width:540px; margin: 0 auto 28px;">
          <div class="review-row">
            <span class="label">Team Name</span>
            <span class="value" style="color:#fff;">${state.team.name}</span>
          </div>
          <div class="review-row">
            <span class="label">Team Leader</span>
            <span class="value">${leader.full_name}</span>
          </div>
          <div class="review-row">
            <span class="label">Number of Members</span>
            <span class="value">${memberCount} Members</span>
          </div>
          <div class="review-row">
            <span class="label">Payment Status</span>
            <span class="value">${statusBadge}</span>
          </div>
          ${state.payment.txn_id ? `
            <div class="review-row">
              <span class="label">Transaction / UTR ID</span>
              <span class="value"><code style="font-family:var(--font-mono);">${state.payment.txn_id}</code></span>
            </div>
          ` : ''}
          <div class="review-row">
            <span class="label">Amount Paid</span>
            <span class="value">₹${state.payment.amount_paid}</span>
          </div>
        </div>

        ${status === 'PAYMENT_REJECTED' ? `
          <div class="security-alert" style="background:var(--danger-bg); border-color:var(--danger-border); border-left-color:var(--danger); text-align:left; max-width:540px; margin:0 auto 20px;">
            <div class="text">
              <h4 style="color:var(--danger);">Payment Verification Rejected</h4>
              <p>The transaction details submitted could not be verified. Please check your UTR number and re-submit.</p>
              <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="window.reSubmitPayment()">
                Re-submit Payment Details
              </button>
            </div>
          </div>
        ` : ''}

        <div style="font-size:0.86rem; color:var(--text-secondary); max-width:480px; margin:0 auto 24px; line-height:1.6;">
          <p>📧 A confirmation summary has been logged for <b>${leader.email}</b>. Verification usually takes <b>2–4 hours</b>. You can track your status anytime using your Registration ID.</p>
        </div>

        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.print()">
            🖨️ Print Registration Slip
          </button>
          <a href="admin.html" class="btn btn-primary">
            View in Admin Portal →
          </a>
          <button type="button" class="btn btn-secondary" onclick="window.startNewRegistration()">
            Register Another Team
          </button>
        </div>
      </div>
    `;
  }

  function bindStep6Events() {
    window.reSubmitPayment = () => {
      state.step = 5;
      render();
    };

    window.startNewRegistration = () => {
      if (confirm("Start a new team registration? Your current details will be cleared from draft.")) {
        localStorage.removeItem(STORAGE_KEY);
        state.step = 1;
        state.registrationId = null;
        state.status = null;
        state.team = {
          name: "",
          college: "",
          track: "AI & Intelligent Systems",
          projectTitle: "",
          members: [
            { is_leader: true, full_name: "", reg_no: "", email: "", phone: "" },
            { is_leader: false, full_name: "", reg_no: "", email: "", phone: "" },
            { is_leader: false, full_name: "", reg_no: "", email: "", phone: "" },
            { is_leader: false, full_name: "", reg_no: "", email: "", phone: "" }
          ]
        };
        state.payment = {
          method: "UPI",
          txn_id: "",
          txn_date: new Date().toISOString().slice(0, 10),
          amount_paid: 600,
          proofFile: null,
          proofPreviewUrl: null
        };
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }

  // ---- Status Lookup Hash Support ----
  function handleHashChange() {
    const hash = window.location.hash;
    const match = hash.match(/^#\/confirmation\/([A-Za-z0-9\-]+)$/);
    if (match) {
      const rid = match[1];
      checkRegistrationStatus(rid);
    } else if (hash === '#/status') {
      const rid = prompt("Enter your 10-character CodeVerse Registration ID (e.g. CV26-XXXXXX):");
      if (rid && rid.trim()) {
        checkRegistrationStatus(rid.trim().toUpperCase());
      }
    }
  }

  // ---- App Initialization ----
  async function init() {
    await fetchConfig();
    loadDraft();
    window.addEventListener('hashchange', handleHashChange);
    if (window.location.hash) {
      handleHashChange();
    } else {
      render();
    }
  }

  init();
})();
