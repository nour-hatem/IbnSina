"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  SimpleGrid,
  Button,
  Badge,
  Text,
  Input,
  Field,
  Dialog,
} from "@chakra-ui/react";
import { approveGate, ApiError } from "@/lib/api";
import type { PatientEncounter } from "@/lib/types";
import { CXRUploader } from "@/components/CXRUploader";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  FileText,
  Upload,
  Activity,
  Microscope,
  Eye,
} from "lucide-react";

interface ClinicalGateApprovalProps {
  encounterId: string;
  gate: "radiology" | "synthesis";
  encounterState: PatientEncounter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
}

export function ClinicalGateApproval({
  encounterId,
  gate,
  encounterState,
  open,
  onOpenChange,
  onActionComplete,
}: ClinicalGateApprovalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const isRadiologyGate = gate === "radiology";

  const handleDecision = async (action: "accept" | "reject") => {
    try {
      setLoading(true);
      setError(null);

      await approveGate(encounterId, {
        gate,
        approved_by: "attending_clinician",
        action,
        edits: notes.trim() ? { clinician_notes: notes.trim() } : null,
      });

      onOpenChange(false);
      onActionComplete();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(`Failed to submit gate ${action}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />

      <Dialog.Positioner>
        <Dialog.Content bg="white" borderRadius="xl" borderWidth="1px" borderColor="slate.200" p={6} maxW="640px" maxH="90vh" overflowY="auto" w="full" boxShadow="xl">
          {/* Header */}
          <Dialog.Header spaceY={1} pb={2}>
            <HStack gap={2}>
              <Badge variant="outline" bg="brand.100" color="brand.900" borderColor="brand.300" textTransform="uppercase" fontSize="10px" px={2} py={0.5}>
                Clinician Gate Approval
              </Badge>
              <Badge variant="outline" bg="brand.800" color="white" borderColor="brand.900" textTransform="capitalize" fontSize="10px" px={2} py={0.5}>
                {gate} Stage
              </Badge>
            </HStack>
            <Dialog.Title fontSize="xl" fontWeight="bold" color="slate.900" pt={1}>
              {isRadiologyGate ? "Approve Orders & Imaging Gate" : "Approve Final Synthesis & Assessment Gate"}
            </Dialog.Title>
            <Dialog.Description fontSize="xs" color="slate.500">
              Encounter ID: <Text as="span" fontFamily="mono" color="slate.700">{encounterId}</Text> — Review AI recommendations before advancing the clinical state graph.
            </Dialog.Description>
          </Dialog.Header>

          <VStack align="stretch" gap={4} pt={2}>
            {/* Error Alert */}
            {error && (
              <Flex p={3} borderRadius="lg" bg="brand.50" borderWidth="1px" borderColor="brand.300" color="brand.900" fontSize="xs" align="center" gap={2}>
                <Box color="brand.700" display="inline-flex" flexShrink={0}><AlertCircle className="h-4 w-4" /></Box>
                <Text fontSize="xs">{error}</Text>
              </Flex>
            )}

            {/* Gate 1: Radiology Gate Review Content */}
            {isRadiologyGate && (
              <VStack align="stretch" gap={4} fontSize="xs" color="slate.700">
                {/* Patient & Vitals Summary */}
                <Box p={3} borderRadius="lg" bg="slate.50" borderWidth="1px" borderColor="slate.200" spaceY={2}>
                  <Flex align="center" justify="space-between">
                    <HStack gap={1.5} fontWeight="semibold" color="slate.900">
                      <Box color="brand.700" display="inline-flex"><Activity className="h-3.5 w-3.5" /></Box>
                      <Text>Patient Summary</Text>
                    </HStack>
                    <Text color="slate.500" fontFamily="mono" fontSize="xs">
                      {encounterState.patient?.full_name || "Unnamed"} ({encounterState.patient?.age_display || "Age N/A"}, {encounterState.patient?.sex || "Sex N/A"})
                    </Text>
                  </Flex>
                  {encounterState.vitals && (
                    <SimpleGrid columns={4} gap={2} pt={1} borderTopWidth="1px" borderColor="slate.200" fontFamily="mono" fontSize="11px">
                      <Box>Temp: <Text as="span" fontWeight="semibold">{encounterState.vitals.temp_c ?? "—"}°C</Text></Box>
                      <Box>HR: <Text as="span" fontWeight="semibold">{encounterState.vitals.hr ?? "—"} bpm</Text></Box>
                      <Box>RR: <Text as="span" fontWeight="semibold">{encounterState.vitals.rr ?? "—"} /min</Text></Box>
                      <Box>SpO2: <Text as="span" fontWeight="semibold">{encounterState.vitals.spo2 ?? "—"}%</Text></Box>
                    </SimpleGrid>
                  )}
                </Box>

                {/* Proposed Imaging Orders */}
                <Box spaceY={2}>
                  <HStack gap={1.5} fontWeight="bold" color="slate.900" textTransform="uppercase" letterSpacing="wider" fontSize="11px">
                    <Box color="brand.700" display="inline-flex"><Eye className="h-3.5 w-3.5" /></Box>
                    <Text>Proposed Imaging Orders</Text>
                  </HStack>
                  {encounterState.imaging_orders && encounterState.imaging_orders.length > 0 ? (
                    <VStack align="stretch" gap={1.5}>
                      {encounterState.imaging_orders.map((img, idx) => (
                        <Flex key={idx} p={2.5} borderRadius="lg" borderWidth="1px" borderColor="brand.200" bg="brand.50" align="flex-start" justify="space-between">
                          <Box>
                            <Text fontWeight="semibold" color="brand.900">{img.modality} ({img.view})</Text>
                            <Text fontSize="11px" color="slate.600" mt={0.5}>{img.rationale}</Text>
                          </Box>
                          <Badge variant="outline" bg="brand.700" color="white" fontSize="10px" px={2} py={0.5}>
                            {img.urgency}
                          </Badge>
                        </Flex>
                      ))}
                    </VStack>
                  ) : (
                    <Text color="slate.400" fontStyle="italic">No imaging orders proposed.</Text>
                  )}
                </Box>

                {/* CXR Image Upload Component */}
                <Box spaceY={1.5}>
                  <HStack gap={1.5} fontWeight="bold" color="slate.900" textTransform="uppercase" letterSpacing="wider" fontSize="11px">
                    <Box color="brand.700" display="inline-flex"><Upload className="h-3.5 w-3.5" /></Box>
                    <Text>Chest Radiograph (CXR) Attachment (Optional)</Text>
                  </HStack>
                  <CXRUploader
                    encounterId={encounterId}
                    disabled={loading}
                  />
                </Box>

                {/* Proposed Lab Orders */}
                <Box spaceY={2}>
                  <HStack gap={1.5} fontWeight="bold" color="slate.900" textTransform="uppercase" letterSpacing="wider" fontSize="11px">
                    <Box color="brand.700" display="inline-flex"><Microscope className="h-3.5 w-3.5" /></Box>
                    <Text>Proposed Lab Orders ({encounterState.lab_orders?.length || 0})</Text>
                  </HStack>
                  {encounterState.lab_orders && encounterState.lab_orders.length > 0 && (
                    <VStack align="stretch" maxH="36" overflowY="auto" gap={1} borderWidth="1px" borderColor="slate.200" borderRadius="lg" p={2} bg="slate.50/50">
                      {encounterState.lab_orders.map((lab, idx) => (
                        <Flex key={idx} align="center" justify="space-between" fontSize="11px" py={1} borderBottomWidth="1px" borderColor="slate.100">
                          <Box>
                            <Text as="span" fontWeight="medium" color="slate.900">{lab.name}</Text>
                            <Text as="span" color="slate.400" fontFamily="mono" ml={2}>[{lab.code}]</Text>
                          </Box>
                          <Badge variant="subtle" fontSize="10px" bg="slate.200" color="slate.800" px={2}>
                            {lab.priority}
                          </Badge>
                        </Flex>
                      ))}
                    </VStack>
                  )}
                </Box>
              </VStack>
            )}

            {/* Gate 2: Synthesis Gate Review Content */}
            {!isRadiologyGate && (
              <VStack align="stretch" gap={4} fontSize="xs" color="slate.700">
                {/* Radiology CXR Read Summary */}
                <Box spaceY={2}>
                  <HStack gap={1.5} fontWeight="bold" color="slate.900" textTransform="uppercase" letterSpacing="wider" fontSize="11px">
                    <Box color="brand.700" display="inline-flex"><FileText className="h-3.5 w-3.5" /></Box>
                    <Text>Radiology Vision Preliminary Read</Text>
                  </HStack>
                  {encounterState.cxr_read ? (
                    <Box p={3} borderRadius="lg" borderWidth="1px" borderColor="brand.300" bg="brand.50" spaceY={2}>
                      <Flex align="center" justify="space-between">
                        <Text fontWeight="semibold" color="slate.900">
                          Impression: {encounterState.cxr_read.impression}
                        </Text>
                        <Badge variant="outline" bg="brand.800" color="white" fontSize="10px" px={2} py={0.5}>
                          Likelihood: {encounterState.cxr_read.pneumonia_likelihood}
                        </Badge>
                      </Flex>

                      <Box>
                        <Text fontWeight="medium" color="slate.700" display="block">Findings:</Text>
                        <Box as="ul" pl={4} pt={0.5} spaceY={0.5} color="slate.600">
                          {encounterState.cxr_read.findings.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </Box>
                      </Box>

                      <Flex pt={1} borderTopWidth="1px" borderColor="brand.200" align="center" justify="space-between" fontSize="11px" color="slate.500" fontFamily="mono">
                        <Text>Model: {encounterState.cxr_read.model_used}</Text>
                        <Text>Confidence: {(encounterState.cxr_read.confidence * 100).toFixed(0)}%</Text>
                      </Flex>

                      <Box p={2} borderRadius="md" bg="white" borderWidth="1px" borderColor="slate.200" fontSize="11px" color="slate.600" fontStyle="italic">
                        <Text as="span" fontWeight="semibold" color="slate.700">Limitations: </Text>
                        {encounterState.cxr_read.limitations}
                      </Box>
                    </Box>
                  ) : (
                    <Text color="slate.400" fontStyle="italic">No radiology read available.</Text>
                  )}
                </Box>

                {/* Accumulated Clinical HPI & SOAP Note */}
                {encounterState.hpi && (
                  <Box p={3} borderRadius="lg" bg="slate.50" borderWidth="1px" borderColor="slate.200" spaceY={1}>
                    <Text fontWeight="semibold" color="slate.900" display="block">History of Present Illness (HPI):</Text>
                    <Text fontSize="11px" color="slate.700">{encounterState.hpi}</Text>
                  </Box>
                )}
              </VStack>
            )}

            {/* Optional Notes Input */}
            <Box spaceY={1} pt={2} borderTopWidth="1px" borderColor="slate.200">
              <Field.Label htmlFor="clinicianNotes" fontSize="xs" fontWeight="semibold" color="slate.700">
                Clinician Review Notes (Optional)
              </Field.Label>
              <Input
                id="clinicianNotes"
                type="text"
                placeholder="Add comments or instructions for the audit trail..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                size="sm"
                borderColor="slate.200"
                _focus={{ borderColor: "brand.500" }}
              />
            </Box>

            {/* Actions Footer */}
            <Dialog.Footer pt={3} display="flex" justifyContent="flex-end" gap={2}>
              <Button
                type="button"
                onClick={() => handleDecision("reject")}
                disabled={loading}
                size="xs"
                variant="outline"
                bg="brand.100"
                color="brand.900"
                borderColor="brand.300"
                _hover={{ bg: "brand.200" }}
                fontWeight="semibold"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Box color="brand.800" display="inline-flex"><XCircle className="h-3.5 w-3.5" /></Box>}
                Reject Gate
              </Button>
              <Button
                type="button"
                onClick={() => handleDecision("accept")}
                disabled={loading}
                size="xs"
                bg="brand.700"
                color="white"
                _hover={{ bg: "brand.800" }}
                fontWeight="semibold"
                boxShadow="xs"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approve & Proceed
              </Button>
            </Dialog.Footer>
          </VStack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
