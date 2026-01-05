// pages/api/generate-story.js - VERSÃO COM VERCEL BLOB STORAGE
import OpenAI from "openai";
import { put } from '@vercel/blob';

// Inicializar cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== CONFIGURAÇÕES ====================
const CONFIG = {
  IMAGE_SIZE: "256x256",           // Tamanho da imagem DALL-E
  MAX_STORY_CHARS: 8000,          // Limite de caracteres para o texto
  MAX_RETRIES: 2,                 // Tentativas para gerar imagem
  RETRY_DELAY: 1000,              // Delay entre tentativas (ms)
};

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Upload de imagem para Vercel Blob Storage
 */
async function uploadToVercelBlob(imageData, storyId, retryCount = 0) {
  console.log('☁️  Enviando imagem para Vercel Blob...');
  
  try {
    const fileName = `story-${storyId}-${Date.now()}.png`;
    const fileBuffer = Buffer.from(imageData, 'base64');
    
    // Configurações do upload
    const blob = await put(fileName, fileBuffer, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: true, // Adiciona sufixo aleatório para evitar colisões
      metadata: {
        storyId: storyId.toString(),
        uploadedAt: new Date().toISOString(),
        source: 'dall-e-3',
        service: 'story-generator-app'
      }
    });
    
    console.log(`✅ Imagem enviada para Vercel Blob: ${blob.url}`);
    console.log(`   ↳ Tamanho: ${Math.round(fileBuffer.length / 1024)}KB`);
    console.log(`   ↳ Pathname: ${blob.pathname}`);
    
    return {
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      sizeKB: Math.round(fileBuffer.length / 1024)
    };
    
  } catch (error) {
    console.error(`❌ Erro no upload para Vercel Blob (tentativa ${retryCount + 1}):`, error.message);
    
    // Tentar novamente se ainda houver tentativas
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`🔄 Tentando novamente em ${CONFIG.RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return uploadToVercelBlob(imageData, storyId, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      url: null
    };
  }
}

/**
 * Gerar imagem com DALL-E com retry logic
 */
async function generateDalleImage(prompt, retryCount = 0) {
  try {
    console.log(`🎨 Gerando imagem DALL-E (tentativa ${retryCount + 1})...`);
    
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: CONFIG.IMAGE_SIZE,
      quality: "standard",
      n: 1,
      response_format: "b64_json",
      style: "natural",
    });
    
    const imageData = imageResponse.data[0].b64_json;
    console.log(`✅ Imagem DALL-E gerada: ${Math.round(imageData.length / 1024)}KB`);
    
    return {
      success: true,
      data: imageData,
      sizeKB: Math.round(imageData.length / 1024)
    };
    
  } catch (error) {
    console.error(`❌ Erro DALL-E (tentativa ${retryCount + 1}):`, error.message);
    
    // Verificar se é um erro de conteúdo e ajustar prompt
    if (error.message.includes('content_policy') && retryCount < CONFIG.MAX_RETRIES) {
      console.log('⚠️  Violação de política de conteúdo, ajustando prompt...');
      const saferPrompt = `Ilustração educacional familiar, estilo cartoon suave, cores pasteis. 
                          Tema apropriado para educação: ${prompt.substring(0, 100)}...`;
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return generateDalleImage(saferPrompt, retryCount + 1);
    }
    
    // Tentar novamente para outros erros
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`🔄 Tentando novamente em ${CONFIG.RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return generateDalleImage(prompt, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Salvar história no Neon DB
 */
async function saveToNeonDB(storyText, imageUrl, userData, initialSave = false) {
  console.log('💾 Salvando no NeonDB...');
  
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Preparar texto (truncar se necessário)
    const maxChars = CONFIG.MAX_STORY_CHARS;
    const finalStory = storyText.length > maxChars 
      ? storyText.substring(0, maxChars) + '... [continua]' 
      : storyText;
    
    const data = {
      text: finalStory,
      mainCharacter: (userData.mainCharacter || "").substring(0, 100),
      plot: (userData.plot || "").substring(0, 200),
      ending: (userData.ending || "").substring(0, 100),
      genre: userData.genre || "",
      literature: userData.literature || ""
    };
    
    let result;
    
    if (initialSave) {
      // Primeiro save (sem imagem ainda)
      result = await prisma.story.create({
        data: data
      });
      console.log(`📝 História salva inicialmente - ID: ${result.id}`);
    } else {
      // Update com URL da imagem
      data.illustrationPath = imageUrl;
      result = await prisma.story.update({
        where: { id: userData.storyId },
        data: data
      });
      console.log(`🖼️  História atualizada com imagem - ID: ${result.id}`);
    }
    
    await prisma.$disconnect();
    
    return {
      success: true,
      id: result.id,
      storyId: result.id,
      imageUrl: imageUrl
    };
    
  } catch (error) {
    console.error('❌ Erro ao salvar no NeonDB:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gerar texto com GPT
 */
async function generateStoryText(userData) {
  console.log('📝 Gerando texto da história...');
  
  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um escritor especializado em criar histórias educacionais para estudantes.
                    Escreva textos claros, envolventes e apropriados para o público estudantil.
                    Use linguagem acessível mas rica em vocabulário.
                    Tamanho: 150-200 palavras.
                    Idioma: Português do Brasil.`
        },
        {
          role: "user",
          content: `Crie ${userData.literature || 'uma história'} no gênero ${userData.genre}.
                    Personagem Principal: ${userData.mainCharacter}
                    Enredo: ${userData.plot}
                    Desfecho: ${userData.ending}
                    
                    Por favor, inclua:
                    1. Introdução do personagem e contexto
                    2. Desenvolvimento do enredo
                    3. Clímax da história
                    4. Desfecho conforme solicitado
                    5. Uma moral ou aprendizado (opcional)`
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
      presence_penalty: 0.3,
      frequency_penalty: 0.2,
    });
    
    const storyText = gptResponse.choices[0].message.content;
    const wordCount = storyText.split(/\s+/).length;
    
    console.log(`✅ Texto gerado: ${wordCount} palavras, ${storyText.length} caracteres`);
    
    return {
      success: true,
      text: storyText,
      wordCount: wordCount,
      charCount: storyText.length
    };
    
  } catch (error) {
    console.error('❌ Erro ao gerar texto:', error.message);
    return {
      success: false,
      error: error.message,
      text: null
    };
  }
}

// ==================== HANDLER PRINCIPAL ====================
export default async function handler(req, res) {
  // Configurar CORS para desenvolvimento
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Lidar com preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Validações básicas
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido. Use POST.' 
    });
  }
  
  // Validar corpo da requisição
  let body;
  try {
    body = req.body;
    
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ 
        success: false,
        error: 'Corpo da requisição inválido.' 
      });
    }
    
  } catch (parseError) {
    return res.status(400).json({ 
      success: false,
      error: 'Erro ao analisar JSON: ' + parseError.message 
    });
  }
  
  const { mainCharacter, plot, ending, genre, literature } = body;
  
  // Validar campos obrigatórios
  if (!mainCharacter || !plot || !ending) {
    return res.status(400).json({ 
      success: false,
      error: 'Campos obrigatórios faltando. Preencha: Personagem, Enredo e Desfecho.',
      required: ['mainCharacter', 'plot', 'ending']
    });
  }
  
  // Validar OpenAI API Key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY não configurada');
    return res.status(500).json({ 
      success: false,
      error: 'Configuração do servidor incompleta.' 
    });
  }
  
  console.log('🚀 Iniciando geração de história...');
  console.log(`📋 Dados recebidos:`, {
    personagem: mainCharacter.substring(0, 50),
    enredo: plot.substring(0, 50),
    desfecho: ending.substring(0, 50),
    genero: genre,
    tipo: literature
  });
  
  try {
    // 1. GERAR TEXTO DA HISTÓRIA
    const textResult = await generateStoryText({
      mainCharacter, plot, ending, genre, literature
    });
    
    if (!textResult.success) {
      throw new Error(`Falha ao gerar texto: ${textResult.error}`);
    }
    
    // 2. SALVAR TEXTO NO BANCO (SEM IMAGEM AINDA)
    const initialSave = await saveToNeonDB(
      textResult.text, 
      null, 
      { mainCharacter, plot, ending, genre, literature },
      true
    );
    
    if (!initialSave.success) {
      throw new Error(`Falha ao salvar texto: ${initialSave.error}`);
    }
    
    const storyId = initialSave.id;
    console.log(`📦 História salva com ID: ${storyId}`);
    
    // 3. GERAR IMAGEM COM DALL-E
    let imageResult = { success: false, data: null };
    let blobResult = { success: false, url: null };
    
    // Criar prompt para a imagem
    const imagePrompt = `Ilustração educacional, estilo cartoon limpo, cores vibrantes mas suaves, 
                         apropriada para ambiente educacional. Mostre: ${mainCharacter} em uma cena 
                         relacionada a ${plot.substring(0, 60)}... 
                         Estilo: ilustração digital amigável, linhas limpas.`;
    
    // Tentar gerar imagem (pode falhar - não é crítico)
    try {
      imageResult = await generateDalleImage(imagePrompt);
      
      if (imageResult.success && imageResult.data) {
        // 4. UPLOAD PARA VERCEL BLOB
        blobResult = await uploadToVercelBlob(imageResult.data, storyId);
        
        if (blobResult.success && blobResult.url) {
          // 5. ATUALIZAR BANCO COM URL DA IMAGEM
          await saveToNeonDB(
            textResult.text,
            blobResult.url,
            { 
              mainCharacter, plot, ending, genre, literature,
              storyId: storyId 
            },
            false
          );
        }
      }
    } catch (imageError) {
      console.log('⚠️  Processo de imagem falhou, continuando sem imagem:', imageError.message);
      // Continuar sem imagem - não é um erro crítico
    }
    
    // 6. PREPARAR RESPOSTA
    const responseData = {
      success: true,
      storyId: storyId,
      story: textResult.text,
      metadata: {
        text: {
          wordCount: textResult.wordCount,
          charCount: textResult.charCount
        },
        image: {
          generated: imageResult.success,
          uploaded: blobResult.success,
          url: blobResult.url || null,
          sizeKB: imageResult.sizeKB || 0,
          blobSizeKB: blobResult.sizeKB || 0
        },
        userInput: {
          mainCharacter: mainCharacter.substring(0, 100),
          plot: plot.substring(0, 150),
          ending: ending.substring(0, 100),
          genre: genre,
          literature: literature
        },
        timestamps: {
          generatedAt: new Date().toISOString(),
          storage: 'vercel-blob'
        }
      }
    };
    
    // Incluir imagem base64 apenas se solicitado (para exibição imediata)
    if (req.body.includeBase64 && imageResult.data) {
      responseData.imageBase64 = imageResult.data;
      console.log('📤 Incluindo base64 na resposta (para preview)');
    }
    
    console.log('🎉 Geração concluída com sucesso!');
    console.log(`📊 Resumo: ${textResult.wordCount} palavras, ` +
                `Imagem: ${imageResult.success ? '✓' : '✗'}, ` +
                `Blob: ${blobResult.success ? '✓' : '✗'}`);
    
    // 7. ENVIAR RESPOSTA
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('💥 ERRO CRÍTICO NO HANDLER:', error);
    
    // Tentar fornecer uma resposta útil mesmo em caso de erro
    const errorResponse = {
      success: false,
      error: 'Erro interno ao processar sua solicitação.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      suggestion: 'Tente novamente em alguns instantes.',
      timestamp: new Date().toISOString()
    };
    
    return res.status(500).json(errorResponse);
  }
}