import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface TrackPoint {
  latitude: number;
  longitude: number;
}

interface Waypoint {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  orderIndex: number;
}

interface GlobeViewProps {
  trackPoints: TrackPoint[];
  waypoints: Waypoint[];
  currentWaypointId: number;
  className?: string;
}

const EARTH_RADIUS = 6;
const EARTH_TEXTURE_URL = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_BUMP_URL = 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg';
const EARTH_SPEC_URL = 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg';
const ROUTE_ALTITUDE = 0.08;

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function smoothPoints(points: THREE.Vector3[], samples: number): THREE.Vector3[] {
  if (points.length < 2) return points;
  const catmull = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  return catmull.getPoints(samples);
}

export default function GlobeView({ trackPoints, waypoints, currentWaypointId, className }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const animFrameRef = useRef<number>(0);
  const markersRef = useRef<THREE.Object3D[]>([]);
  const routeObjectsRef = useRef<THREE.Object3D[]>([]);

  const orderedWaypoints = [...waypoints].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentWaypoint = waypoints.find(w => w.id === currentWaypointId);
  const currentIdx = orderedWaypoints.findIndex(w => w.id === currentWaypointId);

  const routeVectors = trackPoints.length > 1
    ? trackPoints.map(tp => latLonToVector3(tp.latitude, tp.longitude, EARTH_RADIUS + ROUTE_ALTITUDE))
    : waypoints.map(w => latLonToVector3(w.latitude, w.longitude, EARTH_RADIUS + ROUTE_ALTITUDE));

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, EARTH_RADIUS * 0.8, EARTH_RADIUS * 2.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x040a1a, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.position.set(5, 8, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x89b4ff, 0.3);
    fillLight.position.set(-6, -4, -2);
    scene.add(fillLight);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const earthTexture = textureLoader.load(EARTH_TEXTURE_URL);
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    const earthBump = textureLoader.load(EARTH_BUMP_URL);
    const earthSpec = textureLoader.load(EARTH_SPEC_URL);

    const globeGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 72, 72);
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: 0x2a4a7f,
      emissive: 0x05122a,
      emissiveIntensity: 0.3,
      map: earthTexture,
      bumpMap: earthBump,
      bumpScale: 0.1,
      specularMap: earthSpec,
      specular: new THREE.Color(0x444466),
      shininess: 15,
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    globeRef.current = globe;

    const starCount = 1200;
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 80 + Math.random() * 40;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      starVertices[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starVertices[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starVertices[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.6 }));
    scene.add(stars);

    const animate = (timestamp: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (globeRef.current) globeRef.current.rotation.y += 0.0003;
      if (cameraRef.current && rendererRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);

    const onResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      globeRef.current = null;
      markersRef.current = [];
      routeObjectsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    routeObjectsRef.current.forEach(obj => scene.remove(obj));
    routeObjectsRef.current = [];
    markersRef.current.forEach(m => scene.remove(m));
    markersRef.current = [];

    if (routeVectors.length < 2) return;

    const smoothCount = Math.min(routeVectors.length * 3, 600);
    const smoothRoute = smoothPoints(routeVectors, smoothCount);

    const segCount = Math.max(1, orderedWaypoints.length - 1);
    const ptsPerSeg = Math.max(1, Math.floor(smoothRoute.length / segCount));
    const visibleCount = currentIdx >= 0 ? Math.min((currentIdx + 1) * ptsPerSeg, smoothRoute.length) : smoothRoute.length;

    const visible = smoothRoute.slice(0, visibleCount);
    const future = smoothRoute.slice(visibleCount);

    if (visible.length > 1) {
      const coreGeom = new THREE.BufferGeometry().setFromPoints(visible);
      const coreMat = new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.95,
      });
      const coreLine = new THREE.Line(coreGeom, coreMat);
      scene.add(coreLine);
      routeObjectsRef.current.push(coreLine);

      const midGeom = new THREE.BufferGeometry().setFromPoints(visible);
      const midMat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.4,
      });
      const midLine = new THREE.Line(midGeom, midMat);
      scene.add(midLine);
      routeObjectsRef.current.push(midLine);

      const glowGeom = new THREE.BufferGeometry().setFromPoints(visible);
      const glowMat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.12,
      });
      const glowLine = new THREE.Line(glowGeom, glowMat);
      scene.add(glowLine);
      routeObjectsRef.current.push(glowLine);

      if (visible.length > 10) {
        const trailLen = Math.min(30, visible.length);
        const trailPts = visible.slice(visible.length - trailLen);
        const trailGeom = new THREE.BufferGeometry().setFromPoints(trailPts);
        const trailMat = new THREE.LineBasicMaterial({
          color: 0xffd966,
          transparent: true,
          opacity: 0.6,
        });
        const trailLine = new THREE.Line(trailGeom, trailMat);
        scene.add(trailLine);
        routeObjectsRef.current.push(trailLine);
      }
    }

    if (future.length > 1) {
      const futureGeom = new THREE.BufferGeometry().setFromPoints(future);
      const futureMat = new THREE.LineDashedMaterial({
        color: 0x9ca3af,
        dashSize: 0.12,
        gapSize: 0.15,
        transparent: true,
        opacity: 0.4,
      });
      const futureLine = new THREE.Line(futureGeom, futureMat);
      futureLine.computeLineDistances();
      scene.add(futureLine);
      routeObjectsRef.current.push(futureLine);

      const futureGlowGeom = new THREE.BufferGeometry().setFromPoints(future);
      const futureGlowMat = new THREE.LineDashedMaterial({
        color: 0x6b7280,
        dashSize: 0.12,
        gapSize: 0.15,
        transparent: true,
        opacity: 0.1,
      });
      const futureGlowLine = new THREE.Line(futureGlowGeom, futureGlowMat);
      futureGlowLine.computeLineDistances();
      scene.add(futureGlowLine);
      routeObjectsRef.current.push(futureGlowLine);
    }

    const wpPositions = orderedWaypoints.map(w =>
      latLonToVector3(w.latitude, w.longitude, EARTH_RADIUS + 0.1)
    );

    if (orderedWaypoints.length > 2 && visible.length > 1) {
      const arcMat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.15,
      });

      for (let i = 0; i < orderedWaypoints.length - 1; i++) {
        const a = wpPositions[i];
        const b = wpPositions[i + 1];
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.normalize().multiplyScalar(EARTH_RADIUS + 0.6);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const pts = curve.getPoints(24);
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geom, arcMat);
        scene.add(line);
        routeObjectsRef.current.push(line);
      }
    }

    orderedWaypoints.forEach((wp, i) => {
      const pos = latLonToVector3(wp.latitude, wp.longitude, EARTH_RADIUS + 0.1);
      const isCurrent = wp.id === currentWaypointId;
      const isPast = wp.orderIndex < (currentWaypoint?.orderIndex ?? 0);

      const group = new THREE.Group();
      if (isCurrent) {
        const pulseGeom = new THREE.RingGeometry(0.2, 0.45, 32);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        const pulse = new THREE.Mesh(pulseGeom, pulseMat);
        pulse.position.copy(pos);
        pulse.lookAt(0, 0, 0);
        scene.add(pulse);
        markersRef.current.push(pulse);

        const markerGeom = new THREE.SphereGeometry(0.22, 20, 20);
        const markerMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xfbbf24,
          emissiveIntensity: 0.5,
        });
        const marker = new THREE.Mesh(markerGeom, markerMat);
        marker.position.copy(pos);
        scene.add(marker);
        markersRef.current.push(marker);

        const glowGeom = new THREE.SphereGeometry(0.4, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.12,
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.position.copy(pos);
        scene.add(glow);
        markersRef.current.push(glow);
      } else {
        const color = isPast ? 0xf59e0b : 0x6b7280;
        const size = isPast ? 0.14 : 0.09;
        const intensity = isPast ? 0.2 : 0.05;
        const markerGeom = new THREE.SphereGeometry(size, 16, 16);
        const markerMat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: intensity,
        });
        const marker = new THREE.Mesh(markerGeom, markerMat);
        marker.position.copy(pos);
        scene.add(marker);
        markersRef.current.push(marker);
      }
    });
  }, [currentWaypointId, trackPoints.length, waypoints.length]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera || !currentWaypoint) return;
    const target = latLonToVector3(currentWaypoint.latitude, currentWaypoint.longitude, EARTH_RADIUS);
    const normal = target.clone().normalize();
    const camPos = target.clone().add(normal.clone().multiplyScalar(2.0));
    camera.position.copy(camPos);
    camera.up.copy(normal);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [currentWaypoint]);

  return <div ref={containerRef} className={className} />;
}
