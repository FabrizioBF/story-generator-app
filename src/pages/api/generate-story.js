// pages/api/generate-story.js - VERSÃO CORRIGIDA
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== FUNÇÃO DE SALVAMENTO ROBUSTO ====================
async function saveToDatabase(story, illustrationb64, userInput) {
  console.log('💾 Iniciando salvamento no banco de dados...');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurada');
    return { 
      success: false, 
      error: 'DATABASE_URL não configurada no ambiente',
      code: 'NO_DATABASE_URL'
    };
  }

  try {
    console.log('🔗 Conectando ao banco PostgreSQL...');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      log: ['warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Testar conexão
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Conexão com banco estabelecida');
    } catch (connError) {
      console.error('❌ Falha na conexão com o banco:', connError.message);
      await prisma.$disconnect();
      return { 
        success: false, 
        error: `Falha na conexão: ${connError.message}`,
        code: 'CONNECTION_FAILED'
      };
    }

    // Limitar o tamanho do texto para evitar erro de banco de dados
    const truncatedStory = story.length > 15000 ? story.substring(0, 15000) + '...' : story;
    const truncatedIllustration = illustrationb64 && illustrationb64.length > 5000000 
      ? illustrationb64.substring(0, 5000000) 
      : illustrationb64 || "";

    // Inserir a história no banco COM OS DADOS DO USUÁRIO
    console.log('📝 Inserindo história no banco...');
    console.log('📊 Dados do usuário:', {
      mainCharacter: userInput.mainCharacter?.substring(0, 50),
      plot: userInput.plot?.substring(0, 50),
      ending: userInput.ending?.substring(0, 50),
      genre: userInput.genre,
      literature: userInput.literature
    });

    // Verificar se a tabela tem os novos campos
    try {
      // Tentar inserir com todos os campos (incluindo os novos)
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: truncatedIllustration,
          mainCharacter: userInput.mainCharacter || "Não informado",
          plot: userInput.plot || "Não informado",
          ending: userInput.ending || "Não informado",
          genre: userInput.genre || "Não informado",
          literature: userInput.literature || "Não informado"
        }
      });

      await prisma.$disconnect();
      
      console.log(`✅ História salva com sucesso! ID: ${result.id}`);
      return { 
        success: true, 
        id: result.id,
        message: 'História salva no banco de dados'
      };
      
    } catch (schemaError) {
      console.log('⚠️  Tentando inserir sem os novos campos...', schemaError.message);
      
      // Se falhar, tentar inserir apenas com os campos originais
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: truncatedIllustration
        }
      });

      await prisma.$disconnect();
      
      console.log(`✅ História salva (sem metadados)! ID: ${result.id}`);
      return { 
        success: true, 
        id: result.id,
        message: 'História salva (estrutura antiga do banco)',
        warning: 'Campos do usuário não foram salvos - necessário migração do banco'
      };
    }
    
  } catch (dbError) {
    console.error('❌ ERRO ao salvar no banco:', {
      message: dbError.message,
      code: dbError.code
    });
    
    let userMessage = 'Erro ao salvar no banco de dados';
    if (dbError.code === 'P2000') {
      userMessage = 'O texto é muito longo para ser salvo. Tente com um texto menor.';
    } else if (dbError.code === 'P1001') {
      userMessage = 'Não foi possível conectar ao servidor de banco de dados.';
    }
    
    return { 
      success: false, 
      error: dbError.message,
      code: dbError.code,
      userMessage: userMessage
    };
  }
}

// ==================== HANDLER PRINCIPAL ====================
export default async function handler(req, res) {
  console.log('📨 === API generate-story chamada ===');
  
  if (req.method !== 'POST') {
    console.log(`❌ Método ${req.method} não permitido`);
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowed: ['POST']
    });
  }

  const { mainCharacter, plot, ending, genre, literature } = req.body;
  console.log('📥 Dados recebidos:', { 
    mainCharacter: mainCharacter?.substring(0, 30),
    plot: plot?.substring(0, 30),
    ending: ending?.substring(0, 30),
    genre,
    literature
  });

  if (!mainCharacter || !plot || !ending) {
    console.log('❌ Validação falhou: campos obrigatórios faltando');
    return res.status(400).json({ 
      error: 'Campos obrigatórios faltando',
      required: ['mainCharacter', 'plot', 'ending']
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY não configurada');
    return res.status(500).json({ 
      error: 'Configuração do servidor incompleta',
      message: 'OPENAI_API_KEY não encontrada'
    });
  }

  try {
    const startTime = Date.now();
    console.log('🚀 Iniciando geração de conteúdo...');

    // ==================== GERAR HISTÓRIA COM GPT ====================
    console.log('🤖 Gerando texto com GPT...');
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um escritor criativo especializado em português brasileiro. Produza textos claros e envolventes. LIMITE: máximo 300 palavras."
        },
        {
          role: "user",
          content: `Crie um(a) ${literature || 'história'} no gênero ${genre || 'fantasia'} em português do Brasil. Diretrizes:
          1. Personagem principal: ${mainCharacter}
          2. Enredo central: ${plot}
          3. Desfecho: ${ending}
          4. Tamanho: MÁXIMO 300 palavras
          5. Seja criativo, descritivo e mantenha uma narrativa coesa.`
        }
      ],
      max_tokens: 800, // Limitar tokens para evitar textos muito longos
      temperature: 0.8,
    });

    const story = gptResponse.choices[0].message.content;
    const gptTime = Date.now() - startTime;
    console.log(`✅ Texto gerado com sucesso em ${gptTime}ms`);
    console.log(`📏 Tamanho do texto: ${story.length} caracteres (${story.split(/\s+/).length} palavras)`);

    // Verificar se o texto é muito longo
    if (story.length > 20000) {
      console.log('⚠️  Texto muito longo, truncando...');
      const truncatedStory = story.substring(0, 15000) + '\n\n...[Texto truncado para caber no banco de dados]';
      
      // Continuar com o processo mesmo com texto truncado
      console.log(`📏 Tamanho após truncamento: ${truncatedStory.length} caracteres`);
    }

    // ==================== GERAR ILUSTRAÇÃO COM DALL-E ====================
    let illustrationb64 = "";
    const imageStartTime = Date.now();
    
    try {
      console.log('🎨 Gerando prompt para ilustração...');
      const dallePromptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "Você é um especialista em criação de prompts para DALL-E 3. Seja conciso e específico. Máximo 100 palavras." 
          },
          { 
            role: "user", 
            content: `Crie UM prompt detalhado em português para ilustrar esta história: ${story.substring(0, 300)}...
            Gênero: ${genre}. Personagem: ${mainCharacter}. 
            O prompt deve ser apropriado para DALL-E 3. Responda APENAS com o prompt.` 
          }
        ],
        max_tokens: 200,
      });
      
      const dallePrompt = dallePromptResponse.choices[0].message.content;
      console.log('📋 Prompt gerado:', dallePrompt.substring(0, 100) + '...');

      console.log('🖼️ Gerando imagem com DALL-E...');
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: dallePrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
        response_format: "b64_json",
      });

      illustrationb64 = imageResponse.data[0].b64_json;
      const imageTime = Date.now() - imageStartTime;
      console.log(`✅ Imagem gerada com sucesso em ${imageTime}ms`);
      console.log(`📊 Tamanho da imagem base64: ${Math.round(illustrationb64.length / 1024)}KB`);
      
    } catch (imageError) {
      console.error('❌ Erro ao gerar imagem:', imageError.message);
      illustrationb64 = "";
      // Continuar mesmo sem imagem
    }

    // ==================== SALVAR NO BANCO DE DADOS ====================
    console.log('💾 Salvando no banco de dados...');
    const saveResult = await saveToDatabase(story, illustrationb64, {
      mainCharacter,
      plot,
      ending,
      genre,
      literature
    });
    
    // ==================== PREPARAR RESPOSTA ====================
    const totalTime = Date.now() - startTime;
    console.log(`🎉 Processo completo em ${totalTime}ms`);
    
    const responseData = {
      success: true,
      story: story,
      illustrationb64: illustrationb64 || "",
      metadata: {
        generationTime: `${totalTime}ms`,
        textGenerationTime: `${gptTime}ms`,
        textLength: story.length,
        wordCount: story.split(/\s+/).length,
        modelUsed: "gpt-4o",
        timestamp: new Date().toISOString()
      },
      database: {
        saved: saveResult.success,
        message: saveResult.message || saveResult.userMessage,
        warning: saveResult.warning || null
      },
      // Incluir os dados do usuário na resposta
      userInput: {
        mainCharacter,
        plot,
        ending,
        genre,
        literature
      }
    };

    if (saveResult.success && saveResult.id) {
      responseData.database.storyId = saveResult.id;
    }

    if (!saveResult.success) {
      responseData.database.warning = saveResult.userMessage;
      console.log('⚠️  Aviso de banco:', saveResult.userMessage);
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 ERRO NA EXECUÇÃO:', {
      name: error.name,
      message: error.message,
      code: error.code
    });

    // Erros específicos da OpenAI
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Limite de quota excedido',
        message: 'Você excedeu seu limite atual na OpenAI.'
      });
    }

    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Chave da API inválida',
        message: 'A chave da OpenAI fornecida é inválida ou expirou.'
      });
    }

    // Erro genérico
    res.status(500).json({
      success: false,
      error: 'Falha ao gerar conteúdo',
      message: error.message,
      suggestion: 'Tente novamente com um prompt mais curto.'
    });
  }
}