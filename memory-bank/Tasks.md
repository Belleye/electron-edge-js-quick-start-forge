## Backlog

## In Progress

## Completed
- [x] Execute SQL Query (Select * from ORDW.public_v2.dim_Site s) on ORDW using Windows Authentication.

## Session Notes
- Modified `src/shared/LocalMethods.cs` to add `ExecuteSqlQuery` method using `System.Data.SqlClient`.
- Modified `app.js` to define and call the `edge.func` for `ExecuteSqlQuery`.
- Modified `index.html` to add a display area for SQL results.
- Modified `renderer.js` to handle and display the SQL results or errors.
