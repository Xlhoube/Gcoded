# MEMORY.md - Gcoded

## 📋 Contexto Geral
- **Nome do Projecto:** Gcoded
- **Objectivo:** Criar um gerador de percursos de corte (CAM/toolpath generator) interativo para máquinas CNC, a correr no browser de forma 100% local e offline-first. O utilizador poderá criar ou importar desenhos, configurar parâmetros da fresadora, gerar percursos e exportar o G-code. Todos os dados são guardados localmente no browser (`localStorage`) e através de exportação de ficheiros JSON.
- **Data de Início:** 2026-08-21
- **Versão Actual:** v0.4.0
- **Nível de Risco:** 1 (Baixo - protótipo rápido, sem base de dados remota)
- **Ambiente de Deploy:** Vercel (servido como site estático)

---

## 🛠️ Stack Tecnológica & Justificação
- **Frontend:** HTML5, Vanilla CSS e Vanilla JavaScript.
  - *Justificação:* Totalmente estático e offline-first. As bibliotecas gráficas (como Fabric.js para desenho e manipulação de vetores, e Transformers.js para inferência neural de modelos de profundidade 3D) são carregadas via CDN.
- **Base de Dados / Persistência:** `localStorage` do browser e exportação manual para ficheiro JSON.
  - *Justificação:* Decidido pelo utilizador para manter todos os dados locais, sem necessidade de servidores ou bases de dados externas.
- **Servidor Local de Testes:** Servidor HTTP leve externo (ex: `npx serve`, `python -m http.server` ou extensão Live Server).
  - *Justificação:* Evita problemas com permissões de escrita do Google Drive (sem `node_modules` locais) e permite testar sem restrições de CORS.
- **Versionamento:** GitHub.

---

## ⚙️ Histórico de Decisões & ADR (Architecture Decision Records)
- **[2026-08-21] | DECISÃO-001 | Inicialização do Projecto**
  - **Contexto:** Definição da ideia geral (clone melhorado de Temujin CAM) e respostas às 5 perguntas de produto.
- **[2026-08-21] | DECISÃO-002 | Transição para Arquitectura Local-Only**
  - **Contexto:** Falhas sistemáticas do npm install na pasta sincronizada do Google Drive e preferência do utilizador por armazenamento local sem base de dados externa.
  - **Decisão:** Remover Appwrite e Vite do projecto local. Adotar HTML/CSS/JS estático puro com carregamento via CDN e armazenamento local via `localStorage`.
- **[2026-08-21] | DECISÃO-003 | Correcção do Fluxo de Limpeza e UX Premium**
  - **Contexto:** Nos testes automatizados, o uso do diálogo nativo `confirm()` bloqueava o teste e no browser degradava a estética premium.
  - **Decisão:** Remover `confirm()` e implementar um botão com confirmação de clique duplo com temporizador de expiração de 3 segundos no botão de "Limpar Tudo".
- **[2026-08-21] | DECISÃO-004 | Mesa de Corte Física e WCS Zero Customizável**
  - **Contexto:** O utilizador precisava de posicionar o desenho em relação à área de corte da máquina real e alinhar o percurso com a grelha central do NCViewer.
  - **Decisão:** O canvas passa a modelar a Mesa de Corte física. Implementámos um sistema flexível de Origem de Trabalho (WCS G54) móvel. A mira vermelha `X0 Y0` é desenhada directamente no canvas nos offsets correctos e as coordenadas G-code são convertidas de forma linear relativamente a este ponto zero.
- **[2026-08-21] | DECISÃO-005 | Navegação Premium com Zoom & Pan Sincronizados**
  - **Contexto:** Facilitar o desenho mecânico preciso de formas no browser.
  - **Decisão:** Adicionar botões flutuantes (➕, ➖, 🔍 1:1) e zoom dinâmico na roda do rato centrado no cursor. O Pan (arrasto) é mapeado no clique direito e botão central. O zoom/pan é sincronizado com a grelha de fundo aplicando a matriz de transformação do Fabric.js (`viewportTransform`) ao contexto 2D nativo do canvas.
- **[2026-08-21] | DECISÃO-006 | Cópia de Código Resiliente (Híbrida)**
  - **Contexto:** A API `navigator.clipboard` falhava em navegadores sem HTTPS num contexto de IP local ou localhost restrito.
  - **Decisão:** Desenvolver fluxo que executa primeiramente a instrução clássica `document.execCommand('copy')` em memória sobre uma textarea oculta temporária. A API moderna é mantida como redundância de reserva.
- **[2026-08-21] | DECISÃO-007 | Menu de Contexto e Alinhamento de Área Útil**
  - **Contexto:** O utilizador precisava de uma dropdown com opções no clique direito sobre objectos e as formas alinhadas com o ponto zero ficavam com metades em coordenadas negativas.
  - **Decisão:** Criado um menu de contexto personalizado (div flutuante glassmorphism). Ao centrar a peça, alterámos o pivot de `'center'` para `'left', 'bottom'` no Fabric.js para manter a peça no quadrante estritamente positivo (dentro da mesa).
- **[2026-08-21] | DECISÃO-008 | Biblioteca de Ferramentas (Tool Library) Persistida**
  - **Contexto:** O utilizador perdia tempo a digitar manualmente diâmetros, avanços e passos por descida da fresadora para cada novo desenho.
  - **Decisão:** Desenvolvida uma biblioteca de ferramentas persistida no `localStorage` com fresas predefinidas e botões de acção (➕/🗑️) para gerir fresas personalizadas.
- **[2026-08-21] | DECISÃO-009 | Gestor de Biblioteca de Ferramentas com Import/Export JSON**
  - **Contexto:** Necessidade de gerir fresas e lâminas de forma estruturada e partilhável (CRUD de ferramentas + backup).
  - **Decisão:** Criada uma janela modal de Gestão de Ferramentas (Tool Manager Modal) com listagem em tabela, formulário de cadastro dinâmico por módulo, e suporte nativo para exportar e importar a biblioteca inteira em formato JSON local.
- **[2026-09-01] | DECISÃO-010 | Motor de Deep Map 3D com Inferência Neural Local no Browser (Transformers.js)**
  - **Contexto:** A conversão 2D simples por escala de cinzentos causava deformações graves em fotografias (buracos em cabelos/barbas escuras e picos anormais em dentes). O utilizador pretendia um fluxo automatizado "One-Click" idêntico ao ArtCAM com modelos de volumetria real.
  - **Decisão:** Integração da biblioteca Transformers.js no browser com o modelo neural `Depth-Anything` (com fallback para `MiDaS` e Luminância 2D). Ao carregar a imagem, a IA extrai automaticamente a malha volumétrica 3D e gera o relevo na mesa com G-code raster 3D de alta precisão.

---

## 🔧 Estado do Projecto (Open Issues & TODO)
- [x] Criar interface UI/UX básica offline-first (Canvas de desenho + painel de parâmetros)
- [x] Implementar persistência dos parâmetros e desenhos no `localStorage`
- [x] Desenvolver motor básico de geração de G-code localmente
- [x] Integrar botão de cópia rápida infalível com feedback visual
- [x] Desenvolver sistema de parametrização de Mesa física e Origem de Trabalho (WCS) móvel
- [x] Desenvolver navegação premium por Zoom & Pan coordenados com a grelha de fundo
- [x] Corrigir loops infinitos de desenho de formas e empilhamento de estados
- [x] Implementar menu de contexto personalizado (clique direito) nos objectos
- [x] Corrigir alinhamento de peças para o primeiro quadrante positivo de trabalho (left/bottom)
- [x] Desenvolver biblioteca de ferramentas (Tool Library) com auto-preenchimento e persistência
- [x] Desenvolver Gestor de Biblioteca de Ferramentas (Tool Manager Modal) com importação/exportação JSON
- [x] Desenvolver Motor de AI Deep Map & Grayscale Relief Carving com IA no browser
- [ ] Desenvolver estratégia de corte "Exterior (Profile)" com compensação de raio da fresa
- [ ] Desenvolver estratégia de corte "Interior (Pocket)" para preenchimento de caixas
