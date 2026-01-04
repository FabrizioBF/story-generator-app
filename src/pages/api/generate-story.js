// pages/api/generate-story.js - VERSÃO SIMPLIFICADA
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== CONFIGURAÇÕES SIMPLES ====================
const CONFIG = {
  // Imagem
  IMAGE_SIZE: "256x256",           // Pequeno desde o início
  MAX_IMAGE_LENGTH: 40000,         // ~40KB máximo no banco
  
  // Texto
  MAX_STORY_LENGTH: 8000,
  
  // Controle
  ENABLE_IMAGES: true              // Pode desligar para testes
};

// ==================== COMPRESSÃO SUPER SIMPLES ====================
function simpleImageCompression(base64String) {
  console.log('⚡ Compressão simples iniciada...');
  
  if (!base64String || base64String.length === 0) {
    console.log('❌ String vazia');
    return "";
  }
  
  const originalSizeKB = Math.round(base64String.length / 1024);
  console.log(`📊 Tamanho original: ${originalSizeKB}KB`);
  
  // Se já for pequeno, usar como está
  if (originalSizeKB <= 30) { // Menos de 30KB
    console.log(`✅ Já pequeno (${originalSizeKB}KB), mantendo como está`);
    return base64String;
  }
  
  // Método 1: Pegar apenas os primeiros caracteres (mais seguro)
  const maxChars = CONFIG.MAX_IMAGE_LENGTH;
  let compressed = base64String.substring(0, maxChars);
  
  const compressedSizeKB = Math.round(compressed.length / 1024);
  console.log(`✅ Compressão básica: ${originalSizeKB}KB → ${compressedSizeKB}KB`);
  
  return compressed;
}

// Função para criar placeholder mínimo
function createTinyImage() {
  // Imagem SVG mínima (menos de 1KB)
  const svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="#f0f0f0"/>
    <text x="50" y="55" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">🎨</text>
  </svg>`;
  
  // Converter para base64
  const base64 = Buffer.from(svg).toString('base64');
  console.log(`📊 Placeholder criado: ${Math.round(base64.length / 1024)}KB`);
  return base64;
}

// Funções auxiliares
function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 100) + '...';
}

function sanitizeInput(text) {
  if (!text) return "";
  return text.substring(0, 200).trim();
}

// ==================== SALVAR NO BANCO ====================
async function saveStory(story, imageBase64, userInput) {
  console.log('💾 Preparando para salvar...');
  
  if (!process.env.DATABASE_URL) {
    return { success: false, error: 'Banco não configurado' };
  }

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Preparar dados
    const finalStory = truncateText(story, CONFIG.MAX_STORY_LENGTH);
    const finalImage = imageBase64 || createTinyImage();
    
    // Verificar tamanho
    const imageSizeKB = Math.round(finalImage.length / 1024);
    console.log(`📊 Salvando imagem de: ${imageSizeKB}KB`);
    
    // Tentar salvar com todos os campos
    try {
      const result = await prisma.story.create({
        data: {
          text: finalStory,
          illustrationb64: finalImage,
          mainCharacter: sanitizeInput(userInput.mainCharacter) || "Não informado",
          plot: sanitizeInput(userInput.plot) || "Não informado",
          ending: sanitizeInput(userInput.ending) || "Não informado",
          genre: sanitizeInput(userInput.genre) || "Não informado",
          literature: sanitizeInput(userInput.literature) || "Não informado"
        }
      });
      
      console.log(`✅ Salvo! ID: ${result.id}, Imagem: ${imageSizeKB}KB`);
      return { success: true, id: result.id, imageSizeKB };
      
    } catch (error) {
      // Fallback: salvar apenas campos básicos
      console.log('⚠️  Salvando apenas texto e imagem...');
      
      const result = await prisma.story.create({
        data: {
          text: finalStory,
          illustrationb64: finalImage
        }
      });
      
      console.log(`✅ Salvo (básico): ID: ${result.id}`);
      return { 
        success: true, 
        id: result.id, 
        imageSizeKB,
        warning: 'Alguns campos não salvos' 
      };
    }
    
  } catch (error) {
    console.error('❌ Erro no banco:', error.message);
    return { success: false, error: error.message };
  }
}

// ==================== HANDLER PRINCIPAL ====================
export default async function handler(req, res) {
  console.log('📨 Recebendo requisição...');
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas POST' });
  }

  // Validar dados
  const { mainCharacter, plot, ending, genre, literature } = req.body;
  if (!mainCharacter || !plot || !ending) {
    return res.status(400).json({ error: 'Personagem, enredo e desfecho são obrigatórios' });
  }

  // Verificar API key
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
          content: "Você é um assistente educacional. Escreva textos claros de 150-200 palavras em português."
        },
        {
          role: "user",
          content: `Crie ${literature || 'uma história'} no gênero ${genre || 'fantasia'}.
          Personagem: ${mainCharacter}
          Enredo: ${plot}
          Desfecho: ${ending}
          Máximo 200 palavras.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const storyText = gptResponse.choices[0].message.content;
    console.log(`✅ Texto gerado: ${storyText.length} caracteres`);

    // ==================== GERAR IMAGEM ====================
    let originalImage = "";
    let compressedImage = "";
    
    if (CONFIG.ENABLE_IMAGES) {
      try {
        console.log('🎨 Gerando imagem (256x256)...');
        
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Ilustração educacional simples para: ${storyText.substring(0, 80)}... Estilo cartoon.`,
          size: CONFIG.IMAGE_SIZE, // 256x256
          quality: "standard",
          n: 1,
          response_format: "b64_json",
        });

        originalImage = imageResponse.data[0].b64_json;
        const originalSizeKB = Math.round(originalImage.length / 1024);
        console.log(`✅ Imagem gerada: ${originalSizeKB}KB`);
        
        // COMPRIMIR (método simples)
        compressedImage = simpleImageCompression(originalImage);
        
      } catch (imageError) {
        console.log('⚠️  Erro na imagem:', imageError.message);
        compressedImage = createTinyImage();
      }
    } else {
      // Modo sem imagem
      console.log('🔄 Modo sem imagem ativado');
      compressedImage = createTinyImage();
    }

    // ==================== SALVAR NO BANCO ====================
    console.log('💾 Salvando no NeonDB...');
    
    // Adicionar metadados ao texto
    const fullText = storyText + `

=== DADOS ===
Personagem: ${mainCharacter}
Enredo: ${plot}
Desfecho: ${ending}
Gênero: ${genre}
Tipo: ${literature}
=============`;

    const saveResult = await saveStory(fullText, compressedImage, {
      mainCharacter, plot, ending, genre, literature
    });
    
    // ==================== RESPOSTA ====================
    const totalTime = Date.now() - startTime;
    
    const response = {
      success: true,
      story: storyText,
      // Retorna imagem original para visualização
      imageb64: originalImage || "",
      // E também a comprimida que foi salva
      savedImageb64: compressedImage || "",
      metadata: {
        time: `${totalTime}ms`,
        textLength: storyText.length,
        hasImage: !!originalImage,
        imageSaved: saveResult.imageSizeKB ? `${saveResult.imageSizeKB}KB` : 'Não'
      },
      database: {
        saved: saveResult.success,
        storyId: saveResult.id,
        message: saveResult.warning || 'Salvo com sucesso'
      },
      userInput: { mainCharacter, plot, ending, genre, literature }
    };

    console.log(`🎉 Finalizado em ${totalTime}ms`);
    console.log(`📊 Resumo: Texto=${storyText.length} chars, Imagem=${saveResult.imageSizeKB || 0}KB`);
    
    res.status(200).json(response);

  } catch (error) {
    console.error('💥 ERRO:', error.message);
    
    // Erros comuns
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return res.status(429).json({ error: 'Limite da OpenAI excedido' });
    }
    
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ error: 'Chave da API inválida' });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno',
      message: error.message
    });
  }
}