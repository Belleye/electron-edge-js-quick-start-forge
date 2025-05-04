window.api.send("run");

// Global variables to store spec and data
let vegaSpec = null;
let sqlData = null;
let vegaEmbed = window.vegaEmbed; // Assuming vegaEmbed is globally available from vendor script

// Function to attempt rendering the Vega chart
function renderVegaChart() {
    if (vegaSpec && sqlData && vegaEmbed) {
        // Ensure the data format matches what Vega expects (e.g., an object with a 'values' array)
        // The spec likely references a data source name, e.g., "raw"
        // We need to inject the sqlData under that name.
        const dataName = "raw"; // Explicitly use the name expected by the spec

        console.log(`Attempting to embed Vega chart with data source name: ${dataName}`);

        // --- Inject SQL data into the correct data source object --- 
        // Clone the spec to avoid modifying the original
        const viewSpec = JSON.parse(JSON.stringify(vegaSpec)); 

        // Find the data source object within the data array
        let targetDataSource = null;
        if (Array.isArray(viewSpec.data)) {
            targetDataSource = viewSpec.data.find(d => d.name === dataName);
        } else if (viewSpec.data && viewSpec.data.name === dataName) { // Handle case where data is a single object
            targetDataSource = viewSpec.data;
        }

        if (targetDataSource) {
            console.log(`Found data source '${dataName}', injecting SQL data.`);
            // Remove the URL property if it exists
            delete targetDataSource.url;
            // Add the values property with our SQL data
            targetDataSource.values = sqlData;
        } else {
            console.error(`Data source named '${dataName}' not found in the Vega spec.`);
            // Optionally handle this error, e.g., display a message
            // For now, we'll proceed, but Vega will likely fail
        }

        vegaEmbed('#vegaVisContainer', viewSpec, { actions: false }) // Embed with updated spec
            .then(result => console.log("Vega chart embedded successfully:", result.view))
            .catch(error => console.error("Error embedding Vega chart:", error));
    } else {
        console.log('Waiting for Vega spec and/or SQL data...');
        if (!vegaEmbed) console.error("vegaEmbed function not found. Ensure vendor scripts are loaded.");
    }
}

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
            // Store the data and attempt to render
            sqlData = data; 
            renderVegaChart();
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

// --- Request Vega Spec --- 
console.log("Requesting Vega spec...");
window.api.send("getVegaSpec");

// --- Handle Received Vega Spec ---
window.api.receive("vegaSpecData", (data) => {
    if (data.error) {
        console.error("Error receiving Vega spec:", data.error);
        // Display error in the Vega container
        const vegaContainer = document.getElementById('vegaVisContainer');
        if (vegaContainer) {
            vegaContainer.textContent = `Error loading Vega spec: ${data.error}`;
            vegaContainer.style.color = 'red';
        }
    } else {
        console.log("Vega spec received successfully.");
        vegaSpec = data.spec;
        // Attempt to render the chart now that the spec is loaded
        renderVegaChart();
    }
});

// Add event listener for the reload button
document.addEventListener('DOMContentLoaded', () => {
    const reloadButton = document.getElementById('reloadSqlButton');
    if (reloadButton) {
        reloadButton.addEventListener('click', () => {
            console.log('Reload SQL button clicked');
            // Set the results area to 'Loading...' state
            const resultElement = document.getElementById('sqlQueryResults');
            if(resultElement) {
                resultElement.textContent = 'Reloading...';
                resultElement.style.color = 'black'; // Reset color
            }
            // Send message to main process to re-run the SQL query
            window.api.send("runSql", "execute"); // Using "runSql" as the channel
        });
    } else {
        console.error('Reload SQL button not found');
    }
});
