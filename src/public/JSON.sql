-- Declare parameters
DECLARE @StartDate DATETIME = '2025-04-29 06:00:00';
DECLARE @EndDate DATETIME = '2025-04-29 18:00:00';
DECLARE @StartDateUTC DATETIME = DATEADD(HOUR, -8, @StartDate);
DECLARE @EndDateUTC DATETIME = DATEADD(HOUR, -8, @EndDate);
DECLARE @StartSK INT = 202504291;
DECLARE @EndSK INT = 202504291;
DECLARE @PadStart INT = -10;
DECLARE @PadEnd INT = 10;

-- Output variables
DECLARE @JSON NVARCHAR(MAX);
DECLARE @RowCount_c INT, @RowCount_p INT, @RowCount_t INT;
DECLARE @TimeStart DATETIME2 = SYSDATETIME();

-- Timing variables
DECLARE @T1 DATETIME2 = @TimeStart, @T2 DATETIME2, @Dur_c INT, @Dur_p INT, @Dur_t INT, @Dur_cb INT, @Dur_json INT;

-- Cleanup
DROP TABLE IF EXISTS #c; DROP TABLE IF EXISTS #p; DROP TABLE IF EXISTS #t;

-- Step 1: Load #c
SELECT 
    d.DateValue, 
    fc.LoadShift_SK, 
    o.OperatorName, 
    Load_AF.Fleet AS Load_Fleet, 
    Load_AF.AssetId COLLATE SQL_Latin1_General_CP1_CI_AS AS AssetId, 
    fc.tLoadWeightSystem, 
    DATEADD(SECOND, @PadStart, fc.LoadStart) AS LoadStart,
    DATEADD(SECOND, @PadEnd, fc.LoadFinish) AS LoadFinish, 
    PLM.PayloadRange, 
    PLM.IsPayloadCapture, 
    Haul_AF.AssetId AS Truck
INTO #c
FROM ORDW.public_v2.fact_HMECycle fc
INNER JOIN ORDW.public_v2.dim_HMEAssetFunction Load_AF ON Load_AF.HMEAssetFunction_SK = fc.LoadHMEAssetFunction_SK
INNER JOIN ORDW.public_v2.dim_Location sloc ON sloc.Location_SK = fc.SourceLocation_SK
INNER JOIN ORDW.public_v2.dim_Site s ON s.Site_SK = sloc.Site_SK
INNER JOIN ORDW.public_v2.dim_HMEOperator o ON fc.LoadHMEOperator_SK = o.HMEOperator_SK
INNER JOIN ORDW.public_v2.dim_Date d ON fc.LoadShift_SK = d.Shift_SK
INNER JOIN ORDW.public_v2.dim_Material m ON m.Material_SK = fc.Material_SK
INNER JOIN ORDW.public_v2.dim_PayloadManagement PLM ON fc.PayloadManagement_SK = PLM.PayloadManagement_SK
INNER JOIN ORDW.public_v2.dim_HMEAssetFunction Haul_AF ON fc.HaulHMEAssetFunction_SK = Haul_AF.HMEAssetFunction_SK
WHERE s.OperationCode = 'BRNM'
    AND fc.LoadShift_SK BETWEEN @StartSK AND @EndSK
    AND fc.tLoadWeightSystem > 0
    AND PLM.IsPayloadCapture = 'Captured';

SELECT @RowCount_c = COUNT(*) FROM #c;
SET @T2 = SYSDATETIME(); SET @Dur_c = DATEDIFF(SECOND, @T1, @T2); SET @T1 = @T2;

-- Step 2: Load #p
SELECT
    REPLACE(s.machine_code, 'RTIO_B2NS_', '') COLLATE SQL_Latin1_General_CP1_CI_AS AS LoadUnit,
    s.cycle_start_time,
    DATEADD(HOUR, 8, s.cycle_end_time) AS cycle_end_time,
    s.avg_payload
INTO #p
FROM [ORDW.Staging].ods.SMS_payload_cycle_summary_tab s
WHERE s.machine_code LIKE 'RTIO_B2NS_%'
    AND s.cycle_end_time BETWEEN @StartDateUTC AND @EndDateUTC;

SELECT @RowCount_p = COUNT(*) FROM #p;
SET @T2 = SYSDATETIME(); SET @Dur_p = DATEDIFF(SECOND, @T1, @T2); SET @T1 = @T2;

-- Step 3: Load #t
SELECT
    a.AssetId,
    f.HMETimeUsageGroupEventStart,
    f.HMETimeUsageGroupEventFinish
INTO #t
FROM ORDW.public_v2.fact_HMETimeUsage f
INNER JOIN ORDW.public_v2.dim_TimeUsageHME d ON f.TimeUsage_SK = d.TimeUsage_SK
INNER JOIN ORDW.public_v2.dim_Site s ON f.Site_SK = s.Site_SK
INNER JOIN ORDW.public_v2.dim_HMEAsset a ON f.HMEAsset_SK = a.HMEAsset_SK
INNER JOIN ORDW.public_v2.dim_Date dt ON f.Shift_SK = dt.Shift_SK
WHERE s.OperationCode = 'BRNM'
    AND f.Shift_SK BETWEEN @StartSK AND @EndSK
    AND d.TUM7DisplayName LIKE '%Tray%'
    AND a.Class = 'Haul Units';

SELECT @RowCount_t = COUNT(*) FROM #t;
SET @T2 = SYSDATETIME(); SET @Dur_t = DATEDIFF(SECOND, @T1, @T2); SET @T1 = @T2;

-- Step 4: Compute carryback
WITH cb AS (
    SELECT 
        c.LoadShift_SK,
        c.AssetId AS LoadUnit,
        c.OperatorName,
        c.Load_Fleet,
        c.LoadStart,
        c.LoadFinish,
        c.Truck,
        c.tLoadWeightSystem,
        SUM(p.avg_payload) AS SMSpayload,
        COUNT(p.LoadUnit) AS buckets,
        CAST(CASE 
                WHEN COUNT(p.LoadUnit) > 0 
                THEN c.tLoadWeightSystem - SUM(p.avg_payload) 
                ELSE 0 
             END AS DECIMAL(16,1)) AS CarryBack
    FROM #c c
    LEFT JOIN #p p ON c.AssetId = p.LoadUnit
                  AND p.cycle_end_time BETWEEN c.LoadStart AND c.LoadFinish
    GROUP BY 
        c.LoadShift_SK,
        c.AssetId,
        c.OperatorName,
        c.Load_Fleet,
        c.LoadStart,
        c.LoadFinish,
        c.Truck,
        c.tLoadWeightSystem
    HAVING COUNT(p.LoadUnit) > 3
)

-- Step 5: Build JSON
SELECT @JSON = (
    SELECT *
    FROM (
        SELECT
            'Load' AS Class,
            Truck,
            LoadStart AS TimeStart,
            NULL AS TimeEnd,
            LoadUnit,
            OperatorName,
            CAST(tLoadWeightSystem AS INT) AS tLoadWeightSystem,
            CAST(SMSpayload AS INT) AS SMSpayload,
            CAST(CarryBack AS INT) AS CarryBack,
            buckets
        FROM cb

        UNION ALL

        SELECT
            'Carry Back',
            Truck,
            NULL,
            LoadFinish,
            NULL,
            NULL,
            NULL,
            NULL,
            CAST(CarryBack AS INT),
            NULL
        FROM cb

        UNION ALL

        SELECT 
            'Tray Clean',
            AssetId AS Truck,
            HMETimeUsageGroupEventStart,
            HMETimeUsageGroupEventFinish,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL
        FROM #t
    ) q
    --ORDER BY ISNULL(TimeStart, TimeEnd)
    FOR JSON AUTO
);

SET @T2 = SYSDATETIME(); SET @Dur_json = DATEDIFF(SECOND, @T1, @T2);

-- Final Output
SELECT 
    @JSON AS JSONOutput,
    @RowCount_c AS CyclesRows,
    @Dur_c AS CyclesSeconds,
    @RowCount_p AS PassesRows,
    @Dur_p AS PassesSeconds,
    @RowCount_t AS TrayCleansRows,
    @Dur_t AS TrayCleansSeconds,
    @Dur_json AS JsonBuildSeconds;
