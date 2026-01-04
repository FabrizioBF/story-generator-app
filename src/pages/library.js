// pages/library.js - VERSÃO CORRIGIDA
import { useState } from 'react';

// Importação dinâmica para evitar problemas no build
let prisma;
try {
  prisma = require('@/lib/prisma').default;
} catch (error) {
  console.log('Prisma não disponível no cliente:', error.message);
  prisma = null;
}

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
    
    // Importação dinâmica do Prisma (evita problemas no build)
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

    // Buscar histórias
   // const stories = await prisma.story.findMany({
     // orderBy: { createdAt: 'desc' },
      //take: 50 // Limite para performance
    //});

    const stories = await prisma.story.findMany();
  return {
    props: { stories },
  };

    
    console.log(`📖 ${stories.length} histórias encontradas`);
    
    await prisma.$disconnect();
    
    return { 
      props: { 
        stories: JSON.parse(JSON.stringify(stories)), // Serializa para React
        error: null,
        timestamp: new Date().toISOString()
      } 
    };
    
  } catch (error) {
    console.error('❌ ERRO ao carregar histórias:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n')[0]
    });
    
    return { 
      props: { 
        stories: [],
        error: `Falha na conexão: ${error.message}`,
        timestamp: new Date().toISOString(),
        debug: process.env.NODE_ENV === 'development' ? error.stack : null
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
        <h1>📚 Biblioteca de Histórias</h1>
        
        <div style={{ 
          backgroundColor: '#fff3cd', 
          padding: '20px', 
          borderRadius: '8px',
          margin: '20px 0',
          border: '1px solid #ffc107'
        }}>
          <h3>⚠️ Aviso: Problema de Conexão</h3>
          <p><strong>Erro:</strong> {error}</p>
          <p><strong>Hora:</strong> {new Date(timestamp).toLocaleString()}</p>
          <p>O banco de dados pode estar temporariamente indisponível.</p>
          
          <div style={{ marginTop: '15px' }}>
            <h4>📋 Verificações:</h4>
            <ol>
              <li>Verifique se o Neon PostgreSQL está ativo</li>
              <li>Confirme a DATABASE_URL no Vercel</li>
              <li>Teste a conexão manualmente (veja instruções abaixo)</li>
            </ol>
          </div>
          
          {debug && process.env.NODE_ENV === 'development' && (
            <pre style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '10px', 
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {debug}
            </pre>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0d6efd',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
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
        `}</style>
      </div>
    );
  }

  // Se não há histórias (mas também não há erro)
  if (stories.length === 0) {
    return (
      <div className="container">
        <h1>📚 Biblioteca de Histórias</h1>
        
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          backgroundColor: '#e9ecef',
          borderRadius: '10px',
          marginTop: '30px'
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>📭</div>
          <h3>Nenhuma história encontrada</h3>
          <p>As histórias geradas aparecerão aqui automaticamente.</p>
          <p><small>Última verificação: {new Date(timestamp).toLocaleString()}</small></p>
          
          <div style={{ marginTop: '30px' }}>
            <a 
              href="/story-generator" 
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#198754',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '5px'
              }}
            >
              ➕ Criar Primeira História
            </a>
          </div>
        </div>

        <style jsx>{`
          .container {
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
          }
        `}</style>
      </div>
    );
  }

  // Se há histórias, mostrar normalmente
  const { text, illustrationb64, createdAt } = stories[currentStoryIndex];

  return (
    <div className="container">
      <h1>📚 Biblioteca de Histórias</h1>
      
      <div style={{ 
        marginBottom: '20px', 
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '5px',
        fontSize: '14px'
      }}>
        <strong>História {currentStoryIndex + 1} de {stories.length}</strong>
        {createdAt && (
          <span style={{ float: 'right' }}>
            📅 {new Date(createdAt).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      <div className="story">
        <p className="story-text">{text}</p>
        {illustrationb64 && illustrationb64.trim() !== '' ? (
          <img
            className="story-image"
            src={`data:image/png;base64,${illustrationb64}`}
            alt="Ilustração da História"
          />
        ) : (
          <div style={{ 
            padding: '30px', 
            backgroundColor: '#f0f0f0',
            borderRadius: '8px',
            marginTop: '20px',
            textAlign: 'center'
          }}>
            🎨 Esta história não tem ilustração
          </div>
        )}
      </div>
      
      <div className="navigation">
        <button 
          onClick={() => setCurrentStoryIndex(currentStoryIndex - 1)} 
          disabled={currentStoryIndex === 0}
        >
          ◀️ Anterior
        </button>
        
        <button 
          onClick={() => setCurrentStoryIndex(currentStoryIndex + 1)} 
          disabled={currentStoryIndex === stories.length - 1}
        >
          Próximo ▶️
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <a 
          href="/story-generator" 
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            fontSize: '14px'
          }}
        >
          ⬅️ Voltar ao Gerador
        </a>
      </div>

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Georgia', serif;
          background-color: #f5f5f5;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .story {
          text-align: center;
        }
        .story-text {
          font-size: 18px;
          line-height: 1.6;
          color: #333;
          white-space: pre-line;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .story-image {
          max-width: 100%;
          height: auto;
          margin-top: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          border: 1px solid #ddd;
        }
        .navigation {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
        }
        button {
          background-color: #0070f3;
          color: #fff;
          border: none;
          padding: 12px 25px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          transition: background-color 0.3s;
        }
        button:hover:enabled {
          background-color: #005bb5;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        button:disabled {
          background-color: #aaa;
          cursor: not-allowed;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}