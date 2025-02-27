import { useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useState, useEffect } from 'react'
import { EffectComposer, Bloom, ToneMapping, Glitch, Pixelation } from '@react-three/postprocessing'
import { ToneMappingMode, GlitchMode } from 'postprocessing'



export default function Experience() {
    const [mouseX, setMouseX] = useState(0)
    const [mouseY, setMouseY] = useState(0)

    useEffect(() => {
        const handleMouseMove = (e) => {
            // Get mouse position normalized to -1 to 1 range
            const x = (e.clientX / window.innerWidth) * 2 - 1
            const y = -(e.clientY / window.innerHeight) * 2 + 1
            setMouseX(x)
            setMouseY(y)
        }

        // Add event listener to entire window
        window.addEventListener('mousemove', handleMouseMove)

        // Cleanup
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

    return (
        <Canvas
            camera={{ position: [0, 0, 7] }}
            style={{ width: 100, height: 100 }}>
            <EffectComposer disableNormalPass>
                <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

                <Pixelation granularity={5} />

            </EffectComposer>
            <Model
                url="/osmosis-logo.glb"
                mouseX={mouseX}
                mouseY={mouseY}
                scale={[0.5, 0.5, 0.5]}
                position={[0, -1, -1]}
            />
            <directionalLight
                castShadow
                position={[4, 4, 1]}
                intensity={4.5}
            />
            <ambientLight intensity={1.5} />
        </Canvas>
    )
}

function Model({ url, mouseX, mouseY }) {
    const { scene } = useGLTF(url)

    useFrame(() => {
        // Calculate rotation with limits
        const targetYRotation = mouseX * Math.PI * 0.5 // 0.5 = 90 degree max rotation
        const clampedYRotation = Math.min(Math.max(targetYRotation, -Math.PI / 2), Math.PI / 2)

        // Apply rotation with smooth interpolation
        scene.rotation.y += (clampedYRotation - scene.rotation.y) * 0.1

        // For X-axis (vertical) if needed
        const targetXRotation = mouseY * Math.PI * 0.25 // 45 degree max
        scene.rotation.x += (targetXRotation - scene.rotation.x) * 0.1
    })

    return <primitive object={scene} />
}