function toggleDropdown(element) {
  const dropdown = element.parentElement;
  dropdown.classList.toggle('expanded');
}
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(15, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const loader = new GLTFLoader();
let model;

function loadModel(glbFile) {
  if (model) scene.remove(model);  // Remove previous model
  loader.load(`hulls\${glbFile}`, function (gltf) {
    model = gltf.scene;
    model.rotation.y = Math.PI; // Flip model 180 degrees
    scene.add(model);
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.75;
      }
    });
  }, undefined, function (error) {
    console.error('Error loading model:', error);
  });
}

// Load hulls and CSV on startup
fetch('src\hulls.txt').then(response => response.text()).then(data => {
  const hulls = data.split('\n').filter(Boolean);
  const hullDropdown = document.getElementById('hullDropdown');

  hulls.forEach(hull => {
    const option = document.createElement('option');
    option.value = hull;
    option.textContent = hull;
    hullDropdown.appendChild(option);
  });

  hullDropdown.addEventListener('change', loadCSV);
  loadCSV();  // Default to first hull
});

function loadCSV() {
  const hull = document.getElementById('hullDropdown').value;
  fetch(`src\hulls\${hull}.csv`).then(response => response.text()).then(data => {
    const lines = data.split('\n').filter(Boolean);
    const [glbFile] = lines[0].split(',');

    // Load the model
    loadModel(glbFile);
  });
}

fetch('src\shells.csv')
  .then(response => response.text())
  .then(data => {
    const lines = data.split('\n').filter(Boolean);
    const dropdown = document.getElementById('shellDropdown');
    lines.forEach(line => {
      const shell = line.split(',')[0];
      const option = document.createElement('option');
      option.value = shell;
      option.textContent = shell;
      dropdown.appendChild(option);
    });
  });

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
