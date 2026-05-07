// index.js — ValeDoc Front-end
// Consome a API REST em vez de usar dados locais

// ──────────────────────────────────────────────
//  Configuração
// ──────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api'; // ajuste se necessário

const CATS = {
  api:   {label:'API',            bg:'#E6F1FB',color:'#0C447C',dot:'#185FA5'},
  ui:    {label:'UI',             bg:'#EEEDFE',color:'#3C3489',dot:'#534AB7'},
  db:    {label:'Banco de dados', bg:'#E1F5EE',color:'#085041',dot:'#1D9E75'},
  infra: {label:'Infra',          bg:'#FAEEDA',color:'#633806',dot:'#BA7517'},
  seg:   {label:'Segurança',      bg:'#FAECE7',color:'#712B13',dot:'#993C1D'},
};

// Estado local (espelho do banco, para evitar re-renders desnecessários)
let docs       = [];
let editId     = null;
let filtroCat  = null;
let filtroCol  = null;
let dragged    = null; // id do doc sendo arrastado

// ══════════════════════════════════════════════
//  API HELPERS
// ══════════════════════════════════════════════

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Erro na requisição');
  return json;
}

// ──────────────────────────────────────────────
//  Carrega todos os documentos do banco
// ──────────────────────────────────────────────
async function carregarDocs() {
  try {
    const { data } = await apiFetch('/documentos');
    docs = data;
    renderTudo();
  } catch (err) {
    toast('Erro ao carregar documentos: ' + err.message, true);
  }
}

// ══════════════════════════════════════════════
//  CARD
// ══════════════════════════════════════════════
function renderCard(doc) {
  const c   = CATS[doc.categoria];
  const div = document.createElement('div');
  div.className  = 'card';
  div.draggable  = true;
  div.dataset.id = doc.id;

  div.ondragstart = () => {
    dragged = doc.id;
    setTimeout(() => div.classList.add('dragging'), 0);
  };
  div.ondragend = () => div.classList.remove('dragging');

  div.innerHTML = `
    <div class="card-cat" style="background:${c.bg};color:${c.color}">
      <span style="width:6px;height:6px;border-radius:50%;background:${c.dot}"></span>
      ${c.label}
    </div>
    <div class="card-title">${escHTML(doc.titulo)}</div>
    ${doc.descricao ? `<div class="card-desc">${escHTML(doc.descricao)}</div>` : ''}
    <div class="card-footer">
      <span class="card-date">${doc.data || ''}</span>
      <div class="card-acts">
        <button class="icon-btn" title="Editar" onclick="editarDoc(${doc.id})">✏️</button>
        <button class="icon-btn danger" title="Excluir" onclick="deletarDoc(${doc.id})">🗑️</button>
      </div>
    </div>
  `;

  return div;
}

// ══════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════
function renderTudo() {
  const colunas = ['backlog', 'em-progresso', 'revisao', 'concluido'];
  let total = 0;

  colunas.forEach(col => {
    const cont = document.getElementById('cards-' + col);
    cont.innerHTML = '';

    const filtrados = docs.filter(d => {
      if (d.coluna !== col) return false;
      if (filtroCat && d.categoria !== filtroCat) return false;
      if (filtroCol && d.coluna   !== filtroCol)  return false;
      return true;
    });

    filtrados.forEach(d => cont.appendChild(renderCard(d)));
    document.getElementById('cnt-' + col).textContent = filtrados.length;
    total += filtrados.length;
  });

  document.getElementById('total-badge').textContent = docs.length;
  atualizarContadoresCat();
}

function atualizarContadoresCat() {
  document.querySelectorAll('.cat-count').forEach(el => {
    const cat = el.dataset.cat;
    el.textContent = docs.filter(d => d.categoria === cat).length;
  });
}

// ══════════════════════════════════════════════
//  DRAG & DROP
// ══════════════════════════════════════════════
function dragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
}

function dragLeave(e) {
  e.currentTarget.classList.remove('dragover');
}

async function drop(e, col) {
  e.currentTarget.classList.remove('dragover');
  if (!dragged) return;

  const doc = docs.find(d => d.id === dragged);
  if (!doc || doc.coluna === col) { dragged = null; return; }

  try {
    await apiFetch(`/documentos/${dragged}/mover`, {
      method: 'PATCH',
      body: JSON.stringify({ coluna: col }),
    });

    doc.coluna = col; // atualiza espelho local
    toast('Movido para ' + col + '!');
    renderTudo();
  } catch (err) {
    toast('Erro ao mover: ' + err.message, true);
  }

  dragged = null;
}

// ══════════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════════
function abrirModal(col = 'backlog') {
  editId = null;
  document.getElementById('modal-titulo-label').textContent = 'Novo documento';
  document.getElementById('f-titulo').value = '';
  document.getElementById('f-desc').value   = '';
  document.getElementById('f-cat').value    = 'api';
  document.getElementById('f-col').value    = col;
  document.getElementById('overlay').style.display = 'flex';
}

function fecharModal() {
  document.getElementById('overlay').style.display = 'none';
}

// ══════════════════════════════════════════════
//  CRUD
// ══════════════════════════════════════════════

// ---------- CREATE / UPDATE ----------
async function salvar() {
  const titulo    = document.getElementById('f-titulo').value.trim();
  const descricao = document.getElementById('f-desc').value.trim();
  const categoria = document.getElementById('f-cat').value;
  const coluna    = document.getElementById('f-col').value;

  if (!titulo) {
    document.getElementById('f-titulo').focus();
    return;
  }

  try {
    if (editId) {
      // UPDATE
      const { data } = await apiFetch(`/documentos/${editId}`, {
        method: 'PUT',
        body: JSON.stringify({ titulo, descricao, categoria, coluna }),
      });
      const idx = docs.findIndex(d => d.id === editId);
      if (idx !== -1) docs[idx] = data;
      toast('Documento atualizado!');
    } else {
      // CREATE
      const { data } = await apiFetch('/documentos', {
        method: 'POST',
        body: JSON.stringify({ titulo, descricao, categoria, coluna }),
      });
      docs.push(data);
      toast('Documento criado!');
    }

    fecharModal();
    renderTudo();
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, true);
  }
}

// ---------- EDIT (abre modal preenchido) ----------
function editarDoc(id) {
  const doc = docs.find(d => d.id === id);
  if (!doc) return;

  editId = id;
  document.getElementById('modal-titulo-label').textContent = 'Editar documento';
  document.getElementById('f-titulo').value = doc.titulo;
  document.getElementById('f-desc').value   = doc.descricao || '';
  document.getElementById('f-cat').value    = doc.categoria;
  document.getElementById('f-col').value    = doc.coluna;
  document.getElementById('overlay').style.display = 'flex';
}

// ---------- DELETE ----------
async function deletarDoc(id) {
  if (!confirm('Tem certeza que deseja excluir este documento?')) return;

  try {
    await apiFetch(`/documentos/${id}`, { method: 'DELETE' });
    docs = docs.filter(d => d.id !== id);
    toast('Documento removido.');
    renderTudo();
  } catch (err) {
    toast('Erro ao excluir: ' + err.message, true);
  }
}

// ══════════════════════════════════════════════
//  FILTROS
// ══════════════════════════════════════════════
function filtrarCat(cat) {
  filtroCat = cat;
  renderTudo();
}

function filtrarStatus(status, btn) {
  filtroCol = status;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderTudo();
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
function toast(msg, erro = false) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.style.background = erro ? '#A32D2D' : 'var(--blue)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ══════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════
function escHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.getElementById('overlay')
  .addEventListener('click', e => {
    if (e.target.id === 'overlay') fecharModal();
  });

// Carrega os dados do banco ao iniciar
carregarDocs();
