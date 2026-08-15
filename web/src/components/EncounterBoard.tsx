"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  SimpleGrid,
  Card,
  Badge,
  Button,
  Heading,
  Text,
  Skeleton,
} from "@chakra-ui/react";
import { NewEncounterModal } from "@/components/NewEncounterModal";
import { ClinicalGateApproval } from "@/components/ClinicalGateApproval";
import { EdReportView } from "@/components/EdReportView";
import { listEncounters, getEncounter, runEncounterStep } from "@/lib/api";
import type { EncounterSummary, PatientEncounter } from "@/lib/types";
import {
  User,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  Play,
  Loader2,
  FileText,
} from "lucide-react";

function getEsiBadgeProps(esi: number | null) {
  if (esi === null) return { bg: "slate.100", color: "slate.700", borderColor: "slate.200" };
  switch (esi) {
    case 1:
      return { bg: "brand.950", color: "white", borderColor: "brand.800", fontWeight: "semibold" };
    case 2:
      return { bg: "brand.800", color: "white", borderColor: "brand.700", fontWeight: "medium" };
    case 3:
      return { bg: "brand.600", color: "white", borderColor: "brand.500" };
    case 4:
      return { bg: "brand.100", color: "brand.900", borderColor: "brand.300" };
    case 5:
      return { bg: "brand.50", color: "brand.800", borderColor: "brand.200" };
    default:
      return { bg: "slate.100", color: "slate.700", borderColor: "slate.200" };
  }
}

function getNodeBadgeProps(node: string | null) {
  if (!node) return { bg: "slate.100", color: "slate.600", borderColor: "slate.200" };
  switch (node.toLowerCase()) {
    case "intake":
      return { bg: "brand.50", color: "brand.700", borderColor: "brand.200" };
    case "triage":
      return { bg: "brand.100", color: "brand.800", borderColor: "brand.300" };
    case "history":
      return { bg: "brand.200", color: "brand.900", borderColor: "brand.400" };
    case "orders":
      return { bg: "brand.600", color: "white", borderColor: "brand.700" };
    case "radiology":
      return { bg: "brand.800", color: "white", borderColor: "brand.900" };
    case "synthesis":
      return { bg: "brand.950", color: "white", borderColor: "brand.800" };
    default:
      return { bg: "slate.100", color: "slate.600", borderColor: "slate.200" };
  }
}

function formatTimestamp(isoStr: string) {
  try {
    const date = new Date(isoStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
}

export function EncounterBoard() {
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cold-start retry state
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);

  // Active approval modal state
  const [selectedEncounter, setSelectedEncounter] = useState<{
    id: string;
    gate: "radiology" | "synthesis";
    state: PatientEncounter;
  } | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [steppingId, setSteppingId] = useState<string | null>(null);

  // ED Synthesis Report modal state
  const [reportEncounterId, setReportEncounterId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const handleOpenReport = (encounterId: string) => {
    setReportEncounterId(encounterId);
    setReportOpen(true);
  };

  const fetchBoardData = async (isRetry = false) => {
    try {
      if (isRetry) {
        setIsWakingUp(false);
      }
      setError(null);
      const res = await listEncounters();
      setEncounters(res.encounters || []);
      setIsWakingUp(false);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load active encounters";
      setError(message);
      setIsWakingUp(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    listEncounters()
      .then((res) => {
        if (isMounted) {
          setEncounters(res.encounters || []);
          setIsWakingUp(false);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load active encounters";
          setError(message);
          setIsWakingUp(true);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Automatic retry effect when backend is waking up
  useEffect(() => {
    if (!isWakingUp || retryAttempts >= 18) return;

    const timer = setTimeout(() => {
      setRetryAttempts((prev) => {
        const next = prev + 1;
        if (next >= 18) {
          setIsWakingUp(false);
        }
        return next;
      });
      fetchBoardData(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [isWakingUp, retryAttempts]);

  const handleOpenGateModal = async (encounterId: string, suggestedGate?: "radiology" | "synthesis") => {
    try {
      setSteppingId(encounterId);
      const detail = await getEncounter(encounterId);
      const nextGate = detail.next?.[0] as "radiology" | "synthesis" | undefined;
      const targetGate = nextGate || suggestedGate || "radiology";

      setSelectedEncounter({
        id: encounterId,
        gate: targetGate,
        state: detail.state,
      });
      setApprovalOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch encounter details");
    } finally {
      setSteppingId(null);
    }
  };

  const handleRunStep = async (encounterId: string) => {
    try {
      setSteppingId(encounterId);
      const res = await runEncounterStep(encounterId);
      if (res.next && res.next.length > 0) {
        const nextGate = res.next[0] as "radiology" | "synthesis";
        setSelectedEncounter({
          id: encounterId,
          gate: nextGate,
          state: res.state,
        });
        setApprovalOpen(true);
      }
      await fetchBoardData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to step encounter forward");
    } finally {
      setSteppingId(null);
    }
  };

  return (
    <Box w="full" spaceY={6}>
      {/* Header Bar */}
      <Box bg="white" p={6} borderRadius="xl" borderWidth="1px" borderColor="slate.200" boxShadow="xs">
        <Flex direction={{ base: "column", sm: "row" }} align={{ sm: "center" }} justify="space-between" gap={4}>
          <Box>
            <Heading size="md" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2}>
              <Box color="brand.600" display="inline-flex"><Activity className="h-5 w-5" /></Box>
              Paediatric Emergency Department Tracking
            </Heading>
            <Text fontSize="sm" color="slate.500" mt={1}>
              Real-time multi-agent decision support tracking active clinical encounters.
            </Text>
          </Box>
          <HStack gap={3}>
            <NewEncounterModal onCreated={() => fetchBoardData()} />
            <Button
              onClick={() => fetchBoardData()}
              disabled={loading}
              variant="outline"
              size="sm"
              borderColor="slate.200"
              bg="slate.50"
              _hover={{ bg: "slate.100" }}
              color="slate.700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Board
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Cold-Start Waking Up Banner */}
      {isWakingUp && (
        <Box p={4} borderRadius="xl" bg="brand.50" borderWidth="1px" borderColor="brand.300" color="brand.900" shadow="xs">
          <Flex direction={{ base: "column", sm: "row" }} align={{ sm: "center" }} justify="space-between" gap={3}>
            <HStack gap={3} align="flex-start">
              <Box p={2} borderRadius="lg" bg="brand.100" color="brand.700" flexShrink={0}>
                <Loader2 className="h-5 w-5 animate-spin" />
              </Box>
              <Box>
                <Text fontWeight="semibold" color="slate.900" fontSize="sm" display="flex" alignItems="center" gap={2}>
                  Waking up the backend service...
                  <Text as="span" color="slate.500" fontFamily="mono" fontSize="xs" fontWeight="normal">
                    (Attempt {retryAttempts + 1}/18)
                  </Text>
                </Text>
                <Text fontSize="xs" color="slate.600" mt={0.5}>
                  The backend service spins down after periods of inactivity. Booting up the multi-agent AI system usually takes 1-2 minutes on first load. Retrying automatically...
                </Text>
              </Box>
            </HStack>
            <Button
              onClick={() => fetchBoardData()}
              size="xs"
              variant="outline"
              borderColor="brand.300"
              bg="brand.100"
              color="brand.900"
              _hover={{ bg: "brand.200" }}
              fontWeight="semibold"
              flexShrink={0}
            >
              Retry Now
            </Button>
          </Flex>
        </Box>
      )}

      {/* Error View */}
      {!isWakingUp && error && (
        <Box p={4} borderRadius="lg" bg="brand.50" borderWidth="1px" borderColor="brand.300" color="brand.900">
          <Flex align="center" justify="space-between" gap={3}>
            <HStack gap={3}>
              <Box color="brand.700" display="inline-flex" flexShrink={0}><AlertCircle className="h-5 w-5" /></Box>
              <Box>
                <Text fontWeight="semibold" fontSize="sm">Error Loading Board</Text>
                <Text fontSize="xs" color="brand.800">{error}</Text>
              </Box>
            </HStack>
            <Button
              onClick={() => fetchBoardData()}
              size="xs"
              variant="outline"
              bg="white"
              _hover={{ bg: "slate.50" }}
              borderColor="slate.300"
              color="slate.700"
            >
              Try Again
            </Button>
          </Flex>
        </Box>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
          {[1, 2, 3].map((i) => (
            <Box key={i} p={5} borderRadius="xl" borderWidth="1px" borderColor="slate.200" bg="white">
              <VStack align="stretch" gap={3}>
                <Skeleton height="20px" width="75%" />
                <Skeleton height="16px" width="50%" />
                <Skeleton height="16px" width="100%" />
                <Skeleton height="16px" width="83%" />
                <Skeleton height="24px" width="96px" />
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      )}

      {/* Empty State */}
      {!loading && !error && encounters.length === 0 && (
        <Box textAlign="center" py={16} px={4} bg="white" borderRadius="xl" borderWidth="1px" borderStyle="dashed" borderColor="slate.300">
          <Flex mx="auto" h={12} w={12} borderRadius="full" bg="brand.50" align="center" justify="center" color="brand.600" mb={4}>
            <CheckCircle2 className="h-6 w-6" />
          </Flex>
          <Heading size="sm" fontWeight="semibold" color="slate.900">
            No Active Encounters
          </Heading>
          <Text fontSize="sm" color="slate.500" maxW="sm" mx="auto" mt={1}>
            The emergency board is clear. New paediatric registrations will appear here in real time.
          </Text>
        </Box>
      )}

      {/* Encounter Grid */}
      {!loading && !error && encounters.length > 0 && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
          {encounters.map((enc) => {
            const isPendingApproval = enc.current_node === "orders" || enc.current_node === "radiology";
            const isStepping = steppingId === enc.encounter_id;
            const targetGate = enc.current_node === "radiology" ? "synthesis" : "radiology";
            const esiProps = getEsiBadgeProps(enc.esi_level);
            const nodeProps = getNodeBadgeProps(enc.current_node);

            return (
              <Card.Root
                key={enc.encounter_id}
                bg="white"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="slate.200"
                boxShadow="xs"
                _hover={{ borderColor: "brand.300", boxShadow: "md" }}
                transition="all 0.2s"
                overflow="hidden"
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
              >
                <Card.Body p={5} spaceY={4}>
                  {/* Header: Name + ESI Badge */}
                  <Flex align="flex-start" justify="space-between" gap={2} pb={3} borderBottomWidth="1px" borderColor="slate.100">
                    <HStack gap={2.5}>
                      <Box p={2} borderRadius="lg" bg="brand.50" color="brand.700">
                        <User className="h-4 w-4" />
                      </Box>
                      <Box>
                        <Text fontWeight="bold" fontSize="md" color="slate.900">
                          {enc.patient_name || "Unnamed Patient"}
                        </Text>
                        <Text fontSize="xs" fontFamily="mono" color="slate.400" mt={0.5}>
                          ID: {enc.encounter_id}
                        </Text>
                      </Box>
                    </HStack>
                    <Badge variant="outline" px={2.5} py={1} borderRadius="full" fontSize="xs" {...esiProps}>
                      {enc.esi_level ? `ESI ${enc.esi_level}` : "ESI Pending"}
                    </Badge>
                  </Flex>

                  {/* Chief Complaint */}
                  <Box>
                    <Text fontSize="xs" fontWeight="medium" color="slate.400" textTransform="uppercase" letterSpacing="wider" mb={1}>
                      Chief Complaint
                    </Text>
                    <Text fontSize="sm" color="slate.700" fontWeight="medium" lineClamp={2}>
                      {enc.chief_complaint || "No complaint recorded"}
                    </Text>
                  </Box>

                  {/* Pending Approval Banner */}
                  {isPendingApproval && (
                    <Flex p={2.5} borderRadius="lg" bg="brand.50" borderWidth="1px" borderColor="brand.300" align="center" justify="space-between" gap={2}>
                      <HStack gap={1.5} fontWeight="semibold" color="brand.900" fontSize="xs">
                        <Box color="brand.700" display="inline-flex"><ShieldAlert className="h-4 w-4" /></Box>
                        Pending Clinician Approval
                      </HStack>
                      <Button
                        onClick={() => handleOpenGateModal(enc.encounter_id, targetGate)}
                        disabled={isStepping}
                        size="xs"
                        bg="brand.700"
                        color="white"
                        _hover={{ bg: "brand.800" }}
                        fontWeight="semibold"
                      >
                        Review & Gate
                      </Button>
                    </Flex>
                  )}

                  {enc.disposition && (
                    <Flex pt={2} borderTopWidth="1px" borderColor="slate.100" align="center" justify="space-between">
                      <Text fontSize="xs" color="slate.500">Disposition</Text>
                      <Badge variant="subtle" bg="slate.100" color="slate.800" fontSize="xs" fontWeight="medium">
                        {enc.disposition.replace(/_/g, " ")}
                      </Badge>
                    </Flex>
                  )}
                </Card.Body>

                {/* Footer: Stage + Action Button + Timestamp */}
                <Card.Footer px={5} py={3} bg="slate.50/60" borderTopWidth="1px" borderColor="slate.100" display="flex" alignItems="center" justifyContent="space-between" fontSize="xs">
                  <HStack gap={1.5}>
                    <Box color="slate.400" display="inline-flex"><Activity className="h-3.5 w-3.5" /></Box>
                    <Text fontWeight="medium" color="slate.500">Stage:</Text>
                    <Badge variant="outline" fontSize="xs" textTransform="capitalize" px={2} py={0.5} borderRadius="md" {...nodeProps}>
                      {enc.current_node || "Unstarted"}
                    </Badge>
                  </HStack>

                  <HStack gap={2}>
                    {enc.disposition || enc.current_node === "synthesis" ? (
                      <Button
                        onClick={() => handleOpenReport(enc.encounter_id)}
                        size="xs"
                        variant="outline"
                        bg="brand.100"
                        color="brand.900"
                        borderColor="brand.300"
                        _hover={{ bg: "brand.200" }}
                        fontWeight="semibold"
                      >
                        <Box color="brand.700" display="inline-flex"><FileText className="h-3.5 w-3.5" /></Box>
                        View ED Report
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleRunStep(enc.encounter_id)}
                        disabled={isStepping}
                        size="xs"
                        variant="outline"
                        bg="brand.50"
                        color="brand.900"
                        borderColor="brand.200"
                        _hover={{ bg: "brand.100" }}
                        fontWeight="semibold"
                      >
                        {isStepping ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Box color="brand.700" display="inline-flex"><Play className="h-3 w-3" /></Box>
                        )}
                        Run Step
                      </Button>
                    )}
                    <HStack gap={1} color="slate.400" fontFamily="mono">
                      <Clock className="h-3.5 w-3.5" />
                      <Text fontSize="xs">{formatTimestamp(enc.updated_at)}</Text>
                    </HStack>
                  </HStack>
                </Card.Footer>
              </Card.Root>
            );
          })}
        </SimpleGrid>
      )}

      {/* Clinical Gate Approval Dialog */}
      {selectedEncounter && (
        <ClinicalGateApproval
          encounterId={selectedEncounter.id}
          gate={selectedEncounter.gate}
          encounterState={selectedEncounter.state}
          open={approvalOpen}
          onOpenChange={setApprovalOpen}
          onActionComplete={fetchBoardData}
        />
      )}

      {/* ED Synthesis Report Dialog */}
      {reportEncounterId && (
        <EdReportView
          encounterId={reportEncounterId}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}
    </Box>
  );
}
