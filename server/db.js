// db.js — Conexão com MySQL usando pool de conexões
// Instale as dependências: npm install mysql2 dotenv

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'valedoc',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '-03:00', // horário de Brasília
});

// Testa a conexão ao iniciar
pool.getConnection()
  .then(conn => {
    console.log('✅  MySQL conectado com sucesso!');
    conn.release();
  })
  .catch(err => {
    console.error('❌  Erro ao conectar no MySQL:', err.message);
    process.exit(1);
  });

export default pool;
