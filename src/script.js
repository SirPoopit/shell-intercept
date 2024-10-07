import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { penHeatMap } from './components/penHeatMap.js'
import  { createLine, createCone, createSphere } from './components/generateGeometry.js'
import  { getOutcome } from './components/getOutcome.js'
import  { penVisualiser } from './components/penVisualiser.js'


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
const rayLogContainer = document.getElementById('ray-log-container');
const button = document.getElementById("toggleHeatMap");
let castType;
let armorValue;
let internalDensity;
let armorPenetration;
let armorDamageRadius;
let explosionRadius;
let intervalId = null;
let isPenVisualiserToggledOn = false;
let isHeatMapToggledOn = false;
let rayIndex = 0;
let munitionsToggle = true;
const lines = [];
let colliderVisibility = false;
let modelVisibility = true;
let modelTransparency = .4;
let cubeTransparencyBool = false;
let intersectionPoint, intersectionNormal;
let hulldata;
let localArmorStrip;

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

document.getElementById('toggleHeatMap').addEventListener('click', function() {
	 if (isHeatMapToggledOn) {
		 
		modelTransparency = .4;
		colliderVisibility = false;
        clearInterval(intervalId);
        intervalId = null;
        isHeatMapToggledOn = false;
		loadhull()
    } else {
		modelTransparency = .1;
		colliderVisibility = true;
        intervalId = setInterval(penHeatMapUpdater, 100);
        isHeatMapToggledOn = true;
		loadhull()
    }
});

document.getElementById('togglePenVisualiser').addEventListener('click', function() {
	 if (isPenVisualiserToggledOn) {
		 
		modelTransparency = .4;
		colliderVisibility = false;
        clearInterval(intervalId);
        intervalId = null;
        isPenVisualiserToggledOn = false;
		loadhull()
    } else {
		modelTransparency = .1;
		colliderVisibility = true;
        intervalId = setInterval(penVisualiserUpdater, 100);
        isPenVisualiserToggledOn = true;
		loadhull()
    }
});

document.getElementById('munitionsToggle').addEventListener('click', function() {
	 if (munitionsToggle) {
		 
        munitionsToggle = false;
    } else {
	
        munitionsToggle = true;

    }
});

function penHeatMapUpdater(){
	penHeatMap(camera, colliderModel);
}

function penVisualiserUpdater(){
	penVisualiser(camera, colliderModel, armorPenetration, armorValue, internalDensity);
}

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
//		console.log(munitionsToggle)	
		if(munitionsToggle = false) {
//		console.log(munitionsToggle)	
        castShellAtModel(armorValue, internalDensity, armorPenetration, armorDamageRadius, explosionRadius, castType);  // Cast the ray at the model when space is pressed

		} else {
		castShellAtModel(armorValue, internalDensity, armorPenetration, armorDamageRadius, explosionRadius, castType);  // Cast the ray at the model when space is pressed

//		console.log(munitionsToggle)		
//		castMissileAtModel()
		
		}
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



function castMissileAtModel() {
	
	console.log("hi :3");
	
}



// Function to load missile.csv and populate the missile dropdown
function loadMissileCSV() {
    fetch('missile.csv')
        .then(response => response.text())
        .then(data => {
            const lines = data.split('\n');
            const dropdown = document.getElementById('missileDropdown');
            lines.forEach(line => {
                const columns = line.split(',');
                const option = document.createElement('option');
                option.value = columns[0];
                option.textContent = columns[0]; // Display the missile name
                dropdown.appendChild(option);
            });

            // Add event listener to the dropdown to update input limits
            dropdown.addEventListener('change', updateInputLimits);
        })
        .catch(error => console.error('Error loading missile.csv:', error));
}

// Function to update number input limits based on selected missile
function updateInputLimits() {
    const dropdown = document.getElementById('missileDropdown');
    const selectedMissile = dropdown.value;
    const lines = fetch('missile.csv')
        .then(response => response.text())
        .then(data => {
            const rows = data.split('\n');
            for (let row of rows) {
                const columns = row.split(',');
                if (columns[0] === selectedMissile) {
                    const minValue = parseFloat(columns[1]);
                    const maxValue = parseFloat(columns[2]);
                    const numberInput = document.getElementById('numberInput');
                    numberInput.setAttribute('min', minValue);
                    numberInput.setAttribute('max', maxValue);
                    numberInput.value = minValue; // Set to min value initially
                    break;
                }
            }
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
            armorValue = parseFloat(firstLine[0]);
            internalDensity = parseFloat(firstLine[1]);

            loader.load(`hulls/${hull}.glb`, function (gltf) {
                model = gltf.scene;
                model.rotation.y = Math.PI;  // Flip model 180 degrees

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.visible = modelVisibility;
                        const material = new THREE.MeshBasicMaterial({
                            color: 0xffffff,
                            transparent: true,
                            opacity: modelTransparency,
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
					child.visible = colliderVisibility;
                        child.material = new THREE.MeshBasicMaterial({
                            vertexColors: true, // Ensure this is set
                            color: 0xffffff,
                            transparent: false,
                            side: THREE.DoubleSide
                        });

                        // Set up vertex colors
                        const geometry = child.geometry;
                        if (geometry instanceof THREE.BufferGeometry) {
                            const positionAttribute = geometry.attributes.position;
                            const colorAttribute = geometry.attributes.color || new THREE.Float32BufferAttribute(positionAttribute.count * 3, 3);

                            // Initialize color attribute
                            for (let i = 0; i < positionAttribute.count; i++) {
                                colorAttribute.setXYZ(i, 1, 1, 1); // Default to white
                            }
                            geometry.setAttribute('color', colorAttribute);
                        }
                    }
                });

                scene.add(colliderModel);
            });

		clearModules();
		loadModules();
        });
}


function isInsideModel() {
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
		cubeTransparencyBool = false;
        modelTransparency = 0.4;
        cameraInsideModel = false;
		clearModules();
		loadModules();
    } else if (isCameraInside && !cameraInsideModel) {
		cubeTransparencyBool = true;
        modelTransparency = 0.8; 
        cameraInsideModel = true; 
		clearModules();
		loadModules();
    }
}


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


function setHullDropdown(hullType) {
    const dropdown = document.getElementById("hullDropdown");
    const options = dropdown.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].text.includes(hullType)) {
            dropdown.selectedIndex = i;
            reloadScene();
            break;
        }
    }
}


function loadModules() { 
    console.log("loadModules");
    const hullDropdown = document.getElementById('hullDropdown');
    const hull = hullDropdown.value;

    
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
                    case 0: color = 0x00ff00; break;
                    case 1: color = 0x0000ff; break;
                    case 2: color = 0xff0000; break;
                    default: color = 0xffffff;
                }
                
                const geometry = new THREE.BoxGeometry(newSizeX, newSizeY, newSizeZ);
                const material = new THREE.MeshBasicMaterial({
                    color,
                    transparent: cubeTransparencyBool, 
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


function clearModules() {
    console.log("clearModules");
    boxes.forEach(box => scene.remove(box));
    boxes = [];
}


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
						console.log("armorDamageRadius", armorDamageRadius)
                    } else if (line.startsWith('_armorPenetration')) {
                        armorPenetration = parseFloat(line.split(':')[1]);
						console.log("armorPenetration", armorPenetration)
                    } else if (line.startsWith('_castType')) {
                        castType = parseFloat(line.split(':')[1]);
						console.log("castType", castType)
                   } else if (line.startsWith('_explosionRadius')) {
                        explosionRadius = parseFloat(line.split(':')[1]);
						console.log("explosionRadius", explosionRadius)
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
  let  rayIndex = 0;
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






function castShellAtModel() {
	
	localArmorStrip = 0;

    // Get camera position and direction
    const cameraPosition = camera.position.clone();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    // Create a ray from the camera position in the direction it is facing
    const raycaster = new THREE.Raycaster(cameraPosition, cameraDirection);
    const intersects = raycaster.intersectObject(colliderModel);

    // Variables to store intersection points and normal
    let firstIntersection = null;
    let secondIntersection = null;
    let intersectionNormal = null;

    if (intersects.length > 0) {
        firstIntersection = intersects[0].point;
        intersectionNormal = intersects[0].face.normal.clone();
		
		intersectionNormal.applyMatrix3(
			new THREE.Matrix3().getNormalMatrix(intersects[0].object.matrixWorld)
			).normalize();

        if (intersects.length > 1) {
            secondIntersection = intersects[1].point;
        }
    }
	
    if (firstIntersection) {
		getOutcome(scene, cameraPosition, cameraDirection, armorValue, internalDensity, armorPenetration, armorDamageRadius, explosionRadius, castType, localArmorStrip, firstIntersection, secondIntersection, intersectionNormal, boxes)
		
    } else {
        // Draw green line if no intersections
        const endPoint = cameraPosition.clone().add(cameraDirection.multiplyScalar(100));  // Example far point
        const greenLine = createLine(scene, cameraPosition, endPoint, 0x00ff00);
        lines.push(greenLine);
    }

//    logShell(lines);
}






function animate() {
	isInsideModel();
    requestAnimationFrame(animate);
    controls.update();  // Update controls
    renderer.render(scene, camera);
}
