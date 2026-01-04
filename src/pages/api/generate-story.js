// pages/api/generate-story.js - VERSÃO COM COMPRESSÃO JIMP
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== CONFIGURAÇÕES ====================
const CONFIG = {
  // Tamanhos otimizados
  IMAGE_SIZE: "512x512",           // Tamanho do DALL-E
  TARGET_WIDTH: 320,               // Largura final
  TARGET_HEIGHT: 240,              // Altura final
  QUALITY: 60,                     // Qualidade JPEG (1-100)
  MAX_IMAGE_KB: 80,                // Máximo 80KB no banco
  
  // Texto
  MAX_STORY_LENGTH: 10000,
  
  // DALL-E
  USE_DALLE: true                  // Pode desativar para testes
};

// ==================== FUNÇÃO DE COMPRESSÃO COM JIMP ====================
async function compressImageWithJimp(base64String) {
  try {
    console.log('🖼️ Iniciando compressão com JIMP...');
    
    if (!base64String || base64String.length < 100) {
      console.log('❌ String base64 muito curta ou vazia');
      return "";
    }
    
    const originalSizeKB = Math.round(base64String.length / 1024);
    console.log(`📊 Tamanho original: ${originalSizeKB}KB`);
    
    // Importar JIMP
    const Jimp = (await import('jimp')).default;
    
    // Converter base64 para buffer
    const buffer = Buffer.from(base64String, 'base64');
    
    // Carregar imagem com JIMP
    const image = await Jimp.read(buffer);
    
    // Obter dimensões originais
    const { width: originalWidth, height: originalHeight } = image.bitmap;
    console.log(`📏 Dimensões originais: ${originalWidth}x${originalHeight}`);
    
    // Redimensionar mantendo aspect ratio
    image.resize(CONFIG.TARGET_WIDTH, CONFIG.TARGET_HEIGHT, Jimp.RESIZE_BEZIER);
    
    // Ajustar qualidade (compressão JPEG)
    image.quality(CONFIG.QUALITY);
    
    // Se ainda for PNG, converter para JPEG (menor)
    if (image.getMIME() === 'image/png') {
      console.log('🔄 Convertendo PNG para JPEG (menor tamanho)');
    }
    
    // Converter para buffer
    const compressedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    
    // Converter para base64
    const compressedBase64 = compressedBuffer.toString('base64');
    const compressedSizeKB = Math.round(compressedBase64.length / 1024);
    
    // Verificar se está dentro do limite
    if (compressedSizeKB > CONFIG.MAX_IMAGE_KB) {
      console.log(`⚠️  Ainda muito grande (${compressedSizeKB}KB), reduzindo qualidade...`);
      
      // Reduzir mais a qualidade
      image.quality(CONFIG.QUALITY * 0.7);
      const moreCompressedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
      const moreCompressedBase64 = moreCompressedBuffer.toString('base64');
      const finalSizeKB = Math.round(moreCompressedBase64.length / 1024);
      
      console.log(`✅ Compressão final: ${finalSizeKB}KB (redução de ${Math.round((originalSizeKB - finalSizeKB) / originalSizeKB * 100)}%)`);
      return moreCompressedBase64;
    }
    
    console.log(`✅ Compressão concluída: ${compressedSizeKB}KB (redução de ${Math.round((originalSizeKB - compressedSizeKB) / originalSizeKB * 100)}%)`);
    console.log(`📏 Dimensões finais: ${image.bitmap.width}x${image.bitmap.height}`);
    
    return compressedBase64;
    
  } catch (error) {
    console.error('❌ Erro na compressão JIMP:', error.message);
    
    // Fallback: criar imagem placeholder mínima
    console.log('🔄 Usando fallback: imagem placeholder mínima');
    return createMinimalPlaceholder();
  }
}

// Fallback: criar imagem mínima
function createMinimalPlaceholder() {
  // SVG minúsculo em base64 (menos de 1KB)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect width="100" height="100" fill="#f0f0f0"/>
    <text x="50" y="55" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">IMG</text>
  </svg>`;
  
  const base64 = Buffer.from(svg).toString('base64');
  console.log(`📊 Placeholder criado: ${Math.round(base64.length / 1024)}KB`);
  return base64;
}

// Funções auxiliares
function sanitizeText(text, maxLength = 200) {
  if (!text) return "";
  return text.substring(0, Math.min(text.length, maxLength)).trim();
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 100) + '... [texto truncado]';
}

// ==================== FUNÇÃO DE SALVAMENTO ====================
async function saveToDatabase(story, compressedImage, userInput) {
  console.log('💾 Salvando no NeonDB...');
  
  if (!process.env.DATABASE_URL) {
    return { success: false, error: 'DATABASE_URL não configurada' };
  }

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conectado ao NeonDB');

    // Preparar dados
    const truncatedStory = truncateText(story, CONFIG.MAX_STORY_LENGTH);
    const safeImage = compressedImage || createMinimalPlaceholder();
    
    // Verificar tamanho final
    const finalImageKB = Math.round(safeImage.length / 1024);
    console.log(`📊 Imagem para salvar: ${finalImageKB}KB`);
    
    if (finalImageKB > CONFIG.MAX_IMAGE_KB * 1.5) {
      console.log(`⚠️  AVISO: Imagem grande (${finalImageKB}KB) mas tentando salvar...`);
    }

    try {
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: safeImage,
          illustrationUrl: "",
          mainCharacter: sanitizeText(userInput.mainCharacter) || "Não informado",
          plot: sanitizeText(userInput.plot) || "Não informado",
          ending: sanitizeText(userInput.ending) || "Não informado",
          genre: sanitizeText(userInput.genre) || "Não informado",
          literature: sanitizeText(userInput.literature) || "Não informado"
        }
      });

      await prisma.$disconnect();
      
      console.log(`✅ SALVO! ID: ${result.id}, Imagem: ${finalImageKB}KB`);
      return { 
        success: true, 
        id: result.id,
        imageSizeKB: finalImageKB
      };
      
    } catch (schemaError) {
      console.log('⚠️  Schema antigo, salvando sem novos campos...');
      
      const result = await prisma.story.create({
        data: {
          text: truncatedStory,
          illustrationb64: safeImage
        }
      });

      await prisma.$disconnect();
      
      console.log(`✅ Salvo (básico): ID: ${result.id}`);
      return { 
        success: true, 
        id: result.id,
        warning: 'Campos limitados',
        imageSizeKB: finalImageKB
      };
    }
    
  } catch (dbError) {
    console.error('❌ ERRO no NeonDB:', dbError.message);
    return { success: false, error: dbError.message };
  }
}

// ==================== HANDLER PRINCIPAL ====================
export default async function handler(req, res) {
  console.log('🚀 Iniciando geração com compressão...');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { mainCharacter, plot, ending, genre, literature } = req.body;
  
  if (!mainCharacter || !plot || !ending) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY não configurada' });
  }

  try {
    const startTime = Date.now();

    // ==================== GERAR TEXTO ====================
    console.log('🤖 Gerando texto...');
    
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um assistente educacional. Escreva textos de 150-200 palavras."
        },
        {
          role: "user",
          content: `Crie ${literature || 'história'} no gênero ${genre || 'fantasia'}.
          Personagem: ${mainCharacter}
          Enredo: ${plot}
          Desfecho: ${ending}
          Máximo 200 palavras.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const story = gptResponse.choices[0].message.content;
    console.log(`✅ Texto: ${story.length} chars`);

    // ==================== GERAR E COMPRIMIR IMAGEM ====================
    let originalImageb64 = "";
    let compressedImageb64 = "";
    let compressionStats = null;
    
    if (CONFIG.USE_DALLE) {
      try {
        console.log('🎨 Gerando imagem com DALL-E...');
        
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Ilustração simples para: ${story.substring(0, 100)}... Estilo cartoon educativo.`,
          size: CONFIG.IMAGE_SIZE,
          quality: "standard",
          n: 1,
          response_format: "b64_json",
        });

        originalImageb64 = imageResponse.data[0].b64_json;
        const originalSizeKB = Math.round(originalImageb64.length / 1024);
        console.log(`✅ Imagem gerada: ${originalSizeKB}KB`);
        
        // COMPRIMIR A IMAGEM
        console.log('⚡ Comprimindo imagem para caber no banco...');
        compressedImageb64 = await compressImageWithJimp(originalImageb64);
        
        if (compressedImageb64 && compressedImageb64.length > 0) {
          const compressedSizeKB = Math.round(compressedImageb64.length / 1024);
          compressionStats = {
            original: originalSizeKB,
            compressed: compressedSizeKB,
            reduction: Math.round((originalSizeKB - compressedSizeKB) / originalSizeKB * 100)
          };
          console.log(`📊 Estatísticas: ${originalSizeKB}KB → ${compressedSizeKB}KB (${compressionStats.reduction}% menor)`);
        }
        
      } catch (imageError) {
        console.log('⚠️  Erro na imagem:', imageError.message);
        // Cria placeholder se não conseguir
        compressedImageb64 = createMinimalPlaceholder();
      }
    } else {
      // Modo sem DALL-E (para testes)
      console.log('🔄 Modo sem DALL-E, usando placeholder');
      compressedImageb64 = createMinimalPlaceholder();
    }

    // ==================== SALVAR NO BANCO ====================
    const storyWithMetadata = story + `

=== DADOS DO USUÁRIO ===
Personagem: ${mainCharacter}
Enredo: ${plot}
Desfecho: ${ending}
Gênero: ${genre}
Tipo: ${literature}
=======================`;

    console.log('💾 Salvando no NeonDB...');
    const saveResult = await saveToDatabase(storyWithMetadata, compressedImageb64, {
      mainCharacter, plot, ending, genre, literature
    });
    
    // ==================== RESPOSTA ====================
    const totalTime = Date.now() - startTime;
    
    const responseData = {
      success: true,
      story: story,
      // Retorna imagem original para visualização imediata
      fullImageb64: originalImageb64 || "",
      // E a versão comprimida que foi salva
      compressedImageb64: compressedImageb64 || "",
      metadata: {
        totalTime,
        hasImage: !!originalImageb64,
        compression: compressionStats,
        imageSaved: saveResult.imageSizeKB ? `${saveResult.imageSizeKB}KB` : 'N/A',
        dimensions: `${CONFIG.TARGET_WIDTH}x${CONFIG.TARGET_HEIGHT}`,
        quality: `${CONFIG.QUALITY}%`
      },
      database: {
        saved: saveResult.success,
        storyId: saveResult.id,
        imageSizeInDb: saveResult.imageSizeKB,
        message: saveResult.warning || 'História salva com sucesso'
      },
      userInput: { mainCharacter, plot, ending, genre, literature }
    };

    console.log(`🎉 Concluído em ${totalTime}ms`);
    console.log(`📊 Imagem no banco: ${saveResult.imageSizeKB || 0}KB`);
    
    res.status(200).json(responseData);

  } catch (error) {
    console.error('💥 ERRO:', error.message);
    
    if (error.code === 'insufficient_quota') {
      return res.status(429).json({ error: 'Limite excedido' });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}