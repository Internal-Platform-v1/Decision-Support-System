"use strict";

// ============================================================
// FALLBACK: hide loader if ops-console.js fails
// ============================================================
setTimeout(() => {
  const loader = document.getElementById('opsLoader');
  if (loader && !loader.classList.contains('hide')) {
    loader.classList.add('hide');
    setTimeout(() => loader.remove(), 500);
    console.log('✅ Loader hidden by bulletin-center fallback');
  }
}, 1000);

// ------------------------------------------------------------
// GLOBALS
// ------------------------------------------------------------
const db = window.db;
const auth = window.auth;
const OPS = window.OPS || {};

// ------------------------------------------------------------
// DOM REFS (matches updated layout)
// ------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const EL = {
  search: $('#bulletinSearch'),
  newBtn: $('#newBulletinBtn'),
  refreshBtn: $('#refreshBulletins'),
  categories: $('#bulletinCategories'),
  previewContent: $('#previewContent'),

  drawer: $('#composeDrawer'),
  backdrop: $('#drawerBackdrop'),
  closeDrawer: $('#closeDrawerBtn'),
  drawerTitle: $('#drawerTitle'),
  drawerSubtitle: $('#drawerSubtitle'),
  title: $('#bulletinTitle'),
  category: $('#bulletinCategory'),
  priority: $('#bulletinPriority'),
  audience: $('#bulletinAudience'),
  author: $('#bulletinAuthor'),
  message: $('#bulletinMessage'),
  summary: $('#bulletinSummary'),
  attachContainer: $('#attachmentContainer'),
  addAttach: $('#addAttachmentBtn'),
  saveDraft: $('#saveDraftBtn'),
  previewBtn: $('#previewBulletinBtn'),
  publishBtn: $('#publishBulletinBtn'),

  editBtn: $('#editBulletinBtn'),
  copyBtn: $('#copyBulletinBtn'),
  deleteBtn: $('#deleteBulletinBtn'),

  viewAllModal: $('#viewAllModal'),
  closeViewAll: $('#closeViewAllBtn'),
  viewAllSearch: $('#viewAllSearch'),
  viewAllList: $('#viewAllList'),
  viewAllPreview: $('#viewAllPreview'),
  viewAllTitle: $('#viewAllTitle'),
  viewAllSubtitle: $('#viewAllSubtitle'),

  toastContainer: $('#toastContainer'),
};

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
window.editMode = false;
window.copyMode = false;
window.currentBulletin = null;
window.allBulletins = [];
window.currentViewAllCategory = null;
window.currentViewAllBulletin = null;

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Load user profile from OPS
  if (window.currentUserProfile) {
    EL.author.value = window.currentUserProfile.displayName || 'Administrator';
  }

  // Attach listeners
  EL.newBtn.addEventListener('click', () => { resetFormMode(); clearForm(); openDrawer(); });
  EL.closeDrawer.addEventListener('click', closeDrawer);
  EL.backdrop.addEventListener('click', closeDrawer);

  EL.addAttach.addEventListener('click', () => addAttachmentRow());
  EL.saveDraft.addEventListener('click', saveDraft);
  EL.previewBtn.addEventListener('click', previewBulletin);
  EL.publishBtn.addEventListener('click', publishBulletin);

  EL.editBtn.addEventListener('click', editSelected);
  EL.copyBtn.addEventListener('click', copySelected);
  EL.deleteBtn.addEventListener('click', deleteSelected);

  EL.closeViewAll.addEventListener('click', closeViewAll);
  EL.viewAllSearch.addEventListener('input', () => {
    if (window.currentViewAllCategory) renderViewAll(window.currentViewAllCategory);
  });

  EL.search.addEventListener('input', applyFilters);
  EL.refreshBtn.addEventListener('click', () => { applyFilters(); });

  // Filter buttons (click to filter)
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // You can implement filtering logic here if needed
    });
  });

  // Listen for published bulletins from Firestore
  if (window.BulletinService) {
    window.BulletinService.listenPublished((bulletins) => {
      window.allBulletins = bulletins;
      applyFilters();
      if (bulletins.length) {
        window.currentBulletin = bulletins[0];
        showPreview(bulletins[0]);
      } else {
        clearPreview();
      }
    });
  } else {
    console.warn('BulletinService not loaded – check bulletin-service.js');
  }

  // Load initial data (if any already loaded)
  applyFilters();
});

// ------------------------------------------------------------
// DRAWER CONTROLS
// ------------------------------------------------------------
function openDrawer() {
  EL.drawer.classList.add('open');
  EL.backdrop.classList.add('show');
}
function closeDrawer() {
  EL.drawer.classList.remove('open');
  EL.backdrop.classList.remove('show');
}

// ------------------------------------------------------------
// FORM UTILITIES
// ------------------------------------------------------------
function clearForm() {
  EL.title.value = '';
  EL.summary.value = '';
  EL.message.value = '';
  EL.audience.value = '';
  EL.category.selectedIndex = 0;
  EL.priority.selectedIndex = 0;
  clearAttachmentRows();
}

function clearAttachmentRows() {
  EL.attachContainer.innerHTML = '';
  addAttachmentRow(); // always one empty row
}

function addAttachmentRow(attachment = {}) {
  const row = document.createElement('div');
  row.className = 'attachment-row';
  row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px; align-items:center;';
  row.innerHTML = `
    <select class="attachment-type" style="flex:1; padding:8px 12px; border-radius:10px; background:var(--ops-surface); border:1px solid var(--ops-border); color:var(--ops-text);">
      <option value="guide">📘 Decision Guide</option>
      <option value="sharepoint">📂 SharePoint</option>
      <option value="onedrive">☁ OneDrive</option>
      <option value="teams">💬 Teams</option>
      <option value="forms">📝 Forms</option>
      <option value="external">🌐 External</option>
    </select>
    <input type="text" class="attachment-name" placeholder="Name" style="flex:2; padding:8px 12px; border-radius:10px; background:var(--ops-surface); border:1px solid var(--ops-border); color:var(--ops-text);">
    <input type="url" class="attachment-url" placeholder="URL" style="flex:3; padding:8px 12px; border-radius:10px; background:var(--ops-surface); border:1px solid var(--ops-border); color:var(--ops-text);">
    <button type="button" class="remove-attachment" style="width:36px; height:36px; border-radius:10px; background:var(--ops-surface2); border:1px solid var(--ops-border); color:var(--ops-muted);">
      <i class="fa-solid fa-trash"></i>
    </button>
  `;
  row.querySelector('.attachment-type').value = attachment.type || 'guide';
  row.querySelector('.attachment-name').value = attachment.name || '';
  row.querySelector('.attachment-url').value = attachment.url || '';
  row.querySelector('.remove-attachment').addEventListener('click', () => {
    if (EL.attachContainer.children.length > 1) {
      row.remove();
    } else {
      row.querySelectorAll('input').forEach(inp => inp.value = '');
    }
  });
  EL.attachContainer.appendChild(row);
}

function getFormData() {
  const rows = EL.attachContainer.querySelectorAll('.attachment-row');
  const attachments = Array.from(rows).map(row => ({
    type: row.querySelector('.attachment-type').value,
    name: row.querySelector('.attachment-name').value.trim(),
    url: row.querySelector('.attachment-url').value.trim()
  })).filter(a => a.name && a.url);

  return {
    title: EL.title.value.trim(),
    summary: EL.summary.value.trim(),
    message: EL.message.value.trim(),
    category: EL.category.value,
    priority: EL.priority.value,
    author: EL.author.value.trim(),
    audience: EL.audience.value.split(',').map(a => a.trim()).filter(Boolean),
    attachments
  };
}

function loadBulletinIntoForm(bulletin) {
  EL.title.value = bulletin.title || '';
  EL.summary.value = bulletin.summary || '';
  EL.message.value = bulletin.message || '';
  EL.category.value = bulletin.category || 'announcement';
  EL.priority.value = bulletin.priority || 'normal';
  EL.author.value = bulletin.author || '';
  EL.audience.value = (bulletin.audience || []).join(', ');
  EL.attachContainer.innerHTML = '';
  (bulletin.attachments || []).forEach(a => addAttachmentRow(a));
  if (!EL.attachContainer.children.length) addAttachmentRow();
}

function resetFormMode() {
  window.editMode = false;
  window.copyMode = false;
  EL.drawerTitle.textContent = 'Create Bulletin';
  EL.drawerSubtitle.textContent = 'Create or publish a new enterprise announcement.';
  EL.publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish';
}

// ------------------------------------------------------------
// BULLETIN ACTIONS
// ------------------------------------------------------------
async function saveDraft() {
  try {
    const data = getFormData();
    if (!data.title) { showToast('Please enter a title.', 'error'); return; }
    const result = await window.BulletinService.saveDraft(data);
    showToast('Draft saved!');
  } catch (e) { console.error(e); showToast('Unable to save draft.', 'error'); }
}

async function publishBulletin() {
  try {
    const data = getFormData();
    if (!data.title) { showToast('Please enter a title.', 'error'); return; }
    if (!data.message) { showToast('Please enter a message.', 'error'); return; }
    let result;
    if (window.editMode) {
      result = await window.BulletinService.update(window.currentBulletin.id, data);
      showToast('Bulletin updated!');
    } else {
      result = await window.BulletinService.publish(data);
      showToast('Bulletin published!');
    }
    resetFormMode();
    clearForm();
    closeDrawer();
  } catch (e) { console.error(e); showToast('Unable to publish.', 'error'); }
}

function previewBulletin() {
  const data = getFormData();
  if (window.BulletinPreview) {
    window.BulletinPreview.update({
      title: data.title,
      author: data.author || 'Administrator',
      priority: data.priority,
      message: data.message,
      views: 0
    });
    showToast('Preview updated');
  } else {
    showToast('Preview service not available', 'error');
  }
}

function editSelected() {
  const bulletin = getSelectedBulletin();
  if (!bulletin) return;
  window.editMode = true;
  loadBulletinIntoForm(bulletin);
  EL.drawerTitle.textContent = 'Edit Bulletin';
  EL.drawerSubtitle.textContent = 'Update the selected enterprise bulletin.';
  EL.publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
  openDrawer();
}

function copySelected() {
  const bulletin = getSelectedBulletin();
  if (!bulletin) return;
  window.editMode = false;
  window.copyMode = true;
  loadBulletinIntoForm(bulletin);
  EL.title.value = bulletin.title + ' (Copy)';
  EL.drawerTitle.textContent = 'Copy Bulletin';
  EL.drawerSubtitle.textContent = 'Review and publish the copied bulletin.';
  EL.publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Copy';
  openDrawer();
}

async function deleteSelected() {
  const bulletin = getSelectedBulletin();
  if (!bulletin) return;
  if (!confirm(`Delete "${bulletin.title}"? This cannot be undone.`)) return;
  try {
    await window.BulletinService.remove(bulletin.id);
    showToast('Bulletin deleted.');
    clearPreview();
  } catch (e) { console.error(e); showToast('Unable to delete.', 'error'); }
}

function getSelectedBulletin() {
  if (!window.currentBulletin) {
    showToast('Please select a bulletin first.', 'warning');
    return null;
  }
  return window.currentBulletin;
}

// ------------------------------------------------------------
// PREVIEW RENDERING
// ------------------------------------------------------------
function clearPreview() {
  window.currentBulletin = null;
  EL.previewContent.innerHTML = `
    <div class="empty-state">
      <i class="fa-regular fa-newspaper"></i>
      <h3 style="color:var(--ops-heading); margin-top:12px;">No Bulletin Selected</h3>
      <p style="color:var(--ops-muted);">Select a bulletin to view its details.</p>
    </div>
  `;
}

function showPreview(bulletin) {
  window.currentBulletin = bulletin;
  const priorityMap = { critical: 'Critical', important: 'Important', normal: 'Normal' };
  const priorityClass = bulletin.priority || 'normal';
  const date = bulletin.publishedAt?.seconds
    ? new Date(bulletin.publishedAt.seconds * 1000).toLocaleString()
    : 'Just now';

  const attachments = (bulletin.attachments || []).filter(a => a.name && a.url);
  const icons = { guide: 'fa-book', sharepoint: 'fa-folder', onedrive: 'fa-cloud', teams: 'fa-comments', forms: 'fa-file-lines', external: 'fa-link' };

  EL.previewContent.innerHTML = `
    <div class="preview-banner">
      <span class="priority ${priorityClass}">${priorityMap[priorityClass] || 'Normal'}</span>
      <div style="display:flex; gap:8px;">
        <button class="icon-btn" onclick="document.getElementById('editBulletinBtn').click()" style="background:var(--ops-surface2); border:1px solid var(--ops-border); border-radius:12px; width:38px; height:38px;"><i class="fa-regular fa-pen-to-square"></i></button>
        <button class="icon-btn" onclick="document.getElementById('copyBulletinBtn').click()" style="background:var(--ops-surface2); border:1px solid var(--ops-border); border-radius:12px; width:38px; height:38px;"><i class="fa-regular fa-copy"></i></button>
        <button class="icon-btn" onclick="document.getElementById('deleteBulletinBtn').click()" style="background:var(--ops-surface2); border:1px solid var(--ops-border); border-radius:12px; width:38px; height:38px;"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
    <div class="preview-title">
      <h2>${bulletin.title}</h2>
      <div class="preview-info">
        <span><i class="fa-solid fa-building"></i> ${bulletin.author || 'Unknown'}</span>
        <span><i class="fa-regular fa-calendar"></i> ${date}</span>
        <span><i class="fa-regular fa-eye"></i> ${bulletin.views || 0} Views</span>
      </div>
    </div>
    <div class="preview-message">
      <p>${(bulletin.message || '').replace(/\n/g, '<br>')}</p>
    </div>

    ${attachments.length ? `
    <div class="attachment-section">
      <div class="section-title"><h3>Attachments</h3></div>
      <div class="attachment-list">
        ${attachments.map(a => `
          <div class="attachment-card">
            <div class="file-icon ${a.type}"><i class="fa-solid ${icons[a.type] || 'fa-paperclip'}"></i></div>
            <div class="file-info"><h4>${a.name}</h4><span>${a.type.toUpperCase()}</span></div>
            <button class="download-btn" onclick="window.open('${a.url}','_blank')"><i class="fa-solid fa-up-right-from-square"></i></button>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="audience-section">
      <div class="section-title"><h3>Audience</h3></div>
      <div class="audience-tags">
        ${(bulletin.audience || ['All Employees']).map(a => `<span>${a}</span>`).join('')}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><span>Total Views</span><h2>${bulletin.views || 0}</h2><small><i class="fa-solid fa-arrow-trend-up"></i> +12% Today</small></div>
      <div class="stat-card"><span>Read Rate</span><h2>94%</h2><small><i class="fa-solid fa-circle-check"></i> Excellent</small></div>
      <div class="stat-card"><span>Unread</span><h2>${Math.floor((bulletin.views || 0) * 0.1)}</h2><small><i class="fa-solid fa-envelope"></i> Pending</small></div>
      <div class="stat-card"><span>Dismissed</span><h2>${Math.floor((bulletin.views || 0) * 0.05)}</h2><small><i class="fa-solid fa-xmark"></i> Hidden</small></div>
    </div>
  `;
}

// ------------------------------------------------------------
// FILTERING & RENDERING CATEGORIES
// ------------------------------------------------------------
function applyFilters() {
  const keyword = EL.search.value.trim().toLowerCase();
  let filtered = window.allBulletins || [];
  if (keyword) {
    filtered = filtered.filter(b =>
      [b.title, b.summary, b.message, b.category, ...(b.audience || [])]
        .join(' ').toLowerCase().includes(keyword)
    );
  }
  renderCategory(filtered, 'announcement', 'announcementList', 'announcementCount');
  renderCategory(filtered, 'whatsnew', 'whatsNewList', 'whatsNewCount');
  renderCategory(filtered, 'reminder', 'reminderList', 'reminderCount');
  renderCategory(filtered, 'issue', 'issueList', 'issueCount');
  renderCategory(filtered, 'guide', 'guideList', 'guideCount');
}

function renderCategory(bulletins, category, listId, countId) {
  const section = document.querySelector(`.bulletin-section[data-category="${category}"]`);
  if (!section) return;
  const list = section.querySelector('.mini-list');
  const count = section.querySelector('.badge-count');
  if (!list || !count) return;

  const items = bulletins
    .filter(b => b.category === category)
    .sort((a, b) => (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0));

  count.textContent = items.length;

  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = `<div class="mini-item empty"><div><h4>No bulletins</h4><small>Publish one to get started.</small></div></div>`;
    return;
  }

  items.slice(0, 3).forEach(b => {
    const date = b.publishedAt?.seconds ? new Date(b.publishedAt.seconds * 1000).toLocaleDateString() : 'Just now';
    const item = document.createElement('div');
    item.className = 'mini-item';
    item.dataset.id = b.id;
    item.innerHTML = `
      <div><h4>${b.title}</h4><small>${date}</small></div>
      <i class="fa-solid fa-angle-right"></i>
    `;
    item.addEventListener('click', () => {
      document.querySelectorAll('.mini-item.active').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      showPreview(b);
    });
    list.appendChild(item);
  });

  // View All button
  let viewAllBtn = section.querySelector('.view-all-btn');
  if (!viewAllBtn) {
    viewAllBtn = document.createElement('button');
    viewAllBtn.className = 'view-all-btn';
    viewAllBtn.innerHTML = 'View All <i class="fa-solid fa-arrow-right"></i>';
    viewAllBtn.dataset.category = category;
    viewAllBtn.addEventListener('click', () => openViewAll(category));
    section.appendChild(viewAllBtn);
  }
}

// ------------------------------------------------------------
// VIEW ALL MODAL
// ------------------------------------------------------------
function openViewAll(category) {
  window.currentViewAllCategory = category;
  window.currentViewAllBulletin = null;
  renderViewAll(category);
  EL.viewAllModal.classList.add('show');
}

function closeViewAll() {
  EL.viewAllModal.classList.remove('show');
}

function renderViewAll(category) {
  const list = EL.viewAllList;
  const preview = EL.viewAllPreview;
  const search = EL.viewAllSearch.value.trim().toLowerCase();
  EL.viewAllTitle.textContent = capitalize(category);
  EL.viewAllSubtitle.textContent = 'Browse all bulletins';

  let bulletins = (window.allBulletins || []).filter(b => b.category === category);
  if (search) {
    bulletins = bulletins.filter(b =>
      (b.title || '').toLowerCase().includes(search) ||
      (b.summary || '').toLowerCase().includes(search) ||
      (b.message || '').toLowerCase().includes(search)
    );
  }

  if (!bulletins.length) {
    list.innerHTML = `<div class="empty-state" style="text-align:center;color:var(--ops-muted);">No bulletins found.</div>`;
    preview.innerHTML = `<div class="empty-preview">No bulletin selected.</div>`;
    return;
  }

  if (!window.currentViewAllBulletin || !bulletins.find(b => b.id === window.currentViewAllBulletin.id)) {
    window.currentViewAllBulletin = bulletins[0];
  }

  list.innerHTML = bulletins.map(b => `
    <div class="viewall-card ${window.currentViewAllBulletin.id === b.id ? 'selected' : ''}" data-id="${b.id}">
      <div class="viewall-card-top">
        <span class="category-pill">${getCategoryIcon(b.category)} ${capitalize(b.category)}</span>
        <span class="priority-pill priority-${b.priority || 'normal'}">${b.priority || 'Normal'}</span>
      </div>
      <div class="viewall-card-title">${b.title}</div>
      <div class="viewall-card-summary">${b.summary || 'No summary available.'}</div>
      <div class="viewall-card-footer">
        <span><i class="fa-regular fa-calendar"></i> ${formatDate(b.publishedAt)}</span>
        <span><i class="fa-solid fa-chevron-right"></i></span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.viewall-card').forEach(card => {
    card.addEventListener('click', () => {
      const bulletin = bulletins.find(b => b.id === card.dataset.id);
      if (bulletin) {
        window.currentViewAllBulletin = bulletin;
        renderViewAll(category);
      }
    });
  });

  renderViewAllPreview(window.currentViewAllBulletin);
}

function renderViewAllPreview(bulletin) {
  const preview = EL.viewAllPreview;
  const attachments = (bulletin.attachments || []).filter(a => a.name && a.url);
  const date = formatDate(bulletin.publishedAt);
  preview.innerHTML = `
    <div class="viewall-preview-header">
      <div class="viewall-category" style="display:inline-block;background:var(--ops-orange);color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;margin-bottom:12px;">
        ${getCategoryIcon(bulletin.category)} ${capitalize(bulletin.category)}
      </div>
      <h2 class="viewall-preview-title" style="font-size:24px;font-weight:800;color:var(--ops-heading);">${bulletin.title}</h2>
      <div class="viewall-meta" style="display:flex;gap:24px;flex-wrap:wrap;color:var(--ops-muted);font-size:14px;">
        <span><strong>Priority:</strong> ${bulletin.priority || 'Normal'}</span>
        <span><strong>Published:</strong> ${date}</span>
      </div>
    </div>
    ${bulletin.summary ? `<div class="viewall-summary"><h4 style="color:var(--ops-heading);">Summary</h4><p style="color:var(--ops-text);">${bulletin.summary}</p></div>` : ''}
    <div class="viewall-message"><h4 style="color:var(--ops-heading);">Message</h4><div style="color:var(--ops-text);">${bulletin.message || ''}</div></div>
    ${attachments.length ? `
      <div class="viewall-attachments">
        <h4 style="color:var(--ops-heading);">Attachments</h4>
        ${attachments.map(a => `<div class="attachment-item"><i class="fa-solid fa-paperclip"></i> <a href="${a.url}" target="_blank" style="color:var(--ops-orange);">${a.name}</a></div>`).join('')}
      </div>
    ` : ''}
  `;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
function getCategoryIcon(cat) {
  const map = { announcement: '📢', whatsnew: '🆕', guide: '📘', issue: '⚠', reminder: '⏰' };
  return map[cat] || '📄';
}
function formatDate(timestamp) {
  if (!timestamp) return '';
  let date;
  if (typeof timestamp.toDate === 'function') date = timestamp.toDate();
  else date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function showToast(msg, type = 'success') {
  if (window.BulletinToast) {
    window.BulletinToast.show(msg, type);
  } else {
    console.log(`Toast: ${msg}`);
  }
}

// Close drawer/modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (EL.drawer.classList.contains('open')) closeDrawer();
    if (EL.viewAllModal.classList.contains('show')) closeViewAll();
  }
});
