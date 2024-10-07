import * as THREE from 'three';



export function createLine(scene, firstPoint, secondPoint, color) {
    const material = new THREE.LineBasicMaterial({ color: color });
    const geometry = new THREE.BufferGeometry().setFromPoints([firstPoint, secondPoint]);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    return line;
}

export function createCone(scene, firstPoint, angle, secondPoint, color) {
    // Calculate the direction and length between firstPoint and secondPoint
    const direction = new THREE.Vector3().subVectors(secondPoint, firstPoint);
    const length = direction.length();
    direction.normalize();

    // Create cone geometry based on length and angle
    const radius = Math.tan(angle) * length; // Calculate radius of the cone's base
    const geometry = new THREE.ConeGeometry(radius, length, 32); // Create a cone geometry
    const material = new THREE.MeshBasicMaterial({ color: color });

    const cone = new THREE.Mesh(geometry, material);

    // Align the cone to the direction vector
    cone.position.copy(firstPoint);
    cone.lookAt(secondPoint);

    scene.add(cone);
    return cone;
}

export function createSphere(scene, firstPoint, radius, color) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32); // Sphere with the given radius
    const material = new THREE.MeshBasicMaterial({
						color: color,
						transparent: false,
						opacity: .5,
						side: THREE.DoubleSide
});
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(firstPoint); // Place sphere at the firstPoint

    scene.add(sphere);
    return sphere;
}

