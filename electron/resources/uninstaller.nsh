; build/uninstaller.nsh
; 卸载时询问是否删除数据，并确保进程已关闭
; 注意：路径必须与 electron-builder.yml 中的 appId 一致
; app.getPath('userData') 返回 %APPDATA%\{appId}

!macro customUnInit
  ; 先强制结束可能正在运行的 AI Sketch 进程
  nsExec::ExecToLog 'taskkill /F /IM "AI Sketch.exe" /T'
  ; 等待进程完全退出
  Sleep 1000

  MessageBox MB_YESNO "是否删除应用数据？$\n$\n应用数据包括配置、对话历史等。删除后无法恢复。" IDYES DeleteData IDNo KeepData

  DeleteData:
    ; 删除用户数据目录（路径基于 appId: ai-sketch）
    RMDir /r "$APPDATA\ai-sketch"
    RMDir /r "$LOCALAPPDATA\ai-sketch"
    Goto Done

  KeepData:
    ; 保留数据，只删除应用
    Goto Done

  Done:
!macroend
