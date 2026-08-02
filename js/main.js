class HeroScene {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId);
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.pcbGroup = null;
		this.particles = null;
		this.nodes = [];
		this.traces = [];
		this.tracePaths = [];
		this.dataPackets = [];
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

		this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
		this.camera.position.z = 15;

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
		pointLight.position.set(10, 10, 10);
		this.scene.add(pointLight);

		const pointLight2 = new THREE.PointLight(0x4ecdc4, 0.8, 100);
		pointLight2.position.set(-10, -5, -10);
		this.scene.add(pointLight2);

		const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
		dirLight.position.set(5, 10, 7);
		this.scene.add(dirLight);

		this.createParticles();
		this.createDataFlow();

		this.addEventListeners();
		this.animate();
	}

	createParticles() {
		const particleCount = this.isMobile ? 300 : 800;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(particleCount * 3);
		const colors = new Float32Array(particleCount * 3);

		const colorPalette = [
			[0x00f3ff, 0.3],
			[0x4ecdc4, 0.3],
			[0xff6b6b, 0.2],
		];

		for (let i = 0; i < particleCount; i++) {
			const radius = 8 + Math.random() * 12;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);

			positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = radius * Math.cos(phi);

			const colorChoice = colorPalette[Math.floor(Math.random() * colorPalette.length)];
			colors[i * 3] = (colorChoice[0] >> 16 & 0xff) / 255;
			colors[i * 3 + 1] = (colorChoice[0] >> 8 & 0xff) / 255;
			colors[i * 3 + 2] = (colorChoice[0] & 0xff) / 255;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: 0.04,
			vertexColors: true,
			transparent: true,
			opacity: 0.5,
			sizeAttenuation: true,
			depthWrite: false,
		});

		this.particles = new THREE.Points(geometry, material);
		this.scene.add(this.particles);
	}

	createDataFlow() {
		this.pcbGroup = new THREE.Group();

		const boardGeometry = new THREE.BoxGeometry(16, 0.1, 16);
		const boardMaterial = new THREE.MeshStandardMaterial({
			color: 0x0d2014,
			roughness: 0.85,
			metalness: 0.15,
			transparent: true,
			opacity: 0.92,
		});
		const board = new THREE.Mesh(boardGeometry, boardMaterial);
		board.position.y = -0.06;
		this.pcbGroup.add(board);

		const gridGeometry = new THREE.BufferGeometry();
		const gridPoints = [];
		const gridSize = 8;
		const gridStep = 1;
		for (let i = -gridSize; i <= gridSize; i += gridStep) {
			gridPoints.push(new THREE.Vector3(i, 0.01, -gridSize));
			gridPoints.push(new THREE.Vector3(i, 0.01, gridSize));
			gridPoints.push(new THREE.Vector3(-gridSize, 0.01, i));
			gridPoints.push(new THREE.Vector3(gridSize, 0.01, i));
		}
		gridGeometry.setFromPoints(gridPoints);
		const gridMaterial = new THREE.LineBasicMaterial({
			color: 0x00aa44,
			transparent: true,
			opacity: 0.35,
		});
		const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
		this.pcbGroup.add(gridLines);

		const borderGeometry = new THREE.BufferGeometry();
		const borderWidth = 7.8;
		const borderPoints = [
			new THREE.Vector3(-borderWidth, 0.01, -borderWidth),
			new THREE.Vector3(borderWidth, 0.01, -borderWidth),
			new THREE.Vector3(borderWidth, 0.01, borderWidth),
			new THREE.Vector3(-borderWidth, 0.01, borderWidth),
		];
		borderGeometry.setFromPoints(borderPoints);
		const borderMaterial = new THREE.LineBasicMaterial({
			color: 0x00cc44,
			transparent: true,
			opacity: 0.7,
		});
		const borderLines = new THREE.LineLoop(borderGeometry, borderMaterial);
		this.pcbGroup.add(borderLines);

		const nodePositions = [
			{ pos: [-6, 0.01, 2], color: 0x00f3ff, name: 'CPU' },
			{ pos: [-3, 0.01, 3], color: 0x4ecdc4, name: 'RAM' },
			{ pos: [0, 0.01, 0], color: 0x00f3ff, name: 'CTRL' },
			{ pos: [3, 0.01, -1], color: 0xff6b6b, name: 'SENSOR' },
			{ pos: [6, 0.01, 1], color: 0xffbe0b, name: 'PWR' },
			{ pos: [-2, 0.01, -3], color: 0x8a2bff, name: 'COMMS' },
			{ pos: [4, 0.01, 3], color: 0x4ecdc4, name: 'STORAGE' },
			{ pos: [-5, 0.01, -4], color: 0xff6b6b, name: 'IO' },
			{ pos: [0, 0.01, -5], color: 0x00f3ff, name: 'BUS' },
			{ pos: [7, 0.01, 0], color: 0xffbe0b, name: 'USB' },
			{ pos: [-7, 0.01, -1], color: 0x8a2bff, name: 'GPIO' },
			{ pos: [2, 0.01, 5], color: 0x4ecdc4, name: 'DEBUG' },
		];

		nodePositions.forEach((nodeData, idx) => {
			const y = nodeData.pos[1];

			const padGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
			const padMaterial = new THREE.MeshStandardMaterial({
				color: 0xb87333,
				emissive: nodeData.color,
				emissiveIntensity: 0.4,
				roughness: 0.3,
				metalness: 0.7,
			});
			const pad = new THREE.Mesh(padGeometry, padMaterial);
			pad.position.set(nodeData.pos[0], y, nodeData.pos[2]);
			pad.rotation.x = -Math.PI / 2;
			pad.userData = nodeData;
			this.pcbGroup.add(pad);
			this.nodes.push(pad);

			const compGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.3);
			const compMaterial = new THREE.MeshStandardMaterial({
				color: 0x0a0a0f,
				emissive: nodeData.color,
				emissiveIntensity: 0.15,
				roughness: 0.4,
				metalness: 0.2,
			});
			const component = new THREE.Mesh(compGeometry, compMaterial);
			component.position.set(
				nodeData.pos[0] + 0.6,
				y + 0.02,
				nodeData.pos[2] + 0.4
			);
			this.pcbGroup.add(component);

			const viaGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 10);
			const viaMaterial = new THREE.MeshStandardMaterial({
				color: 0x222222,
				emissive: 0x000000,
				roughness: 0.8,
				metalness: 0.9,
			});
			const via = new THREE.Mesh(viaGeometry, viaMaterial);
			via.position.set(nodeData.pos[0], y - 0.08, nodeData.pos[2]);
			via.rotation.x = -Math.PI / 2;
			this.pcbGroup.add(via);

			const ledGeometry = new THREE.SphereGeometry(0.12, 12, 12);
			const ledMaterial = new THREE.MeshBasicMaterial({
				color: nodeData.color,
				emissive: nodeData.color,
				emissiveIntensity: 0.6,
				transparent: true,
				opacity: 0.85,
			});
			const led = new THREE.Mesh(ledGeometry, ledMaterial);
			led.position.set(
				nodeData.pos[0] - 0.55,
				y + 0.06,
				nodeData.pos[2] + 0.45
			);
			this.pcbGroup.add(led);

			const labelSprite = this.createLabelSprite(nodeData.name, nodeData.color);
			labelSprite.position.set(
				nodeData.pos[0] - 0.6,
				y + 0.4,
				nodeData.pos[2] + 0.4
			);
			this.pcbGroup.add(labelSprite);
		});

		const connections = [
			[0, 1], [1, 2], [2, 3], [3, 4],
			[4, 8], [8, 5], [5, 0], [0, 6],
			[6, 4], [2, 7], [7, 11], [11, 8],
			[4, 9], [9, 6], [3, 10], [10, 0],
			[5, 7], [2, 9], [1, 6], [8, 10],
		];

		const layerElevations = [0.02, 0.12, 0.22, 0.32, 0.42, 0.52];

		connections.forEach(([i, j], traceIndex) => {
			const start = this.nodes[i].position;
			const end = this.nodes[j].position;
			const midX = (start.x + end.x) / 2;
			const midZ = (start.z + end.z) / 2;
			const layerHeight = layerElevations[traceIndex % layerElevations.length];

			const curve = new THREE.CatmullRomCurve3([
				new THREE.Vector3(start.x, start.y + 0.02, start.z),
				new THREE.Vector3(start.x, start.y + layerHeight * 0.5, midZ),
				new THREE.Vector3(midX, start.y + layerHeight, midZ),
				new THREE.Vector3(end.x, start.y + layerHeight * 0.5, end.z),
				new THREE.Vector3(end.x, start.y + 0.02, end.z),
			]);

			const tubeGeometry = new THREE.TubeGeometry(curve, 60, 0.08, 8, false);
			const traceColor = 0xcd7f32;
			const material = new THREE.MeshStandardMaterial({
				color: traceColor,
				emissive: this.nodes[i].userData.color,
				emissiveIntensity: 0.4,
				roughness: 0.3,
				metalness: 0.8,
				transparent: true,
				opacity: 0.85,
			});
			const tube = new THREE.Mesh(tubeGeometry, material);
			tube.userData = { curve, traceColor, layerHeight };
			this.pcbGroup.add(tube);
			this.traces.push(tube);
			this.tracePaths.push({ curve, startColor: this.nodes[i].userData.color, layerHeight });
		});

		const packetGeometry = new THREE.SphereGeometry(0.12, 12, 12);

		connections.forEach(([i, j], traceIndex) => {
			const packetCount = this.isMobile ? 3 : 8;
			const nodeColor = this.nodes[i].userData.color;
			for (let p = 0; p < packetCount; p++) {
				const packetMaterial = new THREE.MeshBasicMaterial({
					color: nodeColor,
					emissive: nodeColor,
					emissiveIntensity: 0.8,
					transparent: true,
					opacity: 0.95,
				});
				const packet = new THREE.Mesh(packetGeometry, packetMaterial);
				const baseSpeed = 0.003 + (traceIndex % 3) * 0.001;
				packet.userData = {
					traceIndex,
					progress: p / packetCount,
					speed: baseSpeed + Math.random() * 0.0015,
				};
				this.pcbGroup.add(packet);
				this.dataPackets.push(packet);
			}
		});

		this.pcbGroup.rotation.x = -Math.PI / 4;
		this.pcbGroup.rotation.y = Math.PI / 8;
		this.pcbGroup.scale.set(1.8, 1.8, 1.8);
		this.pcbGroup.position.set(0, 0, 0);
		this.scene.add(this.pcbGroup);
	}

	createLabelSprite(text, colorHex) {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		canvas.width = 160;
		canvas.height = 40;

		ctx.fillStyle = 'rgba(0, 0, 0, 0)';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.font = 'bold 16px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const hex = '#' + ('000000' + (colorHex & 0xffffff).toString(16)).slice(-6);
		ctx.fillStyle = hex;
		ctx.fillText(text, canvas.width / 2, canvas.height / 2);

		const texture = new THREE.CanvasTexture(canvas);
		const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
		const sprite = new THREE.Sprite(material);
		sprite.scale.set(1.4, 0.35, 1);
		return sprite;
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

		this.targetX += (this.mouseX * 0.5 - this.targetX) * 0.02;
		this.targetY += (this.mouseY * 0.5 - this.targetY) * 0.02;

		if (this.pcbGroup) {
			this.pcbGroup.rotation.y += 0.0003;
			this.pcbGroup.rotation.x += 0.0001;

			this.dataPackets.forEach(packet => {
				packet.userData.progress += packet.userData.speed;
				if (packet.userData.progress > 1) {
					packet.userData.progress = 0;
					const tracePath = this.tracePaths[packet.userData.traceIndex];
					packet.position.copy(tracePath.curve.getPointAt(0));
				}
				const tracePath = this.tracePaths[packet.userData.traceIndex];
				const point = tracePath.curve.getPointAt(packet.userData.progress);
				packet.position.lerp(point, 0.3);

				const scale = 0.8 + Math.sin(packet.userData.progress * Math.PI * 3) * 0.4;
				packet.scale.setScalar(scale);

				const intensity = 0.4 + Math.sin(packet.userData.progress * Math.PI * 4) * 0.3;
				packet.material.emissiveIntensity = intensity;
			});

			this.nodes.forEach((node, i) => {
				const pulse = 0.3 + Math.sin(Date.now() * 0.002 + i * 0.4) * 0.2;
				node.material.emissiveIntensity = pulse;
			});

			this.traces.forEach((trace, i) => {
				const pulse = 0.2 + Math.sin(Date.now() * 0.001 + i * 0.15) * 0.1;
				trace.material.emissiveIntensity = pulse;
			});
		}

		if (this.particles) {
			this.particles.rotation.y += 0.0003;
			this.particles.rotation.x += 0.0001;
		}

		this.camera.position.x = this.targetX * 0.5;
		this.camera.position.y = -this.targetY * 0.5;
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
