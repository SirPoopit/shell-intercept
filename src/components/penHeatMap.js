import * as THREE from 'three';
import { bfs } from '../utils/vertices.js'




export function penHeatMap(camera, colliderModel) {
    // --- Custom Color Definitions ---
    const color1 = 0xfcf48d;
    const color2 = 0xe94e0d;
    const color3 = 0xb00f9e;
    const color4 = 0x12007a;

    const tweakValue = 0;


    // --- Ray from the camera ---
    const cameraPosition = camera.position.clone();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    const rayStart = cameraPosition.clone();
    const rayEnd = cameraPosition.clone().add(cameraDirection.multiplyScalar(2)); // Ray extends 2 units from the camera

    // Remove the red line visualization for the ray

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

                // Map the angle from 113.5-180 to 1-0 and apply tweakValue
                if (angleDegrees >= 113.5 && angleDegrees <= 180) {
                    let mappedValue = 1 - ((angleDegrees - 113.5) / (180 - 113.5)); // 113.5° becomes 1, 180° becomes 0
                    mappedValue = Math.min(Math.max(mappedValue + tweakValue, 0), 1);  // Apply tweak and clamp between 0 and 1

                    // Get interpolated color based on the mapped value
                    const interpolatedColor = interpolateColors([color1, color2, color3, color4], mappedValue);

                    const { r, g, b } = interpolatedColor;

                    // BFS to find all adjacent vertices to the current face
                    const adjacentVertices = [
                        ...bfs(a, positionArray, indexArray),
                        ...bfs(b, positionArray, indexArray),
                        ...bfs(c, positionArray, indexArray),
                    ];

                    // Apply the color to each adjacent vertex
                    adjacentVertices.forEach(vertex => {
                        colors[vertex * 3] = r;
                        colors[vertex * 3 + 1] = g;
                        colors[vertex * 3 + 2] = b;
                    });
                }
            }

            // Update the geometry with the new colors
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
		
    });
}

// --- Color Interpolation Function ---
function interpolateColors(colors, t) {
	const [c1, c2, c3, c4] = colors.map((hex) => {
		const r = (hex >> 16 & 0xff) / 255;
		const g = (hex >> 8 & 0xff) / 255;
		const b = (hex & 0xff) / 255;
		return { r, g, b };
	});

	if (t <= 0.33) {
		const factor = t / 0.33;
		return {
			r: c1.r + factor * (c2.r - c1.r),
			g: c1.g + factor * (c2.g - c1.g),
			b: c1.b + factor * (c2.b - c1.b),
		};
	} else if (t <= 0.66) {
		const factor = (t - 0.33) / 0.33;
		return {
			r: c2.r + factor * (c3.r - c2.r),
			g: c2.g + factor * (c3.g - c2.g),
			b: c2.b + factor * (c3.b - c2.b),
		};
	} else {
		const factor = (t - 0.66) / 0.34;
		return {
			r: c3.r + factor * (c4.r - c3.r),
			g: c3.g + factor * (c4.g - c3.g),
			b: c3.b + factor * (c4.b - c3.b),
		};
	}
}