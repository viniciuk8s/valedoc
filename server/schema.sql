-- ==========================================================
--  ValeDoc — Schema MySQL
--  Execute este arquivo uma vez para criar o banco de dados
--  Comando: mysql -u root -p < schema.sql
-- ==========================================================

CREATE DATABASE IF NOT EXISTS valedoc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE valedoc;

-- ----------------------------------------------------------
--  Tabela principal de documentos
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  titulo      VARCHAR(255)    NOT NULL,
  descricao   TEXT,
  categoria   ENUM('api','ui','db','infra','seg') NOT NULL DEFAULT 'api',
  coluna      ENUM('backlog','em-progresso','revisao','concluido') NOT NULL DEFAULT 'backlog',
  criado_em   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
--  Tabela de histórico de alterações (auditoria completa)
--  Cada UPDATE/DELETE gera um registro aqui automaticamente
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS historico (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  documento_id  INT UNSIGNED  NOT NULL,
  acao          ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  snapshot      JSON          NOT NULL COMMENT 'estado do documento no momento da ação',
  feito_em      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_doc (documento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
--  Trigger: grava histórico ao criar um documento
-- ----------------------------------------------------------
DELIMITER $$
CREATE TRIGGER trg_doc_after_insert
AFTER INSERT ON documentos
FOR EACH ROW
BEGIN
  INSERT INTO historico (documento_id, acao, snapshot)
  VALUES (
    NEW.id,
    'CREATE',
    JSON_OBJECT(
      'id',          NEW.id,
      'titulo',      NEW.titulo,
      'descricao',   NEW.descricao,
      'categoria',   NEW.categoria,
      'coluna',      NEW.coluna,
      'criado_em',   NEW.criado_em
    )
  );
END$$

-- ----------------------------------------------------------
--  Trigger: grava histórico ao atualizar um documento
-- ----------------------------------------------------------
CREATE TRIGGER trg_doc_after_update
AFTER UPDATE ON documentos
FOR EACH ROW
BEGIN
  INSERT INTO historico (documento_id, acao, snapshot)
  VALUES (
    NEW.id,
    'UPDATE',
    JSON_OBJECT(
      'id',             NEW.id,
      'titulo',         NEW.titulo,
      'descricao',      NEW.descricao,
      'categoria',      NEW.categoria,
      'coluna',         NEW.coluna,
      'atualizado_em',  NEW.atualizado_em
    )
  );
END$$

-- ----------------------------------------------------------
--  Trigger: grava histórico ao deletar um documento
-- ----------------------------------------------------------
CREATE TRIGGER trg_doc_after_delete
AFTER DELETE ON documentos
FOR EACH ROW
BEGIN
  INSERT INTO historico (documento_id, acao, snapshot)
  VALUES (
    OLD.id,
    'DELETE',
    JSON_OBJECT(
      'id',        OLD.id,
      'titulo',    OLD.titulo,
      'descricao', OLD.descricao,
      'categoria', OLD.categoria,
      'coluna',    OLD.coluna
    )
  );
END$$
DELIMITER ;

-- ----------------------------------------------------------
--  Dados iniciais (os mesmos do front-end original)
-- ----------------------------------------------------------
INSERT INTO documentos (titulo, descricao, categoria, coluna, criado_em) VALUES
  ('Visão geral da arquitetura',    'Stack completa Python + MySQL + HTML/JS',        'api',   'concluido',    '2025-05-02 10:00:00'),
  ('Modelo entidade-relacionamento','Diagrama e descrição das tabelas principais',    'db',    'revisao',      '2025-05-06 10:00:00'),
  ('Endpoints de autenticação',     'Rotas /login, /logout e refresh token',          'api',   'em-progresso', '2025-05-07 10:00:00'),
  ('Guia de componentes front-end', 'Padronizar botões, inputs e tabelas',            'ui',    'em-progresso', '2025-05-08 10:00:00'),
  ('Configuração do servidor MySQL','Setup e variáveis de ambiente',                  'infra', 'backlog',      '2025-05-10 10:00:00'),
  ('Política de controle de acesso','Definir roles e permissões',                     'seg',   'backlog',      '2025-05-15 10:00:00');
