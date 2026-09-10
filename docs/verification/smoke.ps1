<#
.SYNOPSIS
    Phase 1 ingestion smoke test against a running OriginTrace stack.

.DESCRIPTION
    Exercises the paths that only exist once `docker compose up` has produced
    three live containers: the published ports, the API on :8000, the analysis
    service on :8100, and a real network clone.

    Every check declares two things -- what the WBS asks for, and what this
    branch actually does today. A check "passes" when the observed result
    matches today's recorded behaviour, so the script is usable as a regression
    harness right now; where today's behaviour differs from the WBS the line is
    printed as DEFECT with its id from PHASE1_VERIFICATION.md. When a defect is
    fixed, its check turns into a FIXED line and the script exits 2, which is
    the signal to update the report.

    Idempotent: it creates its own users and deletes them, with everything they
    own, on the way out.

.NOTES
    Requires PowerShell 7+ (Invoke-WebRequest -Form) and a stack brought up with
    `docker compose up --build -d` from the repository root.

    NOT EXECUTED during the Phase 1 verification run: the verification shell had
    no Docker. Every assertion below is additionally covered in-process by
    analysis/tests/test_ingestion_e2e.py, which was executed.
#>

[CmdletBinding()]
param(
    [string]$ApiBase      = 'http://localhost:8000',
    [string]$AnalysisBase = 'http://localhost:8100',
    [string]$SampleRepo   = 'https://github.com/pallets/click',
    [string]$Password     = 'Passw0rd!'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw 'PowerShell 7 or newer is required (Invoke-WebRequest -Form).'
}

$script:Failures = 0
$script:Fixed    = 0

function Write-Result {
    param(
        [string]$Name,
        [object]$Actual,
        [object]$ExpectedToday,
        [string]$WbsIntent = '',
        [string]$Defect    = ''
    )
    $ok = "$Actual" -eq "$ExpectedToday"
    if ($ok -and $Defect) {
        Write-Host ("DEFECT {0,-6} {1,-52} {2}" -f $Defect, $Name, $Actual) -ForegroundColor Yellow
        if ($WbsIntent) { Write-Host ("              WBS asks for: {0}" -f $WbsIntent) -ForegroundColor DarkYellow }
    }
    elseif ($ok) {
        Write-Host ("PASS          {0,-52} {1}" -f $Name, $Actual) -ForegroundColor Green
    }
    elseif ($Defect) {
        Write-Host ("FIXED  {0,-6} {1,-52} {2} (was {3})" -f $Defect, $Name, $Actual, $ExpectedToday) -ForegroundColor Cyan
        $script:Fixed++
    }
    else {
        Write-Host ("FAIL          {0,-52} got {1}, expected {2}" -f $Name, $Actual, $ExpectedToday) -ForegroundColor Red
        $script:Failures++
    }
}

function Invoke-Status {
    <# Returns the HTTP status code of a request, without throwing on 4xx/5xx. #>
    param([hashtable]$Arguments)
    try {
        (Invoke-WebRequest @Arguments -SkipHttpErrorCheck).StatusCode
    }
    catch {
        if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { throw }
    }
}

function Invoke-Analyze {
    param([hashtable]$Form, [string]$Token)
    Invoke-WebRequest -Uri "$AnalysisBase/api/analyze" -Method Post -Form $Form `
        -Headers @{ Authorization = "Bearer $Token" } -SkipHttpErrorCheck
}

# --- 0. the stack is actually up ---------------------------------------------

Write-Host "`n== Stack ==" -ForegroundColor White
Write-Result 'docker compose services healthy' `
    ((docker compose ps --format json | ConvertFrom-Json | Where-Object { $_.Health -eq 'healthy' }).Count) 3
Write-Result 'API /api/health' (Invoke-Status @{ Uri = "$ApiBase/api/health" }) 200
Write-Result 'analysis /api/health' (Invoke-Status @{ Uri = "$AnalysisBase/api/health" }) 200

# --- 1. seeds and login -------------------------------------------------------

Write-Host "`n== Authentication ==" -ForegroundColor White
Get-Content "$PSScriptRoot/../../db/seeds/001_dev_users.sql" -Raw |
    docker compose exec -T db psql -U origintrace -d origintrace -q
Write-Result 'seeds load (idempotent)' $LASTEXITCODE 0

function Get-Token {
    param([string]$Email)
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    (Invoke-RestMethod -Uri "$ApiBase/api/auth/login" -Method Post -Body $body -ContentType 'application/json').token
}
$studentToken    = Get-Token 'student@origintrace.test'
$instructorToken = Get-Token 'instructor@origintrace.test'
Write-Result 'student login returns a JWT'    ($studentToken.Split('.').Count)    3
Write-Result 'instructor login returns a JWT' ($instructorToken.Split('.').Count) 3

# --- 2. git ingestion ---------------------------------------------------------

Write-Host "`n== Git ingestion (WBS 2.1) ==" -ForegroundColor White
$first = Invoke-Analyze -Token $studentToken -Form @{ source_url = $SampleRepo; language = 'python' }
Write-Result 'POST /api/analyze with a real repository' $first.StatusCode 500 `
    '200 with files_included > 0 and a risk_band' 'D-02'

if ($first.StatusCode -eq 200) {
    $firstBody = $first.Content | ConvertFrom-Json
    Write-Result 'files_included > 0' ($firstBody.files_included -gt 0) $true
    Write-Result 'risk_band is a band' ($firstBody.risk_band -in @('low', 'medium', 'high')) $true

    $second = Invoke-Analyze -Token $studentToken -Form @{ source_url = $SampleRepo; language = 'python' }
    $secondBody = $second.Content | ConvertFrom-Json
    Write-Result 'resubmission is clustered with the first' `
        ($secondBody.similarity_cluster_members -contains $firstBody.submission_id) $true

    $listed = Invoke-RestMethod -Uri "$ApiBase/api/instructor/submissions" `
        -Headers @{ Authorization = "Bearer $instructorToken" }
    Write-Result 'instructor dashboard shows the submission' ($listed.submissions.Count -ge 1) $true
    Write-Result 'the listed submission carries a risk band' `
        ([bool]($listed.submissions | Where-Object { $_.risk_band })) $true
}
else {
    Write-Host '              downstream clustering and dashboard checks skipped: nothing was stored' -ForegroundColor DarkGray
}

Write-Result 'unreachable repository' `
    (Invoke-Analyze -Token $studentToken -Form @{ source_url = 'https://example.invalid/nope.git'; language = 'python' }).StatusCode 400
Write-Result 'no repository size limit' `
    ((docker compose exec -T analysis grep -c -- '--depth' /app/app/pipeline.py) -ge 1) $true `
    'a clone bounded by size as well as depth and timeout' 'D-10'

# --- 3. request validation ----------------------------------------------------

Write-Host "`n== Validation ==" -ForegroundColor White
$sample = Join-Path ([System.IO.Path]::GetTempPath()) 'origintrace-smoke.py'
"def alpha(bravo, charlie):`n    return bravo + charlie`n" | Set-Content -Path $sample -NoNewline

Write-Result 'source_url and upload together' `
    (Invoke-Analyze -Token $studentToken -Form @{ source_url = $SampleRepo; language = 'python'; upload = Get-Item $sample }).StatusCode 400
Write-Result 'neither source_url nor upload' `
    (Invoke-Analyze -Token $studentToken -Form @{ language = 'python' }).StatusCode 400
Write-Result 'unsupported language' `
    (Invoke-Analyze -Token $studentToken -Form @{ language = 'javascript'; upload = Get-Item $sample }).StatusCode 400 `
    'javascript to be supported: WBS 3.1 names it and submissions.language allows it' 'D-06'
Write-Result 'instructor token with is_self_check' `
    (Invoke-Analyze -Token $instructorToken -Form @{ language = 'python'; is_self_check = 'true'; upload = Get-Item $sample }).StatusCode 400
Write-Result 'a single .py upload' `
    (Invoke-Analyze -Token $studentToken -Form @{ language = 'python'; upload = Get-Item $sample }).StatusCode 200

# --- 4. zip upload (WBS 2.2) --------------------------------------------------

Write-Host "`n== Upload fallback (WBS 2.2) ==" -ForegroundColor White
$zip = Join-Path ([System.IO.Path]::GetTempPath()) 'origintrace-smoke.zip'
Compress-Archive -Path $sample -DestinationPath $zip -Force
$zipResponse = Invoke-Analyze -Token $studentToken -Form @{ language = 'python'; upload = Get-Item $zip }
Write-Result 'a .zip upload is accepted' $zipResponse.StatusCode 200
if ($zipResponse.StatusCode -eq 200) {
    Write-Result 'files_included from a .zip' ($zipResponse.Content | ConvertFrom-Json).files_included 0 `
        'the archive to be extracted and its .py files analysed' 'D-08'
}

# --- 5. java, and the self-check quota ---------------------------------------

Write-Host "`n== Language mismatch and quota ==" -ForegroundColor White
$java = Join-Path ([System.IO.Path]::GetTempPath()) 'Alpha.java'
'class Alpha { int bravo(int charlie) { return charlie; } }' | Set-Content -Path $java -NoNewline
Write-Result 'language=java reaches the DB CHECK' `
    (Invoke-Analyze -Token $studentToken -Form @{ language = 'java'; upload = Get-Item $java }).StatusCode 500 `
    'java to be storable: the parser supports it but submissions.language does not' 'D-01'

$quotaEmail = "smoke-quota-$([guid]::NewGuid())@origintrace.test"
$hash = docker compose exec -T api node -e "console.log(require('bcryptjs').hashSync('$Password',10))"
docker compose exec -T db psql -U origintrace -d origintrace -q -c `
    "INSERT INTO users (email, password_hash, role, full_name) VALUES ('$quotaEmail', '$($hash.Trim())', 'student', 'Smoke Quota')"
try {
    $quotaToken = Get-Token $quotaEmail
    $statuses = 1..4 | ForEach-Object {
        (Invoke-Analyze -Token $quotaToken -Form @{ language = 'python'; is_self_check = 'true'; upload = Get-Item $sample }).StatusCode
    }
    Write-Result 'self-checks 1-3 succeed' (($statuses[0..2] | Where-Object { $_ -eq 200 }).Count) 3
    Write-Result 'self-check 4 is rate limited' $statuses[3] 429
    Write-Result 'quota endpoint reflects usage' `
        (Invoke-RestMethod -Uri "$ApiBase/api/student/self-checks/quota" -Headers @{ Authorization = "Bearer $quotaToken" }).used 0 `
        'used: 3 after three self-checks' 'D-03'
}
finally {
    docker compose exec -T db psql -U origintrace -d origintrace -q -c `
        "DELETE FROM users WHERE email = '$quotaEmail'"
    Remove-Item $sample, $zip, $java -ErrorAction SilentlyContinue
}

# --- summary ------------------------------------------------------------------

Write-Host ''
if ($script:Failures -gt 0) {
    Write-Host "$($script:Failures) check(s) failed unexpectedly." -ForegroundColor Red
    exit 1
}
if ($script:Fixed -gt 0) {
    Write-Host "$($script:Fixed) recorded defect(s) no longer reproduce -- update PHASE1_VERIFICATION.md." -ForegroundColor Cyan
    exit 2
}
Write-Host 'All checks matched the recorded Phase 1 behaviour.' -ForegroundColor Green
exit 0
