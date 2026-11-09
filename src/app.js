// Gcoded - Lógica CAM/CNC Offline-First

// Mapeamento de Escala: 1 mm = 2 px (Canvas 500x500 px = Área CNC 250x250 mm)
const ESCALA_MM_PX = 2;
const TAMANHO_GRELHA_MM = 10; // Linhas principais a cada 10mm
const TAMANHO_GRELHA_PX = TAMANHO_GRELHA_MM * ESCALA_MM_PX;

// Estado Global
let canvas;
let currentTool = 'select'; // 'select' | 'rect' | 'circle' | 'line'
let isDrawing = false;
let isRestoringState = false;
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
let btnImportTrigger, fileImport, btnVectorize, importModal, btnCloseImport, btnCloseImportFooter, importDropzone, btnBrowseFile;
let btnDelete, btnClear, btnCopy;
let canvasCoordsSpan, gcodeOutputText;
let btnGenerate, btnDownload;
let btnZoomIn, btnZoomOut, btnResetView;
let deferredInstallPrompt = null;
let btnInstallApp, btnModalInstallAction, installModal, btnCloseInstall, btnCloseInstallFooter;

// Inputs de Parâmetros
let inputToolDia, inputSafeZ, inputFeedXY, inputFeedZ, inputDepthTotal, inputDepthPass, selectStrategy;
let inputTableX, inputTableY, inputMaterialZ, selectOriginType, inputWcsX, inputWcsY;
let contextMenu, ctxSendToOrigin, ctxDelete, ctxGroup, ctxUngroup;
let rightClickedObject = null;

// Biblioteca de Ferramentas (100% Fresas para CNC Router)
let selectToolLibrary, btnOpenToolManager;
let toolsLibrary = [];
const DEFAULT_TOOLS = [
  { id: 'flat-6000', name: 'Fresa Topo Plano 6.0mm (Corte & Desbaste)', toolType: 'flat', toolDia: 6.0, safeZ: 5.0, feedXY: 1800, feedZ: 500, depthPass: 2.0, stepover: 40, spindleSpeed: 18000 },
  { id: 'flat-3175', name: 'Fresa Topo Plano 3.175mm (1/8" Contorno)', toolType: 'flat', toolDia: 3.175, safeZ: 5.0, feedXY: 1400, feedZ: 400, depthPass: 1.2, stepover: 40, spindleSpeed: 18000 },
  { id: 'flat-2000', name: 'Fresa Topo Plano 2.0mm (Detalhes & Canais)', toolType: 'flat', toolDia: 2.0, safeZ: 4.0, feedXY: 900, feedZ: 300, depthPass: 0.8, stepover: 35, spindleSpeed: 20000 },
  { id: 'ball-3175', name: 'Fresa Esférica 3.175mm (Relevos 3D & Acabamento)', toolType: 'ball', toolDia: 3.175, safeZ: 5.0, feedXY: 1600, feedZ: 500, depthPass: 1.5, stepover: 15, spindleSpeed: 20000 },
  { id: 'ball-1500', name: 'Fresa Esférica 1.5mm (Relevo Alta Definição)', toolType: 'ball', toolDia: 1.5, safeZ: 4.0, feedXY: 1000, feedZ: 300, depthPass: 0.8, stepover: 10, spindleSpeed: 24000 },
  { id: 'vbit-60-6', name: 'Fresa V-Bit 60° 6mm (Gravação & Chanfro)', toolType: 'vbit', toolDia: 6.0, safeZ: 5.0, feedXY: 1200, feedZ: 350, depthPass: 1.5, stepover: 30, spindleSpeed: 18000 },
  { id: 'vbit-90-12', name: 'Fresa V-Bit 90° 12mm (Entalhes V-Carve)', toolType: 'vbit', toolDia: 12.0, safeZ: 5.0, feedXY: 1400, feedZ: 400, depthPass: 2.0, stepover: 30, spindleSpeed: 16000 },
  { id: 'surf-25000', name: 'Fresa de Aplanar 25mm (Faceamento da Mesa)', toolType: 'surfacing', toolDia: 25.0, safeZ: 5.0, feedXY: 2500, feedZ: 400, depthPass: 0.5, stepover: 60, spindleSpeed: 14000 }
];

// Parâmetros de Fresa e CNC Router
let paramToolType, inputSpindleSpeed, lblSpindleSpeed, inputStepover, paramUseArcs;
let paramUseTabs, tabsSettingsGrid, paramTabCount, paramTabWidth, paramTabHeight;
let paramUseDogbone, dogboneSettingsGrid, paramDogboneType;
let paramUseRamping, rampingSettingsGrid, paramRampAngle, paramRampMaxLen;

// Elementos do Gestor de Ferramentas (Modal)
let toolManagerModal, btnCloseToolManager, btnCloseToolManagerFooter, toolManagerTbody, toolManagerForm, btnMngrClearForm;
let mngrToolName, mngrToolType, mngrToolDia, mngrSafeZ, mngrSpindleSpeed, mngrFeedXY, mngrFeedZ, mngrDepthPass, mngrStepover;
let btnExportTools, btnImportTools, fileImportTools;

// Elementos da Vista e Simulador 3D WebGL (Three.js)
let tabView2d, tabView3d, sim3dContainer, canvasContainer, btnOpenSim3d;
let btnSimPlay, btnSimReset, simSpeedSelect, simTimeline, simProgressText;
let droX, droY, droZ, droF, droLine;
let btnCamIso, btnCamTop, btnCamFront;
let simStatusBadge, simStatusText;
let gcodeStatsCard, statEstTime, statZRange, statBBox, statDistance, gcodeSafetyAlert, gcodeSafetyIcon, gcodeSafetyMsg;

// Estado do Simulador 3D WebGL (Three.js)
let threeScene = null, threeCamera = null, threeRenderer = null, threeControls = null;
let toolpathRapidMesh = null, toolpathCutMesh = null, threeCutterTool = null, threeMaterialMesh = null, threeTableMesh = null;
let simParsedData = null;
let simSegments = [];
let simAnimId = null;
let simIsPlaying = false;
let simCurrentIndex = 0;
let simSpeedMultiplier = 5;
let currentViewMode = '2d'; // '2d' | '3d'

// Elementos do Motor de Corte 3D por Imagem (AI Deep Map & Relief Carving)
let btnImport3D, fileImport3D, reliefModal, btnCloseRelief, btnCloseReliefFooter, btnGenerateRelief;
let previewOriginal, previewDepthmap;
let sliderReliefDepth, sliderReliefBlur, sliderReliefContrast, sliderReliefResolution, sliderReliefDetail;
let lblReliefDepth, lblReliefBlur, lblReliefContrast, lblReliefResolution, lblReliefDetail;
let sliderReliefLightBalance, lblReliefLightBalance;
let sliderReliefBgCut, lblReliefBgCut, sliderReliefLightAngle, lblReliefLightAngle, selectReliefMaterialTheme;
let btnViewArtcam, btnViewGrayscale, btnReliefAutoTune;
let chkReliefInvert, chkReliefDoublePass;
let lblReliefSize, lblReliefLines;
let inputReliefW, inputReliefH, btnLockAspect;
let reliefAspectLocked = true; // proporção travada por defeito
let reliefAiStatusCard, reliefAiStatusText, reliefAiProgressBar, reliefAiPercent;
let btnModeAiDepth, btnModeLuminance, lblDepthPreviewTitle;

// Estado interno do motor de IA
let reliefImageEl = null; // Imagem actualmente carregada no modal 3D
let currentReliefMode = 'ai-depth'; // 'ai-depth' | 'luminance'
let currentReliefViewMode = 'artcam'; // 'artcam' | 'grayscale'
let depthPipeline = null;
let isProcessingAI = false;
let cachedAIDepthResult = null; // { rawDepthMap: Float32Array, width: number, height: number }

/**
 * Inicialização Principal
 */
function init() {
  cacheUIElements();
  initCanvas();
  window.canvas = canvas;
  updateTableSize();
  initToolLibrary(); // Inicializar biblioteca de ferramentas
  setupEventListeners();
  setupPWAInstall(); // Configurar suporte de instalação PWA e offline
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
  importModal = document.getElementById('import-modal');
  btnCloseImport = document.getElementById('btn-close-import');
  btnCloseImportFooter = document.getElementById('btn-close-import-footer');
  importDropzone = document.getElementById('import-dropzone');
  btnBrowseFile = document.getElementById('btn-browse-file');

  btnInstallApp = document.getElementById('btn-install-app');
  btnModalInstallAction = document.getElementById('btn-modal-install-action');
  installModal = document.getElementById('install-modal');
  btnCloseInstall = document.getElementById('btn-close-install');
  btnCloseInstallFooter = document.getElementById('btn-close-install-footer');
  
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

  // Inputs e Parâmetros da Fresa (CNC Router)
  inputToolDia = document.getElementById('param-tool-dia');
  inputSafeZ = document.getElementById('param-safe-z');
  inputFeedXY = document.getElementById('param-feed-xy');
  inputFeedZ = document.getElementById('param-feed-z');
  inputDepthTotal = document.getElementById('param-depth-total');
  inputDepthPass = document.getElementById('param-depth-pass');
  selectStrategy = document.getElementById('param-strategy');
  paramToolType = document.getElementById('param-tool-type');
  inputStepover = document.getElementById('param-stepover');
  paramUseArcs = document.getElementById('param-use-arcs');
  inputSpindleSpeed = document.getElementById('param-spindle-speed');
  lblSpindleSpeed = document.getElementById('lbl-spindle-speed');

  paramUseTabs = document.getElementById('param-use-tabs');
  tabsSettingsGrid = document.getElementById('tabs-settings-grid');
  paramTabCount = document.getElementById('param-tab-count');
  paramTabWidth = document.getElementById('param-tab-width');
  paramTabHeight = document.getElementById('param-tab-height');

  if (paramUseTabs) {
    paramUseTabs.addEventListener('change', () => {
      const active = paramUseTabs.checked;
      if (tabsSettingsGrid) {
        tabsSettingsGrid.style.opacity = active ? '1' : '0.45';
        tabsSettingsGrid.style.pointerEvents = active ? 'auto' : 'none';
      }
      saveAppState();
    });
  }
  if (paramTabCount) paramTabCount.addEventListener('change', saveAppState);
  if (paramTabWidth) paramTabWidth.addEventListener('change', saveAppState);
  if (paramTabHeight) paramTabHeight.addEventListener('change', saveAppState);

  // Alívio de Cantos / Dogbone Fillets (REA FreeCAD / VCarve)
  paramUseDogbone = document.getElementById('param-use-dogbone');
  dogboneSettingsGrid = document.getElementById('dogbone-settings-grid');
  paramDogboneType = document.getElementById('param-dogbone-type');

  if (paramUseDogbone) {
    paramUseDogbone.addEventListener('change', () => {
      const active = paramUseDogbone.checked;
      if (dogboneSettingsGrid) {
        dogboneSettingsGrid.style.opacity = active ? '1' : '0.45';
        dogboneSettingsGrid.style.pointerEvents = active ? 'auto' : 'none';
      }
      clearVisualToolpaths();
      saveAppState();
    });
  }
  if (paramDogboneType) {
    paramDogboneType.addEventListener('change', () => {
      clearVisualToolpaths();
      saveAppState();
    });
  }

  // Entrada em Rampa / Ramp Entry (REA Carbide Create & FreeCAD)
  paramUseRamping = document.getElementById('param-use-ramping');
  rampingSettingsGrid = document.getElementById('ramping-settings-grid');
  paramRampAngle = document.getElementById('param-ramp-angle');
  paramRampMaxLen = document.getElementById('param-ramp-max-len');

  if (paramUseRamping) {
    paramUseRamping.addEventListener('change', () => {
      const active = paramUseRamping.checked;
      if (rampingSettingsGrid) {
        rampingSettingsGrid.style.opacity = active ? '1' : '0.45';
        rampingSettingsGrid.style.pointerEvents = active ? 'auto' : 'none';
      }
      clearVisualToolpaths();
      saveAppState();
    });
  }
  if (paramRampAngle) paramRampAngle.addEventListener('change', saveAppState);
  if (paramRampMaxLen) paramRampMaxLen.addEventListener('change', saveAppState);

  inputTableX = document.getElementById('param-table-x');
  inputTableY = document.getElementById('param-table-y');
  inputMaterialZ = document.getElementById('param-material-z');
  selectOriginType = document.getElementById('param-origin-type');
  inputWcsX = document.getElementById('param-wcs-x');
  inputWcsY = document.getElementById('param-wcs-y');

  // Mapear elementos da biblioteca de ferramentas
  selectToolLibrary = document.getElementById('select-tool-library');
  btnOpenToolManager = document.getElementById('btn-open-tool-manager');

  // Mapear elementos do gestor de ferramentas (Modal)
  toolManagerModal = document.getElementById('tool-manager-modal');
  btnCloseToolManager = document.getElementById('btn-close-tool-manager');
  btnCloseToolManagerFooter = document.getElementById('btn-close-tool-manager-footer');
  toolManagerTbody = document.getElementById('tool-manager-tbody');
  toolManagerForm = document.getElementById('tool-manager-form');
  btnMngrClearForm = document.getElementById('btn-mngr-clear-form');
  
  mngrToolName = document.getElementById('mngr-tool-name');
  mngrToolType = document.getElementById('mngr-tool-type');
  mngrToolDia = document.getElementById('mngr-tool-dia');
  mngrSafeZ = document.getElementById('mngr-safe-z');
  mngrSpindleSpeed = document.getElementById('mngr-spindle-speed');
  mngrFeedXY = document.getElementById('mngr-feed-xy');
  mngrFeedZ = document.getElementById('mngr-feed-z');
  mngrDepthPass = document.getElementById('mngr-depth-pass');
  mngrStepover = document.getElementById('mngr-stepover');
  
  btnExportTools = document.getElementById('btn-export-tools');
  btnImportTools = document.getElementById('btn-import-tools');
  fileImportTools = document.getElementById('file-import-tools');

  // Mapear elementos de selecção de Vista e Simulador 3D WebGL
  tabView2d = document.getElementById('tab-view-2d');
  tabView3d = document.getElementById('tab-view-3d');
  sim3dContainer = document.getElementById('sim3d-container');
  canvasContainer = document.getElementById('canvas-container');
  btnOpenSim3d = document.getElementById('btn-open-sim3d');

  btnSimPlay = document.getElementById('btn-sim-play');
  btnSimReset = document.getElementById('btn-sim-reset');
  simSpeedSelect = document.getElementById('sim-speed-select');
  simTimeline = document.getElementById('sim-timeline');
  simProgressText = document.getElementById('sim-progress-text');

  droX = document.getElementById('dro-x');
  droY = document.getElementById('dro-y');
  droZ = document.getElementById('dro-z');
  droF = document.getElementById('dro-f');
  droLine = document.getElementById('dro-line');

  btnCamIso = document.getElementById('btn-cam-iso');
  btnCamTop = document.getElementById('btn-cam-top');
  btnCamFront = document.getElementById('btn-cam-front');

  simStatusBadge = document.getElementById('sim-status-badge');
  simStatusText = document.getElementById('sim-status-text');

  // Mapear elementos do cartão de estatísticas de G-code
  gcodeStatsCard = document.getElementById('gcode-stats-card');
  statEstTime = document.getElementById('stat-est-time');
  statZRange = document.getElementById('stat-z-range');
  statBBox = document.getElementById('stat-bbox');
  statDistance = document.getElementById('stat-distance');
  gcodeSafetyAlert = document.getElementById('gcode-safety-alert');
  gcodeSafetyIcon = document.getElementById('gcode-safety-icon');
  gcodeSafetyMsg = document.getElementById('gcode-safety-msg');

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
  sliderReliefDetail = document.getElementById('relief-detail');
  sliderReliefBlur = document.getElementById('relief-blur');
  sliderReliefContrast = document.getElementById('relief-contrast');
  sliderReliefResolution = document.getElementById('relief-resolution');
  lblReliefDepth = document.getElementById('lbl-relief-depth');
  lblReliefDetail = document.getElementById('lbl-relief-detail');
  lblReliefBlur = document.getElementById('lbl-relief-blur');
  lblReliefContrast = document.getElementById('lbl-relief-contrast');
  lblReliefResolution = document.getElementById('lbl-relief-resolution');
  
  sliderReliefLightBalance = document.getElementById('relief-light-balance');
  lblReliefLightBalance = document.getElementById('lbl-relief-light-balance');
  sliderReliefBgCut = document.getElementById('relief-bg-cut');
  lblReliefBgCut = document.getElementById('lbl-relief-bg-cut');
  sliderReliefLightAngle = document.getElementById('relief-light-angle');
  lblReliefLightAngle = document.getElementById('lbl-relief-light-angle');
  selectReliefMaterialTheme = document.getElementById('relief-material-theme');
  btnViewArtcam = document.getElementById('btn-view-artcam');
  btnViewGrayscale = document.getElementById('btn-view-grayscale');
  btnReliefAutoTune = document.getElementById('btn-relief-auto-tune');

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
 * Reconstrói a tabela de ferramentas dentro do Gestor (100% Fresas CNC Router)
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
    
    // Tipo de Fresa
    const tdType = document.createElement('td');
    let typeLabel = "Topo Plano";
    if (tool.toolType === 'ball') typeLabel = "Esférica (3D)";
    else if (tool.toolType === 'vbit') typeLabel = "V-Bit (Gravação)";
    else if (tool.toolType === 'surfacing') typeLabel = "Aplanar Mesa";
    tdType.innerText = typeLabel;
    tr.appendChild(tdType);
    
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

    // Passo Lateral / Stepover
    const tdStepover = document.createElement('td');
    tdStepover.innerText = `${tool.stepover || 40}%`;
    tr.appendChild(tdStepover);
    
    // Rotação Router
    const tdSpeed = document.createElement('td');
    tdSpeed.innerText = `${tool.spindleSpeed || 18000} RPM`;
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
    if (paramToolType) paramToolType.value = tool.toolType || 'flat';
    if (inputStepover) inputStepover.value = tool.stepover || 40;
    if (inputSpindleSpeed) inputSpindleSpeed.value = tool.spindleSpeed || 18000;
    
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
    toolType: mngrToolType ? mngrToolType.value : 'flat',
    toolDia: parseFloat(mngrToolDia.value) || 3.175,
    safeZ: parseFloat(mngrSafeZ.value) || 5.0,
    feedXY: parseInt(mngrFeedXY.value) || 1400,
    feedZ: parseInt(mngrFeedZ.value) || 400,
    depthPass: parseFloat(mngrDepthPass.value) || 1.0,
    stepover: mngrStepover ? parseInt(mngrStepover.value) || 40 : 40,
    spindleSpeed: parseInt(mngrSpindleSpeed.value) || 18000
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
  if (mngrToolType) mngrToolType.value = "flat";
  mngrToolDia.value = 3.175;
  mngrSafeZ.value = 5.0;
  mngrSpindleSpeed.value = 18000;
  mngrSpindleSpeed.disabled = false;
  mngrFeedXY.value = 1400;
  mngrFeedZ.value = 400;
  mngrDepthPass.value = 1.0;
  if (mngrStepover) mngrStepover.value = 40;
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
    a.download = 'gcoded_router_tools.json';
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
 * Actualiza a interface da barra lateral com os dados da fresa seleccionada
 */
function updateRouterToolUI(toolType, speed, stepover) {
  if (paramToolType && toolType) paramToolType.value = toolType;
  if (inputSpindleSpeed) {
    inputSpindleSpeed.value = speed !== undefined ? speed : 18000;
  }
  if (inputStepover) {
    inputStepover.value = stepover !== undefined ? stepover : 40;
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
 * Analisa a imagem e calibra automaticamente os melhores parâmetros de relevo para CNC
 */
function autoTuneReliefSettings(img, showNotification = true) {
  if (!img) return;

  // 1. Criar canvas de amostragem rápida
  const sampleW = 200;
  const sampleH = Math.round(200 * (img.height / img.width));
  const c = document.createElement('canvas');
  c.width = sampleW;
  c.height = sampleH;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, sampleW, sampleH);

  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const px = imgData.data;

  // 2. Análise de Luminância, Contraste e Assimetria de Sombras
  let totalLuma = 0;
  let leftLuma = 0, leftCount = 0;
  let rightLuma = 0, rightCount = 0;
  let edgeLumaSum = 0, edgeCount = 0;
  let centerLumaSum = 0, centerCount = 0;

  const cx = sampleW / 2;
  const cy = sampleH / 2;
  const centerRadiusSq = (sampleW * 0.3) * (sampleW * 0.3);

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const i = (y * sampleW + x) * 4;
      const L = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      totalLuma += L;

      if (x < sampleW * 0.45) {
        leftLuma += L; leftCount++;
      } else if (x > sampleW * 0.55) {
        rightLuma += L; rightCount++;
      }

      const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (distSq < centerRadiusSq) {
        centerLumaSum += L; centerCount++;
      }
      if (x < sampleW * 0.15 || x > sampleW * 0.85 || y < sampleH * 0.15 || y > sampleH * 0.85) {
        edgeLumaSum += L; edgeCount++;
      }
    }
  }

  const avgLuma = totalLuma / (sampleW * sampleH);
  const avgLeft = leftCount > 0 ? leftLuma / leftCount : 0.5;
  const avgRight = rightCount > 0 ? rightLuma / rightCount : 0.5;
  const lightAsymmetry = Math.abs(avgLeft - avgRight);
  const avgEdge = edgeCount > 0 ? edgeLumaSum / edgeCount : 0.2;
  const avgCenter = centerCount > 0 ? centerLumaSum / centerCount : 0.5;

  // 3. Calibração inteligente dos parâmetros
  const bestLightBalance = Math.min(85, Math.max(40, Math.round(45 + lightAsymmetry * 140)));
  const bestDetail = Math.min(90, Math.max(70, Math.round(78 + (0.5 - avgLuma) * 15)));
  const bestVolume = Math.min(1.4, Math.max(1.0, Math.round((1.1 + (avgCenter - avgLuma) * 0.3) * 10) / 10));

  let bestBgCut = 20;
  if (avgEdge < avgCenter * 0.7) {
    bestBgCut = 25;
  } else if (avgEdge > avgCenter * 0.85) {
    bestBgCut = 30;
  }

  const bestDepth = 2.5;

  // 4. Atualizar os cursores
  if (sliderReliefDetail) {
    sliderReliefDetail.value = bestDetail;
    if (lblReliefDetail) lblReliefDetail.innerText = bestDetail;
  }
  if (sliderReliefLightBalance) {
    sliderReliefLightBalance.value = bestLightBalance;
    if (lblReliefLightBalance) lblReliefLightBalance.innerText = bestLightBalance;
  }
  if (sliderReliefContrast) {
    sliderReliefContrast.value = bestVolume;
    if (lblReliefContrast) lblReliefContrast.innerText = bestVolume;
  }
  if (sliderReliefBgCut) {
    sliderReliefBgCut.value = bestBgCut;
    if (lblReliefBgCut) lblReliefBgCut.innerText = bestBgCut;
  }
  if (sliderReliefDepth) {
    sliderReliefDepth.value = bestDepth;
    if (lblReliefDepth) lblReliefDepth.innerText = bestDepth;
  }

  // 5. Atualizar preview
  scheduleReliefPreviewUpdate();

  if (showNotification && reliefAiStatusText) {
    const prevText = reliefAiStatusText.innerText;
    reliefAiStatusText.innerText = `✨ Auto-calibração aplicada: Detalhe ${bestDetail}%, Luz ${bestLightBalance}%, Corte Fundo ${bestBgCut}%`;
    setTimeout(() => {
      if (reliefAiStatusText) reliefAiStatusText.innerText = prevText;
    }, 4000);
  }
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

    // Pré-calcular percentis uma única vez (elimina lag de ordenação em tempo real)
    const sampleSize = Math.min(depthMap.length, 3000);
    const sample = new Float32Array(sampleSize);
    const step = Math.floor(depthMap.length / sampleSize);
    for (let i = 0; i < sampleSize; i++) {
      sample[i] = depthMap[i * step];
    }
    sample.sort();
    const pLow = sample[Math.floor(sampleSize * 0.05)] || 0;
    const pHigh = sample[Math.floor(sampleSize * 0.95)] || 1;
    const range = Math.max(0.05, pHigh - pLow);

    // Pré-calcular mapa de detalhes anatómicos e traços faciais uma única vez
    const facialFeatureMap = extractFacialFeatureMap(img, width, height, 50);

    cachedAIDepthResult = {
      rawDepthMap: depthMap,
      width,
      height,
      pLow,
      pHigh,
      range,
      facialFeatureMap,
      lastLightBalance: 50
    };

    updateAIProgress(100, '✨ Deep Map 3D por IA gerado com sucesso!');

    isProcessingAI = false;
    if (btnGenerateRelief) btnGenerateRelief.disabled = false;

    // Aplicar calibração inteligente das melhores definições para a fotografia
    autoTuneReliefSettings(img, false);
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
 * Filtro Bilateral: Suaviza ruído e textura de casca de laranja da pele
 * mantendo as arestas dos olhos, nariz e lábios perfeitamente nítidas
 */
function applyBilateralFilter(src, width, height, radius = 3, sigmaSpace = 2.5, sigmaColor = 0.08) {
  const dst = new Float32Array(width * height);
  const twoSpaceSq = 2 * sigmaSpace * sigmaSpace;
  const twoColorSq = 2 * sigmaColor * sigmaColor;

  for (let y = 0; y < height; y++) {
    const yMin = Math.max(0, y - radius);
    const yMax = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const xMin = Math.max(0, x - radius);
      const xMax = Math.min(width - 1, x + radius);
      const centerVal = src[y * width + x];

      let sum = 0, wSum = 0;
      for (let cy = yMin; cy <= yMax; cy++) {
        for (let cx = xMin; cx <= xMax; cx++) {
          const val = src[cy * width + cx];
          const distSq = (cx - x) * (cx - x) + (cy - y) * (cy - y);
          const colorDiffSq = (val - centerVal) * (val - centerVal);
          const weight = Math.exp(-distSq / twoSpaceSq - colorDiffSq / twoColorSq);
          sum += val * weight;
          wSum += weight;
        }
      }
      dst[y * width + x] = wSum > 0 ? sum / wSum : centerVal;
    }
  }
  return dst;
}

/**
 * Extrai mapa multi-banda de traços e feições faciais reconhecíveis (olhos, pálpebras, nariz, lábios, expressão)
 * com normalização adaptativa de iluminação e filtro bilateral anti-ruído
 */
function extractFacialFeatureMap(img, targetW, targetH, lightBalancePct) {
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = targetW;
  tmpCanvas.height = targetH;
  const ctx = tmpCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const px = imgData.data;

  // 1. Converter para luminância perceptual [0..1]
  const luma = new Float32Array(targetW * targetH);
  const greyArr = new Uint8ClampedArray(targetW * targetH * 4);
  for (let i = 0; i < targetW * targetH; i++) {
    const val = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    luma[i] = val;
    const g = Math.round(val * 255);
    greyArr[i * 4] = greyArr[i * 4 + 1] = greyArr[i * 4 + 2] = g;
    greyArr[i * 4 + 3] = 255;
  }

  // 2. Normalização de Iluminação Ambiente (Remove sombras duras de um lado do rosto)
  const balance = (lightBalancePct !== undefined ? lightBalancePct : 50) / 100;
  const normLuma = new Float32Array(targetW * targetH);
  if (balance > 0) {
    const blurAmbient = applyBoxBlur(greyArr, targetW, targetH, 16);
    for (let i = 0; i < targetW * targetH; i++) {
      const amb = blurAmbient[i * 4] / 255;
      const ratio = (luma[i] + 0.05) / (amb + 0.15);
      const balanced = luma[i] * (1 - balance) + ratio * balance * 0.6;
      normLuma[i] = Math.min(1, Math.max(0, balanced));
    }
  } else {
    for (let i = 0; i < targetW * targetH; i++) normLuma[i] = luma[i];
  }

  // 3. Suavização Bilateral da Pele: Elimina ruído granulado mantendo traços nítidos
  const cleanLuma = applyBilateralFilter(normLuma, targetW, targetH, 3, 2.0, 0.06);

  for (let i = 0; i < targetW * targetH; i++) {
    const g = Math.round(cleanLuma[i] * 255);
    greyArr[i * 4] = greyArr[i * 4 + 1] = greyArr[i * 4 + 2] = g;
  }

  // 4. Multi-Scale Laplacian Filtering (Escalas de 2px e 6px)
  const blurFine = applyBoxBlur(greyArr, targetW, targetH, 2);
  const blurMedium = applyBoxBlur(greyArr, targetW, targetH, 6);

  // 5. Gravação de Relevo Anatómico sem ruído
  const featureMap = new Float32Array(targetW * targetH);
  for (let y = 0; y < targetH; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(targetH - 1, y + 1);
    for (let x = 0; x < targetW; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(targetW - 1, x + 1);
      const idx = y * targetW + x;

      const fine = cleanLuma[idx] - (blurFine[idx * 4] / 255);
      const medium = cleanLuma[idx] - (blurMedium[idx * 4] / 255);

      const gx = cleanLuma[y * targetW + xp] - cleanLuma[y * targetW + xm];
      const gy = cleanLuma[yp * targetW + x] - cleanLuma[ym * targetW + x];
      const edge = Math.hypot(gx, gy);

      // Síntese limpa e fluida (estilo ArtCAM)
      let feat = cleanLuma[idx] + (fine * 2.2) + (medium * 1.3) - (edge * 0.40);
      feat = Math.min(1, Math.max(0, feat));
      featureMap[idx] = feat;
    }
  }
  return featureMap;
}

let reliefRafTimer = null;
let offscreenPreviewCanvas = null;

/**
 * Agenda a actualização visual do preview de forma não bloqueante a 60 FPS
 */
function scheduleReliefPreviewUpdate() {
  if (reliefRafTimer) cancelAnimationFrame(reliefRafTimer);
  reliefRafTimer = requestAnimationFrame(() => {
    updateReliefPreviewAndStats();
  });
}

/**
 * Renderiza o relevo 3D sombreado com luz direcional Phong e Oclusão de Cavidades (Estilo ArtCAM / Vectric)
 */
function renderArtCAMShading(depthMap, width, height, lightAngleDeg, materialTheme, outputPixels) {
  const rad = ((lightAngleDeg !== undefined ? lightAngleDeg : 315) * Math.PI) / 180;
  // Direção da luz no espaço 3D (com inclinação de 45°)
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);
  const lz = 0.85;
  const lLen = Math.hypot(lx, ly, lz);
  const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

  // Paleta de materiais rica e polida
  let baseR = 230, baseG = 175, baseB = 35; // Ouro ArtCAM (#e6af23)
  let ambientR = 50, ambientG = 35, ambientB = 12;
  let specPower = 18;
  let specIntensity = 0.65;

  if (materialTheme === 'carved-wood') {
    baseR = 185; baseG = 110; baseB = 45; // Madeira Nogueira
    ambientR = 38; ambientG = 22; ambientB = 10;
    specPower = 10;
    specIntensity = 0.30;
  } else if (materialTheme === 'sculptor-clay') {
    baseR = 220; baseG = 215; baseB = 205; // Argila / Gesso
    ambientR = 48; ambientG = 48; ambientB = 48;
    specPower = 8;
    specIntensity = 0.22;
  }

  const scaleZ = 28.0; // Gradiente calibrado para relevo suave e contornos limpos

  // Pré-suavização leve para garantir brilho especular polido e sem ruído
  const smoothZ = applyBilateralFilter(depthMap, width, height, 2, 1.5, 0.05);

  for (let y = 0; y < height; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(width - 1, x + 1);

      const idx = y * width + x;
      const z = smoothZ[idx]; // 0 = superfície / alto, 1 = fundo / profundo
      const outIdx = idx * 4;

      // Fundo plano cortado
      if (z >= 0.999) {
        outputPixels[outIdx] = 12;
        outputPixels[outIdx + 1] = 16;
        outputPixels[outIdx + 2] = 22;
        outputPixels[outIdx + 3] = 255;
        continue;
      }

      // Gradientes centrais para cálculo das normais de superfície
      const zL = smoothZ[y * width + xm];
      const zR = smoothZ[y * width + xp];
      const zU = smoothZ[ym * width + x];
      const zD = smoothZ[yp * width + x];

      const dzdx = (zL - zR) * scaleZ;
      const dzdy = (zU - zD) * scaleZ;
      const normLen = Math.hypot(dzdx, dzdy, 1.0);
      const nx = dzdx / normLen;
      const ny = dzdy / normLen;
      const nz = 1.0 / normLen;

      // Iluminação Difusa (Lambert)
      const dot = Math.max(0, nx * nlx + ny * nly + nz * nlz);

      // Reflexo Especular (Blinn-Phong)
      const hx = nlx, hy = nly, hz = nlz + 1.0;
      const hLen = Math.hypot(hx, hy, hz);
      const specDot = Math.max(0, nx * (hx / hLen) + ny * (hy / hLen) + nz * (hz / hLen));
      const spec = Math.pow(specDot, specPower) * specIntensity;

      // Oclusão de Cavidades / Sulcos (Delineia pálpebras, pestanas, fendas dos lábios e narinas)
      const laplacian = (zL + zR + zU + zD) - (4.0 * z);
      const cavityOcclusion = Math.max(0.25, Math.min(1.0, 1.0 - laplacian * 10.0));

      // Elevação modula brilho global
      const heightGain = 0.78 + (1 - z) * 0.35;

      const r = Math.min(255, Math.round((ambientR + baseR * dot * heightGain + spec * 255) * cavityOcclusion));
      const g = Math.min(255, Math.round((ambientG + baseG * dot * heightGain + spec * 235) * cavityOcclusion));
      const b = Math.min(255, Math.round((ambientB + baseB * dot * heightGain + spec * 170) * cavityOcclusion));

      outputPixels[outIdx] = r;
      outputPixels[outIdx + 1] = g;
      outputPixels[outIdx + 2] = b;
      outputPixels[outIdx + 3] = 255;
    }
  }
}

/**
 * Processa a imagem para gerar um mapa de profundidade Float32Array [0..1]
 * 0 = superfície (Z=0), 1 = corte mais fundo (Z=-maxDepth)
 */
function processImageToDepthMap(img, options) {
  const { blur, gamma, invert, scaleFactor, mode, detail, bgCut, lightBalance } = options;

  let depthMap = null;
  let finalW = 0, finalH = 0;

  // CASO 1: MODO IA DEEP MAP COM FUSÃO ANATÓMICA MULTI-ESCALA
  if (mode === 'ai-depth' && cachedAIDepthResult) {
    const { rawDepthMap, width, height, pLow, pHigh, range } = cachedAIDepthResult;
    finalW = width;
    finalH = height;

    // 1. Criar base volumétrica 3D (o blur só afeta a base, nunca os olhos/boca)
    const baseArr = new Uint8ClampedArray(width * height * 4);
    const usePLow = pLow !== undefined ? pLow : 0;
    const useRange = range !== undefined ? range : 1;

    for (let i = 0; i < width * height; i++) {
      let norm = (rawDepthMap[i] - usePLow) / useRange;
      norm = Math.min(1, Math.max(0, norm));
      norm = Math.pow(norm, gamma);
      const v = Math.round(norm * 255);
      baseArr[i * 4] = baseArr[i * 4 + 1] = baseArr[i * 4 + 2] = v;
      baseArr[i * 4 + 3] = 255;
    }
    const smoothedBase = blur > 0 ? applyBoxBlur(baseArr, width, height, blur) : baseArr;

    // 2. Extrair mapa de traços faciais (com balanceamento de iluminação)
    const curLB = lightBalance !== undefined ? lightBalance : 50;
    if (!cachedAIDepthResult.facialFeatureMap || cachedAIDepthResult.lastLightBalance !== curLB) {
      cachedAIDepthResult.facialFeatureMap = extractFacialFeatureMap(img, width, height, curLB);
      cachedAIDepthResult.lastLightBalance = curLB;
    }
    const fMap = cachedAIDepthResult.facialFeatureMap;
    const detailWeight = ((detail !== undefined ? detail : 75) / 100);

    // 3. Fusão Proporcional ArtCAM: Curvatura 3D + Escultura dos Traços
    depthMap = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const base3D = smoothedBase[i * 4] / 255;
      const feat = fMap[i];

      // Fusão expressiva: preserva a forma 3D convexa e grava os traços nítidos
      let finalVal = base3D * (1.0 - detailWeight * 0.70) + feat * (detailWeight * 0.70);
      finalVal = Math.min(1, Math.max(0, finalVal));

      // Para o CNC: 0 = superfície (Z=0), 1 = profundidade máxima (-maxDepth)
      const d = invert ? finalVal : (1 - finalVal);
      depthMap[i] = Math.min(1, Math.max(0, d));
    }
  } else {
    // CASO 2: MODO LUMINÂNCIA CLÁSSICA (2D)
    const tmpCanvas = document.createElement('canvas');
    finalW = Math.max(1, Math.round(img.width * scaleFactor));
    finalH = Math.max(1, Math.round(img.height * scaleFactor));
    tmpCanvas.width = finalW;
    tmpCanvas.height = finalH;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(img, 0, 0, finalW, finalH);

    const imageData = tmpCtx.getImageData(0, 0, finalW, finalH);
    let pixels = imageData.data;

    // Converter para escala de cinzentos (luminância perceptual ITU-R BT.601)
    const grey = new Uint8ClampedArray(finalW * finalH * 4);
    for (let i = 0; i < finalW * finalH; i++) {
      const R = pixels[i * 4];
      const G = pixels[i * 4 + 1];
      const B = pixels[i * 4 + 2];
      const L = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
      grey[i * 4] = grey[i * 4 + 1] = grey[i * 4 + 2] = L;
      grey[i * 4 + 3] = 255;
    }

    const blurred = blur > 0 ? applyBoxBlur(grey, finalW, finalH, blur) : grey;

    depthMap = new Float32Array(finalW * finalH);
    for (let i = 0; i < finalW * finalH; i++) {
      let normalised = blurred[i * 4] / 255;
      normalised = Math.pow(normalised, gamma);
      const d = invert ? normalised : (1 - normalised);
      depthMap[i] = Math.min(1, Math.max(0, d));
    }
  }

  // 4. Corte do Plano de Fundo & Isolamento de Retrato (Estilo Medalhão ArtCAM)
  const cutPct = (bgCut !== undefined ? bgCut : 15) / 100;
  if (depthMap) {
    const threshold = Math.max(0.05, 1.0 - cutPct);
    const cx = finalW / 2;
    const cy = finalH / 2;

    for (let y = 0; y < finalH; y++) {
      for (let x = 0; x < finalW; x++) {
        const i = y * finalW + x;
        const dx = (x - cx) / (finalW * 0.46);
        const dy = (y - cy) / (finalH * 0.52);
        const distSq = dx * dx + dy * dy;
        const vignette = Math.max(0, Math.min(1, 1.25 - distSq * 0.45));

        let v = depthMap[i];
        if (cutPct > 0) {
          if (distSq > 0.75) {
            v = v * vignette;
          }
        }
        depthMap[i] = Math.min(1, Math.max(0, v));
      }
    }
  }

  return { depthMap, width: finalW, height: finalH };
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
  const detail = sliderReliefDetail ? parseFloat(sliderReliefDetail.value) : 75;
  const lightBalance = sliderReliefLightBalance ? parseFloat(sliderReliefLightBalance.value) : 50;
  const bgCut = sliderReliefBgCut ? parseFloat(sliderReliefBgCut.value) : 15;
  const lightAngle = sliderReliefLightAngle ? parseFloat(sliderReliefLightAngle.value) : 315;
  const materialTheme = selectReliefMaterialTheme ? selectReliefMaterialTheme.value : 'artcam-gold';

  const { depthMap, width, height } = processImageToDepthMap(reliefImageEl, {
    blur, gamma, invert, scaleFactor, mode: currentReliefMode, detail, bgCut, lightBalance
  });

  // Renderizar preview no canvas
  const maxW = previewDepthmap.parentElement.clientWidth || 300;
  const ratio = height / width;
  previewDepthmap.width = maxW;
  previewDepthmap.height = Math.round(maxW * ratio);

  const dCtx = previewDepthmap.getContext('2d');
  
  if (!offscreenPreviewCanvas) {
    offscreenPreviewCanvas = document.createElement('canvas');
  }
  offscreenPreviewCanvas.width = width;
  offscreenPreviewCanvas.height = height;
  const offCtx = offscreenPreviewCanvas.getContext('2d');
  
  const previewData = offCtx.createImageData(width, height);
  const pData = previewData.data;

  if (currentReliefViewMode === 'artcam') {
    // Renderização com iluminação e relevo 3D estilo ArtCAM
    renderArtCAMShading(depthMap, width, height, lightAngle, materialTheme, pData);
  } else {
    // Renderização em escala de cinzentos (Mapa Z técnico)
    for (let i = 0; i < depthMap.length; i++) {
      const v = Math.round((1 - depthMap[i]) * 255);
      const idx = i * 4;
      pData[idx] = pData[idx + 1] = pData[idx + 2] = v;
      pData[idx + 3] = 255;
    }
  }

  offCtx.putImageData(previewData, 0, 0);
  dCtx.clearRect(0, 0, previewDepthmap.width, previewDepthmap.height);
  dCtx.drawImage(offscreenPreviewCanvas, 0, 0, previewDepthmap.width, previewDepthmap.height);

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
  const detail = sliderReliefDetail ? parseFloat(sliderReliefDetail.value) : 75;
  const lightBalance = sliderReliefLightBalance ? parseFloat(sliderReliefLightBalance.value) : 50;
  const bgCut = sliderReliefBgCut ? parseFloat(sliderReliefBgCut.value) : 15;

  // Extrair o Float32Array final do mapa de profundidade
  const { depthMap, width: dmW, height: dmH } = processImageToDepthMap(reliefImageEl, {
    blur, gamma, invert, scaleFactor, mode: currentReliefMode, detail, bgCut, lightBalance
  });

  const reliefSettings = {
    blur,
    gamma,
    invert,
    resolutionPct,
    maxDepth,
    doublePass,
    detail,
    lightBalance,
    bgCut,
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

  fabric.Image.fromURL(reliefImageEl.src, async (fabricImg) => {
    const startLeft = 20;
    const startTop = Math.max(20, canvas.height - pxH - 20);
    fabricImg.set({
      left: startLeft,
      top: startTop,
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
    await saveAppState();
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

  // Importação (DXF, SVG, PNG, JPG) e Caixa de Importação / Drop
  if (btnImportTrigger && importModal) {
    btnImportTrigger.addEventListener('click', () => {
      importModal.style.display = 'flex';
    });
  } else if (btnImportTrigger) {
    btnImportTrigger.addEventListener('click', () => fileImport.click());
  }

  const closeImportModal = () => {
    if (importModal) importModal.style.display = 'none';
  };

  if (btnCloseImport) btnCloseImport.addEventListener('click', closeImportModal);
  if (btnCloseImportFooter) btnCloseImportFooter.addEventListener('click', closeImportModal);

  if (importModal) {
    importModal.addEventListener('click', (e) => {
      if (e.target === importModal) closeImportModal();
    });
  }

  if (btnBrowseFile) {
    btnBrowseFile.addEventListener('click', () => fileImport.click());
  }

  if (importDropzone) {
    importDropzone.addEventListener('click', () => fileImport.click());

    importDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      importDropzone.classList.add('dragover');
    });

    importDropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      importDropzone.classList.remove('dragover');
    });

    importDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      importDropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        closeImportModal();
        processImportedFile(e.dataTransfer.files[0]);
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && importModal && importModal.style.display === 'flex') {
      closeImportModal();
    }
  });

  fileImport.addEventListener('change', handleFileImport);
  btnVectorize.addEventListener('click', vectorizeSelectedImage);

  // Drag & Drop direto sobre a Mesa de Corte
  const canvasArea = document.getElementById('canvas-area');
  if (canvasArea) {
    canvasArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      canvasArea.classList.add('drop-active');
    });
    canvasArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      canvasArea.classList.remove('drop-active');
    });
    canvasArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      canvasArea.classList.remove('drop-active');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        processImportedFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Corte 3D por Imagem — abrir modal ao clicar no botão
  btnImport3D.addEventListener('click', () => fileImport3D.click());
  fileImport3D.addEventListener('change', handleFileImport3D);
  btnCloseRelief.addEventListener('click', hideReliefModal);
  btnCloseReliefFooter.addEventListener('click', hideReliefModal);
  btnGenerateRelief.addEventListener('click', placeReliefImageOnCanvas);
  
  if (btnModeAiDepth) btnModeAiDepth.addEventListener('click', () => setReliefMode('ai-depth'));
  if (btnModeLuminance) btnModeLuminance.addEventListener('click', () => setReliefMode('luminance'));
  if (btnReliefAutoTune) btnReliefAutoTune.addEventListener('click', () => {
    if (reliefImageEl) autoTuneReliefSettings(reliefImageEl, true);
  });

  // Sliders do modal de corte 3D — actualizar labels e preview em tempo real a 60 FPS
  const reliefSliders = [
    { el: sliderReliefDepth, lbl: lblReliefDepth },
    { el: sliderReliefDetail, lbl: lblReliefDetail },
    { el: sliderReliefLightBalance, lbl: lblReliefLightBalance },
    { el: sliderReliefContrast, lbl: lblReliefContrast },
    { el: sliderReliefBgCut, lbl: lblReliefBgCut },
    { el: sliderReliefLightAngle, lbl: lblReliefLightAngle },
    { el: sliderReliefBlur, lbl: lblReliefBlur },
    { el: sliderReliefResolution, lbl: lblReliefResolution }
  ];
  reliefSliders.forEach(({ el, lbl }) => {
    if (el && lbl) {
      el.addEventListener('input', () => {
        lbl.innerText = el.value;
        if (reliefImageEl) scheduleReliefPreviewUpdate();
      });
    }
  });

  if (selectReliefMaterialTheme) {
    selectReliefMaterialTheme.addEventListener('change', () => {
      if (reliefImageEl) scheduleReliefPreviewUpdate();
    });
  }

  // Alternador de Visualização ArtCAM vs Mapa Z
  if (btnViewArtcam && btnViewGrayscale) {
    btnViewArtcam.addEventListener('click', () => {
      currentReliefViewMode = 'artcam';
      btnViewArtcam.classList.add('active');
      btnViewGrayscale.classList.remove('active');
      if (lblDepthPreviewTitle) lblDepthPreviewTitle.innerText = 'Relevo 3D Esculpido (ArtCAM)';
      if (reliefImageEl) scheduleReliefPreviewUpdate();
    });
    btnViewGrayscale.addEventListener('click', () => {
      currentReliefViewMode = 'grayscale';
      btnViewGrayscale.classList.add('active');
      btnViewArtcam.classList.remove('active');
      if (lblDepthPreviewTitle) lblDepthPreviewTitle.innerText = 'Mapa Z (Escala de Cinzentos)';
      if (reliefImageEl) scheduleReliefPreviewUpdate();
    });
  }

  chkReliefInvert.addEventListener('change', () => {
    if (reliefImageEl) scheduleReliefPreviewUpdate();
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
    scheduleReliefPreviewUpdate();
  });
  inputReliefH.addEventListener('input', () => {
    if (reliefAspectLocked && reliefImageEl) {
      const aspect = reliefImageEl.width / reliefImageEl.height;
      const h = parseFloat(inputReliefH.value);
      if (!isNaN(h) && h > 0) {
        inputReliefW.value = Math.round((h * aspect) * 2) / 2;
      }
    }
    scheduleReliefPreviewUpdate();
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
  
  // Guardar estado quando os parâmetros de corte mudam
  const params = [inputToolDia, inputSafeZ, inputFeedXY, inputFeedZ, inputDepthTotal, inputDepthPass, selectStrategy, inputMaterialZ, paramToolType, inputStepover, paramUseArcs, inputSpindleSpeed];
  params.forEach(input => {
    if (input) {
      input.addEventListener('change', () => {
        clearVisualToolpaths();
        saveAppState();
      });
    }
  });

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
      if (paramToolType) paramToolType.value = tool.toolType || 'flat';
      if (inputStepover) inputStepover.value = tool.stepover || 40;
      if (inputSpindleSpeed) inputSpindleSpeed.value = tool.spindleSpeed || 18000;
      
      clearVisualToolpaths();
      saveAppState();
    }
  });

  // Alternância de Vistas: 2D vs 3D
  if (tabView2d && tabView3d) {
    tabView2d.addEventListener('click', () => switchViewMode('2d'));
    tabView3d.addEventListener('click', () => switchViewMode('3d'));
  }
  if (btnOpenSim3d) {
    btnOpenSim3d.addEventListener('click', () => {
      switchViewMode('3d');
      if (simParsedData && simParsedData.segments.length > 0) {
        startSimulationPlayback();
      }
    });
  }

  // Controlos do Simulador 3D
  if (btnSimPlay) btnSimPlay.addEventListener('click', toggleSimulationPlay);
  if (btnSimReset) btnSimReset.addEventListener('click', resetSimulation);
  if (simSpeedSelect) {
    simSpeedSelect.addEventListener('change', () => {
      simSpeedMultiplier = parseFloat(simSpeedSelect.value) || 5;
    });
  }
  if (simTimeline) {
    simTimeline.addEventListener('input', () => {
      seekSimulation(parseFloat(simTimeline.value));
    });
  }

  // Atalhos de Câmara 3D
  if (btnCamIso) btnCamIso.addEventListener('click', () => setThreeCameraPreset('iso'));
  if (btnCamTop) btnCamTop.addEventListener('click', () => setThreeCameraPreset('top'));
  if (btnCamFront) btnCamFront.addEventListener('click', () => setThreeCameraPreset('front'));

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
 * Motor de Leitura e Descodificação DXF Nativo (Offline-First)
 * Inspirado e adaptado da engenharia de dxfImport.ts do Layerling
 */
class DxfReader {
  static parseToSvgPaths(dxfText, options = {}) {
    const scaleMmPx = options.scaleMmPx ?? ESCALA_MM_PX;
    const tolerance = options.tolerance ?? 0.05;

    const lines = dxfText.split(/\r?\n/);
    let inHeader = false;
    let inEntities = false;
    let unitScale = 1.0; // Padrão 1:1 mm

    const rawEntities = [];
    let currentEntity = null;

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = parseInt(lines[i].trim(), 10);
      const val = lines[i + 1].trim();

      if (code === 0 && val === "SECTION") {
        const nextVal = lines[i + 3]?.trim();
        inHeader = (nextVal === "HEADER");
        inEntities = (nextVal === "ENTITIES");
      }
      if (code === 0 && val === "ENDSEC") {
        inHeader = false;
        inEntities = false;
      }

      // Leitura de unidades no cabeçalho ($INSUNITS)
      if (inHeader && code === 9 && val === "$INSUNITS") {
        const uVal = parseInt(lines[i + 3]?.trim(), 10);
        if (uVal === 1) unitScale = 25.4; // Polegadas para mm
        else if (uVal === 2) unitScale = 304.8; // Pés para mm
        else if (uVal === 4) unitScale = 1.0; // Milímetros
        else if (uVal === 5) unitScale = 10.0; // Centímetros para mm
        else if (uVal === 6) unitScale = 1000.0; // Metros para mm
      }

      if (inEntities) {
        if (code === 0) {
          if (currentEntity) rawEntities.push(currentEntity);
          currentEntity = { type: val, codes: {} };
        } else if (currentEntity) {
          if (!currentEntity.codes[code]) currentEntity.codes[code] = [];
          currentEntity.codes[code].push(val);
        }
      }
    }
    if (currentEntity) rawEntities.push(currentEntity);

    const pieces = [];
    const closedLoops = [];

    const getNum = (ent, c, def = 0) => parseFloat(ent.codes[c]?.[0] || def);
    const getAll = (ent, c) => (ent.codes[c] || []).map(v => parseFloat(v));

    for (const ent of rawEntities) {
      switch (ent.type) {
        case "LINE": {
          const x1 = getNum(ent, 10);
          const y1 = getNum(ent, 20);
          const x2 = getNum(ent, 11);
          const y2 = getNum(ent, 21);
          pieces.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
          break;
        }

        case "CIRCLE": {
          const cx = getNum(ent, 10);
          const cy = getNum(ent, 20);
          const r = getNum(ent, 40);
          if (r > 0) {
            // Círculo fechado aproximado em 4 quadrantes cúbicos de Bézier (k = r * 0.5522847498)
            const k = r * 0.5522847498;
            closedLoops.push([
              { start: { x: cx + r, y: cy }, c1: { x: cx + r, y: cy + k }, c2: { x: cx + k, y: cy + r }, end: { x: cx, y: cy + r } },
              { start: { x: cx, y: cy + r }, c1: { x: cx - k, y: cy + r }, c2: { x: cx - r, y: cy + k }, end: { x: cx - r, y: cy } },
              { start: { x: cx - r, y: cy }, c1: { x: cx - r, y: cy - k }, c2: { x: cx - k, y: cy - r }, end: { x: cx, y: cy - r } },
              { start: { x: cx, y: cy - r }, c1: { x: cx + k, y: cy - r }, c2: { x: cx + r, y: cy - k }, end: { x: cx + r, y: cy } },
            ]);
          }
          break;
        }

        case "ARC": {
          const cx = getNum(ent, 10);
          const cy = getNum(ent, 20);
          const r = getNum(ent, 40);
          const startDeg = getNum(ent, 50);
          const endDeg = getNum(ent, 51);

          let startRad = (startDeg * Math.PI) / 180;
          let endRad = (endDeg * Math.PI) / 180;
          while (endRad <= startRad) endRad += 2 * Math.PI;

          const totalSweep = endRad - startRad;
          const steps = Math.max(1, Math.ceil(totalSweep / (Math.PI / 2)));
          const stepAngle = totalSweep / steps;

          for (let s = 0; s < steps; s++) {
            const a1 = startRad + s * stepAngle;
            const a2 = a1 + stepAngle;
            const halfDiff = (a2 - a1) / 2;
            const k = (4 / 3) * Math.tan(halfDiff / 2) * r;

            const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
            const p2 = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };

            const t1 = { x: -Math.sin(a1), y: Math.cos(a1) };
            const t2 = { x: -Math.sin(a2), y: Math.cos(a2) };

            pieces.push({
              start: p1,
              c1: { x: p1.x + t1.x * k, y: p1.y + t1.y * k },
              c2: { x: p2.x - t2.x * k, y: p2.y - t2.y * k },
              end: p2
            });
          }
          break;
        }

        case "LWPOLYLINE": {
          const xs = getAll(ent, 10);
          const ys = getAll(ent, 20);
          const bulges = getAll(ent, 42);
          const flags = parseInt(ent.codes[70]?.[0] || 0, 10);
          const closed = (flags & 1) === 1;

          if (xs.length > 0) {
            const count = closed ? xs.length : xs.length - 1;
            const polyPieces = [];
            for (let i = 0; i < count; i++) {
              const next = (i + 1) % xs.length;
              const p1 = { x: xs[i], y: ys[i] };
              const p2 = { x: xs[next], y: ys[next] };
              const b = bulges[i] || 0;

              if (Math.abs(b) < 1e-6) {
                polyPieces.push({ start: p1, end: p2 });
              } else {
                const theta = 4 * Math.atan(b);
                const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const r = Math.abs(chord / (2 * Math.sin(theta / 2)));
                const halfTheta = theta / 2;
                const k = (4 / 3) * Math.tan(halfTheta / 2) * r;
                const chordAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const alpha = (Math.PI - Math.abs(theta)) / 2;
                const sign = b > 0 ? 1 : -1;
                const t1Angle = chordAngle + sign * alpha;
                const t2Angle = chordAngle + Math.PI - sign * alpha;

                polyPieces.push({
                  start: p1,
                  c1: { x: p1.x + Math.cos(t1Angle) * k, y: p1.y + Math.sin(t1Angle) * k },
                  c2: { x: p2.x + Math.cos(t2Angle) * k, y: p2.y + Math.sin(t2Angle) * k },
                  end: p2
                });
              }
            }
            if (closed) {
              closedLoops.push(polyPieces);
            } else {
              pieces.push(...polyPieces);
            }
          }
          break;
        }
      }
    }

    const joined = this.stitchPieces(pieces, tolerance);
    const allLoops = [...closedLoops, ...joined.loops];
    const openRuns = joined.open;

    const svgPathStrings = [];
    const totalScale = unitScale * scaleMmPx;

    const toSvg = (p) => ({
      x: p.x * totalScale,
      y: -p.y * totalScale // Inversão vertical para manter orientação no canvas
    });

    for (const loop of allLoops) {
      if (loop.length === 0) continue;
      const s0 = toSvg(loop[0].start);
      let d = `M ${s0.x.toFixed(3)} ${s0.y.toFixed(3)}`;
      for (const piece of loop) {
        const e = toSvg(piece.end);
        if (piece.c1 && piece.c2) {
          const c1 = toSvg(piece.c1);
          const c2 = toSvg(piece.c2);
          d += ` C ${c1.x.toFixed(3)} ${c1.y.toFixed(3)}, ${c2.x.toFixed(3)} ${c2.y.toFixed(3)}, ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
        } else {
          d += ` L ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
        }
      }
      d += ` Z`;
      svgPathStrings.push(d);
    }

    for (const run of openRuns) {
      if (run.length === 0) continue;
      const s0 = toSvg(run[0].start);
      let d = `M ${s0.x.toFixed(3)} ${s0.y.toFixed(3)}`;
      for (const piece of run) {
        const e = toSvg(piece.end);
        if (piece.c1 && piece.c2) {
          const c1 = toSvg(piece.c1);
          const c2 = toSvg(piece.c2);
          d += ` C ${c1.x.toFixed(3)} ${c1.y.toFixed(3)}, ${c2.x.toFixed(3)} ${c2.y.toFixed(3)}, ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
        } else {
          d += ` L ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
        }
      }
      svgPathStrings.push(d);
    }

    return {
      svgPaths: svgPathStrings,
      totalLoops: allLoops.length,
      totalOpen: openRuns.length,
      unitScale
    };
  }

  static stitchPieces(pieces, tolerance) {
    if (pieces.length === 0) return { loops: [], open: [] };

    const pool = pieces.map(p => ({ ...p }));
    const loops = [];
    const open = [];

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const reverse = (piece) => piece.c1 && piece.c2
      ? { start: piece.end, c1: piece.c2, c2: piece.c1, end: piece.start }
      : { start: piece.end, end: piece.start };

    const used = new Array(pool.length).fill(false);

    for (let i = 0; i < pool.length; i++) {
      if (used[i]) continue;
      used[i] = true;

      const currentRun = [pool[i]];
      let expanded = true;

      while (expanded) {
        expanded = false;
        const tail = currentRun[currentRun.length - 1].end;

        if (currentRun.length > 1 && dist(tail, currentRun[0].start) <= tolerance) {
          break;
        }

        let bestIdx = -1;
        let bestDist = tolerance;
        let mustReverse = false;

        for (let j = 0; j < pool.length; j++) {
          if (used[j]) continue;
          const dStart = dist(tail, pool[j].start);
          const dEnd = dist(tail, pool[j].end);

          if (dStart <= bestDist) {
            bestDist = dStart;
            bestIdx = j;
            mustReverse = false;
          } else if (dEnd <= bestDist) {
            bestDist = dEnd;
            bestIdx = j;
            mustReverse = true;
          }
        }

        if (bestIdx !== -1) {
          used[bestIdx] = true;
          const nextPiece = mustReverse ? reverse(pool[bestIdx]) : pool[bestIdx];
          currentRun.push(nextPiece);
          expanded = true;
        }
      }

      const tail = currentRun[currentRun.length - 1].end;
      if (currentRun.length > 1 && dist(tail, currentRun[0].start) <= tolerance) {
        loops.push(currentRun);
      } else {
        open.push(currentRun);
      }
    }

    return { loops, open };
  }
}

/**
 * Processa qualquer ficheiro suportado (.dxf, .svg, ou imagem raster)
 */
function processImportedFile(file) {
  if (!file) return;

  clearVisualToolpaths();
  const lowerName = file.name ? file.name.toLowerCase() : '';
  const reader = new FileReader();

  // 1. FICHEIRO DXF (AutoCAD / CAD mecânico)
  if (lowerName.endsWith('.dxf')) {
    reader.onload = function(evt) {
      try {
        const text = evt.target.result;
        const result = DxfReader.parseToSvgPaths(text, { scaleMmPx: ESCALA_MM_PX });

        if (!result.svgPaths || result.svgPaths.length === 0) {
          alert("Não foram encontrados contornos nem percursos vetoriais legíveis neste ficheiro DXF.");
          return;
        }

        // Unir todos os contornos num único Path com múltiplos subcaminhos
        const unifiedD = result.svgPaths.join(' ');
        const pathObj = new fabric.Path(unifiedD, {
          stroke: '#38bdf8',
          fill: '',
          strokeWidth: 1.5,
          strokeUniform: true
        });

        // Se exceder a mesa de corte, redimensionar proporcionalmente
        const maxAllowedW = canvas.width * 0.9;
        const maxAllowedH = canvas.height * 0.9;
        if (pathObj.width > maxAllowedW || pathObj.height > maxAllowedH) {
          pathObj.scaleToWidth(Math.min(maxAllowedW, maxAllowedH));
        }

        // Posicionar no centro da mesa
        pathObj.set({
          left: (canvas.width - pathObj.getScaledWidth()) / 2,
          top: (canvas.height - pathObj.getScaledHeight()) / 2
        });

        canvas.add(pathObj);
        canvas.setActiveObject(pathObj);
        canvas.requestRenderAll();
        saveAppState();

        showCamToast(`📐 DXF importado: ${result.totalLoops} contorno(s) fechado(s), ${result.totalOpen} aberto(s)!`);
      } catch (err) {
        console.error("Erro ao importar DXF:", err);
        alert(`Erro ao processar ficheiro DXF: ${err.message}`);
      }
    };
    reader.readAsText(file);
    return;
  }

  // 2. FICHEIRO SVG
  if (file.type === 'image/svg+xml' || lowerName.endsWith('.svg')) {
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
        showCamToast("📐 SVG importado para a mesa com sucesso!");
      });
    };
    reader.readAsText(file);
    return;
  }

  // 3. IMAGEM RASTER (PNG, JPG, WEBP)
  if (file.type.match('image.*') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
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
        showCamToast("🖼️ Imagem importada para a mesa!");
      });
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Importa ficheiros SVG, DXF ou imagens raster (PNG/JPG)
 */
function handleFileImport(e) {
  const file = e.target.files[0];
  if (importModal) importModal.style.display = 'none';
  if (file) processImportedFile(file);
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
 * Calcula a área com sinal de um polígono (Shoelace Formula)
 * Determina a orientação: > 0 é Anti-horário (CCW), < 0 é Horário (CW)
 */
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    a += (pts[i].x * pts[i + 1].y) - (pts[i + 1].x * pts[i].y);
  }
  return a / 2;
}

/**
 * Desfasamento Geométrico 2D com Bissectriz e Limite de Miter (Offset Poligonal)
 * delta > 0: Exterior (alarga) | delta < 0: Interior (encolhe)
 */
function offsetContour(points, delta) {
  if (!points || points.length < 3) return points;
  if (Math.abs(delta) < 1e-4) return points;

  const isClosed = Math.hypot(points[0].x - points[points.length - 1].x,
                              points[0].y - points[points.length - 1].y) < 1e-3;
  const loop = isClosed ? points.slice(0, -1) : points.slice();
  const n = loop.length;
  if (n < 3) return points;

  const area = signedArea(points);
  const dSign = area >= 0 ? delta : -delta;

  const normals = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dx = loop[next].x - loop[i].x;
    const dy = loop[next].y - loop[i].y;
    const len = Math.hypot(dx, dy) || 1;
    normals.push({ x: dy / len, y: -dx / len });
  }

  const offsetLoop = [];
  const miterLimit = 2.5;

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const n1 = normals[prev];
    const n2 = normals[i];

    const bx = n1.x + n2.x;
    const by = n1.y + n2.y;
    const blen = Math.hypot(bx, by);

    if (blen < 1e-6) {
      offsetLoop.push({
        x: loop[i].x + n2.x * dSign,
        y: loop[i].y + n2.y * dSign
      });
      continue;
    }

    const ubx = bx / blen;
    const uby = by / blen;

    const cosHalf = n1.x * ubx + n1.y * uby;
    if (Math.abs(cosHalf) < 1e-4) {
      offsetLoop.push({
        x: loop[i].x + n2.x * dSign,
        y: loop[i].y + n2.y * dSign
      });
      continue;
    }

    let miterDist = dSign / cosHalf;
    if (Math.abs(miterDist / dSign) > miterLimit) {
      miterDist = Math.sign(miterDist) * Math.abs(dSign) * miterLimit;
    }

    offsetLoop.push({
      x: loop[i].x + ubx * miterDist,
      y: loop[i].y + uby * miterDist
    });
  }

  if (isClosed) {
    offsetLoop.push({ ...offsetLoop[0] });
  }
  return offsetLoop;
}

/**
 * Gera percursos concêntricos de limpeza de caixa (Pocketing)
 */
function generatePocketToolpaths(points, toolDia, stepoverPercent = 40) {
  const toolRadius = toolDia / 2;
  const step = Math.max(0.1, toolDia * (stepoverPercent / 100));
  const toolpaths = [];

  let currentOffset = -toolRadius;
  let prevArea = Math.abs(signedArea(points));

  for (let pass = 0; pass < 100; pass++) {
    const loop = offsetContour(points, currentOffset);
    const newArea = Math.abs(signedArea(loop));

    if (newArea <= 0.5 || newArea >= prevArea) {
      break;
    }

    toolpaths.push(loop);
    prevArea = newArea;
    currentOffset -= step;
  }

  return toolpaths;
}

/**
 * REA FreeCAD DogboneII.py & Vectric VCarve:
 * Aplica alívios de cantos interiores (Dogbone / T-Bone) aos vértices côncavos de contornos fechados,
 * permitindo que peças retangulares (encaixes macho-fêmea e ensambladuras) entrem perfeitamente.
 */
function applyDogboneRelief(points, toolRadius, type = 'dogbone', strategy = 'inside') {
  if (!points || points.length < 3 || toolRadius <= 0.05) return points;

  const isClosed = Math.hypot(points[0].x - points[points.length - 1].x,
                              points[0].y - points[points.length - 1].y) < 0.1;
  if (!isClosed) return points;

  const loop = points.slice(0, -1);
  const n = loop.length;
  if (n < 3) return points;

  const area = signedArea(points);
  const isCCW = area > 0;

  const newPoints = [];

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const curr = i;
    const next = (i + 1) % n;

    const pPrev = loop[prev];
    const pCurr = loop[curr];
    const pNext = loop[next];

    newPoints.push({ x: pCurr.x, y: pCurr.y });

    // Vetores de entrada e saída
    const v1x = pCurr.x - pPrev.x;
    const v1y = pCurr.y - pPrev.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 1e-3 || len2 < 1e-3) continue;

    const u1x = v1x / len1;
    const u1y = v1y / len1;
    const u2x = v2x / len2;
    const u2y = v2y / len2;

    const t0 = Math.atan2(u1y, u1x);
    const t1 = Math.atan2(u2y, u2x);
    let defl = t1 - t0;
    while (defl <= -Math.PI) defl += 2 * Math.PI;
    while (defl > Math.PI) defl -= 2 * Math.PI;

    // Num laço fechado, diferenciar cantos interiores consoante corte exterior ou interior:
    // Corte Exterior: reentrâncias (defl < 0 em CCW)
    // Corte Interior/Pocket/On: vértices do contorno interno (defl > 0 em CCW)
    let isInsideCorner = false;
    if (strategy === 'outside') {
      isInsideCorner = isCCW ? (defl < -0.3 && defl > -2.85) : (defl > 0.3 && defl < 2.85);
    } else {
      isInsideCorner = isCCW ? (defl > 0.3 && defl < 2.85) : (defl < -0.3 && defl > -2.85);
    }

    if (isInsideCorner) {
      const halfDefl = Math.abs(defl) / 2;
      const cosHalf = Math.cos(halfDefl);
      if (cosHalf < 0.1) continue;

      const dir1 = [u1x, u1y];
      const dir2 = [-u2x, -u2y];
      let boneVec = [0, 0];

      if (type === 'tbone-h') {
        boneVec = Math.abs(dir1[0]) >= Math.abs(dir2[0]) ? dir1 : dir2;
      } else if (type === 'tbone-v') {
        boneVec = Math.abs(dir1[1]) >= Math.abs(dir2[1]) ? dir1 : dir2;
      } else {
        const bx = dir1[0] + dir2[0];
        const by = dir1[1] + dir2[1];
        const blen = Math.hypot(bx, by) || 1;
        boneVec = [bx / blen, by / blen];
      }

      // Profundidade do corte de osso (overshoot adaptativo REA FreeCAD DogboneII)
      const boneLength = type.startsWith('tbone')
        ? toolRadius * 1.05
        : Math.max(toolRadius * 0.45, (toolRadius / Math.max(0.2, cosHalf)) - toolRadius * 0.7);

      const dx = boneLength * boneVec[0];
      const dy = boneLength * boneVec[1];

      // Inserir os waypoints do alívio: avançar até à ponta e retroceder ao canto
      newPoints.push({ x: pCurr.x + dx, y: pCurr.y + dy, isDogbone: true });
      newPoints.push({ x: pCurr.x, y: pCurr.y, isDogboneReturn: true });
    }
  }

  newPoints.push({ ...newPoints[0] });
  return newPoints;
}

/**
 * REA FreeCAD ramp_entry.py & Carbide Create Pro:
 * Gera descida em rampa inclinada contínua ao longo do perímetro inicial da passagem
 * em vez de mergulho vertical a direito, reduzindo esforços de corte e calor.
 */
function generateRampedPass(loop, zStart, zTarget, rampAngleDeg = 10, maxRampLen = 30) {
  if (!loop || loop.length < 2) return [];

  const deltaZ = Math.abs(zTarget - zStart);
  if (deltaZ < 0.01) {
    return loop.map(p => ({ x: p.x, y: p.y, z: zTarget }));
  }

  const angleRad = (Math.max(2, Math.min(45, rampAngleDeg)) * Math.PI) / 180;
  const neededRampLen = Math.min(maxRampLen, deltaZ / Math.tan(angleRad));

  const cumDists = [0];
  let totalPerimeter = 0;
  for (let i = 0; i < loop.length - 1; i++) {
    const d = Math.hypot(loop[i + 1].x - loop[i].x, loop[i + 1].y - loop[i].y);
    totalPerimeter += d;
    cumDists.push(totalPerimeter);
  }

  const effectiveRampLen = Math.min(neededRampLen, totalPerimeter * 0.85);
  const rampedPoints = [];

  rampedPoints.push({ x: loop[0].x, y: loop[0].y, z: zStart });
  let rampCompleted = false;

  for (let i = 1; i < loop.length; i++) {
    const p1 = loop[i - 1];
    const p2 = loop[i];
    const dStart = cumDists[i - 1];
    const dEnd = cumDists[i];

    if (!rampCompleted) {
      if (dEnd <= effectiveRampLen) {
        const zP2 = zStart + (zTarget - zStart) * (dEnd / effectiveRampLen);
        rampedPoints.push({ x: p2.x, y: p2.y, z: zP2, isRamping: true });
        if (Math.abs(dEnd - effectiveRampLen) < 1e-3) {
          rampCompleted = true;
        }
      } else if (dStart < effectiveRampLen && dEnd > effectiveRampLen) {
        const frac = (effectiveRampLen - dStart) / (dEnd - dStart);
        const splitX = p1.x + (p2.x - p1.x) * frac;
        const splitY = p1.y + (p2.y - p1.y) * frac;
        rampedPoints.push({ x: splitX, y: splitY, z: zTarget, isRampEnd: true });
        rampedPoints.push({ x: p2.x, y: p2.y, z: zTarget });
        rampCompleted = true;
      } else {
        rampedPoints.push({ x: p2.x, y: p2.y, z: zTarget });
      }
    } else {
      rampedPoints.push({ x: p2.x, y: p2.y, z: zTarget });
    }
  }

  // FreeCAD Método 4: Sobreposição (Overlap) para limpar a rampa de entrada à cota zTarget
  if (effectiveRampLen > 0.1) {
    const overlapPoints = [];
    for (let i = 1; i < loop.length; i++) {
      const dStart = cumDists[i - 1];
      const dEnd = cumDists[i];
      if (dEnd <= effectiveRampLen) {
        overlapPoints.push({ x: loop[i].x, y: loop[i].y, z: zTarget, isOverlap: true });
        if (Math.abs(dEnd - effectiveRampLen) < 1e-3) break;
      } else if (dStart < effectiveRampLen && dEnd > effectiveRampLen) {
        const frac = (effectiveRampLen - dStart) / (dEnd - dStart);
        const splitX = loop[i - 1].x + (loop[i].x - loop[i - 1].x) * frac;
        const splitY = loop[i - 1].y + (loop[i].y - loop[i - 1].y) * frac;
        overlapPoints.push({ x: splitX, y: splitY, z: zTarget, isOverlap: true });
        break;
      } else {
        break;
      }
    }
    overlapPoints.forEach(p => rampedPoints.push(p));
    // Regressar ao ponto inicial (p0) ao nível zTarget pelo percurso já desbastado
    for (let i = overlapPoints.length - 2; i >= 0; i--) {
      rampedPoints.push({ x: overlapPoints[i].x, y: overlapPoints[i].y, z: zTarget });
    }
    rampedPoints.push({ x: loop[0].x, y: loop[0].y, z: zTarget });
  }

  return rampedPoints;
}

/**
 * Calcula e interpola os waypoints de subida e descida para Abas de Fixação (Holding Tabs)
 * Baseado no modelo determinístico de pontes do Layerling (stencilBridges.ts)
 */
function generateContourWithTabs(points, tabOptions, zVal, depthTotal) {
  const { count = 4, width = 5.0, height = 1.5, enabled = true } = tabOptions;
  if (!enabled || count <= 0 || width <= 0) {
    return points.map(p => ({ x: p.x, y: p.y, z: zVal }));
  }

  // 1. Distâncias acumuladas ao longo do contorno
  const dists = [0];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
    totalLength += d;
    dists.push(totalLength);
  }

  if (totalLength < width * count * 1.2) {
    return points.map(p => ({ x: p.x, y: p.y, z: zVal }));
  }

  // 2. Definir intervalos das abas uniformemente
  const spacing = totalLength / count;
  const tabIntervals = [];
  for (let k = 0; k < count; k++) {
    const center = (k + 0.5) * spacing;
    const start = center - width / 2;
    const end = center + width / 2;
    tabIntervals.push({ start, end });
  }

  const isInsideTab = (d) => tabIntervals.some(tab => d >= tab.start - 1e-4 && d <= tab.end + 1e-4);
  const tabZ = depthTotal + height;

  // 3. Interpolar novos pontos nas fronteiras de cada aba
  const samples = [];
  for (let i = 0; i < points.length - 1; i++) {
    const pA = points[i];
    const pB = points[i + 1];
    const dA = dists[i];
    const dB = dists[i + 1];
    const segLen = dB - dA;

    samples.push({ x: pA.x, y: pA.y, d: dA });

    const splitDists = [];
    for (const tab of tabIntervals) {
      if (tab.start > dA && tab.start < dB) splitDists.push(tab.start);
      if (tab.end > dA && tab.end < dB) splitDists.push(tab.end);
    }
    splitDists.sort((a, b) => a - b);

    for (const splitD of splitDists) {
      const t = (splitD - dA) / (segLen || 1);
      samples.push({
        x: pA.x + (pB.x - pA.x) * t,
        y: pA.y + (pB.y - pA.y) * t,
        d: splitD
      });
    }
  }
  const lastPt = points[points.length - 1];
  samples.push({ x: lastPt.x, y: lastPt.y, d: totalLength });

  return samples.map(s => {
    const inTab = isInsideTab(s.d);
    const z = inTab ? Math.max(zVal, tabZ) : zVal;
    return { x: s.x, y: s.y, z, inTab };
  });
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

let toastTimeout = null;
/**
 * Exibe notificação flutuante com ação rápida para abrir o Simulador 3D
 */
function showCamToast(message, onAction) {
  const toast = document.getElementById('cam-toast');
  const msgEl = document.getElementById('cam-toast-msg');
  const actionBtn = document.getElementById('cam-toast-action');
  if (!toast || !msgEl) return;

  msgEl.innerText = message;
  if (actionBtn && onAction) {
    actionBtn.style.display = 'flex';
    actionBtn.onclick = () => {
      toast.classList.remove('visible');
      onAction();
    };
  } else if (actionBtn) {
    actionBtn.style.display = 'none';
  }

  toast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 7000);
}

/**
 * MOTOR CAM: Gera percursos em G-code e desenha visualização 3D simulada
 */
function generateGCode() {
  try {
    // 1. Filtrar apenas objectos de desenho (ignorar percursos visuais e marcadores)
    const allObjects = canvas.getObjects().filter(obj => !obj.isVisualPath && !obj.isOriginMarker);
    if (allObjects.length === 0) {
      alert("Adiciona pelo menos uma forma ou imagem ao canvas antes de gerar a trajectória!");
      return;
    }

    // Feedback visual imediato no botão
    if (btnGenerate) {
      btnGenerate.innerText = "⏳ A gerar trajectória...";
      btnGenerate.style.opacity = "0.75";
    }

    // Separar objectos de relevo (imagens 3D ou imagens gerais) dos contornos vectoriais
    const reliefObjects = allObjects.filter(obj => obj.isReliefImage || obj.type === 'image');
    const contourObjects = allObjects.filter(obj => !obj.isReliefImage && obj.type !== 'image');

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
    const spindleSpeed = parseCAMParam(inputSpindleSpeed, 12000);
    const useTabs = paramUseTabs ? paramUseTabs.checked : false;
    const tabCount = paramTabCount ? (parseInt(paramTabCount.value, 10) || 4) : 4;
    const tabWidth = paramTabWidth ? (parseFloat(paramTabWidth.value) || 5.0) : 5.0;
    const tabHeight = paramTabHeight ? (parseFloat(paramTabHeight.value) || 1.5) : 1.5;
    const strategy = selectStrategy ? selectStrategy.value : 'outside';
    const toolRadius = toolDia / 2;
    const stepover = inputStepover ? (parseFloat(inputStepover.value) || 40) : 40;

    // Validações apenas para contornos (não se aplicam ao relevo)
    if (contourObjects.length > 0) {
      if (depthTotal >= 0) {
        alert("A profundidade total tem de ser um valor negativo (abaixo da superfície de corte)!");
        if (btnGenerate) { btnGenerate.innerText = "⚙️ Gerar Trajectória"; btnGenerate.style.opacity = ""; }
        return;
      }
      if (Math.abs(depthTotal) > materialZ) {
        const errMsg = `❌ ERRO DE SEGURANÇA:\nA profundidade total de corte (${Math.abs(depthTotal)} mm) excede a espessura do material (${materialZ} mm).\nAjusta a profundidade ou a espessura para evitar colisão e danos na mesa da máquina.`;
        gcodeOutputText.value = errMsg;
        gcodeOutputText.style.color = "var(--danger)";
        alert(errMsg);
        if (btnGenerate) { btnGenerate.innerText = "⚙️ Gerar Trajectória"; btnGenerate.style.opacity = ""; }
        return;
      }
    }

    // Validações de segurança para relevo 3D
    if (reliefObjects.length > 0) {
      for (const fabricImg of reliefObjects) {
        const rs = fabricImg.reliefSettings;
        const maxDepth = rs ? (rs.maxDepth || 2.0) : 2.0;
        if (maxDepth > materialZ) {
          const errMsg = `❌ ERRO DE SEGURANÇA:\nA profundidade do relevo (${maxDepth.toFixed(1)} mm) excede a espessura do material (${materialZ} mm).\nAjusta a profundidade do relevo ou a espessura para evitar colisão e danos na mesa da máquina.`;
          gcodeOutputText.value = errMsg;
          gcodeOutputText.style.color = "var(--danger)";
          alert(errMsg);
          if (btnGenerate) { btnGenerate.innerText = "⚙️ Gerar Trajectória"; btnGenerate.style.opacity = ""; }
          return;
        }
      }
    }

    gcodeOutputText.style.color = "var(--success)";

    // 3. Montar Cabeçalho do G-code Limpo (Padrão CNC Router)
    let gcode = [];
    gcode.push(`G21`);
    gcode.push(`G90`);
    gcode.push(`G17`);
    gcode.push(`M3 S${spindleSpeed.toFixed(0)}`);
    gcode.push(`G4 P1.5`);
    gcode.push(`G0 Z${safeZ.toFixed(3)}`);

    // WCS Offsets
    const wcsX = parseFloat(inputWcsX?.value) || 0;
    const wcsY = parseFloat(inputWcsY?.value) || 0;

    // Colecção de percursos para desenhar no Canvas 2D
    const toolpathsToVisualise = [];

    // 4A. PROCESSAR OBJECTOS DE RELEVO 3D (Raster G-code)
    if (reliefObjects.length > 0) {
      reliefObjects.forEach((fabricImg, imgIdx) => {
        // Garantir que reliefSettings existe com valores por omissão
        let rs = fabricImg.reliefSettings;
        if (!rs) {
          rs = { maxDepth: 2.0, doublePass: false, mode: 'luminance' };
          fabricImg.reliefSettings = rs;
          fabricImg.isReliefImage = true;
        }

        const img = fabricImg.reliefImgEl || fabricImg.getElement() || (() => {
          const i = new Image();
          i.src = fabricImg.reliefSrc || fabricImg._element?.src;
          return i;
        })();

        // Dimensões actuais do objecto na mesa (em mm)
        const objWidthPx = fabricImg.width * (fabricImg.scaleX || 1);
        const objHeightPx = fabricImg.height * (fabricImg.scaleY || 1);
        const objWidthMM = objWidthPx / ESCALA_MM_PX;
        const objHeightMM = objHeightPx / ESCALA_MM_PX;

        // Posição do objecto na mesa (em mm, coordenadas de canvas convertidas)
        const objLeftMM = fabricImg.left / ESCALA_MM_PX;
        const objTopMM = (canvas.height - (fabricImg.top + objHeightPx)) / ESCALA_MM_PX;

        // Obter ou regenerar mapa de profundidade
        let dm = fabricImg.reliefDepthMap;
        let dmW = fabricImg.reliefDepthWidth;
        let dmH = fabricImg.reliefDepthHeight;
        if (!dm || !dmW || !dmH) {
          if (img && (img.complete || img.naturalWidth > 0)) {
            const res = processImageToDepthMap(img, {
              blur: rs.blur || 0,
              gamma: rs.gamma || 1.0,
              invert: !!rs.invert,
              scaleFactor: 0.5,
              mode: rs.mode || 'luminance',
              detail: rs.detail || 75,
              bgCut: rs.bgCut || 15,
              lightBalance: rs.lightBalance || 50
            });
            dm = res.depthMap;
            dmW = res.width;
            dmH = res.height;
            fabricImg.reliefDepthMap = dm;
            fabricImg.reliefDepthWidth = dmW;
            fabricImg.reliefDepthHeight = dmH;
          }
        }

        const maxDepth = rs.maxDepth || 2.0;

        function getReliefZ(xMM, yMM) {
          if (!dm || !dmW || !dmH) return 0;
          const u = Math.min(1, Math.max(0, xMM / objWidthMM));
          const v = 1 - Math.min(1, Math.max(0, yMM / objHeightMM));
          const px = Math.min(dmW - 1, Math.max(0, Math.round(u * (dmW - 1))));
          const py = Math.min(dmH - 1, Math.max(0, Math.round(v * (dmH - 1))));
          return -(dm[py * dmW + px] * maxDepth);
        }

        // Resolução transversal em Y (stepover) e ao longo de X (stepX)
        const stepY = Math.max(0.2, toolDia * 0.35);
        const stepX = Math.max(0.25, Math.min(0.8, objWidthMM / Math.max(1, dmW || 100)));

        // Posição de arranque segura
        gcode.push(`G0 Z${safeZ.toFixed(3)}`);

        // Padrão Zig-Zag contínuo
        let forward = true;
        let currentY = 0;
        let lineIdxCounter = 0;

        const startX = 0;
        const startY = 0;
        const zInitial = getReliefZ(startX, startY);
        gcode.push(`G0 X${(objLeftMM + startX - wcsX).toFixed(3)} Y${(objTopMM + startY - wcsY).toFixed(3)}`);
        gcode.push(`G1 Z${zInitial.toFixed(3)} F${feedZ.toFixed(0)}`);

        while (currentY <= objHeightMM) {
          const xs = forward ? 0 : objWidthMM;
          const xe = forward ? objWidthMM : 0;
          const dx = forward ? stepX : -stepX;

          for (let x = xs; forward ? x <= xe : x >= xe; x += dx) {
            const z = getReliefZ(x, currentY);
            gcode.push(`G1 X${(objLeftMM + x - wcsX).toFixed(3)} Y${(objTopMM + currentY - wcsY).toFixed(3)} Z${z.toFixed(3)} F${feedXY.toFixed(0)}`);
          }

          // Recolher amostragem de linha visual para renderizar sobre a imagem no Canvas 2D
          if (lineIdxCounter % 3 === 0) {
            const canvasY = canvas.height - ((objTopMM + currentY) * ESCALA_MM_PX);
            const canvasX1 = (objLeftMM + xs) * ESCALA_MM_PX;
            const canvasX2 = (objLeftMM + xe) * ESCALA_MM_PX;
            toolpathsToVisualise.push([
              { x: canvasX1, y: canvasY },
              { x: canvasX2, y: canvasY }
            ]);
          }
          lineIdxCounter++;

          // Avanço suave em Y para a próxima linha sem levantar a fresa para Z_safe
          currentY += stepY;
          if (currentY <= objHeightMM) {
            const zNext = getReliefZ(xe, currentY);
            gcode.push(`G1 Y${(objTopMM + currentY - wcsY).toFixed(3)} Z${zNext.toFixed(3)} F${feedXY.toFixed(0)}`);
            forward = !forward;
          }
        }

        // Retracção de segurança no fim do passe em X
        gcode.push(`G0 Z${safeZ.toFixed(3)}`);

        // Raster Y (passe cruzado opcional)
        if (rs.doublePass) {
          let btt = true;
          let currentX = 0;
          const stepXCross = Math.max(0.2, toolDia * 0.35);
          const stepYCross = Math.max(0.25, Math.min(0.8, objHeightMM / Math.max(1, dmH || 100)));

          const zCrossInit = getReliefZ(0, 0);
          gcode.push(`G0 X${(objLeftMM - wcsX).toFixed(3)} Y${(objTopMM - wcsY).toFixed(3)}`);
          gcode.push(`G1 Z${zCrossInit.toFixed(3)} F${feedZ.toFixed(0)}`);

          while (currentX <= objWidthMM) {
            const ys = btt ? 0 : objHeightMM;
            const ye = btt ? objHeightMM : 0;
            const dy = btt ? stepYCross : -stepYCross;

            for (let y = ys; btt ? y <= ye : y >= ye; y += dy) {
              const z = getReliefZ(currentX, y);
              gcode.push(`G1 X${(objLeftMM + currentX - wcsX).toFixed(3)} Y${(objTopMM + y - wcsY).toFixed(3)} Z${z.toFixed(3)} F${feedXY.toFixed(0)}`);
            }

            currentX += stepXCross;
            if (currentX <= objWidthMM) {
              const zCrossNext = getReliefZ(currentX, ye);
              gcode.push(`G1 X${(objLeftMM + currentX - wcsX).toFixed(3)} Z${zCrossNext.toFixed(3)} F${feedXY.toFixed(0)}`);
              btt = !btt;
            }
          }

          gcode.push(`G0 Z${safeZ.toFixed(3)}`);
        }
      });
    }

    // 4B. Processar Geometria de contornos normais (rectângulos, círculos, linhas, SVG)

    // 4. Processar Geometria de cada objecto de contorno no Canvas
    contourObjects.forEach((obj, idx) => {
      // Um objecto pode gerar múltiplos subpercursos (ex: letras com buracos interiores ou SVG com múltiplos paths)
      let subpaths = [];

      // --- CASO 1: RETÂNGULO ---
      if (obj.type === 'rect') {
        const m = obj.calcTransformMatrix();
        const hw = obj.width / 2;
        const hh = obj.height / 2;
        const pts = [
          { x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }, { x: -hw, y: -hh }
        ].map(p => fabric.util.transformPoint(new fabric.Point(p.x, p.y), m));
        subpaths.push(pts);
      }
      // --- CASO 2: CÍRCULO (FASE 2: ARCOS NATIVOS G2/G3 COM VETORES I, J) ---
      else if (obj.type === 'circle') {
        const center = obj.getCenterPoint();
        const radius = obj.radius * (obj.scaleX || 1);
        const useArcs = paramUseArcs ? paramUseArcs.checked : true;

        const steps = 64;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * 2 * Math.PI;
          const px = center.x + radius * Math.cos(theta);
          const py = center.y + radius * Math.sin(theta);
          pts.push({ x: px, y: py });
        }

        if (useArcs) {
          subpaths.push({
            isArcCircle: true,
            center,
            radius,
            visualPoints: pts
          });
        } else {
          subpaths.push(pts);
        }
      }
      // --- CASO 3: LINHA ---
      else if (obj.type === 'line') {
        const m = obj.calcTransformMatrix();
        const lp = obj.calcLinePoints();
        const pts = [
          fabric.util.transformPoint(new fabric.Point(lp.x1, lp.y1), m),
          fabric.util.transformPoint(new fabric.Point(lp.x2, lp.y2), m)
        ];
        subpaths.push(pts);
      }
      // --- CASO 4: CAMINHO / SVG / GRUPO ---
      else {
        const svgNS = "http://www.w3.org/2000/svg";
        const tempSvg = document.createElementNS(svgNS, "svg");
        document.body.appendChild(tempSvg);

        const dStrings = [];
        if (obj.type === 'path') {
          // Separar subpaths em comandos 'M'/'m' distintos se existirem
          const pathCommands = obj.path;
          let currentD = [];
          for (let c = 0; c < pathCommands.length; c++) {
            const cmd = pathCommands[c];
            if ((cmd[0] === 'M' || cmd[0] === 'm') && currentD.length > 0) {
              dStrings.push(currentD.map(p => p.join(' ')).join(' '));
              currentD = [];
            }
            currentD.push(cmd);
          }
          if (currentD.length > 0) {
            dStrings.push(currentD.map(p => p.join(' ')).join(' '));
          }
        } else {
          // Se for grupo SVG, extrair todos os paths individuais
          const svgString = obj.toSVG();
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgString, 'image/svg+xml');
          const paths = doc.querySelectorAll('path');
          paths.forEach(p => {
            const d = p.getAttribute('d');
            if (d && d.trim()) dStrings.push(d.trim());
          });
        }

        const matrix = obj.calcTransformMatrix();
        dStrings.forEach(dStr => {
          if (!dStr.trim()) return;
          const tempPath = document.createElementNS(svgNS, "path");
          tempPath.setAttribute('d', dStr);
          tempSvg.appendChild(tempPath);
          try {
            const totalLength = tempPath.getTotalLength();
            if (totalLength > 0.05) {
              const stepSize = 2; // 1mm em px (ESCALA_MM_PX = 2)
              const numPoints = Math.max(12, Math.ceil(totalLength / stepSize));
              const pts = [];
              for (let i = 0; i <= numPoints; i++) {
                const dist = (i / numPoints) * totalLength;
                const pt = tempPath.getPointAtLength(dist);
                const transformedPt = fabric.util.transformPoint({ x: pt.x, y: pt.y }, matrix);
                pts.push(transformedPt);
              }
              if (pts.length > 0) subpaths.push(pts);
            }
          } catch (e) {
            console.warn("Erro ao ler subpath SVG:", e);
          } finally {
            tempSvg.removeChild(tempPath);
          }
        });

        document.body.removeChild(tempSvg);
      }

      // Processar cada subpath aplicando a Estratégia CAM (Exterior, Interior ou Pocket)
      subpaths.forEach(subItem => {
        const wcsX = parseCAMParam(inputWcsX, 250);
        const wcsY = parseCAMParam(inputWcsY, 250);

        // 1. CÍRCULO COM ARCOS NATIVOS G2 (quando tabs não estão ativos e não é pocket)
        if (subItem && subItem.isArcCircle && !useTabs && strategy !== 'pocket') {
          const { center, radius } = subItem;

          const cxMM = (center.x / ESCALA_MM_PX) - wcsX;
          const cyMM = ((canvas.height - center.y) / ESCALA_MM_PX) - wcsY;
          const rBaseMM = radius / ESCALA_MM_PX;

          // Compensação de raio no círculo
          let rCut = rBaseMM;
          if (strategy === 'outside') rCut = rBaseMM + toolRadius;
          else if (strategy === 'inside') rCut = Math.max(0.1, rBaseMM - toolRadius);

          // Amostragem para renderização visual no canvas 2D
          const visPts = [];
          for (let i = 0; i <= 64; i++) {
            const theta = (i / 64) * 2 * Math.PI;
            visPts.push({
              x: (cxMM + rCut * Math.cos(theta) + wcsX) * ESCALA_MM_PX,
              y: canvas.height - ((cyMM + rCut * Math.sin(theta) + wcsY) * ESCALA_MM_PX)
            });
          }
          toolpathsToVisualise.push(visPts);

          const startX = cxMM - rCut;
          const startY = cyMM;

          const zPasses = [];
          let currentZ = -depthPass;
          while (currentZ > depthTotal) {
            zPasses.push(currentZ);
            currentZ -= depthPass;
          }
          zPasses.push(depthTotal);

          gcode.push(`G0 Z${safeZ.toFixed(3)}`);
          gcode.push(`G0 X${startX.toFixed(3)} Y${startY.toFixed(3)}`);

          zPasses.forEach((zVal) => {
            gcode.push(`G1 Z${zVal.toFixed(3)} F${feedZ.toFixed(0)}`);
            gcode.push(`G2 X${(cxMM + rCut).toFixed(3)} Y${cyMM.toFixed(3)} I${rCut.toFixed(3)} J0.000 F${feedXY.toFixed(0)}`);
            gcode.push(`G2 X${(cxMM - rCut).toFixed(3)} Y${cyMM.toFixed(3)} I${(-rCut).toFixed(3)} J0.000 F${feedXY.toFixed(0)}`);
          });

          gcode.push(`G0 Z${safeZ.toFixed(3)}`);
          return;
        }

        // 2. CONTORNOS POLIGONAIS, RETÂNGULOS, DXF E SVGs
        const rawPoints = (subItem && subItem.isArcCircle) ? subItem.visualPoints : subItem;
        if (!rawPoints || rawPoints.length < 2) return;

        // Converter pontos em coordenadas físicas de maquinação (mm)
        const mmPoints = rawPoints.map(pt => ({
          x: (pt.x / ESCALA_MM_PX) - wcsX,
          y: ((canvas.height - pt.y) / ESCALA_MM_PX) - wcsY
        }));

        const isClosed = Math.hypot(mmPoints[0].x - mmPoints[mmPoints.length - 1].x,
                                    mmPoints[0].y - mmPoints[mmPoints.length - 1].y) < 0.1;

        // Gerar os laços de corte (loops) consoante a estratégia seleccionada
        let loopsToCut = [];
        if (!isClosed || strategy === 'on') {
          loopsToCut = [mmPoints];
        } else if (strategy === 'outside') {
          // Compensação Exterior (+R): peça final fica com dimensão exacta
          loopsToCut = [offsetContour(mmPoints, toolRadius)];
        } else if (strategy === 'inside') {
          // Compensação Interior (-R): cavidade/furo fica com dimensão exacta
          loopsToCut = [offsetContour(mmPoints, -toolRadius)];
        } else if (strategy === 'pocket') {
          // Desbaste Concêntrico Total de Caixa
          loopsToCut = generatePocketToolpaths(mmPoints, toolDia, stepover);
          if (loopsToCut.length === 0) loopsToCut = [mmPoints];
        }

        // REA FreeCAD DogboneII & Vectric VCarve:
        // Se ativado pelo utilizador, aplicar alívios de cantos nos cantos internos
        const useDogbone = paramUseDogbone && paramUseDogbone.checked;
        const dogboneType = paramDogboneType ? paramDogboneType.value : 'dogbone';
        if (useDogbone && isClosed) {
          loopsToCut = loopsToCut.map(l => applyDogboneRelief(l, toolRadius, dogboneType, strategy));
        }

        // Visualização 2D no Canvas com os percursos compensados reais
        loopsToCut.forEach(loop => {
          const vis = loop.map(p => ({
            x: (p.x + wcsX) * ESCALA_MM_PX,
            y: canvas.height - ((p.y + wcsY) * ESCALA_MM_PX)
          }));
          toolpathsToVisualise.push(vis);
        });

        // Passagens verticais de descida Z
        const zPasses = [];
        let currentZ = -depthPass;
        while (currentZ > depthTotal) {
          zPasses.push(currentZ);
          currentZ -= depthPass;
        }
        zPasses.push(depthTotal);

        const useRamping = paramUseRamping && paramUseRamping.checked;
        const rampAngle = paramRampAngle ? parseFloat(paramRampAngle.value) || 10 : 10;
        const rampMaxLen = paramRampMaxLen ? parseFloat(paramRampMaxLen.value) || 30 : 30;

        // Executar corte para cada laço gerado
        loopsToCut.forEach((loop) => {
          if (!loop || loop.length < 2) return;
          const startPt = loop[0];

          gcode.push(`G0 Z${safeZ.toFixed(3)}`);
          gcode.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)}`);

          zPasses.forEach((zVal, pIdx) => {
            const prevZ = (pIdx === 0) ? 0 : zPasses[pIdx - 1];

            if (!isClosed && pIdx > 0) {
              gcode.push(`G0 Z${safeZ.toFixed(3)}`);
              gcode.push(`G0 X${startPt.x.toFixed(3)} Y${startPt.y.toFixed(3)}`);
            }

            const isBottomPass = (zVal <= depthTotal + tabHeight);
            // Aplicar Holding Tabs apenas no contorno exterior ou sobre a linha
            const shouldApplyTabs = useTabs && isClosed && isBottomPass && (strategy === 'outside' || strategy === 'on');
            
            let waypoints;
            if (shouldApplyTabs) {
              waypoints = generateContourWithTabs(loop, { enabled: true, count: tabCount, width: tabWidth, height: tabHeight }, zVal, depthTotal);
            } else if (useRamping && isClosed) {
              waypoints = generateRampedPass(loop, prevZ, zVal, rampAngle, rampMaxLen);
            } else {
              waypoints = loop.map(p => ({ x: p.x, y: p.y, z: zVal }));
            }

            // Posicionar no início Z da passagem
            gcode.push(`G1 Z${waypoints[0].z.toFixed(3)} F${feedZ.toFixed(0)}`);

            // Corte em avanço XY / XYZ
            for (let i = 1; i < waypoints.length; i++) {
              const prev = waypoints[i - 1];
              const curr = waypoints[i];

              if (Math.abs(curr.z - prev.z) > 1e-4) {
                if (curr.z > prev.z) {
                  gcode.push(`G1 Z${curr.z.toFixed(3)} F${feedZ.toFixed(0)} (Subida Aba)`);
                  gcode.push(`G1 X${curr.x.toFixed(3)} Y${curr.y.toFixed(3)} F${feedXY.toFixed(0)}`);
                } else if (shouldApplyTabs) {
                  gcode.push(`G1 X${curr.x.toFixed(3)} Y${curr.y.toFixed(3)} F${feedXY.toFixed(0)}`);
                  gcode.push(`G1 Z${curr.z.toFixed(3)} F${feedZ.toFixed(0)} (Descida Corte)`);
                } else {
                  // Rampa 3D inclinada contínua (movimento simultâneo XYZ)
                  gcode.push(`G1 X${curr.x.toFixed(3)} Y${curr.y.toFixed(3)} Z${curr.z.toFixed(3)} F${feedXY.toFixed(0)} (Entrada em Rampa)`);
                }
              } else if (curr.isDogbone) {
                gcode.push(`G1 X${curr.x.toFixed(3)} Y${curr.y.toFixed(3)} F${feedXY.toFixed(0)} (Alivio Dogbone)`);
              } else {
                gcode.push(`G1 X${curr.x.toFixed(3)} Y${curr.y.toFixed(3)} F${feedXY.toFixed(0)}`);
              }
            }
          });

          gcode.push(`G0 Z${safeZ.toFixed(3)}`);
        });
      });
    });

    // 5. Rodapé Final do G-code (Paragem do Router CNC)
    gcode.push(`G0 Z${safeZ.toFixed(3)}`);
    gcode.push(`M5`);
    gcode.push(`G0 X0 Y0`);
    gcode.push(`M30`);
    
    // Garantir G-code 100% limpo sem quaisquer comentários (; ou ()) nem linhas vazias
    const cleanGCode = gcode
      .map(line => line.split(';')[0].replace(/\(.*?\)/g, '').trim())
      .filter(line => line.length > 0)
      .join('\n');

    lastGeneratedGCode = cleanGCode;
    gcodeOutputText.value = cleanGCode;

    // FASE 1: Parser e Diagnóstico de Segurança CAM (Baseado no Of4W)
    const analysis = analyzeAndDisplayGCodeStats(cleanGCode);

    // FASE 3: Carregar percurso no Simulador 3D WebGL (Three.js)
    loadGCodeInto3DSimulator(cleanGCode);

    // 6. Activar botões
    btnDownload.classList.remove('disabled');
    btnDownload.removeAttribute('disabled');
    btnCopy.classList.remove('disabled');
    btnCopy.removeAttribute('disabled');

    // 7. Desenhar percursos pontilhados no canvas para simulação
    drawVisualToolpaths(toolpathsToVisualise);

    // 8. Feedback visual de sucesso imediato no botão
    if (btnGenerate) {
      btnGenerate.innerText = "✅ Trajectória Gerada!";
      btnGenerate.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btnGenerate.style.opacity = "1";
      setTimeout(() => {
        btnGenerate.innerText = "⚙️ Gerar Trajectória";
        btnGenerate.style.background = "";
      }, 3000);
    }

    // 9. Fazer pulsar o botão de abrir Simulador 3D
    if (btnOpenSim3d) {
      btnOpenSim3d.classList.add('btn-pulsing');
      setTimeout(() => btnOpenSim3d.classList.remove('btn-pulsing'), 7000);
    }

    // 10. Scroll suave para o cartão de estatísticas
    if (gcodeStatsCard) {
      gcodeStatsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 11. Notificação Toast com atalho para abrir o Simulador 3D
    const lineCount = cleanGCode.split('\n').length;
    showCamToast(
      reliefObjects.length > 0 
        ? `✨ Relevo 3D gerado (${lineCount} linhas)! A abrir o Simulador 3D...`
        : `✨ Trajectória gerada (${lineCount} linhas)! Clica para ver no Simulador 3D.`,
      () => {
        switchViewMode('3d');
        startSimulationPlayback();
      }
    );

    // 12. Se for relevo 3D, transição suave automática para o Simulador 3D Three.js
    if (reliefObjects.length > 0) {
      setTimeout(() => {
        switchViewMode('3d');
        startSimulationPlayback();
      }, 400);
    }
  } catch (err) {
    console.error("Erro na geração do G-code:", err);
    alert("Ocorreu um erro ao gerar o G-code. Por favor, verifica se todos os parâmetros numéricos estão corretos.");
    if (btnGenerate) {
      btnGenerate.innerText = "⚙️ Gerar Trajectória";
      btnGenerate.style.opacity = "";
      btnGenerate.style.background = "";
    }
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

/* ==========================================================================
   FASE 1: PARSER DE G-CODE, ESTATÍSTICAS E VALIDAÇÃO CAM (ESTILO NCVIEWER Of4W)
   ========================================================================== */

/**
 * Parser de G-code robusto que decompõe blocos CNC, calcula bounding box, distâncias e tempos
 */
function parseGCode(gcodeText) {
  const tokenRegex = /(G|M|X|Y|Z|A|B|C|I|J|K|R|S|T|F)(-?\d*\.?\d+\.?)/gi;
  const commentRegex = /\((.*?)\)|;.*$/;

  let motion = 0; // 0=Rapid, 1=Linear, 2=ArcCW, 3=ArcCCW
  let distMode = 90; // 90=Absolute, 91=Incremental
  let currentFeed = 1400;
  let rapidFeed = 3500; // mm/min assumido para deslocações rápidas G0
  let currentPos = { x: 0, y: 0, z: 0 };
  let currentTool = 1;
  let spindleSpeed = 18000;

  const points = [];
  const segments = []; // Trajectórias para o simulador 3D e cálculo de métricas
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let totalRapidDist = 0;
  let totalFeedDist = 0;
  let totalTimeMinutes = 0;

  const lines = gcodeText.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const cleanLine = rawLine.replace(commentRegex, '').trim();
    if (!cleanLine) continue;

    let targetPos = { ...currentPos };
    let hasMove = false;
    let arcI = 0, arcJ = 0, arcK = 0, arcR = null;

    let match;
    tokenRegex.lastIndex = 0;
    while ((match = tokenRegex.exec(cleanLine)) !== null) {
      const letter = match[1].toUpperCase();
      const val = parseFloat(match[2]);

      switch (letter) {
        case 'G':
          if (val === 0) motion = 0;
          else if (val === 1) motion = 1;
          else if (val === 2) motion = 2;
          else if (val === 3) motion = 3;
          else if (val === 90) distMode = 90;
          else if (val === 91) distMode = 91;
          break;
        case 'X':
          targetPos.x = distMode === 91 ? currentPos.x + val : val;
          hasMove = true;
          break;
        case 'Y':
          targetPos.y = distMode === 91 ? currentPos.y + val : val;
          hasMove = true;
          break;
        case 'Z':
          targetPos.z = distMode === 91 ? currentPos.z + val : val;
          hasMove = true;
          break;
        case 'I':
          arcI = val;
          break;
        case 'J':
          arcJ = val;
          break;
        case 'K':
          arcK = val;
          break;
        case 'R':
          arcR = val;
          break;
        case 'F':
          currentFeed = val;
          break;
        case 'S':
          spindleSpeed = val;
          break;
        case 'T':
          currentTool = val;
          break;
      }
    }

    if (hasMove) {
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const dz = targetPos.z - currentPos.z;
      const linearDist = Math.hypot(dx, dy, dz);

      // Tratamento de Arcos G2 / G3 (Interpolação circular baseada na matemática do módulo zfJf)
      if ((motion === 2 || motion === 3) && (arcI !== 0 || arcJ !== 0 || arcR !== null)) {
        const cx = currentPos.x + arcI;
        const cy = currentPos.y + arcJ;
        const r = Math.hypot(arcI, arcJ);

        const startAngle = Math.atan2(currentPos.y - cy, currentPos.x - cx);
        const endAngle = Math.atan2(targetPos.y - cy, targetPos.x - cx);

        let sweepAngle = 0;
        if (motion === 2) {
          // Sentido horário (CW)
          sweepAngle = startAngle - endAngle;
          if (sweepAngle <= 0) sweepAngle += 2 * Math.PI;
        } else {
          // Sentido anti-horário (CCW)
          sweepAngle = endAngle - startAngle;
          if (sweepAngle <= 0) sweepAngle += 2 * Math.PI;
        }

        const arcLen = sweepAngle * r;
        const totalArcDist = Math.hypot(arcLen, dz);
        const steps = Math.max(8, Math.min(64, Math.ceil(totalArcDist / 0.8)));

        let prevArcPt = { ...currentPos };
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const currAngle = motion === 2 ? startAngle - t * sweepAngle : startAngle + t * sweepAngle;
          const px = cx + r * Math.cos(currAngle);
          const py = cy + r * Math.sin(currAngle);
          const pz = currentPos.z + t * dz;
          const nextArcPt = { x: px, y: py, z: pz };
          const segDist = Math.hypot(nextArcPt.x - prevArcPt.x, nextArcPt.y - prevArcPt.y, nextArcPt.z - prevArcPt.z);

          segments.push({
            line: lineIdx + 1,
            type: 'arc',
            from: { ...prevArcPt },
            to: { ...nextArcPt },
            dist: segDist,
            feed: currentFeed,
            motion
          });

          if (pz <= 0.05) {
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
          }
          minZ = Math.min(minZ, pz);
          maxZ = Math.max(maxZ, pz);

          prevArcPt = nextArcPt;
        }

        totalFeedDist += totalArcDist;
        totalTimeMinutes += (totalArcDist / (currentFeed > 0 ? currentFeed : 1000));
      } else if (linearDist > 0.0001) {
        // Movimento Linear (G0 ou G1)
        if (targetPos.z <= 0.05) {
          minX = Math.min(minX, targetPos.x, currentPos.x);
          maxX = Math.max(maxX, targetPos.x, currentPos.x);
          minY = Math.min(minY, targetPos.y, currentPos.y);
          maxY = Math.max(maxY, targetPos.y, currentPos.y);
        }
        minZ = Math.min(minZ, targetPos.z);
        maxZ = Math.max(maxZ, targetPos.z);

        const isRapid = motion === 0;
        const feedForMove = isRapid ? rapidFeed : (currentFeed > 0 ? currentFeed : 1000);
        totalTimeMinutes += (linearDist / feedForMove);

        if (isRapid) {
          totalRapidDist += linearDist;
        } else {
          totalFeedDist += linearDist;
        }

        segments.push({
          line: lineIdx + 1,
          type: isRapid ? 'rapid' : 'feed',
          from: { ...currentPos },
          to: { ...targetPos },
          dist: linearDist,
          feed: feedForMove,
          motion
        });
      }

      currentPos = targetPos;
      points.push({ ...currentPos, line: lineIdx + 1 });
    }
  }

  return {
    segments,
    points,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
      minZ: minZ === Infinity ? 0 : minZ,
      maxZ: maxZ === -Infinity ? 0 : maxZ,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
      depth: Math.max(0, Math.abs(minZ))
    },
    totalRapidDist,
    totalFeedDist,
    totalDist: totalRapidDist + totalFeedDist,
    estimatedMinutes: totalTimeMinutes,
    totalLines: lines.length
  };
}

/**
 * Atualiza o cartão visual de estatísticas e validação preventiva do G-code
 */
function analyzeAndDisplayGCodeStats(gcodeText) {
  if (!gcodeStatsCard || !statEstTime) return null;
  const analysis = parseGCode(gcodeText);
  simParsedData = analysis;

  gcodeStatsCard.style.display = 'block';

  // 1. Tempo Estimado de Fresagem
  const totalSecs = Math.round(analysis.estimatedMinutes * 60);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  let timeStr = "";
  if (hrs > 0) timeStr += `${hrs}h `;
  timeStr += `${mins}m ${secs.toString().padStart(2, '0')}s`;
  statEstTime.innerText = timeStr;

  // 2. Extensão do eixo Z
  statZRange.innerText = `${analysis.bounds.minZ.toFixed(2)} a ${analysis.bounds.maxZ.toFixed(1)} mm`;

  // 3. Bounding Box (Área de trabalho real)
  statBBox.innerText = `${analysis.bounds.width.toFixed(1)} x ${analysis.bounds.height.toFixed(1)} mm`;

  // 4. Distâncias totais
  statDistance.innerText = `${(analysis.totalDist / 1000).toFixed(2)} m (Corte: ${(analysis.totalFeedDist / 1000).toFixed(2)}m)`;

  // 5. Validação de Segurança CAM Preventiva
  const materialZ = parseCAMParam(inputMaterialZ, 10.0);
  const tableX = parseCAMParam(inputTableX, 500);
  const tableY = parseCAMParam(inputTableY, 500);
  const wcsX = parseFloat(inputWcsX?.value) || 0;
  const wcsY = parseFloat(inputWcsY?.value) || 0;

  let hasError = false;
  if (analysis.bounds.minZ < -materialZ - 0.05) {
    gcodeSafetyAlert.className = 'safety-badge warning';
    gcodeSafetyIcon.innerText = '⚠️';
    gcodeSafetyMsg.innerText = `ALERTA: Z (${analysis.bounds.minZ.toFixed(1)}mm) ultrapassa o material (${materialZ}mm)! Risco de colisão na mesa.`;
    hasError = true;
  } else {
    const absMinX = analysis.bounds.minX + wcsX;
    const absMaxX = analysis.bounds.maxX + wcsX;
    const absMinY = analysis.bounds.minY + wcsY;
    const absMaxY = analysis.bounds.maxY + wcsY;

    if (absMinX < -0.1 || absMaxX > tableX + 0.1 || absMinY < -0.1 || absMaxY > tableY + 0.1) {
      gcodeSafetyAlert.className = 'safety-badge warning';
      gcodeSafetyIcon.innerText = '⚠️';
      gcodeSafetyMsg.innerText = `ALERTA: O percurso sai fora da área física da mesa CNC (${tableX}x${tableY}mm)!`;
      hasError = true;
    } else {
      gcodeSafetyAlert.className = 'safety-badge safe';
      gcodeSafetyIcon.innerText = '✅';
      gcodeSafetyMsg.innerText = 'Percurso validado com sucesso dentro da mesa e material.';
    }
  }

  // Atualizar badge superior do simulador
  if (simStatusBadge && simStatusText) {
    simStatusBadge.style.display = 'flex';
    simStatusBadge.classList.add('ready');
    simStatusText.innerText = `Simulação Pronta (${analysis.segments.length} blocos)`;
  }

  return analysis;
}

/* ==========================================================================
   FASE 3: SIMULADOR 3D WEBGL INTEGRADO (THREE.JS + ORBIT CONTROLS)
   ========================================================================== */

/**
 * Alterna entre a vista 2D (Editor Fabric.js) e 3D (Simulador WebGL)
 */
function switchViewMode(mode) {
  currentViewMode = mode;
  if (mode === '3d') {
    tabView2d.classList.remove('active');
    tabView3d.classList.add('active');
    canvasContainer.style.display = 'none';
    sim3dContainer.style.display = 'block';

    initThreeSimulator();
    if (threeRenderer && threeCamera) {
      const w = sim3dContainer.clientWidth || 800;
      const h = sim3dContainer.clientHeight || 600;
      threeRenderer.setSize(w, h);
      threeCamera.aspect = w / h;
      threeCamera.updateProjectionMatrix();
    }
  } else {
    tabView3d.classList.remove('active');
    tabView2d.classList.add('active');
    sim3dContainer.style.display = 'none';
    canvasContainer.style.display = 'flex';
    pauseSimulationPlayback();
    if (canvas) canvas.requestRenderAll();
  }
}

/**
 * Inicializa a cena Three.js, iluminação, câmara e controlos de órbita
 */
function initThreeSimulator() {
  if (threeScene) return; // Já inicializado
  if (typeof THREE === 'undefined') {
    console.warn("Three.js não se encontra disponível globalmente.");
    return;
  }

  const container = sim3dContainer;
  const canvasEl = document.getElementById('three-canvas');
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  // 1. Cena
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x080b11);

  // 2. Câmara de Perspetiva com vista isométrica padrão CNC
  threeCamera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
  setThreeCameraPreset('iso');

  // 3. Renderizador WebGL
  threeRenderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    powerPreference: 'high-performance'
  });
  threeRenderer.setSize(width, height);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // 4. Controlos de Órbita
  if (typeof THREE.OrbitControls !== 'undefined') {
    threeControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.maxPolarAngle = Math.PI / 2 + 0.1; // não descer muito abaixo da mesa
  }

  // 5. Iluminação
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  threeScene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(200, 400, 300);
  threeScene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
  dirLight2.position.set(-200, -200, -100);
  threeScene.add(dirLight2);

  // 6. Construir Mesa Física e Bloco de Material
  buildThreeTableAndMaterial();

  // 7. Loop de Renderização Contínuo
  function animateThree() {
    requestAnimationFrame(animateThree);
    if (threeControls) threeControls.update();
    if (threeRenderer && threeScene && threeCamera && currentViewMode === '3d') {
      threeRenderer.render(threeScene, threeCamera);
    }
  }
  animateThree();

  // Redimensionamento
  window.addEventListener('resize', () => {
    if (currentViewMode === '3d' && threeRenderer && threeCamera) {
      const w = sim3dContainer.clientWidth || 800;
      const h = sim3dContainer.clientHeight || 600;
      threeCamera.aspect = w / h;
      threeCamera.updateProjectionMatrix();
      threeRenderer.setSize(w, h);
    }
  });
}

/**
 * Constrói a mesa CNC tridimensional e o bloco de material transparente
 */
function buildThreeTableAndMaterial() {
  if (!threeScene) return;

  // Remover elementos anteriores se existirem
  if (threeTableMesh) threeScene.remove(threeTableMesh);
  if (threeMaterialMesh) threeScene.remove(threeMaterialMesh);

  const tableX = parseCAMParam(inputTableX, 500);
  const tableY = parseCAMParam(inputTableY, 500);
  const materialZ = parseCAMParam(inputMaterialZ, 10.0);
  const wcsX = parseFloat(inputWcsX?.value) || 0;
  const wcsY = parseFloat(inputWcsY?.value) || 0;

  // 1. Grupo da Mesa CNC
  threeTableMesh = new THREE.Group();

  // Placa de sacrifício metálica
  const tableGeo = new THREE.BoxGeometry(tableX, 15, tableY);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
    metalness: 0.4
  });
  const tablePlate = new THREE.Mesh(tableGeo, tableMat);
  tablePlate.position.set(tableX / 2 - wcsX, -materialZ - 7.5, -(tableY / 2 - wcsY));
  threeTableMesh.add(tablePlate);

  // Grelha milimétrica sobre a mesa
  const gridHelper = new THREE.GridHelper(Math.max(tableX, tableY), 50, 0xf97316, 0x334155);
  gridHelper.position.set(tableX / 2 - wcsX, -materialZ + 0.05, -(tableY / 2 - wcsY));
  threeTableMesh.add(gridHelper);

  // Eixos de Coordenadas WCS (Origem X0 Y0 Z0)
  const axesHelper = new THREE.AxesHelper(60);
  axesHelper.position.set(0, 0, 0); // No ponto zero da peça!
  threeTableMesh.add(axesHelper);

  threeScene.add(threeTableMesh);

  // 2. Bloco translúcido de material (Acrílico/Madeira no quadrante da peça)
  const matGeo = new THREE.BoxGeometry(tableX, materialZ, tableY);
  const matMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.15,
    roughness: 0.3,
    transmission: 0.6,
    thickness: 5.0
  });
  threeMaterialMesh = new THREE.Mesh(matGeo, matMaterial);
  threeMaterialMesh.position.set(tableX / 2 - wcsX, -materialZ / 2, -(tableY / 2 - wcsY));
  threeScene.add(threeMaterialMesh);
}

/**
 * Cria o modelo 3D dinâmico da fresa de router CNC
 */
function buildThreeCutterTool(toolType, toolDia) {
  if (!threeScene) return;
  if (threeCutterTool) threeScene.remove(threeCutterTool);

  const group = new THREE.Group();
  const dia = toolDia || 3.175;
  const radius = dia / 2;

  // Corpo / Pinça do Spindle (Cilindro superior preto/metálico)
  const colletGeo = new THREE.CylinderGeometry(8, 8, 25, 24);
  const colletMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
  const collet = new THREE.Mesh(colletGeo, colletMat);
  collet.position.y = 20 + 12.5;
  group.add(collet);

  // Haste da fresa (Aço prateado)
  const shankGeo = new THREE.CylinderGeometry(radius, radius, 20, 24);
  const shankMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
  const shank = new THREE.Mesh(shankGeo, shankMat);
  shank.position.y = 10;
  group.add(shank);

  // Ponta activa da fresa dependente do Tipo
  let tipMesh;
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.7 }); // Dourado metal duro

  if (toolType === 'ball') {
    // Fresa Esférica: ponta arredondada
    const sphereGeo = new THREE.SphereGeometry(radius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    tipMesh = new THREE.Mesh(sphereGeo, tipMat);
    tipMesh.rotation.x = Math.PI;
    tipMesh.position.y = radius;
  } else if (toolType === 'vbit') {
    // Fresa Cónica / V-Bit
    const coneGeo = new THREE.ConeGeometry(radius, radius * 2, 24);
    tipMesh = new THREE.Mesh(coneGeo, tipMat);
    tipMesh.rotation.x = Math.PI;
    tipMesh.position.y = radius;
  } else {
    // Topo Plano padrão
    const flatGeo = new THREE.CylinderGeometry(radius, radius, 2, 24);
    tipMesh = new THREE.Mesh(flatGeo, tipMat);
    tipMesh.position.y = 1;
  }
  group.add(tipMesh);

  threeCutterTool = group;
  threeScene.add(threeCutterTool);
}

/**
 * Carrega o G-code no motor 3D, criando as malhas de linhas rápidas e linhas de corte
 */
function loadGCodeInto3DSimulator(gcodeText) {
  if (!threeScene) initThreeSimulator();
  if (!threeScene) return;

  const analysis = simParsedData || parseGCode(gcodeText);
  simParsedData = analysis;
  simSegments = analysis.segments;
  simCurrentIndex = 0;

  // Reconstruir mesa física com os offsets mais recentes
  buildThreeTableAndMaterial();

  // Construir a fresa tridimensional actual
  const toolDia = parseCAMParam(inputToolDia, 3.175);
  const toolType = paramToolType ? paramToolType.value : 'flat';
  buildThreeCutterTool(toolType, toolDia);

  // Limpar malhas de percursos anteriores
  if (toolpathRapidMesh) threeScene.remove(toolpathRapidMesh);
  if (toolpathCutMesh) threeScene.remove(toolpathCutMesh);

  // Coordenadas Three.js: X = X_cnc, Y = Z_cnc (altura), Z = -Y_cnc (profundidade)
  const rapidPoints = [];
  const cutPoints = [];

  simSegments.forEach(seg => {
    const p1 = new THREE.Vector3(seg.from.x, seg.from.z, -seg.from.y);
    const p2 = new THREE.Vector3(seg.to.x, seg.to.z, -seg.to.y);

    if (seg.type === 'rapid') {
      rapidPoints.push(p1, p2);
    } else {
      cutPoints.push(p1, p2);
    }
  });

  // 1. Percursos Rápidos (G0): Ciano translúcido
  if (rapidPoints.length > 0) {
    const rapidGeo = new THREE.BufferGeometry().setFromPoints(rapidPoints);
    const rapidMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35
    });
    toolpathRapidMesh = new THREE.LineSegments(rapidGeo, rapidMat);
    threeScene.add(toolpathRapidMesh);
  }

  // 2. Percursos de Corte (G1/G2/G3): Verde néon vibrante de alta visibilidade
  if (cutPoints.length > 0) {
    const cutGeo = new THREE.BufferGeometry().setFromPoints(cutPoints);
    const cutMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 2
    });
    toolpathCutMesh = new THREE.LineSegments(cutGeo, cutMat);
    threeScene.add(toolpathCutMesh);
  }

  // Posicionar a fresa no ponto inicial
  if (simSegments.length > 0 && threeCutterTool) {
    const start = simSegments[0].from;
    threeCutterTool.position.set(start.x, start.z, -start.y);
    updateDRODisplay(start.x, start.y, start.z, 0, 1, simSegments.length, 0);
  }

  if (simTimeline) {
    simTimeline.value = 0;
    if (simProgressText) simProgressText.innerText = "0.0%";
  }
}

/**
 * Controla o Play / Pausa da simulação interactiva
 */
function toggleSimulationPlay() {
  if (simIsPlaying) {
    pauseSimulationPlayback();
  } else {
    startSimulationPlayback();
  }
}

function startSimulationPlayback() {
  if (!simSegments || simSegments.length === 0) return;
  simIsPlaying = true;
  if (btnSimPlay) btnSimPlay.innerText = "⏸️ Pausar";

  let lastTime = performance.now();

  function playbackStep(now) {
    if (!simIsPlaying) return;
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // Avançar passos proporcionalmente à taxa de avanço e multiplicador
    const seg = simSegments[simCurrentIndex];
    if (seg) {
      const feed = seg.feed || 1200;
      const speedMmPerSec = (feed / 60) * simSpeedMultiplier;
      const stepsToAdvance = Math.max(1, Math.round((speedMmPerSec * dt) / Math.max(0.5, seg.dist)));

      simCurrentIndex = Math.min(simSegments.length - 1, simCurrentIndex + stepsToAdvance);
      const activeSeg = simSegments[simCurrentIndex];

      if (threeCutterTool && activeSeg) {
        threeCutterTool.position.set(activeSeg.to.x, activeSeg.to.z, -activeSeg.to.y);
        const pct = ((simCurrentIndex + 1) / simSegments.length) * 100;
        if (simTimeline) simTimeline.value = pct;
        if (simProgressText) simProgressText.innerText = `${pct.toFixed(1)}%`;
        updateDRODisplay(activeSeg.to.x, activeSeg.to.y, activeSeg.to.z, activeSeg.feed, activeSeg.line, simSegments.length, pct);
      }

      if (simCurrentIndex >= simSegments.length - 1) {
        pauseSimulationPlayback();
        return;
      }
    }

    simAnimId = requestAnimationFrame(playbackStep);
  }

  simAnimId = requestAnimationFrame(playbackStep);
}

function pauseSimulationPlayback() {
  simIsPlaying = false;
  if (btnSimPlay) btnSimPlay.innerText = "▶️ Reproduzir";
  if (simAnimId) cancelAnimationFrame(simAnimId);
}

function resetSimulation() {
  pauseSimulationPlayback();
  simCurrentIndex = 0;
  if (simSegments && simSegments.length > 0 && threeCutterTool) {
    const start = simSegments[0].from;
    threeCutterTool.position.set(start.x, start.z, -start.y);
    updateDRODisplay(start.x, start.y, start.z, 0, 1, simSegments.length, 0);
  }
  if (simTimeline) simTimeline.value = 0;
  if (simProgressText) simProgressText.innerText = "0.0%";
}

function seekSimulation(pct) {
  if (!simSegments || simSegments.length === 0) return;
  const targetIdx = Math.min(simSegments.length - 1, Math.floor((pct / 100) * simSegments.length));
  simCurrentIndex = targetIdx;
  const seg = simSegments[targetIdx];
  if (seg && threeCutterTool) {
    threeCutterTool.position.set(seg.to.x, seg.to.z, -seg.to.y);
    updateDRODisplay(seg.to.x, seg.to.y, seg.to.z, seg.feed, seg.line, simSegments.length, pct);
  }
  if (simProgressText) simProgressText.innerText = `${pct.toFixed(1)}%`;
}

/**
 * Ajusta a câmara para vistas predefinidas (Isométrica, Topo 2D ou Frente)
 */
function setThreeCameraPreset(preset) {
  if (!threeCamera) return;
  const tableX = parseCAMParam(inputTableX, 500);
  const tableY = parseCAMParam(inputTableY, 500);
  const maxDim = Math.max(tableX, tableY);

  if (preset === 'top') {
    threeCamera.position.set(0, maxDim * 1.6, 0);
    threeCamera.lookAt(0, 0, 0);
  } else if (preset === 'front') {
    threeCamera.position.set(0, 50, maxDim * 1.5);
    threeCamera.lookAt(0, 0, 0);
  } else {
    // Isométrica padrão 45°
    threeCamera.position.set(maxDim * 0.9, maxDim * 1.1, maxDim * 1.1);
    threeCamera.lookAt(0, 0, 0);
  }
  if (threeControls) {
    threeControls.target.set(0, 0, 0);
    threeControls.update();
  }
}

/**
 * Atualiza o painel DRO (Digital Read Out) em tempo real
 */
function updateDRODisplay(x, y, z, feed, currentLine, totalLines, pct) {
  if (droX) droX.innerText = x.toFixed(2);
  if (droY) droY.innerText = y.toFixed(2);
  if (droZ) droZ.innerText = z.toFixed(2);
  if (droF) droF.innerText = Math.round(feed || 0);
  if (droLine) droLine.innerText = `${currentLine || 0} / ${totalLines || 0}`;
}

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
/**
 * Abre a base de dados IndexedDB local do browser para armazenamento de grande capacidade (imagens e matrizes 3D)
 */
function openGcodedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('gcoded_storage', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('reliefs')) {
        db.createObjectStore('reliefs', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda um mapa de relevo pesado no IndexedDB
 */
async function storeReliefInDB(id, reliefData) {
  try {
    const db = await openGcodedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reliefs', 'readwrite');
      const store = tx.objectStore('reliefs');
      store.put({ id, ...reliefData });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB store error:", err);
  }
}

/**
 * Obtém dados de relevo do IndexedDB
 */
async function getReliefFromDB(id) {
  try {
    const db = await openGcodedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reliefs', 'readonly');
      const store = tx.objectStore('reliefs');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB fetch error:", err);
    return null;
  }
}

/**
 * Remove dados antigos de relevos do IndexedDB que já não estejam no canvas
 */
async function cleanReliefsDB(activeIds) {
  try {
    const db = await openGcodedDB();
    const tx = db.transaction('reliefs', 'readwrite');
    const store = tx.objectStore('reliefs');
    const getAllKeysReq = store.getAllKeys();
    getAllKeysReq.onsuccess = () => {
      const keys = getAllKeysReq.result;
      keys.forEach(k => {
        if (!activeIds.includes(k)) store.delete(k);
      });
    };
  } catch (err) {
    console.warn("IndexedDB clean error:", err);
  }
}

/**
 * Persiste o estado completo de forma fiável (parâmetros no localStorage + relevo em IndexedDB)
 */
async function saveAppState() {
  if (!canvas || isRestoringState) return;

  const rawObjects = canvas.getObjects().filter(obj => !obj.isVisualPath && !obj.isOriginMarker);
  const activeReliefIds = [];

  // Recolher metadados e persistir mapas Float32Array no IndexedDB
  const reliefMetadata = [];
  for (let idx = 0; idx < rawObjects.length; idx++) {
    const obj = rawObjects[idx];
    if (obj.isReliefImage) {
      if (!obj.reliefId) obj.reliefId = 'relief_' + Date.now() + '_' + idx;
      activeReliefIds.push(obj.reliefId);

      // Guardar mapa e definições no IndexedDB (converter Float32Array para Array normal para compatibilidade total de clonagem estruturada)
      const depthArray = obj.reliefDepthMap ? Array.from(obj.reliefDepthMap) : null;
      await storeReliefInDB(obj.reliefId, {
        reliefSettings: obj.reliefSettings,
        reliefDepthMap: depthArray,
        reliefDepthWidth: obj.reliefDepthWidth,
        reliefDepthHeight: obj.reliefDepthHeight,
        reliefSrc: obj.reliefSrc
      });

      reliefMetadata.push({
        reliefId: obj.reliefId,
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        width: obj.width,
        height: obj.height
      });
    }
  }

  // Limpar relevos apagados do IndexedDB
  cleanReliefsDB(activeReliefIds);

  // Serialização limpa dos desenhos vectoriais normais sem fugas de memória
  const vectorObjects = rawObjects.filter(obj => !obj.isReliefImage);
  const canvasJsonData = {
    objects: vectorObjects.map(obj => obj.toObject(['selectable', 'evented', 'stroke', 'strokeWidth']))
  };

  const appState = {
    version: "0.4.2",
    lastModified: new Date().toLocaleString(),
    canvasData: canvasJsonData,
    reliefs: reliefMetadata,
    cncParams: {
      toolDia: parseFloat(inputToolDia.value),
      safeZ: parseFloat(inputSafeZ.value),
      feedXY: parseFloat(inputFeedXY.value),
      feedZ: parseFloat(inputFeedZ.value),
      depthTotal: parseFloat(inputDepthTotal.value),
      depthPass: parseFloat(inputDepthPass.value),
      strategy: selectStrategy.value,
      toolType: paramToolType ? paramToolType.value : 'flat',
      stepover: inputStepover ? parseFloat(inputStepover.value) : 40,
      useArcs: paramUseArcs ? paramUseArcs.checked : true,
      useTabs: paramUseTabs ? paramUseTabs.checked : false,
      tabCount: paramTabCount ? parseInt(paramTabCount.value, 10) : 4,
      tabWidth: paramTabWidth ? parseFloat(paramTabWidth.value) : 5.0,
      tabHeight: paramTabHeight ? parseFloat(paramTabHeight.value) : 1.5,
      useDogbone: paramUseDogbone ? paramUseDogbone.checked : false,
      dogboneType: paramDogboneType ? paramDogboneType.value : 'dogbone',
      useRamping: paramUseRamping ? paramUseRamping.checked : false,
      rampAngle: paramRampAngle ? parseFloat(paramRampAngle.value) || 10 : 10,
      rampMaxLen: paramRampMaxLen ? parseFloat(paramRampMaxLen.value) || 30 : 30,
      tableX: parseFloat(inputTableX.value),
      tableY: parseFloat(inputTableY.value),
      materialZ: parseFloat(inputMaterialZ.value),
      originType: selectOriginType.value,
      wcsX: parseFloat(inputWcsX.value),
      wcsY: parseFloat(inputWcsY.value),
      activeToolId: selectToolLibrary ? selectToolLibrary.value : 'flat-6000',
      spindleSpeed: parseFloat(inputSpindleSpeed.value) || 18000
    }
  };

  try {
    localStorage.setItem('gcoded_settings', JSON.stringify(appState));
  } catch (err) {
    console.error("Erro ao persistir estado no localStorage:", err);
  }
}

/**
 * Restaura o estado a partir do localStorage e IndexedDB
 */
async function loadAppState() {
  try {
    isRestoringState = true;
    const data = localStorage.getItem('gcoded_settings');
    if (!data) return;

    const appState = JSON.parse(data);
    
    // 1. Restaurar Parâmetros CAM e Mesa
    if (appState.cncParams) {
      const p = appState.cncParams;
      inputToolDia.value = p.toolDia || 3.175;
      inputSafeZ.value = p.safeZ || 5.0;
      inputFeedXY.value = p.feedXY || 1400;
      inputFeedZ.value = p.feedZ || 400;
      inputDepthTotal.value = p.depthTotal || -3.0;
      inputDepthPass.value = p.depthPass || 1.0;
      selectStrategy.value = p.strategy || 'on';
      inputTableX.value = p.tableX || 500;
      inputTableY.value = p.tableY || 500;
      inputMaterialZ.value = p.materialZ || 10.0;
      selectOriginType.value = p.originType || 'bottom-left';
      inputWcsX.value = p.wcsX !== undefined ? p.wcsX : 0.0;
      inputWcsY.value = p.wcsY !== undefined ? p.wcsY : 0.0;
      
      if (p.toolType && paramToolType) paramToolType.value = p.toolType;
      if (p.stepover !== undefined && inputStepover) inputStepover.value = p.stepover;
      if (p.useArcs !== undefined && paramUseArcs) paramUseArcs.checked = p.useArcs;
      if (p.useTabs !== undefined && paramUseTabs) {
        paramUseTabs.checked = p.useTabs;
        if (tabsSettingsGrid) {
          tabsSettingsGrid.style.opacity = p.useTabs ? '1' : '0.45';
          tabsSettingsGrid.style.pointerEvents = p.useTabs ? 'auto' : 'none';
        }
      }
      if (p.tabCount !== undefined && paramTabCount) paramTabCount.value = p.tabCount;
      if (p.tabWidth !== undefined && paramTabWidth) paramTabWidth.value = p.tabWidth;
      if (p.tabHeight !== undefined && paramTabHeight) paramTabHeight.value = p.tabHeight;
      if (p.useDogbone !== undefined && paramUseDogbone) {
        paramUseDogbone.checked = p.useDogbone;
        if (dogboneSettingsGrid) {
          dogboneSettingsGrid.style.opacity = p.useDogbone ? '1' : '0.45';
          dogboneSettingsGrid.style.pointerEvents = p.useDogbone ? 'auto' : 'none';
        }
      }
      if (p.dogboneType && paramDogboneType) paramDogboneType.value = p.dogboneType;
      if (p.useRamping !== undefined && paramUseRamping) {
        paramUseRamping.checked = p.useRamping;
        if (rampingSettingsGrid) {
          rampingSettingsGrid.style.opacity = p.useRamping ? '1' : '0.45';
          rampingSettingsGrid.style.pointerEvents = p.useRamping ? 'auto' : 'none';
        }
      }
      if (p.rampAngle !== undefined && paramRampAngle) paramRampAngle.value = p.rampAngle;
      if (p.rampMaxLen !== undefined && paramRampMaxLen) paramRampMaxLen.value = p.rampMaxLen;
      if (p.spindleSpeed !== undefined && inputSpindleSpeed) inputSpindleSpeed.value = p.spindleSpeed;
      
      if (p.activeToolId && selectToolLibrary) {
        selectToolLibrary.value = p.activeToolId;
      }
      
      setWCSInputsReadonly(selectOriginType.value !== 'custom');
      updateTableSize();
    }

    // 2. Restaurar Desenhos Vectoriais
    if (appState.canvasData && appState.canvasData.objects && appState.canvasData.objects.length > 0) {
      await new Promise((res) => {
        canvas.loadFromJSON(appState.canvasData, function() {
          canvas.forEachObject(obj => {
            obj.selectable = true;
            obj.evented = true;
          });
          canvas.requestRenderAll();
          res();
        });
      });
    }

    // 3. Restaurar Objectos de Relevo 3D do IndexedDB
    if (appState.reliefs && Array.isArray(appState.reliefs)) {
      for (const meta of appState.reliefs) {
        const dbData = await getReliefFromDB(meta.reliefId);
        if (dbData && dbData.reliefSrc) {
          await new Promise((res) => {
            fabric.Image.fromURL(dbData.reliefSrc, (fabricImg) => {
              fabricImg.set({
                left: meta.left,
                top: meta.top,
                scaleX: meta.scaleX,
                scaleY: meta.scaleY,
                originX: 'left',
                originY: 'top',
                opacity: 0.9,
                borderColor: '#8b5cf6',
                cornerColor: '#8b5cf6'
              });

              fabricImg.isReliefImage = true;
              fabricImg.reliefId = meta.reliefId;
              fabricImg.reliefSettings = dbData.reliefSettings;
              fabricImg.reliefDepthMap = dbData.reliefDepthMap ? new Float32Array(dbData.reliefDepthMap) : null;
              fabricImg.reliefDepthWidth = dbData.reliefDepthWidth;
              fabricImg.reliefDepthHeight = dbData.reliefDepthHeight;
              fabricImg.reliefSrc = dbData.reliefSrc;

              const nativeImg = new Image();
              nativeImg.src = dbData.reliefSrc;
              fabricImg.reliefImgEl = nativeImg;

              canvas.add(fabricImg);
              canvas.requestRenderAll();
              res();
            });
          });
        }
      }
    }
  } catch (err) {
    console.error("Erro ao restaurar o estado:", err);
  } finally {
    isRestoringState = false;
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

/**
 * Configura suporte PWA (Progressive Web App), instalação nativa e Service Worker offline
 */
function setupPWAInstall() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isStandalone) {
    if (btnInstallApp) {
      btnInstallApp.classList.add('installed');
      btnInstallApp.innerHTML = '<span class="icon">✅</span> <span class="install-text">Instalado</span>';
      btnInstallApp.title = 'O Gcoded já está a ser executado como aplicação instalada (100% offline)';
    }
    if (btnModalInstallAction) {
      btnModalInstallAction.innerHTML = '✅ Aplicação Já Instalada';
      btnModalInstallAction.disabled = true;
      btnModalInstallAction.style.opacity = '0.75';
    }
  }

  // Capturar evento de instalação nativa do browser (Chrome, Edge, Samsung, etc.)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    if (btnInstallApp && !isStandalone) {
      btnInstallApp.classList.add('pulse');
      btnInstallApp.innerHTML = '<span class="icon">📲</span> <span class="install-text">Instalar App</span>';
      btnInstallApp.title = 'Instalar o Gcoded no teu computador ou telemóvel';
    }
  });

  // Notificação após a instalação bem-sucedida
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (btnInstallApp) {
      btnInstallApp.classList.remove('pulse');
      btnInstallApp.classList.add('installed');
      btnInstallApp.innerHTML = '<span class="icon">✅</span> <span class="install-text">Instalado</span>';
      btnInstallApp.title = 'Gcoded instalado com sucesso!';
    }
    showCamToast('🎉 Gcoded instalado com sucesso no teu dispositivo!');
    if (installModal) installModal.style.display = 'none';
  });

  const openInstallModal = () => {
    if (installModal) installModal.style.display = 'flex';
  };

  const closeInstallModal = () => {
    if (installModal) installModal.style.display = 'none';
  };

  // Botão de Instalar na Barra Superior
  if (btnInstallApp) {
    btnInstallApp.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            console.log('[Gcoded PWA] Instalação aceite pelo utilizador.');
            deferredInstallPrompt = null;
            closeInstallModal();
          } else {
            console.log('[Gcoded PWA] Instalação cancelada pelo utilizador.');
          }
        } catch (err) {
          console.warn('[Gcoded PWA] Erro ao disparar prompt:', err);
          openInstallModal();
        }
      } else {
        openInstallModal();
      }
    });
  }

  // Ação CTA dentro do Modal
  if (btnModalInstallAction) {
    btnModalInstallAction.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            deferredInstallPrompt = null;
            closeInstallModal();
          }
        } catch (err) {
          console.warn('[Gcoded PWA] Erro ao disparar prompt modal:', err);
        }
      } else {
        const standaloneNow = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (standaloneNow) {
          showCamToast('✅ O Gcoded já se encontra instalado no teu sistema!');
        } else {
          showCamToast('💡 Segue as instruções abaixo para o teu navegador/sistema');
        }
      }
    });
  }

  // Controlos de fecho do Modal de Instalação
  if (btnCloseInstall) btnCloseInstall.addEventListener('click', closeInstallModal);
  if (btnCloseInstallFooter) btnCloseInstallFooter.addEventListener('click', closeInstallModal);
  if (installModal) {
    installModal.addEventListener('click', (e) => {
      if (e.target === installModal) closeInstallModal();
    });
  }

  // Fechar com tecla Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && installModal && installModal.style.display === 'flex') {
      closeInstallModal();
    }
  });

  // Registar o Service Worker para cache 100% offline
  registerServiceWorker();
}

/**
 * Regista o Service Worker para persistência de ficheiros e funcionamento offline
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[Gcoded SW] Service Worker registado com âmbito:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Gcoded SW] Registo de Service Worker falhou:', err);
        });
    });
  }
}

// Iniciar imediatamente se o DOM já estiver pronto, ou aguardar DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

