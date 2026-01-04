// pages/library.js - VERSÃO COMPLETA COM INFORMAÇÕES DO USUÁRIO
import { useState } from 'react';

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

    // Buscar histórias - incluindo os novos campos
    const stories = await prisma.story.findMany({
      orderBy: { id: 'desc' },
      take: 50
    });

    console.log(`📖 ${stories.length} histórias encontradas`);
    
    await prisma.$disconnect();
    
    return { 
      props: { 
        stories: JSON.parse(JSON.stringify(stories)),
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
  
  // Extrair dados (incluindo os novos campos)
  const {
    text,
    illustrationb64,
    createdAt,
    mainCharacter = "Não informado",
    plot = "Não informado",
    ending = "Não informado",
    genre = "Não informado",
    literature = "Não informado"
  } = currentStory;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📚 Biblioteca de Textos</h1>
      
      {/* Contador e navegação */}
      <div style={styles.counterBox}>
        <div style={styles.counterInfo}>
          <span style={styles.counterText}>
            <strong>Texto {currentStoryIndex + 1} de {stories.length}</strong>
          </span>
          <div style={styles.counterButtons}>
            <button 
              onClick={() => setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1))}
              disabled={currentStoryIndex === 0}
              style={styles.navButton}
            >
              ← Anterior
            </button>
            <button 
              onClick={() => setCurrentStoryIndex(Math.min(stories.length - 1, currentStoryIndex + 1))}
              disabled={currentStoryIndex === stories.length - 1}
              style={styles.navButton}
            >
              Próximo →
            </button>
          </div>
        </div>
        {createdAt && (
          <div style={styles.timestamp}>
            📅 {new Date(createdAt).toLocaleDateString('pt-BR')}
            {' '}🕐 {new Date(createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* SEÇÃO DE INFORMAÇÕES DO USUÁRIO */}
      <div style={styles.userInfoSection}>
        <h3 style={styles.sectionTitle}>📋 Informações Fornecidas pelo Usuário:</h3>
        
        <div style={styles.infoGrid}>
          {/* Personagem Principal */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>👤</span>
              <span style={styles.infoLabel}>Personagem Principal</span>
            </div>
            <p style={styles.infoValue}>{mainCharacter}</p>
          </div>
          
          {/* Enredo */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>📖</span>
              <span style={styles.infoLabel}>Enredo</span>
            </div>
            <p style={styles.infoValue}>{plot}</p>
          </div>
          
          {/* Desfecho */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>🎭</span>
              <span style={styles.infoLabel}>Desfecho</span>
            </div>
            <p style={styles.infoValue}>{ending}</p>
          </div>
          
          {/* Gênero */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>🎨</span>
              <span style={styles.infoLabel}>Gênero</span>
            </div>
            <p style={styles.infoValue}>{genre}</p>
          </div>
          
          {/* Tipo de Literatura */}
          <div style={styles.infoCard}>
            <div style={styles.infoHeader}>
              <span style={styles.infoIcon}>📚</span>
              <span style={styles.infoLabel}>Tipo de Literatura</span>
            </div>
            <p style={styles.infoValue}>{literature}</p>
          </div>
        </div>
      </div>

      {/* Texto Gerado */}
      <div style={styles.storySection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>📖 Texto Gerado:</h3>
          <div style={styles.wordCount}>
            📝 {text.split(/\s+/).length} palavras
          </div>
        </div>
        <div style={styles.storyBox}>
          <p style={styles.storyText}>{text}</p>
        </div>
      </div>

      {/* Ilustração */}
      <div style={styles.illustrationSection}>
        <h3 style={styles.sectionTitle}>🎨 Ilustração:</h3>
        {illustrationb64 && illustrationb64.trim() !== '' ? (
          <div style={styles.imageContainer}>
            <img
              src={`data:image/png;base64,${illustrationb64}`}
              alt="Ilustração da História"
              style={styles.image}
            />
            <div style={styles.imageInfo}>
              <span style={styles.imageTag}>🖼️ DALL-E 3</span>
              <span style={styles.imageTag}>📐 1024x1024px</span>
            </div>
          </div>
        ) : (
          <div style={styles.noImage}>
            <div style={{fontSize: '40px', marginBottom: '10px'}}>🎨</div>
            <p>Este texto não possui ilustração</p>
          </div>
        )}
      </div>

      {/* Navegação Inferior */}
      <div style={styles.bottomNavigation}>
        <button 
          onClick={() => setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1))}
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
          onClick={() => setCurrentStoryIndex(Math.min(stories.length - 1, currentStoryIndex + 1))}
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
  infoIcon: {
    fontSize: '18px',
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
  
  // ILUSTRAÇÃO
  illustrationSection: {
    marginBottom: '35px',
  },
  imageContainer: {
    textAlign: 'center',
  },
  image: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '12px',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
    border: '1px solid #ddd',
    transition: 'transform 0.3s ease',
  },
  imageInfo: {
    marginTop: '15px',
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    flexWrap: 'wrap',
  },
  imageTag: {
    background: '#e9ecef',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#495057',
  },
  noImage: {
    padding: '40px',
    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
    borderRadius: '10px',
    textAlign: 'center',
    color: '#6c757d',
    border: '2px dashed #adb5bd',
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