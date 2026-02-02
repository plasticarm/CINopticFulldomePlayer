
import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sphere, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Standard HTML tags (div, button, etc.) are provided by React's global types.
// Three.js intrinsic elements are provided by @react-three/fiber.

interface SceneProps {
  videoElement: HTMLVideoElement | null;
  isPlaying: boolean;
  hasVideo: boolean;
  isMotionEnabled: boolean;
  domeTilt: number;
  projectionMode: 'dome' | 'flat';
  resetTrigger: number;
}

// Shader for the pleasing dark gradient when no video is playing
const DomeGradientShader = {
  uniforms: {
    colorTop: { value: new THREE.Color('#1e293b') }, // Slate 800 (Zenith)
    colorBottom: { value: new THREE.Color('#020617') }  // Slate 950 (Horizon)
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 colorTop;
    uniform vec3 colorBottom;
    varying vec2 vUv;
    void main() {
      // Dome UVs map center (0.5, 0.5) to zenith. 
      // Calculate distance from center to determine gradient mix.
      float dist = distance(vUv, vec2(0.5));
      // smoothstep for a softer falloff, roughly 0.0 at center to 0.5 at edge
      float mixVal = smoothstep(0.0, 0.6, dist);
      vec3 color = mix(colorTop, colorBottom, mixVal);
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const DomeProjection: React.FC<{ videoElement: HTMLVideoElement | null, tilt: number, hasVideo: boolean }> = ({ videoElement, tilt, hasVideo }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  useLayoutEffect(() => {
    if (meshRef.current) {
      const geometry = meshRef.current.geometry;
      const uvAttribute = geometry.attributes.uv;
      const posAttribute = geometry.attributes.position;
      
      const vec = new THREE.Vector3();
      for (let i = 0; i < posAttribute.count; i++) {
        vec.fromBufferAttribute(posAttribute, i);
        vec.normalize();
        
        const theta = Math.acos(vec.y);
        
        // Use (-z, -x) to correctly orient and apply horizontal flip:
        // 1. Front (-Z) maps to Top of texture (North)
        // 2. We negate X to flip the texture horizontally across the Y-axis.
        const phi = Math.atan2(vec.z, vec.x); 
        
        const r = theta / Math.PI; 
        
        const u = 0.5 + r * Math.cos(phi);
        const v = 0.5 + r * Math.sin(phi);
        
        uvAttribute.setXY(i, u, v);
      }
      uvAttribute.needsUpdate = true;
    }
  }, []);

  return (
    <group rotation={[THREE.MathUtils.degToRad(tilt), 0, 0]}>
      <Sphere 
        ref={meshRef} 
        args={[100, 128, 128, 0, Math.PI * 2, 0, Math.PI / 2]} 
        rotation={[0, 0, 0]}
        position={[0, 0, 0]}
      >
        {hasVideo && videoElement ? (
          <meshBasicMaterial side={THREE.BackSide}>
             {/* @ts-ignore */}
             <videoTexture attach="map" args={[videoElement]} colorSpace={THREE.SRGBColorSpace} minFilter={THREE.LinearFilter} magFilter={THREE.LinearFilter} />
          </meshBasicMaterial>
        ) : (
          <shaderMaterial 
            side={THREE.BackSide}
            args={[DomeGradientShader]}
            transparent={false}
          />
        )}
      </Sphere>
    </group>
  );
};

const FlatProjection: React.FC<{ videoElement: HTMLVideoElement | null, hasVideo: boolean }> = ({ videoElement, hasVideo }) => {
  return (
    // Position at Zenith (Y=100)
    // Rotate 90deg X to face down.
    // Added 180deg Y rotation (Math.PI) to apply the horizontal flip, consistent with the Dome.
    <mesh rotation={[Math.PI / 2, Math.PI, 0]} position={[0, 100, 0]}>
      <planeGeometry args={[200, 200]} />
      {hasVideo && videoElement ? (
        <meshBasicMaterial side={THREE.DoubleSide}>
           {/* @ts-ignore */}
           <videoTexture attach="map" args={[videoElement]} colorSpace={THREE.SRGBColorSpace} minFilter={THREE.LinearFilter} magFilter={THREE.LinearFilter} />
        </meshBasicMaterial>
      ) : (
        <meshBasicMaterial side={THREE.DoubleSide} color="#1e293b" />
      )}
    </mesh>
  );
};

const CameraController: React.FC<{ mode: 'dome' | 'flat', isMotionEnabled: boolean }> = ({ mode, isMotionEnabled }) => {
  const { camera } = useThree();
  
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 75;
      camera.updateProjectionMatrix();
    }
  }, [mode, camera]);
  
  // Initial setup only
  useEffect(() => {
    // Default position: inside dome, looking slightly up/forward towards -Z (Front/North)
    // Position (0, -0.07, 0.07) + LookAt (0,0,0) creates a 45 degree upward angle towards -Z.
    camera.position.set(0, -0.07, 0.07);
    camera.up.set(0, 1, 0); 
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
};

const OrientationHandler: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { camera } = useThree();
  const targetQuaternion = useRef(new THREE.Quaternion());
  const currentQuaternion = useRef(new THREE.Quaternion());

  useEffect(() => {
    if (!enabled) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;

      const alpha = THREE.MathUtils.degToRad(e.alpha); 
      const beta = THREE.MathUtils.degToRad(e.beta);   
      const gamma = THREE.MathUtils.degToRad(e.gamma); 

      const euler = new THREE.Euler();
      const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); 

      euler.set(beta, alpha, -gamma, 'YXZ'); 
      targetQuaternion.current.setFromEuler(euler);
      targetQuaternion.current.multiply(q1); 
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [enabled]);

  useFrame(() => {
    if (enabled) {
      currentQuaternion.current.slerp(targetQuaternion.current, 0.1);
      camera.quaternion.copy(currentQuaternion.current);
    }
  });

  return null;
};

const DeepSpaceBackground = () => {
  return (
    <Sphere args={[200, 32, 32]}>
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        uniforms={{
          topColor: { value: new THREE.Color('#111111') },
          bottomColor: { value: new THREE.Color('#000000') },
          offset: { value: 33 },
          exponent: { value: 0.6 }
        }}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize( vWorldPosition + offset ).y;
            gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
          }
        `}
      />
    </Sphere>
  );
};

const Scene: React.FC<SceneProps> = ({ videoElement, isPlaying, hasVideo, isMotionEnabled, domeTilt, projectionMode, resetTrigger }) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();

  // Reset Logic
  useEffect(() => {
    if (resetTrigger > 0) {
      // 1. Reset FOV
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 75;
        camera.updateProjectionMatrix();
      }

      // 2. Reset Transform (Unified for both modes)
      camera.position.set(0, -0.07, 0.07);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);

      // 3. Reset Orbit Controls internal rotation state
      if (controlsRef.current) {
        controlsRef.current.reset();
      }
    }
  }, [resetTrigger, camera]);

  // Custom Zoom (FOV) Logic
  useEffect(() => {
    const domElement = gl.domElement;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (camera instanceof THREE.PerspectiveCamera) {
        const sensitivity = 0.05;
        const delta = e.deltaY * sensitivity;
        const newFov = THREE.MathUtils.clamp(camera.fov + delta, 30, 120);
        camera.fov = newFov;
        camera.updateProjectionMatrix();
      }
    };

    let startDist = 0;
    let startFov = 75;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist = Math.sqrt(dx * dx + dy * dy);
        if (camera instanceof THREE.PerspectiveCamera) {
          startFov = camera.fov;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && camera instanceof THREE.PerspectiveCamera) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (startDist > 0) {
          const zoomFactor = startDist / dist; 
          const newFov = THREE.MathUtils.clamp(startFov * zoomFactor, 30, 120);
          camera.fov = newFov;
          camera.updateProjectionMatrix();
        }
      }
    };

    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    domElement.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('touchstart', handleTouchStart);
      domElement.removeEventListener('touchmove', handleTouchMove);
    };
  }, [gl, camera]);

  return (
    <>
      <color attach="background" args={['#000000']} />
      
      <PerspectiveCamera makeDefault fov={75} />
      
      <CameraController mode={projectionMode} isMotionEnabled={isMotionEnabled} />

      <OrbitControls 
        ref={controlsRef}
        makeDefault 
        enabled={!isMotionEnabled}
        enablePan={false} 
        enableZoom={false}
        minDistance={0.01} 
        maxDistance={250} 
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={-0.5} 
      />

      <OrientationHandler enabled={isMotionEnabled} />
      
      <DeepSpaceBackground />

      {projectionMode === 'dome' ? (
        <DomeProjection videoElement={videoElement} tilt={domeTilt} hasVideo={hasVideo} />
      ) : (
        <FlatProjection videoElement={videoElement} hasVideo={hasVideo} />
      )}
    </>
  );
};

export default Scene;
