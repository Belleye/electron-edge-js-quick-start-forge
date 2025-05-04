using System;
using System.Collections.Generic;
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

        // New method to execute SQL Query
        public async Task<object> ExecuteSqlQuery(dynamic input)
        {
            string connectionString = "Server=ORDW;Database=ORDW;Integrated Security=True;Encrypt=False;";
            string query = "SELECT * FROM ORDW.public_v2.dim_Site s";

            List<Dictionary<string, object>> results = new List<Dictionary<string, object>>();

            try
            {
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    using (SqlCommand command = new SqlCommand(query, connection))
                    {
                        using (SqlDataReader reader = await command.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var row = new Dictionary<string, object>();
                                for (int i = 0; i < reader.FieldCount; i++)
                                {
                                    row[reader.GetName(i)] = reader.GetValue(i);
                                }
                                results.Add(row);
                            }
                        }
                    }
                }
                return results;
            }
            catch (Exception ex)
            {
                // Return exception message to JavaScript
                return new { error = ex.Message, stackTrace = ex.StackTrace };
            }
        }
    }
}
