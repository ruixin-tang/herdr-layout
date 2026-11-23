import AppKit

// The part of the Dutch lesson that Herdr cannot do itself, because a mod only reaches its own window.
//   cover news <url>               opens the url in a new Chrome window, laid over the middle of the
//                                  Herdr window (the dialog keeps a strip at the bottom for its
//                                  countdown), and remembers that window in data/dutch/window
//   cover close x                  closes that Chrome window again
//   cover dark <seconds> [words]   covers every screen the Herdr window is not on, for that long at
//                                  most. With a words.json (words.sh) the cover shows the word list
//                                  of the episode, to look at while it plays
//   cover shot <words> <png>       draws that cover into a picture instead (to look at it: nothing
//                                  may take a picture of the other screen)
// main.js builds it into data/dutch/cover when this file is newer, and stops it with pkill.

// The Herdr window, in the screen coordinates AppleScript uses (origin top left of the main screen).
func herdr() -> CGRect? {
  let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
  let own = all.filter { ($0[kCGWindowOwnerName as String] as? String) == "Herdr" && ($0[kCGWindowLayer as String] as? Int) == 0 }
  let boxes = own.compactMap { ($0[kCGWindowBounds as String] as? NSDictionary).flatMap { CGRect(dictionaryRepresentation: $0) } }
  return boxes.max { $0.width * $0.height < $1.width * $1.height }
}

func osascript(_ script: String) -> (Int32, String) {
  let run = Process(), out = Pipe()
  run.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
  run.arguments = ["-e", script]
  run.standardOutput = out
  try? run.run()
  run.waitUntilExit()
  return (run.terminationStatus, String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "")
}

struct Word: Decodable { let at: String?, nl: String, en: String?, zh: String? }
struct Words: Decodable { let date: String?, words: [Word] }

// What a covered screen shows: the line that says why, and the word list when there is one.
func face(_ size: NSSize, _ words: Words?) -> NSView {
  let view = NSView(frame: NSRect(origin: .zero, size: size))
  view.wantsLayer = true
  view.layer?.backgroundColor = NSColor(red: 0.11, green: 0.08, blue: 0.07, alpha: 1).cgColor
  let label = { (text: String, size: CGFloat, weight: NSFont.Weight, color: NSColor) -> NSTextField in
    let field = NSTextField(labelWithString: text)
    field.font = .systemFont(ofSize: size, weight: weight)
    field.textColor = color
    field.sizeToFit()
    return field
  }
  let dim = NSColor(white: 1, alpha: 0.45)
  guard let words, !words.words.isEmpty else {
    let text = label("Tijd voor Nederlands. Het Journaal staat op je andere scherm.", 22, .medium, dim)
    text.setFrameOrigin(NSPoint(x: (size.width - text.frame.width) / 2, y: (size.height - text.frame.height) / 2))
    view.addSubview(text)
    return view
  }
  // As large as the screen allows: every word gets a row, the list sits in the middle.
  let rows = CGFloat(words.words.count), row = min(64, (size.height - 200) / rows), big = min(30, row * 0.5)
  let cols: [CGFloat] = [big * 2.6, big * 13, big * 9], wide = min(size.width - 80, cols.reduce(0, +) + big * 16)
  let left = (size.width - wide) / 2, top = size.height - (size.height - rows * row - 70) / 2
  let title = label("De woorden van dit Journaal", big * 0.8, .medium, dim)
  title.setFrameOrigin(NSPoint(x: left, y: top - 30))
  view.addSubview(title)
  for (i, word) in words.words.enumerated() {
    let y = top - 70 - CGFloat(i + 1) * row + (row - big * 1.3) / 2
    let cells: [(String, CGFloat, NSFont.Weight, NSColor)] = [
      (word.at ?? "", big * 0.55, .regular, dim),
      (word.nl, big, .semibold, NSColor(red: 0.47, green: 0.86, blue: 0.93, alpha: 1)),
      (word.zh ?? "", big * 0.8, .regular, NSColor(white: 1, alpha: 0.9)),
      (word.en ?? "", big * 0.7, .regular, NSColor(white: 1, alpha: 0.6)),
    ]
    var x = left
    for (n, cell) in cells.enumerated() {
      let field = label(cell.0, cell.1, cell.2, cell.3)
      let room = n < cols.count ? cols[n] - 12 : left + wide - x
      field.lineBreakMode = .byTruncatingTail
      field.frame = NSRect(x: x, y: y + (big - cell.1) * 0.35, width: min(field.frame.width, room), height: field.frame.height)
      view.addSubview(field)
      x += n < cols.count ? cols[n] : 0
    }
  }
  return view
}

func read(_ path: String) -> Words? {
  FileManager.default.contents(atPath: path).flatMap { try? JSONDecoder().decode(Words.self, from: $0) }
}

let args = CommandLine.arguments
guard args.count >= 3 else { exit(1) }
// Beside the binary: the Chrome window "news" made, for "close".
let memo = URL(fileURLWithPath: args[0]).deletingLastPathComponent().appendingPathComponent("window").path

if args[1] == "shot", args.count == 4 {
  let view = face(NSSize(width: 1512, height: 982), read(args[2]))
  guard let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { exit(1) }
  view.cacheDisplay(in: view.bounds, to: rep)
  try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: args[3]))
  exit(0)
}

if args[1] == "close" {
  guard let id = try? String(contentsOfFile: memo, encoding: .utf8), Int(id) != nil else { exit(0) }
  try? FileManager.default.removeItem(atPath: memo)
  exit(osascript("tell application \"Google Chrome\" to close (every window whose id is \(id))").0)
}

guard let window = herdr() else { exit(1) }

if args[1] == "news" {
  let w = min(window.width - 80, max(900, window.width * 0.7)), top = window.minY + 40, bottom = window.maxY - 120
  let left = window.midX - w / 2
  let (status, id) = osascript("""
  tell application "Google Chrome"
    set w to make new window
    set URL of active tab of w to "\(args[2])"
    set bounds of w to {\(Int(left)), \(Int(top)), \(Int(left + w)), \(Int(bottom))}
    activate
    return id of w
  end tell
  """)
  if status == 0 { try? id.write(toFile: memo, atomically: true, encoding: .utf8) }
  exit(status)
}

guard args[1] == "dark", let seconds = Double(args[2]), seconds > 0 else { exit(1) }
// AppKit counts from the bottom of the main screen.
let tall = NSScreen.screens.first?.frame.height ?? 0
let middle = NSPoint(x: window.midX, y: tall - window.midY)
let others = NSScreen.screens.filter { !$0.frame.contains(middle) }
if others.isEmpty { exit(0) }
let words = args.count > 3 ? read(args[3]) : nil

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
var covers: [NSWindow] = []
for screen in others {
  let cover = NSWindow(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
  cover.level = .screenSaver
  cover.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
  cover.backgroundColor = NSColor(red: 0.11, green: 0.08, blue: 0.07, alpha: 1)
  cover.isReleasedWhenClosed = false
  cover.contentView = face(screen.frame.size, words)
  cover.setFrame(screen.frame, display: true)
  cover.orderFrontRegardless()
  covers.append(cover)
}
// Never longer than asked, whatever happens to Herdr in the meantime.
Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { _ in exit(0) }
app.run()
