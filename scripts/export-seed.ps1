param(
    [string]$Output = 'db/seed-export.sql'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

# Parse .env; unescape \$ sequences Vite requires in passwords
$envVars = @{}
if (Test-Path '.env') {
    Get-Content '.env' | Where-Object { $_ -match '^\s*[^#]' } | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') { $envVars[$Matches[1].Trim()] = $Matches[2].Trim() }
    }
}
$dbHost = if ($envVars['DB_HOST']) { $envVars['DB_HOST'] } else { 'localhost' }
$dbPort = if ($envVars['DB_PORT']) { $envVars['DB_PORT'] } else { '3306' }
$dbUser = if ($envVars['DB_USER']) { $envVars['DB_USER'] } else { 'root' }
$dbPass = if ($envVars['DB_PASSWORD']) { $envVars['DB_PASSWORD'] } else { '' }
$dbPass = $dbPass -replace '\\(.)', '$1'
$dbName = if ($envVars['DB_NAME']) { $envVars['DB_NAME'] } else { 'pands' }

# Tables in FK-safe insertion order.
# Reference tables first, then transactional tables matching reset.sql.
$tables = @(
    'app_users',
    'material_skus',
    'raw_roll_lookup',
    'customers',
    'customer_addresses',
    'purchase_orders',
    'purchase_order_lines',
    'work_orders',
    'contacts',
    'work_order_lines',
    'wo_accessories',
    'production_run_groups',
    'production_runs',
    'cut_down_groups',
    'cut_downs',
    'wip_ledger',
    'inventory_counts',
    'inventory_transactions',
    'shipments',
    'shipment_lines',
    'schema_migrations'
)

Write-Host "Exporting $dbName to $Output..."

mysqldump `
    "--host=$dbHost" `
    "--port=$dbPort" `
    "--user=$dbUser" `
    "--password=$dbPass" `
    --no-create-info `
    --insert-ignore `
    --skip-triggers `
    --single-transaction `
    --no-tablespaces `
    "--result-file=$Output" `
    $dbName `
    @tables

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: mysqldump failed." -ForegroundColor Red
    exit 1
}

$size = [math]::Round((Get-Item $Output).Length / 1KB, 1)
Write-Host "Exported $($tables.Count) tables to $Output ($size KB)" -ForegroundColor Green
Write-Host ""
Write-Host "To load on home DB:"
Write-Host "  1. Make sure schema is current:  mysql -u root -p pands < db/schema.sql"
Write-Host "  2. Load the data:                mysql -u root -p pands < $Output"
