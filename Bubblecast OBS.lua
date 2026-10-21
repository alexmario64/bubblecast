obs = obslua
function script_description()
 return "Starts Bubblecast background capture with OBS. Add one Custom Browser Dock: http://127.0.0.1:3927/dock. Install the background app runtime once before using this script."
end
function script_load(settings)
 local launcher = script_path() .. "Start Bubblecast Background.vbs"
 os.execute('wscript.exe "' .. launcher .. '"')
end
