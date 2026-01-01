// pages/api/generate-story.js - VERSÃO CORRIGIDA PARA VERCEL
import OpenAI from "openai";

// Inicializa o cliente OpenAI usando a variável do Vercel
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // 1. Só aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // 2. Pega os dados do corpo da requisição
  const { mainCharacter, plot, ending, genre, literature } = req.body;

  // 3. Validação simples
  if (!mainCharacter || !plot || !ending) {
    return res.status(400).json({ error: 'Personagem, enredo e desfecho são obrigatórios.' });
  }

  // 4. Verificação CRÍTICA da API Key
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERRO: OPENAI_API_KEY não está definida no ambiente Vercel.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  try {
    console.log('Iniciando geração para:', { mainCharacter, plot, ending });

    // === 5. GERAR A HISTÓRIA COM GPT ===
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um escritor criativo especializado em português brasileiro."
        },
        {
          role: "user",
          content: `Crie um(a) ${literature} no gênero ${genre} entre 250 e 350 palavras em português do Brasil. Deve incluir: 
          - Personagem principal: ${mainCharacter}
          - Enredo central: ${plot}
          - Desfecho: ${ending}
          Seja criativo, descritivo e garanta uma narrativa coesa.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.8,
    });

    const story = gptResponse.choices[0].message.content;
    console.log('História gerada com sucesso.');

    // === 6. GERAR PROMPT PARA ILUSTRAÇÃO ===
    const dallePromptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você cria prompts concisos para o DALL-E 3." },
        { role: "user", content: `Gere UM único prompt em inglês para uma ilustração baseada nesta história: ${story}. O prompt deve ser detalhado, mencionar estilo artístico (coerente com ${genre}) e ser apropriado para o DALL-E 3. Responda apenas com o prompt.` }
      ],
      max_tokens: 150,
    });
    const dallePrompt = dallePromptResponse.choices[0].message.content;
    console.log('Prompt para ilustração gerado:', dallePrompt);

    // === 7. GERAR A ILUSTRAÇÃO COM DALL-E ===
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
      response_format: "b64_json", // Importante para receber a imagem em base64
    });

    const illustrationb64 = imageResponse.data[0].b64_json;
    console.log('Ilustração gerada com sucesso.');

    // === 8. RETORNAR SUCESSO (SEM SALVAR NO BANCO) ===
    res.status(200).json({
      success: true,
      story: story,
      illustrationb64: illustrationb64,
    });

  } catch (error) {
    // Log detalhado do erro (aparecerá nos logs do Vercel)
    console.error('ERRO NA API generate-story:', {
      message: error.message,
      type: error.type,
      code: error.code,
      status: error.status
    });

    // Resposta de erro mais clara para o frontend
    res.status(500).json({
      error: 'Falha ao gerar o conteúdo com IA',
      internalError: error.message,
      suggestion: 'Verifique a chave da OpenAI e os logs do servidor.'
    });
  }
}