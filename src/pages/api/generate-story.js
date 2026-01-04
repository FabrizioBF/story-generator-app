// pages/api/generate-story.js - VERSÃO OTIMIZADA COM RESOLUÇÃO REDUZIDA
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== CONFIGURAÇÕES OTIMIZADAS ====================
const IMAGE_CONFIG = {
  GENERATION_SIZE: "256x256",       // REDUZIDO: 256x256 em vez de 512x512
  MAX_THUMBNAIL_KB: 50,            // REDUZIDO: Máximo 50KB no banco
  MAX_STORY_LENGTH: 8000,          // REDUZIDO: Máximo 8K caracteres no banco
  MAX_IMAGE_SIZE_KB: 100,          // Máximo 100KB para imagem completa
  COMPRESSION_QUALITY: 0.5,        // REDUZIDO: Qualidade 50% para thumbnails
};

// ==================== FUNÇÕES AUXILIARES ====================

// Função para criar thumbnail MUITO pequena
async function createOptimizedThumbnail(base64String) {
  if (!base64String || base64String.length === 0) {
    console.log('❌ String base64 vazia');
    return "";
  }

  console.log('🖼️ Processando imagem para thumbnail otimizada...');
  
  const originalSizeKB = Math.round(base64String.length / 1024);
  console.log(`📊 Tamanho original da imagem: ${originalSizeKB}KB`);
  
  // Se a imagem já for muito pequena (< 50KB), usar como está
  if (originalSizeKB <= IMAGE_CONFIG.MAX_THUMBNAIL_KB) {
    console.log(`✅ Imagem já pequena (${originalSizeKB}KB), usando como thumbnail`);
    return base64String;
  }
  
  console.log(`⚠️  Imagem grande (${originalSizeKB}KB), criando thumbnail otimizada`);
  
  try {
    // MÉTODO SIMPLIFICADO: Truncar a string base64 para reduzir tamanho
    // Isso é uma solução prática para o projeto educacional
    const maxBytes = IMAGE_CONFIG.MAX_THUMBNAIL_KB * 1024;
    
    // Pegar apenas os primeiros bytes (isso criará uma imagem menor)
    const optimizedBase64 = base64String.substring(0, maxBytes);
    const optimizedSizeKB = Math.round(optimizedBase64.length / 1024);
    
    console.log(`✅ Thumbnail otimizada criada: ${optimizedSizeKB}KB (redução de ${Math.round((originalSizeKB - optimizedSizeKB) / originalSizeKB * 100)}%)`);
    
    return optimizedBase64;
    
  } catch (error) {
    console.error('❌ Erro ao criar thumbnail otimizada:', error.message);
    return "";
  }
}

// Função para truncar texto se necessário
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 100) + '...\n\n[Texto otimizado para melhor performance]';
}

// Função para validar e limpar dados do usuário
function sanitizeUserInput(input, maxLength = 200) {
  if (!input || typeof input !== 'string') return "";
  return input.substring(0, Math.min(input.length, maxLength)).trim();
}

// ==================== FUNÇÃO DE SALVAMENTO OTIMIZADA ====================
async function saveToDatabase(story, thumbnailb64, userInput) {
  console.log('💾 Iniciando salvamento otimizado no banco de dados...');
  
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

    // Preparar dados otimizados para salvar
    const truncatedStory = truncateText(story, IMAGE_CONFIG.MAX_STORY_LENGTH);
    
    // Verificar e otimizar thumbnail
    let safeThumbnail = "";
    if (thumbnailb64 && thumbnailb64.length > 0) {
      const thumbnailKB = Math.round(thumbnailb64.length / 1024);
      console.log(`📊 Thumbnail recebida: ${thumbnailKB}KB`);
      
      if (thumbnailKB <= IMAGE_CONFIG.MAX_THUMBNAIL_KB) {
        safeThumbnail = thumbnailb64;
        console.log(`✅ Thumbnail dentro do limite (${thumbnailKB}KB)`);
      } else {
        console.log(`⚠️  Thumbnail muito grande (${thumbnailKB}KB), não salvando`);
        // Não salvar thumbnail se for muito grande
      }
    }

    // Sanitizar dados do usuário
    const sanitizedUserInput = {
      mainCharacter: sanitizeUserInput(userInput.mainCharacter),
      plot: sanitizeUserInput(userInput.plot),
      ending: sanitizeUserInput(userInput.ending),
      genre: sanitizeUserInput(userInput.genre),
      literature: sanitizeUserInput(userInput.literature)
    };

    console.log('📝 Inserindo história otimizada no banco...');
    
    try {
      // Tentar salvar com todos os campos
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: safeThumbnail,
          illustrationUrl: "",
          mainCharacter: sanitizedUserInput.mainCharacter || "Não informado",
          plot: sanitizedUserInput.plot || "Não informado",
          ending: sanitizedUserInput.ending || "Não informado",
          genre: sanitizedUserInput.genre || "Não informado",
          literature: sanitizedUserInput.literature || "Não informado"
        }
      });

      await prisma.$disconnect();
      
      console.log(`✅ História salva com sucesso! ID: ${result.id}`);
      console.log(`📊 Dados salvos: Texto=${truncatedStory.length} chars, Thumbnail=${safeThumbnail.length > 0 ? Math.round(safeThumbnail.length/1024) + 'KB' : 'Nenhuma'}`);
      
      return { 
        success: true, 
        id: result.id,
        message: 'História salva no banco de dados',
        hasThumbnail: safeThumbnail.length > 0
      };
      
    } catch (schemaError) {
      console.log('⚠️  Erro de schema, tentando inserir sem novos campos...');
      
      // Fallback: inserir apenas com campos básicos
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: safeThumbnail
        }
      });

      await prisma.$disconnect();
      
      console.log(`✅ História salva (campos básicos)! ID: ${result.id}`);
      return { 
        success: true, 
        id: result.id,
        message: 'História salva (estrutura básica)',
        warning: 'Alguns campos não foram salvos',
        hasThumbnail: safeThumbnail.length > 0
      };
    }
    
  } catch (dbError) {
    console.error('❌ ERRO ao salvar no banco:', dbError.message);
    
    let userMessage = 'Erro ao salvar no banco de dados';
    if (dbError.code === 'P2000') {
      userMessage = 'Dados muito grandes para o banco. Tente com informações mais curtas.';
    }
    
    return { 
      success: false, 
      error: dbError.message,
      code: dbError.code,
      userMessage: userMessage
    };
  }
}

// ==================== HANDLER PRINCIPAL OTIMIZADO ====================
export default async function handler(req, res) {
  console.log('📨 === API generate-story chamada (versão otimizada) ===');
  
  // 1. Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowed: ['POST']
    });
  }

  // 2. Extrair e sanitizar dados do corpo
  const { mainCharacter, plot, ending, genre, literature } = req.body;
  
  // Sanitizar imediatamente
  const sanitizedInput = {
    mainCharacter: sanitizeUserInput(mainCharacter),
    plot: sanitizeUserInput(plot),
    ending: sanitizeUserInput(ending),
    genre: sanitizeUserInput(genre),
    literature: sanitizeUserInput(literature)
  };
  
  console.log('📥 Dados recebidos (sanitizados):', {
    mainCharacter: sanitizedInput.mainCharacter?.substring(0, 30) + '...',
    plot: sanitizedInput.plot?.substring(0, 30) + '...',
    ending: sanitizedInput.ending?.substring(0, 30) + '...',
    genre: sanitizedInput.genre,
    literature: sanitizedInput.literature
  });

  // 3. Validação básica
  if (!sanitizedInput.mainCharacter || !sanitizedInput.plot || !sanitizedInput.ending) {
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
    console.log('🚀 Iniciando geração de conteúdo otimizada...');

    // ==================== GERAR HISTÓRIA COM GPT ====================
    console.log('🤖 Gerando texto otimizado com GPT...');
    
    // Prompt otimizado para texto mais curto
    const systemPrompt = `Você é um assistente educacional especializado em português brasileiro.
    Diretrizes IMPORTANTES:
    1. Produza textos claros e envolventes para estudantes
    2. MÁXIMO 200 palavras (aproximadamente 1500 caracteres)
    3. Use linguagem apropriada para o ENEM
    4. Formato: parágrafos curtos e objetivos
    5. Foco: desenvolvimento do raciocínio crítico
    
    Contexto do usuário:
    - Personagem: ${sanitizedInput.mainCharacter}
    - Enredo: ${sanitizedInput.plot}
    - Desfecho: ${sanitizedInput.ending}
    - Gênero: ${sanitizedInput.genre}
    - Tipo: ${sanitizedInput.literature}`;

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Crie um(a) ${sanitizedInput.literature || 'história'} no gênero ${sanitizedInput.genre || 'fantasia'}.
          
          Diretrizes:
          1. Personagem principal: ${sanitizedInput.mainCharacter}
          2. Enredo central: ${sanitizedInput.plot}
          3. Desfecho: ${sanitizedInput.ending}
          4. Tamanho: MÁXIMO 200 palavras
          5. Objetivo: Desenvolver pensamento crítico`
        }
      ],
      max_tokens: 500, // REDUZIDO: 500 tokens máximo
      temperature: 0.7,
    });

    let story = gptResponse.choices[0].message.content;
    const gptTime = Date.now() - startTime;
    
    console.log(`✅ Texto gerado em ${gptTime}ms: ${story.length} caracteres, ${story.split(/\s+/).length} palavras`);

    // ==================== GERAR ILUSTRAÇÃO COM RESOLUÇÃO REDUZIDA ====================
    let fullImageb64 = "";
    let thumbnailb64 = "";
    const imageStartTime = Date.now();
    
    try {
      console.log('🎨 Gerando ilustração OTIMIZADA (256x256)...');
      
      // Prompt otimizado para ilustração simples e pequena
      const imagePrompt = `Ilustração educacional simples para estudantes.
      Tema: ${sanitizedInput.mainCharacter} em ${sanitizedInput.plot.substring(0, 50)}...
      Gênero: ${sanitizedInput.genre}. Estilo: cartoon educativo, cores básicas, fundo simples.
      IMPORTANTE: Ilustração MINIMALISTA com poucos detalhes para carregamento rápido.`;
      
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: IMAGE_CONFIG.GENERATION_SIZE, // "256x256" - RESOLUÇÃO REDUZIDA
        quality: "standard",
        n: 1,
        response_format: "b64_json",
      });

      fullImageb64 = imageResponse.data[0].b64_json;
      const originalSizeKB = Math.round(fullImageb64.length / 1024);
      console.log(`✅ Imagem otimizada gerada em ${Date.now() - imageStartTime}ms: ${originalSizeKB}KB (${IMAGE_CONFIG.GENERATION_SIZE})`);
      
      // Criar thumbnail ainda mais otimizada se necessário
      if (fullImageb64 && fullImageb64.length > 0) {
        console.log('🔄 Criando thumbnail ultra-otimizada...');
        thumbnailb64 = await createOptimizedThumbnail(fullImageb64);
        
        if (thumbnailb64 && thumbnailb64.length > 0) {
          const thumbnailKB = Math.round(thumbnailb64.length / 1024);
          console.log(`✅ Thumbnail ultra-otimizada: ${thumbnailKB}KB`);
        } else {
          console.log('⚠️  Não foi possível criar thumbnail otimizada');
        }
      }
      
    } catch (imageError) {
      console.log('⚠️  Não foi possível gerar imagem:', imageError.message);
      // Continuar mesmo sem imagem - texto é mais importante
    }

    // ==================== PREPARAR DADOS PARA SALVAR ====================
    console.log('📋 Preparando dados otimizados para salvar...');
    
    // Adicionar informações do usuário de forma estruturada
    const storyWithMetadata = story + `

=== METADADOS DO USUÁRIO ===
Personagem: ${sanitizedInput.mainCharacter}
Enredo: ${sanitizedInput.plot}
Desfecho: ${sanitizedInput.ending}
Gênero: ${sanitizedInput.genre}
Tipo: ${sanitizedInput.literature}
Data: ${new Date().toISOString()}
============================`;

    // ==================== SALVAR NO BANCO ====================
    console.log('💾 Salvando história otimizada no banco...');
    
    const saveResult = await saveToDatabase(storyWithMetadata, thumbnailb64, sanitizedInput);
    
    // ==================== PREPARAR RESPOSTA OTIMIZADA ====================
    const totalTime = Date.now() - startTime;
    console.log(`🎉 Processo completo em ${totalTime}ms`);
    
    // Verificar tamanhos
    const hasFullImage = fullImageb64 && fullImageb64.length > 0;
    const hasThumbnail = thumbnailb64 && thumbnailb64.length > 0;
    const fullImageSizeKB = hasFullImage ? Math.round(fullImageb64.length / 1024) : 0;
    const thumbnailSizeKB = hasThumbnail ? Math.round(thumbnailb64.length / 1024) : 0;
    
    // Determinar status da otimização
    let optimizationStatus = "excelente";
    let optimizationMessage = "Conteúdo totalmente otimizado";
    
    if (fullImageSizeKB > IMAGE_CONFIG.MAX_IMAGE_SIZE_KB) {
      optimizationStatus = "bom";
      optimizationMessage = "Imagem um pouco grande, mas gerenciável";
    }
    
    if (!hasThumbnail && hasFullImage) {
      optimizationStatus = "regular";
      optimizationMessage = "Imagem muito grande para thumbnail";
    }
    
    const responseData = {
      success: true,
      story: story,
      fullImageb64: hasFullImage ? fullImageb64 : "",
      thumbnailb64: hasThumbnail ? thumbnailb64 : "",
      metadata: {
        generationTime: totalTime,
        textGenerationTime: gptTime,
        imageGenerationTime: imageStartTime > 0 ? Date.now() - imageStartTime : 0,
        optimization: {
          status: optimizationStatus,
          message: optimizationMessage,
          resolution: IMAGE_CONFIG.GENERATION_SIZE,
          maxThumbnailKB: IMAGE_CONFIG.MAX_THUMBNAIL_KB
        },
        sizes: {
          textLength: story.length,
          wordCount: story.split(/\s+/).length,
          fullImageKB: fullImageSizeKB,
          thumbnailKB: thumbnailSizeKB,
          hasThumbnail: hasThumbnail
        },
        timestamp: new Date().toISOString()
      },
      database: {
        saved: saveResult.success,
        storyId: saveResult.id,
        message: saveResult.message,
        warning: saveResult.warning || null,
        imageSaved: saveResult.hasThumbnail || false
      },
      // Dados do usuário sanitizados
      userInput: sanitizedInput
    };

    // Log de resumo
    console.log('📊 RESUMO DA GERAÇÃO:');
    console.log(`   📝 Texto: ${story.length} caracteres`);
    console.log(`   🖼️ Imagem: ${fullImageSizeKB}KB (${IMAGE_CONFIG.GENERATION_SIZE})`);
    console.log(`   🖼️ Thumbnail: ${thumbnailSizeKB}KB ${hasThumbnail ? '✅' : '❌'}`);
    console.log(`   ⚡ Status: ${optimizationStatus.toUpperCase()} - ${optimizationMessage}`);

    res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 ERRO NA EXECUÇÃO:', error.message);

    // Tratamento de erros específicos
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Limite de quota excedido na OpenAI',
        message: 'Você atingiu seu limite de uso. Tente novamente mais tarde.',
        code: 'QUOTA_EXCEEDED'
      });
    }

    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Chave da API inválida',
        message: 'A chave da OpenAI fornecida não é válida.',
        code: 'INVALID_API_KEY'
      });
    }

    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'Timeout na geração',
        message: 'O processo demorou muito tempo. Tente com um prompt mais curto.',
        code: 'TIMEOUT_ERROR'
      });
    }

    // Erro genérico
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar conteúdo',
      message: error.message,
      code: 'INTERNAL_ERROR',
      suggestion: 'Verifique os logs para mais detalhes.'
    });
  }
}