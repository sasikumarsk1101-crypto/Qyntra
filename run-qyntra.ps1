$ErrorActionPreference = "Stop"
$workspace = $PSScriptRoot
$buildPath = Join-Path $env:TEMP "qyntra-java-build"
$locationPushed = $false

try {
  $developerUsername = Read-Host "Developer login username"
  if ([string]::IsNullOrWhiteSpace($developerUsername)) {
    throw "A developer username is required."
  }
  $env:QYNTRA_DEVELOPER_USERNAME = $developerUsername.Trim()
  $securePassword = Read-Host "Developer login password" -AsSecureString
  if ($securePassword.Length -eq 0) {
    throw "A developer password is required."
  }
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $env:QYNTRA_DEVELOPER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }

  if ([string]::IsNullOrWhiteSpace($env:GEMINI_API_KEY)) {
    $secureKey = Read-Host "Google Gemini API key (press Enter to run without AI)" -AsSecureString
    if ($secureKey.Length -gt 0) {
      $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
      try {
        $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
      } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
      }
    }
  }

  New-Item -ItemType Directory -Path $buildPath -Force | Out-Null
  Push-Location $workspace
  $locationPushed = $true
  & javac -encoding UTF-8 -d $buildPath (Join-Path $workspace "server\QyntraServer.java")
  if ($LASTEXITCODE -ne 0) {
    throw "Java compilation failed."
  }
  & java -cp $buildPath QyntraServer
  if ($LASTEXITCODE -ne 0) {
    throw "Qyntra server exited with an error."
  }
} finally {
  if ($locationPushed) {
    Pop-Location
  }
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:QYNTRA_DEVELOPER_USERNAME -ErrorAction SilentlyContinue
  Remove-Item Env:QYNTRA_DEVELOPER_PASSWORD -ErrorAction SilentlyContinue
}
