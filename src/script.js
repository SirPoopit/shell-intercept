import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);  // FOV set to 60
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
let data = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredBox = null;


animate();
loadShellsIntoDropdown('shells.txt', 'shellDropdown');
document.getElementById('shellDropdown').addEventListener('change', loadShellmodifers);
document.getElementById('hullDropdown').addEventListener('change', loadModules);
document.getElementById('hullDropdown').addEventListener('change', loadhull);
document.getElementById('hullDropdown').addEventListener('change', clearRaysAndLogs);
const rayLogContainer = document.getElementById('ray-log')
let armorValue, internalDensity, armorPenetration, armorDamageRadius;
let transparency = .4;
let transparencybool = false;
let intersectionPoint, intersectionNormal;
let hulldata;

let cameraInsideModel = true;  // Track if the camera is inside the model
let debounceTimer = null;  // To prevent rapid reloading

window.addEventListener('mousemove', onMouseMove);


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

document.getElementById('reloadSceneButton').addEventListener('click', function() {
    reloadScene();  // Calls reloadScene from your existing script.js
});

document.getElementById('populate').addEventListener('click', function() {
    populateMenus(hullData);  // Calls reloadScene from your existing script.js
});


document.getElementById('HEKP').addEventListener('click', function() {
    createDamageGeometry(175);  // Calls reloadScene from your existing script.js
});



document.getElementById('clearScene').addEventListener('click', function() {
    clearScene();
});



// JavaScript to handle the file input and download the selected .ship file
document.getElementById('uploadShipFile').addEventListener('click', function() {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.ship')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const fileContent = e.target.result;
            console.log('Selected .ship file content:', fileContent);
            parseXML(fileContent)
        };
        reader.readAsText(file);
    } else {
        alert('Please select a valid .ship file.');
    }
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


function clearScene() {
	console.log('clearScene');
	clearRaysAndLogs();
    clearModules();  
    scene.remove(model); 
    scene.remove(colliderModel); 
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
        .then(hullData => {
            const lines = hullData.split('\n').filter(Boolean);
            hullData = lines.map(line => line.split(',')); // Store CSV data for key matching
            const firstLine = lines[0].split(',');
			const armorValue = firstLine[0];
			const internaldensity = firstLine[1];
            
            loader.load(`hulls/${hull}.glb`, function (gltf) {
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
            loader.load(`hulls/${hull} Collider.glb`, function (gltf) {
                colliderModel = gltf.scene;
                colliderModel.traverse((child) => {
                    if (child.isMesh) {
                        child.visible = false;  // Make collider invisible
                    }
                });

                scene.add(colliderModel);
            });
            
            loadModules(); // Trigger module loading after hull is loaded
//			populateMenus(hullData)
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


function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(boxes);

    if (hoveredBox) {
        hoveredBox.material.color.set(hoveredBox.userData.originalColor);  // Reset color
        hoveredBox = null;
    }

    if (intersects.length > 0) {
        hoveredBox = intersects[0].object;
        if (!hoveredBox.userData.originalColor) {
            hoveredBox.userData.originalColor = hoveredBox.material.color.getHex();
        }
        hoveredBox.material.color.set(0xffff00);  // Highlight color
    }
}


// Clear all existing cubes
function clearModules() {
    console.log("clearModules");
    boxes.forEach(box => scene.remove(box));
    boxes = [];
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

            // Calculate the distance between the two intersection points (penetration depth)
            const penetrationDepth = 18.5; //firstIntersection.distanceTo(secondIntersection);

            // Call createDamageGeometry to generate the damage geometry at the first intersection point
            createDamageGeometryAtPoint(firstIntersection, direction, penetrationDepth);

            // Calculate the endpoint of the blue line using armorPenetration
            const blueLineEnd = firstIntersection.clone().add(direction.multiplyScalar(armorPenetration / 4));
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

// Helper function to create damage geometry at the first intersection point
function createDamageGeometryAtPoint(firstIntersection, direction, penetrationDepth) {
    // Adjust the penetration depth by subtracting armor value
    const adjustedPenetrationDepth = penetrationDepth - 0;

    // Part 1: Create a 10m wide cylinder that extends to adjustedPenetrationDepth
    const cylinderRadius = .5; // Radius is half of 10 meters
    const cylinderHeight = adjustedPenetrationDepth;
    const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 32);
    const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true});  // Solid red material
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

    // Set the cylinder's position: The midpoint of the cylinder should be halfway along its height.
    const halfHeight = cylinderHeight / 2;
    const startPoint = firstIntersection.clone();  // Start at the first intersection
    const midpoint = startPoint.clone().add(direction.clone().multiplyScalar(halfHeight));  // Move halfway along the direction of the ray

    // Set the cylinder's position at the midpoint
    cylinder.position.copy(midpoint);

    // Align the cylinder's axis with the ray direction
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

    // Add the cylinder to the scene
    scene.add(cylinder);

    // Part 2: Create spheres every 6.6m, scaling radii
    const sphereCount = Math.floor(adjustedPenetrationDepth / .66);
    let sphereRadius;
    
    for (let i = 0; i < sphereCount; i++) {
        let distance = i * .66;
        if (i <= 17) {
            sphereRadius = THREE.MathUtils.lerp(.75, 2.5, i / 17); // Scaling up to 25 meters by the 18th sphere
			console.log(sphereRadius);
        } else {
            sphereRadius = THREE.MathUtils.lerp(2.5, .75, (i - 18) / 8); // Scaling back down to 7.5 meters by the 26th sphere
			console.log(sphereRadius);
        }

        // Create the sphere at the given distance
        const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });  // Solid green material
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

        // Position sphere along the direction
        const spherePosition = startPoint.clone().add(direction.clone().multiplyScalar(distance));
        sphere.position.copy(spherePosition);

        // Add the sphere to the scene
        scene.add(sphere);
    }
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













function parseXML(fileContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");

    // Extract the hull type (e.g., FF_Moxella from Falcata Republic/FF_Moxella)
    const hullType = xmlDoc.querySelector("HullType").textContent.split("/").pop();
    setHullDropdown(hullType); // Implement this to set the hull dropdown

    // Extract HullSockets and their components
    const hullSockets = xmlDoc.querySelectorAll("HullSocket");
    hullSockets.forEach(socket => {
        const key = socket.querySelector("Key").textContent;
        const componentName = socket.querySelector("ComponentName").textContent;
        updateComponentInUI(key, componentName); // Implement this
    });
}

function setHullDropdown(hullType) {
    const dropdown = document.getElementById("hullDropdown");
    const options = dropdown.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].text.includes(hullType)) {
            dropdown.selectedIndex = i;
            // Trigger the necessary reload or update after selection
            reloadScene();
            break;
        }
    }
}

function findMatchingRowByKey(key) {
    // Assume hullData is the already loaded array from `hull.csv`
    for (let i = 0; i < hullData.length; i++) {
        if (hullData[i][10] === key) { // 11th column (index 10)
            return i;
        }
    }
    return -1; // Not found
}

function updateComponentInUI(key, componentName) {
    const rowIndex = findMatchingRowByKey(key);
    if (rowIndex !== -1) {
        const componentRow = document.querySelector(`#componentRow${rowIndex}`);
        if (componentRow) {
            const rightBox = componentRow.querySelector(".right-box");
            rightBox.textContent = componentName;
        }
    }
}























