// Função para extrair informações do usuário do texto
function extractUserDataFromStory(storyText) {
  const defaultData = {
    mainCharacter: "Não informado",
    plot: "Não informado", 
    ending: "Não informado",
    genre: "Não informado",
    literature: "Não informado"
  };

  // Primeiro, tenta extrair do formato estruturado no final do texto
  const infoSectionStart = "===INFORMAÇÕES DO USUÁRIO===";
  const infoSectionEnd = "==========================";
  
  const startIndex = storyText.indexOf(infoSectionStart);
  const endIndex = storyText.indexOf(infoSectionEnd);
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const infoText = storyText.substring(startIndex + infoSectionStart.length, endIndex);
    const lines = infoText.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      if (line.includes('Personagem Principal:')) {
        defaultData.mainCharacter = line.split('Personagem Principal:')[1]?.trim() || "Não informado";
      }
      if (line.includes('Enredo:')) {
        defaultData.plot = line.split('Enredo:')[1]?.trim() || "Não informado";
      }
      if (line.includes('Desfecho:')) {
        defaultData.ending = line.split('Desfecho:')[1]?.trim() || "Não informado";
      }
      if (line.includes('Gênero:')) {
        defaultData.genre = line.split('Gênero:')[1]?.trim() || "Não informado";
      }
      if (line.includes('Tipo de Literatura:')) {
        defaultData.literature = line.split('Tipo de Literatura:')[1]?.trim() || "Não informado";
      }
    });
    
    // Remove a seção de informações do texto principal para exibição
    const cleanStory = storyText.substring(0, startIndex).trim();
    return { ...defaultData, cleanStory };
  }
  
  // Se não encontrar formato estruturado, retorna o texto original
  return { ...defaultData, cleanStory: storyText };
}

// No componente StoriesPage:
export default function StoriesPage({ stories, error, timestamp }) {
  // ... código anterior ...
  
  const currentStory = stories[currentStoryIndex];
  
  // Extrair dados do usuário
  const userData = extractUserDataFromStory(currentStory.text || "");
  const displayStory = userData.cleanStory || currentStory.text;
  
  // Usar userData.mainCharacter, userData.plot, etc. no JSX
  // ... resto do código ...
}