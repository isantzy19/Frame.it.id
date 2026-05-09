/* ============================================================
   Frame it! — script.js
   ============================================================ */

// ─── STATE ───────────────────────────────────────────────────
const state = {
  layout:     null,   // 2 | 3
  mode:       null,   // 'camera' | 'gallery'
  photos:     [],     // captured/selected photos (data URLs)
  stream:     null,   // webcam MediaStream
  capturing:  false,
  selectedFrame: null, // frame key currently selected
};

// ─── FRAME DEFINITIONS ───────────────────────────────────────
// 3-photo frames (Frame 25–29 in Figma)
const FRAMES_3 = [
  {
    key: 'white-3',
    label: 'Frame',
    type: 'solid',
    bg: '#ffffff',
    photoBorderRadius: 14,
    padding: 18,
    gap: 10,
  },
  {
    key: 'black-3',
    label: 'Black',
    type: 'solid',
    bg: '#111111',
    photoBorderRadius: 14,
    padding: 18,
    gap: 10,
  }
 
];

// 2-photo frames (Frame 30–33 in Figma)
const FRAMES_2 = [
  {
    key: 'white-2',
    label: 'Frame',
    type: 'solid',
    bg: '#ffffff',
    photoBorderRadius: 14,
    padding: 18,
    gap: 10,
  },
  {
    key: 'black-2',
    label: 'Black',
    type: 'solid',
    bg: '#111111',
    photoBorderRadius: 14,
    padding: 18,
    gap: 10,
  }
];

// ─── HELPERS ─────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
    screen.style.display = 'none';
  });

  const target = document.getElementById(id);

  if (target) {
    target.classList.add('active');
    target.style.display = 'flex';
    target.scrollTop = 0;
  }

  window.scrollTo(0, 0);
}

function resetAll() {
  stopCamera();
  state.layout    = null;
  state.mode      = null;
  state.photos    = [];
  state.capturing = false;
  state.selectedFrame = null;

  // reset layout UI
  document.getElementById('lc2').classList.remove('selected');
  document.getElementById('lc3').classList.remove('selected');
  document.getElementById('layoutLabel').textContent = '';
  document.getElementById('layoutNext').disabled = true;

  // reset mode UI
  document.getElementById('modeCamera').classList.remove('selected');
  document.getElementById('modeGallery').classList.remove('selected');
  document.getElementById('modeNext').disabled = true;
}

// ─── LANDING ─────────────────────────────────────────────────
function goToLayout() {
  showScreen('screen-layout');
}

// ─── LAYOUT ──────────────────────────────────────────────────
function selectLayout(n) {
  state.layout = n;
  document.getElementById('lc2').classList.toggle('selected', n === 2);
  document.getElementById('lc3').classList.toggle('selected', n === 3);
  document.getElementById('layoutLabel').textContent = `Selected : ${n} Frame`;
  document.getElementById('layoutNext').disabled = false;
}

function goToMode() {
  if (!state.layout) return;
  showScreen('screen-mode');
}

// ─── MODE ─────────────────────────────────────────────────────
function selectMode(m) {
  state.mode = m;
  document.getElementById('modeCamera').classList.toggle('selected', m === 'camera');
  document.getElementById('modeGallery').classList.toggle('selected', m === 'gallery');
  document.getElementById('modeNext').disabled = false;
}

function goToSnap() {
  if (!state.mode) return;
  state.photos = [];
  if (state.mode === 'camera') {
    buildCameraThumbs();
    showScreen('screen-camera');
    initCamera();
  } else {
    buildGalleryThumbs();
    document.getElementById('galleryCount').textContent = state.layout;
    showScreen('screen-gallery');
  }
}

// ─── CAMERA ──────────────────────────────────────────────────
async function initCamera() {
  const video = document.getElementById('webcam');
  const err   = document.getElementById('camError');
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject   = state.stream;
    video.style.display = 'block';
    err.style.display   = 'none';
  } catch (e) {
    video.style.display = 'none';
    err.style.display   = 'flex';
  }
  updateCamBtn();
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
}

function buildCameraThumbs() {
  const row  = document.getElementById('camThumbs');
  const size = state.layout === 3 ? 80 : 100;
  row.innerHTML = '';
  for (let i = 0; i < state.layout; i++) {
    const slot        = document.createElement('div');
    slot.className    = 'thumb-slot';
    slot.id           = `camThumb${i}`;
    slot.style.width  = size + 'px';
    slot.style.height = size + 'px';
    row.appendChild(slot);
  }
}

function updateCamBtn() {
  const done = state.photos.length >= state.layout;
  const btn  = document.getElementById('camStartBtn');
  btn.textContent = done ? 'DONE ✓' : 'START';
  document.getElementById('camNext').disabled = !done;
}

async function startCapture() {
  if (state.capturing) return;
  if (state.photos.length >= state.layout) { goToCustomize(); return; }
  state.capturing = true;
  document.getElementById('camStartBtn').disabled = true;

  // Countdown 3 2 1
  const overlay = document.getElementById('countdownOverlay');
  overlay.classList.add('show');
  await new Promise(resolve => {
    let t = 3;
    overlay.textContent = t;
    const iv = setInterval(() => {
      t--;
      if (t <= 0) { clearInterval(iv); overlay.classList.remove('show'); resolve(); }
      else overlay.textContent = t;
    }, 1000);
  });

  // Snap
  const video  = document.getElementById('webcam');
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.save(); ctx.scale(-1, 1);
  ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();

  // Flash
  const fl = document.getElementById('flashOverlay');
  fl.classList.add('flash');
  setTimeout(() => fl.classList.remove('flash'), 120);

  const url = canvas.toDataURL('image/jpeg', 0.95);
  const idx = state.photos.length;
  state.photos.push(url);

  // Fill thumb
  const slot = document.getElementById(`camThumb${idx}`);
  if (slot) {
    const img = document.createElement('img'); img.src = url;
    slot.innerHTML = ''; slot.appendChild(img);
  }

  state.capturing = false;
  document.getElementById('camStartBtn').disabled = false;
  updateCamBtn();
}

// ─── GALLERY ─────────────────────────────────────────────────
function buildGalleryThumbs() {
  const row  = document.getElementById('galleryThumbs');
  const size = state.layout === 3 ? 80 : 100;
  row.innerHTML = '';
  state.photos = [];
  for (let i = 0; i < state.layout; i++) {
    const slot        = document.createElement('div');
    slot.className    = 'thumb-slot';
    slot.id           = `galThumb${i}`;
    slot.style.width  = size + 'px';
    slot.style.height = size + 'px';
    row.appendChild(slot);
  }
  document.getElementById('galleryNext').disabled = true;
  document.getElementById('galleryPlaceholder').style.display = 'flex';
  document.getElementById('galleryPreview').style.display     = 'none';
}

function triggerInput() {
  const inp = document.getElementById('galleryFileInput');
  inp.value = '';
  inp.click();
}

function onGalleryChange(e) {
  const files = Array.from(e.target.files);

  files.forEach(file => {
    if (state.photos.length >= state.layout) return;

    const currentIndex = state.photos.length;

    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target.result;

      state.photos.push(url);

      // preview utama
      document.getElementById('galleryPlaceholder').style.display = 'none';

      const prev = document.getElementById('galleryPreview');
      prev.src = url;
      prev.style.display = 'block';

      // thumbnail
      const slot = document.getElementById(`galThumb${currentIndex}`);
      if (slot) {
        const img = document.createElement('img');
        img.src = url;
        slot.innerHTML = '';
        slot.appendChild(img);
      }

      // aktifkan next jika penuh
      document.getElementById('galleryNext').disabled =
        state.photos.length < state.layout;
    };

    reader.readAsDataURL(file);
  });

  // reset supaya bisa input lagi
  e.target.value = '';
}

// ─── CUSTOMIZE ───────────────────────────────────────────────
function goToCustomize() {
  stopCamera();
  buildCustomizePreview();
  showScreen('screen-customize');
}

function buildCustomizePreview() {
  const container = document.getElementById('customizePhotos');
  container.innerHTML = '';
  state.photos.forEach(url => {
    const div = document.createElement('div');
    div.className = 'customize-photo';
    if (url) {
      const img = document.createElement('img'); img.src = url;
      div.appendChild(img);
    }
    container.appendChild(div);
  });
}

function doRetake() {
  state.photos = [];
  if (state.mode === 'camera') {
    buildCameraThumbs();
    showScreen('screen-camera');
    initCamera();
  } else {
    buildGalleryThumbs();
    showScreen('screen-gallery');
  }
}

function goBackFromCustomize() {
  if (state.mode === 'camera') {
    showScreen('screen-camera');
    initCamera();
  } else {
    showScreen('screen-gallery');
  }
}

// ─── STYLE / DOWNLOAD ────────────────────────────────────────
function goToStyle() {
  state.selectedFrame = null;
  buildFrameDropdown();
  showScreen('screen-style');
  const frames = state.layout === 3 ? FRAMES_3 : FRAMES_2;
  selectFrameByKey(frames[0].key);  // default first frame
}

function buildFrameDropdown() {
  const list   = document.getElementById('frameDropList');
  const frames = state.layout === 3 ? FRAMES_3 : FRAMES_2;
  list.innerHTML = '';
  frames.forEach(f => {
    const div = document.createElement('div');
    div.className = 'frame-option';
    div.textContent = f.label;
    div.dataset.key = f.key;
    div.onclick = () => {
      selectFrameByKey(f.key);
      closeFrameDropdown();
    };
    list.appendChild(div);
  });
}

function toggleFrameDropdown() {
  document.getElementById('frameDropList').classList.toggle('open');
}
function closeFrameDropdown() {
  document.getElementById('frameDropList').classList.remove('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.frame-dropdown-wrap')) closeFrameDropdown();
});

function selectFrameByKey(key) {
  state.selectedFrame = key;
  const frames = state.layout === 3 ? FRAMES_3 : FRAMES_2;
  const frame  = frames.find(f => f.key === key);
  if (!frame) return;

  // Update dropdown label
  document.getElementById('frameDropBtn').innerHTML = frame.label + ' &nbsp;∨';

  // Highlight active option
  document.querySelectorAll('.frame-option').forEach(o => {
    o.classList.toggle('active', o.dataset.key === key);
  });

  // Render preview canvas
  renderStyleCanvas(frame);
}

// ─── CANVAS RENDERER ─────────────────────────────────────────
const PHOTO_W = 420;
const PHOTO_H = 320;

async function renderStyleCanvas(frame) {
  const canvas = document.getElementById('styleCanvas');

  if (frame.type === 'solid') {
    await renderSolidFrame(canvas, frame);
  } else {
    await renderImageFrame(canvas, frame);
  }
}

async function renderSolidFrame(canvas, frame) {
  const n       = state.layout;
  const PAD     = frame.padding || 18;
  const GAP     = frame.gap     || 10;
  const cw      = PHOTO_W + PAD * 2;
  const ch      = PHOTO_H * n + GAP * (n - 1) + PAD * 2 + 40;

  canvas.width  = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = frame.bg;
  ctx.fillRect(0, 0, cw, ch);

  // Load photos
  const imgs = await loadImages(state.photos);

  // Draw each photo
  for (let i = 0; i < n; i++) {
    const x = PAD;
    const y = PAD + i * (PHOTO_H + GAP);
    drawRoundRect(ctx, x, y, PHOTO_W, PHOTO_H, frame.photoBorderRadius || 12);
    ctx.save(); ctx.clip();
    if (imgs[i]) {
      const iw = imgs[i].naturalWidth;
      const ih = imgs[i].naturalHeight;

      const scale = Math.max(PHOTO_W / iw, PHOTO_H / ih);
      const dw = iw * scale;
      const dh = ih * scale;

      const dx = x + (PHOTO_W - dw) / 2;
      const dy = y + (PHOTO_H - dh) / 2;

      ctx.drawImage(imgs[i], dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, PHOTO_W, PHOTO_H);
    }
    ctx.restore();
  }

  // Label
  const isDark = frame.bg === '#111111';
  ctx.fillStyle   = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.25)';
  ctx.font        = 'bold 14px Nunito, sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText('Frame it!', cw / 2, ch - 12);
}

async function renderImageFrame(canvas, frame) {
  // Load frame image
  const frameImg = await loadSingleImage(frame.src);
  if (!frameImg) { console.warn('Frame image not found:', frame.src); return; }

  const fw = frameImg.naturalWidth;
  const fh = frameImg.naturalHeight;

  // Fit canvas to a reasonable height
  const maxH = 700;
  const scale = fh > maxH ? maxH / fh : 1;
  canvas.width  = Math.round(fw * scale);
  canvas.height = Math.round(fh * scale);

  const ctx = canvas.getContext('2d');
  const n   = state.layout;

  // Compute photo areas based on frame layout
  const photoAreas = computePhotoAreas(frame.key, canvas.width, canvas.height, n);

  const imgs = await loadImages(state.photos);

  // gambar foto terlebih dahulu
  for (let i = 0; i < n && i < photoAreas.length; i++) {
    const { x, y, w, h } = photoAreas[i];
    const r = frame.photoBorderRadius || 10;
    ctx.save();
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.clip();
    if (imgs[i]) {
      // cover-fit
      const iw = imgs[i].naturalWidth, ih = imgs[i].naturalHeight;
      const scale2 = Math.max(w / iw, h / ih);
      const dw = iw * scale2, dh = ih * scale2;
      const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      ctx.drawImage(imgs[i], dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  // gambar frame PNG di paling atas agar dekorasi tidak rusak
  ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
}

/**
 * Compute approximate photo areas for each decorative frame.
 * These are manually calibrated based on the Figma designs.
 */
function computePhotoAreas(key, cw, ch, n) {
  const areas = [];

  if (key === 'vintage-mail-3') {
    // 3 stacked vertical photos inside vintage-mail frame
    const pw = cw * 0.70, ph = ch * 0.19;
    const ox = cw * 0.15;
    const gaps = [ch * 0.07, ch * 0.39, ch * 0.71];
    for (let i = 0; i < 3; i++) areas.push({ x: ox, y: gaps[i], w: pw, h: ph });

  } else if (key === 'blue-wish-3') {
    // 3 stacked photos in blue gingham frame
    const pw = cw * 0.69, ph = ch * 0.18;
    const ox = cw * 0.15;
    const ys = [ch * 0.07, ch * 0.39, ch * 0.71];
    for (let i = 0; i < 3; i++) areas.push({ x: ox, y: ys[i], w: pw, h: ph });

  } else if (key === 'nct-wish-3') {
    // 3 circular/rounded photos inside NCT Wish frame
    const pw = cw * 0.50, ph = cw * 0.50;
    const ox = (cw - pw) / 2;
    const ys = [ch * 0.05, ch * 0.355, ch * 0.655];
    for (let i = 0; i < 3; i++) areas.push({ x: ox, y: ys[i], w: pw, h: ph });

  } else if (key === 'vintage-2') {
    // 2 photos stacked in vintage-book frame
    const pw = cw * 0.56, ph = ch * 0.20;
    const ox = cw * 0.26;
    const ys = [ch * 0.17, ch * 0.57];
    for (let i = 0; i < 2; i++) areas.push({ x: ox, y: ys[i], w: pw, h: ph });

  } else if (key === 'collage-2') {
    // 2 photos stacked in collage frame
    const pw = cw * 0.48, ph = ch * 0.18;
    const ox = cw * 0.26;
    const ys = [ch * 0.22, ch * 0.57];
    for (let i = 0; i < 2; i++) areas.push({ x: ox, y: ys[i], w: pw, h: ph });
  }

  return areas;
}

// ─── DOWNLOAD ────────────────────────────────────────────────
async function downloadPhoto() {
  const styleCanvas = document.getElementById('styleCanvas');
  const finalCanvas = document.getElementById('finalCanvas');
  finalCanvas.width  = styleCanvas.width;
  finalCanvas.height = styleCanvas.height;
  const ctx = finalCanvas.getContext('2d');
  ctx.drawImage(styleCanvas, 0, 0);

  const link      = document.createElement('a');
  link.download   = `frameit-${Date.now()}.png`;
  link.href       = finalCanvas.toDataURL('image/png');
  link.click();
}

// ─── CANVAS HELPERS ──────────────────────────────────────────
function drawRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}

function loadImages(urls) {
  return Promise.all(urls.map(src => src ? loadSingleImage(src) : Promise.resolve(null)));
}

function loadSingleImage(src) {
  return new Promise(resolve => {
    const img   = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src     = src;
  });
}
