const { ipcMain } = require("electron");

const log = require("electron-log");
const path = require("path");
var net = 'core';
var framework = net.charAt(0).toUpperCase() + net.substr(1);
log.info("framework: " + framework);
process.env.EDGE_USE_CORECLR = 1;
log.info("EDGE_USE_CORECLR: " + process.env.EDGE_USE_CORECLR);

try {
  log.info(module.paths);
  let baseNetAppPath = path.join(__dirname, '/src/QuickStart.Core/bin/Debug/net8.0');
  //let baseNetAppPath = path.join(__dirname, '/src/QuickStart.Core/bin/Release/net8.0/win-x64/publish');

  if (__dirname.indexOf("app.asar") !== -1) {
    baseNetAppPath = path.join(process.resourcesPath,"net8.0");
  }
  
  process.env.EDGE_APP_ROOT = baseNetAppPath;
  var edge = require("electron-edge-js");
  var fs = require('fs');

  log.info("baseNetAppPath: " + baseNetAppPath);

  var baseDll = path.join(baseNetAppPath, "QuickStart.Core.dll");

  var localTypeName = "QuickStart.LocalMethods";
  var externalTypeName = "QuickStart.ExternalMethods";

  var getAppDomainDirectory = edge.func({
    assemblyFile: baseDll,
    typeName: localTypeName,
    methodName: "GetAppDomainDirectory",
  });

  var getCurrentTime = edge.func({
    assemblyFile: baseDll,
    typeName: localTypeName,
    methodName: "GetCurrentTime",
  });

  var useDynamicInput = edge.func({
    assemblyFile: baseDll,
    typeName: localTypeName,
    methodName: "UseDynamicInput",
  });

  var getPerson = edge.func({
    assemblyFile: baseDll,
    typeName: externalTypeName,
    methodName: "GetPersonInfo",
  });

  var handleException = edge.func({
    assemblyFile: baseDll,
    typeName: localTypeName,
    methodName: "ThrowException",
  });

  var executeSqlQuery = edge.func({
    assemblyFile: baseDll,
    typeName: localTypeName, 
    methodName: "ExecuteSqlQuery",
  });

  var getInlinePerson = edge.func({
    source: function () {
      /* 
        using System.Threading.Tasks;
        using System;

        public class Person
        {
            public Person(string name, string email, int age)
            {
                Id =  Guid.NewGuid();
                Name = name;
                Email = email;
                Age = age;
            }
            public Guid Id {get;}
            public string Name {get;set;}
            public string Email {get;set;}
            public int Age {get;set;}
        }

        public class Startup
        {
            public async Task<object> Invoke(dynamic input)
            {
                return new Person(input.name, input.email, input.age);
            }
        }
    */
    },
  });
} catch (e) {
  log.error(e);
  process.exit(1);
}

// New function to execute SQL and send results
async function executeSqlAndSendResult(window) {
    console.log('Executing SQL query function...');
    const sqlFilePath = path.join(__dirname, 'src', 'public', 'JSON.sql');
    let sqlQuery = '';

    try {
        sqlQuery = fs.readFileSync(sqlFilePath, 'utf8');
        console.log('Successfully read SQL query from file.');
    } catch (err) {
        console.error('Error reading SQL file:', err);
        window.webContents.send('fromMain', 'sqlQueryResults', { 
            error: 'Failed to read SQL query file.', 
            details: err.message 
        });
        return; // Stop execution if file read fails
    }

    // If query is empty after reading, report error
    if (!sqlQuery || sqlQuery.trim().length === 0) {
        console.error('SQL query file is empty.');
        window.webContents.send('fromMain', 'sqlQueryResults', { 
            error: 'SQL query file is empty.' 
        });
        return; 
    }

    executeSqlQuery(sqlQuery, function (error, result) {
        if (error) {
            console.error("Edge.js Invocation Error:", error);
            const errorDetails = (error instanceof Error) ? error.message : JSON.stringify(error);
            window.webContents.send('fromMain', 'sqlQueryResults', { 
                error: 'Edge.js invocation failed.', 
                details: errorDetails 
            });
            return;
        }

        console.log("SQL function returned object:", result);

        // Process the object result
        let parsedData = null;
        let processingError = null;

        // 1. Check for C# explicit error first
        if (result && result.error) {
            console.error("SQL Execution Error (C#):", result.error);
            processingError = { 
                error: 'SQL query execution failed in C#.', 
                details: result.error,
                stackTrace: result.stackTrace 
            };
        } 
        // 2. Check if result is null/undefined (e.g., empty query or null JSON from C#)
        else if (result === null || typeof result === 'undefined') {
             console.log('SQL function returned null/undefined, sending empty array.');
             parsedData = []; // Send empty array for Vega
        }
        // 3. Check for JsonOutput property
        else if (result.hasOwnProperty('JsonOutput')) {
            const jsonString = result.JsonOutput;
            // Check if the JsonOutput is a non-empty string
            if (typeof jsonString === 'string' && jsonString.trim().length > 0) {
                try {
                    parsedData = JSON.parse(jsonString);
                    console.log("Successfully parsed JsonOutput string.");
                } catch (parseError) {
                    console.error("Error parsing JsonOutput string:", parseError);
                    processingError = { 
                        error: 'Failed to parse JsonOutput string from SQL result.', 
                        details: parseError.message,
                        rawJsonString: jsonString // Include raw string for debugging
                    };
                }
            } else {
                // JsonOutput was null, empty string, or not a string
                console.log('JsonOutput was null, empty, or not a string. Sending empty array.');
                parsedData = []; // Send empty array for Vega
            }
        } 
        // 4. Unexpected result format
        else {
            console.error('SQL function returned unexpected object format:', result);
            processingError = { error: 'SQL function returned unexpected object format.', details: JSON.stringify(result) };
        }

        // Send the processed data or the error back to the renderer
        if (processingError) {
            window.webContents.send('fromMain', 'sqlQueryResults', processingError);
        } else {
            window.webContents.send('fromMain', 'sqlQueryResults', parsedData);
        }
    });
}

// Export the new function so main.js can call it
exports.run = function (window) {

  getInlinePerson(
    {
      name: "Peter Smith",
      email: "peter.smith@electron-edge-js-quick-start.com",
      age: 30,
    },
    function (error, result) {
      if (error) throw error;
      window.webContents.send(
        "fromMain",
        "getItem",
        JSON.stringify(result, null, 2)
      );
    }
  );
  
  getAppDomainDirectory("", function (error, result) {
    if (error) throw error;
    window.webContents.send("fromMain", "getAppDomainDirectory", result);
  });

  getCurrentTime("", function (error, result) {
    if (error) throw error;
    window.webContents.send("fromMain", "getCurrentTime", result);
  });

  useDynamicInput(
    { framework: framework, node: "Node.Js" },
    function (error, result) {
      if (error) throw error;
      window.webContents.send("fromMain", "useDynamicInput", result);
    }
  );

  try {
    handleException("", function (error, result) {});
  } catch (e) {
    window.webContents.send("fromMain", "handleException", e.Message);
  }

  getPerson(
    {
      name: "John Smith",
      email: "john.smith@electron-edge-js-quick-start.com",
      age: 35,
    },
    function (error, result) {
      if (error) throw error;
      window.webContents.send(
        "fromMain",
        "getPerson",
        JSON.stringify(result, null, 2)
      );
    }
  );

  // Initial SQL execution
  executeSqlAndSendResult(window);

};

// Export the new function so main.js can call it
exports.executeSqlAndSendResult = executeSqlAndSendResult;
