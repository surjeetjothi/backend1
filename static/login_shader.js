// --- LOGIN PAGE SHADER ANIMATION ---
// Adapted from User's React Component

function initLoginShader() {
  const container = document.getElementById('shader-animation-container');
  if (!container) return;

  if (typeof THREE === 'undefined') {
    console.warn("Three.js not loaded.");
    return;
  }

  // Clear any previous canvas
  container.innerHTML = '';

  // 1. Vertex Shader (Standard Plane)
  const vertexShader = `
      void main() {
        gl_Position = vec4( position, 1.0 );
      }
    `;

  // 2. Fragment Shader (The "Wavy Lines" Effect)
  const fragmentShader = `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time*0.05;
        float lineWidth = 0.002;

        vec3 color = vec3(0.0);
        for(int j = 0; j < 3; j++){
          for(int i=0; i < 5; i++){
            color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*5.0 - length(uv) + mod(uv.x+uv.y, 0.2));
          }
        }
        
        gl_FragColor = vec4(color[0],color[1],color[2],1.0);
      }
    `;

  // 3. Scene Setup
  const camera = new THREE.Camera();
  camera.position.z = 1;

  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);

  const uniforms = {
    time: { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  container.appendChild(renderer.domElement);

  // 4. Resize Handling
  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    renderer.setSize(width, height);
    uniforms.resolution.value.x = width * window.devicePixelRatio;
    uniforms.resolution.value.y = height * window.devicePixelRatio;
  };

  // Use ResizeObserver for robust layout handling
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);
  resize(); // Initial call

  // 5. Animation Loop
  const animate = () => {
    requestAnimationFrame(animate);
    uniforms.time.value += 0.03;
    renderer.render(scene, camera);
  };

  animate();
}

// Init when DOM is ready
document.addEventListener('DOMContentLoaded', initLoginShader);
