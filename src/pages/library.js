// pages/library.js - VERSÃO ATUALIZADA COM INFORMAÇÕES DO USUÁRIO
import { useState } from 'react';

export async function getServerSideProps() {
  console.log('📚 Biblioteca: Iniciando carregamento...');
  console.log('DATABASE_URL disponível:', !!process.env.DATABASE_URL);
  
  // Se não tem DATABASE_URL, retorna vazio
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL não configurada, retornando vazio');
    return { 
      props: { 
        stories: [],
        error: 'Banco de dados não configurado',
        timestamp: new Date().toISOString()
      } 
    };
  }

  try {
    console.log('🔗 Conectando ao Neon PostgreSQL...');
    
    // Importação dinâmica do Prisma
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Testar conexão primeiro
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão com Neon estabelecida');

    // Buscar histórias com todos os campos
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
    console.error('❌ ERRO ao carregar histórias:', {
      message: error.message,
      code: error.code
    });
    
    return { 
      props: { 
        stories: [],
        error: `Falha na conexão: ${error.message}`,
        timestamp: new Date().toISOString(),
        debug: process.env.NODE_ENV === 'development' ? error.message : null
      } 
    };
  }
}

export default function StoriesPage({ stories, error, timestamp, debug }) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  // Mostrar informações de debug
  if (error) {
    return (
      <div className="container">
        <h1>📚 Biblioteca de Textos</h1>
        
        <div className="error-box">
          <h3>⚠️ Aviso: Problema de Conexão</h3>
          <p><strong>Erro:</strong> {error}</p>
          <p><strong>Hora:</strong> {new Date(timestamp).toLocaleString()}</p>
          <p>O banco de dados pode estar temporariamente indisponível.</p>
          
          <div className="troubleshoot">
            <h4>📋 Verificações:</h4>
            <ol>
              <li>Verifique se o Neon PostgreSQL está ativo</li>
              <li>Confirme a DATABASE_URL no Vercel</li>
              <li>Teste a conexão manualmente</li>
            </ol>
          </div>
          
          {debug && (
            <pre className="debug-info">
              {debug}
            </pre>
          )}
        </div>

        <div className="retry-container">
          <button 
            onClick={() => window.location.reload()}
            className="retry-btn"
          >
            🔄 Tentar Novamente
          </button>
        </div>

        <style jsx>{`
          .container {
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            font-family: 'Segoe UI', sans-serif;
          }
          
          .error-box {
            background-color: #fff3cd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #ffc107;
          }
          
          .troubleshoot {
            margin-top: 15px;
          }
          
          .debug-info {
            background-color: #f8f9fa;
            padding: 10px;
            font-size: 12px;
            overflow: auto;
            margin-top: 10px;
          }
          
          .retry-container {
            text-align: center;
            margin-top: 30px;
          }
          
          .retry-btn {
            padding: 10px 20px;
            background-color: #0d6efd;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
          }
          
          .retry-btn:hover {
            background-color: #0b5ed7;
          }
        `}</style>
      </div>
    );
  }

  // Se não há histórias (mas também não há erro)
  if (stories.length === 0) {
    return (
      <div className="container">
        <h1>📚 Biblioteca de Textos</h1>
        
        <div className="empty-library">
          <div className="empty-icon">📭</div>
          <h3>Nenhum texto encontrado</h3>
          <p>Os textos gerados aparecerão aqui automaticamente.</p>
          <p className="last-check">
            <small>Última verificação: {new Date(timestamp).toLocaleString()}</small>
          </p>
          
          <div className="create-first">
            <a 
              href="/story-generator" 
              className="create-btn"
            >
              ➕ Criar Primeiro Texto
            </a>
          </div>
        </div>

        <style jsx>{`
          .container {
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
          }
          
          .empty-library {
            text-align: center;
            padding: 40px 20px;
            background-color: #e9ecef;
            border-radius: 10px;
            margin-top: 30px;
          }
          
          .empty-icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          
          .last-check {
            margin-top: 10px;
            color: #6c757d;
          }
          
          .create-first {
            margin-top: 30px;
          }
          
          .create-btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #198754;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s;
          }
          
          .create-btn:hover {
            background-color: #157347;
          }
        `}</style>
      </div>
    );
  }

  // Se há textos, mostrar normalmente
  const currentStory = stories[currentStoryIndex];
  const { 
    text, 
    illustrationb64, 
    createdAt,
    mainCharacter,
    plot,
    ending,
    genre,
    literature
  } = currentStory;

  return (
    <div className="container">
      <h1 className="page-title">📚 Biblioteca de Textos</h1>
      
      {/* Contador e navegação */}
      <div className="story-counter">
        <div className="counter-info">
          <span className="counter-text">
            <strong>Texto {currentStoryIndex + 1} de {stories.length}</strong>
          </span>
          <div className="counter-buttons">
            <button 
              onClick={() => setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1))} 
              disabled={currentStoryIndex === 0}
              className="counter-btn prev-btn"
            >
              ← Anterior
            </button>
            <button 
              onClick={() => setCurrentStoryIndex(Math.min(stories.length - 1, currentStoryIndex + 1))} 
              disabled={currentStoryIndex === stories.length - 1}
              className="counter-btn next-btn"
            >
              Próximo →
            </button>
          </div>
        </div>
        {createdAt && (
          <div className="timestamp">
            <span className="date-icon">📅</span>
            <span>{new Date(createdAt).toLocaleDateString('pt-BR')}</span>
            <span className="time-icon">🕐</span>
            <span>{new Date(createdAt).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</span>
          </div>
        )}
      </div>

      {/* Informações do usuário */}
      <div className="user-input-info">
        <h3 className="info-title">
          <span className="info-icon">📋</span>
          Informações fornecidas pelo usuário:
        </h3>
        <div className="info-grid">
          <div className="info-card">
            <div className="info-header">
              <span className="info-icon">👤</span>
              <span className="info-label">Personagem Principal</span>
            </div>
            <p className="info-value">{mainCharacter || "Não informado"}</p>
          </div>
          
          <div className="info-card">
            <div className="info-header">
              <span className="info-icon">📖</span>
              <span className="info-label">Enredo</span>
            </div>
            <p className="info-value">{plot || "Não informado"}</p>
          </div>
          
          <div className="info-card">
            <div className="info-header">
              <span className="info-icon">🎭</span>
              <span className="info-label">Desfecho</span>
            </div>
            <p className="info-value">{ending || "Não informado"}</p>
          </div>
          
          <div className="info-card">
            <div className="info-header">
              <span className="info-icon">🎨</span>
              <span className="info-label">Gênero</span>
            </div>
            <p className="info-value">{genre || "Não informado"}</p>
          </div>
          
          <div className="info-card">
            <div className="info-header">
              <span className="info-icon">📚</span>
              <span className="info-label">Tipo de Literatura</span>
            </div>
            <p className="info-value">{literature || "Não informado"}</p>
          </div>
        </div>
      </div>

      {/* Texto gerado */}
      <div className="story-section">
        <div className="section-header">
          <h3 className="section-title">
            <span className="section-icon">📖</span>
            Texto Gerado:
          </h3>
          <div className="word-count">
            <span className="word-icon">📝</span>
            <span>{text.split(/\s+/).length} palavras</span>
          </div>
        </div>
        <div className="story-content">
          <p className="story-text">{text}</p>
        </div>
      </div>

      {/* Ilustração */}
      <div className="illustration-section">
        <div className="section-header">
          <h3 className="section-title">
            <span className="section-icon">🎨</span>
            Ilustração:
          </h3>
        </div>
        {illustrationb64 && illustrationb64.trim() !== '' ? (
          <div className="image-container">
            <img
              className="story-image"
              src={`data:image/png;base64,${illustrationb64}`}
              alt="Ilustração da História"
              loading="lazy"
            />
            <div className="image-info">
              <span className="info-tag">🖼️ Imagem gerada com DALL-E 3</span>
              <span className="info-tag">📐 1024x1024 pixels</span>
            </div>
          </div>
        ) : (
          <div className="no-image">
            <div className="no-image-icon">🎨</div>
            <p>Este texto não possui ilustração</p>
          </div>
        )}
      </div>

      {/* Navegação inferior */}
      <div className="bottom-navigation">
        <button 
          onClick={() => setCurrentStoryIndex(Math.max(0, currentStoryIndex - 1))} 
          disabled={currentStoryIndex === 0}
          className="nav-btn prev-btn"
        >
          <span className="btn-icon">◀️</span>
          <span className="btn-text">História Anterior</span>
        </button>
        
        <a href="/" className="home-link">
          <span className="link-icon">🏠</span>
          <span className="link-text">Página Inicial</span>
        </a>
        
        <a href="/story-generator" className="generator-link">
          <span className="link-icon">✨</span>
          <span className="link-text">Novo Texto</span>
        </a>
        
        <button 
          onClick={() => setCurrentStoryIndex(Math.min(stories.length - 1, currentStoryIndex + 1))} 
          disabled={currentStoryIndex === stories.length - 1}
          className="nav-btn next-btn"
        >
          <span className="btn-text">Próxima História</span>
          <span className="btn-icon">▶️</span>
        </button>
      </div>

      <style jsx>{`
        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }
        
        .page-title {
          text-align: center;
          color: #2c3e50;
          margin-bottom: 30px;
          font-size: 2.2rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          padding-bottom: 15px;
          border-bottom: 2px solid #f0f0f0;
        }
        
        .story-counter {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          padding: 15px 20px;
          margin-bottom: 25px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .counter-info {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .counter-text {
          font-size: 16px;
          font-weight: 600;
        }
        
        .counter-buttons {
          display: flex;
          gap: 10px;
        }
        
        .counter-btn {
          padding: 6px 15px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }
        
        .counter-btn:hover:enabled {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        
        .counter-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .timestamp {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          background: rgba(255, 255, 255, 0.1);
          padding: 6px 12px;
          border-radius: 6px;
        }
        
        .date-icon, .time-icon {
          font-size: 14px;
        }
        
        .user-input-info {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
          border-left: 6px solid #667eea;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        
        .info-title {
          color: #2d3748;
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 1.4rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .info-icon {
          font-size: 1.2em;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        
        .info-card {
          background: white;
          border-radius: 10px;
          padding: 18px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
          border: 1px solid #e2e8f0;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .info-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 15px rgba(0,0,0,0.1);
        }
        
        .info-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .info-label {
          font-weight: 700;
          color: #4a5568;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .info-value {
          color: #2d3748;
          font-size: 16px;
          line-height: 1.5;
          margin: 0;
          word-break: break-word;
        }
        
        .story-section, .illustration-section {
          margin-bottom: 35px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .section-title {
          color: #2c3e50;
          font-size: 1.3rem;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .section-icon {
          font-size: 1.2em;
        }
        
        .word-count {
          background: #e8f4fd;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          color: #2c5282;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .word-icon {
          font-size: 14px;
        }
        
        .story-content {
          background: #f8fafc;
          border-radius: 10px;
          padding: 25px;
          border: 1px solid #e2e8f0;
        }
        
        .story-text {
          font-size: 17px;
          line-height: 1.8;
          color: #2d3748;
          white-space: pre-line;
          margin: 0;
          font-family: 'Georgia', serif;
        }
        
        .image-container {
          text-align: center;
        }
        
        .story-image {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
          border: 1px solid #ddd;
          transition: transform 0.3s ease;
        }
        
        .story-image:hover {
          transform: scale(1.01);
        }
        
        .image-info {
          margin-top: 15px;
          display: flex;
          justify-content: center;
          gap: 15px;
          flex-wrap: wrap;
        }
        
        .info-tag {
          background: #e9ecef;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          color: #495057;
        }
        
        .no-image {
          padding: 40px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 10px;
          text-align: center;
          color: #6c757d;
          border: 2px dashed #adb5bd;
        }
        
        .no-image-icon {
          font-size: 50px;
          margin-bottom: 15px;
          opacity: 0.5;
        }
        
        .bottom-navigation {
          display: grid;
          grid-template-columns: 1fr auto auto 1fr;
          gap: 15px;
          margin-top: 40px;
          align-items: center;
        }
        
        .nav-btn {
          padding: 12px 25px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s ease;
          justify-content: center;
        }
        
        .prev-btn {
          background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
          color: white;
          justify-self: start;
        }
        
        .next-btn {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          justify-self: end;
        }
        
        .nav-btn:hover:enabled {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        
        .nav-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .home-link, .generator-link {
          padding: 12px 25px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s ease;
        }
        
        .home-link {
          background: #28a745;
          color: white;
        }
        
        .generator-link {
          background: #ffc107;
          color: #212529;
        }
        
        .home-link:hover, .generator-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0,0,0,0.1);
        }
        
        .btn-icon {
          font-size: 16px;
        }
        
        .link-icon {
          font-size: 16px;
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 15px;
          }
          
          .page-title {
            font-size: 1.8rem;
          }
          
          .story-counter {
            flex-direction: column;
            align-items: stretch;
            gap: 15px;
          }
          
          .counter-info {
            justify-content: space-between;
          }
          
          .info-grid {
            grid-template-columns: 1fr;
          }
          
          .bottom-navigation {
            grid-template-columns: 1fr;
            grid-template-rows: repeat(4, auto);
            gap: 10px;
          }
          
          .nav-btn, .home-link, .generator-link {
            width: 100%;
            justify-content: center;
          }
          
          .prev-btn {
            grid-row: 1;
          }
          
          .home-link {
            grid-row: 2;
          }
          
          .generator-link {
            grid-row: 3;
          }
          
          .next-btn {
            grid-row: 4;
          }
        }
        
        @media (max-width: 480px) {
          .section-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .counter-buttons {
            width: 100%;
          }
          
          .counter-btn {
            flex: 1;
            text-align: center;
          }
          
          .story-text {
            font-size: 16px;
            line-height: 1.7;
          }
        }
      `}</style>
    </div>
  );
}