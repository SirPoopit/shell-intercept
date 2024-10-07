

    // --- BFS function to find all adjacent vertices on the same face ---
export function bfs(startVertex, positionArray, indexArray) {
	const queue = [startVertex];
	const visited = new Set([startVertex]);
	const adjacentVertices = [];

	while (queue.length > 0) {
		const currentVertex = queue.shift();
		adjacentVertices.push(currentVertex);

		// Find adjacent vertices by checking shared edges
		for (let i = 0; i < indexArray.length; i += 3) {
			const a = indexArray[i];
			const b = indexArray[i + 1];
			const c = indexArray[i + 2];

			const faceVertices = [a, b, c];

			if (faceVertices.includes(currentVertex)) {
				faceVertices.forEach(v => {
					if (!visited.has(v)) {
						visited.add(v);
						queue.push(v);
					}
				});
			}
		}
	}

	return adjacentVertices;
}