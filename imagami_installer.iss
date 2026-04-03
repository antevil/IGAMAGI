[Setup]
AppName=IGAMAGI
AppVersion=0.1.0
DefaultDirName={autopf}\IGAMAGI
DefaultGroupName=IGAMAGI
OutputDir=installer
OutputBaseFilename=IGAMAGI_Setup_0_1_0
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "デスクトップにショートカットを作成する"; GroupDescription: "追加アイコン:"

[Files]
Source: "dist\app\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\IGAMAGI"; Filename: "{app}\app.exe"
Name: "{commondesktop}\IGAMAGI"; Filename: "{app}\app.exe"; Tasks: desktopicon