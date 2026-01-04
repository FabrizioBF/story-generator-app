// pages/api/generate-story.js - VERSÃO OTIMIZADA (SEM SALVAR IMAGEM NO BANCO)
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== FUNÇÃO DE SALVAMENTO SIMPLIFICADA ====================
async function saveToDatabase(story, userInput) {
  console.log('💾 Iniciando salvamento no banco de dados...');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL não configurada');
    return { 
      success: false, 
      error: 'DATABASE_URL não configurada',
      code: 'NO_DATABASE_URL'
    };
  }

  try {
    console.log('🔗 Conectando ao banco PostgreSQL...');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    });

    // Testar conexão
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão com banco estabelecida');

    // Limitar o tamanho do texto para evitar erro
    const MAX_STORY_LENGTH = 10000; // 10K caracteres
    const truncatedStory = story.length > MAX_STORY_LENGTH 
      ? story.substring(0, MAX_STORY_LENGTH) + '... [Texto truncado]' 
      : story;

    console.log('📝 Inserindo história no banco...');
    
    // Tentar inserir COM os novos campos
    try {
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: "", // String vazia - não salvar imagem
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
      console.log('⚠️  Erro de schema, tentando inserir sem novos campos...');
      
      // Se falhar, tentar inserir apenas com texto
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: "" // String vazia
        }
      });

      await prisma.$disconnect();
      
      console.log(`✅ História salva (sem metadados)! ID: ${result.id}`);
      return { 
        success: true, 
        id: result.id,
        message: 'História salva (campos limitados)',
        warning: 'Campos do usuário não salvos - necessário migração'
      };
    }
    
  } catch (dbError) {
    console.error('❌ ERRO ao salvar no banco:', dbError.message);
    
    return { 
      success: false, 
      error: dbError.message,
      code: dbError.code,
      userMessage: 'Erro ao salvar no banco de dados'
    };
  }
}

// ==================== HANDLER PRINCIPAL ====================
export default async function handler(req, res) {
  console.log('📨 === API generate-story chamada ===');
  
  // 1. Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowed: ['POST']
    });
  }

  // 2. Extrair dados do corpo
  const { mainCharacter, plot, ending, genre, literature } = req.body;
  
  // 3. Validação básica
  if (!mainCharacter || !plot || !ending) {
    return res.status(400).json({ 
      error: 'Campos obrigatórios faltando: personagem, enredo e desfecho'
    });
  }

  // 4. Verificar chave da OpenAI
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ 
      error: 'OPENAI_API_KEY não configurada'
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
          content: `Você é um escritor criativo especializado em português brasileiro. 
          Diretrizes IMPORTANTES:
          1. Produza textos claros e envolventes
          2. MÁXIMO 250 palavras (cerca de 1500 caracteres)
          3. Use linguagem apropriada para estudantes
          4. Mantenha uma narrativa coesa
          5. INCLUA as seguintes informações no FINAL do texto:
             
"===INFORMAÇÕES DO USUÁRIO===
Personagem Principal: ${mainCharacter}
Enredo: ${plot}
Desfecho: ${ending}
Gênero: ${genre}
Tipo de Literatura: ${literature}
=========================="`
        },
        {
          role: "user",
          content: `Crie um(a) ${literature || 'história'} no gênero ${genre || 'fantasia'} em português do Brasil.
          
          Personagem principal: ${mainCharacter}
          Enredo central: ${plot}
          Desfecho: ${ending}
          
          Lembre-se: MÁXIMO 250 palavras.`
        }
      ],
      max_tokens: 600, // Limitar para texto mais curto
      temperature: 0.7,
    });

    let story = gptResponse.choices[0].message.content;
    console.log(`✅ Texto gerado: ${story.length} caracteres, ${story.split(/\s+/).length} palavras`);

    // ==================== GERAR ILUSTRAÇÃO COM DALL-E ====================
    let illustrationb64 = "";
    
    try {
      console.log('🎨 Gerando ilustração...');
      
      // Criar prompt mais simples para evitar imagens muito complexas
      const imagePrompt = `Ilustração para uma ${literature || 'história'} de ${genre || 'fantasia'}.
      Personagem: ${mainCharacter}.
      Cena principal relacionada a: ${plot.substring(0, 100)}...
      Estilo: Ilustração digital colorida, apropriada para educação.`;
      
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
        response_format: "b64_json",
      });

      illustrationb64 = imageResponse.data[0].b64_json;
      console.log(`✅ Imagem gerada: ${Math.round(illustrationb64.length / 1024)}KB`);
      
    } catch (imageError) {
      console.log('⚠️  Não foi possível gerar imagem:', imageError.message);
      illustrationb64 = "";
    }

    // ==================== SALVAR NO BANCO DE DADOS ====================
    console.log('💾 Salvando história no banco (SEM imagem)...');
    const saveResult = await saveToDatabase(story, {
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
      illustrationb64: illustrationb64, // A imagem é retornada, mas NÃO salva no banco
      metadata: {
        generationTime: `${totalTime}ms`,
        textLength: story.length,
        wordCount: story.split(/\s+/).length,
        timestamp: new Date().toISOString()
      },
      database: {
        saved: saveResult.success,
        storyId: saveResult.id,
        message: saveResult.message,
        warning: saveResult.warning || null
      },
      // Dados do usuário sempre retornados
      userInput: {
        mainCharacter,
        plot,
        ending,
        genre,
        literature
      }
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 ERRO:', error.message);

    // Tratamento de erros comuns
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Limite de quota excedido na OpenAI'
      });
    }

    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Chave da API inválida'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao gerar conteúdo',
      message: error.message
    });
  }
}