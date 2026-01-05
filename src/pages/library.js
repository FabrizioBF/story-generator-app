import { useState, useEffect } from 'react';
import Head from 'next/head';

// Função para extrair informações do texto da história
function extractStoryMetadata(storyText) {
  const defaultData = {
    title: "História sem título",
    mainCharacter: "Não informado",
    plot: "Não informado", 
    ending: "Não informado",
    genre: "Não informado",
    literature: "Não informado",
    extractedFromText: false,
    wordCount: 0
  };

  if (!storyText || typeof storyText !== 'string') {
    return { ...defaultData, cleanStory: storyText || "" };
  }

  // Calcular contagem de palavras
  const words = storyText.trim().split(/\s+/);
  defaultData.wordCount = words.length;

  // Tentar extrair título (primeira linha ou parágrafo)
  const lines = storyText.split('\n').filter(line => line.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 10 && firstLine.length < 100 && !firstLine.includes(' ')) {
      defaultData.title = firstLine;
    } else if (firstLine.length > 0) {
      defaultData.title = firstLine.substring(0, 60) + (firstLine.length > 60 ? '...' : '');
    }
  }

  // Tentar extrair do formato estruturado
  const infoSectionStart = "=== DADOS ===";
  const infoSectionEnd = "=============";
  
  const startIndex = storyText.indexOf(infoSectionStart);
  const endIndex = storyText.indexOf(infoSectionEnd);
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const infoText = storyText.substring(startIndex + infoSectionStart.length, endIndex);
    const infoLines = infoText.split('\n').filter(line => line.trim());
    
    infoLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.includes('Personagem:')) {
        defaultData.mainCharacter = trimmedLine.split('Personagem:')[1]?.trim() || "Não informado";
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
      if (trimmedLine.includes('Tipo:')) {
        defaultData.literature = trimmedLine.split('Tipo:')[1]?.trim() || "Não informado";
      }
    });
    
    // Remover seção de informações do texto principal
    const cleanStory = storyText.substring(0, startIndex).trim();
    return { 
      ...defaultData, 
      cleanStory,
      extractedFromText: true
    };
  }
  
  return { ...defaultData, cleanStory: storyText, extractedFromText: false };
}

// Componente de imagem com tratamento de erro
function StoryImage({ imageUrl, storyId, title, onError }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [imageUrl]);

  if (!imageUrl) {
    return (
      <div style={styles.noImagePlaceholder}>
        <div style={styles.placeholderIcon}>🖼️</div>
        <p style={styles.placeholderText}>Sem ilustração</p>
      </div>
    );
  }

  const handleError = (e) => {
    console.error(`❌ Erro ao carregar imagem ${storyId}:`, imageUrl);
    setHasError(true);
    setIsLoading(false);
    if (onError) onError(e);
  };

  const handleLoad = () => {
    console.log(`✅ Imagem carregada: ${storyId}`);
    setIsLoading(false);
  };

  return (
    <div style={styles.imageWrapper}>
      {isLoading && (
        <div style={styles.imageLoading}>
          <div style={{
            ...styles.spinner,
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={styles.loadingText}>Carregando imagem...</p>
        </div>
      )}
      
      {hasError ? (
        <div style={styles.imageError}>
          <div style={styles.errorIcon}>⚠️</div>
          <p style={styles.errorText}>Imagem não disponível</p>
          <a 
            href={imageUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={styles.externalLink}
          >
            Tentar abrir externamente
          </a>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={`Ilustração: ${title}`}
          style={{
            ...styles.image,
            display: isLoading ? 'none' : 'block'
          }}
          onError={handleError}
          onLoad={handleLoad}
          loading="lazy"
          crossOrigin="anonymous"
        />
      )}
      
      <div style={styles.imageFooter}>
        <span style={styles.storageBadge}>
          ☁️ Vercel Blob
        </span>
        <a 
          href={imageUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={styles.viewOriginal}
          title="Abrir imagem original"
        >
          🔗
        </a>
      </div>
    </div>
  );
}

// Componente de informação
function InfoCard({ icon, label, value, color = '#3b82f6' }) {
  return (
    <div style={styles.infoCard}>
      <div style={styles.infoHeader}>
        <span style={{ ...styles.infoIcon, backgroundColor: `${color}20` }}>
          {icon}
        </span>
        <span style={styles.infoLabel}>{label}</span>
      </div>
      <div style={styles.infoValueContainer}>
        <p style={styles.infoValue}>{value || "Não informado"}</p>
      </div>
    </div>
  );
}

// Buscar dados do servidor - VERSÃO SEM updatedAt
export async function getServerSideProps() {
  console.log('📚 Biblioteca: Carregando histórias...');
  
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL não configurada');
    return { 
      props: { 
        stories: [],
        error: 'Banco de dados não configurado',
        timestamp: new Date().toISOString(),
        totalStories: 0
      } 
    };
  }

  try {
    console.log('🔗 Conectando ao Neon DB...');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    });

    // Testar conexão
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão estabelecida com Neon DB');

    // Buscar histórias - APENAS CAMPOS QUE EXISTEM
    const stories = await prisma.story.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        text: true,
        illustrationPath: true,
        mainCharacter: true,
        plot: true,
        ending: true,
        genre: true,
        literature: true,
        createdAt: true
        // NÃO INCLUIR updatedAt - campo não existe no banco
      }
    });

    console.log(`📖 ${stories.length} histórias encontradas`);
    
    // Processar dados
    const processedStories = stories.map(story => {
      // Extrair metadados do texto
      const metadata = extractStoryMetadata(story.text);
      
      // Verificar URL da imagem
      const hasImage = story.illustrationPath && story.illustrationPath.length > 10;
      const isVercelBlobUrl = hasImage && story.illustrationPath.includes('vercel-storage.com');
      
      return {
        ...story,
        ...metadata,
        hasImage,
        isVercelBlobUrl,
        imageType: isVercelBlobUrl ? 'vercel-blob' : 'external-url',
        displayDate: new Date(story.createdAt).toLocaleDateString('pt-BR'),
        displayTime: new Date(story.createdAt).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
        // Não adicionar updatedAt - usar apenas createdAt
      };
    });
    
    await prisma.$disconnect();
    
    return { 
      props: { 
        stories: JSON.parse(JSON.stringify(processedStories)),
        error: null,
        timestamp: new Date().toISOString(),
        totalStories: processedStories.length
      } 
    };
    
  } catch (error) {
    console.error('❌ ERRO no servidor:', error.message);
    
    return { 
      props: { 
        stories: [],
        error: `Falha ao conectar ao banco: ${error.message}`,
        timestamp: new Date().toISOString(),
        totalStories: 0
      } 
    };
  }
}

// Componente principal
export default function StoriesPage({ stories, error, timestamp, totalStories }) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStories, setFilteredStories] = useState(stories);

  // Filtrar histórias baseado na busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStories(stories);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = stories.filter(story => {
      return (
        story.text.toLowerCase().includes(term) ||
        story.mainCharacter.toLowerCase().includes(term) ||
        story.plot.toLowerCase().includes(term) ||
        story.genre.toLowerCase().includes(term) ||
        story.literature.toLowerCase().includes(term)
      );
    });

    setFilteredStories(filtered);
    setCurrentStoryIndex(0); // Resetar para primeira história
  }, [searchTerm, stories]);

  // Tratar erros de carregamento
  if (error) {
    return (
      <div style={styles.pageContainer}>
        <Head>
          <title>Biblioteca - Erro</title>
          <style jsx global>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Head>
        
        <div style={styles.errorPage}>
          <h1 style={styles.errorTitle}>📚 Biblioteca de Textos</h1>
          <div style={styles.errorMessage}>
            <h2>⚠️ Erro de Conexão</h2>
            <p>{error}</p>
            <p style={styles.errorHint}>
              Verifique se o banco de dados está configurado corretamente.
            </p>
            <div style={styles.errorActions}>
              <button 
                onClick={() => window.location.reload()}
                style={styles.retryButton}
              >
                🔄 Tentar Novamente
              </button>
              <a href="/" style={styles.homeButton}>
                🏠 Página Inicial
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sem histórias
  if (stories.length === 0) {
    return (
      <div style={styles.pageContainer}>
        <Head>
          <title>Biblioteca Vazia</title>
          <style jsx global>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Head>
        
        <div style={styles.emptyLibrary}>
          <h1 style={styles.libraryTitle}>📚 Biblioteca de Textos</h1>
          <div style={styles.emptyMessage}>
            <div style={styles.emptyIcon}>📭</div>
            <h2>Nenhum texto encontrado</h2>
            <p>Os textos gerados aparecerão aqui automaticamente.</p>
            <p style={styles.timestamp}>
              Última verificação: {new Date(timestamp).toLocaleString('pt-BR')}
            </p>
            <div style={styles.emptyActions}>
              <a href="/story-generator" style={styles.createButton}>
                ✨ Criar Primeira História
              </a>
              <a href="/" style={styles.homeLink}>
                🏠 Voltar ao Início
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // História atual
  const currentStory = filteredStories[currentStoryIndex] || filteredStories[0];
  
  if (!currentStory) {
    return (
      <div style={styles.pageContainer}>
        <Head>
          <title>Biblioteca - Busca</title>
          <style jsx global>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Head>
        
        <h1 style={styles.libraryTitle}>📚 Biblioteca de Textos</h1>
        <div style={styles.noResults}>
          <p>Nenhuma história encontrada para "{searchTerm}"</p>
          <button 
            onClick={() => setSearchTerm('')}
            style={styles.clearSearchButton}
          >
            Limpar busca
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Head>
        <title>Biblioteca - {currentStory.title}</title>
        <meta name="description" content="Biblioteca de histórias geradas com IA" />
        {/* CSS-in-JS seguro para animações */}
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Estilos responsivos */
          @media (max-width: 768px) {
            .info-grid-responsive {
              grid-template-columns: 1fr !important;
            }
            
            .nav-buttons-responsive {
              flex-direction: column;
              gap: 10px;
            }
            
            .story-selector-responsive {
              width: 100% !important;
            }
            
            .footer-navigation-responsive {
              flex-direction: column;
              gap: 15px;
            }
          }
        `}</style>
      </Head>

      {/* Cabeçalho */}
      <header style={styles.header}>
        <h1 style={styles.libraryTitle}>
          📚 Biblioteca de Textos
          <span style={styles.counterBadge}>
            {totalStories} {totalStories === 1 ? 'história' : 'histórias'}
          </span>
        </h1>
        
        {/* Barra de busca */}
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="🔍 Buscar por personagem, gênero, texto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              style={styles.clearButton}
            >
              ✕
            </button>
          )}
        </div>
        
        {searchTerm && (
          <div style={styles.searchResults}>
            {filteredStories.length} resultado{filteredStories.length !== 1 ? 's' : ''} para "{searchTerm}"
          </div>
        )}
      </header>

      {/* Controles de navegação */}
      <div style={styles.navigationPanel}>
        <div style={styles.navInfo}>
          <div style={styles.storyCounter}>
            <span style={styles.counterText}>
              <strong>História {currentStoryIndex + 1} de {filteredStories.length}</strong>
              <span style={styles.storyId}>ID: {currentStory.id}</span>
            </span>
            <div style={styles.dateInfo}>
              <span style={styles.dateIcon}>📅</span>
              {currentStory.displayDate} às {currentStory.displayTime}
            </div>
          </div>
          
          <div style={styles.navButtons}>
            <button 
              onClick={() => setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1))}
              disabled={currentStoryIndex === 0}
              style={{
                ...styles.navButton,
                ...(currentStoryIndex === 0 && styles.navButtonDisabled)
              }}
            >
              ← Anterior
            </button>
            
            <select
              value={currentStoryIndex}
              onChange={(e) => setCurrentStoryIndex(Number(e.target.value))}
              style={styles.storySelector}
            >
              {filteredStories.map((story, index) => (
                <option key={story.id} value={index}>
                  #{story.id} - {story.title.substring(0, 40)}...
                </option>
              ))}
            </select>
            
            <button 
              onClick={() => setCurrentStoryIndex(Math.min(filteredStories.length - 1, currentStoryIndex + 1))}
              disabled={currentStoryIndex === filteredStories.length - 1}
              style={{
                ...styles.navButton,
                ...(currentStoryIndex === filteredStories.length - 1 && styles.navButtonDisabled)
              }}
            >
              Próxima →
            </button>
          </div>
        </div>
      </div>

      {/* Informações do usuário */}
      <section style={styles.infoSection}>
        <h2 style={styles.sectionTitle}>
          <span style={styles.sectionIcon}>📋</span>
          Informações fornecidas
        </h2>
        
        <div style={{ ...styles.infoGrid, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          <InfoCard 
            icon="👤" 
            label="Personagem Principal" 
            value={currentStory.mainCharacter}
            color="#3b82f6"
          />
          <InfoCard 
            icon="📖" 
            label="Enredo" 
            value={currentStory.plot}
            color="#10b981"
          />
          <InfoCard 
            icon="🎭" 
            label="Desfecho" 
            value={currentStory.ending}
            color="#f59e0b"
          />
          <InfoCard 
            icon="🎨" 
            label="Gênero" 
            value={currentStory.genre}
            color="#8b5cf6"
          />
          <InfoCard 
            icon="📚" 
            label="Tipo de Literatura" 
            value={currentStory.literature}
            color="#ef4444"
          />
        </div>
      </section>

      {/* Texto da história */}
      <section style={styles.storySection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📖</span>
            História Gerada
            <span style={styles.wordCount}>
              📝 {currentStory.wordCount} palavras
            </span>
          </h2>
          <div style={styles.textStats}>
            <span style={styles.statBadge}>
              {currentStory.text.length} caracteres
            </span>
            {currentStory.extractedFromText && (
              <span style={styles.structuredBadge}>
                Dados estruturados
              </span>
            )}
          </div>
        </div>
        
        <div style={styles.storyContent}>
          <div style={styles.storyText}>
            {currentStory.cleanStory.split('\n').map((paragraph, index) => (
              paragraph.trim() ? (
                <p key={index} style={styles.paragraph}>
                  {paragraph}
                </p>
              ) : (
                <br key={index} />
              )
            ))}
          </div>
          
          <div style={styles.storyActions}>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(currentStory.cleanStory);
                alert('Texto copiado!');
              }}
              style={styles.copyButton}
            >
              📋 Copiar texto
            </button>
            <button 
              onClick={() => window.print()}
              style={styles.printButton}
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>
      </section>

      {/* Ilustração */}
      <section style={styles.illustrationSection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>🎨</span>
            Ilustração
            {currentStory.hasImage && (
              <span style={styles.storageBadgeHeader}>
                ☁️ Armazenada no Vercel Blob
              </span>
            )}
          </h2>
        </div>
        
        <div style={styles.illustrationContainer}>
          <StoryImage
            imageUrl={currentStory.illustrationPath}
            storyId={currentStory.id}
            title={currentStory.title}
          />
          
          {!currentStory.hasImage && (
            <div style={styles.noImageInfo}>
              <p>Esta história não possui uma ilustração associada.</p>
              <p style={styles.noImageHint}>
                <small>
                  As ilustrações são geradas pelo DALL-E 3 e armazenadas no Vercel Blob Storage.
                  Pode ocorrer falha na geração ou no upload.
                </small>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Navegação inferior */}
      <footer style={styles.footer}>
        <div style={styles.footerNavigation}>
          <button 
            onClick={() => setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1))}
            disabled={currentStoryIndex === 0}
            style={styles.footerNavButton}
          >
            ◀️ História Anterior
          </button>
          
          <div style={styles.footerActions}>
            <a href="/" style={styles.footerLink}>
              🏠 Página Inicial
            </a>
            <a href="/story-generator" style={styles.generateLink}>
              ✨ Nova História
            </a>
          </div>
          
          <button 
            onClick={() => setCurrentStoryIndex(Math.min(filteredStories.length - 1, currentStoryIndex + 1))}
            disabled={currentStoryIndex === filteredStories.length - 1}
            style={styles.footerNavButton}
          >
            Próxima História ▶️
          </button>
        </div>
        
        <div style={styles.footerInfo}>
          <p style={styles.footerText}>
            <small>
              📊 {filteredStories.length} histórias visíveis • 
              🕐 Atualizado: {new Date(timestamp).toLocaleTimeString('pt-BR')} •
              💾 Armazenamento: Vercel Blob + Neon DB
            </small>
          </p>
        </div>
      </footer>
    </div>
  );
}

// Estilos como objeto JavaScript
const styles = {
  pageContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    color: '#1f2937',
  },
  
  // Header
  header: {
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e5e7eb',
  },
  
  libraryTitle: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap',
  },
  
  counterBadge: {
    fontSize: '1rem',
    fontWeight: '600',
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '5px 15px',
    borderRadius: '20px',
    marginLeft: '10px',
  },
  
  searchContainer: {
    position: 'relative',
    maxWidth: '600px',
    marginBottom: '15px',
  },
  
  searchInput: {
    width: '100%',
    padding: '12px 45px 12px 15px',
    fontSize: '16px',
    border: '2px solid #d1d5db',
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.3s ease',
  },
  
  clearButton: {
    position: 'absolute',
    right: '15px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#6b7280',
  },
  
  searchResults: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '10px',
  },
  
  // Navegação
  navigationPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '30px',
    border: '1px solid #e2e8f0',
  },
  
  navInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
  },
  
  storyCounter: {
    flex: 1,
  },
  
  counterText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  
  storyId: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '400',
  },
  
  dateInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '5px',
  },
  
  dateIcon: {
    fontSize: '16px',
  },
  
  navButtons: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  
  navButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    minWidth: '100px',
  },
  
  navButtonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  
  storySelector: {
    padding: '10px 15px',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white',
    minWidth: '200px',
    cursor: 'pointer',
  },
  
  // Seção de informações
  infoSection: {
    marginBottom: '30px',
  },
  
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  
  sectionIcon: {
    fontSize: '24px',
  },
  
  infoGrid: {
    display: 'grid',
    gap: '20px',
  },
  
  infoCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  
  infoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '15px',
  },
  
  infoIcon: {
    fontSize: '20px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
  },
  
  infoLabel: {
    fontWeight: '600',
    color: '#4b5563',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  
  infoValueContainer: {
    minHeight: '60px',
  },
  
  infoValue: {
    color: '#1f2937',
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0',
  },
  
  // Seção da história
  storySection: {
    marginBottom: '30px',
  },
  
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  
  wordCount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: '15px',
  },
  
  textStats: {
    display: 'flex',
    gap: '10px',
  },
  
  statBadge: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '5px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
  },
  
  structuredBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '5px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
  },
  
  storyContent: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '30px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  
  storyText: {
    fontSize: '18px',
    lineHeight: '1.8',
    color: '#1f2937',
    marginBottom: '30px',
  },
  
  paragraph: {
    marginBottom: '20px',
    textAlign: 'justify',
  },
  
  storyActions: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'flex-end',
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
  
  printButton: {
    padding: '10px 20px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  // Seção de ilustração
  illustrationSection: {
    marginBottom: '40px',
  },
  
  storageBadgeHeader: {
    fontSize: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '6px',
    marginLeft: '15px',
  },
  
  illustrationContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0',
  },
  
  imageWrapper: {
    position: 'relative',
    textAlign: 'center',
    minHeight: '300px',
  },
  
  imageLoading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
  },
  
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    margin: '0 auto 15px',
  },
  
  loadingText: {
    color: '#6b7280',
  },
  
  image: {
    maxWidth: '100%',
    maxHeight: '400px',
    height: 'auto',
    borderRadius: '8px',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
    margin: '0 auto',
  },
  
  imageError: {
    padding: '40px',
    backgroundColor: '#fef2f2',
    borderRadius: '10px',
    border: '2px dashed #ef4444',
    textAlign: 'center',
  },
  
  errorIcon: {
    fontSize: '40px',
    marginBottom: '15px',
  },
  
  errorText: {
    color: '#dc2626',
    marginBottom: '15px',
  },
  
  externalLink: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '14px',
  },
  
  imageFooter: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
    marginTop: '15px',
  },
  
  storageBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
  },
  
  viewOriginal: {
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '16px',
    padding: '5px',
  },
  
  noImagePlaceholder: {
    padding: '40px',
    backgroundColor: '#f9fafb',
    borderRadius: '10px',
    border: '2px dashed #d1d5db',
    textAlign: 'center',
  },
  
  placeholderIcon: {
    fontSize: '40px',
    marginBottom: '15px',
    opacity: 0.5,
  },
  
  placeholderText: {
    color: '#6b7280',
  },
  
  noImageInfo: {
    textAlign: 'center',
    padding: '20px',
    color: '#6b7280',
  },
  
  noImageHint: {
    color: '#9ca3af',
    maxWidth: '500px',
    margin: '10px auto',
  },
  
  // Footer
  footer: {
    marginTop: '40px',
    paddingTop: '20px',
    borderTop: '2px solid #e5e7eb',
  },
  
  footerNavigation: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  
  footerNavButton: {
    padding: '12px 25px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    minWidth: '150px',
  },
  
  footerActions: {
    display: 'flex',
    gap: '15px',
  },
  
  footerLink: {
    padding: '12px 25px',
    backgroundColor: '#10b981',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  generateLink: {
    padding: '12px 25px',
    backgroundColor: '#f59e0b',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  footerInfo: {
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
  },
  
  footerText: {
    color: '#6b7280',
    margin: '0',
  },
  
  // Páginas de erro/vazia
  errorPage: {
    textAlign: 'center',
    padding: '50px 20px',
  },
  
  errorTitle: {
    fontSize: '2.5rem',
    marginBottom: '30px',
  },
  
  errorMessage: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#fef2f2',
    padding: '30px',
    borderRadius: '12px',
    border: '1px solid #fecaca',
  },
  
  errorHint: {
    color: '#6b7280',
    marginTop: '15px',
  },
  
  errorActions: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginTop: '25px',
  },
  
  retryButton: {
    padding: '12px 25px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  homeButton: {
    padding: '12px 25px',
    backgroundColor: '#6b7280',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  emptyLibrary: {
    textAlign: 'center',
    padding: '50px 20px',
  },
  
  emptyMessage: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '40px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '2px dashed #d1d5db',
  },
  
  emptyIcon: {
    fontSize: '60px',
    marginBottom: '20px',
    opacity: 0.7,
  },
  
  timestamp: {
    color: '#6b7280',
    fontSize: '14px',
    marginTop: '15px',
  },
  
  emptyActions: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginTop: '30px',
  },
  
  createButton: {
    padding: '12px 25px',
    backgroundColor: '#3b82f6',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  homeLink: {
    padding: '12px 25px',
    backgroundColor: '#9ca3af',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  noResults: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    marginTop: '30px',
  },
  
  clearSearchButton: {
    padding: '10px 20px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '15px',
  },
};