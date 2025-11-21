(() => {
  'use strict';
  const DEFAULT_BACKGROUND_COLOR = '#FFFFFF';
  const DEFAULT_FOREGROUND_COLOR = '#000000';
  const DEMO_COLOR = '#FF6D00';
  const canvas = document.getElementById('pixelCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  let displayWidth = 520;
  let displayHeight = 520;
  let dpr = window.devicePixelRatio || 1;
  function resizeCanvas() {
    const container = document.getElementById('previewCanvas');
    const rect = container.getBoundingClientRect();
    displayWidth = Math.floor(rect.width);
    displayHeight = Math.floor(rect.height);
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    if (hasImage) {
      scheduleRedraw();
    } else {
      fillCanvasBackground(backgroundColor);
    }
  }
  const fileInput = document.getElementById('fileInput');
  const errorEl = document.getElementById('error');
  const uploadPreview = document.getElementById('uploadPreview');
  const uploadIcon = document.getElementById('uploadIcon');
  const emptyState = document.getElementById('emptyState');
  const previewCanvas = document.getElementById('previewCanvas');
  const exportPNGButton = document.getElementById('exportPNG');
  const exportSVGButton = document.getElementById('exportSVG');
  const resetLabel = document.querySelector('.panel__reset-label');
  const gridSizeSlider = document.getElementById('gridSize');
  const edgeSlider = document.getElementById('edgeThreshold');
  const detailSlider = document.getElementById('detailLevel');
  const lineSlider = document.getElementById('lineThickness');
  const outlineSlider = document.getElementById('outlineThickness');
  const gridSizeVal = document.getElementById('gridSizeVal');
  const edgeThresholdVal = document.getElementById('edgeThresholdVal');
  const detailLevelVal = document.getElementById('detailLevelVal');
  const lineThicknessVal = document.getElementById('lineThicknessVal');
  const outlineThicknessVal = document.getElementById('outlineThicknessVal');
  const bgSwatches = Array.from(document.querySelectorAll('.bg-swatch[data-color]'));
  const customBgColorPicker = document.getElementById('customBgPicker');
  const fgSwatches = Array.from(document.querySelectorAll('.fg-swatch[data-color]'));
  const customFgColorPicker = document.getElementById('customFgPicker');
  const styleButtons = document.querySelectorAll('.style-button');
  let styleMode = 'square';
  let processedImage = null;
  let demoImage = null;
  let hasImage = false;
  let gridSize = 10, edgeThreshold = 30, detailLevel = 1, lineThickness = 1, outlineThickness = 5;
  let backgroundColor = DEFAULT_BACKGROUND_COLOR;
  let foregroundColor = DEFAULT_FOREGROUND_COLOR;
  let typingTimeout = null;
  let offsetX = 0, offsetY = 0;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let cachedEdges = null;
  let isExportingPNG = false;
  let isExportingSVG = false;
  let isFirstAnimation = true;
  function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
      if (!lastRan) {
        func(...args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if ((Date.now() - lastRan) >= limit) {
            func(...args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    };
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  function fillCanvasBackground(color) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.scale(dpr, dpr);
  }
  function clearCanvas() {
    fillCanvasBackground(backgroundColor);
  }
  function updateEmptyState() {
    updateBackgroundVisuals();
  }
  function resetUploadPreview() {
    uploadPreview.src = '';
    uploadPreview.classList.add('hidden');
    uploadIcon.classList.remove('hidden');
  }
  function resetState() {
    processedImage = null;
    demoImage = null;
    hasImage = false;
    cachedEdges = null;
    resetUploadPreview();
    clearCanvas();
    setError(null);
    updateEmptyState();
    fileInput.value = '';
  }
  function setError(message) {
    if (!message) {
      errorEl.classList.add('hidden');
      errorEl.textContent = '';
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
  function getReadableTextColor(hex) {
    const normalized = hex.replace('#', '').trim();
    const expanded = normalized.length === 3
      ? normalized.split('').map(char => char + char).join('')
      : normalized;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return 'rgba(0, 0, 0, 0.3)';
    }
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.68)';
  }
  function updateBackgroundVisuals() {
    previewCanvas.style.backgroundColor = backgroundColor;
    previewCanvas.style.backgroundImage = 'none';
    emptyState.style.backgroundColor = backgroundColor;
    emptyState.style.backgroundImage = 'none';
    const textColor = getReadableTextColor(backgroundColor);
    emptyState.style.color = textColor;
    const chars = document.querySelectorAll('.typing-char');
    if (hasImage || backgroundColor !== DEFAULT_BACKGROUND_COLOR) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
      emptyState.classList.add('hidden');
      chars.forEach((char) => {
        char.classList.remove('typing-char--visible');
      });
    } else {
      emptyState.classList.remove('hidden');
      if (!typingTimeout) {
        runTypingAnimation(chars);
      }
    }
  }
  function runTypingAnimation(chars) {
    if (isFirstAnimation) {
      chars.forEach((char, index) => {
        setTimeout(() => {
          char.classList.add('typing-char--visible');
        }, index * 35);
      });
      typingTimeout = setTimeout(() => runTypingAnimation(chars), chars.length * 35 + 1000);
      isFirstAnimation = false;
    } else {
      chars.forEach((char) => {
        char.classList.remove('typing-char--visible');
      });
      setTimeout(() => {
        chars.forEach((char, index) => {
          setTimeout(() => {
            char.classList.add('typing-char--visible');
          }, index * 35);
        });
        typingTimeout = setTimeout(() => runTypingAnimation(chars), chars.length * 35 + 1000);
      }, 100);
    }
  }
  function detectEdges(imageData, edgeThresholdValue, detailLevelValue) {
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
    }
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const gx =
          gray[(y - 1) * width + (x + 1)] + 2 * gray[y * width + (x + 1)] + gray[(y + 1) * width + (x + 1)] -
          (gray[(y - 1) * width + (x - 1)] + 2 * gray[y * width + (x - 1)] + gray[(y + 1) * width + (x - 1)]);
        const gy =
          gray[(y - 1) * width + (x - 1)] + 2 * gray[(y - 1) * width + x] + gray[(y - 1) * width + (x + 1)] -
          (gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)]);
        const idx = y * width + x;
        magnitude[idx] = Math.sqrt(gx * gx + gy * gy) / 4;
        direction[idx] = Math.atan2(gy, gx);
      }
    }
    const edges = [];
    const weakEdges = [];
    const factor = 1 - (detailLevelValue - 1) / 29 * 0.75;
    const highThreshold = Math.max(edgeThresholdValue * factor, 1);
    const lowThreshold = highThreshold * 0.4;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (magnitude[idx] <= lowThreshold) continue;
  
        let dir = (direction[idx] * 180 / Math.PI + 180) % 180;
        let d;
        if (dir < 22.5 || dir >= 157.5) d = 0;
        else if (dir < 67.5) d = 45;
        else if (dir < 112.5) d = 90;
        else d = 135;
  
        let n1 = 0, n2 = 0;
        if (d === 0) { n1 = magnitude[idx - 1]; n2 = magnitude[idx + 1]; }
        else if (d === 45) { n1 = magnitude[idx + width - 1]; n2 = magnitude[idx - width + 1]; }
        else if (d === 90) { n1 = magnitude[idx - width]; n2 = magnitude[idx + width]; }
        else { n1 = magnitude[idx + width + 1]; n2 = magnitude[idx - width - 1]; }
  
        if (magnitude[idx] >= n1 && magnitude[idx] >= n2) {
          if (magnitude[idx] >= highThreshold) {
            edges.push(idx);
          } else {
            weakEdges.push(idx);
          }
        }
      }
    }
    const edgeSet = new Set(edges);
    const connected = new Set();
    weakEdges.forEach(idx => {
      const y = Math.floor(idx / width);
      const x = idx % width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (edgeSet.has(nIdx)) {
              connected.add(idx);
              break;
            }
          }
        }
        if (connected.has(idx)) break;
      }
    });
    return [...edges, ...Array.from(connected)];
  }
  function prepareImage(image) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = width;
    fullCanvas.height = height;
    const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
    if (!fullCtx) throw new Error('Unable to prepare canvas context');
    fullCtx.drawImage(image, 0, 0, width, height);
    const original = fullCtx.getImageData(0, 0, width, height);
    const targetSize = 360;
    const maxDimension = Math.max(width, height);
    const scale = maxDimension > targetSize ? targetSize / maxDimension : 1;
    const previewWidth = Math.max(1, Math.round(width * scale));
    const previewHeight = Math.max(1, Math.round(height * scale));
    const previewCanvasEl = document.createElement('canvas');
    previewCanvasEl.width = previewWidth;
    previewCanvasEl.height = previewHeight;
    const previewCtx = previewCanvasEl.getContext('2d', { willReadFrequently: true });
    if (!previewCtx) throw new Error('Unable to prepare preview context');
    previewCtx.imageSmoothingEnabled = false;
    previewCtx.drawImage(image, 0, 0, previewWidth, previewHeight);
    const preview = previewCtx.getImageData(0, 0, previewWidth, previewHeight);
    return {
      original,
      preview,
      originalWidth: width,
      originalHeight: height,
      previewWidth,
      previewHeight,
      scale
    };
  }
  function calculateShapeParams(x, y, uniformScale, canvasOffsetX, canvasOffsetY) {
    const baseSize = uniformScale * gridSize;
    const thicknessFactor = 1 + (lineThickness - 1) * 0.25;
    const rectSize = baseSize * thicknessFactor;
    const thicknessOffset = (rectSize - baseSize) / 2;
    const drawX = canvasOffsetX + x * uniformScale - thicknessOffset;
    const drawY = canvasOffsetY + y * uniformScale - thicknessOffset;
    return {
      drawX,
      drawY,
      rectSize,
      baseSize
    };
  }
  function renderPixels(targetCtx, edges, previewWidth, previewHeight, uniformScale, canvasOffsetX, canvasOffsetY, step) {
    targetCtx.imageSmoothingEnabled = false;
    const isExport = targetCtx.canvas.width === 2880 || targetCtx.canvas.height === 3840;
    const pixelRatio = isExport ? 1 : dpr;
    for (let i = 0; i < edges.length; i += step) {
      const index = edges[i];
      const y = Math.floor(index / previewWidth);
      const x = index % previewWidth;
      const params = calculateShapeParams(x, y, uniformScale, canvasOffsetX, canvasOffsetY);
      if (styleMode === 'square') {
        targetCtx.fillStyle = foregroundColor;
        targetCtx.fillRect(params.drawX, params.drawY, params.rectSize, params.rectSize);
      } else if (styleMode === 'circle') {
        const cx = params.drawX + params.rectSize / 2;
        const cy = params.drawY + params.rectSize / 2;
        const cr = params.rectSize / 2;
        targetCtx.fillStyle = foregroundColor;
        targetCtx.beginPath();
        targetCtx.arc(cx, cy, cr, 0, Math.PI * 2);
        targetCtx.fill();
      } else if (styleMode === 'filled') {
        const cx = params.drawX + params.rectSize / 2;
        const cy = params.drawY + params.rectSize / 2;
        const baseRadius = params.rectSize / 2;

        // ==================== 优化后的 Outline thickness 算法 ====================
        const maxStroke = baseRadius * 1.1;      // 10 时稍微超过半径，保证完全被黑边吞没
        const minStroke = baseRadius * 0.07;     // 1 时非常细的边，几乎全是彩色
        const blackStrokeRaw = minStroke + (maxStroke - minStroke) * (outlineThickness - 1) / 9;
        const blackStroke = blackStrokeRaw * pixelRatio;
        // ======================================================================

        const outerRadius = baseRadius;
        const innerRadius = Math.max(outerRadius - blackStroke, 0);

        // 先画黑色外圈
        targetCtx.fillStyle = '#000';
        targetCtx.beginPath();
        targetCtx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        targetCtx.fill();

        // 内圈还有空间才画彩色
        if (innerRadius > 0.4) {
          targetCtx.fillStyle = foregroundColor;
          targetCtx.beginPath();
          targetCtx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
          targetCtx.fill();
        }
      }
    }
  }
  function renderPreview() {
    if (!processedImage && !demoImage) return;
    fillCanvasBackground(backgroundColor);
    const image = processedImage || demoImage;
    const preview = image.preview;
    const previewWidth = image.previewWidth;
    const previewHeight = image.previewHeight;
    if (cachedEdges === null) {
      cachedEdges = detectEdges(preview, edgeThreshold, detailLevel);
    }
    const uniformScale = Math.min(displayWidth / previewWidth, displayHeight / previewHeight);
    const canvasOffsetX = (displayWidth - previewWidth * uniformScale) / 2 + offsetX;
    const canvasOffsetY = (displayHeight - previewHeight * uniformScale) / 2 + offsetY;
    const step = Math.max(1, gridSize);
    renderPixels(ctx, cachedEdges, previewWidth, previewHeight, uniformScale, canvasOffsetX, canvasOffsetY, step);
    updateCursor();
  }
  let redrawRequest = null;
  function scheduleRedraw() {
    if (!hasImage) return;
    if (redrawRequest === null) {
      redrawRequest = requestAnimationFrame(() => {
        renderPreview();
        redrawRequest = null;
      });
    }
  }
  function setBackgroundColor(color) {
    backgroundColor = color.toUpperCase();
    updateBackgroundVisuals();
    clearCanvas();
    if (hasImage) {
      scheduleRedraw();
    }
  }
  function setForegroundColor(color) {
    foregroundColor = color.toUpperCase();
    if (hasImage) {
      scheduleRedraw();
    }
  }
  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setError(null);
      resetState();
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      resetState();
      return;
    }
    setError(null);
    gridSizeSlider.value = 10;
    edgeSlider.value = 30;
    detailSlider.value = 1;
    lineSlider.value = 1;
    outlineSlider.value = 5;
    gridSizeVal.textContent = '10';
    edgeThresholdVal.textContent = '30';
    detailLevelVal.textContent = '1';
    lineThicknessVal.textContent = '1';
    outlineThicknessVal.textContent = '5';
    gridSize = 10;
    edgeThreshold = 30;
    detailLevel = 1;
    lineThickness = 1;
    outlineThickness = 5;
    setBackgroundColor(DEFAULT_BACKGROUND_COLOR);
    customBgColorPicker.value = DEFAULT_BACKGROUND_COLOR;
    setForegroundColor(DEFAULT_FOREGROUND_COLOR);
    customFgColorPicker.value = DEFAULT_FOREGROUND_COLOR;
    styleButtons.forEach(b => b.classList.remove('active'));
    document.querySelector('.style-button[data-style="square"]').classList.add('active');
    styleMode = 'square';
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        setError('Unable to read the file, please try another image');
        resetState();
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          processedImage = prepareImage(img);
          demoImage = null;
          hasImage = true;
          uploadPreview.src = result;
          uploadPreview.classList.remove('hidden');
          uploadIcon.classList.add('hidden');
          offsetX = 0;
          offsetY = 0;
          cachedEdges = null;
          scheduleRedraw();
          updateEmptyState();
          fileInput.value = '';
        } catch (err) {
          console.error(err);
          setError('Unable to process the image, please try another file');
          resetState();
        }
      };
      img.onerror = () => {
        setError('Unable to read the file, please try another image');
        resetState();
      };
      img.src = result;
    };
    reader.onerror = () => {
      setError('Unable to read the file, please try another image');
      resetState();
    };
    reader.readAsDataURL(file);
  }
  function generateFilledDemo() {
    const size = 360;
    const demoCanvas = document.createElement('canvas');
    demoCanvas.width = size;
    demoCanvas.height = size;
    const dctx = demoCanvas.getContext('2d');
    dctx.fillStyle = '#ffffff';
    dctx.fillRect(0, 0, size, size);
    dctx.fillStyle = '#000000';
    dctx.fillRect(60, 60, 240, 240);
    dctx.globalCompositeOperation = 'destination-out';
    dctx.beginPath();
    dctx.arc(120, 120, 50, 0, Math.PI * 2);
    dctx.arc(240, 120, 50, 0, Math.PI * 2);
    dctx.arc(180, 240, 50, 0, Math.PI * 2);
    dctx.fill();
    dctx.globalCompositeOperation = 'source-over';
    demoImage = {
      original: dctx.getImageData(0, 0, size, size),
      preview: dctx.getImageData(0, 0, size, size),
      originalWidth: size,
      originalHeight: size,
      previewWidth: size,
      previewHeight: size,
      scale: 1
    };
    processedImage = null;
    hasImage = true;
    cachedEdges = null;
    emptyState.classList.add('hidden');
    if (typingTimeout) clearTimeout(typingTimeout);
    foregroundColor = DEMO_COLOR;
    customFgColorPicker.value = DEMO_COLOR;
    fgSwatches.forEach(s => s.classList.remove('active'));
    scheduleRedraw();
  }
  function handleExportPNG() {
    if (!hasImage || isExportingPNG) return;
    isExportingPNG = true;
    const image = processedImage || demoImage;
    const previewWidth = image.previewWidth;
    const previewHeight = image.previewHeight;
    if (cachedEdges === null) {
      cachedEdges = detectEdges(image.preview, edgeThreshold, detailLevel);
    }
    const exportWidth = 2880;
    const exportHeight = 3840;
    const exportScale = Math.min(exportWidth / previewWidth, exportHeight / previewHeight);
    const baseX = (exportWidth - previewWidth * exportScale) / 2;
    const baseY = (exportHeight - previewHeight * exportScale) / 2;
    const step = Math.max(1, gridSize);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const exportCtx = exportCanvas.getContext('2d', { alpha: false });
    exportCtx.imageSmoothingEnabled = false;
    exportCtx.fillStyle = backgroundColor;
    exportCtx.fillRect(0, 0, exportWidth, exportHeight);
    renderPixels(exportCtx, cachedEdges, previewWidth, previewHeight, exportScale, baseX, baseY, step);
    exportCanvas.toBlob((blob) => {
      downloadBlob(blob, `pixel-art-3x4-portrait.png`);
      isExportingPNG = false;
    }, 'image/png');
  }
  function handleExportSVG() {
    if (!hasImage || isExportingSVG) return;
    isExportingSVG = true;
    const image = processedImage || demoImage;
    const previewWidth = image.previewWidth;
    const previewHeight = image.previewHeight;
    if (cachedEdges === null) {
      cachedEdges = detectEdges(image.preview, edgeThreshold, detailLevel);
    }
    const exportWidth = 2880;
    const exportHeight = 3840;
    const exportScale = Math.min(exportWidth / previewWidth, exportHeight / previewHeight);
    const baseX = (exportWidth - previewWidth * exportScale) / 2;
    const baseY = (exportHeight - previewHeight * exportScale) / 2;
    const step = Math.max(1, gridSize);
    const shapes = [];
    for (let i = 0; i < cachedEdges.length; i += step) {
      const index = cachedEdges[i];
      const y = Math.floor(index / previewWidth);
      const x = index % previewWidth;
      const params = calculateShapeParams(x, y, exportScale, baseX, baseY);
      if (styleMode === 'square') {
        shapes.push(`<rect x="${params.drawX.toFixed(2)}" y="${params.drawY.toFixed(2)}" width="${params.rectSize.toFixed(2)}" height="${params.rectSize.toFixed(2)}" fill="${foregroundColor}" shape-rendering="crispEdges" />`);
      } else if (styleMode === 'circle') {
        const cx = (params.drawX + params.rectSize / 2).toFixed(2);
        const cy = (params.drawY + params.rectSize / 2).toFixed(2);
        const cr = (params.rectSize / 2).toFixed(2);
        shapes.push(`<circle cx="${cx}" cy="${cy}" r="${cr}" fill="${foregroundColor}" shape-rendering="geometricPrecision" />`);
      } else if (styleMode === 'filled') {
        const cx = (params.drawX + params.rectSize / 2).toFixed(2);
        const cy = (params.drawY + params.rectSize / 2).toFixed(2);
        const baseRadius = params.rectSize / 2;

        // ==================== 优化后的 Outline thickness 算法（SVG 版） ====================
        const maxStroke = baseRadius * 1.1;
        const minStroke = baseRadius * 0.07;
        const blackStroke = minStroke + (maxStroke - minStroke) * (outlineThickness - 1) / 9;
        // =================================================================================

        const outerRadius = baseRadius.toFixed(2);
        const innerRadius = Math.max(baseRadius - blackStroke, 0).toFixed(2);

        shapes.push(`<circle cx="${cx}" cy="${cy}" r="${outerRadius}" fill="#000"/>`);
        if (parseFloat(innerRadius) > 0.4) {
          shapes.push(`<circle cx="${cx}" cy="${cy}" r="${innerRadius}" fill="${foregroundColor}"/>`);
        }
      }
    }
    const svg =
      `<svg width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" xmlns="http://www.w3.org/2000/svg" style="background:${backgroundColor}">` +
      shapes.join('') +
      `</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadBlob(blob, 'pixel-art-3x4-portrait.svg');
    isExportingSVG = false;
  }
  const updateEdges = throttle(() => {
    cachedEdges = null;
    scheduleRedraw();
  }, 20);
  gridSizeSlider.addEventListener('input', (event) => {
    gridSize = Number(event.target.value);
    gridSizeVal.textContent = gridSize.toString();
    scheduleRedraw();
  });
  edgeSlider.addEventListener('input', (event) => {
    edgeThreshold = Number(event.target.value);
    edgeThresholdVal.textContent = edgeThreshold.toString();
    cachedEdges = null;
    scheduleRedraw();
    updateEdges();
  });
  detailSlider.addEventListener('input', (event) => {
    detailLevel = Number(event.target.value);
    detailLevelVal.textContent = detailLevel.toString();
    cachedEdges = null;
    scheduleRedraw();
    updateEdges();
  });
  lineSlider.addEventListener('input', (event) => {
    lineThickness = Number(event.target.value);
    lineThicknessVal.textContent = lineThickness.toString();
    scheduleRedraw();
  });
  outlineSlider.addEventListener('input', (event) => {
    outlineThickness = Number(event.target.value);
    outlineThicknessVal.textContent = outlineThickness.toString();
    scheduleRedraw();
  });
  bgSwatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (color) {
        setBackgroundColor(color);
      }
    });
  });
  customBgColorPicker.addEventListener('input', (event) => {
    setBackgroundColor(event.target.value);
  });
  fgSwatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (color) {
        setForegroundColor(color);
      }
    });
  });
  customFgColorPicker.addEventListener('input', (event) => {
    setForegroundColor(event.target.value);
  });
  fileInput.addEventListener('change', handleFileChange);
  exportPNGButton.addEventListener('click', handleExportPNG);
  exportSVGButton.addEventListener('click', handleExportSVG);
  resetLabel.addEventListener('click', () => {
    gridSizeSlider.value = 10;
    edgeSlider.value = 30;
    detailSlider.value = 1;
    lineSlider.value = 1;
    outlineSlider.value = 5;
    gridSizeVal.textContent = '10';
    edgeThresholdVal.textContent = '30';
    detailLevelVal.textContent = '1';
    lineThicknessVal.textContent = '1';
    outlineThicknessVal.textContent = '5';
    gridSize = 10;
    edgeThreshold = 30;
    detailLevel = 1;
    lineThickness = 1;
    outlineThickness = 5;
    setBackgroundColor(DEFAULT_BACKGROUND_COLOR);
    customBgColorPicker.value = DEFAULT_BACKGROUND_COLOR;
    setForegroundColor(DEFAULT_FOREGROUND_COLOR);
    customFgColorPicker.value = DEFAULT_FOREGROUND_COLOR;
    resetState();
  });
  styleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      styleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      styleMode = btn.dataset.style;
      if (styleMode === 'filled') {
        if (!hasImage) {
          generateFilledDemo();
        } else {
          foregroundColor = DEMO_COLOR;
          customFgColorPicker.value = DEMO_COLOR;
          fgSwatches.forEach(s => s.classList.remove('active'));
        }
      }
      if (hasImage) {
        cachedEdges = null;
        scheduleRedraw();
      }
    });
  });
  function updateCursor() {
    if (hasImage) {
      canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }
  canvas.addEventListener('mousedown', (e) => {
    if (!hasImage || e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX - offsetX;
    dragStartY = e.clientY - offsetY;
    canvas.classList.add('dragging');
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX = e.clientX - dragStartX;
    offsetY = e.clientY - dragStartY;
    scheduleRedraw();
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      canvas.classList.remove('dragging');
      updateCursor();
    }
  });
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setBackgroundColor(DEFAULT_BACKGROUND_COLOR);
  setForegroundColor(DEFAULT_FOREGROUND_COLOR);
  updateEmptyState();
  updateCursor();
})();