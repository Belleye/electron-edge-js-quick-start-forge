window.api.send("run");
window.api.receive("fromMain", (documentId, data) => {
    // Handle SQL Query results separately
    if (documentId === 'sqlQueryResults') {
        const resultElement = document.getElementById('sqlQueryResults');
        if (data && data.error) {
            // Display error message
            resultElement.textContent = `Error: ${data.error}\nStackTrace: ${data.stackTrace || 'N/A'}`;
            resultElement.style.color = 'red'; 
        } else {
            // Display successful results
            resultElement.textContent = JSON.stringify(data, null, 2);
            resultElement.style.color = 'black'; // Reset color on success
        }
    } else {
        // Handle other messages as before
        const targetElement = document.getElementById(documentId);
        if (targetElement) {
            targetElement.innerHTML = data;
        } else {
            console.warn(`Element with ID '${documentId}' not found.`);
        }
    }
});
