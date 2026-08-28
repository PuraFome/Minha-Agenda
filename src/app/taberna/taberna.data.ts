import { Npc } from './taberna.types';

export const NPCS: Npc[] = [
  {
    id: 'dona-arruma',
    name: 'Dona Arruma',
    avatar: '🧹',
    role: 'Mãe / limpeza doméstica',
    greeting: 'Ai, meu filho, a casa não se arruma sozinha! Bora dar um jeito nisso, hein?',
    appearance: {
      kind: 'grandma',
      skinColor: '#f5d6c3',
      hairColor: '#d1d5db',
      outfitColor: '#7c3aed',
      accentColor: '#fbbf24',
      hairStyle: 'bun',
      accessory: 'glasses',
      expression: 'warm',
    },
    dialogTree: {
      startNodeId: 'start',
      nodes: {
        start: {
          id: 'start',
          text: 'Ai, meu filho! Que saudade! A casa tá um caos, sabe? Eu tento sozinha, mas com idade a gente não é mais como antes...',
          choices: [
            { text: 'Dona Arruma, o que posso fazer?', nextNodeId: 'offer-help' },
            { text: 'Pelo menos a cozinha está limpa!', nextNodeId: 'kitchen' },
          ],
        },
        'offer-help': {
          id: 'offer-help',
          text: 'Ai, que amor! Você é um anjo! Olha, tem umas coisinhas que eu preciso de ajuda. Mas não se assusta, tudo simples!',
          choices: [
            { text: 'Estou pronto para ajudar!', nextNodeId: 'missions', missionId: 'dona-arruma-m1' },
            { text: 'Me conta mais primeiro...', nextNodeId: 'details' },
          ],
        },
        kitchen: {
          id: 'kitchen',
          text: 'Cozinha? Limpa? Ah, que bom! Mas tem a louça acumulada lá, sabia? E o fogão precisa de uma força maior...',
          choices: [
            { text: 'Posso ajudar com a louça!', nextNodeId: 'missions', missionId: 'dona-arruma-m3' },
            { text: 'Me conta o que precisa.', nextNodeId: 'details' },
          ],
        },
        details: {
          id: 'details',
          text: 'Olha, eu tenho umas tarefas organizadinhas aqui. Tem coisa fácil pra começar, e umas mais pesadas quando você estiver mais forte!',
          choices: [
            { text: 'Mostre as tarefas!', nextNodeId: 'missions', missionId: 'dona-arruma-m2' },
          ],
        },
        missions: {
          id: 'missions',
          text: 'Prontinho, meu filho! Aqui, leve esta tarefa com você e me ajude a pôr a casa em ordem!',
          isEnd: true,
        },
      },
    },
    missions: [
      { templateId: 'dona-arruma-m1', title: 'Arrumar a cama', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'dona-arruma-m2', title: 'Varrer a sala', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'dona-arruma-m3', title: 'Lavar a louça acumulada', difficulty: 'media', prazoDays: 1, minFriendship: 0 },
      { templateId: 'dona-arruma-m4', title: 'Passar roupa a ferro', difficulty: 'dificil', prazoDays: 2, minFriendship: 3 },
      { templateId: 'dona-arruma-m5', title: 'Limpar o banheiro inteiro', difficulty: 'muito-dificil', prazoDays: 2, minFriendship: 5 },
      { templateId: 'dona-arruma-m6', title: 'Faxina geral de fim de semana', difficulty: 'epica', prazoDays: 3, minFriendship: 6 },
    ],
  },
  {
    id: 'capitao-compromisso',
    name: 'Capitão Compromisso',
    avatar: '📋',
    role: 'Produtividade / trabalho',
    greeting: 'Recruta! A ordem é não deixar pra depois. O compromisso é sagrado!',
    appearance: {
      kind: 'soldier',
      skinColor: '#d2a679',
      hairColor: '#1f2937',
      outfitColor: '#166534',
      accentColor: '#dc2626',
      hairStyle: 'military',
      expression: 'stern',
    },
    dialogTree: {
      startNodeId: 'start',
      nodes: {
        start: {
          id: 'start',
          text: 'Recruta! Chegou na hora certa! Tem muita coisa pra resolver e o tempo não espera. Relatório, e-mails, agenda...',
          choices: [
            { text: 'Capitão, reporting for duty!', nextNodeId: 'report' },
            { text: 'Tá meio tenso por aqui...', nextNodeId: 'tense' },
          ],
        },
        report: {
          id: 'report',
          text: 'Bom! Atitude de soldado! Mas antes de sair atirando, preciso saber: você está preparado pra uma missão leve ou quer algo mais pesado?',
          choices: [
            { text: 'Missão leve pra aquecer!', nextNodeId: 'easy' },
            { text: 'Direto pro pesado!', nextNodeId: 'hard' },
          ],
        },
        tense: {
          id: 'tense',
          text: 'Tenso? Recruta, tenso é ficar sem cumprir prazo! Mas tranquilo, vou te guiar. Primeiro as coisas simples, depois o pesado.',
          choices: [
            { text: 'Entendido, capitão!', nextNodeId: 'easy' },
            { text: 'Pode mandar as ordens!', nextNodeId: 'missions', missionId: 'capitao-compromisso-m2' },
          ],
        },
        easy: {
          id: 'easy',
          text: 'Ótimo! Vamos começar com tarefas rápidas. E-mails e anotações são o básico de todo soldado produtivo!',
          choices: [
            { text: 'Aceito a missão!', nextNodeId: 'missions', missionId: 'capitao-compromisso-m1' },
          ],
        },
        hard: {
          id: 'hard',
          text: 'Impressionante! Você tem garra! Mas lembre-se: até o mais forte soldado precisa descansar. Escolha sabiamente!',
          choices: [
            { text: 'Estou pronto, capitão!', nextNodeId: 'missions', missionId: 'capitao-compromisso-m4' },
          ],
        },
        missions: {
          id: 'missions',
          text: 'Atenção, recruta! Esta é a sua ordem do dia. Cumpra-a com honra e volte para o próximo combate!',
          isEnd: true,
        },
      },
    },
    missions: [
      { templateId: 'capitao-compromisso-m1', title: 'Responder e-mails pendentes', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'capitao-compromisso-m2', title: 'Anotar as tarefas do dia', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'capitao-compromisso-m3', title: 'Organizar a agenda da semana', difficulty: 'media', prazoDays: 2, minFriendship: 0 },
      { templateId: 'capitao-compromisso-m4', title: 'Entregar aquele relatório', difficulty: 'dificil', prazoDays: 3, minFriendship: 3 },
      { templateId: 'capitao-compromisso-m5', title: 'Planejar o projeto do mês', difficulty: 'muito-dificil', prazoDays: 5, minFriendship: 5 },
      { templateId: 'capitao-compromisso-m6', title: 'Fechar a pauta anual', difficulty: 'epica', prazoDays: 7, minFriendship: 6 },
    ],
  },
  {
    id: 'mestre-cadencia',
    name: 'Mestre Cadência',
    avatar: '🎵',
    role: 'Estudos / música',
    greeting: 'Tudo tem seu ritmo, aprendiz. Vamos entrar na cadência dos estudos?',
    appearance: {
      kind: 'bard',
      skinColor: '#c68642',
      hairColor: '#047857',
      outfitColor: '#1e40af',
      accentColor: '#f59e0b',
      hairStyle: 'long',
      accessory: 'hat',
      expression: 'mysterious',
    },
    dialogTree: {
      startNodeId: 'start',
      nodes: {
        start: {
          id: 'start',
          text: 'Ah, ouço um passo novo ecoando no meu salão de estudos... Você busca conhecimento ou simplesmente veio ouvir minha música?',
          choices: [
            { text: 'Busco sabedoria, mestre!', nextNodeId: 'wisdom' },
            { text: 'Sua música me trouxe aqui.', nextNodeId: 'music' },
          ],
        },
        wisdom: {
          id: 'wisdom',
          text: 'Sabedoria... como uma nota que ressoa eternamente. Diga-me: você prefere estudar em ritmo lento e constante ou em burstos de energia?',
          choices: [
            { text: 'Ritmo constante e sereno.', nextNodeId: 'steady' },
            { text: 'Burstos de energia total!', nextNodeId: 'burst' },
          ],
        },
        music: {
          id: 'music',
          text: 'A música é a linguagem da alma... Mas para tocar uma sinfonia, primeiro precisa aprender as notas. Vamos às lições?',
          choices: [
            { text: 'Estou pronto para aprender!', nextNodeId: 'missions', missionId: 'mestre-cadencia-m1' },
            { text: 'Mostre-me o caminho.', nextNodeId: 'steady' },
          ],
        },
        steady: {
          id: 'steady',
          text: 'Excelente! A constância é a mãe da maestria. Tenho tarefas perfeitas para quem busca o ritmo certo...',
          choices: [
            { text: 'Guie-me, mestre!', nextNodeId: 'missions', missionId: 'mestre-cadencia-m2' },
          ],
        },
        burst: {
          id: 'burst',
          text: 'Energia! O fogo que move montanhas! Mas lembre-se: até o mais forte trovão precisa de silêncio entre os relâmpagos...',
          choices: [
            { text: 'Entendido, mestre!', nextNodeId: 'missions', missionId: 'mestre-cadencia-m3' },
          ],
        },
        missions: {
          id: 'missions',
          text: 'Eis sua lição, aprendiz. Pratique com devoção e, aos poucos, a cadência virá até você.',
          isEnd: true,
        },
      },
    },
    missions: [
      { templateId: 'mestre-cadencia-m1', title: 'Estudar 30 minutos', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'mestre-cadencia-m2', title: 'Revisar as anotações', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'mestre-cadencia-m3', title: 'Fazer um exercício prático', difficulty: 'media', prazoDays: 1, minFriendship: 0 },
      { templateId: 'mestre-cadencia-m4', title: 'Ler um capítulo inteiro', difficulty: 'dificil', prazoDays: 2, minFriendship: 3 },
      { templateId: 'mestre-cadencia-m5', title: 'Ensaiar uma música nova', difficulty: 'muito-dificil', prazoDays: 3, minFriendship: 5 },
      { templateId: 'mestre-cadencia-m6', title: 'Montar o resumo do semestre', difficulty: 'epica', prazoDays: 5, minFriendship: 6 },
    ],
  },
  {
    id: 'frei-equilibrio',
    name: 'Frei Equilibrio',
    avatar: '🧘',
    role: 'Saúde / exercício',
    greeting: 'A mente sã habita o corpo em equilíbrio. Respire fundo e vamos.',
    appearance: {
      kind: 'monk',
      skinColor: '#fbbf24',
      hairColor: '#92400e',
      outfitColor: '#b91c1c',
      accentColor: '#047857',
      hairStyle: 'bald',
      expression: 'wise',
    },
    dialogTree: {
      startNodeId: 'start',
      nodes: {
        start: {
          id: 'start',
          text: 'A Paz esteja com você, jovem viajante. Vejo nos seus olhos alguém que busca harmonia entre corpo e mente...',
          choices: [
            { text: 'Preciso de equilíbrio, frei.', nextNodeId: 'balance' },
            { text: 'Estou cansado de tudo.', nextNodeId: 'tired' },
          ],
        },
        balance: {
          id: 'balance',
          text: 'O equilíbrio é uma jornada, não um destino. Olhe para dentro: o que sente que falta hoje? Força? Resistência? Paz?',
          choices: [
            { text: 'Preciso de força!', nextNodeId: 'strength' },
            { text: 'Quero resistência.', nextNodeId: 'endurance' },
          ],
        },
        tired: {
          id: 'tired',
          text: 'Cansaço é o corpo pedindo pausa. Mas lembre-se: descansar não é desistir. Vamos encontrar o caminho de volta...',
          choices: [
            { text: 'Me mostre o caminho.', nextNodeId: 'missions', missionId: 'frei-equilibrio-m2' },
            { text: 'Preciso de ar fresco.', nextNodeId: 'endurance' },
          ],
        },
        strength: {
          id: 'strength',
          text: 'Força vem de pequenos passos! Comece leve, cresça devagar. Tenho tarefas perfeitas para forjar seu corpo...',
          choices: [
            { text: 'Aceito o desafio!', nextNodeId: 'missions', missionId: 'frei-equilibrio-m1' },
          ],
        },
        endurance: {
          id: 'endurance',
          text: 'Resistência é como uma árvore: flexível, mas enraizada. Vamos plantar suas sementes de vigor?',
          choices: [
            { text: 'Estou pronto para crescer!', nextNodeId: 'missions', missionId: 'frei-equilibrio-m2' },
          ],
        },
        missions: {
          id: 'missions',
          text: 'Vá, jovem. Esta prática é um passo na sua jornada de equilíbrio. Faça com presença.',
          isEnd: true,
        },
      },
    },
    missions: [
      { templateId: 'frei-equilibrio-m1', title: 'Beber 2L de água', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'frei-equilibrio-m2', title: 'Caminhar 30 minutos', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'frei-equilibrio-m3', title: 'Alongar o corpo', difficulty: 'media', prazoDays: 1, minFriendship: 0 },
      { templateId: 'frei-equilibrio-m4', title: 'Treinar força 40 min', difficulty: 'dificil', prazoDays: 2, minFriendship: 3 },
      { templateId: 'frei-equilibrio-m5', title: 'Corrida de 5km', difficulty: 'muito-dificil', prazoDays: 3, minFriendship: 5 },
      { templateId: 'frei-equilibrio-m6', title: 'Desafio de 30 dias de saúde', difficulty: 'epica', prazoDays: 30, minFriendship: 6 },
    ],
  },
  {
    id: 'barao-orcamento',
    name: 'Barão do Orçamento',
    avatar: '💰',
    role: 'Finanças',
    greeting: 'Meus centavos, meus domínios! Vamos pôr as contas em ordem?',
    appearance: {
      kind: 'baron',
      skinColor: '#f5d6c3',
      hairColor: '#1f2937',
      outfitColor: '#1e3a5f',
      accentColor: '#c05621',
      hairStyle: 'short',
      accessory: 'monocle',
      expression: 'jolly',
    },
    dialogTree: {
      startNodeId: 'start',
      nodes: {
        start: {
          id: 'start',
          text: 'Ah, um visitante! Venha, venha! Vejo que busca prosperidade! Cada centavo conta, cada real é um soldado no seu exército financeiro!',
          choices: [
            { text: 'Barão, preciso organizar minhas finanças!', nextNodeId: 'organize' },
            { text: 'Estou quebrado...', nextNodeId: 'broke' },
          ],
        },
        organize: {
          id: 'organize',
          text: 'Organizar? FAZENDA BEM GERIDA! Vamos classificar: o que é urgente? O que pode esperar?',
          choices: [
            { text: 'Urgente! Contas a pagar!', nextNodeId: 'urgent' },
            { text: 'Quero planejar o futuro.', nextNodeId: 'future' },
          ],
        },
        broke: {
          id: 'broke',
          text: 'Quebrado? NUNCA! Você está em fase de REESTRUTURAÇÃO! Todo império começou com um centavo. Vamos contar seus soldados?',
          choices: [
            { text: 'Sim, me ajude a contar!', nextNodeId: 'missions', missionId: 'barao-orcamento-m1' },
            { text: 'Como começar?', nextNodeId: 'urgent' },
          ],
        },
        urgent: {
          id: 'urgent',
          text: 'URGENTE! Não se acalme! Tenho tarefas rápidas pra tapar buracos. Depois planejamos o império!',
          choices: [
            { text: 'Às armas, barão!', nextNodeId: 'missions', missionId: 'barao-orcamento-m2' },
          ],
        },
        future: {
          id: 'future',
          text: 'PLANEJAMENTO! A arma secreta dos Barões! Vamos construir um castelo tijolo por tijolo, centavo por centavo!',
          choices: [
            { text: 'Construiremos juntos!', nextNodeId: 'missions', missionId: 'barao-orcamento-m3' },
          ],
        },
        missions: {
          id: 'missions',
          text: 'Excelente! Esta é a sua missão financeira. Cada centavo bem cuidado é uma vitória sobre o caos!',
          isEnd: true,
        },
      },
    },
    missions: [
      { templateId: 'barao-orcamento-m1', title: 'Anotar os gastos do dia', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'barao-orcamento-m2', title: 'Conferir o saldo da conta', difficulty: 'facil', prazoDays: 1, minFriendship: 0 },
      { templateId: 'barao-orcamento-m3', title: 'Revisar assinaturas', difficulty: 'media', prazoDays: 2, minFriendship: 0 },
      { templateId: 'barao-orcamento-m4', title: 'Pagar a conta à vista', difficulty: 'dificil', prazoDays: 3, minFriendship: 3 },
      { templateId: 'barao-orcamento-m5', title: 'Montar a reserva de emergência', difficulty: 'muito-dificil', prazoDays: 7, minFriendship: 5 },
      { templateId: 'barao-orcamento-m6', title: 'Planejar o orçamento anual', difficulty: 'epica', prazoDays: 14, minFriendship: 6 },
    ],
  },
];
