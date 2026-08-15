"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  SimpleGrid,
  Button,
  Badge,
  Text,
  Heading,
  Dialog,
} from "@chakra-ui/react";
import { getEncounter, ApiError } from "@/lib/api";
import type { PatientEncounter, DifferentialItem } from "@/lib/types";
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Stethoscope,
} from "lucide-react";

interface EdReportViewProps {
  encounterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EdReportView({
  encounterId,
  open,
  onOpenChange,
}: EdReportViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encounterState, setEncounterState] = useState<PatientEncounter | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!open || !encounterId) return;

    async function fetchReportData() {
      try {
        setLoading(true);
        setError(null);
        const detail = await getEncounter(encounterId);

        if (detail.status !== "complete") {
          setError(
            `Encounter is currently in progress (${detail.status.toUpperCase()}). The final Emergency Department (ED) report is only generated once all clinician approval gates are completed.`
          );
          setEncounterState(detail.state);
          setIsComplete(false);
        } else {
          setEncounterState(detail.state);
          setIsComplete(true);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load clinical encounter report.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchReportData();
  }, [encounterId, open]);

  // Helper to parse and render Markdown lines safely without external dependencies
  const renderFormattedMarkdown = (markdownText: string) => {
    if (!markdownText) return null;

    const lines = markdownText.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<Box key={idx} h={2} />);
        return;
      }

      // Horizontal Rule
      if (trimmed === "---") {
        elements.push(
          <Box key={idx} my={3} borderBottomWidth="1px" borderColor="slate.200" />
        );
        return;
      }

      // Headers (### or ## or #)
      if (trimmed.startsWith("#")) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const text = trimmed.replace(/^#+\s*/, "");
        const headerColor = level === 1 ? "brand.900" : level === 2 ? "slate.900" : "slate.800";
        const headerSize = level === 1 ? "sm" : level === 2 ? "xs" : "xs";

        elements.push(
          <Heading key={idx} size={headerSize} fontWeight="bold" color={headerColor} mt={3} mb={1}>
            {parseBoldText(text)}
          </Heading>
        );
        return;
      }

      // Bullet items (- or *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const text = trimmed.replace(/^[-*]\s*/, "");
        elements.push(
          <Flex key={idx} align="flex-start" gap={2} fontSize="xs" color="slate.700" ml={2} my={0.5}>
            <Box h="6px" w="6px" borderRadius="full" bg="brand.600" mt={1.5} flexShrink={0} />
            <Text fontSize="xs" color="slate.700">{parseBoldText(text)}</Text>
          </Flex>
        );
        return;
      }

      // Default paragraph line
      elements.push(
        <Text key={idx} fontSize="xs" color="slate.700" lineHeight="relaxed" my={1}>
          {parseBoldText(trimmed)}
        </Text>
      );
    });

    return elements;
  };

  // Helper to parse inline **bold text**
  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text as="strong" key={i} fontWeight="semibold" color="slate.900">
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />

      <Dialog.Positioner>
        <Dialog.Content bg="white" borderRadius="xl" borderWidth="1px" borderColor="slate.200" p={6} maxW="3xl" maxH="90vh" display="flex" flexDirection="column" w="full" boxShadow="xl">
          {/* Fixed Header */}
          <Dialog.Header flexShrink={0} pb={3} borderBottomWidth="1px" borderColor="slate.100">
            <Flex align="center" justify="space-between" gap={3}>
              <HStack gap={3}>
                <Box p={2} borderRadius="lg" bg="brand.100" color="brand.800">
                  <FileText className="h-5 w-5" />
                </Box>
                <Box>
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2}>
                    Emergency Department Final Synthesis Report
                  </Dialog.Title>
                  <Dialog.Description fontSize="xs" color="slate.500" fontFamily="mono">
                    Encounter ID: {encounterId}
                  </Dialog.Description>
                </Box>
              </HStack>
              {isComplete && (
                <Badge variant="outline" bg="brand.700" color="white" borderColor="brand.800" fontSize="xs" px={2.5} py={1} borderRadius="full">
                  Finalized
                </Badge>
              )}
            </Flex>
          </Dialog.Header>

          {/* Scrollable Content Body (Prevents Boundary Overflow) */}
          <Dialog.Body flex="1" overflowY="auto" py={4} spaceY={6}>
            {/* Loading State */}
            {loading && (
              <VStack justify="center" py={12} gap={3} color="slate.500">
                <Box color="brand.600"><Loader2 className="h-8 w-8 animate-spin" /></Box>
                <Text fontSize="xs" fontWeight="medium">Fetching encounter synthesis report...</Text>
              </VStack>
            )}

            {/* Error / In-Progress State */}
            {!loading && error && (
              <Box p={4} borderRadius="lg" bg="brand.50" borderWidth="1px" borderColor="brand.300" color="brand.950" fontSize="xs" spaceY={2} my={2}>
                <HStack gap={2} fontWeight="semibold" color="brand.900">
                  <Box color="brand.700" display="inline-flex" flexShrink={0}><AlertCircle className="h-4 w-4" /></Box>
                  <Text>Report Unavailable</Text>
                </HStack>
                <Text fontSize="11px" lineHeight="relaxed" color="slate.700">{error}</Text>
              </Box>
            )}

            {/* Completed Report Content */}
            {!loading && encounterState && isComplete && (
              <VStack align="stretch" gap={6} fontSize="xs">
                {/* Structured Highlights Box (Clinician Executive Summary) */}
                <VStack align="stretch" gap={4}>
                  <Heading size="xs" fontWeight="bold" color="slate.900" textTransform="uppercase" letterSpacing="wider" display="flex" alignItems="center" gap={1.5}>
                    <Box color="brand.700" display="inline-flex"><Stethoscope className="h-4 w-4" /></Box>
                    Clinician Summary & Structured Assessments
                  </Heading>

                  {/* 1. Working Diagnosis */}
                  <Box p={3.5} borderRadius="lg" borderWidth="1px" borderColor="brand.300" bg="brand.50" spaceY={1}>
                    <Text fontSize="11px" fontWeight="semibold" color="brand.900" display="block" textTransform="uppercase" letterSpacing="wider">
                      Final Working Diagnosis
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="slate.900">
                      {encounterState.final_diagnosis || "Diagnosis pending clinical review"}
                    </Text>
                  </Box>

                  {/* 2. Structured Grid: Severity + Disposition */}
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                    {/* Disposition Box */}
                    <Box p={3} borderRadius="lg" borderWidth="1px" borderColor="slate.200" bg="slate.50" spaceY={2}>
                      <Flex align="center" justify="space-between">
                        <Text fontWeight="semibold" color="slate.900">Disposition</Text>
                        <Badge variant="outline" fontSize="10px" bg="brand.100" color="brand.900" borderColor="brand.300" px={2} py={0.5}>
                          <Box color="brand.700" display="inline-flex" mr={1}><ShieldCheck className="h-3 w-3" /></Box>
                          Computed (Rule-Based)
                        </Badge>
                      </Flex>
                      {encounterState.disposition ? (
                        <Box>
                          <Text fontWeight="bold" color="slate.900" fontSize="xs">
                            {encounterState.disposition.decision}
                          </Text>
                          <Text fontSize="11px" color="slate.600" mt={1}>
                            {encounterState.disposition.rationale}
                          </Text>
                        </Box>
                      ) : (
                        <Text color="slate.400" fontStyle="italic">No disposition computed</Text>
                      )}
                    </Box>

                    {/* Severity Score Box */}
                    <Box p={3} borderRadius="lg" borderWidth="1px" borderColor="slate.200" bg="slate.50" spaceY={2}>
                      <Flex align="center" justify="space-between">
                        <Text fontWeight="semibold" color="slate.900">Severity Assessment</Text>
                        <Badge variant="outline" fontSize="10px" bg="brand.100" color="brand.900" borderColor="brand.300" px={2} py={0.5}>
                          <Box color="brand.700" display="inline-flex" mr={1}><ShieldCheck className="h-3 w-3" /></Box>
                          Computed (Deterministic)
                        </Badge>
                      </Flex>
                      {encounterState.severity ? (
                        <VStack align="stretch" gap={1} fontFamily="mono" fontSize="11px">
                          <Text>
                            Classification: <Text as="span" fontWeight="semibold" color="slate.900">{encounterState.severity.classification}</Text>
                          </Text>
                          <Text>
                            Danger Signs ({encounterState.severity.who_danger_sign_count ?? 0}):{" "}
                            <Text as="span" fontWeight="semibold" color="slate.800">
                              {encounterState.severity.who_danger_signs && encounterState.severity.who_danger_signs.length > 0
                                ? encounterState.severity.who_danger_signs.join(", ")
                                : "None"}
                            </Text>
                          </Text>
                          <Text>
                            PIDS/IDSA Severe:{" "}
                            <Text as="span" fontWeight="semibold" color="slate.900">
                              {encounterState.severity.idsa_severe ? "Yes" : "No"}
                            </Text>
                          </Text>
                        </VStack>
                      ) : (
                        <Text color="slate.400" fontStyle="italic">No severity score available</Text>
                      )}
                    </Box>
                  </SimpleGrid>

                  {/* 3. Ranked Differential Diagnosis */}
                  {encounterState.differential && encounterState.differential.length > 0 && (
                    <Box spaceY={2}>
                      <Text fontWeight="semibold" color="slate.900" display="block">
                        Ranked Differential Diagnosis ({encounterState.differential.length})
                      </Text>
                      <VStack align="stretch" maxH="48" overflowY="auto" gap={1.5} pr={1}>
                        {encounterState.differential.map((diff: DifferentialItem, idx: number) => (
                          <Flex
                            key={idx}
                            p={2.5}
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor="slate.200"
                            bg="slate.50/70"
                            direction={{ base: "column", sm: "row" }}
                            align={{ sm: "center" }}
                            justify="space-between"
                            gap={2}
                          >
                            <Box spaceY={0.5}>
                              <HStack gap={2}>
                                <Text fontWeight="semibold" color="slate.900">
                                  {idx + 1}. {diff.diagnosis}
                                </Text>
                                {diff.icd10 && (
                                  <Text fontFamily="mono" fontSize="10px" color="slate.500">[{diff.icd10}]</Text>
                                )}
                                {diff.cannot_miss && (
                                  <Badge variant="outline" bg="brand.100" color="brand.900" borderColor="brand.300" fontSize="9px" py={0}>
                                    Cannot-Miss
                                  </Badge>
                                )}
                              </HStack>
                              {diff.supporting_evidence && diff.supporting_evidence.length > 0 && (
                                <Text fontSize="11px" color="slate.600">
                                  Supporting: {diff.supporting_evidence.join(", ")}
                                </Text>
                              )}
                            </Box>
                            <Badge
                              variant="subtle"
                              fontSize="10px"
                              textTransform="uppercase"
                              fontFamily="mono"
                              bg="slate.200"
                              color="slate.800"
                              alignSelf={{ base: "flex-start", sm: "center" }}
                              flexShrink={0}
                            >
                              Likelihood: {diff.likelihood}
                            </Badge>
                          </Flex>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>

                {/* Narrative ED Report (Formatted Markdown Text) */}
                <Box pt={4} borderTopWidth="1px" borderColor="slate.200" spaceY={3}>
                  <Heading size="xs" fontWeight="bold" color="slate.900" textTransform="uppercase" letterSpacing="wider" display="flex" alignItems="center" gap={1.5}>
                    <Box color="brand.700" display="inline-flex"><FileText className="h-4 w-4" /></Box>
                    Emergency Department Report Narrative
                  </Heading>
                  <Box p={4} borderRadius="xl" borderWidth="1px" borderColor="slate.200" bg="slate.50/40" color="slate.800" fontFamily="sans" lineHeight="relaxed">
                    {encounterState.ed_report_md
                      ? renderFormattedMarkdown(encounterState.ed_report_md)
                      : <Text color="slate.400" fontStyle="italic">No report narrative generated.</Text>}
                  </Box>
                </Box>
              </VStack>
            )}
          </Dialog.Body>

          {/* Fixed Footer */}
          <Dialog.Footer flexShrink={0} pt={4} borderTopWidth="1px" borderColor="slate.100" display="flex" justifyContent="flex-end">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              size="xs"
              variant="outline"
              bg="slate.100"
              color="slate.700"
              borderColor="slate.300"
              _hover={{ bg: "slate.200" }}
              fontWeight="semibold"
            >
              Close Report
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
