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
        },
        baseImageSrc: null,
        gridConfig: { rows: 2, cols: 2 },
        cellReplacements: {}, // key: "row-col", value: { src, width, height, prompt }
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

    // --- CORE LOGIC & DRAWING ---
    async function drawCanvas() {
        if (!baseImage) return;

        const { rows, cols } = projectState.gridConfig;
        const baseCellWidth = baseImage.width / cols;
        const baseCellHeight = baseImage.height / rows;

        const colWidths = new Array(cols).fill(baseCellWidth);
        const rowHeights = new Array(rows).fill(baseCellHeight);

        for (const key in projectState.cellReplacements) {
            const [row, col] = key.split('-').map(Number);
            const replacement = projectState.cellReplacements[key];
            colWidths[col] = Math.max(colWidths[col], replacement.width);
            rowHeights[row] = Math.max(rowHeights[row], replacement.height);
        }

        const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
        const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

        canvas.width = totalWidth;
        canvas.height = totalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let currentY = 0;
        for (let row = 0; row < rows; row++) {
            let currentX = 0;
            for (let col = 0; col < cols; col++) {
                const cellKey = `${row}-${col}`;
                const cellW = colWidths[col];
                const cellH = rowHeights[row];

                if (projectState.cellReplacements[cellKey]) {
                    const replacement = projectState.cellReplacements[cellKey];
                    const img = await loadImage(replacement.src);
                    ctx.drawImage(img, currentX, currentY, cellW, cellH);
                } else {
                    const sx = col * baseCellWidth;
                    const sy = row * baseCellHeight;
                    ctx.drawImage(baseImage, sx, sy, baseCellWidth, baseCellHeight, currentX, currentY, cellW, cellH);
                }
                currentX += cellW;
            }
            currentY += rowHeights[row];
        }

        if (projectState.ui.showGrid) {
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
        previewToggle.checked =!projectState.ui.showGrid;
        apiKeyInput.value = projectState.ui.apiKey;
        drawCanvas();
    }

    // --- GEMINI API LOGIC ---
    async function handleAIGeneration() {
        if (!activeCell ||!projectState.ui.apiKey) {
            alert('Please enter your Google AI API Key in the control panel.');
            return;
        }

        setAILoading(true);

        try {
            const prompt = cellPromptInput.value;
            const cellImageBase64 = await getCellAsBase64(activeCell);

            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${projectState.ui.apiKey}`;

            const payload = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/png", data: cellImageBase64 } }
                    ]
                }],
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
            projectState.cellReplacements[cellKey] = {
                src: newImageSrc, width: img.width, height: img.height, prompt: prompt
            };
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

    // --- SAVE, LOAD, EXPORT FUNCTIONS ---
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

    function exportImage() {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${projectState.metadata.title.replace(/\s+/g, '_')}_export.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // --- UTILITY FUNCTIONS ---
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

        if (projectState.cellReplacements[cellKey]) {
            const replacement = projectState.cellReplacements[cellKey];
            const img = await loadImage(replacement.src);
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

    // --- EVENT HANDLERS & INITIALIZATION ---
    function init() {
        const handleCellReplacement = (file) => {
            if (!file ||!activeCell) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const cellKey = `${activeCell.row}-${activeCell.col}`;
                    projectState.cellReplacements[cellKey] = {
                        src: e.target.result, width: img.width, height: img.height,
                        prompt: projectState.cellReplacements[cellKey]?.prompt |

| ''
                    };
                    projectState.metadata.dateModified = new Date().toISOString();
                    drawCanvas();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            hideCellActionModal();
        };

        loadProjectInput.addEventListener('change', (event) => {
            const file = event.target.files;
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const loadedState = JSON.parse(e.target.result);
                    projectState = loadedState;
                    if (projectState.baseImageSrc) {
                        baseImage = await loadImage(projectState.baseImageSrc);
                    }
                    gridSelect.value = `${projectState.gridConfig.cols}x${projectState.gridConfig.rows}`;
                    updateUI();
                    welcomeScreen.classList.add('hidden');
                    editorView.classList.remove('hidden');
                    editorView.classList.add('app-container');
                } catch (error) {
                    alert('Failed to load project file. It may be corrupted.');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        });

        uploadBaseImageBtn.addEventListener('click', () => baseImageInput.click());
        loadProjectBtnWelcome.addEventListener('click', () => loadProjectInput.click());
        baseImageInput.addEventListener('change', (e) => {
            const file = e.target.files;
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                projectState.baseImageSrc = ev.target.result;
                projectState.metadata.dateCreated = new Date().toISOString();
                baseImage = new Image();
                baseImage.onload = () => {
                    welcomeScreen.classList.add('hidden');
                    editorView.classList.remove('hidden');
                    editorView.classList.add('app-container');
                    updateUI();
                };
                baseImage.src = projectState.baseImageSrc;
            };
            reader.readAsDataURL(file);
        });
        apiKeyInput.addEventListener('input', (e) => projectState.ui.apiKey = e.target.value);
        gridSelect.addEventListener('change', () => {
            const [cols, rows] = gridSelect.value.split('x').map(Number);
            projectState.gridConfig = { rows, cols };
            projectState.cellReplacements = {};
            drawCanvas();
        });
        previewToggle.addEventListener('change', (e) => { projectState.ui.showGrid =!e.target.checked; drawCanvas(); });
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

            for (const key in projectState.cellReplacements) {
                const [r, c] = key.split('-').map(Number);
                const rep = projectState.cellReplacements[key];
                colWidths[c] = Math.max(colWidths[c], rep.width);
                rowHeights[r] = Math.max(rowHeights[r], rep.height);
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
        cellImageInput.addEventListener('change', (e) => handleCellReplacement(e.target.files));
        clearCellBtn.addEventListener('click', () => {
            if(activeCell) {
                delete projectState.cellReplacements[`${activeCell.row}-${activeCell.col}`];
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
    }

    // --- Helper functions for modals and UI state ---
    const showCellActionModal = () => {
        const cellKey = `${activeCell.row}-${activeCell.col}`;
        cellActionTitle.textContent = `Actions for Cell (R:${activeCell.row + 1}, C:${activeCell.col + 1})`;
        cellPromptInput.value = projectState.cellReplacements[cellKey]?.prompt |

| '';
        clearCellBtn.style.display = projectState.cellReplacements[cellKey]? 'block' : 'none';
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
        generateAiBtnText.style.display = isLoading? 'none' : 'inline';
        generateAiSpinner.style.display = isLoading? 'inline-block' : 'none';
    };

    init();
});
