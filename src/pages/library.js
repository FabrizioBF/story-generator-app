// pages/library.js - VERSÃO OTIMIZADA COM THUMBNAILS
import { useState } from 'react';

// Configurações de imagem (deve corresponder ao generate-story.js)
const IMAGE_CONFIG = {
  THUMBNAIL_SIZE: 256,
  MAX_THUMBNAIL_KB: 100
};

// Função para extrair informações do usuário do texto
function extractUserDataFromStory(storyText) {
  const defaultData = {
    mainCharacter: "Não informado",
    plot: "Não informado", 
    ending: "Não informado",
    genre: "Não informado",
    literature: "Não informado",
    hasStructuredData: false
  };

  if (!storyText || typeof storyText !== 'string') {
    return { ...defaultData, cleanStory: storyText || "" };
  }

  // Primeiro, tenta extrair do formato estruturado no final do texto
  const infoSectionStart = "=== INFORMAÇÕES DO USUÁRIO ===";
  const infoSectionEnd = "==============================";
  
  const startIndex = storyText.indexOf(infoSectionStart);
  const endIndex = storyText.indexOf(infoSectionEnd);
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const infoText = storyText.substring(startIndex + infoSectionStart.length, endIndex);
    const lines = infoText.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.includes('Personagem Principal:')) {
        defaultData.mainCharacter = trimmedLine.split('Personagem Principal:')[1]?.trim() || "Não informado";
      }
      if (trimmedLine.includes('Enredo:')) {
        defaultData.plot = trimmedLine.split('Enredo:')[1]?.trim() || "Não informado";
      }
      if (trimmedLine.includes('Desfecho:')) {
        defaultData.ending = trimmedLine.split('Desfecho:')[1]?.trim() || "Não informado";
      }
      if (trimmedLine.includes('Gênero:')) {
        defaultData.genre = trimmedLine.split('Gênero:')[1]?.trim() || "Não informado";
      }
      if (trimmedLine.includes('Tipo de Literatura:')) {
        defaultData.literature = trimmedLine.split('Tipo de Literatura:')[1]?.trim() || "Não informado";
      }
    });
    
    // Remove a seção de informações do texto principal para exibição
    const cleanStory = storyText.substring(0, startIndex).trim();
    return { 
      ...defaultData, 
      cleanStory,
      hasStructuredData: true
    };
  }
  
  return { ...defaultData, cleanStory: storyText };
}

export async function getServerSideProps() {
  console.log('📚 Biblioteca: Iniciando carregamento...');
  
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL não configurada');
    return { 
      props: { 
        stories: [],
        error: 'Banco de dados não configurado',
        timestamp: new Date().toISOString()
      } 
    };
  }

  try {
    console.log('🔗 Conectando ao banco...');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    });

    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão estabelecida');

    // Buscar histórias com thumbnails
    const stories = await prisma.story.findMany({
      orderBy: { id: 'desc' },
      take: 50,
      select: {
        id: true,
        text: true,
        illustrationb64: true,
        illustrationUrl: true,
        createdAt: true,
        mainCharacter: true,
        plot: true,
        ending: true,
        genre: true,
        literature: true
      }
    });

    console.log(`📖 ${stories.length} histórias encontradas`);
    
    // Analisar tamanhos das thumbnails
    const storiesWithThumbnailInfo = stories.map(story => {
      const hasThumbnail = story.illustrationb64 && story.illustrationb64.length > 100;
      const thumbnailSizeKB = hasThumbnail ? Math.round(story.illustrationb64.length / 1024) : 0;
      
      return {
        ...story,
        hasThumbnail,
        thumbnailSizeKB,
        isOptimized: thumbnailSizeKB > 0 && thumbnailSizeKB <= IMAGE_CONFIG.MAX_THUMBNAIL_KB
      };
    });
    
    await prisma.$disconnect();
    
    return { 
      props: { 
        stories: JSON.parse(JSON.stringify(storiesWithThumbnailInfo)),
        error: null,
        timestamp: new Date().toISOString()
      } 
    };
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    
    return { 
      props: { 
        stories: [],
        error: `Falha: ${error.message}`,
        timestamp: new Date().toISOString()
      } 
    };
  }
}

export default function StoriesPage({ stories, error, timestamp }) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);

  // Tratar erros
  if (error) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>📚 Biblioteca de Textos</h1>
        <div style={styles.errorBox}>
          <h3>⚠️ Erro de Conexão</h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={styles.button}
          >
            🔄 Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Sem histórias
  if (stories.length === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>📚 Biblioteca de Textos</h1>
        <div style={styles.emptyBox}>
          <div style={{fontSize: '50px', marginBottom: '20px'}}>📭</div>
          <h3>Nenhum texto encontrado</h3>
          <p>Os textos gerados aparecerão aqui.</p>
          <p><small>Última verificação: {new Date(timestamp).toLocaleString()}</small></p>
          <a href="/story-generator" style={styles.createButton}>
            ➕ Criar Primeiro Texto
          </a>
        </div>
      </div>
    );
  }

  // História atual
  const currentStory = stories[currentStoryIndex];
  
  // Extrair dados do usuário do texto
  const userData = extractUserDataFromStory(currentStory.text || "");
  const displayStory = userData.cleanStory || currentStory.text;
  
  // Preferir dados diretos do banco se disponíveis
  const finalUserData = {
    mainCharacter: currentStory.mainCharacter || userData.mainCharacter,
    plot: currentStory.plot || userData.plot,
    ending: currentStory.ending || userData.ending,
    genre: currentStory.genre || userData.genre,
    literature: currentStory.literature || userData.literature,
    hasStructuredData: userData.hasStructuredData
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📚 Biblioteca de Textos</h1>
      
      {/* Contador e navegação */}
      <div style={styles.counterBox}>
        <div style={styles.counterInfo}>
          <span style={styles.counterText}>
            <strong>Texto {currentStoryIndex + 1} de {stories.length}</strong>
            {currentStory.hasThumbnail && (
              <span style={styles.thumbnailBadge}>
                🖼️ {currentStory.thumbnailSizeKB}KB
                {currentStory.isOptimized && ' ✓'}
              </span>
            )}
          </span>
          <div style={styles.counterButtons}>
            <button 
              onClick={() => {
                setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
                setImageLoadError(false);
              }}
              disabled={currentStoryIndex === 0}
              style={styles.navButton}
            >
              ← Anterior
            </button>
            <button 
              onClick={() => {
                setCurrentStoryIndex(Math.min(stories.length - 1, currentStoryIndex + 1));
                setImageLoadError(false);
              }}
              disabled={currentStoryIndex === stories.length - 1}
              style={styles.navButton}
            >
              Próximo →
            </button>
          </div>
        </div>
        {currentStory.createdAt && (
          <div style={styles.timestamp}>
            📅 {new Date(currentStory.createdAt).toLocaleDateString('pt-BR')}
            {' '}🕐 {new Date(currentStory.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* SEÇÃO DE INFORMAÇÕES DO USUÁRIO */}
      <div style={styles.userInfoSection}>
        <h3 style={styles.sectionTitle}>
          <span style={styles.infoIcon}>📋</span>
          Informações Fornecidas pelo Usuário:
        </h3>
        
        <div style={styles.infoGrid}>
          {/* Personagem Principal */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>👤</span>
              <span style={styles.infoLabel}>Personagem Principal</span>
            </div>
            <p style={styles.infoValue}>{finalUserData.mainCharacter}</p>
          </div>
          
          {/* Enredo */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>📖</span>
              <span style={styles.infoLabel}>Enredo</span>
            </div>
            <p style={styles.infoValue}>{finalUserData.plot}</p>
          </div>
          
          {/* Desfecho */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>🎭</span>
              <span style={styles.infoLabel}>Desfecho</span>
            </div>
            <p style={styles.infoValue}>{finalUserData.ending}</p>
          </div>
          
          {/* Gênero */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>🎨</span>
              <span style={styles.infoLabel}>Gênero</span>
            </div>
            <p style={styles.infoValue}>{finalUserData.genre}</p>
          </div>
          
          {/* Tipo de Literatura */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>📚</span>
              <span style={styles.infoLabel}>Tipo de Literatura</span>
            </div>
            <p style={styles.infoValue}>{finalUserData.literature}</p>
          </div>
        </div>
      </div>

      {/* Texto Gerado */}
      <div style={styles.storySection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📖</span>
            Texto Gerado:
          </h3>
          <div style={styles.wordCount}>
            📝 {displayStory.split(/\s+/).length} palavras
          </div>
        </div>
        <div style={styles.storyBox}>
          <p style={styles.storyText}>{displayStory}</p>
        </div>
      </div>

      {/* SEÇÃO DE THUMBNAIL OTIMIZADA */}
      {currentStory.hasThumbnail ? (
        <div style={styles.thumbnailSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>🖼️</span>
              Thumbnail Otimizada:
            </h3>
            <div style={styles.thumbnailInfo}>
              <span style={styles.infoTag}>📏 {IMAGE_CONFIG.THUMBNAIL_SIZE}px</span>
              <span style={styles.infoTag}>⚡ {currentStory.thumbnailSizeKB}KB</span>
              {currentStory.isOptimized && (
                <span style={{...styles.infoTag, backgroundColor: '#d1fae5', color: '#065f46'}}>
                  ✓ Otimizada
                </span>
              )}
            </div>
          </div>
          
          <div style={styles.thumbnailContainer}>
            {!imageLoadError ? (
              <>
                <img
                  src={`data:image/jpeg;base64,${currentStory.illustrationb64}`}
                  alt="Thumbnail da história"
                  style={styles.thumbnailImage}
                  onError={() => {
                    console.log('❌ Erro ao carregar thumbnail');
                    setImageLoadError(true);
                  }}
                  onLoad={() => {
                    console.log('✅ Thumbnail carregada com sucesso');
                  }}
                />
                <div style={styles.imageCaption}>
                  <p style={styles.captionText}>
                    <small>
                      <em>
                        🚀 Esta é uma versão otimizada da imagem ({currentStory.thumbnailSizeKB}KB) 
                        para carregamento rápido e armazenamento eficiente.
                      </em>
                    </small>
                  </p>
                </div>
              </>
            ) : (
              <div style={styles.thumbnailError}>
                <div style={{fontSize: '40px', marginBottom: '10px'}}>❌</div>
                <p>Thumbnail corrompida ou muito grande</p>
                <p style={{fontSize: '14px', color: '#666', marginTop: '5px'}}>
                  Tamanho: {currentStory.thumbnailSizeKB}KB
                </p>
              </div>
            )}
          </div>
          
          {/* URL alternativa se disponível */}
          {currentStory.illustrationUrl && currentStory.illustrationUrl.trim() !== '' && (
            <div style={styles.alternativeUrl}>
              <p style={{fontSize: '14px', marginBottom: '5px'}}>
                <strong>URL alternativa disponível:</strong>
              </p>
              <a 
                href={currentStory.illustrationUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={styles.urlLink}
              >
                🔗 Abrir imagem completa
              </a>
            </div>
          )}
        </div>
      ) : (
        <div style={styles.noThumbnailSection}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>🖼️</span>
            Thumbnail:
          </h3>
          <div style={styles.noThumbnail}>
            <div style={{fontSize: '40px', marginBottom: '10px', opacity: 0.5}}>📷</div>
            <p>Esta história não possui thumbnail</p>
            <p style={styles.optimizationNote}>
              <small>
                <em>
                  As histórias mais recentes incluem thumbnails otimizadas para 
                  melhor performance e economia de espaço.
                </em>
              </small>
            </p>
          </div>
        </div>
      )}

      {/* Navegação Inferior */}
      <div style={styles.bottomNavigation}>
        <button 
          onClick={() => {
            setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1));
            setImageLoadError(false);
          }}
          disabled={currentStoryIndex === 0}
          style={{...styles.bottomButton, ...styles.prevButton}}
        >
          ◀️ História Anterior
        </button>
        
        <a href="/" style={{...styles.bottomLink, ...styles.homeLink}}>
          🏠 Página Inicial
        </a>
        
        <a href="/story-generator" style={{...styles.bottomLink, ...styles.generatorLink}}>
          ✨ Novo Texto
        </a>
        
        <button 
          onClick={() => {
            setCurrentStoryIndex(Math.min(stories.length - 1, currentStoryIndex + 1));
            setImageLoadError(false);
          }}
          disabled={currentStoryIndex === stories.length - 1}
          style={{...styles.bottomButton, ...styles.nextButton}}
        >
          Próxima História ▶️
        </button>
      </div>

      {/* Estilos inline */}
      <style jsx>{`
        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 15px;
          }
          
          .info-grid {
            grid-template-columns: 1fr !important;
          }
          
          .bottom-navigation {
            flex-direction: column;
            gap: 10px;
          }
          
          .thumbnail-badge {
            display: block;
            margin-top: 5px;
          }
          
          .thumbnail-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }
        }
      `}</style>
    </div>
  );
}

// Estilos como objeto JavaScript
const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
  },
  title: {
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: '30px',
    fontSize: '2.2rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    paddingBottom: '15px',
    borderBottom: '2px solid #f0f0f0',
  },
  counterBox: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '10px',
    padding: '15px 20px',
    marginBottom: '25px',
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
  },
  counterInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  counterText: {
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  thumbnailBadge: {
    fontSize: '12px',
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '3px 8px',
    borderRadius: '4px',
    display: 'inline-block',
  },
  counterButtons: {
    display: 'flex',
    gap: '10px',
  },
  navButton: {
    padding: '6px 15px',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
  },
  timestamp: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '6px 12px',
    borderRadius: '6px',
  },
  
  // SEÇÃO DE INFORMAÇÕES DO USUÁRIO
  userInfoSection: {
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '30px',
    borderLeft: '6px solid #667eea',
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    color: '#2d3748',
    marginTop: '0',
    marginBottom: '20px',
    fontSize: '1.4rem',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  infoIcon: {
    fontSize: '18px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  infoCard: {
    background: 'white',
    borderRadius: '10px',
    padding: '18px',
    boxShadow: '0 3px 10px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  infoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    paddingBottom: '10px',
    borderBottom: '1px solid #f0f0f0',
  },
  infoLabel: {
    fontWeight: '700',
    color: '#4a5568',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  infoValue: {
    color: '#2d3748',
    fontSize: '16px',
    lineHeight: '1.5',
    margin: '0',
    wordBreak: 'break-word',
  },
  
  // TEXTO GERADO
  storySection: {
    marginBottom: '35px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  sectionIcon: {
    fontSize: '20px',
  },
  wordCount: {
    background: '#e8f4fd',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    color: '#2c5282',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  storyBox: {
    background: '#f8fafc',
    borderRadius: '10px',
    padding: '25px',
    border: '1px solid #e2e8f0',
  },
  storyText: {
    fontSize: '17px',
    lineHeight: '1.8',
    color: '#2d3748',
    whiteSpace: 'pre-line',
    margin: '0',
    fontFamily: "'Georgia', serif",
  },
  
  // SEÇÃO DE THUMBNAIL
  thumbnailSection: {
    marginBottom: '35px',
    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    borderRadius: '12px',
    padding: '25px',
    border: '1px solid #bae6fd',
  },
  thumbnailInfo: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  infoTag: {
    background: '#e0f2fe',
    padding: '4px 10px',
    borderRadius: '15px',
    fontSize: '12px',
    color: '#0369a1',
    fontWeight: '600',
  },
  thumbnailContainer: {
    textAlign: 'center',
    marginTop: '15px',
  },
  thumbnailImage: {
    maxWidth: '400px',
    maxHeight: '400px',
    width: 'auto',
    height: 'auto',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    border: '2px solid #7dd3fc',
    backgroundColor: '#f8fafc',
    transition: 'transform 0.3s ease',
  },
  imageCaption: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '8px',
    maxWidth: '500px',
    margin: '15px auto 0',
  },
  captionText: {
    margin: '0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  thumbnailError: {
    padding: '40px',
    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
    borderRadius: '10px',
    textAlign: 'center',
    color: '#dc2626',
    border: '2px dashed #f87171',
  },
  alternativeUrl: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f0fdf4',
    borderRadius: '8px',
    border: '1px solid #bbf7d0',
    textAlign: 'center',
  },
  urlLink: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    transition: 'background-color 0.3s',
  },
  noThumbnailSection: {
    marginBottom: '35px',
  },
  noThumbnail: {
    padding: '40px',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    borderRadius: '10px',
    textAlign: 'center',
    color: '#64748b',
    border: '2px dashed #cbd5e1',
  },
  optimizationNote: {
    marginTop: '15px',
    color: '#475569',
    maxWidth: '500px',
    margin: '10px auto 0',
  },
  
  // NAVEGAÇÃO INFERIOR
  bottomNavigation: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto 1fr',
    gap: '15px',
    marginTop: '40px',
    alignItems: 'center',
  },
  bottomButton: {
    padding: '12px 25px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.3s ease',
    justifyContent: 'center',
  },
  prevButton: {
    background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
    color: 'white',
    justifySelf: 'start',
  },
  nextButton: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'white',
    justifySelf: 'end',
  },
  bottomLink: {
    padding: '12px 25px',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.3s ease',
  },
  homeLink: {
    background: '#28a745',
    color: 'white',
  },
  generatorLink: {
    background: '#ffc107',
    color: '#212529',
  },
  
  // ESTILOS PARA ERROS
  errorBox: {
    backgroundColor: '#fff3cd',
    padding: '20px',
    borderRadius: '8px',
    margin: '20px 0',
    border: '1px solid #ffc107',
    textAlign: 'center',
  },
  emptyBox: {
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: '#e9ecef',
    borderRadius: '10px',
    marginTop: '30px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#0d6efd',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '15px',
  },
  createButton: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#198754',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '5px',
    marginTop: '20px',
  },
};