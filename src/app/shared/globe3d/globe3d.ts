import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

/**
 * Globo 3D decorativo (WebGL/three.js) usado como pano de fundo animado
 * enquanto o sistema estiver online. Puramente visual — não depende de
 * nenhuma API/endpoint do backend.
 */
@Component({
  selector: 'app-globe3d',
  standalone: true,
  template: `<canvas #canvas class="globe3d-canvas"></canvas>`,
  styleUrls: ['./globe3d.css'],
})
export class Globe3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private globeGroup?: THREE.Group;
  private frameId = 0;
  private resizeObserver?: ResizeObserver;
  private visibilityHandler = () => this.handleVisibilityChange();
  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit(): void {
    this.initScene();
    this.zone.runOutsideAngular(() => this.animate());

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement ?? this.canvasRef.nativeElement);

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  constructor(private zone: NgZone) {}

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const { clientWidth, clientHeight } = canvas.parentElement ?? canvas;
    const width = clientWidth || 480;
    const height = clientHeight || 480;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 6.4);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);

    this.globeGroup = new THREE.Group();
    this.globeGroup.rotation.x = 0.28;
    this.scene.add(this.globeGroup);

    this.globeGroup.add(this.buildDotSphere());
    this.globeGroup.add(this.buildWireSphere());
    this.globeGroup.add(...this.buildConnectionArcs());
    this.scene.add(this.buildAtmosphere());
  }

  /** Nuvem de pontos distribuída em esfera (padrão Fibonacci) simulando a "malha" do globo. */
  private buildDotSphere(): THREE.Points {
    const radius = 2.15;
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorA = new THREE.Color('#4FA8FF');
    const colorB = new THREE.Color('#00E676');
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      positions[i * 3] = x * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = z * radius;

      const mixed = colorA.clone().lerp(colorB, Math.random() * 0.6);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Points(geometry, material);
  }

  /** Malha de linhas (meridianos/paralelos) para reforçar a leitura de "globo". */
  private buildWireSphere(): THREE.LineSegments {
    const geometry = new THREE.SphereGeometry(2.16, 24, 16);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color('#4FA8FF'),
      transparent: true,
      opacity: 0.08,
    });
    return new THREE.LineSegments(wireframe, material);
  }

  /** Arcos curvos ligando pontos da superfície — remete às conexões/mensagens da plataforma. */
  private buildConnectionArcs(): THREE.Line[] {
    const radius = 2.15;
    const arcs: THREE.Line[] = [];
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color('#00E676'),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });

    const randomPointOnSphere = () => {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
    };

    for (let i = 0; i < 6; i++) {
      const start = randomPointOnSphere();
      const end = randomPointOnSphere();
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(radius * 1.35);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(48);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      arcs.push(new THREE.Line(geometry, material));
    }

    return arcs;
  }

  /** Brilho externo sutil (efeito atmosfera) usando o verso de uma esfera translúcida. */
  private buildAtmosphere(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(2.32, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#4FA8FF'),
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    return new THREE.Mesh(geometry, material);
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);

    if (this.globeGroup && !this.reduceMotion) {
      this.globeGroup.rotation.y += 0.0022;
    }

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

    this.scene?.traverse((obj) => {
      if (obj instanceof THREE.Points || obj instanceof THREE.Line || obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose();
        const material = obj.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material?.dispose();
        }
      }
    });

    this.renderer?.dispose();
  }
}
