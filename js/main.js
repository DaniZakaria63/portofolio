class HeroScene {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId);
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.galaxy = null;
		this.starfield = null;
		this.fallingStars = [];
		this.mouseX = 0;
		this.mouseY = 0;
		this.targetX = 0;
		this.targetY = 0;
		this.isMobile = window.innerWidth < 768;
		this.init();
	}

	init() {
		if (!this.canvas || !window.THREE) return;

		this.scene = new THREE.Scene();
		this.scene.background = null;

		const width = this.canvas.parentElement.offsetWidth;
		const height = this.canvas.parentElement.offsetHeight;

		this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
		this.camera.position.set(0, 0, 20);

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance',
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor(0x000000, 0);

		this.createStarfield();
		this.createGalaxy();
		this.createFallingStars();

		this.addEventListeners();
		this.animate();
	}

	createStarfield() {
		const count = this.isMobile ? 800 : 1800;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);

		const tints = [
			new THREE.Color(0xffffff),
			new THREE.Color(0xa6b8ff),
			new THREE.Color(0xffe8c8),
			new THREE.Color(0xc9d6ff),
		];

		for (let i = 0; i < count; i++) {
			const radius = 24 + Math.random() * 30;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);

			positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = radius * Math.cos(phi);

			const tint = tints[(Math.random() * tints.length) | 0];
			const brightness = 0.5 + Math.random() * 0.5;
			colors[i * 3] = tint.r * brightness;
			colors[i * 3 + 1] = tint.g * brightness;
			colors[i * 3 + 2] = tint.b * brightness;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: this.isMobile ? 0.055 : 0.04,
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
			sizeAttenuation: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});

		this.starfield = new THREE.Points(geometry, material);
		this.scene.add(this.starfield);
	}

	createGalaxy() {
		const count = this.isMobile ? 1500 : 3800;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);

		const arms = 4;
		const armColors = [
			new THREE.Color(0x7fd8ff),
			new THREE.Color(0x00f3ff),
			new THREE.Color(0x9b8cff),
			new THREE.Color(0xff7ee5),
		];

		for (let i = 0; i < count; i++) {
			const radius = Math.pow(Math.random(), 1.6) * 15;
			const armIndex = i % arms;
			const armAngle = armIndex * ((Math.PI * 2) / arms);
			const spiral = armAngle + radius * 1.1;
			const spread = 0.3 + radius * 0.5;

			const x = Math.cos(spiral) * radius + (Math.random() - 0.5) * spread;
			const y = (Math.random() - 0.5) * spread * 0.3;
			const z = Math.sin(spiral) * radius + (Math.random() - 0.5) * spread;

			positions[i * 3] = x;
			positions[i * 3 + 1] = y;
			positions[i * 3 + 2] = z;

			const falloff = radius / 15;
			const color = new THREE.Color(0xffffff).lerp(armColors[armIndex], Math.pow(falloff, 0.7));
			const twinkle = 0.6 + Math.random() * 0.6;
			colors[i * 3] = color.r * twinkle;
			colors[i * 3 + 1] = color.g * twinkle;
			colors[i * 3 + 2] = color.b * twinkle;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: this.isMobile ? 0.08 : 0.055,
			vertexColors: true,
			transparent: true,
			opacity: 0.95,
			sizeAttenuation: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});

		const points = new THREE.Points(geometry, material);

		this.galaxy = new THREE.Group();
		this.galaxy.rotation.x = Math.PI * 0.32;
		this.galaxy.rotation.y = 0.12;
		this.galaxy.rotation.z = -Math.PI / 4.2;
		this.galaxy.scale.setScalar(1.9);
		this.galaxy.position.z = -6;
		this.galaxy.add(points);
		this.scene.add(this.galaxy);
	}

	createFallingStars() {
		const count = this.isMobile ? 16 : 30;
		const texture = this.createCometTexture();

		for (let i = 0; i < count; i++) {
			const material = new THREE.SpriteMaterial({
				map: texture,
				transparent: true,
				opacity: 0,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
			});

			material.color.setHSL(0.52 + Math.random() * 0.3, 0.5, 0.95);

			const sprite = new THREE.Sprite(material);
			sprite.userData = { speed: 1 };
			this.spawnMeteor(sprite);
			this.scene.add(sprite);
			this.fallingStars.push(sprite);
		}
	}

	spawnMeteor(star) {
		const ud = star.userData;
		ud.x = 30 + Math.random() * 8;
		ud.y = 10 + (Math.random() - 0.5) * 20;
		ud.z = -8 + Math.random() * 14;
		ud.speed = 3 + Math.random() * 3.5;
		ud.slope = 0.3 + Math.random() * 0.18;
		ud.drift = (Math.random() - 0.5) * 0.15;
	}

	updateMeteor(star, dt) {
		const ud = star.userData;
		const time = Date.now() * 0.001;

		ud.x -= ud.speed * dt;
		ud.y -= ud.speed * ud.slope * dt;
		ud.y += Math.sin(time * 1.5 + ud.x * 0.4) * ud.drift * dt * 6;

		const travel = Math.hypot(ud.speed, ud.speed * ud.slope);
		const angle = Math.atan2(ud.speed * ud.slope, ud.speed);

		const fadeIn = Math.max(0, Math.min(1, (38 - ud.x) / 7));
		const fadeOut = Math.max(0, Math.min(1, (ud.x + 26) / 7));
		const glow = Math.min(0.95, 0.3 + travel * 0.12) * Math.min(fadeIn, fadeOut);

		star.material.opacity = glow;
		star.material.rotation = angle - Math.PI / 2;

		const len = 1.8 + travel * 0.55;
		star.scale.set(len * 0.22, len, 1);

		star.position.set(ud.x, ud.y, ud.z);

		if (ud.x < -28 || ud.y < -13 || ud.y > 14) {
			this.spawnMeteor(star);
			return;
		}
	}

	createCometTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 160;
		const ctx = canvas.getContext('2d');

		ctx.globalCompositeOperation = 'lighter';

		const headX = canvas.width * 0.5;
		const headY = canvas.height * 0.85;

		const head = ctx.createRadialGradient(headX, headY, 0, headX, headY, 26);
		head.addColorStop(0, 'rgba(255, 255, 255, 1)');
		head.addColorStop(0.3, 'rgba(255, 250, 240, 0.55)');
		head.addColorStop(1, 'rgba(255, 250, 240, 0)');
		ctx.fillStyle = head;
		ctx.beginPath();
		ctx.arc(headX, headY, 26, 0, Math.PI * 2);
		ctx.fill();

		for (let i = 0; i < 40; i++) {
			const s = i / 39;
			const y = headY - s * 130;
			const x = headX + (Math.sin(s * Math.PI * 1.4) + (s * s - s) * 4) * s * 16;
			const radius = Math.max(1.1, 9 * Math.pow(1 - s, 2.2));
			const alpha = Math.pow(1 - s, 2.4) * 0.8;

			const circle = ctx.createRadialGradient(x, y, 0, x, y, radius);
			circle.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
			circle.addColorStop(1, 'rgba(255, 255, 255, 0)');
			ctx.fillStyle = circle;
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalCompositeOperation = 'source-over';

		const texture = new THREE.CanvasTexture(canvas);
		return texture;
	}

	addEventListeners() {
		document.addEventListener('mousemove', (e) => {
			this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
			this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
		});

		window.addEventListener('resize', () => {
			const width = this.canvas.parentElement.offsetWidth;
			const height = this.canvas.parentElement.offsetHeight;

			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height);
		});
	}

	animate() {
		if (!this.scene || !this.camera || !this.renderer) return;

		requestAnimationFrame(() => this.animate());

		const time = Date.now() * 0.001;

		this.targetX += (this.mouseX * 0.4 - this.targetX) * 0.02;
		this.targetY += (this.mouseY * 0.4 - this.targetY) * 0.02;

		if (this.galaxy) {
			this.galaxy.rotation.y = 0.12 + Math.sin(time * 0.05) * 0.18;
			this.galaxy.rotation.z = -Math.PI / 4.2 + Math.sin(time * 0.04) * 0.03;
			this.galaxy.children[0].material.opacity = 0.9 + Math.sin(time * 0.5) * 0.08;
		}

		if (this.starfield) {
			this.starfield.material.opacity = 0.75 + Math.sin(time * 0.8) * 0.15;
			this.starfield.rotation.y += 0.0003;
		}

		this.fallingStars.forEach(star => this.updateMeteor(star, 1 / 60));

		this.camera.position.x = this.targetX * 0.6;
		this.camera.position.y = this.targetY * 0.4;
		this.camera.lookAt(this.scene.position);

		this.renderer.render(this.scene, this.camera);
	}
}

class SkillsScene {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId);
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.orbitingSpheres = [];
		this.centralSphere = null;
		this.isDragging = false;
		this.previousMouse = { x: 0, y: 0 };
		this.targetRotation = { x: 0, y: 0 };
		this.currentRotation = { x: 0, y: 0 };
		this.init();
	}

	init() {
		if (!this.canvas || !window.THREE) return;

		this.scene = new THREE.Scene();
		this.scene.background = null;

		const width = 260;
		const height = 260;

		this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
		this.camera.position.z = 8;

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance',
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setClearColor(0x000000, 0);

		const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
		this.scene.add(ambientLight);

		const pointLight = new THREE.PointLight(0x00f3ff, 1, 100);
		this.scene.add(pointLight);

		this.createCentralSphere();
		this.createOrbitingSpheres();

		this.addEventListeners();
		this.animate();
	}

	createCentralSphere() {
		const geometry = new THREE.IcosahedronGeometry(0.8, 2);
		const material = new THREE.MeshStandardMaterial({
			color: 0x00f3ff,
			emissive: 0x00f3ff,
			emissiveIntensity: 0.3,
			wireframe: true,
			transparent: true,
			opacity: 0.7,
		});

		this.centralSphere = new THREE.Mesh(geometry, material);
		this.scene.add(this.centralSphere);
	}

	createOrbitingSpheres() {
		const skills = [
			{ name: 'Mobile', color: 0xff6b6b, radius: 2.5, speed: 0.3, delay: 0 },
			{ name: 'Web', color: 0x4ecdc4, radius: 2.5, speed: 0.25, delay: 0.2 },
			{ name: 'Database', color: 0xffbe0b, radius: 2.5, speed: 0.28, delay: 0.4 },
			{ name: 'Server', color: 0x8a2bff, radius: 2.5, speed: 0.32, delay: 0.6 },
		];

		const spriteMaterial = new THREE.SpriteMaterial({
			map: this.createTextSprite(),
			transparent: true,
		});

		skills.forEach((skill, index) => {
			const geometry = new THREE.SphereGeometry(0.35, 16, 16);
			const material = new THREE.MeshStandardMaterial({
				color: skill.color,
				emissive: skill.color,
				emissiveIntensity: 0.4,
			});

			const sphere = new THREE.Mesh(geometry, material);
			sphere.userData = {
				name: skill.name,
				angle: (index / skills.length) * Math.PI * 2,
				radius: skill.radius,
				speed: skill.speed,
				delay: skill.delay,
				baseColor: skill.color,
			};

			this.scene.add(sphere);
			this.orbitingSpheres.push(sphere);
		});
	}

	createTextSprite() {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		canvas.width = 128;
		canvas.height = 32;
		return new THREE.CanvasTexture(canvas);
	}

	addEventListeners() {
		const onDragStart = (e) => {
			this.isDragging = true;
			this.previousMouse = { x: e.clientX, y: e.clientY };
		};

		const onDrag = (e) => {
			if (!this.isDragging) return;
			const deltaX = e.clientX - this.previousMouse.x;
			this.targetRotation.y += deltaX * 0.01;
			this.previousMouse = { x: e.clientX, y: e.clientY };
		};

		const onDragEnd = () => {
			this.isDragging = false;
		};

		this.canvas.addEventListener('mousedown', onDragStart);
		this.canvas.addEventListener('mousemove', onDrag);
		this.canvas.addEventListener('mouseup', onDragEnd);
		this.canvas.addEventListener('mouseleave', onDragEnd);

		this.canvas.addEventListener('touchstart', (e) => {
			this.isDragging = true;
			this.previousMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
		});
		this.canvas.addEventListener('touchmove', (e) => {
			if (!this.isDragging) return;
			const deltaX = e.touches[0].clientX - this.previousMouse.x;
			this.targetRotation.y += deltaX * 0.01;
			this.previousMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
		}, { passive: true });
		this.canvas.addEventListener('touchend', () => {
			this.isDragging = false;
		});
	}

	animate() {
		if (!this.scene || !this.camera || !this.renderer) return;

		requestAnimationFrame(() => this.animate());

		if (this.centralSphere) {
			this.centralSphere.rotation.y += 0.003;
			this.centralSphere.rotation.x += 0.001;
		}

		this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.05;
		this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.05;

		this.orbitingSpheres.forEach((sphere, index) => {
			sphere.userData.angle += sphere.userData.speed * 0.016;
			sphere.position.x = Math.cos(sphere.userData.angle) * sphere.userData.radius;
			sphere.position.z = Math.sin(sphere.userData.angle) * sphere.userData.radius;
			sphere.position.y = Math.sin(sphere.userData.angle * 0.7) * 0.5;

			sphere.rotation.x += 0.01;
			sphere.rotation.y += 0.01;
		});

		this.camera.position.x = Math.sin(this.currentRotation.y) * 0.3;

		this.renderer.render(this.scene, this.camera);
	}
}

class AnimationController {
	constructor() {
		this.init();
	}

	init() {
		this.initLoadingScreen();
		this.initCustomCursor();
		this.initNavigation();
		this.initGSAPAnimations();
		this.initCounters();
		this.initContactForm();
	}

	initLoadingScreen() {
		const loadingScreen = document.getElementById('loadingScreen');
		if (!loadingScreen) return;

		const hideLoading = () => {
			if (gsap) {
				gsap.to(loadingScreen, {
					opacity: 0,
					duration: 0.8,
					ease: 'power2.inOut',
					onComplete: () => {
						loadingScreen.style.display = 'none';
						document.body.style.overflow = 'auto';
					},
				});
			} else {
				loadingScreen.style.transition = 'opacity 0.8s ease';
				loadingScreen.style.opacity = '0';
				setTimeout(() => {
					loadingScreen.style.display = 'none';
					document.body.style.overflow = 'auto';
				}, 800);
			}
		};

		window.addEventListener('load', () => {
			setTimeout(hideLoading, 300);
		});

		setTimeout(hideLoading, 5000);
		document.body.style.overflow = 'hidden';
	}

	initCustomCursor() {
		const cursor = document.getElementById('cursor');
		if (!cursor) return;

		let mouseX = 0;
		let mouseY = 0;
		let currentX = 0;
		let currentY = 0;

		document.addEventListener('mousemove', (e) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
		});

		const hoverElements = document.querySelectorAll('a, .project-card, .domain-item, button, .social-link');
		hoverElements.forEach(el => {
			el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
			el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
		});

		const animateCursor = () => {
			currentX += (mouseX - currentX) * 0.1;
			currentY += (mouseY - currentY) * 0.1;
			cursor.style.transform = `translate(${currentX}px, ${currentY}px)`;
			requestAnimationFrame(animateCursor);
		};
		animateCursor();
	}

	initNavigation() {
		const navbar = document.getElementById('navbar');
		const navMenu = document.getElementById('navMenu');
		const menuToggle = document.getElementById('menuToggle');

		if (navbar) {
			let lastScroll = 0;

			window.addEventListener('scroll', () => {
				const scrollTop = window.pageYOffset;

				if (scrollTop > 50) {
					navbar.classList.add('scrolled');
				} else {
					navbar.classList.remove('scrolled');
				}

				lastScroll = scrollTop;
			});
		}

		if (menuToggle && navMenu) {
			menuToggle.addEventListener('click', () => {
				menuToggle.classList.toggle('active');
				navMenu.classList.toggle('active');
			});
		}

		const navLinks = document.querySelectorAll('.nav-link');
		navLinks.forEach(link => {
			link.addEventListener('click', () => {
				navLinks.forEach(l => l.classList.remove('active'));
				link.classList.add('active');

				if (navMenu) navMenu.classList.remove('active');
				if (menuToggle) menuToggle.classList.remove('active');
			});
		});

		this.initActiveNavOnScroll();
	}

	initActiveNavOnScroll() {
		const sections = document.querySelectorAll('section');
		const navLinks = document.querySelectorAll('.nav-link');

		const observerOptions = {
			root: null,
			rootMargin: '-50% 0px -50% 0px',
			threshold: 0,
		};

		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				const id = entry.target.id;
				const link = document.querySelector(`.nav-link[href="#${id}"]`);

				if (entry.isIntersecting) {
					navLinks.forEach(l => l.classList.remove('active'));
					if (link) link.classList.add('active');
				}
			});
		}, observerOptions);

		sections.forEach(section => {
			if (section.id) observer.observe(section);
		});
	}

	initGSAPAnimations() {
		if (!gsap || !ScrollTrigger) return;

		gsap.registerPlugin(ScrollTrigger);

		const tl = gsap.timeline({
			defaults: {
				opacity: 0,
				y: 30,
				duration: 0.8,
				ease: 'power3.out',
			},
		});

		// About section animations
		tl.to('.about-text', {
			opacity: 1,
			y: 0,
			scrollTrigger: {
				trigger: '.about-section',
				start: 'top 80%',
			},
		}).to('.about-highlights .highlight', {
			opacity: 1,
			y: 0,
			stagger: 0.1,
			scrollTrigger: {
				trigger: '.about-highlights',
				start: 'top 80%',
			},
		}, '-=0.4');

		// Skills section animations
		gsap.from('.skill-item', {
			opacity: 0,
			x: -20,
			stagger: 0.1,
			duration: 0.6,
			scrollTrigger: {
				trigger: '.skills-section',
				start: 'top 80%',
			},
		});

		gsap.utils.toArray('.skill-progress').forEach(bar => {
			const targetWidth = bar.style.width || '100%';
			gsap.fromTo(bar, { width: '0%' }, {
				width: targetWidth,
				duration: 1.5,
				ease: 'power3.out',
				scrollTrigger: {
					trigger: bar,
					start: 'top 90%',
				},
			});
		});

		gsap.from('.domain-item', {
			opacity: 0,
			y: 20,
			stagger: 0.1,
			duration: 0.6,
			scrollTrigger: {
				trigger: '.domain-list',
				start: 'top 90%',
			},
		});

		// Projects section animations
		gsap.utils.toArray('.project-card').forEach((card, i) => {
			gsap.from(card, {
				opacity: 0,
				y: 40,
				rotationY: 20,
				duration: 0.8,
				delay: i * 0.1,
				ease: 'power3.out',
				scrollTrigger: {
					trigger: card,
					start: 'top 90%',
				},
			});
		});

		// Experience timeline animations
		gsap.utils.toArray('.timeline-item').forEach((item, i) => {
			const direction = i % 2 === 0 ? -1 : 1;
			gsap.from(item, {
				opacity: 0,
				x: 80 * direction,
				duration: 0.8,
				delay: i * 0.1,
				ease: 'power3.out',
				scrollTrigger: {
					trigger: item,
					start: 'top 85%',
				},
			});
		});

		// Contact section animations
		gsap.from('.contact-item', {
			opacity: 0,
			y: 20,
			stagger: 0.15,
			duration: 0.6,
			scrollTrigger: {
				trigger: '.contact-info',
				start: 'top 80%',
			},
		});

		gsap.from('.contact-form-container', {
			opacity: 0,
			y: 30,
			duration: 0.8,
			ease: 'power3.out',
			scrollTrigger: {
				trigger: '.contact-form-container',
				start: 'top 80%',
			},
		});

		// Hero text entrance
		const heroTl = gsap.timeline({ defaults: { duration: 1, ease: 'power3.out' } });
		heroTl.from('.hero-greeting', { opacity: 0, y: 20 })
			.from('.hero-name', { opacity: 0, y: 30 }, '-=0.6')
			.from('.hero-title', { opacity: 0, y: 20 }, '-=0.6')
			.from('.hero-buttons .btn', { opacity: 0, y: 20, stagger: 0.15 }, '-=0.6')
			.from('.hero-stats .stat', { opacity: 0, y: 20, stagger: 0.1 }, '-=0.4')
			.from('.scroll-indicator', { opacity: 0, y: 10 }, '-=0.6');

		// Scroll indicator bounce
		gsap.to('.scroll-dot', {
			y: 16,
			opacity: 0.3,
			repeat: -1,
			yoyo: true,
			duration: 1.5,
			ease: 'power2.inOut',
		});
	}

	initCounters() {
		const counters = document.querySelectorAll('.stat-number');
		counters.forEach(counter => {
			const text = counter.textContent;
			const target = parseInt(text);
			const hasPlus = text.includes('+');
			counter.textContent = hasPlus ? '0+' : '0';

			const proxy = { val: 0 };
			gsap.to(proxy, {
				val: target,
				duration: 2,
				delay: 0.5,
				ease: 'power2.out',
				onUpdate: () => {
					counter.textContent = Math.round(proxy.val) + (hasPlus ? '+' : '');
				},
				scrollTrigger: {
					trigger: counter.parentElement,
					start: 'top 80%',
				},
			});
		});
	}

	initContactForm() {
		const form = document.getElementById('contactForm');
		if (form) {
			form.addEventListener('submit', (e) => {
				e.preventDefault();
				const inputs = form.querySelectorAll('.form-input');
				inputs.forEach(input => {
					if (input.value.trim()) {
						input.style.borderColor = '#4ecdc4';
					}
				});

				form.reset();
				const submitBtn = form.querySelector('button[type="submit"]');
				const originalText = submitBtn.textContent;
				submitBtn.textContent = 'Message Sent!';
				submitBtn.style.background = 'linear-gradient(135deg, #4ecdc4, #00f3ff)';

				setTimeout(() => {
					submitBtn.textContent = originalText;
					submitBtn.style.background = '';
					inputs.forEach(input => input.style.borderColor = '');
				}, 3000);
			});
		}
	}
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	const heroScene = new HeroScene('heroCanvas');
	const skillsScene = new SkillsScene('skillsCanvas');
	const animationController = new AnimationController();

	// Close mobile menu when clicking nav links
	document.querySelectorAll('.nav-link').forEach(link => {
		link.addEventListener('click', (e) => {
			const menuToggle = document.getElementById('menuToggle');
			const navMenu = document.getElementById('navMenu');
			if (menuToggle && navMenu) {
				menuToggle.classList.remove('active');
				navMenu.classList.remove('active');
			}
		});
	});
});
