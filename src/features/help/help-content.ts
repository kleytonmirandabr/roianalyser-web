/**
 * Conteúdo da central de ajuda — uma entrada por tela/feature do sistema.
 *
 * `slug` é a chave usada pra associar a entrada à URL atual (via match de
 * `pathPattern` ou comparação direta). `pathPattern` é regex string testado
 * contra `location.pathname` pra resolver o tópico do `<HelpButton>` no header.
 *
 * Conteúdo é texto simples (sem HTML/MD por enquanto pra evitar parser
 * adicional). Se ficar limitado, plugar `react-markdown` em outra sprint.
 */

export type HelpTopic = {
  slug: string
  /** Categoria — usada pra agrupar no índice. */
  category: 'fluxo' | 'projeto' | 'admin' | 'sistema'
  /** Título exibido no índice e no painel. */
  title: string
  /** URL principal da feature (atalho clicável). */
  path: string
  /** Regex pra match com URL atual (default: pathPattern começa com `path`). */
  pathPattern?: RegExp
  /** Resumo curto exibido no índice. */
  summary: string
  /** Conteúdo completo: array de seções (parágrafo ou lista). */
  sections: HelpSection[]
}

export type HelpSection =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'tip'; text: string }
  | { kind: 'shortcut'; keys: string; description: string }

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: 'dashboard',
    category: 'fluxo',
    title: 'Dashboard',
    path: '/dashboard',
    summary: 'Visão geral do tenant: KPIs, projetos recentes e distribuição por status.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'O Dashboard mostra a saúde do seu pipeline e portfolio em uma tela. '+
          'Os 6 cards no topo trazem indicadores fechados (total de projetos, atualizados nos últimos 7 dias, etc).',
      },
      {
        kind: 'list',
        items: [
          'Receita líquida (tenant): soma de receita esperada de todos os projetos com Entradas Dinâmicas.',
          'Resultado consolidado: receita menos custo de todos os projetos.',
          'Margem média: (resultado / receita) — útil pra ver se o pipeline está saudável.',
          'Atualizações recentes: últimos projetos modificados, com link direto.',
          'Distribuição por status: barras horizontais com count e cor de cada status.',
        ],
      },
    ],
  },
  {
    slug: 'projects-list',
    category: 'fluxo',
    title: 'Lista de Projetos',
    path: '/projects',
    pathPattern: /^\/projects\/?$/,
    summary: 'Tabela com todos os projetos do tenant ativo.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'A lista mostra todos os projetos do tenant. Cada coluna tem ícone de funil pra filtrar por valores únicos e botão de sort no rótulo.',
      },
      {
        kind: 'tip',
        text:
          'Use "Apenas meus" pra filtrar projetos onde você é responsável, está no time ou em uma tarefa.',
      },
      {
        kind: 'shortcut',
        keys: 'Ctrl/⌘ + B',
        description: 'Recolhe ou expande a sidebar pra ganhar espaço.',
      },
    ],
  },
  {
    slug: 'projects-board',
    category: 'fluxo',
    title: 'Kanban de Oportunidades',
    path: '/projects/board',
    summary: 'Cards arrastáveis entre colunas pra mudar status do projeto.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'O Kanban agrupa projetos pelo status. Arrastar um card pra outra coluna muda o status — útil pra time comercial atualizar pipeline rápido.',
      },
      {
        kind: 'list',
        items: [
          'Cards mostram cliente, valor estimado, responsável e prazo final.',
          'Header da coluna mostra contagem e valor total acumulado.',
          'Filtros no topo: busca livre, responsável, valor mínimo.',
        ],
      },
    ],
  },
  {
    slug: 'projects-funnel',
    category: 'fluxo',
    title: 'Funil de Vendas',
    path: '/projects/funnel',
    summary: 'Etapas do funil com taxa de conversão entre elas.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'O funil mostra quantos projetos estão em cada etapa, valor consolidado e ticket médio. A taxa de conversão exibe quantos % daquele estágio chegaram do anterior — útil pra identificar onde leads "vazam".',
      },
      {
        kind: 'tip',
        text:
          'Taxa abaixo de 50% (em amber) indica gargalo. Considere revisar critérios de qualificação ou treinamento da equipe naquela etapa.',
      },
    ],
  },
  {
    slug: 'projects-lost',
    category: 'fluxo',
    title: 'Projetos Perdidos',
    path: '/projects/lost',
    summary: 'Análise de oportunidades perdidas: motivos, tempo médio, valor.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Lista projetos em status de "perda" ou "cancelado". KPIs mostram valor total perdido, win rate e tempo médio até a perda.',
      },
      {
        kind: 'tip',
        text:
          'Cadastre o catálogo "Motivos de Perda" pra capturar dados estruturados que alimentam insights automáticos.',
      },
    ],
  },
  {
    slug: 'project-detail',
    category: 'projeto',
    title: 'Detalhe do Projeto',
    path: '/projects/:id',
    pathPattern: /^\/projects\/[^/]+/,
    summary: 'Hub do projeto com 10 abas: info, financeiro, tasks, comentários, etc.',
    sections: [
      {
        kind: 'list',
        items: [
          'Informações: nome, status, cliente, responsável, time, custom fields.',
          'Resumo & Gráfico: KPIs financeiros e visualização do ROI.',
          'Entradas Dinâmicas: itens do projeto (HW, SW, serviços) que alimentam o cálculo.',
          'Financeiro: cash flow mês a mês.',
          'Forecast: previsto × realizado por mês.',
          'Cronograma: marcos de entrega com Gantt visual.',
          'Anexos: links externos pra contratos, propostas, NF.',
          'Tarefas: ações com responsável, data e tipo.',
          'Comentários: feed de discussão do time.',
          'Histórico: log automático de tudo que mudou.',
        ],
      },
    ],
  },
  {
    slug: 'project-entries',
    category: 'projeto',
    title: 'Entradas Dinâmicas',
    path: '/projects/:id/entradas',
    pathPattern: /\/entradas$/,
    summary: 'Itens do catálogo aplicados ao projeto pra calcular ROI.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Adicione linhas escolhendo um Item do Catálogo. Os defaults do item (valor, duração, parcelas, início) são herdados automaticamente — você só ajusta o que precisar.',
      },
      {
        kind: 'tip',
        text:
          'Cadastre Categorias de Item, Unidades de Cobrança e Tipos Financeiros antes — eles populam o catálogo e o motor de cálculo.',
      },
    ],
  },
  {
    slug: 'project-schedule',
    category: 'projeto',
    title: 'Cronograma',
    path: '/projects/:id/schedule',
    pathPattern: /\/schedule$/,
    summary: 'Marcos de entrega com Gantt visual e variação previsto vs realizado.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Cadastre marcos com data prevista e responsável. Quando a entrega acontece, marque a data realizada — o sistema calcula automaticamente quem está atrasado.',
      },
      {
        kind: 'list',
        items: [
          'Gantt visual no topo: barras coloridas por status, marker da data prevista, círculo da data realizada.',
          'Linha tracejada vertical mostra "hoje" pra referência.',
          'Hover em qualquer marco mostra detalhes e variação em dias.',
        ],
      },
    ],
  },
  {
    slug: 'project-comments',
    category: 'projeto',
    title: 'Comentários',
    path: '/projects/:id/comments',
    pathPattern: /\/comments$/,
    summary: 'Feed de discussão do time sobre o projeto.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Use comentários pra registrar decisões, dúvidas e contexto que não cabe nas tarefas. Diferente do histórico (eventos automáticos), aqui é texto humano.',
      },
      {
        kind: 'shortcut',
        keys: 'Ctrl/⌘ + Enter',
        description: 'Envia o comentário do composer.',
      },
      {
        kind: 'tip',
        text:
          'Marque comentários como "resolvido" quando a discussão chegar a uma decisão. Eles ficam visíveis mas atenuados.',
      },
    ],
  },
  {
    slug: 'me',
    category: 'fluxo',
    title: 'Minha Agenda',
    path: '/me',
    summary: 'Suas pendências do dia: tarefas, marcos, aprovações.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Mostra projetos onde você é responsável ou está no time. Lista tarefas atrasadas e do dia, marcos próximos, projetos parados (sem update há +7 dias) e aprovações esperando você.',
      },
    ],
  },
  {
    slug: 'forecast',
    category: 'fluxo',
    title: 'Rolling Forecast',
    path: '/forecast',
    summary: 'Projeção consolidada de receita do tenant inteiro com what-if.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Soma a receita esperada de todos os projetos por mês calendário, dentro de uma janela rolante. Os cenários (Base / Otimista / Pessimista) permitem ajustar projetos individuais e ver o impacto consolidado.',
      },
      {
        kind: 'tip',
        text:
          'Configure o ano fiscal e horizonte do Rolling em /admin/clients pra alinhar com seu período contábil.',
      },
    ],
  },
  {
    slug: 'catalogs',
    category: 'sistema',
    title: 'Catálogos',
    path: '/catalogs',
    summary: 'Listas de apoio: empresas, contatos, status, tipos de contrato, etc.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Catálogos populam selects e validam dados em todo o sistema. Estão agrupados por contexto: CRM, Projeto, Itens e Pessoas.',
      },
      {
        kind: 'tip',
        text:
          'Em "Status de Projeto" você pode arrastar pra reordenar (não precisa setar order manualmente). A categoria liga o status a automações do sistema (won, lost, execution, etc).',
      },
    ],
  },
  {
    slug: 'admin',
    category: 'admin',
    title: 'Administração',
    path: '/admin',
    summary: 'Configuração cross-tenant: usuários, perfis, planos, marca.',
    sections: [
      {
        kind: 'list',
        items: [
          'Usuários: cadastro de pessoas com acesso. Master pode definir multi-tenant (clientIds[]).',
          'Perfis: agrupamentos de funcionalidades (Admin, Comercial, Delivery, Financeiro).',
          'Planos: planos de assinatura cross-tenant.',
          'Funcionalidades: lista master de features que perfis/planos consomem.',
          'Clientes: tenants que usam o sistema. Logo, fuso, ano fiscal.',
          'Workflow: regras de transição de status (Sprint D).',
          'Marca: nome do sistema, logo, favicon. Master only.',
        ],
      },
      {
        kind: 'tip',
        text:
          'Só usuários Master conseguem promover outros usuários a Master e atribuir múltiplos clientes a um mesmo usuário.',
      },
    ],
  },
  {
    slug: 'reports',
    category: 'fluxo',
    title: 'Relatórios',
    path: '/reports',
    summary: 'Relatórios pré-configurados e agendados.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Relatórios são dashboards salvos com filtros pré-aplicados. Podem ser agendados pra envio recorrente por e-mail (semanal, mensal).',
      },
    ],
  },
  {
    slug: 'imports',
    category: 'sistema',
    title: 'Importações CSV',
    path: '/imports',
    summary: 'Wizards pra importar empresas, contatos e oportunidades em lote.',
    sections: [
      {
        kind: 'paragraph',
        text:
          'Carregue um CSV, mapeie as colunas pros campos do sistema, faça preview de validação e confirme. Duplicatas são detectadas e você decide se pula ou sobrescreve.',
      },
    ],
  },
]

/** Resolve o tópico mais apropriado pra uma URL. null se nenhum bater. */
export function resolveTopic(pathname: string): HelpTopic | null {
  // Primeiro tenta match exato.
  const exact = HELP_TOPICS.find((t) => t.path === pathname)
  if (exact) return exact
  // Depois tenta pathPattern.
  for (const topic of HELP_TOPICS) {
    if (topic.pathPattern && topic.pathPattern.test(pathname)) return topic
  }
  // Por último, prefix match — pega o tópico cujo path é mais específico.
  const candidates = HELP_TOPICS.filter((t) => pathname.startsWith(t.path))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.path.length - a.path.length)
  return candidates[0]
}

/** Agrupa os tópicos por categoria pra renderizar índice na página /help. */
export function groupByCategory(): Record<HelpTopic['category'], HelpTopic[]> {
  const out: Record<HelpTopic['category'], HelpTopic[]> = {
    fluxo: [],
    projeto: [],
    admin: [],
    sistema: [],
  }
  for (const t of HELP_TOPICS) out[t.category].push(t)
  return out
}
