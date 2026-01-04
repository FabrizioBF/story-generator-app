import { useState } from 'react';
import { useRouter } from 'next/router';

export default function HomePage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  const navigateTo = (url) => router.push(url);

  const equipe = [
"Caio Manoel Tenório de Araújo",
"Cecilia Cristinni da Silva Oliveira",
"Emilly Hidiquel da Silva Vasconcelos",
"Emilly Laís Rufino Ramos",
"Prof. Fabrízio Barbosa Farias (orientador)",
"Geovana Larissa Xavier de Melo",
"Iago Leonam de Gusmão Pereira",
"João Victor Cosmo de Lima",
"Maísa de Santana de Souza",
"Marjorie Carla Tavares da Silva",
"Sara Vitória Ferreira de Santana"
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div className="container">
      {/* Logo principal: caderno com caneta e linhas, com leve flutuação */}
      <div className="logo">
        <svg className="floating" xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 64 64">
          {/* Caderno */}
          <rect x="10" y="8" width="44" height="48" rx="4" fill="#60a5fa" stroke="#1e293b" strokeWidth="2"/>
          {/* Linhas do caderno */}
          <line x1="14" y1="16" x2="50" y2="16" stroke="white" strokeWidth="1"/>
          <line x1="14" y1="24" x2="50" y2="24" stroke="white" strokeWidth="1"/>
          <line x1="14" y1="32" x2="50" y2="32" stroke="white" strokeWidth="1"/>
          <line x1="14" y1="40" x2="50" y2="40" stroke="white" strokeWidth="1"/>
          <line x1="14" y1="48" x2="50" y2="48" stroke="white" strokeWidth="1"/>
          {/* Caneta */}
          <rect x="45" y="5" width="6" height="20" rx="1" fill="#f59e0b" stroke="#1e293b" strokeWidth="1"/>
          <polygon points="45,5 51,5 48,0" fill="#dc2626"/>
        </svg>
      </div>

      <h1 className="title">
        Assistente para Inspirar a Construção de Textos
      </h1>

      <div className="tiles">
        <div className="tile circle" onClick={() => navigateTo('/story-generator')}>
          <span>Aplicativo</span>
        </div>
        <div className="tile square" onClick={() => navigateTo('/library')}>
          <span>Ver Biblioteca</span>
        </div>
      </div>

      <div className="buttons-row">
        <button className="about-btn" onClick={() => setShowModal(true)}>
          Sobre o Projeto
        </button>
        <button className="about-btn" onClick={() => setShowTeamModal(true)}>
          Equipe
        </button>
      </div>

      {/* Modal SOBRE */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Sobre o Projeto</h2>
            <p>
              O <strong>Gerador de Texto com Ilustração</strong> é um aplicativo interativo que utiliza
              inteligência artificial generativa para ajudar estudantes na construção de textos como preparação para a redação do ENEM.
              Seu objetivo é desenvolver o pensamento crítico, a criatividade e o domínio da escrita da língua portuguesa dos estudantes.
            </p>
            <button className="close-btn" onClick={() => setShowModal(false)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Modal EQUIPE */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Equipe</h2>
            <p>
              O projeto foi desenvolvido dentro da Bolsa de Fomento à Inovação da FACEPE (processo BFI-2062-1.03/25),
              vinculado ao Edital Nº 19/2025-FACEPE – Compet Médio-Tec: Habilidades de Futuro,
              por estudantes e professor da Escola Técnica Estadual Porto Digital (ETEPD), Recife-PE.
            </p>
            <ul className="team-list">
              {equipe.map((nome, index) => (
                <li key={index}>
                  {nome.includes("Fabrizio Barbosa Farias") ? (
                    <strong>{nome}</strong>
                  ) : (
                    nome
                  )}
                </li>
              ))}
            </ul>
            <button className="close-btn" onClick={() => setShowTeamModal(false)}>Fechar</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: linear-gradient(135deg, #dbeafe 0%, #f8fafc 50%, #e0f2fe 100%);
          background-size: 200% 200%;
          animation: gradientShift 12s ease infinite;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .floating {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0); }
        }

        .title {
          font-size: 25px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 40px;
          text-align: center;
          text-shadow: 0 2px 6px rgba(0,0,0,0.15);
          max-width: 90%;
        }

        .tiles {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 30px;
          margin-bottom: 20px;
        }

        .tile {
          width: 220px;
          height: 220px;
          background: rgba(255,255,255,0.25);
          backdrop-filter: blur(10px);
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
        }

        .tile.circle { border-radius: 50%; }
        .tile.square { border-radius: 15px; }
        .tile:hover { transform: translateY(-8px) scale(1.05); box-shadow:0 15px 35px rgba(0,0,0,0.15); }

        .buttons-row { display:flex; gap:20px; margin-top:20px; flex-wrap:wrap; justify-content:center; }
        .about-btn { padding: 12px 28px; border:none; border-radius:25px; background-color:#3b82f6; color:white; font-size:16px; font-weight:600; cursor:pointer; transition: background-color 0.3s ease, transform 0.3s ease; box-shadow: 0 6px 18px rgba(59,130,246,0.3); }
        .about-btn:hover { background-color:#2563eb; transform:translateY(-3px); }

        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter: blur(4px); display:flex; justify-content:center; align-items:center; animation: fadeIn 0.4s ease forwards; }
        .modal-content { background: rgba(255,255,255,0.95); border-radius:20px; padding:30px; width:90%; max-width:500px; box-shadow:0 20px 40px rgba(0,0,0,0.2); }

        .modal-content h2 { text-align:center; color:#1e293b; }
        .modal-content p { color:#334155; line-height:1.6; margin-top:15px; text-align:justify; }

        .team-list {
          margin-top:15px;
          padding-left:20px;
          color:#1e293b;
          line-height:1.8;
          list-style-type: disc;
        }

        .team-list strong {
          color: #0f172a;
        }

        .close-btn { margin-top:25px; padding:10px 20px; border:none; border-radius:20px; background-color:#ef4444; color:white; font-weight:600; cursor:pointer; display:block; margin:25px auto 0 auto; transition: background-color 0.3s ease; }
        .close-btn:hover { background-color:#dc2626; }
      `}</style>
    </div>
  );
}