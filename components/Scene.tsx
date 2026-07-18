
import React, { useRef, useEffect, useLayoutEffect, useMemo, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sphere, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Vignette, Bloom, SMAA } from '@react-three/postprocessing';
import { Effect } from 'postprocessing';
import { QuaternionControls } from './QuaternionControls';

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
  smoothFovChange: boolean;
  useQuaternionRotation: boolean;
  ambientIntensity: number;
  ambientFalloff: number;
  restrictViewToEdge: boolean;
  edgePadding: number;
  allowCameraRoll: boolean;
  vignette: number;
  bloom: number;
  edgeBlur: number;
  edgeChokeOpacity: number;
  antialiasing: boolean;
  postProcessingEnabled: boolean;
}

// Custom Edge Blur Effect
const EdgeBlurShader = {
  fragmentShader: `
    uniform float blurStrength;
    
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      vec2 center = vec2(0.5, 0.5);
      vec2 toCenter = uv - center;
      float dist = length(toCenter);
      
      vec4 color = inputColor;
      
      if (blurStrength > 0.0) {
        float amount = smoothstep(0.1, 0.9, dist) * blurStrength;
        
        if (amount > 0.0) {
          vec4 blurColor = vec4(0.0);
          float total = 0.0;
          float radius = amount * 0.025; // max radius for the blur
          
          // Vogel's spiral for smooth high-quality bokeh-like lens blur
          const float GOLDEN_ANGLE = 2.39996323;
          const int SAMPLES = 48;
          
          for(int i = 0; i < SAMPLES; i++) {
              float r = sqrt(float(i) + 0.5) / sqrt(float(SAMPLES));
              float theta = float(i) * GOLDEN_ANGLE;
              
              vec2 offset = vec2(cos(theta), sin(theta)) * r * radius;
              
              // Soft falloff weight
              float weight = 1.0 - (r * r); 
              blurColor += texture2D(inputBuffer, uv + offset) * weight;
              total += weight;
          }
          
          color = blurColor / total;
          // Keep original alpha to prevent weird transparency ovals
          color.a = inputColor.a;
        }
      }
      
      outputColor = color;
    }
  `
};

class EdgeBlurImpl extends Effect {
  constructor({ blurStrength = 0 } = {}) {
    super('EdgeBlur', EdgeBlurShader.fragmentShader, {
      uniforms: new Map([
        ['blurStrength', new THREE.Uniform(blurStrength)]
      ])
    });
  }
}

const EdgeBlurNode = forwardRef(({ blurStrength }: { blurStrength: number }, ref) => {
  const effect = useMemo(() => new EdgeBlurImpl({ blurStrength }), []);
  effect.uniforms.get('blurStrength')!.value = blurStrength;
  return <primitive ref={ref} object={effect} />;
});

// Custom Vignette Effect
const CustomVignetteShader = {
  fragmentShader: `
    uniform float vignetteStrength;
    
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      vec2 center = vec2(0.5, 0.5);
      vec2 toCenter = uv - center;
      float dist = length(toCenter);
      
      vec4 color = inputColor;
      
      if (vignetteStrength != 0.0) {
        float vigFactor = smoothstep(0.8, 0.2, dist * 1.5);
        if (vignetteStrength < 0.0) {
          color.rgb *= mix(1.0, vigFactor, -vignetteStrength);
        } else {
          color.rgb += (1.0 - vigFactor) * vignetteStrength;
        }
      }
      
      // Keep original alpha
      color.a = inputColor.a;
      outputColor = color;
    }
  `
};

class CustomVignetteImpl extends Effect {
  constructor({ vignetteStrength = 0 } = {}) {
    super('CustomVignette', CustomVignetteShader.fragmentShader, {
      uniforms: new Map([
        ['vignetteStrength', new THREE.Uniform(vignetteStrength)]
      ])
    });
  }
}

const CustomVignetteNode = forwardRef(({ vignetteStrength }: { vignetteStrength: number }, ref) => {
  const effect = useMemo(() => new CustomVignetteImpl({ vignetteStrength }), []);
  effect.uniforms.get('vignetteStrength')!.value = vignetteStrength;
  return <primitive ref={ref} object={effect} />;
});

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

const AmbientGlowShader = {
  vertexShader: `
    varying vec3 vLocalPosition;
    void main() {
      vLocalPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform bool uHasVideo;
    uniform float radius;
    uniform vec3 colorBottom;
    uniform float uAmbientIntensity;
    uniform float uAmbientFalloff;
    varying vec3 vLocalPosition;

    void main() {
      // y goes from 0 at the edge (equator) to -radius at the bottom center.
      // normalize y to 0..1 where 0 is equator and 1 is south pole
      float distToCenter = clamp(-vLocalPosition.y / radius, 0.0, 1.0);
      
      // Exponential falloff: fast initial drop, but with a longer subtle tail
      // so it remains visible even at 30+ degrees below the horizon.
      float fade = 0.80 * exp(-distToCenter * uAmbientFalloff) + 0.20 * exp(-distToCenter * max(uAmbientFalloff / 6.0, 0.5));

      vec3 color;
      if (uHasVideo) {
        float phi = atan(vLocalPosition.z, vLocalPosition.x);
        
        // Circular fisheye texture radius at the edge is 0.5.
        // Sample slightly inside to capture real active color.
        float r_tex = 0.48;
        
        // Map to UV space centered at (0.5, 0.5)
        float u = 0.5 + r_tex * cos(phi);
        float v = 0.5 + r_tex * sin(phi);
        
        // Blur sampling along the edge
        vec3 blurredColor = vec3(0.0);
        float totalWeight = 0.0;
        for (int i = -3; i <= 3; i++) {
          for (int j = -3; j <= 3; j++) {
            float du = float(i) * 0.005;
            float dv = float(j) * 0.005;
            blurredColor += texture2D(map, vec2(u + du, v + dv)).rgb;
            totalWeight += 1.0;
          }
        }
        color = blurredColor / totalWeight;
        
        // Increase vibrancy and brightness for the spill
        color = pow(color, vec3(0.8)) * 1.5;
      } else {
        color = colorBottom;
      }

      // Also fade color to black to create a glowing effect
      color *= (fade * uAmbientIntensity);

      gl_FragColor = vec4(color, 0.0);
    }
  `
};

const DomeProjection: React.FC<{ videoElement: HTMLVideoElement | null, tilt: number, hasVideo: boolean, ambientIntensity: number, ambientFalloff: number, edgeChokeOpacity: number }> = ({ videoElement, tilt, hasVideo, ambientIntensity, ambientFalloff, edgeChokeOpacity }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const currentTilt = useRef(tilt);

  const videoTexture = useMemo(() => {
    if (!videoElement) return null;
    const tex = new THREE.VideoTexture(videoElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [videoElement]);

  useFrame((state, delta) => {
    // Smoothly interpolate currentTilt towards target tilt
    const lerpFactor = Math.min(1, 10 * delta);
    currentTilt.current = THREE.MathUtils.lerp(currentTilt.current, tilt, lerpFactor);
    if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.degToRad(currentTilt.current);
    }

    // Direct uniform updates on the material on each frame to guarantee perfect reactivity
    if (materialRef.current) {
      materialRef.current.uniforms.uAmbientIntensity.value = ambientIntensity;
      materialRef.current.uniforms.uAmbientFalloff.value = ambientFalloff;
      materialRef.current.uniforms.uHasVideo.value = hasVideo && !!videoTexture;
      materialRef.current.uniforms.map.value = videoTexture;
    }
  });

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
    <group ref={groupRef} rotation={[THREE.MathUtils.degToRad(currentTilt.current), 0, 0]}>
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

      {/* Black Edge Choke (Fade to black at the horizon to smooth the hard edge) */}
      <mesh scale={[1, 1, 1]} position={[0, 0, 0]} frustumCulled={false}>
        <sphereGeometry args={[99.8, 128, 32, 0, Math.PI * 2, Math.PI / 2 - 0.05, 0.05]} />
        <shaderMaterial
          side={THREE.BackSide}
          transparent={true}
          depthWrite={false}
          uniforms={{
            color: { value: new THREE.Color('#000000') },
            uOpacity: { value: edgeChokeOpacity }
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 color;
            uniform float uOpacity;
            varying vec2 vUv;
            void main() {
              // vUv.y is 1.0 at the top of the choke, 0.0 at the horizon.
              float alpha = smoothstep(0.0, 1.0, 1.0 - vUv.y) * uOpacity;
              gl_FragColor = vec4(color, alpha);
            }
          `}
        />
      </mesh>

      {/* Ambient Light Spill Glow Inverted Dome */}
      <mesh scale={[1, 1, 1]} frustumCulled={false}>
        {/* radius: 100, widthSegments: 128, heightSegments: 64, phiStart: 0, phiLength: Math.PI * 2, thetaStart: Math.PI / 2, thetaLength: Math.PI / 2 */}
        <sphereGeometry args={[100, 128, 64, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <shaderMaterial 
          ref={materialRef}
          vertexShader={AmbientGlowShader.vertexShader}
          fragmentShader={AmbientGlowShader.fragmentShader}
          uniforms={{
            map: { value: null },
            uHasVideo: { value: false },
            radius: { value: 100.0 },
            colorBottom: { value: new THREE.Color('#312e81') }, // deep warm indigo
            uAmbientIntensity: { value: ambientIntensity },
            uAmbientFalloff: { value: ambientFalloff }
          }}
          transparent={true}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.CustomBlending}
          blendEquation={THREE.AddEquation}
          blendSrc={THREE.OneFactor}
          blendDst={THREE.OneFactor}
          blendEquationAlpha={THREE.AddEquation}
          blendSrcAlpha={THREE.ZeroFactor}
          blendDstAlpha={THREE.OneFactor}
        />
      </mesh>
    </group>
  );
};

const FlatProjection: React.FC<{ videoElement: HTMLVideoElement | null, hasVideo: boolean }> = ({ videoElement, hasVideo }) => {
  return (
    // Position directly in front of the camera (-Z)
    <mesh rotation={[0, 0, 0]} position={[0, 0, -100]}>
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
    if (mode === 'flat') {
      camera.position.set(0, 0, 0.07);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(0, -0.07, 0.07);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    }
  }, [mode, camera]);

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

const Scene: React.FC<SceneProps> = ({ videoElement, isPlaying, hasVideo, isMotionEnabled, domeTilt, projectionMode, resetTrigger, smoothFovChange, useQuaternionRotation, ambientIntensity, ambientFalloff, restrictViewToEdge, edgePadding, allowCameraRoll, vignette, bloom, edgeBlur, edgeChokeOpacity, antialiasing, postProcessingEnabled }) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  const targetFov = useRef(75);
  const rollVelocity = useRef(0);

  // Reset Logic and Mode change updates
  useEffect(() => {
    // 1. Reset FOV
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 75;
      targetFov.current = 75;
      camera.updateProjectionMatrix();
    }

    // 2. Reset Transform (Unified for both modes)
    if (projectionMode === 'flat') {
      camera.position.set(0, 0, 0.07); 
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(0, -0.07, 0.07);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    }

    // 3. Reset Orbit Controls internal rotation state
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      controlsRef.current.saveState();
    }
  }, [resetTrigger, projectionMode, camera]);

  // Smooth FOV & Roll animation loop
  useFrame((state, delta) => {
    if (camera instanceof THREE.PerspectiveCamera) {
      // FOV Momentum
      if (smoothFovChange) {
        const diff = targetFov.current - camera.fov;
        if (Math.abs(diff) > 0.01) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov.current, 10, delta);
          camera.updateProjectionMatrix();
        } else if (camera.fov !== targetFov.current) {
          camera.fov = targetFov.current;
          camera.updateProjectionMatrix();
        }
      } else {
        if (camera.fov !== targetFov.current) {
          camera.fov = targetFov.current;
          camera.updateProjectionMatrix();
        }
      }

      // Roll Momentum
      if (allowCameraRoll && !isMotionEnabled) {
        if (Math.abs(rollVelocity.current) > 0.00001) {
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          camera.up.applyAxisAngle(forward, rollVelocity.current * delta * 60);
          camera.updateProjectionMatrix();
          
          if (controlsRef.current) {
            controlsRef.current.update();
          }

          rollVelocity.current = THREE.MathUtils.damp(rollVelocity.current, 0, 5, delta);
        } else {
          rollVelocity.current = 0;
        }
      }

      // Update minPolarAngle dynamically to restrict view to dome edge
      if (controlsRef.current) {
        if (restrictViewToEdge && projectionMode === 'dome') {
          const aspect = camera.aspect;
          const vfovRad = THREE.MathUtils.degToRad(camera.fov);
          const hfovRad = 2 * Math.atan(Math.tan(vfovRad / 2) * aspect);
          
          const tanCorner = Math.sqrt(Math.pow(Math.tan(vfovRad / 2), 2) + Math.pow(Math.tan(hfovRad / 2), 2));
          const cornerAngle = Math.atan(tanCorner);
          
          const paddingRad = THREE.MathUtils.degToRad(edgePadding);
          const maxAngleFromDomeUp = (Math.PI / 2) - cornerAngle + paddingRad;
          const C = Math.cos(maxAngleFromDomeUp);
          
          const tiltRad = THREE.MathUtils.degToRad(domeTilt);
          const theta_c = controlsRef.current.getAzimuthalAngle();
          const theta_f = theta_c + Math.PI; // Forward vector azimuth
          
          const A = Math.cos(tiltRad);
          const B = Math.cos(theta_f) * Math.sin(tiltRad);
          const R = Math.sqrt(A * A + B * B);
          
          const alpha = Math.atan2(B, A);
          let maxPhi_f;
          if (C / R <= 1) {
            maxPhi_f = alpha + Math.acos(Math.max(-1, C / R));
          } else {
            maxPhi_f = alpha;
          }
          
          controlsRef.current.minPolarAngle = Math.max(0, Math.PI - maxPhi_f);
          controlsRef.current.maxPolarAngle = Math.PI;
        } else {
          controlsRef.current.minPolarAngle = 0;
          controlsRef.current.maxPolarAngle = Math.PI;
        }
      }
    }
  });

  // Custom Zoom (FOV) Logic
  useEffect(() => {
    const domElement = gl.domElement;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (camera instanceof THREE.PerspectiveCamera) {
        const sensitivity = 0.05;
        const delta = e.deltaY * sensitivity;
        
        if (smoothFovChange) {
          targetFov.current = THREE.MathUtils.clamp(targetFov.current + delta, 30, 120);
        } else {
          const newFov = THREE.MathUtils.clamp(camera.fov + delta, 30, 120);
          camera.fov = newFov;
          targetFov.current = newFov;
          camera.updateProjectionMatrix();
        }
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
          
          if (smoothFovChange) {
            targetFov.current = THREE.MathUtils.clamp(startFov * zoomFactor, 30, 120);
          } else {
            const newFov = THREE.MathUtils.clamp(startFov * zoomFactor, 30, 120);
            camera.fov = newFov;
            targetFov.current = newFov;
            camera.updateProjectionMatrix();
          }
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
  }, [gl, camera, smoothFovChange]);

  // Camera Roll Logic
  useEffect(() => {
    if (!allowCameraRoll || isMotionEnabled) return;

    const domElement = gl.domElement;
    let isDragging = false;
    let previousX = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Right click
        isDragging = true;
        previousX = e.clientX;
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && camera instanceof THREE.PerspectiveCamera) {
        const deltaX = e.clientX - previousX;
        previousX = e.clientX;

        // Add to roll velocity for momentum
        rollVelocity.current += deltaX * 0.002;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        isDragging = false;
      }
    };
    
    const handleContextMenu = (e: Event) => e.preventDefault();

    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('contextmenu', handleContextMenu);

    return () => {
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl, camera, allowCameraRoll, isMotionEnabled]);

  return (
    <>
      <color attach="background" args={['#000000']} />
      
      <PerspectiveCamera makeDefault fov={75} />
      
      <CameraController mode={projectionMode} isMotionEnabled={isMotionEnabled} />

      <OrbitControls 
        ref={controlsRef}
        makeDefault 
        enabled={!isMotionEnabled && !useQuaternionRotation}
        enablePan={false} 
        enableZoom={false}
        minDistance={0.01} 
        maxDistance={250} 
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={-0.5} 
      />

      <QuaternionControls 
        enabled={!isMotionEnabled && useQuaternionRotation}
        restrictViewToEdge={restrictViewToEdge}
        edgePadding={edgePadding}
        domeTilt={domeTilt}
        projectionMode={projectionMode}
      />

      <OrientationHandler enabled={isMotionEnabled} />
      
      {projectionMode === 'dome' ? (
        <DeepSpaceBackground />
      ) : (
        <color attach="background" args={['#000000']} />
      )}

      {projectionMode === 'dome' ? (
        <DomeProjection videoElement={videoElement} tilt={domeTilt} hasVideo={hasVideo} ambientIntensity={ambientIntensity} ambientFalloff={ambientFalloff} edgeChokeOpacity={edgeChokeOpacity} />
      ) : (
        <FlatProjection videoElement={videoElement} hasVideo={hasVideo} />
      )}

      {postProcessingEnabled && (vignette !== 0 || bloom > 0 || edgeBlur > 0 || antialiasing) && (
        <EffectComposer disableNormalPass multisampling={antialiasing ? 0 : 4}>
          {antialiasing && <SMAA />}
          {edgeBlur > 0 && <EdgeBlurNode blurStrength={edgeBlur} />}
          {bloom > 0 && <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={bloom} />}
          {vignette !== 0 && <CustomVignetteNode vignetteStrength={vignette} />}
        </EffectComposer>
      )}
    </>
  );
};

export default Scene;
