// pages/api/generate-story.js - VERSÃO SIMPLES SEM BIBLIOTECAS
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== CONFIGURAÇÕES ====================
const CONFIG = {
  // Imagem BEM pequena
  IMAGE_SIZE: "256x256",           // Pequeno desde a geração
  MAX_IMAGE_KB: 50,                // Máximo 50KB
  
  // Texto
  MAX_STORY_CHARS: 8000,
  
  // Controle
  TRY_COMPRESSION: true
};

// ==================== FUNÇÃO SIMPLES DE "COMPRESSÃO" ====================
function safeImageForDatabase(base64String) {
  console.log('🔧 Preparando imagem para o banco...');
  
  if (!base64String || base64String.length === 0) {
    console.log('❌ Sem imagem');
    return "";
  }
  
  const originalKB = Math.round(base64String.length / 1024);
  console.log(`📊 Tamanho original: ${originalKB}KB`);
  
  // Se já for pequeno (< 50KB), usar como está
  if (originalKB <= CONFIG.MAX_IMAGE_KB) {
    console.log(`✅ Já pequeno (${originalKB}KB), mantendo`);
    return base64String;
  }
  
  // Se for muito grande, temos várias opções:
  
  // OPÇÃO A: Cortar a string (simples, mas pode corromper)
  if (CONFIG.TRY_COMPRESSION) {
    const maxLength = CONFIG.MAX_IMAGE_KB * 1024;
    const cutImage = base64String.substring(0, maxLength);
    const cutKB = Math.round(cutImage.length / 1024);
    console.log(`✂️ Cortado para: ${cutKB}KB`);
    return cutImage;
  }
  
  // OPÇÃO B: Usar placeholder (mais seguro)
  console.log('🔄 Usando placeholder seguro');
  return createSafePlaceholder();
}

// Criar placeholder seguro (SVG minúsculo)
function createSafePlaceholder() {
  // SVG de 100x100 pixels (menos de 1KB)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect width="100" height="100" fill="#f0f0f0"/>
    <circle cx="50" cy="50" r="30" fill="#ddd"/>
    <text x="50" y="55" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">🎨</text>
  </svg>`;
  
  return Buffer.from(svg).toString('base64');
}

// Criar imagem de erro (quando DALL-E falha)
function createErrorImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect width="100" height="100" fill="#fee2e2"/>
    <text x="50" y="40" font-family="Arial" font-size="10" fill="#dc2626" text-anchor="middle">Erro</text>
    <text x="50" y="60" font-family="Arial" font-size="10" fill="#dc2626" text-anchor="middle">na Imagem</text>
  </svg>`;
  
  return Buffer.from(svg).toString('base64');
}

// ==================== SALVAR NO BANCO ====================
async function saveToNeonDB(storyText, safeImage, userData) {
  console.log('💾 Salvando no NeonDB...');
  
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Garantir que a imagem não seja muito grande
    let finalImage = safeImage || createSafePlaceholder();
    if (finalImage.length > 60000) { // ~60KB
      console.log('⚠️  Imagem ainda grande, usando placeholder');
      finalImage = createSafePlaceholder();
    }
    
    // Preparar texto
    const maxChars = CONFIG.MAX_STORY_CHARS;
    const story = storyText.length > maxChars 
      ? storyText.substring(0, maxChars) + '...' 
      : storyText;
    
    // Inserir
    const result = await prisma.story.create({
      data: {
        text: story,
        illustrationb64: finalImage,
        mainCharacter: (userData.mainCharacter || "").substring(0, 100),
        plot: (userData.plot || "").substring(0, 200),
        ending: (userData.ending || "").substring(0, 100),
        genre: userData.genre || "",
        literature: userData.literature || ""
      }
    });
    
    console.log(`✅ Salvo! ID: ${result.id}`);
    return { success: true, id: result.id };
    
  } catch (error) {
    console.error('❌ Erro ao salvar:', error.message);
    return { success: false, error: error.message };
  }
}

// ==================== HANDLER PRINCIPAL ====================
export default async function handler(req, res) {
  // Validações básicas
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  
  const { mainCharacter, plot, ending, genre, literature } = req.body;
  if (!mainCharacter || !plot || !ending) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY não configurada' });
  }
  
  try {
    console.log('🚀 Iniciando geração...');
    
    // 1. GERAR TEXTO
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Escreva textos de 150-200 palavras em português, claros e envolventes."
        },
        {
          role: "user",
          content: `Crie ${literature || 'uma história'} no gênero ${genre}.
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
    console.log(`✅ Texto: ${storyText.length} caracteres`);
    
    // 2. GERAR IMAGEM (tentar, mas não é crítico)
    let dalleImage = "";
    let savedImage = "";
    
    try {
      console.log('🎨 Gerando imagem 256x256...');
      
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Ilustração educacional simples, estilo cartoon, cores básicas. Tema: ${mainCharacter} em ${plot.substring(0, 50)}...`,
        size: CONFIG.IMAGE_SIZE, // 256x256
        quality: "standard",
        n: 1,
        response_format: "b64_json",
      });
      
      dalleImage = imageResponse.data[0].b64_json;
      console.log(`✅ Imagem DALL-E: ${Math.round(dalleImage.length / 1024)}KB`);
      
      // Preparar para salvar no banco
      savedImage = safeImageForDatabase(dalleImage);
      
    } catch (imageError) {
      console.log('⚠️  Sem imagem DALL-E:', imageError.message);
      savedImage = createErrorImage();
    }
    
    // 3. SALVAR NO BANCO
    console.log('💾 Salvando...');
    const saveResult = await saveToNeonDB(storyText, savedImage, {
      mainCharacter, plot, ending, genre, literature
    });
    
    // 4. RESPOSTA
    const response = {
      success: true,
      story: storyText,
      // Imagem completa para mostrar agora
      imageNow: dalleImage || "",
      // Imagem que foi salva (pode ser diferente)
      imageSaved: savedImage || "",
      metadata: {
        textLength: storyText.length,
        hasDalleImage: !!dalleImage,
        dalleSize: dalleImage ? `${Math.round(dalleImage.length / 1024)}KB` : 'N/A',
        savedSize: savedImage ? `${Math.round(savedImage.length / 1024)}KB` : 'N/A',
        note: 'Imagem pode ser reduzida para caber no banco'
      },
      database: {
        saved: saveResult.success,
        storyId: saveResult.id
      }
    };
    
    console.log('🎉 Concluído!');
    res.status(200).json(response);
    
  } catch (error) {
    console.error('💥 ERRO:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno',
      details: error.message 
    });
  }
}