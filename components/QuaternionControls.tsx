import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const QuaternionControls: React.FC<{ 
  enabled: boolean,
  restrictViewToEdge: boolean,
  edgePadding: number,
  domeTilt: number,
  projectionMode: string
}> = ({ enabled, restrictViewToEdge, edgePadding, domeTilt, projectionMode }) => {
  const { camera, gl } = useThree();
  
  const isDragging = useRef(false);
  const previousPosition = useRef({ x: 0, y: 0 });
  const sphericalDelta = useRef({ theta: 0, phi: 0 });

  const checkRotationLimit = (q: THREE.Quaternion) => {
    if (!restrictViewToEdge || projectionMode !== 'dome') return true;
    
    if (!(camera instanceof THREE.PerspectiveCamera)) return true;

    const aspect = camera.aspect;
    const vfovRad = THREE.MathUtils.degToRad(camera.fov);
    const hfovRad = 2 * Math.atan(Math.tan(vfovRad / 2) * aspect);
    const tanCorner = Math.sqrt(Math.pow(Math.tan(vfovRad / 2), 2) + Math.pow(Math.tan(hfovRad / 2), 2));
    const cornerAngle = Math.atan(tanCorner);
    
    const paddingRad = THREE.MathUtils.degToRad(edgePadding);
    const maxAngle = (Math.PI / 2) - cornerAngle + paddingRad;
    
    const tiltRad = THREE.MathUtils.degToRad(domeTilt);
    const domeUp = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), tiltRad);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const angle = forward.angleTo(domeUp);
    
    return angle <= maxAngle;
  };

  useEffect(() => {
    if (!enabled) return;

    const domElement = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only left click
      isDragging.current = true;
      previousPosition.current = { x: e.clientX, y: e.clientY };
      try {
        domElement.setPointerCapture(e.pointerId);
      } catch (err) {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - previousPosition.current.x;
      const deltaY = e.clientY - previousPosition.current.y;
      
      previousPosition.current = { x: e.clientX, y: e.clientY };
      
      // Accumulate the delta
      // Multiplying by rotateSpeed to keep magnitude consistent with previous implementation
      const rotateSpeed = 0.005;
      sphericalDelta.current.theta += deltaX * rotateSpeed;
      sphericalDelta.current.phi += deltaY * rotateSpeed;
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false;
      try {
        domElement.releasePointerCapture(e.pointerId);
      } catch (err) {}
    };

    domElement.style.touchAction = 'none';

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.ownerDocument.addEventListener('pointermove', onPointerMove);
    domElement.ownerDocument.addEventListener('pointerup', onPointerUp);

    return () => {
      domElement.style.touchAction = 'auto';
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.ownerDocument.removeEventListener('pointermove', onPointerMove);
      domElement.ownerDocument.removeEventListener('pointerup', onPointerUp);
    };
  }, [enabled, gl, camera, restrictViewToEdge, edgePadding, domeTilt, projectionMode]);

  useFrame(() => {
    if (!enabled) return;

    const dampingFactor = 0.05;

    if (Math.abs(sphericalDelta.current.theta) > 0.0001 || Math.abs(sphericalDelta.current.phi) > 0.0001) {
      
      const stepTheta = sphericalDelta.current.theta * dampingFactor;
      const stepPhi = sphericalDelta.current.phi * dampingFactor;
      
      const qY = new THREE.Quaternion();
      qY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), stepTheta);
      
      const qX = new THREE.Quaternion();
      qX.setFromAxisAngle(new THREE.Vector3(1, 0, 0), stepPhi);

      const nextQ = camera.quaternion.clone();
      nextQ.premultiply(qY);
      nextQ.multiply(qX);
      nextQ.normalize();

      if (checkRotationLimit(nextQ)) {
        camera.quaternion.copy(nextQ);
      } else {
        // Try just yaw
        const nextQYaw = camera.quaternion.clone();
        nextQYaw.premultiply(qY);
        nextQYaw.normalize();
        if (checkRotationLimit(nextQYaw)) {
           camera.quaternion.copy(nextQYaw);
           sphericalDelta.current.phi = 0; // stop pitching
        } else {
           sphericalDelta.current.theta = 0;
           sphericalDelta.current.phi = 0;
        }
      }

      sphericalDelta.current.theta *= (1 - dampingFactor);
      sphericalDelta.current.phi *= (1 - dampingFactor);
    }
  });

  return null;
};
