// Gcoded - Lógica CAM/CNC Offline-First

// Mapeamento de Escala: 1 mm = 2 px (Canvas 500x500 px = Área CNC 250x250 mm)
const ESCALA_MM_PX = 2;
const TAMANHO_GRELHA_MM = 10; // Linhas principais a cada 10mm
const TAMANHO_GRELHA_PX = TAMANHO_GRELHA_MM * ESCALA_MM_PX;

// Estado Global
let canvas;
let currentTool = 'select'; // 'select' | 'rect' | 'circle' | 'line'
let isDrawing = false;
let origX = 0;
let origY = 0;
let activeShape = null;
let lastGeneratedGCode = "";

// Estado de Zoom e Pan
let isPanning = false;
let lastPosX = 0;
let lastPosY = 0;

// Elementos da UI
let toolSelectBtn, toolRectBtn, toolCircleBtn, toolLineBtn;
let btnImportTrigger, fileImport, btnVectorize;
let btnDelete, btnClear, btnCopy;
let canvasCoordsSpan, gcodeOutputText;
let btnGenerate, btnDownload;
let btnZoomIn, btnZoomOut, btnResetView;

// Inputs de Parâmetros
let inputToolDia, inputSafeZ, inputFeedXY, inputFeedZ, inputDepthTotal, inputDepthPass, selectStrategy;
let inputTableX, inputTableY, inputMaterialZ, selectOriginType, inputWcsX, inputWcsY;
let contextMenu, ctxSendToOrigin, ctxDelete, ctxGroup, ctxUngroup;
let rightClickedObject = null;

// Biblioteca de Ferramentas
let selectToolLibrary, btnOpenToolManager;
let toolsLibrary = [];
const DEFAULT_TOOLS = [
  { id: 'flat-3175', name: 'Fresa Topo Plano 3.175mm', toolDia: 3.175, safeZ: 5.0, feedXY: 1200, feedZ: 400, depthPass: 1.0, moduleType: 'spindle', spindleSpeed: 12000 },
  { id: 'flat-6000', name: 'Fresa Topo Plano 6.000mm', toolDia: 6.0, safeZ: 5.0, feedXY: 1800, feedZ: 600, depthPass: 2.0, moduleType: 'spindle', spindleSpeed: 12000 },
  { id: 'flat-2000', name: 'Fresa Topo Plano 2.000mm', toolDia: 2.0, safeZ: 5.0, feedXY: 800, feedZ: 300, depthPass: 0.8, moduleType: 'spindle', spindleSpeed: 15000 },
  { id: 'eot-foam-6000', name: 'Lâmina Oscilante EOT 6.0mm', toolDia: 6.0, safeZ: 5.0, feedXY: 1500, feedZ: 800, depthPass: 3.0, moduleType: 'eot', spindleSpeed: 6000 },
  { id: 'drag-knife-05', name: 'Lâmina Arrasto DragTool 0.5mm', toolDia: 0.5, safeZ: 3.0, feedXY: 1000, feedZ: 200, depthPass: 0.2, moduleType: 'dragtool', spindleSpeed: 0 }
];

// Módulos de Trabalho
let selectToolModule, inputSpindleSpeed, lblSpindleSpeed;

// Elementos do Gestor de Ferramentas (Modal)
let toolManagerModal, btnCloseToolManager, btnCloseToolManagerFooter, toolManagerTbody, toolManagerForm, btnMngrClearForm;
let mngrToolName, mngrToolModule, mngrToolDia, mngrSafeZ, mngrSpindleSpeed, mngrFeedXY, mngrFeedZ, mngrDepthPass;
let btnExportTools, btnImportTools, fileImportTools;

// Elementos do Motor de Corte 3D por Imagem (AI Deep Map & Relief Carving)
let btnImport3D, fileImport3D, reliefModal, btnCloseRelief, btnCloseReliefFooter, btnGenerateRelief;
let previewOriginal, previewDepthmap;
let sliderReliefDepth, sliderReliefBlur, sliderReliefContrast, sliderReliefResolution;
let lblReliefDepth, lblReliefBlur, lblReliefContrast, lblReliefResolution;
let chkReliefInvert, chkReliefDoublePass;
let lblReliefSize, lblReliefLines;
let inputReliefW, inputReliefH, btnLockAspect;
let reliefAspectLocked = true; // proporção travada por defeito
let reliefAiStatusCard, reliefAiStatusText, reliefAiProgressBar, reliefAiPercent;
let btnModeAiDepth, btnModeLuminance, lblDepthPreviewTitle;

// Estado interno do motor de IA
let reliefImageEl = null; // Imagem actualmente carregada no modal 3D
let currentReliefMode = 'ai-depth'; // 'ai-depth' | 'luminance'
let depthPipeline = null;
let isProcessingAI = false;
let cachedAIDepthResult = null; // { rawDepthMap: Float32Array, width: number, height: number }

/**
 * Inicialização Principal
 */
function init() {
  cacheUIElements();
  initCanvas();
  initToolLibrary(); // Inicializar biblioteca de ferramentas
  setupEventListeners();
  loadAppState();
}

/**
 * Mapeia os elementos do DOM para variáveis
 */
function cacheUIElements() {
  toolSelectBtn = document.getElementById('tool-select');
  toolRectBtn = document.getElementById('tool-rect');
  toolCircleBtn = document.getElementById('tool-circle');
  toolLineBtn = document.getElementById('tool-line');
  
  btnImportTrigger = document.getElementById('btn-import-trigger');
  fileImport = document.getElementById('file-import');
  btnVectorize = document.getElementById('btn-vectorize');
  
  btnDelete = document.getElementById('btn-delete');
  btnClear = document.getElementById('btn-clear');
  btnCopy = document.getElementById('btn-copy');
  
  canvasCoordsSpan = document.getElementById('canvas-coords');
  gcodeOutputText = document.getElementById('gcode-output');
  
  btnGenerate = document.getElementById('btn-generate');
  btnDownload = document.getElementById('btn-download');
  
  btnZoomIn = document.getElementById('btn-zoom-in');
  btnZoomOut = document.getElementById('btn-zoom-out');
  btnResetView = document.getElementById('btn-reset-view');

  contextMenu = document.getElementById('context-menu');
  ctxSendToOrigin = document.getElementById('ctx-send-to-origin');
  ctxDelete = document.getElementById('ctx-delete');
  ctxGroup = document.getElementById('ctx-group');
  ctxUngroup = document.getElementById('ctx-ungroup');

  // inputs
  inputToolDia = document.getElementById('param-tool-dia');
  inputSafeZ = document.getElementById('param-safe-z');
  inputFeedXY = document.getElementById('param-feed-xy');
  inputFeedZ = document.getElementById('param-feed-z');
  inputDepthTotal = document.getElementById('param-depth-total');
  inputDepthPass = document.getElementById('param-depth-pass');
  selectStrategy = document.getElementById('param-strategy');

  inputTableX = document.getElementById('param-table-x');
  inputTableY = document.getElementById('param-table-y');
  inputMaterialZ = document.getElementById('param-material-z');
  selectOriginType = document.getElementById('param-origin-type');
  inputWcsX = document.getElementById('param-wcs-x');
  inputWcsY = document.getElementById('param-wcs-y');

  // Mapear elementos da biblioteca de ferramentas
  selectToolLibrary = document.getElementById('select-tool-library');
  btnOpenToolManager = document.getElementById('btn-open-tool-manager');

  // Mapear elementos dos módulos de trabalho
  selectToolModule = document.getElementById('param-tool-module');
  inputSpindleSpeed = document.getElementById('param-spindle-speed');
  lblSpindleSpeed = document.getElementById('lbl-spindle-speed');

  // Mapear elementos do gestor de ferramentas (Modal)
  toolManagerModal = document.getElementById('tool-manager-modal');
  btnCloseToolManager = document.getElementById('btn-close-tool-manager');
  btnCloseToolManagerFooter = document.getElementById('btn-close-tool-manager-footer');
  toolManagerTbody = document.getElementById('tool-manager-tbody');
  toolManagerForm = document.getElementById('tool-manager-form');
  btnMngrClearForm = document.getElementById('btn-mngr-clear-form');
  
  mngrToolName = document.getElementById('mngr-tool-name');
  mngrToolModule = document.getElementById('mngr-tool-module');
  mngrToolDia = document.getElementById('mngr-tool-dia');
  mngrSafeZ = document.getElementById('mngr-safe-z');
  mngrSpindleSpeed = document.getElementById('mngr-spindle-speed');
  mngrFeedXY = document.getElementById('mngr-feed-xy');
  mngrFeedZ = document.getElementById('mngr-feed-z');
  mngrDepthPass = document.getElementById('mngr-depth-pass');
  
  btnExportTools = document.getElementById('btn-export-tools');
  btnImportTools = document.getElementById('btn-import-tools');
  fileImportTools = document.getElementById('file-import-tools');

  // Mapear elementos do modal de Corte 3D por Imagem
  btnImport3D = document.getElementById('btn-import-3d');
  fileImport3D = document.getElementById('file-import-3d');
  reliefModal = document.getElementById('relief-modal');
  btnCloseRelief = document.getElementById('btn-close-relief');
  btnCloseReliefFooter = document.getElementById('btn-close-relief-footer');
  btnGenerateRelief = document.getElementById('btn-generate-relief');
  previewOriginal = document.getElementById('preview-original');
  previewDepthmap = document.getElementById('preview-depthmap');
  sliderReliefDepth = document.getElementById('relief-max-depth');
  sliderReliefBlur = document.getElementById('relief-blur');
  sliderReliefContrast = document.getElementById('relief-contrast');
  sliderReliefResolution = document.getElementById('relief-resolution');
  lblReliefDepth = document.getElementById('lbl-relief-depth');
  lblReliefBlur = document.getElementById('lbl-relief-blur');
  lblReliefContrast = document.getElementById('lbl-relief-contrast');
  lblReliefResolution = document.getElementById('lbl-relief-resolution');
  chkReliefInvert = document.getElementById('relief-invert');
  chkReliefDoublePass = document.getElementById('relief-double-pass');
  lblReliefSize = document.getElementById('lbl-relief-size');
  lblReliefLines = document.getElementById('lbl-relief-lines');
  inputReliefW = document.getElementById('relief-width-mm');
  inputReliefH = document.getElementById('relief-height-mm');
  btnLockAspect = document.getElementById('btn-lock-aspect');

  // Elementos do motor de IA
  reliefAiStatusCard = document.getElementById('relief-ai-status-card');
  reliefAiStatusText = document.getElementById('relief-ai-status-text');
  reliefAiProgressBar = document.getElementById('relief-ai-progress-bar');
  reliefAiPercent = document.getElementById('relief-ai-percent');
  btnModeAiDepth = document.getElementById('btn-mode-ai-depth');
  btnModeLuminance = document.getElementById('btn-mode-luminance');
  lblDepthPreviewTitle = document.getElementById('lbl-depth-preview-title');
}

/**
 * Inicializa a biblioteca de ferramentas e carrega do localStorage ou assume padrões
 */
function initToolLibrary() {
  const storedTools = localStorage.getItem('gcoded_tools');
  if (storedTools) {
    try {
      toolsLibrary = JSON.parse(storedTools);
    } catch (err) {
      console.error("Erro ao carregar a biblioteca de ferramentas:", err);
      toolsLibrary = [...DEFAULT_TOOLS];
    }
  } else {
    toolsLibrary = [...DEFAULT_TOOLS];
    localStorage.setItem('gcoded_tools', JSON.stringify(toolsLibrary));
  }
  populateToolLibrarySelect();
}

/**
 * Preenche o select da biblioteca de ferramentas com a lista actual
 */
function populateToolLibrarySelect() {
  if (!selectToolLibrary) return;
  selectToolLibrary.innerHTML = "";
  toolsLibrary.forEach(tool => {
    const opt = document.createElement('option');
    opt.value = tool.id;
    opt.innerText = tool.name;
    selectToolLibrary.appendChild(opt);
  });
}

/**
 * Abre o modal do Gestor de Biblioteca de Ferramentas
 */
function showToolManagerModal() {
  if (!toolManagerModal) return;
  toolManagerModal.style.display = 'flex';
  renderToolManagerTable();
  clearToolManagerForm();
}

/**
 * Fecha o modal do Gestor de Biblioteca de Ferramentas
 */
function hideToolManagerModal() {
  if (!toolManagerModal) return;
  toolManagerModal.style.display = 'none';
}

/**
 * Reconstrói a tabela de ferramentas dentro do Gestor
 */
function renderToolManagerTable() {
  if (!toolManagerTbody) return;
  toolManagerTbody.innerHTML = "";

  toolsLibrary.forEach((tool, idx) => {
    const tr = document.createElement('tr');
    
    // Nome
    const tdName = document.createElement('td');
    tdName.innerText = tool.name;
    tr.appendChild(tdName);
    
    // Módulo
    const tdModule = document.createElement('td');
    let modLabel = "Fuso (Spindle)";
    if (tool.moduleType === 'eot') modLabel = "Oscilante (EOT)";
    if (tool.moduleType === 'dragtool') modLabel = "Arrasto (Drag)";
    tdModule.innerText = modLabel;
    tr.appendChild(tdModule);
    
    // Diâmetro
    const tdDia = document.createElement('td');
    tdDia.innerText = `${tool.toolDia} mm`;
    tr.appendChild(tdDia);
    
    // Z Segurança
    const tdSafeZ = document.createElement('td');
    tdSafeZ.innerText = `${tool.safeZ} mm`;
    tr.appendChild(tdSafeZ);
    
    // Avanço XY
    const tdFeedXY = document.createElement('td');
    tdFeedXY.innerText = `${tool.feedXY} mm/min`;
    tr.appendChild(tdFeedXY);
    
    // Avanço Z
    const tdFeedZ = document.createElement('td');
    tdFeedZ.innerText = `${tool.feedZ} mm/min`;
    tr.appendChild(tdFeedZ);
    
    // Passo Z
    const tdPassZ = document.createElement('td');
    tdPassZ.innerText = `${tool.depthPass} mm`;
    tr.appendChild(tdPassZ);
    
    // Velocidade
    const tdSpeed = document.createElement('td');
    tdSpeed.innerText = tool.moduleType === 'dragtool' ? 'N/A' : `${tool.spindleSpeed} RPM/Hz`;
    tr.appendChild(tdSpeed);
    
    // Ações
    const tdActions = document.createElement('td');
    
    // Botão Usar
    const btnUse = document.createElement('button');
    btnUse.className = "action-btn-sm use";
    btnUse.innerText = "⚡ Usar";
    btnUse.addEventListener('click', () => useToolFromManager(tool.id));
    tdActions.appendChild(btnUse);
    
    // Botão Apagar
    const btnDel = document.createElement('button');
    btnDel.className = "action-btn-sm delete";
    btnDel.innerText = "🗑️";
    btnDel.addEventListener('click', () => deleteToolFromManager(tool.id));
    tdActions.appendChild(btnDel);
    
    tr.appendChild(tdActions);
    toolManagerTbody.appendChild(tr);
  });
}

/**
 * Selecciona e aplica uma ferramenta a partir do Gestor de Ferramentas
 */
function useToolFromManager(id) {
  const tool = toolsLibrary.find(t => t.id === id);
  if (tool && selectToolLibrary) {
    selectToolLibrary.value = tool.id;
    
    inputToolDia.value = tool.toolDia;
    inputSafeZ.value = tool.safeZ;
    inputFeedXY.value = tool.feedXY;
    inputFeedZ.value = tool.feedZ;
    inputDepthPass.value = tool.depthPass;
    
    updateModuleUI(tool.moduleType || 'spindle', tool.spindleSpeed);
    
    clearVisualToolpaths();
    saveAppState();
    hideToolManagerModal();
  }
}

/**
 * Remove uma ferramenta da biblioteca a partir do Gestor de Ferramentas
 */
function deleteToolFromManager(id) {
  if (toolsLibrary.length <= 1) {
    alert("A biblioteca de ferramentas tem de conter pelo menos uma ferramenta!");
    return;
  }
  
  const tool = toolsLibrary.find(t => t.id === id);
  if (!tool) return;
  
  if (!confirm(`Tem a certeza que deseja eliminar a ferramenta "${tool.name}"?`)) return;
  
  toolsLibrary = toolsLibrary.filter(t => t.id !== id);
  localStorage.setItem('gcoded_tools', JSON.stringify(toolsLibrary));
  populateToolLibrarySelect();
  renderToolManagerTable();
  
  // Se apagámos a ferramenta activa, seleccionar a primeira restante
  if (selectToolLibrary.value === id) {
    useToolFromManager(toolsLibrary[0].id);
  } else {
    saveAppState();
  }
}

/**
 * Adiciona uma nova ferramenta à biblioteca a partir do formulário do Gestor
 */
function addToolFromManager() {
  if (!mngrToolName || !mngrToolDia || !mngrSafeZ || !mngrFeedXY || !mngrFeedZ || !mngrDepthPass) return;
  
  const name = mngrToolName.value.trim();
  if (name === "") return;
  
  const newTool = {
    id: 'custom-' + Date.now(),
    name: name,
    toolDia: parseFloat(mngrToolDia.value) || 3.175,
    safeZ: parseFloat(mngrSafeZ.value) || 5.0,
    feedXY: parseInt(mngrFeedXY.value) || 1200,
    feedZ: parseInt(mngrFeedZ.value) || 400,
    depthPass: parseFloat(mngrDepthPass.value) || 1.0,
    moduleType: mngrToolModule.value,
    spindleSpeed: mngrToolModule.value === 'dragtool' ? 0 : (parseInt(mngrSpindleSpeed.value) || 12000)
  };
  
  toolsLibrary.push(newTool);
  localStorage.setItem('gcoded_tools', JSON.stringify(toolsLibrary));
  
  populateToolLibrarySelect();
  renderToolManagerTable();
  clearToolManagerForm();
  
  // Definir a nova ferramenta criada como a activa
  useToolFromManager(newTool.id);
}

/**
 * Limpa o formulário de cadastro do gestor
 */
function clearToolManagerForm() {
  if (!toolManagerForm) return;
  mngrToolName.value = "";
  mngrToolModule.value = "spindle";
  mngrToolDia.value = 3.175;
  mngrSafeZ.value = 5.0;
  mngrSpindleSpeed.value = 12000;
  mngrSpindleSpeed.disabled = false;
  mngrFeedXY.value = 1200;
  mngrFeedZ.value = 400;
  mngrDepthPass.value = 1.0;
}

/**
 * Exporta a biblioteca de ferramentas actual em formato JSON para download
 */
function exportToolsLibrary() {
  try {
    const dataStr = JSON.stringify(toolsLibrary, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcoded_tool_library.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  } catch (err) {
    console.error("Erro ao exportar biblioteca:", err);
    alert("Erro ao exportar a biblioteca de ferramentas.");
  }
}

/**
 * Importa uma biblioteca de ferramentas a partir de um ficheiro JSON local
 */
function importToolsLibrary(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      
      // Validação básica da estrutura
      if (!Array.isArray(imported) || imported.length === 0) {
        alert("Ficheiro inválido. A biblioteca tem de conter uma lista de ferramentas!");
        return;
      }
      
      const isValid = imported.every(tool => tool.name && tool.toolDia !== undefined && tool.feedXY !== undefined);
      if (!isValid) {
        alert("Ficheiro de biblioteca com propriedades em falta. Certifica-te que exportaste do Gcoded.");
        return;
      }
      
      if (confirm(`Pretende substituir a sua biblioteca actual por ${imported.length} ferramentas importadas?`)) {
        toolsLibrary = imported;
        localStorage.setItem('gcoded_tools', JSON.stringify(toolsLibrary));
        populateToolLibrarySelect();
        renderToolManagerTable();
        
        // Activar a primeira ferramenta
        useToolFromManager(toolsLibrary[0].id);
        alert("Biblioteca de ferramentas importada com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao importar JSON:", err);
      alert("Ocorreu um erro ao processar o ficheiro. Certifica-te que é um JSON válido.");
    }
  };
  reader.readAsText(file);
  e.target.value = ""; // Limpar input
}

/**
 * Actualiza a interface com base no Módulo de Trabalho seleccionado
 */
function updateModuleUI(moduleType, speed) {
  if (!selectToolModule || !inputSpindleSpeed || !lblSpindleSpeed) return;
  
  selectToolModule.value = moduleType || 'spindle';
  
  if (moduleType === 'spindle') {
    lblSpindleSpeed.innerText = 'Velocidade Spindle (RPM)';
    inputSpindleSpeed.disabled = false;
    inputSpindleSpeed.value = speed !== undefined ? speed : 12000;
  } else if (moduleType === 'eot') {
    lblSpindleSpeed.innerText = 'Freq. Oscilação (Hz/RPM)';
    inputSpindleSpeed.disabled = false;
    inputSpindleSpeed.value = speed !== undefined ? speed : 6000;
  } else if (moduleType === 'dragtool') {
    lblSpindleSpeed.innerText = 'Lâmina Estática (Desactivada)';
    inputSpindleSpeed.disabled = true;
    inputSpindleSpeed.value = 0;
  }
}

/* ============================================================
   MOTOR DE CORTE 3D POR IMAGEM — AI DEEP MAP & RELIEF CARVING
   ============================================================ */

/**
 * Carrega o pipeline do modelo de IA Depth-Anything no browser
 */
async function getDepthPipeline(onProgress) {
  if (!depthPipeline) {
    try {
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      depthPipeline = await pipeline('depth-estimation', 'Xenova/depth-anything-small-hf', {
        progress_callback: onProgress
      });
    } catch (err) {
      console.warn("Tentativa de carregar Depth-Anything falhou, a tentar modelo alternativo MiDaS...", err);
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      depthPipeline = await pipeline('depth-estimation', 'Xenova/dpt-hybrid-midas', {
        progress_callback: onProgress
      });
    }
  }
  return depthPipeline;
}

/**
 * Actualiza a barra de progresso e texto da IA no modal
 */
function updateAIProgress(percent, text) {
  if (reliefAiProgressBar) reliefAiProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (reliefAiPercent) reliefAiPercent.innerText = `${Math.round(percent)}%`;
  if (reliefAiStatusText && text) reliefAiStatusText.innerText = text;
}

/**
 * Executa a inferência por Inteligência Artificial na imagem carregada
 */
async function generateAIDepthMap(img) {
  try {
    isProcessingAI = true;
    if (reliefAiStatusCard) {
      reliefAiStatusCard.style.display = 'flex';
      updateAIProgress(10, 'A inicializar modelo neural no browser...');
    }
    if (btnGenerateRelief) btnGenerateRelief.disabled = true;

    const pipe = await getDepthPipeline((progress) => {
      if (progress.status === 'progress') {
        const pct = Math.round(progress.progress || 0);
        updateAIProgress(pct, `A descarregar modelo neural (${pct}%)...`);
      } else if (progress.status === 'initiate') {
        updateAIProgress(15, `A carregar pesos do modelo...`);
      } else if (progress.status === 'ready') {
        updateAIProgress(85, `Modelo neural pronto! A inferir geometria 3D...`);
      }
    });

    updateAIProgress(90, 'A analisar volume facial e relevo tridimensional...');
    const output = await pipe(img.src);

    const rawDepth = output.depth;
    const width = rawDepth.width;
    const height = rawDepth.height;
    const rawData = rawDepth.data; // Uint8ClampedArray

    // Normalizar para Float32Array [0..1]
    const depthMap = new Float32Array(width * height);
    for (let i = 0; i < depthMap.length; i++) {
      // 1.0 = ponto mais saliente (superfície Z=0), 0.0 = fundo (profundidade máxima)
      depthMap[i] = rawData[i] / 255;
    }

    cachedAIDepthResult = { rawDepthMap: depthMap, width, height };
    updateAIProgress(100, '✨ Deep Map 3D por IA gerado com sucesso!');

    isProcessingAI = false;
    if (btnGenerateRelief) btnGenerateRelief.disabled = false;

    updateReliefPreviewAndStats();
  } catch (err) {
    console.warn('Erro ao processar imagem com IA:', err);
    isProcessingAI = false;
    updateAIProgress(100, '⚠️ IA indisponível offline. A utilizar modo Luminância.');
    if (btnGenerateRelief) btnGenerateRelief.disabled = false;
    setReliefMode('luminance');
  }
}

/**
 * Alterna entre o modo de IA Deep Map e Luminância Clássica
 */
function setReliefMode(mode) {
  currentReliefMode = mode;
  if (btnModeAiDepth && btnModeLuminance) {
    if (mode === 'ai-depth') {
      btnModeAiDepth.classList.add('active');
      btnModeLuminance.classList.remove('active');
      if (lblDepthPreviewTitle) lblDepthPreviewTitle.innerText = 'Mapa de Profundidade 3D (Deep Map por IA)';
      if (!cachedAIDepthResult && reliefImageEl && !isProcessingAI) {
        generateAIDepthMap(reliefImageEl);
      } else {
        updateReliefPreviewAndStats();
      }
    } else {
      btnModeLuminance.classList.add('active');
      btnModeAiDepth.classList.remove('active');
      if (lblDepthPreviewTitle) lblDepthPreviewTitle.innerText = 'Mapa de Altura (Luminância 2D)';
      if (reliefAiStatusText) reliefAiStatusText.innerText = 'Modo Luminância 2D ativo (Litofanias)';
      updateReliefPreviewAndStats();
    }
  }
}

/**
 * Abre o modal de corte 3D após o utilizador seleccionar uma imagem
 */
function handleFileImport3D(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      reliefImageEl = img;
      cachedAIDepthResult = null; // Limpar cache anterior
      reliefModal.style.display = 'flex';

      // Preencher automaticamente as dimensões (proporcional à mesa de corte)
      const tableW = parseFloat(inputTableX?.value) || 250;
      const tableH = parseFloat(inputTableY?.value) || 250;
      const aspect = img.width / img.height;
      let defaultW = Math.min(tableW * 0.6, tableH * 0.6 * aspect);
      let defaultH = defaultW / aspect;
      // Arredondar a 0.5mm
      defaultW = Math.round(defaultW * 2) / 2;
      defaultH = Math.round(defaultH * 2) / 2;
      if (inputReliefW) inputReliefW.value = defaultW;
      if (inputReliefH) inputReliefH.value = defaultH;

      // Renderizar imagem original no canvas de preview
      drawOriginalPreview(img);

      // Activar modo IA por defeito e iniciar processamento automático
      setReliefMode('ai-depth');
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

/**
 * Fecha o modal de corte 3D por imagem
 */
function hideReliefModal() {
  if (reliefModal) reliefModal.style.display = 'none';
}

/**
 * Desenha a imagem original no canvas de preview (aspect-fit)
 */
function drawOriginalPreview(img) {
  if (!previewOriginal) return;
  const maxW = previewOriginal.parentElement.clientWidth || 300;
  const ratio = img.height / img.width;
  previewOriginal.width = maxW;
  previewOriginal.height = Math.round(maxW * ratio);
  const ctx = previewOriginal.getContext('2d');
  ctx.drawImage(img, 0, 0, previewOriginal.width, previewOriginal.height);
}

/**
 * Aplica um Blur Gaussiano simples (box blur 2-pass) num ImageData.
 */
function applyBoxBlur(pixels, width, height, radius) {
  if (radius <= 0) return pixels;
  const output = new Uint8ClampedArray(pixels.length);
  const passes = 2; // 2 passes de box blur aproximam um Gaussiano

  let src = pixels.slice();
  let dst = new Uint8ClampedArray(pixels.length);

  for (let p = 0; p < passes; p++) {
    // Passagem Horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          sum += src[(y * width + nx) * 4];
          count++;
        }
        const idx = (y * width + x) * 4;
        dst[idx] = dst[idx + 1] = dst[idx + 2] = Math.round(sum / count);
        dst[idx + 3] = 255;
      }
    }
    // Passagem Vertical
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          sum += dst[(ny * width + x) * 4];
          count++;
        }
        const idx = (y * width + x) * 4;
        output[idx] = output[idx + 1] = output[idx + 2] = Math.round(sum / count);
        output[idx + 3] = 255;
      }
    }
    src = output.slice();
  }
  return output;
}

/**
 * Processa a imagem para gerar um mapa de profundidade Float32Array [0..1]
 * 0 = superfície (Z=0), 1 = corte mais fundo (Z=-maxDepth)
 */
function processImageToDepthMap(img, options) {
  const { blur, gamma, invert, scaleFactor, mode } = options;

  // CASO 1: MODO IA DEEP MAP
  if (mode === 'ai-depth' && cachedAIDepthResult) {
    const { rawDepthMap, width, height } = cachedAIDepthResult;

    // Converter para array de píxeis para aplicar blur/gama se pretendido
    const grey = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const v = Math.round(rawDepthMap[i] * 255);
      grey[i * 4] = grey[i * 4 + 1] = grey[i * 4 + 2] = v;
      grey[i * 4 + 3] = 255;
    }

    const blurred = blur > 0 ? applyBoxBlur(grey, width, height, blur) : grey;
    const depthMap = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      let norm = blurred[i * 4] / 255;
      norm = Math.pow(norm, gamma);
      // No mapa de profundidade IA: 1.0 = relevo alto (superfície Z=0), 0.0 = fundo (profundo)
      // Para o CNC: 0 = Z=0, 1 = -maxDepth
      const depth = invert ? norm : (1 - norm);
      depthMap[i] = Math.min(1, Math.max(0, depth));
    }
    return { depthMap, width, height };
  }

  // CASO 2: MODO LUMINÂNCIA CLÁSSICA (2D)
  const tmpCanvas = document.createElement('canvas');
  const targetW = Math.max(1, Math.round(img.width * scaleFactor));
  const targetH = Math.max(1, Math.round(img.height * scaleFactor));
  tmpCanvas.width = targetW;
  tmpCanvas.height = targetH;
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(img, 0, 0, targetW, targetH);

  const imageData = tmpCtx.getImageData(0, 0, targetW, targetH);
  let pixels = imageData.data;

  // Converter para escala de cinzentos (luminância perceptual ITU-R BT.601)
  const grey = new Uint8ClampedArray(targetW * targetH * 4);
  for (let i = 0; i < targetW * targetH; i++) {
    const R = pixels[i * 4];
    const G = pixels[i * 4 + 1];
    const B = pixels[i * 4 + 2];
    const L = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
    grey[i * 4] = grey[i * 4 + 1] = grey[i * 4 + 2] = L;
    grey[i * 4 + 3] = 255;
  }

  const blurred = blur > 0 ? applyBoxBlur(grey, targetW, targetH, blur) : grey;

  const depthMap = new Float32Array(targetW * targetH);
  for (let i = 0; i < targetW * targetH; i++) {
    let normalised = blurred[i * 4] / 255;
    normalised = Math.pow(normalised, gamma);
    const depth = invert ? normalised : (1 - normalised);
    depthMap[i] = Math.min(1, Math.max(0, depth));
  }

  return { depthMap, width: targetW, height: targetH };
}

/**
 * Actualiza o preview do mapa de profundidade e as estatísticas de estimativa no modal
 */
function updateReliefPreviewAndStats() {
  if (!reliefImageEl || !previewDepthmap) return;

  const blur = parseInt(sliderReliefBlur.value);
  const gamma = parseFloat(sliderReliefContrast.value);
  const invert = chkReliefInvert.checked;
  const resolutionPct = parseInt(sliderReliefResolution.value);
  const scaleFactor = resolutionPct / 100;
  const toolDia = parseFloat(inputToolDia?.value) || 3.175;

  const { depthMap, width, height } = processImageToDepthMap(reliefImageEl, {
    blur, gamma, invert, scaleFactor, mode: currentReliefMode
  });

  // Renderizar depth map no canvas de preview
  const maxW = previewDepthmap.parentElement.clientWidth || 300;
  const ratio = height / width;
  previewDepthmap.width = maxW;
  previewDepthmap.height = Math.round(maxW * ratio);

  const dCtx = previewDepthmap.getContext('2d');
  const previewData = dCtx.createImageData(width, height);
  for (let i = 0; i < depthMap.length; i++) {
    // Visualização: 255 = superfície/branco, 0 = preto/profundo
    const v = Math.round((1 - depthMap[i]) * 255);
    previewData.data[i * 4] = v;
    previewData.data[i * 4 + 1] = v;
    previewData.data[i * 4 + 2] = v;
    previewData.data[i * 4 + 3] = 255;
  }

  // Criar canvas temporário e escalar suavemente para o preview
  const tmpC = document.createElement('canvas');
  tmpC.width = width; tmpC.height = height;
  tmpC.getContext('2d').putImageData(previewData, 0, 0);
  dCtx.clearRect(0, 0, previewDepthmap.width, previewDepthmap.height);
  dCtx.drawImage(tmpC, 0, 0, previewDepthmap.width, previewDepthmap.height);

  // Dimensões na mesa
  const aspect = reliefImageEl.width / reliefImageEl.height;
  let areaW = parseFloat(inputReliefW?.value);
  let areaH = parseFloat(inputReliefH?.value);
  if (!areaW || areaW <= 0) {
    const tableW = parseFloat(inputTableX?.value) || 250;
    const tableH = parseFloat(inputTableY?.value) || 250;
    areaW = Math.min(tableW * 0.6, tableH * 0.6 * aspect);
    areaH = areaW / aspect;
  } else if (!areaH || areaH <= 0) {
    areaH = areaW / aspect;
  }

  const numLinesX = Math.ceil(areaH / toolDia);
  const numLinesY = Math.ceil(areaW / toolDia);
  const totalLines = chkReliefDoublePass.checked ? numLinesX + numLinesY : numLinesX;

  if (lblReliefSize) lblReliefSize.innerText = `${areaW.toFixed(0)}mm × ${areaH.toFixed(0)}mm`;
  if (lblReliefLines) lblReliefLines.innerText = `~${totalLines} linhas de corte`;
}

/**
 * Coloca a imagem 3D na mesa com o mapa de profundidade gerado
 */
function placeReliefImageOnCanvas() {
  if (!reliefImageEl) {
    alert('Nenhuma imagem carregada para processar.');
    return;
  }

  const blur = parseInt(sliderReliefBlur.value);
  const gamma = parseFloat(sliderReliefContrast.value);
  const invert = chkReliefInvert.checked;
  const resolutionPct = parseInt(sliderReliefResolution.value);
  const scaleFactor = resolutionPct / 100;
  const maxDepth = parseFloat(sliderReliefDepth.value);
  const doublePass = chkReliefDoublePass.checked;

  // Extrair o Float32Array final do mapa de profundidade
  const { depthMap, width: dmW, height: dmH } = processImageToDepthMap(reliefImageEl, {
    blur, gamma, invert, scaleFactor, mode: currentReliefMode
  });

  const reliefSettings = {
    blur,
    gamma,
    invert,
    resolutionPct,
    maxDepth,
    doublePass,
    mode: currentReliefMode,
    srcWidth: reliefImageEl.width,
    srcHeight: reliefImageEl.height
  };

  const imgAspect = reliefImageEl.width / reliefImageEl.height;
  let areaW = parseFloat(inputReliefW?.value);
  let areaH = parseFloat(inputReliefH?.value);
  if (!areaW || areaW <= 0) {
    const tableW = parseFloat(inputTableX?.value) || 250;
    const tableH = parseFloat(inputTableY?.value) || 250;
    areaW = Math.min(tableW * 0.6, tableH * 0.6 * imgAspect);
    areaH = areaW / imgAspect;
  } else if (!areaH || areaH <= 0) {
    areaH = areaW / imgAspect;
  }

  const pxW = areaW * ESCALA_MM_PX;
  const pxH = areaH * ESCALA_MM_PX;

  fabric.Image.fromURL(reliefImageEl.src, (fabricImg) => {
    fabricImg.set({
      left: 20,
      top: 20,
      scaleX: pxW / fabricImg.width,
      scaleY: pxH / fabricImg.height,
      originX: 'left',
      originY: 'top',
      opacity: 0.9,
      borderColor: '#8b5cf6',
      cornerColor: '#8b5cf6'
    });

    // Guardar definições e dados 3D no objecto
    fabricImg.isReliefImage = true;
    fabricImg.reliefSettings = reliefSettings;
    fabricImg.reliefDepthMap = depthMap;
    fabricImg.reliefDepthWidth = dmW;
    fabricImg.reliefDepthHeight = dmH;
    fabricImg.reliefSrc = reliefImageEl.src;
    fabricImg.reliefImgEl = reliefImageEl;

    canvas.add(fabricImg);
    canvas.setActiveObject(fabricImg);
    canvas.requestRenderAll();

    hideReliefModal();
    clearVisualToolpaths();
    saveAppState();
  });
}

/**
 * Inicializa a instância do Fabric.js Canvas
 */
function initCanvas() {
  canvas = new fabric.Canvas('cnc-canvas', {
    width: 500,
    height: 500,
    backgroundColor: '#10141e',
    selectionColor: 'rgba(249, 115, 22, 0.15)',
    selectionBorderColor: '#f97316',
    selectionLineWidth: 1,
    fireRightClick: true, // Permitir capturar eventos do clique direito do rato
    stopContextMenu: true // Bloquear menu de contexto padrão do browser no canvas
  });

  // Desenhar Grelha (Grid) no Canvas após renderização (acompanha zoom e pan)
  canvas.on('after:render', function() {
    const ctx = canvas.getContext();
    ctx.save();
    
    // Aplicar a transformação de zoom e pan do Fabric.js ao contexto 2D bruto da mesa
    const vpt = canvas.viewportTransform;
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    
    const zoom = canvas.getZoom();
    
    // Grelha Principal (Linhas Cinzentas Subtis)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1 / zoom; // Espessura constante de 1px no ecrã
    
    // Linhas Verticais
    for (let i = TAMANHO_GRELHA_PX; i < canvas.width; i += TAMANHO_GRELHA_PX) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    
    // Linhas Horizontais
    for (let i = TAMANHO_GRELHA_PX; i < canvas.height; i += TAMANHO_GRELHA_PX) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Eixos Centrais (Cores de Acento muito subtis)
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.15)';
    ctx.lineWidth = 1.5 / zoom;
    
    // Eixo X Central
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    // Eixo Y Central
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.restore();
  });
}

/**
 * Configura os ouvintes de eventos da UI e do Canvas
 */
function setupEventListeners() {
  // Troca de Ferramentas
  toolSelectBtn.addEventListener('click', () => setTool('select'));
  toolRectBtn.addEventListener('click', () => setTool('rect'));
  toolCircleBtn.addEventListener('click', () => setTool('circle'));
  toolLineBtn.addEventListener('click', () => setTool('line'));

  // Ações de Apagar e Limpar
  btnDelete.addEventListener('click', deleteSelectedObject);
  btnClear.addEventListener('click', clearCanvas);

  // Importação (SVG, PNG, JPG) e Tracing
  btnImportTrigger.addEventListener('click', () => fileImport.click());
  fileImport.addEventListener('change', handleFileImport);
  btnVectorize.addEventListener('click', vectorizeSelectedImage);

  // Corte 3D por Imagem — abrir modal ao clicar no botão
  btnImport3D.addEventListener('click', () => fileImport3D.click());
  fileImport3D.addEventListener('change', handleFileImport3D);
  btnCloseRelief.addEventListener('click', hideReliefModal);
  btnCloseReliefFooter.addEventListener('click', hideReliefModal);
  btnGenerateRelief.addEventListener('click', placeReliefImageOnCanvas);
  
  if (btnModeAiDepth) btnModeAiDepth.addEventListener('click', () => setReliefMode('ai-depth'));
  if (btnModeLuminance) btnModeLuminance.addEventListener('click', () => setReliefMode('luminance'));

  // Sliders do modal de corte 3D — actualizar labels e preview em tempo real
  const reliefSliders = [
    { el: sliderReliefDepth, lbl: lblReliefDepth },
    { el: sliderReliefBlur, lbl: lblReliefBlur },
    { el: sliderReliefContrast, lbl: lblReliefContrast },
    { el: sliderReliefResolution, lbl: lblReliefResolution }
  ];
  reliefSliders.forEach(({ el, lbl }) => {
    el.addEventListener('input', () => {
      lbl.innerText = el.value;
      if (reliefImageEl) updateReliefPreviewAndStats();
    });
  });
  chkReliefInvert.addEventListener('change', () => {
    if (reliefImageEl) updateReliefPreviewAndStats();
  });

  // Botão de travamento de proporção
  btnLockAspect.addEventListener('click', () => {
    reliefAspectLocked = !reliefAspectLocked;
    btnLockAspect.dataset.locked = reliefAspectLocked ? 'true' : 'false';
    btnLockAspect.innerText = reliefAspectLocked ? '🔒' : '🔓';
  });

  // Inputs de dimensão — actualizar o outro quando um muda (se locked)
  inputReliefW.addEventListener('input', () => {
    if (reliefAspectLocked && reliefImageEl) {
      const aspect = reliefImageEl.width / reliefImageEl.height;
      const w = parseFloat(inputReliefW.value);
      if (!isNaN(w) && w > 0) {
        inputReliefH.value = Math.round((w / aspect) * 2) / 2;
      }
    }
    updateReliefPreviewAndStats();
  });
  inputReliefH.addEventListener('input', () => {
    if (reliefAspectLocked && reliefImageEl) {
      const aspect = reliefImageEl.width / reliefImageEl.height;
      const h = parseFloat(inputReliefH.value);
      if (!isNaN(h) && h > 0) {
        inputReliefW.value = Math.round((h * aspect) * 2) / 2;
      }
    }
    updateReliefPreviewAndStats();
  });

  // Geração, Download e Cópia de G-code
  btnGenerate.addEventListener('click', generateGCode);
  btnDownload.addEventListener('click', downloadGCode);
  btnCopy.addEventListener('click', copyGCodeToClipboard);

  // Controlos manuais de Zoom
  btnZoomIn.addEventListener('click', zoomInCanvas);
  btnZoomOut.addEventListener('click', zoomOutCanvas);
  btnResetView.addEventListener('click', resetCanvasView);

  // Monitorização de Movimento no Canvas (Coordenadas)
  canvas.on('mouse:move', handleCanvasMouseMove);

  // Interação de Criação de Desenhos com Rato e Pan
  canvas.on('mouse:down', handleCanvasMouseDown);
  canvas.on('mouse:move', handleCanvasDrawingMove);
  canvas.on('mouse:move', handleCanvasMouseMoveForPan);
  canvas.on('mouse:up', handleCanvasMouseUp);
  canvas.on('mouse:wheel', handleCanvasMouseWheel);

  // Desativar menu de contexto para permitir Pan com clique direito do rato
  const container = document.querySelector('.canvas-container');
  if (container) {
    container.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Gestão de Seleção
  canvas.on('selection:created', updateSelectionState);
  canvas.on('selection:updated', updateSelectionState);
  canvas.on('selection:cleared', updateSelectionState);

  // Limpar percursos de simulação antigos e guardar estado quando o canvas muda (apenas para formas reais)
  canvas.on('object:modified', (e) => {
    if (e.target && (e.target.isVisualPath || e.target.isOriginMarker)) return;
    clearVisualToolpaths();
    saveAppState();
  });
  canvas.on('object:added', (e) => {
    if (e.target && (e.target.isVisualPath || e.target.isOriginMarker)) return;
    clearVisualToolpaths();
    saveAppState();
  });
  canvas.on('object:removed', (e) => {
    if (e.target && (e.target.isVisualPath || e.target.isOriginMarker)) return;
    clearVisualToolpaths();
    saveAppState();
  });

  // Finalização global de arrasto fora do canvas
  window.addEventListener('mouseup', handleWindowMouseUp);

  // Atalho de teclado para apagar objectos com a tecla Delete
  window.addEventListener('keydown', handleKeyDown);

  // Eventos do Menu de Contexto Personalizado
  ctxSendToOrigin.addEventListener('click', () => {
    if (rightClickedObject) {
      sendObjectToOrigin(rightClickedObject);
    }
    hideContextMenu();
  });

  ctxGroup.addEventListener('click', () => {
    groupSelectedObjects();
    hideContextMenu();
  });

  ctxUngroup.addEventListener('click', () => {
    ungroupSelectedObject();
    hideContextMenu();
  });

  ctxDelete.addEventListener('click', () => {
    if (rightClickedObject) {
      canvas.setActiveObject(rightClickedObject);
      deleteSelectedObject();
    }
    hideContextMenu();
  });

  document.addEventListener('click', hideContextMenu);
  canvas.on('mouse:down', (opt) => {
    if (opt.e.button === 0) hideContextMenu();
  });
  canvas.on('mouse:wheel', hideContextMenu);
  
  // Guardar estado quando os parâmetros mudam (inclui espessura do material)
  const params = [inputToolDia, inputSafeZ, inputFeedXY, inputFeedZ, inputDepthTotal, inputDepthPass, selectStrategy, inputMaterialZ, selectToolModule, inputSpindleSpeed];
  params.forEach(input => {
    if (input) {
      input.addEventListener('change', () => {
        clearVisualToolpaths();
        saveAppState();
      });
    }
  });

  // Ouvir alteração directa do Módulo de Trabalho
  if (selectToolModule) {
    selectToolModule.addEventListener('change', () => {
      updateModuleUI(selectToolModule.value);
      clearVisualToolpaths();
      saveAppState();
    });
  }

  // Biblioteca de Ferramentas - Seleccionar Ferramenta
  selectToolLibrary.addEventListener('change', () => {
    const selectedId = selectToolLibrary.value;
    const tool = toolsLibrary.find(t => t.id === selectedId);
    if (tool) {
      inputToolDia.value = tool.toolDia;
      inputSafeZ.value = tool.safeZ;
      inputFeedXY.value = tool.feedXY;
      inputFeedZ.value = tool.feedZ;
      inputDepthPass.value = tool.depthPass;
      
      updateModuleUI(tool.moduleType || 'spindle', tool.spindleSpeed);
      
      clearVisualToolpaths();
      saveAppState();
    }
  });

  // Biblioteca de Ferramentas - Abrir Janela Gestora
  btnOpenToolManager.addEventListener('click', showToolManagerModal);
  
  // Biblioteca de Ferramentas - Fechar Janela Gestora
  btnCloseToolManager.addEventListener('click', hideToolManagerModal);
  btnCloseToolManagerFooter.addEventListener('click', hideToolManagerModal);

  // Submissão do Formulário de Cadastro do Gestor de Ferramentas
  toolManagerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addToolFromManager();
  });

  // Limpar formulário de cadastro do gestor
  btnMngrClearForm.addEventListener('click', clearToolManagerForm);

  // Comportamento dinâmico no select de módulo do formulário do gestor
  mngrToolModule.addEventListener('change', () => {
    const mod = mngrToolModule.value;
    if (mod === 'spindle') {
      mngrSpindleSpeed.disabled = false;
      mngrSpindleSpeed.value = 12000;
    } else if (mod === 'eot') {
      mngrSpindleSpeed.disabled = false;
      mngrSpindleSpeed.value = 6000;
    } else if (mod === 'dragtool') {
      mngrSpindleSpeed.disabled = true;
      mngrSpindleSpeed.value = 0;
    }
  });

  // Exportar / Importar Ferramentas
  btnExportTools.addEventListener('click', exportToolsLibrary);
  btnImportTools.addEventListener('click', () => fileImportTools.click());
  fileImportTools.addEventListener('change', importToolsLibrary);

  // Atualizar tamanho do canvas quando o tamanho da mesa muda
  inputTableX.addEventListener('change', () => {
    clearVisualToolpaths();
    updateTableSize();
  });
  inputTableY.addEventListener('change', () => {
    clearVisualToolpaths();
    updateTableSize();
  });

  // Tipo de alinhamento de origem muda
  selectOriginType.addEventListener('change', () => {
    clearVisualToolpaths();
    updateWCSOffsets();
  });

  // Offsets manuais mudam
  inputWcsX.addEventListener('change', () => {
    clearVisualToolpaths();
    drawOriginMarker();
    saveAppState();
  });
  inputWcsY.addEventListener('change', () => {
    clearVisualToolpaths();
    drawOriginMarker();
    saveAppState();
  });
}

/**
 * Redimensiona o canvas interativo com base no tamanho da mesa de corte (1mm = 2px)
 */
function updateTableSize() {
  const mmX = parseCAMParam(inputTableX, 500);
  const mmY = parseCAMParam(inputTableY, 500);
  
  const pxWidth = mmX * ESCALA_MM_PX;
  const pxHeight = mmY * ESCALA_MM_PX;
  
  canvas.setWidth(pxWidth);
  canvas.setHeight(pxHeight);
  canvas.requestRenderAll();
  
  // Atualizar offsets WCS visto que a mesa mudou
  updateWCSOffsets();
}

/**
 * Atualiza os offsets WCS baseados no tipo de alinhamento de origem escolhido
 */
function updateWCSOffsets() {
  const mmX = parseCAMParam(inputTableX, 500);
  const mmY = parseCAMParam(inputTableY, 500);
  const originType = selectOriginType.value;
  
  if (originType === 'bottom-left') {
    inputWcsX.value = "0.0";
    inputWcsY.value = "0.0";
    setWCSInputsReadonly(true);
  } else if (originType === 'top-left') {
    inputWcsX.value = "0.0";
    inputWcsY.value = mmY.toFixed(1);
    setWCSInputsReadonly(true);
  } else if (originType === 'top-right') {
    inputWcsX.value = mmX.toFixed(1);
    inputWcsY.value = mmY.toFixed(1);
    setWCSInputsReadonly(true);
  } else if (originType === 'bottom-right') {
    inputWcsX.value = mmX.toFixed(1);
    inputWcsY.value = "0.0";
    setWCSInputsReadonly(true);
  } else if (originType === 'center') {
    inputWcsX.value = (mmX / 2).toFixed(1);
    inputWcsY.value = (mmY / 2).toFixed(1);
    setWCSInputsReadonly(true);
  } else if (originType === 'custom') {
    setWCSInputsReadonly(false);
  }
  
  // Redesenhar mira vermelha
  drawOriginMarker();
  
  // Guardar estado
  saveAppState();
}

/**
 * Ativa ou desativa a edição manual dos inputs de offset WCS
 */
function setWCSInputsReadonly(readonly) {
  if (!inputWcsX || !inputWcsY) return;
  if (readonly) {
    inputWcsX.setAttribute('readonly', 'true');
    inputWcsY.setAttribute('readonly', 'true');
    inputWcsX.style.opacity = '0.6';
    inputWcsY.style.opacity = '0.6';
  } else {
    inputWcsX.removeAttribute('readonly');
    inputWcsY.removeAttribute('readonly');
    inputWcsX.style.opacity = '1.0';
    inputWcsY.style.opacity = '1.0';
  }
}

/**
 * Desenha a mira vermelha que indica visualmente a Origem do Trabalho (X0 Y0) do CNC na mesa
 */
function drawOriginMarker() {
  if (!canvas || !inputWcsX || !inputWcsY) return;

  // 1. Remover marcador antigo
  const toRemove = canvas.getObjects().filter(obj => obj.isOriginMarker);
  toRemove.forEach(obj => canvas.remove(obj));
  
  // 2. Calcular coordenadas do marcador em pixéis com base nos offsets WCS da mesa
  const wcsX = parseCAMParam(inputWcsX, 250);
  const wcsY = parseCAMParam(inputWcsY, 250);
  
  const targetX = wcsX * ESCALA_MM_PX;
  const targetY = canvas.height - (wcsY * ESCALA_MM_PX);

  // 3. Criar os elementos da mira (círculo e duas linhas cruzadas)
  const circle = new fabric.Circle({
    left: targetX - 3.5,
    top: targetY - 3.5,
    radius: 3.5,
    fill: '#ef4444',
    selectable: false,
    evented: false,
    isOriginMarker: true
  });

  const hLine = new fabric.Line([targetX - 12, targetY, targetX + 12, targetY], {
    stroke: '#ef4444',
    strokeWidth: 1.2,
    selectable: false,
    evented: false,
    isOriginMarker: true
  });

  const vLine = new fabric.Line([targetX, targetY - 12, targetX, targetY + 12], {
    stroke: '#ef4444',
    strokeWidth: 1.2,
    selectable: false,
    evented: false,
    isOriginMarker: true
  });

  // Ajustar posição do texto "X0 Y0" para não cortar fora do canvas
  let textLeft = targetX + 8;
  let textTop = targetY - 15;
  if (targetX > canvas.width - 55) textLeft = targetX - 52;
  if (targetY < 20) textTop = targetY + 8;

  const text = new fabric.Text("X0 Y0", {
    left: textLeft,
    top: textTop,
    fontSize: 10,
    fontWeight: 'bold',
    fill: '#ef4444',
    fontFamily: 'sans-serif',
    selectable: false,
    evented: false,
    isOriginMarker: true
  });

  canvas.add(hLine, vLine, circle, text);
  canvas.requestRenderAll();
}

/**
 * Altera a ferramenta ativa e atualiza os botões
 */
function setTool(tool) {
  currentTool = tool;
  
  // Atualizar visual da barra de ferramentas
  toolSelectBtn.classList.toggle('active', tool === 'select');
  toolRectBtn.classList.toggle('active', tool === 'rect');
  toolCircleBtn.classList.toggle('active', tool === 'circle');
  toolLineBtn.classList.toggle('active', tool === 'line');

  // Ajustar interatividade do canvas
  if (tool === 'select') {
    canvas.selection = true;
    canvas.forEachObject(obj => {
      if (!obj.isVisualPath && !obj.isOriginMarker) {
        obj.selectable = true;
        obj.evented = true;
      }
    });
  } else {
    canvas.selection = false;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    canvas.forEachObject(obj => {
      obj.selectable = false;
      obj.evented = false;
    });
  }
}

/**
 * Mostra as coordenadas do rato na barra de estado em Milímetros
 */
function handleCanvasMouseMove(options) {
  if (!options.pointer) return;
  
  // Converter coordenadas em pixéis para milímetros (em relação à origem inferior esquerda, normal em CNC)
  const mmX = (options.pointer.x / ESCALA_MM_PX).toFixed(2);
  const mmY = ((canvas.height - options.pointer.y) / ESCALA_MM_PX).toFixed(2);
  
  canvasCoordsSpan.innerText = `X: ${mmX} mm | Y: ${mmY} mm`;
}

/**
 * Inicia o desenho de uma forma
 */
function handleCanvasMouseDown(options) {
  if (!options.pointer) return;

  // Interacções de clique direito (Pan vs Menu de Contexto)
  if (options.e.button === 2 || options.e.which === 3) {
    const clickedObj = options.target;
    
    // Se clicou num objecto real selecionável, abrir o menu de contexto personalizado
    if (clickedObj && !clickedObj.isVisualPath && !clickedObj.isOriginMarker) {
      showContextMenu(options.e, clickedObj);
      return;
    }
    
    // Se clicou em zona vazia, inicia o Pan (arrasto) e oculta o menu
    hideContextMenu();
    isPanning = true;
    lastPosX = options.e.clientX;
    lastPosY = options.e.clientY;
    canvas.selection = false;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return;
  }

  if (currentTool === 'select') return;
  
  // Segurança anti-bloqueio: se já estava a desenhar, finaliza a forma anterior
  if (isDrawing) {
    handleCanvasMouseUp();
  }
  
  clearVisualToolpaths();
  isDrawing = true;
  const pointer = canvas.getPointer(options.e);
  origX = pointer.x;
  origY = pointer.y;

  const style = {
    fill: 'transparent',
    stroke: '#f97316',
    strokeWidth: 2,
    selectable: false,
    evented: false
  };

  if (currentTool === 'rect') {
    activeShape = new fabric.Rect({
      ...style,
      left: origX,
      top: origY,
      width: 0,
      height: 0
    });
  } else if (currentTool === 'circle') {
    activeShape = new fabric.Circle({
      ...style,
      left: origX,
      top: origY,
      radius: 0
    });
  } else if (currentTool === 'line') {
    activeShape = new fabric.Line([origX, origY, origX, origY], style);
  }

  if (activeShape) {
    canvas.add(activeShape);
    canvas.requestRenderAll();
  }
}

/**
 * Atualiza o tamanho da forma enquanto o rato é arrastado
 */
function handleCanvasDrawingMove(options) {
  if (!isDrawing || !activeShape) return;
  
  const pointer = canvas.getPointer(options.e);
  const x = pointer.x;
  const y = pointer.y;

  if (currentTool === 'rect') {
    const width = Math.abs(x - origX);
    const height = Math.abs(y - origY);
    
    activeShape.set({
      left: Math.min(x, origX),
      top: Math.min(y, origY),
      width: width,
      height: height
    });
  } else if (currentTool === 'circle') {
    const rx = Math.abs(x - origX);
    const ry = Math.abs(y - origY);
    const radius = Math.sqrt(rx * rx + ry * ry);
    
    activeShape.set({
      left: origX - radius,
      top: origY - radius,
      radius: radius
    });
  } else if (currentTool === 'line') {
    activeShape.set({
      x2: x,
      y2: y
    });
  }

  canvas.requestRenderAll();
}

/**
 * Conclui o desenho da forma e regressa à ferramenta de seleção
 */
function handleCanvasMouseUp() {
  // Finalizar Pan se estivesse ativo
  if (isPanning) {
    isPanning = false;
    canvas.selection = (currentTool === 'select');
    canvas.requestRenderAll();
    return;
  }

  if (!isDrawing) return;
  isDrawing = false;
  
  // Validar se o objecto desenhado tem dimensões válidas
  if (activeShape) {
    let isValid = true;
    if (currentTool === 'rect' && (activeShape.width < 5 || activeShape.height < 5)) isValid = false;
    if (currentTool === 'circle' && activeShape.radius < 3) isValid = false;
    if (currentTool === 'line' && (Math.abs(activeShape.x2 - activeShape.x1) < 5 && Math.abs(activeShape.y2 - activeShape.y1) < 5)) isValid = false;
    
    if (!isValid) {
      canvas.remove(activeShape);
    } else {
      // Tornar selecionável após finalizar
      activeShape.set({
        selectable: true,
        evented: true
      });
      activeShape.setCoords();
    }
  }

  activeShape = null;
  setTool('select');
  saveAppState();
}

/**
 * Finalização de arrasto global de rato quando solto fora do canvas
 */
function handleWindowMouseUp() {
  if (isDrawing) {
    handleCanvasMouseUp();
  }
}

/**
 * Trata eventos de teclas de atalho globais (ex: Delete para remover objectos)
 */
function handleKeyDown(e) {
  // Impedir eliminação se o utilizador estiver focado em caixas de input
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedObject();
    e.preventDefault();
  }
}

/**
 * Zoom In manual através do botão flutuante
 */
function zoomInCanvas() {
  let zoom = canvas.getZoom();
  zoom += 0.15;
  if (zoom > 20) zoom = 20;
  canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
}

/**
 * Zoom Out manual através do botão flutuante
 */
function zoomOutCanvas() {
  let zoom = canvas.getZoom();
  zoom -= 0.15;
  if (zoom < 0.1) zoom = 0.1;
  canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
}

/**
 * Repõe o zoom e pan da mesa (Visualização 1:1)
 */
function resetCanvasView() {
  canvas.setZoom(1.0);
  canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
  canvas.requestRenderAll();
}

/**
 * Zoom dinâmico centrado na posição atual do rato (Roda do Rato)
 */
function handleCanvasMouseWheel(opt) {
  const delta = opt.e.deltaY;
  let zoom = canvas.getZoom();
  zoom *= 0.999 ** delta;
  if (zoom > 20) zoom = 20;
  if (zoom < 0.1) zoom = 0.1;
  
  canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
  opt.e.preventDefault();
  opt.e.stopPropagation();
}

/**
 * Arrasta e desloca (Pan) a mesa de corte no ecrã com clique direito ou botão do meio
 */
function handleCanvasMouseMoveForPan(options) {
  if (!isPanning) return;
  const e = options.e;
  const vpt = canvas.viewportTransform;
  vpt[4] += e.clientX - lastPosX;
  vpt[5] += e.clientY - lastPosY;
  canvas.requestRenderAll();
  lastPosX = e.clientX;
  lastPosY = e.clientY;
}

/**
 * Actualiza botões sensíveis à selecção activa do Canvas
 */
function updateSelectionState() {
  const activeObject = canvas.getActiveObject();
  
  if (activeObject && !activeObject.isVisualPath) {
    btnDelete.classList.remove('disabled');
    btnDelete.removeAttribute('disabled');
    
    // Se for uma imagem bitmap, permite vetorizar
    if (activeObject.type === 'image') {
      btnVectorize.classList.remove('disabled');
      btnVectorize.removeAttribute('disabled');
    } else {
      btnVectorize.classList.add('disabled');
      btnVectorize.setAttribute('disabled', 'true');
    }
  } else {
    btnDelete.classList.add('disabled');
    btnDelete.setAttribute('disabled', 'true');
    
    btnVectorize.classList.add('disabled');
    btnVectorize.setAttribute('disabled', 'true');
  }
}

/**
 * Elimina o objeto atualmente selecionado
 */
function deleteSelectedObject() {
  const activeObject = canvas.getActiveObject();
  if (activeObject) {
    if (activeObject.type === 'activeSelection') {
      activeObject.forEachObject(obj => canvas.remove(obj));
      canvas.discardActiveObject();
    } else {
      canvas.remove(activeObject);
    }
    canvas.requestRenderAll();
    saveAppState();
  }
}

let clearConfirmActive = false;
let clearTimer = null;

/**
 * Limpa todo o canvas de desenho com confirmação de clique duplo premium (sem pop-up nativo)
 */
function clearCanvas() {
  if (!clearConfirmActive) {
    clearConfirmActive = true;
    btnClear.innerHTML = "⚠️ Tens a certeza?";
    btnClear.style.background = "var(--danger)";
    btnClear.style.color = "#fff";
    
    // Repor o botão após 3 segundos se não for clicado novamente
    clearTimer = setTimeout(() => {
      resetClearButton();
    }, 3000);
  } else {
    // Segundo clique: Limpar efetivamente
    clearTimeout(clearTimer);
    canvas.clear();
    canvas.setBackgroundColor('#10141e', canvas.renderAll.bind(canvas));
    clearVisualToolpaths();
    saveAppState();
    resetClearButton();
  }
}

/**
 * Repõe o texto e estilo original do botão de Limpar Tudo
 */
function resetClearButton() {
  clearConfirmActive = false;
  btnClear.innerHTML = "🗑️ Limpar Tudo";
  btnClear.style.background = ""; // Repor estilo CSS padrão
  btnClear.style.color = "";
}


/**
 * Limpa apenas as linhas pontilhadas de percurso da ferramenta (simulação)
 */
function clearVisualToolpaths() {
  const objects = canvas.getObjects();
  const toRemove = objects.filter(obj => obj.isVisualPath);
  toRemove.forEach(obj => canvas.remove(obj));
  
  // Desativar botões se a trajetória anterior for invalidada
  btnDownload.classList.add('disabled');
  btnDownload.setAttribute('disabled', 'true');
  btnCopy.classList.add('disabled');
  btnCopy.setAttribute('disabled', 'true');
  lastGeneratedGCode = "";
  canvas.requestRenderAll();
}

/**
 * Importa ficheiros SVG ou imagens raster (PNG/JPG)
 */
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  clearVisualToolpaths();
  const reader = new FileReader();

  if (file.type === 'image/svg+xml') {
    reader.onload = function(f) {
      fabric.loadSVGFromString(f.target.result, function(objects, options) {
        const obj = fabric.util.groupSVGElements(objects, options);
        
        obj.scaleToWidth(250);
        obj.set({
          left: (canvas.width - obj.getScaledWidth()) / 2,
          top: (canvas.height - obj.getScaledHeight()) / 2,
          stroke: '#f97316',
          strokeWidth: obj.strokeWidth || 1.5
        });
        
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        saveAppState();
      });
    };
    reader.readAsText(file);
  } else if (file.type.match('image.*')) {
    reader.onload = function(f) {
      fabric.Image.fromURL(f.target.result, function(img) {
        img.scaleToWidth(250);
        img.set({
          left: (canvas.width - img.getScaledWidth()) / 2,
          top: (canvas.height - img.getScaledHeight()) / 2,
          opacity: 0.85
        });
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        saveAppState();
      });
    };
    reader.readAsDataURL(file);
  }
  
  e.target.value = '';
}

/**
 * Vetoriza a imagem selecionada usando ImageTracer.js
 */
function vectorizeSelectedImage() {
  const activeObject = canvas.getActiveObject();
  if (!activeObject || activeObject.type !== 'image') return;

  const imgElement = activeObject._element;
  if (!imgElement) return;

  clearVisualToolpaths();

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imgElement.naturalWidth || imgElement.width;
  tempCanvas.height = imgElement.naturalHeight || imgElement.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(imgElement, 0, 0);
  
  try {
    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    
    const options = {
      ltres: 1,
      qtres: 1,
      pathomit: 8,
      colorsampling: 1,
      numberofcolors: 2,
      strokewidth: 2,
      pal: [{r:0,g:0,b:0,a:255}, {r:255,g:255,b:255,a:255}]
    };
    
    const svgString = ImageTracer.imagedataToSVG(imgData, options);
    
    fabric.loadSVGFromString(svgString, function(objects, opts) {
      const gcodeContour = fabric.util.groupSVGElements(objects, opts);
      
      gcodeContour.set({
        left: activeObject.left,
        top: activeObject.top,
        scaleX: activeObject.getScaledWidth() / gcodeContour.width,
        scaleY: activeObject.getScaledHeight() / gcodeContour.height,
        fill: 'transparent',
        stroke: '#f97316',
        strokeWidth: 2
      });

      canvas.remove(activeObject);
      canvas.add(gcodeContour);
      canvas.setActiveObject(gcodeContour);
      canvas.requestRenderAll();
      saveAppState();
    });
  } catch (err) {
    console.error("Erro na vetorização:", err);
    alert("Não foi possível vetorizar a imagem devido a restrições de CORS locais.");
  }
}

/**
 * MOTOR CAM: Gera percursos em G-code e desenha visualização 3D simulada
 */
/**
 * Auxiliar para converter input regional com vírgulas e tratar NaN
 */
function parseCAMParam(inputElement, defaultValue) {
  let valStr = inputElement.value.toString().trim();
  valStr = valStr.replace(',', '.');
  let val = parseFloat(valStr);
  if (isNaN(val)) {
    val = defaultValue;
    inputElement.value = defaultValue;
  }
  return val;
}

/**
 * MOTOR CAM: Gera percursos em G-code e desenha visualização 3D simulada
 */
function generateGCode() {
  try {
    // 1. Filtrar apenas objectos de desenho (ignorar percursos visuais e marcadores)
    const allObjects = canvas.getObjects().filter(obj => !obj.isVisualPath && !obj.isOriginMarker);
    if (allObjects.length === 0) {
      alert("Adiciona pelo menos uma forma ao canvas antes de gerar a trajectória!");
      return;
    }

    // Separar objectos de relevo (imagens 3D) dos contornos normais
    const reliefObjects = allObjects.filter(obj => obj.isReliefImage);
    const contourObjects = allObjects.filter(obj => !obj.isReliefImage);

    // Limpar visualizações antigas
    clearVisualToolpaths();

    // 2. Extrair parâmetros CAM comuns
    const toolDia = parseCAMParam(inputToolDia, 3.175);
    const safeZ = parseCAMParam(inputSafeZ, 5.0);
    const feedXY = parseCAMParam(inputFeedXY, 1200);
    const feedZ = parseCAMParam(inputFeedZ, 400);
    const depthTotal = parseCAMParam(inputDepthTotal, -3.0);
    const depthPass = parseCAMParam(inputDepthPass, 1.0);
    const materialZ = parseCAMParam(inputMaterialZ, 10.0);
    const toolModule = selectToolModule ? selectToolModule.value : 'spindle';
    const spindleSpeed = parseCAMParam(inputSpindleSpeed, 12000);

    // Validações apenas para contornos (não se aplicam ao relevo)
    if (contourObjects.length > 0) {
      if (depthTotal >= 0) {
        alert("A profundidade total tem de ser um valor negativo (abaixo da superfície de corte)!");
        return;
      }
      if (Math.abs(depthTotal) > materialZ) {
        gcodeOutputText.value = `❌ ERRO DE SEGURANÇA:\nA profundidade total de corte (${Math.abs(depthTotal)} mm) excede a espessura do material (${materialZ} mm).\nAjusta a profundidade ou a espessura para evitar colisão e danos na mesa da máquina.`;
        gcodeOutputText.style.color = "var(--danger)";
        return;
      }
    }

    gcodeOutputText.style.color = "var(--success)";

    // 3. Montar Cabeçalho do G-code
    let gcode = [];
    gcode.push(`G21`);
    gcode.push(`G90`);
    gcode.push(`G17`);
    if (toolModule === 'spindle') {
      gcode.push(`M3 S${spindleSpeed.toFixed(0)}`);
      gcode.push(`G4 P1.5 ; Aguardar estabilização do fuso`);
    } else if (toolModule === 'eot') {
      gcode.push(`M3 S${spindleSpeed.toFixed(0)}`);
      gcode.push(`G4 P1.0 ; Aguardar estabilização da oscilação EOT`);
    } else {
      gcode.push(`; Cabeca de Arrasto (Lamina Estatica)`);
    }
    gcode.push(`G0 Z${safeZ.toFixed(3)}`);

    // WCS Offsets
    const wcsX = parseFloat(inputWcsX?.value) || 0;
    const wcsY = parseFloat(inputWcsY?.value) || 0;

    // 4A. PROCESSAR OBJECTOS DE RELEVO 3D (Raster G-code)
    if (reliefObjects.length > 0) {
      gcode.push('; === CORTE 3D POR IMAGEM (GRAYSCALE RELIEF) ===');
      reliefObjects.forEach((fabricImg, imgIdx) => {
        const rs = fabricImg.reliefSettings;
        if (!rs) return;

        // Carregar a imagem original a partir do src guardado
        // Usar o HTMLImageElement já carregado (guardado quando o utilizador confirmou no modal).
        // Se por algum motivo não existir, criar um novo a partir do data URL.
        const img = fabricImg.reliefImgEl || (() => {
          const i = new Image();
          i.src = fabricImg.reliefSrc;
          return i;
        })();

        // Dimensões actuais do objecto na mesa (em mm)
        const objWidthPx = fabricImg.width * fabricImg.scaleX;
        const objHeightPx = fabricImg.height * fabricImg.scaleY;
        const objWidthMM = objWidthPx / ESCALA_MM_PX;
        const objHeightMM = objHeightPx / ESCALA_MM_PX;

        // Posição do objecto na mesa (em mm, coordenadas de canvas convertidas)
        const objLeftMM = fabricImg.left / ESCALA_MM_PX;
        const objTopMM = (canvas.height - (fabricImg.top + objHeightPx)) / ESCALA_MM_PX;

        // Obter mapa de profundidade pré-calculado (IA ou Luminância)
        const dm = fabricImg.reliefDepthMap;
        const dmW = fabricImg.reliefDepthWidth;
        const dmH = fabricImg.reliefDepthHeight;
        const maxDepth = rs.maxDepth || 2.0;

        function getReliefZ(xMM, yMM) {
          if (!dm || !dmW || !dmH) return 0;
          const u = Math.min(1, Math.max(0, xMM / objWidthMM));
          const v = Math.min(1, Math.max(0, yMM / objHeightMM));
          const px = Math.min(dmW - 1, Math.max(0, Math.round(u * (dmW - 1))));
          const py = Math.min(dmH - 1, Math.max(0, Math.round(v * (dmH - 1))));
          return -(dm[py * dmW + px] * maxDepth);
        }

        // Raster X
        gcode.push(`; Imagem ${imgIdx + 1} — Raster X`);
        let lx = 0;
        for (let y = 0; y <= objHeightMM; y += toolDia) {
          const ltr = lx % 2 === 0;
          const xs = ltr ? 0 : objWidthMM;
          const xe = ltr ? objWidthMM : 0;
          const xSt = ltr ? toolDia : -toolDia;
          gcode.push(`G0 Z${safeZ.toFixed(3)}`);
          gcode.push(`G0 X${(objLeftMM + xs - wcsX).toFixed(3)} Y${(objTopMM + y - wcsY).toFixed(3)}`);
          for (let x = xs; ltr ? x <= xe : x >= xe; x += xSt) {
            const z = getReliefZ(x, y);
            gcode.push(`G1 X${(objLeftMM + x - wcsX).toFixed(3)} Y${(objTopMM + y - wcsY).toFixed(3)} Z${z.toFixed(3)} F${feedXY.toFixed(0)}`);
          }
          lx++;
        }

        // Raster Y (passe cruzado)
        if (rs.doublePass) {
          gcode.push(`; Imagem ${imgIdx + 1} — Raster Y`);
          let ly = 0;
          for (let x = 0; x <= objWidthMM; x += toolDia) {
            const btt = ly % 2 === 0;
            const ys = btt ? 0 : objHeightMM;
            const ye = btt ? objHeightMM : 0;
            const ySt = btt ? toolDia : -toolDia;
            gcode.push(`G0 Z${safeZ.toFixed(3)}`);
            gcode.push(`G0 X${(objLeftMM + x - wcsX).toFixed(3)} Y${(objTopMM + ys - wcsY).toFixed(3)}`);
            for (let y = ys; btt ? y <= ye : y >= ye; y += ySt) {
              const z = getReliefZ(x, y);
              gcode.push(`G1 X${(objLeftMM + x - wcsX).toFixed(3)} Y${(objTopMM + y - wcsY).toFixed(3)} Z${z.toFixed(3)} F${feedXY.toFixed(0)}`);
            }
            ly++;
          }
        }
      });
    }

    // 4B. Processar Geometria de contornos normais (rectângulos, círculos, linhas, SVG)
    const toolpathsToVisualise = [];

    // 4. Processar Geometria de cada objecto de contorno no Canvas
    contourObjects.forEach((obj, idx) => {
      let points = [];

      // --- CASO 1: RETÂNGULO ---
      if (obj.type === 'rect') {
        const coords = obj.getCoords(); // tl, tr, br, bl
        points = [
          { x: coords[0].x, y: coords[0].y },
          { x: coords[1].x, y: coords[1].y },
          { x: coords[2].x, y: coords[2].y },
          { x: coords[3].x, y: coords[3].y },
          { x: coords[0].x, y: coords[0].y } // Fechar loop
        ];
      }
      // --- CASO 2: CÍRCULO ---
      else if (obj.type === 'circle') {
        const center = obj.getCenterPoint();
        const radius = obj.radius * (obj.scaleX || 1);
        const steps = 64; // Aproximação por polígono de 64 lados
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * 2 * Math.PI;
          const px = center.x + radius * Math.cos(theta);
          const py = center.y + radius * Math.sin(theta);
          points.push({ x: px, y: py });
        }
      }
      // --- CASO 3: LINHA ---
      else if (obj.type === 'line') {
        const coords = obj.getCoords();
        points = [
          { x: coords[0].x, y: coords[0].y },
          { x: coords[1].x, y: coords[1].y }
        ];
      }
      // --- CASO 4: CAMINHO / SVG / GRUPO ---
      else {
        // Usar a API do browser para caminhar no SVG de forma extremamente precisa
        const svgNS = "http://www.w3.org/2000/svg";
        const tempSvg = document.createElementNS(svgNS, "svg");
        const tempPath = document.createElementNS(svgNS, "path");
        
        let dString = "";
        if (obj.type === 'path') {
          dString = obj.path.map(cmd => cmd.join(' ')).join(' ');
        } else {
          // Se for um grupo (SVG complexo), extraímos o caminho serializando para SVG
          const svgString = obj.toSVG();
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgString, 'image/svg+xml');
          const paths = doc.querySelectorAll('path');
          paths.forEach(p => {
            dString += " " + p.getAttribute('d');
          });
        }

        if (dString.trim()) {
          tempPath.setAttribute('d', dString);
          tempSvg.appendChild(tempPath);
          document.body.appendChild(tempSvg);
          
          try {
            const totalLength = tempPath.getTotalLength();
            const stepSize = 2; // Resolução de amostragem de 1mm (2px)
            const numPoints = Math.max(12, Math.ceil(totalLength / stepSize));
            
            const matrix = obj.calcTransformMatrix();
            for (let i = 0; i <= numPoints; i++) {
              const dist = (i / numPoints) * totalLength;
              const pt = tempPath.getPointAtLength(dist);
              // Transformar coordenadas locais do SVG em coordenadas globais do Canvas
              const transformedPt = fabric.util.transformPoint({ x: pt.x, y: pt.y }, matrix);
              points.push(transformedPt);
            }
          } catch (e) {
            console.warn("Erro ao ler caminhos SVG:", e);
          } finally {
            document.body.removeChild(tempSvg);
          }
        }
      }

      // Se extraímos coordenadas com sucesso, gerar os comandos de corte
      if (points.length > 0) {
        // Converter pontos para milímetros em relação à Origem do Trabalho (WCS Zero na mesa)
        const wcsX = parseCAMParam(inputWcsX, 250);
        const wcsY = parseCAMParam(inputWcsY, 250);
        const mmPoints = points.map(pt => {
          const mesaX = pt.x / ESCALA_MM_PX;
          const mesaY = (canvas.height - pt.y) / ESCALA_MM_PX;
          return {
            x: mesaX - wcsX,
            y: mesaY - wcsY
          };
        });

        // Guardar percurso para renderizar no canvas como simulação visual
        toolpathsToVisualise.push(points);

        // Calcular as passagens verticais de descida Z
        const zPasses = [];
        let currentZ = -depthPass;
        while (currentZ > depthTotal) {
          zPasses.push(currentZ);
          currentZ -= depthPass;
        }
        zPasses.push(depthTotal); // Garantir passagem na profundidade final

        // Ponto Inicial da trajectória
        const startPt = mmPoints[0];
        gcode.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)}`);
        
        // Executar percurso completo por camadas Z
        zPasses.forEach((zVal, pIdx) => {
          // Mergulho vertical
          gcode.push(`G1 Z${zVal.toFixed(3)} F${feedZ.toFixed(0)}`);
          
          // Cortar contorno em XY
          for (let i = 1; i < mmPoints.length; i++) {
            gcode.push(`G1 X${mmPoints[i].x.toFixed(3)} Y${mmPoints[i].y.toFixed(3)} F${feedXY.toFixed(0)}`);
          }
        });

        // Retorno para altura segura após concluir objecto
        gcode.push(`G0 Z${safeZ.toFixed(3)}`);
      }
    });

    // 5. Rodapé Final do G-code
    gcode.push(`G0 Z${safeZ.toFixed(3)}`);
    
    // Paragem de rotação/oscilação conforme o Módulo
    if (toolModule === 'spindle' || toolModule === 'eot') {
      gcode.push(`M5`);
    }
    
    gcode.push(`G0 X0 Y0`);
    gcode.push(`M30`);
    
    // Guardar G-code em variável global e apresentar na consola
    lastGeneratedGCode = gcode.join('\n');
    gcodeOutputText.value = lastGeneratedGCode;

    // 6. Activar botões
    btnDownload.classList.remove('disabled');
    btnDownload.removeAttribute('disabled');
    btnCopy.classList.remove('disabled');
    btnCopy.removeAttribute('disabled');

    // 7. Desenhar percursos pontilhados no canvas para simulação
    drawVisualToolpaths(toolpathsToVisualise);
  } catch (err) {
    console.error("Erro na geração do G-code:", err);
    alert("Ocorreu um erro ao gerar o G-code. Por favor, verifica se todos os parâmetros numéricos estão corretos.");
  }
}

/**
 * Desenha percursos de ferramentas no Fabric.js (linhas tracejadas decorativas)
 */
function drawVisualToolpaths(paths) {
  paths.forEach(points => {
    // Desenhar linhas pontilhadas azuis para indicar corte
    for (let i = 0; i < points.length - 1; i++) {
      const line = new fabric.Line([points[i].x, points[i].y, points[i+1].x, points[i+1].y], {
        stroke: '#60a5fa', // Azul simulação
        strokeWidth: 1.5,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        isVisualPath: true // Tag de identificação para limpeza posterior
      });
      canvas.add(line);
    }
  });
  canvas.requestRenderAll();
}

/**
 * Descarrega o G-code gerado como ficheiro (.nc)
 */
async function downloadGCode() {
  try {
    if (!lastGeneratedGCode) {
      alert("Nenhum G-code disponível para guardar!");
      return;
    }

    // Abordagem moderna (File System Access API) - Resolve 100% dos bugs de extensões e UUIDs
    // Abre a janela nativa do Windows para guardar ficheiro com a extensão garantida.
    if (window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: 'gcoded_output.nc',
          types: [{
            description: 'G-Code File',
            accept: { 'text/plain': ['.nc', '.gcode', '.txt'] }
          }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(lastGeneratedGCode);
        await writable.close();
        return; // Guardado com sucesso!
      } catch (err) {
        // Se o utilizador apenas cancelar a janela, ignoramos silenciosamente
        if (err.name === 'AbortError') return;
        console.warn("API de sistema de ficheiros falhou, a usar fallback...", err);
      }
    }

    // Fallback para browsers antigos que não suportam showSaveFilePicker
    const blob = new Blob([lastGeneratedGCode], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcoded_output.nc';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 3000);
  } catch (err) {
    console.error("Erro ao transferir o ficheiro:", err);
    alert("Erro ao transferir o ficheiro G-code. Tenta copiar o código da consola manualmente.");
  }
}

/**
 * Copia o G-code gerado para a área de transferência do sistema com feedback visual premium
 */
function copyGCodeToClipboard() {
  try {
    if (!lastGeneratedGCode) {
      alert("Nenhum G-code disponível para copiar!");
      return;
    }

    // Criar elemento de texto oculto para cópia clássica (funciona em todos os ambientes)
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = lastGeneratedGCode;
    tempTextArea.style.position = 'fixed';
    tempTextArea.style.top = '0';
    tempTextArea.style.left = '0';
    tempTextArea.style.opacity = '0';
    document.body.appendChild(tempTextArea);
    tempTextArea.focus();
    tempTextArea.select();
    
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      console.error("execCommand falhou:", err);
    }
    
    document.body.removeChild(tempTextArea);

    if (success) {
      showCopyFeedback();
    } else if (navigator.clipboard) {
      // Tentar a API moderna se a clássica falhar por algum motivo
      navigator.clipboard.writeText(lastGeneratedGCode).then(() => {
        showCopyFeedback();
      }).catch(err => {
        console.error("Erro na API modern clipboard:", err);
        fallbackAlert();
      });
    } else {
      fallbackAlert();
    }
  } catch (err) {
    console.error("Erro geral no fluxo de cópia:", err);
    fallbackAlert();
  }
}

/**
 * Apresenta o feedback visual premium de cópia efetuada
 */
function showCopyFeedback() {
  const originalText = btnCopy.innerHTML;
  btnCopy.innerHTML = "✅ Copiado!";
  btnCopy.style.background = "var(--success)";
  btnCopy.style.borderColor = "var(--success)";
  btnCopy.style.color = "#fff";
  
  setTimeout(() => {
    btnCopy.innerHTML = originalText;
    btnCopy.style.background = ""; // Repor estilo CSS
    btnCopy.style.borderColor = "";
    btnCopy.style.color = "";
  }, 2000);
}

/**
 * Alerta de falha na cópia
 */
function fallbackAlert() {
  alert("Não foi possível copiar automaticamente. Selecciona o texto na consola e copia manualmente.");
}

/**
 * Persiste o estado completo no localStorage
 */
function saveAppState() {
  if (!canvas) return;

  // Filtrar objetos visuais temporários de percursos e marcadores antes de guardar
  const rawObjects = canvas.getObjects().filter(obj => !obj.isVisualPath && !obj.isOriginMarker);
  
  const tempCanvas = new fabric.Canvas(null, { width: 500, height: 500 });
  rawObjects.forEach(obj => {
    // Clonar para não alterar o canvas ativo
    obj.clone(cloned => tempCanvas.add(cloned));
  });

  const appState = {
    version: "0.3.0",
    lastModified: new Date().toLocaleString(),
    canvasData: tempCanvas.toJSON(['selectable', 'evented', 'stroke', 'strokeWidth']),
    cncParams: {
      toolDia: parseFloat(inputToolDia.value),
      safeZ: parseFloat(inputSafeZ.value),
      feedXY: parseFloat(inputFeedXY.value),
      feedZ: parseFloat(inputFeedZ.value),
      depthTotal: parseFloat(inputDepthTotal.value),
      depthPass: parseFloat(inputDepthPass.value),
      strategy: selectStrategy.value,
      tableX: parseFloat(inputTableX.value),
      tableY: parseFloat(inputTableY.value),
      materialZ: parseFloat(inputMaterialZ.value),
      originType: selectOriginType.value,
      wcsX: parseFloat(inputWcsX.value),
      wcsY: parseFloat(inputWcsY.value),
      activeToolId: selectToolLibrary ? selectToolLibrary.value : 'flat-3175',
      toolModule: selectToolModule ? selectToolModule.value : 'spindle',
      spindleSpeed: parseFloat(inputSpindleSpeed.value)
    }
  };

  try {
    localStorage.setItem('gcoded_settings', JSON.stringify(appState));
  } catch (err) {
    console.error("Erro ao persistir estado:", err);
  }
}

/**
 * Restaura o estado a partir do localStorage
 */
function loadAppState() {
  try {
    const data = localStorage.getItem('gcoded_settings');
    if (!data) return;

    const appState = JSON.parse(data);
    
    // Restaurar Parâmetros
    if (appState.cncParams) {
      const p = appState.cncParams;
      inputToolDia.value = p.toolDia || 3.175;
      inputSafeZ.value = p.safeZ || 5.0;
      inputFeedXY.value = p.feedXY || 1200;
      inputFeedZ.value = p.feedZ || 400;
      inputDepthTotal.value = p.depthTotal || -3.0;
      inputDepthPass.value = p.depthPass || 1.0;
      selectStrategy.value = p.strategy || 'on';
      inputTableX.value = p.tableX || 500;
      inputTableY.value = p.tableY || 500;
      inputMaterialZ.value = p.materialZ || 10.0;
      selectOriginType.value = p.originType || 'center';
      inputWcsX.value = p.wcsX !== undefined ? p.wcsX : 250.0;
      inputWcsY.value = p.wcsY !== undefined ? p.wcsY : 250.0;
      
      // Restaurar selecção da ferramenta activa
      if (p.activeToolId && selectToolLibrary) {
        selectToolLibrary.value = p.activeToolId;
      }
      
      // Restaurar o módulo de trabalho e rotações
      updateModuleUI(p.toolModule || 'spindle', p.spindleSpeed || 12000);
      
      // Colocar inputs readonly se for alinhamento automático
      setWCSInputsReadonly(selectOriginType.value !== 'custom');
      
      // Redimensionar canvas com os limites recuperados
      updateTableSize();
    }

    // Restaurar Canvas
    if (appState.canvasData && appState.canvasData.objects && appState.canvasData.objects.length > 0) {
      canvas.loadFromJSON(appState.canvasData, function() {
        canvas.forEachObject(obj => {
          obj.selectable = true;
          obj.evented = true;
        });
        canvas.requestRenderAll();
      });
    }
  } catch (err) {
    console.error("Erro ao restaurar o estado:", err);
  }
}

/**
 * Move o objecto selecionado (ou selecção activa) para que o seu centro coincida com a Origem do Trabalho (X0 Y0)
 */
function sendObjectToOrigin(obj) {
  if (!canvas || !inputWcsX || !inputWcsY || !obj) return;
  
  // 1. Calcular coordenadas da Origem do Trabalho (X0 Y0) em pixéis no canvas
  const wcsX = parseCAMParam(inputWcsX, 250);
  const wcsY = parseCAMParam(inputWcsY, 250);
  
  const targetX = wcsX * ESCALA_MM_PX;
  const targetY = canvas.height - (wcsY * ESCALA_MM_PX);
  
  // 2. Mover o objecto alinhando o seu canto inferior esquerdo com a origem (garante que fica na área de trabalho)
  obj.setPositionByOrigin(new fabric.Point(targetX, targetY), 'left', 'bottom');
  obj.setCoords();
  
  // 3. Limpar percursos antigos (forçando recalculo), atualizar e salvar estado
  clearVisualToolpaths();
  canvas.requestRenderAll();
  saveAppState();
}

/**
 * Mostra o menu de contexto personalizado na posição do rato
 */
function showContextMenu(e, obj) {
  if (!contextMenu) return;
  rightClickedObject = obj;

  // Determinar o que mostrar consoante o tipo de selecção
  const activeObjs = canvas.getActiveObjects();
  const isGroup = obj && obj.type === 'group';
  const isMultiSelection = activeObjs.length > 1;

  // "Agrupar" — apenas visivel com 2+ objectos seleccionados (que não sejam o marcador de origem)
  const canGroup = isMultiSelection && activeObjs.every(o => !o.isOriginMarker && !o.isVisualPath);
  ctxGroup.style.display = canGroup ? 'block' : 'none';

  // "Desagrupar" — apenas visivel quando o objecto clicado for um grupo
  ctxUngroup.style.display = isGroup ? 'block' : 'none';

  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.style.display = 'block';
}

/**
 * Oculta o menu de contexto personalizado
 */
function hideContextMenu() {
  if (contextMenu) {
    contextMenu.style.display = 'none';
  }
  rightClickedObject = null;
}

/**
 * Agrupa todos os objectos actualmente seleccionados num só grupo Fabric.js
 */
function groupSelectedObjects() {
  const activeObjs = canvas.getActiveObjects();
  if (activeObjs.length < 2) return;

  // Filtrar apenas formas reais (excluir marca de origem e percursos visuais)
  const toGroup = activeObjs.filter(o => !o.isOriginMarker && !o.isVisualPath);
  if (toGroup.length < 2) return;

  // Desseleccionar antes de agrupar
  canvas.discardActiveObject();

  const group = new fabric.Group(toGroup, {
    originX: 'left',
    originY: 'top'
  });

  // Remover formas individuais e adicionar o grupo
  toGroup.forEach(obj => canvas.remove(obj));
  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();

  clearVisualToolpaths();
  saveAppState();
}

/**
 * Desagrupa o grupo actualmente seleccionado, devolvendo os objectos individuais ao canvas
 */
function ungroupSelectedObject() {
  const activeObj = canvas.getActiveObject();
  if (!activeObj || activeObj.type !== 'group') return;

  const items = activeObj.getObjects();
  activeObj.destroy(); // Liberta as referências internas do grupo
  canvas.remove(activeObj);

  // Readicionar cada elemento individualmente com as coordenadas absolutas restauradas
  items.forEach(item => {
    item.set({ originX: 'left', originY: 'top' });
    canvas.add(item);
  });

  // Seleccionar todos os objectos libertados
  const sel = new fabric.ActiveSelection(items, { canvas });
  canvas.setActiveObject(sel);
  canvas.requestRenderAll();

  clearVisualToolpaths();
  saveAppState();
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
