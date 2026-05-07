// server.js — API REST ValeDoc
// Instale: npm install express cors mysql2 dotenv
// Inicie:  node server.js  (ou: npx nodemon server.js)

import express    from 'express';
import cors       from 'cors';
import dotenv     from 'dotenv';
import pool       from './db.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────
//  Middlewares globais
// ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONT_ORIGIN || '*', // ajuste para a origem do front em produção
}));
app.use(express.json());

// ──────────────────────────────────────────────
//  Valores aceitos (para validação)
// ──────────────────────────────────────────────
const CATS    = ['api','ui','db','infra','seg'];
const COLUNAS = ['backlog','em-progresso','revisao','concluido'];

// Helper: formata data para exibição (ex.: "07 mai")
function formatarData(dateStr) {
  const d = new Date(dateStr);
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${d.getDate().toString().padStart(2,'0')} ${meses[d.getMonth()]}`;
}

// ──────────────────────────────────────────────
//  Middleware: trata erros async sem try/catch repetido
// ──────────────────────────────────────────────
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ══════════════════════════════════════════════
//  ROTAS CRUD — /api/documentos
// ══════════════════════════════════════════════

// ──────────────────────────────────────────────
//  GET /api/documentos
//  Lista todos os documentos.
//  Query params opcionais:
//    ?categoria=api
//    ?coluna=backlog
// ──────────────────────────────────────────────
app.get('/api/documentos', asyncHandler(async (req, res) => {
  const { categoria, coluna } = req.query;

  let sql    = 'SELECT * FROM documentos WHERE 1=1';
  const params = [];

  if (categoria && CATS.includes(categoria)) {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }

  if (coluna && COLUNAS.includes(coluna)) {
    sql += ' AND coluna = ?';
    params.push(coluna);
  }

  sql += ' ORDER BY criado_em ASC';

  const [rows] = await pool.execute(sql, params);

  // Adiciona campo "data" formatado para o front-end
  const docs = rows.map(r => ({
    ...r,
    data: formatarData(r.criado_em),
  }));

  res.json({ success: true, data: docs });
}));

// ──────────────────────────────────────────────
//  GET /api/documentos/:id
//  Retorna um documento específico + seu histórico
// ──────────────────────────────────────────────
app.get('/api/documentos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [[doc]] = await pool.execute(
    'SELECT * FROM documentos WHERE id = ?',
    [id]
  );

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
  }

  const [historico] = await pool.execute(
    'SELECT * FROM historico WHERE documento_id = ? ORDER BY feito_em DESC',
    [id]
  );

  res.json({
    success: true,
    data: { ...doc, data: formatarData(doc.criado_em) },
    historico,
  });
}));

// ──────────────────────────────────────────────
//  POST /api/documentos
//  Cria um novo documento
//  Body: { titulo, descricao, categoria, coluna }
// ──────────────────────────────────────────────
app.post('/api/documentos', asyncHandler(async (req, res) => {
  const { titulo, descricao = '', categoria = 'api', coluna = 'backlog' } = req.body;

  // Validações
  if (!titulo || titulo.trim() === '') {
    return res.status(400).json({ success: false, message: 'O campo "titulo" é obrigatório.' });
  }
  if (!CATS.includes(categoria)) {
    return res.status(400).json({ success: false, message: `Categoria inválida. Use: ${CATS.join(', ')}.` });
  }
  if (!COLUNAS.includes(coluna)) {
    return res.status(400).json({ success: false, message: `Coluna inválida. Use: ${COLUNAS.join(', ')}.` });
  }

  const [result] = await pool.execute(
    'INSERT INTO documentos (titulo, descricao, categoria, coluna) VALUES (?, ?, ?, ?)',
    [titulo.trim(), descricao.trim(), categoria, coluna]
  );

  const [[novoDoc]] = await pool.execute(
    'SELECT * FROM documentos WHERE id = ?',
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Documento criado com sucesso.',
    data: { ...novoDoc, data: formatarData(novoDoc.criado_em) },
  });
}));

// ──────────────────────────────────────────────
//  PUT /api/documentos/:id
//  Atualiza título, descrição, categoria e/ou coluna
//  Body: { titulo?, descricao?, categoria?, coluna? }
// ──────────────────────────────────────────────
app.put('/api/documentos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [[docAtual]] = await pool.execute(
    'SELECT * FROM documentos WHERE id = ?',
    [id]
  );

  if (!docAtual) {
    return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
  }

  // Mescla com valores existentes (PATCH-like behavior)
  const titulo    = (req.body.titulo    ?? docAtual.titulo).toString().trim();
  const descricao = (req.body.descricao ?? docAtual.descricao ?? '').toString().trim();
  const categoria = req.body.categoria  ?? docAtual.categoria;
  const coluna    = req.body.coluna     ?? docAtual.coluna;

  if (!titulo) {
    return res.status(400).json({ success: false, message: 'O campo "titulo" não pode ser vazio.' });
  }
  if (!CATS.includes(categoria)) {
    return res.status(400).json({ success: false, message: `Categoria inválida. Use: ${CATS.join(', ')}.` });
  }
  if (!COLUNAS.includes(coluna)) {
    return res.status(400).json({ success: false, message: `Coluna inválida. Use: ${COLUNAS.join(', ')}.` });
  }

  await pool.execute(
    'UPDATE documentos SET titulo = ?, descricao = ?, categoria = ?, coluna = ? WHERE id = ?',
    [titulo, descricao, categoria, coluna, id]
  );

  const [[docAtualizado]] = await pool.execute(
    'SELECT * FROM documentos WHERE id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Documento atualizado.',
    data: { ...docAtualizado, data: formatarData(docAtualizado.criado_em) },
  });
}));

// ──────────────────────────────────────────────
//  PATCH /api/documentos/:id/mover
//  Move um card para outra coluna (drag & drop)
//  Body: { coluna }
// ──────────────────────────────────────────────
app.patch('/api/documentos/:id/mover', asyncHandler(async (req, res) => {
  const { id }     = req.params;
  const { coluna } = req.body;

  if (!COLUNAS.includes(coluna)) {
    return res.status(400).json({ success: false, message: `Coluna inválida. Use: ${COLUNAS.join(', ')}.` });
  }

  const [[doc]] = await pool.execute(
    'SELECT id FROM documentos WHERE id = ?',
    [id]
  );

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
  }

  await pool.execute(
    'UPDATE documentos SET coluna = ? WHERE id = ?',
    [coluna, id]
  );

  res.json({ success: true, message: `Documento movido para "${coluna}".` });
}));

// ──────────────────────────────────────────────
//  DELETE /api/documentos/:id
//  Remove um documento (o histórico permanece)
// ──────────────────────────────────────────────
app.delete('/api/documentos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [[doc]] = await pool.execute(
    'SELECT id FROM documentos WHERE id = ?',
    [id]
  );

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
  }

  await pool.execute('DELETE FROM documentos WHERE id = ?', [id]);

  res.json({ success: true, message: 'Documento removido com sucesso.' });
}));

// ──────────────────────────────────────────────
//  GET /api/documentos/:id/historico
//  Retorna todo o histórico de um documento
// ──────────────────────────────────────────────
app.get('/api/documentos/:id/historico', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [historico] = await pool.execute(
    'SELECT * FROM historico WHERE documento_id = ? ORDER BY feito_em DESC',
    [id]
  );

  res.json({ success: true, data: historico });
}));

// ──────────────────────────────────────────────
//  Middleware global de erros
// ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('🔴 Erro interno:', err);
  res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
});

// ──────────────────────────────────────────────
//  Inicia o servidor
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  ValeDoc API rodando em http://localhost:${PORT}`);
});
