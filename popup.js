// ─────────────────────────────────────────────
//  Job Tracker — popup.js
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // Auto-fill today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;

  // Auto-fill the active tab's URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      document.getElementById('url').value = tab.url;
    }
  } catch (_) {
    // URL capture failed — user can enter manually
  }

  loadJobs();

  document.getElementById('job-form').addEventListener('submit', saveJob);
  document.getElementById('export-btn').addEventListener('click', exportCSV);
});

// ── Save a new job ────────────────────────────
async function saveJob(e) {
  e.preventDefault();

  const company = document.getElementById('company').value.trim();
  const date    = document.getElementById('date').value;
  const role    = document.getElementById('role').value.trim();
  const jobId   = document.getElementById('jobId').value.trim();
  const status  = document.getElementById('status').value;
  const url     = document.getElementById('url').value.trim();

  if (!company || !date || !role) return;

  const job = {
    id: Date.now().toString(),   // unique key for deletion
    company,
    date,
    role,
    jobId,
    status,
    url,
  };

  const { jobs = [] } = await chrome.storage.local.get('jobs');
  jobs.unshift(job);  // newest first
  await chrome.storage.local.set({ jobs });

  // Reset variable fields; keep date + URL for convenience
  document.getElementById('company').value = '';
  document.getElementById('role').value    = '';
  document.getElementById('jobId').value   = '';
  document.getElementById('status').value  = 'Applied';

  showMessage('Job saved!', 'success');
  loadJobs();
}

// ── Render the job list ───────────────────────
async function loadJobs() {
  const { jobs = [] } = await chrome.storage.local.get('jobs');

  document.getElementById('job-count').textContent =
    `${jobs.length} job${jobs.length !== 1 ? 's' : ''} tracked`;

  const listEl = document.getElementById('job-list');
  listEl.innerHTML = '';

  if (jobs.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No jobs tracked yet — add your first one above!</p>';
    return;
  }

  const PAGE = 8;
  jobs.slice(0, PAGE).forEach(job => {
    const statusKey  = job.status.toLowerCase().replace(/\s+/g, '-');
    const item       = document.createElement('div');
    item.className   = 'job-item';

    item.innerHTML = `
      <div class="job-info">
        <span class="job-company">${esc(job.company)}</span>
        <div class="job-role">${esc(job.role)}${job.jobId ? ` &middot; ${esc(job.jobId)}` : ''}</div>
        <div class="job-meta">
          <span class="status-badge status-${statusKey}">${esc(job.status)}</span>
          <span class="job-date">${esc(job.date)}</span>
        </div>
      </div>
      <button class="delete-btn" data-id="${esc(job.id)}" title="Remove">&#215;</button>
    `;

    listEl.appendChild(item);
  });

  if (jobs.length > PAGE) {
    const more = document.createElement('p');
    more.className   = 'more-jobs';
    more.textContent = `+${jobs.length - PAGE} more — export CSV to view all`;
    listEl.appendChild(more);
  }

  // Wire up delete buttons
  listEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteJob(btn.dataset.id));
  });
}

// ── Delete a single job ───────────────────────
async function deleteJob(id) {
  const { jobs = [] } = await chrome.storage.local.get('jobs');
  await chrome.storage.local.set({ jobs: jobs.filter(j => j.id !== id) });
  loadJobs();
}

// ── Export all jobs as a CSV download ─────────
async function exportCSV() {
  const { jobs = [] } = await chrome.storage.local.get('jobs');

  if (jobs.length === 0) {
    showMessage('No jobs to export yet.', 'error');
    return;
  }

  const headers = ['Company', 'Date', 'Role', 'Job ID', 'Status', 'URL'];
  const rows = jobs.map(j =>
    [j.company, j.date, j.role, j.jobId || '', j.status, j.url || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv  = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const blobUrl = URL.createObjectURL(blob);

  const a      = document.createElement('a');
  a.href       = blobUrl;
  a.download   = `job_applications_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);

  showMessage(`Exported ${jobs.length} job${jobs.length !== 1 ? 's' : ''}!`, 'success');
}

// ── Helpers ───────────────────────────────────

/** Escape a value for safe innerHTML insertion. */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str ?? '')));
  return d.innerHTML;
}

function showMessage(text, type) {
  const el     = document.getElementById('message');
  el.textContent = text;
  el.className = `message ${type}`;
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 2500);
}
