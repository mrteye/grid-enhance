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
    const generateBaseImageBtn = document.getElementById('generate-base-image-btn');
    const baseImageModal = document.getElementById('base-image-modal');
    const baseImagePromptInput = document.getElementById('base-image-prompt-input');
    const baseImageApiKeyInput = document.getElementById('base-image-api-key-input');
    const generateBaseBtn = document.getElementById('generate-base-btn');
    const cancelBaseBtn = document.getElementById('cancel-base-btn');
    const generateBaseSpinner = document.getElementById('generate-base-spinner');
    const generateBaseBtnText = document.getElementById('generate-base-btn-text');
    const cellActionModal = document.getElementById('cell-action-modal');
    const cellActionTitle = document.getElementById('cell-action-title');
    const cellPreviewCanvas = document.getElementById('cell-preview-canvas');
    const otherPromptsList = document.getElementById('other-prompts-list');
    const cellPromptInput = document.getElementById('cell-prompt-input');
    const generateAiSpinner = document.getElementById('generate-ai-spinner');
    const generateAiBtnText = document.getElementById('generate-ai-btn-text');
    const replaceCellBtn = document.getElementById('replace-cell-btn');
    const clearCellBtn = document.getElementById('clear-cell-btn');
    const cancelCellActionBtn = document.getElementById('cancel-cell-action-btn');
    const metadataModal = document.getElementById('metadata-modal');
    const metaTitle = document.getElementById('meta-title');
    const metaDesc = document.getElementById('meta-desc');
    const metaAuthor = document.getElementById('meta-author');
    const metaVersion = document.getElementById('meta-version');
    const saveMetadataBtn = document.getElementById('save-metadata-btn');
    const cancelMetadataBtn = document.getElementById('cancel-metadata-btn');
    const promptAssistBtn = document.getElementById('prompt-assist-btn');
    const promptAssistModal = document.getElementById('prompt-assist-modal');
    const promptAssistList = document.getElementById('prompt-assist-list');
    const newAssistInput = document.getElementById('new-assist-input');
    const addAssistBtn = document.getElementById('add-assist-btn');
    const closeAssistModalBtn = document.getElementById('close-assist-modal-btn');

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
        if (!baseImage) {
            ctx.clearRect(0,0, canvas.width, canvas.height);
            return;
        };
        
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
                    const cellW = colWidths[col];
                    const cellH = rowHeights[row];
                    if (cropSelection.has(cellKey)) {
                        ctx.fillRect(currentCropX, currentCropY, cellW, cellH);
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
        gridSelect.value = `${projectState.gridConfig.cols}x${projectState.gridConfig.rows}`;
        await drawCanvas();
    }

    // --- GEMINI API & IMAGE HANDLING ---
    const handleBaseImageGeneration = async () => {
        const prompt = baseImagePromptInput.value;
        const apiKey = baseImageApiKeyInput.value;
        if (!prompt || !apiKey) {
            alert('Please provide a prompt and your API key.');
            return;
        }
        setBaseGenLoading(true);
        try {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseModalities: ['IMAGE'] },
            };
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.error.message}`);
            }
            const result = await response.json();
            const newImageBase64 = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (!newImageBase64) {
                throw new Error("API did not return an image. The prompt might be unsafe.");
            }
            const newImageSrc = `data:image/png;base64,${newImageBase64}`;
            initializeAppWithImage(newImageSrc, apiKey);
            hideBaseImageModal();
        } catch (error) {
            console.error("Base Image Generation Failed:", error);
            alert("Base Image Generation Failed: " + error.message);
        } finally {
            setBaseGenLoading(false);
        }
    };

    async function handleAIGeneration() {
        if (!activeCell || !projectState.ui.apiKey) {
            alert('Please enter your Google AI API Key in the control panel.');
            return;
        }
        setAILoading(true);
        try {
            let finalPrompt = cellPromptInput.value;
            const enabledAssists = projectState.metadata.promptAssists.filter(a => a.enabled).map(a => a.text);
            if(enabledAssists.length > 0) {
                finalPrompt += '; ' + enabledAssists.join('; ');
            }

            const cellImageBase64 = await getCellAsBase64(activeCell);
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${projectState.ui.apiKey}`;
            const payload = {
                contents: [{ parts: [ { text: finalPrompt }, { inlineData: { mimeType: "image/png", data: cellImageBase64 } } ] }],
                generationConfig: { responseModalities: ['IMAGE'] },
            };
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.error.message}`);
            }
            const result = await response.json();
            const newImageBase64 = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (!newImageBase64) throw new Error("API did not return an image.");
            const newImageSrc = `data:image/png;base64,${newImageBase64}`;
            const img = await loadImage(newImageSrc);
            const cellKey = `${activeCell.row}-${activeCell.col}`;
            const newHistoryEntry = { src: newImageSrc, width: img.width, height: img.height, prompt: cellPromptInput.value };
            if (!projectState.cellHistory[cellKey]) projectState.cellHistory[cellKey] = [];
            projectState.cellHistory[cellKey].push(newHistoryEntry);
            projectState.metadata.dateModified = new Date().toISOString();
            await drawCanvas();
            hideCellActionModal();
        } catch (error) {
            console.error("AI Generation Failed:", error);
            alert("AI Generation Failed: " + error.message);
        } finally {
            setAILoading(false);
        }
    }
    
    async function performCrop() {
        if (cropSelection.size === 0) return;
        saveStateForUndo('Crop Image');
        await drawCanvas(true, true);
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

    // --- UTILITY & HELPER FUNCTIONS ---
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = src;
        });
    }

     async function getCellAsBase64(cell) {
        if (!baseImage) return null;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const cellKey = `${cell.row}-${cell.col}`;
        const history = projectState.cellHistory[cellKey];
        if (history && history.length > 0) {
            const latest = history[history.length - 1];
            const img = await loadImage(latest.src);
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
        } else {
            const { rows, cols } = projectState.gridConfig;
            const cellWidth = baseImage.width / cols;
            const cellHeight = baseImage.height / rows;
            const sx = cell.col * cellWidth;
            const sy = cell.row * cellHeight;
            tempCanvas.width = cellWidth;
            tempCanvas.height = cellHeight;
            tempCtx.drawImage(baseImage, sx, sy, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
        }
        return tempCanvas.toDataURL('image/png').split(',')[1];
    }
    const showBaseImageModal = () => baseImageModal.classList.remove('hidden');
    const hideBaseImageModal = () => baseImageModal.classList.add('hidden');
    const setBaseGenLoading = (isLoading) => {
        generateBaseBtn.disabled = isLoading;
        generateBaseBtnText.style.display = isLoading ? 'none' : 'inline';
        generateBaseSpinner.style.display = isLoading ? 'inline-block' : 'none';
    };
     const showCellActionModal = async (cell) => {
        activeCell = cell;
        const cellKey = `${cell.row}-${cell.col}`;
        cellActionTitle.textContent = `Actions for Cell (R:${cell.row + 1}, C:${cell.col + 1})`;
        const history = projectState.cellHistory[cellKey];
        if (history && history.length > 0) {
            cellPromptInput.value = history[history.length - 1].prompt || '';
            clearCellBtn.disabled = false;
            clearCellBtn.textContent = `Undo Gen (${history.length})`;
        } else {
            cellPromptInput.value = '';
            clearCellBtn.disabled = true;
            clearCellBtn.textContent = 'Undo Last Gen';
        }
        
        // Make modal visible so clientWidth is available for canvas sizing
        cellActionModal.classList.remove('hidden');

        const previewCtx = cellPreviewCanvas.getContext('2d');
        const base64 = await getCellAsBase64(activeCell);
        previewCtx.clearRect(0, 0, cellPreviewCanvas.width, cellPreviewCanvas.height);
        if (base64) {
            const img = await loadImage(`data:image/png;base64,${base64}`);
            const aspect = img.width / img.height;
            cellPreviewCanvas.width = cellPreviewCanvas.clientWidth;
            cellPreviewCanvas.height = cellPreviewCanvas.width / aspect;
            previewCtx.drawImage(img, 0, 0, cellPreviewCanvas.width, cellPreviewCanvas.height);
        }

        otherPromptsList.innerHTML = '';
        let hasOtherPrompts = false;
        Object.values(projectState.cellHistory).flat().forEach(item => {
            if (item.prompt && item.prompt !== 'Manual Upload') {
                hasOtherPrompts = true;
                const p = document.createElement('p');
                p.className = 'p-1 hover:bg-gray-700 rounded';
                p.textContent = item.prompt;
                p.onclick = () => { cellPromptInput.value = p.textContent; };
                otherPromptsList.appendChild(p);
            }
        });
        if (!hasOtherPrompts) {
            otherPromptsList.innerHTML = '<p class="text-gray-400 p-1">No other prompts yet.</p>';
        }
    };
     const hideCellActionModal = () => cellActionModal.classList.add('hidden');
     const setAILoading = (isLoading) => {
        generateAiBtn.disabled = isLoading;
        generateAiBtnText.style.display = isLoading ? 'none' : 'inline';
        generateAiSpinner.style.display = isLoading ? 'inline-block' : 'none';
    };

    // --- METADATA MODAL ---
    const showMetadataModal = () => {
        metaTitle.value = projectState.metadata.title;
        metaDesc.value = projectState.metadata.description;
        metaAuthor.value = projectState.metadata.author;
        metaVersion.value = projectState.metadata.versionNote;
        metadataModal.classList.remove('hidden');
    };
    const hideMetadataModal = () => metadataModal.classList.add('hidden');
    const saveMetadata = () => {
        saveStateForUndo('Update Metadata');
        projectState.metadata.title = metaTitle.value || 'Untitled Project';
        projectState.metadata.description = metaDesc.value;
        projectState.metadata.author = metaAuthor.value;
        projectState.metadata.versionNote = metaVersion.value;
        projectState.metadata.dateModified = new Date().toISOString();
        updateUI();
        hideMetadataModal();
    };

    // --- PROMPT ASSIST MODAL ---
    const showPromptAssistModal = () => {
        renderPromptAssists();
        promptAssistModal.classList.remove('hidden');
    };
    const hidePromptAssistModal = () => promptAssistModal.classList.add('hidden');
    const renderPromptAssists = () => {
        promptAssistList.innerHTML = '';
        if (projectState.metadata.promptAssists.length === 0) {
            promptAssistList.innerHTML = '<p class="text-gray-400 text-sm">No assists added yet.</p>';
            return;
        }
        projectState.metadata.promptAssists.forEach((assist, index) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-gray-700 p-2 rounded';
            const label = document.createElement('label');
            label.className = 'flex items-center text-sm text-gray-200 flex-grow';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = assist.enabled;
            checkbox.className = 'h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-gray-600 mr-3';
            checkbox.onchange = () => { projectState.metadata.promptAssists[index].enabled = checkbox.checked; };
            label.appendChild(checkbox);
            label.append(assist.text);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Remove';
            deleteBtn.className = 'btn btn-danger btn-sm text-xs';
            deleteBtn.onclick = () => {
                projectState.metadata.promptAssists.splice(index, 1);
                renderPromptAssists();
            };
            div.appendChild(label);
            div.appendChild(deleteBtn);
            promptAssistList.appendChild(div);
        });
    };
    const addPromptAssist = () => {
        const text = newAssistInput.value.trim();
        if (text) {
            projectState.metadata.promptAssists.push({ text, enabled: true });
            newAssistInput.value = '';
            renderPromptAssists();
        }
    };

    // --- PROJECT SAVE/LOAD/EXPORT ---
    const saveProject = () => {
        projectState.ui.apiKey = apiKeyInput.value;
        const projectData = JSON.stringify(projectState, null, 2);
        const blob = new Blob([projectData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = projectState.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeTitle || 'project'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const loadProject = (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const newState = JSON.parse(e.target.result);
                if (!newState.metadata || !newState.baseImageSrc) throw new Error('Invalid project file format.');
                projectState = newState;
                baseImage = await loadImage(projectState.baseImageSrc);
                welcomeScreen.classList.add('hidden');
                editorView.classList.remove('hidden');
                stateHistory = [];
                historyIndex = -1;
                saveStateForUndo('Load Project');
                await updateUI();
            } catch (error) {
                alert(`Failed to load project: ${error.message}`);
            }
        };
        reader.readAsText(file);
    };

    const exportImage = async () => {
        await drawCanvas(true);
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        const safeTitle = projectState.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeTitle || 'export'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await drawCanvas(false);
    };

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

        previewToggle.addEventListener('change', () => {
            projectState.ui.showGrid = !previewToggle.checked;
            drawCanvas();
        });

        cropModeToggle.addEventListener('change', (e) => {
            isCropMode = e.target.checked;
            // If we turn crop mode off, clear the selection and hide the button
            if (!isCropMode) {
                cropSelection.clear();
                cropSelectionBtn.classList.add('hidden');
                drawCanvas(); // Redraw to remove selection overlay
            }
        });
        
        // Project Management & Modals
        saveProjectBtn.addEventListener('click', saveProject);
        exportImageBtn.addEventListener('click', exportImage);
        loadProjectBtnEditor.addEventListener('click', () => document.getElementById('load-project-input').click());
        loadProjectBtnWelcome.addEventListener('click', () => document.getElementById('load-project-input').click());
        document.getElementById('load-project-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                loadProject(file);
                e.target.value = null; // Reset input
            }
        });

        // Metadata Modal
        editMetadataBtn.addEventListener('click', showMetadataModal);
        saveMetadataBtn.addEventListener('click', saveMetadata);
        cancelMetadataBtn.addEventListener('click', hideMetadataModal);

        // Prompt Assist Modal
        promptAssistBtn.addEventListener('click', showPromptAssistModal);
        addAssistBtn.addEventListener('click', addPromptAssist);
        newAssistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPromptAssist(); });
        closeAssistModalBtn.addEventListener('click', hidePromptAssistModal);

        generateBaseImageBtn.addEventListener('click', showBaseImageModal);
        cancelBaseBtn.addEventListener('click', hideBaseImageModal);
        generateBaseBtn.addEventListener('click', handleBaseImageGeneration);
        generateAiBtn.addEventListener('click', () => {
            saveStateForUndo('AI Generate');
            handleAIGeneration();
        });
        cropSelectionBtn.addEventListener('click', performCrop);
        uploadBaseImageBtn.addEventListener('click', () => document.getElementById('base-image-input').click());
        document.getElementById('base-image-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => initializeAppWithImage(ev.target.result, projectState.ui.apiKey);
            reader.readAsDataURL(file);
        });
        clearCellBtn.addEventListener('click', () => {
            if (activeCell) {
                const cellKey = `${activeCell.row}-${activeCell.col}`;
                if (projectState.cellHistory[cellKey] && projectState.cellHistory[cellKey].length > 0) {
                    saveStateForUndo('Undo Cell Generation');
                    projectState.cellHistory[cellKey].pop();
                    drawCanvas();
                    showCellActionModal(activeCell); // Refresh modal
                }
            }
        });
        cancelCellActionBtn.addEventListener('click', hideCellActionModal);
        replaceCellBtn.addEventListener('click', () => document.getElementById('cell-image-input').click());
        document.getElementById('cell-image-input').addEventListener('change', (e) => {
             const file = e.target.files[0];
            if (!file || !activeCell) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                 const img = await loadImage(ev.target.result);
                 const cellKey = `${activeCell.row}-${activeCell.col}`;
                 const newHistoryEntry = { src: ev.target.result, width: img.width, height: img.height, prompt: 'Manual Upload' };
                 if (!projectState.cellHistory[cellKey]) projectState.cellHistory[cellKey] = [];
                 projectState.cellHistory[cellKey].push(newHistoryEntry);
                 saveStateForUndo('Upload Cell Image');
                 drawCanvas();
                 hideCellActionModal();
            }
            reader.readAsDataURL(file);
        });
        canvas.addEventListener('click', (event) => {
            if (!baseImage) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;
            const { rows, cols } = projectState.gridConfig;
            const baseCellWidth = baseImage.width / cols;
            const baseCellHeight = baseImage.height / rows;
            const colWidths = new Array(cols).fill(baseCellWidth);
            const rowHeights = new Array(rows).fill(baseCellHeight);
             for (const key in projectState.cellHistory) {
                const history = projectState.cellHistory[key];
                if (history && history.length > 0) {
                    const [r, c] = key.split('-').map(Number);
                    const latest = history[history.length - 1];
                    colWidths[c] = Math.max(colWidths[c], latest.width);
                    rowHeights[r] = Math.max(rowHeights[r], latest.height);
                }
            }
            let cumulativeY = 0;
            for (let row = 0; row < rows; row++) {
                let cumulativeX = 0;
                for (let col = 0; col < cols; col++) {
                    const cellW = colWidths[col];
                    const cellH = rowHeights[row];
                    if (x >= cumulativeX && x <= cumulativeX + cellW && y >= cumulativeY && y <= cumulativeY + cellH) {
                        const cell = { row, col };
                         if (isCropMode) {
                            const cellKey = `${row}-${col}`;
                            if (cropSelection.has(cellKey)) {
                                cropSelection.delete(cellKey);
                            } else {
                                cropSelection.add(cellKey);
                            }
                            cropSelectionBtn.classList.toggle('hidden', cropSelection.size === 0);
                            drawCanvas();
                        } else {
                           showCellActionModal(cell);
                        }
                        return;
                    }
                    cumulativeX += cellW;
                }
                cumulativeY += rowHeights[row];
            }
        });
        
        updateUndoRedoButtons();
    }
    
    init();
});
