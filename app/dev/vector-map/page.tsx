import { VectorMapPreview } from "@/components/maps/vector-map-preview";

export default function VectorMapPreviewPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <VectorMapPreview />;
}
