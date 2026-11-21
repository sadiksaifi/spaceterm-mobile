import { CameraView, type BarcodeScanningResult } from "expo-camera";
import { Pressable, StyleSheet, View } from "react-native";

import { text } from "../text";

/** The preview's size and the viewfinder's corner brackets, as each platform's mockup draws them. */
export type PreviewMetrics = {
  size: number;
  radius: number;
  bracket: { size: number; inset: number; stroke: number; radius: number };
  bracketColor: string;
};

const CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;
type Corner = (typeof CORNERS)[number];

/**
 * The camera, square, with the viewfinder over it. It reads QR codes while `scanning`, and shows
 * black before the camera is allowed. Where a development build fakes pairing, a tap stands in for
 * a scan, as simulators have no camera.
 */
export function CameraPreview({
  metrics,
  scanning,
  onScan,
  onFakeScan,
}: {
  metrics: PreviewMetrics;
  scanning: boolean;
  onScan: (data: string) => void;
  onFakeScan: (() => void) | undefined;
}) {
  const box = {
    width: metrics.size,
    height: metrics.size,
    borderRadius: metrics.radius,
  };
  const preview = (
    <View style={[styles.preview, box]} accessible accessibilityLabel={text.cameraPreview}>
      {scanning && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }: BarcodeScanningResult) => onScan(data)}
        />
      )}
      {CORNERS.map((corner) => (
        <View key={corner} style={bracketStyle(corner, metrics)} />
      ))}
    </View>
  );
  if (onFakeScan === undefined) return preview;
  return (
    <Pressable
      onPress={onFakeScan}
      accessibilityRole="button"
      accessibilityLabel={text.cameraPreview}
    >
      {preview}
    </Pressable>
  );
}

/** One corner bracket: the two outer edges of a rounded square, inset from the preview's corner. */
function bracketStyle(corner: Corner, { bracket, bracketColor }: PreviewMetrics) {
  const top = corner.startsWith("top");
  const left = corner.endsWith("Left");
  return {
    position: "absolute" as const,
    width: bracket.size,
    height: bracket.size,
    borderColor: bracketColor,
    ...(top
      ? { top: bracket.inset, borderTopWidth: bracket.stroke }
      : { bottom: bracket.inset, borderBottomWidth: bracket.stroke }),
    ...(left
      ? { left: bracket.inset, borderLeftWidth: bracket.stroke }
      : { right: bracket.inset, borderRightWidth: bracket.stroke }),
    [`border${corner[0]!.toUpperCase()}${corner.slice(1)}Radius`]: bracket.radius,
  };
}

const styles = StyleSheet.create({
  preview: { backgroundColor: "#000000", overflow: "hidden" },
});
