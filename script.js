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

    // --- DOM ELEMENTS ---
    const welcomeScreen = document.getElementById('welcome-screen');
    const editorView = document.getElementById('editor-view');
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');
    const gridSelect = document.getElementById('grid-select');
    const previewToggle = document.getElementById('preview-toggle');
    const projectTitleDisplay = document.getElementById('project-title-display');
    const apiKeyInput = document.getElementById('api-key-input');
    const uploadBaseImageBtn = document.getElementById('upload-base-image-btn');
    const loadProjectBtnWelcome = document.getElementById('load-project-btn-welcome');
    const editMetadataBtn = document.getElementById('edit-metadata-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const loadProjectBtnEditor = document.getElementById('load-project-btn-editor');
    const exportImageBtn = document.getElementById('export-image-btn');
    const cellActionModal = document.getElementById('cell-action-modal');
    const cellActionTitle = document.getElementById('cell-action-title');
    const cellPromptInput = document.getElementById('cell-prompt-input');
    const generateAiBtn = document.getElementById('generate-ai-btn');
    const generateAiBtnText = document.getElementById('generate-ai-btn-text');
    const generateAiSpinner = document.getElementById('generate-ai-spinner');
    const replaceCellBtn = document.getElementById('replace-cell-btn');
    const downloadCellBtn = document.getElementById('download-cell-btn');
    const clearCellBtn = document.getElementById('clear-cell-btn');
    const cancelCellActionBtn = document.getElementById('cancel-cell-action-btn');
    const baseImageInput = document.getElementById('base-image-input');
    const cellImageInput = document.getElementById('cell-image-input');
    const loadProjectInput = document.getElementById('load-project-input');
    const metaTitle = document.getElementById('meta-title');
    const metaDesc = document.getElementById('meta-desc');
    const metaAuthor = document.getElementById('meta-author');
    const metaVersion = document.getElementById('meta-version');
    const metadataModal = document.getElementById('metadata-modal');
    const saveMetadataBtn = document.getElementById('save-metadata-btn');
    const cancelMetadataBtn = document.getElementById('cancel-metadata-btn');
    const cellPreviewCanvas = document.getElementById('cell-preview-canvas');
    const otherPromptsList = document.getElementById('other-prompts-list');
    const promptAssistBtn = document.getElementById('prompt-assist-btn');
    const promptAssistModal = document.getElementById('prompt-assist-modal');
    const promptAssistList = document.getElementById('prompt-assist-list');
    const newAssistInput = document.getElementById('new-assist-input');
    const addAssistBtn = document.getElementById('add-assist-btn');
    const closeAssistModalBtn = document.getElementById('close-assist-modal-btn');
    // New elements for base image generation
    const generateBaseImageBtn = document.getElementById('generate-base-image-btn');
    const baseImageModal = document.getElementById('base-image-modal');
    const basePromptInput = document.getElementById('base-prompt-input');
    const baseApiKeyInput = document.getElementById('base-api-key-input');
    const generateBtn = document.getElementById('generate-btn');
    const generateBtnText = document.getElementById('generate-btn-text');
    const generateSpinner = document.getElementById('generate-spinner');
    const cancelBaseGenBtn = document.getElementById('cancel-base-gen-btn');

    // --- CORE LOGIC & DRAWING ---
    async function drawCanvas(isExporting = false) {
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
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            let cX = 0;
            for(let i = 0; i < cols - 1; i++) { cX += colWidths[i]; ctx.moveTo(cX, 0); ctx.lineTo(cX, canvas.height); }
            let cY = 0;
            for(let i = 0; i < rows - 1; i++) { cY += rowHeights[i]; ctx.moveTo(0, cY); ctx.lineTo(canvas.width, cY); }
            ctx.stroke();
        }
    }

    function updateUI() {
        projectTitleDisplay.textContent = projectState.metadata.title;
        previewToggle.checked = !projectState.ui.showGrid;
        apiKeyInput.value = projectState.ui.apiKey;
        drawCanvas();
    }

    // --- GEMINI API LOGIC ---
    async function handleBaseImageGeneration() {
        const prompt = basePromptInput.value.trim();
        const apiKey = baseApiKeyInput.value.trim();
        if (!prompt || !apiKey) {
            alert('Please provide a prompt and your API key.');
            return;
        }

        setBaseGenLoading(true);
        try {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            const payload = { instances: [{ prompt: prompt }], parameters: { "sampleCount": 1 } };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.error.message || 'Unknown error'}`);
            }

            const result = await response.json();
            const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
            if (!base64Data) throw new Error("API did not return an image.");

            const newImageSrc = `data:image/png;base64,${base64Data}`;
            initializeAppWithImage(newImageSrc, apiKey);

        } catch (error) {
            console.error("Base Image Generation Failed:", error);
            alert("Base Image Generation Failed: " + error.message);
        } finally {
            setBaseGenLoading(false);
        }
    }

    async function handleAIGeneration() {
        if (!activeCell || !projectState.ui.apiKey) {
            alert('Please enter your Google AI API Key in the control panel.');
            return;
        }
        setAILoading(true);
        try {
            let finalPrompt = cellPromptInput.value;
            const enabledAssists = projectState.metadata.promptAssists.filter(a => a.enabled).map(a => a.text);
            if (enabledAssists.length > 0) {
                finalPrompt += '; ' + enabledAssists.join('; ');
            }
            const cellImageBase64 = await getCellAsBase64(activeCell);
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${projectState.ui.apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: finalPrompt }, { inlineData: { mimeType: "image/png", data: cellImageBase64 } }] }],
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
            if (!newImageBase64) throw new Error("API did not return an image. The prompt might be unsafe.");
            const newImageSrc = `data:image/png;base64,${newImageBase64}`;
            const img = await loadImage(newImageSrc);
            const cellKey = `${activeCell.row}-${activeCell.col}`;
            if (!projectState.cellHistory[cellKey]) {
                projectState.cellHistory[cellKey] = [];
            }
            projectState.cellHistory[cellKey].push({
                src: newImageSrc,
                width: img.width,
                height: img.height,
                prompt: cellPromptInput.value
            });
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

    // --- SAVE, LOAD, EXPORT ---
    function saveProject() {
        projectState.metadata.dateModified = new Date().toISOString();
        const projectJson = JSON.stringify(projectState, null, 2);
        const blob = new Blob([projectJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectState.metadata.title.replace(/\s+/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    async function exportImage() {
        await drawCanvas(true);
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${projectState.metadata.title.replace(/\s+/g, '_')}_export.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await drawCanvas(false);
    }

    // --- UTILITIES ---
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
            const latestReplacement = history[history.length - 1];
            const img = await loadImage(latestReplacement.src);
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
    
    function initializeAppWithImage(imageSrc, apiKey = '') {
        projectState.baseImageSrc = imageSrc;
        projectState.ui.apiKey = apiKey;
        projectState.metadata.dateCreated = new Date().toISOString();
        projectState.cellHistory = {};
        baseImage = new Image();
        baseImage.onload = () => {
            hideBaseImageModal();
            welcomeScreen.classList.add('hidden');
            editorView.classList.remove('hidden');
            editorView.classList.add('app-container');
            updateUI();
        };
        baseImage.src = imageSrc;
    }

    // --- EVENT HANDLERS & INITIALIZATION ---
    function init() {
        const handleCellReplacement = (file) => {
            if (!file || !activeCell) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const cellKey = `${activeCell.row}-${activeCell.col}`;
                    if (!projectState.cellHistory[cellKey]) {
                        projectState.cellHistory[cellKey] = [];
                    }
                    projectState.cellHistory[cellKey].push({
                        src: e.target.result,
                        width: img.width,
                        height: img.height,
                        prompt: 'Manual Upload'
                    });
                    projectState.metadata.dateModified = new Date().toISOString();
                    drawCanvas();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            hideCellActionModal();
        };

        loadProjectInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const loadedState = JSON.parse(e.target.result);
                    if (loadedState.cellReplacements) {
                        loadedState.cellHistory = {};
                        for (const key in loadedState.cellReplacements) {
                            loadedState.cellHistory[key] = [{
                                ...loadedState.cellReplacements[key],
                                prompt: loadedState.metadata?.prompts?.[key] || 'Imported'
                            }];
                        }
                        delete loadedState.cellReplacements;
                        if (loadedState.metadata) delete loadedState.metadata.prompts;
                    }
                    if (!loadedState.metadata.promptAssists) {
                        loadedState.metadata.promptAssists = [];
                    }
                    projectState = loadedState;
                    if (projectState.baseImageSrc) {
                        baseImage = await loadImage(projectState.baseImageSrc);
                    }
                    gridSelect.value = `${projectState.gridConfig.cols}x${projectState.gridConfig.rows}`;
                    updateUI();
                    welcomeScreen.classList.add('hidden');
                    editorView.classList.remove('hidden');
                } catch (error) {
                    alert('Failed to load project file. It may be corrupted.');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        });

        uploadBaseImageBtn.addEventListener('click', () => baseImageInput.click());
        baseImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => initializeAppWithImage(ev.target.result, projectState.ui.apiKey);
            reader.readAsDataURL(file);
        });

        loadProjectBtnWelcome.addEventListener('click', () => loadProjectInput.click());
        apiKeyInput.addEventListener('input', (e) => projectState.ui.apiKey = e.target.value);
        gridSelect.addEventListener('change', () => {
            const [cols, rows] = gridSelect.value.split('x').map(Number);
            projectState.gridConfig = { rows, cols };
            projectState.cellHistory = {};
            drawCanvas();
        });
        previewToggle.addEventListener('change', (e) => { projectState.ui.showGrid = !e.target.checked; drawCanvas(); });
        canvas.addEventListener('click', (event) => {
            if (!baseImage) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;
            const { rows, cols } = projectState.gridConfig;
            const colWidths = new Array(cols).fill(baseImage.width / cols);
            const rowHeights = new Array(rows).fill(baseImage.height / rows);
            for (const key in projectState.cellHistory) {
                const history = projectState.cellHistory[key];
                if (history && history.length > 0) {
                    const [r, c] = key.split('-').map(Number);
                    const rep = history[history.length - 1];
                    colWidths[c] = Math.max(colWidths[c], rep.width);
                    rowHeights[r] = Math.max(rowHeights[r], rep.height);
                }
            }
            let cumulativeY = 0;
            for (let row = 0; row < rows; row++) {
                let cumulativeX = 0;
                for (let col = 0; col < cols; col++) {
                    const cellW = colWidths[col];
                    const cellH = rowHeights[row];
                    if (x >= cumulativeX && x <= cumulativeX + cellW && y >= cumulativeY && y <= cumulativeY + cellH) {
                        activeCell = { row, col };
                        showCellActionModal();
                        return;
                    }
                    cumulativeX += cellW;
                }
                cumulativeY += rowHeights[row];
            }
        });

        saveProjectBtn.addEventListener('click', saveProject);
        exportImageBtn.addEventListener('click', exportImage);
        loadProjectBtnEditor.addEventListener('click', () => loadProjectInput.click());
        editMetadataBtn.addEventListener('click', showMetadataModal);
        generateAiBtn.addEventListener('click', handleAIGeneration);
        replaceCellBtn.addEventListener('click', () => cellImageInput.click());
        cellImageInput.addEventListener('change', (e) => handleCellReplacement(e.target.files[0]));
        clearCellBtn.addEventListener('click', () => {
            if (activeCell) {
                const cellKey = `${activeCell.row}-${activeCell.col}`;
                const history = projectState.cellHistory[cellKey];
                if (history && history.length > 0) {
                    history.pop();
                    if (history.length === 0) {
                        delete projectState.cellHistory[cellKey];
                    }
                }
                drawCanvas();
            }
            hideCellActionModal();
        });
        cancelCellActionBtn.addEventListener('click', hideCellActionModal);
        saveMetadataBtn.addEventListener('click', () => {
            projectState.metadata.title = metaTitle.value;
            projectState.metadata.description = metaDesc.value;
            projectState.metadata.author = metaAuthor.value;
            projectState.metadata.versionNote = metaVersion.value;
            projectState.metadata.dateModified = new Date().toISOString();
            updateUI();
            hideMetadataModal();
        });
        cancelMetadataBtn.addEventListener('click', hideMetadataModal);
        promptAssistBtn.addEventListener('click', showPromptAssistModal);
        closeAssistModalBtn.addEventListener('click', hidePromptAssistModal);
        addAssistBtn.addEventListener('click', () => {
            const text = newAssistInput.value.trim();
            if (text) {
                projectState.metadata.promptAssists.push({ text, enabled: true });
                newAssistInput.value = '';
                renderPromptAssists();
            }
        });
        generateBaseImageBtn.addEventListener('click', showBaseImageModal);
        cancelBaseGenBtn.addEventListener('click', hideBaseImageModal);
        generateBtn.addEventListener('click', handleBaseImageGeneration);
    }

    // --- MODAL & UI HELPERS ---
    const showCellActionModal = async () => {
        const cellKey = `${activeCell.row}-${activeCell.col}`;
        const history = projectState.cellHistory[cellKey];
        const latestEntry = (history && history.length > 0) ? history[history.length - 1] : null;
        cellActionTitle.textContent = `Actions for Cell (R:${activeCell.row + 1}, C:${activeCell.col + 1})`;
        cellPromptInput.value = latestEntry?.prompt === 'Manual Upload' ? '' : latestEntry?.prompt || '';
        clearCellBtn.style.display = latestEntry ? 'block' : 'none';
        const previewCtx = cellPreviewCanvas.getContext('2d');
        const base64 = await getCellAsBase64(activeCell);
        const img = await loadImage(`data:image/png;base64,${base64}`);
        cellPreviewCanvas.width = img.width;
        cellPreviewCanvas.height = img.height;
        previewCtx.drawImage(img, 0, 0);
        otherPromptsList.innerHTML = '';
        let hasOtherPrompts = false;
        for (const key in projectState.cellHistory) {
            const otherHistory = projectState.cellHistory[key];
            if (key !== cellKey && otherHistory && otherHistory.length > 0) {
                const latestPrompt = otherHistory[otherHistory.length - 1].prompt;
                if (latestPrompt && latestPrompt !== 'Manual Upload') {
                    hasOtherPrompts = true;
                    const p = document.createElement('p');
                    p.textContent = latestPrompt;
                    p.onclick = () => { cellPromptInput.value = p.textContent; };
                    otherPromptsList.appendChild(p);
                }
            }
        }
        if (!hasOtherPrompts) {
            otherPromptsList.innerHTML = '<p class="text-gray-400">No other prompts yet.</p>';
        }
        cellActionModal.classList.remove('hidden');
    };
    const hideCellActionModal = () => { cellActionModal.classList.add('hidden'); activeCell = null; };
    const showMetadataModal = () => {
        metaTitle.value = projectState.metadata.title;
        metaDesc.value = projectState.metadata.description;
        metaAuthor.value = projectState.metadata.author;
        metaVersion.value = projectState.metadata.versionNote;
        metadataModal.classList.remove('hidden');
    };
    const hideMetadataModal = () => { metadataModal.classList.add('hidden'); };
    const setAILoading = (isLoading) => {
        generateAiBtn.disabled = isLoading;
        generateAiBtnText.style.display = isLoading ? 'none' : 'inline';
        generateAiSpinner.style.display = isLoading ? 'inline-block' : 'none';
    };
    const renderPromptAssists = () => {
        promptAssistList.innerHTML = '';
        projectState.metadata.promptAssists.forEach((assist, index) => {
            const assistEl = document.createElement('div');
            assistEl.className = 'flex items-center justify-between bg-gray-800 p-2 rounded';
            assistEl.innerHTML = `
                <div class="flex items-center">
                    <input type="checkbox" id="assist-check-${index}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-gray-700" ${assist.enabled ? 'checked' : ''}>
                    <label for="assist-check-${index}" class="ml-3 text-sm text-gray-200">${assist.text}</label>
                </div>
                <button data-index="${index}" class="text-red-400 hover:text-red-600 text-lg font-bold leading-none">&times;</button>
            `;
            promptAssistList.appendChild(assistEl);
            assistEl.querySelector('input').addEventListener('change', (e) => {
                projectState.metadata.promptAssists[index].enabled = e.target.checked;
            });
            assistEl.querySelector('button').addEventListener('click', (e) => {
                projectState.metadata.promptAssists.splice(index, 1);
                renderPromptAssists();
            });
        });
    };
    const showPromptAssistModal = () => {
        renderPromptAssists();
        promptAssistModal.classList.remove('hidden');
    };
    const hidePromptAssistModal = () => { promptAssistModal.classList.add('hidden'); };
    const showBaseImageModal = () => {
        baseApiKeyInput.value = projectState.ui.apiKey; // Pre-fill if already entered
        baseImageModal.classList.remove('hidden');
    };
    const hideBaseImageModal = () => { baseImageModal.classList.add('hidden'); };
    const setBaseGenLoading = (isLoading) => {
        generateBtn.disabled = isLoading;
        generateBtnText.style.display = isLoading ? 'none' : 'inline';
        generateSpinner.style.display = isLoading ? 'inline-block' : 'none';
    };

    init();
});

