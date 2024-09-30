import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);  // FOV set to 60
camera.position.set(15, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;  // Disable default zoom behavior
controls.enableDamping = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const loader = new GLTFLoader();
let model, colliderModel;
let boxes = [];  // Array to store created cubes
let rays = []; // Array to store rays and their visibility state
let rayIndex = 0; // Counter for rays
let rayLines = [];
let rayLogs = [];



const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredBox = null;

animate();
loadShellsIntoDropdown('shells.txt', 'shellDropdown');
document.getElementById('shellDropdown').addEventListener('change', loadShellmodifers);
const rayLogContainer = document.getElementById('ray-log')
let armorValue, internalDensity, armorPenetration, armorDamageRadius;
let transparency = .4;
let transparencybool = false;
let intersectionPoint, intersectionNormal;




// Scroll wheel to translate forward/back
window.addEventListener('wheel', (event) => {
    const delta = Math.sign(event.deltaY);
    const moveDistance = delta * 0.5;  // Adjust speed here

    const moveVector = new THREE.Vector3();
    camera.getWorldDirection(moveVector);
    camera.position.add(moveVector.multiplyScalar(moveDistance));
    controls.update();

    // Prevent flipping of controls and apply constraints
    const distanceFromOrigin = camera.position.length();
    if (distanceFromOrigin < 0.1) {
        camera.position.setLength(0.1);  // Prevent going too close to origin
    }
});


// Expandable Menu functionality
document.querySelectorAll('.expandable-header').forEach(header => {
    header.addEventListener('click', () => {
        const menu = header.parentElement;
        menu.classList.toggle('active');
    });
});




// Event listener for the space bar to draw rays
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
		console.log(armorValue);
        castRayAtModel(armorValue, internalDensity, armorPenetration);  // Cast the ray at the model when space is pressed
    }
});



// Load hulls into dropdown and set the default behavior
fetch('hulls.txt').then(response => response.text()).then(data => {
    const hulls = data.split('\n').filter(Boolean);
    const hullDropdown = document.getElementById('hullDropdown');

    hulls.forEach(hull => {
        const option = document.createElement('option');
        option.value = hull;
        option.textContent = hull;
        hullDropdown.appendChild(option);
    });

    hullDropdown.addEventListener('change', loadhull, loadModules);
    loadModules()
	loadhull()
	loadShellmodifers()
	clearRaysAndLogs()
});

let cameraInsideModel = true;  // Track if the camera is inside the model
let debounceTimer = null;  // To prevent rapid reloading

function checkIntersectionWithRays() {
    if (!model) return;  // Return if the model isn't loaded

    // Ray 1: Cast a ray in the direction the camera is facing (forward)
    const forwardRayDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    raycaster.set(camera.position, forwardRayDirection);
    const intersectsFront = raycaster.intersectObject(colliderModel, true);

    // Ray 2: Cast a ray in the opposite direction (backward)
    const backwardRayDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).normalize();
    raycaster.set(camera.position, backwardRayDirection);
    const intersectsBack = raycaster.intersectObject(colliderModel, true);

    // Check if both rays intersect the model, which indicates the camera is inside
    const isCameraInside = intersectsFront.length > 0 && intersectsBack.length > 0;

    // Ensure we don't trigger continuous reloading
    if (debounceTimer) return;  // Skip if debounce is active

    // If the camera status changes, reload cubes and hull once
    if (!isCameraInside && cameraInsideModel) {

        console.log("Camera entered the model");
        transparency = 0.4;
        transparencybool = false; 
        reloadScene(); 
        cameraInsideModel = false;

    } else if (isCameraInside && !cameraInsideModel) {
        console.log("Camera exited the model");
        transparency = 0.8; 
        transparencybool = true;
        reloadScene(); 
        cameraInsideModel = true; 
    }
}


// Reload the scene with a debounce to prevent rapid reloading
function reloadScene() {
	clearRaysAndLogs()
    loadModules();  // Reload cubes with updated transparency
    loadhull();   // Reload hull with updated transparency

    // Add debounce to avoid reloading repeatedly
    debounceTimer = setTimeout(() => {
        debounceTimer = null;  // Reset debounce after a short delay
    }, 250);  // 500ms debounce to avoid continuous reloading
}


// Load the shells into dropdown menu
function loadShellsIntoDropdown(filePath, dropdownId) {
    fetch(filePath).then(response => response.text()).then(data => {
        const dropdown = document.getElementById(dropdownId);
        const shells = data.split('\n');
        shells.forEach(shell => {
            const option = document.createElement('option');
            option.value = shell.trim();
            option.textContent = shell.trim();
            dropdown.appendChild(option);
        });
    });
}


function loadhull() {
    console.log("loadhull");
    const hullDropdown = document.getElementById('hullDropdown');
    const hull = hullDropdown.value;
    
    if (model) scene.remove(model);  // Remove previous hull model
    if (colliderModel) scene.remove(colliderModel);  // Remove previous collider model
    
    fetch(`hulls/${hull}.csv`)
        .then(response => response.text())
        .then(data => {
            const lines = data.split('\n').filter(Boolean);
            const firstLine = lines[0].split(',');
			const armorValue = firstLine[2];
			const internaldensity = firstLine[3];
            // Load hull.glb from first value
            const glbFile = firstLine[0];
            loader.load(`hulls/${glbFile}`, function (gltf) {
                model = gltf.scene;
                model.rotation.y = Math.PI;  // Flip model 180 degrees
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        const material = new THREE.MeshBasicMaterial({
                            color: 0xffffff,
                            transparent: true,
                            opacity: transparency,
                            side: THREE.DoubleSide
                        });
                        child.material = material;
                    }
                });

                scene.add(model);
            });

            // Load collider.glb from second value and set full transparency
            const colliderGlb = firstLine[1];  // Second value for collider
            loader.load(`hulls/${colliderGlb}`, function (gltf) {
                colliderModel = gltf.scene;
//                colliderModel.rotation.y = Math.PI;

                colliderModel.traverse((child) => {
                    if (child.isMesh) {
                        child.visible = false;  // Make collider invisible

                    }
                });

                scene.add(colliderModel);
            });
        });
}


function loadModules() { 
    console.log("loadModules");
    const hullDropdown = document.getElementById('hullDropdown');
    const hull = hullDropdown.value;
    
    clearModules();  // Clear old cubes
    
    fetch(`hulls/${hull}.csv`)
        .then(response => response.text())
        .then(data => {
            const lines = data.split('\n').filter(Boolean);
            for (let i = 1; i < lines.length; i++) {
                const boxData = lines[i].split(',');
                // Convert values to numbers and adjust sizes
                const [type, x, y, z, rotX, rotY, rotZ, sizeX, sizeY, sizeZ] = boxData.map(Number);
                
                // Convert rotations from degrees to radians
                const rotXRadians = THREE.MathUtils.degToRad(rotX);
                const rotYRadians = THREE.MathUtils.degToRad(rotY);
                const rotZRadians = THREE.MathUtils.degToRad(rotZ);
                
                // Divide sizes by 4
                const newSizeX = sizeX / 4;
                const newSizeY = sizeY / 4;
                const newSizeZ = sizeZ / 4;

                let color;
                switch (type) {
                    case 0: color = 0xff0000; break;  // Red for type 0
                    case 1: color = 0x00ff00; break;  // Green for type 1
                    case 2: color = 0x0000ff; break;  // Blue for type 2
                    default: color = 0xffffff;
                }
                
                const geometry = new THREE.BoxGeometry(newSizeX, newSizeY, newSizeZ);
                const material = new THREE.MeshBasicMaterial({
                    color,
                    transparent: transparencybool, 
                    opacity: .7  
                });
                
                const cube = new THREE.Mesh(geometry, material);
                cube.position.set(x, y, z);
                cube.rotation.set(rotXRadians, rotYRadians, rotZRadians); // Set rotation in radians
                scene.add(cube);
                boxes.push(cube);  // Add the cube to the boxes array
            }
        });
}



// Clear all existing cubes
function clearModules() {
    console.log("clearModules");
    boxes.forEach(box => scene.remove(box));
    boxes = [];
}


function populateDropdownsFromCSV(data) {
    console.log("populateDropdownsFromCSV");
    const lines = data.split('\n').filter(Boolean);
  
    // Reset dropdown containers
    const mountingContent = document.getElementById('mountingDropdowns');
    const componentContent = document.getElementById('componentDropdowns');
    const moduleContent = document.getElementById('moduleDropdowns');
  
    mountingContent.innerHTML = '';
    componentContent.innerHTML = '';
    moduleContent.innerHTML = '';
      
    let mountCount = 1; // Initialized counter
    let moduleCount = 1; // Initialized counter
    let componentCount = 1; // Initialized counter

    // Process each line after the first (which contains metadata)
    for (let i = 1; i < lines.length; i++) {
        const rowData = lines[i].split(',');

        const category = parseInt(rowData[0]);
        const xPos = rowData[1]; // Example of using the position data
        const yPos = rowData[2];
        const zPos = rowData[3];

        // Create a dropdown item depending on the category
        let dropdownItem = document.createElement('div');
        
        if (category === 0) {
            dropdownItem.textContent = `mod ${mountCount}`;
            mountingContent.appendChild(dropdownItem); // Fixed dropdown reference
            mountCount++; // Increment mod counter
        } else if (category === 1) {
            dropdownItem.textContent = `com ${moduleCount}`;
            componentContent.appendChild(dropdownItem); // Fixed dropdown reference
            moduleCount++; // Increment compartment counter
        } else if (category === 2) {
            dropdownItem.textContent = `mod ${componentCount}`;
            moduleContent.appendChild(dropdownItem); // Fixed dropdown reference
            componentCount++; // Increment mod counter
        }
    }
}


// Load shell asset values from selected shell
function loadShellmodifers() {
	console.log("loadShellmodifers");
    const shellDropdown = document.getElementById('shellDropdown');
    const selectedShell = shellDropdown.value;
    if (selectedShell) {
		console.log(selectedShell);		
        fetch(`shells/${selectedShell}.asset`)
            .then(response => response.text())
            .then(data => {
                const lines = data.split('\n');
                lines.forEach(line => {
                    line = line.trim();
                    if (line.startsWith('_armorDamageRadius')) {
                        armorDamageRadius = parseFloat(line.split(':')[1]);
                    } else if (line.startsWith('_armorPenetration')) {
                        armorPenetration = parseFloat(line.split(':')[1]);
//                    } else if (line.startsWith('_rayAngle')) {
//                        rayAngle = parseFloat(line.split(':')[1]);
//                   } else if (line.startsWith('_explosionRadius')) {
//                        explosionRadius = parseFloat(line.split(':')[1]);
//                   } else if (line.startsWith('_componentDamage')) {
//                        rayAngle = parseFloat(line.split(':')[1]);
//						console.log(rayAngle);
//                    } else if (line.startsWith('_RayAngle:')) {
//                       rayAngle = parseFloat(line.split(':')[1]);
//						console.log(rayAngle);
                    }
                });
            });
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    checkIntersectionWithRays();  // Check for ray intersections
    controls.update();  // Update controls
    renderer.render(scene, camera);
}

//armorValue, internalDensity, armorPenetration,

function castRayAtModel() {
    // Get camera position and direction
    const cameraPosition = camera.position.clone();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    // Create a ray from the camera position in the direction it is facing
    const raycaster = new THREE.Raycaster(cameraPosition, cameraDirection);
    const intersects = raycaster.intersectObject(colliderModel);
	

    // Variables to store intersection points
    let firstIntersection = null;
    let secondIntersection = null;

    if (intersects.length > 0) {
        firstIntersection = intersects[0].point;

        if (intersects.length > 1) {
            secondIntersection = intersects[1].point;
        }
    }

    const lines = [];  // Array to hold the lines to be toggled

    // If intersections are found, draw lines
    if (firstIntersection) {
        // Draw red line from camera to the first intersection point
        const redLine = drawLine(cameraPosition, firstIntersection, 0xff0000);
        lines.push(redLine);

        if (secondIntersection) {
            // Calculate the direction from firstIntersection to secondIntersection
            const direction = new THREE.Vector3().subVectors(secondIntersection, firstIntersection).normalize();

            // Calculate the endpoint of the blue line using armorPenetration
            const blueLineEnd = firstIntersection.clone().add(direction.multiplyScalar(armorPenetration/4));
            const blueLine = drawLine(firstIntersection, blueLineEnd, 0x0000ff);
            lines.push(blueLine);
        }
    } else {
        // Draw green line if no intersections
        const endPoint = cameraPosition.clone().add(cameraDirection.multiplyScalar(100));  // Example far point
        const greenLine = drawLine(cameraPosition, endPoint, 0x00ff00);
        lines.push(greenLine);
    }

    // Log all the lines together
    logShell(lines);
}


// Function to clear all rays and log boxes from the scene and UI
function clearRaysAndLogs() {
    // Ensure the scene exists before attempting to traverse it
    if (scene) {
        // Find and remove all the lines in the scene that are currently drawn
        scene.traverse((object) => {
            if (object.isLine) {
                scene.remove(object);  // Remove the line from the scene
                object.geometry.dispose();  // Dispose of the geometry to free up memory
                object.material.dispose();  // Dispose of the material to free up memory
            }
        });
    } else {
        console.error("Scene is not defined.");
    }

    // Clear the ray log container (UI)
    const rayLogContainer = document.getElementById('ray-log-container');
    if (rayLogContainer) {
        while (rayLogContainer.firstChild) {
            rayLogContainer.removeChild(rayLogContainer.firstChild);  // Remove each log box
        }
    } else {
        console.error("ray-log-container not found.");
    }

    // Reset the ray index counter
    rayIndex = 0;
}


// Helper function to draw lines
function drawLine(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);
    scene.add(line);

    return line;  // Return the created line so it can be toggled
}


// Log the ray(s) in the UI
function logShell(lines) {
    const rayLogContainer = document.getElementById('ray-log-container');

    // Ensure the container exists in the DOM
    if (!rayLogContainer) {
        console.error('ray-log-container element not found in the DOM');
        return;
    }

    const rayLog = document.createElement('div');
    rayLog.className = 'ray-box';
    rayLog.textContent = `Ray ${rayIndex + 1}`;  // Ray log text
    rayLogContainer.appendChild(rayLog);

    // Make the ray-log clickable to toggle the visibility of multiple lines
    rayLog.addEventListener('click', () => {
        lines.forEach(line => {
            line.visible = !line.visible;  // Toggle visibility of each associated line
        });
        rayLog.classList.toggle('hidden-ray');  // Update UI class to indicate visibility
    });

    rayIndex++;  // Increment the ray index for the next ray
}


function createDecal(firstIntersection, normal) {
    const decalSize = 0.5;  // Size of the decal
    const decalGeometry = new THREE.PlaneGeometry(decalSize, decalSize);
    
    const decalMaterial = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('pngs/Red X.png'),  // Replace with your decal texture path
        transparent: true,
        depthWrite: false,
        depthTest: false
    });

    const decal = new THREE.Mesh(decalGeometry, decalMaterial);
    decal.position.copy(position);

    // Orient the decal to face the normal of the surface
    // Calculate the rotation from the normal vector to the plane
    const upVector = new THREE.Vector3(0, 0, 1);  // Default up direction for the decal
    const rotationAxis = new THREE.Vector3().crossVectors(upVector, normal).normalize();
    const angle = Math.acos(upVector.dot(normal));
    
    // Apply rotation to the decal
    decal.quaternion.setFromAxisAngle(rotationAxis, angle);

    // Add the decal to the scene
    scene.add(decal);
}


function createDecalAtFirstIntersection(intersectionPoint, normal) {
    const decalWidth = 1; // Set your desired decal width
    const decalHeight = 1; // Set your desired decal height
    const decalDepth = 0.01; // Thickness of the decal

    // Create the decal geometry
    const decalGeometry = new THREE.DecalGeometry(yourModel, intersectionPoint, normal, new THREE.Vector3(decalWidth, decalHeight, decalDepth));

    // Create a material for the decal
    const decalMaterial = new THREE.MeshStandardMaterial({
        map: yourDecalTexture, // Assign your decal texture
        depthTest: true,
        depthWrite: false,
        transparent: true,
        opacity: 1,
    });

    // Create the decal mesh
    const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);
    scene.add(decalMesh); // Add the decal to your scene
}




