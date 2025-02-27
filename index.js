const express = require("express");
const cors = require("cors");
const { poolPromise, sql } = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

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
  const { celular, nome, email, assinante, pagtoEmDia, prefResp } = req.body;

  if (!celular) {
    return res.status(400).json({
      error: "O campo 'celular' é obrigatório.",
      suggestion: "Envie um JSON com o campo 'celular'."
    });
  }

  try {
    const pool = await poolPromise;
    
    const checkCliente = await pool.request()
      .input('Celular', sql.VarChar(20), celular)
      .query(`SELECT 1 FROM cliente WHERE Celular = @Celular`);

    const clienteExiste = checkCliente.recordset.length > 0;

    const request = pool.request();
    request.input('Celular', sql.VarChar(20), celular);
    request.input('NomeCli', sql.VarChar(200), nome || '');
    request.input('eMail', sql.VarChar(50), email || '');
    request.input('Assinante', sql.VarChar(3), assinante || '');
    request.input('PagtoEmDia', sql.VarChar(3), pagtoEmDia || '');
    request.input('PrefResp', sql.Char(5), prefResp || '');

    await request.execute('SpGrCliente');

    const result = await pool.request()
      .input('Celular', sql.VarChar(20), celular)
      .query(`
        SELECT Celular, NomeCli, eMail, Assinante, PagtoEmDia, PrefResp
        FROM cliente 
        WHERE Celular = @Celular
      `);

    const clienteAtualizado = result.recordset[0];

    const message = clienteExiste ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!";

    res.status(200).json({
      message,
      data: clienteAtualizado
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
    const result = await pool.request().execute("SpSeCliente");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum cliente encontrado!"
      });
    }

    res.status(200).json({
      message: `Clientes encontrados: ${result.recordset.length}`,
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
        message: "Cliente não cadastrado!" 
      });
    }

    const cliente = result.recordset[0];

    const clienteData = {
      Nome: cliente.NomeCli,
      Celular: cliente.Celular,
      Email: cliente.eMail,
      Assinante: cliente.Assinante,  
      PagtoEmDia: cliente.PagtoEmDia,
      PrefResp: cliente.PrefResp
    };

    const message = `Cliente encontrado com sucesso! Nome: ${clienteData.Nome}, Celular: ${clienteData.Celular}, Email: ${clienteData.Email}, Assinante: ${clienteData.Assinante}, Pagamento em Dia: ${clienteData.PagtoEmDia}, Preferência de Resposta: ${clienteData.PrefResp}`;

    res.status(200).json({
      message: message,
      data: clienteData
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


// Endpoint para excluir cliente por celular
app.delete("/cliente/:celular", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Celular', sql.VarChar(15), req.params.celular)
      .execute('SpExCliente');

    if (result.rowsAffected[0] === 0) {
      return res.status(200).json({ 
        message: "Cliente não encontrado ou já excluído!" 
      });
    }

    res.status(200).json({
      message: "Cliente excluído com sucesso!"
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);
    
    res.status(400).json({
      error: "Erro na exclusão",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined
    });
  }
});


// Endpoint para gravar os prompts
app.post("/prompt", async (req, res) => {
  const { prompt, instrupadrao, obs } = req.body;

  if (!prompt || !instrupadrao || !obs) {
    return res.status(400).json({
      error: "Os campos 'prompt', 'instrupadrao' e 'obs' são obrigatórios.",
      suggestion: "Envie um JSON com os campos obrigatórios preenchidos."
    });
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("PromptIA", sql.VarChar(5000), prompt);
    request.input("InstrPadrao", sql.VarChar(5000), instrupadrao);
    request.input("Obs", sql.VarChar(5000), obs);

    await request.execute("SpGrComandoIA");

    res.status(201).json({
      message: "Prompt cadastrado com sucesso!",
      data: {
        prompt,
        instrupadrao,
        obs
      }
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao cadastrar o prompt",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


// Endpoint para listar os prompts
app.get("/prompt", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SpSe1ComandoAtu");

    if (result.recordset.length === 0) {
      return res.status(200).json({
        message: "Nenhum prompt encontrado!"
      });
    }

    res.status(200).json({
      message: `Prompts encontrados: ${result.recordset.length}`,
      data: result.recordset  
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao listar os prompts",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Tente novamente mais tarde"
    });
  }
});


// Endpoint para registrar custos de tokens
app.post("/tokens", async (req, res) => {
  const { celular, prefResp, pergunta, resposta, nomeIA, dolarCota } = req.body;

  if (!celular || !prefResp || !pergunta || !resposta || !nomeIA || !dolarCota) {
    return res.status(400).json({
      error: "Os campos 'celular', 'prefResp', 'pergunta', 'resposta', 'nomeIA' e 'dolarCota' são obrigatórios.",
      suggestion: "Envie um JSON com os campos obrigatórios preenchidos."
    });
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("Celular", sql.Char(20), celular);
    request.input("PrefResp", sql.Char(5), prefResp);
    request.input("Pergunta", sql.NVarChar(sql.MAX), pergunta);
    request.input("Resposta", sql.NVarChar(sql.MAX), resposta);
    request.input("NomeIA", sql.Char(30), nomeIA);
    request.input("DolarCota", sql.Decimal(10, 6), dolarCota);

    await request.execute("SpContaTokens");

    res.status(201).json({
      message: "Registro de tokens salvo com sucesso!",
      data: {
        celular,
        prefResp,
        pergunta,
        resposta,
        nomeIA,
        dolarCota
      }
    });

  } catch (error) {
    const errorMessages = handleSQLError(error);
    console.error("Erro SQL:", errorMessages);

    res.status(500).json({
      error: "Erro ao registrar o custo dos tokens",
      details: process.env.NODE_ENV === 'development' ? errorMessages : undefined,
      suggestion: "Verifique os dados enviados e tente novamente"
    });
  }
});


// Endpoint para criar/atualizar thread
app.post("/threads", async (req, res) => {
  const { ThreadId, Celular, Assunto } = req.body;

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

    request.input('TreadId', sql.Char(50), ThreadId);  
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
        resultado: result.recordset   
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
      .input('Celular', sql.Char(20), celular)  
      .execute('SpSeThreadIA');                

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
      .execute('SpSeThreadIA');  

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
    const { TreadId, Celular } = req.body;  

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
    const request = pool.request().input('TreadId', sql.Char(50), TreadId); 

    if (Celular) {
      request.input('Celular', sql.Char(20), Celular);
    }

    await request.execute('SpExThreadIA');

    res.status(204).send(); 

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