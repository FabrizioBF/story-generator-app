// pages/story-generator.js - VERSÃO CORRIGIDA SEM ERROS SSR
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function StoryGenerator() {
  const router = useRouter();
  
  // Estados do formulário
  const [mainCharacter, setMainCharacter] = useState('');
  const [plot, setPlot] = useState('');
  const [ending, setEnding] = useState('');
  const [genre, setGenre] = useState('Fantasy');
  const [literature, setLiterature] = useState('story');
  
  // Estados da história gerada
  const [story, setStory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [storyId, setStoryId] = useState(null);
  
  // Estados de interface
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationStep, setGenerationStep] = useState(null); // 'text', 'image', 'upload', 'complete'
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Verificar se estamos no cliente
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Efeito para simular progresso
  useEffect(() => {
    let interval;
    if (isSubmitting) {
      interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 95) return 95;
          return prev + Math.random() * 15;
        });
      }, 500);
    } else {
      setGenerationProgress(0);
      clearInterval(interval);
    }
    
    return () => clearInterval(interval);
  }, [isSubmitting]);
  
  // Gerar prompt para imagem
  const generateImagePrompt = () => {
    const basePrompt = `Ilustração educacional, estilo cartoon limpo, cores vibrantes mas suaves, apropriada para ambiente educacional.`;
    
    if (mainCharacter && plot) {
      return `${basePrompt} Mostre: ${mainCharacter} em uma cena relacionada a ${plot.substring(0, 80)}`;
    }
    
    if (plot) {
      return `${basePrompt} Cena relacionada a: ${plot.substring(0, 100)}`;
    }
    
    return `${basePrompt} Ilustração criativa para uma história.`;
  };
  
  // Validar formulário
  const validateForm = () => {
    const errors = [];
    
    if (!mainCharacter.trim()) {
      errors.push('Personagem principal é obrigatório');
    }
    
    if (!plot.trim()) {
      errors.push('Enredo é obrigatório');
    }
    
    if (!ending.trim()) {
      errors.push('Desfecho é obrigatório');
    }
    
    if (mainCharacter.length < 2) {
      errors.push('Personagem principal muito curto (mínimo 2 caracteres)');
    }
    
    if (plot.length < 10) {
      errors.push('Enredo muito curto (mínimo 10 caracteres)');
    }
    
    if (ending.length < 5) {
      errors.push('Desfecho muito curto (mínimo 5 caracteres)');
    }
    
    return errors;
  };
  
  // Limpar formulário
  const resetForm = () => {
    setMainCharacter('');
    setPlot('');
    setEnding('');
    setGenre('Fantasy');
    setLiterature('story');
    setStory('');
    setImageUrl('');
    setImageBase64('');
    setStoryId(null);
    setError(null);
    setSuccess(false);
    setGenerationStep(null);
  };
  
  // Ver história na biblioteca
  const viewInLibrary = () => {
    if (storyId) {
      router.push(`/library?highlight=${storyId}`);
    } else {
      router.push('/library');
    }
  };
  
  // Copiar texto para clipboard (apenas no cliente)
  const copyToClipboard = (text) => {
    if (!isClient) return;
    
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Texto copiado para a área de transferência!');
      })
      .catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar texto. Tente manualmente.');
      });
  };
  
  // Gerar nova história
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Validar formulário
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }
    
    // Resetar estados
    setError(null);
    setSuccess(false);
    setStory('');
    setImageUrl('');
    setImageBase64('');
    setStoryId(null);
    setGenerationStep('text');
    setIsSubmitting(true);
    setGenerationProgress(10);
    
    // Dados da requisição
    const requestBody = {
      mainCharacter: mainCharacter.trim(),
      plot: plot.trim(),
      ending: ending.trim(),
      genre,
      literature,
      includeBase64: true, // Solicitar base64 para preview imediato
      imagePrompt: generateImagePrompt()
    };
    
    console.log('📤 Enviando dados para geração:', requestBody);
    
    try {
      // Simular progresso inicial
      setGenerationProgress(20);
      
      // Fazer requisição para a API
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      // Verificar resposta
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }
      
      // Processar resposta
      const data = await response.json();
      console.log('📥 Resposta recebida:', data);
      
      // Atualizar progresso
      setGenerationStep('image');
      setGenerationProgress(60);
      
      if (!data.success) {
        throw new Error(data.error || 'Falha na geração');
      }
      
      // Atualizar estados com os dados da história
      setStory(data.story || '');
      setStoryId(data.storyId || null);
      setGenerationProgress(80);
      
      // Processar imagem
      if (data.imageBase64) {
        // Usar base64 para preview imediato
        setImageBase64(`data:image/png;base64,${data.imageBase64}`);
        console.log('🖼️  Preview base64 carregado');
      }
      
      if (data.metadata?.image?.url) {
        // URL do Vercel Blob para acesso futuro
        setImageUrl(data.metadata.image.url);
        console.log('🔗 URL do Vercel Blob:', data.metadata.image.url);
      }
      
      // Atualizar progresso final
      setGenerationStep('complete');
      setGenerationProgress(100);
      setSuccess(true);
      
      // Log de sucesso
      console.log('✅ História gerada com sucesso:', {
        id: data.storyId,
        words: data.metadata?.text?.wordCount,
        hasImage: !!data.imageBase64,
        blobUrl: data.metadata?.image?.url
      });
      
      // Rolar para a história gerada (apenas no cliente)
      if (isClient) {
        setTimeout(() => {
          document.getElementById('generated-story')?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 500);
      }
      
    } catch (error) {
      console.error('❌ Erro na geração:', error);
      setError(error.message || 'Erro desconhecido ao gerar a história');
      setGenerationStep('error');
      setGenerationProgress(0);
    } finally {
      setIsSubmitting(false);
      
      // Limpar step após 3 segundos
      if (generationStep === 'complete' || generationStep === 'error') {
        setTimeout(() => {
          setGenerationStep(null);
        }, 3000);
      }
    }
  };
  
  // Renderizar barra de progresso
  const renderProgressBar = () => {
    if (!isSubmitting && generationProgress === 0) return null;
    
    const stepLabels = {
      'text': 'Gerando texto...',
      'image': 'Criando ilustração...',
      'upload': 'Salvando na nuvem...',
      'complete': 'Concluído!',
      'error': 'Erro na geração'
    };
    
    const currentLabel = stepLabels[generationStep] || 'Processando...';
    
    return (
      <div style={styles.progressContainer}>
        <div style={styles.progressHeader}>
          <span style={styles.progressIcon}>
            {generationStep === 'complete' ? '✅' : 
             generationStep === 'error' ? '❌' : '⚡'}
          </span>
          <span style={styles.progressText}>{currentLabel}</span>
          <span style={styles.progressPercent}>{Math.round(generationProgress)}%</span>
        </div>
        
        <div style={styles.progressBar}>
          <div 
            style={{
              ...styles.progressFill,
              width: `${generationProgress}%`,
              backgroundColor: generationStep === 'error' ? '#ef4444' : 
                             generationStep === 'complete' ? '#10b981' : '#3b82f6'
            }}
          />
        </div>
        
        {generationStep === 'text' && (
          <p style={styles.progressHint}>Criando história com GPT-4...</p>
        )}
        
        {generationStep === 'image' && (
          <p style={styles.progressHint}>Gerando imagem com DALL-E 3...</p>
        )}
        
        {generationStep === 'upload' && (
          <p style={styles.progressHint}>Upload para Vercel Blob Storage...</p>
        )}
      </div>
    );
  };
  
  return (
    <div style={styles.container}>
      <Head>
        <title>Gerador de Texto com Ilustração</title>
        <meta name="description" content="Gere histórias criativas com ilustrações usando IA" />
        {/* CSS-in-JS seguro para animações */}
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Estilos responsivos */
          @media (max-width: 768px) {
            .row-responsive {
              flex-direction: column !important;
            }
            
            .form-group-half-responsive {
              width: 100% !important;
            }
            
            .button-group-responsive {
              flex-direction: column !important;
            }
            
            .result-actions-responsive {
              flex-direction: column !important;
              gap: 10px !important;
            }
          }
        `}</style>
      </Head>
      
      {/* Cabeçalho */}
      <header style={styles.header}>
        <h1 style={styles.title}>
          ✨ Gerador de Texto com Ilustração
        </h1>
        <p style={styles.subtitle}>
          Crie histórias únicas com inteligência artificial. Preencha os campos abaixo e clique em gerar!
        </p>
      </header>
      
      {/* Barra de progresso */}
      {renderProgressBar()}
      
      {/* Mensagens de status */}
      {error && (
        <div style={styles.errorMessage}>
          <div style={styles.errorIcon}>⚠️</div>
          <div>
            <h3 style={styles.errorTitle}>Erro na geração</h3>
            <p style={styles.errorText}>{error}</p>
            <button 
              onClick={() => setError(null)}
              style={styles.dismissButton}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
      
      {success && (
        <div style={styles.successMessage}>
          <div style={styles.successIcon}>🎉</div>
          <div>
            <h3 style={styles.successTitle}>História gerada com sucesso!</h3>
            <p style={styles.successText}>
              Sua história foi salva na biblioteca. 
              {imageUrl && ' A ilustração está armazenada no Vercel Blob Storage.'}
            </p>
            <div style={styles.successActions}>
              <button 
                onClick={viewInLibrary}
                style={styles.libraryButton}
              >
                📚 Ver na Biblioteca
              </button>
              <button 
                onClick={resetForm}
                style={styles.newStoryButton}
              >
                ✨ Nova História
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={styles.content}>
        {/* Formulário */}
        <div style={styles.formSection}>
          <div style={styles.formHeader}>
            <h2 style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>📝</span>
              Criar Nova História
            </h2>
            <p style={styles.sectionDescription}>
              Preencha os detalhes da história que você quer criar
            </p>
          </div>
          
          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Personagem Principal */}
            <div style={styles.formGroup}>
              <label htmlFor="mainCharacter" style={styles.label}>
                <span style={styles.labelIcon}>👤</span>
                Personagem Principal
                <span style={styles.required}>*</span>
              </label>
              <input
                id="mainCharacter"
                type="text"
                value={mainCharacter}
                onChange={(e) => setMainCharacter(e.target.value)}
                placeholder="Ex: João, um jovem aventureiro"
                style={styles.input}
                disabled={isSubmitting}
                maxLength={100}
              />
              <div style={styles.charCounter}>
                {mainCharacter.length}/100 caracteres
              </div>
            </div>
            
            {/* Enredo */}
            <div style={styles.formGroup}>
              <label htmlFor="plot" style={styles.label}>
                <span style={styles.labelIcon}>📖</span>
                Enredo
                <span style={styles.required}>*</span>
              </label>
              <textarea
                id="plot"
                value={plot}
                onChange={(e) => setPlot(e.target.value)}
                placeholder="Ex: Descobre um mapa antigo que leva a um tesouro perdido"
                style={{...styles.input, ...styles.textarea}}
                disabled={isSubmitting}
                rows={3}
                maxLength={200}
              />
              <div style={styles.charCounter}>
                {plot.length}/200 caracteres
              </div>
            </div>
            
            {/* Desfecho */}
            <div style={styles.formGroup}>
              <label htmlFor="ending" style={styles.label}>
                <span style={styles.labelIcon}>🎭</span>
                Desfecho
                <span style={styles.required}>*</span>
              </label>
              <input
                id="ending"
                type="text"
                value={ending}
                onChange={(e) => setEnding(e.target.value)}
                placeholder="Ex: Encontra o tesouro e ajuda sua comunidade"
                style={styles.input}
                disabled={isSubmitting}
                maxLength={100}
              />
              <div style={styles.charCounter}>
                {ending.length}/100 caracteres
              </div>
            </div>
            
            <div style={{...styles.row, display: 'flex', gap: '20px'}}>
              {/* Gênero */}
              <div style={{...styles.formGroupHalf, flex: 1}}>
                <label htmlFor="genre" style={styles.label}>
                  <span style={styles.labelIcon}>🎨</span>
                  Gênero
                </label>
                <select
                  id="genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  style={styles.select}
                  disabled={isSubmitting}
                >
                  <option value="Fantasy">Fantasia</option>
                  <option value="Science Fiction">Ficção Científica</option>
                  <option value="Mystery">Mistério</option>
                  <option value="Romance">Romance</option>
                  <option value="Thriller">Suspense</option>
                  <option value="Horror">Terror</option>
                  <option value="Adventure">Aventura</option>
                  <option value="Historical">Histórico</option>
                  <option value="Comedy">Comédia</option>
                  <option value="Drama">Drama</option>
                  <option value="Educational">Educacional</option>
                  <option value="Folklore">Folclore</option>
                  <option value="Mythology">Mitologia</option>
                </select>
              </div>
              
              {/* Tipo de Literatura */}
              <div style={{...styles.formGroupHalf, flex: 1}}>
                <label htmlFor="literature" style={styles.label}>
                  <span style={styles.labelIcon}>📚</span>
                  Tipo de Literatura
                </label>
                <select
                  id="literature"
                  value={literature}
                  onChange={(e) => setLiterature(e.target.value)}
                  style={styles.select}
                  disabled={isSubmitting}
                >
                  <option value="story">História</option>
                  <option value="rhyming poetry">Poesia rimada</option>
                  <option value="poetry">Poesia</option>
            <option value="literary prose">Prosa literária</option>
                  <option value="free verse">Verso livre</option>
                  <option value="short story">Conto</option>
                  <option value="fable">Fábula</option>
                  <option value="tale">Conto popular</option>
                  <option value="chronicle">Crônica</option>
                  <option value="essay">Ensaio</option>
                  <option value="memoir">Memória</option>
                  <option value="letter">Carta</option>
                  <option value="dialogue">Diálogo</option>
                  <option value="monologue">Monólogo</option>
                  <option value="allegory">Alegoria</option>
                  <option value="satire">Sátira</option>
                  <option value="parable">Parábola</option>
                  <option value="legends">Lendas</option>
                  <option value="literatura clássica">Clássica</option>
            <option value="modernist literature">Modernista</option>
            <option value="contemporary literature">Contemporânea</option>
            <option value="cordel literature">Cordel</option>
            <option value="intermedial literature">Intermidiática</option>
                </select>
              </div>
            </div>
            
            {/* Preview do prompt da imagem */}
            <div style={styles.promptPreview}>
              <h4 style={styles.promptTitle}>
                <span style={styles.promptIcon}>🎨</span>
                Preview do Prompt da Imagem
              </h4>
              <p style={styles.promptText}>
                {generateImagePrompt()}
              </p>
              <p style={styles.promptNote}>
                <small>
                  Este prompt será usado para gerar a ilustração com DALL-E 3
                </small>
              </p>
            </div>
            
            {/* Botões */}
            <div style={styles.buttonGroup}>
              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{
                  ...styles.submitButton,
                  ...(isSubmitting && styles.submitButtonDisabled)
                }}
              >
                {isSubmitting ? (
                  <>
                    <div style={styles.buttonSpinner}></div>
                    Gerando...
                  </>
                ) : (
                  '✨ Gerar História'
                )}
              </button>
              
              <button 
                type="button" 
                onClick={resetForm}
                disabled={isSubmitting}
                style={styles.resetButton}
              >
                🔄 Limpar
              </button>
              
              <button 
                type="button" 
                onClick={() => router.push('/library')}
                style={styles.libraryButtonSmall}
              >
                📚 Biblioteca
              </button>
            </div>
            
            {/* Informações de armazenamento */}
            <div style={styles.storageInfo}>
              <p style={styles.storageText}>
                <small>
                  💡 <strong>Armazenamento:</strong> O texto é salvo no Neon DB e a ilustração no Vercel Blob Storage.
                  {isSubmitting && ' Aguarde enquanto processamos sua história...'}
                </small>
              </p>
            </div>
          </form>
        </div>
        
        {/* História Gerada */}
        {(story || imageBase64 || imageUrl) && (
          <div id="generated-story" style={styles.resultSection}>
            <div style={styles.resultHeader}>
              <h2 style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📖</span>
                História Gerada
                {storyId && (
                  <span style={styles.storyIdBadge}>ID: {storyId}</span>
                )}
              </h2>
              
              <div style={styles.resultActions}>
                <button 
                  onClick={() => copyToClipboard(story)}
                  style={styles.copyButton}
                >
                  📋 Copiar
                </button>
                <button 
                  onClick={viewInLibrary}
                  style={styles.viewButton}
                >
                  📚 Ver na Biblioteca
                </button>
              </div>
            </div>
            
            {/* Informações de armazenamento */}
            <div style={styles.storageDetails}>
              <div style={styles.storageBadge}>
                <span style={styles.storageIcon}>💾</span>
                Texto salvo no Neon DB
              </div>
              {imageUrl && (
                <div style={styles.storageBadge}>
                  <span style={styles.storageIcon}>☁️</span>
                  Imagem no Vercel Blob
                  <a 
                    href={imageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={styles.externalLink}
                    title="Abrir imagem no Vercel Blob"
                  >
                    🔗
                  </a>
                </div>
              )}
            </div>
            
            {/* Texto da História */}
            {story && (
              <div style={styles.storyContainer}>
                <div style={styles.storyHeader}>
                  <h3 style={styles.storyTitle}>
                    {mainCharacter || 'História Sem Título'}
                    <span style={styles.storyMeta}>
                      {genre && ` · ${genre}`}
                      {literature && literature !== 'story' && ` · ${literature}`}
                    </span>
                  </h3>
                </div>
                
                <div style={styles.storyContent}>
                  {story.split('\n').map((paragraph, index) => (
                    paragraph.trim() ? (
                      <p key={index} style={styles.paragraph}>
                        {paragraph}
                      </p>
                    ) : (
                      <br key={index} />
                    )
                  ))}
                </div>
                
                <div style={styles.storyFooter}>
                  <div style={styles.wordCount}>
                    📝 {story.split(/\s+/).length} palavras
                  </div>
                  <div style={styles.generatedInfo}>
                    Gerado em {new Date().toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            )}
            
            {/* Ilustração */}
            {(imageBase64 || imageUrl) && (
              <div style={styles.illustrationSection}>
                <div style={styles.illustrationHeader}>
                  <h3 style={styles.illustrationTitle}>
                    <span style={styles.illustrationIcon}>🎨</span>
                    Ilustração da História
                  </h3>
                  <div style={styles.illustrationInfo}>
                    {imageUrl && (
                      <span style={styles.blobBadge}>
                        ☁️ Vercel Blob Storage
                      </span>
                    )}
                  </div>
                </div>
                
                <div style={styles.illustrationContainer}>
                  {imageBase64 ? (
                    <img
                      src={imageBase64}
                      alt="Ilustração da história gerada"
                      style={styles.illustrationImage}
                      onError={() => {
                        // Fallback para URL do blob se base64 falhar
                        if (imageUrl) {
                          setImageBase64('');
                        }
                      }}
                    />
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Ilustração da história gerada"
                      style={styles.illustrationImage}
                      onError={(e) => {
                        console.error('Erro ao carregar imagem do blob:', imageUrl);
                        
                        // Mostrar fallback (apenas no cliente)
                        if (isClient) {
                          const container = e.target.parentElement;
                          if (container) {
                            container.innerHTML = `
                              <div style="
                                padding: 30px;
                                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                                border-radius: 10px;
                                text-align: center;
                                border: 2px dashed #f59e0b;
                                color: #92400e;
                                width: 100%;
                              ">
                                <div style="font-size: 40px; margin-bottom: 15px;">☁️</div>
                                <h4 style="margin: 0 0 10px 0;">Imagem no Vercel Blob</h4>
                                <p style="margin-bottom: 15px;">
                                  A ilustração está armazenada no Vercel Blob Storage.
                                </p>
                                <a href="${imageUrl}" 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   style="
                                     display: inline-block;
                                     padding: 8px 16px;
                                     background: #3b82f6;
                                     color: white;
                                     text-decoration: none;
                                     border-radius: 6px;
                                   ">
                                  🔗 Abrir Imagem
                                </a>
                              </div>
                            `;
                          }
                        }
                      }}
                    />
                  ) : null}
                  
                  {/* Legenda da imagem */}
                  <div style={styles.imageCaption}>
                    <p>
                      <strong>Prompt usado:</strong> {generateImagePrompt()}
                    </p>
                    <p style={styles.captionNote}>
                      <small>
                        ⚡ Gerado com DALL-E 3 · 
                        💾 Armazenado no Vercel Blob Storage · 
                        🎨 256x256 pixels
                      </small>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Rodapé informativo */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.techStack}>
            <h4 style={styles.footerTitle}>Tecnologias utilizadas:</h4>
            <div style={styles.techIcons}>
              <span style={styles.techIcon}>⚡</span> OpenAI GPT-4
              <span style={styles.techIcon}>🎨</span> DALL-E 3
              <span style={styles.techIcon}>☁️</span> Vercel Blob Storage
              <span style={styles.techIcon}>🐘</span> Neon DB (PostgreSQL)
              <span style={styles.techIcon}>⚛️</span> Next.js
            </div>
          </div>
          
          <div style={styles.footerActions}>
            <button 
              onClick={() => router.push('/')}
              style={styles.homeButton}
            >
              🏠 Página Inicial
            </button>
            <button 
              onClick={() => router.push('/library')}
              style={styles.browseButton}
            >
              📚 Navegar Biblioteca
            </button>
          </div>
        </div>
        
        <p style={styles.footerNote}>
          <small>
            Este projeto utiliza inteligência artificial para fins educacionais. 
            As histórias são geradas automaticamente e podem conter imprecisões.
          </small>
        </p>
      </footer>
    </div>
  );
}

// Estilos como objeto JavaScript
const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    color: '#1f2937',
  },
  
  header: {
    textAlign: 'center',
    marginBottom: '40px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e5e7eb',
  },
  
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  
  subtitle: {
    fontSize: '1.1rem',
    color: '#6b7280',
    maxWidth: '700px',
    margin: '0 auto',
    lineHeight: '1.6',
  },
  
  // Barra de progresso
  progressContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '30px',
    border: '1px solid #e2e8f0',
  },
  
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '15px',
  },
  
  progressIcon: {
    fontSize: '24px',
  },
  
  progressText: {
    flex: 1,
    marginLeft: '15px',
    fontWeight: '600',
    color: '#1e293b',
  },
  
  progressPercent: {
    fontWeight: '700',
    color: '#3b82f6',
    fontSize: '18px',
  },
  
  progressBar: {
    height: '10px',
    backgroundColor: '#e5e7eb',
    borderRadius: '5px',
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    borderRadius: '5px',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
  
  progressHint: {
    marginTop: '10px',
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
  },
  
  // Mensagens
  errorMessage: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '30px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
  },
  
  errorIcon: {
    fontSize: '24px',
    color: '#ef4444',
  },
  
  errorTitle: {
    margin: '0 0 5px 0',
    color: '#dc2626',
  },
  
  errorText: {
    margin: '0 0 15px 0',
    color: '#7f1d1d',
  },
  
  dismissButton: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  
  successMessage: {
    backgroundColor: '#d1fae5',
    border: '1px solid #a7f3d0',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '30px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
  },
  
  successIcon: {
    fontSize: '24px',
    color: '#10b981',
  },
  
  successTitle: {
    margin: '0 0 5px 0',
    color: '#065f46',
  },
  
  successText: {
    margin: '0 0 15px 0',
    color: '#065f46',
  },
  
  successActions: {
    display: 'flex',
    gap: '10px',
  },
  
  libraryButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  newStoryButton: {
    padding: '10px 20px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  // Conteúdo principal
  content: {
    display: 'grid',
    gap: '40px',
  },
  
  // Formulário
  formSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '30px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  },
  
  formHeader: {
    marginBottom: '30px',
  },
  
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  
  sectionIcon: {
    fontSize: '24px',
  },
  
  sectionDescription: {
    color: '#6b7280',
    fontSize: '1rem',
  },
  
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
  },
  
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  
  formGroupHalf: {
    flex: 1,
  },
  
  row: {
    display: 'flex',
    gap: '20px',
  },
  
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#4b5563',
    fontSize: '15px',
  },
  
  labelIcon: {
    fontSize: '18px',
  },
  
  required: {
    color: '#ef4444',
    marginLeft: '4px',
  },
  
  input: {
    padding: '12px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '2px solid #d1d5db',
    outline: 'none',
    transition: 'border-color 0.3s',
    backgroundColor: 'white',
  },
  
  textarea: {
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
  },
  
  select: {
    padding: '12px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '2px solid #d1d5db',
    outline: 'none',
    transition: 'border-color 0.3s',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  
  charCounter: {
    textAlign: 'right',
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '5px',
  },
  
  promptPreview: {
    backgroundColor: '#e0f2fe',
    borderRadius: '8px',
    padding: '15px',
    borderLeft: '4px solid #3b82f6',
  },
  
  promptTitle: {
    margin: '0 0 10px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#1e40af',
  },
  
  promptIcon: {
    fontSize: '16px',
  },
  
  promptText: {
    margin: '0',
    fontSize: '14px',
    color: '#1e40af',
    lineHeight: '1.5',
  },
  
  promptNote: {
    margin: '10px 0 0 0',
    color: '#60a5fa',
  },
  
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    marginTop: '10px',
  },
  
  submitButton: {
    flex: 1,
    padding: '15px',
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  
  buttonSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  
  resetButton: {
    padding: '15px 25px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  libraryButtonSmall: {
    padding: '15px 25px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  storageInfo: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    border: '1px dashed #d1d5db',
  },
  
  storageText: {
    margin: '0',
    color: '#6b7280',
  },
  
  // Resultados
  resultSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '30px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  },
  
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  
  storyIdBadge: {
    fontSize: '14px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '4px 12px',
    borderRadius: '20px',
    marginLeft: '15px',
    fontWeight: '600',
  },
  
  resultActions: {
    display: 'flex',
    gap: '10px',
  },
  
  copyButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  viewButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  storageDetails: {
    display: 'flex',
    gap: '10px',
    marginBottom: '25px',
    flexWrap: 'wrap',
  },
  
  storageBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '8px 15px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  storageIcon: {
    fontSize: '16px',
  },
  
  externalLink: {
    marginLeft: '5px',
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '14px',
  },
  
  storyContainer: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '25px',
    marginBottom: '30px',
    border: '1px solid #e5e7eb',
  },
  
  storyHeader: {
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #e5e7eb',
  },
  
  storyTitle: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0',
  },
  
  storyMeta: {
    fontSize: '1rem',
    fontWeight: '400',
    color: '#6b7280',
    marginLeft: '10px',
  },
  
  storyContent: {
    fontSize: '18px',
    lineHeight: '1.8',
    color: '#1f2937',
    marginBottom: '25px',
  },
  
  paragraph: {
    marginBottom: '20px',
    textAlign: 'justify',
  },
  
  storyFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '15px',
    borderTop: '1px solid #e5e7eb',
  },
  
  wordCount: {
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  generatedInfo: {
    color: '#9ca3af',
    fontSize: '14px',
  },
  
  // Ilustração
  illustrationSection: {
    marginTop: '30px',
  },
  
  illustrationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  
  illustrationTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  
  illustrationIcon: {
    fontSize: '24px',
  },
  
  illustrationInfo: {
    display: 'flex',
    gap: '10px',
  },
  
  blobBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  
  illustrationContainer: {
    textAlign: 'center',
  },
  
  illustrationImage: {
    maxWidth: '100%',
    maxHeight: '500px',
    height: 'auto',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    marginBottom: '15px',
  },
  
  imageCaption: {
    backgroundColor: '#f9fafb',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    textAlign: 'left',
  },
  
  captionNote: {
    margin: '10px 0 0 0',
    color: '#6b7280',
  },
  
  // Rodapé
  footer: {
    marginTop: '50px',
    paddingTop: '30px',
    borderTop: '2px solid #e5e7eb',
  },
  
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '30px',
  },
  
  techStack: {
    flex: 1,
  },
  
  footerTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: '10px',
  },
  
  techIcons: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  
  techIcon: {
    marginRight: '5px',
    fontSize: '18px',
  },
  
  footerActions: {
    display: 'flex',
    gap: '15px',
  },
  
  homeButton: {
    padding: '10px 20px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  browseButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  footerNote: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '13px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb',
  },
};