import * as THREE from 'three';
import  { createLine, createCone, createSphere } from './generateGeometry.js'


export function getOutcome(scene, cameraPosition, cameraDirection, armorValue, internalDensity, armorPenetration, armorDamageRadius, explosionRadius, castType, localArmorStrip, firstIntersection, secondIntersection, intersectionNormal, boxes){
 

    const lines = [];

	// Draw red line from camera to the first intersection point
	const redLine = createLine(scene, cameraPosition, firstIntersection, 0xff0000);
	lines.push(redLine);

	// Calculate the angle between the ray and the normal at the intersection
	const angleToNormal = cameraDirection.angleTo(intersectionNormal); // Angle in radians
	const angleToNormalDeg = angleToNormal * (180 / Math.PI);  // Convert to degrees

	// Calculate angled armor based on the cosine of the angle to the normal
	const angledArmor = ((armorValue * 10) / Math.cos(angleToNormal)) / -10;
			
	// Case logic
	if (angleToNormalDeg < 110) {
		// "bounce" case: Reflect a green ray
		const reflectedDirection = cameraDirection.clone().reflect(intersectionNormal);
		const bounceEndPoint = firstIntersection.clone().add(reflectedDirection.multiplyScalar(100));
		const bounceLine = createLine(scene, firstIntersection, bounceEndPoint, 0x00ff00);
		console.log("bounce")
		console.log(angleToNormalDeg)
		lines.push(bounceLine);
	} else if (armorPenetration <= (angledArmor - localArmorStrip)) {
		// "nonpen" case: No additional geometry
		// No need to add anything here, just a check
		console.log("hit")
		//console.log(armorPenetration-angledArmor)
	} else if (armorPenetration > (angledArmor - localArmorStrip) + ((firstIntersection.distanceTo(secondIntersection)) * 10 * internalDensity)) {
		// "overpen" case: Continue red line through the model
		const overpenEndPoint = cameraPosition.clone().add(cameraDirection.multiplyScalar(100)); // Example far point
		const overpenLine = createLine(scene, firstIntersection, overpenEndPoint, 0xff0000);
		console.log("overpen");
		lines.push(overpenLine);
	} else if (castType === 0) {
		// "HE" case: Draw blue line and explosion sphere
		const blueLineDistance = (armorPenetration - (angledArmor - localArmorStrip)) / internalDensity / 10 ;
		const blueLineEnd = firstIntersection.clone().add(cameraDirection.multiplyScalar(blueLineDistance));
		const blueLine = createLine(scene, firstIntersection, blueLineEnd, 0x0000ff);
		console.log("HE pen")
		lines.push(blueLine);

		// Draw explosion sphere at 80% of the blue line
		const explosionPoint = firstIntersection.clone().lerp(blueLineEnd, 0.85);
		const explosionSphere = createSphere(scene, explosionPoint, explosionRadius, 0xff0000);
		lines.push(explosionSphere);
	} else if (castType === 2) {
		
		const direction = new THREE.Vector3().subVectors(secondIntersection || firstIntersection, firstIntersection).normalize();
		const penetrationDistance = (armorPenetration - (angledArmor - localArmorStrip)) / internalDensity / 10;  // Distance for the blue line if no box is hit

		// Use raycaster to check for intersections with box objects
		const boxRaycaster = new THREE.Raycaster(firstIntersection, direction);
		const boxIntersects = boxRaycaster.intersectObjects(boxes);  // Assuming boxes contains your box geometries

		let blueLineEnd;

		if (boxIntersects.length > 0) {
			// If we hit a box, stop the blue line at the intersection point with the box
			blueLineEnd = boxIntersects[0].point;
		} else {
			// If no box is hit, extend the blue line by armorPenetration
			blueLineEnd = firstIntersection.clone().add(direction.multiplyScalar(penetrationDistance));
		}

		const blueLine = createLine(scene, firstIntersection, blueLineEnd, 0x0000ff);
		console.log("AP pen");	
		lines.push(blueLine);

	}



//function logShell(lines) {
	let rayIndex = 0;
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
		console.log(lines);
        lines.forEach(line => {
            line.visible = !line.visible;  // Toggle visibility of each associated line
        });
        rayLog.classList.toggle('hidden-ray');  // Update UI class to indicate visibility
    });

    rayIndex++;  // Increment the ray index for the next ray
//}








	}

	
	