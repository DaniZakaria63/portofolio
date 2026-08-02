class SpaceScene {
  constructor(id) {
    this.canvas = document.getElementById(id);
    this.meteors = [];
    this.mouse = { x: 0, y: 0 };
    if (!this.canvas || !window.THREE) return;
    this.scene = new THREE.Scene();
    const box = this.canvas.parentElement;
    this.camera = new THREE.PerspectiveCamera(58, box.clientWidth / box.clientHeight, .1, 1000);
    this.camera.position.z = 22;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.resize();
    this.addStars();
    this.addGalaxy();
    this.addMeteors();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', event => { this.mouse.x = event.clientX / innerWidth * 2 - 1; this.mouse.y = event.clientY / innerHeight * 2 - 1; });
    this.animate();
  }

  resize() {
    if (!this.renderer) return;
    const box = this.canvas.parentElement;
    this.camera.aspect = box.clientWidth / box.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(box.clientWidth, box.clientHeight, false);
  }

  points(count, radius, size, palette) {
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    const colorset = palette.map(color => new THREE.Color(color));
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 1.5) * radius, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const color = colorset[i % colorset.length], glow = .5 + Math.random() * .5;
      colors.set([color.r * glow, color.g * glow, color.b * glow], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending }));
  }

  addStars() { this.stars = this.points(innerWidth < 700 ? 700 : 1500, 42, .045, [0xdfe5ec, 0x626c7d, 0x599692]); this.scene.add(this.stars); }

  addGalaxy() {
    const galaxy = this.points(innerWidth < 700 ? 1800 : 4200, 16, .065, [0x599692, 0x626c7d, 0xdfe5ec]);
    galaxy.rotation.x = .42; galaxy.rotation.z = -.72; galaxy.position.z = -7; galaxy.scale.set(1.7, .28, 1.7); this.galaxy = galaxy; this.scene.add(galaxy);
  }

  addMeteors() {
    const textureCanvas = document.createElement('canvas'); textureCanvas.width = 40; textureCanvas.height = 180;
    const context = textureCanvas.getContext('2d'), gradient = context.createLinearGradient(20, 180, 20, 0);
    gradient.addColorStop(0, 'rgba(223,229,236,1)'); gradient.addColorStop(.16, 'rgba(89,150,146,.8)'); gradient.addColorStop(1, 'rgba(89,150,146,0)');
    context.fillStyle = gradient; context.fillRect(14, 0, 12, 180);
    const texture = new THREE.CanvasTexture(textureCanvas);
    for (let i = 0; i < (innerWidth < 700 ? 12 : 24); i++) { const meteor = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); meteor.userData = {}; this.spawn(meteor, true); this.meteors.push(meteor); this.scene.add(meteor); }
  }

  spawn(meteor, initial) { const data = meteor.userData; data.x = initial ? 20 + Math.random() * 30 : 24; data.y = 12 + Math.random() * 15; data.z = -3 + Math.random() * 15; data.speed = 4 + Math.random() * 5; data.slope = .35 + Math.random() * .25; meteor.scale.set(.2, 1.3 + Math.random() * 1.5, 1); }

  animate() { requestAnimationFrame(() => this.animate()); const time = performance.now() * .001; this.galaxy.rotation.y = -.72 + time * .018; this.stars.rotation.y = time * .006; this.meteors.forEach(meteor => { const d = meteor.userData; d.x -= d.speed / 60; d.y -= d.speed * d.slope / 60; meteor.position.set(d.x, d.y, d.z); meteor.material.opacity = Math.max(0, Math.min(1, (25 - d.x) / 5)); meteor.material.rotation = -.3; if (d.x < -25 || d.y < -14) this.spawn(meteor, false); }); this.camera.position.x += (this.mouse.x * .45 - this.camera.position.x) * .015; this.camera.position.y += (-this.mouse.y * .25 - this.camera.position.y) * .015; this.camera.lookAt(this.scene.position); this.renderer.render(this.scene, this.camera); }
}

class PortfolioUI {
  constructor() {
    this.loading(); this.navigation(); this.reveal(); this.filters(); this.media(); this.cursor();
  }
  loading() { const screen = document.getElementById('loadingScreen'); window.addEventListener('load', () => { setTimeout(() => { screen.style.transition = 'opacity .6s'; screen.style.opacity = 0; setTimeout(() => screen.remove(), 650); }, 250); }); }
  navigation() { const nav = document.getElementById('navbar'), menu = document.getElementById('navMenu'), toggle = document.getElementById('menuToggle'); addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 30), { passive: true }); toggle.addEventListener('click', () => { const open = menu.classList.toggle('open'); toggle.setAttribute('aria-expanded', open); }); document.querySelectorAll('.nav-link,.nav-cta').forEach(link => link.addEventListener('click', () => menu.classList.remove('open'))); const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) return; document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id)); }), { rootMargin: '-45% 0px -45% 0px' }); document.querySelectorAll('main section').forEach(section => observer.observe(section)); }
  reveal() { if (!window.gsap || !window.ScrollTrigger) { document.querySelectorAll('.reveal').forEach(item => item.classList.add('visible')); return; } gsap.registerPlugin(ScrollTrigger); gsap.utils.toArray('.reveal').forEach(item => gsap.fromTo(item, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: item, start: 'top 88%', once: true } })); }
  filters() { document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { const filter = button.dataset.filter; document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button)); document.querySelectorAll('.project-card').forEach(card => card.classList.toggle('is-hidden', filter !== 'all' && card.dataset.type !== filter)); })); }
  media() { const videos = document.querySelectorAll('video'); const observer = new IntersectionObserver(entries => entries.forEach(entry => { const video = entry.target; if (entry.isIntersecting) video.play().catch(() => {}); else video.pause(); }), { threshold: .2 }); videos.forEach(video => { observer.observe(video); video.addEventListener('error', () => { video.style.display = 'none'; }); }); }
  cursor() { const cursor = document.getElementById('cursor'); if (matchMedia('(pointer: coarse)').matches) return; document.addEventListener('mousemove', event => { cursor.style.left = event.clientX + 'px'; cursor.style.top = event.clientY + 'px'; }); document.querySelectorAll('a,button,.project-card').forEach(item => { item.addEventListener('mouseenter', () => cursor.classList.add('hover')); item.addEventListener('mouseleave', () => cursor.classList.remove('hover')); }); }
}

document.addEventListener('DOMContentLoaded', () => { new SpaceScene('heroCanvas'); new PortfolioUI(); });
