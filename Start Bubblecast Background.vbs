Option Explicit
Dim files, shell, root, runtime
Set files = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = files.GetParentFolderName(WScript.ScriptFullName)
runtime = root & "\.local\electron\electron.exe"
If Not files.FileExists(runtime) Then
  MsgBox "Run Install Background App.cmd once before starting background capture.", 64, "Bubblecast"
  WScript.Quit 1
End If
shell.Run Chr(34) & runtime & Chr(34) & " " & Chr(34) & root & "\desktop" & Chr(34), 0, False
