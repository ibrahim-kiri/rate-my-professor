// dimensionReduction.js

/**
 * Performs random projection to reduce the dimensionality of a vector.
 * @param {number[]} vector - The input vector to be reduced.
 * @param {number} targetDim - The target dimension.
 * @returns {number[]} The reduced vector.
 */
export function randomProjection(vector, targetDim) {
    if (vector.length <= targetDim) {
        console.warn(`Vector dimension (${vector.length}) is already <= target dimension (${targetDim}). No reduction performed.`);
        return vector;
    }

    const projectionMatrix = generateRandomMatrix(targetDim, vector.length);
    return multiplyMatrixVector(projectionMatrix, vector);
}

function generateRandomMatrix(rows, cols) {
    return Array(rows).fill().map(() => 
        Array(cols).fill().map(() => (Math.random() * 2 - 1) / Math.sqrt(cols))
    );
}

function multiplyMatrixVector(matrix, vector) {
    return matrix.map(row => 
        row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
}