import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

interface Traveler {
  curve: THREE.QuadraticBezierCurve3;
  cometGroup: THREE.Group;
  coreMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  trailMeshes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; baseOpacity: number }[];
  progress: number;
  speed: number;
}

interface FeatureArc {
  a: number;
  b: number;
  label: string;
}

/**
 * Globo 3D interativo (WebGL/three.js): wireframe + nós distribuídos (Fibonacci
 * sphere) + arcos de conexão de fundo + 4 arcos de destaque com tooltip ao
 * passar o mouse + "cometas" viajando pelas conexões. Usado como pano de fundo
 * decorativo no login e na landing — puramente visual, não depende de nenhuma
 * API/endpoint do backend.
 */
@Component({
  selector: 'app-globe3d',
  standalone: true,
  template: `
    <canvas #canvas class="globe3d-canvas"></canvas>
    <div #tooltip class="globe3d-tooltip"></div>
  `,
  styleUrls: ['./globe3d.css'],
})
export class Globe3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tooltip', { static: true }) private tooltipRef!: ElementRef<HTMLDivElement>;

  private readonly GLOBE_R = 2.4;
  private readonly NODE_COUNT = 46;
  private readonly FEATURES: FeatureArc[] = [
    { label: 'Disparo em Massa', a: 2, b: 30 },
    { label: 'API Oficial', a: 10, b: 38 },
    { label: 'Chat Ativo', a: 18, b: 5 },
    { label: 'Dashboard Integrada', a: 25, b: 42 },
  ];

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private group?: THREE.Group;

  private nodePositions: THREE.Vector3[] = [];
  private travelers: Traveler[] = [];
  private hitboxes: THREE.Mesh[] = [];
  private fadeMats: THREE.Material[] = [];
  private globeMat!: THREE.LineBasicMaterial;
  private arcMat!: THREE.LineBasicMaterial;
  private equatorMat!: THREE.MeshBasicMaterial;
  private solidMat!: THREE.MeshBasicMaterial;

  private raycaster = new THREE.Raycaster();
  private mouseNDC = new THREE.Vector2(-10, -10);
  private hovered: THREE.Mesh | null = null;
  private lastClientX = 0;
  private lastClientY = 0;

  private targetRotX = 0;
  private targetRotY = 0.4;
  private curRotX = 0;
  private curRotY = 0.4;
  private t = 0;
  private frameId = 0;

  private resizeObserver?: ResizeObserver;
  private pointerMoveHandler = (e: PointerEvent) => this.onPointerMove(e);
  private scrollHandler = () => this.onScroll();
  private visibilityHandler = () => this.handleVisibilityChange();
  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.initScene();
    this.zone.runOutsideAngular(() => {
      this.animate();
      window.addEventListener('pointermove', this.pointerMoveHandler);
      window.addEventListener('scroll', this.scrollHandler, { passive: true });
    });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement ?? this.canvasRef.nativeElement);

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const wrap = canvas.parentElement ?? canvas;
    const width = wrap.clientWidth || 480;
    const height = wrap.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0.4, 9.5);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);

    this.group = new THREE.Group();
    this.group.position.set(-0.4, 0, 0);
    this.scene.add(this.group);

    // Globo sólido sutil + wireframe + linha do equador
    const solidGeo = new THREE.SphereGeometry(this.GLOBE_R * 0.985, 32, 32);
    this.solidMat = new THREE.MeshBasicMaterial({ color: 0x0a1128, transparent: true, opacity: 0.55 });
    this.group.add(new THREE.Mesh(solidGeo, this.solidMat));

    const globeGeo = new THREE.SphereGeometry(this.GLOBE_R, 28, 20);
    const globeWire = new THREE.WireframeGeometry(globeGeo);
    this.globeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
    this.group.add(new THREE.LineSegments(globeWire, this.globeMat));

    const equatorGeo = new THREE.TorusGeometry(this.GLOBE_R, 0.005, 8, 128);
    this.equatorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const equator = new THREE.Mesh(equatorGeo, this.equatorMat);
    equator.rotation.x = Math.PI / 2;
    this.group.add(equator);

    // Nós distribuídos uniformemente na esfera (Fibonacci sphere)
    for (let i = 0; i < this.NODE_COUNT; i++) {
      const phi = Math.acos(-1 + (2 * i) / this.NODE_COUNT);
      const theta = Math.sqrt(this.NODE_COUNT * Math.PI) * phi;
      this.nodePositions.push(new THREE.Vector3(
        this.GLOBE_R * Math.cos(theta) * Math.sin(phi),
        this.GLOBE_R * Math.sin(theta) * Math.sin(phi),
        this.GLOBE_R * Math.cos(phi)
      ));
    }

    const nodeGeo = new THREE.SphereGeometry(0.02, 6, 6);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    this.nodePositions.forEach(p => {
      const dot = new THREE.Mesh(nodeGeo, nodeMat);
      dot.position.copy(p);
      this.group!.add(dot);
    });

    // Conexões de fundo — quanto mais próximas angularmente, maior a chance de ligar
    this.arcMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
    const bgPairs: [number, number][] = [];
    for (let i = 0; i < this.nodePositions.length; i++) {
      for (let j = i + 1; j < this.nodePositions.length; j++) {
        const d = this.nodePositions[i].distanceTo(this.nodePositions[j]);
        if (d < this.GLOBE_R * 1.05 && Math.random() < 0.09) {
          bgPairs.push([i, j]);
        }
      }
    }
    bgPairs.forEach(([i, j]) => this.addArc(i, j, false));

    // Arcos de destaque — revelam um diferencial da plataforma no hover
    this.FEATURES.forEach(f => this.addArc(f.a, f.b, true, f.label));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  }

  private addArc(i: number, j: number, isFeature: boolean, label?: string): void {
    const a = this.nodePositions[i];
    const b = this.nodePositions[j];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(this.GLOBE_R * (1 + a.distanceTo(b) / (this.GLOBE_R * 4.2)));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(36);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);

    let lineMat: THREE.LineBasicMaterial;
    if (isFeature) {
      lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      const tipA = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), tipMat);
      tipA.position.copy(a);
      const tipB = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), tipMat);
      tipB.position.copy(b);
      this.group!.add(tipA, tipB);

      const tubeCurve = new THREE.CatmullRomCurve3(pts);
      const hitGeo = new THREE.TubeGeometry(tubeCurve, 36, 0.14, 6, false);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitbox = new THREE.Mesh(hitGeo, hitMat);
      hitbox.userData['label'] = label;
      hitbox.userData['mat'] = lineMat;
      this.group!.add(hitbox);
      this.hitboxes.push(hitbox);
    } else {
      lineMat = this.arcMat;
    }
    this.group!.add(new THREE.Line(geo, lineMat));

    // "Cometa" viajando ao longo do arco, com rastro de partículas
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), coreMat);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), haloMat);
    const cometGroup = new THREE.Group();
    cometGroup.add(halo, core);
    this.group!.add(cometGroup);

    const TRAIL_LEN = 7;
    const trailMeshes: Traveler['trailMeshes'] = [];
    for (let k = 0; k < TRAIL_LEN; k++) {
      const fade = 1 - k / TRAIL_LEN;
      const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 * fade, blending: THREE.AdditiveBlending, depthWrite: false });
      const trailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.02 * fade, 6, 6), trailMat);
      this.group!.add(trailMesh);
      trailMeshes.push({ mesh: trailMesh, mat: trailMat, baseOpacity: 0.18 * fade });
    }

    this.fadeMats.push(coreMat, haloMat, ...trailMeshes.map(t => t.mat));

    this.travelers.push({
      curve, cometGroup, coreMat, haloMat, trailMeshes,
      progress: Math.random(),
      speed: 0.1 + Math.random() * 0.1,
    });
  }

  private onPointerMove(e: PointerEvent): void {
    const wrap = this.canvasRef.nativeElement.parentElement ?? this.canvasRef.nativeElement;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    this.targetRotY = 0.4 + nx * 0.35;
    this.targetRotX = -ny * 0.2;

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;

    const rect = wrap.getBoundingClientRect();
    this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onScroll(): void {
    if (!this.group) return;
    const scrollT = Math.min(window.scrollY / (window.innerHeight * 0.6), 1);
    this.group.position.y = -scrollT * 0.6;
    this.group.scale.setScalar(1 - scrollT * 0.15);
    const fade = 1 - scrollT * 0.6;
    this.globeMat.opacity = 0.1 * fade;
    this.arcMat.opacity = 0.1 * fade;
    this.equatorMat.opacity = 0.3 * fade;
    this.solidMat.opacity = 0.55 * fade;
    this.travelers.forEach(tr => {
      tr.coreMat.opacity = 0.5 * fade;
      tr.haloMat.opacity = 0.22 * fade;
      tr.trailMeshes.forEach(trail => { trail.mat.opacity = trail.baseOpacity * fade; });
    });
  }

  private updateHover(): void {
    if (!this.camera) return;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const intersects = this.raycaster.intersectObjects(this.hitboxes);
    const tooltip = this.tooltipRef.nativeElement;

    if (intersects.length > 0) {
      const obj = intersects[0].object as THREE.Mesh;
      if (this.hovered !== obj) {
        if (this.hovered) this.resetHover(this.hovered);
        this.hovered = obj;
        (this.hovered.userData['mat'] as THREE.Material & { opacity: number }).opacity = 1;
      }
      tooltip.textContent = this.hovered.userData['label'];
      tooltip.style.left = this.lastClientX + 'px';
      tooltip.style.top = this.lastClientY + 'px';
      tooltip.classList.add('visible');
    } else if (this.hovered) {
      this.resetHover(this.hovered);
      this.hovered = null;
      tooltip.classList.remove('visible');
    }
  }

  private resetHover(obj: THREE.Mesh): void {
    (obj.userData['mat'] as THREE.Material & { opacity: number }).opacity = 0.5;
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);
    if (!this.reduceMotion) {
      this.t += 0.004;
    }

    this.curRotX += (this.targetRotX - this.curRotX) * 0.05;
    this.curRotY += (this.targetRotY - this.curRotY) * 0.05;

    if (this.group) {
      this.group.rotation.x = this.curRotX;
      this.group.rotation.y = this.curRotY + this.t;
    }

    if (!this.reduceMotion) {
      this.travelers.forEach(tr => {
        tr.progress += tr.speed * 0.006;
        if (tr.progress > 1) tr.progress -= 1;

        const p = tr.curve.getPointAt(tr.progress);
        tr.cometGroup.position.copy(p);

        const glow = 0.6 + 0.4 * Math.sin(tr.progress * Math.PI);
        tr.cometGroup.scale.setScalar(0.6 + glow * 0.5);

        tr.trailMeshes.forEach((trail, k) => {
          const trailProgress = Math.max(0, Math.min(1, tr.progress - (k + 1) * 0.012));
          const tp = tr.curve.getPointAt(trailProgress);
          trail.mesh.position.copy(tp);
        });
      });
    }

    this.updateHover();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement ?? canvas;
    const width = parent.clientWidth || 480;
    const height = parent.clientHeight || 480;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      cancelAnimationFrame(this.frameId);
    } else {
      this.zone.runOutsideAngular(() => this.animate());
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('pointermove', this.pointerMoveHandler);
    window.removeEventListener('scroll', this.scrollHandler);

    this.scene?.traverse((obj) => {
      const anyObj = obj as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
      anyObj.geometry?.dispose();
      const material = anyObj.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material?.dispose();
      }
    });

    this.renderer?.dispose();
  }
}
