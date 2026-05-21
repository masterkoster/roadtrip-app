import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';

interface TrackPoint {
  latitude: number;
  longitude: number;
}

interface Photo {
  id: number;
  url: string;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  caption: string | null;
}

interface Participant {
  id: number;
  name: string;
  vehicleType: string;
  colorHex: string;
}

interface Highlight {
  waypointId: number;
}

interface Waypoint {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description: string | null;
}

interface LandmarkPopupMeta {
  emoji: string;
  title: string;
  tagline: string;
  fact: string;
  badge: string;
  image?: string;
  sticker?: string;
  palette: {
    background: string;
    accent: string;
    border: string;
    text: string;
    ribbon: string;
  };
}

interface AnimatedJourneyPlayerProps {
  trackPoints: TrackPoint[];
  waypoints: Waypoint[];
  photos: Photo[];
  participants: Participant[];
  highlights: Highlight[];
  autoPlay?: boolean;
  soundtrackUrl?: string | null;
  onClose: () => void;
}

const EARTH_RADIUS = 6;
const EARTH_TEXTURE_URL = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_BUMP_URL = 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg';
const EARTH_SPEC_URL = 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg';
const APPROACH_DURATION = 4200;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const ensureNormalized = (vector: THREE.Vector3, fallback = new THREE.Vector3(1, 0, 0)): THREE.Vector3 => {
  if (vector.lengthSq() < 1e-6) {
    return fallback.clone().normalize();
  }
  return vector.normalize();
};

const computeSideVector = (normal: THREE.Vector3, tangent: THREE.Vector3): THREE.Vector3 => {
  let side = tangent.clone().cross(normal);
  if (side.lengthSq() < 1e-6) {
    side = new THREE.Vector3(0, 1, 0).cross(normal);
    if (side.lengthSq() < 1e-6) {
      side = new THREE.Vector3(1, 0, 0).cross(normal);
    }
  }
  return side.normalize();
};

const VEHICLE_GLYPHS: Record<string, string> = {
  car: '🚙',
  rv: '🚐',
  motorcycle: '🏍️',
  bike: '🚴',
};

const createVehicleAvatar = (vehicleType: string, colorHex: string, index: number): THREE.Group => {
  const type = VEHICLE_GLYPHS[vehicleType] ? vehicleType : 'car';
  const group = new THREE.Group();
  const baseColor = new THREE.Color(colorHex || '#f97316');
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.35,
    metalness: 0.35,
    emissive: baseColor.clone().multiplyScalar(0.22),
    emissiveIntensity: 0.5,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.85, metalness: 0.15 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: '#0f172a', opacity: 0.75, transparent: true, roughness: 0.25, metalness: 0.05 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: '#fef3c7', transparent: true, opacity: 0.45, side: THREE.DoubleSide });

  const halo = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 28), glowMaterial);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.01;
  group.add(halo);

  if (type === 'rv') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 0.3), bodyMaterial);
    body.position.set(-0.05, 0.22, 0);
    group.add(body);

    const loft = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.28), glassMaterial);
    loft.position.set(-0.12, 0.35, 0);
    group.add(loft);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.28), bodyMaterial);
    cab.position.set(0.36, 0.24, 0);
    group.add(cab);

    [-0.3, 0.08].forEach(xPos => {
      const wheelLeft = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 12, 20), trimMaterial);
      wheelLeft.position.set(xPos, 0.06, 0.16);
      wheelLeft.rotation.y = Math.PI / 2;
      group.add(wheelLeft);
      const wheelRight = wheelLeft.clone();
      wheelRight.position.z = -0.16;
      group.add(wheelRight);
    });
  } else if (type === 'motorcycle') {
    const frame = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.36, 6, 16), bodyMaterial);
    frame.rotation.z = Math.PI / 2;
    frame.position.set(0, 0.23, 0);
    group.add(frame);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.14), bodyMaterial);
    seat.position.set(-0.05, 0.32, 0);
    group.add(seat);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 12), trimMaterial);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.25, 0.32, 0);
    group.add(handle);

    const frontWheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 14, 22), trimMaterial);
    frontWheel.rotation.y = Math.PI / 2;
    frontWheel.position.set(0.3, 0.08, 0);
    group.add(frontWheel);
    const backWheel = frontWheel.clone();
    backWheel.position.x = -0.32;
    group.add(backWheel);
  } else if (type === 'bike') {
    const frameMain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.52, 18), bodyMaterial);
    frameMain.rotation.z = Math.PI / 4;
    frameMain.position.set(-0.02, 0.26, 0);
    group.add(frameMain);

    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 12), bodyMaterial);
    seatPost.rotation.z = Math.PI / 2;
    seatPost.position.set(-0.22, 0.3, 0);
    group.add(seatPost);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 12), trimMaterial);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.24, 0.32, 0);
    group.add(handle);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.08), bodyMaterial);
    seat.position.set(-0.2, 0.34, 0);
    group.add(seat);

    const frontWheel = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 12, 20), trimMaterial);
    frontWheel.rotation.y = Math.PI / 2;
    frontWheel.position.set(0.3, 0.06, 0);
    group.add(frontWheel);
    const backWheel = frontWheel.clone();
    backWheel.position.x = -0.3;
    group.add(backWheel);
  } else {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.26), bodyMaterial);
    chassis.position.set(-0.04, 0.18, 0);
    group.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.22), glassMaterial);
    cabin.position.set(-0.1, 0.3, 0);
    group.add(cabin);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 18), bodyMaterial);
    hood.rotation.z = Math.PI / 2;
    hood.position.set(0.32, 0.18, 0);
    group.add(hood);

    const wheelPositions: Array<[number, number, number]> = [
      [-0.2, 0.05, 0.15],
      [-0.2, 0.05, -0.15],
      [0.2, 0.05, 0.15],
      [0.2, 0.05, -0.15],
    ];
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 12, 24), trimMaterial);
      wheel.position.set(x, y, z);
      wheel.rotation.y = Math.PI / 2;
      group.add(wheel);
    });
  }

  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.16, 12),
    new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#fbbf24', emissiveIntensity: 0.9, roughness: 0.4 })
  );
  beacon.position.set(-0.28, 0.32, 0);
  group.add(beacon);

  const scale = 0.85 + Math.min(index, 4) * 0.05;
  group.scale.setScalar(scale);
  group.rotation.z = Math.PI / 2;

  return group;
};

const LANDMARK_POPUPS: Record<string, LandmarkPopupMeta> = {
  'big ben': {
    emoji: '🕰️',
    title: 'Clocktower Reverie',
    tagline: 'Chimes over the Thames',
    fact: 'Big Ben is the nickname for the great bell that has marked London’s rhythm since 1859.',
    badge: 'Heritage Icon',
    image: 'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=900&q=80',
    sticker: '🇬🇧',
    palette: {
      background: 'linear-gradient(140deg, #0b122c 0%, #1f2d50 55%, #c18a2b 120%)',
      accent: 'rgba(255,198,92,0.55)',
      border: 'rgba(255,230,173,0.32)',
      text: '#f9fafb',
      ribbon: '#facc15',
    },
  },
  'the big bang tower': {
    emoji: '🕰️',
    title: 'Clocktower Reverie',
    tagline: 'Chimes over the Thames',
    fact: 'Big Ben is the nickname for the great bell that has marked London’s rhythm since 1859.',
    badge: 'Heritage Icon',
    image: 'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=900&q=80',
    sticker: '🇬🇧',
    palette: {
      background: 'linear-gradient(140deg, #0b122c 0%, #1f2d50 55%, #c18a2b 120%)',
      accent: 'rgba(255,198,92,0.55)',
      border: 'rgba(255,230,173,0.32)',
      text: '#f9fafb',
      ribbon: '#facc15',
    },
  },
  'eiffel tower': {
    emoji: '🗼',
    title: 'Parisian Skyline',
    tagline: 'Iron lacework at sunset',
    fact: 'The Eiffel Tower can grow more than 15 cm during hot Parisian summers as iron expands.',
    badge: 'City Lights',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80',
    sticker: '✨',
    palette: {
      background: 'linear-gradient(135deg, #280f36 0%, #43275a 55%, #f97316 120%)',
      accent: 'rgba(236,72,153,0.45)',
      border: 'rgba(252,231,243,0.28)',
      text: '#fff5f5',
      ribbon: '#fb7185',
    },
  },
  'statue of liberty': {
    emoji: '🗽',
    title: 'Harbor Beacon',
    tagline: 'Liberty lighting the world',
    fact: 'Lady Liberty arrived from France in 214 crates and was assembled on Bedloe’s Island in 1886.',
    badge: 'Harbor Story',
    image: 'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=900&q=80',
    sticker: '🇺🇸',
    palette: {
      background: 'linear-gradient(145deg, #062b3c 0%, #0d4f68 60%, #34d399 130%)',
      accent: 'rgba(45,212,191,0.45)',
      border: 'rgba(191,242,255,0.28)',
      text: '#f0fdf4',
      ribbon: '#4ade80',
    },
  },
  'grand canyon': {
    emoji: '🧭',
    title: 'Canyon Vista',
    tagline: 'Strata written in sunrise',
    fact: 'The Grand Canyon reveals nearly two billion years of Earth’s geological history in its layers.',
    badge: 'Geology Epic',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    sticker: '🏜️',
    palette: {
      background: 'linear-gradient(140deg, #2a0f12 0%, #6b2f19 55%, #f59e0b 120%)',
      accent: 'rgba(248,113,113,0.45)',
      border: 'rgba(254,215,170,0.32)',
      text: '#fdf6ec',
      ribbon: '#f97316',
    },
  },
};

const FALLBACK_EMOJIS = ['🌄', '🌅', '🏕️', '🏛️', '🎡'];

const getLandmarkPopupMeta = (waypoint: Waypoint, nearbyPhotos: Photo[]): LandmarkPopupMeta => {
  const key = waypoint.name.toLowerCase();
  const base = LANDMARK_POPUPS[key];
  if (base) {
    return { ...base, title: base.title || waypoint.name };
  }

  const photo = nearbyPhotos.find(p => !!(p.thumbnailUrl || p.url));
  const accentColor = '#f97316';
  return {
    emoji: FALLBACK_EMOJIS[Math.floor(Math.random() * FALLBACK_EMOJIS.length)] ?? '📍',
    title: waypoint.name,
    tagline: 'Roadside highlight',
    fact: `Mark this moment at ${waypoint.name}—it is a signature chapter of the journey.`,
    badge: 'Discovery',
    image: photo?.thumbnailUrl || photo?.url,
    palette: {
      background: 'linear-gradient(140deg, #0b1729 0%, #132a45 60%, #f97316 130%)',
      accent: 'rgba(251,191,36,0.5)',
      border: 'rgba(255,255,255,0.18)',
      text: '#f8fafc',
      ribbon: accentColor,
    },
    sticker: '✨',
  };
};

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export default function AnimatedJourneyPlayer({
  trackPoints,
  waypoints,
  photos,
  participants,
  highlights,
  autoPlay = true,
  soundtrackUrl,
  onClose,
}: AnimatedJourneyPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const globeRef = useRef<THREE.Mesh>();
  const participantMeshes = useRef<THREE.Object3D[]>([]);
  const [progress, setProgress] = useState(0);
  const renderLoopRef = useRef<number>();
  const progressLoopRef = useRef<number>();
  const phaseRef = useRef<'overview' | 'approach' | 'journey'>('overview');
  const overviewAngleRef = useRef(0);
  const pauseUntilRef = useRef<number | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const pausedTotalRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const highlightObjectsRef = useRef<Record<number, THREE.Object3D>>({});
  const highlightTexturesRef = useRef<Record<number, THREE.Texture>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [popup, setPopup] = useState<{ waypoint: Waypoint; meta: LandmarkPopupMeta } | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHighlightRef = useRef<number | null>(null);
  const approachStartRef = useRef<number | null>(null);
  const approachFromRef = useRef<THREE.Vector3 | null>(null);
  const [introStage, setIntroStage] = useState<'orbit' | 'approach' | 'hidden'>('orbit');

  const pathPoints = useMemo(() => {
    if (trackPoints.length > 1) return trackPoints;
    if (waypoints.length > 0) {
      return waypoints.map(w => ({ latitude: w.latitude, longitude: w.longitude }));
    }
    return [] as TrackPoint[];
  }, [trackPoints, waypoints]);

  const routeVectors = useMemo(() => {
    if (!pathPoints.length) return [] as THREE.Vector3[];
    return pathPoints.map(tp => latLonToVector3(tp.latitude, tp.longitude, EARTH_RADIUS + 0.05));
  }, [pathPoints]);

  useEffect(() => {
    setProgress(0);
    pausedTotalRef.current = 0;
    pauseUntilRef.current = null;
    pauseStartRef.current = null;
    startRef.current = null;
    phaseRef.current = 'overview';
    approachStartRef.current = null;
    approachFromRef.current = null;
    setIntroStage(routeVectors.length > 1 ? 'orbit' : 'hidden');
  }, [pathPoints.length, highlights.length, routeVectors.length]);

  useEffect(() => {
    if (routeVectors.length < 2) {
      phaseRef.current = 'journey';
      setIntroStage('hidden');
      return;
    }
    const timer = setTimeout(() => {
      phaseRef.current = 'approach';
      approachStartRef.current = null;
      approachFromRef.current = null;
      setIntroStage('approach');
    }, 2600);
    return () => clearTimeout(timer);
  }, [routeVectors.length]);

  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 2000);
    camera.position.set(0, EARTH_RADIUS * 0.75, EARTH_RADIUS * 2.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x040a1a, 1);
    containerRef.current.appendChild(renderer.domElement);
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

    const globeGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: earthBump,
      bumpScale: 0.15,
      specularMap: earthSpec,
      specular: new THREE.Color(0x333333),
      shininess: 12,
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    globeRef.current = globe;

    const starGeometry = new THREE.BufferGeometry();
    const starVertices = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const radius = 80 + Math.random() * 40;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      starVertices[i * 3] = x;
      starVertices[i * 3 + 1] = y;
      starVertices[i * 3 + 2] = z;
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0.65 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    if (routeVectors.length > 1) {
      const routeGeometry = new THREE.BufferGeometry().setFromPoints(routeVectors);
      const routeMaterial = new THREE.LineBasicMaterial({ color: 0xffd95a, transparent: true, opacity: 0.9, linewidth: 4 });
      const routeLine = new THREE.Line(routeGeometry, routeMaterial);
      scene.add(routeLine);
    }

    participantMeshes.current = participants.map((p, idx) => {
      const avatar = createVehicleAvatar(p.vehicleType, p.colorHex, idx);
      scene.add(avatar);
      return avatar;
    });

    Object.values(highlightTexturesRef.current).forEach(tex => tex.dispose());
    highlightTexturesRef.current = {};
    Object.values(highlightObjectsRef.current).forEach(obj => scene.remove(obj));
    highlightObjectsRef.current = {};

    if (highlights.length && waypoints.length) {
      highlights.forEach(h => {
        const wp = waypoints.find(w => w.id === h.waypointId);
        if (!wp) return;
        const tex = createLabelTexture(wp.name, h.waypointId);
        const planeGeom = new THREE.PlaneGeometry(0.9, 0.5);
        const planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(planeGeom, planeMat);
        const holder = new THREE.Group();
        holder.add(plane);
        const base = latLonToVector3(wp.latitude, wp.longitude, EARTH_RADIUS + 0.4);
        holder.position.copy(base);
        plane.position.set(0, 0, 0);
        holder.scale.set(0.2, 0.2, 0.2);
        scene.add(holder);
        highlightObjectsRef.current[h.waypointId] = holder;
      });
    }

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', onResize);

    const animate = (timestamp: number) => {
      renderLoopRef.current = requestAnimationFrame(animate);

      if (!cameraRef.current) return;

      const camera = cameraRef.current;

      if (phaseRef.current === 'overview' || routeVectors.length < 2) {
        overviewAngleRef.current += 0.0007;
        const radius = EARTH_RADIUS * 3.1;
        const angle = overviewAngleRef.current;
        const height = EARTH_RADIUS * 0.6 + Math.sin(angle * 0.6) * EARTH_RADIUS * 0.5;
        const desired = new THREE.Vector3(
          radius * Math.cos(angle),
          height,
          radius * Math.sin(angle)
        );
        camera.position.lerp(desired, 0.02);
        camera.up.lerp(new THREE.Vector3(0, 1, 0), 0.05);
        camera.lookAt(0, 0, 0);
      } else if (phaseRef.current === 'approach') {
        if (routeVectors.length) {
          const firstPoint = routeVectors[0];
          const nextPoint = routeVectors[1] ?? firstPoint;
          if (approachStartRef.current == null) {
            approachStartRef.current = timestamp;
            approachFromRef.current = camera.position.clone();
          }
          const elapsed = Math.min(Math.max((timestamp - (approachStartRef.current ?? timestamp)) / APPROACH_DURATION, 0), 1);
          const eased = easeInOutCubic(elapsed);
          const normal = firstPoint.clone().normalize();
          const fallbackAxis = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
          const tangent = ensureNormalized(nextPoint.clone().sub(firstPoint), fallbackAxis);
          const side = computeSideVector(normal, tangent);
          const from = approachFromRef.current ?? normal.clone().multiplyScalar(EARTH_RADIUS * 3.6);
          const to = firstPoint.clone()
            .add(normal.clone().multiplyScalar(1.25))
            .add(side.multiplyScalar(0.9));
          const position = from.clone().lerp(to, eased);
          camera.position.copy(position);
          camera.up.lerp(normal, 0.12);
          const focus = firstPoint.clone()
            .add(tangent.clone().multiplyScalar(0.6 * (1 - eased)))
            .add(normal.clone().multiplyScalar(0.25));
          camera.lookAt(focus);
          if (elapsed >= 1) {
            phaseRef.current = 'journey';
            setIntroStage(prev => (prev === 'hidden' ? prev : 'hidden'));
            startRef.current = null;
            pausedTotalRef.current = 0;
            pauseUntilRef.current = null;
            pauseStartRef.current = null;
            approachStartRef.current = null;
            approachFromRef.current = null;
          }
        }
      } else {
        const idx = Math.min(Math.floor(progress * (routeVectors.length - 1)), routeVectors.length - 1);
        const point = routeVectors[idx];
        if (point) {
          const normal = point.clone().normalize();
          const nextIdx = Math.min(idx + 1, routeVectors.length - 1);
          const nextPoint = routeVectors[nextIdx] ?? point;
          const fallbackAxis = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
          const tangent = ensureNormalized(nextPoint.clone().sub(point), fallbackAxis);
          const side = computeSideVector(normal, tangent);
          const desired = point.clone()
            .add(normal.clone().multiplyScalar(1.7))
            .add(side.multiplyScalar(0.6));
          camera.position.lerp(desired, 0.08);
          const lookTarget = point.clone().add(tangent.clone().multiplyScalar(0.8));
          camera.up.lerp(normal, 0.1);
          camera.lookAt(lookTarget);
        }
      }

      if (globeRef.current) globeRef.current.rotation.y += 0.0004;
      Object.values(highlightObjectsRef.current).forEach(obj => {
        if (!cameraRef.current) return;
        obj.lookAt(camera.position);
      });
      renderer.render(scene, camera);
    };

    renderLoopRef.current = requestAnimationFrame(animate);

    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      window.removeEventListener('resize', onResize);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
      if (progressLoopRef.current) cancelAnimationFrame(progressLoopRef.current);
      scene.clear();
      participantMeshes.current = [];
      Object.values(highlightTexturesRef.current).forEach(tex => tex.dispose());
      highlightTexturesRef.current = {};
      highlightObjectsRef.current = {};
      rendererRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeVectors, participants, highlights, waypoints]);

  const highlightIndices = useMemo(() => {
    const indices: Record<number, number> = {};
    if (!pathPoints.length) return indices;
    highlights.forEach(h => {
      const wp = waypoints.find(w => w.id === h.waypointId);
      if (!wp) return;
      let bestIdx = 0;
      let bestDist = Number.MAX_VALUE;
      pathPoints.forEach((pt, idx) => {
        const dlat = pt.latitude - wp.latitude;
        const dlng = pt.longitude - wp.longitude;
        const dist = dlat * dlat + dlng * dlng;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });
      indices[h.waypointId] = bestIdx;
    });
    return indices;
  }, [highlights, pathPoints, waypoints]);

  useEffect(() => {
    if (!routeVectors.length || !participantMeshes.current.length) return;
    const count = routeVectors.length;
    const updatePositions = () => {
      const idx = Math.min(Math.floor(progress * (count - 1)), count - 1);
      const nextIdx = Math.min(idx + 1, count - 1);
      const basePoint = routeVectors[idx];
      const nextPoint = routeVectors[nextIdx] ?? basePoint;
      const normal = basePoint.clone().normalize();
      const fallbackAxis = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const tangent = ensureNormalized(nextPoint.clone().sub(basePoint), fallbackAxis);
      participantMeshes.current.forEach((mesh, participantIdx) => {
        const offset = normal.clone().multiplyScalar(EARTH_RADIUS + 0.25 + participantIdx * 0.12);
        const side = computeSideVector(normal, tangent).multiplyScalar(participantIdx * 0.18);
        const forward = tangent.clone().multiplyScalar(participantIdx === 0 ? 0.0 : participantIdx * 0.25);
        const desired = offset.add(side).add(forward);
        mesh.position.lerp(desired, 0.35);
        const lookTarget = desired.clone().add(tangent);
        mesh.lookAt(lookTarget);
      });
    };
    updatePositions();
  }, [progress, routeVectors]);

  useEffect(() => {
    if (!routeVectors.length || !Object.keys(highlightObjectsRef.current).length) return;
    const count = routeVectors.length;
    const idx = Math.min(Math.floor(progress * (count - 1)), count - 1);
    Object.entries(highlightObjectsRef.current).forEach(([idStr, obj]) => {
      const id = Number(idStr);
      const targetIdx = highlightIndices[id];
      if (targetIdx == null) {
        obj.visible = false;
        return;
      }
      const pathIdx = Math.min(targetIdx, routeVectors.length - 1);
      const base = routeVectors[pathIdx];
      const normal = base.clone().normalize();
      obj.position.copy(base.clone().add(normal.clone().multiplyScalar(0.4)));
      if (cameraRef.current) {
        obj.lookAt(cameraRef.current.position);
      }
      const diff = Math.abs(idx - pathIdx);
      const scale = diff < 3 ? 1 : diff < 8 ? 0.5 : 0.2;
      obj.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.2);
      obj.visible = true;
    });
  }, [progress, routeVectors, highlightIndices]);

  useEffect(() => {
    if (!autoPlay || routeVectors.length < 2) {
      setProgress(0);
      return;
    }
    const duration = Math.max(15000, routeVectors.length * 450);
    const step = (timestamp: number) => {
      if (phaseRef.current !== 'journey') {
        startRef.current = null;
        progressLoopRef.current = requestAnimationFrame(step);
        return;
      }
      if (!startRef.current) startRef.current = timestamp;
      if (pauseUntilRef.current && timestamp < pauseUntilRef.current) {
        progressLoopRef.current = requestAnimationFrame(step);
        return;
      }
      if (pauseUntilRef.current && timestamp >= pauseUntilRef.current) {
        if (pauseStartRef.current != null) {
          pausedTotalRef.current += pauseUntilRef.current - pauseStartRef.current;
        }
        pauseUntilRef.current = null;
        pauseStartRef.current = null;
      }
      const elapsed = timestamp - (startRef.current ?? timestamp) - pausedTotalRef.current;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);
      if (pct < 1) {
        progressLoopRef.current = requestAnimationFrame(step);
      }
    };
    progressLoopRef.current = requestAnimationFrame(step);
    return () => {
      if (progressLoopRef.current) cancelAnimationFrame(progressLoopRef.current);
      startRef.current = null;
    };
  }, [autoPlay, routeVectors.length]);

  useEffect(() => {
    if (!soundtrackUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      audioRef.current.volume = 0.35;
    }
    audioRef.current.src = soundtrackUrl;
    audioRef.current.play().catch(() => {});
    return () => {
      audioRef.current?.pause();
    };
  }, [soundtrackUrl]);

  const currentWaypoint = useMemo(() => {
    if (!pathPoints.length || !waypoints.length) return null;
    const idx = Math.min(Math.floor(progress * (pathPoints.length - 1)), pathPoints.length - 1);
    const tp = pathPoints[idx];
    if (!tp) return null;
    let nearest = waypoints[0];
    let best = Number.MAX_VALUE;
    waypoints.forEach(w => {
      const dlat = w.latitude - tp.latitude;
      const dlng = w.longitude - tp.longitude;
      const dist = dlat * dlat + dlng * dlng;
      if (dist < best) {
        best = dist;
        nearest = w;
      }
    });
    return nearest;
  }, [progress, pathPoints, waypoints]);

  const waypointPhotos = useMemo(() => {
    if (!currentWaypoint) return [] as Photo[];
    return photos.filter(p => {
      if (p.latitude == null || p.longitude == null) return false;
      const dlat = p.latitude - currentWaypoint.latitude;
      const dlng = p.longitude - currentWaypoint.longitude;
      return Math.sqrt(dlat * dlat + dlng * dlng) < 1;
    }).slice(0, 4);
  }, [currentWaypoint, photos]);

  const mapPreviewUrl = useMemo(() => {
    if (!currentWaypoint) return null;
    const lat = currentWaypoint.latitude.toFixed(5);
    const lon = currentWaypoint.longitude.toFixed(5);
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=10&size=320x180&maptype=mapnik&markers=${lat},${lon},lightblue`;
  }, [currentWaypoint]);

const createLabelTexture = (title: string, waypointId: number): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, canvas.width, 24);
  ctx.fillStyle = '#7c3aed';
  ctx.font = 'bold 48px Playfair Display, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  highlightTexturesRef.current && (highlightTexturesRef.current[waypointId] = texture);
  return texture;
};

  useEffect(() => {
    if (progress > 0.02 && routeVectors.length > 1) {
      phaseRef.current = 'journey';
    }
  }, [progress, routeVectors.length]);

  useEffect(() => {
    if (!currentWaypoint) return;
    const highlightIds = new Set(highlights.map(h => h.waypointId));
    if (highlightIds.has(currentWaypoint.id) && lastHighlightRef.current !== currentWaypoint.id) {
      lastHighlightRef.current = currentWaypoint.id;
      const meta = getLandmarkPopupMeta(currentWaypoint, waypointPhotos);
      setPopup({ waypoint: currentWaypoint, meta });
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => setPopup(null), 5200);
      const now = performance.now();
      pauseStartRef.current = now;
      pauseUntilRef.current = now + 4500;
      phaseRef.current = 'journey';
    }
  }, [currentWaypoint, highlights, waypointPhotos]);

  useEffect(() => () => {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
  }, []);

  const heroImage = popup?.meta.image ?? null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col text-white">
      <div className="absolute inset-0" ref={containerRef} />
      {introStage !== 'hidden' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-center px-6 py-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          <div className="text-[11px] uppercase tracking-[0.5em] text-white/50 mb-2">
            {introStage === 'orbit' ? 'Global Overview' : 'Approach Vector'}
          </div>
          <div className="text-2xl font-semibold text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
            {introStage === 'orbit' ? 'Charting Your Journey' : 'Diving Toward The Route'}
          </div>
        </div>
      )}
      {popup && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[420px] max-w-[90vw] z-[65]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          <div
            className="relative rounded-[28px] overflow-hidden border shadow-[0_24px_46px_rgba(6,11,34,0.55)]"
            style={{
              background: popup.meta.palette.background,
              borderColor: popup.meta.palette.border,
            }}
          >
            <div
              className="absolute inset-0 opacity-65"
              style={heroImage ? {
                backgroundImage: `url(${heroImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'saturate(1.2)',
              } : {
                background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.18), transparent 55%)',
              }}
            />
            <div className="absolute -left-14 top-10 w-40 h-40 rounded-full blur-3xl" style={{ background: popup.meta.palette.accent }} />
            <div className="absolute -right-12 bottom-0 w-32 h-32 rounded-full blur-3xl opacity-60" style={{ background: popup.meta.palette.accent }} />
            <div className="relative px-6 pt-6 pb-7 space-y-4 backdrop-blur-[2px]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-4xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]">{popup.meta.emoji}</span>
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.4em] bg-white/15 text-white/80 border border-white/20" style={{ color: popup.meta.palette.text }}>
                      {popup.meta.badge}
                    </div>
                    <h3 className="text-2xl font-semibold mt-2 leading-tight" style={{ color: popup.meta.palette.text }}>
                      {popup.meta.title || popup.waypoint.name}
                    </h3>
                    <div className="text-[11px] uppercase tracking-[0.35em] text-white/70 mt-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {popup.meta.tagline}
                    </div>
                  </div>
                </div>
                {popup.meta.sticker && (
                  <div className="text-lg px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white shadow-lg">
                    {popup.meta.sticker}
                  </div>
                )}
              </div>
              <div className="bg-black/25 border border-white/15 rounded-[20px] px-5 py-4 shadow-inner" style={{ color: popup.meta.palette.text }}>
                <p className="text-sm leading-relaxed text-white/90" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{popup.meta.fact}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span>{popup.waypoint.name}</span>
                  <span>{popup.waypoint.latitude.toFixed(2)}° / {popup.waypoint.longitude.toFixed(2)}°</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl" style={{ fontFamily: 'system-ui, sans-serif' }}>
        {participants.length ? (
          participants.map(p => {
            const glyph = VEHICLE_GLYPHS[p.vehicleType] || '🚙';
            return (
              <div key={p.id} className="flex items-center gap-2">
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-full text-base shadow-lg"
                  style={{ background: `${p.colorHex || '#fb7185'}33`, border: `1px solid ${p.colorHex || '#fb7185'}` }}
                >
                  {glyph}
                </span>
                <span className="text-xs text-white/80 font-medium">{p.name}</span>
              </div>
            );
          })
        ) : (
          <span className="text-xs text-white/70">Solo Traveler</span>
        )}
      </div>
      {currentWaypoint && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 text-gray-800 rounded-2xl shadow-xl border border-amber-100 overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="px-5 pt-4 pb-3">
            <div className="text-[11px] uppercase tracking-[0.3em] text-amber-600/60 mb-1">Stop</div>
            <h2 className="text-xl font-bold text-gray-900">{currentWaypoint.name}</h2>
            {currentWaypoint.description && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{currentWaypoint.description}</p>
            )}
          </div>
          {mapPreviewUrl && (
            <div className="px-5">
              <div className="overflow-hidden rounded-xl border border-amber-100/60 shadow-sm">
                <img src={mapPreviewUrl} alt="Map preview" className="w-full h-40 object-cover" />
              </div>
            </div>
          )}
          {waypointPhotos.length > 0 && (
            <div className="flex gap-2 px-5 pb-4 overflow-x-auto">
              {waypointPhotos.map(photo => (
                <img key={photo.id} src={photo.thumbnailUrl || photo.url} alt={photo.caption || ''}
                  className="w-24 h-20 object-cover rounded-xl border border-white shadow-sm" />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/60">Progress</div>
        <div className="w-48 h-[6px] bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400" style={{ width: `${progress * 100}%` }} />
        </div>
        <button onClick={onClose} className="px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}
