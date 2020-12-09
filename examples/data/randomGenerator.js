function getRandomData(rows, columns) {
    const output = [];

    for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < columns; j++) {
            row.push(Math.random());
        }
        output.push(row);
    }

    return output;
}
