import * as THREE from 'three';
import { bfs } from '../utils/vertices.js'



export function penVisualiser(camera, colliderModel, armorPenetration, armorValue, internalDensity) {
	
let localArmorStrip = 0;

    const color1 = 0x0000ff; // Color for condition 1
    const color2 = 0xff0000; // Color for condition 2
    const color3 = 0x00ff00; // Color for condition 3
    const color4 = 0x550000; // Color for condition 4



    // --- Custom Color Definitions ---
//    const color1 = 0xfcf48d; // Color for condition 1
//    const color2 = 0xe94e0d; // Color for condition 2
//    const color3 = 0xb00f9e; // Color for condition 3
//    const color4 = 0x12007a; // Color for condition 4

    // --- Ray from the camera ---
    const cameraPosition = camera.position.clone();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    // --- Traverse all children of colliderModel ---
    colliderModel.traverse((child) => {
        if (child.isMesh) {
            const geometry = child.geometry;

            // Ensure geometry has vertex colors
            let colors = geometry.attributes.color ? geometry.attributes.color.array : new Float32Array(geometry.attributes.position.count * 3);

            // Initialize colors to white if no vertex colors are set
            if (!geometry.attributes.color) {
                for (let i = 0; i < colors.length; i += 3) {
                    colors[i] = 1.0;   // Red component
                    colors[i + 1] = 1.0; // Green component
                    colors[i + 2] = 1.0; // Blue component (white color)
                }
            }

            // Iterate through each face (triangle) in the geometry
            const indexArray = geometry.index.array;
            const positionArray = geometry.attributes.position.array;
            for (let i = 0; i < indexArray.length; i += 3) {
                const a = indexArray[i];
                const b = indexArray[i + 1];
                const c = indexArray[i + 2];

                // Get the vertices of the face
                const vA = new THREE.Vector3(
                    positionArray[a * 3],
                    positionArray[a * 3 + 1],
                    positionArray[a * 3 + 2]
                );
                const vB = new THREE.Vector3(
                    positionArray[b * 3],
                    positionArray[b * 3 + 1],
                    positionArray[b * 3 + 2]
                );
                const vC = new THREE.Vector3(
                    positionArray[c * 3],
                    positionArray[c * 3 + 1],
                    positionArray[c * 3 + 2]
                );

                // Compute the face normal
                const faceNormal = new THREE.Vector3()
                    .subVectors(vC, vB)
                    .cross(new THREE.Vector3().subVectors(vA, vB))
                    .normalize();

                // Apply the object's matrix transformations to the normal
                faceNormal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(child.matrixWorld)).normalize();

                // Calculate the angle between the face normal and the camera direction
                const angleRadians = faceNormal.angleTo(cameraDirection);
                const angleDegrees = THREE.MathUtils.radToDeg(angleRadians);

                // Map the angle to a value for color assignment
//                let mappedValue = 1 - ((angleDegrees - 113.5) / (180 - 113.5)); // 113.5° becomes 1, 180° becomes 0
//                mappedValue = Math.min(Math.max(mappedValue, 0), 1);  // Clamp between 0 and 1

				const angledArmor = ((armorValue * 10) / Math.cos(angleRadians)) / -10;

                // Color assignment based on armorPen, armorValue, internalDensity, and mappedValue
                let assignedColor;
                if (angleDegrees < 110) {
                    assignedColor = color1; // Condition for color 1
                } else if (armorPenetration < (angledArmor - localArmorStrip)) {
                    assignedColor = color2; // Condition for color 2
                } else if (armorPenetration < angledArmor + armorValue) {
                    assignedColor = color3; // Condition for color 3
                } else if (armorPenetration >= angledArmor + armorValue) {
                    assignedColor = color4; // Condition for color 4
                } else {
                    assignedColor = 0x000000; // Default color
                }

                // BFS to find all adjacent vertices to the current face
                const adjacentVertices = [
                    ...bfs(a, positionArray, indexArray),
                    ...bfs(b, positionArray, indexArray), // Using bIndex here
                    ...bfs(c, positionArray, indexArray),
                ];

                // Apply the assigned color to each adjacent vertex
                const { r: red, g: green, b: blue } = new THREE.Color(assignedColor); // Renamed destructured variables

                adjacentVertices.forEach(vertex => {
                    colors[vertex * 3] = red;
                    colors[vertex * 3 + 1] = green;
                    colors[vertex * 3 + 2] = blue;
                });
            }

            // Update the geometry with the new colors
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
    });
}