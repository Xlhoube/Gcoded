# MEMORY.md - Gcoded

## 📋 Contexto Geral
- **Nome do Projecto:** Gcoded
- **Objectivo:** Criar um gerador de percursos de corte (CAM/toolpath generator) interativo para máquinas CNC, a correr no browser de forma 100% local e offline-first. O utilizador poderá criar ou importar desenhos, configurar parâmetros da fresadora, gerar percursos e exportar o G-code. Todos os dados são guardados localmente no browser (`localStorage`) e através de exportação de ficheiros JSON.
- **Data de Início:** 2026-08-21
- **Versão Actual:** v0.8.1
- **Nível de Risco:** 1 (Baixo - protótipo rápido, sem base de dados remota)
- **Ambiente de Deploy:** Vercel (servido como site estático)

---

## 🛠️ Stack Tecnológica & Justificação
- **Frontend:** HTML5, Vanilla CSS e Vanilla JavaScript.
  - *Justificação:* Totalmente estático e offline-first. Bibliotecas externas são carregadas via CDN: Fabric.js (desenho vetorial 2D), Three.js + OrbitControls (simulação 3D WebGL de maquinação CNC) e Transformers.js (inferência neural local de profundidade).
- **Base de Dados / Persistência:** `IndexedDB` para dados volumosos (mapas de profundidade e imagens de relevo 3D), `localStorage` para definições e geometrias vetoriais ligeiras, e exportação manual para ficheiro JSON.
  - *Justificação:* O `localStorage` tem limite estrito de ~5MB, estourando rapidamente ao serializar Float32Array de relevos 3D de alta resolução. O `IndexedDB` suporta armazenamento assíncrono de centenas de megabytes no browser local sem falhas.
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
- **[2026-10-23] | DECISÃO-011 | Correcção Crítica de Geometria CAM e Orientação de Relevo**
  - **Contexto:** A auditoria detectou que linhas diagonais saíam horizontais (`getCoords()` bounding box), retângulos distorciam com zoom/pan, relevo 3D ficava invertido no eixo Y (de pernas para o ar) e o modo luminância gerava mapas de profundidade planos por offset incorreto de canal alfa.
  - **Decisão:** Migração da extração de coordenadas para geometria local com `calcTransformMatrix()` e `calcLinePoints()`, inversão do eixo V no rastreio Z do relevo (`1 - y/h`) e correcção do índice do canal alfa (`i*4+3`). Validado via testes automatizados E2E.
- **[2026-10-23] | DECISÃO-012 | Retracções de Segurança CAM e Protecção de Material em Relevo**
  - **Contexto:** Subpaths de SVGs complexos (ex: ilhas/buracos) eram cortados continuamente sem levantar a fresa; contornos abertos em múltiplas passagens Z atravessavam a peça em G1 ao voltar ao início; e o relevo 3D não validava a profundidade contra a espessura do material e mergulhava à velocidade rápida XY.
  - **Decisão:** Decomposição de caminhos em subpaths atómicos com retracção `G0 Z_safe` entre cada um; verificação de contorno aberto para reposicionar em altura segura antes de cada nova passagem Z; mergulho inicial em relevo com `feedZ`; e bloqueio preventivo de segurança se `maxDepth > materialZ`.
- **[2026-10-23] | DECISÃO-013 | Persistência Fiável de Relevo 3D e Mapas de Profundidade via IndexedDB**
  - **Contexto:** Relevos 3D continham mapas de profundidade `Float32Array` volumosos. Guardá-los no `localStorage` gerava `QuotaExceededError` ou perda silenciosa dos dados de relevo ao fechar ou recarregar o browser, impossibilitando a regeneração posterior de G-code 3D.
  - **Decisão:** Implementação de base de dados IndexedDB local (`gcoded_db`, store `reliefs`). O `saveAppState` isola metadados ligeiros no `localStorage` e persiste matrizes de profundidade e imagens no `IndexedDB`. O `loadAppState` reconstrói o objecto no Fabric.js restaurando `depthMap`, `reliefWidth` e `reliefHeight`, garantindo integridade na geração de G-code após reload (F5).
- **[2026-10-23] | DECISÃO-014 | Simulador 3D WebGL, Arcos G2/G3 Nativos e Reformulação Exclusiva para CNC Routers**
  - **Contexto:** Inspirado na engenharia reversa do NCViewer, o software necessitava de feedback visual tridimensional em tempo real para inspeção prévia de código G-code, eliminação de facetação poligonal em círculos, e remoção de módulos legados irrelevantes (lâminas de arrasto e facas oscilantes EOT), focando a aplicação a 100% em fresagem e CNC Routers.
  - **Decisão:** 
    1. **Fase 1 (Parser & Verificador Preventivo):** Implementado motor modal de análise G-code para extrair Bounding Box X/Y/Z, cálculo rigoroso de tempo estimado de maquinação (considerando avanços de corte e avanço rápido de 3000 mm/min) e alerta de segurança proativo em caso de invasão de limites da mesa ou mergulho inferior à espessura do material.
    2. **Fase 2 (Arcos Nativos G2/G3):** Otimizador CAM com suporte a interpolação circular nativa usando vetores relativos I e J no plano XY (G17), gerando círculos e curvas suaves de elevada precisão com código G-code limpo e compacto.
    3. **Fase 3 (Simulador 3D WebGL com Three.js):** Renderização tridimensional interativa com mesa de trabalho em grelha cinzenta e origens X/Y/Z, bloco de material translúcido iluminado, linhas tridimensionais diferenciadas por cor (vermelho para G0 rápido, azul para G1/G2/G3 de corte), ferramenta/fresa animada em 3D, painel DRO digital (X, Y, Z, F e Linha) e barra de controlo de reprodução (Play, Pausa, Reset, Timeline e velocidades 0.5x até 10x).
- **[2026-10-23] | DECISÃO-015 | Visualização 2D de Relevo, Feedback Táctil CAM e Notificação Toast**
  - **Contexto:** Ao clicar em "Gerar Trajectória" com uma imagem de relevo na mesa, o canvas 2D não desenhava qualquer percurso visual (ao contrário dos contornos vectoriais que recebiam linhas azuis tracejadas), a consola G-code ficava no fundo da barra lateral fora da visão imediata e não havia feedback de estado no botão, levando o utilizador a concluir que "nada acontecia".
  - **Decisão:** 
    1. Amostragem e renderização no Canvas 2D das linhas raster em zigue-zague de maquinação (em azul `#60a5fa`) sobre a imagem do relevo, dando feedback visual instantâneo do corte sobre a peça.
    2. Feedback reactivo no botão `btnGenerate`: transição imediata para `⏳ A gerar trajectória...` e conclusão com `✅ Trajectória Gerada!` em verde néon.
    3. Notificação Toast flutuante (`#cam-toast`) com atalho direto `[👁️ Abrir Simulador 3D]` e pulso dinâmico no botão do simulador.
    4. Scroll automático suave para o cartão de estatísticas e consola G-code.
    5. Protecção resiliente de dados: caso um objecto de imagem não possua temporariamente `reliefSettings` ou `depthMap`, o sistema regenera-os dinamicamente em tempo de execução sem falhas silenciosas.
- **[2026-10-23] | DECISÃO-016 | Resolução de Cache do Browser (Cache Busting v=0.5.2) e Transição 3D Automática**
  - **Contexto:** O browser do utilizador mantinha em cache agressivo a versão anterior do script `src/app.js` servido pelo servidor local, e o listener `DOMContentLoaded` em scripts do tipo módulo (`type="module"`) corria risco de não disparar caso o documento já estivesse no estado `interactive`/`complete`.
  - **Decisão:**
    1. **Cache Busting Forçado:** Adicionado parâmetro de versão `src/app.js?v=0.5.2` em `index.html`, obrigando o browser a descarregar o novo código imediatamente.
    2. **Inicialização Resiliente:** Substituição de `DOMContentLoaded` cego por verificação de `document.readyState` (`if (document.readyState === 'loading') ... else init()`).
    3. **Transição Automática para 3D:** Ao gerar a trajectória de um relevo 3D, a aplicação comuta automaticamente e de forma suave para o separador `[👁️ Simulador 3D (WebGL)]` e inicia a maquinação da fresa em tempo real, eliminando qualquer dúvida visual.
- **[2026-10-23] | DECISÃO-017 | Eliminação de ReferenceError residual em generateGCode**
  - **Contexto:** Ao clicar em `⚙️ Gerar Trajectória`, o motor gerava `ReferenceError: selectToolModule is not defined (app.js:2535:24)` devido a uma referência residual à variável do módulo legado que foi removida na reformulação para CNC Router.
  - **Decisão:** Removida a linha `const toolModule = selectToolModule ? selectToolModule.value : 'spindle';`, eliminando a causa raiz do erro. Forçado cache busting com `?v=0.5.3` em `index.html`.
- **[2026-10-31] | DECISÃO-018 | Importador Nativo DXF com Costura de Contornos e Drag & Drop (Passo 1/3 REA)**
  - **Contexto:** Necessidade de importar ficheiros padrão de CAD mecânico (AutoCAD / SolidWorks / LibreCAD) sem requisições de rede ou dependências externas, inspirado na análise de engenharia reversa do Layerling (`dxfImport.ts`).
  - **Decisão:**
    1. Implementada classe `DxfReader` em JavaScript puro para leitura das entidades `LINE`, `CIRCLE`, `ARC`, `LWPOLYLINE` com fatores de curvatura (*bulges*), conversão de `$INSUNITS` (polegadas para mm) e inversão vertical coordenada para o canvas.
    2. Desenvolvido algoritmo `stitchPieces` que une extremidades de segmentos contíguos com tolerância de 0.05mm em contornos fechados contínuos (`Z`), evitando paragens e retracções desnecessárias da fresa.
    3. Adicionado suporte completo para arrastar e largar ficheiros (.dxf, .svg, imagens) diretamente sobre a mesa CNC (`#canvas-area.drop-active`).
    4. Forçado incremento de versão para `v0.6.0` com cache busting no `index.html`.
- **[2026-10-31] | DECISÃO-019 | Sistema de Abas de Retenção (Holding Tabs) para Corte Passante CNC (Passo 2/3 REA)**
  - **Contexto:** Ao cortar peças em profundidade total com contornos fechados, a peça desprendia-se da chapa de sacrifício na última passagem Z, colidindo com a fresa a alta rotação. Inspirado no algoritmo de pontes determinísticas do Layerling (`stencilBridges.ts`).
  - **Decisão:**
    1. Criada secção dedicada na barra lateral com interruptor para activar/desactivar, quantidade de abas, largura (mm) e espessura/altura (mm).
    2. Desenvolvido motor de amostragem `generateContourWithTabs` que divide o perímetro em intervalos uniformes e calcula waypoints com elevação automática a `Z_tab = depthTotal + tabHeight` exclusivamente nas passagens inferiores onde a peça ficaria solta.
    3. Geração de percurso G-code com elevações verticais suaves `(Subida Aba)` e mergulhos `(Descida Corte)`, visualizadas automaticamente em 3D WebGL no Three.js.
    4. Forçado incremento de versão para `v0.7.0` com persistência completa em `localStorage`.
- **[2026-10-31] | DECISÃO-020 | Estratégias CAM de Compensação de Raio: Profile Exterior, Profile Interior e Pocketing Concêntrico (Passo 3/3 REA)**
  - **Contexto:** Peças cortadas pelo centro da linha saíam menores do que o desenhado em virtude do diâmetro da fresa, e não existia suporte para esvaziar cavidades/caixas (pocketing). Inspirado na matemática de insets/offsets do Layerling (`cadSketchInset.ts`).
  - **Decisão:**
    1. Desenvolvido algoritmo geométrico 2D `offsetContour` com cálculo de normais por vértice e vector bissectriz com limite de miter seguro (evitando espigões em cantos agudos).
    2. Implementadas 4 estratégias no selector `param-strategy`:
       - **Exterior (Profile):** Desfasamento $+R$ para fora, garantindo que o perímetro exterior da peça final tem as medidas mecânicas exactas.
       - **Interior (Profile):** Desfasamento $-R$ para dentro, garantindo que furos e janelas saem nas dimensões nominais.
       - **Caixa / Pocket:** Desbaste concêntrico contínuo gerado por `generatePocketToolpaths` com passo lateral paramétrico (*stepover* %).
       - **Sobre a Linha:** Corte directo sem compensação para gravações e entalhes.
    3. Suporte completo para arcos nativos circulares G2/G3 com raio compensado e renderização 2D exacta das linhas de desvio no canvas.
    4. Forçado incremento de versão para `v0.8.0` com persistência no `localStorage`.
- **[2026-10-31] | DECISÃO-021 | Caixa Modal de Importação com Dica de Engenharia para Vetores Puros (π, SVG e DXF)**
  - **Contexto:** O utilizador pretendia esclarecimento sobre a preparação de símbolos mecânicos/matemáticos (ex: π) para maquinação CNC e solicitou a inclusão explícita de uma Dica de Engenharia na caixa de importação de ficheiros, destacando as vantagens de formatos vetoriais puros (SVG ou DXF nativo) sobre imagens raster.
  - **Decisão:**
    1. Criada caixa modal dedicada de importação de ficheiros (`#import-modal`), ativada pelo botão principal "📥 Importar" e com suporte a atalho de teclado `Escape` e fecho por clique exterior.
    2. Incorporada zona de arrasto e largada (*Dropzone*) visual com badges de formatos aceites (.dxf, .svg, .png, .jpg, .jpeg) e botão direto "📂 Procurar Ficheiro".
    3. Integrado cartão de destaque *glassmorphism* com a **Dica de Engenharia**: *"Se tiveres o desenho do π em formato vetorial puro (SVG ou o recém-implementado DXF), podes importá-lo diretamente sem precisar de vetorizar, garantindo curvas e arcos matematicamente perfeitos!"*.
    4. Ao selecionar ou largar um ficheiro na caixa, a modal fecha automaticamente e o desenho é importado diretamente para a mesa de corte CNC com notificação de confirmação.
    5. Incremento de versão para `v0.8.1` com cache-busting atualizado.
- **[2026-10-31] | DECISÃO-022 | Configuração de Repositório Remoto GitHub e Sincronização Upstream**
  - **Contexto:** O repositório Git local não tinha remote origin associado, mantendo todo o histórico apenas no disco local. O utilizador forneceu o URL remoto do GitHub.
  - **Decisão:**
    1. Configurado o remote origin para `https://github.com/Xlhoube/Gcoded.git`.
    2. Alinhado o ramo principal para `main` com tracking upstream (`git push -u origin main`).
    3. Todos os 25 commits atómicos (desde o protótipo inicial até v0.8.1 com DXF, Holding Tabs, Offsets de Fresagem e Dica de Engenharia) foram enviados e sincronizados com sucesso no GitHub.
- **[2026-11-09] | DECISÃO-023 | Suporte de Instalação PWA (Progressive Web App) e Funcionamento 100% Offline**
  - **Contexto:** Necessidade de permitir a instalação do Gcoded como aplicação nativa dedicada em desktop (Windows, macOS, Linux) e mobile (Android, iOS), operando sem barra de endereços e 100% offline em computadores dedicados de oficina CNC.
  - **Decisão:**
    1. Criado `manifest.webmanifest` e conjunto de ícones com branding CNC (SVG vetorial, PNG 192x192, 512x512 e maskable).
    2. Implementado Service Worker (`sw.js`) para pré-carregamento e cache offline-first de todos os recursos essenciais e bibliotecas CDNs.
    3. Adicionado botão dinâmico "📲 Instalar App" no cabeçalho superior (`#top-bar`) com captura de `beforeinstallprompt` e deteção de modo `standalone`.
    4. Criada caixa modal dedicada de instalação (`#install-modal`) com guias passo a passo para Chrome/Edge/Brave, Safari (iOS / macOS) e Android.
    5. Incremento de versão para `v0.9.0` com cache-busting atualizado.
- **[2026-11-09] | DECISÃO-024 | Integração do REA (Reverse Engineer Anything - morluto/rea) como Skill Oficial e MCP Server**
  - **Contexto:** O utilizador solicitou a adição do REA (`https://github.com/morluto/rea`) ao ambiente do agente.
  - **Decisão:**
    1. Instalada e registada a skill oficial `reverse-engineer-anything` (v49 compatível com `rea-agents@6.8.0`, com todas as referências de engenharia reversa).
    2. Configurado o servidor MCP para Antigravity em `~/.gemini/config/mcp_config.json` apontando para o runtime direto do Node.js, validado com estado `aligned` no `rea doctor`.
    3. Disponibilizado o pacote `rea-agents` e a CLI `rea` com 175 comandos e 229 ferramentas de análise reversa.
- **[2026-11-09] | DECISÃO-025 | Engenharia Reversa (REA) de CAM: Alívio de Cantos (Dogbone) e Entrada em Rampa (Ramping)**
  - **Contexto:** Com base nas referências de software CAM profissional (FreeCAD CAM Workbench, Carbide Create Pro, Vectric VCarve e EasyCarve), foi realizada engenharia reversa dos dois algoritmos de maquinação CNC mais cruciais para marcenaria e peças de precisão:
    1. **Alívio de Cantos Interiores (Dogbone / T-Bone):** Baseado no módulo `DogboneII.py` do FreeCAD e VCarve. Resolve o problema do raio cego da fresa cilíndrica em cantos de 90°, permitindo o encaixe perfeito de respigas, tábuas e ensambladuras retangulares.
       - *Matemática:* Deteção de deflexão angular $\Delta = t_1 - t_0$ para cantos côncavos. Cálculo do vetor de alívio por bissetriz ($\vec{u}_1 - \vec{u}_2$) para *Dogbone 45°*, ou seleção de aresta dominante para *T-Bone Horizontal* e *T-Bone Vertical* (que escondem a folga dentro da junta montada). Comprimento adaptativo $L = \max(0.45R, \frac{R}{\cos(\Delta/2)} - 0.7R)$.
    2. **Entrada em Rampa Suave (Ramp Entry):** Baseado no método 4 de `ramp_entry.py` do FreeCAD CAM e Carbide Create Pro. Substitui o mergulho vertical a direito por uma descida helicoidal/inclinada contínua ao longo do perímetro da peça em 3 eixos simultâneos ($XYZ$), com sobreposição (*overlap*) determinística para garantir a limpeza plana do início da passagem à cota final.
  - **Decisão:**
    - Adicionadas secções dedicadas e controlos paramétricos no painel lateral (`#param-use-dogbone`, `#param-dogbone-type`, `#param-use-ramping`, `#param-ramp-angle`, `#param-ramp-max-len`).
    - Implementadas as funções `applyDogboneRelief(points, toolRadius, type, strategy)` e `generateRampedPass(loop, zStart, zTarget, rampAngleDeg, maxRampLen)`.
    - Integrado o cálculo no motor `generateGCode()` com emissão sincronizada de blocos `G1 X... Y... Z... F...` e visualização 2D/3D em tempo real.
    - Persistência total dos novos parâmetros no `localStorage` via `saveAppState()` e `loadAppState()`.
- **[2026-11-09] | DECISÃO-026 | Integração do ClipperLib: Resolução Definitiva de Auto-Interseções (Swallowtails) em Desfasamentos Curvos 2D**
  - **Contexto:** Ao importar formas complexas com curvaturas côncavas pronunciadas (como o pinheiro de Natal das imagens enviadas), o algoritmo ingénuo anterior de desfasamento por normais e bissetrizes gerava auto-interseções e laços circulares grotescos (*swallowtails*), onde os percursos se cruzavam sobre si próprios e entravam pela peça adentro.
  - **Decisão:**
    1. Integrada a biblioteca industrial padrão de CAD/CAM **ClipperLib** (baseada no algoritmo de clipping de Bala Vatti e desfasamento poligonal de Angus Johnson) localmente em `lib/clipper.js`.
    2. Mantida a arquitetura 100% offline-first: ficheiro empacotado localmente sem dependências externas e registado na cache do Service Worker (`sw.js`).
    3. Atualizada a função `offsetContour()` para utilizar `ClipperLib.ClipperOffset` com união em arco (`JoinType.jtRound`), resolução micrométrica (`scale = 1000`) e tolerância de arco de 0.025mm.
    4. Atualizado `generatePocketToolpaths()` para desfasamento concêntrico limpo, suportando separação automática de ilhas independentes em zonas estreitas (estrangulamentos).
    5. Mantido fallback geométrico seguro com limite rigoroso de miter (1.414).
    6. Incremento de versão para `v0.10.1`.

- **[2026-11-09] | DECISÃO-027 | Sistema de Notificação e Popup de Atualização PWA (Auto-Update & Manual Check)**
  - **Contexto:** O utilizador solicitou um popup de atualização para a aplicação PWA.
  - **Decisão:**
    1. Criado popup flutuante de atualização (`#update-popup`) com design glassmorphism, ícone animado de foguete, botão de ação imediata "⚡ Atualizar Agora" e fecho/adiamento.
    2. Adicionado botão de versão e estado (`#btn-version-badge`) no cabeçalho superior (`#top-bar`) com pulso luminoso que sinaliza quando uma nova versão foi descarregada pelo Service Worker.
    3. Criado modal de histórico e novidades (`#update-modal`) com lista de changelog das versões recentes e botão de verificação manual com feedback interativo.
    4. Atualizado o ciclo de vida do Service Worker (`sw.js`): removido o `skipWaiting` imediato no evento `install`, aguardando a instrução do utilizador via `postMessage({ action: 'skipWaiting' })`, com reload automático em `controllerchange`.
    5. Exposta a função `window.showUpdatePopup()` no âmbito global para pré-visualização e testes rápidos.

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
- [x] Corrigir geometria de linhas diagonais, retângulos sob zoom/pan e orientação Y de relevo 3D
- [x] Implementar retracção de segurança entre subpaths e reposicionamento Z em contornos abertos
- [x] Persistência fiável de dados e mapas de profundidade de relevo 3D via IndexedDB
- [x] Parser e Validador Preventivo de G-Code com cálculo de tempos e Dry-Run Verifier (Fase 1)
- [x] Motor de Interpolação de Arcos Nativos G2/G3 com vetores relativos I e J (Fase 2)
- [x] Simulador 3D WebGL integrado em Three.js com painel DRO e controlos de reprodução (Fase 3)
- [x] Reformulação da barra lateral e biblioteca exclusivamente para Fresas e Routers CNC
- [x] Importador Nativo de DXF com costura automática de segmentos e Drag & Drop na mesa CNC (Passo 1/3)
- [x] Sistema de Abas de Fixação / Holding Tabs para corte passante CNC (Passo 2/3)
- [x] Desenvolver estratégia de corte "Exterior (Profile)" com compensação de raio da fresa (Passo 3/3)
- [x] Desenvolver estratégia de corte "Interior (Pocket)" para preenchimento de caixas (Passo 3/3)
- [x] Caixa de Importação de Ficheiros com Dropzone e Dica de Engenharia para Vetores Puros (π, SVG e DXF)
- [x] Repositório GitHub remoto configurado e sincronizado com tracking upstream (main)
- [x] Opção de Instalar Aplicação (PWA com Manifest, Service Worker, Ícones e Modal de Instalação)
- [x] Integração de REA (Reverse Engineer Anything - morluto/rea) via Skill e Servidor MCP Alinhado
- [x] Engenharia Reversa CAM (FreeCAD / Carbide / VCarve): Alívio de Cantos (Dogbone/T-Bone) e Entrada em Rampa (v0.10.0)
- [x] Desfasamento Poligonal Industrial ClipperLib (Eliminação Total de Laços/Swallowtails) (v0.10.1)
- [x] Popup e Notificação de Atualização PWA com Changelog e Verificação Manual (DECISÃO-027)


