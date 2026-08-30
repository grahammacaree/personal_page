#!/usr/bin/env swift
/**
 * Apple Vision OCR for a single page image (macOS).
 * Usage: vision-ocr.swift <image-path>
 * Prints recognized text to stdout (UTF-8).
 */
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count >= 2 else {
  fputs("usage: vision-ocr.swift <image>\n", stderr)
  exit(2)
}

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let tiff = img.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let cg = rep.cgImage
else {
  fputs("failed to load image: \(path)\n", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
do {
  try handler.perform([request])
} catch {
  fputs("Vision error: \(error)\n", stderr)
  exit(1)
}

let observations = request.results ?? []
var lines: [String] = []
for obs in observations {
  if let candidate = obs.topCandidates(1).first {
    let t = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
    if !t.isEmpty { lines.append(t) }
  }
}
print(lines.joined(separator: "\n"))
