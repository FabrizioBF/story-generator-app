// pages/api/generate-story.js - VERSÃO HÍBRIDA OTIMIZADA
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== CONFIGURAÇÕES DE IMAGEM ====================
const IMAGE_CONFIG = {
  GENERATION_SIZE: "512x512",       // Tamanho gerado pelo DALL-E
  THUMBNAIL_SIZE: 256,             // Tamanho da thumbnail
  MAX_THUMBNAIL_KB: 100,           // Máximo 100KB no banco
  COMPRESSION_QUALITY: 0.6,        // Qualidade JPEG (0.0 a 1.0)
  MAX_STORY_LENGTH: 10000,         // Máximo 10K caracteres no banco
};

// ==================== FUNÇÕES AUXILIARES ====================

// Função para criar thumbnail otimizada
function createThumbnail(base64String) {
  return new Promise((resolve, reject) => {
    if (!base64String || base64String.length === 0) {
      resolve("");
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Configurar tamanho da thumbnail
        const targetSize = IMAGE_CONFIG.THUMBNAIL_SIZE;
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        // Fundo branco para transparências
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetSize, targetSize);
        
        // Calcular dimensões mantendo proporção
        const ratio = Math.min(
          targetSize / img.width,
          targetSize / img.height
        );
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;
        const x = (targetSize - newWidth) / 2;
        const y = (targetSize - newHeight) / 2;
        
        // Desenhar imagem redimensionada
        ctx.drawImage(img, x, y, newWidth, newHeight);
        
        // Converter para JPEG comprimido
        const thumbnail = canvas.toDataURL('image/jpeg', IMAGE_CONFIG.COMPRESSION_QUALITY);
        const base64Thumbnail = thumbnail.split(',')[1];
        
        console.log(`🖼️ Thumbnail criada: ${targetSize}x${targetSize}, ${Math.round(base64Thumbnail.length / 1024)}KB`);
        resolve(base64Thumbnail);
        
      } catch (error) {
        console.error('❌ Erro ao criar thumbnail:', error);
        resolve(""); // Retorna vazio em caso de erro
      }
    };
    
    img.onerror = (error) => {
      console.error('❌ Erro ao carregar imagem:', error);
      resolve("");
    };
    
    // Iniciar carregamento
    img.src = `data:image/png;base64,${base64String}`;
  });
}

// Função para truncar texto se necessário
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 100) + '...\n\n[Texto truncado para otimização]';
}

// ==================== FUNÇÃO DE SALVAMENTO ====================
async function saveToDatabase(story, thumbnailb64, userInput) {
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

    // Preparar dados para salvar
    const truncatedStory = truncateText(story, IMAGE_CONFIG.MAX_STORY_LENGTH);
    const safeThumbnail = thumbnailb64 || "";
    
    // Verificar tamanho da thumbnail
    if (safeThumbnail.length > 0) {
      const thumbnailKB = Math.round(safeThumbnail.length / 1024);
      console.log(`📊 Thumbnail para salvar: ${thumbnailKB}KB`);
      
      if (thumbnailKB > IMAGE_CONFIG.MAX_THUMBNAIL_KB) {
        console.log(`⚠️  Thumbnail muito grande (${thumbnailKB}KB), truncando...`);
        // Truncar se ainda for muito grande
        const maxBytes = IMAGE_CONFIG.MAX_THUMBNAIL_KB * 1024;
        const truncatedThumbnail = safeThumbnail.substring(0, maxBytes);
        console.log(`📊 Thumbnail truncada: ${Math.round(truncatedThumbnail.length / 1024)}KB`);
      }
    }

    console.log('📝 Inserindo história no banco...');
    
    try {
      // Tentar salvar com todos os campos
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: safeThumbnail,
          illustrationUrl: "", // Pode ser preenchido posteriormente se usar CDN
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
      console.log('⚠️  Erro de schema, tentando inserir sem novos campos...', schemaError.message);
      
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
        warning: 'Alguns campos não foram salvos'
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
    
    // Sistema prompt otimizado
    const systemPrompt = `Você é um escritor criativo especializado em português brasileiro.
    Diretrizes IMPORTANTES:
    1. Produza textos claros e envolventes para estudantes
    2. MÁXIMO 300 palavras (aproximadamente 2000 caracteres)
    3. Use linguagem apropriada para o ENEM
    4. Mantenha uma narrativa coesa com início, meio e fim
    5. Formate o texto em parágrafos claros
    
    Informações do usuário:
    - Personagem: ${mainCharacter}
    - Enredo: ${plot}
    - Desfecho: ${ending}
    - Gênero: ${genre}
    - Tipo: ${literature}`;

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Crie um(a) ${literature || 'história'} no gênero ${genre || 'fantasia'}.
          Personagem principal: ${mainCharacter}
          Enredo: ${plot}
          Desfecho: ${ending}
          
          Lembre-se: máximo 300 palavras, linguagem clara e envolvente.`
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    let story = gptResponse.choices[0].message.content;
    const gptTime = Date.now() - startTime;
    
    console.log(`✅ Texto gerado em ${gptTime}ms: ${story.length} caracteres, ${story.split(/\s+/).length} palavras`);

    // ==================== GERAR ILUSTRAÇÃO ====================
    let fullImageb64 = "";
    let thumbnailb64 = "";
    const imageStartTime = Date.now();
    
    try {
      console.log('🎨 Gerando ilustração com DALL-E...');
      
      // Prompt otimizado para ilustração
      const imagePrompt = `Ilustração para uma ${literature || 'história'} de ${genre || 'fantasia'}.
      Personagem: ${mainCharacter}.
      Cena: ${plot.substring(0, 80)}...
      Estilo: Ilustração digital colorida, estilo cartoon educacional, fundo simples.
      IMPORTANTE: Imagem simples e leve, cores básicas, sem muitos detalhes.`;
      
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: IMAGE_CONFIG.GENERATION_SIZE, // "512x512"
        quality: "standard",
        n: 1,
        response_format: "b64_json",
      });

      fullImageb64 = imageResponse.data[0].b64_json;
      const originalSizeKB = Math.round(fullImageb64.length / 1024);
      console.log(`✅ Imagem gerada em ${Date.now() - imageStartTime}ms: ${originalSizeKB}KB (${IMAGE_CONFIG.GENERATION_SIZE})`);
      
      // Criar thumbnail otimizada
      console.log('🖼️ Criando thumbnail...');
      thumbnailb64 = await createThumbnail(fullImageb64);
      
      if (thumbnailb64 && thumbnailb64.length > 0) {
        const thumbnailKB = Math.round(thumbnailb64.length / 1024);
        console.log(`✅ Thumbnail criada: ${thumbnailKB}KB (${IMAGE_CONFIG.THUMBNAIL_SIZE}x${IMAGE_CONFIG.THUMBNAIL_SIZE})`);
      } else {
        console.log('⚠️  Não foi possível criar thumbnail');
      }
      
    } catch (imageError) {
      console.log('⚠️  Não foi possível gerar imagem:', imageError.message);
      // Continuar mesmo sem imagem
    }

    // ==================== SALVAR NO BANCO ====================
    console.log('💾 Salvando história no banco...');
    
    // Adicionar informações do usuário ao final do texto
    const storyWithMetadata = story + `

=== INFORMAÇÕES DO USUÁRIO ===
Personagem Principal: ${mainCharacter}
Enredo: ${plot}
Desfecho: ${ending}
Gênero: ${genre}
Tipo de Literatura: ${literature}
==============================`;

    const saveResult = await saveToDatabase(storyWithMetadata, thumbnailb64, {
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
      story: story, // Texto original sem metadados
      fullImageb64: fullImageb64 || "", // Imagem completa para exibição imediata
      thumbnailb64: thumbnailb64 || "", // Thumbnail salva no banco
      metadata: {
        generationTime: totalTime,
        textGenerationTime: gptTime,
        imageGenerationTime: imageStartTime > 0 ? Date.now() - imageStartTime : 0,
        textLength: story.length,
        wordCount: story.split(/\s+/).length,
        imageSize: fullImageb64 ? Math.round(fullImageb64.length / 1024) + 'KB' : 'N/A',
        thumbnailSize: thumbnailb64 ? Math.round(thumbnailb64.length / 1024) + 'KB' : 'N/A',
        thumbnailDimensions: `${IMAGE_CONFIG.THUMBNAIL_SIZE}x${IMAGE_CONFIG.THUMBNAIL_SIZE}`,
        timestamp: new Date().toISOString()
      },
      database: {
        saved: saveResult.success,
        storyId: saveResult.id,
        message: saveResult.message,
        warning: saveResult.warning || null
      },
      // Dados do usuário para referência
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
    console.error('💥 ERRO NA EXECUÇÃO:', error.message);

    // Tratamento de erros específicos
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Limite de quota excedido na OpenAI',
        message: 'Tente novamente mais tarde ou verifique sua conta OpenAI.'
      });
    }

    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Chave da API inválida',
        message: 'Verifique sua OPENAI_API_KEY nas variáveis de ambiente.'
      });
    }

    // Erro de timeout
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'Timeout na geração',
        message: 'A geração demorou muito tempo. Tente com um prompt mais simples.'
      });
    }

    // Erro genérico
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar conteúdo',
      message: error.message,
      suggestion: 'Verifique os logs do servidor para detalhes.'
    });
  }
}

// ==================== POLYFILL PARA AMBIENTE NODE.JS ====================
// Necessário porque usamos Image() que é do browser

if (typeof window === 'undefined') {
  // Server-side: usar polyfill
  global.Image = class {
    constructor() {
      this._src = '';
      this.onload = null;
      this.onerror = null;
      this.width = 0;
      this.height = 0;
    }
    
    set src(value) {
      this._src = value;
      // Simular carregamento assíncrono
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
    
    get src() {
      return this._src;
    }
  };
  
  // Polyfill para document.createElement
  if (typeof global.document === 'undefined') {
    global.document = {
      createElement: (tagName) => {
        if (tagName === 'canvas') {
          return {
            getContext: () => ({
              fillStyle: '',
              fillRect: () => {},
              drawImage: () => {},
            }),
            width: 0,
            height: 0,
            toDataURL: () => 'data:image/jpeg;base64,'
          };
        }
        return {};
      }
    };
  }
}