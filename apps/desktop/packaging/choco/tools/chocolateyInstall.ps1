$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/flamingo-stack/openframe-oss-frontend/releases/download/1.0.190/OpenFrame-Console_1.0.190_x64-setup.exe'
  checksum64     = '39df0de646e5a6b601ca2d5f2f3dc5c558ac80ab7af27540890a70edcaf066af'
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
  $packageArgs.url64bit = 'https://github.com/flamingo-stack/openframe-oss-frontend/releases/download/1.0.190/OpenFrame-Console_1.0.190_arm64-setup.exe'
  $packageArgs.checksum64 = '7d9eded1b25aab75ee9fe70a595ac68369125fdb390bfbaf7b4020bbe694388b'
}

Install-ChocolateyPackage @packageArgs
