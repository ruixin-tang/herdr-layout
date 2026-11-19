import AppKit

// The part of the Dutch lesson that Herdr cannot do itself, because a mod only reaches its own window.
//   cover news <url>      opens the url in a new Chrome window, laid over the middle of the Herdr
//                         window (the dialog keeps a strip at the bottom for its countdown)
//   cover dark <seconds>  covers every screen the Herdr window is not on, for that long at most
// main.js builds it into data/dutch/cover when this file is newer, and stops it with pkill.

// The Herdr window, in the screen coordinates AppleScript uses (origin top left of the main screen).
func herdr() -> CGRect? {
  let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
  let own = all.filter { ($0[kCGWindowOwnerName as String] as? String) == "Herdr" && ($0[kCGWindowLayer as String] as? Int) == 0 }
  let boxes = own.compactMap { ($0[kCGWindowBounds as String] as? NSDictionary).flatMap { CGRect(dictionaryRepresentation: $0) } }
  return boxes.max { $0.width * $0.height < $1.width * $1.height }
}

let args = CommandLine.arguments
guard args.count == 3, let window = herdr() else { exit(1) }

if args[1] == "news" {
  let w = min(window.width - 80, max(900, window.width * 0.7)), top = window.minY + 40, bottom = window.maxY - 120
  let left = window.midX - w / 2
  let script = """
  tell application "Google Chrome"
    set w to make new window
    set URL of active tab of w to "\(args[2])"
    set bounds of w to {\(Int(left)), \(Int(top)), \(Int(left + w)), \(Int(bottom))}
    activate
  end tell
  """
  let run = Process()
  run.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
  run.arguments = ["-e", script]
  try? run.run()
  run.waitUntilExit()
  exit(run.terminationStatus)
}

guard args[1] == "dark", let seconds = Double(args[2]), seconds > 0 else { exit(1) }
// AppKit counts from the bottom of the main screen.
let tall = NSScreen.screens.first?.frame.height ?? 0
let middle = NSPoint(x: window.midX, y: tall - window.midY)
let others = NSScreen.screens.filter { !$0.frame.contains(middle) }
if others.isEmpty { exit(0) }

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
var covers: [NSWindow] = []
for screen in others {
  let cover = NSWindow(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
  cover.level = .screenSaver
  cover.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
  cover.backgroundColor = NSColor(red: 0.11, green: 0.08, blue: 0.07, alpha: 1)
  cover.isReleasedWhenClosed = false
  let text = NSTextField(labelWithString: "Tijd voor Nederlands. Het Journaal staat op je andere scherm.")
  text.font = .systemFont(ofSize: 22, weight: .medium)
  text.textColor = NSColor(white: 1, alpha: 0.45)
  text.sizeToFit()
  text.setFrameOrigin(NSPoint(x: (screen.frame.width - text.frame.width) / 2, y: (screen.frame.height - text.frame.height) / 2))
  cover.contentView?.addSubview(text)
  cover.setFrame(screen.frame, display: true)
  cover.orderFrontRegardless()
  covers.append(cover)
}
// Never longer than asked, whatever happens to Herdr in the meantime.
Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { _ in exit(0) }
app.run()
