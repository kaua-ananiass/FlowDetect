const tauriCore = window.__TAURI__?.core ?? null;
const tauriEvent = window.__TAURI__?.event ?? null;
const tauriDialog = window.__TAURI__?.dialog ?? null;
window.__GENERATOR_MAIN_READY = true;

async function invoke(command, payload) {
  if (typeof tauriCore?.invoke !== "function") {
    throw new Error("API do Tauri indisponivel na interface do gerador.");
  }
  return tauriCore.invoke(command, payload);
}

async function safeListen(eventName, handler) {
  if (typeof tauriEvent?.listen !== "function") {
    return null;
  }

  try {
    return await tauriEvent.listen(eventName, handler);
  } catch (error) {
    console.warn(`Nao foi possivel registrar o evento ${eventName}.`, error);
    return null;
  }
}

async function openNativeFileDialog(options = {}) {
  if (typeof tauriDialog?.open !== "function") {
    throw new Error("Seletor de arquivos indisponivel na interface atual.");
  }
  return tauriDialog.open(options);
}

async function saveNativeFileDialog(options = {}) {
  if (typeof tauriDialog?.save !== "function") {
    throw new Error("Janela nativa para salvar arquivo indisponivel na interface atual.");
  }
  return tauriDialog.save(options);
}

if (!window.__FLOWDETECT_DESIGN_SYSTEM__) {
const state = {
  roadmap: null,
  workbook: null,
  workbookPreview: null,
  workbookExternalEditOpenedAt: 0,
  smartRecorder: {
    running: false,
    events: [],
    previews: {},
    pendingClickId: null,
    pollTimer: null,
  },
  activeTab: "launcher",
  remoteControl: {
    address: "127.0.0.1:18452",
    meshUrl: "",
    meshFrameUrl: "",
    meshPath: "",
    meshRunning: false,
    meshStarting: false,
    screenStreaming: false,
    screenStreamTimer: null,
    screenSnapshotUrl: "",
    screenSnapshotAt: 0,
    screenSnapshotLoading: false,
    webrtcPeer: null,
    webrtcSessionId: "",
    webrtcActive: false,
    webrtcControlChannel: null,
    webrtcAnswerTimer: null,
    remotePointerInside: false,
    connected: false,
    agentLabel: "Aguardando conexao",
    activeView: "execution",
    library: [],
    selectedId: "",
    roadmap: null,
    currentSequence: "principal",
    currentOrder: null,
    detailOpenOrder: null,
    lastCenteredOrder: null,
    running: false,
    pollTimer: null,
    statusRefreshing: false,
    sheetRefreshing: false,
    lastSheetRefreshAt: 0,
    lastStatusSignature: "",
    logs: [],
    spreadsheetPreview: {
      available: false,
      message: "A planilha preenchida pelo Agent vai aparecer aqui.",
      workbook_id: "",
      sheet: "",
      headers: [],
      rows: [],
      write_columns: [],
    },
    editableTextOverrides: {},
    progress: {
      percent: 0,
      description: "A execucao remota vai aparecer aqui.",
      company: "",
      sequence: "principal",
      order: 0,
    },
  },
  commandMapZoom: 0.96,
  commandMapRequestedZoom: 0.96,
  commandMapChromeCollapsed: true,
  commandMapPageSequence: "principal",
  commandMapPageSequenceLock: null,
  commandMapFocusOrder: null,
  commandMapOrderCache: [],
  commandMapAutoFitFrame: 0,
  commandConnectorLayoutFrame: 0,
  commandMapSave: {
    running: false,
    percent: 0,
    status: "Mapa ainda nao salvo.",
    dirty: false,
  },
  commandMapDrafts: {},
  assist: {
    mode: "idle",
    current: 0,
    total: 0,
    percent: 0,
    description: "",
    company: "",
    windowTitle: "",
    currentOrder: null,
    success: null,
    logs: [],
  },
  assistControlTab: "target",
  editableTextOverrides: {},
  assistTarget: {
    enabled: false,
    status: "idle",
    title: "",
    className: "",
    hwnd: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    pid: 0,
    modalOpen: false,
    loading: false,
    windows: [],
    lastSeenAt: 0,
  },
  recognitionWindowCatalog: [],
  assistPlayback: {
    running: false,
    timer: null,
    token: 0,
    mode: "idle",
  },
  login: {
    authenticated: false,
    profile: null,
    resolution: null,
    activationKey: "",
    activationId: "",
    expiresAt: "",
    step: "admin",
    users: [],
    selectedUser: null,
  },
  executionWindowMode: "normal",
  testLaunchPending: false,
  insertPanel: null,
  captureTarget: null,
  captureBlurTimer: null,
  captureSequence: 0,
  imageImportTarget: null,
  draggingOrder: null,
  draggingClientKey: "",
  pendingDrag: null,
  dragTargetIndex: null,
  dragPointerId: null,
  dragPreviewEl: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragClientX: 0,
  dragClientY: 0,
  dragMoveFrame: 0,
  dragSegments: [],
  dragDropZones: [],
  dragThresholds: [],
  dragContainerRect: null,
  dragPlaceholderWidth: 0,
  dragPlaceholderHeight: 0,
  recognitionTreeTabs: {},
  spreadsheetTreeTabs: {},
  recognitionTestStatus: {},
  recognitionPreviewCache: {},
  expandedTreeCardOrder: null,
  expandedTreeCardOrigin: null,
  workbookSearch: "",
  composerWorkbookId: "",
  previewWorkbookId: "",
  workbookSelectedSheet: "",
  workbookSelectedColumn: "",
  workbookSelectedCell: null,
  testLoopData: null,
  library: {
    items: [],
    activeId: "",
    categories: [],
    search: "",
    category: "",
    createdFrom: "",
    updatedFrom: "",
    sort: "updated_desc",
    createOpen: false,
    createDraft: {
      nome: "",
      categoria: "",
      descricao: "",
    },
    editingId: "",
    editDraft: {
      nome: "",
      categoria: "",
      descricao: "",
    },
    filtersOpen: false,
    dirty: false,
  },
  systemDiagnostics: {
    loading: true,
    fixing: false,
    data: null,
    error: "",
  },
  renderDirty: {
    commandMap: true,
    assist: true,
    workbook: true,
  },
};

try {
  state.remoteControl.meshUrl = localStorage.getItem("flowdetect_meshcentral_url") || "";
  state.remoteControl.meshPath = localStorage.getItem("flowdetect_meshcentral_agent_path") || "";
} catch (error) {
  console.warn("Nao foi possivel carregar a URL do MeshCentral.", error);
}

let commandMapClientKeySequence = 0;
let assistTargetPollTimer = 0;
let assistWindowPickerRequestId = 0;
let assistTargetValidationPending = false;
let loginSubmitInFlight = false;
let studioTutorialActiveIndex = 0;
let studioTutorialOpen = false;
let studioTutorialAutoStartTimer = 0;
let studioTutorialPositionFrame = 0;
let workspaceRenderTimer = 0;
const DEV_ADMIN_CONFIG = Object.freeze({
  enabled: true,
  displayName: "Usuario local",
  email: "local@flowdetect.app",
  password: "flow123",
});

const builderShell = document.querySelector(".builder-shell");
const loginOverlay = document.getElementById("loginOverlay");
const loginTitleText = document.getElementById("loginTitleText");
const loginStepBadgeDiagnostics = document.getElementById("loginStepBadgeDiagnostics");
const loginStepBadgeActivation = document.getElementById("loginStepBadgeActivation");
const loginStepBadgeUsers = document.getElementById("loginStepBadgeUsers");
const loginStepBadgeCredentials = document.getElementById("loginStepBadgeCredentials");
const loginModeBadge = document.getElementById("loginModeBadge");
const loginActivationSummary = document.getElementById("loginActivationSummary");
const loginDevAdminQuickButton = document.getElementById("loginDevAdminQuickButton");
const loginActivationKeyInput = document.getElementById("loginActivationKeyInput");
const loginStepDiagnostics = document.getElementById("loginStepDiagnostics");
const loginStepActivation = document.getElementById("loginStepActivation");
const loginStepDevAdmin = document.getElementById("loginStepDevAdmin");
const loginStepUsers = document.getElementById("loginStepUsers");
const loginStepCredentials = document.getElementById("loginStepCredentials");
const loginStepRegister = document.getElementById("loginStepRegister");
const loginUsersList = document.getElementById("loginUsersList");
const loginContinueKeyButton = document.getElementById("loginContinueKeyButton");
const loginChooseUserButton = document.getElementById("loginChooseUserButton");
const loginCreateUserButton = document.getElementById("loginCreateUserButton");
const loginBackToUsersButton = document.getElementById("loginBackToUsersButton");
const loginBackToActivationButton = document.getElementById("loginBackToActivationButton");
const loginSelectedUserSummary = document.getElementById("loginSelectedUserSummary");
const loginDisplayNameInput = document.getElementById("loginDisplayNameInput");
const loginResetActivationButton = document.getElementById("loginResetActivationButton");
const loginEmailInput = document.getElementById("loginEmailInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginRegisterPasswordInput = document.getElementById("loginRegisterPasswordInput");
const loginPasswordConfirmInput = document.getElementById("loginPasswordConfirmInput");
const loginSubmitButton = document.getElementById("loginSubmitButton");
const loginRegisterSubmitButton = document.getElementById("loginRegisterSubmitButton");
const loginResolutionPreview = document.getElementById("loginResolutionPreview");
const loginErrorText = document.getElementById("loginErrorText");
const loginContinueDiagnosticsButton = document.getElementById("loginContinueDiagnosticsButton");
const devAdminPanel = document.getElementById("devAdminPanel");
const devAdminEmailInput = document.getElementById("devAdminEmailInput");
const devAdminPasswordInput = document.getElementById("devAdminPasswordInput");
const devAdminLoginButton = document.getElementById("devAdminLoginButton");
const loginBackFromDevAdminButton = document.getElementById("loginBackFromDevAdminButton");
const timelineList = document.getElementById("timelineList");
const commandMapList = document.getElementById("commandMapList");
const messageBar = document.getElementById("messageBar");
const timelineMeta = document.getElementById("timelineMeta");
const commandMapMeta = document.getElementById("commandMapMeta");
const commandMapStepBadge = document.getElementById("commandMapStepBadge");
const commandMapPageTabs = document.getElementById("commandMapPageTabs");
const commandMapPageModeSelect = document.getElementById("commandMapPageModeSelect");
const commandMapPageAfterLoopSelect = document.getElementById("commandMapPageAfterLoopSelect");
const commandMapPageModeHint = document.getElementById("commandMapPageModeHint");
const builderStatus = document.getElementById("builderStatus");
const totalBlocks = document.getElementById("totalBlocks");
const textBlocks = document.getElementById("textBlocks");
const keyBlocks = document.getElementById("keyBlocks");
const spreadsheetBlocks = document.getElementById("spreadsheetBlocks");
const exportNameInput = document.getElementById("exportNameInput");
const testDelayInput = document.getElementById("testDelayInput");
const testLoopStartInput = document.getElementById("testLoopStartInput");
const testLoopHint = document.getElementById("testLoopHint");
const bulkDelayInput = document.getElementById("bulkDelayInput");
const applyBulkDelayButton = document.getElementById("applyBulkDelayButton");
const mapBulkDelayInput = document.getElementById("mapBulkDelayInput");
const mapApplyBulkDelayButton = document.getElementById("mapApplyBulkDelayButton");
const mapSaveButton = document.getElementById("mapSaveButton");
const mapSavePercent = document.getElementById("mapSavePercent");
const mapSaveFill = document.getElementById("mapSaveFill");
const mapSaveStatus = document.getElementById("mapSaveStatus");
const testOnceButton = document.getElementById("testOnceButton");
const stopTestButton = document.getElementById("stopTestButton");
const testWindowModeSelect = document.getElementById("testWindowModeSelect");
const assistTabButton = document.getElementById("assistTabButton");
const captureOverlay = document.getElementById("captureOverlay");
const captureOverlayText = document.getElementById("captureOverlayText");
const cancelCaptureButton = document.getElementById("cancelCaptureButton");
const editorTabButton = document.getElementById("editorTabButton");
const commandTabButton = document.getElementById("commandTabButton");
const workbookTabButton = document.getElementById("workbookTabButton");
const launcherTabButton = document.getElementById("launcherTabButton");
const remoteControlTabButton = document.getElementById("remoteControlTabButton");
const agentScreenTabButton = document.getElementById("agentScreenTabButton");
const smartRecorderTabButton = document.getElementById("smartRecorderTabButton");
const sessionChip = document.getElementById("sessionChip");
const tutorialReplayButton = document.getElementById("tutorialReplayButton");
const studioTutorialOverlay = document.getElementById("studioTutorialOverlay");
const studioTutorialSpotlight = document.getElementById("studioTutorialSpotlight");
const studioTutorialCard = document.getElementById("studioTutorialCard");
const studioTutorialStepText = document.getElementById("studioTutorialStepText");
const studioTutorialTitle = document.getElementById("studioTutorialTitle");
const studioTutorialText = document.getElementById("studioTutorialText");
const studioTutorialExtra = document.getElementById("studioTutorialExtra");
const studioTutorialPrevButton = document.getElementById("studioTutorialPrevButton");
const studioTutorialNextButton = document.getElementById("studioTutorialNextButton");
const studioTutorialSkipButton = document.getElementById("studioTutorialSkipButton");
const launcherPanel = document.getElementById("launcherPanel");
const editorPanel = document.getElementById("editorPanel");
const assistPanel = document.getElementById("assistPanel");
const assistShell = assistPanel?.querySelector(".assist-shell");
const commandsPanel = document.getElementById("commandsPanel");
const commandMapShell = commandsPanel?.querySelector(".command-map-shell");
const mapPrevButton = document.getElementById("mapPrevButton");
const mapNextButton = document.getElementById("mapNextButton");
const workbookPanel = document.getElementById("workbookPanel");
const remoteControlPanel = document.getElementById("remoteControlPanel");
const agentScreenPanel = document.getElementById("agentScreenPanel");
const smartRecorderPanel = document.getElementById("smartRecorderPanel");
const studioControlHint = document.getElementById("studioControlHint");
const studioControlStatus = document.getElementById("studioControlStatus");
const studioControlAddressInput = document.getElementById("studioControlAddressInput");
const studioControlConnectButton = document.getElementById("studioControlConnectButton");
const studioControlRefreshButton = document.getElementById("studioControlRefreshButton");
const studioControlAgentLabel = document.getElementById("studioControlAgentLabel");
const studioControlMeta = document.getElementById("studioControlMeta");
const studioControlImportButton = document.getElementById("studioControlImportButton");
const studioControlZipInput = document.getElementById("studioControlZipInput");
const studioControlAgentWindowMode = document.getElementById("studioControlAgentWindowMode");
const studioControlLoopStartInput = document.getElementById("studioControlLoopStartInput");
const studioControlCompanyStartInput = document.getElementById("studioControlCompanyStartInput");
const studioControlRunButton = document.getElementById("studioControlRunButton");
const studioControlStopButton = document.getElementById("studioControlStopButton");
const studioControlEditableTextPanel = document.getElementById("studioControlEditableTextPanel");
const studioControlEditableTextList = document.getElementById("studioControlEditableTextList");
const studioControlViewButtons = Array.from(document.querySelectorAll("[data-studio-control-view]"));
const studioControlViewPanels = Array.from(document.querySelectorAll("[data-studio-control-panel]"));
const studioControlEmpty = document.getElementById("studioControlEmpty");
const studioControlList = document.getElementById("studioControlList");
const studioControlSelectedTitle = document.getElementById("studioControlSelectedTitle");
const studioControlProgressPercent = document.getElementById("studioControlProgressPercent");
const studioControlProgressFill = document.getElementById("studioControlProgressFill");
const studioControlProgressText = document.getElementById("studioControlProgressText");
const studioControlCompanyText = document.getElementById("studioControlCompanyText");
const studioControlPageText = document.getElementById("studioControlPageText");
const studioControlBlockText = document.getElementById("studioControlBlockText");
const studioControlPrevBlockButton = document.getElementById("studioControlPrevBlockButton");
const studioControlNextBlockButton = document.getElementById("studioControlNextBlockButton");
const studioControlPageChips = document.getElementById("studioControlPageChips");
const studioControlFlowList = document.getElementById("studioControlFlowList");
const studioControlLogList = document.getElementById("studioControlLogList");
const studioControlSheetRefreshButton = document.getElementById("studioControlSheetRefreshButton");
const studioControlSheetTitle = document.getElementById("studioControlSheetTitle");
const studioControlSheetMeta = document.getElementById("studioControlSheetMeta");
const studioControlSheetStatus = document.getElementById("studioControlSheetStatus");
const studioControlSheetTableWrap = document.getElementById("studioControlSheetTableWrap");
const studioControlMeshUrlInput = document.getElementById("studioControlMeshUrlInput");
const studioControlMeshPathInput = document.getElementById("studioControlMeshPathInput");
const studioControlMeshStartButton = document.getElementById("studioControlMeshStartButton");
const studioControlMeshLoadButton = document.getElementById("studioControlMeshLoadButton");
const studioControlMeshEmbedButton = document.getElementById("studioControlMeshEmbedButton");
const studioControlMeshOpenButton = document.getElementById("studioControlMeshOpenButton");
const studioControlMeshClearButton = document.getElementById("studioControlMeshClearButton");
const studioControlMeshFrame = document.getElementById("studioControlMeshFrame");
const studioControlScreenVideo = document.getElementById("studioControlScreenVideo");
const studioControlScreenImage = document.getElementById("studioControlScreenImage");
const studioControlScreenStatus = document.getElementById("studioControlScreenStatus");
const mapZoomOutButton = document.getElementById("mapZoomOutButton");
const mapZoomInButton = document.getElementById("mapZoomInButton");
const mapZoomRange = document.getElementById("mapZoomRange");
const mapZoomValue = document.getElementById("mapZoomValue");
const commandMapChromeToggleButton = document.getElementById("commandMapChromeToggleButton");
const assistDelayInput = document.getElementById("assistDelayInput");
const assistLoopStartInput = document.getElementById("assistLoopStartInput");
const assistWindowModeSelect = document.getElementById("assistWindowModeSelect");
const assistQuickButton = document.getElementById("assistQuickButton");
const assistStopButton = document.getElementById("assistStopButton");
const assistStatusText = document.getElementById("assistStatusText");
const assistDetailText = document.getElementById("assistDetailText");
const assistOriginText = document.getElementById("assistOriginText");
const assistWindowText = document.getElementById("assistWindowText");
const assistWindowDetailText = document.getElementById("assistWindowDetailText");
const assistCompanyText = document.getElementById("assistCompanyText");
const assistModeText = document.getElementById("assistModeText");
const assistPercentText = document.getElementById("assistPercentText");
const assistProgressFill = document.getElementById("assistProgressFill");
const assistProgressMeta = document.getElementById("assistProgressMeta");
const assistMapList = document.getElementById("assistMapList");
const assistLogList = document.getElementById("assistLogList");
const assistControlTabs = document.getElementById("assistControlTabs");
const assistInitialSequenceSelect = document.getElementById("assistInitialSequenceSelect");
const assistSequenceModeList = document.getElementById("assistSequenceModeList");
const assistEditableTextList = document.getElementById("assistEditableTextList");
const assistTargetTitle = document.getElementById("assistTargetTitle");
const assistTargetDetailText = document.getElementById("assistTargetDetailText");
const assistTargetStatusChip = document.getElementById("assistTargetStatusChip");
const assistTargetMetaText = document.getElementById("assistTargetMetaText");
const assistSelectWindowButton = document.getElementById("assistSelectWindowButton");
const assistClearWindowButton = document.getElementById("assistClearWindowButton");
const assistWindowPickerOverlay = document.getElementById("assistWindowPickerOverlay");
const assistWindowPickerList = document.getElementById("assistWindowPickerList");
const assistWindowPickerStatus = document.getElementById("assistWindowPickerStatus");
const assistWindowPickerCloseButton = document.getElementById("assistWindowPickerCloseButton");
const assistWindowPickerRefreshButton = document.getElementById("assistWindowPickerRefreshButton");
const workbookMeta = document.getElementById("workbookMeta");
const workbookFilesTabs = document.getElementById("workbookFilesTabs");
const addWorkbookButton = document.getElementById("addWorkbookButton");
const openWorkbookButton = document.getElementById("openWorkbookButton");
const deleteWorkbookButton = document.getElementById("deleteWorkbookButton");
const workbookFileInput = document.getElementById("workbookFileInput");
const imageFileInput = document.getElementById("imageFileInput");
const automationZipFileInput = document.getElementById("automationZipFileInput");
const workbookSheetSelect = document.getElementById("workbookSheetSelect");
const workbookSearchInput = document.getElementById("workbookSearchInput");
const workbookRowsInfo = document.getElementById("workbookRowsInfo");
const smartRecorderStartButton = document.getElementById("smartRecorderStartButton");
const smartRecorderStopButton = document.getElementById("smartRecorderStopButton");
const smartRecorderSendButton = document.getElementById("smartRecorderSendButton");
const smartRecorderStatus = document.getElementById("smartRecorderStatus");
const smartRecorderCount = document.getElementById("smartRecorderCount");
const smartRecorderTrack = document.getElementById("smartRecorderTrack");
const workbookTableWrap = document.getElementById("workbookTableWrap");
const workbookSelectedValueBlock = document.getElementById("workbookSelectedValueBlock");
const selectedWorkbookStatus = document.getElementById("selectedWorkbookStatus");
const selectedWorkbookTitle = document.getElementById("selectedWorkbookTitle");
const selectedWorkbookSubtitle = document.getElementById("selectedWorkbookSubtitle");
const selectedWorkbookValue = document.getElementById("selectedWorkbookValue");
const workbookSelectedColumnBlock = document.getElementById("workbookSelectedColumnBlock");
const selectedWorkbookColumnStatus = document.getElementById("selectedWorkbookColumnStatus");
const selectedWorkbookColumnTitle = document.getElementById("selectedWorkbookColumnTitle");
const selectedWorkbookColumnSubtitle = document.getElementById("selectedWorkbookColumnSubtitle");
const selectedWorkbookColumnPreview = document.getElementById("selectedWorkbookColumnPreview");
const workbookTextDelay = document.getElementById("workbookTextDelay");
const addWorkbookCellButton = document.getElementById("addWorkbookCellButton");
const workbookLoopDelay = document.getElementById("workbookLoopDelay");
const workbookAfterAction = document.getElementById("workbookAfterAction");
const workbookAfterActionCaptureButton = document.getElementById("workbookAfterActionCaptureButton");
const workbookBetweenItems = document.getElementById("workbookBetweenItems");
const addWorkbookColumnButton = document.getElementById("addWorkbookColumnButton");
const launcherList = document.getElementById("launcherList");
const launcherMeta = document.getElementById("launcherMeta");
const systemCheckPanel = document.getElementById("systemCheckPanel");
const systemCheckSummary = document.getElementById("systemCheckSummary");
const systemCheckBadge = document.getElementById("systemCheckBadge");
const systemCheckGrid = document.getElementById("systemCheckGrid");
const systemCheckFixButton = document.getElementById("systemCheckFixButton");
const systemCheckRefreshButton = document.getElementById("systemCheckRefreshButton");
const launcherSearchInput = document.getElementById("launcherSearchInput");
const launcherCategoryFilter = document.getElementById("launcherCategoryFilter");
const launcherCreatedFromInput = document.getElementById("launcherCreatedFromInput");
const launcherUpdatedFromInput = document.getElementById("launcherUpdatedFromInput");
const launcherSortInput = document.getElementById("launcherSortInput");
const launcherFiltersToggleButton = document.getElementById("launcherFiltersToggleButton");
const launcherExtraFilters = document.getElementById("launcherExtraFilters");
const newAutomationButton = document.getElementById("newAutomationButton");
const launcherCreatePanel = document.getElementById("launcherCreatePanel");
const newAutomationNameInput = document.getElementById("newAutomationNameInput");
const newAutomationCategoryInput = document.getElementById("newAutomationCategoryInput");
const newAutomationDescriptionInput = document.getElementById("newAutomationDescriptionInput");
const confirmCreateAutomationButton = document.getElementById("confirmCreateAutomationButton");
const cancelCreateAutomationButton = document.getElementById("cancelCreateAutomationButton");
const launcherCategorySuggestions = document.getElementById("launcherCategorySuggestions");

const textInput = document.getElementById("textInput");
const textDelay = document.getElementById("textDelay");
const sequenceContextInput = document.getElementById("sequenceContextInput");
const keyInput = document.getElementById("keyInput");
const keyDelay = document.getElementById("keyDelay");
const keyRepeatInput = document.getElementById("keyRepeatInput");
const mouseXInput = document.getElementById("mouseXInput");
const mouseYInput = document.getElementById("mouseYInput");
const mouseButtonInput = document.getElementById("mouseButtonInput");
const mouseClicksInput = document.getElementById("mouseClicksInput");
const captureMouseButton = document.getElementById("captureMouseButton");
const mouseDelay = document.getElementById("mouseDelay");
const imagePathInput = document.getElementById("imagePathInput");
const captureImageButton = document.getElementById("captureImageButton");
const selectImageButton = document.getElementById("selectImageButton");
const testImageRecognitionButton = document.getElementById("testImageRecognitionButton");
const openImagesFolderButton = document.getElementById("openImagesFolderButton");
const openRecognitionDiagnosticsButton = document.getElementById("openRecognitionDiagnosticsButton");
const imageTimeoutInput = document.getElementById("imageTimeoutInput");
const imageConfidenceInput = document.getElementById("imageConfidenceInput");
const imageSearchProfileInput = document.getElementById("imageSearchProfileInput");
const imageClickModeInput = document.getElementById("imageClickModeInput");
const imageFailureActionInput = document.getElementById("imageFailureActionInput");
const imageFailureBlockInput = document.getElementById("imageFailureBlockInput");
const imageFailureSequenceInput = document.getElementById("imageFailureSequenceInput");
const imageRetryCountInput = document.getElementById("imageRetryCountInput");
const imageRetryIntervalInput = document.getElementById("imageRetryIntervalInput");
const imageDelayInput = document.getElementById("imageDelayInput");
const chromeBlockNameInput = document.getElementById("chromeBlockNameInput");
const chromeHtmlInput = document.getElementById("chromeHtmlInput");
const analyzeChromeHtmlButton = document.getElementById("analyzeChromeHtmlButton");
const chromeAnalysisJsonInput = document.getElementById("chromeAnalysisJsonInput");
const chromeHtmlPreview = document.getElementById("chromeHtmlPreview");
const chromeTargetMethodInput = document.getElementById("chromeTargetMethodInput");
const chromeTargetValueInput = document.getElementById("chromeTargetValueInput");
const chromeActionTypeInput = document.getElementById("chromeActionTypeInput");
const chromeValueSourceInput = document.getElementById("chromeValueSourceInput");
const chromeActionValueInput = document.getElementById("chromeActionValueInput");
const chromeSaveAsInput = document.getElementById("chromeSaveAsInput");
const chromeTimeoutInput = document.getElementById("chromeTimeoutInput");
const chromePressAfterInput = document.getElementById("chromePressAfterInput");
const chromeSuccessActionInput = document.getElementById("chromeSuccessActionInput");
const chromeSuccessSequenceInput = document.getElementById("chromeSuccessSequenceInput");
const chromeSuccessBlockInput = document.getElementById("chromeSuccessBlockInput");
const chromeFailureActionInput = document.getElementById("chromeFailureActionInput");
const chromeFailureSequenceInput = document.getElementById("chromeFailureSequenceInput");
const chromeFailureBlockInput = document.getElementById("chromeFailureBlockInput");
const chromeRetryCountInput = document.getElementById("chromeRetryCountInput");
const chromeRetryIntervalInput = document.getElementById("chromeRetryIntervalInput");
const chromeClearBeforeInput = document.getElementById("chromeClearBeforeInput");
const chromeFallbackVisualInput = document.getElementById("chromeFallbackVisualInput");
const chromeFallbackImageInput = document.getElementById("chromeFallbackImageInput");
const selectChromeFallbackImageButton = document.getElementById("selectChromeFallbackImageButton");
const chromeDelayInput = document.getElementById("chromeDelayInput");
const addChromeHtmlButton = document.getElementById("addChromeHtmlButton");
const verifyNameInput = document.getElementById("verifyNameInput");
const verifyActiveImageInput = document.getElementById("verifyActiveImageInput");
const verifyInactiveImageInput = document.getElementById("verifyInactiveImageInput");
const selectVerifyActiveImageButton = document.getElementById("selectVerifyActiveImageButton");
const selectVerifyInactiveImageButton = document.getElementById("selectVerifyInactiveImageButton");
const verifyTimeoutInput = document.getElementById("verifyTimeoutInput");
const verifyConfidenceInput = document.getElementById("verifyConfidenceInput");
const verifyActiveActionInput = document.getElementById("verifyActiveActionInput");
const verifyActiveSequenceInput = document.getElementById("verifyActiveSequenceInput");
const verifyInactiveActionInput = document.getElementById("verifyInactiveActionInput");
const verifyInactiveSequenceInput = document.getElementById("verifyInactiveSequenceInput");
const verifyMissingActionInput = document.getElementById("verifyMissingActionInput");
const verifyMissingSequenceInput = document.getElementById("verifyMissingSequenceInput");
const verifyDelayInput = document.getElementById("verifyDelayInput");
const composerWorkbookSelect = document.getElementById("composerWorkbookSelect");
const sheetSelect = document.getElementById("sheetSelect");
const columnSelect = document.getElementById("columnSelect");
const afterActionInput = document.getElementById("afterActionInput");
const afterActionCaptureButton = document.getElementById("afterActionCaptureButton");
const betweenItemsInput = document.getElementById("betweenItemsInput");
const spreadsheetDelay = document.getElementById("spreadsheetDelay");
const addLoopStartButton = document.getElementById("addLoopStartButton");
const addLoopEndButton = document.getElementById("addLoopEndButton");

if (messageBar) {
  messageBar.textContent = "main.js carregado. Inicializando interface...";
}

window.addEventListener("error", (event) => {
  const text = `Erro de interface: ${event.message || "falha desconhecida"}`;
  if (messageBar) {
    messageBar.textContent = text;
    messageBar.classList.remove("is-success");
    messageBar.classList.add("is-error");
  }
  console.error(event.error || event.message || event);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "promessa rejeitada");
  const text = `Erro async da interface: ${reason}`;
  if (messageBar) {
    messageBar.textContent = text;
    messageBar.classList.remove("is-success");
    messageBar.classList.add("is-error");
  }
  console.error(event.reason || event);
});

function setTestExecutionState(running) {
  const active = Boolean(running);
  stopTestButton.disabled = !active;
  assistStopButton.disabled = !active;
  if (active) {
    builderStatus.textContent = "Executando automacao";
  } else if (builderStatus.textContent === "Executando automacao") {
    builderStatus.textContent = "Pronto";
  }
}

function isTestExecutionActive() {
  return !stopTestButton.disabled || !assistStopButton.disabled;
}

function hasSpreadsheetLoopBlock() {
  return (state.roadmap?.events ?? []).some((event) => event.type === "sequencia_planilha");
}

function triggerSuccessPulse(button) {
  if (!button) {
    return;
  }
  button.classList.remove("button-confirm-pulse");
  void button.offsetWidth;
  button.classList.add("button-confirm-pulse");
  window.setTimeout(() => {
    button.classList.remove("button-confirm-pulse");
  }, 1200);
}

function hasUnsavedEditorChanges() {
  return Boolean(state.library?.dirty);
}

function confirmLeaveEditorIfDirty() {
  if (!hasUnsavedEditorChanges()) {
    return true;
  }
  return window.confirm("Existem alteracoes nao salvas. Deseja continuar mesmo assim?");
}

function markWorkspaceRenderDirty(options = {}) {
  const {
    commandMap = false,
    assist = false,
    workbook = false,
  } = options;
  state.renderDirty.commandMap = state.renderDirty.commandMap || Boolean(commandMap);
  state.renderDirty.assist = state.renderDirty.assist || Boolean(assist);
  state.renderDirty.workbook = state.renderDirty.workbook || Boolean(workbook);
}

function renderActiveWorkspaceContent() {
  let renderedCommandMap = false;
  let renderedAssist = false;
  if (state.activeTab === "commands" && state.renderDirty.commandMap) {
    renderCommandMap();
    state.renderDirty.commandMap = false;
    renderedCommandMap = true;
  }

  if (state.activeTab === "assist" && state.renderDirty.assist) {
    renderAssistSequenceSettings(state.roadmap);
    renderAssistExecutionMap();
    renderAssistEditableTexts();
    state.renderDirty.assist = false;
    renderedAssist = true;
  }

  if (state.activeTab === "workbook" && state.renderDirty.workbook) {
    state.renderDirty.workbook = false;
    if (state.workbookPreview?.headers?.length || !availableWorkbooks().length) {
      renderWorkbookPreview();
    } else {
      loadWorkbookPreview().catch((error) => {
        state.renderDirty.workbook = true;
        setMessage(String(error), "error");
      });
    }
  }

  if (state.activeTab === "smart-recorder") {
    renderSmartRecorder();
  }

  if (state.activeTab === "commands") {
    scheduleCommandMapAutoFit();
    if (state.commandMapFocusOrder) {
      requestAnimationFrame(() => centerCommandMapOrder(state.commandMapFocusOrder, "auto"));
    }
  }

  if (state.activeTab === "assist" && !renderedAssist) {
    requestAnimationFrame(() => {
      if (!assistMapList) {
        return;
      }
      if (state.assist.mode === "running" && state.assist.currentOrder != null) {
        syncAssistEdgeSpacers();
        centerAssistOrder(state.assist.currentOrder, "auto");
      } else {
        centerFirstAssistOrder("auto");
      }
    });
  }

  return renderedCommandMap || renderedAssist;
}

function scheduleActiveWorkspaceRender() {
  window.clearTimeout(workspaceRenderTimer);
  workspaceRenderTimer = window.setTimeout(() => {
    renderActiveWorkspaceContent();
  }, 35);
}

function releaseInactiveWorkspaceDom(previousTab = "") {
  window.setTimeout(() => {
    if (previousTab === "commands" && state.activeTab !== "commands" && commandMapList) {
      commandMapList.innerHTML = "";
      state.renderDirty.commandMap = true;
    }
    if (previousTab === "assist" && state.activeTab !== "assist" && assistMapList) {
      assistMapList.innerHTML = "";
      state.renderDirty.assist = true;
    }
    if (previousTab === "workbook" && state.activeTab !== "workbook" && workbookTableWrap) {
      workbookTableWrap.innerHTML = "";
      state.renderDirty.workbook = true;
    }
  }, 90);
}

function setWorkspaceTab(tabName) {
  if (tabName === "editor") {
    tabName = "commands";
  }
  if (tabName === "launcher" && state.activeTab !== "launcher" && !confirmLeaveEditorIfDirty()) {
    return;
  }
  const previousTab = state.activeTab;
  state.activeTab = tabName;
  const launcherActive = tabName === "launcher";
  const editorActive = tabName === "editor";
  const assistActive = tabName === "assist";
  const commandsActive = tabName === "commands";
  const workbookActive = tabName === "workbook";
  const remoteControlActive = tabName === "remote-control";
  const agentScreenActive = tabName === "agent-screen";
  const smartRecorderActive = tabName === "smart-recorder";
  launcherTabButton.classList.toggle("is-active", launcherActive);
  editorTabButton.classList.toggle("is-active", editorActive);
  assistTabButton.classList.toggle("is-active", assistActive);
  commandTabButton.classList.toggle("is-active", commandsActive);
  workbookTabButton.classList.toggle("is-active", workbookActive);
  remoteControlTabButton?.classList.toggle("is-active", remoteControlActive);
  agentScreenTabButton?.classList.toggle("is-active", agentScreenActive);
  smartRecorderTabButton?.classList.toggle("is-active", smartRecorderActive);
  launcherPanel.classList.toggle("is-active", launcherActive);
  editorPanel.classList.toggle("is-active", editorActive);
  assistPanel.classList.toggle("is-active", assistActive);
  commandsPanel.classList.toggle("is-active", commandsActive);
  workbookPanel.classList.toggle("is-active", workbookActive);
  remoteControlPanel?.classList.toggle("is-active", remoteControlActive);
  agentScreenPanel?.classList.toggle("is-active", agentScreenActive);
  smartRecorderPanel?.classList.toggle("is-active", smartRecorderActive);
  builderShell?.classList.toggle("is-launcher-active", launcherActive);
  builderShell?.classList.toggle("is-commands-active", commandsActive);
  builderShell?.classList.toggle("is-workbook-active", workbookActive);
  builderShell?.classList.toggle("is-assist-active", assistActive);
  builderShell?.classList.toggle("is-remote-control-active", remoteControlActive);
  builderShell?.classList.toggle("is-agent-screen-active", agentScreenActive);
  builderShell?.classList.toggle("is-smart-recorder-active", smartRecorderActive);
  applyCommandMapChromeMode();
  if (agentScreenActive) {
    renderStudioControlScreen();
    refreshStudioControlMeshStatus({ silent: true }).catch(() => null);
  }
  scheduleActiveWorkspaceRender();
  releaseInactiveWorkspaceDom(previousTab);
}

const STUDIO_TUTORIAL_STORAGE_KEY = "flowdetect_studio_tutorial_seen_v1";
const STUDIO_TUTORIAL_STEPS = Object.freeze([
  {
    tab: "launcher",
    target: "#launcherTabButton",
    title: "Launcher de Automacoes",
    text: "Aqui voce cria, importa, organiza e abre suas automacoes salvas.",
  },
  {
    tab: "commands",
    target: "#commandMapList",
    title: "Mapa dos comandos",
    text: "Monte o fluxo em blocos, conecte caminhos e defina o que acontece em cada etapa.",
  },
  {
    tab: "commands",
    target: "#commandMapList",
    title: "Criar um bloco",
    text: "Para criar, clique em uma opcao de bloco no mapa ou use os botoes de inserir antes/depois em um card existente.",
    extra: [
      "Texto",
      "Tecla",
      "Reconhecimento",
      "Planilha",
    ],
  },
  {
    tab: "assist",
    target: "#assistTabButton",
    title: "Execucao assistida",
    text: "Teste a automacao e acompanhe os blocos avancando em tempo real.",
  },
  {
    tab: "assist",
    target: "#assistControlTabs",
    title: "Controles da execucao",
    text: "Escolha janela alvo, pagina inicial, loops e textos editaveis antes de executar.",
  },
  {
    tab: "workbook",
    target: "#workbookTabButton",
    title: "Planilha e dados",
    text: "Importe planilhas, confira linhas e envie celulas ou colunas para o mapa.",
  },
  {
    tab: "remote-control",
    target: "#remoteControlTabButton",
    title: "Controle remoto",
    text: "Conecte em um Agent para importar, iniciar e acompanhar automacoes em outro PC.",
  },
  {
    tab: "agent-screen",
    target: "#agentScreenTabButton",
    title: "Tela do Agent",
    text: "Abra a tela remota do PC do Agent pelo MeshCentral quando precisar acompanhar ou controlar manualmente.",
  },
]);

function hasSeenStudioTutorial() {
  try {
    return window.localStorage?.getItem(STUDIO_TUTORIAL_STORAGE_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function markStudioTutorialSeen() {
  try {
    window.localStorage?.setItem(STUDIO_TUTORIAL_STORAGE_KEY, "1");
  } catch (error) {
    console.warn("Nao foi possivel salvar o estado do tutorial.", error);
  }
}

function fallbackStudioTutorialTarget() {
  return document.querySelector(".workspace-tabs") || builderShell || document.body;
}

function currentStudioTutorialStep() {
  return STUDIO_TUTORIAL_STEPS[Math.min(
    Math.max(0, studioTutorialActiveIndex),
    STUDIO_TUTORIAL_STEPS.length - 1
  )];
}

function positionStudioTutorial() {
  if (!studioTutorialOpen || !studioTutorialOverlay || !studioTutorialCard || !studioTutorialSpotlight) {
    return;
  }

  const step = currentStudioTutorialStep();
  const target = document.querySelector(step.target) || fallbackStudioTutorialTarget();
  const rect = target.getBoundingClientRect();
  const padding = 6;
  const left = Math.round(Math.max(10, rect.left - padding));
  const top = Math.round(Math.max(10, rect.top - padding));
  const width = Math.round(Math.min(window.innerWidth - left - 10, rect.width + padding * 2));
  const height = Math.round(Math.min(window.innerHeight - top - 10, rect.height + padding * 2));
  studioTutorialSpotlight.style.left = `${left}px`;
  studioTutorialSpotlight.style.top = `${top}px`;
  studioTutorialSpotlight.style.width = `${Math.max(70, width)}px`;
  studioTutorialSpotlight.style.height = `${Math.max(44, height)}px`;

  const cardRect = studioTutorialCard.getBoundingClientRect();
  const gap = 12;
  const prefersBelow = rect.top + rect.height + cardRect.height + gap < window.innerHeight - 14;
  let cardTop = prefersBelow ? rect.bottom + gap : rect.top - cardRect.height - gap;
  if (cardTop < 14) {
    cardTop = Math.min(window.innerHeight - cardRect.height - 14, rect.bottom + gap);
  }
  const idealLeft = rect.left + Math.min(18, Math.max(0, rect.width / 4));
  const cardLeft = Math.min(Math.max(14, idealLeft), window.innerWidth - cardRect.width - 14);
  studioTutorialCard.style.left = `${Math.round(cardLeft)}px`;
  studioTutorialCard.style.top = `${Math.round(Math.max(14, cardTop))}px`;
}

function scheduleStudioTutorialPosition() {
  window.cancelAnimationFrame(studioTutorialPositionFrame);
  studioTutorialPositionFrame = window.requestAnimationFrame(positionStudioTutorial);
}

function renderStudioTutorialStep() {
  if (!studioTutorialOverlay) {
    return;
  }

  const step = currentStudioTutorialStep();
  const canSwitchTutorialTab = step.tab !== "launcher" || state.activeTab === "launcher" || !hasUnsavedEditorChanges();
  const willSwitchTab = Boolean(step.tab && state.activeTab !== step.tab && canSwitchTutorialTab);
  if (step.tab && state.activeTab !== step.tab && canSwitchTutorialTab) {
    setWorkspaceTab(step.tab);
  }
  if (studioTutorialStepText) {
    studioTutorialStepText.textContent = `Passo ${studioTutorialActiveIndex + 1} de ${STUDIO_TUTORIAL_STEPS.length}`;
  }
  if (studioTutorialTitle) {
    studioTutorialTitle.textContent = step.title;
  }
  if (studioTutorialText) {
    studioTutorialText.textContent = step.text;
  }
  if (studioTutorialExtra) {
    const items = Array.isArray(step.extra) ? step.extra : [];
    studioTutorialExtra.hidden = !items.length;
    studioTutorialExtra.innerHTML = items.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }
  if (studioTutorialPrevButton) {
    studioTutorialPrevButton.disabled = studioTutorialActiveIndex <= 0;
  }
  if (studioTutorialNextButton) {
    studioTutorialNextButton.textContent = studioTutorialActiveIndex >= STUDIO_TUTORIAL_STEPS.length - 1
      ? "Finalizar"
      : "Proximo";
  }
  if (willSwitchTab) {
    window.setTimeout(scheduleStudioTutorialPosition, 140);
  } else {
    scheduleStudioTutorialPosition();
  }
}

function openStudioTutorial({ force = false } = {}) {
  if (!studioTutorialOverlay || !state.login.authenticated) {
    return;
  }
  if (!force && hasSeenStudioTutorial()) {
    return;
  }
  studioTutorialOpen = true;
  studioTutorialActiveIndex = 0;
  studioTutorialOverlay.hidden = false;
  document.body.classList.add("is-studio-tutorial-open");
  renderStudioTutorialStep();
}

function closeStudioTutorial({ remember = true } = {}) {
  studioTutorialOpen = false;
  window.cancelAnimationFrame(studioTutorialPositionFrame);
  if (studioTutorialOverlay) {
    studioTutorialOverlay.hidden = true;
  }
  document.body.classList.remove("is-studio-tutorial-open");
  if (remember) {
    markStudioTutorialSeen();
  }
}

function scheduleStudioTutorialAutoStart() {
  window.clearTimeout(studioTutorialAutoStartTimer);
  if (!state.login.authenticated || hasSeenStudioTutorial()) {
    return;
  }
  studioTutorialAutoStartTimer = window.setTimeout(() => {
    openStudioTutorial();
  }, 650);
}

function applyCommandMapChromeMode() {
  const collapsed = state.activeTab === "commands" && Boolean(state.commandMapChromeCollapsed);
  builderShell?.classList.toggle("is-command-map-chrome-collapsed", collapsed);
  if (commandMapChromeToggleButton) {
    commandMapChromeToggleButton.textContent = collapsed ? "Mostrar menu" : "Ocultar menu";
    commandMapChromeToggleButton.setAttribute("aria-pressed", collapsed ? "true" : "false");
    commandMapChromeToggleButton.setAttribute(
      "aria-label",
      collapsed ? "Mostrar menu superior do mapa" : "Ocultar menu superior do mapa"
    );
  }
}

function applyCommandMapZoom() {
  const zoomPercent = Math.round(state.commandMapZoom * 100);
  commandMapList.style.setProperty("--command-map-zoom", String(state.commandMapZoom));
  if (mapZoomRange) {
    mapZoomRange.value = String(zoomPercent);
  }
  if (mapZoomValue) {
    mapZoomValue.textContent = `${zoomPercent}%`;
  }
}

function autoFitCommandMapZoom() {
  if (!commandMapList || state.activeTab !== "commands") {
    return;
  }

  const cards = Array.from(commandMapList.querySelectorAll(".command-tree-card"));
  if (!cards.length) {
    state.commandMapZoom = Math.min(1.4, Math.max(0.6, Number(state.commandMapRequestedZoom) || 0.96));
    applyCommandMapZoom();
    return;
  }

  const requestedZoom = Math.min(1.4, Math.max(0.6, Number(state.commandMapRequestedZoom) || 0.96));
  const currentZoom = Math.max(0.01, Number(state.commandMapZoom) || requestedZoom || 0.96);
  const availableHeight = Math.max(220, commandMapList.clientHeight - 24);

  let tallestNaturalHeight = 0;
  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    if (!rect.height) {
      return;
    }
    tallestNaturalHeight = Math.max(tallestNaturalHeight, rect.height / currentZoom);
  });

  if (!tallestNaturalHeight) {
    state.commandMapZoom = requestedZoom;
    applyCommandMapZoom();
    return;
  }

  const fitZoom = Math.min(1.4, Math.max(0.6, availableHeight / tallestNaturalHeight));
  state.commandMapZoom = Math.min(requestedZoom, fitZoom);
  applyCommandMapZoom();
}

function findAdjacentCommandFlowSegment(element, direction = "previous") {
  if (!element) {
    return null;
  }

  let sibling = direction === "next" ? element.nextElementSibling : element.previousElementSibling;
  while (sibling) {
    if (sibling.classList?.contains("command-flow-segment")) {
      return sibling;
    }
    sibling = direction === "next" ? sibling.nextElementSibling : sibling.previousElementSibling;
  }
  return null;
}

function updateCommandConnectorPositions() {
  if (!commandMapList || state.activeTab !== "commands") {
    return;
  }

  const row = commandMapList.querySelector(".command-flow-row");
  if (!row) {
    return;
  }

  const rowRect = row.getBoundingClientRect();
  row.querySelectorAll(".command-inline-connector").forEach((connector) => {
    const previousSegment = findAdjacentCommandFlowSegment(connector, "previous");
    const nextSegment = findAdjacentCommandFlowSegment(connector, "next");
    const centers = [previousSegment, nextSegment]
      .map((segment) => segment?.querySelector(".command-tree-card"))
      .filter(Boolean)
      .map((card) => {
        const rect = card.getBoundingClientRect();
        const factor = Number.parseFloat(getComputedStyle(card).getPropertyValue("--connector-anchor-factor"));
        if (Number.isFinite(factor) && factor > 0) {
          return rect.top - rowRect.top + rect.height * factor;
        }
        return rect.top - rowRect.top + rect.height / 2;
      });

    if (!centers.length) {
      connector.style.removeProperty("--connector-inline-top");
      return;
    }

    const centerTop = centers.reduce((sum, value) => sum + value, 0) / centers.length;
    connector.style.setProperty("--connector-inline-top", `${Math.round(centerTop)}px`);
  });
}

function getCommandMapFailureRoute(event) {
  const details = event?.details || event?.detalhes || {};
  const eventType = String(event?.type || "").trim();

  if (eventType === "clicar_imagem") {
    const action = String(details.ao_nao_encontrar || "parar").trim().toLowerCase();
    const block = Number(details.bloco_nao_encontrar || 0);
    const delay = Math.max(0, parseNumber(details.atraso_antes_sequencia_nao_encontrar, 0));
    return {
      action,
      block: Number.isFinite(block) && block > 0 ? block : null,
      delay,
    };
  }

  if (eventType === "chrome_elemento_html") {
    const action = String(details.ao_falhar || "parar").trim().toLowerCase();
    const block = Number(details.bloco_falha || 0);
    const delay = Math.max(0, parseNumber(details.atraso_antes_sequencia_falha, 0));
    return {
      action,
      block: Number.isFinite(block) && block > 0 ? block : null,
      delay,
    };
  }

  return { action: "parar", block: null, delay: 0 };
}

function normalizeCommandJumpRoute(event, route, kind, visibleOrders) {
  if (route.action !== "ir_para_bloco" || !route.block) {
    return null;
  }
  const sourceOrder = Number(event.order || 0);
  const targetOrder = Number(route.block || 0);
  if (!sourceOrder || !targetOrder || sourceOrder === targetOrder || !visibleOrders.has(targetOrder)) {
    return null;
  }
  return {
    sourceOrder,
    targetOrder,
    delay: route.delay,
    kind,
  };
}

function getCommandMapJumpRoutes(events = getCommandMapEvents().map((event) => applyCommandMapDraftToEvent(event))) {
  const visibleOrders = new Set(events.map((event) => Number(event.order || 0)));
  return events.flatMap((event) => [
    normalizeCommandJumpRoute(event, getCommandMapSuccessRoute(event), "success", visibleOrders),
    normalizeCommandJumpRoute(event, getCommandMapFailureRoute(event), "failure", visibleOrders),
  ]).filter(Boolean);
}

function clearCommandJumpLayer(row) {
  row?.querySelector(".command-jump-layer")?.remove();
  row?.classList.remove("has-jump-paths");
  row?.classList.remove("has-backward-jump-paths");
  row?.style.removeProperty("--jump-route-lanes");
}

function renderCommandJumpPaths() {
  if (!commandMapList || state.activeTab !== "commands") {
    return;
  }

  const row = commandMapList.querySelector(".command-flow-row");
  if (!row) {
    return;
  }

  clearCommandJumpLayer(row);
  const routes = getCommandMapJumpRoutes();
  if (!routes.length) {
    return;
  }

  row.classList.add("has-jump-paths");
  const endpointLaneUsage = new Map();
  const preparedRoutes = routes.map((route) => {
    const sourceKey = `source:${route.sourceOrder}`;
    const targetKey = `target:${route.targetOrder}`;
    const pairKey = `pair:${Math.min(route.sourceOrder, route.targetOrder)}:${Math.max(route.sourceOrder, route.targetOrder)}`;
    const lane = Math.max(
      endpointLaneUsage.get(sourceKey) || 0,
      endpointLaneUsage.get(targetKey) || 0,
      endpointLaneUsage.get(pairKey) || 0
    );
    endpointLaneUsage.set(sourceKey, lane + 1);
    endpointLaneUsage.set(targetKey, lane + 1);
    endpointLaneUsage.set(pairKey, lane + 1);
    return { ...route, lane };
  });
  const maxLane = preparedRoutes.reduce((max, route) => Math.max(max, route.lane || 0), 0);
  row.style.setProperty("--jump-route-lanes", String(maxLane));
  const zoom = Number(state.commandMapZoom || 1) || 1;
  const rowRect = row.getBoundingClientRect();
  const rowWidth = Math.max(row.scrollWidth / zoom, rowRect.width / zoom, 1);
  const rowHeight = Math.max(row.scrollHeight / zoom, rowRect.height / zoom, 1);
  const layer = document.createElement("div");
  layer.className = "command-jump-layer";
  layer.style.width = `${Math.ceil(rowWidth)}px`;
  layer.style.height = `${Math.ceil(rowHeight)}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "command-jump-svg");
  svg.setAttribute("viewBox", `0 0 ${Math.ceil(rowWidth)} ${Math.ceil(rowHeight)}`);
  svg.setAttribute("aria-hidden", "true");

  preparedRoutes.forEach((route, index) => {
    const sourceSegment = row.querySelector(`.command-flow-segment[data-order="${route.sourceOrder}"]`);
    const targetSegment = row.querySelector(`.command-flow-segment[data-order="${route.targetOrder}"]`);
    const sourceCard = sourceSegment?.querySelector(".command-tree-card");
    const targetCard = targetSegment?.querySelector(".command-tree-card");
    if (!sourceCard || !targetCard) {
      return;
    }

    const sourceRect = sourceCard.getBoundingClientRect();
    const targetRect = targetCard.getBoundingClientRect();
    const sourceCenterX = (sourceRect.left - rowRect.left + sourceRect.width / 2) / zoom;
    const targetCenterX = (targetRect.left - rowRect.left + targetRect.width / 2) / zoom;
    const sourceTop = (sourceRect.top - rowRect.top) / zoom;
    const targetTop = (targetRect.top - rowRect.top) / zoom;
    const isBackward = targetCenterX < sourceCenterX;
    const laneOffset = 38 + Number(route.lane || 0) * 24;
    const pathY = Math.max(16, Math.min(sourceTop, targetTop) - laneOffset);
    const sourceY = Math.max(18, sourceTop + 10);
    const targetY = Math.max(18, targetTop + 10);
    const radius = 12;
    const direction = targetCenterX >= sourceCenterX ? 1 : -1;
    const sourceTurnX = sourceCenterX;
    const targetTurnX = targetCenterX;
    const sourceCornerX = sourceTurnX + radius * direction;
    const targetCornerX = targetTurnX - radius * direction;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const pathId = `commandJumpPath${route.sourceOrder}_${route.targetOrder}_${route.kind}_${index}`;
    path.setAttribute("id", pathId);
    path.setAttribute(
      "d",
      [
        `M ${sourceCenterX} ${sourceY}`,
        `L ${sourceTurnX} ${pathY + radius}`,
        `Q ${sourceTurnX} ${pathY} ${sourceCornerX} ${pathY}`,
        `L ${targetCornerX} ${pathY}`,
        `Q ${targetTurnX} ${pathY} ${targetTurnX} ${pathY + radius}`,
        `L ${targetCenterX} ${targetY}`,
      ].join(" ")
    );
    path.setAttribute("class", `command-jump-path ${isBackward ? "is-backward" : "is-forward"} ${route.kind === "failure" ? "is-failure" : "is-success"}`);
    svg.appendChild(path);

    const energy = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    energy.setAttribute("class", `command-jump-energy ${route.kind === "failure" ? "is-failure" : "is-success"}`);
    energy.setAttribute("r", route.kind === "failure" ? "3.2" : "3");
    const motion = document.createElementNS("http://www.w3.org/2000/svg", "animateMotion");
    motion.setAttribute("dur", route.kind === "failure" ? "1.65s" : "1.45s");
    motion.setAttribute("repeatCount", "indefinite");
    motion.setAttribute("rotate", "auto");
    const mpath = document.createElementNS("http://www.w3.org/2000/svg", "mpath");
    mpath.setAttribute("href", `#${pathId}`);
    mpath.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${pathId}`);
    motion.appendChild(mpath);
    energy.appendChild(motion);
    svg.appendChild(energy);

    const midpointX = (sourceCenterX + targetCenterX) / 2;
    const label = document.createElement("label");
    label.className = `connector-time command-jump-time ${isBackward ? "is-backward" : "is-forward"} ${route.kind === "failure" ? "is-failure" : "is-success"}`;
    label.style.left = `${Math.round(midpointX)}px`;
    label.style.top = `${Math.round(pathY)}px`;
    label.innerHTML = `
      <span class="connector-link-label">${escapeHtml(`${route.sourceOrder} > ${route.targetOrder}`)}</span>
      <input
        data-jump-delay="true"
        data-route-kind="${escapeHtml(route.kind)}"
        data-source-order="${escapeHtml(String(route.sourceOrder))}"
        data-target-order="${escapeHtml(String(route.targetOrder))}"
        type="number"
        min="0"
        step="0.1"
        value="${escapeHtml(formatTransitionDelayValue(route.delay))}"
      />
      <strong>s</strong>
    `;
    layer.appendChild(label);
  });

  layer.prepend(svg);
  row.prepend(layer);
}

function scheduleCommandConnectorLayout() {
  if (state.commandConnectorLayoutFrame) {
    cancelAnimationFrame(state.commandConnectorLayoutFrame);
  }
  state.commandConnectorLayoutFrame = requestAnimationFrame(() => {
    state.commandConnectorLayoutFrame = 0;
    updateCommandConnectorPositions();
    renderCommandJumpPaths();
  });
}

function scheduleCommandMapAutoFit() {
  if (state.commandMapAutoFitFrame) {
    cancelAnimationFrame(state.commandMapAutoFitFrame);
  }
  state.commandMapAutoFitFrame = requestAnimationFrame(() => {
    state.commandMapAutoFitFrame = 0;
    autoFitCommandMapZoom();
    scheduleCommandConnectorLayout();
  });
}

function setCommandMapZoom(nextZoom) {
  state.commandMapRequestedZoom = Math.min(1.4, Math.max(0.6, Number(nextZoom) || 1));
  state.commandMapZoom = state.commandMapRequestedZoom;
  applyCommandMapZoom();
  scheduleCommandMapAutoFit();
  if (state.activeTab === "commands" && state.commandMapFocusOrder) {
    requestAnimationFrame(() => centerCommandMapOrder(state.commandMapFocusOrder, "auto"));
  }
}

function getCommandMapOrders() {
  return getCommandMapEvents()
    .map((event) => Number(event.order))
    .filter((order) => Number.isFinite(order));
}

function getAssistRoadmapEvents(roadmap = state.roadmap) {
  return [...(roadmap?.events ?? [])].sort((firstEvent, secondEvent) => {
    const firstOrder = Number(firstEvent?.order ?? firstEvent?.ordem ?? 0);
    const secondOrder = Number(secondEvent?.order ?? secondEvent?.ordem ?? 0);
    const firstIsFinite = Number.isFinite(firstOrder);
    const secondIsFinite = Number.isFinite(secondOrder);

    if (!firstIsFinite && !secondIsFinite) {
      return 0;
    }
    if (!firstIsFinite) {
      return 1;
    }
    if (!secondIsFinite) {
      return -1;
    }
    return firstOrder - secondOrder;
  });
}

function getAssistInitialOrder(roadmap = state.roadmap) {
  const initialSequence = resolveRoadmapInitialSequence(roadmap);
  return getCommandMapEvents(initialSequence, roadmap)[0]?.order ?? getAssistRoadmapEvents()[0]?.order ?? null;
}

function getAssistCurrentSequence() {
  const byOrder = getCommandMapEventSequenceByOrder(state.assist.currentOrder);
  if (byOrder) {
    return byOrder;
  }

  return resolveRoadmapInitialSequence();
}

function setAssistControlTab(tabName = "target") {
  const requestedTab = String(tabName || "").trim().toLowerCase();
  const nextTab = ["target", "pages", "texts"].includes(requestedTab) ? requestedTab : "target";
  state.assistControlTab = nextTab;

  document.querySelectorAll("[data-assist-control-tab]").forEach((button) => {
    const isActive = button.dataset.assistControlTab === nextTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-assist-control-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.assistControlPanel !== nextTab;
    panel.classList.toggle("is-active", panel.dataset.assistControlPanel === nextTab);
  });
}

function syncAssistTheme() {
  if (!assistShell) {
    return;
  }

  assistShell.dataset.pageTheme = resolveCommandMapPageTheme(getAssistCurrentSequence());
}

function updateCommandMapNavButtons() {
  const orders = state.commandMapOrderCache || getCommandMapOrders();
  const currentIndex = orders.indexOf(Number(state.commandMapFocusOrder));
  const hasOrders = orders.length > 0;
  if (mapPrevButton) {
    mapPrevButton.disabled = !hasOrders || currentIndex <= 0;
  }
  if (mapNextButton) {
    mapNextButton.disabled = !hasOrders || currentIndex < 0 || currentIndex >= orders.length - 1;
  }
}

function moveCommandMapFocus(step) {
  const orders = state.commandMapOrderCache || getCommandMapOrders();
  if (!orders.length) {
    return;
  }

  const currentIndex = Math.max(0, orders.indexOf(Number(state.commandMapFocusOrder)));
  const nextIndex = Math.min(orders.length - 1, Math.max(0, currentIndex + step));
  const nextOrder = orders[nextIndex];
  if (nextOrder == null || nextOrder === state.commandMapFocusOrder) {
    return;
  }
  setCommandMapFocus(nextOrder, "auto", {
    skipConnectorLayout: true,
    animateFocusPulse: true,
    scrollMode: "if-needed",
  });
}

function syncTestInputsFrom(source) {
  const delayValue = source === "assist" ? assistDelayInput.value : testDelayInput.value;
  const loopValue = source === "assist" ? assistLoopStartInput.value : testLoopStartInput.value;
  testDelayInput.value = delayValue;
  assistDelayInput.value = delayValue;
  testLoopStartInput.value = loopValue;
  assistLoopStartInput.value = loopValue;
  updateTestLoopHint();
}

function normalizeExecutionWindowMode(value) {
  return String(value || "").trim().toLowerCase() === "minimize" ? "minimize" : "normal";
}

function syncExecutionWindowModeFrom(source) {
  const modeValue = normalizeExecutionWindowMode(
    source === "assist" ? assistWindowModeSelect?.value : testWindowModeSelect?.value
  );
  state.executionWindowMode = modeValue;
  if (testWindowModeSelect) {
    testWindowModeSelect.value = modeValue;
  }
  if (assistWindowModeSelect) {
    assistWindowModeSelect.value = modeValue;
  }
}

function shouldMinimizeExecutionWindow() {
  return normalizeExecutionWindowMode(state.executionWindowMode) === "minimize";
}

function surfaceAssistExecutionMessage(message, kind = "info") {
  const text = String(message || "").trim();
  if (!text) {
    return;
  }
  pushAssistLog(text, kind);
  state.assist.description = text;
  updateAssistProgressUI();
}

function captureLoginResolution() {
  const screenWidth = Number(window.screen?.width || 0);
  const screenHeight = Number(window.screen?.height || 0);
  const viewportWidth = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
  const viewportHeight = Number(window.innerHeight || document.documentElement?.clientHeight || 0);
  const devicePixelRatio = Number(window.devicePixelRatio || 1);
  return {
    screenWidth,
    screenHeight,
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
    label: `${screenWidth} x ${screenHeight}`,
  };
}

function setLoginError(message = "") {
  if (!loginErrorText) {
    return;
  }
  const text = String(message || "").trim();
  loginErrorText.hidden = !text;
  loginErrorText.textContent = text;
}

function hasDevAdminConfig() {
  return Boolean(DEV_ADMIN_CONFIG?.enabled);
}

function setLoginStep(step = "admin") {
  state.login.step = step;
}

function renderLoginTitle() {
  if (!loginTitleText) {
    return;
  }
  loginTitleText.innerHTML = '<span class="welcome-title-flow">Flow</span><span class="welcome-title-detect">Detect</span>';
}

function updateLoginModeUI() {
  renderLoginTitle();

  if (hasDevAdminConfig() && devAdminEmailInput && !devAdminEmailInput.value) {
    devAdminEmailInput.value = String(DEV_ADMIN_CONFIG?.email || "").trim();
  }
}

function updateActivationSummary() {
  if (!loginActivationSummary) {
    return;
  }
  loginActivationSummary.textContent = state.login.authenticated
    ? "FlowDetect pronto para uso nesta maquina."
    : "Automacao visual para criar, testar e executar fluxos desktop.";
}

function renderLoginUsersList() {
  return;
}

function updateSelectedUserSummary() {
  return;
}

function updateLoginResolutionPreview(resolution = null) {
  if (!loginResolutionPreview) {
    return;
  }
  const current = resolution || captureLoginResolution();
  loginResolutionPreview.textContent = `Resolucao detectada ao entrar: ${current.screenWidth} x ${current.screenHeight} | area util ${current.viewportWidth} x ${current.viewportHeight}`;
}

function applyLoginStateUI() {
  const authenticated = Boolean(state.login.authenticated);
  document.body.classList.toggle("is-authenticated", authenticated);
  document.body.classList.toggle("is-auth-locked", !authenticated);
  if (loginOverlay) {
    loginOverlay.setAttribute("aria-hidden", authenticated ? "true" : "false");
    loginOverlay.hidden = authenticated;
  }

  const profile = state.login.profile || {};
  const resolution = state.login.resolution || captureLoginResolution();
  const userName = String(profile.nome || profile.email || "").trim();
  const resolutionLabel = `${resolution.screenWidth || 0} x ${resolution.screenHeight || 0}`;

  updateLoginModeUI();
  updateActivationSummary();
  updateLoginResolutionPreview(resolution);

  if (sessionChip) {
    sessionChip.textContent = authenticated
      ? `${userName || DEV_ADMIN_CONFIG.displayName} | ${resolutionLabel}`
      : "FlowDetect | aguardando entrada";
  }

  if (assistWindowText) {
    assistWindowText.textContent = authenticated
      ? userName || DEV_ADMIN_CONFIG.displayName
      : "Aguardando entrada";
  }

  if (assistWindowDetailText) {
    assistWindowDetailText.textContent = authenticated
      ? `Resolucao salva: ${resolutionLabel}`
      : "Clique em entrar para salvar a resolucao atual desta maquina.";
  }

  if (tutorialReplayButton) {
    tutorialReplayButton.hidden = !authenticated;
  }

  if (authenticated) {
    scheduleStudioTutorialAutoStart();
  } else {
    closeStudioTutorial({ remember: false });
  }
}

async function loadPersistedLoginSession(options = {}) {
  const preserveAuthenticated = Boolean(options.preserveAuthenticated);
  try {
    const result = await invoke("get_login_session");
    if (!result?.exists || !result?.session) {
      if (preserveAuthenticated && (state.login.authenticated || loginSubmitInFlight)) {
        return;
      }
      state.login.authenticated = false;
      state.login.profile = {
        nome: DEV_ADMIN_CONFIG.displayName,
        email: DEV_ADMIN_CONFIG.email,
        role: "local",
        isDevAdmin: false,
      };
      state.login.resolution = null;
      state.login.step = "admin";
      return;
    }

    const saved = result.session;
    const email = String(saved.email || "").trim();
    const nome = String(saved.nome || "").trim();
    const normalizedName = !nome || nome === "Administrador" ? DEV_ADMIN_CONFIG.displayName : nome;
    const normalizedEmail = !email || email === "admin@flowdetect.local" ? DEV_ADMIN_CONFIG.email : email;
    const resolution = {
      screenWidth: Number(saved.screen_width || 0),
      screenHeight: Number(saved.screen_height || 0),
      viewportWidth: Number(saved.viewport_width || 0),
      viewportHeight: Number(saved.viewport_height || 0),
      devicePixelRatio: Number(saved.device_pixel_ratio || 1),
    };

    const hasSavedResolution = resolution.screenWidth > 0 && resolution.screenHeight > 0;
    state.login.authenticated = true;
    state.login.profile = {
      nome: normalizedName,
      email: normalizedEmail,
      role: "local",
      isDevAdmin: false,
    };
    state.login.resolution = hasSavedResolution ? resolution : captureLoginResolution();
    state.login.activationKey = String(saved.activation_key || "LOCAL-WELCOME").trim() || "LOCAL-WELCOME";
    state.login.activationId = String(saved.activation_id || "local-welcome").trim() || "local-welcome";
    state.login.expiresAt = String(saved.expires_at || "").trim();
    state.login.step = "admin";
    if (devAdminEmailInput) {
      devAdminEmailInput.value = normalizedEmail || String(DEV_ADMIN_CONFIG.email || "").trim();
    }
  } catch (error) {
    if (preserveAuthenticated && state.login.authenticated) {
      return;
    }
    console.warn("Nao foi possivel carregar a sessao local do FlowDetect.", error);
  }
}

async function submitDevAdminLogin() {
  if (!hasDevAdminConfig()) {
    setLoginError("A entrada local do FlowDetect nao esta habilitada.");
    return;
  }

  if (loginSubmitInFlight || state.login.authenticated) {
    applyLoginStateUI();
    return;
  }

  const expectedEmail = String(DEV_ADMIN_CONFIG?.email || "").trim().toLowerCase();
  const expectedPassword = String(DEV_ADMIN_CONFIG?.password || "").trim();
  const usingLegacyCredentialFields = Boolean(devAdminEmailInput || devAdminPasswordInput);

  if (usingLegacyCredentialFields) {
    const email = String(devAdminEmailInput?.value || "").trim().toLowerCase();
    const password = String(devAdminPasswordInput?.value || "").trim();

    if (!email || !password) {
      setLoginError("Digite o e-mail e a senha do admin local.");
      return;
    }

    if (email !== expectedEmail || password !== expectedPassword) {
      setLoginError("Credencial admin invalida.");
      return;
    }
  }

  setLoginError("");
  const resolution = captureLoginResolution();
  updateLoginResolutionPreview(resolution);
  if (devAdminLoginButton) {
    devAdminLoginButton.textContent = "Entrando...";
    devAdminLoginButton.disabled = true;
  }
  loginSubmitInFlight = true;

  try {
    const displayName = String(state.login.profile?.nome || DEV_ADMIN_CONFIG?.displayName || "Usuario local").trim() || "Usuario local";
    await invoke("save_login_session", {
      nome: displayName,
      email: expectedEmail,
      activationKey: "LOCAL-WELCOME",
      activationId: "local-welcome",
      expiresAt: "",
      screenWidth: resolution.screenWidth,
      screenHeight: resolution.screenHeight,
      viewportWidth: resolution.viewportWidth,
      viewportHeight: resolution.viewportHeight,
      devicePixelRatio: resolution.devicePixelRatio,
    });

    state.login.authenticated = true;
    state.login.profile = {
      nome: displayName,
      email: expectedEmail,
      role: "local",
      isDevAdmin: false,
    };
    state.login.resolution = resolution;
    state.login.activationKey = "LOCAL-WELCOME";
    state.login.activationId = "local-welcome";
    state.login.expiresAt = "";
    state.login.step = "admin";
    applyLoginStateUI();
    setMessage(`FlowDetect pronto. Resolucao ${resolution.screenWidth} x ${resolution.screenHeight} salva para esta maquina.`, "success");
  } catch (error) {
    setLoginError(String(error || "Falha ao abrir o FlowDetect."));
  } finally {
    loginSubmitInFlight = false;
    if (devAdminLoginButton) {
      devAdminLoginButton.textContent = "Entrar";
      devAdminLoginButton.disabled = false;
    }
  }
}

async function runImageRecognitionTest(values, options = {}) {
  const imagePath = String(values?.imagePath || "").trim();
  if (!imagePath) {
    setMessage("Selecione uma referencia visual antes de testar o reconhecimento.", "error");
    if (Number.isFinite(Number(options.recognitionOrder))) {
      setRecognitionTestStatusForOrder(Number(options.recognitionOrder), imagePath, false);
    }
    return;
  }

  try {
    setBusy("Testando reconhecimento");
    setMessage(
      options.inheritWindowFallback === false
        ? "Testando o bloco no estado atual da tela, usando apenas os dados dele."
        : "Testando somente o bloco de reconhecimento...",
      "info"
    );
    const result = await invoke("test_image_recognition", {
      imagem: imagePath,
      timeout: parseNumber(values.timeout, 10),
      confianca: parseNumber(values.confidence, 0.8),
      perfilBusca: normalizeRecognitionProfile(values.searchProfile, "balanced"),
      modoAreaBusca: "target_window",
      areaBuscaX: 0,
      areaBuscaY: 0,
      areaBuscaLargura: 0,
      areaBuscaAltura: 0,
      janelaAlvo: values.windowTitle?.trim() || null,
      textoOcrEsperado: values.expectedOcrText?.trim() || null,
    });
    setBusy("Pronto");
    if (Number.isFinite(Number(options.recognitionOrder))) {
      setRecognitionTestStatusForOrder(Number(options.recognitionOrder), imagePath, true);
    }
    setMessage(result || "Reconhecimento testado com sucesso.", "success");
    return true;
  } catch (error) {
    setBusy("Erro");
    if (Number.isFinite(Number(options.recognitionOrder))) {
      setRecognitionTestStatusForOrder(Number(options.recognitionOrder), imagePath, false);
    }
    const message = String(error || "");
    const diagnosticHint = message.toLowerCase().includes("diagnostico")
      ? " Veja a pasta diagnosticos_reconhecimento para comparar a captura usada no teste."
      : "";
    setMessage(`${message}${diagnosticHint}`, "error");
    return false;
  }
}

function extractOrderFromDescription(description) {
  const match = String(description || "").match(/Evento\s+#(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractAssistPositionHint(text) {
  const content = String(text || "").trim();
  if (!content) {
    return null;
  }

  const orderFromDescription = extractOrderFromDescription(content);
  if (orderFromDescription != null) {
    return { order: orderFromDescription, sequence: getCommandMapEventSequenceByOrder(orderFromDescription) };
  }

  const loopBlockReturn = content.match(/Retorno para o bloco\s+(\d+)\s+da pagina inicial do loop\s+\(([^)]+)\)/i);
  if (loopBlockReturn) {
    const hintedOrder = Number(loopBlockReturn[1]);
    return {
      order: Number.isFinite(hintedOrder) ? hintedOrder : null,
      sequence: normalizeSequenceName(loopBlockReturn[2]),
    };
  }

  const loopPageReturn = content.match(/Retorno para a pagina inicial do loop\s+\(([^)]+)\)/i);
  if (loopPageReturn) {
    const sequence = normalizeSequenceName(loopPageReturn[1]);
    return {
      order: getCommandMapFirstOrderForSequence(sequence),
      sequence,
    };
  }

  return null;
}

function extractAssistIterationHint(text) {
  const match = String(text || "").match(/Iteracao\s+(\d+)\/(\d+)/i);
  if (!match) {
    return null;
  }
  return {
    current: Number(match[1] || 0),
    total: Number(match[2] || 0),
  };
}

function getAssistRequestedLoopStart() {
  return Math.max(
    1,
    Math.trunc(parseNumber(assistLoopStartInput?.value || testLoopStartInput?.value, 1)),
  );
}

function resolveAssistLoopRowByIteration(iterationNumber) {
  const rows = state.testLoopData?.rows ?? [];
  if (!rows.length || !Number.isFinite(Number(iterationNumber)) || Number(iterationNumber) <= 0) {
    return null;
  }

  const startLine = getAssistRequestedLoopStart();
  const startIndex = rows.findIndex((row) => Number(row.row_number) >= startLine);
  if (startIndex < 0) {
    return null;
  }

  return rows[startIndex + Number(iterationNumber) - 1] || null;
}

function resolveAssistLoopRowByLine(lineNumber) {
  const rows = state.testLoopData?.rows ?? [];
  if (!rows.length || !Number.isFinite(Number(lineNumber)) || Number(lineNumber) <= 0) {
    return null;
  }
  return rows.find((row) => Number(row.row_number) === Number(lineNumber)) || null;
}

function applyAssistLoopRuntimeHint(text, { updateDescription = false, updateCompany = true } = {}) {
  const content = String(text || "").trim();
  if (!content) {
    return false;
  }

  let changed = false;
  const iteration = extractAssistIterationHint(content);
  if (iteration) {
    const row = resolveAssistLoopRowByIteration(iteration.current);
    if (iteration.total > 0) {
      state.assist.current = iteration.current;
      state.assist.total = iteration.total;
      state.assist.percent = (iteration.current / iteration.total) * 100;
      changed = true;
    }
    if (updateCompany && row?.company && state.assist.company !== String(row.company)) {
      state.assist.company = String(row.company);
      changed = true;
    }
    if (updateDescription) {
      state.assist.description = content;
      changed = true;
    }
  }

  const loopGroupMatch = content.match(/grupo em loop:\s*(.+)$/i);
  if (loopGroupMatch) {
    const firstSequence = normalizeSequenceName(String(loopGroupMatch[1] || "").split(",")[0] || "");
    const firstOrder = getCommandMapFirstOrderForSequence(firstSequence);
    if (firstOrder != null && Number(state.assist.currentOrder) !== Number(firstOrder)) {
      state.assist.currentOrder = Number(firstOrder);
      changed = true;
    }
    if (updateDescription) {
      state.assist.description = content;
      changed = true;
    }
  }

  if (updateDescription && /trecho em loop|retorno para a pagina inicial do loop|retorno para o bloco/i.test(content)) {
    state.assist.description = content;
    changed = true;
  }

  return changed;
}

function applyAssistPositionHint(text, { render = true } = {}) {
  const hint = extractAssistPositionHint(text);
  if (!hint) {
    return false;
  }

  if (Number.isFinite(Number(hint.order))) {
    state.assist.currentOrder = Number(hint.order);
  } else if (hint.sequence) {
    const firstOrder = getCommandMapFirstOrderForSequence(hint.sequence);
    if (firstOrder != null) {
      state.assist.currentOrder = firstOrder;
    }
  }

  if (render) {
    renderAssistExecutionMap();
  }
  return true;
}

const FLOWDETECT_WINDOW_PATTERN = /flowdetect|gerador visual de automacoes/i;

function isFlowDetectWindowCandidate(item) {
  return FLOWDETECT_WINDOW_PATTERN.test(String(item?.title || ""));
}

function normalizeAssistTargetWindow(item) {
  const title = String(item?.title || "").trim();
  return {
    title,
    hwnd: Number(item?.hwnd || 0),
    className: String(item?.class_name || item?.className || "").trim(),
    pid: Number(item?.pid || 0),
    left: Number(item?.left || 0),
    top: Number(item?.top || 0),
    width: Number(item?.width || 0),
    height: Number(item?.height || 0),
    isFlowDetect: isFlowDetectWindowCandidate(item),
  };
}

function normalizeRecognitionWindowTitle(value) {
  return String(value ?? "").trim();
}

function recognitionWindowCatalogItems() {
  const seen = new Set();
  return (Array.isArray(state.recognitionWindowCatalog) ? state.recognitionWindowCatalog : [])
    .map(normalizeAssistTargetWindow)
    .filter((item) => item.title && !item.isFlowDetect)
    .filter((item) => {
      const key = `${item.title}::${item.className}::${item.hwnd}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function recognitionWindowOptionsMarkup(selectedTitle = "", emptyLabel = "Sem janela fixa neste bloco") {
  const normalizedSelected = normalizeRecognitionWindowTitle(selectedTitle);
  const items = recognitionWindowCatalogItems();
  const options = [`<option value="">${escapeHtml(emptyLabel)}</option>`];
  if (normalizedSelected && !items.some((item) => item.title === normalizedSelected)) {
    options.push(
      `<option value="${escapeHtml(normalizedSelected)}" selected>${escapeHtml(`${normalizedSelected} (janela salva)`)}</option>`
    );
  }
  items.forEach((item) => {
    const meta = item.className ? ` | ${item.className}` : "";
    options.push(
      `<option value="${escapeHtml(item.title)}" ${item.title === normalizedSelected ? "selected" : ""}>${escapeHtml(`${item.title}${meta}`)}</option>`
    );
  });
  return options.join("");
}

function updateRecognitionWindowSelects(root = document) {
  if (!root?.querySelectorAll) {
    return;
  }
  root.querySelectorAll('[data-field="windowTitle"], [data-tree-field="windowTitle"], [data-insert-field="windowTitle"]').forEach((select) => {
    const currentValue = normalizeRecognitionWindowTitle(select.value || select.dataset.windowTitle || "");
    select.innerHTML = recognitionWindowOptionsMarkup(currentValue);
    if (currentValue) {
      select.value = currentValue;
    }
  });
}

async function refreshRecognitionWindowCatalog(options = {}) {
  const silent = Boolean(options.silent);
  const result = await invoke("list_open_windows");
  state.recognitionWindowCatalog = Array.isArray(result?.items)
    ? result.items.map(normalizeAssistTargetWindow).filter((item) => item.title && !item.isFlowDetect)
    : [];
  updateRecognitionWindowSelects(options.root || document);
  if (!silent) {
    const total = recognitionWindowCatalogItems().length;
    setMessage(total ? `${total} janela(s) carregada(s) para o bloco.` : "Nenhuma janela visivel foi encontrada agora.", total ? "success" : "info");
  }
}

function resetAssistTargetState() {
  state.assistTarget = {
    ...state.assistTarget,
    enabled: false,
    status: "idle",
    title: "",
    className: "",
    hwnd: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    pid: 0,
    lastSeenAt: 0,
  };
}

function assistTargetMetaLabel(target = state.assistTarget) {
  if (!target?.enabled) {
    return "Sem hwnd ativo para esta execucao.";
  }
  const parts = [`hwnd ${target.hwnd || 0}`];
  if (target.className) {
    parts.push(`classe ${target.className}`);
  }
  if (target.width > 0 && target.height > 0) {
    parts.push(`${target.width}x${target.height}`);
  }
  parts.push(`x=${target.left || 0} y=${target.top || 0}`);
  return parts.join(" | ");
}

function updateAssistTargetUI() {
  if (!assistTargetTitle || !assistTargetDetailText || !assistTargetStatusChip || !assistTargetMetaText) {
    return;
  }

  const target = state.assistTarget;
  const hasTarget = Boolean(target?.enabled && target?.hwnd);
  let chipVariant = "is-idle";
  let chipText = "Nenhuma janela selecionada";
  let detailText = "Selecione uma janela aberta antes de executar quando quiser travar a automacao em um alvo especifico.";

  if (hasTarget && target.status === "lost") {
    chipVariant = "is-lost";
    chipText = "Janela perdida";
    detailText = "A janela alvo nao esta mais disponivel. Escolha outra antes de iniciar a automacao.";
  } else if (hasTarget && state.assist.mode === "running") {
    chipVariant = "is-running";
    chipText = "Executando nesta janela";
    detailText = "A execucao atual esta presa a esta janela. Se ela sumir, a automacao para com aviso.";
  } else if (hasTarget) {
    chipVariant = "is-selected";
    chipText = "Janela selecionada";
    detailText = "O contorno azul marca este alvo e o executor usa esse contexto so nesta execucao.";
  }

  assistTargetTitle.textContent = hasTarget ? target.title || "Janela sem titulo" : "Nenhuma janela selecionada";
  assistTargetDetailText.textContent = detailText;
  assistTargetMetaText.textContent = assistTargetMetaLabel(target);
  assistTargetStatusChip.textContent = chipText;
  assistTargetStatusChip.className = `assist-target-status-chip ${chipVariant}`;
  if (assistClearWindowButton) {
    assistClearWindowButton.disabled = !hasTarget;
  }
}

function stopAssistTargetMonitor() {
  if (assistTargetPollTimer) {
    clearTimeout(assistTargetPollTimer);
    assistTargetPollTimer = 0;
  }
}

function scheduleAssistTargetMonitor() {
  stopAssistTargetMonitor();
  if (!state.assistTarget.enabled) {
    return;
  }
  assistTargetPollTimer = setTimeout(async () => {
    try {
      await refreshAssistTargetAvailability({ silent: true });
    } finally {
      scheduleAssistTargetMonitor();
    }
  }, 1400);
}

async function refreshAssistTargetAvailability(options = {}) {
  if (!state.assistTarget.enabled || !state.assistTarget.hwnd || assistTargetValidationPending) {
    return state.assistTarget.status !== "lost";
  }

  assistTargetValidationPending = true;
  const silent = Boolean(options.silent);
  try {
    const result = await invoke("list_open_windows");
    const items = Array.isArray(result?.items) ? result.items.map(normalizeAssistTargetWindow) : [];
    const current = items.find((item) => item.hwnd === state.assistTarget.hwnd);
    if (!current || current.isFlowDetect) {
      const wasLost = state.assistTarget.status === "lost";
      state.assistTarget = {
        ...state.assistTarget,
        status: "lost",
      };
      updateAssistTargetUI();
      if (!wasLost) {
        await invoke("hide_target_window_overlay", { clearTarget: false }).catch(() => null);
        pushAssistLog("Janela alvo perdida. Execucao pausada.", "error");
        if (!silent) {
          setMessage("A janela alvo selecionada nao esta mais disponivel.", "error");
        }
      }
      return false;
    }

    state.assistTarget = {
      ...state.assistTarget,
      enabled: true,
      status: "selected",
      title: current.title,
      className: current.className,
      hwnd: current.hwnd,
      left: current.left,
      top: current.top,
      width: current.width,
      height: current.height,
      pid: current.pid,
      lastSeenAt: Date.now(),
    };
    updateAssistTargetUI();
    return true;
  } finally {
    assistTargetValidationPending = false;
  }
}

function closeAssistWindowPicker() {
  state.assistTarget.modalOpen = false;
  if (assistWindowPickerOverlay) {
    assistWindowPickerOverlay.hidden = true;
  }
}

function renderAssistWindowPicker() {
  if (!assistWindowPickerList || !assistWindowPickerStatus) {
    return;
  }

  const items = Array.isArray(state.assistTarget.windows) ? state.assistTarget.windows : [];
  if (state.assistTarget.loading) {
    assistWindowPickerStatus.textContent = "Carregando janelas abertas...";
  } else if (!items.length) {
    assistWindowPickerStatus.textContent = "Nenhuma janela com titulo visivel foi encontrada agora.";
  } else {
    assistWindowPickerStatus.textContent = `${items.length} janela(s) encontrada(s). Escolha a correta para esta execucao.`;
  }

  if (!items.length) {
    assistWindowPickerList.innerHTML = `<div class="assist-log-line is-muted">Abra a janela do sistema que deseja automatizar e atualize a lista.</div>`;
    return;
  }

  assistWindowPickerList.innerHTML = items.map((item) => {
    const blocked = Boolean(item.isFlowDetect);
    const active = state.assistTarget.enabled && Number(state.assistTarget.hwnd) === Number(item.hwnd);
    const tagLabel = blocked ? "FlowDetect" : active ? "Atual" : "Selecionar";
    const tagClass = blocked ? "assist-window-picker-tag is-blocked" : "assist-window-picker-tag";
    return `
      <button
        class="assist-window-picker-item${blocked ? " is-blocked" : ""}"
        type="button"
        data-window-picker-hwnd="${Number(item.hwnd)}"
        ${blocked ? "disabled" : ""}
      >
        <div class="assist-window-picker-title-row">
          <strong>${escapeHtml(item.title || "Janela sem titulo")}</strong>
          <span class="${tagClass}">${escapeHtml(tagLabel)}</span>
        </div>
        <div class="assist-window-picker-meta">
          hwnd ${Number(item.hwnd)}${item.className ? ` | classe ${escapeHtml(item.className)}` : ""}
        </div>
        <div class="assist-window-picker-meta">
          ${Number(item.width)}x${Number(item.height)} | x=${Number(item.left)} y=${Number(item.top)}
        </div>
      </button>
    `;
  }).join("");
}

async function refreshAssistWindowPicker() {
  state.assistTarget.loading = true;
  renderAssistWindowPicker();
  const requestId = ++assistWindowPickerRequestId;
  try {
    const result = await invoke("list_open_windows");
    if (requestId !== assistWindowPickerRequestId) {
      return;
    }
    state.assistTarget.windows = Array.isArray(result?.items) ? result.items.map(normalizeAssistTargetWindow) : [];
  } catch (error) {
    if (requestId !== assistWindowPickerRequestId) {
      return;
    }
    state.assistTarget.windows = [];
    assistWindowPickerStatus.textContent = String(error || "Falha ao listar as janelas abertas.");
  } finally {
    if (requestId === assistWindowPickerRequestId) {
      state.assistTarget.loading = false;
      renderAssistWindowPicker();
    }
  }
}

async function openAssistWindowPicker() {
  state.assistTarget.modalOpen = true;
  if (assistWindowPickerOverlay) {
    assistWindowPickerOverlay.hidden = false;
  }
  await refreshAssistWindowPicker();
}

async function applyAssistTargetWindow(item) {
  const target = normalizeAssistTargetWindow(item);
  if (!target.hwnd || !target.title) {
    throw new Error("Selecione uma janela valida.");
  }
  if (target.isFlowDetect) {
    throw new Error("A propria janela do FlowDetect nao pode ser usada como alvo da automacao.");
  }

  const result = await invoke("show_target_window_overlay", {
    target: {
      hwnd: target.hwnd,
      title: target.title,
      className: target.className,
      left: target.left,
      top: target.top,
      width: target.width,
      height: target.height,
    },
  });
  const applied = normalizeAssistTargetWindow(result?.target || target);
  state.assistTarget = {
    ...state.assistTarget,
    enabled: true,
    status: "selected",
    title: applied.title,
    className: applied.className,
    hwnd: applied.hwnd,
    left: applied.left,
    top: applied.top,
    width: applied.width,
    height: applied.height,
    pid: target.pid,
    lastSeenAt: Date.now(),
  };
  updateAssistTargetUI();
  scheduleAssistTargetMonitor();
  closeAssistWindowPicker();
  pushAssistLog(`Janela alvo selecionada: ${applied.title} / hwnd ${applied.hwnd}`, "info");
  setMessage(`Janela alvo selecionada: ${applied.title}`, "success");
}

async function clearAssistTargetWindow(options = {}) {
  stopAssistTargetMonitor();
  await invoke("hide_target_window_overlay", { clearTarget: true }).catch(() => null);
  resetAssistTargetState();
  updateAssistTargetUI();
  if (!options.silent) {
    pushAssistLog("Janela alvo limpa para esta execucao.", "info");
    setMessage("Janela alvo removida. O comportamento atual da automacao foi mantido.", "info");
  }
}

async function ensureAssistTargetReadyForExecution() {
  if (!state.assistTarget.enabled) {
    return null;
  }
  const available = await refreshAssistTargetAvailability({ silent: true });
  if (!available || state.assistTarget.status === "lost") {
    throw new Error("A janela alvo selecionada foi perdida. Escolha outra antes de executar.");
  }
  return state.assistTarget;
}

function updateAssistProgressUI() {
  const assist = state.assist;
  const resolution = state.login.resolution || captureLoginResolution();
  const resolutionLabel = `${resolution.screenWidth || 0} x ${resolution.screenHeight || 0}`;
  syncAssistTheme();
  updateAssistTargetUI();
  assistStatusText.textContent =
    assist.mode === "running"
      ? `Executando ${assist.current}/${assist.total || 0}`
      : assist.mode === "done"
        ? "Concluido"
        : assist.mode === "failed"
          ? "Falha"
        : assist.mode === "stopped"
          ? "Interrompido"
          : "Pronto";
  assistDetailText.textContent =
    assist.description || (assist.mode === "idle" ? "Aguardando inicio de um teste." : "Sem detalhes da execucao.");
  assistOriginText.textContent = "Criador de automacoes";
  assistWindowText.textContent = state.login.profile?.nome || "Sessao local";
  assistWindowDetailText.textContent =
    state.login.authenticated
      ? `Resolucao salva: ${resolutionLabel}`
      : "Entre no programa para salvar a resolucao desta maquina.";
  assistCompanyText.textContent = assist.company || "-";
  assistModeText.textContent =
    assist.mode === "running"
      ? "A trilha fica verde conforme a execucao avanca."
      : assist.mode === "done"
        ? "Ultimo teste finalizado com sucesso."
        : assist.mode === "failed"
          ? "A execucao terminou com erro. Veja a ultima mensagem exibida."
        : assist.mode === "stopped"
          ? "Execucao interrompida pelo launcher."
          : "Modo assistido pronto para acompanhar a execucao.";
  assistPercentText.textContent = `${Math.round(assist.percent || 0)}%`;
  assistProgressFill.style.width = `${Math.max(0, Math.min(100, assist.percent || 0))}%`;
  assistProgressMeta.textContent =
    assist.total > 0 ? `${assist.current}/${assist.total} passos observados.` : "Nenhum passo em execucao.";
}

function renderAssistLogs() {
  if (!assistLogList) {
    return;
  }
  const logs = Array.isArray(state.assist.logs) ? state.assist.logs : [];
  if (!logs.length) {
    assistLogList.innerHTML = `<div class="assist-log-line is-muted">Aguardando logs da execucao...</div>`;
    return;
  }
  assistLogList.innerHTML = logs
    .slice(-18)
    .map(
      (entry) => `
        <div class="assist-log-line${entry.kind ? ` is-${escapeHtml(entry.kind)}` : ""}">
          ${escapeHtml(entry.message || "")}
        </div>
      `
    )
    .join("");
  assistLogList.scrollTop = assistLogList.scrollHeight;
}

function pushAssistLog(message, kind = "info") {
  const text = String(message || "").trim();
  if (!text) {
    return;
  }
  state.assist.logs = [...(state.assist.logs || []), { message: text, kind }].slice(-80);
  renderAssistLogs();
}

function resetAssistViewportToStart() {
  if (!assistMapList) {
    return;
  }
  assistMapList.scrollLeft = 0;
  assistMapList.scrollTop = 0;
  assistMapList.scrollTo({ left: 0, top: 0, behavior: "auto" });
}

function syncAssistEdgeSpacers() {
  if (!assistMapList) {
    return;
  }

  const assistFlowRow = assistMapList.querySelector(".assist-flow-row");
  if (!assistFlowRow) {
    return;
  }

  const assistCards = assistFlowRow.querySelectorAll(".assist-card");
  if (!assistCards.length) {
    return;
  }

  const startSpacer = assistFlowRow.querySelector(".assist-edge-spacer.is-start");
  const endSpacer = assistFlowRow.querySelector(".assist-edge-spacer.is-end");
  const containerWidth = assistMapList.clientWidth || assistMapList.getBoundingClientRect().width || 0;
  const firstCard = assistCards[0];
  const lastCard = assistCards[assistCards.length - 1];

  if (startSpacer && firstCard) {
    const startWidth = Math.max(0, Math.round(containerWidth / 2 - firstCard.offsetWidth / 2));
    startSpacer.style.width = `${startWidth}px`;
  }

  if (endSpacer && lastCard) {
    const trailingElement = endSpacer.previousElementSibling?.classList?.contains("assist-end")
      ? endSpacer.previousElementSibling
      : null;
    const trailingWidth = trailingElement?.offsetWidth ?? 0;
    const endWidth = Math.max(0, Math.round(containerWidth / 2 - lastCard.offsetWidth / 2 - trailingWidth));
    endSpacer.style.width = `${endWidth}px`;
  }
}

function centerFirstAssistOrder(behavior = "auto") {
  const firstAssistOrder = getAssistInitialOrder();
  if (firstAssistOrder == null) {
    resetAssistViewportToStart();
    return;
  }

  syncAssistEdgeSpacers();
  centerAssistOrder(firstAssistOrder, behavior);
}

function renderAssistExecutionMap() {
  const currentSequence = getAssistCurrentSequence();
  const events = getCommandMapEvents(currentSequence);
  const fallbackEvents = getAssistRoadmapEvents();
  const visibleEvents = events.length ? events : fallbackEvents;
  syncAssistTheme();
  assistMapList.innerHTML = "";

  if (!visibleEvents.length) {
    assistMapList.innerHTML = `<div class="empty-state">Adicione blocos ao roteiro para acompanhar a execucao assistida aqui.</div>`;
    return;
  }

  const hasKnownCurrentOrder = visibleEvents.some((event) => Number(event.order) === Number(state.assist.currentOrder));
  const isRunningAssist = state.assist.mode === "running";
  if (state.assist.mode === "idle" || !hasKnownCurrentOrder) {
    state.assist.currentOrder = visibleEvents[0]?.order ?? getAssistInitialOrder() ?? null;
  }

  const activeOrder = state.assist.currentOrder;
  const activeIndex = visibleEvents.findIndex((event) => Number(event.order) === Number(activeOrder));
  const hasProgress = activeIndex >= 0 && state.assist.mode !== "idle";
  const leadingSpacer = `<div class="assist-edge-spacer is-start" aria-hidden="true"></div>`;
  const trailingSpacer = `<div class="assist-edge-spacer is-end" aria-hidden="true"></div>`;

  const markup = visibleEvents
    .map((event, index) => {
      const isDone = hasProgress && index < activeIndex;
      const isCurrent = activeIndex >= 0 ? index === activeIndex : index === 0;
      const stateClass = isCurrent ? "is-current" : isDone ? "is-done" : "is-upcoming";
      const connectorClass =
        hasProgress && index < activeIndex
          ? "is-done"
          : hasProgress && index === activeIndex - 1
            ? "is-current"
            : "is-upcoming";

      const card = `
        <article class="assist-card ${stateClass}" data-assist-order="${Number(event.order)}">
          <div class="assist-card-top">
            <span class="assist-card-index">${String(event.order).padStart(2, "0")}</span>
            <span class="assist-card-chip">${escapeHtml(event.type.replaceAll("_", " "))}</span>
          </div>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.subtitle)}</p>
        </article>
      `;

      if (index === visibleEvents.length - 1) {
        return `${card}<div class="assist-end ${state.assist.mode === "done" ? "is-done" : ""}">Fim</div>`;
      }

      return `
        ${card}
        <div class="assist-connector ${connectorClass}">
          <span></span>
        </div>
      `;
    })
    .join("");

  assistMapList.innerHTML = `<div class="assist-flow-row">${leadingSpacer}${markup}${trailingSpacer}</div>`;
  requestAnimationFrame(() => {
    syncAssistEdgeSpacers();
    if (state.assist.mode === "running" && state.assist.currentOrder != null) {
      centerAssistOrder(state.assist.currentOrder, "smooth");
      return;
    }
    centerFirstAssistOrder("auto");
  });
}

function centerAssistOrder(order, behavior = "smooth") {
  if (!assistMapList || order == null) {
    return;
  }

  const target = assistMapList.querySelector(`[data-assist-order="${Number(order)}"]`);
  if (!target) {
    return;
  }

  const containerRect = assistMapList.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const currentScrollLeft = assistMapList.scrollLeft;
  const delta = (targetRect.left + targetRect.width / 2) - (containerRect.left + containerRect.width / 2);
  const left = Math.max(0, currentScrollLeft + delta);

  assistMapList.scrollTo({
    left,
    behavior,
  });
}

function resetAssistState(mode = "idle") {
  state.assist = {
    mode,
    current: 0,
    total: 0,
    percent: 0,
    description: "",
    company: "",
    windowTitle: "",
    currentOrder: mode === "running" ? null : getAssistInitialOrder(),
    success: null,
    logs: [],
  };
  updateAssistProgressUI();
  renderAssistLogs();
  renderAssistExecutionMap();
}

function clearAssistPlaybackTimer() {
  if (state.assistPlayback.timer) {
    clearTimeout(state.assistPlayback.timer);
    state.assistPlayback.timer = null;
  }
}

function stopAssistPlayback() {
  clearAssistPlaybackTimer();
  state.assistPlayback.running = false;
  state.assistPlayback.mode = "idle";
  state.assistPlayback.steps = [];
  state.assistPlayback.index = 0;
}

function formatAssistValue(value, max = 40) {
  const text = String(value ?? "").replaceAll("\n", " ").replaceAll("\r", " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getEditableTextEvents(roadmap = state.roadmap) {
  return getAssistRoadmapEvents(roadmap)
    .filter((event) => event?.type === "texto_livre" && Boolean(event?.details?.editavel_execucao));
}

function getEditableTextLabel(event) {
  const customLabel = String(event?.details?.rotulo_execucao ?? "").trim();
  if (customLabel) {
    return customLabel;
  }
  const order = event?.order ?? event?.ordem ?? "";
  const preview = formatAssistValue(event?.text ?? event?.texto ?? "", 28);
  return preview ? `Bloco ${order} - ${preview}` : `Bloco ${order}`;
}

function renderAssistEditableTexts() {
  if (!assistEditableTextList) {
    return;
  }

  const events = getEditableTextEvents();
  if (!events.length) {
    assistEditableTextList.innerHTML = `
      <div class="assist-editable-text-empty">
        Nenhum bloco de texto marcado para alterar no inicio.
      </div>
    `;
    return;
  }

  assistEditableTextList.innerHTML = events
    .map((event) => {
      const orderKey = String(event.order);
      const currentValue = Object.prototype.hasOwnProperty.call(state.editableTextOverrides, orderKey)
        ? state.editableTextOverrides[orderKey]
        : event.text ?? event.texto ?? "";
      return `
        <label class="assist-editable-text-item">
          <span>
            <strong>${escapeHtml(getEditableTextLabel(event))}</strong>
            <small>Pagina ${escapeHtml(sequenceLabel(event.sequence ?? event.sequencia ?? "principal"))}</small>
          </span>
          <textarea data-editable-text-order="${escapeHtml(orderKey)}" rows="2">${escapeHtml(currentValue)}</textarea>
        </label>
      `;
    })
    .join("");
}

function collectAssistEditableTextOverrides() {
  if (!assistEditableTextList) {
    return {};
  }

  const overrides = {};
  assistEditableTextList.querySelectorAll("[data-editable-text-order]").forEach((field) => {
    const order = String(field.dataset.editableTextOrder || "").trim();
    if (order) {
      overrides[order] = field.value ?? "";
    }
  });
  state.editableTextOverrides = { ...state.editableTextOverrides, ...overrides };
  return overrides;
}

function editableTextOverridesJson() {
  const overrides = collectAssistEditableTextOverrides();
  return Object.keys(overrides).length ? JSON.stringify(overrides) : "";
}

function renderStudioControlEditableTexts() {
  if (!studioControlEditableTextPanel || !studioControlEditableTextList) {
    return;
  }

  const events = getEditableTextEvents(state.remoteControl.roadmap);
  studioControlEditableTextPanel.hidden = !events.length;
  if (!events.length) {
    studioControlEditableTextList.innerHTML = "";
    return;
  }

  studioControlEditableTextList.innerHTML = events
    .map((event) => {
      const orderKey = String(event.order ?? event.ordem ?? "");
      const currentValue = Object.prototype.hasOwnProperty.call(state.remoteControl.editableTextOverrides, orderKey)
        ? state.remoteControl.editableTextOverrides[orderKey]
        : event.text ?? event.texto ?? "";
      return `
        <label class="studio-control-editable-item">
          <span>
            <strong>${escapeHtml(getEditableTextLabel(event))}</strong>
            <small>${escapeHtml(sequenceLabel(event.sequence ?? event.sequencia ?? "principal"))} | bloco ${escapeHtml(orderKey)}</small>
          </span>
          <textarea data-studio-control-editable-order="${escapeHtml(orderKey)}" rows="2">${escapeHtml(currentValue)}</textarea>
        </label>
      `;
    })
    .join("");
}

function collectStudioControlEditableTextOverrides() {
  if (!studioControlEditableTextList) {
    return {};
  }
  const overrides = {};
  studioControlEditableTextList.querySelectorAll("[data-studio-control-editable-order]").forEach((field) => {
    const order = String(field.dataset.studioControlEditableOrder || "").trim();
    if (order) {
      overrides[order] = field.value ?? "";
    }
  });
  state.remoteControl.editableTextOverrides = {
    ...state.remoteControl.editableTextOverrides,
    ...overrides,
  };
  return overrides;
}

function studioControlEditableTextOverridesJson() {
  const overrides = collectStudioControlEditableTextOverrides();
  return Object.keys(overrides).length ? JSON.stringify(overrides) : "";
}

function getSpreadsheetEventValues(event) {
  const values = event?.details?.valores ?? event?.details?.values ?? event?.detalhes?.valores ?? event?.detalhes?.values ?? [];
  return Array.isArray(values) ? values : [];
}

function getSpreadsheetLoopCount(event) {
  const values = getSpreadsheetEventValues(event);
  if (values.length) {
    return values.length;
  }
  const description = String(event?.description ?? "").trim();
  const match = description.match(/(\d+)\s+itens?/i);
  return match ? Number(match[1]) : 0;
}

function getSpreadsheetLoopBadgeLabel(event) {
  const total = getSpreadsheetLoopCount(event);
  return `${total} ${total === 1 ? "loop" : "loops"}`;
}

function isLoopMarkerType(type) {
  return type === "inicio_loop" || type === "fim_loop";
}

function normalizeExecutionFeedbackMessage(message) {
  const text = String(message ?? "").trim();
  if (!text) {
    return "Execucao iniciada com sucesso.";
  }
  return text
    .replace(/^Teste simples iniciado/i, "Execucao iniciada")
    .replace(/^Teste com loop iniciado/i, "Execucao iniciada")
    .replace("A automacao vai executar uma vez", "A automacao vai executar")
    .replace("O executor vai procurar a linha", "A automacao vai iniciar pela linha")
    .replace("o teste simples", "a automacao")
    .replace("o teste direto com loop", "a automacao");
}

function describeAssistBaseEvent(event, index = null, total = null, value = null) {
  if (!event) {
    return "Passo da automacao";
  }

  const order = Number(event.order || event.ordem || 0);
  const type = String(event.type || event.tipo || "");
  const details = event.details || event.detalhes || {};

  if (type === "inicio_loop") {
    return `Evento #${order}: inicio do loop`;
  }

  if (type === "fim_loop") {
    return `Evento #${order}: fim do loop`;
  }

  if (type === "texto_livre") {
    return `Evento #${order}: texto ${formatAssistValue(event.text || event.texto || "", 28)}`;
  }

  if (type === "tecla" || type === "atalho") {
    const keys = Array.isArray(event.keys || event.teclas) ? (event.keys || event.teclas) : [];
    const label = keys.join(" + ") || formatAssistValue(event.text || event.texto || "tecla", 24);
    return `Evento #${order}: ${label}`;
  }

  if (type === "mouse_click") {
    const button = String(details.button || details.botao || "left").toUpperCase();
    const x = Number(details.x || 0);
    const y = Number(details.y || 0);
    const clicks = Number(details.clicks || details.cliques || 1);
    return `Evento #${order}: mouse ${button} ${clicks === 2 ? "duplo" : "simples"} X=${x} Y=${y}`;
  }

  if (type === "sequencia_planilha") {
    const column = String(details.column || details.coluna || "coluna");
    const totalItems = total ?? getSpreadsheetEventValues(event).length;
    if (index != null) {
      return `Evento #${order}: ${column} ${index + 1}/${totalItems} (${formatAssistValue(value ?? "", 22)})`;
    }
    return `Evento #${order}: sequencia da coluna ${column}`;
  }

  return `Evento #${order}: ${formatAssistValue(event.text || event.texto || "acao", 28)}`;
}

function buildAssistSimulationSteps(mode, loopStart) {
  const roadmap = state.roadmap;
  if (!(roadmap?.events ?? []).length) {
    return [];
  }

  const startSequence = resolveRoadmapInitialSequence(roadmap);
  const flowTrace = traceCommandMapExecutionFlow({
    roadmap,
    startSequence,
  });
  const steps = [];
  const appendTraceEvents = (events, options = {}) => {
    const { row = null, rowIndex = null, rowPosition = null, totalRows = null } = options;
    events.forEach((event) => {
      if (isLoopMarkerType(event.type)) {
        return;
      }
      const delayBefore = Math.max(0, parseNumber(event.delay ?? event.intervalo_antes, 0));
      if (row && event.type === "sequencia_planilha") {
        const values = getSpreadsheetEventValues(event);
        const relativeIndex = rowIndex ?? 0;
        const displayIndex = rowPosition ?? relativeIndex;
        const value = values[relativeIndex] ?? row.value ?? "";
        steps.push({
          order: Number(event.order),
          wait: delayBefore,
          company: String(row.company || ""),
          description:
            `Iteracao ${displayIndex + 1}/${totalRows || values.length || 1} - linha ${row.row_number} - `
            + describeAssistBaseEvent(event, relativeIndex, values.length || totalRows, value),
        });
        return;
      }

      if (!row && event.type === "sequencia_planilha") {
        const values = getSpreadsheetEventValues(event);
        const details = event.details || event.detalhes || {};
        const intervalBetween = Math.max(0, parseNumber(details.interval_between ?? details.intervalo_entre_itens, 0.5));
        values.forEach((value, index) => {
          steps.push({
            order: Number(event.order),
            wait: index === 0 ? delayBefore : intervalBetween,
            company: "",
            description: describeAssistBaseEvent(event, index, values.length, value),
          });
        });
        return;
      }

      steps.push({
        order: Number(event.order),
        wait: delayBefore,
        company: String(row?.company || ""),
        description: row
          ? `Iteracao ${(rowPosition ?? rowIndex ?? 0) + 1}/${totalRows || 1} - ${describeAssistBaseEvent(event)}`
          : describeAssistBaseEvent(event),
      });
    });
  };

  if (mode === "normal") {
    appendTraceEvents(flowTrace.events);
    return steps;
  }

  const primaryLoopRows = state.testLoopData?.rows ?? [];
  if (!primaryLoopRows.length) {
    throw new Error("Nao ha dados de loop disponiveis para a execucao assistida.");
  }

  let startIndex = primaryLoopRows.findIndex((row) => Number(row.row_number) >= loopStart);
  if (startIndex < 0) {
    const lastLine = primaryLoopRows.at(-1)?.row_number ?? 0;
    throw new Error(`A linha ${loopStart} nao existe nesse loop. Ultima linha disponivel: ${lastLine}.`);
  }

  const iterations = primaryLoopRows.slice(startIndex);
  const totalIterations = iterations.length;
  const markerLoopRange = getLoopMarkerRange(roadmap);
  if (markerLoopRange) {
    const preLoopTrace = traceCommandMapExecutionFlow({
      roadmap,
      startSequence,
      blockBoundarySequence: markerLoopRange.sequence,
      stopBeforeBlockOrder: markerLoopRange.startOrder,
    });
    appendTraceEvents(preLoopTrace.events);

    const loopTrace = traceCommandMapExecutionFlow({
      roadmap,
      startSequence: markerLoopRange.sequence,
      startIndex: markerLoopRange.startIndex + 1,
      limitSequence: markerLoopRange.sequence,
      blockBoundarySequence: markerLoopRange.sequence,
      minBlockOrder: markerLoopRange.startOrder + 1,
      stopBeforeBlockOrder: markerLoopRange.endOrder,
    });

    iterations.forEach((row, iterationIndex) => {
      appendTraceEvents(loopTrace.events, {
        row,
        rowIndex: startIndex + iterationIndex,
        rowPosition: iterationIndex,
        totalRows: totalIterations,
      });
    });

    if (loopTrace.exit?.action === "ir_para_bloco" || loopTrace.exit?.action === "ir_para_sequencia") {
      const postLoopStart = resolveAssistPostLoopStart(loopTrace, roadmap);
      if (postLoopStart?.sequence) {
        const postLoopTrace = traceCommandMapExecutionFlow({
          roadmap,
          startSequence: postLoopStart.sequence,
          startIndex: postLoopStart.startIndex || 0,
        });
        appendTraceEvents(postLoopTrace.events);
      }
      return steps;
    }

    const postLoopTrace = traceCommandMapExecutionFlow({
      roadmap,
      startSequence: markerLoopRange.sequence,
      startIndex: markerLoopRange.endIndex + 1,
    });
    appendTraceEvents(postLoopTrace.events);
    return steps;
  }

  const configuredLoopSequences = getConfiguredLoopSequences(roadmap);
  if (configuredLoopSequences.length) {
    const preLoopTrace = traceCommandMapUntilLoopEntry({
      roadmap,
      startSequence,
      loopSequences: configuredLoopSequences,
    });
    const loopSequence = preLoopTrace.loopSequence || "";
    if (loopSequence) {
      appendTraceEvents(preLoopTrace.events);
      const loopTrace = traceCommandMapLoopRegion({
        roadmap,
        startSequence: loopSequence,
        startIndex: preLoopTrace.startIndex || 0,
        loopSequences: configuredLoopSequences,
      });

      iterations.forEach((row, iterationIndex) => {
        appendTraceEvents(loopTrace.events, {
          row,
          rowIndex: startIndex + iterationIndex,
          rowPosition: iterationIndex,
          totalRows: totalIterations,
        });
      });

      const postLoopStart = resolveAssistPostLoopStart(loopTrace, roadmap);
      if (postLoopStart?.sequence) {
        const postLoopTrace = traceCommandMapExecutionFlow({
          roadmap,
          startSequence: postLoopStart.sequence,
          startIndex: postLoopStart.startIndex || 0,
        });
        appendTraceEvents(postLoopTrace.events);
      }

      return steps;
    }
  }

  iterations.forEach((row, iterationIndex) => {
    appendTraceEvents(flowTrace.events, {
      row,
      rowIndex: startIndex + iterationIndex,
      rowPosition: iterationIndex,
      totalRows: totalIterations,
    });
  });

  return steps;
}

function scheduleAssistPlaybackStep(token, delayMs) {
  clearAssistPlaybackTimer();
  state.assistPlayback.timer = setTimeout(() => {
    if (!state.assistPlayback.running || state.assistPlayback.token !== token) {
      return;
    }

    const steps = state.assistPlayback.steps || [];
    const index = state.assistPlayback.index || 0;
    const step = steps[index];
    if (!step) {
      state.assist.mode = "done";
      state.assist.success = true;
      state.assist.current = state.assist.total;
      state.assist.percent = 100;
      state.assist.description = "Execucao assistida concluida.";
      updateAssistProgressUI();
      renderAssistExecutionMap();
      stopAssistPlayback();
      setTestExecutionState(false);
      return;
    }

    state.assist.mode = "running";
    state.assist.currentOrder = step.order;
    state.assist.current = index + 1;
    state.assist.total = steps.length;
    state.assist.percent = (state.assist.current / state.assist.total) * 100;
    state.assist.company = step.company || "";
    state.assist.description = step.description || "Executando etapa da automacao.";
    updateAssistProgressUI();
    renderAssistExecutionMap();

    state.assistPlayback.index = index + 1;
    const nextDelay = Math.max(140, Math.round((Number(step.wait || 0) || 0) * 1000));
    scheduleAssistPlaybackStep(token, nextDelay);
  }, Math.max(0, delayMs));
}

function startAssistPlayback(mode, initialDelaySeconds, loopStart = 1) {
  const steps = buildAssistSimulationSteps(mode, loopStart);
  const token = Date.now();
  state.assistPlayback.token = token;
  state.assistPlayback.running = true;
  state.assistPlayback.mode = mode;
  state.assistPlayback.steps = steps;
  state.assistPlayback.index = 0;
  state.assist.total = steps.length;
  state.assist.current = 0;
  state.assist.percent = 0;
  state.assist.currentOrder = getAssistInitialOrder();
  updateAssistProgressUI();
  renderAssistExecutionMap();
  scheduleAssistPlaybackStep(token, Math.max(0, initialDelaySeconds) * 1000);
}

async function startQuickTestExecution(forceAssist = false) {
  const fromAssist = forceAssist || assistPanel.classList.contains("is-active");
  try {
    if (!(await ensureCommandMapPreparedForExecution({
      actionLabel: "executar a automacao",
      onInfo: fromAssist
        ? (message) => surfaceAssistExecutionMessage(message, "info")
        : null,
      onError: fromAssist
        ? (message) => surfaceAssistExecutionMessage(message, "error")
        : null,
    }))) {
      return;
    }
    const activeTarget = await ensureAssistTargetReadyForExecution();

    if (state.testLaunchPending) {
      const message = "Ja existe um disparo de teste em andamento.";
      if (fromAssist) {
        surfaceAssistExecutionMessage(message, "error");
      }
      setMessage(message, "error");
      return;
    }
    if (isTestExecutionActive()) {
      const message = "Ja existe uma automacao em execucao. Pare a atual antes de iniciar outra.";
      if (fromAssist) {
        surfaceAssistExecutionMessage(message, "error");
      }
      setMessage(message, "error");
      return;
    }

    const delay = parseNumber(fromAssist ? assistDelayInput.value : testDelayInput.value, 0);
    const minimizeWindow = shouldMinimizeExecutionWindow();
    const textOverrides = editableTextOverridesJson();
    syncTestInputsFrom(fromAssist ? "assist" : "top");
    state.testLaunchPending = true;
    setMessage("Iniciando execucao...", "info");
    setBusy("Iniciando execucao");
    setTestExecutionState(true);
    resetAssistState("running");
    state.assist.description = `Voce tem ${delay}s para focar a janela onde a automacao deve executar.`;
    updateAssistProgressUI();
    if (activeTarget) {
      pushAssistLog(`Executando nesta janela: ${activeTarget.title} / hwnd ${activeTarget.hwnd}`, "info");
    } else {
      pushAssistLog("Nenhuma janela alvo selecionada. Captura e reconhecimento vao usar a tela inteira.", "info");
    }
    pushAssistLog(`Execucao iniciada. Atraso inicial: ${delay}s.`, "info");
    if (textOverrides) {
      pushAssistLog("Textos editaveis aplicados para esta execucao.", "info");
    }
    const result = fromAssist
      ? await invoke("launch_assisted_quick_test", { delay, minimizeWindow, textOverrides })
      : await invoke("launch_quick_test", { delay, minimizeWindow, textOverrides });
    triggerSuccessPulse(fromAssist ? assistQuickButton : testOnceButton);
    setBusy("Pronto");
    setMessage(normalizeExecutionFeedbackMessage(result), "success");
  } catch (error) {
    setBusy("Erro");
    setTestExecutionState(false);
    stopAssistPlayback();
    resetAssistState("idle");
    const message = String(error);
    if (fromAssist) {
      surfaceAssistExecutionMessage(message, "error");
    }
    setMessage(message, "error");
  } finally {
    state.testLaunchPending = false;
  }
}

async function startLoopTestExecution(forceAssist = false) {
  const fromAssist = forceAssist || assistPanel.classList.contains("is-active");
  try {
    if (!hasSpreadsheetLoopBlock()) {
      await startQuickTestExecution(forceAssist);
      return;
    }
    if (!(await ensureCommandMapPreparedForExecution({
      actionLabel: "executar a automacao",
      onInfo: fromAssist
        ? (message) => surfaceAssistExecutionMessage(message, "info")
        : null,
      onError: fromAssist
        ? (message) => surfaceAssistExecutionMessage(message, "error")
        : null,
    }))) {
      return;
    }
    const activeTarget = await ensureAssistTargetReadyForExecution();

    await refreshTestLoopData();

    if (state.testLaunchPending) {
      const message = "Ja existe um disparo de teste em andamento.";
      if (fromAssist) {
        surfaceAssistExecutionMessage(message, "error");
      }
      setMessage(message, "error");
      return;
    }
    if (isTestExecutionActive()) {
      const message = "Ja existe uma automacao em execucao. Pare a atual antes de iniciar outra.";
      if (fromAssist) {
        surfaceAssistExecutionMessage(message, "error");
      }
      setMessage(message, "error");
      return;
    }

    const delay = parseNumber(fromAssist ? assistDelayInput.value : testDelayInput.value, 0);
    const minimizeWindow = shouldMinimizeExecutionWindow();
    const textOverrides = editableTextOverridesJson();
    const loopStart = Math.max(
      1,
      Math.trunc(parseNumber(fromAssist ? assistLoopStartInput.value : testLoopStartInput.value, 1)),
    );
    syncTestInputsFrom(fromAssist ? "assist" : "top");
    state.testLaunchPending = true;
    setMessage("Iniciando execucao com planilha...", "info");
    setBusy("Iniciando execucao");
    setTestExecutionState(true);
    resetAssistState("running");
    state.assist.description =
      `Voce tem ${delay}s para focar a janela da automacao. O loop vai procurar a linha ${loopStart}.`;
    updateAssistProgressUI();
    if (activeTarget) {
      pushAssistLog(`Executando nesta janela: ${activeTarget.title} / hwnd ${activeTarget.hwnd}`, "info");
    } else {
      pushAssistLog("Nenhuma janela alvo selecionada. Captura e reconhecimento vao usar a tela inteira.", "info");
    }
    pushAssistLog(`Execucao iniciada com planilha. Linha inicial: ${loopStart}. Atraso: ${delay}s.`, "info");
    if (textOverrides) {
      pushAssistLog("Textos editaveis aplicados para esta execucao.", "info");
    }
    const result = fromAssist
      ? await invoke("launch_assisted_loop_test", {
          delay,
          loopStart,
          minimizeWindow,
          textOverrides,
        })
      : await invoke("launch_test_automation", {
          delay,
          loopStart,
          minimizeWindow,
          textOverrides,
        });
    triggerSuccessPulse(fromAssist ? assistQuickButton : testOnceButton);
    setBusy("Pronto");
    setMessage(normalizeExecutionFeedbackMessage(result), "success");
  } catch (error) {
    setBusy("Erro");
    setTestExecutionState(false);
    stopAssistPlayback();
    resetAssistState("idle");
    const message = String(error);
    if (fromAssist) {
      surfaceAssistExecutionMessage(message, "error");
    }
    setMessage(message, "error");
  } finally {
    state.testLaunchPending = false;
  }
}

async function stopCurrentTestExecution() {
  try {
    state.testLaunchPending = false;
    setMessage("Solicitando parada da automacao...", "info");
    const result = await invoke("stop_test_execution");
    state.assist.mode = "stopped";
    state.assist.description = "Parada solicitada pelo launcher.";
    stopAssistPlayback();
    updateAssistProgressUI();
    setTestExecutionState(false);
    setBusy("Pronto");
    setMessage(result, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function startAutoExecution(forceAssist = false) {
  if (hasSpreadsheetLoopBlock()) {
    await startLoopTestExecution(forceAssist);
    return;
  }
  await startQuickTestExecution(forceAssist);
}

window.handleExecuteClick = () => {
  startAutoExecution(false);
};

window.handleAssistExecuteClick = () => {
  startAutoExecution(true);
};

window.handleQuickTestClick = () => {
  startAutoExecution(false);
};

window.handleLoopTestClick = () => {
  startAutoExecution(false);
};

window.handleAssistQuickTestClick = () => {
  startAutoExecution(true);
};

window.handleAssistLoopTestClick = () => {
  startAutoExecution(true);
};

window.handleStopTestClick = () => {
  stopCurrentTestExecution();
};

function registerExecutionActionButtons() {
  testOnceButton?.addEventListener("click", () => {
    if (messageBar) {
      messageBar.textContent = "Iniciando execucao...";
    }
    window.handleExecuteClick?.();
  });

  assistQuickButton?.addEventListener("click", () => {
    if (assistDetailText) {
      assistDetailText.textContent = "Iniciando execucao assistida...";
    }
    if (messageBar) {
      messageBar.textContent = "Iniciando execucao assistida...";
    }
    window.handleAssistExecuteClick?.();
  });

  stopTestButton?.addEventListener("click", () => {
    if (messageBar) {
      messageBar.textContent = "Solicitando parada da automacao...";
    }
    window.handleStopTestClick?.();
  });

  assistStopButton?.addEventListener("click", () => {
    if (assistDetailText) {
      assistDetailText.textContent = "Solicitando parada da automacao...";
    }
    if (messageBar) {
      messageBar.textContent = "Solicitando parada da automacao...";
    }
    window.handleStopTestClick?.();
  });
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function setMessage(message, variant = "info") {
  messageBar.textContent = message;
  messageBar.className = "message-bar";
  if (variant === "success") {
    messageBar.classList.add("is-success");
  } else if (variant === "error") {
    messageBar.classList.add("is-error");
  }
}

function updateCommandMapSaveUI() {
  if (!mapSaveButton || !mapSavePercent || !mapSaveFill || !mapSaveStatus) {
    return;
  }

  const shell = mapSaveButton.closest(".command-map-save-panel");
  const percent = Math.max(0, Math.min(100, Math.round(Number(state.commandMapSave.percent) || 0)));
  mapSavePercent.textContent = `${percent}%`;
  mapSaveFill.style.width = `${percent}%`;
  mapSaveStatus.textContent = state.commandMapSave.status || "Mapa ainda nao salvo.";
  mapSaveButton.disabled = Boolean(state.commandMapSave.running);
  mapSaveButton.textContent = state.commandMapSave.running ? "Salvando..." : "Salvar mapa";

  shell?.classList.toggle("is-running", Boolean(state.commandMapSave.running));
  shell?.classList.toggle("is-success", !state.commandMapSave.running && percent >= 100 && !state.commandMapSave.dirty);
  shell?.classList.toggle("is-dirty", Boolean(state.commandMapSave.dirty) && !state.commandMapSave.running);
}

function setCommandMapSaveState(partial = {}) {
  state.commandMapSave = {
    ...state.commandMapSave,
    ...partial,
  };
  updateCommandMapSaveUI();
}

function markCommandMapSaveDirty() {
  setCommandMapSaveState({
    dirty: true,
    percent: 0,
    status: "Alteracoes pendentes no mapa.",
  });
}

function syncCommandMapSaveStateWithPending(pendingSnapshots = null) {
  if (state.commandMapSave.running) {
    return Array.isArray(pendingSnapshots) ? pendingSnapshots : [];
  }

  const pending = Array.isArray(pendingSnapshots)
    ? pendingSnapshots
    : getPendingCommandMapSnapshots();

  if (pending.length) {
    setCommandMapSaveState({
      dirty: true,
      percent: 0,
      status: "Alteracoes pendentes no mapa. Clique em Salvar mapa quando quiser persistir.",
    });
    return pending;
  }

  setCommandMapSaveState({
    dirty: false,
    percent: 100,
    status: "Mapa sincronizado e pronto para o loop.",
  });
  return pending;
}

function ensureCommandMapSavedBefore(actionLabel = "continuar") {
  const pending = syncCommandMapSaveStateWithPending();
  if (pending.length) {
    setMessage(`Existem alteracoes pendentes no mapa. Clique em Salvar mapa antes de ${actionLabel}.`, "error");
    return false;
  }
  return true;
}

async function ensureCommandMapPreparedForExecution(options = {}) {
  const {
    actionLabel = "executar a automacao",
    onInfo = null,
    onError = null,
  } = options;
  const pending = syncCommandMapSaveStateWithPending();
  if (!pending.length) {
    return true;
  }

  const infoMessage = pending.length === 1
    ? "1 bloco pendente detectado. Sincronizando o mapa antes de executar..."
    : `${pending.length} blocos pendentes detectados. Sincronizando o mapa antes de executar...`;

  if (typeof onInfo === "function") {
    onInfo(infoMessage);
  }
  setBusy("Sincronizando mapa");
  setMessage(infoMessage, "info");

  try {
    setCommandMapSaveState({
      running: true,
      dirty: true,
      percent: 0,
      status: "Sincronizando alteracoes do mapa para executar...",
    });

    const result = await persistCommandMapDraftsForExecution({
      onProgress: ({ current, total, percent }) => {
        setCommandMapSaveState({
          running: total > 0 && current < total,
          dirty: true,
          percent,
          status: total
            ? `Sincronizando blocos ${current}/${total} antes da execucao...`
            : "Nenhuma alteracao pendente no mapa.",
        });
      },
    });

    setCommandMapSaveState({
      running: false,
      dirty: false,
      percent: 100,
      status: result.total
        ? "Mapa sincronizado e pronto para executar."
        : "Mapa ja estava sincronizado para executar.",
    });
    setBusy("Pronto");
    return true;
  } catch (error) {
    const message = `Nao foi possivel sincronizar o mapa antes de ${actionLabel}: ${String(error)}`;
    setCommandMapSaveState({
      running: false,
      dirty: true,
      status: message,
    });
    setBusy("Erro");
    if (typeof onError === "function") {
      onError(message);
    }
    setMessage(message, "error");
    return false;
  }
}

function nextCommandMapClientKey() {
  commandMapClientKeySequence += 1;
  return `command-card-${commandMapClientKeySequence}`;
}

function buildCommandEventFingerprint(event = {}) {
  return JSON.stringify([
    event.type || "",
    event.title || "",
    event.subtitle || "",
    event.command || "",
    event.delay ?? "",
  ]);
}

function commandEventClientKey(event = {}) {
  return String(event?.clientKey || "").trim();
}

function findRoadmapEventByClientKey(clientKey) {
  const normalizedClientKey = String(clientKey || "").trim();
  if (!normalizedClientKey) {
    return null;
  }
  return (state.roadmap?.events ?? []).find((event) => commandEventClientKey(event) === normalizedClientKey) || null;
}

function normalizeKeysDraftValue(value) {
  return String(value || "")
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
}

function applySuccessFlowDraft(details, values) {
  details.ao_sucesso = values.successAction || "continuar";
  details.bloco_sucesso = optionalPositiveInt(values.successBlock) || "";
  details.sequencia_sucesso = values.successAction === "ir_para_sequencia"
    ? optionalSequenceValue(values.successSequence) || ""
    : "";
  details.atraso_antes_sequencia_sucesso = transitionSequenceDelayArg(
    values.successAction,
    values.successSequenceDelay,
  );
  return details;
}

function applyCommandMapDraftToEvent(event) {
  const clientKey = commandEventClientKey(event);
  const draft = state.commandMapDrafts?.[clientKey];
  if (!clientKey || !draft?.values) {
    return event;
  }

  const values = draft.values;
  const nextEvent = {
    ...event,
    delay: parseNumber(values.delay, event.delay ?? 0),
    details: {
      ...(event.details ?? {}),
    },
  };
  const details = nextEvent.details;

  if (nextEvent.type === "texto_livre") {
    nextEvent.text = values.text ?? nextEvent.text;
    applySuccessFlowDraft(details, values);
    return nextEvent;
  }

  if (nextEvent.type === "tecla" || nextEvent.type === "atalho") {
    nextEvent.keys = normalizeKeysDraftValue(values.keys);
    details.repeticoes = Math.max(1, Math.trunc(parseNumber(values.repeat, details.repeticoes ?? 1)));
    applySuccessFlowDraft(details, values);
    return nextEvent;
  }

  if (nextEvent.type === "mouse_click") {
    details.x = parseNumber(values.x, details.x ?? 0);
    details.y = parseNumber(values.y, details.y ?? 0);
    details.botao = values.button || details.botao || "left";
    details.cliques = Math.max(1, Math.trunc(parseNumber(values.clicks, details.cliques ?? details.clicks ?? 1)));
    details.clicks = details.cliques;
    applySuccessFlowDraft(details, values);
    return nextEvent;
  }

  if (nextEvent.type === "clicar_imagem") {
    details.imagem = values.imagePath ?? details.imagem ?? "";
    details.timeout = parseNumber(values.timeout, details.timeout ?? 10);
    details.confianca = parseNumber(values.confidence, details.confianca ?? 0.8);
    details.perfil_busca = normalizeRecognitionProfile(values.searchProfile, details.perfil_busca ?? "balanced");
    details.modo_area_busca = "target_window";
    details.area_busca_x = 0;
    details.area_busca_y = 0;
    details.area_busca_largura = 0;
    details.area_busca_altura = 0;
    details.janela_alvo = normalizeRecognitionWindowTitle(values.windowTitle || details.janela_alvo || "");
    details.texto_ocr_esperado = values.expectedOcrText ?? details.texto_ocr_esperado ?? "";
    details.clicar = recognitionClicksFromMode(values.recognitionClickMode, 1) > 0;
    details.clicks = recognitionClicksFromMode(values.recognitionClickMode, 1);
    details.cliques = details.clicks;
    details.ao_nao_encontrar = values.failureAction || "parar";
    details.sequencia_nao_encontrar = values.failureAction === "ir_para_sequencia"
      ? optionalSequenceValue(values.failureSequence) || ""
      : "";
    details.bloco_nao_encontrar = optionalPositiveInt(values.failureBlock) || "";
    details.atraso_antes_sequencia_nao_encontrar = transitionSequenceDelayArg(
      values.failureAction,
      values.failureSequenceDelay,
    );
    details.quantidade_tentativas = Math.max(1, Math.trunc(parseNumber(values.retryCount, details.quantidade_tentativas ?? 1)));
    details.intervalo_tentativas = parseNumber(values.retryInterval, details.intervalo_tentativas ?? 1);
    applySuccessFlowDraft(details, values);
    return nextEvent;
  }

  if (nextEvent.type === "chrome_elemento_html") {
    return {
      ...nextEvent,
      details: buildChromeDetailsFromAnalysisAndValues(draft.values.chromeAnalysis || {}, draft.values),
    };
  }

  if (nextEvent.type === "verificar_estado_botao") {
    details.nome = values.verifyName || details.nome || "Verificar botao";
    details.imagem_ativo = values.verifyActiveImage ?? details.imagem_ativo ?? "";
    details.imagem_desativado = values.verifyInactiveImage ?? details.imagem_desativado ?? "";
    details.timeout = parseNumber(values.verifyTimeout, details.timeout ?? 5);
    details.confianca = parseNumber(values.verifyConfidence, details.confianca ?? 0.85);
    details.se_ativo = {
      acao: values.verifyActiveAction || "continuar",
      sequencia: optionalSequenceValue(values.verifyActiveSequence) || "",
    };
    details.se_desativado = {
      acao: values.verifyInactiveAction || "ir_para_sequencia",
      sequencia: optionalSequenceValue(values.verifyInactiveSequence) || "",
    };
    details.se_nao_encontrar = {
      acao: values.verifyMissingAction || "parar",
      sequencia: optionalSequenceValue(values.verifyMissingSequence) || "",
    };
    return nextEvent;
  }

  if (nextEvent.type === "sequencia_planilha") {
    details.arquivo = values.workbook ?? details.arquivo ?? "";
    details.aba = values.sheet ?? details.aba ?? "";
    details.coluna = values.column ?? details.coluna ?? "";
    details.acao_apos_item_texto = values.afterAction ?? details.acao_apos_item_texto ?? "nenhuma";
    details.intervalo_entre_itens = parseNumber(values.intervalBetween, details.intervalo_entre_itens ?? 0.5);
    applySuccessFlowDraft(details, values);
    return nextEvent;
  }

  return nextEvent;
}

function syncCommandMapDraftsWithRoadmap(roadmap = state.roadmap) {
  const validKeys = new Set(
    (roadmap?.events ?? [])
      .map((event) => commandEventClientKey(event))
      .filter(Boolean)
  );

  state.commandMapDrafts = Object.fromEntries(
    Object.entries(state.commandMapDrafts || {}).filter(([clientKey]) => validKeys.has(clientKey))
  );
}

function decorateRoadmapForClient(roadmap, previousRoadmap = null) {
  if (!roadmap) {
    return roadmap;
  }

  const previousQueues = new Map();
  for (const previousEvent of previousRoadmap?.events ?? []) {
    const fingerprint = buildCommandEventFingerprint(previousEvent);
    if (!previousQueues.has(fingerprint)) {
      previousQueues.set(fingerprint, []);
    }
    previousQueues.get(fingerprint).push(previousEvent.clientKey || nextCommandMapClientKey());
  }

  return {
    ...roadmap,
    events: (roadmap.events ?? []).map((event) => {
      const fingerprint = buildCommandEventFingerprint(event);
      const queue = previousQueues.get(fingerprint);
      const clientKey = event.clientKey || queue?.shift() || nextCommandMapClientKey();
      return {
        ...event,
        clientKey,
      };
    }),
  };
}

function normalizeRecognitionImagePath(imagePath) {
  return normalizeStringValue(imagePath);
}

function recognitionPreviewFileName(imagePath) {
  const normalized = normalizeRecognitionImagePath(imagePath);
  if (!normalized) {
    return "";
  }
  const parts = normalized.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || normalized;
}

function recognitionPreviewCardsWithin(root) {
  if (!root) {
    return [];
  }
  if (typeof root.matches === "function" && root.matches("[data-recognition-preview-card]")) {
    return [root];
  }
  return Array.from(root.querySelectorAll?.("[data-recognition-preview-card]") || []);
}

function resolveRecognitionPreviewPath(container, fallbackPath = "") {
  if (!container) {
    return normalizeRecognitionImagePath(fallbackPath);
  }
  return normalizeRecognitionImagePath(
    container.querySelector?.('[data-tree-field="imagePath"]')?.value
      || container.querySelector?.('[data-insert-field="imagePath"]')?.value
      || container.dataset.recognitionPreviewPath
      || fallbackPath
  );
}

function renderRecognitionPreviewCardState({ status = "empty", imagePath = "", src = "", message = "" } = {}) {
  const normalizedPath = normalizeRecognitionImagePath(imagePath);
  const fileName = recognitionPreviewFileName(normalizedPath);
  const title = normalizedPath ? fileName || normalizedPath : "Nenhuma referencia visual";
  const subtitle = normalizedPath
    ? normalizedPath
    : "Capture ou selecione uma referencia para visualizar aqui.";

  let stageContent = `
    <div class="recognition-preview-state is-empty">
      <strong>Sem imagem definida</strong>
      <span>Esse bloco ainda nao tem referencia salva.</span>
    </div>
  `;

  if (status === "loading" && normalizedPath) {
    stageContent = `
      <div class="recognition-preview-state is-loading">
        <strong>Carregando preview</strong>
        <span>${escapeHtml(fileName || normalizedPath)}</span>
      </div>
    `;
  } else if (status === "error" && normalizedPath) {
    stageContent = `
      <div class="recognition-preview-state is-error">
        <strong>Preview indisponivel</strong>
        <span>${escapeHtml(message || "Nao foi possivel abrir a imagem dessa referencia.")}</span>
      </div>
    `;
  } else if (status === "ready" && normalizedPath && src) {
    stageContent = `
      <img
        class="recognition-preview-image"
        src="${escapeHtml(src)}"
        alt="Preview da referencia ${escapeHtml(fileName || normalizedPath)}"
        loading="lazy"
      />
    `;
  }

  return `
    <div class="recognition-preview-stage is-${escapeHtml(status)}" data-recognition-preview-stage="true">
      ${stageContent}
    </div>
    <div class="recognition-preview-meta">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
  `;
}

function renderRecognitionPreviewPanel(imagePath = "") {
  const normalizedPath = normalizeRecognitionImagePath(imagePath);
  return `
    <div class="recognition-preview-card" data-recognition-preview-card="true" data-recognition-preview-path="${escapeHtml(normalizedPath)}">
      ${renderRecognitionPreviewCardState({
        status: normalizedPath ? "loading" : "empty",
        imagePath: normalizedPath,
      })}
    </div>
  `;
}

function setRecognitionPreviewCardState(previewCard, payload = {}) {
  if (!previewCard) {
    return;
  }
  const imagePath = normalizeRecognitionImagePath(payload.imagePath || "");
  previewCard.dataset.recognitionPreviewPath = imagePath;
  previewCard.innerHTML = renderRecognitionPreviewCardState({
    status: payload.status || (imagePath ? "loading" : "empty"),
    imagePath,
    src: payload.src || "",
    message: payload.message || "",
  });
}

async function fetchRecognitionPreviewAsset(imagePath) {
  const normalizedPath = normalizeRecognitionImagePath(imagePath);
  if (!normalizedPath) {
    return null;
  }

  const cached = state.recognitionPreviewCache?.[normalizedPath];
  if (cached?.src) {
    return cached;
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = invoke("get_recognition_image_preview", {
    imageId: normalizedPath,
  }).then((result) => {
    const payload = {
      imagePath: normalizedPath,
      src: String(result?.src || ""),
      fileName: String(result?.file_name || recognitionPreviewFileName(normalizedPath)),
    };
    state.recognitionPreviewCache[normalizedPath] = payload;
    return payload;
  }).catch((error) => {
    delete state.recognitionPreviewCache[normalizedPath];
    throw error;
  });

  state.recognitionPreviewCache[normalizedPath] = { promise };
  return promise;
}

function clearRecognitionPreviewCache(imagePath = "") {
  const normalizedPath = normalizeRecognitionImagePath(imagePath);
  if (!normalizedPath) {
    state.recognitionPreviewCache = {};
    return;
  }
  delete state.recognitionPreviewCache[normalizedPath];
}

async function hydrateRecognitionPreviewCard(previewCard, overridePath = null) {
  if (!previewCard) {
    return;
  }

  const host = previewCard.closest(".command-tree-card, .insert-card-panel");
  const imagePath = resolveRecognitionPreviewPath(
    host,
    (overridePath ?? previewCard.dataset.recognitionPreviewPath) || ""
  );
  const requestId = `${Date.now()}-${Math.random()}`;
  previewCard.dataset.recognitionPreviewRequestId = requestId;

  if (!imagePath) {
    setRecognitionPreviewCardState(previewCard, { status: "empty", imagePath: "" });
    return;
  }

  setRecognitionPreviewCardState(previewCard, { status: "loading", imagePath });

  try {
    const preview = await fetchRecognitionPreviewAsset(imagePath);
    if (previewCard.dataset.recognitionPreviewRequestId !== requestId) {
      return;
    }
    if (!preview?.src) {
      throw new Error("A imagem nao retornou um preview valido.");
    }
    setRecognitionPreviewCardState(previewCard, {
      status: "ready",
      imagePath,
      src: preview.src,
    });
  } catch (error) {
    if (previewCard.dataset.recognitionPreviewRequestId !== requestId) {
      return;
    }
    setRecognitionPreviewCardState(previewCard, {
      status: "error",
      imagePath,
      message: String(error || "Nao foi possivel carregar a imagem.").slice(0, 160),
    });
  }
}

function hydrateRecognitionPreviewCards(root, overridePath = null) {
  recognitionPreviewCardsWithin(root).forEach((previewCard) => {
    hydrateRecognitionPreviewCard(previewCard, overridePath);
  });
}

function findRecognitionRoadmapEventByOrder(order, type = "") {
  const numericOrder = Number(order);
  if (!Number.isFinite(numericOrder) || numericOrder <= 0) {
    return null;
  }
  return (state.roadmap?.events ?? []).find((event) =>
    Number(event.order) === numericOrder && (!type || String(event.type || "") === type)
  ) || null;
}

function syncRecognitionTestStatusWithRoadmap(roadmap) {
  const validKeys = new Set(
    (roadmap?.events ?? [])
      .filter((event) => String(event.type || "") === "clicar_imagem" && String(event.clientKey || "").trim())
      .map((event) => String(event.clientKey).trim())
  );

  state.recognitionTestStatus = Object.fromEntries(
    Object.entries(state.recognitionTestStatus || {}).filter(([clientKey]) => validKeys.has(clientKey))
  );
}

function setRecognitionTestStatusForOrder(order, imagePath, tested) {
  const event = findRecognitionRoadmapEventByOrder(order, "clicar_imagem");
  const clientKey = String(event?.clientKey || "").trim();
  if (!clientKey) {
    return;
  }

  const normalizedImagePath = normalizeRecognitionImagePath(imagePath);
  if (!normalizedImagePath) {
    delete state.recognitionTestStatus[clientKey];
    updateRecognitionStatusUIForOrder(order, "");
    return;
  }

  state.recognitionTestStatus = {
    ...state.recognitionTestStatus,
    [clientKey]: {
      imagePath: normalizedImagePath,
      tested: Boolean(tested),
    },
  };
  updateRecognitionStatusUIForOrder(order, normalizedImagePath);
}

function isRecognitionTestedForEvent(event, overrideImagePath = null) {
  const clientKey = String(event?.clientKey || "").trim();
  const normalizedImagePath =
    overrideImagePath !== null
      ? normalizeRecognitionImagePath(overrideImagePath)
      : normalizeRecognitionImagePath(event?.details?.imagem || "");
  if (!clientKey || !normalizedImagePath) {
    return false;
  }

  const status = state.recognitionTestStatus?.[clientKey];
  return Boolean(status?.tested && status?.imagePath === normalizedImagePath);
}

function recognitionSubtitleLabel(event) {
  if (String(event?.type || "") !== "clicar_imagem") {
    return String(event?.subtitle || "");
  }
  const windowTitle = normalizeRecognitionWindowTitle(event?.details?.janela_alvo || "");
  if (windowTitle) {
    return `Busca presa em ${windowTitle}`;
  }
  return normalizeRecognitionImagePath(event?.details?.imagem || "")
    ? "Referencia pronta para uso"
    : "Capture ou selecione uma referencia";
}

function updateRecognitionStatusUIForOrder(order, overrideImagePath = null) {
  const event = findRecognitionRoadmapEventByOrder(order, "clicar_imagem");
  if (!event) {
    return;
  }

  const hasReference =
    overrideImagePath !== null
      ? Boolean(normalizeRecognitionImagePath(overrideImagePath))
      : Boolean(normalizeRecognitionImagePath(event?.details?.imagem || ""));
  const tested = isRecognitionTestedForEvent(event, overrideImagePath);
  const subtitle = hasReference
    ? "Referencia pronta para uso"
    : "Capture ou selecione uma referencia";

  document
    .querySelectorAll(
      `.flow-card[data-order="${order}"][data-type="clicar_imagem"], .command-tree-card[data-order="${order}"][data-type="clicar_imagem"]`
    )
    .forEach((card) => {
      const subtitleEl = card.querySelector('[data-recognition-subtitle="true"]');
      if (subtitleEl) {
        subtitleEl.textContent = subtitle;
      }

      const stateEl = card.querySelector('[data-recognition-state="true"]');
      if (stateEl) {
        stateEl.textContent = hasReference ? "Reconhecimento feito" : "Sem referencia";
        stateEl.classList.toggle("is-ready", hasReference);
        stateEl.classList.toggle("is-missing", !hasReference);
      }

      const testEl = card.querySelector('[data-recognition-test="true"]');
      if (testEl) {
        testEl.textContent = tested ? "Testado" : "Nao testado";
        testEl.classList.toggle("is-tested", tested);
        testEl.classList.toggle("is-pending", !tested);
      }
    });
}

function showCaptureOverlay(text) {
  captureOverlayText.textContent = text;
  captureOverlay.hidden = false;
}

function resolveNearestCommandMapFocus(roadmap, preferredOrder) {
  const events = getCommandMapEvents(state.commandMapPageSequence, roadmap);
  if (!events.length) {
    return null;
  }

  const exact = events.find((event) => event.order === preferredOrder);
  if (exact) {
    return exact.order;
  }

  const next = events.find((event) => event.order >= preferredOrder);
  if (next) {
    return next.order;
  }

  return events.at(-1)?.order ?? events[0]?.order ?? null;
}

function resolveCommandMapFocusByClientKey(roadmap, clientKey, fallbackOrder = null) {
  const normalizedClientKey = String(clientKey || "").trim();
  if (normalizedClientKey) {
    const match = getCommandMapEvents(state.commandMapPageSequence, roadmap)
      .find((event) => String(event?.clientKey || "").trim() === normalizedClientKey);
    if (match?.order != null) {
      return Number(match.order);
    }
  }

  return resolveNearestCommandMapFocus(roadmap, fallbackOrder);
}

function centerCommandMapOrder(order, behavior = "smooth", options = {}) {
  const mode = options.mode || "center";
  const targetSegment = commandMapList.querySelector(`.command-flow-segment[data-order="${order}"]`);
  if (!targetSegment) {
    return;
  }

  const containerRect = commandMapList.getBoundingClientRect();
  const targetRect = targetSegment.getBoundingClientRect();
  if (mode === "if-needed") {
    const margin = Math.min(140, Math.max(72, commandMapList.clientWidth * 0.12));
    const leftOverflow = targetRect.left - (containerRect.left + margin);
    const rightOverflow = targetRect.right - (containerRect.right - margin);
    if (leftOverflow >= 0 && rightOverflow <= 0) {
      return;
    }

    const delta = leftOverflow < 0 ? leftOverflow : rightOverflow;
    commandMapList.scrollTo({
      left: commandMapList.scrollLeft + delta,
      behavior,
    });
    return;
  }

  const delta = targetRect.left - containerRect.left - (commandMapList.clientWidth / 2 - targetRect.width / 2);
  commandMapList.scrollTo({
    left: commandMapList.scrollLeft + delta,
    behavior,
  });
}

function captureCommandMapCardPositions() {
  const positions = new Map();
  commandMapList.querySelectorAll(".command-flow-segment[data-client-key]").forEach((segment) => {
    const key = segment.dataset.clientKey;
    const card = segment.querySelector(".command-tree-card");
    if (!key || !card) {
      return;
    }
    positions.set(key, card.getBoundingClientRect());
  });
  return positions;
}

function animateCommandMapLayoutShift(previousPositions) {
  if (!(previousPositions instanceof Map) || !previousPositions.size) {
    return;
  }

  const animatedCards = [];
  commandMapList.querySelectorAll(".command-flow-segment[data-client-key]").forEach((segment) => {
    const key = segment.dataset.clientKey;
    const card = segment.querySelector(".command-tree-card");
    const previousRect = previousPositions.get(key);
    if (!key || !card || !previousRect) {
      return;
    }

    const nextRect = card.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    const deltaY = previousRect.top - nextRect.top;

    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
      return;
    }

    const tilt = Math.max(-2.2, Math.min(2.2, deltaX / 58));
    animatedCards.push({
      card,
      deltaX,
      deltaY,
      tilt,
    });
  });

  if (!animatedCards.length) {
    return;
  }

  commandMapList.getBoundingClientRect();

  requestAnimationFrame(() => {
    animatedCards.forEach(({ card, deltaX, deltaY, tilt }) => {
      const distance = Math.abs(deltaX);
      const arcLift = distance > 20 ? Math.min(18, Math.max(8, distance * 0.085)) : 0;
      const arcY = deltaY + (deltaX > 0 ? arcLift : -arcLift);

      const cleanup = () => {
        card.style.transition = "";
        card.style.transform = "";
        card.style.willChange = "";
        card.style.zIndex = "";
        card.__commandMapShiftAnimation = null;
      };

      if (card.__commandMapShiftAnimation) {
        card.__commandMapShiftAnimation.cancel();
        card.__commandMapShiftAnimation = null;
      }

      card.style.willChange = "transform";
      card.style.zIndex = "7";

      if (typeof card.animate === "function") {
        const animation = card.animate(
          [
            {
              transform: `translate(${deltaX}px, ${deltaY}px) rotate(${tilt}deg) scale(0.985)`,
            },
            {
              transform: `translate(${Math.round(deltaX * 0.38)}px, ${Math.round(arcY)}px) rotate(${(tilt * 0.42).toFixed(3)}deg) scale(1.018)`,
              offset: 0.56,
            },
            {
              transform: "translate(0px, 0px) rotate(0deg) scale(1)",
            },
          ],
          {
            duration: 320,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "both",
          }
        );

        card.__commandMapShiftAnimation = animation;
        animation.addEventListener("finish", cleanup, { once: true });
        animation.addEventListener("cancel", cleanup, { once: true });
        return;
      }

      card.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
      card.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${tilt}deg)`;

      requestAnimationFrame(() => {
        card.style.transform = "";
      });

      card.addEventListener("transitionend", cleanup, { once: true });
    });
  });
}

function applyCommandMapFocus(behavior = "smooth", options = {}) {
  const skipConnectorLayout = Boolean(options.skipConnectorLayout);
  const animateFocusPulse = Boolean(options.animateFocusPulse);
  const scrollMode = options.scrollMode || "center";
  const events = getCommandMapEvents();
  const focusOrder = resolveNearestCommandMapFocus(state.roadmap, state.commandMapFocusOrder ?? events[0]?.order ?? null);
  state.commandMapFocusOrder = focusOrder;
  const visibleOrders = events.map((event) => Number(event.order)).filter((order) => Number.isFinite(order));
  const focusIndex = visibleOrders.indexOf(Number(focusOrder));
  const neighborOrders = new Set(
    [visibleOrders[focusIndex - 1], visibleOrders[focusIndex + 1]].filter((order) => Number.isFinite(order))
  );

  const row = commandMapList.querySelector(".command-flow-row");
  if (!row) {
    updateCommandMapNavButtons();
    return;
  }

  row.classList.toggle("is-carousel-focus", Boolean(focusOrder));
  commandMapList.querySelectorAll(".command-flow-segment").forEach((segment) => {
    const order = Number(segment.dataset.order);
    const isFocused = order === focusOrder;
    const isNeighbor = neighborOrders.has(order);
    segment.classList.toggle("is-focused", isFocused);
    segment.classList.toggle("is-neighbor", isNeighbor);
    if (isFocused && animateFocusPulse) {
      segment.classList.remove("is-focus-pulse");
      void segment.offsetWidth;
      segment.classList.add("is-focus-pulse");
      window.setTimeout(() => {
        segment.classList.remove("is-focus-pulse");
      }, 260);
    }
  });

  commandMapList.querySelectorAll(".command-inline-connector").forEach((connector) => {
    const targetIndex = Number(connector.dataset.targetIndex);
    const nearFocus = focusOrder != null && (targetIndex === focusOrder || neighborOrders.has(targetIndex));
    connector.classList.toggle("is-near-focus", nearFocus);
  });

  if (!skipConnectorLayout) {
    scheduleCommandConnectorLayout();
  }

  updateCommandMapNavButtons();

  if (state.activeTab === "commands" && focusOrder) {
    requestAnimationFrame(() => centerCommandMapOrder(focusOrder, behavior, { mode: scrollMode }));
  }
}

function setCommandMapFocus(order, behavior = "smooth", options = {}) {
  const skipConnectorLayout = Boolean(options.skipConnectorLayout);
  const animateFocusPulse = Boolean(options.animateFocusPulse);
  const scrollMode = options.scrollMode || "center";
  const targetSequence = getCommandMapEventSequenceByOrder(order);
  const lockedSequence = activeCommandMapPageSequenceLock();
  if (lockedSequence && targetSequence && targetSequence !== lockedSequence) {
    state.commandMapPageSequence = lockedSequence;
    syncSequenceContextInput();
    renderCommandMapPageTabs();
    updateCommandMapHeaderSummary();
    state.commandMapFocusOrder = resolveNearestCommandMapFocus(state.roadmap, state.commandMapFocusOrder ?? order);
    applyCommandMapFocus(behavior, { skipConnectorLayout, animateFocusPulse, scrollMode });
    return;
  }
  if (targetSequence && targetSequence !== normalizeSequenceName(state.commandMapPageSequence)) {
    state.commandMapPageSequence = targetSequence;
    syncSequenceContextInput();
    renderCommandMapPageTabs();
    updateCommandMapHeaderSummary();
    renderCommandMap();
  }
  state.commandMapFocusOrder = order;
  applyCommandMapFocus(behavior, { skipConnectorLayout, animateFocusPulse, scrollMode });
}

function focusLastCommandMapCard(roadmap) {
  return getCommandMapEvents(state.commandMapPageSequence, roadmap).at(-1)?.order ?? state.commandMapFocusOrder;
}

function hideCaptureOverlay() {
  captureOverlay.hidden = true;
}

function clearCaptureBlurTimer() {
  if (state.captureBlurTimer) {
    clearTimeout(state.captureBlurTimer);
    state.captureBlurTimer = null;
  }
}

function cancelCapture(message = "Captura cancelada.") {
  clearCaptureBlurTimer();
  state.captureTarget = null;
  hideCaptureOverlay();
  setMessage(message, "error");
}

function isModifierOnlyKey(key) {
  return ["ctrl", "alt", "shift", "cmd"].includes(key);
}

function writeCapturedShortcut(captured) {
  const field = state.captureTarget.field || "keys";

  if (state.captureTarget.scope === "update-tree") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${state.captureTarget.order}"]`);
    const input = card?.querySelector(`[data-tree-field="${field}"]`);
    if (input) {
      input.value = captured;
    }
  } else if (state.captureTarget.scope === "update-editor") {
    const card = timelineList.querySelector(`.flow-card[data-order="${state.captureTarget.order}"]`);
    const input = card?.querySelector(`[data-field="${field}"]`);
    if (input) {
      input.value = captured;
    }
  } else if (state.captureTarget.scope === "insert-panel") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${state.captureTarget.order}"]`);
    const input = panel?.querySelector(`[data-insert-field="${field}"]`);
    if (input) {
      input.value = captured;
      if (state.insertPanel) {
        state.insertPanel[field] = captured;
      }
    }
  } else if (state.captureTarget.scope === "composer-after-action") {
    afterActionInput.value = captured;
  } else if (state.captureTarget.scope === "workbook-after-action") {
    workbookAfterAction.value = captured;
  }
}

function writeCapturedMouse(payload) {
  const x = Number(payload?.x ?? 0);
  const y = Number(payload?.y ?? 0);
  const button = String(payload?.button ?? "left").toLowerCase();

  if (state.captureTarget.scope === "composer-mouse") {
    mouseXInput.value = String(x);
    mouseYInput.value = String(y);
    mouseButtonInput.value = button;
    return;
  }

  if (state.captureTarget.scope === "update-tree") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${state.captureTarget.order}"]`);
    const xInput = card?.querySelector('[data-tree-field="x"]');
    const yInput = card?.querySelector('[data-tree-field="y"]');
    const buttonInput = card?.querySelector('[data-tree-field="button"]');
    if (xInput) {
      xInput.value = String(x);
    }
    if (yInput) {
      yInput.value = String(y);
    }
    if (buttonInput) {
      buttonInput.value = button;
    }
    return;
  }

  if (state.captureTarget.scope === "update-editor") {
    const card = timelineList.querySelector(`.flow-card[data-order="${state.captureTarget.order}"]`);
    const xInput = card?.querySelector('[data-field="x"]');
    const yInput = card?.querySelector('[data-field="y"]');
    const buttonInput = card?.querySelector('[data-field="button"]');
    if (xInput) {
      xInput.value = String(x);
    }
    if (yInput) {
      yInput.value = String(y);
    }
    if (buttonInput) {
      buttonInput.value = button;
    }
    return;
  }

  if (state.captureTarget.scope === "insert-panel") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${state.captureTarget.order}"]`);
    const xInput = panel?.querySelector('[data-insert-field="x"]');
    const yInput = panel?.querySelector('[data-insert-field="y"]');
    const buttonInput = panel?.querySelector('[data-insert-field="button"]');
    if (xInput) {
      xInput.value = String(x);
    }
    if (yInput) {
      yInput.value = String(y);
    }
    if (buttonInput) {
      buttonInput.value = button;
    }
    if (state.insertPanel) {
      state.insertPanel.x = x;
      state.insertPanel.y = y;
      state.insertPanel.button = button;
    }
  }
}

function formatMouseButtonLabel(button) {
  const labels = {
    left: "esquerdo",
    right: "direito",
    middle: "meio",
  };
  return labels[String(button || "").toLowerCase()] || String(button || "left").toLowerCase();
}

function clearDragState() {
  if (state.dragMoveFrame) {
    cancelAnimationFrame(state.dragMoveFrame);
    state.dragMoveFrame = 0;
  }
  builderShell?.classList.remove("is-map-dragging");
  state.pendingDrag = null;
  commandMapList.querySelectorAll(".command-drop-zone").forEach((zone) => {
    zone.classList.remove("is-drop-target");
  });
  commandMapList.querySelectorAll(".command-flow-segment").forEach((segment) => {
    segment.classList.remove("is-drag-source");
    segment.classList.remove("is-drop-before");
    segment.classList.remove("is-drop-after");
  });

  state.draggingOrder = null;
  state.draggingClientKey = "";
  state.dragTargetIndex = null;
  state.dragPointerId = null;
  state.dragOffsetX = 0;
  state.dragOffsetY = 0;
  state.dragClientX = 0;
  state.dragClientY = 0;
  state.dragSegments = [];
  state.dragDropZones = [];
  state.dragThresholds = [];
  state.dragContainerRect = null;
  state.dragPlaceholderWidth = 0;
  state.dragPlaceholderHeight = 0;
  commandMapList?.style.removeProperty("--drag-placeholder-width");
  commandMapList?.style.removeProperty("--drag-placeholder-height");
  commandMapList?.style.removeProperty("--drag-placeholder-offset-y");

  if (state.dragPreviewEl) {
    state.dragPreviewEl.remove();
    state.dragPreviewEl = null;
  }
}

function releaseDragInteraction({ keepPreview = false } = {}) {
  if (state.dragMoveFrame) {
    cancelAnimationFrame(state.dragMoveFrame);
    state.dragMoveFrame = 0;
  }
  if (!keepPreview && state.dragPreviewEl) {
    state.dragPreviewEl.remove();
    state.dragPreviewEl = null;
  }
  state.pendingDrag = null;
  state.draggingOrder = null;
  state.draggingClientKey = "";
  state.dragTargetIndex = null;
  state.dragPointerId = null;
  state.dragOffsetX = 0;
  state.dragOffsetY = 0;
  state.dragClientX = 0;
  state.dragClientY = 0;
  state.dragSegments = [];
  state.dragDropZones = [];
  state.dragThresholds = [];
  state.dragContainerRect = null;
  state.dragPlaceholderWidth = 0;
  state.dragPlaceholderHeight = 0;
  commandMapList?.style.removeProperty("--drag-placeholder-width");
  commandMapList?.style.removeProperty("--drag-placeholder-height");
  commandMapList?.style.removeProperty("--drag-placeholder-offset-y");
  builderShell?.classList.remove("is-map-dragging");
  commandMapList.querySelectorAll(".command-drop-zone").forEach((zone) => {
    zone.classList.remove("is-drop-target");
  });
  commandMapList.querySelectorAll(".command-flow-segment").forEach((segment) => {
    segment.classList.remove("is-drag-source");
    segment.classList.remove("is-drop-before");
    segment.classList.remove("is-drop-after");
  });
}

function updateDragTarget(targetIndex) {
  if (!targetIndex || state.dragTargetIndex === targetIndex) {
    return;
  }

  state.dragTargetIndex = targetIndex;
  const dropZones = state.dragDropZones.length
    ? state.dragDropZones
    : Array.from(commandMapList.querySelectorAll(".command-drop-zone"));
  dropZones.forEach((zone) => {
    zone.classList.toggle("is-drop-target", Number(zone.dataset.targetIndex) === targetIndex);
  });

  const dragSegments = state.dragSegments.length
    ? state.dragSegments
    : Array.from(commandMapList.querySelectorAll(".command-flow-segment"));
  dragSegments.forEach((segment) => {
    segment.classList.remove("is-drop-before", "is-drop-after");
  });
}

function getNormalizedDragTargetIndex(targetIndex, order) {
  const sourceOrder = Number(order);
  const nextTarget = Number(targetIndex);
  if (!Number.isFinite(sourceOrder) || !Number.isFinite(nextTarget)) {
    return nextTarget;
  }

  return nextTarget > sourceOrder ? nextTarget - 1 : nextTarget;
}

function isNoopCardReorder(order, targetIndex) {
  const sourceOrder = Number(order);
  const destinationIndex = Number(targetIndex);
  return (
    Number.isFinite(sourceOrder) &&
    Number.isFinite(destinationIndex) &&
    (destinationIndex === sourceOrder || destinationIndex === sourceOrder + 1)
  );
}

function getDragTargetIndexFromEvent(event) {
  const zone = event.target.closest(".command-drop-zone");
  if (zone) {
    return Number(zone.dataset.targetIndex);
  }

  const connector = event.target.closest(".command-inline-connector");
  if (connector) {
    return Number(connector.dataset.targetIndex);
  }

  const segment = event.target.closest(".command-flow-segment");
  if (segment) {
    const order = Number(segment.dataset.order);
    const rect = segment.getBoundingClientRect();
    const isLeftHalf = event.clientX <= rect.left + rect.width / 2;
    return isLeftHalf ? order : order + 1;
  }

  return null;
}

function getDragTargetIndexFromPoint(clientX, clientY) {
  const containerRect = state.dragContainerRect || commandMapList.getBoundingClientRect();
  const verticalTolerance = 160;
  const draggingOrder = Number(state.draggingOrder);
  const liveThresholds = Array.from(commandMapList.querySelectorAll(".command-flow-segment"))
    .map((segment) => {
      const order = Number(segment.dataset.order);
      if (!order || order === draggingOrder) {
        return null;
      }
      const rect = segment.getBoundingClientRect();
      return {
        order,
        centerX: rect.left - containerRect.left + commandMapList.scrollLeft + rect.width / 2,
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.centerX - second.centerX);

  if (liveThresholds.length) {
    if (clientY < containerRect.top - verticalTolerance || clientY > containerRect.bottom + verticalTolerance) {
      return null;
    }

    const contentX = clientX - containerRect.left + commandMapList.scrollLeft;
    for (const threshold of liveThresholds) {
      if (contentX <= threshold.centerX) {
        return threshold.order;
      }
    }

    const lastThreshold = liveThresholds[liveThresholds.length - 1];
    return lastThreshold ? lastThreshold.order + 1 : null;
  }

  const target = document.elementFromPoint(clientX, clientY);
  if (!target) {
    return null;
  }

  return getDragTargetIndexFromEvent({
    target,
    clientX,
  });
}

function autoScrollCommandMap(clientX) {
  const rect = state.dragContainerRect || commandMapList.getBoundingClientRect();
  const edge = 72;
  const speed = 18;

  if (clientX < rect.left + edge) {
    commandMapList.scrollLeft -= speed;
  } else if (clientX > rect.right - edge) {
    commandMapList.scrollLeft += speed;
  }
}

function moveDragPreview(clientX, clientY) {
  if (!state.dragPreviewEl) {
    return;
  }

  const nextX = clientX - state.dragOffsetX;
  const nextY = clientY - state.dragOffsetY;
  state.dragPreviewEl.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(1.01)`;
}

function refreshDragGeometry() {
  const containerRect = commandMapList.getBoundingClientRect();
  const scrollLeft = commandMapList.scrollLeft;
  const draggingOrder = Number(state.draggingOrder);
  const dragSegments = state.dragSegments.length
    ? state.dragSegments
    : Array.from(commandMapList.querySelectorAll(".command-flow-segment"));

  state.dragContainerRect = containerRect;
  state.dragThresholds = dragSegments
    .map((segment) => {
      const order = Number(segment.dataset.order);
      if (!order || order === draggingOrder) {
        return null;
      }

      const rect = segment.getBoundingClientRect();
      return {
        order,
        centerX: rect.left - containerRect.left + scrollLeft + rect.width / 2,
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.centerX - second.centerX);
}

function scheduleDragUpdate(clientX, clientY) {
  state.dragClientX = clientX;
  state.dragClientY = clientY;

  if (state.dragMoveFrame) {
    return;
  }

  state.dragMoveFrame = requestAnimationFrame(() => {
    state.dragMoveFrame = 0;

    if (!state.draggingOrder) {
      return;
    }

    moveDragPreview(state.dragClientX, state.dragClientY);
    autoScrollCommandMap(state.dragClientX);

    const targetIndex = getDragTargetIndexFromPoint(state.dragClientX, state.dragClientY);
    if (targetIndex) {
      updateDragTarget(targetIndex);
    }
  });
}

function getDropAnimationPosition(targetIndex, previewEl) {
  const previewRect = previewEl?.getBoundingClientRect();
  if (!previewRect) {
    return null;
  }

  const zone = commandMapList.querySelector(`.command-drop-zone[data-target-index="${targetIndex}"]`);
  if (zone) {
    const zoneRect = zone.getBoundingClientRect();
    const alignedTopSegment =
      commandMapList.querySelector(`.command-flow-segment[data-order="${targetIndex}"]`) ||
      commandMapList.querySelector(`.command-flow-segment[data-order="${Math.max(1, targetIndex - 1)}"]`);
    const alignedTop = alignedTopSegment?.getBoundingClientRect().top ?? previewRect.top;
    return {
      left: zoneRect.left + zoneRect.width / 2 - previewRect.width / 2,
      top: alignedTop,
    };
  }

  const targetSegment = commandMapList.querySelector(`.command-flow-segment[data-order="${targetIndex}"]`);
  if (targetSegment) {
    const rect = targetSegment.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
    };
  }

  return {
    left: previewRect.left,
    top: previewRect.top,
  };
}

function animateDropPreviewToTarget(previewEl, targetIndex) {
  if (!previewEl || !targetIndex) {
    return Promise.resolve();
  }

  const destination = getDropAnimationPosition(targetIndex, previewEl);
  if (!destination) {
    return Promise.resolve();
  }

  previewEl.style.transition = "left 220ms cubic-bezier(0.22, 1, 0.36, 1), top 220ms cubic-bezier(0.22, 1, 0.36, 1)";

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      previewEl.style.transition = "";
      resolve();
    };

    previewEl.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 260);

    requestAnimationFrame(() => {
      previewEl.style.left = `${destination.left}px`;
      previewEl.style.top = `${destination.top}px`;
    });
  });
}

function buildOptimisticReorderResult(roadmap, order, targetIndex) {
  if (!roadmap?.events?.length || !order || !targetIndex) {
    return null;
  }

  const events = roadmap.events.map((event) => ({ ...event }));
  const sourceIndex = events.findIndex((event) => Number(event.order) === Number(order));
  if (sourceIndex < 0) {
    return null;
  }

  const [draggedEvent] = events.splice(sourceIndex, 1);
  const focusClientKey = String(draggedEvent?.clientKey || "").trim();
  let insertionIndex = Math.max(0, Math.min(events.length, Number(targetIndex) - 1));
  if (sourceIndex < insertionIndex) {
    insertionIndex -= 1;
  }
  insertionIndex = Math.max(0, Math.min(events.length, insertionIndex));
  events.splice(insertionIndex, 0, draggedEvent);

  return {
    focusClientKey,
    focusOrder: insertionIndex + 1,
    roadmap: {
      ...roadmap,
      events: events.map((event, index) => ({
        ...event,
        order: index + 1,
      })),
    },
  };
}

function buildOptimisticDirectionalMoveResult(roadmap, order, direction) {
  const events = roadmap?.events ?? [];
  if (!events.length || !order || !direction) {
    return null;
  }

  const sourceIndex = events.findIndex((event) => Number(event.order) === Number(order));
  if (sourceIndex < 0) {
    return null;
  }

  const step = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const targetIndex = sourceIndex + step;
  if (!step || targetIndex < 0 || targetIndex >= events.length) {
    return null;
  }

  const nextEvents = events.map((event) => ({ ...event }));
  const currentEvent = nextEvents[sourceIndex];
  const adjacentEvent = nextEvents[targetIndex];
  nextEvents[sourceIndex] = adjacentEvent;
  nextEvents[targetIndex] = currentEvent;

  return {
    focusClientKey: String(currentEvent?.clientKey || "").trim(),
    focusOrder: targetIndex + 1,
    roadmap: {
      ...roadmap,
      events: nextEvents.map((event, index) => ({
        ...event,
        order: index + 1,
      })),
    },
  };
}

function applyOptimisticCommandMapReorder(optimistic, layoutSnapshot = null) {
  if (!optimistic?.roadmap) {
    return;
  }

  state.roadmap = optimistic.roadmap;
  state.commandMapFocusOrder = resolveCommandMapFocusByClientKey(
    optimistic.roadmap,
    optimistic.focusClientKey,
    optimistic.focusOrder ?? state.commandMapFocusOrder
  );
  renderCommandMap({ layoutSnapshot });
  if (state.activeTab === "assist") {
    renderAssistExecutionMap();
  }
}

async function commitCardReorder(order, targetIndex, layoutSnapshot = null) {
  const previousRoadmap = state.roadmap;
  const previousFocus = state.commandMapFocusOrder;
  const optimistic = buildOptimisticReorderResult(previousRoadmap, order, targetIndex);

  try {
    setBusy("Reordenando");
    if (optimistic) {
      applyOptimisticCommandMapReorder(optimistic, layoutSnapshot);
    }

    const roadmap = await invoke("reorder_block", {
      order,
      targetIndex,
    });

    state.roadmap = decorateRoadmapForClient(roadmap, optimistic?.roadmap ?? previousRoadmap);
    state.library.dirty = false;
    state.commandMapFocusOrder = resolveCommandMapFocusByClientKey(
      state.roadmap,
      optimistic?.focusClientKey,
      optimistic?.focusOrder ?? previousFocus
    );
    if (state.activeTab === "commands" && state.commandMapFocusOrder) {
      requestAnimationFrame(() => centerCommandMapOrder(state.commandMapFocusOrder, "auto"));
    }
    setBusy("Pronto");
    setMessage("Bloco reordenado com sucesso.", "success");
  } catch (error) {
    if (previousRoadmap) {
      state.roadmap = previousRoadmap;
      state.commandMapFocusOrder = previousFocus;
      renderCommandMap();
      renderAssistExecutionMap();
    }
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function moveCommandMapCardByStep(order, direction) {
  const visibleOrders = getCommandMapOrders();
  const sourceIndex = visibleOrders.indexOf(Number(order));
  const step = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  if (sourceIndex < 0 || !step) {
    return;
  }

  const targetVisibleIndex = sourceIndex + step;
  if (targetVisibleIndex < 0 || targetVisibleIndex >= visibleOrders.length) {
    return;
  }

  const neighborOrder = Number(visibleOrders[targetVisibleIndex]);
  if (!Number.isFinite(neighborOrder) || neighborOrder <= 0) {
    return;
  }

  const layoutSnapshot = captureCommandMapCardPositions();
  const targetIndex = direction === "up" ? neighborOrder : neighborOrder + 1;
  await commitCardReorder(order, targetIndex, layoutSnapshot);
}

function beginCardDrag(handle, pointerEvent) {
  const segment = handle.closest(".command-flow-segment");
  if (!segment) {
    return;
  }

  const order = Number(segment.dataset.order || handle.dataset.order);
  if (!Number.isFinite(order) || order <= 0) {
    return;
  }

  const rect = segment.getBoundingClientRect();
  const preview = segment.cloneNode(true);
  const dragZoom = Math.max(0.01, Number(state.commandMapZoom) || 1);
  const startX = Math.round(rect.left);
  const startY = Math.round(rect.top);

  preview.classList.remove("is-drop-before", "is-drop-after");
  preview.classList.add("command-drag-preview");
  preview.style.zoom = String(dragZoom);
  preview.style.width = `${rect.width / dragZoom}px`;
  preview.style.height = `${rect.height / dragZoom}px`;
  preview.style.left = "0px";
  preview.style.top = "0px";
  preview.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(1.01)`;

  document.body.appendChild(preview);

  state.draggingOrder = order;
  state.draggingClientKey = String(segment.dataset.clientKey || "").trim();
  state.dragPointerId = pointerEvent.pointerId;
  state.dragPreviewEl = preview;
  state.dragOffsetX = pointerEvent.clientX - rect.left;
  state.dragOffsetY = pointerEvent.clientY - rect.top;
  state.dragDropZones = Array.from(commandMapList.querySelectorAll(".command-drop-zone"));
  state.dragSegments = Array.from(commandMapList.querySelectorAll(".command-flow-segment"));
  state.dragPlaceholderWidth = Math.max(188, Math.round(rect.width / dragZoom));
  state.dragPlaceholderHeight = Math.max(150, Math.round(rect.height / dragZoom));
  commandMapList.style.setProperty("--drag-placeholder-width", `${state.dragPlaceholderWidth}px`);
  commandMapList.style.setProperty("--drag-placeholder-height", `${state.dragPlaceholderHeight}px`);
  commandMapList.style.setProperty("--drag-placeholder-offset-y", "0px");

  segment.classList.add("is-drag-source");
  builderShell?.classList.add("is-map-dragging");
  refreshDragGeometry();

  if (typeof handle.setPointerCapture === "function") {
    handle.setPointerCapture(pointerEvent.pointerId);
  }

  const initialTarget = getDragTargetIndexFromPoint(pointerEvent.clientX, pointerEvent.clientY);
  if (initialTarget) {
    updateDragTarget(initialTarget);
  }
}

function finishCardDrag(shouldDrop = true) {
  if (!state.draggingOrder) {
    clearDragState();
    return;
  }

  const draggedEvent = findRoadmapEventByClientKey(state.draggingClientKey);
  const order = Number(draggedEvent?.order ?? state.draggingOrder);
  const targetIndex = state.dragTargetIndex;
  if (shouldDrop && targetIndex && !isNoopCardReorder(order, targetIndex)) {
    const layoutSnapshot = captureCommandMapCardPositions();
    const commitPromise = commitCardReorder(order, targetIndex, layoutSnapshot);
    releaseDragInteraction();
    void commitPromise;
    return;
  }

  clearDragState();
}

function createInsertPanelState(targetOrder, position) {
  const workbookId = resolveWorkbookId();
  return {
    targetOrder,
    position,
    type: "key",
    text: "",
    keys: "",
    repeat: 1,
    x: 0,
    y: 0,
    button: "left",
    clicks: 1,
    imagePath: "",
    timeout: 10,
    confidence: 0.8,
    searchProfile: "balanced",
    searchAreaMode: "target_window",
    searchAreaX: 0,
    searchAreaY: 0,
    searchAreaWidth: 0,
    searchAreaHeight: 0,
    recognitionTab: "base",
    windowTitle: "",
    expectedOcrText: "",
    recognitionClickMode: "single",
    failureAction: "parar",
    failureBlock: "",
    failureSequence: "pagina_2",
    retryCount: 3,
    retryInterval: 1,
    successAction: "continuar",
    successBlock: "",
    successSequence: "pagina_2",
    successSequenceDelay: 0,
    chromeName: "Chrome / Elemento HTML",
    chromeHtml: "",
    chromeAnalysis: null,
    chromeTargetMethod: "css",
    chromeTargetValue: "",
    chromeActionType: "clicar",
    chromeValueSource: "texto_fixo",
    chromeActionValue: "",
    chromeSaveAs: "",
    chromeTimeout: 10000,
    chromePressAfter: "",
    chromeSuccessAction: "continuar",
    chromeSuccessBlock: "",
    chromeSuccessSequence: "pagina_2",
    chromeSuccessSequenceDelay: 0,
    chromeFailureAction: "parar",
    chromeFailureBlock: "",
    chromeFailureSequence: "pagina_2",
    chromeFailureSequenceDelay: 0,
    failureSequenceDelay: 0,
    chromeRetryCount: 1,
    chromeRetryInterval: 0.5,
    chromeClearBefore: true,
    chromeFallbackVisual: false,
    chromeFallbackImage: "",
    openUrl: "",
    openBrowser: "padrao",
    openMode: "nova_janela",
    openFullscreen: false,
    openWait: 3,
    programPath: "",
    programParams: "",
    programWait: 2,
    delay: 0.3,
    workbook: workbookId,
    sheet: workbookSheetsFor(workbookId)[0]?.name ?? "",
    column: columnsForSheetInWorkbook(workbookId, workbookSheetsFor(workbookId)[0]?.name ?? "")?.[0] ?? "",
    writeValue: "OK",
    afterAction: "nenhuma",
    intervalBetween: 0.5,
  };
}

function setBusy(label) {
  builderStatus.textContent = label;
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTransitionDelay(value) {
  return Math.max(0, parseNumber(value, 0));
}

function formatTransitionDelayValue(value) {
  const normalized = normalizeTransitionDelay(value);
  return Number.isInteger(normalized) ? String(normalized) : String(normalized);
}

function transitionSequenceDelayArg(action, delayValue) {
  return ["ir_para_sequencia", "ir_para_bloco"].includes(String(action || "").trim())
    ? normalizeTransitionDelay(delayValue)
    : null;
}

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "sim", "yes"].includes(normalized);
}

function recognitionClickModeFromDetails(details = {}) {
  const clicks = Math.max(0, Math.trunc(parseNumber(details.clicks ?? details.cliques ?? (details.clicar === false ? 0 : 1), 1)));
  if (clicks >= 2) {
    return "double";
  }
  if (clicks === 1) {
    return "single";
  }
  return "identify";
}

function recognitionClicksFromMode(value, fallback = 1) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "double") {
    return 2;
  }
  if (normalized === "identify" || normalized === "false" || normalized === "0") {
    return 0;
  }
  if (normalized === "single" || normalized === "true" || normalized === "1") {
    return 1;
  }
  return Math.max(0, Math.trunc(Number(fallback) || 0));
}

function normalizeRecognitionProfile(value, fallback = "balanced") {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "fast" || normalized === "balanced" || normalized === "precise") {
    return normalized;
  }
  return fallback;
}

function optionalPositiveInt(value) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseChromeAnalysisJson(raw) {
  if (!raw) {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  try {
    return JSON.parse(String(raw));
  } catch (_error) {
    return null;
  }
}

function chromeKindFromAnalysis(analysis) {
  return String(analysis?.tipo_provavel || analysis?.elemento?.tipo_provavel || "").trim() || "generic";
}

function chromeKindLabel(kind) {
  switch (kind) {
    case "text_input":
      return "Campo de texto";
    case "textarea":
      return "Textarea";
    case "select":
      return "Select";
    case "button":
      return "Botao";
    case "link":
      return "Link";
    case "editable":
      return "Campo editavel";
    case "choice":
      return "Escolha";
    default:
      return "Elemento generico";
  }
}

function chromeActionOptionsForKind(kind) {
  if (kind === "text_input" || kind === "textarea" || kind === "editable") {
    return [
      ["preencher", "Preencher texto"],
      ["limpar", "Limpar campo"],
      ["clicar", "Clicar no campo"],
      ["esperar", "Esperar aparecer"],
      ["verificar_existe", "Verificar se existe"],
      ["pegar_texto", "Pegar texto"],
    ];
  }
  if (kind === "select") {
    return [
      ["selecionar_texto", "Selecionar por texto"],
      ["selecionar_valor", "Selecionar por value"],
      ["selecionar_indice", "Selecionar por indice"],
      ["clicar", "Clicar"],
      ["esperar", "Esperar aparecer"],
      ["verificar_existe", "Verificar se existe"],
    ];
  }
  return [
    ["clicar", "Clicar"],
    ["esperar", "Esperar aparecer"],
    ["verificar_existe", "Verificar se existe"],
    ["pegar_texto", "Pegar texto"],
    ["clicar_aguardar_carregamento", "Clicar e aguardar carregamento"],
    ["clicar_aguardar_download", "Clicar e aguardar download"],
  ];
}

function renderChromeActionOptions(kind, selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  return chromeActionOptionsForKind(kind)
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function chromeActionNeedsValue(actionType = "") {
  return ["preencher", "selecionar_texto", "selecionar_valor", "selecionar_indice"].includes(String(actionType || "").trim());
}

function chromeActionSupportsClear(actionType = "") {
  return String(actionType || "").trim() === "preencher";
}

function chromeActionSupportsPressAfter(actionType = "") {
  return String(actionType || "").trim() === "preencher";
}

function chromeActionSupportsSaveAs(actionType = "") {
  return String(actionType || "").trim() === "pegar_texto";
}

function renderChromeMethodOptions(analysis, selectedValue = "") {
  const selected = String(selectedValue || analysis?.alvo_recomendado?.metodo || "css").trim();
  const selectors = Array.isArray(analysis?.seletores) ? analysis.seletores : [];
  const defaults = [
    ["placeholder", "Placeholder"],
    ["name", "Name"],
    ["aria-label", "Aria-label"],
    ["labelledby", "Label / aria-labelledby"],
    ["id", "ID"],
    ["css", "CSS"],
    ["xpath", "XPath"],
    ["text", "Texto"],
    ["role", "Role"],
  ];
  const available = new Set(selectors.map((item) => String(item?.metodo || "").trim()).filter(Boolean));
  return defaults
    .filter(([value]) => available.size === 0 || available.has(value) || value === selected)
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function findChromeSelectorByMethod(analysis, method) {
  const selectedMethod = String(method || "").trim();
  return (analysis?.seletores || []).find((item) => String(item?.metodo || "").trim() === selectedMethod)
    || analysis?.alvo_recomendado
    || null;
}

function renderChromePreviewHtml(analysis) {
  if (!analysis) {
    return `
      <div class="chrome-preview-copy chrome-preview-empty">
        <p class="panel-kicker">Fluxo sugerido</p>
        <h3>Cole o elemento HTML</h3>
        <p class="muted-copy">O gerador analisa o elemento, identifica o melhor seletor e sugere automaticamente a ação mais adequada.</p>
      </div>
    `;
  }
  const element = analysis.elemento || {};
  const best = analysis.alvo_recomendado || {};
  return `
    <div class="chrome-preview-copy">
      <p class="panel-kicker">Elemento detectado</p>
      <h3>${escapeHtml(chromeKindLabel(chromeKindFromAnalysis(analysis)))}</h3>
      <p class="muted-copy">Tag: <strong>${escapeHtml(element.tag || "-")}</strong>${element.type ? ` | Tipo: <strong>${escapeHtml(element.type)}</strong>` : ""}${element.placeholder ? ` | Placeholder: <strong>${escapeHtml(element.placeholder)}</strong>` : ""}</p>
      <p class="muted-copy">Melhor método: <strong>${escapeHtml(best.metodo || "css")}</strong></p>
      <p class="muted-copy">Alvo: <strong>${escapeHtml(best.valor || "-")}</strong></p>
      <p class="muted-copy">Confiança: <strong>${escapeHtml(best.confianca || analysis.confianca || "media")}</strong> | Ação sugerida: <strong>${escapeHtml((analysis.acao_sugerida || {}).tipo || "clicar")}</strong></p>
    </div>
  `;
}

function renderChromeBlockFields(event, mode = "card", currentOrder = null) {
  const details = event.details ?? {};
  const analysis = {
    html_original: details.html_original ?? "",
    elemento: details.elemento ?? {},
    tipo_provavel: details.tipo_provavel ?? "",
    seletores: details.seletores ?? [],
    alvo_recomendado: details.alvo ?? {},
    acao_sugerida: details.acao ?? {},
    nome_sugerido: details.nome ?? "Chrome / Elemento HTML",
    confianca: details.alvo?.confianca ?? "media",
  };
  const fieldAttr = mode === "tree" ? "data-tree-field" : "data-field";
  const actionAttr = mode === "tree" ? "data-tree-action" : "data-action";
  const kind = chromeKindFromAnalysis(analysis);
  const actionType = String(details.acao?.tipo || analysis?.acao_sugerida?.tipo || "clicar").trim();
  const hasAnalysis = Boolean((details.html_original ?? "").trim()) || Boolean((details.alvo?.valor ?? "").trim());
  return `
    <div class="field-stack chrome-block-fields">
      <label>
        <span>Nome do bloco</span>
        <input ${fieldAttr}="chromeName" type="text" value="${escapeHtml(details.nome ?? "Chrome / Elemento HTML")}" />
      </label>
      <label>
        <span>HTML do elemento</span>
        <textarea ${fieldAttr}="chromeHtml" rows="5" placeholder="<input ...> ou <button ...>">${escapeHtml(details.html_original ?? "")}</textarea>
      </label>
      <input ${fieldAttr}="chromeAnalysis" type="hidden" value="${escapeHtml(JSON.stringify(analysis))}" />
      <div class="recognition-action-row">
        <button class="tree-open-button" ${actionAttr}="analyze-chrome-html" type="button">Analisar HTML</button>
        <span class="recognition-action-help">Cole o elemento e deixe o gerador sugerir o que fazer.</span>
      </div>
      <div class="chrome-preview-card" data-chrome-preview>
        ${renderChromePreviewHtml(analysis)}
      </div>
      ${hasAnalysis ? `
      <div class="chrome-quick-grid">
        <label>
          <span>Método de busca</span>
          <select ${fieldAttr}="chromeTargetMethod">
            ${renderChromeMethodOptions(analysis, details.alvo?.metodo ?? "css")}
          </select>
        </label>
        <label>
          <span>Alvo encontrado</span>
          <input ${fieldAttr}="chromeTargetValue" type="text" value="${escapeHtml(details.alvo?.valor ?? "")}" />
        </label>
        <label>
          <span>Ação</span>
          <select ${fieldAttr}="chromeActionType">
            ${renderChromeActionOptions(kind, actionType)}
          </select>
        </label>
        ${chromeActionNeedsValue(actionType) ? `
        <label>
          <span>Origem do valor</span>
          <select ${fieldAttr}="chromeValueSource">
            <option value="texto_fixo" ${String(details.acao?.origem_valor ?? "texto_fixo") === "texto_fixo" ? "selected" : ""}>Texto fixo</option>
            <option value="variavel" ${String(details.acao?.origem_valor ?? "") === "variavel" ? "selected" : ""}>Variavel</option>
            <option value="planilha" ${String(details.acao?.origem_valor ?? "") === "planilha" ? "selected" : ""}>Planilha</option>
          </select>
        </label>
        <label>
          <span>Valor</span>
          <input ${fieldAttr}="chromeActionValue" type="text" value="${escapeHtml(details.acao?.valor ?? "")}" placeholder='Texto fixo ou {{CNPJ}} / {{linha.CNPJ}}' />
        </label>
        ` : ""}
      </div>
      <details class="chrome-advanced-panel">
        <summary>Configurações avançadas</summary>
        <div class="chrome-advanced-grid">
          <label>
            <span>Timeout (ms)</span>
            <input ${fieldAttr}="chromeTimeout" type="number" min="500" step="500" value="${escapeHtml(details.timeout ?? 10000)}" />
          </label>
          ${chromeActionSupportsSaveAs(actionType) ? `
          <label>
            <span>Salvar texto em</span>
            <input ${fieldAttr}="chromeSaveAs" type="text" value="${escapeHtml(details.acao?.salvar_em ?? "")}" placeholder="Nome da variável" />
          </label>
          ` : `<input ${fieldAttr}="chromeSaveAs" type="hidden" value="${escapeHtml(details.acao?.salvar_em ?? "")}" />`}
          ${chromeActionSupportsPressAfter(actionType) ? `
          <label>
            <span>Pressionar depois</span>
            <select ${fieldAttr}="chromePressAfter">
              <option value="" ${!(details.acao?.pressionar_depois) ? "selected" : ""}>Nada</option>
              <option value="Enter" ${String(details.acao?.pressionar_depois ?? "") === "Enter" ? "selected" : ""}>Enter</option>
              <option value="Tab" ${String(details.acao?.pressionar_depois ?? "") === "Tab" ? "selected" : ""}>Tab</option>
            </select>
          </label>
          ` : `<input ${fieldAttr}="chromePressAfter" type="hidden" value="${escapeHtml(details.acao?.pressionar_depois ?? "")}" />`}
          <label>
            <span>Ao concluir</span>
            <select ${fieldAttr}="chromeSuccessAction">
              <option value="continuar" ${String(details.ao_sucesso ?? "continuar") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="ir_para_sequencia" ${String(details.ao_sucesso ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para pagina</option>
              <option value="ir_para_bloco" ${String(details.ao_sucesso ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
            <span>Pagina apos sucesso</span>
            <select ${fieldAttr}="chromeSuccessSequence">
              ${renderSequenceSuggestionsOptions(details.sequencia_sucesso ?? "pagina_2", "Escolha uma pagina")}
            </select>
          </label>
          <label>
            <span>Bloco após sucesso</span>
            <select ${fieldAttr}="chromeSuccessBlock">
              ${blockTargetOptions(details.bloco_sucesso ?? "", currentOrder, "Escolha um bloco")}
            </select>
          </label>
          <input ${fieldAttr}="chromeSuccessSequenceDelay" type="hidden" value="${escapeHtml(formatTransitionDelayValue(details.atraso_antes_sequencia_sucesso ?? 0))}" />
          <label>
            <span>Falha</span>
            <select ${fieldAttr}="chromeFailureAction">
              <option value="parar" ${String(details.ao_falhar ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(details.ao_falhar ?? "") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(details.ao_falhar ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_sequencia" ${String(details.ao_falhar ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para pagina</option>
              <option value="ir_para_bloco" ${String(details.ao_falhar ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
            <span>Pagina em caso de falha</span>
            <select ${fieldAttr}="chromeFailureSequence">
              ${renderSequenceSuggestionsOptions(details.sequencia_falha ?? "pagina_2", "Escolha uma pagina")}
            </select>
          </label>
          <label>
            <span>Ir para bloco</span>
            <select ${fieldAttr}="chromeFailureBlock">
              ${blockTargetOptions(details.bloco_falha ?? "", currentOrder, "Escolha um bloco")}
            </select>
          </label>
          <input ${fieldAttr}="chromeFailureSequenceDelay" type="hidden" value="${escapeHtml(formatTransitionDelayValue(details.atraso_antes_sequencia_falha ?? 0))}" />
          <label>
            <span>Tentativas</span>
            <input ${fieldAttr}="chromeRetryCount" type="number" min="1" step="1" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
          </label>
          <label>
            <span>Intervalo tentativas</span>
            <input ${fieldAttr}="chromeRetryInterval" type="number" min="0" step="0.5" value="${escapeHtml(details.intervalo_tentativas ?? 0.5)}" />
          </label>
          ${chromeActionSupportsClear(actionType) ? `
          <label class="inline-checkbox">
            <input ${fieldAttr}="chromeClearBefore" type="checkbox" ${details.acao?.limpar_antes !== false ? "checked" : ""} />
            <span>Limpar antes</span>
          </label>
          ` : `<input ${fieldAttr}="chromeClearBefore" type="hidden" value="${details.acao?.limpar_antes !== false ? "true" : "false"}" />`}
          <label class="inline-checkbox">
            <input ${fieldAttr}="chromeFallbackVisual" type="checkbox" ${details.fallback_visual ? "checked" : ""} />
            <span>Usar fallback visual</span>
          </label>
          <label class="chrome-fallback-field">
            <span>Imagem do fallback</span>
            <div class="capture-inline">
              <input ${fieldAttr}="chromeFallbackImage" type="text" value="${escapeHtml(details.fallback_imagem ?? "")}" placeholder="imagens/campo.png" />
              <button class="tree-open-button" ${actionAttr}="select-chrome-fallback-image" type="button">Selecionar</button>
            </div>
          </label>
        </div>
      </details>
      ` : `
      <div class="chrome-minimal-help">
        <p class="muted-copy">Depois da análise, o gerador mostra automaticamente o melhor método de busca e a ação sugerida para esse elemento.</p>
      </div>
      `}
    </div>
  `;
}

function buildChromeDetailsFromAnalysisAndValues(analysis, values) {
  const selector = findChromeSelectorByMethod(analysis, values.chromeTargetMethod);
  const targetMethod = String(values.chromeTargetMethod || selector?.metodo || analysis?.alvo_recomendado?.metodo || "css").trim();
  const targetValue = String(values.chromeTargetValue || selector?.valor || analysis?.alvo_recomendado?.valor || "").trim();
  const selectorCss = selector?.seletor_css || analysis?.alvo_recomendado?.seletor_css || "";
  const element = { ...(analysis?.elemento || {}) };
  const action = {
    tipo: values.chromeActionType,
    origem_valor: values.chromeValueSource,
    valor: values.chromeActionValue,
    limpar_antes: values.chromeClearBefore,
    pressionar_depois: values.chromePressAfter,
    salvar_em: values.chromeSaveAs,
  };
  const target = {
    metodo: targetMethod,
    valor: targetValue,
    confianca: selector?.confianca || analysis?.alvo_recomendado?.confianca || analysis?.confianca || "media",
    seletor_css: selectorCss,
    codigo_playwright: selector?.codigo_playwright || "",
    role: selector?.role || element.role || "",
  };
  return {
    nome: values.chromeName || analysis?.nome_sugerido || "Chrome / Elemento HTML",
    html_original: values.chromeHtml,
    elemento: element,
    tipo_provavel: chromeKindFromAnalysis(analysis),
    seletores: Array.isArray(analysis?.seletores) ? analysis.seletores : [],
    alvo: target,
    acao: action,
    timeout: Math.max(500, Math.trunc(Number(values.chromeTimeout) || 10000)),
    fallback_visual: Boolean(values.chromeFallbackVisual),
    fallback_imagem: values.chromeFallbackImage || "",
    ao_sucesso: values.chromeSuccessAction || "continuar",
    bloco_sucesso: optionalPositiveInt(values.chromeSuccessBlock),
    sequencia_sucesso: optionalSequenceValue(values.chromeSuccessSequence),
    atraso_antes_sequencia_sucesso: normalizeTransitionDelay(values.chromeSuccessSequenceDelay),
    ao_falhar: values.chromeFailureAction || "parar",
    bloco_falha: optionalPositiveInt(values.chromeFailureBlock),
    sequencia_falha: optionalSequenceValue(values.chromeFailureSequence),
    atraso_antes_sequencia_falha: normalizeTransitionDelay(values.chromeFailureSequenceDelay),
    quantidade_tentativas: Math.max(1, Math.trunc(Number(values.chromeRetryCount) || 1)),
    intervalo_tentativas: Number(values.chromeRetryInterval) || 0,
  };
}

function refreshChromeComposerActionOptions() {
  if (!chromeActionTypeInput) {
    return;
  }
  const analysis = parseChromeAnalysisJson(chromeAnalysisJsonInput?.value);
  const current = chromeActionTypeInput.value || (analysis?.acao_sugerida || {}).tipo || "clicar";
  chromeActionTypeInput.innerHTML = renderChromeActionOptions(chromeKindFromAnalysis(analysis), current);
  chromeActionTypeInput.value = current;
}

function applyChromeAnalysisToComposer(analysis, preserveTargetMethod = false) {
  if (!analysis) {
    return;
  }
  if (chromeAnalysisJsonInput) {
    chromeAnalysisJsonInput.value = JSON.stringify(analysis);
  }
  if (chromeHtmlPreview) {
    chromeHtmlPreview.innerHTML = renderChromePreviewHtml(analysis);
  }
  if (chromeBlockNameInput && !chromeBlockNameInput.value.trim()) {
    chromeBlockNameInput.value = analysis.nome_sugerido || "Chrome / Elemento HTML";
  } else if (chromeBlockNameInput && chromeBlockNameInput.value === "Chrome / Elemento HTML") {
    chromeBlockNameInput.value = analysis.nome_sugerido || "Chrome / Elemento HTML";
  }
  if (chromeTargetMethodInput) {
    const selectedMethod = preserveTargetMethod ? chromeTargetMethodInput.value : (analysis.alvo_recomendado?.metodo || "css");
    chromeTargetMethodInput.innerHTML = renderChromeMethodOptions(analysis, selectedMethod);
    chromeTargetMethodInput.value = selectedMethod;
  }
  const selector = findChromeSelectorByMethod(analysis, chromeTargetMethodInput?.value);
  if (chromeTargetValueInput) {
    chromeTargetValueInput.value = selector?.valor || analysis.alvo_recomendado?.valor || "";
  }
  refreshChromeComposerActionOptions();
  if (chromeActionTypeInput && !chromeActionTypeInput.value) {
    chromeActionTypeInput.value = (analysis.acao_sugerida || {}).tipo || "clicar";
  }
  if (chromeValueSourceInput) {
    chromeValueSourceInput.value = (analysis.acao_sugerida || {}).origem_valor || "texto_fixo";
  }
  if (chromeActionValueInput && !chromeActionValueInput.value.trim()) {
    chromeActionValueInput.value = (analysis.acao_sugerida || {}).valor || "";
  }
  if (chromeClearBeforeInput) {
    chromeClearBeforeInput.checked = Boolean((analysis.acao_sugerida || {}).limpar_antes);
  }
  if (chromePressAfterInput && !chromePressAfterInput.value) {
    chromePressAfterInput.value = (analysis.acao_sugerida || {}).pressionar_depois || "";
  }
}

async function analyzeChromeHtmlForComposer() {
  const html = chromeHtmlInput?.value?.trim() || "";
  if (!html) {
    setMessage("Cole o elemento HTML antes de analisar.", "error");
    return null;
  }
  const analysis = await invoke("analyze_html_element", { html });
  applyChromeAnalysisToComposer(analysis);
  setMessage("Elemento HTML analisado com sucesso.", "success");
  return analysis;
}

function composerChromeValues() {
  return {
    chromeName: chromeBlockNameInput?.value?.trim() || "",
    chromeHtml: chromeHtmlInput?.value?.trim() || "",
    chromeAnalysis: parseChromeAnalysisJson(chromeAnalysisJsonInput?.value),
    chromeTargetMethod: chromeTargetMethodInput?.value || "css",
    chromeTargetValue: chromeTargetValueInput?.value || "",
    chromeActionType: chromeActionTypeInput?.value || "clicar",
    chromeValueSource: chromeValueSourceInput?.value || "texto_fixo",
    chromeActionValue: chromeActionValueInput?.value || "",
    chromeSaveAs: chromeSaveAsInput?.value?.trim() || "",
    chromeTimeout: parseNumber(chromeTimeoutInput?.value, 10000),
    chromePressAfter: chromePressAfterInput?.value || "",
    chromeSuccessAction: chromeSuccessActionInput?.value || "continuar",
    chromeSuccessBlock: chromeSuccessBlockInput?.value || "",
    chromeSuccessSequence: chromeSuccessSequenceInput?.value || "pagina_2",
    chromeFailureAction: chromeFailureActionInput?.value || "parar",
    chromeFailureBlock: chromeFailureBlockInput?.value || "",
    chromeFailureSequence: chromeFailureSequenceInput?.value || "pagina_2",
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(chromeRetryCountInput?.value, 1))),
    chromeRetryInterval: parseNumber(chromeRetryIntervalInput?.value, 0.5),
    chromeClearBefore: Boolean(chromeClearBeforeInput?.checked),
    chromeFallbackVisual: Boolean(chromeFallbackVisualInput?.checked),
    chromeFallbackImage: chromeFallbackImageInput?.value?.trim() || "",
    delay: parseNumber(chromeDelayInput?.value, 0),
  };
}

function applyChromeAnalysisToContainer(container, fieldAttr, analysis, preserveMethod = false) {
  if (!container || !analysis) {
    return;
  }
  const get = (field) => container.querySelector(`[${fieldAttr}="${field}"]`);
  const analysisField = get("chromeAnalysis");
  if (analysisField) {
    analysisField.value = JSON.stringify(analysis);
  }
  const preview = container.querySelector("[data-chrome-preview]");
  if (preview) {
    preview.innerHTML = renderChromePreviewHtml(analysis);
  }
  const nameField = get("chromeName");
  if (nameField && (!nameField.value.trim() || nameField.value === "Chrome / Elemento HTML")) {
    nameField.value = analysis.nome_sugerido || "Chrome / Elemento HTML";
  }
  const methodField = get("chromeTargetMethod");
  if (methodField) {
    const nextMethod = preserveMethod ? methodField.value : (analysis.alvo_recomendado?.metodo || "css");
    methodField.innerHTML = renderChromeMethodOptions(analysis, nextMethod);
    methodField.value = nextMethod;
  }
  const selector = findChromeSelectorByMethod(analysis, methodField?.value);
  const valueField = get("chromeTargetValue");
  if (valueField) {
    valueField.value = selector?.valor || analysis.alvo_recomendado?.valor || "";
  }
  const actionField = get("chromeActionType");
  if (actionField) {
    const currentAction = actionField.value || analysis.acao_sugerida?.tipo || "clicar";
    actionField.innerHTML = renderChromeActionOptions(chromeKindFromAnalysis(analysis), currentAction);
    actionField.value = currentAction;
  }
  const valueSourceField = get("chromeValueSource");
  if (valueSourceField) {
    valueSourceField.value = analysis.acao_sugerida?.origem_valor || valueSourceField.value || "texto_fixo";
  }
  const actionValueField = get("chromeActionValue");
  if (actionValueField && !actionValueField.value.trim()) {
    actionValueField.value = analysis.acao_sugerida?.valor || "";
  }
  const clearField = get("chromeClearBefore");
  if (clearField) {
    clearField.checked = analysis.acao_sugerida?.limpar_antes !== false;
  }
  const pressField = get("chromePressAfter");
  if (pressField && !pressField.value) {
    pressField.value = analysis.acao_sugerida?.pressionar_depois || "";
  }
}

async function analyzeChromeHtmlInContainer(container, fieldAttr) {
  if (!container) {
    return null;
  }
  const htmlField = container.querySelector(`[${fieldAttr}="chromeHtml"]`);
  const html = htmlField?.value?.trim() || "";
  if (!html) {
    setMessage("Cole o HTML do elemento antes de analisar.", "error");
    return null;
  }
  const analysis = await invoke("analyze_html_element", { html });
  applyChromeAnalysisToContainer(container, fieldAttr, analysis);
  setMessage("Elemento HTML analisado com sucesso.", "success");
  return analysis;
}

function availableBlockTargets(currentOrder = null) {
  return (state.roadmap?.events ?? []).filter((event) => {
    const order = Number(event?.order);
    if (!Number.isFinite(order)) {
      return false;
    }
    if (currentOrder == null) {
      return true;
    }
    return order !== Number(currentOrder);
  });
}

function getCommandMapEventByOrder(order, roadmap = state.roadmap) {
  return (roadmap?.events ?? []).find((item) => Number(item.order) === Number(order)) || null;
}

function getCommandMapBlockLocalNumber(order, sequenceName, roadmap = state.roadmap) {
  const normalizedSequence = normalizeSequenceName(sequenceName);
  const pageEvents = getCommandMapEvents(normalizedSequence, roadmap);
  const targetIndex = pageEvents.findIndex((event) => Number(event?.order) === Number(order));
  return targetIndex >= 0 ? targetIndex + 1 : null;
}

function blockTargetLabel(event, options = {}) {
  const { includePage = true, includeOrder = true } = options;
  const order = Number(event?.order);
  const sequence = normalizeSequenceName(event?.sequence || event?.sequencia);
  const pageLabel = getCommandMapPageLabel(sequence);
  const localNumber = getCommandMapBlockLocalNumber(order, sequence);
  const title = String(event?.title || event?.type || "Bloco").trim();
  const labelParts = [];
  if (includePage) {
    labelParts.push(pageLabel);
  }
  labelParts.push(`Bloco ${localNumber || (Number.isFinite(order) ? order : "?")}`);
  if (title) {
    labelParts.push(title);
  }

  let label = labelParts.join(" - ");
  if (includeOrder && Number.isFinite(order)) {
    label += ` (#${order})`;
  }
  return label;
}

function blockTargetLabelByOrder(order, options = {}) {
  const event = getCommandMapEventByOrder(order);
  if (event) {
    return blockTargetLabel(event, options);
  }
  const numericOrder = Number(order);
  return Number.isFinite(numericOrder) ? `Bloco ${numericOrder}` : "Bloco";
}

function blockTargetOptions(selectedValue = "", currentOrder = null, placeholder = "Escolha um bloco") {
  const selected = String(selectedValue ?? "").trim();
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];

  const groupedTargets = new Map();
  for (const event of availableBlockTargets(currentOrder)) {
    const sequence = normalizeSequenceName(event?.sequence || event?.sequencia);
    if (!groupedTargets.has(sequence)) {
      groupedTargets.set(sequence, []);
    }
    groupedTargets.get(sequence).push(event);
  }

  for (const page of getCommandMapPageDefinitions()) {
    const events = groupedTargets.get(page.sequence) || [];
    if (!events.length) {
      continue;
    }
    options.push(`<optgroup label="${escapeHtml(page.label)}">`);
    for (const event of events) {
      const order = Number(event.order);
      const selectedAttr = String(order) === selected ? " selected" : "";
      options.push(
        `<option value="${escapeHtml(order)}"${selectedAttr}>${escapeHtml(blockTargetLabel(event, { includePage: false, includeOrder: true }))}</option>`
      );
    }
    options.push(`</optgroup>`);
    groupedTargets.delete(page.sequence);
  }

  for (const [sequence, events] of groupedTargets.entries()) {
    options.push(`<optgroup label="${escapeHtml(getCommandMapPageLabel(sequence))}">`);
    for (const event of events) {
      const order = Number(event.order);
      const selectedAttr = String(order) === selected ? " selected" : "";
      options.push(
        `<option value="${escapeHtml(order)}"${selectedAttr}>${escapeHtml(blockTargetLabel(event, { includePage: false, includeOrder: true }))}</option>`
      );
    }
    options.push(`</optgroup>`);
  }
  return options.join("");
}

function renderActionTargetFields(
  fieldAttr,
  actionFieldName,
  actionValue,
  sequenceFieldName,
  sequenceValue,
  blockFieldName,
  blockValue,
  currentOrder,
  labels = {},
) {
  const action = String(actionValue || "").trim();
  const sequenceLabel = labels.sequenceLabel || "Escolha a pagina";
  const blockLabel = labels.blockLabel || "Escolha o bloco";
  const sequencePlaceholder = labels.sequencePlaceholder || "Escolha uma pagina";
  const blockPlaceholder = labels.blockPlaceholder || "Escolha um bloco";
  const delayFieldName = labels.delayFieldName || "";
  const delayValue = normalizeTransitionDelay(labels.delayValue ?? 0);
  const delayLabel = labels.delayLabel || "Esperar antes de abrir";
  const showSequence = action === "ir_para_sequencia";
  const showBlock = action === "ir_para_bloco";

  return `
    <div
      class="action-target-field"
      data-action-visibility-source="${escapeHtml(actionFieldName)}"
      data-action-visibility-kind="sequence"
      ${showSequence ? "" : "hidden"}
    >
      <label>
        <span>${escapeHtml(sequenceLabel)}</span>
        <select ${fieldAttr}="${escapeHtml(sequenceFieldName)}">
          ${renderSequenceSuggestionsOptions(sequenceValue || "pagina_2", sequencePlaceholder)}
        </select>
      </label>
      ${delayFieldName ? `
      <label>
        <span>${escapeHtml(delayLabel)}</span>
        <input
          ${fieldAttr}="${escapeHtml(delayFieldName)}"
          type="number"
          min="0"
          step="0.1"
          value="${escapeHtml(formatTransitionDelayValue(delayValue))}"
        />
      </label>
      ` : ""}
    </div>
    <div
      class="action-target-field"
      data-action-visibility-source="${escapeHtml(actionFieldName)}"
      data-action-visibility-kind="block"
      ${showBlock ? "" : "hidden"}
    >
      <label>
        <span>${escapeHtml(blockLabel)}</span>
        <select ${fieldAttr}="${escapeHtml(blockFieldName)}">
          ${blockTargetOptions(blockValue, currentOrder, blockPlaceholder)}
        </select>
      </label>
      ${delayFieldName ? `
        <input
          ${fieldAttr}="${escapeHtml(delayFieldName)}"
          type="hidden"
          value="${escapeHtml(formatTransitionDelayValue(delayValue))}"
        />
        <p class="action-target-hint">O tempo deste pulo fica na linha azul do caminho.</p>
      ` : ""}
    </div>
  `;
}

function renderSuccessFlowFields(
  fieldAttr,
  successAction = "continuar",
  successBlock = "",
  successSequence = "",
  successSequenceDelay = 0,
  currentOrder = null,
) {
  const action = String(successAction || "continuar");
  const block = String(successBlock ?? "");
  const sequence = String(successSequence ?? "");
  return `
    <label>
      <span>Ao concluir</span>
      <select ${fieldAttr}="successAction">
        <option value="continuar" ${action === "continuar" ? "selected" : ""}>Continuar</option>
        <option value="ir_para_sequencia" ${action === "ir_para_sequencia" ? "selected" : ""}>Ir para pagina</option>
        <option value="ir_para_bloco" ${action === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
      </select>
    </label>
    ${renderActionTargetFields(
      fieldAttr,
      "successAction",
      action,
      "successSequence",
      sequence,
      "successBlock",
      block,
      currentOrder,
      {
        sequenceLabel: "Abrir esta pagina",
        blockLabel: "Abrir este bloco",
        delayFieldName: "successSequenceDelay",
        delayValue: successSequenceDelay,
        delayLabel: "Esperar antes de ir (s)",
      }
    )}
  `;
}

function resolveDestinationPage(preferredValue = "") {
  const pages = getCommandMapPageDefinitions();
  if (!pages.length) {
    return "";
  }

  const normalizedPreferred = normalizeSequenceName(preferredValue || "");
  if (pages.some((page) => page.sequence === normalizedPreferred)) {
    return normalizedPreferred;
  }

  const currentSequence = normalizeSequenceName(currentSequenceName());
  return pages.find((page) => page.sequence !== currentSequence)?.sequence || pages[0]?.sequence || "";
}

function applyActionVisibilityState(container) {
  if (!container) {
    return;
  }

  container.querySelectorAll("[data-action-visibility-source]").forEach((wrapper) => {
    const source = String(wrapper.dataset.actionVisibilitySource || "").trim();
    const kind = String(wrapper.dataset.actionVisibilityKind || "").trim();
    if (!source || !kind) {
      return;
    }

    const control = container.querySelector(
      `[data-tree-field="${source}"], [data-insert-field="${source}"], [data-field="${source}"]`
    );
    const action = String(control?.value || "").trim();
    const shouldShow =
      (kind === "sequence" && action === "ir_para_sequencia") ||
      (kind === "block" && action === "ir_para_bloco");

    wrapper.hidden = !shouldShow;
    wrapper.classList.toggle("is-visible", shouldShow);
  });
}

function normalizeRecognitionTreeTab(tabName) {
  const normalized = String(tabName || "base").trim().toLowerCase();
  return ["base", "preview", "action", "advanced"].includes(normalized) ? normalized : "base";
}

function normalizeSpreadsheetTreeTab(tabName) {
  const normalized = String(tabName || "planilha").trim().toLowerCase();
  return ["planilha", "fluxo"].includes(normalized) ? normalized : "planilha";
}

function applyRecognitionTreeTabState(card, tabName) {
  if (!card) {
    return;
  }

  const activeTab = normalizeRecognitionTreeTab(tabName);
  card.querySelectorAll("[data-recognition-tab-target]").forEach((button) => {
    const isActive = button.dataset.recognitionTabTarget === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  card.querySelectorAll("[data-recognition-tab-panel]").forEach((panel) => {
    const isActive = panel.dataset.recognitionTabPanel === activeTab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function applySpreadsheetTreeTabState(card, tabName) {
  if (!card) {
    return;
  }

  const activeTab = normalizeSpreadsheetTreeTab(tabName);
  card.querySelectorAll("[data-spreadsheet-tab-target]").forEach((button) => {
    const isActive = button.dataset.spreadsheetTabTarget === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  card.querySelectorAll("[data-spreadsheet-tab-panel]").forEach((panel) => {
    const isActive = panel.dataset.spreadsheetTabPanel === activeTab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function setRecognitionTreeTab(order, tabName) {
  const activeTab = normalizeRecognitionTreeTab(tabName);
  state.recognitionTreeTabs = {
    ...state.recognitionTreeTabs,
    [order]: activeTab,
  };

  commandMapList.querySelectorAll(`.command-tree-card[data-order="${order}"]`).forEach((card) => {
    applyRecognitionTreeTabState(card, activeTab);
    hydrateRecognitionPreviewCards(card);
  });
  scheduleCommandConnectorLayout();
}

function setSpreadsheetTreeTab(order, tabName) {
  const activeTab = normalizeSpreadsheetTreeTab(tabName);
  state.spreadsheetTreeTabs = {
    ...state.spreadsheetTreeTabs,
    [order]: activeTab,
  };

  commandMapList.querySelectorAll(`.command-tree-card[data-order="${order}"]`).forEach((card) => {
    applySpreadsheetTreeTabState(card, activeTab);
  });
  scheduleCommandConnectorLayout();
}

function animateExpandedTreeCardOpen() {
  const panel = commandMapList.querySelector(".command-card-overlay-panel");
  const backdrop = commandMapList.querySelector(".command-card-overlay-backdrop");
  if (!panel) {
    return;
  }

  const origin = state.expandedTreeCardOrigin;
  const panelRect = panel.getBoundingClientRect();
  const panelCenterX = panelRect.left + panelRect.width / 2;
  const panelCenterY = panelRect.top + panelRect.height / 2;

  let startTransform = "perspective(1200px) rotateX(-8deg) scale(0.92)";
  if (origin) {
    const originCenterX = origin.left + origin.width / 2;
    const originCenterY = origin.top + origin.height / 2;
    const deltaX = originCenterX - panelCenterX;
    const deltaY = originCenterY - panelCenterY;
    const scaleX = Math.max(0.34, Math.min(1, origin.width / panelRect.width));
    const scaleY = Math.max(0.28, Math.min(1, origin.height / panelRect.height));
    startTransform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
  }

  backdrop?.animate(
    [
      { opacity: 0 },
      { opacity: 1 },
    ],
    {
      duration: 220,
      easing: "ease-out",
      fill: "both",
    }
  );

  panel.animate(
    [
      {
        opacity: 0.78,
        transform: startTransform,
      },
      {
        opacity: 1,
        transform: "translate(0px, 0px) scale(1, 1)",
      },
    ],
    {
      duration: 260,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both",
    }
  );
}

function openExpandedTreeCard(order, sourceElement = null) {
  const sourceCard =
    sourceElement?.closest(".command-tree-card") ||
    commandMapList.querySelector(`.command-tree-card[data-order="${order}"]`);
  const sourceRect = sourceCard?.getBoundingClientRect();
  state.expandedTreeCardOrigin = sourceRect
    ? {
        left: sourceRect.left,
        top: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      }
    : null;
  state.expandedTreeCardOrder = Number(order) || null;
  builderShell?.classList.add("has-command-card-overlay");
  renderCommandMap();
  requestAnimationFrame(() => {
    animateExpandedTreeCardOpen();
  });
}

function closeExpandedTreeCard() {
  state.expandedTreeCardOrder = null;
  state.expandedTreeCardOrigin = null;
  builderShell?.classList.remove("has-command-card-overlay");
  renderCommandMap();
}

function renderRecognitionTreeHiddenFields(details = {}, currentOrder = null) {
  const clickMode = recognitionClickModeFromDetails(details);
  const successAction = String(details.ao_sucesso ?? "continuar");
  const successBlock = String(details.bloco_sucesso ?? "");
  const failureAction = String(details.ao_nao_encontrar ?? "parar");
  const failureBlock = String(details.bloco_nao_encontrar ?? "");
  const failureSequence = String(details.sequencia_nao_encontrar ?? "");
  return `
    <input data-tree-field="imagePath" type="hidden" value="${escapeHtml(details.imagem ?? "")}" />
    <input data-tree-field="timeout" type="hidden" value="${escapeHtml(details.timeout ?? 10)}" />
    <input data-tree-field="confidence" type="hidden" value="${escapeHtml(details.confianca ?? 0.8)}" />
    <input data-tree-field="searchProfile" type="hidden" value="${escapeHtml(normalizeRecognitionProfile(details.perfil_busca, "balanced"))}" />
    <input data-tree-field="expectedOcrText" type="hidden" value="${escapeHtml(details.texto_ocr_esperado ?? "")}" />
    <input data-tree-field="windowTitle" type="hidden" value="${escapeHtml(details.janela_alvo ?? "")}" />
    <input data-tree-field="clickOnFind" type="hidden" value="${escapeHtml(clickMode)}" />
    <input data-tree-field="successAction" type="hidden" value="${escapeHtml(successAction)}" />
    <input data-tree-field="successBlock" type="hidden" value="${escapeHtml(successBlock)}" />
    <input data-tree-field="failureAction" type="hidden" value="${escapeHtml(failureAction)}" />
    <input data-tree-field="failureBlock" type="hidden" value="${escapeHtml(failureBlock)}" />
    <input data-tree-field="failureSequence" type="hidden" value="${escapeHtml(failureSequence)}" />
    <input data-tree-field="retryCount" type="hidden" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
    <input data-tree-field="retryInterval" type="hidden" value="${escapeHtml(details.intervalo_tentativas ?? 1)}" />
    <input data-tree-field="delay" type="hidden" value="${escapeHtml(details.delay ?? "")}" data-recognition-hidden-order="${escapeHtml(currentOrder ?? "")}" />
  `;
}

function renderRecognitionCompactTreeEditor(event) {
  const details = event.details ?? {};
  const hasReference = Boolean(normalizeRecognitionImagePath(details.imagem));
  const tested = isRecognitionTestedForEvent(event);
  const profileLabel = {
    fast: "Rapido",
    balanced: "Equilibrado",
    precise: "Preciso",
  }[normalizeRecognitionProfile(details.perfil_busca, "balanced")] || "Equilibrado";
  const clickLabel = {
    single: "1 clique",
    double: "2 cliques",
    identify: "Identificar",
  }[recognitionClickModeFromDetails(details)] || "1 clique";
  const failureLabel = {
    parar: "Parar",
    continuar: "Continuar",
    pular: "Continuar",
    tentar_novamente: "Tentar novamente",
    ir_para_bloco: details.bloco_nao_encontrar
      ? `Ir para ${blockTargetLabelByOrder(details.bloco_nao_encontrar, { includePage: true, includeOrder: false })}`
      : "Ir para bloco",
    ir_para_sequencia: `Ir para ${getCommandMapPageLabel(details.sequencia_nao_encontrar || "pagina_2")}`,
  }[String(details.ao_nao_encontrar ?? "parar")] || "Parar";
  const windowLabel = normalizeRecognitionWindowTitle(details.janela_alvo || "");

  return `
    <div class="recognition-compact-body">
      <div class="recognition-compact-hero">
        <div class="recognition-compact-statuses">
          <span class="recognition-compact-state ${hasReference ? "is-ready" : "is-missing"}" data-recognition-state="true">
            ${hasReference ? "Reconhecimento feito" : "Sem referencia"}
          </span>
          <span class="recognition-compact-test ${tested ? "is-tested" : "is-pending"}" data-recognition-test="true">
            ${tested ? "Testado" : "Nao testado"}
          </span>
        </div>
        <button class="tree-open-button recognition-test-inline" data-tree-action="test-image-recognition" type="button">Testar</button>
      </div>
      <div class="recognition-compact-metrics">
        <span><small>Timeout</small><strong>${escapeHtml(details.timeout ?? 10)}s</strong></span>
        <span><small>Confianca</small><strong>${escapeHtml(details.confianca ?? 0.8)}</strong></span>
        <span><small>Perfil</small><strong>${escapeHtml(profileLabel)}</strong></span>
      </div>
      <div class="recognition-compact-summary">
        <span>Ao reconhecer: <strong>${escapeHtml(clickLabel)}</strong></span>
        <span>Se falhar: <strong>${escapeHtml(failureLabel)}</strong></span>
        <span>Janela: <strong>${escapeHtml(windowLabel || "Sem janela fixa")}</strong></span>
      </div>
      ${renderRecognitionTreeHiddenFields(details, event.order)}
    </div>
  `;
}

function renderRecognitionExpandedTreeEditor(event) {
  const details = event.details ?? {};
  const activeRecognitionTab = normalizeRecognitionTreeTab(state.recognitionTreeTabs?.[event.order] ?? "base");
  return `
    <div class="field-stack field-stack-recognition recognition-expanded-editor">
      <div class="recognition-card-tabs has-preview" role="tablist" aria-label="Configuracoes do reconhecimento visual">
        <button class="recognition-card-tab ${activeRecognitionTab === "base" ? "is-active" : ""}" data-recognition-tab-target="base" type="button" aria-pressed="${activeRecognitionTab === "base" ? "true" : "false"}">Base</button>
        <button class="recognition-card-tab ${activeRecognitionTab === "preview" ? "is-active" : ""}" data-recognition-tab-target="preview" type="button" aria-pressed="${activeRecognitionTab === "preview" ? "true" : "false"}">Preview</button>
        <button class="recognition-card-tab ${activeRecognitionTab === "action" ? "is-active" : ""}" data-recognition-tab-target="action" type="button" aria-pressed="${activeRecognitionTab === "action" ? "true" : "false"}">Acao</button>
        <button class="recognition-card-tab ${activeRecognitionTab === "advanced" ? "is-active" : ""}" data-recognition-tab-target="advanced" type="button" aria-pressed="${activeRecognitionTab === "advanced" ? "true" : "false"}">Avancado</button>
      </div>

      <div class="recognition-card-panel ${activeRecognitionTab === "base" ? "is-active" : ""}" data-recognition-tab-panel="base" ${activeRecognitionTab === "base" ? "" : "hidden"}>
        <label class="recognition-reference-field">
          <span>Referencia visual</span>
          <div class="capture-inline">
            <input data-tree-field="imagePath" type="text" value="${escapeHtml(details.imagem ?? "")}" placeholder="imagens/botao_salvar.png, painel_erro.png..." />
            <button class="tree-open-button" data-tree-action="capture-image" type="button">Capturar nova imagem</button>
            <button class="tree-open-button" data-tree-action="select-image" type="button">Selecionar referencia</button>
          </div>
        </label>
        <button class="tree-open-button recognition-test-inline" data-tree-action="test-image-recognition" type="button">Testar imagem</button>
        <div class="tree-inline-fields tree-inline-fields-recognition recognition-panel-grid">
          <label class="recognition-cell recognition-cell-sm">
            <span>Timeout</span>
            <input data-tree-field="timeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 10)}" />
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Confianca</span>
            <input data-tree-field="confidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.8)}" />
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Perfil</span>
            <select data-tree-field="searchProfile">
              <option value="fast" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "fast" ? "selected" : ""}>Rapido</option>
              <option value="balanced" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "balanced" ? "selected" : ""}>Equilibrado</option>
              <option value="precise" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "precise" ? "selected" : ""}>Preciso</option>
            </select>
          </label>
          <label class="recognition-cell recognition-cell-full">
            <span>Texto OCR obrigatorio</span>
            <input data-tree-field="expectedOcrText" type="text" value="${escapeHtml(details.texto_ocr_esperado ?? "")}" placeholder="Ex: 06/2025" />
          </label>
          <label class="recognition-cell recognition-cell-full">
            <span>Janela deste bloco</span>
            <select data-tree-field="windowTitle">
              ${recognitionWindowOptionsMarkup(details.janela_alvo ?? "", "Sem janela fixa neste bloco")}
            </select>
          </label>
          <button class="tree-open-button recognition-window-refresh" data-tree-action="refresh-recognition-windows" type="button">Atualizar janelas</button>
        </div>
      </div>

      <div class="recognition-card-panel ${activeRecognitionTab === "preview" ? "is-active" : ""}" data-recognition-tab-panel="preview" ${activeRecognitionTab === "preview" ? "" : "hidden"}>
        ${renderRecognitionPreviewPanel(details.imagem ?? "")}
        <p class="recognition-card-helper">Essa e a imagem atualmente salva nesse bloco para o FlowDetect procurar na tela.</p>
      </div>

      <div class="recognition-card-panel ${activeRecognitionTab === "action" ? "is-active" : ""}" data-recognition-tab-panel="action" ${activeRecognitionTab === "action" ? "" : "hidden"}>
        <div class="insert-outcome-groups">
          <section class="insert-outcome-group is-success">
            <div class="insert-outcome-header">
              <strong>Se der certo</strong>
              <p>Quando a imagem for encontrada, escolha o que acontece em seguida.</p>
            </div>
            <div class="tree-inline-fields recognition-panel-grid recognition-panel-grid-actions">
              <label class="recognition-cell recognition-cell-full">
                <span>Quando encontrar a imagem</span>
                <select data-tree-field="clickOnFind">
                  <option value="single" ${recognitionClickModeFromDetails(details) === "single" ? "selected" : ""}>Dar 1 clique</option>
                  <option value="double" ${recognitionClickModeFromDetails(details) === "double" ? "selected" : ""}>Dar 2 cliques</option>
                  <option value="identify" ${recognitionClickModeFromDetails(details) === "identify" ? "selected" : ""}>So identificar</option>
                </select>
              </label>
              <label class="recognition-cell recognition-cell-sm">
                <span>Depois disso</span>
                <select data-tree-field="successAction">
                  <option value="continuar" ${String(details.ao_sucesso ?? "continuar") === "continuar" ? "selected" : ""}>Continuar a sequencia</option>
                  <option value="ir_para_sequencia" ${String(details.ao_sucesso ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para outra pagina</option>
                  <option value="ir_para_bloco" ${String(details.ao_sucesso ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para outro bloco</option>
                </select>
              </label>
              ${renderActionTargetFields(
                "data-tree-field",
                "successAction",
                details.ao_sucesso ?? "continuar",
                "successSequence",
                details.sequencia_sucesso ?? "pagina_2",
                "successBlock",
                details.bloco_sucesso ?? "",
                event.order,
                {
                  sequenceLabel: "Abrir esta pagina",
                  blockLabel: "Abrir este bloco",
                  delayFieldName: "successSequenceDelay",
                  delayValue: details.atraso_antes_sequencia_sucesso ?? 0,
                  delayLabel: "Esperar antes da troca (s)",
                }
              )}
            </div>
          </section>

          <section class="insert-outcome-group is-failure">
            <div class="insert-outcome-header">
              <strong>Se falhar</strong>
              <p>Se a imagem nao aparecer, escolha como o fluxo deve continuar.</p>
            </div>
            <div class="tree-inline-fields recognition-panel-grid recognition-panel-grid-actions">
              <label class="recognition-cell recognition-cell-sm">
                <span>O que fazer na falha</span>
                <select data-tree-field="failureAction">
                  <option value="parar" ${String(details.ao_nao_encontrar ?? "parar") === "parar" ? "selected" : ""}>Parar a automacao</option>
                  <option value="continuar" ${String(details.ao_nao_encontrar ?? "") === "continuar" || String(details.ao_nao_encontrar ?? "") === "pular" ? "selected" : ""}>Continuar a sequencia</option>
                  <option value="tentar_novamente" ${String(details.ao_nao_encontrar ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
                  <option value="ir_para_sequencia" ${String(details.ao_nao_encontrar ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para outra pagina</option>
                  <option value="ir_para_bloco" ${String(details.ao_nao_encontrar ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para outro bloco</option>
                </select>
              </label>
              ${renderActionTargetFields(
                "data-tree-field",
                "failureAction",
                details.ao_nao_encontrar ?? "parar",
                "failureSequence",
                details.sequencia_nao_encontrar ?? "pagina_2",
                "failureBlock",
                details.bloco_nao_encontrar ?? "",
                event.order,
                {
                  sequenceLabel: "Abrir esta pagina",
                  blockLabel: "Abrir este bloco",
                  delayFieldName: "failureSequenceDelay",
                  delayValue: details.atraso_antes_sequencia_nao_encontrar ?? 0,
                  delayLabel: "Esperar antes da troca (s)",
                }
              )}
            </div>
          </section>
        </div>
      </div>

      <div class="recognition-card-panel ${activeRecognitionTab === "advanced" ? "is-active" : ""}" data-recognition-tab-panel="advanced" ${activeRecognitionTab === "advanced" ? "" : "hidden"}>
        <p class="recognition-card-helper">Essas opcoes costumam ser ajustadas uma vez e depois quase nao mudam.</p>
        <div class="tree-inline-fields tree-inline-fields-recognition recognition-panel-grid">
          <label class="recognition-cell recognition-cell-sm">
            <span>Tentativas</span>
            <input data-tree-field="retryCount" type="number" min="1" step="1" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
          </label>
          <label class="recognition-cell recognition-cell-sm">
            <span>Intervalo entre tentativas</span>
            <input data-tree-field="retryInterval" type="number" min="0" step="0.5" value="${escapeHtml(details.intervalo_tentativas ?? 1)}" />
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderExpandedCommandCardOverlay(events = []) {
  const order = Number(state.expandedTreeCardOrder);
  if (!order) {
    return "";
  }

  const event = events.find((item) => Number(item.order) === order && item.type === "clicar_imagem");
  if (!event) {
    return "";
  }

  return `
    <div class="command-card-overlay">
      <div class="command-card-overlay-backdrop" data-close-expanded-card="true"></div>
      <div class="command-card-overlay-panel">
        <article class="command-tree-card command-tree-card-overlay-card is-visual-recognition" data-order="${event.order}" data-type="${escapeHtml(event.type)}" data-delay="${escapeHtml(event.delay)}" data-client-key="${escapeHtml(event.clientKey || String(event.order))}">
          <div class="command-tree-top">
            <div class="command-tree-main">
              <span class="command-index">${String(event.order).padStart(2, "0")}</span>
              <div>
                <h3>${escapeHtml(event.title)}</h3>
                <p data-recognition-subtitle="true">${escapeHtml(recognitionSubtitleLabel(event))}</p>
              </div>
            </div>
            <div class="command-tree-side">
              <span class="type-chip ${escapeHtml(event.type)}">${escapeHtml(typeChipLabel(event.type))}</span>
              <button class="tree-open-button" data-tree-action="close-card-details" type="button">Fechar</button>
            </div>
          </div>
          <div class="command-tree-grid command-tree-grid-overlay">
            <div class="tree-editor">
              ${renderRecognitionExpandedTreeEditor(event)}
            </div>
          </div>
          <div class="command-tree-actions command-tree-actions-overlay">
            <div class="command-action-group command-action-group-primary has-recognition-button">
              <button class="tree-save-button" data-tree-action="save">Salvar</button>
              <button class="tree-open-button" data-tree-action="test-image-recognition">Testar</button>
              <button class="tree-open-button" data-tree-action="close-card-details">Fechar</button>
            </div>
          </div>
        </article>
      </div>
    </div>
  `;
}

function populateImageFailureBlockSelect() {
  if (!imageFailureBlockInput) {
    return;
  }
  const currentValue = String(imageFailureBlockInput.value ?? "").trim();
  imageFailureBlockInput.innerHTML = blockTargetOptions(currentValue, null, "Escolha um bloco");
  if (currentValue) {
    imageFailureBlockInput.value = currentValue;
  }
}

function populateImageFailureSequenceSelect() {
  if (!imageFailureSequenceInput) {
    return;
  }
  const currentValue = normalizeSequenceName(imageFailureSequenceInput.value || "pagina_2");
  imageFailureSequenceInput.innerHTML = renderSequenceSuggestionsOptions(currentValue, "Escolha uma pagina");
  imageFailureSequenceInput.value = currentValue;
}

function populateChromeFailureBlockSelect() {
  if (!chromeFailureBlockInput) {
    return;
  }
  const currentValue = String(chromeFailureBlockInput.value ?? "").trim();
  chromeFailureBlockInput.innerHTML = blockTargetOptions(currentValue, null, "Escolha um bloco");
  if (currentValue) {
    chromeFailureBlockInput.value = currentValue;
  }
}

function populateChromeFailureSequenceSelect() {
  if (!chromeFailureSequenceInput) {
    return;
  }
  const currentValue = normalizeSequenceName(chromeFailureSequenceInput.value || "pagina_2");
  chromeFailureSequenceInput.innerHTML = renderSequenceSuggestionsOptions(currentValue, "Escolha uma pagina");
  chromeFailureSequenceInput.value = currentValue;
}

function populateChromeSuccessBlockSelect() {
  if (!chromeSuccessBlockInput) {
    return;
  }
  const currentValue = String(chromeSuccessBlockInput.value ?? "").trim();
  chromeSuccessBlockInput.innerHTML = blockTargetOptions(currentValue, null, "Escolha um bloco");
  if (currentValue) {
    chromeSuccessBlockInput.value = currentValue;
  }
}

function populateChromeSuccessSequenceSelect() {
  if (!chromeSuccessSequenceInput) {
    return;
  }
  const currentValue = normalizeSequenceName(chromeSuccessSequenceInput.value || "pagina_2");
  chromeSuccessSequenceInput.innerHTML = renderSequenceSuggestionsOptions(currentValue, "Escolha uma pagina");
  chromeSuccessSequenceInput.value = currentValue;
}

function typeChipLabel(type) {
  switch (type) {
    case "clicar_imagem":
      return "RECONHECIMENTO";
    case "verificar_estado_botao":
      return "ESTADO DO BOTAO";
    case "chrome_elemento_html":
      return "CHROME HTML";
    case "abrir_url":
      return "ABRIR URL";
    case "abrir_programa":
      return "ABRIR PROGRAMA";
    case "sequencia_planilha":
      return "SEQUENCIA PLANILHA";
    case "escrever_planilha":
      return "ESCREVER PLANILHA";
    case "inicio_loop":
      return "INICIO LOOP";
    case "fim_loop":
      return "FIM LOOP";
    default:
      return String(type || "").replaceAll("_", " ");
  }
}

const COMMAND_PAGE_DEFINITIONS = Object.freeze([
  { sequence: "principal", label: "Pagina 1", shortLabel: "1", number: 1, theme: "principal" },
  { sequence: "pagina_2", label: "Pagina 2", shortLabel: "2", number: 2, theme: "pagina_2" },
  { sequence: "pagina_3", label: "Pagina 3", shortLabel: "3", number: 3, theme: "pagina_3" },
  { sequence: "pagina_4", label: "Pagina 4", shortLabel: "4", number: 4, theme: "pagina_4" },
]);

function sequenceLabel(sequenceName) {
  const normalized = normalizeSequenceName(sequenceName);
  return COMMAND_PAGE_DEFINITIONS.find((page) => page.sequence === normalized)?.label || normalized || "Pagina 1";
}

function normalizeSequenceName(sequenceName) {
  const normalized = String(sequenceName || "").trim();
  if (!normalized) {
    return "principal";
  }

  const lowered = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (["principal", "pagina_1", "pagina 1", "pagina1", "p1"].includes(lowered)) {
    return "principal";
  }
  if (["pagina_2", "pagina 2", "pagina2", "p2"].includes(lowered)) {
    return "pagina_2";
  }
  if (["pagina_3", "pagina 3", "pagina3", "p3"].includes(lowered)) {
    return "pagina_3";
  }
  if (["pagina_4", "pagina 4", "pagina4", "p4"].includes(lowered)) {
    return "pagina_4";
  }

  return normalized;
}

function normalizeSequenceExecutionMode(mode) {
  return String(mode || "").trim().toLowerCase() === "loop_planilha" ? "loop_planilha" : "normal";
}

function getRoadmapSequenceSettings(roadmap = state.roadmap) {
  const settings = roadmap?.sequence_settings;
  return settings && typeof settings === "object" ? settings : {};
}

function getSequenceExecutionSettings(sequenceName, roadmap = state.roadmap) {
  const normalized = normalizeSequenceName(sequenceName);
  const settings = getRoadmapSequenceSettings(roadmap);
  const raw = settings[normalized] || {};
  const executionMode = normalizeSequenceExecutionMode(
    raw.execution_mode ?? raw.executionMode ?? raw.modo_execucao
  );
  const afterLoopSequence = executionMode === "loop_planilha"
    ? (optionalSequenceValue(raw.after_loop_sequence ?? raw.afterLoopSequence ?? raw.sequencia_apos_loop) || "")
    : "";
  return {
    executionMode,
    afterLoopSequence: afterLoopSequence === normalized ? "" : afterLoopSequence,
  };
}

function getConfiguredLoopSequences(roadmap = state.roadmap) {
  return getCommandMapPageDefinitions(roadmap)
    .filter((page) => getSequenceExecutionSettings(page.sequence, roadmap).executionMode === "loop_planilha")
    .map((page) => page.sequence);
}

function getConfiguredLoopSequence(roadmap = state.roadmap) {
  const loopSequence = getConfiguredLoopSequences(roadmap)[0];
  return loopSequence ? getCommandMapPageDefinition(loopSequence, roadmap) : null;
}

function resolveRoadmapInitialSequence(roadmap = state.roadmap) {
  const preferred = normalizeSequenceName(roadmap?.initial_sequence || roadmap?.sequencia_inicial || "principal");
  const pages = getCommandMapPageDefinitions(roadmap);
  if (pages.some((page) => page.sequence === preferred)) {
    return preferred;
  }
  if ((roadmap?.events ?? []).some((event) => normalizeSequenceName(event.sequence || event.sequencia) === "principal")) {
    return "principal";
  }
  return normalizeSequenceName(roadmap?.events?.[0]?.sequence || roadmap?.events?.[0]?.sequencia || "principal");
}

function getCommandMapPageDefinitions(roadmap = state.roadmap) {
  const basePages = COMMAND_PAGE_DEFINITIONS.map((page) => ({ ...page, isExtra: false }));
  const knownSequences = new Set(basePages.map((page) => page.sequence));
  const extraPages = Array.from(new Set(roadmap?.sequences ?? []))
    .map((sequence) => normalizeSequenceName(sequence))
    .filter((sequence) => !knownSequences.has(sequence))
    .map((sequence, index) => ({
      sequence,
      label: sequence,
      shortLabel: String(basePages.length + index + 1),
      number: basePages.length + index + 1,
      theme: "principal",
      isExtra: true,
    }));
  return [...basePages, ...extraPages];
}

function getCommandMapPageDefinition(sequenceName, roadmap = state.roadmap) {
  const normalized = normalizeSequenceName(sequenceName);
  return (
    getCommandMapPageDefinitions(roadmap).find((page) => page.sequence === normalized)
    || getCommandMapPageDefinitions(roadmap)[0]
    || COMMAND_PAGE_DEFINITIONS[0]
  );
}

function resolveCommandMapPageTheme(sequenceName) {
  const normalized = normalizeSequenceName(sequenceName);
  return COMMAND_PAGE_DEFINITIONS.some((page) => page.sequence === normalized)
    ? normalized
    : "principal";
}

function syncCommandMapPageTheme() {
  if (!commandMapShell) {
    return;
  }

  commandMapShell.dataset.pageTheme = resolveCommandMapPageTheme(state.commandMapPageSequence);
}

function getCommandMapPageLabel(sequenceName, roadmap = state.roadmap) {
  return getCommandMapPageDefinition(sequenceName, roadmap)?.label || "Pagina 1";
}

function getCommandMapEvents(sequenceName = state.commandMapPageSequence, roadmap = state.roadmap) {
  const normalized = normalizeSequenceName(sequenceName);
  return (roadmap?.events ?? []).filter(
    (event) => normalizeSequenceName(event.sequence || event.sequencia) === normalized
  );
}

function getCommandMapEventSequenceByOrder(order, roadmap = state.roadmap) {
  const event = (roadmap?.events ?? []).find((item) => Number(item.order) === Number(order));
  return event ? normalizeSequenceName(event.sequence || event.sequencia) : "";
}

function getCommandMapFirstOrderForSequence(sequenceName, roadmap = state.roadmap) {
  const orders = getCommandMapEvents(sequenceName, roadmap)
    .map((event) => Number(event.order ?? event.ordem))
    .filter((order) => Number.isFinite(order))
    .sort((firstOrder, secondOrder) => firstOrder - secondOrder);
  return orders[0] ?? null;
}

function getCommandMapSuccessRoute(event, roadmap = state.roadmap) {
  const details = event?.details || event?.detalhes || {};
  const action = String(details.ao_sucesso || "continuar").trim().toLowerCase();
  const sequence = optionalSequenceValue(details.sequencia_sucesso || "");
  const block = Number(details.bloco_sucesso || 0);
  const delay = Math.max(0, parseNumber(details.atraso_antes_sequencia_sucesso, 0));
  return {
    action,
    sequence: sequence || "",
    block: Number.isFinite(block) && block > 0 ? block : null,
    delay,
  };
}

function traceCommandMapExecutionFlow({
  roadmap = state.roadmap,
  startSequence = resolveRoadmapInitialSequence(roadmap),
  startIndex = 0,
  stopBeforeSequence = "",
  limitSequence = "",
  blockBoundarySequence = "",
  minBlockOrder = 0,
  stopBeforeBlockOrder = 0,
} = {}) {
  const events = [];
  let currentSequence = normalizeSequenceName(startSequence);
  let currentIndex = Math.max(0, Number(startIndex) || 0);
  const targetStopSequence = stopBeforeSequence ? normalizeSequenceName(stopBeforeSequence) : "";
  const boundedSequence = limitSequence ? normalizeSequenceName(limitSequence) : "";
  const boundedBlockSequence = blockBoundarySequence ? normalizeSequenceName(blockBoundarySequence) : "";
  const minimumBlockOrder = Math.max(0, Number(minBlockOrder) || 0);
  const maximumBlockOrderExclusive = Math.max(0, Number(stopBeforeBlockOrder) || 0);
  let guard = 0;

  if (targetStopSequence && currentSequence === targetStopSequence) {
    return { status: "before_target", events, exit: null };
  }

  while (guard < 1000) {
    guard += 1;
    const pageEvents = getCommandMapEvents(currentSequence, roadmap);
    if (currentIndex >= pageEvents.length) {
      return { status: "completed", events, exit: null };
    }

    const event = pageEvents[currentIndex];
    const eventOrder = Number(event.order || 0);
    if (boundedBlockSequence && currentSequence === boundedBlockSequence) {
      if (minimumBlockOrder && eventOrder < minimumBlockOrder) {
        return {
          status: "block_exit",
          events,
          exit: {
            action: "ir_para_bloco",
            block: eventOrder,
            sequence: currentSequence,
          },
        };
      }
      if (maximumBlockOrderExclusive && eventOrder >= maximumBlockOrderExclusive) {
        return {
          status: "before_block",
          events,
          exit: null,
          sequence: currentSequence,
          blockOrder: eventOrder,
        };
      }
    }
    events.push(event);
    const route = getCommandMapSuccessRoute(event, roadmap);

    if (route.action === "ir_para_sequencia" && route.sequence) {
      if (boundedSequence && currentSequence === boundedSequence && route.sequence !== boundedSequence) {
        return { status: "sequence_exit", events, exit: route };
      }
      currentSequence = route.sequence;
      currentIndex = 0;
      if (targetStopSequence && currentSequence === targetStopSequence) {
        return { status: "before_target", events, exit: route };
      }
      continue;
    }

    if (route.action === "ir_para_bloco" && route.block) {
      const blockEvent = getCommandMapEventByOrder(route.block, roadmap);
      if (!blockEvent) {
        return { status: "completed", events, exit: null };
      }
      const destinationSequence = getCommandMapEventSequenceByOrder(route.block, roadmap);
      const destinationEvents = getCommandMapEvents(destinationSequence, roadmap);
      const destinationIndex = destinationEvents.findIndex((item) => Number(item.order) === Number(route.block));
      if (boundedBlockSequence && destinationSequence === boundedBlockSequence) {
        if (minimumBlockOrder && Number(route.block) < minimumBlockOrder) {
          return {
            status: "block_exit",
            events,
            exit: {
              ...route,
              sequence: destinationSequence,
            },
          };
        }
        if (maximumBlockOrderExclusive && Number(route.block) >= maximumBlockOrderExclusive) {
          return {
            status: "block_exit",
            events,
            exit: {
              ...route,
              sequence: destinationSequence,
            },
          };
        }
      }
      if (boundedSequence && currentSequence === boundedSequence && destinationSequence !== boundedSequence) {
        return {
          status: "block_exit",
          events,
          exit: {
            ...route,
            sequence: destinationSequence,
          },
        };
      }
      currentSequence = destinationSequence;
      currentIndex = Math.max(0, destinationIndex);
      if (targetStopSequence && currentSequence === targetStopSequence && currentIndex === 0) {
        return { status: "before_target", events, exit: route };
      }
      continue;
    }

    if (route.action === "parar") {
      return { status: "stopped", events, exit: route };
    }

    currentIndex += 1;
  }

  return { status: "completed", events, exit: null };
}

function getLoopMarkerRange(roadmap = state.roadmap) {
  let startMarker = null;
  let endMarker = null;
  let foundMarker = false;

  getCommandMapPageDefinitions(roadmap).forEach((page) => {
    const events = getCommandMapEvents(page.sequence, roadmap);
    events.forEach((event, index) => {
      if (!isLoopMarkerType(event.type)) {
        return;
      }
      foundMarker = true;
      if (!startMarker && event.type === "inicio_loop") {
        startMarker = {
          sequence: page.sequence,
          index,
          event,
        };
        return;
      }
      if (
        startMarker
        && !endMarker
        && event.type === "fim_loop"
        && page.sequence === startMarker.sequence
        && index > startMarker.index
      ) {
        endMarker = {
          sequence: page.sequence,
          index,
          event,
        };
      }
    });
  });

  if (!foundMarker) {
    return null;
  }
  if (!startMarker || !endMarker) {
    throw new Error("Use os blocos Inicio do loop e Fim do loop na mesma pagina para limitar o trecho em loop.");
  }

  const loopEvents = getCommandMapEvents(startMarker.sequence, roadmap).slice(startMarker.index + 1, endMarker.index);
  const spreadsheetEvent = loopEvents.find((event) => event.type === "sequencia_planilha");
  if (!loopEvents.length) {
    throw new Error("Adicione ao menos um bloco entre Inicio do loop e Fim do loop.");
  }
  if (!spreadsheetEvent) {
    throw new Error("O trecho entre Inicio do loop e Fim do loop precisa ter ao menos um bloco de planilha.");
  }

  return {
    sequence: startMarker.sequence,
    startIndex: startMarker.index,
    endIndex: endMarker.index,
    startOrder: Number(startMarker.event.order || 0),
    endOrder: Number(endMarker.event.order || 0),
    spreadsheetEvent,
  };
}

function traceCommandMapUntilLoopEntry({
  roadmap = state.roadmap,
  startSequence = resolveRoadmapInitialSequence(roadmap),
  loopSequences = getConfiguredLoopSequences(roadmap),
} = {}) {
  const events = [];
  const loopSet = new Set(loopSequences.map((sequence) => normalizeSequenceName(sequence)));
  let currentSequence = normalizeSequenceName(startSequence);
  let currentIndex = 0;
  let guard = 0;

  if (loopSet.has(currentSequence)) {
    return { status: "before_loop", events, loopSequence: currentSequence, startIndex: 0, exit: null };
  }

  while (guard < 1000) {
    guard += 1;
    const pageEvents = getCommandMapEvents(currentSequence, roadmap);
    if (currentIndex >= pageEvents.length) {
      return { status: "completed", events, loopSequence: "", startIndex: 0, exit: null };
    }

    const event = pageEvents[currentIndex];
    events.push(event);
    const route = getCommandMapSuccessRoute(event, roadmap);

    if (route.action === "ir_para_sequencia" && route.sequence) {
      const destinationSequence = normalizeSequenceName(route.sequence);
      if (loopSet.has(destinationSequence)) {
        return {
          status: "before_loop",
          events,
          loopSequence: destinationSequence,
          startIndex: 0,
          exit: route,
        };
      }
      currentSequence = destinationSequence;
      currentIndex = 0;
      continue;
    }

    if (route.action === "ir_para_bloco" && route.block) {
      const destinationEvent = getCommandMapEventByOrder(route.block, roadmap);
      if (!destinationEvent) {
        return { status: "completed", events, loopSequence: "", startIndex: 0, exit: null };
      }
      const destinationSequence = getCommandMapEventSequenceByOrder(route.block, roadmap);
      const destinationEvents = getCommandMapEvents(destinationSequence, roadmap);
      const destinationIndex = Math.max(
        0,
        destinationEvents.findIndex((item) => Number(item.order) === Number(route.block))
      );
      if (loopSet.has(destinationSequence)) {
        return {
          status: "before_loop",
          events,
          loopSequence: destinationSequence,
          startIndex: destinationIndex,
          exit: {
            ...route,
            sequence: destinationSequence,
          },
        };
      }
      currentSequence = destinationSequence;
      currentIndex = destinationIndex;
      continue;
    }

    if (route.action === "parar") {
      return { status: "stopped", events, loopSequence: "", startIndex: 0, exit: route };
    }

    currentIndex += 1;
  }

  return { status: "completed", events, loopSequence: "", startIndex: 0, exit: null };
}

function traceCommandMapLoopRegion({
  roadmap = state.roadmap,
  startSequence = resolveRoadmapInitialSequence(roadmap),
  startIndex = 0,
  loopSequences = getConfiguredLoopSequences(roadmap),
} = {}) {
  const events = [];
  const loopSet = new Set(loopSequences.map((sequence) => normalizeSequenceName(sequence)));
  let currentSequence = normalizeSequenceName(startSequence);
  let currentIndex = Math.max(0, Number(startIndex) || 0);
  let guard = 0;

  while (guard < 1000) {
    guard += 1;
    const pageEvents = getCommandMapEvents(currentSequence, roadmap);
    if (currentIndex >= pageEvents.length) {
      return { status: "completed", events, exit: null, exitSequence: currentSequence };
    }

    const event = pageEvents[currentIndex];
    events.push(event);
    const route = getCommandMapSuccessRoute(event, roadmap);

    if (route.action === "ir_para_sequencia" && route.sequence) {
      const destinationSequence = normalizeSequenceName(route.sequence);
      if (!loopSet.has(destinationSequence)) {
        return {
          status: "loop_exit",
          events,
          exit: route,
          exitSequence: currentSequence,
        };
      }
      currentSequence = destinationSequence;
      currentIndex = 0;
      continue;
    }

    if (route.action === "ir_para_bloco" && route.block) {
      const destinationEvent = getCommandMapEventByOrder(route.block, roadmap);
      if (!destinationEvent) {
        return { status: "completed", events, exit: null, exitSequence: currentSequence };
      }
      const destinationSequence = getCommandMapEventSequenceByOrder(route.block, roadmap);
      const destinationEvents = getCommandMapEvents(destinationSequence, roadmap);
      const destinationIndex = Math.max(
        0,
        destinationEvents.findIndex((item) => Number(item.order) === Number(route.block))
      );
      if (!loopSet.has(destinationSequence)) {
        return {
          status: "loop_exit",
          events,
          exit: {
            ...route,
            sequence: destinationSequence,
          },
          exitSequence: currentSequence,
        };
      }
      currentSequence = destinationSequence;
      currentIndex = destinationIndex;
      continue;
    }

    if (route.action === "parar") {
      return { status: "stopped", events, exit: route, exitSequence: currentSequence };
    }

    currentIndex += 1;
  }

  return { status: "completed", events, exit: null, exitSequence: currentSequence };
}

function resolveAssistPostLoopStart(loopTrace, roadmap = state.roadmap) {
  const route = loopTrace?.exit || null;
  if (route?.action === "ir_para_bloco" && route.block) {
    const destinationSequence = getCommandMapEventSequenceByOrder(route.block, roadmap);
    const destinationEvents = getCommandMapEvents(destinationSequence, roadmap);
    const destinationIndex = destinationEvents.findIndex((item) => Number(item.order) === Number(route.block));
    return {
      sequence: destinationSequence,
      startIndex: Math.max(0, destinationIndex),
    };
  }

  if (route?.action === "ir_para_sequencia" && route.sequence) {
    return {
      sequence: normalizeSequenceName(route.sequence),
      startIndex: 0,
    };
  }

  const fallbackSequence = getSequenceExecutionSettings(loopTrace?.exitSequence || "", roadmap).afterLoopSequence;
  if (fallbackSequence) {
    return {
      sequence: fallbackSequence,
      startIndex: 0,
    };
  }

  return null;
}

function syncSequenceContextInput() {
  if (sequenceContextInput) {
    sequenceContextInput.value = normalizeSequenceName(state.commandMapPageSequence);
  }
}

function lockCommandMapPageSequence(sequenceName, durationMs = 1800) {
  const sequence = normalizeSequenceName(sequenceName);
  if (!sequence) {
    state.commandMapPageSequenceLock = null;
    return;
  }
  state.commandMapPageSequenceLock = {
    sequence,
    until: Date.now() + durationMs,
  };
}

function activeCommandMapPageSequenceLock() {
  const lock = state.commandMapPageSequenceLock;
  if (!lock?.sequence || Date.now() > Number(lock.until || 0)) {
    state.commandMapPageSequenceLock = null;
    return "";
  }
  return normalizeSequenceName(lock.sequence);
}

function ensureCommandMapPageSelection(roadmap = state.roadmap) {
  const pages = getCommandMapPageDefinitions(roadmap);
  const lockedSequence = activeCommandMapPageSequenceLock();
  const currentSequence = normalizeSequenceName(lockedSequence || state.commandMapPageSequence);
  const hasCurrent = pages.some((page) => page.sequence === currentSequence);
  state.commandMapPageSequence = hasCurrent
    ? currentSequence
    : normalizeSequenceName(pages[0]?.sequence || "principal");
  syncSequenceContextInput();
}

function renderSequenceSuggestionsOptions(selectedValue = "", placeholder = "Escolha uma pagina") {
  const normalizedSelected = normalizeSequenceName(selectedValue || "");
  const options = [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...getCommandMapPageDefinitions().map((page) => `
      <option value="${escapeHtml(page.sequence)}" ${page.sequence === normalizedSelected ? "selected" : ""}>
        ${escapeHtml(page.label)}
      </option>
    `),
  ];
  return options.join("");
}

function renderAssistSequenceSettings(roadmap = state.roadmap) {
  if (!assistInitialSequenceSelect || !assistSequenceModeList) {
    return;
  }

  const pages = getCommandMapPageDefinitions(roadmap);
  const initialSequence = resolveRoadmapInitialSequence(roadmap);
  assistInitialSequenceSelect.innerHTML = pages
    .map((page) => `
      <option value="${escapeHtml(page.sequence)}" ${page.sequence === initialSequence ? "selected" : ""}>
        ${escapeHtml(page.label)}
      </option>
    `)
    .join("");
  assistInitialSequenceSelect.value = initialSequence;

  assistSequenceModeList.innerHTML = pages
    .map((page) => {
      const settings = getSequenceExecutionSettings(page.sequence, roadmap);
      const isLoop = settings.executionMode === "loop_planilha";
      const hasSpreadsheetBlock = getCommandMapEvents(page.sequence, roadmap).some((event) => event.type === "sequencia_planilha");
      const modeLabel = isLoop
        ? (hasSpreadsheetBlock ? "Loop da planilha" : "Loop")
        : "Executar uma vez";
      return `
        <label class="assist-sequence-chip ${isLoop ? "is-loop" : ""}">
          <span class="assist-sequence-chip-label">
            <strong class="assist-sequence-chip-title">${escapeHtml(page.label)}</strong>
            <span class="assist-sequence-chip-mode">${escapeHtml(modeLabel)}</span>
          </span>
          <span class="assist-sequence-switch">
            <input
              type="checkbox"
              data-assist-sequence-toggle="${escapeHtml(page.sequence)}"
              aria-label="${escapeHtml(`${page.label} em loop da planilha`)}"
              ${isLoop ? "checked" : ""}
            />
            <span class="assist-sequence-switch-track">
              <span class="assist-sequence-switch-thumb"></span>
            </span>
          </span>
        </label>
      `;
    })
    .join("");
}

async function runAssistExecutionSettingsMutation(label, promiseFactory) {
  try {
    setBusy(label);
    const roadmap = await promiseFactory();
    applyRoadmap(roadmap);
    await refreshAutomationLibrary();
    setBusy("Pronto");
    setMessage(`${label} com sucesso.`, "success");
  } catch (error) {
    setBusy("Erro");
    renderAssistSequenceSettings();
    setMessage(String(error), "error");
  }
}

async function saveAssistInitialSequence(sequenceName) {
  const sequence = normalizeSequenceName(sequenceName);
  if (sequence === resolveRoadmapInitialSequence()) {
    renderAssistSequenceSettings();
    return;
  }
  await runAssistExecutionSettingsMutation("Pagina inicial atualizada", () =>
    invoke("update_initial_sequence", { sequence })
  );
}

async function saveAssistSequenceExecutionMode(sequenceName, enabled) {
  const sequence = normalizeSequenceName(sequenceName);
  const currentSettings = getSequenceExecutionSettings(sequence);
  const executionMode = enabled ? "loop_planilha" : "normal";
  if (executionMode === currentSettings.executionMode) {
    renderAssistSequenceSettings();
    return;
  }
  await runAssistExecutionSettingsMutation("Configuracao da execucao salva", () =>
    invoke("update_sequence_settings", {
      sequence,
      executionMode,
      afterLoopSequence: enabled ? (currentSettings.afterLoopSequence || null) : null,
    })
  );
}

function renderCommandMapPageExecutionSettings() {
  if (!commandMapPageModeSelect || !commandMapPageAfterLoopSelect || !commandMapPageModeHint) {
    return;
  }

  const currentSequence = normalizeSequenceName(state.commandMapPageSequence);
  const pageDefinition = getCommandMapPageDefinition(currentSequence);
  const settings = getSequenceExecutionSettings(currentSequence);
  const hasSpreadsheetBlock = getCommandMapEvents(currentSequence).some((event) => event.type === "sequencia_planilha");

  commandMapPageModeSelect.value = settings.executionMode;
  const afterLoopValue = settings.afterLoopSequence || "";
  commandMapPageAfterLoopSelect.innerHTML = [
    `<option value="">Concluir sem abrir outra pagina</option>`,
    ...getCommandMapPageDefinitions()
      .filter((page) => page.sequence !== currentSequence)
      .map((page) => `
        <option value="${escapeHtml(page.sequence)}" ${page.sequence === afterLoopValue ? "selected" : ""}>
          ${escapeHtml(page.label)}
        </option>
      `),
  ].join("");
  commandMapPageAfterLoopSelect.hidden = settings.executionMode !== "loop_planilha";
  commandMapPageAfterLoopSelect.value = afterLoopValue;

  if (settings.executionMode === "loop_planilha") {
    const afterLoopLabel = afterLoopValue ? getCommandMapPageLabel(afterLoopValue) : "nenhuma pagina extra";
    commandMapPageModeHint.textContent = hasSpreadsheetBlock
      ? `${pageDefinition.label} roda a cada linha da planilha. O que vem antes executa uma vez, e depois do loop segue para ${afterLoopLabel}.`
      : `${pageDefinition.label} esta marcada para loop, mas ainda precisa de um bloco de planilha nesta pagina.`;
    return;
  }

  commandMapPageModeHint.textContent = `${pageDefinition.label} segue o fluxo normal da automacao e executa uma vez por percurso.`;
}

function updateCommandMapHeaderSummary() {
  const pageDefinition = getCommandMapPageDefinition(state.commandMapPageSequence);
  const pageEvents = getCommandMapEvents();
  const total = pageEvents.length;
  const settings = getSequenceExecutionSettings(pageDefinition.sequence);
  syncCommandMapPageTheme();

  if (commandMapStepBadge) {
    commandMapStepBadge.textContent = `${total} etapa${total === 1 ? "" : "s"}`;
  }

  if (commandMapMeta) {
    if (settings.executionMode === "loop_planilha") {
      const afterLoopLabel = settings.afterLoopSequence ? getCommandMapPageLabel(settings.afterLoopSequence) : "encerrar o loop aqui";
      commandMapMeta.textContent = total
        ? `${total} bloco${total === 1 ? "" : "s"} nesta ${pageDefinition.label.toLowerCase()}. Essa pagina roda em loop da planilha e depois segue para ${afterLoopLabel}.`
        : `${pageDefinition.label} esta reservada para loop da planilha. Adicione os blocos desta etapa aqui.`;
    } else {
      commandMapMeta.textContent = total
        ? `${total} bloco${total === 1 ? "" : "s"} nesta ${pageDefinition.label.toLowerCase()}. Use a falha de um comando para enviar o fluxo para outra pagina quando precisar.`
        : `${pageDefinition.label} vazia no momento. Crie uma sequencia nova aqui e use as outras paginas para separar fluxos de erro, apoio ou caminhos alternativos.`;
    }
  }

  renderCommandMapPageExecutionSettings();
}

function renderCommandMapPageTabs() {
  if (!commandMapPageTabs) {
    return;
  }

  syncCommandMapPageTheme();
  const currentSequence = normalizeSequenceName(state.commandMapPageSequence);
  const counts = new Map();
  (state.roadmap?.events ?? []).forEach((event) => {
    const sequence = normalizeSequenceName(event.sequence || event.sequencia);
    counts.set(sequence, (counts.get(sequence) || 0) + 1);
  });

  commandMapPageTabs.innerHTML = getCommandMapPageDefinitions()
    .map((page, index) => {
      const total = counts.get(page.sequence) || 0;
      const pageNumber = page.number || index + 1;
      const isActive = page.sequence === currentSequence;
      const pageSettings = getSequenceExecutionSettings(page.sequence);
      const isLoopPage = pageSettings.executionMode === "loop_planilha";
      const totalLabel = `${total} bloco${total === 1 ? "" : "s"}`;
      const actionLabel = isActive ? "Pagina atual" : "Abrir pagina";
      const loopLabel = isLoopPage ? " Pagina configurada para loop da planilha." : "";
      return `
        <button
          class="command-page-tab ${isActive ? "is-active" : ""} ${isLoopPage ? "is-loop-page" : ""}"
          type="button"
          data-command-page="${escapeHtml(page.sequence)}"
          data-page-number="${escapeHtml(String(pageNumber))}"
          aria-pressed="${isActive ? "true" : "false"}"
          aria-current="${isActive ? "page" : "false"}"
          aria-label="${escapeHtml(`${page.label}. ${totalLabel}. ${actionLabel}.${loopLabel}`)}"
          title="${escapeHtml(`${page.label} - ${totalLabel}${isLoopPage ? " - Loop da planilha" : ""}`)}"
        >
          <span class="command-page-tab-number">${escapeHtml(String(pageNumber))}</span>
        </button>
      `;
    })
    .join("");
}

function switchCommandMapPage(sequenceName, options = {}) {
  const { skipAutoSave = false } = options;
  const nextSequence = normalizeSequenceName(sequenceName);
  if (nextSequence === normalizeSequenceName(state.commandMapPageSequence)) {
    return Promise.resolve(true);
  }

  if (!skipAutoSave) {
    syncVisibleCommandMapDrafts();
    syncCommandMapSaveStateWithPending();
  }

  state.insertPanel = null;
  state.expandedTreeCardOrder = null;
  state.expandedTreeCardOrigin = null;
  state.commandMapPageSequenceLock = null;
  state.commandMapPageSequence = nextSequence;
  syncCommandMapPageTheme();
  syncSequenceContextInput();
  renderCommandMapPageTabs();
  updateCommandMapHeaderSummary();
  state.commandMapFocusOrder = getCommandMapEvents(nextSequence)[0]?.order ?? null;
  renderCommandMap();
  return Promise.resolve(true);
}

function currentSequenceName() {
  return normalizeSequenceName(state.commandMapPageSequence || sequenceContextInput?.value);
}

function optionalSequenceValue(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalizeSequenceName(normalized) : null;
}

function refreshSequenceSuggestions() {
  const list = document.getElementById("sequenceSuggestions");
  if (!list) {
    return;
  }
  list.innerHTML = getCommandMapPageDefinitions()
    .map((page) => `<option value="${escapeHtml(page.sequence)}">${escapeHtml(page.label)}</option>`)
    .join("");
}

async function saveCurrentPageExecutionSettings() {
  if (!state.roadmap || !commandMapPageModeSelect || !commandMapPageAfterLoopSelect) {
    return;
  }

  const sequence = normalizeSequenceName(state.commandMapPageSequence);
  const executionMode = normalizeSequenceExecutionMode(commandMapPageModeSelect.value);
  const afterLoopSequence = executionMode === "loop_planilha"
    ? (optionalSequenceValue(commandMapPageAfterLoopSelect.value) || "")
    : "";
  const currentSettings = getSequenceExecutionSettings(sequence);

  if (
    executionMode === currentSettings.executionMode
    && afterLoopSequence === currentSettings.afterLoopSequence
  ) {
    renderCommandMapPageExecutionSettings();
    return;
  }

  await runMutation("Configuracao da pagina salva", () =>
    invoke("update_sequence_settings", {
      sequence,
      executionMode,
      afterLoopSequence: afterLoopSequence || null,
    })
  );
}

function openImagePicker(target) {
  state.imageImportTarget = target;
  imageFileInput.click();
}

function normalizeCaptureImageName(value) {
  const fileName = String(value || "").trim().split(/[\\/]/).pop() || "";
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const normalized = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]\d{3,4}$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || "imagem_capturada";
}

function promptCapturedImageName(defaultFileName) {
  const baseName = String(defaultFileName || "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .trim();
  return window.prompt(
    "Digite um nome para identificar essa imagem capturada:",
    baseName || "imagem_capturada"
  );
}

function readCurrentImagePathFromTarget(target) {
  if (!target) {
    return "";
  }

  if (target.scope === "composer-image") {
    return imagePathInput?.value || "";
  }

  if (target.scope === "update-editor") {
    return timelineList
      ?.querySelector(`.flow-card[data-order="${target.order}"] [data-field="imagePath"]`)
      ?.value || "";
  }

  if (target.scope === "update-tree") {
    return (
      commandMapList
        ?.querySelector(`.command-tree-card-overlay-card[data-order="${target.order}"] [data-tree-field="imagePath"]`)
        ?.value
      || commandMapList
        ?.querySelector(`.command-tree-card[data-order="${target.order}"] [data-tree-field="imagePath"]`)
        ?.value
      || ""
    );
  }

  if (target.scope === "insert-panel") {
    return commandMapList
      ?.querySelector(`.insert-card-panel[data-target-order="${target.order}"] [data-insert-field="imagePath"]`)
      ?.value || state.insertPanel?.imagePath || "";
  }

  return "";
}

function inferCaptureImageNameHint(target) {
  return normalizeCaptureImageName(readCurrentImagePathFromTarget(target));
}

async function importImageToProject(file) {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const result = await invoke("import_image_asset", {
    fileName: file.name,
    bytes,
  });
  clearRecognitionPreviewCache(String(result?.image_id || ""));
  return result;
}

async function importAutomationZipToProject(file) {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invoke("import_saved_automation_zip", {
    fileName: file.name,
    bytes,
  });
}

function writeImportedImagePath(target, imageId) {
  if (!target || !imageId) {
    return;
  }

  if (target.scope === "composer-image") {
    imagePathInput.value = imageId;
    return;
  }

  if (target.scope === "composer-chrome-fallback") {
    chromeFallbackImageInput.value = imageId;
    return;
  }

  if (target.scope === "composer-verify-active") {
    verifyActiveImageInput.value = imageId;
    return;
  }

  if (target.scope === "composer-verify-inactive") {
    verifyInactiveImageInput.value = imageId;
    return;
  }

  if (target.scope === "update-editor") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="imagePath"]');
    if (input) {
      input.value = imageId;
    }
    setRecognitionTestStatusForOrder(target.order, imageId, false);
    return;
  }

  if (target.scope === "update-editor-verify-active") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="verifyActiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-editor-verify-inactive") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="verifyInactiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-editor-chrome-fallback") {
    const card = timelineList.querySelector(`.flow-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-field="chromeFallbackImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-tree") {
    const card =
      commandMapList.querySelector(`.command-tree-card-overlay-card[data-order="${target.order}"]`) ||
      commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="imagePath"]');
    if (input) {
      input.value = imageId;
    }
    setRecognitionTestStatusForOrder(target.order, imageId, false);
    hydrateRecognitionPreviewCards(card, imageId);
    return;
  }

  if (target.scope === "update-tree-chrome-fallback") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="chromeFallbackImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-tree-verify-active") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="verifyActiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "update-tree-verify-inactive") {
    const card = commandMapList.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    const input = card?.querySelector('[data-tree-field="verifyInactiveImage"]');
    if (input) {
      input.value = imageId;
    }
    return;
  }

  if (target.scope === "insert-panel") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${target.order}"]`);
    const input = panel?.querySelector('[data-insert-field="imagePath"]');
    if (input) {
      input.value = imageId;
    }
    if (state.insertPanel) {
      state.insertPanel.imagePath = imageId;
    }
    hydrateRecognitionPreviewCards(panel, imageId);
    return;
  }

  if (target.scope === "insert-panel-chrome-fallback") {
    const panel = commandMapList.querySelector(`.insert-card-panel[data-target-order="${target.order}"]`);
    const input = panel?.querySelector('[data-insert-field="chromeFallbackImage"]');
    if (input) {
      input.value = imageId;
    }
    if (state.insertPanel) {
      state.insertPanel.chromeFallbackImage = imageId;
    }
  }
}

async function persistCapturedRecognitionImage(target) {
  if (!target) {
    return false;
  }

  if (target.scope === "update-editor") {
    const card = timelineList?.querySelector(`.flow-card[data-order="${target.order}"]`);
    if (!card) {
      return false;
    }
    const roadmap = await invokeCommandCardUpdate({
      order: Number(card.dataset.order),
      type: String(card.dataset.type || ""),
      values: formValuesFromCard(card),
    });
    if (roadmap) {
      state.commandMapFocusOrder = Number(card.dataset.order);
      applyRoadmap(roadmap);
      await refreshAutomationLibrary();
      return true;
    }
  }

  if (target.scope === "update-tree") {
    const card =
      commandMapList?.querySelector(`.command-tree-card-overlay-card[data-order="${target.order}"]`)
      || commandMapList?.querySelector(`.command-tree-card[data-order="${target.order}"]`);
    if (!card) {
      return false;
    }
    const roadmap = await invokeCommandCardUpdate({
      order: Number(card.dataset.order),
      type: String(card.dataset.type || ""),
      values: treeValuesFromCard(card),
    });
    if (roadmap) {
      applyRoadmap(roadmap);
      await refreshAutomationLibrary();
      setCommandMapFocus(Number(card.dataset.order));
      return true;
    }
  }

  return false;
}

async function captureImageToProject(target) {
  if (!target) {
    return;
  }

  try {
    setBusy("Capturando imagem");
    setMessage("Selecione a area da tela que deseja usar no reconhecimento.", "info");
    const result = await invoke("capture_image_asset", {
      baseNameHint: inferCaptureImageNameHint(target) || null,
    });

    if (result?.cancelled) {
      setBusy("Pronto");
      setMessage(result?.message || "Captura cancelada.", "info");
      return;
    }

    let imageId = String(result?.image_id || "");
    if (!imageId) {
      throw new Error("A captura foi concluida, mas o caminho da imagem nao voltou para a interface.");
    }

    const typedName = promptCapturedImageName(result?.file_name || imageId);
    if (typedName !== null && String(typedName).trim()) {
      clearRecognitionPreviewCache(imageId);
      const renamed = await invoke("rename_image_asset", {
        imageId,
        newName: String(typedName).trim(),
      });
      imageId = String(renamed?.image_id || imageId);
      if (renamed?.file_name) {
        result.file_name = renamed.file_name;
      }
    }

    clearRecognitionPreviewCache(imageId);
    writeImportedImagePath(target, imageId);
    const savedInBlock = await persistCapturedRecognitionImage(target);
    const sizeLabel =
      Number(result?.width) > 0 && Number(result?.height) > 0
        ? ` (${result.width}x${result.height})`
        : "";

    setBusy("Pronto");
    setMessage(
      savedInBlock
        ? `Imagem ${result?.file_name || imageId}${sizeLabel} capturada e salva no bloco.`
        : `Imagem ${result?.file_name || imageId}${sizeLabel} capturada e vinculada ao bloco atual.`,
      "success"
    );
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function updateTestLoopHint() {
  const payload = state.testLoopData;
  if (!payload?.rows?.length) {
    testLoopHint.textContent = "Nenhum loop de planilha encontrado no roteiro para testar por linha.";
    return;
  }

  const requestedLine = Math.max(1, Math.trunc(parseNumber(testLoopStartInput.value, 1)));
  const resolvedRow = payload.rows.find((row) => Number(row.row_number) >= requestedLine);

  if (!resolvedRow) {
    const lastRow = payload.rows[payload.rows.length - 1];
    testLoopHint.textContent =
      `A linha ${requestedLine} nao existe nesse loop. Ultima linha disponivel: ${lastRow.row_number}.`;
    return;
  }

  const company = resolvedRow.company ? ` | ${resolvedRow.company}` : "";
  testLoopHint.textContent =
    `O teste vai comecar na linha ${resolvedRow.row_number}: ${resolvedRow.value}${company}. ` +
    "Se houver outros loops de planilha, eles acompanham essa mesma linha quando ela existir.";
}

async function refreshTestLoopData() {
  try {
    state.testLoopData = await invoke("get_test_loop_data");
  } catch (_error) {
    state.testLoopData = null;
  }
  updateTestLoopHint();
}

function syncWorkbookSelectionAfterRowRemoval(rowNumber) {
  const selectedCell = state.workbookSelectedCell;
  if (!selectedCell || selectedCell.sheet !== state.workbookSelectedSheet) {
    return;
  }

  const currentRow = Number(selectedCell.rowNumber);
  if (!Number.isFinite(currentRow)) {
    state.workbookSelectedCell = null;
    return;
  }

  if (currentRow === rowNumber) {
    state.workbookSelectedCell = null;
    return;
  }

  if (currentRow > rowNumber) {
    state.workbookSelectedCell = {
      ...selectedCell,
      rowNumber: currentRow - 1,
    };
  }
}

async function removeWorkbookPreviewRow(rowNumber) {
  const workbookId = state.previewWorkbookId || state.workbookPreview?.workbook_id || "";
  const sheetName = state.workbookSelectedSheet || state.workbookPreview?.sheet || "";
  if (!workbookId || !sheetName) {
    setMessage("Selecione uma planilha valida antes de excluir a linha.", "error");
    return;
  }

  const confirmed = window.confirm(
    `Excluir a linha ${rowNumber} da aba ${sheetName}? Ela nao vai mais participar do loop.`
  );
  if (!confirmed) {
    return;
  }

  try {
    setBusy("Excluindo linha");
    const result = await invoke("remove_workbook_preview_row", {
      workbook: workbookId,
      sheet: sheetName,
      rowNumber,
    });
    syncWorkbookSelectionAfterRowRemoval(rowNumber);
    if (result?.roadmap) {
      applyRoadmap(result.roadmap);
    } else {
      const roadmap = await invoke("get_roadmap");
      applyRoadmap(roadmap);
    }
    await refreshTestLoopData();
    await loadWorkbookPreview(sheetName, workbookId);
    setBusy("Pronto");
    setMessage(`Linha ${rowNumber} removida da planilha com sucesso.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function workbookSheets() {
  return selectedComposerWorkbookMeta()?.sheets ?? [];
}

function columnsForSheet(sheetName) {
  return workbookSheets().find((sheet) => sheet.name === sheetName)?.columns ?? [];
}

function availableWorkbooks() {
  return state.workbook?.workbooks ?? [];
}

function workbookById(workbookId) {
  return availableWorkbooks().find((item) => item.id === workbookId) || null;
}

function selectedComposerWorkbookMeta() {
  const workbooks = availableWorkbooks();
  if (!workbooks.length) {
    return null;
  }

  const activeId = state.composerWorkbookId || state.workbook?.default_workbook || workbooks[0]?.id;
  return workbookById(activeId) || workbooks[0] || null;
}

function selectedPreviewWorkbookMeta() {
  const workbooks = availableWorkbooks();
  if (!workbooks.length) {
    return null;
  }

  const activeId = state.previewWorkbookId || state.workbook?.default_workbook || workbooks[0]?.id;
  return workbookById(activeId) || workbooks[0] || null;
}

function smartRecorderUsableEvents() {
  return (state.smartRecorder.events || []).filter((event) => event?.type && event.type !== "status");
}

function smartRecorderTypeLabel(type) {
  if (type === "clicar_imagem") return "Reconhecimento";
  if (type === "texto_livre") return "Texto";
  if (type === "tecla") return "Tecla";
  return "Evento";
}

function smartRecorderEventTitle(event) {
  if (event.type === "clicar_imagem") return "Clique visual";
  if (event.type === "texto_livre") return "Texto digitado";
  if (event.type === "tecla") return `Tecla ${(event.keys || "").toUpperCase()}`;
  return event.title || "Evento capturado";
}

function smartRecorderEventSubtitle(event) {
  if (event.type === "clicar_imagem") {
    return event.click_action === "identificar" || event.clicks === 0 ? "So identificar" : `${event.clicks || 1} clique(s)`;
  }
  if (event.type === "texto_livre") return event.text || "-";
  if (event.type === "tecla") return `${event.keys || "-"} x${event.repeat || 1}`;
  return event.title || "-";
}

function smartRecorderTargetSequence(event) {
  return event.target_sequence || event.targetSequence || "principal";
}

function smartRecorderDestinationLabel(event) {
  return `Criar em: ${sequenceLabel(smartRecorderTargetSequence(event))}`;
}

function formatSmartRecorderDelay(value) {
  const delay = Math.max(0, Number(value || 0));
  return `${delay.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s`;
}

function smartRecorderClickControls(event) {
  const width = Number(event.crop?.width || 180);
  const height = Number(event.crop?.height || 110);
  const clicks = Number(event.clicks || 1);
  const clickAction = event.click_action === "identificar" || event.clicks === 0 ? "identificar" : "clicar";
  const confirmed = Boolean(event.confirmed);
  return `
    <div class="smart-recorder-preview" data-smart-preview="${escapeHtml(event.image_id || "")}">
      ${state.smartRecorder.previews[event.image_id]
        ? `<img src="${escapeHtml(state.smartRecorder.previews[event.image_id])}" alt="Preview da area capturada" />`
        : `<span>Carregando preview...</span>`}
    </div>
    <div class="smart-recorder-click-editor ${confirmed ? "is-confirmed" : "is-pending"}">
      <label>
        <span>Largura</span>
        <input data-smart-recorder-field="width" type="number" min="40" step="10" value="${escapeHtml(String(width))}" />
      </label>
      <label>
        <span>Altura</span>
        <input data-smart-recorder-field="height" type="number" min="40" step="10" value="${escapeHtml(String(height))}" />
      </label>
      <label>
        <span>Acao</span>
        <select data-smart-recorder-field="clicks">
          <option value="1" ${clickAction !== "identificar" && clicks !== 2 ? "selected" : ""}>1 clique</option>
          <option value="2" ${clickAction !== "identificar" && clicks === 2 ? "selected" : ""}>2 cliques</option>
          <option value="identify" ${clickAction === "identificar" ? "selected" : ""}>So identificar</option>
        </select>
      </label>
      <button class="tree-save-button" type="button" data-smart-recorder-action="confirm-click">
        ${confirmed ? "Atualizar area" : "Confirmar area"}
      </button>
    </div>
  `;
}

async function hydrateSmartRecorderPreviews() {
  const imageIds = smartRecorderUsableEvents()
    .filter((event) => event.type === "clicar_imagem" && event.image_id && !state.smartRecorder.previews[event.image_id])
    .map((event) => event.image_id);
  if (!imageIds.length) return;
  await Promise.allSettled(imageIds.map(async (imageId) => {
    const preview = await invoke("get_recognition_image_preview", { imageId });
    if (preview?.src) {
      state.smartRecorder.previews[imageId] = preview.src;
    }
  }));
  renderSmartRecorder();
}

function renderSmartRecorder() {
  if (!smartRecorderTrack) return;
  const events = smartRecorderUsableEvents();
  if (smartRecorderStatus) smartRecorderStatus.textContent = state.smartRecorder.running ? "Gravando" : "Pronto";
  if (smartRecorderCount) smartRecorderCount.textContent = String(events.length);
  if (smartRecorderStartButton) smartRecorderStartButton.disabled = state.smartRecorder.running;
  if (smartRecorderStopButton) smartRecorderStopButton.disabled = !state.smartRecorder.running;
  if (smartRecorderSendButton) smartRecorderSendButton.disabled = state.smartRecorder.running || !events.length;

  if (!events.length) {
    smartRecorderTrack.innerHTML = `<div class="empty-state">Nenhum bloco gravado ainda. Clique em Iniciar gravacao para comecar.</div>`;
    return;
  }

  smartRecorderTrack.innerHTML = events.map((event, index) => `
    ${index > 0 ? `
      <span class="smart-recorder-delay-connector">
        <i></i>
        <input
          type="number"
          min="0"
          step="0.1"
          value="${escapeHtml(String(Math.max(0, Number(event.delay || 0.3)).toFixed(1)))}"
          title="Tempo antes deste bloco"
          data-smart-recorder-delay-id="${escapeHtml(String(event.id))}"
        />
        <i></i>
      </span>
    ` : ""}
    <article class="smart-recorder-card smart-recorder-card-${escapeHtml(event.type)}" data-smart-recorder-id="${escapeHtml(String(event.id))}">
      <div class="smart-recorder-card-top">
        <div class="smart-recorder-card-main">
          <span class="flow-index">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>${escapeHtml(smartRecorderEventTitle(event))}</h3>
            <p>${escapeHtml(smartRecorderEventSubtitle(event))}</p>
          </div>
        </div>
        <span class="type-chip ${escapeHtml(event.type)}">${escapeHtml(smartRecorderTypeLabel(event.type))}</span>
      </div>
      <div class="smart-recorder-meta-row">
        <span class="smart-recorder-destination-chip">${escapeHtml(smartRecorderDestinationLabel(event))}</span>
      </div>
      ${event.type === "clicar_imagem" ? `
        <div class="smart-recorder-crop">Area: ${escapeHtml(String(event.crop?.width || "-"))} x ${escapeHtml(String(event.crop?.height || "-"))}</div>
        ${smartRecorderClickControls(event)}
        <button class="tree-open-button" type="button" data-smart-recorder-action="adjust-image">Selecionar area manual</button>
      ` : ""}
      <button class="tree-delete-button smart-recorder-delete-button" type="button" data-smart-recorder-action="delete-event">Excluir bloco</button>
    </article>
  `).join("");
  hydrateSmartRecorderPreviews().catch(() => {});
}

async function refreshSmartRecorderStatus() {
  const wasRunning = state.smartRecorder.running;
  const status = await invoke("get_smart_recorder_status");
  state.smartRecorder.running = Boolean(status.running);
  state.smartRecorder.events = Array.isArray(status.events) ? status.events : [];
  renderSmartRecorder();
  const pendingClick = smartRecorderUsableEvents().find((event) => event.type === "clicar_imagem" && !event.confirmed);
  if (state.smartRecorder.running && pendingClick && state.smartRecorder.pendingClickId !== pendingClick.id) {
    state.smartRecorder.pendingClickId = pendingClick.id;
    await stopSmartRecorder();
    setWorkspaceTab("smart-recorder");
    setMessage("Clique capturado. Confirme a area e escolha 1 ou 2 cliques antes de continuar.", "success");
    return;
  }
  if (!state.smartRecorder.running) {
    stopSmartRecorderPolling();
    if (wasRunning) {
      setBusy("Pronto");
      setMessage("Gravacao finalizada. Revise os blocos antes de enviar para o mapa.", "success");
    }
  }
}

function startSmartRecorderPolling() {
  window.clearInterval(state.smartRecorder.pollTimer);
  state.smartRecorder.pollTimer = window.setInterval(() => {
    refreshSmartRecorderStatus().catch((error) => {
      stopSmartRecorderPolling();
      setMessage(String(error), "error");
    });
  }, 700);
}

function stopSmartRecorderPolling() {
  window.clearInterval(state.smartRecorder.pollTimer);
  state.smartRecorder.pollTimer = null;
}

async function startSmartRecorder() {
  try {
    setBusy("Gravando");
    const result = await invoke("start_smart_recorder");
    state.smartRecorder.running = Boolean(result.running);
    state.smartRecorder.events = Array.isArray(result.events) ? result.events : [];
    state.smartRecorder.pendingClickId = null;
    renderSmartRecorder();
    startSmartRecorderPolling();
    setMessage(result.message || "Gravador iniciado. Use ESC para finalizar.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function stopSmartRecorder() {
  try {
    setBusy("Parando gravador");
    const result = await invoke("stop_smart_recorder");
    state.smartRecorder.running = Boolean(result.running);
    state.smartRecorder.events = Array.isArray(result.events) ? result.events : [];
    stopSmartRecorderPolling();
    renderSmartRecorder();
    setBusy("Pronto");
    setMessage("Gravacao finalizada. Revise os blocos antes de enviar para o mapa.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function adjustSmartRecorderClickImage(eventId) {
  const event = state.smartRecorder.events.find((item) => String(item.id) === String(eventId));
  if (!event || event.type !== "clicar_imagem") return;
  try {
    setBusy("Ajustando area");
    const result = await invoke("capture_image_asset", { baseNameHint: `gravador_click_${event.id}` });
    event.image_id = result.image_id || event.image_id;
    event.crop = { ...(event.crop || {}), manual: true };
    renderSmartRecorder();
    setBusy("Pronto");
    setMessage("Area do clique atualizada para esse bloco gravado.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function confirmSmartRecorderClickArea(card) {
  const eventId = Number(card?.dataset.smartRecorderId || 0);
  const event = state.smartRecorder.events.find((item) => Number(item.id) === eventId);
  if (!event || event.type !== "clicar_imagem") return;
  const get = (field) => card.querySelector(`[data-smart-recorder-field="${field}"]`);
  const width = Math.max(40, Math.trunc(parseNumber(get("width")?.value, event.crop?.width || 180)));
  const height = Math.max(40, Math.trunc(parseNumber(get("height")?.value, event.crop?.height || 110)));
  const clickValue = get("clicks")?.value || "1";
  const clickAction = clickValue === "identify" ? "identificar" : "clicar";
  const clicks = clickAction === "identificar" ? 0 : Math.max(1, Math.min(2, Math.trunc(parseNumber(clickValue, event.clicks || 1))));
  try {
    setBusy("Confirmando area");
    const result = await invoke("update_smart_recorder_click_area", {
      eventId,
      width,
      height,
      clicks,
      clickAction,
    });
    state.smartRecorder.events = Array.isArray(result.events) ? result.events : state.smartRecorder.events;
    const updated = result.event;
    if (updated?.image_id) {
      delete state.smartRecorder.previews[updated.image_id];
    }
    renderSmartRecorder();
    setBusy("Pronto");
    setMessage("Area e quantidade de cliques confirmadas.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function deleteSmartRecorderEvent(eventId) {
  const event = state.smartRecorder.events.find((item) => String(item.id) === String(eventId));
  if (!event) return;
  try {
    setBusy("Excluindo bloco");
    const result = await invoke("delete_smart_recorder_event", { eventId: Number(eventId) });
    state.smartRecorder.events = Array.isArray(result.events)
      ? result.events
      : state.smartRecorder.events.filter((item) => String(item.id) !== String(eventId));
    if (event.image_id) {
      delete state.smartRecorder.previews[event.image_id];
    }
    renderSmartRecorder();
    setBusy(state.smartRecorder.running ? "Gravando" : "Pronto");
    setMessage("Bloco removido do Gravador inteligente.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function updateSmartRecorderEventDelay(input) {
  const eventId = Number(input?.dataset.smartRecorderDelayId || 0);
  if (!eventId) return;
  const delay = Math.max(0, Number(parseNumber(input.value, 0)));
  const current = state.smartRecorder.events.find((item) => Number(item.id) === eventId);
  if (current && Math.abs(Number(current.delay || 0) - delay) < 0.001) return;
  try {
    setBusy("Salvando tempo");
    const result = await invoke("update_smart_recorder_event_delay", { eventId, delay });
    state.smartRecorder.events = Array.isArray(result.events) ? result.events : state.smartRecorder.events;
    renderSmartRecorder();
    setBusy(state.smartRecorder.running ? "Gravando" : "Pronto");
    setMessage("Tempo do bloco atualizado.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function sendSmartRecorderEventsToMap() {
  const events = smartRecorderUsableEvents();
  if (!events.length) {
    setMessage("Nenhum bloco gravado para enviar ao mapa.", "error");
    return;
  }
  const pendingClicks = events.filter((event) => event.type === "clicar_imagem" && !event.confirmed);
  if (pendingClicks.length) {
    setMessage("Confirme a area dos cliques visuais antes de enviar para o mapa.", "error");
    return;
  }
  try {
    setBusy("Enviando blocos");
    let roadmap = null;
    const sequencia = currentSequenceName();
    for (const event of events) {
      const eventSequence = smartRecorderTargetSequence(event);
      if (event.type === "texto_livre" && String(event.text || "").trim()) {
        roadmap = await invoke("add_text_block", {
          text: String(event.text || ""),
          delay: Number(event.delay || 0.3),
          sequencia: eventSequence,
          aoSucesso: "continuar",
          blocoSucesso: null,
          sequenciaSucesso: null,
          atrasoSequenciaSucesso: 0,
          editavelExecucao: false,
          rotuloExecucao: null,
        });
      } else if (event.type === "tecla" && String(event.keys || "").trim()) {
        roadmap = await invoke("add_key_block", {
          keys: String(event.keys || ""),
          repeat: Number(event.repeat || 1),
          delay: Number(event.delay || 0.3),
          sequencia: eventSequence,
          aoSucesso: "continuar",
          blocoSucesso: null,
          sequenciaSucesso: null,
          atrasoSequenciaSucesso: 0,
        });
      } else if (event.type === "clicar_imagem" && String(event.image_id || "").trim()) {
        roadmap = await invoke("add_image_click_block", {
          imagem: String(event.image_id || ""),
          timeout: 10,
          confianca: Number(event.confidence || 0.82),
          perfilBusca: "balanced",
          clicar: !(event.click_action === "identificar" || Number(event.clicks || 1) <= 0),
          clicks: event.click_action === "identificar" ? 0 : Number(event.clicks || 1),
          offsetX: 0,
          offsetY: 0,
          janelaAlvo: null,
          textoOcrEsperado: null,
          aoNaoEncontrar: "parar",
          sequenciaNaoEncontrar: null,
          blocoNaoEncontrar: null,
          atrasoSequenciaNaoEncontrar: 0,
          quantidadeTentativas: 1,
          intervaloTentativas: 1,
          delay: Number(event.delay || 0.3),
          sequencia: eventSequence,
          aoSucesso: "continuar",
          blocoSucesso: null,
          sequenciaSucesso: null,
          atrasoSequenciaSucesso: 0,
        });
      }
    }
    if (roadmap) {
      applyRoadmap(roadmap, { preserveCommandMapSequence: sequencia });
      markCommandMapSaveDirty();
    }
    await invoke("clear_smart_recorder_events");
    state.smartRecorder.events = [];
    state.smartRecorder.previews = {};
    renderSmartRecorder();
    setBusy("Pronto");
    setMessage(`${events.length} bloco(s) enviados para o mapa e removidos do gravador.`, "success");
    setWorkspaceTab("commands");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function workbookSheetsFor(workbookId) {
  return workbookById(workbookId)?.sheets ?? [];
}

function countBlocksUsingWorkbook(workbookId) {
  const normalizedWorkbookId = String(workbookId || "").trim();
  if (!normalizedWorkbookId) {
    return 0;
  }

  return (state.roadmap?.events ?? []).filter((event) => {
    const details = event.details || event.detalhes || {};
    const eventWorkbook = String(details.arquivo || details.workbook || "").trim();
    return eventWorkbook === normalizedWorkbookId;
  }).length;
}

function columnsForSheetInWorkbook(workbookId, sheetName) {
  return workbookSheetsFor(workbookId).find((sheet) => sheet.name === sheetName)?.columns ?? [];
}

function resolveWorkbookId(preferredId = "") {
  const workbooks = availableWorkbooks();
  return workbookById(preferredId)?.id
    || workbookById(state.composerWorkbookId)?.id
    || workbookById(state.workbook?.default_workbook)?.id
    || workbooks[0]?.id
    || "";
}

function setOptionsForSelect(select, options, selectedValue = "") {
  if (!select) return;
  select.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
    .join("");
  select.value = options.includes(selectedValue) ? selectedValue : options[0] ?? "";
}

function setColumnSuggestionsForField(field, columns, selectedValue = "") {
  if (!field) return;
  const value = columns.includes(selectedValue) ? selectedValue : columns[0] ?? selectedValue ?? "";
  if (field.tagName === "SELECT") {
    setOptionsForSelect(field, columns, value);
    return;
  }

  const listId = field.getAttribute("list");
  const datalist = listId ? document.getElementById(listId) : null;
  if (datalist) {
    datalist.innerHTML = columns
      .map((column) => `<option value="${escapeHtml(column)}"></option>`)
      .join("");
  }
  field.value = value;
}

function syncSpreadsheetSheetAndColumnFields(container, fieldSelector, workbookId, preferredSheet = "", preferredColumn = "") {
  const sheetField = container?.querySelector(`[${fieldSelector}="sheet"]`);
  const columnField = container?.querySelector(`[${fieldSelector}="column"]`);
  const sheets = workbookSheetsFor(workbookId);
  const nextSheet = sheets.some((sheet) => sheet.name === preferredSheet)
    ? preferredSheet
    : sheets[0]?.name ?? "";
  setOptionsForSelect(sheetField, sheets.map((sheet) => sheet.name), nextSheet);
  setColumnSuggestionsForField(columnField, columnsForSheetInWorkbook(workbookId, nextSheet), preferredColumn);
  return {
    sheet: nextSheet,
    column: columnField?.value ?? "",
  };
}

function populateSheetSelect(selectedName) {
  const sheets = workbookSheets();
  const chosen = selectedName && sheets.some((sheet) => sheet.name === selectedName)
    ? selectedName
    : sheets[0]?.name ?? "";

  sheetSelect.innerHTML = sheets.length
    ? sheets.map((sheet) => `<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join("")
    : `<option value="">Nenhuma aba</option>`;
  sheetSelect.value = chosen;
  populateColumnSelect(chosen);
}

function populateColumnSelect(sheetName, selectedColumn) {
  const columns = columnsForSheet(sheetName);
  const chosen = selectedColumn && columns.includes(selectedColumn) ? selectedColumn : columns[0] ?? "";
  columnSelect.innerHTML = columns.length
    ? columns.map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`).join("")
    : `<option value="">Nenhuma coluna</option>`;
  columnSelect.value = chosen;
}

function syncWorkbook(workbook) {
  if (workbook) {
    state.workbook = workbook;
  }
  const workbooks = availableWorkbooks();
  const defaultWorkbookId = state.workbook?.default_workbook || workbooks[0]?.id || "";
  if (!state.composerWorkbookId || !workbooks.some((item) => item.id === state.composerWorkbookId)) {
    state.composerWorkbookId = defaultWorkbookId;
  }
  if (!state.previewWorkbookId || !workbooks.some((item) => item.id === state.previewWorkbookId)) {
    state.previewWorkbookId = defaultWorkbookId;
  }
  populateComposerWorkbookSelect();
  populateSheetSelect(sheetSelect.value);
}

function populateComposerWorkbookSelect() {
  const workbooks = availableWorkbooks();
  composerWorkbookSelect.innerHTML = workbooks.length
    ? workbooks
        .map((workbook) => `<option value="${escapeHtml(workbook.id)}">${escapeHtml(workbook.file_name)}</option>`)
        .join("")
    : `<option value="">Nenhuma planilha</option>`;
  composerWorkbookSelect.value = state.composerWorkbookId || workbooks[0]?.id || "";
}

function populateWorkbookSheetSelect() {
  const sheets = selectedPreviewWorkbookMeta()?.sheets ?? [];
  const chosen = state.workbookSelectedSheet && sheets.some((sheet) => sheet.name === state.workbookSelectedSheet)
    ? state.workbookSelectedSheet
    : sheets[0]?.name ?? "";

  workbookSheetSelect.innerHTML = sheets.length
    ? sheets.map((sheet) => `<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join("")
    : `<option value="">Nenhuma aba</option>`;
  workbookSheetSelect.value = chosen;
  state.workbookSelectedSheet = chosen;
}

function renderWorkbookFileTabs() {
  const workbooks = availableWorkbooks();
  if (!workbooks.length) {
    workbookFilesTabs.innerHTML = "";
    return;
  }

  workbookFilesTabs.innerHTML = workbooks
    .map((workbook) => {
      const activeClass = workbook.id === state.previewWorkbookId ? " is-active" : "";
      return `<button class="workbook-file-tab${activeClass}" type="button" data-workbook-tab="${escapeHtml(workbook.id)}">${escapeHtml(workbook.file_name)}</button>`;
    })
    .join("");
}

function filteredWorkbookRows() {
  const preview = state.workbookPreview;
  if (!preview) {
    return [];
  }

  const filter = state.workbookSearch.trim().toLowerCase();
  if (!filter) {
    return preview.rows ?? [];
  }

  return (preview.rows ?? []).filter((row) =>
    row.values.some((value) => String(value ?? "").toLowerCase().includes(filter))
  );
}

function updateWorkbookSelectionLabels() {
  const preview = state.workbookPreview;
  const selectedCell = state.workbookSelectedCell;
  const selectedColumn = state.workbookSelectedColumn;
  const hasSelectedCell =
    selectedCell &&
    selectedCell.value !== undefined &&
    selectedCell.value !== null &&
    `${selectedCell.value}`.trim() !== "";

  if (hasSelectedCell) {
    selectedWorkbookTitle.textContent = `${selectedCell.header} | linha ${selectedCell.rowNumber}`;
    selectedWorkbookSubtitle.textContent = `Esse valor sera enviado como texto para o mapa a partir da aba ${selectedCell.sheet}.`;
    selectedWorkbookValue.textContent = selectedCell.value;
    selectedWorkbookStatus.textContent = "Pronto";
    workbookSelectedValueBlock.classList.add("is-ready");
    workbookSelectedValueBlock.classList.remove("is-empty");
    addWorkbookCellButton.disabled = false;
  } else {
    selectedWorkbookTitle.textContent = "Escolha uma celula";
    selectedWorkbookSubtitle.textContent = "Clique em qualquer celula da tabela para mandar aquele valor direto para o mapa.";
    selectedWorkbookValue.textContent = "-";
    selectedWorkbookStatus.textContent = "Aguardando";
    workbookSelectedValueBlock.classList.remove("is-ready");
    workbookSelectedValueBlock.classList.add("is-empty");
    addWorkbookCellButton.disabled = true;
  }

  if (selectedColumn && preview?.headers?.includes(selectedColumn)) {
    selectedWorkbookColumnTitle.textContent = `${selectedColumn} | aba ${preview.sheet}`;
    selectedWorkbookColumnSubtitle.textContent = "Cada linha dessa coluna vai virar um item do loop quando voce enviar para o mapa.";
    selectedWorkbookColumnPreview.textContent = `${selectedColumn} | ${preview.rows?.length || 0} linhas prontas para o loop`;
    selectedWorkbookColumnStatus.textContent = "Pronto";
    workbookSelectedColumnBlock.classList.add("is-ready");
    workbookSelectedColumnBlock.classList.remove("is-empty");
    addWorkbookColumnButton.disabled = false;
  } else {
    selectedWorkbookColumnTitle.textContent = "Escolha uma coluna";
    selectedWorkbookColumnSubtitle.textContent = "Clique no nome de uma coluna para transformar cada linha dela em um item do loop.";
    selectedWorkbookColumnPreview.textContent = "Nenhuma coluna escolhida ainda.";
    selectedWorkbookColumnStatus.textContent = "Aguardando";
    workbookSelectedColumnBlock.classList.remove("is-ready");
    workbookSelectedColumnBlock.classList.add("is-empty");
    addWorkbookColumnButton.disabled = true;
  }
}

function renderWorkbookPreview() {
  populateWorkbookSheetSelect();
  renderWorkbookFileTabs();
  if (openWorkbookButton) {
    openWorkbookButton.disabled = !selectedPreviewWorkbookMeta()?.id;
  }
  if (deleteWorkbookButton) {
    deleteWorkbookButton.disabled = !selectedPreviewWorkbookMeta()?.id;
  }
  const preview = state.workbookPreview;
  if (!preview?.headers?.length) {
    workbookMeta.textContent = "A planilha ainda nao foi encontrada ou nao possui colunas legiveis.";
    workbookRowsInfo.textContent = "Sem linhas carregadas.";
    workbookTableWrap.innerHTML = `<div class="empty-state">Nenhum dado de planilha disponivel no momento.</div>`;
    updateWorkbookSelectionLabels();
    return;
  }

  if (!preview.headers.includes(state.workbookSelectedColumn)) {
    state.workbookSelectedColumn = preview.headers[0] ?? "";
  }

  const rows = filteredWorkbookRows();
  workbookMeta.textContent = `${preview.workbook_name} • ${preview.total_rows} linhas encontradas na aba ${preview.sheet}. Use a tabela para escolher valores ou colunas.`;
  workbookRowsInfo.textContent = `${rows.length} de ${preview.total_rows} linhas visiveis`;

  const headerCells = preview.headers
    .map((header) => {
      const selectedClass = header === state.workbookSelectedColumn ? " is-selected" : "";
      return `
        <th class="workbook-col-head${selectedClass}" data-workbook-column="${escapeHtml(header)}">
          <div class="workbook-col-head-inner">
            <span>${escapeHtml(header)}</span>
            <button class="micro-button" type="button" data-workbook-column-action="select" data-column="${escapeHtml(header)}">Loop</button>
          </div>
        </th>
      `;
    })
    .join("");

  const bodyRows = rows.length
    ? rows
        .map((row) => {
          const cells = row.values
            .map((value, index) => {
              const header = preview.headers[index] ?? `Coluna ${index + 1}`;
              const selected =
                state.workbookSelectedCell &&
                state.workbookSelectedCell.rowNumber === row.row_number &&
                state.workbookSelectedCell.header === header;
              const classes = ["workbook-cell"];
              if (selected) {
                classes.push("is-selected");
              }
              if (header === state.workbookSelectedColumn) {
                classes.push("is-column-selected");
              }
              const safeValue = String(value ?? "");
              return `
                <td class="${classes.join(" ")}" data-workbook-cell="true" data-row-number="${row.row_number}" data-column="${escapeHtml(header)}" data-value="${escapeHtml(safeValue)}">
                  <div class="workbook-cell-inner">
                    <span>${escapeHtml(safeValue || "-")}</span>
                    ${safeValue ? `<button class="micro-button workbook-cell-add" type="button" data-workbook-cell-add="true" data-row-number="${row.row_number}" data-column="${escapeHtml(header)}" data-value="${escapeHtml(safeValue)}">Mapa</button>` : ""}
                  </div>
                </td>
              `;
            })
            .join("");
          return `
            <tr>
              <td class="workbook-row-number">
                <div class="workbook-row-number-inner">
                  <span>${row.row_number}</span>
                  <button
                    class="micro-button workbook-row-remove"
                    type="button"
                    data-workbook-row-remove="${row.row_number}"
                    title="Excluir linha ${row.row_number}"
                  >
                    Excluir
                  </button>
                </div>
              </td>
              ${cells}
            </tr>
          `;
        })
        .join("")
    : `<tr><td class="workbook-empty-row" colspan="${preview.headers.length + 1}">Nenhuma linha encontrada para esse filtro.</td></tr>`;

  workbookTableWrap.innerHTML = `
    <table class="workbook-table">
      <thead>
        <tr>
          <th class="workbook-row-number-head">#</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;

  updateWorkbookSelectionLabels();
}

function updateStats() {
  const summary = state.roadmap?.summary ?? {};
  totalBlocks.textContent = summary.total ?? 0;
  textBlocks.textContent = summary.text_blocks ?? 0;
  keyBlocks.textContent = summary.key_blocks ?? 0;
  spreadsheetBlocks.textContent = summary.spreadsheet_blocks ?? 0;

  const total = summary.total ?? 0;
  timelineMeta.textContent = total
    ? `${total} blocos conectados no fluxo. Edite qualquer card e salve no proprio lugar.`
    : "Sem blocos no momento. Comece adicionando um texto, atalho, clique, reconhecimento ou loop.";
  updateCommandMapHeaderSummary();
}

function setLauncherCreateOpen(open) {
  state.library.createOpen = Boolean(open);
  if (!state.library.createOpen) {
    state.library.createDraft = {
      nome: "",
      categoria: "",
      descricao: "",
    };
    if (newAutomationNameInput) {
      newAutomationNameInput.value = "";
    }
    if (newAutomationCategoryInput) {
      newAutomationCategoryInput.value = "";
    }
    if (newAutomationDescriptionInput) {
      newAutomationDescriptionInput.value = "";
    }
  }
  if (launcherCreatePanel) {
    launcherCreatePanel.hidden = true;
  }
  renderLauncherLibrary();
  if (state.library.createOpen) {
    requestAnimationFrame(() => {
      launcherList?.querySelector('[data-create-field="nome"]')?.focus();
    });
  }
}

async function createAutomationFromDraft() {
  const nome = String(state.library.createDraft?.nome || "").trim();
  if (!nome) {
    setMessage("Informe um nome para a nova automacao.", "error");
    return;
  }

  try {
    setBusy("Criando");
    const result = await invoke("create_saved_automation", {
      nome,
      descricao: String(state.library.createDraft?.descricao || "").trim(),
      categoria: String(state.library.createDraft?.categoria || "").trim() || "Outros",
    });
    applyPersistedRoadmap(result);
    state.library.items = result.library?.items || state.library.items;
    state.library.categories = result.library?.categories || state.library.categories;
    state.library.activeId = result.library?.active_id || "";
    exportNameInput.value = nome;
    setLauncherCreateOpen(false);
    setWorkspaceTab("commands");
    setBusy("Pronto");
    setMessage("Automacao criada com sucesso.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function renderLauncherCreateCard() {
  const draft = state.library.createDraft || {};
  if (state.library.createOpen) {
    return `
      <article class="automation-library-card automation-library-card--create automation-library-card--create-open" data-automation-id="__new__">
        <div class="automation-library-card-stage">
          <section class="automation-library-card-face automation-library-card-front automation-library-create-face automation-library-create-form-face">
            <div class="automation-library-top automation-library-top--create">
              <div>
                <p class="panel-kicker">Novo projeto</p>
                <h3>Novo card de automacao</h3>
              </div>
              <button class="launcher-flip-trigger" type="button" data-library-action="create-cancel">Cancelar</button>
            </div>
            <div class="automation-library-create-form">
              <label class="automation-library-create-field">
                <span>Nome</span>
                <input data-create-field="nome" type="text" placeholder="Ex.: Cadastro de Cliente Alterdata" value="${escapeHtml(draft.nome || "")}" />
              </label>
              <label class="automation-library-create-field">
                <span>Categoria</span>
                <input data-create-field="categoria" type="text" list="launcherCategorySuggestions" placeholder="Alterdata" value="${escapeHtml(draft.categoria || "")}" />
              </label>
              <label class="automation-library-create-field automation-library-create-field--full">
                <span>Descricao</span>
                <textarea data-create-field="descricao" rows="4" placeholder="Explique rapidamente o objetivo da automacao">${escapeHtml(draft.descricao || "")}</textarea>
              </label>
            </div>
            <div class="automation-library-actions automation-library-actions--create">
              <button class="ghost-button secondary-inline-action" data-library-action="import">Importar ZIP</button>
              <button class="ghost-button secondary-inline-action" data-library-action="create-cancel">Cancelar</button>
              <button class="primary-button primary-inline-action" data-library-action="create-confirm">Criar automacao</button>
            </div>
          </section>
        </div>
      </article>
    `;
  }

  return `
    <article class="automation-library-card automation-library-card--create" data-automation-id="__new__">
      <div class="automation-library-card-stage">
        <section class="automation-library-card-face automation-library-card-front automation-library-create-face">
          <p class="panel-kicker">Novo projeto</p>
          <h3>Criar automacao</h3>
          <p class="automation-library-description">Inicie outra automacao sem sair da biblioteca.</p>
          <div class="automation-library-actions">
            <button class="primary-button primary-inline-action" data-library-action="create">+ Nova automacao</button>
            <button class="ghost-button secondary-inline-action" data-library-action="import">Importar ZIP</button>
          </div>
        </section>
      </div>
    </article>
  `;
}

function setLibraryEditOpen(automationId, open) {
  const targetId = String(automationId || "");
  if (!open) {
    state.library.editingId = "";
    state.library.editDraft = {
      nome: "",
      categoria: "",
      descricao: "",
    };
    renderLauncherLibrary();
    return;
  }

  const item = state.library.items.find((entry) => String(entry.id) === targetId);
  if (!item) {
    return;
  }

  state.library.editingId = targetId;
  state.library.editDraft = {
    nome: String(item.nome || ""),
    categoria: String(item.categoria || "Outros"),
    descricao: String(item.descricao || ""),
  };
  renderLauncherLibrary();
}

async function saveLibraryCardEdit(automationId) {
  const targetId = String(automationId || "");
  const nome = String(state.library.editDraft?.nome || "").trim();
  if (!nome) {
    throw new Error("Informe um nome para a automacao.");
  }

  const categoria = String(state.library.editDraft?.categoria || "").trim() || "Outros";
  const descricao = String(state.library.editDraft?.descricao || "").trim();

  const result = await invoke("rename_saved_automation", {
    id: targetId,
    nome,
    descricao,
    categoria,
  });

  state.library.items = result.library?.items || state.library.items;
  state.library.categories = result.library?.categories || state.library.categories;
  state.library.activeId = result.library?.active_id || state.library.activeId;
  state.library.editingId = "";
  state.library.editDraft = {
    nome: "",
    categoria: "",
    descricao: "",
  };
  renderLauncherLibrary();
}

function formatDateLabel(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("pt-BR");
}

function compareAutomationItems(a, b) {
  const sort = state.library.sort || "updated_desc";
  if (sort === "name_asc") {
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  }
  if (sort === "created_desc") {
    return String(b.criado_em || "").localeCompare(String(a.criado_em || ""));
  }
  if (sort === "used_desc") {
    const usedDiff = Number(b.vezes_executada || 0) - Number(a.vezes_executada || 0);
    if (usedDiff !== 0) {
      return usedDiff;
    }
  }
  return String(b.atualizado_em || "").localeCompare(String(a.atualizado_em || ""));
}

function systemStatusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "ok":
      return "Pronto";
    case "warning":
      return "Atencao";
    case "error":
      return "Corrigir";
    default:
      return "Verificando";
  }
}

function renderSystemDiagnostics() {
  return;
}

async function refreshSystemDiagnostics() {
  return null;
}

async function runSystemAutofix() {
  return null;
}

function filteredAutomationItems() {
  const search = (state.library.search || "").trim().toLowerCase();
  const category = (state.library.category || "").trim();
  const createdFrom = state.library.createdFrom || "";
  const updatedFrom = state.library.updatedFrom || "";
  return [...(state.library.items || [])]
    .filter((item) => {
      if (search) {
        const haystack = `${item.nome || ""} ${item.descricao || ""}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      if (category && String(item.categoria || "") !== category) {
        return false;
      }
      if (createdFrom && String(item.criado_em || "").slice(0, 10) < createdFrom) {
        return false;
      }
      if (updatedFrom && String(item.atualizado_em || "").slice(0, 10) < updatedFrom) {
        return false;
      }
      return true;
    })
    .sort(compareAutomationItems);
}

function renderLauncherLibrary() {
  if (!launcherList) {
    return;
  }
  const items = filteredAutomationItems();
  const hasItems = items.length > 0;
  launcherMeta.textContent = items.length
    ? `${items.length} automacoes encontradas. Abra, execute e organize sua biblioteca.`
    : "Biblioteca vazia. Crie a primeira automacao ou importe um ZIP.";

  if (newAutomationButton) {
    newAutomationButton.hidden = false;
    newAutomationButton.textContent = hasItems ? "+ Nova automacao" : "Criar primeira automacao";
  }

  launcherCategoryFilter.innerHTML = [
    '<option value="">Todas</option>',
    ...(state.library.categories || []).map((category) => {
      const selected = category === state.library.category ? "selected" : "";
      return `<option value="${escapeHtml(category)}" ${selected}>${escapeHtml(category)}</option>`;
    }),
  ].join("");

  launcherCategorySuggestions.innerHTML = (state.library.categories || [])
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");

  if (launcherExtraFilters) {
    launcherExtraFilters.hidden = true;
  }

  const createCard = renderLauncherCreateCard();

  if (!hasItems) {
    const emptyStatePanel = state.library.createOpen
      ? `
        <section class="launcher-empty-library-panel" data-automation-id="__empty__">
          <div class="launcher-empty-library-copy">
            <p class="panel-kicker">Biblioteca vazia</p>
            <h3>Preencha os dados da sua primeira automacao</h3>
            <p>O FlowDetect foi aberto limpo para voce comecar do zero. O formulario ja esta no card acima.</p>
          </div>
          <div class="launcher-empty-library-tip">Depois de criar, ela ja abre pronta para editar no mapa dos comandos.</div>
        </section>
      `
      : `
        <section class="launcher-empty-library-panel" data-automation-id="__empty__">
          <div class="launcher-empty-library-copy">
            <p class="panel-kicker">Biblioteca vazia</p>
            <h3>Crie sua primeira automacao</h3>
            <p>Este setup foi gerado limpo, sem automacoes, imagens ou planilhas. Comece uma nova automacao agora ou importe um ZIP pronto.</p>
          </div>
          <div class="launcher-empty-library-actions">
            <button class="primary-button primary-inline-action" data-library-action="create">Criar primeira automacao</button>
            <button class="ghost-button secondary-inline-action" data-library-action="import">Importar ZIP</button>
          </div>
        </section>
      `;
    launcherList.innerHTML = `
      ${createCard}
      ${emptyStatePanel}
    `;
    return;
  }

  launcherList.innerHTML = createCard + items
    .map((item) => {
      const activeClass = item.active ? " is-active" : "";
      const isEditing = String(state.library.editingId || "") === String(item.id);
      const editingClass = isEditing ? " is-editing" : "";
      const flippedClass = isEditing ? " is-flipped" : "";
      const description = escapeHtml(item.descricao || "Sem descricao curta.");
      const lastExecution = item.ultima_execucao
        ? escapeHtml(formatDateLabel(item.ultima_execucao))
        : "Nunca executada";
      const updatedAt = escapeHtml(formatDateLabel(item.atualizado_em));
      const editDraft = isEditing
        ? (state.library.editDraft || {})
        : {
            nome: item.nome || "",
            categoria: item.categoria || "Outros",
            descricao: item.descricao || "",
          };
      return `
        <article class="automation-library-card${activeClass}${editingClass}${flippedClass}" data-automation-id="${escapeHtml(item.id)}">
          <div class="automation-library-card-stage">
            <section class="automation-library-card-face automation-library-card-front">
              <div class="automation-library-top">
                <div>
                  <p class="panel-kicker">${escapeHtml(item.categoria || "Outros")}</p>
                  <h3>${escapeHtml(item.nome)}</h3>
                </div>
                <div class="automation-library-top-side">
                  ${item.active ? '<span class="library-active-chip">Em edicao</span>' : ""}
                  <button class="launcher-flip-trigger" type="button" data-library-action="flip">Virar</button>
                </div>
              </div>

              <div class="automation-library-front-summary">
                <p class="automation-library-description">${description}</p>
                <div class="automation-library-quick-meta">
                  <span>
                    <small>Comandos</small>
                    <strong>${escapeHtml(item.command_count ?? 0)}</strong>
                  </span>
                  <span>
                    <small>Sequencias</small>
                    <strong>${escapeHtml(item.sequence_count ?? 1)}</strong>
                  </span>
                  <span>
                    <small>Execucoes</small>
                    <strong>${escapeHtml(item.vezes_executada ?? 0)}</strong>
                  </span>
                </div>
                <div class="automation-library-front-footer">
                  <span class="automation-library-front-note">Atualizada: ${updatedAt}</span>
                  <span class="automation-library-front-note">Ultima: ${lastExecution}</span>
                </div>
              </div>

              <div class="automation-library-actions">
                <button class="tree-open-button primary-inline-action" data-library-action="edit">Editar</button>
                <button class="soft-button primary-inline-action" data-library-action="run">Executar</button>
                <button class="ghost-button secondary-inline-action" data-library-action="duplicate">Duplicar</button>
              </div>
            </section>

            <section class="automation-library-card-face automation-library-card-back">
              <div class="automation-library-back-top">
                <div>
                  <p class="panel-kicker">${escapeHtml(item.categoria || "Outros")}</p>
                  <h3 class="automation-library-back-title">${escapeHtml(item.nome)}</h3>
                </div>
                <div class="automation-library-top-side">
                  ${item.active ? '<span class="library-active-chip">Ativa</span>' : ""}
                  <button class="launcher-flip-trigger" type="button" data-library-action="${isEditing ? "edit-cancel" : "unflip"}">${isEditing ? "Cancelar" : "Voltar"}</button>
                </div>
              </div>

              ${
                isEditing
                  ? `
                    <div class="automation-library-back-body automation-library-back-body--edit">
                      <div class="automation-library-card-edit-form">
                        <label class="automation-library-card-edit-field">
                          <span>Nome</span>
                          <input type="text" value="${escapeHtml(String(editDraft.nome || ""))}" data-library-edit-field="nome" />
                        </label>
                        <label class="automation-library-card-edit-field">
                          <span>Categoria</span>
                          <input type="text" value="${escapeHtml(String(editDraft.categoria || ""))}" list="launcherCategorySuggestions" data-library-edit-field="categoria" />
                        </label>
                        <label class="automation-library-card-edit-field automation-library-card-edit-field--full">
                          <span>Descricao</span>
                          <textarea rows="5" data-library-edit-field="descricao">${escapeHtml(String(editDraft.descricao || ""))}</textarea>
                        </label>
                        <div class="automation-library-id">ID: ${escapeHtml(item.id)}</div>
                      </div>
                    </div>

                    <div class="automation-library-actions">
                      <button class="ghost-button secondary-inline-action" data-library-action="edit-cancel">Cancelar</button>
                      <button class="primary-button primary-inline-action" data-library-action="edit-save">Salvar</button>
                    </div>
                  `
                  : `
                    <p class="automation-library-description-full">${description}</p>

                    <div class="automation-library-back-body">
                      <div class="automation-library-back-grid">
                        <span>
                          <small>Criada em</small>
                          <strong>${escapeHtml(formatDateLabel(item.criado_em))}</strong>
                        </span>
                        <span>
                          <small>Atualizada em</small>
                          <strong>${escapeHtml(formatDateLabel(item.atualizado_em))}</strong>
                        </span>
                        <span>
                          <small>Ultima execucao</small>
                          <strong>${lastExecution}</strong>
                        </span>
                        <span>
                          <small>Categoria</small>
                          <strong>${escapeHtml(item.categoria || "Outros")}</strong>
                        </span>
                        <span>
                          <small>Comandos</small>
                          <strong>${escapeHtml(item.command_count ?? 0)}</strong>
                        </span>
                        <span>
                          <small>Sequencias</small>
                          <strong>${escapeHtml(item.sequence_count ?? 1)}</strong>
                        </span>
                        <span>
                          <small>Execucoes</small>
                          <strong>${escapeHtml(item.vezes_executada ?? 0)}</strong>
                        </span>
                        <span>
                          <small>Status</small>
                          <strong>${item.active ? "Em edicao" : "Disponivel"}</strong>
                        </span>
                      </div>

                      <div class="automation-library-id">ID: ${escapeHtml(item.id)}</div>
                    </div>

                    <div class="automation-library-actions">
                      <button class="ghost-button secondary-inline-action" data-library-action="edit-meta">Editar dados</button>
                      <button class="ghost-button secondary-inline-action" data-library-action="export-zip">Exportar ZIP</button>
                      <button class="danger-button secondary-inline-action" data-library-action="delete">Excluir</button>
                    </div>
                  `
              }
            </section>
          </div>
        </article>
      `;
    })
    .join("");
}

function studioControlSelectedAutomation() {
  return state.remoteControl.library.find((item) => String(item.id) === String(state.remoteControl.selectedId)) || null;
}

function studioControlAutomationSummary(item) {
  const commands = Number(item.command_count ?? item.commands ?? item.total_blocos ?? 0);
  const sequences = Number(item.sequence_count ?? item.sequences ?? 1);
  const updated = item.atualizado_em || item.updated_at || item.updatedAt || "";
  const parts = [`${commands} bloco${commands === 1 ? "" : "s"}`, `${sequences || 1} pagina${sequences === 1 ? "" : "s"}`];
  if (updated) {
    parts.push(`Atualizada em ${formatDateLabel(updated)}`);
  }
  return parts.join(" | ");
}

function studioControlEvents() {
  return Array.isArray(state.remoteControl.roadmap?.events) ? state.remoteControl.roadmap.events : [];
}

function studioControlSequenceEvents(sequence = state.remoteControl.currentSequence) {
  const normalized = normalizeSequenceName(sequence);
  return studioControlEvents()
    .filter((event) => normalizeSequenceName(event.sequence || event.sequencia || "principal") === normalized)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function studioControlVisiblePages() {
  const events = studioControlEvents();
  const used = new Set(events.map((event) => normalizeSequenceName(event.sequence || event.sequencia || "principal")));
  return COMMAND_PAGE_DEFINITIONS.filter((page) => used.has(page.sequence) || page.sequence === "principal");
}

function studioControlFirstOrder(sequence = state.remoteControl.currentSequence) {
  return studioControlSequenceEvents(sequence)[0]?.order ?? null;
}

function studioControlCurrentEvent() {
  return studioControlEvents().find((event) => Number(event.order) === Number(state.remoteControl.currentOrder)) || null;
}

function studioControlEventTitle(event = {}) {
  const details = event.details || event.detalhes || {};
  if (event.title) {
    return String(event.title);
  }
  if (event.type === "texto_livre") {
    return "Texto livre";
  }
  if (event.type === "tecla" || event.type === "atalho") {
    return "Tecla";
  }
  if (event.type === "mouse_click") {
    return "Mouse";
  }
  if (event.type === "clicar_imagem") {
    return "Reconhecimento visual";
  }
  if (event.type === "sequencia_planilha") {
    return "Loop da planilha";
  }
  if (event.type === "escrever_planilha") {
    return "Escrever na planilha";
  }
  if (event.type === "abrir_url") {
    return "Abrir URL";
  }
  if (event.type === "abrir_programa") {
    return "Abrir Programa";
  }
  if (event.type === "inicio_loop") {
    return "Inicio do loop";
  }
  if (event.type === "fim_loop") {
    return "Fim do loop";
  }
  return details.nome || typeChipLabel(event.type || "bloco");
}

function studioControlEventSubtitle(event = {}) {
  const details = event.details || event.detalhes || {};
  if (event.type === "texto_livre") {
    return details.texto || details.text || "Texto configurado";
  }
  if (event.type === "tecla" || event.type === "atalho") {
    return `${details.teclas || details.keys || details.tecla || "tecla"}${details.repeticoes ? ` x${details.repeticoes}` : ""}`;
  }
  if (event.type === "mouse_click") {
    return `${details.botao || "click"} em ${details.x ?? "-"}, ${details.y ?? "-"}`;
  }
  if (event.type === "clicar_imagem") {
    return details.imagem || details.image || "Imagem de referencia";
  }
  if (event.type === "sequencia_planilha") {
    return `${details.arquivo || "planilha"} -> ${details.coluna || "coluna"}`;
  }
  if (event.type === "escrever_planilha") {
    return `${details.aba || "aba"} -> ${details.coluna || "coluna"} = ${details.valor || ""}`;
  }
  if (event.type === "abrir_url") {
    return details.url || "URL configurada";
  }
  if (event.type === "abrir_programa") {
    return details.caminho || "Executavel configurado";
  }
  return `Atraso ${Number(event.delay || 0).toLocaleString("pt-BR")}s`;
}

function studioControlEventDetails(event = {}) {
  const details = event.details || event.detalhes || {};
  const rows = [
    ["Tipo", typeChipLabel(event.type || "bloco")],
    ["Pagina", sequenceLabel(event.sequence || event.sequencia || "principal")],
    ["Atraso", `${Number(event.delay || 0).toLocaleString("pt-BR")}s`],
  ];
  if (event.type === "texto_livre") {
    rows.push(["Texto", details.texto || details.text || "-"]);
  } else if (event.type === "tecla" || event.type === "atalho") {
    rows.push(["Teclas", details.teclas || details.keys || details.tecla || "-"]);
    rows.push(["Repeticoes", details.repeticoes || details.repeat || "1"]);
  } else if (event.type === "clicar_imagem") {
    rows.push(["Imagem", details.imagem || details.image || "-"]);
    rows.push(["Precisao", `${details.confianca || details.confidence || "80%"}`]);
  } else if (event.type === "sequencia_planilha") {
    rows.push(["Arquivo", details.arquivo || "-"]);
    rows.push(["Aba", details.aba || "-"]);
    rows.push(["Coluna", details.coluna || "-"]);
  } else if (event.type === "escrever_planilha") {
    rows.push(["Arquivo", details.arquivo || "-"]);
    rows.push(["Aba", details.aba || "-"]);
    rows.push(["Coluna", details.coluna || "-"]);
    rows.push(["Valor", details.valor || "-"]);
    rows.push(["Linha", "Linha atual do loop"]);
  } else if (event.type === "abrir_url") {
    rows.push(["URL", details.url || "-"]);
    rows.push(["Navegador", details.navegador || "padrao"]);
    rows.push(["Tela cheia", details.tela_cheia ? "Sim" : "Nao"]);
  } else if (event.type === "abrir_programa") {
    rows.push(["Executavel", details.caminho || "-"]);
    rows.push(["Parametros", details.parametros || "-"]);
  } else if (event.type === "mouse_click") {
    rows.push(["Coordenadas", `${details.x ?? "-"}, ${details.y ?? "-"}`]);
    rows.push(["Botao", details.botao || "left"]);
  }
  return rows;
}

function studioControlThemeClass(sequence) {
  const theme = resolveCommandMapPageTheme(normalizeSequenceName(sequence));
  return `theme-${String(theme || "principal").replace(/[^a-z0-9_-]/gi, "")}`;
}

function renderStudioControlFlowCard(event, index, stateClass) {
  const flipped = Number(state.remoteControl.detailOpenOrder) === Number(event.order);
  const themeClass = studioControlThemeClass(event.sequence || state.remoteControl.currentSequence);
  const isLoop = getSequenceExecutionSettings(event.sequence || state.remoteControl.currentSequence, state.remoteControl.roadmap).executionMode === "loop_planilha";
  return `
    <article class="studio-control-flow-card ${stateClass} ${themeClass} ${isLoop ? "is-loop" : ""} ${flipped ? "is-flipped" : ""}" data-studio-control-order="${Number(event.order)}">
      <div class="studio-control-flow-card-flip">
        <div class="studio-control-flow-card-face studio-control-flow-card-front">
          <span class="studio-control-flow-index">${String(index + 1).padStart(2, "0")}</span>
          <small>${escapeHtml(isLoop ? `Loop | ${typeChipLabel(event.type || "bloco")}` : typeChipLabel(event.type || "bloco"))}</small>
          <div class="studio-control-flow-card-copy">
            <strong>${escapeHtml(studioControlEventTitle(event))}</strong>
            <p>${escapeHtml(studioControlEventSubtitle(event))}</p>
            <em>${Number(event.delay || 0).toLocaleString("pt-BR")}s antes</em>
          </div>
          <button class="studio-control-detail-button" type="button" data-studio-control-action="details" data-id="${Number(event.order)}">Ver detalhes</button>
        </div>
        <div class="studio-control-flow-card-face studio-control-flow-card-back">
          <div class="studio-control-flow-card-back-head">
            <strong>${escapeHtml(studioControlEventTitle(event))}</strong>
            <button class="studio-control-detail-button" type="button" data-studio-control-action="back" data-id="${Number(event.order)}">Voltar</button>
          </div>
          <div class="studio-control-flow-detail-list">
            ${studioControlEventDetails(event).map(([label, value]) => `
              <span>
                <small>${escapeHtml(label)}</small>
                <strong>${escapeHtml(value)}</strong>
              </span>
            `).join("")}
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderStudioControlFlow() {
  const events = studioControlSequenceEvents();
  const hasEvents = events.length > 0;
  if (studioControlPageChips) {
    const pages = studioControlVisiblePages();
    studioControlPageChips.innerHTML = pages.map((page) => `
      <button class="${normalizeSequenceName(state.remoteControl.currentSequence) === page.sequence ? "is-active" : ""}" type="button" data-studio-control-page="${escapeHtml(page.sequence)}">
        <strong>${escapeHtml(page.label)}</strong>
        <span>${escapeHtml(getSequenceExecutionSettings(page.sequence, state.remoteControl.roadmap).executionMode === "loop_planilha" ? "Loop" : "Executar uma vez")}</span>
      </button>
    `).join("");
  }
  if (studioControlFlowList) {
    if (!hasEvents) {
      studioControlFlowList.innerHTML = `<div class="empty-state">Abra uma automacao remota para ver os blocos aqui.</div>`;
    } else {
      const currentIndex = events.findIndex((entry) => Number(entry.order) === Number(state.remoteControl.currentOrder));
      const cards = events.map((event, index) => {
        const isCurrent = Number(event.order) === Number(state.remoteControl.currentOrder);
        const stateClass = isCurrent
          ? "is-current"
          : currentIndex >= 0 && index < currentIndex
            ? "is-done"
            : "is-upcoming";
        const connectorClass = stateClass === "is-done" ? "is-done" : isCurrent ? "is-current" : "";
        return `
          ${renderStudioControlFlowCard(event, index, stateClass)}
          ${index < events.length - 1 ? `<div class="studio-control-flow-connector ${connectorClass}"><span></span></div>` : '<div class="studio-control-flow-end">Fim</div>'}
        `;
      }).join("");
      const activeTheme = studioControlThemeClass(state.remoteControl.currentSequence);
      const activeLoop = getSequenceExecutionSettings(state.remoteControl.currentSequence, state.remoteControl.roadmap).executionMode === "loop_planilha";
      studioControlFlowList.innerHTML = `<div class="studio-control-flow-row ${activeTheme} ${activeLoop ? "is-loop" : ""}">${cards}</div>`;
    }
  }
  if (studioControlPrevBlockButton) {
    studioControlPrevBlockButton.disabled = !hasEvents || events.findIndex((event) => Number(event.order) === Number(state.remoteControl.currentOrder)) <= 0;
  }
  if (studioControlNextBlockButton) {
    const index = events.findIndex((event) => Number(event.order) === Number(state.remoteControl.currentOrder));
    studioControlNextBlockButton.disabled = !hasEvents || index < 0 || index >= events.length - 1;
  }
  const shouldCenter = Number(state.remoteControl.lastCenteredOrder) !== Number(state.remoteControl.currentOrder);
  if (shouldCenter) {
    state.remoteControl.lastCenteredOrder = state.remoteControl.currentOrder;
  }
  requestAnimationFrame(() => {
    if (!shouldCenter) {
      return;
    }
    const selected = studioControlFlowList?.querySelector(".studio-control-flow-card.is-current");
    if (!selected || !studioControlFlowList) {
      return;
    }
    const containerRect = studioControlFlowList.getBoundingClientRect();
    const targetRect = selected.getBoundingClientRect();
    const delta = (targetRect.left + targetRect.width / 2) - (containerRect.left + containerRect.width / 2);
    studioControlFlowList.scrollTo({
      left: Math.max(0, studioControlFlowList.scrollLeft + delta),
      behavior: "auto",
    });
  });
}

function renderStudioControlSpreadsheet() {
  const preview = state.remoteControl.spreadsheetPreview || {};
  const headers = Array.isArray(preview.headers) ? preview.headers : [];
  const rows = Array.isArray(preview.rows) ? preview.rows : [];
  const writeColumns = new Set((Array.isArray(preview.write_columns) ? preview.write_columns : []).map((column) => String(column || "")));
  const available = Boolean(preview.available);

  if (studioControlSheetRefreshButton) {
    studioControlSheetRefreshButton.disabled = !state.remoteControl.connected || state.remoteControl.sheetRefreshing;
    studioControlSheetRefreshButton.textContent = state.remoteControl.sheetRefreshing ? "Atualizando..." : "Atualizar planilha";
  }
  if (studioControlSheetTitle) {
    studioControlSheetTitle.textContent = available ? `${preview.workbook_id || "Planilha"}` : "Aguardando planilha";
  }
  if (studioControlSheetMeta) {
    const sheetName = preview.sheet ? `Aba ${preview.sheet}` : "Nenhuma aba carregada";
    const rowCount = Number(preview.row_count ?? rows.length ?? 0);
    studioControlSheetMeta.textContent = available
      ? `${sheetName} | ${rowCount} linha${rowCount === 1 ? "" : "s"} visivel${rowCount === 1 ? "" : "is"}`
      : (preview.message || "Conecte no Agent para visualizar os dados do projeto.");
  }
  if (studioControlSheetStatus) {
    if (!state.remoteControl.connected) {
      studioControlSheetStatus.textContent = "Conecte no Agent para carregar a planilha remota.";
    } else if (state.remoteControl.sheetRefreshing) {
      studioControlSheetStatus.textContent = "Lendo planilha do Agent...";
    } else if (!available) {
      studioControlSheetStatus.textContent = preview.message || "Nenhuma planilha encontrada no projeto remoto.";
    } else if (preview.limited) {
      studioControlSheetStatus.textContent = "Mostrando uma previa das primeiras linhas para manter a tela leve.";
    } else {
      studioControlSheetStatus.textContent = "Dados atualizados a partir do Agent.";
    }
  }
  if (!studioControlSheetTableWrap) {
    return;
  }
  if (!available || !headers.length) {
    studioControlSheetTableWrap.innerHTML = `
      <div class="empty-state">${escapeHtml(preview.message || "A planilha preenchida pelo Agent vai aparecer aqui.")}</div>
    `;
    return;
  }

  studioControlSheetTableWrap.innerHTML = `
    <table class="studio-control-sheet-table">
      <thead>
        <tr>
          <th>Linha</th>
          ${headers.map((header) => `
            <th class="${writeColumns.has(String(header)) ? "is-write-column" : ""}">${escapeHtml(header)}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const values = Array.isArray(row.values) ? row.values : [];
          return `
            <tr>
              <td class="studio-control-sheet-row-number">${escapeHtml(row.row_number ?? "")}</td>
              ${headers.map((header, index) => `
                <td class="${writeColumns.has(String(header)) ? "is-write-column" : ""}">${escapeHtml(values[index] ?? "")}</td>
              `).join("")}
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function normalizeMeshCentralUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function meshCentralUrlFromAgentAddress(address) {
  const normalized = String(address || "").trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  if (!normalized) {
    return "";
  }
  const host = normalized.includes(":")
    ? normalized.split(":").slice(0, -1).join(":")
    : normalized;
  return host ? `http://${host}:8080` : "";
}

function ensureMeshCentralUrlFromAgent({ force = false } = {}) {
  const derivedUrl = meshCentralUrlFromAgentAddress(state.remoteControl.address);
  if (!derivedUrl) {
    return "";
  }
  if (force || !state.remoteControl.meshUrl) {
    persistMeshCentralUrl(derivedUrl);
  }
  return state.remoteControl.meshUrl || derivedUrl;
}

function currentMeshCentralUrl() {
  return normalizeMeshCentralUrl(
    studioControlMeshUrlInput?.value
    || state.remoteControl.meshUrl
    || ensureMeshCentralUrlFromAgent()
  );
}

function persistMeshCentralUrl(url) {
  state.remoteControl.meshUrl = url;
  try {
    if (url) {
      localStorage.setItem("flowdetect_meshcentral_url", url);
    } else {
      localStorage.removeItem("flowdetect_meshcentral_url");
    }
  } catch (error) {
    console.warn("Nao foi possivel salvar a URL do MeshCentral.", error);
  }
}

function persistMeshCentralPath(path) {
  state.remoteControl.meshPath = String(path || "").trim();
  try {
    if (state.remoteControl.meshPath) {
      localStorage.setItem("flowdetect_meshcentral_agent_path", state.remoteControl.meshPath);
    } else {
      localStorage.removeItem("flowdetect_meshcentral_agent_path");
    }
  } catch (error) {
    console.warn("Nao foi possivel salvar a pasta do MeshCentral.", error);
  }
}

function renderStudioControlScreen() {
  const remote = state.remoteControl;
  if (remote.connected && !remote.meshUrl) {
    ensureMeshCentralUrlFromAgent();
  }
  if (studioControlMeshUrlInput && document.activeElement !== studioControlMeshUrlInput) {
    studioControlMeshUrlInput.value = remote.meshUrl || "";
  }
  if (studioControlMeshPathInput && document.activeElement !== studioControlMeshPathInput) {
    studioControlMeshPathInput.value = remote.meshPath || "";
  }
  if (studioControlMeshFrame && studioControlMeshFrame.getAttribute("src") !== (remote.meshFrameUrl || "about:blank")) {
    studioControlMeshFrame.setAttribute("src", remote.meshFrameUrl || "about:blank");
  }
  if (studioControlScreenImage) {
    if (remote.screenSnapshotUrl && studioControlScreenImage.src !== remote.screenSnapshotUrl) {
      studioControlScreenImage.src = remote.screenSnapshotUrl;
    }
    studioControlScreenImage.hidden = !remote.screenSnapshotUrl;
  }
  const hasRemoteScreen = Boolean(remote.meshFrameUrl || remote.screenSnapshotUrl || remote.webrtcActive);
  studioControlMeshFrame?.classList.toggle("is-active", Boolean(remote.meshFrameUrl) && !remote.screenSnapshotUrl && !remote.webrtcActive);
  studioControlMeshFrame?.closest(".studio-control-screen-frame-wrap")?.classList.toggle("has-screen", hasRemoteScreen);
  if (studioControlScreenStatus) {
    if (remote.screenStreaming) {
      studioControlScreenStatus.textContent = "Recebendo tela do Agent dentro do Studio.";
    } else if (remote.screenSnapshotUrl) {
      studioControlScreenStatus.textContent = "Visualizacao pausada. Clique em Assistir no Studio para continuar.";
    } else if (remote.meshRunning) {
      studioControlScreenStatus.textContent = "MeshCentral rodando no Agent. Use Abrir tela segura para evitar travar o Studio.";
    } else if (remote.meshStarting) {
      studioControlScreenStatus.textContent = "MeshCentral sendo preparado no Agent. Na primeira vez pode levar alguns minutos.";
    } else if (remote.meshFrameUrl) {
      studioControlScreenStatus.textContent = "Tela remota carregada. Se ficar em branco, o MeshCentral bloqueou incorporacao; use Abrir fora.";
    } else if (remote.meshUrl) {
      studioControlScreenStatus.textContent = remote.connected
        ? "URL montada pelo IP do Agent. Clique em Iniciar no Agent e depois Abrir tela segura."
        : "URL salva. Conecte no Agent ou abra a tela segura.";
    } else {
      studioControlScreenStatus.textContent = "Conecte no Agent para o FlowDetect montar a URL do MeshCentral automaticamente.";
    }
  }
  if (studioControlMeshStartButton) {
    studioControlMeshStartButton.disabled = !remote.connected || remote.meshStarting;
    studioControlMeshStartButton.textContent = remote.meshRunning
      ? "Servidor ativo"
      : remote.meshStarting
        ? "Preparando..."
        : "Iniciar no Agent";
  }
  if (studioControlMeshLoadButton) {
    studioControlMeshLoadButton.disabled = !remote.connected;
    studioControlMeshLoadButton.textContent = remote.screenStreaming ? "Pausar visualizacao" : "Assistir no Studio";
  }
  if (studioControlMeshEmbedButton) {
    studioControlMeshEmbedButton.disabled = !remote.meshUrl;
  }
  if (studioControlMeshOpenButton) {
    studioControlMeshOpenButton.disabled = !remote.meshUrl;
  }
  if (studioControlMeshClearButton) {
    studioControlMeshClearButton.disabled = !remote.meshUrl && !remote.meshFrameUrl;
  }
}

function renderStudioControl() {
  const remote = state.remoteControl;
  const selected = studioControlSelectedAutomation();
  const percent = Math.max(0, Math.min(100, Number(remote.progress.percent || 0)));
  studioControlViewButtons.forEach((button) => {
    const active = button.dataset.studioControlView === remote.activeView;
    button.classList.toggle("is-active", active);
  });
  studioControlViewPanels.forEach((panel) => {
    const active = panel.dataset.studioControlPanel === remote.activeView;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  if (studioControlStatus) {
    studioControlStatus.textContent = !remote.connected ? "Desconectado" : remote.running ? "Executando" : "Conectado";
    studioControlStatus.className = `studio-control-status ${remote.connected ? (remote.running ? "is-running" : "is-online") : "is-offline"}`;
  }
  if (studioControlAddressInput && document.activeElement !== studioControlAddressInput) {
    studioControlAddressInput.value = remote.address;
  }
  if (studioControlHint) {
    studioControlHint.textContent = remote.connected
      ? "Agent conectado. Escolha uma automacao remota para executar no outro computador."
      : "Conecte no Agent do outro PC para importar, visualizar e executar automacoes.";
  }
  if (studioControlAgentLabel) {
    studioControlAgentLabel.textContent = remote.agentLabel;
  }
  if (studioControlMeta) {
    studioControlMeta.textContent = `${remote.library.length} automacao${remote.library.length === 1 ? "" : "es"}`;
  }
  if (studioControlStopButton) {
    studioControlStopButton.disabled = !remote.connected || !remote.running;
  }
  if (studioControlImportButton) {
    studioControlImportButton.disabled = !remote.connected;
  }
  if (studioControlRunButton) {
    studioControlRunButton.disabled = !remote.connected || !remote.selectedId || remote.running;
  }
  if (studioControlRefreshButton) {
    studioControlRefreshButton.disabled = !remote.connected;
  }
  if (studioControlEmpty) {
    studioControlEmpty.hidden = remote.connected && remote.library.length > 0;
    studioControlEmpty.textContent = remote.connected
      ? "Nenhuma automacao no Agent conectado. Importe um ZIP para comecar."
      : "Conecte no Agent para carregar as automacoes remotas.";
  }
  if (studioControlList) {
    studioControlList.innerHTML = remote.library.map((item) => {
      const isSelected = String(item.id) === String(remote.selectedId);
      const name = item.nome || item.name || "Automacao sem nome";
      const description = item.descricao || item.description || "Automacao disponivel no Agent conectado.";
      const commands = Number(item.command_count ?? item.commands ?? item.total_blocos ?? 0);
      const sequences = Number(item.sequence_count ?? item.sequences ?? 1);
      return `
        <article class="studio-control-card ${isSelected ? "is-selected" : ""}" data-remote-automation-id="${escapeHtml(item.id)}">
          <div class="studio-control-card-head">
            <span class="studio-control-card-badge">${escapeHtml(item.categoria || item.category || "Remota")}</span>
            ${isSelected ? '<span class="studio-control-card-live">Aberta</span>' : ""}
          </div>
          <h3>${escapeHtml(name)}</h3>
          <p>${escapeHtml(description)}</p>
          <div class="studio-control-card-summary">${escapeHtml(studioControlAutomationSummary(item))}</div>
          <div class="studio-control-card-stats">
            <span><strong>${commands}</strong> comandos</span>
            <span><strong>${sequences || 1}</strong> paginas</span>
          </div>
          <div class="studio-control-card-actions">
            <button class="ghost-button" type="button" data-studio-control-action="select" data-id="${escapeHtml(item.id)}">Abrir</button>
            <button class="primary-button" type="button" data-studio-control-action="run" data-id="${escapeHtml(item.id)}" ${remote.running ? "disabled" : ""}>Executar</button>
          </div>
        </article>
      `;
    }).join("");
  }
  if (studioControlSelectedTitle) {
    studioControlSelectedTitle.textContent = selected?.nome || selected?.name || "Nenhuma automacao selecionada";
  }
  if (studioControlProgressPercent) {
    studioControlProgressPercent.textContent = `${Math.round(percent)}%`;
  }
  if (studioControlProgressFill) {
    studioControlProgressFill.style.width = `${percent}%`;
  }
  if (studioControlProgressText) {
    studioControlProgressText.textContent = remote.progress.description || "A execucao remota vai aparecer aqui.";
  }
  renderStudioControlScreen();
  if (studioControlCompanyText) {
    studioControlCompanyText.textContent = remote.progress.company || "-";
  }
  if (studioControlPageText) {
    studioControlPageText.textContent = sequenceLabel(remote.progress.sequence || "principal");
  }
  if (studioControlBlockText) {
    studioControlBlockText.textContent = studioControlCurrentEvent()?.title || (remote.progress.order ? `Bloco ${remote.progress.order}` : "Aguardando");
  }
  renderStudioControlFlow();
  renderStudioControlSpreadsheet();
  renderStudioControlEditableTexts();
  if (studioControlLogList) {
    studioControlLogList.innerHTML = remote.logs.length
      ? remote.logs.slice(0, 12).map((line) => `<article>${escapeHtml(line)}</article>`).join("")
      : `<article>Logs do Agent aparecem aqui quando a execucao iniciar.</article>`;
  }
}

async function refreshStudioControlLibrary(options = {}) {
  if (!state.remoteControl.connected) {
    renderStudioControl();
    return;
  }
  const result = await invoke("remote_agent_list_automations", { address: state.remoteControl.address });
  state.remoteControl.library = Array.isArray(result?.items) ? result.items : [];
  if (options.preferredId) {
    state.remoteControl.selectedId = String(options.preferredId);
  } else if (!state.remoteControl.selectedId && state.remoteControl.library[0]?.id) {
    state.remoteControl.selectedId = String(state.remoteControl.library[0].id);
  }
  renderStudioControl();
}

function applyStudioControlStatus(payload = {}) {
  const snapshot = payload?.snapshot || {};
  const progress = snapshot.progress || {};
  const automationId = String(snapshot.automation_id || snapshot.automationId || "").trim();
  const incomingLogs = Array.isArray(snapshot.logs)
    ? snapshot.logs.map((line) => String(line || "").trim()).filter(Boolean).reverse()
    : state.remoteControl.logs;
  const statusSignature = JSON.stringify({
    running: Boolean(snapshot.running),
    automationId,
    percent: Number(progress.percent || 0),
    description: String(progress.description || ""),
    company: String(progress.company || ""),
    sequence: normalizeSequenceName(progress.sequence || "principal"),
    order: Number(progress.order || 0),
    logs: incomingLogs.slice(0, 12),
  });
  const statusChanged = statusSignature !== state.remoteControl.lastStatusSignature;
  const wasRunning = state.remoteControl.running;
  state.remoteControl.lastStatusSignature = statusSignature;
  if (automationId) {
    state.remoteControl.selectedId = automationId;
  }
  state.remoteControl.running = Boolean(snapshot.running);
  state.remoteControl.progress = {
    percent: Number(progress.percent || 0),
    description: String(progress.description || (state.remoteControl.running ? "Automacao remota em execucao." : "Agent pronto.")),
    company: String(progress.company || ""),
    sequence: normalizeSequenceName(progress.sequence || "principal"),
    order: Number(progress.order || 0),
  };
  const shouldSyncRemotePosition = state.remoteControl.running || Boolean(snapshot.running);
  if (shouldSyncRemotePosition && progress.sequence) {
    state.remoteControl.currentSequence = normalizeSequenceName(progress.sequence);
  }
  if (shouldSyncRemotePosition && Number(progress.order || 0) > 0) {
    state.remoteControl.currentOrder = Number(progress.order);
    state.remoteControl.lastCenteredOrder = null;
    const current = studioControlCurrentEvent();
    if (current?.sequence || current?.sequencia) {
      state.remoteControl.currentSequence = normalizeSequenceName(current.sequence || current.sequencia);
    }
  }
  state.remoteControl.logs = incomingLogs;
  if (!statusChanged && !state.remoteControl.running && !wasRunning) {
    return;
  }
  renderStudioControl();
}

async function refreshStudioControlStatus(options = {}) {
  if (!state.remoteControl.connected || state.remoteControl.statusRefreshing) {
    return;
  }
  state.remoteControl.statusRefreshing = true;
  try {
    const result = await invoke("remote_agent_status", { address: state.remoteControl.address });
    applyStudioControlStatus(result);
  } catch (error) {
    if (!options.silent) {
      setMessage(String(error), "error");
    }
  } finally {
    state.remoteControl.statusRefreshing = false;
  }
}

async function refreshStudioControlSpreadsheet(options = {}) {
  const { force = false, silent = false } = options;
  if (!state.remoteControl.connected || state.remoteControl.sheetRefreshing) {
    return;
  }
  const now = Date.now();
  if (!force && now - Number(state.remoteControl.lastSheetRefreshAt || 0) < 2200) {
    return;
  }
  state.remoteControl.sheetRefreshing = true;
  renderStudioControlSpreadsheet();
  try {
    const result = await invoke("remote_agent_spreadsheet_preview", {
      address: state.remoteControl.address,
      limit: 80,
    });
    state.remoteControl.spreadsheetPreview = {
      available: Boolean(result?.available),
      message: String(result?.message || ""),
      workbook_id: String(result?.workbook_id || ""),
      sheet: String(result?.sheet || ""),
      headers: Array.isArray(result?.headers) ? result.headers : [],
      rows: Array.isArray(result?.rows) ? result.rows : [],
      row_count: Number(result?.row_count ?? result?.rows?.length ?? 0),
      limited: Boolean(result?.limited),
      write_columns: Array.isArray(result?.write_columns) ? result.write_columns : [],
    };
    state.remoteControl.lastSheetRefreshAt = Date.now();
  } catch (error) {
    const errorText = String(error);
    const friendlyMessage = errorText.includes("Endpoint nao encontrado") || errorText.includes("Endpoint não encontrado")
      ? "O Agent conectado ainda nao tem a visualizacao de planilha. Feche e abra o Agent atualizado."
      : errorText;
    state.remoteControl.spreadsheetPreview = {
      available: false,
      message: friendlyMessage,
      workbook_id: "",
      sheet: "",
      headers: [],
      rows: [],
      write_columns: [],
    };
    if (!silent) {
      setMessage(friendlyMessage, "error");
    }
  } finally {
    state.remoteControl.sheetRefreshing = false;
    renderStudioControlSpreadsheet();
  }
}

function applyStudioControlMeshStatus(result = {}) {
  state.remoteControl.meshRunning = Boolean(result.running);
  state.remoteControl.meshStarting = Boolean(result.starting);
  if (result.url) {
    persistMeshCentralUrl(normalizeMeshCentralUrl(result.url));
  }
  if (state.activeTab === "agent-screen") {
    renderStudioControl();
  }
}

async function refreshStudioControlMeshStatus(options = {}) {
  if (!state.remoteControl.connected) {
    state.remoteControl.meshRunning = false;
    renderStudioControl();
    return;
  }
  try {
    const result = await invoke("remote_agent_meshcentral_status", { address: state.remoteControl.address });
    applyStudioControlMeshStatus(result);
  } catch (error) {
    state.remoteControl.meshRunning = false;
    renderStudioControl();
    if (!options.silent) {
      setMessage(String(error), "error");
    }
  }
}

async function refreshStudioControlScreenSnapshot({ silent = false } = {}) {
  const remote = state.remoteControl;
  if (!remote.connected || remote.screenSnapshotLoading) {
    return;
  }
  remote.screenSnapshotLoading = true;
  try {
    const result = await invoke("remote_agent_screen_snapshot", { address: remote.address });
    const imageData = String(result?.data || "");
    if (!imageData) {
      throw new Error("O Agent nao retornou imagem da tela.");
    }
    const nextUrl = `data:${result?.mime || "image/png"};base64,${imageData}`;
    remote.screenSnapshotUrl = nextUrl;
    remote.screenSnapshotAt = Date.now();
    if (studioControlScreenImage) {
      studioControlScreenImage.src = nextUrl;
      studioControlScreenImage.hidden = false;
      studioControlScreenImage.closest(".studio-control-screen-frame-wrap")?.classList.add("has-screen");
    }
    if (studioControlScreenStatus && remote.screenStreaming) {
      const resolution = result?.resolution ? ` | ${result.resolution}` : "";
      studioControlScreenStatus.textContent = `Recebendo tela do Agent em tempo real${resolution}.`;
    }
  } catch (error) {
    if (!silent) {
      setMessage(String(error), "error");
      if (studioControlScreenStatus) {
        studioControlScreenStatus.textContent = String(error);
      }
    }
  } finally {
    remote.screenSnapshotLoading = false;
  }
}

function waitForIceGatheringComplete(peer, timeoutMs = 2200) {
  if (!peer || peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = window.setTimeout(done, timeoutMs);
    function done() {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }
    function onChange() {
      if (peer.iceGatheringState === "complete") {
        done();
      }
    }
    peer.addEventListener("icegatheringstatechange", onChange);
  });
}

function stopStudioControlWebRtc({ clearRemote = false } = {}) {
  const remote = state.remoteControl;
  if (remote.webrtcAnswerTimer) {
    window.clearInterval(remote.webrtcAnswerTimer);
    remote.webrtcAnswerTimer = null;
  }
  if (remote.webrtcPeer) {
    remote.webrtcPeer.close();
    remote.webrtcPeer = null;
  }
  remote.webrtcControlChannel = null;
  remote.webrtcSessionId = "";
  remote.webrtcActive = false;
  if (studioControlScreenVideo) {
    studioControlScreenVideo.srcObject = null;
    studioControlScreenVideo.hidden = true;
    studioControlScreenVideo.closest(".studio-control-screen-frame-wrap")?.classList.remove("has-webrtc");
  }
  if (clearRemote && remote.connected) {
    invoke("remote_agent_webrtc_clear", { address: remote.address }).catch(() => null);
  }
}

async function startStudioControlWebRtc() {
  const remote = state.remoteControl;
  if (!remote.connected) {
    throw new Error("Conecte no Agent antes de iniciar o WebRTC.");
  }
  if (!window.RTCPeerConnection) {
    throw new Error("WebRTC nao esta disponivel neste WebView.");
  }
  stopStudioControlWebRtc({ clearRemote: true });
  if (remote.screenStreamTimer) {
    window.clearInterval(remote.screenStreamTimer);
    remote.screenStreamTimer = null;
  }
  remote.screenSnapshotUrl = "";
  if (studioControlScreenImage) {
    studioControlScreenImage.removeAttribute("src");
    studioControlScreenImage.hidden = true;
  }
  const peer = new RTCPeerConnection({ iceServers: [] });
  remote.webrtcPeer = peer;
  remote.webrtcControlChannel = peer.createDataChannel("flowdetect-control", { ordered: true });
  peer.addTransceiver("video", { direction: "recvonly" });
  peer.ontrack = (event) => {
    const stream = event.streams?.[0];
    if (stream && studioControlScreenVideo) {
      studioControlScreenVideo.srcObject = stream;
      studioControlScreenVideo.hidden = false;
      studioControlScreenImage.hidden = true;
      studioControlScreenVideo.closest(".studio-control-screen-frame-wrap")?.classList.add("has-screen", "has-webrtc");
      remote.webrtcActive = true;
      if (studioControlScreenStatus) {
        studioControlScreenStatus.textContent = "WebRTC ativo. Recebendo video em tempo real do Agent.";
      }
      renderStudioControl();
    }
  };
  peer.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
      remote.webrtcActive = false;
      renderStudioControl();
    }
  };
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  await waitForIceGatheringComplete(peer);
  const session = await invoke("remote_agent_webrtc_offer", {
    address: remote.address,
    offer: {
      type: peer.localDescription.type,
      sdp: peer.localDescription.sdp,
    },
  });
  remote.webrtcSessionId = String(session?.session_id || "");
  if (!remote.webrtcSessionId) {
    throw new Error("O Agent nao aceitou a sessao WebRTC.");
  }
  if (studioControlScreenStatus) {
    studioControlScreenStatus.textContent = "Solicitando permissao de tela no Agent...";
  }
  let attempts = 0;
  return new Promise((resolve, reject) => {
    remote.webrtcAnswerTimer = window.setInterval(async () => {
      attempts += 1;
      try {
        const answerPayload = await invoke("remote_agent_webrtc_answer", { address: remote.address });
        const answer = answerPayload?.answer || null;
        if (answer && String(answerPayload?.session_id || "") === remote.webrtcSessionId) {
          window.clearInterval(remote.webrtcAnswerTimer);
          remote.webrtcAnswerTimer = null;
          await peer.setRemoteDescription(answer);
          resolve(true);
        } else if (attempts > 60) {
          window.clearInterval(remote.webrtcAnswerTimer);
          remote.webrtcAnswerTimer = null;
          reject(new Error("O Agent nao respondeu ao WebRTC. Vou usar a visualizacao leve."));
        }
      } catch (error) {
        if (attempts > 60) {
          window.clearInterval(remote.webrtcAnswerTimer);
          remote.webrtcAnswerTimer = null;
          reject(error);
        }
      }
    }, 500);
  });
}

function remoteVideoPointFromEvent(event) {
  if (!studioControlScreenVideo || studioControlScreenVideo.hidden) {
    return null;
  }
  const rect = studioControlScreenVideo.getBoundingClientRect();
  const videoWidth = studioControlScreenVideo.videoWidth || 16;
  const videoHeight = studioControlScreenVideo.videoHeight || 9;
  const boxRatio = rect.width / rect.height;
  const videoRatio = videoWidth / videoHeight;
  let contentWidth = rect.width;
  let contentHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;
  if (boxRatio > videoRatio) {
    contentWidth = rect.height * videoRatio;
    offsetX = (rect.width - contentWidth) / 2;
  } else {
    contentHeight = rect.width / videoRatio;
    offsetY = (rect.height - contentHeight) / 2;
  }
  const x = (event.clientX - rect.left - offsetX) / contentWidth;
  const y = (event.clientY - rect.top - offsetY) / contentHeight;
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }
  return { x, y };
}

function sendStudioRemoteControlEvent(payload) {
  const channel = state.remoteControl.webrtcControlChannel;
  if (!channel || channel.readyState !== "open") {
    return;
  }
  channel.send(JSON.stringify(payload));
}

function stopStudioControlScreenStream({ clear = false } = {}) {
  const remote = state.remoteControl;
  remote.screenStreaming = false;
  if (remote.screenStreamTimer) {
    window.clearInterval(remote.screenStreamTimer);
    remote.screenStreamTimer = null;
  }
  if (clear) {
    stopStudioControlWebRtc({ clearRemote: true });
    remote.screenSnapshotUrl = "";
    remote.screenSnapshotAt = 0;
    if (studioControlScreenImage) {
      studioControlScreenImage.removeAttribute("src");
      studioControlScreenImage.hidden = true;
    }
  }
  renderStudioControl();
}

function startStudioControlScreenStream() {
  const remote = state.remoteControl;
  if (!remote.connected) {
    setMessage("Conecte no Agent antes de assistir a tela.", "error");
    return;
  }
  if (remote.screenStreaming) {
    stopStudioControlScreenStream();
    stopStudioControlWebRtc({ clearRemote: true });
    setMessage("Visualizacao da tela do Agent pausada.", "success");
    return;
  }
  remote.screenStreaming = true;
  remote.meshFrameUrl = "";
  if (studioControlMeshFrame) {
    studioControlMeshFrame.setAttribute("src", "about:blank");
  }
  renderStudioControl();
  startStudioControlWebRtc()
    .then(() => {
      setMessage("WebRTC iniciado dentro do Studio.", "success");
    })
    .catch((error) => {
      stopStudioControlWebRtc({ clearRemote: true });
      if (studioControlScreenStatus) {
        studioControlScreenStatus.textContent = `${String(error)} Usando visualizacao leve.`;
      }
      refreshStudioControlScreenSnapshot({ silent: false }).catch(() => null);
      remote.screenStreamTimer = window.setInterval(() => {
        refreshStudioControlScreenSnapshot({ silent: true }).catch(() => null);
      }, 280);
      setMessage("WebRTC nao iniciou; usando visualizacao leve por snapshots.", "error");
    });
}

function startStudioControlPolling() {
  if (state.remoteControl.pollTimer) {
    window.clearInterval(state.remoteControl.pollTimer);
  }
  state.remoteControl.pollTimer = window.setInterval(() => {
    refreshStudioControlStatus({ silent: true }).catch(() => null);
    if (state.activeTab === "agent-screen") {
      refreshStudioControlMeshStatus({ silent: true }).catch(() => null);
    }
    if (state.remoteControl.running || state.remoteControl.activeView === "spreadsheet") {
      refreshStudioControlSpreadsheet({ silent: true }).catch(() => null);
    }
  }, 1800);
}

async function connectStudioControl() {
  const address = String(studioControlAddressInput?.value || "").trim() || "127.0.0.1:18452";
  state.remoteControl.address = address;
  const ping = await invoke("remote_agent_ping", { address });
  state.remoteControl.connected = true;
  state.remoteControl.agentLabel = `${ping?.agent || "FlowDetect Agent"} | ${ping?.address || address}`;
  ensureMeshCentralUrlFromAgent({ force: true });
  setMessage(`Controle remoto conectado em ${address}.`, "success");
  startStudioControlPolling();
  renderStudioControl();
  refreshStudioControlLibrary({ silent: true }).catch(() => null);
  refreshStudioControlStatus({ silent: true }).catch(() => null);
}

async function openStudioControlAutomation(id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return;
  }
  const roadmap = await invoke("remote_agent_open_automation", {
    address: state.remoteControl.address,
    id: normalizedId,
  });
  state.remoteControl.selectedId = normalizedId;
  state.remoteControl.roadmap = roadmap;
  state.remoteControl.currentSequence = normalizeSequenceName(roadmap?.initial_sequence || roadmap?.sequencia_inicial || "principal");
  state.remoteControl.currentOrder = studioControlFirstOrder(state.remoteControl.currentSequence) ?? roadmap?.events?.[0]?.order ?? null;
  state.remoteControl.detailOpenOrder = null;
  state.remoteControl.lastCenteredOrder = null;
  state.remoteControl.editableTextOverrides = {};
  await refreshStudioControlStatus({ silent: true });
  await refreshStudioControlSpreadsheet({ force: true, silent: true });
  renderStudioControl();
}

async function runStudioControlAutomation(id = "") {
  const normalizedId = String(id || state.remoteControl.selectedId || "").trim();
  if (!normalizedId) {
    throw new Error("Escolha uma automacao remota antes de executar.");
  }
  if (!state.remoteControl.connected) {
    throw new Error("Conecte no Agent antes de executar.");
  }
  if (!state.remoteControl.roadmap || String(state.remoteControl.selectedId) !== normalizedId) {
    await openStudioControlAutomation(normalizedId);
  }
  const result = await invoke("remote_agent_execute", {
    address: state.remoteControl.address,
    id: normalizedId,
    delay: Number(testDelayInput?.value || 3),
    loopStart: Math.max(1, Math.trunc(parseNumber(studioControlLoopStartInput?.value || testLoopStartInput?.value, 1))),
    startCompany: String(studioControlCompanyStartInput?.value || "").trim(),
    minimizeAgent: String(studioControlAgentWindowMode?.value || "minimize") === "minimize",
    textOverrides: studioControlEditableTextOverridesJson(),
  });
  applyStudioControlStatus(result);
  refreshStudioControlSpreadsheet({ force: true, silent: true }).catch(() => null);
  setMessage("Execucao remota iniciada no Agent.", "success");
}

async function stopStudioControlAutomation() {
  const result = await invoke("remote_agent_stop", { address: state.remoteControl.address });
  applyStudioControlStatus(result);
  setMessage("Parada enviada ao Agent.", "info");
}

async function importStudioControlZip(file) {
  if (!file) {
    return;
  }
  if (!state.remoteControl.connected) {
    throw new Error("Conecte no Agent antes de importar o ZIP.");
  }
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  const result = await invoke("remote_agent_import_automation_zip", {
    address: state.remoteControl.address,
    fileName: file.name,
    bytes,
  });
  const importedId = String(result?.imported_id || result?.importedId || result?.active_automation?.id || "").trim();
  await refreshStudioControlLibrary({ preferredId: importedId });
  await refreshStudioControlStatus({ silent: true });
  await refreshStudioControlSpreadsheet({ force: true, silent: true });
  setMessage(`ZIP enviado ao Agent: ${file.name}`, "success");
}

async function refreshAutomationLibrary(feedbackMessage = "") {
  const result = await invoke("list_saved_automations");
  state.library.items = result.items || [];
  state.library.activeId = result.active_id || "";
  state.library.categories = result.categories || [];
  if (!state.library.items.some((item) => String(item.id) === String(state.library.editingId || ""))) {
    state.library.editingId = "";
    state.library.editDraft = {
      nome: "",
      categoria: "",
      descricao: "",
    };
  }
  const activeItem = state.library.items.find((item) => String(item.id) === String(state.library.activeId));
  if (activeItem?.nome) {
    exportNameInput.value = activeItem.nome;
  }
  renderLauncherLibrary();
  if (feedbackMessage) {
    setMessage(feedbackMessage, "success");
  }
}

function renderOpenUrlFields(fieldAttr, details = {}, currentOrder = null) {
  const browser = String(details.navegador ?? "padrao");
  const openMode = String(details.modo_abertura ?? "nova_janela");
  const fullscreen = Boolean(details.tela_cheia ?? false);
  return `
    <div class="field-stack">
      <label>
        <span>URL para abrir</span>
        <input ${fieldAttr}="openUrl" type="text" value="${escapeHtml(details.url ?? "")}" placeholder="https://sistema.com.br" />
      </label>
      <div class="tree-inline-fields">
        <label>
          <span>Navegador</span>
          <select ${fieldAttr}="openBrowser">
            <option value="padrao" ${browser === "padrao" ? "selected" : ""}>Padrao</option>
            <option value="chrome" ${browser === "chrome" ? "selected" : ""}>Chrome</option>
            <option value="edge" ${browser === "edge" ? "selected" : ""}>Edge</option>
          </select>
        </label>
        <label>
          <span>Abrir em</span>
          <select ${fieldAttr}="openMode">
            <option value="nova_janela" ${openMode !== "nova_aba" ? "selected" : ""}>Nova janela</option>
            <option value="nova_aba" ${openMode === "nova_aba" ? "selected" : ""}>Nova aba</option>
          </select>
        </label>
        <label>
          <span>Aguardar apos abrir (s)</span>
          <input ${fieldAttr}="openWait" type="number" min="0" step="0.5" value="${escapeHtml(details.aguardar_segundos ?? 3)}" />
        </label>
      </div>
      <label class="runtime-edit-switch-row open-url-fullscreen-switch">
        <span>Tela cheia</span>
        <span class="runtime-edit-switch">
          <input ${fieldAttr}="openFullscreen" type="checkbox" ${fullscreen ? "checked" : ""} />
          <i></i>
        </span>
      </label>
      <div class="tree-inline-fields">
        ${renderSuccessFlowFields(fieldAttr, details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", details.sequencia_sucesso ?? "", details.atraso_antes_sequencia_sucesso ?? 0, currentOrder)}
      </div>
    </div>
  `;
}

function renderOpenProgramFields(fieldAttr, details = {}, currentOrder = null) {
  return `
    <div class="field-stack">
      <label>
        <span>Caminho do executavel</span>
        <input ${fieldAttr}="programPath" type="text" value="${escapeHtml(details.caminho ?? "")}" placeholder="C:\\Program Files\\App\\app.exe" />
      </label>
      <label>
        <span>Parametros opcionais</span>
        <input ${fieldAttr}="programParams" type="text" value="${escapeHtml(details.parametros ?? "")}" placeholder="--new-window https://site.com.br" />
      </label>
      <div class="tree-inline-fields">
        <label>
          <span>Aguardar apos abrir (s)</span>
          <input ${fieldAttr}="programWait" type="number" min="0" step="0.5" value="${escapeHtml(details.aguardar_segundos ?? 2)}" />
        </label>
        ${renderSuccessFlowFields(fieldAttr, details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", details.sequencia_sucesso ?? "", details.atraso_antes_sequencia_sucesso ?? 0, currentOrder)}
      </div>
    </div>
  `;
}

function renderWriteSpreadsheetFields(fieldAttr, details = {}, currentOrder = null) {
  const workbooks = availableWorkbooks();
  const requestedWorkbookId = details.arquivo || details.workbook || "";
  const workbookId = resolveWorkbookId(requestedWorkbookId);
  const workbookOptions = workbooks.length
    ? workbooks
      .map((workbook) => `<option value="${escapeHtml(workbook.id)}" ${workbook.id === workbookId ? "selected" : ""}>${escapeHtml(workbook.file_name)}</option>`)
      .join("")
    : `<option value="">Nenhuma planilha</option>`;
  const availableSheets = workbookSheetsFor(workbookId);
  const currentSheet = details.aba || details.sheet || "";
  const selectedSheet = availableSheets.some((sheet) => sheet.name === currentSheet)
    ? currentSheet
    : availableSheets[0]?.name ?? "";
  const sheetOptions = availableSheets
    .map((sheet) => `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`)
    .join("");
  const columns = columnsForSheetInWorkbook(workbookId, selectedSheet);
  const selectedColumn = details.coluna || details.column || columns[0] || "";
  const suggestionId = `spreadsheetWriteColumns-${String(currentOrder ?? "new").replace(/[^a-z0-9_-]/gi, "")}`;
  const columnSuggestions = columns
    .map((column) => `<option value="${escapeHtml(column)}"></option>`)
    .join("");

  return `
    <div class="field-stack spreadsheet-write-editor">
      <div class="tree-inline-fields">
        <label>
          <span>Arquivo</span>
          <select ${fieldAttr}="workbook">${workbookOptions}</select>
        </label>
        <label>
          <span>Aba</span>
          <select ${fieldAttr}="sheet">${sheetOptions}</select>
        </label>
        <label>
          <span>Coluna</span>
          <input ${fieldAttr}="column" type="text" list="${escapeHtml(suggestionId)}" value="${escapeHtml(selectedColumn)}" placeholder="Status" />
          <datalist id="${escapeHtml(suggestionId)}">${columnSuggestions}</datalist>
        </label>
        <label>
          <span>Escrever</span>
          <input ${fieldAttr}="writeValue" type="text" value="${escapeHtml(details.valor ?? details.value ?? "OK")}" placeholder="OK, X, Concluido..." />
        </label>
      </div>
      <p class="spreadsheet-write-hint">No loop atual: escreve na mesma linha que esta rodando.</p>
      <div class="tree-inline-fields">
        ${renderSuccessFlowFields(fieldAttr, details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", details.sequencia_sucesso ?? "", details.atraso_antes_sequencia_sucesso ?? 0, currentOrder)}
      </div>
    </div>
  `;
}

function renderEditorFields(event) {
  const details = event.details ?? {};
  const delayField = `
    <label>
      <span>Tempo antes do bloco</span>
      <input data-field="delay" type="number" min="0" step="0.1" value="${escapeHtml(event.delay)}" />
    </label>
  `;

  if (isLoopMarkerType(event.type)) {
    const title = event.type === "inicio_loop" ? "Inicio do loop" : "Fim do loop";
    const copy = event.type === "inicio_loop"
      ? "Esse marcador define onde a repeticao por linha da planilha comeca."
      : "Esse marcador fecha o trecho que sera repetido para cada linha da planilha.";
    return `
      <div class="field-stack loop-marker-note">
        <p class="muted-copy"><strong>${title}.</strong> ${copy}</p>
        ${event.type === "fim_loop" ? `
          <div class="tree-inline-fields">
            ${renderSuccessFlowFields("data-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", details.sequencia_sucesso ?? "", details.atraso_antes_sequencia_sucesso ?? 0, event.order)}
          </div>
        ` : ""}
      </div>
    `;
  }

  if (event.type === "texto_livre") {
    const editableAtRun = Boolean(details.editavel_execucao);
    return `
      <div class="field-stack">
        <label>
          <span>Texto que sera digitado</span>
          <textarea data-field="text" rows="5">${escapeHtml(event.text)}</textarea>
        </label>
        <label class="runtime-edit-switch-row">
          <span>Bloco editavel</span>
          <span class="runtime-edit-switch">
            <input data-field="editableAtRun" type="checkbox" ${editableAtRun ? "checked" : ""} />
            <i></i>
          </span>
        </label>
        <label class="runtime-edit-name">
          <span>Nome do bloco</span>
          <input data-field="runtimeLabel" type="text" value="${escapeHtml(details.rotulo_execucao ?? "")}" placeholder="Ex.: Competencia, Mensagem, Observacao" />
        </label>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "tecla" || event.type === "atalho") {
    const repeatCount = Math.max(1, Number(event.details?.repeticoes ?? 1));
    return `
      <div class="field-stack">
        <label>
          <span>Tecla ou atalho</span>
          <div class="capture-inline">
            <input data-field="keys" type="text" value="${escapeHtml(event.keys.join("+"))}" />
            <button class="tree-open-button record-key-button" data-action="record-key">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Repetir quantas vezes</span>
          <input data-field="repeat" type="number" min="1" step="1" value="${escapeHtml(repeatCount)}" />
        </label>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "mouse_click") {
    const clicks = Number(details.clicks ?? details.cliques ?? 1);
    return `
      <div class="field-stack">
        <div class="triple-grid">
          <label>
            <span>X</span>
            <input data-field="x" type="number" step="1" value="${escapeHtml(details.x ?? 0)}" />
          </label>
          <label>
            <span>Y</span>
            <input data-field="y" type="number" step="1" value="${escapeHtml(details.y ?? 0)}" />
          </label>
          <label>
            <span>Botao</span>
            <select data-field="button">
              <option value="left" ${details.botao === "left" ? "selected" : ""}>Esquerdo</option>
              <option value="right" ${details.botao === "right" ? "selected" : ""}>Direito</option>
              <option value="middle" ${details.botao === "middle" ? "selected" : ""}>Meio</option>
            </select>
          </label>
          <label>
            <span>Cliques</span>
            <select data-field="clicks">
              <option value="1" ${clicks === 1 ? "selected" : ""}>1 clique</option>
              <option value="2" ${clicks === 2 ? "selected" : ""}>2 cliques</option>
            </select>
          </label>
        </div>
        <button class="tree-open-button capture-mouse-inline-button" data-action="record-mouse" type="button">Capturar mouse</button>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "clicar_imagem") {
    return `
      <div class="field-stack">
        <label>
          <span>Referencia visual</span>
          <div class="capture-inline">
            <input data-field="imagePath" type="text" value="${escapeHtml(details.imagem ?? "")}" placeholder="imagens/botao_salvar.png, painel_erro.png..." />
            <button class="tree-open-button" data-action="capture-image" type="button">Capturar nova imagem</button>
            <button class="tree-open-button" data-action="select-image" type="button">Selecionar referencia</button>
          </div>
        </label>
        <button class="tree-open-button" data-action="test-image-recognition" type="button">Testar imagem</button>
        <div class="triple-grid">
          <label>
            <span>Timeout</span>
            <input data-field="timeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 10)}" />
          </label>
          <label>
            <span>Confianca</span>
            <input data-field="confidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.8)}" />
          </label>
          <label>
            <span>Perfil de busca</span>
            <select data-field="searchProfile">
              <option value="fast" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "fast" ? "selected" : ""}>Rapido</option>
              <option value="balanced" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "balanced" ? "selected" : ""}>Equilibrado</option>
              <option value="precise" ${normalizeRecognitionProfile(details.perfil_busca, "balanced") === "precise" ? "selected" : ""}>Preciso</option>
            </select>
          </label>
          <label>
            <span>Janela deste bloco</span>
            <select data-field="windowTitle">
              ${recognitionWindowOptionsMarkup(details.janela_alvo ?? "", "Sem janela fixa neste bloco")}
            </select>
          </label>
          <label>
            <span>Texto OCR obrigatorio</span>
            <input data-field="expectedOcrText" type="text" value="${escapeHtml(details.texto_ocr_esperado ?? "")}" placeholder="Ex: 06/2025" />
          </label>
          <button class="tree-open-button recognition-window-refresh" data-action="refresh-recognition-windows" type="button">Atualizar janelas</button>
          <label>
            <span>Ao reconhecer</span>
            <select data-field="clickOnFind">
              <option value="single" ${recognitionClickModeFromDetails(details) === "single" ? "selected" : ""}>1 clique</option>
              <option value="double" ${recognitionClickModeFromDetails(details) === "double" ? "selected" : ""}>2 cliques</option>
              <option value="identify" ${recognitionClickModeFromDetails(details) === "identify" ? "selected" : ""}>Somente identificar</option>
            </select>
          </label>
          <label>
            <span>Se nao encontrar</span>
            <select data-field="failureAction">
              <option value="parar" ${String(details.ao_nao_encontrar ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(details.ao_nao_encontrar ?? "") === "continuar" || String(details.ao_nao_encontrar ?? "") === "pular" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(details.ao_nao_encontrar ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_sequencia" ${String(details.ao_nao_encontrar ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para pagina</option>
              <option value="ir_para_bloco" ${String(details.ao_nao_encontrar ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          <label>
            <span>Ir para esta pagina</span>
            <select data-field="failureSequence">
              ${renderSequenceSuggestionsOptions(details.sequencia_nao_encontrar ?? "pagina_2", "Escolha uma pagina")}
            </select>
          </label>
          <label>
            <span>Ir para este bloco</span>
            <select data-field="failureBlock">
              ${blockTargetOptions(details.bloco_nao_encontrar ?? "", event.order)}
            </select>
          </label>
          <label>
            <span>Tentativas</span>
            <input data-field="retryCount" type="number" min="1" step="1" value="${escapeHtml(details.quantidade_tentativas ?? 1)}" />
          </label>
          <label>
            <span>Intervalo entre tentativas</span>
            <input data-field="retryInterval" type="number" min="0" step="0.5" value="${escapeHtml(details.intervalo_tentativas ?? 1)}" />
          </label>
        </div>
        ${delayField}
      </div>
    `;
  }

  if (event.type === "chrome_elemento_html") {
    return renderChromeBlockFields(event, "card", event.order);
  }

  if (event.type === "abrir_url") {
    return `
      ${renderOpenUrlFields("data-field", details, event.order)}
      ${delayField}
    `;
  }

  if (event.type === "abrir_programa") {
    return `
      ${renderOpenProgramFields("data-field", details, event.order)}
      ${delayField}
    `;
  }

  if (event.type === "escrever_planilha") {
    return `
      ${renderWriteSpreadsheetFields("data-field", details, event.order)}
      ${delayField}
    `;
  }

  if (event.type === "verificar_estado_botao") {
    const activeAction = details.se_ativo?.acao ?? "continuar";
    const inactiveAction = details.se_desativado?.acao ?? "ir_para_sequencia";
    const missingAction = details.se_nao_encontrar?.acao ?? "parar";
    return `
      <div class="field-stack">
        <label>
          <span>Nome do bloco</span>
          <input data-field="verifyName" type="text" value="${escapeHtml(details.nome ?? "Verificar botao")}" />
        </label>
        <label>
          <span>Referencia ativa</span>
          <div class="capture-inline">
            <input data-field="verifyActiveImage" type="text" value="${escapeHtml(details.imagem_ativo ?? "")}" />
            <button class="tree-open-button" data-action="select-verify-active-image" type="button">Selecionar ativa</button>
          </div>
        </label>
        <label>
          <span>Referencia desativada</span>
          <div class="capture-inline">
            <input data-field="verifyInactiveImage" type="text" value="${escapeHtml(details.imagem_desativado ?? "")}" />
            <button class="tree-open-button" data-action="select-verify-inactive-image" type="button">Selecionar desativada</button>
          </div>
        </label>
        <div class="double-grid">
          <label>
            <span>Timeout</span>
            <input data-field="verifyTimeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 5)}" />
          </label>
          <label>
            <span>Confianca</span>
            <input data-field="verifyConfidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.85)}" />
          </label>
        </div>
        <div class="tree-inline-fields">
          <label><span>Se ativo</span><select data-field="verifyActiveAction"><option value="continuar" ${activeAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${activeAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="ir_para_sequencia" ${activeAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="parar" ${activeAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se ativo</span><input data-field="verifyActiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_ativo?.sequencia ?? "")}" /></label>
          <label><span>Se desativado</span><select data-field="verifyInactiveAction"><option value="ir_para_sequencia" ${inactiveAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${inactiveAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${inactiveAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="parar" ${inactiveAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se desativado</span><input data-field="verifyInactiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_desativado?.sequencia ?? "")}" /></label>
          <label><span>Se nao encontrar</span><select data-field="verifyMissingAction"><option value="parar" ${missingAction === "parar" ? "selected" : ""}>Parar</option><option value="ir_para_sequencia" ${missingAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${missingAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${missingAction === "pular_card" ? "selected" : ""}>Pular card</option></select></label>
          <label><span>Sequencia se nao encontrar</span><input data-field="verifyMissingSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_nao_encontrar?.sequencia ?? "")}" /></label>
        </div>
        ${delayField}
      </div>
    `;
  }

  const workbookId = resolveWorkbookId(details.arquivo || details.workbook || "");
  const workbookOptions = availableWorkbooks()
    .map(
      (workbook) =>
        `<option value="${escapeHtml(workbook.id)}" ${workbook.id === workbookId ? "selected" : ""}>${escapeHtml(workbook.file_name)}</option>`
    )
    .join("");
  const availableSheets = workbookSheetsFor(workbookId);
  const selectedSheet = availableSheets.some((sheet) => sheet.name === details.aba)
    ? details.aba
    : availableSheets[0]?.name ?? "";
  const sheetOptions = availableSheets
    .map(
      (sheet) =>
        `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`
    )
    .join("");
  const availableColumns = columnsForSheetInWorkbook(workbookId, selectedSheet);
  const selectedColumn = availableColumns.includes(details.coluna) ? details.coluna : availableColumns[0] ?? "";
  const columnOptions = availableColumns
    .map(
      (column) =>
        `<option value="${escapeHtml(column)}" ${column === selectedColumn ? "selected" : ""}>${escapeHtml(column)}</option>`
    )
    .join("");

  return `
    <div class="field-stack">
      <div class="double-grid">
        <label>
          <span>Arquivo</span>
          <select data-field="workbook">${workbookOptions}</select>
        </label>
        <label>
          <span>Aba</span>
          <select data-field="sheet">${sheetOptions}</select>
        </label>
        <label>
          <span>Coluna</span>
          <select data-field="column">${columnOptions}</select>
        </label>
      </div>
      <div class="double-grid">
        <label>
          <span>Acao apos item</span>
          <div class="capture-inline">
            <input data-field="afterAction" type="text" value="${escapeHtml(details.acao_apos_item_texto ?? "nenhuma")}" />
            <button class="tree-open-button record-key-button" data-action="record-after-action" type="button">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Intervalo entre itens</span>
          <input data-field="intervalBetween" type="number" min="0" step="0.1" value="${escapeHtml(details.intervalo_entre_itens ?? 0.5)}" />
        </label>
      </div>
      ${delayField}
    </div>
  `;
}

function renderTreeEditorFields(event) {
  const details = event.details ?? {};
  if (isLoopMarkerType(event.type)) {
    const copy = event.type === "inicio_loop"
      ? "A automacao entra no trecho repetido logo apos este bloco."
      : "A automacao encerra o trecho repetido imediatamente antes deste bloco.";
    return `
      <div class="field-stack loop-marker-note">
        <p class="muted-copy">${copy}</p>
        ${event.type === "fim_loop" ? `
          <div class="tree-inline-fields">
            ${renderSuccessFlowFields("data-tree-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", details.sequencia_sucesso ?? "", details.atraso_antes_sequencia_sucesso ?? 0, event.order)}
          </div>
        ` : ""}
      </div>
    `;
  }

  if (event.type === "texto_livre") {
    const editableAtRun = Boolean(event.details?.editavel_execucao);
    return `
      <div class="field-stack">
        <label>
          <span>Texto do bloco</span>
          <textarea data-tree-field="text" rows="3">${escapeHtml(event.text)}</textarea>
        </label>
        <label class="runtime-edit-name">
          <span>Nome do bloco</span>
          <input data-tree-field="runtimeLabel" type="text" value="${escapeHtml(event.details?.rotulo_execucao ?? "")}" placeholder="Ex.: Competencia" />
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-tree-field", event.details?.ao_sucesso ?? "continuar", event.details?.bloco_sucesso ?? "", event.details?.sequencia_sucesso ?? "", event.details?.atraso_antes_sequencia_sucesso ?? 0, event.order)}
        </div>
      </div>
    `;
  }

  if (event.type === "tecla" || event.type === "atalho") {
    const repeatCount = Math.max(1, Number(event.details?.repeticoes ?? 1));
    return `
      <div class="field-stack">
        <label>
          <span>Tecla ou atalho</span>
          <input data-tree-field="keys" type="text" value="${escapeHtml(event.keys.join("+"))}" />
        </label>
        <label>
          <span>Repetir quantas vezes</span>
          <input data-tree-field="repeat" type="number" min="1" step="1" value="${escapeHtml(repeatCount)}" />
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-tree-field", event.details?.ao_sucesso ?? "continuar", event.details?.bloco_sucesso ?? "", event.details?.sequencia_sucesso ?? "", event.details?.atraso_antes_sequencia_sucesso ?? 0, event.order)}
        </div>
      </div>
    `;
  }

  if (event.type === "mouse_click") {
    const clicks = Number(details.clicks ?? details.cliques ?? 1);
    return `
      <div class="field-stack">
        <div class="tree-inline-fields-wide">
          <label>
            <span>X</span>
            <input data-tree-field="x" type="number" step="1" value="${escapeHtml(details.x ?? 0)}" />
          </label>
          <label>
            <span>Y</span>
            <input data-tree-field="y" type="number" step="1" value="${escapeHtml(details.y ?? 0)}" />
          </label>
          <label>
            <span>Botao</span>
            <select data-tree-field="button">
              <option value="left" ${details.botao === "left" ? "selected" : ""}>Esquerdo</option>
              <option value="right" ${details.botao === "right" ? "selected" : ""}>Direito</option>
              <option value="middle" ${details.botao === "middle" ? "selected" : ""}>Meio</option>
            </select>
          </label>
          <label>
            <span>Cliques</span>
            <select data-tree-field="clicks">
              <option value="1" ${clicks === 1 ? "selected" : ""}>1 clique</option>
              <option value="2" ${clicks === 2 ? "selected" : ""}>2 cliques</option>
            </select>
          </label>
        </div>
        <button class="tree-open-button capture-mouse-inline-button" data-tree-action="record-mouse" type="button">Capturar mouse</button>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-tree-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", details.sequencia_sucesso ?? "", details.atraso_antes_sequencia_sucesso ?? 0, event.order)}
        </div>
      </div>
    `;
  }

  if (event.type === "clicar_imagem") {
    return renderRecognitionExpandedTreeEditor(event);
  }

  if (event.type === "chrome_elemento_html") {
    return renderChromeBlockFields(event, "tree", event.order);
  }

  if (event.type === "abrir_url") {
    return renderOpenUrlFields("data-tree-field", details, event.order);
  }

  if (event.type === "abrir_programa") {
    return renderOpenProgramFields("data-tree-field", details, event.order);
  }

  if (event.type === "escrever_planilha") {
    return renderWriteSpreadsheetFields("data-tree-field", details, event.order);
  }

  if (event.type === "verificar_estado_botao") {
    const activeAction = details.se_ativo?.acao ?? "continuar";
    const inactiveAction = details.se_desativado?.acao ?? "ir_para_sequencia";
    const missingAction = details.se_nao_encontrar?.acao ?? "parar";
    return `
      <div class="field-stack">
        <label>
          <span>Nome do bloco</span>
          <input data-tree-field="verifyName" type="text" value="${escapeHtml(details.nome ?? "Verificar botao")}" />
        </label>
        <label>
          <span>Referencia ativa</span>
          <div class="capture-inline">
            <input data-tree-field="verifyActiveImage" type="text" value="${escapeHtml(details.imagem_ativo ?? "")}" />
            <button class="tree-open-button" data-tree-action="select-verify-active-image" type="button">Selecionar ativa</button>
          </div>
        </label>
        <label>
          <span>Referencia desativada</span>
          <div class="capture-inline">
            <input data-tree-field="verifyInactiveImage" type="text" value="${escapeHtml(details.imagem_desativado ?? "")}" />
            <button class="tree-open-button" data-tree-action="select-verify-inactive-image" type="button">Selecionar desativada</button>
          </div>
        </label>
        <div class="tree-inline-fields">
          <label><span>Timeout</span><input data-tree-field="verifyTimeout" type="number" min="0.1" step="0.5" value="${escapeHtml(details.timeout ?? 5)}" /></label>
          <label><span>Confianca</span><input data-tree-field="verifyConfidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(details.confianca ?? 0.85)}" /></label>
          <label><span>Se ativo</span><select data-tree-field="verifyActiveAction"><option value="continuar" ${activeAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${activeAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="ir_para_sequencia" ${activeAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="parar" ${activeAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se ativo</span><input data-tree-field="verifyActiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_ativo?.sequencia ?? "")}" /></label>
          <label><span>Se desativado</span><select data-tree-field="verifyInactiveAction"><option value="ir_para_sequencia" ${inactiveAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${inactiveAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${inactiveAction === "pular_card" ? "selected" : ""}>Pular card</option><option value="parar" ${inactiveAction === "parar" ? "selected" : ""}>Parar</option></select></label>
          <label><span>Sequencia se desativado</span><input data-tree-field="verifyInactiveSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_desativado?.sequencia ?? "")}" /></label>
          <label><span>Se nao encontrar</span><select data-tree-field="verifyMissingAction"><option value="parar" ${missingAction === "parar" ? "selected" : ""}>Parar</option><option value="ir_para_sequencia" ${missingAction === "ir_para_sequencia" ? "selected" : ""}>Ir para sequencia</option><option value="continuar" ${missingAction === "continuar" ? "selected" : ""}>Continuar</option><option value="pular_card" ${missingAction === "pular_card" ? "selected" : ""}>Pular card</option></select></label>
          <label><span>Sequencia se nao encontrar</span><input data-tree-field="verifyMissingSequence" type="text" list="sequenceSuggestions" value="${escapeHtml(details.se_nao_encontrar?.sequencia ?? "")}" /></label>
        </div>
      </div>
    `;
  }

  const workbookId = resolveWorkbookId(details.arquivo || details.workbook || "");
  const workbookOptions = availableWorkbooks()
    .map(
      (workbook) =>
        `<option value="${escapeHtml(workbook.id)}" ${workbook.id === workbookId ? "selected" : ""}>${escapeHtml(workbook.file_name)}</option>`
    )
    .join("");
  const availableSheets = workbookSheetsFor(workbookId);
  const selectedSheet = availableSheets.some((sheet) => sheet.name === details.aba)
    ? details.aba
    : availableSheets[0]?.name ?? "";
  const sheetOptions = availableSheets
    .map(
      (sheet) =>
        `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`
    )
    .join("");
  const availableColumns = columnsForSheetInWorkbook(workbookId, selectedSheet);
  const selectedColumn = availableColumns.includes(details.coluna) ? details.coluna : availableColumns[0] ?? "";
  const columnOptions = availableColumns
    .map(
      (column) =>
        `<option value="${escapeHtml(column)}" ${column === selectedColumn ? "selected" : ""}>${escapeHtml(column)}</option>`
    )
    .join("");
  const activeSpreadsheetTab = normalizeSpreadsheetTreeTab(state.spreadsheetTreeTabs?.[event.order] ?? "planilha");

  return `
    <div class="field-stack spreadsheet-card-editor">
      <div class="recognition-card-tabs spreadsheet-card-tabs" role="tablist" aria-label="Configuracoes do bloco de planilha">
        <button
          class="recognition-card-tab ${activeSpreadsheetTab === "planilha" ? "is-active" : ""}"
          data-spreadsheet-tab-target="planilha"
          type="button"
          aria-pressed="${activeSpreadsheetTab === "planilha" ? "true" : "false"}"
        >Planilha</button>
        <button
          class="recognition-card-tab ${activeSpreadsheetTab === "fluxo" ? "is-active" : ""}"
          data-spreadsheet-tab-target="fluxo"
          type="button"
          aria-pressed="${activeSpreadsheetTab === "fluxo" ? "true" : "false"}"
        >Fluxo</button>
      </div>

      <div
        class="recognition-card-panel ${activeSpreadsheetTab === "planilha" ? "is-active" : ""}"
        data-spreadsheet-tab-panel="planilha"
        ${activeSpreadsheetTab === "planilha" ? "" : "hidden"}
      >
        <div class="tree-inline-fields spreadsheet-tree-inline-fields">
          <label class="spreadsheet-tree-inline-field-full">
            <span>Arquivo</span>
            <select data-tree-field="workbook">${workbookOptions}</select>
          </label>
          <label>
            <span>Aba</span>
            <select data-tree-field="sheet">${sheetOptions}</select>
          </label>
          <label>
            <span>Coluna</span>
            <select data-tree-field="column">${columnOptions}</select>
          </label>
          <label>
            <span>Acao apos item</span>
            <input data-tree-field="afterAction" type="text" value="${escapeHtml(details.acao_apos_item_texto ?? "nenhuma")}" />
          </label>
          <label>
            <span>Intervalo entre itens</span>
            <input data-tree-field="intervalBetween" type="number" min="0" step="0.1" value="${escapeHtml(details.intervalo_entre_itens ?? 0.5)}" />
          </label>
          <div class="spreadsheet-tree-inline-actions">
            <button class="tree-open-button record-key-button" data-tree-action="record-after-action" type="button">Gravar tecla</button>
          </div>
        </div>
      </div>

      <div
        class="recognition-card-panel ${activeSpreadsheetTab === "fluxo" ? "is-active" : ""}"
        data-spreadsheet-tab-panel="fluxo"
        ${activeSpreadsheetTab === "fluxo" ? "" : "hidden"}
      >
        <p class="recognition-card-helper">Defina o que acontece quando esse loop terminar de preencher o item atual.</p>
        <div class="tree-inline-fields spreadsheet-flow-inline-fields">
          ${renderSuccessFlowFields("data-tree-field", details.ao_sucesso ?? "continuar", details.bloco_sucesso ?? "", details.sequencia_sucesso ?? "", details.atraso_antes_sequencia_sucesso ?? 0, event.order)}
        </div>
      </div>
    </div>
  `;
}

function renderInsertRecognitionPanel(panel, order) {
  const activeTab = normalizeRecognitionTreeTab(panel.recognitionTab ?? "base");
  return `
    <div class="field-stack field-stack-recognition insert-recognition-editor">
      <div class="recognition-card-tabs has-preview insert-recognition-tabs" role="tablist" aria-label="Configuracoes do novo reconhecimento">
        <button
          class="recognition-card-tab ${activeTab === "base" ? "is-active" : ""}"
          data-insert-recognition-tab-target="base"
          type="button"
          aria-pressed="${activeTab === "base" ? "true" : "false"}"
        >Base</button>
        <button
          class="recognition-card-tab ${activeTab === "preview" ? "is-active" : ""}"
          data-insert-recognition-tab-target="preview"
          type="button"
          aria-pressed="${activeTab === "preview" ? "true" : "false"}"
        >Preview</button>
        <button
          class="recognition-card-tab ${activeTab === "action" ? "is-active" : ""}"
          data-insert-recognition-tab-target="action"
          type="button"
          aria-pressed="${activeTab === "action" ? "true" : "false"}"
        >Acao</button>
        <button
          class="recognition-card-tab ${activeTab === "advanced" ? "is-active" : ""}"
          data-insert-recognition-tab-target="advanced"
          type="button"
          aria-pressed="${activeTab === "advanced" ? "true" : "false"}"
        >Avancado</button>
      </div>

      <div
        class="recognition-card-panel ${activeTab === "base" ? "is-active" : ""}"
        data-insert-recognition-tab-panel="base"
        ${activeTab === "base" ? "" : "hidden"}
      >
        <label class="recognition-reference-field">
          <span>Referencia visual</span>
          <input
            data-insert-field="imagePath"
            type="text"
            value="${escapeHtml(panel.imagePath ?? "")}"
            placeholder="imagens/botao_salvar.png, painel_erro.png..."
          />
        </label>
        <div class="recognition-utility-row insert-recognition-actions">
          <button class="tree-open-button" data-insert-action="capture-image" type="button">Capturar nova imagem</button>
          <button class="tree-open-button" data-insert-action="select-image" type="button">Selecionar referencia</button>
        </div>
        <div class="tree-inline-fields tree-inline-fields-recognition recognition-panel-grid insert-recognition-grid">
          <label class="recognition-cell">
            <span>Timeout</span>
            <input data-insert-field="timeout" type="number" min="0.1" step="0.5" value="${escapeHtml(panel.timeout ?? 10)}" />
          </label>
          <label class="recognition-cell">
            <span>Confianca</span>
            <input data-insert-field="confidence" type="number" min="0.1" max="1" step="0.05" value="${escapeHtml(panel.confidence ?? 0.8)}" />
          </label>
          <label class="recognition-cell">
            <span>Perfil</span>
            <select data-insert-field="searchProfile">
              <option value="fast" ${normalizeRecognitionProfile(panel.searchProfile, "balanced") === "fast" ? "selected" : ""}>Rapido</option>
              <option value="balanced" ${normalizeRecognitionProfile(panel.searchProfile, "balanced") === "balanced" ? "selected" : ""}>Equilibrado</option>
              <option value="precise" ${normalizeRecognitionProfile(panel.searchProfile, "balanced") === "precise" ? "selected" : ""}>Preciso</option>
            </select>
          </label>
          <label class="recognition-cell recognition-cell-full">
            <span>Janela deste bloco</span>
            <select data-insert-field="windowTitle">
              ${recognitionWindowOptionsMarkup(panel.windowTitle ?? "", "Sem janela fixa neste bloco")}
            </select>
          </label>
          <label class="recognition-cell recognition-cell-full">
            <span>Texto OCR obrigatorio</span>
            <input data-insert-field="expectedOcrText" type="text" value="${escapeHtml(panel.expectedOcrText ?? "")}" placeholder="Ex: 06/2025" />
          </label>
          <button class="tree-open-button recognition-window-refresh" data-insert-action="refresh-recognition-windows" type="button">Atualizar janelas</button>
        </div>
      </div>

      <div
        class="recognition-card-panel ${activeTab === "preview" ? "is-active" : ""}"
        data-insert-recognition-tab-panel="preview"
        ${activeTab === "preview" ? "" : "hidden"}
      >
        ${renderRecognitionPreviewPanel(panel.imagePath ?? "")}
        <p class="recognition-card-helper">Use essa aba para conferir exatamente qual imagem o novo bloco vai guardar.</p>
      </div>

      <div
        class="recognition-card-panel ${activeTab === "action" ? "is-active" : ""}"
        data-insert-recognition-tab-panel="action"
        ${activeTab === "action" ? "" : "hidden"}
      >
        <div class="insert-outcome-groups">
          <section class="insert-outcome-group is-success">
            <div class="insert-outcome-header">
              <strong>Se der certo</strong>
              <p>Quando a imagem for encontrada, escolha o que esse bloco deve fazer.</p>
            </div>
            <div class="tree-inline-fields recognition-panel-grid recognition-panel-grid-actions insert-recognition-grid-actions">
              <label>
                <span>Quando encontrar a imagem</span>
                <select data-insert-field="clickOnFind">
                  <option value="single" ${String(panel.recognitionClickMode ?? "single") === "single" ? "selected" : ""}>Dar 1 clique</option>
                  <option value="double" ${String(panel.recognitionClickMode ?? "single") === "double" ? "selected" : ""}>Dar 2 cliques</option>
                  <option value="identify" ${String(panel.recognitionClickMode ?? "single") === "identify" ? "selected" : ""}>So identificar</option>
                </select>
              </label>
              <label>
                <span>Depois disso</span>
                <select data-insert-field="successAction">
                  <option value="continuar" ${String(panel.successAction ?? "continuar") === "continuar" ? "selected" : ""}>Continuar a sequencia</option>
                  <option value="ir_para_sequencia" ${String(panel.successAction ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para outra pagina</option>
                  <option value="ir_para_bloco" ${String(panel.successAction ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para outro bloco</option>
                </select>
              </label>
              ${renderActionTargetFields(
                "data-insert-field",
                "successAction",
                panel.successAction ?? "continuar",
                "successSequence",
                panel.successSequence ?? "pagina_2",
                "successBlock",
                panel.successBlock ?? "",
                order,
                {
                  sequenceLabel: "Abrir esta pagina",
                  blockLabel: "Abrir este bloco",
                  delayFieldName: "successSequenceDelay",
                  delayValue: panel.successSequenceDelay ?? 0,
                  delayLabel: "Esperar antes da troca (s)",
                }
              )}
            </div>
          </section>

          <section class="insert-outcome-group is-failure">
            <div class="insert-outcome-header">
              <strong>Se falhar</strong>
              <p>Se a imagem nao aparecer, escolha como o fluxo deve reagir.</p>
            </div>
            <div class="tree-inline-fields recognition-panel-grid recognition-panel-grid-actions insert-recognition-grid-actions">
              <label>
                <span>O que fazer na falha</span>
                <select data-insert-field="failureAction">
                  <option value="parar" ${String(panel.failureAction ?? "parar") === "parar" ? "selected" : ""}>Parar a automacao</option>
                  <option value="continuar" ${String(panel.failureAction ?? "") === "continuar" || String(panel.failureAction ?? "") === "pular" ? "selected" : ""}>Continuar a sequencia</option>
                  <option value="tentar_novamente" ${String(panel.failureAction ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
                  <option value="ir_para_sequencia" ${String(panel.failureAction ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para outra pagina</option>
                  <option value="ir_para_bloco" ${String(panel.failureAction ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para outro bloco</option>
                </select>
              </label>
              ${renderActionTargetFields(
                "data-insert-field",
                "failureAction",
                panel.failureAction ?? "parar",
                "failureSequence",
                panel.failureSequence ?? "pagina_2",
                "failureBlock",
                panel.failureBlock ?? "",
                order,
                {
                  sequenceLabel: "Abrir esta pagina",
                  blockLabel: "Abrir este bloco",
                  delayFieldName: "failureSequenceDelay",
                  delayValue: panel.failureSequenceDelay ?? 0,
                  delayLabel: "Esperar antes da troca (s)",
                }
              )}
            </div>
          </section>
        </div>
      </div>

      <div
        class="recognition-card-panel ${activeTab === "advanced" ? "is-active" : ""}"
        data-insert-recognition-tab-panel="advanced"
        ${activeTab === "advanced" ? "" : "hidden"}
      >
        <p class="recognition-card-helper">Ajuste quantas tentativas o novo reconhecimento deve fazer antes de seguir a regra de falha.</p>
        <div class="tree-inline-fields tree-inline-fields-recognition recognition-panel-grid insert-recognition-grid">
          <label class="recognition-cell">
            <span>Tentativas</span>
            <input data-insert-field="retryCount" type="number" min="1" step="1" value="${escapeHtml(panel.retryCount ?? 1)}" />
          </label>
          <label class="recognition-cell">
            <span>Intervalo</span>
            <input data-insert-field="retryInterval" type="number" min="0" step="0.5" value="${escapeHtml(panel.retryInterval ?? 1)}" />
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderInsertPanel(order) {
  if (!state.insertPanel || state.insertPanel.targetOrder !== order) {
    return "";
  }

  const panel = state.insertPanel;
  const workbookId = resolveWorkbookId(panel.workbook || "");
  const workbookOptions = availableWorkbooks()
    .map(
      (workbook) =>
        `<option value="${escapeHtml(workbook.id)}" ${workbook.id === workbookId ? "selected" : ""}>${escapeHtml(workbook.file_name)}</option>`
    )
    .join("");
  const sheets = workbookSheetsFor(workbookId);
  const selectedSheet = sheets.some((sheet) => sheet.name === panel.sheet) ? panel.sheet : sheets[0]?.name ?? "";
  const sheetOptions = sheets
    .map(
      (sheet) =>
        `<option value="${escapeHtml(sheet.name)}" ${sheet.name === selectedSheet ? "selected" : ""}>${escapeHtml(sheet.name)}</option>`
    )
    .join("");
  const columns = columnsForSheetInWorkbook(workbookId, selectedSheet);
  const selectedColumn = columns.includes(panel.column) ? panel.column : columns[0] ?? "";
  const columnOptions = columns
    .map(
      (column) =>
        `<option value="${escapeHtml(column)}" ${column === selectedColumn ? "selected" : ""}>${escapeHtml(column)}</option>`
    )
    .join("");

  let body = "";
  if (panel.type === "text") {
    body = `
      <div class="field-stack">
        <label>
          <span>Texto do novo bloco</span>
          <textarea data-insert-field="text" rows="3">${escapeHtml(panel.text)}</textarea>
        </label>
        <label class="runtime-edit-switch-row">
          <span>Bloco editavel</span>
          <span class="runtime-edit-switch">
            <input data-insert-field="editableAtRun" type="checkbox" ${panel.editableAtRun ? "checked" : ""} />
            <i></i>
          </span>
        </label>
        <label class="runtime-edit-name">
          <span>Nome do bloco</span>
          <input data-insert-field="runtimeLabel" type="text" value="${escapeHtml(panel.runtimeLabel ?? "")}" placeholder="Ex.: Competencia" />
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", panel.successSequence ?? "", panel.successSequenceDelay ?? 0, order)}
        </div>
      </div>
    `;
  } else if (panel.type === "key") {
    body = `
      <div class="field-stack">
        <label>
          <span>Tecla ou atalho</span>
          <div class="capture-inline">
            <input data-insert-field="keys" type="text" value="${escapeHtml(panel.keys)}" placeholder="tab, enter, alt+f..." />
            <button class="tree-open-button record-key-button" data-insert-action="record-key">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Repetir quantas vezes</span>
          <input data-insert-field="repeat" type="number" min="1" step="1" value="${escapeHtml(panel.repeat ?? 1)}" />
        </label>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", panel.successSequence ?? "", panel.successSequenceDelay ?? 0, order)}
        </div>
      </div>
    `;
  } else if (panel.type === "mouse") {
    body = `
      <div class="field-stack">
        <div class="tree-inline-fields-wide">
          <label>
            <span>X</span>
            <input data-insert-field="x" type="number" step="1" value="${escapeHtml(panel.x)}" />
          </label>
          <label>
            <span>Y</span>
            <input data-insert-field="y" type="number" step="1" value="${escapeHtml(panel.y)}" />
          </label>
          <label>
            <span>Botao</span>
            <select data-insert-field="button">
              <option value="left" ${panel.button === "left" ? "selected" : ""}>Esquerdo</option>
              <option value="right" ${panel.button === "right" ? "selected" : ""}>Direito</option>
              <option value="middle" ${panel.button === "middle" ? "selected" : ""}>Meio</option>
            </select>
          </label>
          <label>
            <span>Cliques</span>
            <select data-insert-field="clicks">
              <option value="1" ${Number(panel.clicks ?? 1) === 1 ? "selected" : ""}>1 clique</option>
              <option value="2" ${Number(panel.clicks ?? 1) === 2 ? "selected" : ""}>2 cliques</option>
            </select>
          </label>
        </div>
        <button class="tree-open-button capture-mouse-inline-button" data-insert-action="record-mouse" type="button">Capturar mouse</button>
        <div class="tree-inline-fields">
          ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", panel.successSequence ?? "", panel.successSequenceDelay ?? 0, order)}
        </div>
      </div>
    `;
  } else if (panel.type === "loop_start" || panel.type === "loop_end") {
    body = `
      <div class="field-stack loop-marker-note">
        <p class="muted-copy">
          ${panel.type === "loop_start"
            ? "Use este marcador para indicar onde o trecho repetido comeca. O loop passa a valer logo apos este bloco."
            : "Use este marcador para fechar o trecho repetido. Tudo o que estiver entre os dois marcadores roda para cada linha da planilha."}
        </p>
        ${panel.type === "loop_end" ? `
          <div class="tree-inline-fields">
            ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", panel.successSequence ?? "", panel.successSequenceDelay ?? 0, order)}
          </div>
        ` : ""}
      </div>
    `;
  } else if (panel.type === "image") {
    body = renderInsertRecognitionPanel(panel, order);
  } else if (panel.type === "chrome") {
    const analysis = panel.chromeAnalysis || {};
    body = `
      <div class="field-stack">
        <label>
          <span>Nome do bloco</span>
          <input data-insert-field="chromeName" type="text" value="${escapeHtml(panel.chromeName ?? "Chrome / Elemento HTML")}" />
        </label>
        <label>
          <span>HTML do elemento</span>
          <textarea data-insert-field="chromeHtml" rows="5" placeholder="<input ...> ou <button ...>">${escapeHtml(panel.chromeHtml ?? "")}</textarea>
        </label>
        <input data-insert-field="chromeAnalysis" type="hidden" value="${escapeHtml(JSON.stringify(analysis))}" />
        <div class="recognition-action-row">
          <button class="tree-open-button" data-insert-action="analyze-chrome-html" type="button">Analisar HTML</button>
        </div>
        <div class="chrome-preview-card" data-chrome-preview>
          ${renderChromePreviewHtml(analysis)}
        </div>
        <div class="tree-inline-fields">
          <label>
            <span>Metodo de busca</span>
            <select data-insert-field="chromeTargetMethod">
              ${renderChromeMethodOptions(analysis, panel.chromeTargetMethod ?? analysis?.alvo_recomendado?.metodo ?? "css")}
            </select>
          </label>
          <label>
            <span>Alvo</span>
            <input data-insert-field="chromeTargetValue" type="text" value="${escapeHtml(panel.chromeTargetValue ?? analysis?.alvo_recomendado?.valor ?? "")}" />
          </label>
          <label>
            <span>Ação</span>
            <select data-insert-field="chromeActionType">
              ${renderChromeActionOptions(chromeKindFromAnalysis(analysis), panel.chromeActionType ?? analysis?.acao_sugerida?.tipo ?? "clicar")}
            </select>
          </label>
          <label>
            <span>Origem do valor</span>
            <select data-insert-field="chromeValueSource">
              <option value="texto_fixo" ${String(panel.chromeValueSource ?? analysis?.acao_sugerida?.origem_valor ?? "texto_fixo") === "texto_fixo" ? "selected" : ""}>Texto fixo</option>
              <option value="variavel" ${String(panel.chromeValueSource ?? "") === "variavel" ? "selected" : ""}>Variavel</option>
              <option value="planilha" ${String(panel.chromeValueSource ?? "") === "planilha" ? "selected" : ""}>Planilha</option>
            </select>
          </label>
          <label>
            <span>Valor</span>
            <input data-insert-field="chromeActionValue" type="text" value="${escapeHtml(panel.chromeActionValue ?? analysis?.acao_sugerida?.valor ?? "")}" />
          </label>
          <label>
            <span>Salvar texto em</span>
            <input data-insert-field="chromeSaveAs" type="text" value="${escapeHtml(panel.chromeSaveAs ?? "")}" />
          </label>
          <label>
            <span>Timeout (ms)</span>
            <input data-insert-field="chromeTimeout" type="number" min="500" step="500" value="${escapeHtml(panel.chromeTimeout ?? 10000)}" />
          </label>
          <label>
            <span>Pressionar depois</span>
            <select data-insert-field="chromePressAfter">
              <option value="" ${!(panel.chromePressAfter) ? "selected" : ""}>Nada</option>
              <option value="Enter" ${String(panel.chromePressAfter ?? "") === "Enter" ? "selected" : ""}>Enter</option>
              <option value="Tab" ${String(panel.chromePressAfter ?? "") === "Tab" ? "selected" : ""}>Tab</option>
            </select>
          </label>
          <label>
            <span>Ao concluir</span>
            <select data-insert-field="chromeSuccessAction">
              <option value="continuar" ${String(panel.chromeSuccessAction ?? "continuar") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="ir_para_sequencia" ${String(panel.chromeSuccessAction ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para pagina</option>
              <option value="ir_para_bloco" ${String(panel.chromeSuccessAction ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          ${renderActionTargetFields(
            "data-insert-field",
            "chromeSuccessAction",
            panel.chromeSuccessAction ?? "continuar",
            "chromeSuccessSequence",
            panel.chromeSuccessSequence ?? "pagina_2",
            "chromeSuccessBlock",
            panel.chromeSuccessBlock ?? "",
            order,
            {
              sequenceLabel: "Pagina apos sucesso",
              blockLabel: "Bloco apos sucesso",
              delayFieldName: "chromeSuccessSequenceDelay",
              delayValue: panel.chromeSuccessSequenceDelay ?? 0,
              delayLabel: "Esperar antes da troca (s)",
            }
          )}
          <label>
            <span>Falha</span>
            <select data-insert-field="chromeFailureAction">
              <option value="parar" ${String(panel.chromeFailureAction ?? "parar") === "parar" ? "selected" : ""}>Parar</option>
              <option value="continuar" ${String(panel.chromeFailureAction ?? "") === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="tentar_novamente" ${String(panel.chromeFailureAction ?? "") === "tentar_novamente" ? "selected" : ""}>Tentar novamente</option>
              <option value="ir_para_sequencia" ${String(panel.chromeFailureAction ?? "") === "ir_para_sequencia" ? "selected" : ""}>Ir para pagina</option>
              <option value="ir_para_bloco" ${String(panel.chromeFailureAction ?? "") === "ir_para_bloco" ? "selected" : ""}>Ir para bloco</option>
            </select>
          </label>
          ${renderActionTargetFields(
            "data-insert-field",
            "chromeFailureAction",
            panel.chromeFailureAction ?? "parar",
            "chromeFailureSequence",
            panel.chromeFailureSequence ?? "pagina_2",
            "chromeFailureBlock",
            panel.chromeFailureBlock ?? "",
            order,
            {
              sequenceLabel: "Pagina em caso de falha",
              blockLabel: "Ir para bloco",
              delayFieldName: "chromeFailureSequenceDelay",
              delayValue: panel.chromeFailureSequenceDelay ?? 0,
              delayLabel: "Esperar antes da troca (s)",
            }
          )}
          <label>
            <span>Tentativas</span>
            <input data-insert-field="chromeRetryCount" type="number" min="1" step="1" value="${escapeHtml(panel.chromeRetryCount ?? 1)}" />
          </label>
          <label>
            <span>Intervalo tentativas</span>
            <input data-insert-field="chromeRetryInterval" type="number" min="0" step="0.5" value="${escapeHtml(panel.chromeRetryInterval ?? 0.5)}" />
          </label>
        </div>
        <div class="inline-field">
          <label class="inline-checkbox">
            <input data-insert-field="chromeClearBefore" type="checkbox" ${panel.chromeClearBefore !== false ? "checked" : ""} />
            <span>Limpar antes</span>
          </label>
          <label class="inline-checkbox">
            <input data-insert-field="chromeFallbackVisual" type="checkbox" ${panel.chromeFallbackVisual ? "checked" : ""} />
            <span>Fallback visual</span>
          </label>
          <div class="capture-inline">
            <input data-insert-field="chromeFallbackImage" type="text" value="${escapeHtml(panel.chromeFallbackImage ?? "")}" placeholder="imagens/campo.png" />
            <button class="tree-open-button" data-insert-action="select-chrome-fallback-image" type="button">Selecionar fallback</button>
          </div>
        </div>
      </div>
    `;
  } else if (panel.type === "open_url") {
    body = renderOpenUrlFields("data-insert-field", {
      url: panel.openUrl,
      navegador: panel.openBrowser,
      modo_abertura: panel.openMode,
      tela_cheia: panel.openFullscreen,
      aguardar_segundos: panel.openWait,
      ao_sucesso: panel.successAction,
      bloco_sucesso: panel.successBlock,
      sequencia_sucesso: panel.successSequence,
      atraso_antes_sequencia_sucesso: panel.successSequenceDelay,
    }, order);
  } else if (panel.type === "open_program") {
    body = renderOpenProgramFields("data-insert-field", {
      caminho: panel.programPath,
      parametros: panel.programParams,
      aguardar_segundos: panel.programWait,
      ao_sucesso: panel.successAction,
      bloco_sucesso: panel.successBlock,
      sequencia_sucesso: panel.successSequence,
      atraso_antes_sequencia_sucesso: panel.successSequenceDelay,
    }, order);
  } else if (panel.type === "write_spreadsheet") {
    body = renderWriteSpreadsheetFields("data-insert-field", {
      arquivo: panel.workbook,
      aba: panel.sheet,
      coluna: panel.column,
      valor: panel.writeValue,
      ao_sucesso: panel.successAction,
      bloco_sucesso: panel.successBlock,
      sequencia_sucesso: panel.successSequence,
      atraso_antes_sequencia_sucesso: panel.successSequenceDelay,
    }, order);
  } else {
    body = `
      <div class="tree-inline-fields">
        <label>
          <span>Arquivo</span>
          <select data-insert-field="workbook">${workbookOptions}</select>
        </label>
        <label>
          <span>Aba</span>
          <select data-insert-field="sheet">${sheetOptions}</select>
        </label>
        <label>
          <span>Coluna</span>
          <select data-insert-field="column">${columnOptions}</select>
        </label>
        <label>
          <span>Acao apos item</span>
          <div class="capture-inline">
            <input data-insert-field="afterAction" type="text" value="${escapeHtml(panel.afterAction)}" />
            <button class="tree-open-button record-key-button" data-insert-action="record-after-action" type="button">Gravar tecla</button>
          </div>
        </label>
        <label>
          <span>Intervalo entre itens</span>
          <input data-insert-field="intervalBetween" type="number" min="0" step="0.1" value="${escapeHtml(panel.intervalBetween)}" />
        </label>
        ${renderSuccessFlowFields("data-insert-field", panel.successAction ?? "continuar", panel.successBlock ?? "", panel.successSequence ?? "", panel.successSequenceDelay ?? 0, order)}
      </div>
    `;
  }

  return `
    <div class="insert-card-panel" data-target-order="${order}">
      <div class="insert-card-header">
        <div>
          <p class="panel-kicker">Novo bloco</p>
          <h4>${panel.position === "before" ? "Inserir antes" : "Inserir depois"} do bloco ${order}</h4>
        </div>
        <button class="micro-button" data-insert-action="cancel">Fechar</button>
      </div>
      <div class="insert-type-row">
        <button class="insert-type-button ${panel.type === "key" ? "is-active" : ""}" data-insert-type="key">Tecla</button>
        <button class="insert-type-button ${panel.type === "text" ? "is-active" : ""}" data-insert-type="text">Texto</button>
        <button class="insert-type-button ${panel.type === "mouse" ? "is-active" : ""}" data-insert-type="mouse">Mouse</button>
        <button class="insert-type-button ${panel.type === "image" ? "is-active" : ""}" data-insert-type="image">Reconhecimento</button>
        <button class="insert-type-button ${panel.type === "chrome" ? "is-active" : ""}" data-insert-type="chrome">Chrome HTML</button>
        <button class="insert-type-button ${panel.type === "open_url" ? "is-active" : ""}" data-insert-type="open_url">Abrir URL</button>
        <button class="insert-type-button ${panel.type === "open_program" ? "is-active" : ""}" data-insert-type="open_program">Abrir Programa</button>
        <button class="insert-type-button ${panel.type === "spreadsheet" ? "is-active" : ""}" data-insert-type="spreadsheet">Planilha</button>
        <button class="insert-type-button ${panel.type === "write_spreadsheet" ? "is-active" : ""}" data-insert-type="write_spreadsheet">Escrever celula</button>
        <button class="insert-type-button ${panel.type === "loop_start" ? "is-active" : ""}" data-insert-type="loop_start">Inicio loop</button>
        <button class="insert-type-button ${panel.type === "loop_end" ? "is-active" : ""}" data-insert-type="loop_end">Fim loop</button>
      </div>
      <div class="insert-card-body">
        ${body}
        <label>
          <span>Tempo antes do novo bloco</span>
          <input data-insert-field="delay" type="number" min="0" step="0.1" value="${escapeHtml(panel.delay)}" />
        </label>
      </div>
      <div class="insert-card-actions">
        <button class="tree-save-button" data-insert-action="save">Adicionar bloco</button>
      </div>
    </div>
  `;
}

function renderEmptyCommandMapStarter() {
  const pageDefinition = getCommandMapPageDefinition(state.commandMapPageSequence);
  const hasAnyEvent = Boolean(state.roadmap?.events?.length);
  if (!state.insertPanel || state.insertPanel.targetOrder !== 0) {
    return `
      <div class="empty-command-map-state">
        <div class="empty-command-map-copy">
          <p class="panel-kicker">${escapeHtml(pageDefinition.label)}</p>
          <h3>${hasAnyEvent ? "Esta pagina ainda esta vazia" : "Crie o primeiro bloco por aqui"}</h3>
          <p>${hasAnyEvent
            ? `Adicione uma sequencia nesta ${escapeHtml(pageDefinition.label.toLowerCase())} para separar esse fluxo do restante da automacao.`
            : "A automacao ainda nao tem comandos. Escolha um tipo abaixo para comecar direto no mapa."}</p>
        </div>
        <div class="empty-command-map-actions">
          <button class="insert-type-button is-active" data-empty-insert-type="key" type="button">Tecla</button>
          <button class="insert-type-button" data-empty-insert-type="text" type="button">Texto</button>
          <button class="insert-type-button" data-empty-insert-type="mouse" type="button">Mouse</button>
          <button class="insert-type-button" data-empty-insert-type="image" type="button">Reconhecimento</button>
          <button class="insert-type-button" data-empty-insert-type="chrome" type="button">Chrome HTML</button>
          <button class="insert-type-button" data-empty-insert-type="open_url" type="button">Abrir URL</button>
          <button class="insert-type-button" data-empty-insert-type="open_program" type="button">Abrir Programa</button>
          <button class="insert-type-button" data-empty-insert-type="spreadsheet" type="button">Planilha</button>
          <button class="insert-type-button" data-empty-insert-type="write_spreadsheet" type="button">Escrever celula</button>
          <button class="insert-type-button" data-empty-insert-type="loop_start" type="button">Inicio loop</button>
          <button class="insert-type-button" data-empty-insert-type="loop_end" type="button">Fim loop</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="empty-command-map-panel-wrap">
      ${renderInsertPanel(0)}
    </div>
  `;
}

function normalizeCapturedKey(event) {
  const raw = (event.key || "").toLowerCase();
  const specialMap = {
    " ": "space",
    spacebar: "space",
    escape: "esc",
    esc: "esc",
    arrowup: "up",
    arrowdown: "down",
    arrowleft: "left",
    arrowright: "right",
    control: "ctrl",
    shift: "shift",
    alt: "alt",
    meta: "cmd",
  };

  if (specialMap[raw]) {
    return specialMap[raw];
  }
  if (raw.length === 1) {
    return raw;
  }
  return raw;
}

function beginKeyCapture(target) {
  if (state.captureTarget) {
    setMessage("Ja existe uma captura em andamento.", "error");
    return;
  }

  clearCaptureBlurTimer();
  state.captureTarget = { ...target, mode: "key", requestId: ++state.captureSequence };
  showCaptureOverlay("Aperte a tecla ou o atalho desejado. Quando capturar, esta janela some automaticamente.");
  setMessage("Pressione a tecla ou combinacao agora. Use ESC para cancelar.", "success");
}

async function beginMouseCapture(target) {
  if (state.captureTarget) {
    setMessage("Ja existe uma captura em andamento.", "error");
    return;
  }

  clearCaptureBlurTimer();
  const requestId = ++state.captureSequence;
  state.captureTarget = { ...target, mode: "mouse", requestId };
  showCaptureOverlay("Clique no ponto exato da tela. Vamos capturar a posicao do mouse e o botao usado nesse clique.");
  setMessage("Captura de mouse iniciada. Clique na tela desejada para preencher o bloco.", "success");

  try {
    const payload = await invoke("capture_mouse_click");
    if (!state.captureTarget || state.captureTarget.mode !== "mouse" || state.captureTarget.requestId !== requestId) {
      return;
    }

    writeCapturedMouse(payload);
    state.captureTarget = null;
    hideCaptureOverlay();
    setMessage(
      `Clique gravado: ${formatMouseButtonLabel(payload.button)} em X ${payload.x} | Y ${payload.y}.`,
      "success"
    );
  } catch (error) {
    if (!state.captureTarget || state.captureTarget.mode !== "mouse" || state.captureTarget.requestId !== requestId) {
      return;
    }

    state.captureTarget = null;
    hideCaptureOverlay();
    setMessage(String(error), "error");
  }
}

window.addEventListener("keydown", (event) => {
  if (!state.captureTarget || state.captureTarget.mode !== "key") {
    if (state.captureTarget?.mode === "mouse" && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelCapture("Captura de mouse cancelada.");
    }
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    cancelCapture("Gravacao de tecla cancelada.");
    return;
  }

  const parts = [];
  if (event.ctrlKey) {
    parts.push("ctrl");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  if (event.metaKey) {
    parts.push("cmd");
  }

  const normalized = normalizeCapturedKey(event);
  if (isModifierOnlyKey(normalized)) {
    showCaptureOverlay("Modificador detectado. Agora pressione a tecla final do atalho.");
    setMessage(`Modificador ${normalized} detectado. Falta a tecla final.`, "success");
    return;
  }

  if (!isModifierOnlyKey(normalized)) {
    parts.push(normalized);
  }

  const captured = [...new Set(parts)].join("+");
  if (!captured) {
    return;
  }

  clearCaptureBlurTimer();
  writeCapturedShortcut(captured);
  state.captureTarget = null;
  hideCaptureOverlay();
  setMessage(`Tecla gravada: ${captured}`, "success");
});

captureOverlay.addEventListener("click", (event) => {
  if (event.target === captureOverlay) {
    cancelCapture(
      state.captureTarget?.mode === "mouse" ? "Captura de mouse cancelada." : "Gravacao de tecla cancelada."
    );
  }
});

cancelCaptureButton.addEventListener("click", () => {
  cancelCapture(
    state.captureTarget?.mode === "mouse" ? "Captura de mouse cancelada." : "Gravacao de tecla cancelada."
  );
});

window.addEventListener("blur", () => {
  if (state.captureTarget?.mode === "key") {
    clearCaptureBlurTimer();
    state.captureBlurTimer = setTimeout(() => {
      state.captureBlurTimer = null;
      if (state.captureTarget?.mode === "key" && !document.hasFocus()) {
        cancelCapture("Captura cancelada porque a janela perdeu o foco.");
      }
    }, 180);
  }
});

window.addEventListener("focus", () => {
  clearCaptureBlurTimer();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.assistTarget.modalOpen) {
    event.preventDefault();
    closeAssistWindowPicker();
    return;
  }

  if (event.key === "Escape" && state.expandedTreeCardOrder) {
    event.preventDefault();
    closeExpandedTreeCard();
    return;
  }

  if (state.activeTab !== "commands" || state.captureTarget) {
    return;
  }

  const target = event.target;
  const tagName = String(target?.tagName || "").toUpperCase();
  const editingField =
    target?.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
  if (editingField) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveCommandMapFocus(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveCommandMapFocus(1);
  }
});

function renderTimeline() {
  updateStats();
  const events = state.roadmap?.events ?? [];
  if (!events.length) {
    timelineList.innerHTML = `<div class="empty-state">Nenhum bloco salvo ainda. Monte o fluxo pela coluna da esquerda e ele vai aparecer conectado aqui.</div>`;
    return;
  }

  timelineList.innerHTML = events
    .map((event, index) => {
      const delayLabel = index === 0 ? `Inicio + ${event.delay}s` : `${event.delay}s antes do proximo bloco`;
      const isRuntimeEditable = event.type === "texto_livre" && Boolean(event.details?.editavel_execucao);
      return `
        <div class="timeline-node">
          <div class="delay-bridge">
            <span class="delay-pill">${escapeHtml(delayLabel)}</span>
          </div>
          <article class="flow-card ${isRuntimeEditable ? "is-runtime-editable" : ""}" data-order="${event.order}" data-type="${escapeHtml(event.type)}">
            <div class="card-top">
              <div>
                <p class="panel-kicker">Bloco ${event.order}</p>
                <h3>${escapeHtml(event.title)}</h3>
                <p data-recognition-subtitle="true">${escapeHtml(recognitionSubtitleLabel(event))}</p>
              </div>
              <span class="type-chip ${escapeHtml(event.type)} ${isRuntimeEditable ? "runtime-editable" : ""}">${escapeHtml(isRuntimeEditable ? "Bloco editavel" : typeChipLabel(event.type))}</span>
            </div>

            <div class="block-grid">
              <div class="block-editor">
                ${renderEditorFields(event)}
                <div class="card-actions">
                  <button class="save-button" data-action="save">Salvar bloco</button>
                  <button class="micro-button" data-action="up">Subir</button>
                  <button class="micro-button" data-action="down">Descer</button>
                  <button class="micro-button" data-action="remove">Excluir</button>
                </div>
              </div>

              <div>
                <p class="card-description">${escapeHtml(event.description)}</p>
                <div class="command-preview">${escapeHtml(event.command)}</div>
              </div>
            </div>
          </article>
        </div>
      `;
    })
    .join("");
}

function renderCommandMap(options = {}) {
  const { layoutSnapshot = null } = options;
  const events = getCommandMapEvents().map((event) => applyCommandMapDraftToEvent(event));
  state.commandMapOrderCache = events
    .map((event) => Number(event.order))
    .filter((order) => Number.isFinite(order));
  const pageDefinition = getCommandMapPageDefinition(state.commandMapPageSequence);
  builderShell?.classList.toggle("has-insert-panel", Boolean(state.insertPanel));
  builderShell?.classList.toggle("has-command-card-overlay", Boolean(state.expandedTreeCardOrder));
  updateCommandMapHeaderSummary();
  renderCommandMapPageTabs();
  if (!events.length) {
    commandMapList.innerHTML = renderEmptyCommandMapStarter();
    applyCommandMapZoom();
    updateCommandMapNavButtons();
    return;
  }

  const segments = events.map((event, index) => {
    const nextEvent = events[index + 1];
    const isFirstCard = index === 0;
    const isLastCard = index === events.length - 1;
    const hasRecordButton = event.type === "tecla" || event.type === "atalho";
    const isRecognitionCard = event.type === "clicar_imagem";
    const isSpreadsheetCard = event.type === "sequencia_planilha" || event.type === "escrever_planilha";
    const isLoopMarkerCard = isLoopMarkerType(event.type);
    const isRuntimeEditable = event.type === "texto_livre" && Boolean(event.details?.editavel_execucao);
    const primaryActionClass = isRecognitionCard
      ? "has-recognition-button"
      : hasRecordButton
        ? "has-record-button"
        : "";
    const primaryActions = isRecognitionCard
      ? `
        <button class="tree-save-button" data-tree-action="save">Salvar</button>
        <button class="tree-open-button" data-tree-action="test-image-recognition">Testar</button>
        <button class="tree-open-button" data-tree-action="capture-image">Capturar</button>
      `
      : `
        <button class="tree-save-button" data-tree-action="save">Salvar</button>
        <button class="tree-open-button" data-tree-action="open-editor">Editor</button>
        ${hasRecordButton ? '<button class="tree-open-button" data-tree-action="record-key">Gravar</button>' : ""}
      `;
    const card = `
      <div class="command-flow-segment ${isRecognitionCard ? "visual-recognition-segment" : ""} ${isSpreadsheetCard ? "spreadsheet-segment" : ""} ${state.insertPanel?.targetOrder === event.order ? "has-insert-panel" : ""}" data-order="${event.order}" data-client-key="${escapeHtml(event.clientKey || String(event.order))}">
      <article class="command-tree-card ${isRecognitionCard ? "is-visual-recognition" : ""} ${isSpreadsheetCard ? "is-spreadsheet-card" : ""} ${isLoopMarkerCard ? "is-loop-marker" : ""} ${isRuntimeEditable ? "is-runtime-editable" : ""}" data-order="${event.order}" data-client-key="${escapeHtml(event.clientKey || String(event.order))}" data-type="${escapeHtml(event.type)}" data-delay="${escapeHtml(event.delay)}">
        <div class="command-tree-top">
          <div class="command-tree-main">
            <span class="command-index">${String(event.order).padStart(2, "0")}</span>
            <div>
              ${event.type === "sequencia_planilha" ? `<span class="command-tree-loop-badge">${escapeHtml(getSpreadsheetLoopBadgeLabel(event))}</span>` : ""}
              ${event.type === "escrever_planilha" ? `<span class="command-tree-loop-badge">Linha atual</span>` : ""}
              <h3>${escapeHtml(event.title)}</h3>
              <p data-recognition-subtitle="true">${escapeHtml(recognitionSubtitleLabel(event))}</p>
            </div>
          </div>
          <div class="command-tree-side">
            ${event.type === "texto_livre" ? `
              <label class="runtime-edit-switch command-card-editable-switch" title="Bloco editavel na execucao">
                <input data-tree-field="editableAtRun" type="checkbox" ${isRuntimeEditable ? "checked" : ""} />
                <i></i>
              </label>
            ` : ""}
            <span class="type-chip ${escapeHtml(event.type)} ${isRuntimeEditable ? "runtime-editable" : ""}">${escapeHtml(isRuntimeEditable ? "Bloco editavel" : typeChipLabel(event.type))}</span>
            <button class="drag-handle" data-drag-handle="true" data-order="${event.order}" title="Arrastar card" type="button">
              <span>Arrastar</span>
            </button>
          </div>
        </div>

        <div class="command-tree-grid">
          <div class="tree-editor">
            ${renderTreeEditorFields(event)}
          </div>
          <div class="tree-command-preview">${escapeHtml(event.command)}</div>
        </div>

        <div class="command-tree-actions">
          <div class="command-action-group command-action-group-primary ${primaryActionClass}">
            ${primaryActions}
          </div>
          <div class="command-action-group command-action-group-secondary">
            <button class="micro-button" data-tree-action="insert-before">Antes</button>
            <button class="micro-button" data-tree-action="insert-after">Depois</button>
            <button class="micro-button" data-tree-action="remove">Excluir</button>
          </div>
          <div class="command-action-group command-action-group-reorder">
            <button
              class="tree-shift-button"
              data-tree-action="up"
              type="button"
              title="Mover para a esquerda"
              aria-label="Mover card para a esquerda"
              ${isFirstCard ? "disabled" : ""}
            >&larr;</button>
            <button
              class="tree-shift-button"
              data-tree-action="down"
              type="button"
              title="Mover para a direita"
              aria-label="Mover card para a direita"
              ${isLastCard ? "disabled" : ""}
            >&rarr;</button>
          </div>
        </div>
      </article>
      ${renderInsertPanel(event.order)}
      </div>
    `;

    if (!nextEvent) {
      return `${card}<div class="command-flow-end">Fim da ${escapeHtml(pageDefinition.label.toLowerCase())}</div>`;
    }

    return `
      ${card}
      <div class="command-inline-connector" data-target-index="${nextEvent.order}">
        <label class="connector-time connector-time-inline">
          <span class="connector-link-label">${event.order} > ${nextEvent.order}</span>
          <input
            data-connector-delay="true"
            data-order="${nextEvent.order}"
            type="number"
            min="0"
            step="0.1"
            value="${escapeHtml(nextEvent.delay)}"
          />
          <strong>s</strong>
        </label>
        <div class="connector-track"></div>
      </div>
    `;
  });

  commandMapList.innerHTML = `<div class="command-flow-row">${events
    .map((event, index) => {
      const zone = `<div class="command-drop-zone" data-target-index="${event.order}" aria-label="Soltar antes do bloco ${event.order}"></div>`;
      return `${zone}${segments[index]}`;
    })
    .join("")}<div class="command-drop-zone command-drop-zone-end" data-target-index="${Number(events.at(-1)?.order ?? 0) + 1}" aria-label="Soltar no final de ${escapeHtml(pageDefinition.label.toLowerCase())}"></div></div>`;
  hydrateRecognitionPreviewCards(commandMapList);
  applyCommandMapZoom();
  scheduleCommandMapAutoFit();
  applyCommandMapFocus();
  if (layoutSnapshot) {
    requestAnimationFrame(() => {
      animateCommandMapLayoutShift(layoutSnapshot);
    });
  }
}

function applyRoadmap(roadmap, options = {}) {
  const resetCommandMapDrafts = Boolean(options.resetCommandMapDrafts);
  const resetCommandMapNavigation = Boolean(options.resetCommandMapNavigation);
  const preserveCommandMapSequence = options.preserveCommandMapSequence
    ? normalizeSequenceName(options.preserveCommandMapSequence)
    : "";
  if (resetCommandMapDrafts) {
    state.commandMapDrafts = {};
  }
  const decoratedRoadmap = decorateRoadmapForClient(roadmap, state.roadmap);
  state.roadmap = decoratedRoadmap;
  syncCommandMapDraftsWithRoadmap(decoratedRoadmap);
  if (resetCommandMapNavigation) {
    const initialSequence = normalizeSequenceName(
      decoratedRoadmap?.initial_sequence || decoratedRoadmap?.sequencia_inicial || "principal"
    );
    const pageExists = getCommandMapPageDefinitions(decoratedRoadmap)
      .some((page) => page.sequence === initialSequence);
    state.commandMapPageSequence = pageExists ? initialSequence : "principal";
    state.commandMapPageSequenceLock = null;
    state.commandMapFocusOrder = getCommandMapEvents(state.commandMapPageSequence, decoratedRoadmap)
      .at(0)?.order ?? decoratedRoadmap?.events?.[0]?.order ?? null;
    state.assist.currentOrder = getAssistInitialOrder(decoratedRoadmap);
  } else if (preserveCommandMapSequence) {
    const pageExists = getCommandMapPageDefinitions(decoratedRoadmap)
      .some((page) => page.sequence === preserveCommandMapSequence);
    if (pageExists) {
      state.commandMapPageSequence = preserveCommandMapSequence;
    }
  }
  ensureCommandMapPageSelection(decoratedRoadmap);
  syncCommandMapPageTheme();
  syncRecognitionTestStatusWithRoadmap(decoratedRoadmap);
  state.library.dirty = false;
  syncSequenceContextInput();
  refreshSequenceSuggestions();
  renderCommandMapPageTabs();
  populateImageFailureBlockSelect();
  populateImageFailureSequenceSelect();
  populateChromeFailureBlockSelect();
  populateChromeFailureSequenceSelect();
  populateChromeSuccessBlockSelect();
  populateChromeSuccessSequenceSelect();
  state.commandMapFocusOrder = resolveNearestCommandMapFocus(
    decoratedRoadmap,
    state.commandMapFocusOrder ?? decoratedRoadmap?.events?.[0]?.order ?? null
  );
  syncWorkbook(decoratedRoadmap.workbook);
  renderTimeline();
  if (state.assist.mode === "idle" && !state.assist.currentOrder) {
    state.assist.currentOrder = getAssistInitialOrder(decoratedRoadmap);
  }
  syncAssistTheme();
  markWorkspaceRenderDirty({ commandMap: true, assist: true, workbook: true });
  renderActiveWorkspaceContent();
  syncCommandMapSaveStateWithPending();
}

function applyPersistedRoadmap(roadmap) {
  applyRoadmap(roadmap, {
    resetCommandMapDrafts: true,
    resetCommandMapNavigation: true,
  });
}

async function refreshRoadmap(message = "Roteiro atualizado.") {
  setBusy("Atualizando");
  const roadmap = await invoke("get_roadmap");
  applyRoadmap(roadmap);
  await refreshTestLoopData();
  setBusy("Pronto");
  setMessage(message, "success");
}

async function applyBulkDelayToAllBlocks(source = "top") {
  const sourceInput = source === "map" ? mapBulkDelayInput : bulkDelayInput;
  const delay = Math.max(0, parseNumber(sourceInput?.value, 0));
  if (bulkDelayInput) {
    bulkDelayInput.value = String(delay);
  }
  if (mapBulkDelayInput) {
    mapBulkDelayInput.value = String(delay);
  }
  const totalEvents = state.roadmap?.events?.length ?? 0;
  if (!totalEvents) {
    setMessage("Nao existe nenhum bloco no roteiro para aplicar o atraso global.", "error");
    return;
  }

  try {
    setBusy("Aplicando atraso global");
    const roadmap = await invoke("update_all_blocks_delay", { delay });
    applyRoadmap(roadmap);
    await refreshAutomationLibrary();
    setBusy("Pronto");
    setMessage(`Atraso de ${delay}s aplicado em ${totalEvents} bloco(s).`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

async function refreshWorkbookMeta() {
  const workbook = await invoke("get_workbook_meta");
  syncWorkbook(workbook);
  populateWorkbookSheetSelect();
}

async function loadWorkbookPreview(
  sheetName = state.workbookSelectedSheet || selectedPreviewWorkbookMeta()?.sheets?.[0]?.name || "",
  workbookId = state.previewWorkbookId || state.workbook?.default_workbook || availableWorkbooks()[0]?.id || ""
) {
  state.previewWorkbookId = workbookId;
  state.workbookSelectedSheet = sheetName;
  const preview = await invoke("get_workbook_preview", {
    workbook: workbookId || null,
    sheet: sheetName || null,
    limit: 120,
  });
  state.workbookPreview = preview;
  state.previewWorkbookId = preview.workbook_id || workbookId;
  state.workbookSelectedSheet = preview.sheet || sheetName;
  if (!preview.headers?.includes(state.workbookSelectedColumn)) {
    state.workbookSelectedColumn = preview.headers?.[0] ?? "";
  }
  if (
    state.workbookSelectedCell &&
    state.workbookSelectedCell.sheet !== state.workbookSelectedSheet
  ) {
    state.workbookSelectedCell = null;
  }
  if (state.activeTab === "workbook") {
    renderWorkbookPreview();
    state.renderDirty.workbook = false;
  } else {
    state.renderDirty.workbook = true;
  }
}

async function runMutation(label, promiseFactory, focusResolver = null) {
  const activeCommandMapSequence = normalizeSequenceName(state.commandMapPageSequence);
  try {
    setBusy(label);
    lockCommandMapPageSequence(activeCommandMapSequence);
    const roadmap = await promiseFactory();
    const pageExists = getCommandMapPageDefinitions(roadmap)
      .some((page) => page.sequence === activeCommandMapSequence);
    if (pageExists) {
      state.commandMapPageSequence = activeCommandMapSequence;
      syncSequenceContextInput();
      lockCommandMapPageSequence(activeCommandMapSequence, 2500);
    }
    if (typeof focusResolver === "function") {
      state.commandMapFocusOrder = focusResolver(roadmap);
    }
    applyRoadmap(roadmap, { preserveCommandMapSequence: activeCommandMapSequence });
    await refreshAutomationLibrary();
    setBusy("Pronto");
    setMessage(`${label} com sucesso.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

function formValuesFromCard(card) {
  const get = (field) => card.querySelector(`[data-field="${field}"]`);
  return {
    delay: parseNumber(get("delay")?.value, 0),
    successAction: get("successAction")?.value ?? "continuar",
    successBlock: get("successBlock")?.value ?? "",
    successSequence: get("successSequence")?.value ?? "",
    successSequenceDelay: normalizeTransitionDelay(get("successSequenceDelay")?.value),
    text: get("text")?.value ?? "",
    editableAtRun: Boolean(get("editableAtRun")?.checked),
    runtimeLabel: get("runtimeLabel")?.value ?? "",
    keys: get("keys")?.value ?? "",
    repeat: Math.max(1, Math.trunc(parseNumber(get("repeat")?.value, 1))),
    x: parseNumber(get("x")?.value, 0),
    y: parseNumber(get("y")?.value, 0),
    button: get("button")?.value ?? "left",
    clicks: Math.max(1, Math.trunc(parseNumber(get("clicks")?.value, 1))),
    imagePath: get("imagePath")?.value ?? "",
    timeout: parseNumber(get("timeout")?.value, 10),
    confidence: parseNumber(get("confidence")?.value, 0.8),
    searchProfile: normalizeRecognitionProfile(get("searchProfile")?.value, "balanced"),
    searchAreaMode: "target_window",
    searchAreaX: 0,
    searchAreaY: 0,
    searchAreaWidth: 0,
    searchAreaHeight: 0,
    windowTitle: normalizeRecognitionWindowTitle(get("windowTitle")?.value ?? ""),
    expectedOcrText: get("expectedOcrText")?.value ?? "",
    recognitionClickMode: get("clickOnFind")?.value ?? "single",
    failureAction: get("failureAction")?.value ?? "parar",
    failureBlock: get("failureBlock")?.value ?? "",
    failureSequence: get("failureSequence")?.value ?? "",
    failureSequenceDelay: normalizeTransitionDelay(get("failureSequenceDelay")?.value),
    retryCount: Math.max(1, Math.trunc(parseNumber(get("retryCount")?.value, 1))),
    retryInterval: parseNumber(get("retryInterval")?.value, 1),
    verifyName: get("verifyName")?.value ?? "",
    verifyActiveImage: get("verifyActiveImage")?.value ?? "",
    verifyInactiveImage: get("verifyInactiveImage")?.value ?? "",
    verifyTimeout: parseNumber(get("verifyTimeout")?.value, 5),
    verifyConfidence: parseNumber(get("verifyConfidence")?.value, 0.85),
    verifyActiveAction: get("verifyActiveAction")?.value ?? "continuar",
    verifyActiveSequence: get("verifyActiveSequence")?.value ?? "",
    verifyInactiveAction: get("verifyInactiveAction")?.value ?? "ir_para_sequencia",
    verifyInactiveSequence: get("verifyInactiveSequence")?.value ?? "",
    verifyMissingAction: get("verifyMissingAction")?.value ?? "parar",
    verifyMissingSequence: get("verifyMissingSequence")?.value ?? "",
    chromeName: get("chromeName")?.value ?? "",
    chromeHtml: get("chromeHtml")?.value ?? "",
    chromeAnalysis: parseChromeAnalysisJson(get("chromeAnalysis")?.value ?? ""),
    chromeTargetMethod: get("chromeTargetMethod")?.value ?? "css",
    chromeTargetValue: get("chromeTargetValue")?.value ?? "",
    chromeActionType: get("chromeActionType")?.value ?? "clicar",
    chromeValueSource: get("chromeValueSource")?.value ?? "texto_fixo",
    chromeActionValue: get("chromeActionValue")?.value ?? "",
    chromeSaveAs: get("chromeSaveAs")?.value ?? "",
    chromeTimeout: parseNumber(get("chromeTimeout")?.value, 10000),
    chromePressAfter: get("chromePressAfter")?.value ?? "",
    chromeSuccessAction: get("chromeSuccessAction")?.value ?? "continuar",
    chromeSuccessBlock: get("chromeSuccessBlock")?.value ?? "",
    chromeSuccessSequence: get("chromeSuccessSequence")?.value ?? "",
    chromeSuccessSequenceDelay: normalizeTransitionDelay(get("chromeSuccessSequenceDelay")?.value),
    chromeFailureAction: get("chromeFailureAction")?.value ?? "parar",
    chromeFailureBlock: get("chromeFailureBlock")?.value ?? "",
    chromeFailureSequence: get("chromeFailureSequence")?.value ?? "",
    chromeFailureSequenceDelay: normalizeTransitionDelay(get("chromeFailureSequenceDelay")?.value),
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(get("chromeRetryCount")?.value, 1))),
    chromeRetryInterval: parseNumber(get("chromeRetryInterval")?.value, 0.5),
    chromeClearBefore: Boolean(get("chromeClearBefore")?.checked),
    chromeFallbackVisual: Boolean(get("chromeFallbackVisual")?.checked),
    chromeFallbackImage: get("chromeFallbackImage")?.value ?? "",
    openUrl: get("openUrl")?.value ?? "",
    openBrowser: get("openBrowser")?.value ?? "padrao",
    openMode: get("openMode")?.value ?? "nova_janela",
    openFullscreen: Boolean(get("openFullscreen")?.checked),
    openWait: parseNumber(get("openWait")?.value, 3),
    programPath: get("programPath")?.value ?? "",
    programParams: get("programParams")?.value ?? "",
    programWait: parseNumber(get("programWait")?.value, 2),
    workbook: get("workbook")?.value ?? "",
    sheet: get("sheet")?.value ?? "",
    column: get("column")?.value ?? "",
    writeValue: get("writeValue")?.value ?? "",
    afterAction: get("afterAction")?.value ?? "nenhuma",
    intervalBetween: parseNumber(get("intervalBetween")?.value, 0.5),
  };
}

function treeValuesFromCard(card) {
  const get = (field) => card.querySelector(`[data-tree-field="${field}"]`);
  return {
    delay: parseNumber(card.dataset.delay, 0),
    successAction: get("successAction")?.value ?? "continuar",
    successBlock: get("successBlock")?.value ?? "",
    successSequence: get("successSequence")?.value ?? "",
    successSequenceDelay: normalizeTransitionDelay(get("successSequenceDelay")?.value),
    text: get("text")?.value ?? "",
    editableAtRun: Boolean(get("editableAtRun")?.checked),
    runtimeLabel: get("runtimeLabel")?.value ?? "",
    keys: get("keys")?.value ?? "",
    repeat: Math.max(1, Math.trunc(parseNumber(get("repeat")?.value, 1))),
    x: parseNumber(get("x")?.value, 0),
    y: parseNumber(get("y")?.value, 0),
    button: get("button")?.value ?? "left",
    clicks: Math.max(1, Math.trunc(parseNumber(get("clicks")?.value, 1))),
    imagePath: get("imagePath")?.value ?? "",
    timeout: parseNumber(get("timeout")?.value, 10),
    confidence: parseNumber(get("confidence")?.value, 0.8),
    searchProfile: normalizeRecognitionProfile(get("searchProfile")?.value, "balanced"),
    searchAreaMode: "target_window",
    searchAreaX: 0,
    searchAreaY: 0,
    searchAreaWidth: 0,
    searchAreaHeight: 0,
    windowTitle: normalizeRecognitionWindowTitle(get("windowTitle")?.value ?? ""),
    expectedOcrText: get("expectedOcrText")?.value ?? "",
    recognitionClickMode: get("clickOnFind")?.value ?? "single",
    failureAction: get("failureAction")?.value ?? "parar",
    failureBlock: get("failureBlock")?.value ?? "",
    failureSequence: get("failureSequence")?.value ?? "",
    failureSequenceDelay: normalizeTransitionDelay(get("failureSequenceDelay")?.value),
    retryCount: Math.max(1, Math.trunc(parseNumber(get("retryCount")?.value, 1))),
    retryInterval: parseNumber(get("retryInterval")?.value, 1),
    verifyName: get("verifyName")?.value ?? "",
    verifyActiveImage: get("verifyActiveImage")?.value ?? "",
    verifyInactiveImage: get("verifyInactiveImage")?.value ?? "",
    verifyTimeout: parseNumber(get("verifyTimeout")?.value, 5),
    verifyConfidence: parseNumber(get("verifyConfidence")?.value, 0.85),
    verifyActiveAction: get("verifyActiveAction")?.value ?? "continuar",
    verifyActiveSequence: get("verifyActiveSequence")?.value ?? "",
    verifyInactiveAction: get("verifyInactiveAction")?.value ?? "ir_para_sequencia",
    verifyInactiveSequence: get("verifyInactiveSequence")?.value ?? "",
    verifyMissingAction: get("verifyMissingAction")?.value ?? "parar",
    verifyMissingSequence: get("verifyMissingSequence")?.value ?? "",
    chromeName: get("chromeName")?.value ?? "",
    chromeHtml: get("chromeHtml")?.value ?? "",
    chromeAnalysis: parseChromeAnalysisJson(get("chromeAnalysis")?.value ?? ""),
    chromeTargetMethod: get("chromeTargetMethod")?.value ?? "css",
    chromeTargetValue: get("chromeTargetValue")?.value ?? "",
    chromeActionType: get("chromeActionType")?.value ?? "clicar",
    chromeValueSource: get("chromeValueSource")?.value ?? "texto_fixo",
    chromeActionValue: get("chromeActionValue")?.value ?? "",
    chromeSaveAs: get("chromeSaveAs")?.value ?? "",
    chromeTimeout: parseNumber(get("chromeTimeout")?.value, 10000),
    chromePressAfter: get("chromePressAfter")?.value ?? "",
    chromeSuccessAction: get("chromeSuccessAction")?.value ?? "continuar",
    chromeSuccessBlock: get("chromeSuccessBlock")?.value ?? "",
    chromeSuccessSequence: get("chromeSuccessSequence")?.value ?? "",
    chromeSuccessSequenceDelay: normalizeTransitionDelay(get("chromeSuccessSequenceDelay")?.value),
    chromeFailureAction: get("chromeFailureAction")?.value ?? "parar",
    chromeFailureBlock: get("chromeFailureBlock")?.value ?? "",
    chromeFailureSequence: get("chromeFailureSequence")?.value ?? "",
    chromeFailureSequenceDelay: normalizeTransitionDelay(get("chromeFailureSequenceDelay")?.value),
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(get("chromeRetryCount")?.value, 1))),
    chromeRetryInterval: parseNumber(get("chromeRetryInterval")?.value, 0.5),
    chromeClearBefore: Boolean(get("chromeClearBefore")?.checked),
    chromeFallbackVisual: Boolean(get("chromeFallbackVisual")?.checked),
    chromeFallbackImage: get("chromeFallbackImage")?.value ?? "",
    openUrl: get("openUrl")?.value ?? "",
    openBrowser: get("openBrowser")?.value ?? "padrao",
    openMode: get("openMode")?.value ?? "nova_janela",
    openFullscreen: Boolean(get("openFullscreen")?.checked),
    openWait: parseNumber(get("openWait")?.value, 3),
    programPath: get("programPath")?.value ?? "",
    programParams: get("programParams")?.value ?? "",
    programWait: parseNumber(get("programWait")?.value, 2),
    workbook: get("workbook")?.value ?? "",
    sheet: get("sheet")?.value ?? "",
    column: get("column")?.value ?? "",
    writeValue: get("writeValue")?.value ?? "",
    afterAction: get("afterAction")?.value ?? "nenhuma",
    intervalBetween: parseNumber(get("intervalBetween")?.value, 0.5),
  };
}

function findRoadmapEventByOrder(order) {
  return (state.roadmap?.events ?? []).find((event) => Number(event.order) === Number(order)) || null;
}

function approxEqual(a, b, epsilon = 0.0001) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon;
}

function normalizeStringValue(value) {
  return String(value ?? "").trim();
}

function successFlowChanged(values, details = {}) {
  return (
    normalizeStringValue(values.successAction) !== normalizeStringValue(details.ao_sucesso ?? "continuar")
    || Number(optionalPositiveInt(values.successBlock) || 0) !== Number(details.bloco_sucesso ?? 0)
    || normalizeStringValue(values.successSequence) !== normalizeStringValue(details.sequencia_sucesso ?? "")
    || !approxEqual(
      normalizeTransitionDelay(values.successSequenceDelay),
      normalizeTransitionDelay(details.atraso_antes_sequencia_sucesso ?? 0),
    )
  );
}

function commandCardSnapshot(card) {
  return {
    clientKey: String(card.dataset.clientKey || "").trim(),
    order: Number(card.dataset.order),
    type: String(card.dataset.type || ""),
    values: treeValuesFromCard(card),
  };
}

function setCommandCardRouteDelay(card, routeKind, delayValue) {
  if (!card) {
    return false;
  }
  const normalizedDelay = formatTransitionDelayValue(normalizeTransitionDelay(delayValue));
  const normalizedKind = routeKind === "failure" ? "failure" : "success";
  const selector = normalizedKind === "failure"
    ? '[data-tree-field="failureSequenceDelay"], [data-tree-field="chromeFailureSequenceDelay"]'
    : '[data-tree-field="successSequenceDelay"], [data-tree-field="chromeSuccessSequenceDelay"]';
  const delayField = card.querySelector(selector);
  if (!delayField) {
    return false;
  }
  delayField.value = normalizedDelay;
  return true;
}

function setRoadmapEventRouteDelay(sourceOrder, routeKind, delayValue) {
  const event = findRoadmapEventByOrder(sourceOrder);
  if (!event) {
    return false;
  }
  const details = event.details || event.detalhes || {};
  event.details = details;
  const normalizedDelay = normalizeTransitionDelay(delayValue);
  const normalizedKind = routeKind === "failure" ? "failure" : "success";

  if (normalizedKind === "failure") {
    if (event.type === "chrome_elemento_html") {
      details.atraso_antes_sequencia_falha = normalizedDelay;
      return true;
    }
    details.atraso_antes_sequencia_nao_encontrar = normalizedDelay;
    return true;
  }

  details.atraso_antes_sequencia_sucesso = normalizedDelay;
  return true;
}

function saveCommandJumpDelayFromInput(input) {
  const sourceOrder = Number(input?.dataset?.sourceOrder || 0);
  const routeKind = input?.dataset?.routeKind === "failure" ? "failure" : "success";
  if (!sourceOrder) {
    return;
  }
  const cards = Array.from(commandMapList?.querySelectorAll(`.command-tree-card[data-order="${sourceOrder}"]`) || []);
  const card = cards[cards.length - 1] || null;
  const updatedCards = cards.reduce((count, item) => (
    setCommandCardRouteDelay(item, routeKind, input.value) ? count + 1 : count
  ), 0);
  if (!card || !updatedCards) {
    setMessage("Nao foi possivel atualizar o tempo deste caminho.", "error");
    return;
  }

  setRoadmapEventRouteDelay(sourceOrder, routeKind, input.value);
  const snapshot = commandCardSnapshot(card);
  const clientKey = String(snapshot.clientKey || "").trim();
  if (clientKey) {
    state.commandMapDrafts[clientKey] = {
      type: snapshot.type,
      values: snapshot.values,
    };
  }
  runMutation("Tempo do caminho atualizado", () =>
    invokeCommandCardUpdate(snapshot)
  , () => sourceOrder);
}

function syncCommandMapDraftFromSnapshot(snapshot) {
  const clientKey = String(snapshot?.clientKey || "").trim();
  if (!clientKey || !Number.isFinite(snapshot?.order) || snapshot.order <= 0) {
    return;
  }

  if (commandCardHasUnsavedChanges(snapshot)) {
    state.commandMapDrafts[clientKey] = {
      type: snapshot.type,
      values: snapshot.values,
    };
    return;
  }

  delete state.commandMapDrafts[clientKey];
}

function syncCommandMapDraftFromCard(card) {
  if (!card) {
    return;
  }
  syncCommandMapDraftFromSnapshot(commandCardSnapshot(card));
}

function syncVisibleCommandMapDrafts() {
  getDistinctCommandTreeCards().forEach((card) => {
    syncCommandMapDraftFromCard(card);
  });
}

function getDistinctCommandTreeCards(selector = ".command-tree-card") {
  const cards = Array.from(commandMapList?.querySelectorAll(selector) || []);
  if (!cards.length) {
    return [];
  }

  const cardsByOrder = new Map();
  for (const card of cards) {
    const order = Number(card?.dataset?.order);
    if (!Number.isFinite(order) || order <= 0) {
      continue;
    }
    // When the same block exists twice in the DOM, keep the latest instance.
    cardsByOrder.set(order, card);
  }

  return Array.from(cardsByOrder.values());
}

function commandCardHasUnsavedChanges(snapshot) {
  const event = findRoadmapEventByOrder(snapshot.order);
  if (!event) {
    return false;
  }

  const details = event.details ?? {};
  const values = snapshot.values || {};
  const eventDelay = Number(event.delay ?? 0);

  if (!approxEqual(values.delay, eventDelay)) {
    return true;
  }

  if (snapshot.type === "texto_livre") {
    return normalizeStringValue(values.text) !== normalizeStringValue(event.text)
      || Boolean(values.editableAtRun) !== Boolean(details.editavel_execucao)
      || normalizeStringValue(values.runtimeLabel) !== normalizeStringValue(details.rotulo_execucao ?? "")
      || successFlowChanged(values, details);
  }

  if (snapshot.type === "tecla" || snapshot.type === "atalho") {
    return (
      normalizeStringValue(values.keys) !== normalizeStringValue((event.keys || []).join("+"))
      || Number(values.repeat || 1) !== Number(details.repeticoes ?? 1)
      || successFlowChanged(values, details)
    );
  }

  if (snapshot.type === "mouse_click") {
    return (
      Number(values.x || 0) !== Number(details.x ?? 0)
      || Number(values.y || 0) !== Number(details.y ?? 0)
      || normalizeStringValue(values.button) !== normalizeStringValue(details.botao ?? "left")
      || Number(values.clicks || 1) !== Number(details.cliques ?? details.clicks ?? 1)
      || successFlowChanged(values, details)
    );
  }

  if (snapshot.type === "clicar_imagem") {
    return (
      normalizeStringValue(values.imagePath) !== normalizeStringValue(details.imagem)
      || !approxEqual(values.timeout, details.timeout ?? 10)
      || !approxEqual(values.confidence, details.confianca ?? 0.8)
      || normalizeRecognitionProfile(values.searchProfile, "balanced") !== normalizeRecognitionProfile(details.perfil_busca, "balanced")
      || normalizeRecognitionWindowTitle(values.windowTitle || "") !== normalizeRecognitionWindowTitle(details.janela_alvo ?? "")
      || normalizeStringValue(values.expectedOcrText) !== normalizeStringValue(details.texto_ocr_esperado ?? "")
      || normalizeStringValue(values.recognitionClickMode) !== normalizeStringValue(recognitionClickModeFromDetails(details))
      || successFlowChanged(values, details)
      || normalizeStringValue(values.failureAction) !== normalizeStringValue(details.ao_nao_encontrar ?? "parar")
      || Number(optionalPositiveInt(values.failureBlock) || 0) !== Number(details.bloco_nao_encontrar ?? 0)
      || normalizeStringValue(values.failureSequence) !== normalizeStringValue(details.sequencia_nao_encontrar ?? "")
      || !approxEqual(
        normalizeTransitionDelay(values.failureSequenceDelay),
        normalizeTransitionDelay(details.atraso_antes_sequencia_nao_encontrar ?? 0),
      )
      || Number(values.retryCount || 1) !== Number(details.quantidade_tentativas ?? 1)
      || !approxEqual(values.retryInterval, details.intervalo_tentativas ?? 1)
    );
  }

  if (snapshot.type === "chrome_elemento_html") {
    const action = details.acao ?? {};
    const target = details.alvo ?? {};
    return (
      normalizeStringValue(values.chromeName) !== normalizeStringValue(details.nome ?? "Chrome / Elemento HTML")
      || normalizeStringValue(values.chromeHtml) !== normalizeStringValue(details.html_original ?? "")
      || normalizeStringValue(values.chromeTargetMethod) !== normalizeStringValue(target.metodo ?? "css")
      || normalizeStringValue(values.chromeTargetValue) !== normalizeStringValue(target.valor ?? "")
      || normalizeStringValue(values.chromeActionType) !== normalizeStringValue(action.tipo ?? "clicar")
      || normalizeStringValue(values.chromeValueSource) !== normalizeStringValue(action.origem_valor ?? "texto_fixo")
      || normalizeStringValue(values.chromeActionValue) !== normalizeStringValue(action.valor ?? "")
      || normalizeStringValue(values.chromeSaveAs) !== normalizeStringValue(action.salvar_em ?? "")
      || !approxEqual(values.chromeTimeout, details.timeout ?? 10000)
      || normalizeStringValue(values.chromePressAfter) !== normalizeStringValue(action.pressionar_depois ?? "")
      || normalizeStringValue(values.chromeSuccessAction) !== normalizeStringValue(details.ao_sucesso ?? "continuar")
      || Number(optionalPositiveInt(values.chromeSuccessBlock) || 0) !== Number(details.bloco_sucesso ?? 0)
      || normalizeStringValue(values.chromeSuccessSequence) !== normalizeStringValue(details.sequencia_sucesso ?? "")
      || !approxEqual(
        normalizeTransitionDelay(values.chromeSuccessSequenceDelay),
        normalizeTransitionDelay(details.atraso_antes_sequencia_sucesso ?? 0),
      )
      || normalizeStringValue(values.chromeFailureAction) !== normalizeStringValue(details.ao_falhar ?? "parar")
      || Number(optionalPositiveInt(values.chromeFailureBlock) || 0) !== Number(details.bloco_falha ?? 0)
      || normalizeStringValue(values.chromeFailureSequence) !== normalizeStringValue(details.sequencia_falha ?? "")
      || !approxEqual(
        normalizeTransitionDelay(values.chromeFailureSequenceDelay),
        normalizeTransitionDelay(details.atraso_antes_sequencia_falha ?? 0),
      )
      || Number(values.chromeRetryCount || 1) !== Number(details.quantidade_tentativas ?? 1)
      || !approxEqual(values.chromeRetryInterval, details.intervalo_tentativas ?? 0.5)
      || Boolean(values.chromeClearBefore) !== Boolean(action.limpar_antes ?? true)
      || Boolean(values.chromeFallbackVisual) !== Boolean(details.fallback_visual ?? false)
      || normalizeStringValue(values.chromeFallbackImage) !== normalizeStringValue(details.fallback_imagem ?? "")
    );
  }

  if (snapshot.type === "abrir_url") {
    return (
      normalizeStringValue(values.openUrl) !== normalizeStringValue(details.url)
      || normalizeStringValue(values.openBrowser) !== normalizeStringValue(details.navegador ?? "padrao")
      || normalizeStringValue(values.openMode) !== normalizeStringValue(details.modo_abertura ?? "nova_janela")
      || Boolean(values.openFullscreen) !== Boolean(details.tela_cheia ?? false)
      || !approxEqual(values.openWait, details.aguardar_segundos ?? 3)
      || successFlowChanged(values, details)
    );
  }

  if (snapshot.type === "abrir_programa") {
    return (
      normalizeStringValue(values.programPath) !== normalizeStringValue(details.caminho)
      || normalizeStringValue(values.programParams) !== normalizeStringValue(details.parametros ?? "")
      || !approxEqual(values.programWait, details.aguardar_segundos ?? 2)
      || successFlowChanged(values, details)
    );
  }

  if (snapshot.type === "verificar_estado_botao") {
    return (
      normalizeStringValue(values.verifyName) !== normalizeStringValue(details.nome ?? "Verificar botao")
      || normalizeStringValue(values.verifyActiveImage) !== normalizeStringValue(details.imagem_ativo)
      || normalizeStringValue(values.verifyInactiveImage) !== normalizeStringValue(details.imagem_desativado)
      || !approxEqual(values.verifyTimeout, details.timeout ?? 5)
      || !approxEqual(values.verifyConfidence, details.confianca ?? 0.85)
      || normalizeStringValue(values.verifyActiveAction) !== normalizeStringValue(details.se_ativo?.acao ?? "continuar")
      || normalizeStringValue(values.verifyActiveSequence) !== normalizeStringValue(details.se_ativo?.sequencia ?? "")
      || normalizeStringValue(values.verifyInactiveAction) !== normalizeStringValue(details.se_desativado?.acao ?? "ir_para_sequencia")
      || normalizeStringValue(values.verifyInactiveSequence) !== normalizeStringValue(details.se_desativado?.sequencia ?? "")
      || normalizeStringValue(values.verifyMissingAction) !== normalizeStringValue(details.se_nao_encontrar?.acao ?? "parar")
      || normalizeStringValue(values.verifyMissingSequence) !== normalizeStringValue(details.se_nao_encontrar?.sequencia ?? "")
    );
  }

  if (snapshot.type === "sequencia_planilha") {
    return (
      normalizeStringValue(values.workbook) !== normalizeStringValue(details.arquivo)
      || normalizeStringValue(values.sheet) !== normalizeStringValue(details.aba)
      || normalizeStringValue(values.column) !== normalizeStringValue(details.coluna)
      || normalizeStringValue(values.afterAction) !== normalizeStringValue(details.acao_apos_item_texto ?? "nenhuma")
      || !approxEqual(values.intervalBetween, details.intervalo_entre_itens ?? 0.5)
      || successFlowChanged(values, details)
    );
  }

  if (snapshot.type === "escrever_planilha") {
    return (
      normalizeStringValue(values.workbook) !== normalizeStringValue(details.arquivo)
      || normalizeStringValue(values.sheet) !== normalizeStringValue(details.aba)
      || normalizeStringValue(values.column) !== normalizeStringValue(details.coluna)
      || normalizeStringValue(values.writeValue) !== normalizeStringValue(details.valor)
      || successFlowChanged(values, details)
    );
  }

  if (isLoopMarkerType(snapshot.type)) {
    return snapshot.type === "fim_loop" && successFlowChanged(values, details);
  }

  return false;
}

async function invokeCommandCardUpdate(snapshot) {
  const { order, type, values } = snapshot;

  if (type === "texto_livre") {
    return invoke("update_text_block", {
      order,
      text: values.text,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
      editavelExecucao: Boolean(values.editableAtRun),
      rotuloExecucao: values.runtimeLabel || null,
    });
  }

  if (type === "tecla" || type === "atalho") {
    return invoke("update_key_block", {
      order,
      keys: values.keys,
      repeat: values.repeat,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  if (type === "mouse_click") {
    return invoke("update_mouse_block", {
      order,
      x: values.x,
      y: values.y,
      button: values.button,
      clicks: values.clicks,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  if (type === "clicar_imagem") {
    if (!normalizeStringValue(values.imagePath)) {
      throw new Error(`O bloco ${order} de reconhecimento esta sem referencia visual.`);
    }
    return invoke("update_image_click_block", {
      order,
      imagem: values.imagePath,
      timeout: values.timeout,
      confianca: values.confidence,
      perfilBusca: values.searchProfile,
      modoAreaBusca: "target_window",
      areaBuscaX: 0,
      areaBuscaY: 0,
      areaBuscaLargura: 0,
      areaBuscaAltura: 0,
      janelaAlvo: values.windowTitle?.trim() || null,
      textoOcrEsperado: values.expectedOcrText?.trim() || null,
      clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
      clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
      offsetX: 0,
      offsetY: 0,
      aoNaoEncontrar: values.failureAction,
      sequenciaNaoEncontrar: values.failureAction === "ir_para_sequencia"
        ? values.failureSequence.trim() || null
        : null,
      atrasoSequenciaNaoEncontrar: transitionSequenceDelayArg(values.failureAction, values.failureSequenceDelay),
      blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
      quantidadeTentativas: values.retryCount,
      intervaloTentativas: values.retryInterval,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  if (type === "chrome_elemento_html") {
    if (!normalizeStringValue(values.chromeHtml)) {
      throw new Error(`O bloco ${order} de Chrome HTML esta sem o elemento colado.`);
    }
    const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
    const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
    return invoke("update_chrome_html_block", {
      order,
      nome: details.nome,
      htmlOriginal: details.html_original,
      elemento: details.elemento,
      alvo: details.alvo,
      acao: details.acao,
      timeout: details.timeout,
      fallbackVisual: details.fallback_visual,
      fallbackImagem: details.fallback_imagem || null,
      aoSucesso: details.ao_sucesso,
      blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
      sequenciaSucesso: details.ao_sucesso === "ir_para_sequencia"
        ? optionalSequenceValue(details.sequencia_sucesso)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(details.ao_sucesso, details.atraso_antes_sequencia_sucesso),
      aoFalhar: details.ao_falhar,
      blocoFalha: optionalPositiveInt(details.bloco_falha),
      sequenciaFalha: details.ao_falhar === "ir_para_sequencia"
        ? optionalSequenceValue(details.sequencia_falha)
        : null,
      atrasoSequenciaFalha: transitionSequenceDelayArg(details.ao_falhar, details.atraso_antes_sequencia_falha),
      quantidadeTentativas: details.quantidade_tentativas,
      intervaloTentativas: details.intervalo_tentativas,
      delay: values.delay,
    });
  }

  if (type === "abrir_url") {
    if (!normalizeStringValue(values.openUrl)) {
      throw new Error(`O bloco ${order} de Abrir URL esta sem URL.`);
    }
    return invoke("update_open_url_block", {
      order,
      url: values.openUrl,
      navegador: values.openBrowser || "padrao",
      modoAbertura: values.openMode || "nova_janela",
      telaCheia: Boolean(values.openFullscreen),
      aguardarSegundos: values.openWait,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  if (type === "abrir_programa") {
    if (!normalizeStringValue(values.programPath)) {
      throw new Error(`O bloco ${order} de Abrir Programa esta sem executavel.`);
    }
    return invoke("update_open_program_block", {
      order,
      caminho: values.programPath,
      parametros: values.programParams || null,
      aguardarSegundos: values.programWait,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  if (type === "verificar_estado_botao") {
    if (!normalizeStringValue(values.verifyActiveImage) || !normalizeStringValue(values.verifyInactiveImage)) {
      throw new Error(`O bloco ${order} de verificacao esta sem as referencias ativa e desativada.`);
    }
    return invoke("update_verify_button_state_block", {
      order,
      nome: values.verifyName || "Verificar botao",
      imagemAtivo: values.verifyActiveImage,
      imagemDesativado: values.verifyInactiveImage,
      timeout: values.verifyTimeout,
      confianca: values.verifyConfidence,
      acaoAtivo: values.verifyActiveAction,
      sequenciaAtivo: optionalSequenceValue(values.verifyActiveSequence),
      acaoDesativado: values.verifyInactiveAction,
      sequenciaDesativado: optionalSequenceValue(values.verifyInactiveSequence),
      acaoNaoEncontrar: values.verifyMissingAction,
      sequenciaNaoEncontrar: optionalSequenceValue(values.verifyMissingSequence),
      delay: values.delay,
    });
  }

  if (type === "sequencia_planilha") {
    return invoke("update_spreadsheet_block", {
      order,
      workbook: values.workbook || null,
      sheet: values.sheet,
      column: values.column,
      afterAction: values.afterAction,
      intervalBetween: values.intervalBetween,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  if (type === "escrever_planilha") {
    if (!normalizeStringValue(values.sheet) || !normalizeStringValue(values.column)) {
      throw new Error(`Configure a aba e a coluna do bloco ${order} de escrita na planilha.`);
    }
    return invoke("update_write_spreadsheet_block", {
      order,
      workbook: values.workbook || null,
      sheet: values.sheet,
      column: values.column,
      value: values.writeValue,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  if (isLoopMarkerType(type)) {
    return invoke("update_loop_marker_block", {
      order,
      delay: values.delay,
      sequencia: currentSequenceName(),
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    });
  }

  return null;
}

function getPendingCommandMapSnapshots() {
  syncVisibleCommandMapDrafts();

  const pending = [];
  for (const [clientKey, draft] of Object.entries(state.commandMapDrafts || {})) {
    const event = findRoadmapEventByClientKey(clientKey);
    if (!event) {
      delete state.commandMapDrafts[clientKey];
      continue;
    }

    const snapshot = {
      clientKey,
      order: Number(event.order),
      type: String(event.type || draft.type || ""),
      values: draft.values || {},
    };

    if (commandCardHasUnsavedChanges(snapshot)) {
      pending.push(snapshot);
    } else {
      delete state.commandMapDrafts[clientKey];
    }
  }

  return pending;
}

async function persistCommandMapDraftsForExecution(options = {}) {
  const { onProgress = null } = options;
  const pending = getPendingCommandMapSnapshots();
  if (!pending.length) {
    if (typeof onProgress === "function") {
      onProgress({
        current: 0,
        total: 0,
        percent: 100,
        done: true,
      });
    }
    return { saved: 0, total: 0, roadmap: null };
  }

  let latestRoadmap = null;
  const total = pending.length;
  for (let index = 0; index < pending.length; index += 1) {
    const snapshot = pending[index];
    latestRoadmap = await invokeCommandCardUpdate(snapshot);
    if (typeof onProgress === "function") {
      onProgress({
        current: index + 1,
        total,
        percent: Math.round(((index + 1) / total) * 100),
        snapshot,
        done: index + 1 === total,
      });
    }
  }

  if (latestRoadmap) {
    applyRoadmap(latestRoadmap);
    await refreshAutomationLibrary();
    await refreshTestLoopData();
  }

  if (pending.length) {
    setCommandMapSaveState({
      running: false,
      dirty: false,
      percent: 100,
      status: "Mapa sincronizado e pronto para o loop.",
    });
  }

  return {
    saved: total,
    total,
    roadmap: latestRoadmap,
  };
}

async function autoSaveCommandMapPageSwitch() {
  const pending = getPendingCommandMapSnapshots();
  if (!pending.length) {
    return true;
  }

  try {
    setCommandMapSaveState({
      running: true,
      dirty: true,
      percent: 0,
      status: "Salvando pagina automaticamente...",
    });

    const result = await persistCommandMapDraftsForExecution({
      onProgress: ({ current, total, percent }) => {
        setCommandMapSaveState({
          running: total > 0 && current < total,
          dirty: true,
          percent,
          status: total
            ? `Salvando pagina automaticamente ${current}/${total}...`
            : "Nenhuma alteracao pendente nesta pagina.",
        });
      },
    });

    setCommandMapSaveState({
      running: false,
      dirty: false,
      percent: 100,
      status: result.total ? "Pagina salva automaticamente." : "Mapa sincronizado e pronto para o loop.",
    });
    return true;
  } catch (error) {
    setCommandMapSaveState({
      running: false,
      dirty: true,
      status: `Falha ao salvar a pagina automaticamente: ${String(error)}`,
    });
    setMessage(`Nao foi possivel salvar a pagina automaticamente: ${String(error)}`, "error");
    return false;
  }
}

function insertValuesFromPanel(panelElement) {
  const get = (field) => panelElement.querySelector(`[data-insert-field="${field}"]`);
  return {
    type: state.insertPanel?.type ?? "key",
    targetOrder: Number(panelElement.dataset.targetOrder),
    position: state.insertPanel?.position ?? "after",
    text: get("text")?.value ?? "",
    editableAtRun: Boolean(get("editableAtRun")?.checked ?? state.insertPanel?.editableAtRun),
    runtimeLabel: get("runtimeLabel")?.value ?? state.insertPanel?.runtimeLabel ?? "",
    keys: get("keys")?.value ?? "",
    repeat: Math.max(1, Math.trunc(parseNumber(get("repeat")?.value, state.insertPanel?.repeat ?? 1))),
    x: parseNumber(get("x")?.value, 0),
    y: parseNumber(get("y")?.value, 0),
    button: get("button")?.value ?? "left",
    clicks: Math.max(1, Math.trunc(parseNumber(get("clicks")?.value, 1))),
    imagePath: get("imagePath")?.value ?? state.insertPanel?.imagePath ?? "",
    timeout: parseNumber(get("timeout")?.value, state.insertPanel?.timeout ?? 10),
    confidence: parseNumber(get("confidence")?.value, state.insertPanel?.confidence ?? 0.8),
    searchProfile: normalizeRecognitionProfile(get("searchProfile")?.value, state.insertPanel?.searchProfile ?? "balanced"),
    searchAreaMode: "target_window",
    searchAreaX: 0,
    searchAreaY: 0,
    searchAreaWidth: 0,
    searchAreaHeight: 0,
    windowTitle: normalizeRecognitionWindowTitle(get("windowTitle")?.value ?? state.insertPanel?.windowTitle ?? ""),
    expectedOcrText: get("expectedOcrText")?.value ?? state.insertPanel?.expectedOcrText ?? "",
    recognitionClickMode: get("clickOnFind")?.value ?? state.insertPanel?.recognitionClickMode ?? "single",
    failureAction: get("failureAction")?.value ?? state.insertPanel?.failureAction ?? "parar",
    failureBlock: get("failureBlock")?.value ?? state.insertPanel?.failureBlock ?? "",
    failureSequence: get("failureSequence")?.value ?? state.insertPanel?.failureSequence ?? "pagina_2",
    failureSequenceDelay: normalizeTransitionDelay(get("failureSequenceDelay")?.value ?? state.insertPanel?.failureSequenceDelay ?? 0),
    retryCount: Math.max(1, Math.trunc(parseNumber(get("retryCount")?.value, state.insertPanel?.retryCount ?? 1))),
    retryInterval: parseNumber(get("retryInterval")?.value, state.insertPanel?.retryInterval ?? 1),
    successAction: get("successAction")?.value ?? state.insertPanel?.successAction ?? "continuar",
    successBlock: get("successBlock")?.value ?? state.insertPanel?.successBlock ?? "",
    successSequence: get("successSequence")?.value ?? state.insertPanel?.successSequence ?? "pagina_2",
    successSequenceDelay: normalizeTransitionDelay(get("successSequenceDelay")?.value ?? state.insertPanel?.successSequenceDelay ?? 0),
    chromeName: get("chromeName")?.value ?? state.insertPanel?.chromeName ?? "Chrome / Elemento HTML",
    chromeHtml: get("chromeHtml")?.value ?? state.insertPanel?.chromeHtml ?? "",
    chromeAnalysis: parseChromeAnalysisJson(get("chromeAnalysis")?.value ?? state.insertPanel?.chromeAnalysis ?? ""),
    chromeTargetMethod: get("chromeTargetMethod")?.value ?? state.insertPanel?.chromeTargetMethod ?? "css",
    chromeTargetValue: get("chromeTargetValue")?.value ?? state.insertPanel?.chromeTargetValue ?? "",
    chromeActionType: get("chromeActionType")?.value ?? state.insertPanel?.chromeActionType ?? "clicar",
    chromeValueSource: get("chromeValueSource")?.value ?? state.insertPanel?.chromeValueSource ?? "texto_fixo",
    chromeActionValue: get("chromeActionValue")?.value ?? state.insertPanel?.chromeActionValue ?? "",
    chromeSaveAs: get("chromeSaveAs")?.value ?? state.insertPanel?.chromeSaveAs ?? "",
    chromeTimeout: parseNumber(get("chromeTimeout")?.value, state.insertPanel?.chromeTimeout ?? 10000),
    chromePressAfter: get("chromePressAfter")?.value ?? state.insertPanel?.chromePressAfter ?? "",
    chromeSuccessAction: get("chromeSuccessAction")?.value ?? state.insertPanel?.chromeSuccessAction ?? "continuar",
    chromeSuccessBlock: get("chromeSuccessBlock")?.value ?? state.insertPanel?.chromeSuccessBlock ?? "",
    chromeSuccessSequence: get("chromeSuccessSequence")?.value ?? state.insertPanel?.chromeSuccessSequence ?? "pagina_2",
    chromeSuccessSequenceDelay: normalizeTransitionDelay(get("chromeSuccessSequenceDelay")?.value ?? state.insertPanel?.chromeSuccessSequenceDelay ?? 0),
    chromeFailureAction: get("chromeFailureAction")?.value ?? state.insertPanel?.chromeFailureAction ?? "parar",
    chromeFailureBlock: get("chromeFailureBlock")?.value ?? state.insertPanel?.chromeFailureBlock ?? "",
    chromeFailureSequence: get("chromeFailureSequence")?.value ?? state.insertPanel?.chromeFailureSequence ?? "pagina_2",
    chromeFailureSequenceDelay: normalizeTransitionDelay(get("chromeFailureSequenceDelay")?.value ?? state.insertPanel?.chromeFailureSequenceDelay ?? 0),
    chromeRetryCount: Math.max(1, Math.trunc(parseNumber(get("chromeRetryCount")?.value, state.insertPanel?.chromeRetryCount ?? 1))),
    chromeRetryInterval: parseNumber(get("chromeRetryInterval")?.value, state.insertPanel?.chromeRetryInterval ?? 0.5),
    chromeClearBefore: Boolean(get("chromeClearBefore")?.checked ?? state.insertPanel?.chromeClearBefore),
    chromeFallbackVisual: Boolean(get("chromeFallbackVisual")?.checked ?? state.insertPanel?.chromeFallbackVisual),
    chromeFallbackImage: get("chromeFallbackImage")?.value ?? state.insertPanel?.chromeFallbackImage ?? "",
    openUrl: get("openUrl")?.value ?? state.insertPanel?.openUrl ?? "",
    openBrowser: get("openBrowser")?.value ?? state.insertPanel?.openBrowser ?? "padrao",
    openMode: get("openMode")?.value ?? state.insertPanel?.openMode ?? "nova_janela",
    openFullscreen: Boolean(get("openFullscreen")?.checked ?? state.insertPanel?.openFullscreen),
    openWait: parseNumber(get("openWait")?.value, state.insertPanel?.openWait ?? 3),
    programPath: get("programPath")?.value ?? state.insertPanel?.programPath ?? "",
    programParams: get("programParams")?.value ?? state.insertPanel?.programParams ?? "",
    programWait: parseNumber(get("programWait")?.value, state.insertPanel?.programWait ?? 2),
    delay: parseNumber(get("delay")?.value, 0),
    workbook: get("workbook")?.value ?? state.insertPanel?.workbook ?? "",
    sheet: get("sheet")?.value ?? state.insertPanel?.sheet ?? "",
    column: get("column")?.value ?? state.insertPanel?.column ?? "",
    writeValue: get("writeValue")?.value ?? state.insertPanel?.writeValue ?? "OK",
    afterAction: get("afterAction")?.value ?? "nenhuma",
    intervalBetween: parseNumber(get("intervalBetween")?.value, 0.5),
  };
}

async function persistCommandMapDrafts() {
  const focusedOrder = Number(state.commandMapFocusOrder);
  if (!Number.isFinite(focusedOrder) || focusedOrder <= 0) {
    return;
  }

  const card = commandMapList?.querySelector(`.command-tree-card[data-order="${focusedOrder}"]`);
  if (!card) {
    return;
  }

  const order = Number(card.dataset.order);
  const type = card.dataset.type;
  const values = treeValuesFromCard(card);
  const roadmap = await invokeCommandCardUpdate({ order, type, values });

  if (roadmap) {
    applyRoadmap(roadmap);
    await refreshAutomationLibrary();
    await refreshTestLoopData();
  }
}

async function saveEntireCommandMap() {
  try {
    setCommandMapSaveState({
      running: true,
      dirty: true,
      percent: 0,
      status: "Salvando todo o mapa...",
    });

    const result = await persistCommandMapDraftsForExecution({
      onProgress: ({ current, total, percent }) => {
        const status = total
          ? `Salvando blocos ${current}/${total} para preparar o loop.`
          : "Nenhuma alteracao pendente no mapa.";
        setCommandMapSaveState({
          running: total > 0 && current < total,
          percent,
          status,
        });
      },
    });

    if (!result.total) {
      setCommandMapSaveState({
        running: false,
        dirty: false,
        percent: 100,
        status: "Mapa ja estava salvo e pronto para o loop.",
      });
      setMessage("Mapa ja estava salvo e pronto para o loop.", "success");
      return;
    }

    setCommandMapSaveState({
      running: false,
      dirty: false,
      percent: 100,
      status: `Mapa salvo com sucesso. ${result.saved} bloco(s) pronto(s) para o loop.`,
    });
    setMessage("Mapa salvo com sucesso e pronto para o loop.", "success");
  } catch (error) {
    setCommandMapSaveState({
      running: false,
      dirty: true,
      status: `Falha ao salvar o mapa: ${String(error)}`,
    });
    throw error;
  }
}

async function persistVisibleRecognitionDrafts() {
  const cards = getDistinctCommandTreeCards('.command-tree-card[data-type="clicar_imagem"]');
  if (!cards.length) {
    return;
  }

  for (const card of cards) {
    const order = Number(card.dataset.order);
    if (!Number.isFinite(order) || order <= 0) {
      continue;
    }

    const values = treeValuesFromCard(card);
    if (!String(values.imagePath || "").trim()) {
      continue;
    }

    const roadmap = await invoke("update_image_click_block", {
      order,
      imagem: values.imagePath,
      timeout: values.timeout,
      confianca: values.confidence,
      perfilBusca: values.searchProfile,
      modoAreaBusca: "target_window",
      areaBuscaX: 0,
      areaBuscaY: 0,
      areaBuscaLargura: 0,
      areaBuscaAltura: 0,
      janelaAlvo: values.windowTitle?.trim() || null,
      textoOcrEsperado: values.expectedOcrText?.trim() || null,
      clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
      clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
      offsetX: 0,
      offsetY: 0,
      aoNaoEncontrar: values.failureAction,
      sequenciaNaoEncontrar: values.failureAction === "ir_para_sequencia"
        ? values.failureSequence.trim() || null
        : null,
      blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
      quantidadeTentativas: values.retryCount,
      intervaloTentativas: values.retryInterval,
      delay: values.delay,
    });
    if (roadmap) {
      applyRoadmap(roadmap);
    }
  }

  await refreshAutomationLibrary();
  await refreshTestLoopData();
}

function focusEditorBlock(order) {
  setWorkspaceTab("commands");
  requestAnimationFrame(() => {
    setCommandMapFocus(order, "auto");
    const target = commandMapList?.querySelector(`.command-tree-card[data-order="${order}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.style.boxShadow = "0 0 0 1px rgba(223, 109, 58, 0.42), 0 0 0 10px rgba(223, 109, 58, 0.1)";
      setTimeout(() => {
        target.style.boxShadow = "";
      }, 1400);
    }
  });
}

document.getElementById("addTextButton").addEventListener("click", () => {
  const text = textInput.value.trimEnd();
  if (!text) {
    setMessage("Digite um texto antes de adicionar o bloco.", "error");
    return;
  }
  runMutation("Texto adicionado", () =>
    invoke("add_text_block", {
      text: text.includes("\n") ? text : text,
      delay: parseNumber(textDelay.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
      editavelExecucao: false,
      rotuloExecucao: null,
    })
  , focusLastCommandMapCard);
});

mapZoomRange.addEventListener("input", (event) => {
  setCommandMapZoom(Number(event.target.value) / 100);
});

mapZoomOutButton.addEventListener("click", () => {
  setCommandMapZoom(Math.round((state.commandMapZoom - 0.05) * 100) / 100);
});

mapZoomInButton.addEventListener("click", () => {
  setCommandMapZoom(Math.round((state.commandMapZoom + 0.05) * 100) / 100);
});

window.addEventListener("resize", () => {
  if (state.activeTab === "commands") {
    scheduleCommandMapAutoFit();
    scheduleCommandConnectorLayout();
  }
  if (state.activeTab === "assist") {
    requestAnimationFrame(() => {
      syncAssistEdgeSpacers();
      if (state.assist.mode === "running" && state.assist.currentOrder != null) {
        centerAssistOrder(state.assist.currentOrder, "auto");
      } else {
        centerFirstAssistOrder("auto");
      }
    });
  }
});

commandMapList?.addEventListener("scroll", () => {
  if (state.activeTab === "commands" && state.insertPanel) {
    scheduleCommandConnectorLayout();
  }
}, { passive: true });

mapPrevButton?.addEventListener("click", () => {
  moveCommandMapFocus(-1);
});

mapNextButton?.addEventListener("click", () => {
  moveCommandMapFocus(1);
});

commandMapPageTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-command-page]");
  if (!button) {
    return;
  }
  void switchCommandMapPage(button.dataset.commandPage || "principal");
});

assistInitialSequenceSelect?.addEventListener("change", () => {
  saveAssistInitialSequence(assistInitialSequenceSelect.value).catch((error) => {
    renderAssistSequenceSettings();
    setMessage(String(error), "error");
  });
});

assistSequenceModeList?.addEventListener("change", (event) => {
  const toggle = event.target.closest("[data-assist-sequence-toggle]");
  if (!toggle) {
    return;
  }
  saveAssistSequenceExecutionMode(toggle.dataset.assistSequenceToggle || "principal", Boolean(toggle.checked)).catch((error) => {
    renderAssistSequenceSettings();
    setMessage(String(error), "error");
  });
});

assistControlTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-assist-control-tab]");
  if (!button) {
    return;
  }
  setAssistControlTab(button.dataset.assistControlTab || "target");
});

assistEditableTextList?.addEventListener("input", (event) => {
  const field = event.target.closest("[data-editable-text-order]");
  if (!field) {
    return;
  }
  state.editableTextOverrides[String(field.dataset.editableTextOrder || "")] = field.value ?? "";
});

studioControlEditableTextList?.addEventListener("input", (event) => {
  const field = event.target.closest("[data-studio-control-editable-order]");
  if (!field) {
    return;
  }
  state.remoteControl.editableTextOverrides[String(field.dataset.studioControlEditableOrder || "")] = field.value ?? "";
});

commandMapPageModeSelect?.addEventListener("change", () => {
  if (commandMapPageModeSelect.value !== "loop_planilha" && commandMapPageAfterLoopSelect) {
    commandMapPageAfterLoopSelect.value = "";
  }
  renderCommandMapPageExecutionSettings();
  saveCurrentPageExecutionSettings().catch((error) => setMessage(String(error), "error"));
});

commandMapPageAfterLoopSelect?.addEventListener("change", () => {
  saveCurrentPageExecutionSettings().catch((error) => setMessage(String(error), "error"));
});

document.getElementById("addKeyButton").addEventListener("click", () => {
  const keys = keyInput.value.trim();
  if (!keys) {
    setMessage("Informe uma tecla ou um atalho.", "error");
    return;
  }
  runMutation("Bloco de teclado adicionado", () =>
    invoke("add_key_block", {
      keys,
      repeat: Math.max(1, Math.trunc(parseNumber(keyRepeatInput.value, 1))),
      delay: parseNumber(keyDelay.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

document.getElementById("addMouseButton").addEventListener("click", () => {
  runMutation("Bloco de mouse adicionado", () =>
    invoke("add_mouse_block", {
      x: parseNumber(mouseXInput.value, 0),
      y: parseNumber(mouseYInput.value, 0),
      button: mouseButtonInput.value,
      clicks: Math.max(1, Math.trunc(parseNumber(mouseClicksInput.value, 1))),
      delay: parseNumber(mouseDelay.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

document.getElementById("addImageButton").addEventListener("click", () => {
  const imagePath = imagePathInput.value.trim();
  if (!imagePath) {
    setMessage("Selecione uma referencia visual antes de adicionar o bloco.", "error");
    return;
  }
  runMutation("Bloco de reconhecimento adicionado", () =>
    invoke("add_image_click_block", {
      imagem: imagePath,
      timeout: parseNumber(imageTimeoutInput.value, 10),
      confianca: parseNumber(imageConfidenceInput.value, 0.8),
      perfilBusca: normalizeRecognitionProfile(imageSearchProfileInput.value, "balanced"),
      modoAreaBusca: "target_window",
      areaBuscaX: 0,
      areaBuscaY: 0,
      areaBuscaLargura: 0,
      areaBuscaAltura: 0,
      janelaAlvo: null,
      textoOcrEsperado: null,
      clicar: recognitionClicksFromMode(imageClickModeInput.value, 1) > 0,
      clicks: recognitionClicksFromMode(imageClickModeInput.value, 1),
      offsetX: 0,
      offsetY: 0,
      aoNaoEncontrar: imageFailureActionInput.value || "parar",
      sequenciaNaoEncontrar: (imageFailureActionInput.value || "parar") === "ir_para_sequencia"
        ? normalizeSequenceName(imageFailureSequenceInput?.value || "pagina_2")
        : null,
      blocoNaoEncontrar: optionalPositiveInt(imageFailureBlockInput.value),
      quantidadeTentativas: Math.max(1, Math.trunc(parseNumber(imageRetryCountInput.value, 1))),
      intervaloTentativas: parseNumber(imageRetryIntervalInput.value, 1),
      delay: parseNumber(imageDelayInput.value, 0),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

analyzeChromeHtmlButton?.addEventListener("click", () => {
  analyzeChromeHtmlForComposer().catch((error) => setMessage(String(error), "error"));
});

chromeHtmlInput?.addEventListener("paste", () => {
  setTimeout(() => {
    analyzeChromeHtmlForComposer().catch(() => {});
  }, 80);
});

chromeTargetMethodInput?.addEventListener("change", () => {
  const analysis = parseChromeAnalysisJson(chromeAnalysisJsonInput?.value);
  const selector = findChromeSelectorByMethod(analysis, chromeTargetMethodInput.value);
  if (chromeTargetValueInput && selector?.valor) {
    chromeTargetValueInput.value = selector.valor;
  }
});

selectChromeFallbackImageButton?.addEventListener("click", () => {
  openImagePicker({ scope: "composer-chrome-fallback" });
});

addChromeHtmlButton?.addEventListener("click", () => {
  const values = composerChromeValues();
  if (!values.chromeHtml.trim()) {
    setMessage("Cole o HTML do elemento antes de adicionar o bloco Chrome.", "error");
    return;
  }
  runMutation("Bloco Chrome HTML adicionado", async () => {
    const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
    const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
    return invoke("add_chrome_html_block", {
      nome: details.nome,
      htmlOriginal: details.html_original,
      elemento: details.elemento,
      alvo: details.alvo,
      acao: details.acao,
      timeout: details.timeout,
      fallbackVisual: details.fallback_visual,
      fallbackImagem: details.fallback_imagem || null,
      aoSucesso: details.ao_sucesso,
      blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
      sequenciaSucesso: details.ao_sucesso === "ir_para_sequencia"
        ? optionalSequenceValue(details.sequencia_sucesso)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(details.ao_sucesso, details.atraso_antes_sequencia_sucesso),
      aoFalhar: details.ao_falhar,
      blocoFalha: optionalPositiveInt(details.bloco_falha),
      sequenciaFalha: details.ao_falhar === "ir_para_sequencia"
        ? optionalSequenceValue(details.sequencia_falha)
        : null,
      atrasoSequenciaFalha: transitionSequenceDelayArg(details.ao_falhar, details.atraso_antes_sequencia_falha),
      quantidadeTentativas: details.quantidade_tentativas,
      intervaloTentativas: details.intervalo_tentativas,
      delay: values.delay,
      sequencia: currentSequenceName(),
    });
  }, focusLastCommandMapCard);
});

document.getElementById("addVerifyButton").addEventListener("click", () => {
  if (!verifyActiveImageInput.value.trim() || !verifyInactiveImageInput.value.trim()) {
    setMessage("Selecione as referencias ativa e desativada antes de adicionar a verificacao.", "error");
    return;
  }
  runMutation("Bloco de verificacao adicionado", () =>
    invoke("add_verify_button_state_block", {
      nome: verifyNameInput.value.trim() || "Verificar botao",
      imagemAtivo: verifyActiveImageInput.value.trim(),
      imagemDesativado: verifyInactiveImageInput.value.trim(),
      timeout: parseNumber(verifyTimeoutInput.value, 5),
      confianca: parseNumber(verifyConfidenceInput.value, 0.85),
      acaoAtivo: verifyActiveActionInput.value,
      sequenciaAtivo: optionalSequenceValue(verifyActiveSequenceInput.value),
      acaoDesativado: verifyInactiveActionInput.value,
      sequenciaDesativado: optionalSequenceValue(verifyInactiveSequenceInput.value),
      acaoNaoEncontrar: verifyMissingActionInput.value,
      sequenciaNaoEncontrar: optionalSequenceValue(verifyMissingSequenceInput.value),
      delay: parseNumber(verifyDelayInput.value, 0),
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

captureMouseButton.addEventListener("click", () => {
  beginMouseCapture({ scope: "composer-mouse" });
});

captureImageButton?.addEventListener("click", () => {
  captureImageToProject({ scope: "composer-image" });
});

openImagesFolderButton?.addEventListener("click", async () => {
  try {
    const openedPath = await invoke("open_images_folder");
    setMessage(`Pasta de imagens aberta: ${openedPath}`, "success");
  } catch (error) {
    setMessage(String(error), "error");
  }
});

openRecognitionDiagnosticsButton?.addEventListener("click", async () => {
  try {
    const openedPath = await invoke("open_recognition_diagnostics_folder");
    setMessage(`Pasta de diagnosticos aberta: ${openedPath}`, "success");
  } catch (error) {
    setMessage(String(error), "error");
  }
});

selectImageButton.addEventListener("click", () => {
  openImagePicker({ scope: "composer-image" });
});

testImageRecognitionButton?.addEventListener("click", () => {
  runImageRecognitionTest({
    imagePath: imagePathInput.value.trim(),
    timeout: parseNumber(imageTimeoutInput.value, 10),
    confidence: parseNumber(imageConfidenceInput.value, 0.8),
    searchProfile: normalizeRecognitionProfile(imageSearchProfileInput.value, "balanced"),
  }, { inheritWindowFallback: true });
});

selectVerifyActiveImageButton.addEventListener("click", () => {
  openImagePicker({ scope: "composer-verify-active" });
});

selectVerifyInactiveImageButton.addEventListener("click", () => {
  openImagePicker({ scope: "composer-verify-inactive" });
});

document.getElementById("addSpreadsheetButton").addEventListener("click", () => {
  if (!sheetSelect.value || !columnSelect.value) {
    setMessage("Escolha uma aba e uma coluna da planilha.", "error");
    return;
  }
  runMutation("Loop da planilha adicionado", () =>
    invoke("add_spreadsheet_block", {
      workbook: composerWorkbookSelect.value || state.composerWorkbookId || null,
      sheet: sheetSelect.value,
      column: columnSelect.value,
      delay: parseNumber(spreadsheetDelay.value, 0),
      afterAction: afterActionInput.value.trim() || "nenhuma",
      intervalBetween: parseNumber(betweenItemsInput.value, 0.5),
      sequencia: currentSequenceName(),
      aoSucesso: "continuar",
      blocoSucesso: null,
    })
  , focusLastCommandMapCard);
});

addLoopStartButton?.addEventListener("click", () => {
  runMutation("Inicio do loop adicionado", () =>
    invoke("add_loop_start_block", {
      delay: 0,
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

addLoopEndButton?.addEventListener("click", () => {
  runMutation("Fim do loop adicionado", () =>
    invoke("add_loop_end_block", {
      delay: 0,
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

afterActionCaptureButton.addEventListener("click", () => {
  beginKeyCapture({ scope: "composer-after-action", field: "afterAction" });
});

sheetSelect.addEventListener("change", () => {
  populateColumnSelect(sheetSelect.value);
});

composerWorkbookSelect.addEventListener("change", () => {
  state.composerWorkbookId = composerWorkbookSelect.value;
  populateSheetSelect("");
});

editorTabButton.addEventListener("click", () => setWorkspaceTab("commands"));
assistTabButton.addEventListener("click", () => setWorkspaceTab("assist"));
commandTabButton.addEventListener("click", () => setWorkspaceTab("commands"));
workbookTabButton.addEventListener("click", () => setWorkspaceTab("workbook"));
launcherTabButton.addEventListener("click", () => setWorkspaceTab("launcher"));
remoteControlTabButton?.addEventListener("click", () => setWorkspaceTab("remote-control"));
agentScreenTabButton?.addEventListener("click", () => setWorkspaceTab("agent-screen"));
smartRecorderTabButton?.addEventListener("click", () => setWorkspaceTab("smart-recorder"));
smartRecorderStartButton?.addEventListener("click", () => {
  startSmartRecorder();
});
smartRecorderStopButton?.addEventListener("click", () => {
  stopSmartRecorder();
});
smartRecorderSendButton?.addEventListener("click", () => {
  sendSmartRecorderEventsToMap();
});
smartRecorderTrack?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-smart-recorder-action]");
  if (!actionButton) return;
  const card = actionButton.closest("[data-smart-recorder-id]");
  if (actionButton.dataset.smartRecorderAction === "adjust-image") {
    adjustSmartRecorderClickImage(card?.dataset.smartRecorderId || "");
  } else if (actionButton.dataset.smartRecorderAction === "confirm-click") {
    confirmSmartRecorderClickArea(card);
  } else if (actionButton.dataset.smartRecorderAction === "delete-event") {
    deleteSmartRecorderEvent(card?.dataset.smartRecorderId || "");
  }
});
smartRecorderTrack?.addEventListener("keydown", (event) => {
  const delayInput = event.target.closest("[data-smart-recorder-delay-id]");
  if (!delayInput || event.key !== "Enter") return;
  event.preventDefault();
  delayInput.blur();
  updateSmartRecorderEventDelay(delayInput);
});
smartRecorderTrack?.addEventListener("focusout", (event) => {
  const delayInput = event.target.closest("[data-smart-recorder-delay-id]");
  if (delayInput) {
    updateSmartRecorderEventDelay(delayInput);
  }
});
document.getElementById("openEditorFromMap").addEventListener("click", () => setWorkspaceTab("commands"));
tutorialReplayButton?.addEventListener("click", () => openStudioTutorial({ force: true }));
studioTutorialNextButton?.addEventListener("click", () => {
  if (studioTutorialActiveIndex >= STUDIO_TUTORIAL_STEPS.length - 1) {
    closeStudioTutorial();
    return;
  }
  studioTutorialActiveIndex += 1;
  renderStudioTutorialStep();
});
studioTutorialPrevButton?.addEventListener("click", () => {
  studioTutorialActiveIndex = Math.max(0, studioTutorialActiveIndex - 1);
  renderStudioTutorialStep();
});
studioTutorialSkipButton?.addEventListener("click", () => closeStudioTutorial());
studioTutorialOverlay?.addEventListener("click", (event) => {
  if (event.target === studioTutorialOverlay) {
    closeStudioTutorial();
  }
});
window.addEventListener("resize", () => {
  scheduleStudioTutorialPosition();
});
window.addEventListener("keydown", (event) => {
  if (!studioTutorialOpen) {
    return;
  }
  if (event.key === "Escape") {
    closeStudioTutorial();
  } else if (event.key === "ArrowRight") {
    studioTutorialNextButton?.click();
  } else if (event.key === "ArrowLeft") {
    studioTutorialPrevButton?.click();
  }
});
commandMapChromeToggleButton?.addEventListener("click", () => {
  state.commandMapChromeCollapsed = !state.commandMapChromeCollapsed;
  applyCommandMapChromeMode();
  if (state.activeTab === "commands" && state.commandMapFocusOrder) {
    requestAnimationFrame(() => centerCommandMapOrder(state.commandMapFocusOrder, "auto"));
  }
});

newAutomationButton.addEventListener("click", () => {
  setLauncherCreateOpen(true);
});

cancelCreateAutomationButton.addEventListener("click", () => {
  setLauncherCreateOpen(false);
});

confirmCreateAutomationButton.addEventListener("click", async () => {
  state.library.createDraft.nome = newAutomationNameInput.value.trim();
  state.library.createDraft.categoria = newAutomationCategoryInput.value.trim();
  state.library.createDraft.descricao = newAutomationDescriptionInput.value.trim();
  await createAutomationFromDraft();
});

launcherSearchInput.addEventListener("input", () => {
  state.library.search = launcherSearchInput.value;
  renderLauncherLibrary();
});

launcherCategoryFilter.addEventListener("change", () => {
  state.library.category = launcherCategoryFilter.value;
  renderLauncherLibrary();
});

launcherCreatedFromInput.addEventListener("change", () => {
  state.library.createdFrom = launcherCreatedFromInput.value;
  renderLauncherLibrary();
});

launcherUpdatedFromInput.addEventListener("change", () => {
  state.library.updatedFrom = launcherUpdatedFromInput.value;
  renderLauncherLibrary();
});

launcherSortInput.addEventListener("change", () => {
  state.library.sort = launcherSortInput.value;
  renderLauncherLibrary();
});

launcherFiltersToggleButton?.addEventListener("click", () => {
  if (launcherExtraFilters) {
    launcherExtraFilters.hidden = true;
  }
});

launcherList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-library-action]");
  if (!button) {
    return;
  }
  const card = button.closest("[data-automation-id]");
  const automationId = card?.dataset.automationId;
  if (!automationId) {
    return;
  }
  const action = button.dataset.libraryAction;

  try {
    if (action === "create") {
      setLauncherCreateOpen(true);
      return;
    }

    if (action === "import") {
      if (!confirmLeaveEditorIfDirty()) {
        return;
      }
      const selectedPath = await openNativeFileDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Automacao FlowDetect", extensions: ["zip"] }],
      });
      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }
      setBusy("Importando ZIP");
      const result = await invoke("import_saved_automation_zip_from_file_path", {
        filePath: selectedPath,
      });
      applyPersistedRoadmap(result);
      await refreshTestLoopData();
      state.library.items = result.library?.items || state.library.items;
      state.library.categories = result.library?.categories || state.library.categories;
      state.library.activeId = result.library?.active_id || result.active_automation?.id || state.library.activeId;
      if (result.active_automation?.nome) {
        exportNameInput.value = result.active_automation.nome;
      }
      setLauncherCreateOpen(false);
      renderLauncherLibrary();
      setWorkspaceTab("commands");
      setBusy("Pronto");
      setMessage(
        `Automacao "${result.active_automation?.nome || "importada"}" importada do ZIP com sucesso.`,
        "success"
      );
      return;
    }

    if (action === "create-cancel") {
      setLauncherCreateOpen(false);
      return;
    }

    if (action === "create-confirm") {
      await createAutomationFromDraft();
      return;
    }

    if (action === "flip" || action === "unflip") {
      card.classList.toggle("is-flipped", action === "flip");
      return;
    }

    if (action === "edit") {
      if (!confirmLeaveEditorIfDirty()) {
        return;
      }
      setBusy("Abrindo");
      const result = await invoke("open_saved_automation", { id: automationId });
      applyPersistedRoadmap(result);
      await refreshTestLoopData();
      state.library.items = result.library?.items || state.library.items;
      state.library.categories = result.library?.categories || state.library.categories;
      state.library.activeId = result.library?.active_id || automationId;
      if (result.active_automation?.nome) {
        exportNameInput.value = result.active_automation.nome;
      }
      renderLauncherLibrary();
      setWorkspaceTab("commands");
      setBusy("Pronto");
      setMessage("Automacao carregada no mapa dos comandos.", "success");
      return;
    }

    if (action === "run") {
      const item = state.library.items.find((entry) => String(entry.id) === String(automationId));
      if (!item) {
        setMessage("Automacao nao encontrada para executar.", "error");
        return;
      }
      if (Number(item.command_count || 0) <= 0) {
        setMessage("Essa automacao ainda nao tem blocos para executar.", "error");
        return;
      }
      setBusy("Executando");
      setMessage(`Iniciando a automacao "${item.nome || "sem nome"}"...`, "info");
      const result = await invoke("execute_saved_automation", {
        id: automationId,
        delay: parseNumber(testDelayInput.value, 3),
        loopStart: Math.max(1, Math.trunc(parseNumber(testLoopStartInput.value, 1))),
      });
      await refreshAutomationLibrary();
      setBusy("Pronto");
      setMessage(result || "Executando automacao...", "success");
      return;
    }

    if (action === "duplicate") {
      setBusy("Duplicando");
      await invoke("duplicate_saved_automation", { id: automationId });
      await refreshAutomationLibrary("Automacao duplicada.");
      setBusy("Pronto");
      return;
    }

    if (action === "export-zip") {
      const isActiveAutomation = String(automationId || "") === String(state.library.activeId || "");
      if (isActiveAutomation && !ensureCommandMapSavedBefore("exportar a automacao em ZIP")) {
        return;
      }
      const item = state.library.items.find((entry) => String(entry.id) === String(automationId));
      const defaultZipName = `${String(item?.nome || exportNameInput.value.trim() || "Automacao").trim() || "Automacao"}.zip`;
      setBusy("Escolhendo local");
      let pickedPath = null;
      try {
        pickedPath = await saveNativeFileDialog({
          defaultPath: defaultZipName,
          filters: [{ name: "Automacao FlowDetect", extensions: ["zip"] }],
        });
      } catch (dialogError) {
        console.warn("Nao foi possivel abrir o seletor de destino do ZIP.", dialogError);
        setMessage("Nao consegui abrir a janela de escolher pasta. Vou exportar para a pasta padrao do FlowDetect.", "info");
      }
      if (!pickedPath) {
        setBusy("Exportando ZIP");
        const result = await invoke("export_saved_automation_zip", {
          id: automationId,
          destino: null,
          destinationPath: null,
        });
        setBusy("Pronto");
        setMessage(
          `Automacao "${result.automation?.nome || "sem nome"}" exportada em ${result.zip_path}.`,
          "success"
        );
        return;
      }
      setBusy("Exportando ZIP");
      const result = await invoke("export_saved_automation_zip", {
        id: automationId,
        destino: pickedPath,
        destinationPath: pickedPath,
      });
      setBusy("Pronto");
      setMessage(
        `Automacao "${result.automation?.nome || "sem nome"}" exportada em ${result.zip_path}.`,
        "success"
      );
      return;
    }

    if (action === "edit-meta") {
      setLibraryEditOpen(automationId, true);
      card.classList.add("is-flipped");
      return;
    }

    if (action === "edit-cancel") {
      setLibraryEditOpen(automationId, false);
      card.classList.remove("is-flipped");
      return;
    }

    if (action === "edit-save") {
      setBusy("Salvando");
      await saveLibraryCardEdit(automationId);
      card.classList.add("is-flipped");
      setBusy("Pronto");
      return;
    }

    if (action === "rename") {
      const item = state.library.items.find((entry) => String(entry.id) === String(automationId));
      const novoNome = window.prompt("Novo nome da automacao:", item?.nome || "");
      if (!novoNome) {
        return;
      }
      setBusy("Renomeando");
      await invoke("rename_saved_automation", {
        id: automationId,
        nome: novoNome,
        descricao: item?.descricao || "",
        categoria: item?.categoria || "Outros",
      });
      await refreshAutomationLibrary("Automacao renomeada.");
      setBusy("Pronto");
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Tem certeza que deseja excluir esta automacao?")) {
        return;
      }
      setBusy("Excluindo");
      await invoke("delete_saved_automation", { id: automationId });
      await refreshAutomationLibrary("Automacao excluida.");
      setBusy("Pronto");
    }
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

launcherList.addEventListener("input", (event) => {
  const editField = event.target.closest("[data-library-edit-field]");
  if (editField) {
    const key = editField.dataset.libraryEditField;
    if (key) {
      state.library.editDraft[key] = editField.value;
    }
    return;
  }

  const field = event.target.closest("[data-create-field]");
  if (!field) {
    return;
  }
  const key = field.dataset.createField;
  if (!key) {
    return;
  }
  state.library.createDraft[key] = field.value;
});

studioControlConnectButton?.addEventListener("click", async () => {
  try {
    setBusy("Conectando Agent");
    await connectStudioControl();
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
    state.remoteControl.connected = false;
    renderStudioControl();
  }
});

studioControlRefreshButton?.addEventListener("click", async () => {
  try {
    setBusy("Atualizando remoto");
    await refreshStudioControlLibrary();
    await refreshStudioControlStatus({ silent: true });
    await refreshStudioControlSpreadsheet({ force: true, silent: true });
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

studioControlImportButton?.addEventListener("click", () => {
  studioControlZipInput?.click();
});

studioControlZipInput?.addEventListener("change", async () => {
  const file = studioControlZipInput.files?.[0] || null;
  studioControlZipInput.value = "";
  if (!file) {
    return;
  }
  try {
    setBusy("Enviando ZIP");
    await importStudioControlZip(file);
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

studioControlRunButton?.addEventListener("click", async () => {
  try {
    setBusy("Executando remoto");
    await runStudioControlAutomation();
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

studioControlStopButton?.addEventListener("click", async () => {
  try {
    setBusy("Parando remoto");
    await stopStudioControlAutomation();
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

studioControlViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.remoteControl.activeView = button.dataset.studioControlView || "execution";
    renderStudioControl();
    if (state.remoteControl.activeView === "spreadsheet") {
      refreshStudioControlSpreadsheet({ force: true, silent: true }).catch(() => null);
    }
  });
});

studioControlMeshUrlInput?.addEventListener("change", () => {
  persistMeshCentralUrl(normalizeMeshCentralUrl(studioControlMeshUrlInput.value));
  renderStudioControl();
});

studioControlMeshPathInput?.addEventListener("change", () => {
  persistMeshCentralPath(studioControlMeshPathInput.value);
  renderStudioControl();
});

studioControlMeshStartButton?.addEventListener("click", () => {
  const meshPath = String(studioControlMeshPathInput?.value || state.remoteControl.meshPath || "").trim();
  if (!state.remoteControl.connected) {
    setMessage("Conecte no Agent antes de iniciar o MeshCentral.", "error");
    return;
  }
  persistMeshCentralPath(meshPath);
  const meshUrl = currentMeshCentralUrl();
  persistMeshCentralUrl(meshUrl);
  state.remoteControl.meshStarting = true;
  renderStudioControl();
  setMessage("Comando enviado ao Agent. O MeshCentral vai preparar em segundo plano.", "success");
  invoke("remote_agent_meshcentral_start", {
    address: state.remoteControl.address,
    meshPath,
    url: meshUrl,
  })
    .then((result) => {
      applyStudioControlMeshStatus(result);
      refreshStudioControlMeshStatus({ silent: true }).catch(() => null);
    })
    .catch((error) => {
      state.remoteControl.meshStarting = false;
      renderStudioControl();
      setMessage(String(error), "error");
    });
  window.setTimeout(() => refreshStudioControlMeshStatus({ silent: true }).catch(() => null), 1800);
});

studioControlMeshLoadButton?.addEventListener("click", () => {
  startStudioControlScreenStream();
});

studioControlMeshEmbedButton?.addEventListener("click", () => {
  const url = currentMeshCentralUrl();
  if (!url) {
    setMessage("Informe a URL do MeshCentral para incorporar a tela remota.", "error");
    return;
  }
  persistMeshCentralUrl(url);
  stopStudioControlScreenStream({ clear: true });
  state.remoteControl.meshFrameUrl = url;
  setMessage("Tentando incorporar a tela do MeshCentral. Se ficar branco, use Assistir no Studio ou Abrir fora.", "success");
  renderStudioControl();
});

studioControlMeshOpenButton?.addEventListener("click", () => {
  const url = currentMeshCentralUrl();
  if (!url) {
    setMessage("Informe a URL do MeshCentral antes de abrir.", "error");
    return;
  }
  persistMeshCentralUrl(url);
  window.open(url, "_blank", "noopener,noreferrer");
});

studioControlMeshClearButton?.addEventListener("click", () => {
  persistMeshCentralUrl("");
  state.remoteControl.meshFrameUrl = "";
  stopStudioControlScreenStream({ clear: true });
  if (studioControlMeshFrame) {
    studioControlMeshFrame.setAttribute("src", "about:blank");
  }
  renderStudioControl();
});

studioControlScreenVideo?.addEventListener("mouseenter", () => {
  state.remoteControl.remotePointerInside = true;
});

studioControlScreenVideo?.addEventListener("mouseleave", () => {
  state.remoteControl.remotePointerInside = false;
});

studioControlScreenVideo?.addEventListener("mousemove", (event) => {
  const point = remoteVideoPointFromEvent(event);
  if (!point) {
    return;
  }
  sendStudioRemoteControlEvent({ kind: "mouse", event: "move", x: point.x, y: point.y });
});

studioControlScreenVideo?.addEventListener("mousedown", (event) => {
  const point = remoteVideoPointFromEvent(event);
  if (!point) {
    return;
  }
  event.preventDefault();
  studioControlScreenVideo.focus?.();
  sendStudioRemoteControlEvent({ kind: "mouse", event: "down", x: point.x, y: point.y, button: event.button });
});

studioControlScreenVideo?.addEventListener("mouseup", (event) => {
  const point = remoteVideoPointFromEvent(event);
  if (!point) {
    return;
  }
  event.preventDefault();
  sendStudioRemoteControlEvent({ kind: "mouse", event: "up", x: point.x, y: point.y, button: event.button });
});

studioControlScreenVideo?.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

studioControlScreenVideo?.addEventListener("wheel", (event) => {
  const point = remoteVideoPointFromEvent(event);
  if (!point) {
    return;
  }
  event.preventDefault();
  sendStudioRemoteControlEvent({
    kind: "mouse",
    event: "wheel",
    x: point.x,
    y: point.y,
    delta: event.deltaY < 0 ? 120 : -120,
  });
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (!state.remoteControl.webrtcActive || !state.remoteControl.remotePointerInside) {
    return;
  }
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  sendStudioRemoteControlEvent({ kind: "key", event: "down", key: event.key });
});

window.addEventListener("keyup", (event) => {
  if (!state.remoteControl.webrtcActive || !state.remoteControl.remotePointerInside) {
    return;
  }
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  sendStudioRemoteControlEvent({ kind: "key", event: "up", key: event.key });
});

studioControlSheetRefreshButton?.addEventListener("click", () => {
  refreshStudioControlSpreadsheet({ force: true }).catch((error) => setMessage(String(error), "error"));
});

studioControlList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-studio-control-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.studioControlAction || "";
  const id = button.dataset.id || "";
  try {
    if (action === "select") {
      setBusy("Abrindo remoto");
      await openStudioControlAutomation(id);
    } else if (action === "run") {
      setBusy("Executando remoto");
      await runStudioControlAutomation(id);
    }
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

studioControlPageChips?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-studio-control-page]");
  if (!button) {
    return;
  }
  state.remoteControl.currentSequence = normalizeSequenceName(button.dataset.studioControlPage || "principal");
  state.remoteControl.currentOrder = studioControlFirstOrder(state.remoteControl.currentSequence);
  state.remoteControl.detailOpenOrder = null;
  state.remoteControl.lastCenteredOrder = null;
  renderStudioControl();
});

studioControlFlowList?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-studio-control-action]");
  if (actionButton) {
    const order = Number(actionButton.dataset.id || 0);
    const action = actionButton.dataset.studioControlAction || "";
    if (action === "details") {
      state.remoteControl.detailOpenOrder = order;
    } else if (action === "back") {
      state.remoteControl.detailOpenOrder = null;
    }
    renderStudioControl();
    return;
  }
  const card = event.target.closest("[data-studio-control-order]");
  if (!card) {
    return;
  }
  const order = Number(card.dataset.studioControlOrder || 0);
  state.remoteControl.currentOrder = order || state.remoteControl.currentOrder;
  state.remoteControl.detailOpenOrder = null;
  state.remoteControl.lastCenteredOrder = null;
  const current = studioControlCurrentEvent();
  if (current?.sequence || current?.sequencia) {
    state.remoteControl.currentSequence = normalizeSequenceName(current.sequence || current.sequencia);
  }
  renderStudioControl();
});

studioControlPrevBlockButton?.addEventListener("click", () => {
  const events = studioControlSequenceEvents();
  const index = events.findIndex((event) => Number(event.order) === Number(state.remoteControl.currentOrder));
  if (index > 0) {
    state.remoteControl.currentOrder = events[index - 1].order;
    state.remoteControl.detailOpenOrder = null;
    state.remoteControl.lastCenteredOrder = null;
    renderStudioControl();
  }
});

studioControlNextBlockButton?.addEventListener("click", () => {
  const events = studioControlSequenceEvents();
  const index = events.findIndex((event) => Number(event.order) === Number(state.remoteControl.currentOrder));
  if (index >= 0 && index < events.length - 1) {
    state.remoteControl.currentOrder = events[index + 1].order;
    state.remoteControl.detailOpenOrder = null;
    state.remoteControl.lastCenteredOrder = null;
    renderStudioControl();
  }
});

[editorPanel, commandsPanel, workbookPanel].forEach((panel) => {
  panel?.addEventListener("input", () => {
    state.library.dirty = true;
  });
});

commandsPanel?.addEventListener("input", () => {
  markCommandMapSaveDirty();
});

commandMapList?.addEventListener("input", (event) => {
  const target = event.target;
  if (
    target?.matches?.('[data-tree-field="imagePath"], [data-insert-field="imagePath"]')
  ) {
    const previewHost = target.closest(".command-tree-card, .insert-card-panel");
    hydrateRecognitionPreviewCards(previewHost, target.value);
  }
  const card = event.target.closest(".command-tree-card");
  if (!card) {
    return;
  }
  syncCommandMapDraftFromCard(card);
});

mapSaveButton?.addEventListener("click", async () => {
  try {
    setBusy("Salvando mapa");
    await saveEntireCommandMap();
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

testDelayInput.addEventListener("input", () => syncTestInputsFrom("top"));
testLoopStartInput.addEventListener("input", () => syncTestInputsFrom("top"));
assistDelayInput.addEventListener("input", () => syncTestInputsFrom("assist"));
assistLoopStartInput.addEventListener("input", () => syncTestInputsFrom("assist"));
testWindowModeSelect?.addEventListener("change", () => syncExecutionWindowModeFrom("top"));
assistWindowModeSelect?.addEventListener("change", () => syncExecutionWindowModeFrom("assist"));
registerExecutionActionButtons();
assistSelectWindowButton?.addEventListener("click", () => {
  openAssistWindowPicker().catch((error) => setMessage(String(error), "error"));
});
assistClearWindowButton?.addEventListener("click", () => {
  clearAssistTargetWindow().catch((error) => setMessage(String(error), "error"));
});
assistWindowPickerCloseButton?.addEventListener("click", closeAssistWindowPicker);
assistWindowPickerRefreshButton?.addEventListener("click", () => {
  refreshAssistWindowPicker().catch((error) => setMessage(String(error), "error"));
});
assistWindowPickerOverlay?.addEventListener("click", (event) => {
  if (event.target === assistWindowPickerOverlay) {
    closeAssistWindowPicker();
  }
});
assistWindowPickerList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-window-picker-hwnd]");
  if (!button) {
    return;
  }
  const hwnd = Number(button.dataset.windowPickerHwnd || 0);
  const item = (state.assistTarget.windows || []).find((entry) => Number(entry.hwnd) === hwnd);
  if (!item) {
    setMessage("Essa janela nao esta mais na lista. Atualize e tente novamente.", "error");
    return;
  }
  applyAssistTargetWindow(item).catch((error) => setMessage(String(error), "error"));
});

devAdminEmailInput?.addEventListener("input", () => setLoginError(""));
devAdminPasswordInput?.addEventListener("input", () => setLoginError(""));
devAdminLoginButton?.addEventListener("click", () => {
  submitDevAdminLogin().catch((error) => setLoginError(String(error)));
});
loginOverlay?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const target = event.target;
    if (target === devAdminEmailInput || target === devAdminPasswordInput || state.login.step === "admin") {
      submitDevAdminLogin().catch((error) => setLoginError(String(error)));
    }
  }
});

workbookSheetSelect.addEventListener("change", async () => {
  try {
    setBusy("Carregando planilha");
    await loadWorkbookPreview(workbookSheetSelect.value, state.previewWorkbookId);
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

workbookSearchInput.addEventListener("input", () => {
  state.workbookSearch = workbookSearchInput.value;
  renderWorkbookPreview();
});

workbookFilesTabs.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-workbook-tab]");
  if (!tab) {
    return;
  }

  try {
    state.previewWorkbookId = tab.dataset.workbookTab || "";
    state.workbookSelectedSheet = "";
    state.workbookSelectedColumn = "";
    state.workbookSelectedCell = null;
    setBusy("Carregando planilha");
    await loadWorkbookPreview("", state.previewWorkbookId);
    populateSheetSelect("");
    setBusy("Pronto");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

addWorkbookButton.addEventListener("click", () => {
  workbookFileInput.click();
});

openWorkbookButton?.addEventListener("click", async () => {
  const workbook = selectedPreviewWorkbookMeta();
  if (!workbook?.id) {
    setMessage("Nenhuma planilha selecionada para abrir.", "error");
    return;
  }

  try {
    setBusy("Abrindo planilha");
    await invoke("open_workbook", {
      workbook: workbook.id,
    });
    state.workbookExternalEditOpenedAt = Date.now();
    setBusy("Pronto");
    setMessage("Planilha aberta no editor padrao. Ao voltar para o FlowDetect, a previa sera recarregada.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

window.addEventListener("focus", async () => {
  if (!state.workbookExternalEditOpenedAt || state.activeTab !== "workbook") {
    return;
  }
  if (Date.now() - state.workbookExternalEditOpenedAt < 1000) {
    return;
  }

  const workbookId = state.previewWorkbookId || selectedPreviewWorkbookMeta()?.id || "";
  const sheetName = state.workbookSelectedSheet || workbookSheetSelect?.value || "";
  state.workbookExternalEditOpenedAt = 0;

  try {
    await refreshWorkbookMeta();
    await loadWorkbookPreview(sheetName, workbookId);
    setMessage("Planilha recarregada com as alteracoes salvas.", "success");
  } catch (error) {
    setMessage(`Nao foi possivel recarregar a planilha: ${error}`, "error");
  }
});

deleteWorkbookButton?.addEventListener("click", async () => {
  const workbook = selectedPreviewWorkbookMeta();
  if (!workbook?.id) {
    setMessage("Nenhuma planilha selecionada para excluir.", "error");
    return;
  }

  const usedBlocks = countBlocksUsingWorkbook(workbook.id);
  const warning = usedBlocks
    ? `\n\nAtenção: ${usedBlocks} bloco(s) usam essa planilha. Eles continuarão no mapa, mas ficarão sem o arquivo até você escolher outra planilha.`
    : "";
  const confirmed = window.confirm(`Excluir a planilha "${workbook.file_name}" do projeto?${warning}`);
  if (!confirmed) {
    return;
  }

  try {
    setBusy("Excluindo planilha");
    const result = await invoke("delete_workbook", {
      workbook: workbook.id,
    });
    await refreshWorkbookMeta();
    const nextWorkbookId = result.next_workbook_id || state.workbook?.default_workbook || availableWorkbooks()[0]?.id || "";
    state.previewWorkbookId = nextWorkbookId;
    state.workbookSelectedSheet = "";
    state.workbookSelectedColumn = "";
    state.workbookSelectedCell = null;
    state.workbookPreview = null;
    if (nextWorkbookId) {
      await loadWorkbookPreview("", nextWorkbookId);
    } else {
      renderWorkbookPreview();
    }
    populateSheetSelect("");
    setBusy("Pronto");
    setMessage(`Planilha ${workbook.file_name} excluida do projeto.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

workbookFileInput.addEventListener("change", async () => {
  const file = workbookFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    setBusy("Importando planilha");
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const result = await invoke("import_workbook", {
      fileName: file.name,
      bytes,
    });
    await refreshWorkbookMeta();
    state.previewWorkbookId = result.workbook_id || state.previewWorkbookId;
    await loadWorkbookPreview("", state.previewWorkbookId);
    populateSheetSelect("");
    setBusy("Pronto");
    setMessage(`Planilha ${file.name} adicionada ao projeto.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  } finally {
    workbookFileInput.value = "";
  }
});

imageFileInput.addEventListener("change", async () => {
  const file = imageFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    setBusy("Importando imagem");
    const result = await importImageToProject(file);
    writeImportedImagePath(state.imageImportTarget, result.image_id || "");
    setBusy("Pronto");
    setMessage(`Referencia ${file.name} adicionada ao projeto.`, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  } finally {
    state.imageImportTarget = null;
    imageFileInput.value = "";
  }
});

automationZipFileInput?.addEventListener("change", async () => {
  const file = automationZipFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    setBusy("Importando ZIP");
    const result = await importAutomationZipToProject(file);
    applyPersistedRoadmap(result);
    await refreshTestLoopData();
    state.library.items = result.library?.items || state.library.items;
    state.library.categories = result.library?.categories || state.library.categories;
    state.library.activeId = result.library?.active_id || result.active_automation?.id || state.library.activeId;
    if (result.active_automation?.nome) {
      exportNameInput.value = result.active_automation.nome;
    }
    setLauncherCreateOpen(false);
    renderLauncherLibrary();
    setWorkspaceTab("commands");
    setBusy("Pronto");
    setMessage(
      `Automacao "${result.active_automation?.nome || file.name}" importada do ZIP com sucesso.`,
      "success"
    );
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  } finally {
    automationZipFileInput.value = "";
  }
});

workbookTableWrap.addEventListener("click", async (event) => {
  const columnButton = event.target.closest("[data-workbook-column-action]");
  if (columnButton) {
    state.workbookSelectedColumn = columnButton.dataset.column || "";
    renderWorkbookPreview();
    return;
  }

  const removeRowButton = event.target.closest("[data-workbook-row-remove]");
  if (removeRowButton) {
    await removeWorkbookPreviewRow(Number(removeRowButton.dataset.workbookRowRemove || 0));
    return;
  }

  const addButton = event.target.closest("[data-workbook-cell-add]");
  if (addButton) {
    state.workbookSelectedCell = {
      sheet: state.workbookSelectedSheet,
      rowNumber: Number(addButton.dataset.rowNumber),
      header: addButton.dataset.column || "",
      value: addButton.dataset.value || "",
    };
    updateWorkbookSelectionLabels();
    runMutation("Valor da planilha adicionado", () =>
      invoke("add_text_block", {
        text: state.workbookSelectedCell.value,
        delay: parseNumber(workbookTextDelay.value, 0),
        sequencia: currentSequenceName(),
      })
    , focusLastCommandMapCard);
    return;
  }

  const cell = event.target.closest("[data-workbook-cell]");
  if (!cell) {
    return;
  }

  state.workbookSelectedCell = {
    sheet: state.workbookSelectedSheet,
    rowNumber: Number(cell.dataset.rowNumber),
    header: cell.dataset.column || "",
    value: cell.dataset.value || "",
  };
  state.workbookSelectedColumn = cell.dataset.column || state.workbookSelectedColumn;
  renderWorkbookPreview();
});

addWorkbookCellButton.addEventListener("click", () => {
  if (!state.workbookSelectedCell?.value) {
    setMessage("Selecione um valor da planilha antes de adicionar ao mapa.", "error");
    return;
  }

  runMutation("Valor da planilha adicionado", () =>
    invoke("add_text_block", {
      text: state.workbookSelectedCell.value,
      delay: parseNumber(workbookTextDelay.value, 0),
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

addWorkbookColumnButton.addEventListener("click", () => {
  if (!state.workbookSelectedSheet || !state.workbookSelectedColumn) {
    setMessage("Selecione uma coluna da planilha antes de criar o loop.", "error");
    return;
  }

  runMutation("Loop da planilha adicionado", () =>
    invoke("add_spreadsheet_block", {
      workbook: state.previewWorkbookId || null,
      sheet: state.workbookSelectedSheet,
      column: state.workbookSelectedColumn,
      delay: parseNumber(workbookLoopDelay.value, 0),
      afterAction: workbookAfterAction.value.trim() || "nenhuma",
      intervalBetween: parseNumber(workbookBetweenItems.value, 0.5),
      sequencia: currentSequenceName(),
    })
  , focusLastCommandMapCard);
});

workbookAfterActionCaptureButton.addEventListener("click", () => {
  beginKeyCapture({ scope: "workbook-after-action", field: "afterAction" });
});

document.getElementById("refreshButton").addEventListener("click", async () => {
  try {
    setBusy("Atualizando");
    await refreshWorkbookMeta();
    await loadWorkbookPreview(state.workbookSelectedSheet || workbookSheetSelect.value, state.previewWorkbookId);
    await refreshRoadmap("Roteiro recarregado.");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

document.getElementById("legacyButton").addEventListener("click", async () => {
  try {
    setBusy("Abrindo captura");
    const result = await invoke("launch_legacy_capture");
    setBusy("Pronto");
    setMessage(result, "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

applyBulkDelayButton?.addEventListener("click", async () => {
  await applyBulkDelayToAllBlocks("top");
});

mapApplyBulkDelayButton?.addEventListener("click", async () => {
  await applyBulkDelayToAllBlocks("map");
});


document.getElementById("exportButton").addEventListener("click", async () => {
  const automationName = exportNameInput.value.trim();
  if (!automationName) {
    setMessage("Informe um nome para a automacao antes de exportar.", "error");
    return;
  }

  try {
    setBusy("Exportando");
    const result = await invoke("export_automation_bundle", { automationName });
    setBusy("Pronto");
    setMessage(
      `Automacao "${automationName}" gerada em ${result.export_dir} com interface propria, Dados do loop e Textos livres editaveis. Copiados: ${result.copied.length}.`,
      "success"
    );
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
});

document.getElementById("clearButton").addEventListener("click", () => {
  runMutation("Roteiro limpo", () => invoke("clear_blocks"), () => null);
});

timelineList.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches('[data-field="imagePath"]')) {
    const card = target.closest(".flow-card");
    setRecognitionTestStatusForOrder(Number(card?.dataset.order), target.value, false);
    return;
  }
  if (target.matches('[data-field="chromeTargetMethod"]')) {
    const card = target.closest(".flow-card");
    const analysis = parseChromeAnalysisJson(card?.querySelector('[data-field="chromeAnalysis"]')?.value);
    const selector = findChromeSelectorByMethod(analysis, target.value);
    const valueField = card?.querySelector('[data-field="chromeTargetValue"]');
    if (valueField && selector?.valor) {
      valueField.value = selector.valor;
    }
    return;
  }
  if (target.matches('[data-field="workbook"]')) {
    const card = target.closest(".flow-card");
    syncSpreadsheetSheetAndColumnFields(card, "data-field", target.value);
    return;
  }

  if (target.matches('[data-field="sheet"]')) {
    const card = target.closest(".flow-card");
    const workbookField = card.querySelector('[data-field="workbook"]');
    const columnField = card.querySelector('[data-field="column"]');
    const columns = columnsForSheetInWorkbook(workbookField?.value, target.value);
    setColumnSuggestionsForField(columnField, columns);
    return;
  }
});

timelineList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".flow-card");
  const order = Number(card.dataset.order);
  const type = card.dataset.type;
  const values = formValuesFromCard(card);
  const action = button.dataset.action;

  if (action === "record-key") {
    state.commandMapFocusOrder = order;
    beginKeyCapture({ scope: "update-editor", order });
    return;
  }

  if (action === "record-mouse") {
    state.commandMapFocusOrder = order;
    beginMouseCapture({ scope: "update-editor", order });
    return;
  }

  if (action === "record-after-action") {
    state.commandMapFocusOrder = order;
    beginKeyCapture({ scope: "update-editor", order, field: "afterAction" });
    return;
  }

  if (action === "select-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor", order });
    return;
  }

  if (action === "capture-image") {
    state.commandMapFocusOrder = order;
    captureImageToProject({ scope: "update-editor", order });
    return;
  }

  if (action === "refresh-recognition-windows") {
    state.commandMapFocusOrder = order;
    refreshRecognitionWindowCatalog({ root: card }).catch((error) => setMessage(String(error), "error"));
    return;
  }

  if (action === "analyze-chrome-html") {
    state.commandMapFocusOrder = order;
    analyzeChromeHtmlInContainer(card, "data-field");
    return;
  }

  if (action === "select-chrome-fallback-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor-chrome-fallback", order });
    return;
  }

  if (action === "test-image-recognition") {
      state.commandMapFocusOrder = order;
      runImageRecognitionTest(values, { inheritWindowFallback: false, recognitionOrder: order });
      return;
    }

  if (action === "select-verify-active-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor-verify-active", order });
    return;
  }

  if (action === "select-verify-inactive-image") {
    state.commandMapFocusOrder = order;
    openImagePicker({ scope: "update-editor-verify-inactive", order });
    return;
  }

  if (action === "up") {
    void moveCommandMapCardByStep(order, "up");
    return;
  }

  if (action === "down") {
    void moveCommandMapCardByStep(order, "down");
    return;
  }

  if (action === "remove") {
    runMutation("Bloco removido", () => invoke("remove_block", { order }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order)
    );
    return;
  }

  if (action === "save") {
    runMutation("Bloco salvo", () =>
      invokeCommandCardUpdate({ order, type, values })
    , () => order);
  }
});

commandMapList.addEventListener("change", (event) => {
  const target = event.target;
  if (
    target.matches('[data-tree-field="editableAtRun"], [data-field="editableAtRun"], [data-insert-field="editableAtRun"]')
  ) {
    const container = target.closest(".command-tree-card, .insert-card-panel, .flow-card");
    if (container?.classList.contains("command-tree-card") || container?.classList.contains("flow-card")) {
      const isEditable = Boolean(target.checked);
      container.classList.toggle("is-runtime-editable", isEditable);
      const chip = container.querySelector(".type-chip");
      if (chip) {
        chip.classList.toggle("runtime-editable", isEditable);
        chip.textContent = isEditable ? "Bloco editavel" : typeChipLabel(container.dataset.type || "texto_livre");
      }
      syncCommandMapDraftFromCard(container);
    }
    if (container?.classList.contains("insert-card-panel") && state.insertPanel) {
      state.insertPanel.editableAtRun = Boolean(target.checked);
    }
    return;
  }

  if (target.matches("[data-jump-delay]")) {
    saveCommandJumpDelayFromInput(target);
    return;
  }

  if (
    target.matches('[data-tree-field="successAction"], [data-tree-field="failureAction"], [data-tree-field="chromeSuccessAction"], [data-tree-field="chromeFailureAction"], [data-insert-field="successAction"], [data-insert-field="failureAction"], [data-insert-field="chromeSuccessAction"], [data-insert-field="chromeFailureAction"], [data-field="successAction"], [data-field="failureAction"], [data-field="chromeSuccessAction"], [data-field="chromeFailureAction"]')
  ) {
    const container = target.closest(".command-tree-card, .insert-card-panel, .flow-card");
    applyActionVisibilityState(container);
    if (state.insertPanel && container?.classList.contains("insert-card-panel")) {
      if (target.matches('[data-insert-field="successAction"]')) {
        state.insertPanel.successAction = target.value;
      }
      if (target.matches('[data-insert-field="failureAction"]')) {
        state.insertPanel.failureAction = target.value;
      }
      if (target.matches('[data-insert-field="chromeSuccessAction"]')) {
        state.insertPanel.chromeSuccessAction = target.value;
      }
      if (target.matches('[data-insert-field="chromeFailureAction"]')) {
        state.insertPanel.chromeFailureAction = target.value;
      }
    }
    if (container?.classList.contains("command-tree-card")) {
      syncCommandMapDraftFromCard(container);
      scheduleCommandConnectorLayout();
    }
    return;
  }

  if (
    target.matches('[data-tree-field="successBlock"], [data-tree-field="successSequenceDelay"], [data-tree-field="chromeSuccessBlock"], [data-tree-field="chromeSuccessSequenceDelay"], [data-tree-field="failureBlock"], [data-tree-field="failureSequenceDelay"], [data-tree-field="chromeFailureBlock"], [data-tree-field="chromeFailureSequenceDelay"]')
  ) {
    const card = target.closest(".command-tree-card");
    syncCommandMapDraftFromCard(card);
    scheduleCommandConnectorLayout();
    return;
  }

  if (target.matches('[data-tree-field="imagePath"]')) {
    const card = target.closest(".command-tree-card");
    setRecognitionTestStatusForOrder(Number(card?.dataset.order), target.value, false);
    hydrateRecognitionPreviewCards(card, target.value);
    return;
  }

  if (target.matches('[data-tree-field="expectedOcrText"]')) {
    const card = target.closest(".command-tree-card");
    syncCommandMapDraftFromCard(card);
    return;
  }

  if (target.matches('[data-insert-field="imagePath"]')) {
    const panel = target.closest(".insert-card-panel");
    if (state.insertPanel && panel) {
      state.insertPanel.imagePath = target.value;
    }
    hydrateRecognitionPreviewCards(panel, target.value);
    return;
  }

  if (target.matches('[data-insert-field="expectedOcrText"]')) {
    if (state.insertPanel) {
      state.insertPanel.expectedOcrText = target.value;
    }
    return;
  }
  if (target.matches('[data-tree-field="chromeTargetMethod"]')) {
    const card = target.closest(".command-tree-card");
    const analysis = parseChromeAnalysisJson(card?.querySelector('[data-tree-field="chromeAnalysis"]')?.value);
    const selector = findChromeSelectorByMethod(analysis, target.value);
    const valueField = card?.querySelector('[data-tree-field="chromeTargetValue"]');
    if (valueField && selector?.valor) {
      valueField.value = selector.valor;
    }
    return;
  }

  if (target.matches("[data-connector-delay]")) {
    const order = Number(target.dataset.order);
    runMutation("Tempo entre blocos atualizado", () =>
      invoke("update_block_delay", {
        order,
        delay: parseNumber(target.value, 0),
      })
    );
    return;
  }

  if (target.matches('[data-tree-field="workbook"]')) {
    const card = target.closest(".command-tree-card");
    syncSpreadsheetSheetAndColumnFields(card, "data-tree-field", target.value);
    return;
  }

  if (target.matches('[data-tree-field="sheet"]')) {
    const card = target.closest(".command-tree-card");
    const workbookField = card.querySelector('[data-tree-field="workbook"]');
    const columnField = card.querySelector('[data-tree-field="column"]');
    const columns = columnsForSheetInWorkbook(workbookField?.value, target.value);
    setColumnSuggestionsForField(columnField, columns);
    return;
  }

  if (target.matches('[data-insert-field="workbook"]')) {
    const panel = target.closest(".insert-card-panel");
    const updated = syncSpreadsheetSheetAndColumnFields(panel, "data-insert-field", target.value);
    if (state.insertPanel) {
      state.insertPanel.workbook = target.value;
      state.insertPanel.sheet = updated.sheet;
      state.insertPanel.column = updated.column;
    }
    return;
  }

  if (target.matches('[data-insert-field="chromeTargetMethod"]')) {
    const panel = target.closest(".insert-card-panel");
    const analysis = parseChromeAnalysisJson(panel?.querySelector('[data-insert-field="chromeAnalysis"]')?.value);
    const selector = findChromeSelectorByMethod(analysis, target.value);
    const valueField = panel?.querySelector('[data-insert-field="chromeTargetValue"]');
    if (valueField && selector?.valor) {
      valueField.value = selector.valor;
    }
    if (state.insertPanel) {
      state.insertPanel.chromeTargetMethod = target.value;
      state.insertPanel.chromeTargetValue = selector?.valor || state.insertPanel.chromeTargetValue || "";
    }
  }

  if (target.matches('[data-insert-field="sheet"]')) {
    const panel = target.closest(".insert-card-panel");
    const workbookField = panel.querySelector('[data-insert-field="workbook"]');
    const columns = columnsForSheetInWorkbook(workbookField?.value, target.value);
    const columnField = panel.querySelector('[data-insert-field="column"]');
    setColumnSuggestionsForField(columnField, columns);
    if (state.insertPanel) {
      state.insertPanel.sheet = target.value;
      state.insertPanel.column = columnField?.value ?? "";
    }
    return;
  }

  const card = target.closest(".command-tree-card");
  if (card && target.matches("input, textarea, select")) {
    markCommandMapSaveDirty();
    syncCommandMapDraftFromCard(card);
  }
});

commandMapList.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-drag-handle]");
  if (handle && event.button === 0) {
    event.preventDefault();
    state.pendingDrag = {
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    if (typeof handle.setPointerCapture === "function") {
      handle.setPointerCapture(event.pointerId);
    }
    return;
  }

  const segment = event.target.closest(".command-flow-segment");
  if (segment) {
    setCommandMapFocus(Number(segment.dataset.order), "auto");
  }

  if (!handle || event.button !== 0) {
    return;
  }
});

commandMapList.addEventListener("focusin", (event) => {
  if (event.target.closest("[data-drag-handle]")) {
    return;
  }

  const segment = event.target.closest(".command-flow-segment");
  if (segment) {
    setCommandMapFocus(Number(segment.dataset.order), "smooth");
  }
});

window.addEventListener("pointermove", (event) => {
  if (state.pendingDrag?.pointerId === event.pointerId && !state.draggingOrder) {
    event.preventDefault();
    state.pendingDrag.lastX = event.clientX;
    state.pendingDrag.lastY = event.clientY;
    const distance = Math.hypot(event.clientX - state.pendingDrag.startX, event.clientY - state.pendingDrag.startY);
    if (distance >= 5) {
      const pending = state.pendingDrag;
      state.pendingDrag = null;
      beginCardDrag(pending.handle, {
        ...event,
        clientX: pending.startX,
        clientY: pending.startY,
        pointerId: pending.pointerId,
      });
      scheduleDragUpdate(event.clientX, event.clientY);
    }
    return;
  }

  if (!state.draggingOrder || state.dragPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  scheduleDragUpdate(event.clientX, event.clientY);
});

window.addEventListener("pointerup", (event) => {
  if (state.pendingDrag?.pointerId === event.pointerId && !state.draggingOrder) {
    state.pendingDrag = null;
    return;
  }

  if (!state.draggingOrder || state.dragPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const targetIndex = getDragTargetIndexFromPoint(event.clientX, event.clientY);
  if (targetIndex) {
    updateDragTarget(targetIndex);
  }
  finishCardDrag(true);
});

window.addEventListener("pointercancel", (event) => {
  if (state.pendingDrag?.pointerId === event.pointerId && !state.draggingOrder) {
    state.pendingDrag = null;
    return;
  }

  if (!state.draggingOrder || state.dragPointerId !== event.pointerId) {
    return;
  }

  finishCardDrag(false);
});

commandMapList.addEventListener("click", (event) => {
  const recognitionTabButton = event.target.closest("button[data-recognition-tab-target]");
  if (recognitionTabButton) {
    const card = recognitionTabButton.closest(".command-tree-card");
    const order = Number(card?.dataset.order);
    if (order) {
      setRecognitionTreeTab(order, recognitionTabButton.dataset.recognitionTabTarget || "base");
    }
    return;
  }

  const spreadsheetTabButton = event.target.closest("button[data-spreadsheet-tab-target]");
  if (spreadsheetTabButton) {
    const card = spreadsheetTabButton.closest(".command-tree-card");
    const order = Number(card?.dataset.order);
    if (order) {
      setSpreadsheetTreeTab(order, spreadsheetTabButton.dataset.spreadsheetTabTarget || "planilha");
    }
    return;
  }

  const button = event.target.closest("button[data-tree-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".command-tree-card");
  const order = Number(card.dataset.order);
  const type = card.dataset.type;
  const values = treeValuesFromCard(card);
  const action = button.dataset.treeAction;

  if (action === "open-editor") {
    setCommandMapFocus(order);
    focusEditorBlock(order);
    return;
  }

  if (action === "record-key") {
    setCommandMapFocus(order);
    beginKeyCapture({ scope: "update-tree", order });
    return;
  }

  if (action === "record-mouse") {
    setCommandMapFocus(order);
    beginMouseCapture({ scope: "update-tree", order });
    return;
  }

  if (action === "record-after-action") {
    setCommandMapFocus(order);
    beginKeyCapture({ scope: "update-tree", order, field: "afterAction" });
    return;
  }

  if (action === "select-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree", order });
    return;
  }

  if (action === "capture-image") {
    setCommandMapFocus(order);
    captureImageToProject({ scope: "update-tree", order });
    return;
  }

  if (action === "refresh-recognition-windows") {
    setCommandMapFocus(order);
    refreshRecognitionWindowCatalog({ root: card }).catch((error) => setMessage(String(error), "error"));
    return;
  }

  if (action === "analyze-chrome-html") {
    setCommandMapFocus(order);
    analyzeChromeHtmlInContainer(card, "data-tree-field");
    return;
  }

  if (action === "select-chrome-fallback-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree-chrome-fallback", order });
    return;
  }

  if (action === "test-image-recognition") {
      setCommandMapFocus(order);
      runImageRecognitionTest(values, { inheritWindowFallback: false, recognitionOrder: order });
      return;
    }

  if (action === "select-verify-active-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree-verify-active", order });
    return;
  }

  if (action === "select-verify-inactive-image") {
    setCommandMapFocus(order);
    openImagePicker({ scope: "update-tree-verify-inactive", order });
    return;
  }

  if (action === "insert-before" || action === "insert-after") {
    setCommandMapFocus(order);
    state.insertPanel = createInsertPanelState(order, action === "insert-before" ? "before" : "after");
    if (state.commandMapZoom > 1) {
      setCommandMapZoom(1);
    }
    commandMapList.scrollTop = 0;
    renderCommandMap();
    return;
  }

  if (action === "up") {
    moveCommandMapCardByStep(order, "up");
    return;
  }

  if (action === "down") {
    moveCommandMapCardByStep(order, "down");
    return;
  }

  if (action === "remove") {
    runMutation("Bloco removido", () => invoke("remove_block", { order }), (roadmap) =>
      resolveNearestCommandMapFocus(roadmap, order)
    );
    return;
  }

  if (action === "save") {
    runMutation("Bloco salvo", () =>
      invokeCommandCardUpdate({ order, type, values })
    , () => order);
  }
});

commandMapList.addEventListener("click", (event) => {
  const emptyTypeButton = event.target.closest("button[data-empty-insert-type]");
  if (emptyTypeButton) {
    state.insertPanel = createInsertPanelState(0, "after");
    state.insertPanel.type = emptyTypeButton.dataset.emptyInsertType || "key";
    if (state.insertPanel.type === "spreadsheet" || state.insertPanel.type === "write_spreadsheet") {
      state.insertPanel.workbook = resolveWorkbookId(state.insertPanel.workbook);
      state.insertPanel.sheet = workbookSheetsFor(state.insertPanel.workbook)[0]?.name || "";
      state.insertPanel.column = columnsForSheetInWorkbook(state.insertPanel.workbook, state.insertPanel.sheet)[0] || "";
    }
    renderCommandMap();
    return;
  }

  const insertRecognitionTabButton = event.target.closest("button[data-insert-recognition-tab-target]");
  if (insertRecognitionTabButton) {
    if (!state.insertPanel) {
      return;
    }
    const panel = insertRecognitionTabButton.closest(".insert-card-panel");
    if (panel) {
      state.insertPanel = {
        ...state.insertPanel,
        ...insertValuesFromPanel(panel),
      };
    }
    setCommandMapFocus(Number(panel?.dataset.targetOrder || state.insertPanel.targetOrder));
    state.insertPanel.recognitionTab = normalizeRecognitionTreeTab(
      insertRecognitionTabButton.dataset.insertRecognitionTabTarget || "base"
    );
    renderCommandMap();
    return;
  }

  const button = event.target.closest("button[data-insert-action], button[data-insert-type]");
  if (!button) {
    return;
  }

  if (button.dataset.insertType) {
    if (!state.insertPanel) {
      return;
    }
    state.insertPanel.type = button.dataset.insertType;
    if (state.insertPanel.type === "spreadsheet" || state.insertPanel.type === "write_spreadsheet") {
      state.insertPanel.workbook = resolveWorkbookId(state.insertPanel.workbook);
      state.insertPanel.sheet = workbookSheetsFor(state.insertPanel.workbook)[0]?.name || "";
      state.insertPanel.column = columnsForSheetInWorkbook(state.insertPanel.workbook, state.insertPanel.sheet)[0] || "";
    }
    setCommandMapFocus(state.insertPanel.targetOrder);
    renderCommandMap();
    return;
  }

  const panel = button.closest(".insert-card-panel");
  if (!panel || !state.insertPanel) {
    return;
  }

  const action = button.dataset.insertAction;
  if (action === "cancel") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    state.insertPanel = null;
    renderCommandMap();
    return;
  }

  if (action === "record-key") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    beginKeyCapture({ scope: "insert-panel", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "record-mouse") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    beginMouseCapture({ scope: "insert-panel", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "record-after-action") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    beginKeyCapture({ scope: "insert-panel", order: Number(panel.dataset.targetOrder), field: "afterAction" });
    return;
  }

  if (action === "select-image") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    openImagePicker({ scope: "insert-panel", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "capture-image") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    captureImageToProject({ scope: "insert-panel", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "refresh-recognition-windows") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    refreshRecognitionWindowCatalog({ root: panel }).catch((error) => setMessage(String(error), "error"));
    return;
  }

  if (action === "analyze-chrome-html") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    analyzeChromeHtmlInContainer(panel, "data-insert-field");
    return;
  }

  if (action === "select-chrome-fallback-image") {
    setCommandMapFocus(Number(panel.dataset.targetOrder));
    openImagePicker({ scope: "insert-panel-chrome-fallback", order: Number(panel.dataset.targetOrder) });
    return;
  }

  if (action === "save") {
    const values = insertValuesFromPanel(panel);
    const common = {
      targetOrder: values.targetOrder,
      position: values.position,
      delay: values.delay,
      aoSucesso: values.successAction,
      blocoSucesso: optionalPositiveInt(values.successBlock),
      sequenciaSucesso: values.successAction === "ir_para_sequencia"
        ? optionalSequenceValue(values.successSequence)
        : null,
      atrasoSequenciaSucesso: transitionSequenceDelayArg(values.successAction, values.successSequenceDelay),
    };
    const isFirstBlock = Number(common.targetOrder) <= 0;

    let promiseFactory;
    if (values.type === "text") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_text_block", {
              text: values.text,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
              editavelExecucao: Boolean(values.editableAtRun),
              rotuloExecucao: values.runtimeLabel || null,
            })
          : invoke("insert_text_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              text: values.text,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
              editavelExecucao: Boolean(values.editableAtRun),
              rotuloExecucao: values.runtimeLabel || null,
            });
    } else if (values.type === "key") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_key_block", {
              keys: values.keys,
              repeat: values.repeat,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_key_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              keys: values.keys,
              repeat: values.repeat,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    } else if (values.type === "loop_start") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_loop_start_block", {
              delay: common.delay,
              sequencia: currentSequenceName(),
            })
          : invoke("insert_loop_start_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              delay: common.delay,
              sequencia: currentSequenceName(),
            });
    } else if (values.type === "loop_end") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_loop_end_block", {
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_loop_end_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    } else if (values.type === "mouse") {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_mouse_block", {
              x: values.x,
              y: values.y,
              button: values.button,
              clicks: values.clicks,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_mouse_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              x: values.x,
              y: values.y,
              button: values.button,
              clicks: values.clicks,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    } else if (values.type === "image") {
      if (!values.imagePath.trim()) {
        setMessage("Selecione uma referencia visual antes de inserir esse bloco.", "error");
        return;
      }
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_image_click_block", {
              imagem: values.imagePath,
              timeout: values.timeout,
              confianca: values.confidence,
              perfilBusca: values.searchProfile,
              modoAreaBusca: "target_window",
              areaBuscaX: 0,
              areaBuscaY: 0,
              areaBuscaLargura: 0,
              areaBuscaAltura: 0,
              janelaAlvo: values.windowTitle?.trim() || null,
              textoOcrEsperado: values.expectedOcrText?.trim() || null,
              clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
              clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
              offsetX: 0,
              offsetY: 0,
              aoNaoEncontrar: values.failureAction,
              sequenciaNaoEncontrar: values.failureAction === "ir_para_sequencia"
                ? values.failureSequence.trim() || null
                : null,
              atrasoSequenciaNaoEncontrar: transitionSequenceDelayArg(values.failureAction, values.failureSequenceDelay),
              blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
              quantidadeTentativas: values.retryCount,
              intervaloTentativas: values.retryInterval,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_image_click_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              imagem: values.imagePath,
              timeout: values.timeout,
              confianca: values.confidence,
              perfilBusca: values.searchProfile,
              modoAreaBusca: "target_window",
              areaBuscaX: 0,
              areaBuscaY: 0,
              areaBuscaLargura: 0,
              areaBuscaAltura: 0,
              janelaAlvo: values.windowTitle?.trim() || null,
              textoOcrEsperado: values.expectedOcrText?.trim() || null,
              clicar: recognitionClicksFromMode(values.recognitionClickMode, 1) > 0,
              clicks: recognitionClicksFromMode(values.recognitionClickMode, 1),
              offsetX: 0,
              offsetY: 0,
              aoNaoEncontrar: values.failureAction,
              sequenciaNaoEncontrar: values.failureAction === "ir_para_sequencia"
                ? values.failureSequence.trim() || null
                : null,
              atrasoSequenciaNaoEncontrar: transitionSequenceDelayArg(values.failureAction, values.failureSequenceDelay),
              blocoNaoEncontrar: optionalPositiveInt(values.failureBlock),
              quantidadeTentativas: values.retryCount,
              intervaloTentativas: values.retryInterval,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    } else if (values.type === "chrome") {
      if (!values.chromeHtml.trim()) {
        setMessage("Cole o HTML do elemento antes de inserir esse bloco.", "error");
        return;
      }
      promiseFactory = async () => {
        const analysis = values.chromeAnalysis || await invoke("analyze_html_element", { html: values.chromeHtml });
        const details = buildChromeDetailsFromAnalysisAndValues(analysis, values);
        return isFirstBlock
          ? invoke("add_chrome_html_block", {
              nome: details.nome,
              htmlOriginal: details.html_original,
              elemento: details.elemento,
              alvo: details.alvo,
              acao: details.acao,
              timeout: details.timeout,
              fallbackVisual: details.fallback_visual,
              fallbackImagem: details.fallback_imagem || null,
              aoSucesso: details.ao_sucesso,
              blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
              sequenciaSucesso: details.ao_sucesso === "ir_para_sequencia"
                ? optionalSequenceValue(details.sequencia_sucesso)
                : null,
              atrasoSequenciaSucesso: transitionSequenceDelayArg(details.ao_sucesso, details.atraso_antes_sequencia_sucesso),
              aoFalhar: details.ao_falhar,
              blocoFalha: optionalPositiveInt(details.bloco_falha),
              sequenciaFalha: details.ao_falhar === "ir_para_sequencia"
                ? optionalSequenceValue(details.sequencia_falha)
                : null,
              atrasoSequenciaFalha: transitionSequenceDelayArg(details.ao_falhar, details.atraso_antes_sequencia_falha),
              quantidadeTentativas: details.quantidade_tentativas,
              intervaloTentativas: details.intervalo_tentativas,
              delay: common.delay,
              sequencia: currentSequenceName(),
            })
          : invoke("insert_chrome_html_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              nome: details.nome,
              htmlOriginal: details.html_original,
              elemento: details.elemento,
              alvo: details.alvo,
              acao: details.acao,
              timeout: details.timeout,
              fallbackVisual: details.fallback_visual,
              fallbackImagem: details.fallback_imagem || null,
              aoSucesso: details.ao_sucesso,
              blocoSucesso: optionalPositiveInt(details.bloco_sucesso),
              sequenciaSucesso: details.ao_sucesso === "ir_para_sequencia"
                ? optionalSequenceValue(details.sequencia_sucesso)
                : null,
              atrasoSequenciaSucesso: transitionSequenceDelayArg(details.ao_sucesso, details.atraso_antes_sequencia_sucesso),
              aoFalhar: details.ao_falhar,
              blocoFalha: optionalPositiveInt(details.bloco_falha),
              sequenciaFalha: details.ao_falhar === "ir_para_sequencia"
                ? optionalSequenceValue(details.sequencia_falha)
                : null,
              atrasoSequenciaFalha: transitionSequenceDelayArg(details.ao_falhar, details.atraso_antes_sequencia_falha),
              quantidadeTentativas: details.quantidade_tentativas,
              intervaloTentativas: details.intervalo_tentativas,
              delay: common.delay,
              sequencia: currentSequenceName(),
            });
      };
    } else if (values.type === "open_url") {
      if (!values.openUrl.trim()) {
        setMessage("Informe a URL antes de inserir esse bloco.", "error");
        return;
      }
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_open_url_block", {
              url: values.openUrl,
              navegador: values.openBrowser,
              modoAbertura: values.openMode,
              telaCheia: Boolean(values.openFullscreen),
              aguardarSegundos: values.openWait,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_open_url_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              url: values.openUrl,
              navegador: values.openBrowser,
              modoAbertura: values.openMode,
              telaCheia: Boolean(values.openFullscreen),
              aguardarSegundos: values.openWait,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    } else if (values.type === "open_program") {
      if (!values.programPath.trim()) {
        setMessage("Informe o caminho do programa antes de inserir esse bloco.", "error");
        return;
      }
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_open_program_block", {
              caminho: values.programPath,
              parametros: values.programParams || null,
              aguardarSegundos: values.programWait,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_open_program_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              caminho: values.programPath,
              parametros: values.programParams || null,
              aguardarSegundos: values.programWait,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    } else if (values.type === "write_spreadsheet") {
      if (!values.sheet.trim() || !values.column.trim()) {
        setMessage("Informe a aba e a coluna antes de inserir esse bloco.", "error");
        return;
      }
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_write_spreadsheet_block", {
              workbook: values.workbook || state.composerWorkbookId || null,
              sheet: values.sheet,
              column: values.column,
              value: values.writeValue,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_write_spreadsheet_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              workbook: values.workbook || state.composerWorkbookId || null,
              sheet: values.sheet,
              column: values.column,
              value: values.writeValue,
              delay: common.delay,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    } else {
      promiseFactory = () =>
        isFirstBlock
          ? invoke("add_spreadsheet_block", {
              workbook: values.workbook || state.composerWorkbookId || null,
              sheet: values.sheet,
              column: values.column,
              delay: common.delay,
              afterAction: values.afterAction,
              intervalBetween: values.intervalBetween,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            })
          : invoke("insert_spreadsheet_block", {
              targetOrder: common.targetOrder,
              position: common.position,
              workbook: values.workbook || state.composerWorkbookId || null,
              sheet: values.sheet,
              column: values.column,
              delay: common.delay,
              afterAction: values.afterAction,
              intervalBetween: values.intervalBetween,
              sequencia: currentSequenceName(),
              aoSucesso: common.aoSucesso,
              blocoSucesso: common.blocoSucesso,
              sequenciaSucesso: common.sequenciaSucesso,
              atrasoSequenciaSucesso: common.atrasoSequenciaSucesso,
            });
    }

    runMutation("Bloco inserido", async () => {
      const roadmap = await promiseFactory();
      state.insertPanel = null;
      return roadmap;
    }, (roadmap) =>
      resolveNearestCommandMapFocus(
        roadmap,
        isFirstBlock ? roadmap?.events?.[0]?.order ?? null : common.position === "before" ? common.targetOrder : common.targetOrder + 1
      )
    );
  }
});

async function boot() {
  try {
    setBusy("Carregando");
    updateCommandMapSaveUI();
    renderStudioControl();
    syncExecutionWindowModeFrom("top");
    setAssistControlTab(state.assistControlTab);
    setWorkspaceTab(state.activeTab);
    await loadPersistedLoginSession({ preserveAuthenticated: true });
    updateLoginResolutionPreview(state.login.resolution);
    applyLoginStateUI();
    try {
      const executionState = await invoke("get_test_execution_state");
      setTestExecutionState(executionState?.running);
    } catch (error) {
      console.warn("Falha ao consultar estado inicial de teste.", error);
      setTestExecutionState(false);
    }

    await safeListen("test-execution-state", (event) => {
      setTestExecutionState(event.payload?.running);
      if (!event.payload?.running && builderStatus.textContent === "Executando teste") {
        builderStatus.textContent = "Pronto";
      }
    });
    await safeListen("test-log", (event) => {
      const message = event.payload?.message;
      if (message) {
        const text = String(message);
        const lowered = text.toLowerCase();
        const kind = lowered.includes("erro")
          || lowered.includes("falha")
          || lowered.includes("nao encontrada")
          || lowered.includes("não encontrada")
          ? "error"
          : lowered.includes("encontrada")
            || lowered.includes("confirmacao visual")
            || lowered.includes("confirmação visual")
            || lowered.includes("clique executado")
            ? "success"
            : "info";
        pushAssistLog(text, kind);
        if (lowered.includes("janela alvo perdida")) {
          state.assistTarget = {
            ...state.assistTarget,
            status: "lost",
          };
          updateAssistTargetUI();
        }
        if (state.assist.mode === "running" && !state.assist.description) {
          state.assist.description = text;
          updateAssistProgressUI();
        }
        const updatedLoopRuntime = applyAssistLoopRuntimeHint(text, {
          updateDescription: state.assist.mode === "running",
        });
        const movedAssistPosition = applyAssistPositionHint(text, { render: false });
        if (updatedLoopRuntime || movedAssistPosition) {
          updateAssistProgressUI();
          renderAssistExecutionMap();
        }
        setMessage(text, "info");
      }
    });
    await safeListen("test-progress", (event) => {
      const payload = event.payload || {};
      stopAssistPlayback();
      state.assist.mode = "running";
      state.assist.current = Number(payload.current || 0);
      state.assist.total = Number(payload.total || 0);
      state.assist.percent = Number(payload.percent || 0);
      state.assist.description = String(payload.description || "");
      if (Number(payload.iteration_current || 0) > 0 && Number(payload.iteration_total || 0) > 0) {
        state.assist.current = Number(payload.iteration_current || 0);
        state.assist.total = Number(payload.iteration_total || 0);
        state.assist.percent = state.assist.total > 0
          ? (state.assist.current / state.assist.total) * 100
          : Number(payload.percent || 0);
      }
      if (Number(payload.order || 0) > 0) {
        state.assist.currentOrder = Number(payload.order || 0);
      } else if (payload.sequence) {
        const firstOrder = getCommandMapFirstOrderForSequence(payload.sequence);
        if (firstOrder != null) {
          state.assist.currentOrder = firstOrder;
        }
      }
      const rowFromLine = resolveAssistLoopRowByLine(Number(payload.line || 0));
      state.assist.company = String(payload.company || rowFromLine?.company || "");
      applyAssistLoopRuntimeHint(payload.description, {
        updateDescription: false,
        updateCompany: !payload.company && !rowFromLine?.company,
      });
      applyAssistPositionHint(payload.description, { render: false });
      updateAssistProgressUI();
      pushAssistLog(state.assist.description, "info");
      renderAssistExecutionMap();
    });
    await safeListen("test-finished", (event) => {
      const payload = event.payload || {};
      stopAssistPlayback();
      state.assist.mode = payload.success ? "done" : payload.code === -9 ? "stopped" : "failed";
      state.assist.success = Boolean(payload.success);
      if (payload.success) {
        state.assist.percent = 100;
        state.assist.current = state.assist.total || state.roadmap?.events?.length || 0;
        state.assist.description = state.assist.description || "Execucao finalizada com sucesso.";
        pushAssistLog("Execucao finalizada com sucesso.", "success");
      } else {
        state.assist.description = state.assist.description || `Execucao encerrada com codigo ${payload.code}.`;
        pushAssistLog(state.assist.description, payload.code === -9 ? "info" : "error");
      }
      updateAssistProgressUI();
      renderAssistExecutionMap();
    });
    await refreshAutomationLibrary();
    await refreshWorkbookMeta();
    const roadmap = await invoke("get_roadmap");
    applyPersistedRoadmap(roadmap);
    await refreshTestLoopData();
    refreshRecognitionWindowCatalog({ silent: true }).catch(() => {});
    resetAssistState("idle");
    setBusy("Pronto");
    setMessage("Gerador pronto para uso.", "success");
  } catch (error) {
    setBusy("Erro");
    setMessage(String(error), "error");
  }
}

updateLoginResolutionPreview();
applyLoginStateUI();
boot();
}
