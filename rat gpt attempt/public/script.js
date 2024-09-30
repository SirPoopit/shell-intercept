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

// Load GLB model and add it to the scene
function loadModel(glbFile) {
  if (model) scene.remove(model);  // Remove previous model
  loader.load(`hulls/${glbFile}`, function (gltf) {
    model = gltf.scene;
    model.rotation.y = Math.PI;  // Flip model 180 degrees
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

// Make the function globally accessible by attaching it to the window object
window.toggleCollapsible = function(contentId) {
  const content = document.getElementById(contentId);
  const parent = content.parentElement;
  parent.classList.toggle('expanded');  // Toggle expanded class
};


// Function to toggle collapsible sections
function toggleCollapsible(contentId) {
  const content = document.getElementById(contentId);
  const parent = content.parentElement;
  parent.classList.toggle('expanded');
}

// Attach event listeners to all collapsible headers
document.querySelectorAll('.collapsible-header').forEach(header => {
  header.addEventListener('click', () => {
    const contentId = header.getAttribute('data-target');
    toggleCollapsible(contentId);
  });
});



// Populate left dropdowns with CSV content
function populateLeftDropdowns(lines) {
  const mountingContent = document.getElementById('mountingContent');
  const compartmentContent = document.getElementById('compartmentContent');
  const moduleContent = document.getElementById('moduleContent');

  // Clear existing options
  [mountingContent, compartmentContent, moduleContent].forEach(content => content.innerHTML = '');

  lines.slice(1).forEach((line, index) => {
    const columns = line.split(',');

    const mountingItem = document.createElement('div');
    mountingItem.textContent = columns[0];  // 1st column
    mountingContent.appendChild(mountingItem);

    const compartmentItem = document.createElement('div');
    compartmentItem.textContent = columns[1];  // 2nd column
    compartmentContent.appendChild(compartmentItem);

    const moduleItem = document.createElement('div');
    moduleItem.textContent = columns[2];  // 3rd column
    moduleContent.appendChild(moduleItem);
  });
}

// Populate hull dropdown with files from the "hulls" folder
async function populateHulls() {
  const hullDropdown = document.getElementById('hullDropdown');

  const response = await fetch('/hulls');  // Fetch the list of .csv files from the server
  const files = await response.json();

  files.forEach(file => {
    const option = document.createElement('option');
    option.value = file.replace('.csv', '');
    option.textContent = file.replace('.csv', '');
    hullDropdown.appendChild(option);
  });

  hullDropdown.addEventListener('change', loadCSV);
  loadCSV();  // Load the first hull by default
}

// Populate shell dropdown with files from the "shells" folder
async function populateShells() {
  const shellDropdown = document.getElementById('shellDropdown');

  const response = await fetch('/shells');  // Fetch the list of .asset files from the server
  const files = await response.json();

  files.forEach(file => {
    const option = document.createElement('option');
    option.value = file.replace('.asset', '');
    option.textContent = file.replace('.asset', '');
    shellDropdown.appendChild(option);
  });
}

// Initialize dropdowns on page load
populateHulls();
populateShells();

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
