

'use strict';

const STORAGE_KEY = 'taskflow_tasks';
const SW_PATH     = './service-worker.js';
const MAX_CHARS   = 200;

const state = {
  tasks: [],
  filter: 'all',
  deferredInstallPrompt: null,
};

const dom = {
  taskInput:       document.getElementById('task-input'),
  addBtn:          document.getElementById('add-btn'),
  taskList:        document.getElementById('task-list'),
  emptyState:      document.getElementById('empty-state'),
  emptySubtitle:   document.getElementById('empty-subtitle'),
  charCount:       document.getElementById('char-count'),
  charCounter:     document.getElementById('char-counter'),
  filterTabs:      document.querySelectorAll('.filter-tab'),
  clearDoneBtn:    document.getElementById('clear-done-btn'),
  totalCount:      document.getElementById('total-count'),
  pendingCount:    document.getElementById('pending-count'),
  doneCount:       document.getElementById('done-count'),
  progressFill:    document.getElementById('progress-ring-fill'),
  progressPct:     document.getElementById('progress-pct'),
  badgeAll:        document.getElementById('badge-all'),
  badgePending:    document.getElementById('badge-pending'),
  badgeDone:       document.getElementById('badge-done'),
  toast:           document.getElementById('toast'),
  toastIcon:       document.getElementById('toast-icon'),
  toastMessage:    document.getElementById('toast-message'),
  installBanner:   document.getElementById('install-banner'),
  installBtn:      document.getElementById('install-btn'),
  dismissInstall:  document.getElementById('dismiss-install-btn'),
  connectionStatus:document.getElementById('connection-status'),
  statusLabel:     document.querySelector('#connection-status .status-label'),
  swDot:           document.querySelector('#sw-status .sw-dot'),
  lastSaved:       document.getElementById('last-saved'),
  infoCache:       document.getElementById('info-cache'),
  infoSW:          document.getElementById('info-sw'),
};

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const tasks = JSON.parse(raw);

    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    console.error('[App] Erro ao carregar tarefas:', error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    updateLastSaved();
  } catch (error) {
    console.error('[App] Erro ao salvar tarefas:', error);
    showToast('Erro ao salvar. Armazenamento cheio?', 'error', '⚠️');
  }
}

function updateLastSaved() {
  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dom.lastSaved) {
    dom.lastSaved.textContent = `Salvo às ${time}`;
  }
}

function createTask(text) {
  return {
    id:        `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text:      text.trim(),
    done:      false,
    createdAt: new Date().toISOString(),
    doneAt:    null,
  };
}

function addTask() {
  const text = dom.taskInput.value.trim();

  if (!text) {
    shakeInput();
    showToast('Digite o nome da tarefa!', 'warning', '⚠️');
    dom.taskInput.focus();
    return;
  }

  if (text.length > MAX_CHARS) {
    showToast(`Máximo de ${MAX_CHARS} caracteres!`, 'warning', '⚠️');
    return;
  }

  const task = createTask(text);
  state.tasks.unshift(task);
  saveTasks();
  renderTaskList();
  updateStats();

  dom.taskInput.value = '';
  updateCharCounter('');

  showToast('Tarefa adicionada!', 'success', '✓');
  dom.taskInput.focus();

  console.log('[App] Tarefa adicionada:', task);
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  task.done   = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;

  saveTasks();
  renderTaskList();
  updateStats();

  const msg = task.done ? 'Tarefa concluída! 🎉' : 'Tarefa reaberta';
  const type = task.done ? 'success' : 'info';
  showToast(msg, type, task.done ? '✓' : '↩');
}

function removeTask(id) {
  const taskEl = document.getElementById(`task-${id}`);

  if (taskEl) {
    taskEl.classList.add('removing');
    taskEl.addEventListener('animationend', () => {
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveTasks();
      renderTaskList();
      updateStats();
    }, { once: true });
  } else {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks();
    renderTaskList();
    updateStats();
  }

  showToast('Tarefa removida', 'info', '🗑');
}

function clearDoneTasks() {
  const doneCount = state.tasks.filter(t => t.done).length;

  if (doneCount === 0) {
    showToast('Nenhuma tarefa concluída para limpar', 'warning', '⚠️');
    return;
  }

  state.tasks = state.tasks.filter(t => !t.done);
  saveTasks();
  renderTaskList();
  updateStats();

  showToast(`${doneCount} tarefa${doneCount > 1 ? 's' : ''} removida${doneCount > 1 ? 's' : ''}`, 'success', '🗑');
}

function getFilteredTasks() {
  switch (state.filter) {
    case 'pending': return state.tasks.filter(t => !t.done);
    case 'done':    return state.tasks.filter(t => t.done);
    default:        return [...state.tasks];
  }
}

function setFilter(filter) {
  state.filter = filter;

  dom.filterTabs.forEach(tab => {
    const isActive = tab.dataset.filter === filter;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive.toString());
  });

  renderTaskList();
}

function renderTaskList() {
  const filtered = getFilteredTasks();

  const isEmpty = filtered.length === 0;
  dom.emptyState.style.display = isEmpty ? 'flex' : 'none';
  dom.taskList.style.display   = isEmpty ? 'none' : 'flex';

  if (isEmpty) {
    dom.emptySubtitle.textContent = getEmptyMessage();
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach((task, index) => {
    const item = createTaskElement(task, index);
    fragment.appendChild(item);
  });

  dom.taskList.innerHTML = '';
  dom.taskList.appendChild(fragment);

  const hasDone = state.tasks.some(t => t.done);
  dom.clearDoneBtn.classList.toggle('hidden', !hasDone);
}

function createTaskElement(task, index) {
  const li = document.createElement('li');
  li.className = `task-item${task.done ? ' done' : ''}`;
  li.id = `task-${task.id}`;
  li.setAttribute('role', 'listitem');

  li.style.animationDelay = `${index * 40}ms`;
  const dateStr = formatDate(task.createdAt);
  const doneBadge = task.done
    ? `<span class="task-done-badge" aria-label="Concluída em ${formatDate(task.doneAt)}">
        ✓ Concluída
       </span>`
    : '';

  li.innerHTML = `
    <div class="task-checkbox-wrapper">
      <input
        type="checkbox"
        class="task-checkbox"
        id="check-${task.id}"
        ${task.done ? 'checked' : ''}
        aria-label="${task.done ? 'Desmarcar' : 'Marcar como concluída'}: ${escapeHtml(task.text)}"
      />
    </div>
    <label class="task-content" for="check-${task.id}" style="cursor: pointer;">
      <span class="task-text">${escapeHtml(task.text)}</span>
      <div class="task-meta">
        <span class="task-date">${dateStr}</span>
        ${doneBadge}
      </div>
    </label>
    <button
      class="task-delete-btn"
      aria-label="Remover tarefa: ${escapeHtml(task.text)}"
      title="Remover tarefa"
    >✕</button>
  `;

  const checkbox   = li.querySelector('.task-checkbox');
  const deleteBtn  = li.querySelector('.task-delete-btn');

  checkbox.addEventListener('change', () => toggleTask(task.id));
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeTask(task.id);
  });

  return li;
}

function getEmptyMessage() {
  switch (state.filter) {
    case 'pending': return 'Nenhuma tarefa pendente. Ótimo trabalho! 🎉';
    case 'done':    return 'Nenhuma tarefa concluída ainda.';
    default:        return 'Adicione sua primeira tarefa acima!';
  }
}

function updateStats() {
  const total   = state.tasks.length;
  const done    = state.tasks.filter(t => t.done).length;
  const pending = total - done;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

  animateNumber(dom.totalCount,   total);
  animateNumber(dom.pendingCount, pending);
  animateNumber(dom.doneCount,    done);

  dom.badgeAll.textContent     = total;
  dom.badgePending.textContent = pending;
  dom.badgeDone.textContent    = done;

  const offset = 100 - pct;
  dom.progressFill.style.strokeDashoffset = offset;
  dom.progressPct.textContent = `${pct}%`;

  if (pct === 100 && total > 0) {
    dom.progressFill.style.stroke = 'var(--color-success)';
  } else if (pct > 50) {
    dom.progressFill.style.stroke = 'var(--color-accent)';
  } else {
    dom.progressFill.style.stroke = 'var(--color-accent)';
  }
}

function animateNumber(el, newVal) {
  const current = parseInt(el.textContent, 10) || 0;
  if (current === newVal) return;

  el.textContent = newVal;
  el.classList.remove('updated');
  void el.offsetWidth;
  el.classList.add('updated');
}

let toastTimeout = null;

function showToast(message, type = 'info', icon = 'ℹ️', duration = 2500) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    dom.toast.classList.remove('show');
  }

  dom.toastIcon.textContent    = icon;
  dom.toastMessage.textContent = message;
  dom.toast.className          = `toast ${type}`;

  requestAnimationFrame(() => {
    dom.toast.classList.add('show');
  });

  toastTimeout = setTimeout(() => {
    dom.toast.classList.remove('show');
    toastTimeout = null;
  }, duration);
}

function updateCharCounter(text) {
  const len = text.length;
  dom.charCount.textContent = len;

  dom.charCounter.classList.remove('warning', 'danger');
  if (len > MAX_CHARS * 0.9)      dom.charCounter.classList.add('danger');
  else if (len > MAX_CHARS * 0.7) dom.charCounter.classList.add('warning');
}

function shakeInput() {
  dom.taskInput.style.transition = 'transform 80ms ease';
  const keyframes = [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-6px)' },
    { transform: 'translateX(6px)' },
    { transform: 'translateX(-4px)' },
    { transform: 'translateX(4px)' },
    { transform: 'translateX(0)' },
  ];
  dom.taskInput.animate(keyframes, { duration: 300, easing: 'ease' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now  = new Date();
    const diff = now - date;
    if (diff < 60_000) return 'Agora mesmo';
    if (diff < 3_600_000) {
      const mins = Math.floor(diff / 60_000);
      return `Há ${mins} min`;
    }

    if (date.toDateString() === now.toDateString()) {
      return `Hoje às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return '';
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[App] Service Workers não suportados neste navegador.');
    updateSWInfo('Não suportado');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: './'
    });

    console.log('[App] ✅ Service Worker registrado! Escopo:', registration.scope);
    monitorSWRegistration(registration);

  } catch (error) {
    console.error('[App] ❌ Falha ao registrar Service Worker:', error);
    updateSWInfo('Erro no registro');
    dom.swDot.className = 'sw-dot error';
  }
}

function monitorSWRegistration(registration) {
  if (registration.active) {
    console.log('[App] SW já está ativo.');
    dom.swDot.className = 'sw-dot active';
    dom.swDot.title = 'Service Worker ativo';
    updateSWInfo('Ativo ✓');
  }

  if (registration.installing) {
    console.log('[App] SW está sendo instalado...');
    trackSWState(registration.installing);
  }

  if (registration.waiting) {
    console.log('[App] Nova versão do SW aguardando.');
    dom.swDot.className = 'sw-dot waiting';
    dom.swDot.title = 'Nova versão disponível';
    showToast('Nova versão disponível! Recarregue.', 'info', '🔄', 5000);
  }

  registration.addEventListener('updatefound', () => {
    console.log('[App] Nova versão do SW detectada!');
    const newWorker = registration.installing;
    if (newWorker) trackSWState(newWorker);
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[App] SW assumiu o controle. Recarregando...');
    window.location.reload();
  });
}

function trackSWState(sw) {
  sw.addEventListener('statechange', () => {
    console.log('[App] SW state:', sw.state);

    switch (sw.state) {
      case 'installing':
        updateSWInfo('Instalando...');
        dom.swDot.className = 'sw-dot waiting';
        break;

      case 'installed':
        updateSWInfo('Instalado');
        break;

      case 'activating':
        updateSWInfo('Ativando...');
        break;

      case 'activated':
        updateSWInfo('Ativo ✓');
        dom.swDot.className = 'sw-dot active';
        dom.swDot.title = 'Service Worker ativo';
        showToast('App pronto para uso offline!', 'success', '⚡');
        break;

      case 'redundant':
        updateSWInfo('Substituído');
        dom.swDot.className = 'sw-dot error';
        break;
    }
  });
}

function updateSWInfo(status) {
  if (dom.infoSW) dom.infoSW.textContent = status;
}

async function checkCacheStatus() {
  if (!('caches' in window)) {
    if (dom.infoCache) dom.infoCache.textContent = 'Não suportado';
    return;
  }

  try {
    const cacheNames = await caches.keys();
    if (dom.infoCache) {
      dom.infoCache.textContent = cacheNames.length > 0
        ? `${cacheNames.length} cache(s) ativo(s)`
        : 'Nenhum cache';
    }
  } catch {
    if (dom.infoCache) dom.infoCache.textContent = 'Verificar DevTools';
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();

  console.log('[App] 📱 PWA pode ser instalada!');

  state.deferredInstallPrompt = event;
  showInstallBanner();
});

function showInstallBanner() {
  dom.installBanner.classList.remove('hidden');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dom.installBanner.classList.add('show');
    });
  });
}

function hideInstallBanner() {
  dom.installBanner.classList.remove('show');
  setTimeout(() => {
    dom.installBanner.classList.add('hidden');
  }, 350);
}

async function promptInstall() {
  if (!state.deferredInstallPrompt) {
    showToast('Instalação não disponível agora', 'warning', '⚠️');
    return;
  }

  state.deferredInstallPrompt.prompt();
  const { outcome } = await state.deferredInstallPrompt.userChoice;
  console.log('[App] Resultado da instalação:', outcome);

  if (outcome === 'accepted') {
    showToast('App instalado com sucesso!', 'success', '🎉', 3000);
  } else {
    showToast('Instalação cancelada', 'info', 'ℹ️');
  }

  state.deferredInstallPrompt = null;
  hideInstallBanner();
}

window.addEventListener('appinstalled', () => {
  console.log('[App] ✅ PWA instalada com sucesso!');
  showToast('TaskFlow instalado! 🎉', 'success', '✅', 4000);
  state.deferredInstallPrompt = null;
  hideInstallBanner();
});

function updateConnectionStatus() {
  const isOnline = navigator.onLine;

  dom.connectionStatus.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
  dom.statusLabel.textContent    = isOnline ? 'Online' : 'Offline';

  if (!isOnline) {
    showToast('Você está offline. Dados salvos localmente.', 'warning', '📵', 4000);
  } else {
    showToast('Conexão restaurada!', 'success', '🌐', 2000);
  }
}

window.addEventListener('online',  updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

function setupEventListeners() {
  dom.addBtn.addEventListener('click', addTask);
  dom.taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTask();
    }
  });

  dom.taskInput.addEventListener('input', (e) => {
    updateCharCounter(e.target.value);
  });

  dom.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setFilter(tab.dataset.filter);
    });
  });

  dom.clearDoneBtn.addEventListener('click', clearDoneTasks);
  dom.installBtn.addEventListener('click', promptInstall);
  dom.dismissInstall.addEventListener('click', hideInstallBanner);

  dom.installBanner.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideInstallBanner();
  });
}

function init() {
  console.log('[App] 🚀 Inicializando TaskFlow PWA...');

  state.tasks = loadTasks();
  console.log(`[App] ${state.tasks.length} tarefa(s) carregada(s) do localStorage.`);
  renderTaskList();
  updateStats();
  setupEventListeners();
  registerServiceWorker();
  checkCacheStatus();
  const isOnline = navigator.onLine;
  dom.connectionStatus.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
  dom.statusLabel.textContent    = isOnline ? 'Online' : 'Offline';

  setTimeout(() => dom.taskInput.focus(), 100);

  console.log('[App] ✅ Inicialização completa!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

