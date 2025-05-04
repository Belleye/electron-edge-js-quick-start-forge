using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Security.Cryptography.X509Certificates;
using System.Threading.Tasks;

namespace QuickStart
{
    public class LocalMethods
    {
        public async Task<object> GetAppDomainDirectory(dynamic input)
        {
            return AppDomain.CurrentDomain.BaseDirectory;
        }

        public async Task<object> GetCurrentTime(dynamic input)
        {
            return DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        }

        public async Task<object> UseDynamicInput(dynamic input)
        {
            var dict = (IDictionary<string, object>)input;
            return $".NET {dict["framework"]} welcomes {dict["node"]}";
        }
        public async Task<object> ThrowException(dynamic input)
        {
            throw new Exception("Sample Exception");
        }
        
        public async Task<object> ListCertificates(dynamic input)
        {
            X509Store store = new X509Store((string)input.storeName, (StoreLocation)Enum.Parse(typeof(StoreLocation), (string)input.storeLocation));
            store.Open(OpenFlags.ReadOnly);
            try
            {
                List<string> result = new List<string>();
                foreach (X509Certificate2 certificate in store.Certificates)
                {
                    result.Add(certificate.Subject);
                }

                return result;
            }
            finally
            {
                store.Close();
            }
        }

        // Reverted to return Task<object>
        public async Task<object> ExecuteSqlQuery(string sqlQuery)
        {
            string connectionString = "Server=ORDW;Database=ORDW;Integrated Security=True;Encrypt=False;";
            if (string.IsNullOrEmpty(sqlQuery))
            {
                // Return an error or default value if query is empty
                 return null; 
            }

            string jsonResult = null;

            try
            {
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    using (SqlCommand command = new SqlCommand(sqlQuery, connection))
                    {
                        using (SqlDataReader reader = await command.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync() && reader.HasRows)
                            {
                                // Assuming the JSON result is in the first column
                                if (!await reader.IsDBNullAsync(0)) 
                                {
                                     jsonResult = reader.GetString(0);
                                } else {
                                    // Handle case where the cell is DBNull
                                    jsonResult = null; 
                                }
                            }
                        }
                    }
                }
                // Return the JSON string wrapped in an object
                return new { JsonOutput = jsonResult }; 
            }
            catch (Exception ex)
            {
                // Log the exception details
                Console.WriteLine($"SQL Error: {ex.Message}");
                Console.WriteLine($"Stack Trace: {ex.StackTrace}");
                // Return null on error, JS side needs to handle this - REVERTED to error object
                // return null; 
                return new { error = ex.Message, stackTrace = ex.StackTrace };
            }
        }
    }
}
