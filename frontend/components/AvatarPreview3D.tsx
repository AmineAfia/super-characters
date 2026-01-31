"use client"

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

interface AvatarPreview3DProps {
  avatarUrl: string
  onLoaded?: () => void
  onError?: (error: string) => void
}

export default function AvatarPreview3D({ avatarUrl, onLoaded, onError }: AvatarPreview3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const modelRef = useRef<THREE.Group | null>(null)
  const clockRef = useRef(new THREE.Clock())
  const animationFrameRef = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Create scene
    const scene = new THREE.Scene()
    scene.background = null // Transparent
    sceneRef.current = scene

    // Create camera - positioned to show full body with some space around
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100)
    camera.position.set(0, 1.0, 6.5)
    camera.lookAt(0, 0.9, 0)
    cameraRef.current = camera

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xfff5f0, 1.2)
    keyLight.position.set(2, 3, 2)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xf0f5ff, 0.5)
    fillLight.position.set(-2, 2, 1)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4)
    rimLight.position.set(0, 2, -2)
    scene.add(rimLight)

    // Add a subtle spotlight from below (for the spotlight effect)
    const spotLight = new THREE.SpotLight(0xfff5f0, 0.6, 15, Math.PI / 3, 0.5)
    spotLight.position.set(0, -0.5, 2)
    spotLight.target.position.set(0, 0.9, 0)
    scene.add(spotLight)
    scene.add(spotLight.target)

    // Add orbit controls for user interaction
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.9, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = false
    controls.enablePan = false
    controls.minPolarAngle = Math.PI / 4
    controls.maxPolarAngle = Math.PI / 2
    controls.autoRotate = true
    controls.autoRotateSpeed = 2
    controls.update()

    // Load the avatar model
    const loader = new GLTFLoader()
    loader.load(
      avatarUrl,
      (gltf) => {
        const model = gltf.scene
        modelRef.current = model

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        // Center horizontally, keep feet on ground
        model.position.x = -center.x
        model.position.y = -box.min.y
        model.position.z = -center.z

        // Scale to fit nicely
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 2.5 / maxDim
        model.scale.setScalar(scale)
        model.position.multiplyScalar(scale)

        scene.add(model)

        // Setup animations if available
        if (gltf.animations.length > 0) {
          mixerRef.current = new THREE.AnimationMixer(model)
          const action = mixerRef.current.clipAction(gltf.animations[0])
          action.play()
        }

        onLoaded?.()
      },
      undefined,
      (error) => {
        console.error('[AvatarPreview3D] Failed to load model:', error)
        onError?.(error.message || 'Failed to load avatar model')
      }
    )

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)
      
      const delta = clockRef.current.getDelta()
      
      // Update animation mixer
      if (mixerRef.current) {
        mixerRef.current.update(delta)
      }

      // Update controls
      controls.update()

      // Render
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameRef.current)
      
      if (modelRef.current) {
        scene.remove(modelRef.current)
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose())
            } else {
              child.material.dispose()
            }
          }
        })
      }
      
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [avatarUrl, onLoaded, onError])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
      style={{ minHeight: '200px' }}
    />
  )
}
