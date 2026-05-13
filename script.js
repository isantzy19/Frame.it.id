/* ============================================================
   Frame it! — script.js  (OOP Refactor)
   ============================================================
   Arsitektur OOP:
   - FrameDefinition      : Model data untuk frame/gaya foto
   - AppState             : Singleton — menyimpan seluruh state aplikasi
   - ScreenManager        : Mengelola perpindahan antar screen
   - CanvasRenderer       : Menangani semua operasi render ke <canvas>
   - CameraController     : Mengelola webcam & proses capture foto
   - GalleryController    : Mengelola input foto dari galeri
   - FrameDropdown        : Mengelola UI dropdown pemilihan frame
   - App                  : Kelas utama (entry point) yang mengkoordinasikan semua kelas
   ============================================================ */


/* ─────────────────────────────────────────────────────────────
   1. FrameDefinition — Model / Data Class
   ───────────────────────────────────────────────────────────── */
class FrameDefinition {
  /**
   * @param {string} key    - Identifier unik
   * @param {string} label  - Label tampilan di UI
   * @param {string} type   - 'solid' | 'image'
   * @param {string} bg     - Warna background (solid) atau src gambar (image)
   * @param {number} photoBorderRadius
   * @param {number} padding
   * @param {number} gap
   * @param {string|null} src - Path ke file gambar frame (jika type === 'image')
   */
  constructor({ key, label, type, bg, photoBorderRadius = 12, padding = 18, gap = 10, src = null }) {
    this.key               = key;
    this.label             = label;
    this.type              = type;
    this.bg                = bg;
    this.photoBorderRadius = photoBorderRadius;
    this.padding           = padding;
    this.gap               = gap;
    this.src               = src;
  }
}


/* ─────────────────────────────────────────────────────────────
   2. AppState — Singleton untuk menyimpan state global
   ───────────────────────────────────────────────────────────── */
class AppState {
  constructor() {
    if (AppState._instance) return AppState._instance;
    AppState._instance = this;

    this.layout        = null;   // 2 | 3
    this.mode          = null;   // 'camera' | 'gallery'
    this.photos        = [];     // data URLs foto
    this.stream        = null;   // MediaStream webcam
    this.capturing     = false;
    this.selectedFrame = null;   // key frame yang dipilih

    // Definisi frame (3-foto)
    this.frames3 = [
      new FrameDefinition({ key: 'white-3', label: 'Frame', type: 'solid', bg: '#ffffff', photoBorderRadius: 14, padding: 18, gap: 10 }),
      new FrameDefinition({ key: 'black-3', label: 'Black',  type: 'solid', bg: '#111111', photoBorderRadius: 14, padding: 18, gap: 10 }),
    ];

    // Definisi frame (2-foto)
    this.frames2 = [
      new FrameDefinition({ key: 'white-2', label: 'Frame', type: 'solid', bg: '#ffffff', photoBorderRadius: 14, padding: 18, gap: 10 }),
      new FrameDefinition({ key: 'black-2', label: 'Black',  type: 'solid', bg: '#111111', photoBorderRadius: 14, padding: 18, gap: 10 }),
    ];
  }

  /** Kembalikan daftar frame sesuai layout aktif */
  get currentFrames() {
    return this.layout === 3 ? this.frames3 : this.frames2;
  }

  /** Cari FrameDefinition berdasarkan key */
  findFrame(key) {
    return this.currentFrames.find(f => f.key === key) || null;
  }

  /** Reset state ke kondisi awal */
  reset() {
    this.layout        = null;
    this.mode          = null;
    this.photos        = [];
    this.capturing     = false;
    this.selectedFrame = null;
  }
}


/* ─────────────────────────────────────────────────────────────
   3. ScreenManager — Mengelola perpindahan layar
   ───────────────────────────────────────────────────────────── */
class ScreenManager {
  constructor() {
    this.screens = document.querySelectorAll('.screen');
  }

  /** Tampilkan screen dengan id tertentu, sembunyikan yang lain */
  show(id) {
    this.screens.forEach(screen => {
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
}


/* ─────────────────────────────────────────────────────────────
   4. CanvasRenderer — Semua logika rendering canvas
   ───────────────────────────────────────────────────────────── */
class CanvasRenderer {
  static PHOTO_W = 420;
  static PHOTO_H = 320;

  /**
   * Render frame ke canvas sesuai tipe (solid / image)
   * @param {HTMLCanvasElement} canvas
   * @param {FrameDefinition} frame
   * @param {string[]} photos  - Array data URL foto
   * @param {number} layout    - Jumlah foto (2 | 3)
   */
  async render(canvas, frame, photos, layout) {
    if (frame.type === 'solid') {
      await this._renderSolid(canvas, frame, photos, layout);
    } else {
      await this._renderImage(canvas, frame, photos, layout);
    }
  }

  /** Render frame dengan background warna solid */
  async _renderSolid(canvas, frame, photos, n) {
    const PAD = frame.padding;
    const GAP = frame.gap;
    const cw  = CanvasRenderer.PHOTO_W + PAD * 2;
    const ch  = CanvasRenderer.PHOTO_H * n + GAP * (n - 1) + PAD * 2 + 40;

    canvas.width  = cw;
    canvas.height = ch;

    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = frame.bg;
    ctx.fillRect(0, 0, cw, ch);

    const imgs = await this._loadImages(photos);

    for (let i = 0; i < n; i++) {
      const x = PAD;
      const y = PAD + i * (CanvasRenderer.PHOTO_H + GAP);
      this._drawRoundRect(ctx, x, y, CanvasRenderer.PHOTO_W, CanvasRenderer.PHOTO_H, frame.photoBorderRadius);
      ctx.save();
      ctx.clip();
      if (imgs[i]) {
        this._drawCoverFit(ctx, imgs[i], x, y, CanvasRenderer.PHOTO_W, CanvasRenderer.PHOTO_H);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, CanvasRenderer.PHOTO_W, CanvasRenderer.PHOTO_H);
      }
      ctx.restore();
    }

    // Label watermark
    const isDark = frame.bg === '#111111';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.25)';
    ctx.font      = 'bold 14px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frame it!', cw / 2, ch - 12);
  }

  /** Render frame menggunakan gambar PNG dekoratif */
  async _renderImage(canvas, frame, photos, n) {
    const frameImg = await this._loadSingleImage(frame.src);
    if (!frameImg) { console.warn('Frame image not found:', frame.src); return; }

    const fw = frameImg.naturalWidth;
    const fh = frameImg.naturalHeight;
    const maxH  = 700;
    const scale = fh > maxH ? maxH / fh : 1;

    canvas.width  = Math.round(fw * scale);
    canvas.height = Math.round(fh * scale);

    const ctx       = canvas.getContext('2d');
    const photoAreas = this._computePhotoAreas(frame.key, canvas.width, canvas.height, n);
    const imgs       = await this._loadImages(photos);

    for (let i = 0; i < n && i < photoAreas.length; i++) {
      const { x, y, w, h } = photoAreas[i];
      ctx.save();
      this._drawRoundRect(ctx, x, y, w, h, frame.photoBorderRadius);
      ctx.clip();
      if (imgs[i]) {
        this._drawCoverFit(ctx, imgs[i], x, y, w, h);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, w, h);
      }
      ctx.restore();
    }

    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
  }

  /** Gambar image dengan mode cover-fit ke dalam area tertentu */
  _drawCoverFit(ctx, img, x, y, w, h) {
    const iw    = img.naturalWidth;
    const ih    = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const dw    = iw * scale;
    const dh    = ih * scale;
    const dx    = x + (w - dw) / 2;
    const dy    = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /** Gambar path rounded rectangle (digunakan sebelum clip) */
  _drawRoundRect(ctx, x, y, w, h, r) {
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

  /** Hitung area foto untuk setiap frame dekoratif */
  _computePhotoAreas(key, cw, ch, n) {
    const areas = [];
    if (key === 'vintage-mail-3') {
      const pw = cw * 0.70, ph = ch * 0.19, ox = cw * 0.15;
      [ch * 0.07, ch * 0.39, ch * 0.71].forEach(y => areas.push({ x: ox, y, w: pw, h: ph }));
    } else if (key === 'blue-wish-3') {
      const pw = cw * 0.69, ph = ch * 0.18, ox = cw * 0.15;
      [ch * 0.07, ch * 0.39, ch * 0.71].forEach(y => areas.push({ x: ox, y, w: pw, h: ph }));
    } else if (key === 'nct-wish-3') {
      const pw = cw * 0.50, ph = cw * 0.50, ox = (cw - pw) / 2;
      [ch * 0.05, ch * 0.355, ch * 0.655].forEach(y => areas.push({ x: ox, y, w: pw, h: ph }));
    } else if (key === 'vintage-2') {
      const pw = cw * 0.56, ph = ch * 0.20, ox = cw * 0.26;
      [ch * 0.17, ch * 0.57].forEach(y => areas.push({ x: ox, y, w: pw, h: ph }));
    } else if (key === 'collage-2') {
      const pw = cw * 0.48, ph = ch * 0.18, ox = cw * 0.26;
      [ch * 0.22, ch * 0.57].forEach(y => areas.push({ x: ox, y, w: pw, h: ph }));
    }
    return areas;
  }

  /** Load banyak gambar secara paralel */
  _loadImages(urls) {
    return Promise.all(urls.map(src => src ? this._loadSingleImage(src) : Promise.resolve(null)));
  }

  /** Load satu gambar, resolve null jika gagal */
  _loadSingleImage(src) {
    return new Promise(resolve => {
      const img   = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src     = src;
    });
  }

  /** Download canvas sebagai file PNG */
  async downloadFromCanvas(sourceCanvas) {
    const finalCanvas   = document.getElementById('finalCanvas');
    finalCanvas.width   = sourceCanvas.width;
    finalCanvas.height  = sourceCanvas.height;
    finalCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);

    const link      = document.createElement('a');
    link.download   = `frameit-${Date.now()}.png`;
    link.href       = finalCanvas.toDataURL('image/png');
    link.click();
  }
}


/* ─────────────────────────────────────────────────────────────
   5. CameraController — Mengelola webcam dan capture foto
   ───────────────────────────────────────────────────────────── */
class CameraController {
  /**
   * @param {AppState} state
   */
  constructor(state) {
    this.state = state;
  }

  /** Inisialisasi & mulai stream webcam */
  async init() {
    const video = document.getElementById('webcam');
    const err   = document.getElementById('camError');
    try {
      this.state.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      video.srcObject     = this.state.stream;
      video.style.display = 'block';
      err.style.display   = 'none';
    } catch (e) {
      video.style.display = 'none';
      err.style.display   = 'flex';
    }
    this._updateButton();
  }

  /** Hentikan stream webcam */
  stop() {
    if (this.state.stream) {
      this.state.stream.getTracks().forEach(t => t.stop());
      this.state.stream = null;
    }
  }

  /** Buat slot thumbnail di camera screen */
  buildThumbs() {
    const row  = document.getElementById('camThumbs');
    const size = this.state.layout === 3 ? 80 : 100;
    row.innerHTML = '';
    for (let i = 0; i < this.state.layout; i++) {
      const slot        = document.createElement('div');
      slot.className    = 'thumb-slot';
      slot.id           = `camThumb${i}`;
      slot.style.width  = size + 'px';
      slot.style.height = size + 'px';
      row.appendChild(slot);
    }
  }

  /** Proses capture foto dengan hitung mundur & flash */
  async capture(onDone) {
    if (this.state.capturing) return;
    if (this.state.photos.length >= this.state.layout) { onDone(); return; }

    this.state.capturing = true;
    document.getElementById('camStartBtn').disabled = true;

    await this._countdown();

    const url = this._snapPhoto();
    const idx = this.state.photos.length;
    this.state.photos.push(url);
    this._fillThumb(idx, url);
    this._triggerFlash();

    this.state.capturing = false;
    document.getElementById('camStartBtn').disabled = false;
    this._updateButton();
  }

  /** Tampilkan overlay hitung mundur 3-2-1 */
  _countdown() {
    return new Promise(resolve => {
      const overlay = document.getElementById('countdownOverlay');
      overlay.classList.add('show');
      let t = 3;
      overlay.textContent = t;
      const iv = setInterval(() => {
        t--;
        if (t <= 0) {
          clearInterval(iv);
          overlay.classList.remove('show');
          resolve();
        } else {
          overlay.textContent = t;
        }
      }, 1000);
    });
  }

  /** Ambil frame dari video dan kembalikan sebagai data URL */
  _snapPhoto() {
    const video   = document.getElementById('webcam');
    const canvas  = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx     = canvas.getContext('2d');
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  /** Efek flash layar setelah foto diambil */
  _triggerFlash() {
    const fl = document.getElementById('flashOverlay');
    fl.classList.add('flash');
    setTimeout(() => fl.classList.remove('flash'), 120);
  }

  /** Isi slot thumbnail dengan foto yang baru diambil */
  _fillThumb(idx, url) {
    const slot = document.getElementById(`camThumb${idx}`);
    if (slot) {
      const img = document.createElement('img');
      img.src   = url;
      slot.innerHTML = '';
      slot.appendChild(img);
    }
  }

  /** Update teks & status tombol START */
  _updateButton() {
    const done = this.state.photos.length >= this.state.layout;
    const btn  = document.getElementById('camStartBtn');
    btn.textContent = done ? 'DONE ✓' : 'START';
    document.getElementById('camNext').disabled = !done;
  }
}


/* ─────────────────────────────────────────────────────────────
   6. GalleryController — Mengelola input foto dari galeri
   ───────────────────────────────────────────────────────────── */
class GalleryController {
  /**
   * @param {AppState} state
   */
  constructor(state) {
    this.state = state;
  }

  /** Buat slot thumbnail & reset tampilan gallery screen */
  buildThumbs() {
    const row  = document.getElementById('galleryThumbs');
    const size = this.state.layout === 3 ? 80 : 100;
    row.innerHTML  = '';
    this.state.photos = [];

    for (let i = 0; i < this.state.layout; i++) {
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

  /** Buka file picker */
  triggerInput() {
    const inp = document.getElementById('galleryFileInput');
    inp.value = '';
    inp.click();
  }

  /** Proses file yang dipilih user */
  handleChange(e) {
    const files = Array.from(e.target.files);

    files.forEach(file => {
      if (this.state.photos.length >= this.state.layout) return;

      const currentIndex = this.state.photos.length;
      const reader       = new FileReader();

      reader.onload = ev => {
        const url = ev.target.result;
        this.state.photos.push(url);

        document.getElementById('galleryPlaceholder').style.display = 'none';
        const prev  = document.getElementById('galleryPreview');
        prev.src    = url;
        prev.style.display = 'block';

        const slot = document.getElementById(`galThumb${currentIndex}`);
        if (slot) {
          const img = document.createElement('img');
          img.src   = url;
          slot.innerHTML = '';
          slot.appendChild(img);
        }

        document.getElementById('galleryNext').disabled =
          this.state.photos.length < this.state.layout;
      };

      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }
}


/* ─────────────────────────────────────────────────────────────
   7. FrameDropdown — Mengelola UI dropdown pemilihan frame
   ───────────────────────────────────────────────────────────── */
class FrameDropdown {
  /**
   * @param {AppState}      state
   * @param {CanvasRenderer} renderer
   */
  constructor(state, renderer) {
    this.state    = state;
    this.renderer = renderer;

    // Tutup dropdown jika klik di luar
    document.addEventListener('click', e => {
      if (!e.target.closest('.frame-dropdown-wrap')) this.close();
    });
  }

  /** Bangun daftar opsi dropdown dari frame yang tersedia */
  build() {
    const list   = document.getElementById('frameDropList');
    list.innerHTML = '';
    this.state.currentFrames.forEach(f => {
      const div         = document.createElement('div');
      div.className     = 'frame-option';
      div.textContent   = f.label;
      div.dataset.key   = f.key;
      div.onclick       = () => { this.selectByKey(f.key); this.close(); };
      list.appendChild(div);
    });
  }

  toggle() {
    document.getElementById('frameDropList').classList.toggle('open');
  }

  close() {
    document.getElementById('frameDropList').classList.remove('open');
  }

  /** Pilih frame berdasarkan key, update UI & render canvas */
  selectByKey(key) {
    this.state.selectedFrame = key;
    const frame = this.state.findFrame(key);
    if (!frame) return;

    document.getElementById('frameDropBtn').innerHTML = frame.label + ' &nbsp;∨';
    document.querySelectorAll('.frame-option').forEach(o => {
      o.classList.toggle('active', o.dataset.key === key);
    });

    const canvas = document.getElementById('styleCanvas');
    this.renderer.render(canvas, frame, this.state.photos, this.state.layout);
  }
}


/* ─────────────────────────────────────────────────────────────
   8. App — Kelas utama yang mengkoordinasikan semua komponen
   ───────────────────────────────────────────────────────────── */
class App {
  constructor() {
    // Inisialisasi semua komponen
    this.state    = new AppState();
    this.screens  = new ScreenManager();
    this.renderer = new CanvasRenderer();
    this.camera   = new CameraController(this.state);
    this.gallery  = new GalleryController(this.state);
    this.dropdown = new FrameDropdown(this.state, this.renderer);

    this._bindGlobalHandlers();
  }

  /** Daftarkan event handler global (inline HTML tidak bisa akses method instance langsung) */
  _bindGlobalHandlers() {
    // Semua fungsi ini dipanggil dari inline onclick di HTML
    window.goToLayout     = ()  => this.goToLayout();
    window.selectLayout   = (n) => this.selectLayout(n);
    window.goToMode       = ()  => this.goToMode();
    window.selectMode     = (m) => this.selectMode(m);
    window.goToSnap       = ()  => this.goToSnap();
    window.startCapture   = ()  => this.startCapture();
    window.triggerInput   = ()  => this.gallery.triggerInput();
    window.onGalleryChange = (e) => this.gallery.handleChange(e);
    window.goToCustomize  = ()  => this.goToCustomize();
    window.doRetake       = ()  => this.doRetake();
    window.goBackFromCustomize = () => this.goBackFromCustomize();
    window.goToStyle      = ()  => this.goToStyle();
    window.toggleFrameDropdown = () => this.dropdown.toggle();
    window.downloadPhoto  = ()  => this.downloadPhoto();
    window.showScreen     = (id) => this.screens.show(id);
    window.stopCamera     = ()  => this.camera.stop();
    window.resetAll       = ()  => this.resetAll();
  }

  // ── Navigasi ──────────────────────────────────────────────

  goToLayout() {
    this.screens.show('screen-layout');
  }

  goToMode() {
    if (!this.state.layout) return;
    this.screens.show('screen-mode');
  }

  goToSnap() {
    if (!this.state.mode) return;
    this.state.photos = [];
    if (this.state.mode === 'camera') {
      this.camera.buildThumbs();
      this.screens.show('screen-camera');
      this.camera.init();
    } else {
      this.gallery.buildThumbs();
      document.getElementById('galleryCount').textContent = this.state.layout;
      this.screens.show('screen-gallery');
    }
  }

  goToCustomize() {
    this.camera.stop();
    this._buildCustomizePreview();
    this.screens.show('screen-customize');
  }

  goBackFromCustomize() {
    if (this.state.mode === 'camera') {
      this.screens.show('screen-camera');
      this.camera.init();
    } else {
      this.screens.show('screen-gallery');
    }
  }

  goToStyle() {
    this.state.selectedFrame = null;
    this.dropdown.build();
    this.screens.show('screen-style');
    // Pilih frame pertama secara default
    const firstFrame = this.state.currentFrames[0];
    if (firstFrame) this.dropdown.selectByKey(firstFrame.key);
  }

  // ── Pilih Layout ──────────────────────────────────────────

  selectLayout(n) {
    this.state.layout = n;
    document.getElementById('lc2').classList.toggle('selected', n === 2);
    document.getElementById('lc3').classList.toggle('selected', n === 3);
    document.getElementById('layoutLabel').textContent = `Selected : ${n} Frame`;
    document.getElementById('layoutNext').disabled = false;
  }

  // ── Pilih Mode ────────────────────────────────────────────

  selectMode(m) {
    this.state.mode = m;
    document.getElementById('modeCamera').classList.toggle('selected', m === 'camera');
    document.getElementById('modeGallery').classList.toggle('selected', m === 'gallery');
    document.getElementById('modeNext').disabled = false;
  }

  // ── Capture ───────────────────────────────────────────────

  startCapture() {
    this.camera.capture(() => this.goToCustomize());
  }

  // ── Customize ─────────────────────────────────────────────

  _buildCustomizePreview() {
    const container   = document.getElementById('customizePhotos');
    container.innerHTML = '';
    this.state.photos.forEach(url => {
      const div = document.createElement('div');
      div.className = 'customize-photo';
      if (url) {
        const img = document.createElement('img');
        img.src   = url;
        div.appendChild(img);
      }
      container.appendChild(div);
    });
  }

  doRetake() {
    this.state.photos = [];
    if (this.state.mode === 'camera') {
      this.camera.buildThumbs();
      this.screens.show('screen-camera');
      this.camera.init();
    } else {
      this.gallery.buildThumbs();
      this.screens.show('screen-gallery');
    }
  }

  // ── Download ──────────────────────────────────────────────

  async downloadPhoto() {
    const styleCanvas = document.getElementById('styleCanvas');
    await this.renderer.downloadFromCanvas(styleCanvas);
  }

  // ── Reset ─────────────────────────────────────────────────

  resetAll() {
    this.camera.stop();
    this.state.reset();

    document.getElementById('lc2').classList.remove('selected');
    document.getElementById('lc3').classList.remove('selected');
    document.getElementById('layoutLabel').textContent = '';
    document.getElementById('layoutNext').disabled = true;

    document.getElementById('modeCamera').classList.remove('selected');
    document.getElementById('modeGallery').classList.remove('selected');
    document.getElementById('modeNext').disabled = true;
  }
}


/* ─────────────────────────────────────────────────────────────
   Entry Point — Jalankan App setelah DOM siap
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
