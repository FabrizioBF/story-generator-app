// pages/api/generate-story.js - VERSÃO OTIMIZADA COM NEON
import OpenAI from "openai";

// ==================== CONFIGURAÇÃO OPENAI ====================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== FUNÇÃO DE SALVAMENTO ROBUSTO ====================
async function saveToDatabase(story, illustrationb64) {
  console.log('💾 Iniciando salvamento no banco de dados...');
  
  // Verificar se DATABASE_URL está configurada
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurada');
    return { 
      success: false, 
      error: 'DATABASE_URL não configurada no ambiente',
      code: 'NO_DATABASE_URL'
    };
  }

  // Verificar se é uma URL do Neon
  if (!process.env.DATABASE_URL.includes('neon.tech') && 
      !process.env.DATABASE_URL.includes('postgresql://')) {
    console.log('⚠️  DATABASE_URL não parece ser uma URL PostgreSQL válida');
  }

  try {
    console.log('🔗 Conectando ao banco PostgreSQL...');
    
    // Importação dinâmica do Prisma (evita problemas de build)
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      log: ['warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Testar conexão rápida
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

    // Inserir a história no banco
    console.log('📝 Inserindo história no banco...');
    const result = await prisma.story.create({
      data: {
        text: story.length > 10000 ? story.substring(0, 10000) : story, // Limita tamanho
        illustrationb64: illustrationb64 || ""
      }
    });

    await prisma.$disconnect();
    
    console.log(`✅ História salva com sucesso! ID: ${result.id}`);
    return { 
      success: true, 
      id: result.id,
      message: 'História salva no banco de dados'
    };
    
  } catch (dbError) {
    console.error('❌ ERRO ao salvar no banco:', {
      message: dbError.message,
      code: dbError.code,
      meta: dbError.meta
    });
    
    let userMessage = 'Erro ao salvar no banco de dados';
    if (dbError.code === 'P1001') {
      userMessage = 'Não foi possível conectar ao servidor de banco de dados.';
    } else if (dbError.code === 'P1012') {
      userMessage = 'Erro na configuração do banco de dados.';
    } else if (dbError.code === 'P2025') {
      userMessage = 'Problema na estrutura do banco.';
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
  
  // 1. Verificar método HTTP
  if (req.method !== 'POST') {
    console.log(`❌ Método ${req.method} não permitido`);
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowed: ['POST']
    });
  }

  // 2. Extrair dados do corpo
  const { mainCharacter, plot, ending, genre, literature } = req.body;
  console.log('📥 Dados recebidos:', { mainCharacter, plot, ending, genre, literature });

  // 3. Validação básica
  if (!mainCharacter || !plot || !ending) {
    console.log('❌ Validação falhou: campos obrigatórios faltando');
    return res.status(400).json({ 
      error: 'Campos obrigatórios faltando',
      required: ['mainCharacter', 'plot', 'ending'],
      received: { mainCharacter: !!mainCharacter, plot: !!plot, ending: !!ending }
    });
  }

  // 4. Verificar chave da OpenAI
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY não configurada');
    return res.status(500).json({ 
      error: 'Configuração do servidor incompleta',
      message: 'OPENAI_API_KEY não encontrada nas variáveis de ambiente',
      suggestion: 'Configure OPENAI_API_KEY no painel do Vercel'
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
          content: "Você é um escritor criativo especializado em português brasileiro. Produza textos claros e envolventes."
        },
        {
          role: "user",
          content: `Crie um(a) ${literature} no gênero ${genre} em português do Brasil. Diretrizes:
          1. Personagem principal: ${mainCharacter}
          2. Enredo central: ${plot}
          3. Desfecho: ${ending}
          4. Tamanho: 250-350 palavras
          5. Seja criativo, descritivo e mantenha uma narrativa coesa.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.8,
    });

    const story = gptResponse.choices[0].message.content;
    const gptTime = Date.now() - startTime;
    console.log(`✅ Texto gerado com sucesso em ${gptTime}ms`);
    console.log(`📏 Tamanho do texto: ${story.length} caracteres`);

    // ==================== GERAR ILUSTRAÇÃO COM DALL-E ====================
    let illustrationb64 = "";
    const imageStartTime = Date.now();
    
    console.log('🎨 Gerando prompt para ilustração...');
    const dallePromptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "Você é um especialista em criação de prompts para DALL-E 3. Seja conciso e específico." 
        },
        { 
          role: "user", 
          content: `Crie UM prompt detalhado em português para ilustrar esta história: ${story.substring(0, 500)}...
          Gênero: ${genre}. O prompt deve mencionar estilo artístico e ser apropriado para DALL-E 3.
          Responda APENAS com o prompt.` 
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

    // ==================== SALVAR NO BANCO DE DADOS ====================
    console.log('💾 Salvando no banco de dados...');
    const saveResult = await saveToDatabase(story, illustrationb64);
    
    // ==================== PREPARAR RESPOSTA ====================
    const totalTime = Date.now() - startTime;
    console.log(`🎉 Processo completo em ${totalTime}ms`);
    
    const responseData = {
      success: true,
      story: story,
      illustrationb64: illustrationb64,
      metadata: {
        generationTime: `${totalTime}ms`,
        textGenerationTime: `${gptTime}ms`,
        imageGenerationTime: `${imageTime}ms`,
        textLength: story.length,
        imageSize: `${Math.round(illustrationb64.length / 1024)}KB`,
        modelUsed: {
          text: "gpt-4o",
          image: "dall-e-3"
        },
        timestamp: new Date().toISOString()
      },
      database: {
        saved: saveResult.success,
        message: saveResult.message || saveResult.userMessage
      }
    };

    // Adicionar ID da história se salvou com sucesso
    if (saveResult.success && saveResult.id) {
      responseData.database.storyId = saveResult.id;
    }

    // Adicionar aviso se houve problema no banco (mas não crítico)
    if (!saveResult.success) {
      responseData.database.warning = saveResult.userMessage;
      console.log('⚠️  Aviso de banco:', saveResult.userMessage);
    }

    res.status(200).json(responseData);

  } catch (error) {
    // ==================== TRATAMENTO DE ERROS ====================
    console.error('💥 ERRO NA EXECUÇÃO:', {
      name: error.name,
      message: error.message,
      code: error.code,
      type: error.type,
      status: error.status
    });

    // Erros específicos da OpenAI
    if (error.code === 'insufficient_quota' || error.status === 429) {
      console.error('❌ Limite de quota excedido na OpenAI');
      return res.status(429).json({
        success: false,
        error: 'Limite de quota excedido',
        message: 'Você excedeu seu limite atual na OpenAI.',
        suggestion: 'Verifique seu plano e faturamento na plataforma OpenAI.',
        documentation: 'https://platform.openai.com/docs/guides/error-codes/api-errors'
      });
    }

    if (error.code === 'invalid_api_key' || error.status === 401) {
      console.error('❌ Chave da OpenAI inválida');
      return res.status(401).json({
        success: false,
        error: 'Chave da API inválida',
        message: 'A chave da OpenAI fornecida é inválida ou expirou.',
        suggestion: 'Verifique a variável OPENAI_API_KEY no Vercel.'
      });
    }

    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      console.error('❌ Timeout na requisição');
      return res.status(504).json({
        success: false,
        error: 'Timeout',
        message: 'A geração demorou muito tempo.',
        suggestion: 'Tente com um prompt mais simples ou aguarde um momento.'
      });
    }

    // Erro genérico
    res.status(500).json({
      success: false,
      error: 'Falha ao gerar conteúdo',
      message: error.message,
      internalCode: error.code,
      suggestion: 'Verifique os logs do servidor para mais detalhes.',
      timestamp: new Date().toISOString()
    });
  }
}