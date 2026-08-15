"use client";

import { useEffect, useState, useRef } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Button,
  Text,
} from "@chakra-ui/react";
import { uploadCXR, ApiError } from "@/lib/api";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface CXRUploaderProps {
  encounterId: string;
  onUploadComplete?: (cxrPath: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function CXRUploader({
  encounterId,
  onUploadComplete,
  disabled = false,
}: CXRUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL on unmount or preview URL change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateFile = (file: File): string | null => {
    const validTypes = ["image/jpeg", "image/png"];
    if (!validTypes.includes(file.type)) {
      return "Invalid file type. Only JPEG (.jpg, .jpeg) and PNG (.png) images are accepted.";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${sizeMB} MB) exceeds maximum allowed limit of 10 MB.`;
    }
    return null;
  };

  const processAndUploadFile = async (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);

    try {
      setUploading(true);
      const res = await uploadCXR(encounterId, file);
      setUploadedPath(res.cxr_path);
      if (onUploadComplete) {
        onUploadComplete(res.cxr_path);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to upload Chest Radiograph. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  const triggerSelect = () => {
    if (!disabled && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Compute drop zone border/bg based on state
  const dropZoneBorderColor = dragActive
    ? "brand.600"
    : uploadedPath
    ? "brand.400"
    : "brand.300";

  const dropZoneBg = dragActive
    ? "brand.100/60"
    : uploadedPath
    ? "brand.50/40"
    : "brand.50/20";

  const dropZoneHoverBg = uploadedPath ? "brand.50" : "brand.50/50";

  return (
    <VStack align="stretch" gap={2} fontSize="xs">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        disabled={disabled || uploading}
        style={{ display: "none" }}
      />

      {/* Drop zone / Upload box */}
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        position="relative"
        p={4}
        borderRadius="xl"
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={dropZoneBorderColor}
        bg={dropZoneBg}
        _hover={{ bg: dropZoneHoverBg }}
        transition="all 0.2s"
        cursor={disabled || uploading ? "not-allowed" : "pointer"}
        opacity={disabled || uploading ? 0.6 : 1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap={2}
      >
        {/* Uploading Spinner State */}
        {uploading ? (
          <VStack gap={2} py={3} color="brand.800">
            <Box color="brand.600" display="inline-flex"><Loader2 className="h-6 w-6 animate-spin" /></Box>
            <Text fontWeight="medium" fontSize="xs">Uploading Chest Radiograph...</Text>
            <Text fontSize="11px" color="slate.500">{selectedFile?.name}</Text>
          </VStack>
        ) : uploadedPath && previewUrl ? (
          /* Upload Success & Preview State */
          <Flex w="full" direction={{ base: "column", sm: "row" }} align="center" gap={4} py={1}>
            {/* Thumbnail */}
            <Box
              position="relative"
              flexShrink={0}
              w="96px"
              h="96px"
              borderRadius="lg"
              overflow="hidden"
              borderWidth="1px"
              borderColor="brand.300"
              bg="gray.900"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="CXR Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Box>

            {/* Info & Replace */}
            <VStack flex="1" align={{ base: "center", sm: "flex-start" }} gap={1}>
              <HStack gap={1.5} color="brand.900" fontWeight="semibold">
                <Box color="brand.700" display="inline-flex" flexShrink={0}><CheckCircle2 className="h-4 w-4" /></Box>
                <Text>Radiograph Uploaded</Text>
              </HStack>
              <Text fontSize="11px" fontFamily="mono" color="slate.600" truncate maxW="280px">
                {selectedFile?.name || uploadedPath.split("/").pop()}
              </Text>
              <Text fontSize="10px" color="slate.500">
                Processed &amp; attached for Radiology Vision Agent
              </Text>
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerSelect();
                }}
                disabled={disabled || uploading}
                size="xs"
                variant="outline"
                bg="brand.100"
                color="brand.800"
                borderColor="brand.300"
                _hover={{ bg: "brand.200" }}
                mt={1}
                fontSize="11px"
                fontWeight="medium"
              >
                <RefreshCw className="h-3 w-3" />
                Replace Image
              </Button>
            </VStack>
          </Flex>
        ) : (
          /* Default Idle / Drag-and-Drop Prompt State */
          <VStack gap={1.5} py={2} textAlign="center">
            <Box p={2} borderRadius="full" bg="brand.100" color="brand.800">
              <Upload className="h-5 w-5" />
            </Box>
            <Box>
              <Text as="span" fontWeight="semibold" color="slate.900">
                Click to browse
              </Text>{" "}
              <Text as="span" color="slate.500">or drag and drop chest X-ray</Text>
            </Box>
            <Text fontSize="11px" color="slate.400">
              Supports JPEG and PNG formats (max 10 MB)
            </Text>
          </VStack>
        )}
      </Box>

      {/* Inline Error Display (Blue-only palette) */}
      {error && (
        <Flex p={2.5} borderRadius="lg" bg="brand.50" borderWidth="1px" borderColor="brand.300" color="brand.950" fontSize="xs" align="center" gap={2}>
          <Box color="brand.700" display="inline-flex" flexShrink={0}><AlertCircle className="h-4 w-4" /></Box>
          <Text fontSize="xs">{error}</Text>
        </Flex>
      )}
    </VStack>
  );
}
