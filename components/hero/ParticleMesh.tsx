"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function ParticleMesh() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* ── scene ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 80;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    /* ── particles with vertex colors (purple + cyan) ── */
    const particleCount = 3000;
    const positions = new Float32Array(particleCount * 3);
    const colors    = new Float32Array(particleCount * 3);
    const sizes     = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      const t = Math.random();
      if (t < 0.5) {
        // purple band
        colors[i * 3]     = 0.48 + t * 0.3;
        colors[i * 3 + 1] = 0.23;
        colors[i * 3 + 2] = 0.93;
      } else {
        // cyan band
        colors[i * 3]     = 0.02;
        colors[i * 3 + 1] = 0.7 + t * 0.3;
        colors[i * 3 + 2] = 0.82;
      }
      sizes[i] = Math.random() * 2 + 0.5;
    }

    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    ptGeo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    ptGeo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));

    const ptMat = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(ptGeo, ptMat);
    scene.add(particles);

    /* ── wireframe scrolling grid ── */
    const gridGeo = new THREE.PlaneGeometry(300, 300, 30, 30);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI / 3;
    grid.position.y = -60;
    scene.add(grid);

    /* ── purple torus ── */
    const torusGeo = new THREE.TorusGeometry(25, 0.3, 8, 80);
    const torusMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.15 });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.position.set(60, -10, -20);
    scene.add(torus);

    /* ── cyan torus ── */
    const torus2Geo = new THREE.TorusGeometry(15, 0.2, 8, 60);
    const torus2Mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.12 });
    const torus2 = new THREE.Mesh(torus2Geo, torus2Mat);
    torus2.position.set(-60, 20, -30);
    scene.add(torus2);

    /* ── mouse ── */
    let mouseX = 0, mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX =  (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

    /* ── resize ── */
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    /* ── loop ── */
    let frameId: number;
    let t = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      t += 0.004;

      particles.rotation.y = t * 0.05 + mouseX * 0.08;
      particles.rotation.x = mouseY * 0.05;

      torus.rotation.x  = t * 0.3;
      torus.rotation.y  = t * 0.2;
      torus2.rotation.x = -t * 0.2;
      torus2.rotation.z =  t * 0.15;

      grid.position.z = (t * 5) % 10 - 5;

      camera.position.x += (mouseX * 6 - camera.position.x) * 0.04;
      camera.position.y += (mouseY * 4 - camera.position.y) * 0.04;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      ptGeo.dispose();
      ptMat.dispose();
      gridGeo.dispose();
      gridMat.dispose();
      torusGeo.dispose();
      torusMat.dispose();
      torus2Geo.dispose();
      torus2Mat.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
