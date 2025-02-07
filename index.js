const express = require("express");
const cors = require("cors");
const { poolPromise, sql } = require("./db");
require("dotenv").config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Helper para tratamento de erros do SQL
const handleSQLError = (error) => {
  const errorMessages = {};
  let counter = 1;
  
  if (error.precedingErrors) {
    error.precedingErrors.forEach((err) => {
      errorMessages[`message-${counter.toString().padStart(2, '0')}`] = {
        code: err.code || 'UNKNOWN',
        message: err.message,
        line: err.lineNumber || null
      };
      counter++;
    });
  }
  
  if (error.message) {
    errorMessages[`message-${counter.toString().padStart(2, '0')}`] = {
      code: error.code || 'UNKNOWN',
      message: error.message,
      line: error.lineNumber || null
    };
  }

  return errorMessages;
};

// Endpoint para criar/atualizar cliente
app.post("/clientes", async (req, res) => {
  const { celular, nome, email } = req.body;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    
    request.input('Celular', sql.VarChar(20), celular);
    request.input('NomeCli', sql.VarChar(200), nome || '');
    request.input('eMail', sql.VarChar(50), email || '');

    const result = await request.execute('SpGrCliente');

    res.status(200).json({
      message: "Cliente criado/atualizado com sucesso!",
      data: result.recordset
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);
    
    res.status(400).json({
      error: "Erro ao processar a requisição",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});

// Endpoint para listar todos os clientes
app.get("/clientes", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT Celular, NomeCli, eMail 
      FROM cliente
      ORDER BY NomeCli
    `);
    
    res.status(200).json({
      data: result.recordset
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);
    
    res.status(500).json({
      error: "Erro ao listar clientes",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});


// Endpoint para buscar cliente por celular
app.get("/cliente/:celular", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Celular', sql.VarChar(15), req.params.celular)
      .execute('spse1cliente');

    if (result.recordset.length === 0) {
      return res.status(200).json({ 
        message: "Cliente não cadastrado!" // Mantendo o padrão da estrutura
      });
    }

    const cliente = result.recordset[0];
    const message = `Cliente encontrado com sucesso! Nome: ${cliente.NomeCli}, Celular: ${cliente.Celular}, Email: ${cliente.eMail}`;

    res.status(200).json({
      message: message,
      data: cliente
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);
    
    res.status(400).json({
      error: "Erro na busca",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined
    });
  }
});



// Endpoint para criar/atualizar thread
app.post("/threads", async (req, res) => {
  const { ThreadId, Celular, Assunto } = req.body;

  // Validação de dados
  if (!ThreadId || !Celular || !Assunto) {
    return res.status(400).json({
      status: "fail",
      error: "Dados incompletos",
      suggestion: "Verifique: ThreadId (até 50 chars), Celular (até 20 chars), Assunto não vazio"
    });
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    // Corrigir o nome do parâmetro para que seja exatamente igual ao esperado pela procedure
    request.input('TreadId', sql.Char(50), ThreadId);  // ALTERADO: 'ThreadId' para 'TreadId'
    request.input('Celular', sql.Char(20), Celular);
    request.input('Assunto', sql.VarChar(200), Assunto);

    const result = await request.execute('SpGrThreadIA');

    res.status(200).json({
      status: "success",
      message: "Thread criada/atualizada com sucesso",
      data: {
        ThreadId,
        Celular,
        Assunto,
        resultado: result.recordset  // Inclui o retorno do banco, se houver
      }
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      status: "fail",
      error: "Falha na operação",
      messages: errorMessages,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


// Endpoint para buscar thread por celular
app.get("/threads", async (req, res) => {
  try {
    const { celular } = req.query;

    if (!celular) {
      return res.status(400).json({
        status: "fail",
        error: "Parâmetro obrigatório",
        messages: {
          "message-01": {
            code: "MISSING_PARAM",
            message: "O parâmetro 'celular' é obrigatório na query string"
          }
        }
      });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Celular', sql.Char(20), celular) // Parâmetro correto
      .execute('SpSeThreadIA');               // Procedure correta

    res.status(200).json({
      status: "success",
      results: result.recordset.length,
      data: result.recordset
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Falha na busca",
      messages: {
        "message-01": {
          code: error.code || "UNKNOWN_ERROR",
          message: error.message
        }
      },
      suggestion: "O formato do celular deve ser '5511999999999'"
    });
  }
});


// Endpoint para listar todas as threads
app.get("/threads/all", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .execute('SpSeThreadIA'); // Executa a procedure sem parâmetros

    res.status(200).json({
      status: "success",
      results: result.recordset.length,
      data: result.recordset
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Falha na listagem",
      messages: handleSQLError(error),
      suggestion: "Verifique se a procedure SpSeThreadIA existe no banco"
    });
  }
});


// Endpoint para excluir thread
app.delete("/threads", async (req, res) => {
  try {
    const { TreadId, Celular } = req.body; // Corrigido para TreadId

    if (!TreadId) {
      return res.status(400).json({
        status: "fail",
        error: "TreadId é obrigatório para exclusão",
        messages: {
          "message-01": {
            code: "MISSING_TREADID",
            message: "O campo 'TreadId' deve ser fornecido"
          }
        }
      });
    }

    const pool = await poolPromise;
    const request = pool.request().input('TreadId', sql.Char(50), TreadId); // Correção aqui também

    if (Celular) {
      request.input('Celular', sql.Char(20), Celular);
    }

    await request.execute('SpExThreadIA');

    res.status(204).send(); // Sucesso sem conteúdo

  } catch (error) {
    res.status(400).json({
      status: "fail",
      error: "Exclusão falhou",
      messages: {
        "message-01": {
          code: "EREQUEST",
          message: error.message
        }
      },
      suggestion: "Verifique se a thread existe e tente novamente"
    });
  }
});



// Configuração final
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});