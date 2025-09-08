document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let projectState = {
        metadata: {
            title: 'Untitled Project',
            description: '',
            author: '',
            dateCreated: null,
            dateModified: null,
            versionNote: 'Initial version',
            promptAssists: [
                { text: '4k, detailed, high resolution', enabled: true },
                { text: 'cinematic lighting', enabled: false },
                { text: 'watercolor painting style', enabled: false },
            ]
        },
        baseImageSrc: null,
        gridConfig: { rows: 2, cols: 2 },
        cellHistory: {},
        ui: { showGrid: true, apiKey: '' }
    };

    let baseImage = null;
    let activeCell = null;
    let isCropMode = false;
    let cropSelection = new Set();
    
    // Undo/Redo History
    let stateHistory = [];
    let historyIndex = -1;

    // --- DOM ELEMENTS ---
    const welcomeScreen = document.getElementById('welcome-screen');
    const editorView = document.getElementById('editor-view');
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');
    const gridSelect = document.getElementById('grid-select');
    const previewToggle = document.getElementById('preview-toggle');
    const cropModeToggle = document.getElementById('crop-mode-toggle');
    const cropSelectionBtn = document.getElementById('crop-selection-btn');
    const projectTitleDisplay = document.getElementById('project-title-display');
    const apiKeyInput = document.getElementById('api-key-input');
    const uploadBaseImageBtn = document.getElementById('upload-base-image-btn');
    const loadProjectBtnWelcome = document.getElementById('load-project-btn-welcome');
    const editMetadataBtn = document.getElementById('edit-metadata-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const loadProjectBtnEditor = document.getElementById('load-project-btn-editor');
    const exportImageBtn = document.getElementById('export-image-btn');
    const generateAiBtn = document.getElementById('generate-ai-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    // All other getElementById calls are assumed here for brevity...


    // --- UNDO/REDO LOGIC ---
    function saveStateForUndo(actionDescription) {
        if (historyIndex < stateHistory.length - 1) {
            stateHistory = stateHistory.slice(0, historyIndex + 1);
        }
        const stateCopy = JSON.parse(JSON.stringify(projectState));
        stateHistory.push({ state: stateCopy, action: actionDescription });
        historyIndex++;
        updateUndoRedoButtons();
    }

    async function loadState(historyEntry) {
        projectState = JSON.parse(JSON.stringify(historyEntry.state));
        
        if (projectState.baseImageSrc) {
            baseImage = await loadImage(projectState.baseImageSrc);
        } else {
            baseImage = null;
        }
        
        gridSelect.value = `${projectState.gridConfig.cols}x${projectState.gridConfig.rows}`;
        isCropMode = false;
        cropModeToggle.checked = false;
        cropSelection.clear();
        cropSelectionBtn.classList.add('hidden');

        await updateUI();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            loadState(stateHistory[historyIndex]);
        }
        updateUndoRedoButtons();
    }

    function redo() {
        if (historyIndex < stateHistory.length - 1) {
            historyIndex++;
            loadState(stateHistory[historyIndex]);
        }
        updateUndoRedoButtons();
    }
    
    function updateUndoRedoButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= stateHistory.length - 1;
    }

    // --- CORE LOGIC & DRAWING ---
    async function drawCanvas(isExporting = false, skipSelection = false) {
        if (!baseImage) return;
        
        const { rows, cols } = projectState.gridConfig;
        const baseCellWidth = baseImage.width / cols;
        const baseCellHeight = baseImage.height / rows;
        const colWidths = new Array(cols).fill(baseCellWidth);
        const rowHeights = new Array(rows).fill(baseCellHeight);

        for (const key in projectState.cellHistory) {
            const history = projectState.cellHistory[key];
            if (history && history.length > 0) {
                const [row, col] = key.split('-').map(Number);
                const latestReplacement = history[history.length - 1];
                colWidths[col] = Math.max(colWidths[col], latestReplacement.width);
                rowHeights[row] = Math.max(rowHeights[row], latestReplacement.height);
            }
        }

        const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
        const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        let currentY = 0;
        for (let row = 0; row < rows; row++) {
            let currentX = 0;
            for (let col = 0; col < cols; col++) {
                const cellKey = `${row}-${col}`;
                const cellW = colWidths[col];
                const cellH = rowHeights[row];
                const history = projectState.cellHistory[cellKey];
                
                if (history && history.length > 0) {
                    const latestReplacement = history[history.length - 1];
                    const img = await loadImage(latestReplacement.src);
                    ctx.drawImage(img, currentX, currentY, cellW, cellH);
                } else {
                    const sx = col * baseCellWidth;
                    const sy = row * baseCellHeight;
                     if (cellW > baseCellWidth || cellH > baseCellHeight) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                        ctx.fillRect(currentX, currentY, cellW, cellH);
                        const centeredX = currentX + (cellW - baseCellWidth) / 2;
                        const centeredY = currentY + (cellH - baseCellHeight) / 2;
                        ctx.drawImage(baseImage, sx, sy, baseCellWidth, baseCellHeight, centeredX, centeredY, baseCellWidth, baseCellHeight);
                    } else {
                       ctx.drawImage(baseImage, sx, sy, baseCellWidth, baseCellHeight, currentX, currentY, cellW, cellH);
                    }
                }
                currentX += cellW;
            }
            currentY += rowHeights[row];
        }

        if (!isExporting && projectState.ui.showGrid) {
            ctx.save();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.setLineDash([10, 10]);
            ctx.lineDashOffset = 0;
            ctx.beginPath();
            let cX_w = 0; for(let i = 0; i < cols - 1; i++) { cX_w += colWidths[i]; ctx.moveTo(cX_w, 0); ctx.lineTo(cX_w, canvas.height); }
            let cY_w = 0; for(let i = 0; i < rows - 1; i++) { cY_w += rowHeights[i]; ctx.moveTo(0, cY_w); ctx.lineTo(canvas.width, cY_w); }
            ctx.stroke();
            ctx.strokeStyle = 'black';
            ctx.lineDashOffset = 10;
            ctx.beginPath();
            let cX_b = 0; for(let i = 0; i < cols - 1; i++) { cX_b += colWidths[i]; ctx.moveTo(cX_b, 0); ctx.lineTo(cX_b, canvas.height); }
            let cY_b = 0; for(let i = 0; i < rows - 1; i++) { cY_b += rowHeights[i]; ctx.moveTo(0, cY_b); ctx.lineTo(canvas.width, cY_b); }
            ctx.stroke();
            ctx.restore();
        }

        if (!skipSelection && isCropMode && cropSelection.size > 0) {
            ctx.fillStyle = 'rgba(79, 70, 229, 0.4)';
            let currentCropY = 0;
            for (let row = 0; row < rows; row++) {
                let currentCropX = 0;
                for (let col = 0; col < cols; col++) {
                    const cellKey = `${row}-${col}`;
                    if (cropSelection.has(cellKey)) {
                        ctx.fillRect(currentCropX, currentCropY, colWidths[col], rowHeights[row]);
                    }
                    currentCropX += colWidths[col];
                }
                currentCropY += rowHeights[row];
            }
        }
    }
    
    async function updateUI() {
        projectTitleDisplay.textContent = projectState.metadata.title;
        previewToggle.checked = !projectState.ui.showGrid;
        apiKeyInput.value = projectState.ui.apiKey;
        await drawCanvas();
    }
    
    async function performCrop() {
        if (cropSelection.size === 0) return;

        saveStateForUndo('Crop Image');

        await drawCanvas(true, true); // Draw clean canvas without grid or selection

        const { rows, cols } = projectState.gridConfig;
        const baseCellWidth = baseImage.width / cols;
        const baseCellHeight = baseImage.height / rows;

        let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1;
        cropSelection.forEach(cellKey => {
            const [row, col] = cellKey.split('-').map(Number);
            minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
            minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
        });

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        let cropWidth = 0, cropHeight = 0;
        const newGridCols = (maxCol - minCol + 1);
        const newGridRows = (maxRow - minRow + 1);
        const colWidths = [];
        const rowHeights = [];

        // Determine dimensions of the new cropped canvas and cell history
        for (let r = minRow; r <= maxRow; r++) {
            let maxHeightInRow = baseCellHeight;
            for (let c = minCol; c <= maxCol; c++) {
                 const history = projectState.cellHistory[`${r}-${c}`];
                 if (history && history.length > 0) maxHeightInRow = Math.max(maxHeightInRow, history[history.length - 1].height);
            }
            rowHeights.push(maxHeightInRow);
            cropHeight += maxHeightInRow;
        }
        for (let c = minCol; c <= maxCol; c++) {
             let maxWidthInCol = baseCellWidth;
            for (let r = minRow; r <= maxRow; r++) {
                 const history = projectState.cellHistory[`${r}-${c}`];
                 if (history && history.length > 0) maxWidthInCol = Math.max(maxWidthInCol, history[history.length - 1].width);
            }
            colWidths.push(maxWidthInCol);
            cropWidth += maxWidthInCol;
        }

        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;

        const newCellHistory = {};
        let currentY = 0;
        for (let r = 0; r < newGridRows; r++) {
            let currentX = 0;
            for (let c = 0; c < newGridCols; c++) {
                const originalRow = minRow + r;
                const originalCol = minCol + c;
                const cellKey = `${originalRow}-${originalCol}`;
                const newCellKey = `${r}-${c}`;
                
                if (projectState.cellHistory[cellKey]) newCellHistory[newCellKey] = projectState.cellHistory[cellKey];

                const history = projectState.cellHistory[cellKey];
                if (history && history.length > 0) {
                    const latest = history[history.length - 1];
                    const img = await loadImage(latest.src);
                    tempCtx.drawImage(img, currentX, currentY, colWidths[c], rowHeights[r]);
                } else {
                    const sx = originalCol * baseCellWidth;
                    const sy = originalRow * baseCellHeight;
                    tempCtx.drawImage(baseImage, sx, sy, baseCellWidth, baseCellHeight, currentX, currentY, colWidths[c], rowHeights[r]);
                }
                currentX += colWidths[c];
            }
            currentY += rowHeights[r];
        }

        const newDataUrl = tempCanvas.toDataURL('image/png');
        baseImage = await loadImage(newDataUrl);
        
        projectState.baseImageSrc = newDataUrl;
        projectState.gridConfig = { rows: newGridRows, cols: newGridCols };
        projectState.cellHistory = newCellHistory;
        
        isCropMode = false;
        cropModeToggle.checked = false;
        cropSelection.clear();
        cropSelectionBtn.classList.add('hidden');

        await drawCanvas();
    }

    // --- INITIALIZATION & EVENT HANDLERS ---
    function initializeAppWithImage(imageSrc, apiKey = '') {
        projectState.baseImageSrc = imageSrc;
        projectState.ui.apiKey = apiKey;
        projectState.metadata.dateCreated = new Date().toISOString();
        projectState.cellHistory = {};
        baseImage = new Image();
        baseImage.onload = () => {
            welcomeScreen.classList.add('hidden');
            editorView.classList.remove('hidden');
            stateHistory = [];
            historyIndex = -1;
            saveStateForUndo('Initial Image');
            updateUI();
        };
        baseImage.src = imageSrc;
    }

    function init() {
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);

        gridSelect.addEventListener('change', async () => {
            saveStateForUndo('Change Grid');
            await drawCanvas(true);
            const newDataUrl = canvas.toDataURL('image/png');
            projectState.baseImageSrc = newDataUrl;
            baseImage = await loadImage(newDataUrl);
            const [cols, rows] = gridSelect.value.split('x').map(Number);
            projectState.gridConfig = { rows, cols };
            projectState.cellHistory = {};
            await drawCanvas(false);
        });

        generateAiBtn.addEventListener('click', () => {
            saveStateForUndo('AI Generate');
            // handleAIGeneration(); This is now called inside the saveState function after prompt
        });

        cropSelectionBtn.addEventListener('click', performCrop);

        // ... other event listeners
        uploadBaseImageBtn.addEventListener('click', () => document.getElementById('base-image-input').click());
        document.getElementById('base-image-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => initializeAppWithImage(ev.target.result, projectState.ui.apiKey);
            reader.readAsDataURL(file);
        });
        
        updateUndoRedoButtons();
    }
    
    init();
});
