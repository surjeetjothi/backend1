
// --- SHADER ANIMATION INITIALIZATION (Three.js) ---
// Adapts the React ShaderAnimation component for Vanilla JS.

function initShaderAnimation() {
    const container = document.getElementById('login-visual-panel');
    if (!container) return;
    if (typeof THREE === 'undefined') {
        console.warn("Three.js not loaded.");
        return;
    }

    // Vertex Shader
    const vertexShader = `
      void main() {
        gl_Position = vec4( position, 1.0 );
      }
    `;

    // Fragment Shader (Liquid Effect)
    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      
      // Constants for liquid effect
      const float xScale = 3.0;
      const float yScale = 3.0;
      const float distortion = 0.1;

      void main(void) {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
        
        float d = length(p) * distortion;
        
        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        // Liquid flow calculation
        float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
        float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);
        
        // Output with smooth colors
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `;

    // Scene Setup
    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Use container dimensions
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Resize Handler
    const onWindowResize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        uniforms.resolution.value.x = width * window.devicePixelRatio;
        uniforms.resolution.value.y = height * window.devicePixelRatio;
    };

    // Initial sizing
    onWindowResize();
    window.addEventListener("resize", onWindowResize, false);

    // Animation Loop
    const animate = () => {
        requestAnimationFrame(animate);
        uniforms.time.value += 0.01;
        renderer.render(scene, camera);
    };

    animate();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initShaderAnimation();
});
