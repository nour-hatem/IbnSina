"use client";

import Link from "next/link";
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
} from "@chakra-ui/react";
import {
  Stethoscope,
  ShieldCheck,
  ArrowLeft,
  Activity,
  Layers,
  FileCheck2,
  Lock,
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Eye,
  Microscope,
  ClipboardList,
  Info,
} from "lucide-react";

export default function AboutPage() {
  return (
    <Box minH="screen" bg="slate.50" color="slate.900" fontFamily="sans" display="flex" flexDirection="column">
      {/* Navigation Header */}
      <Box as="header" position="sticky" top={0} zIndex={30} bg="white/95" backdropFilter="blur(8px)" borderBottomWidth="1px" borderColor="slate.200/80" px={6} py={4}>
        <Flex maxW="7xl" mx="auto" align="center" justify="space-between">
          <Link href="/" style={{ textDecoration: "none" }}>
            <HStack gap={3}>
              <Flex h={10} w={10} borderRadius="xl" bg="brand.700" align="center" justify="center" color="white" boxShadow="xs">
                <Stethoscope className="h-5 w-5" />
              </Flex>
              <Box>
                <Heading size="sm" fontWeight="bold" letterSpacing="tight" color="slate.900" display="flex" alignItems="center" gap={2}>
                  IbnSina
                  <Badge variant="outline" bg="brand.50" color="brand.700" borderColor="brand.200" fontSize="10px" px={2} py={0.5} borderRadius="full" fontWeight="normal">
                    v0.1.0
                  </Badge>
                </Heading>
                <Text fontSize="xs" color="slate.500">Paediatric Emergency Decision Support System</Text>
              </Box>
            </HStack>
          </Link>

          <HStack gap={3}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <Button
                size="sm"
                variant="outline"
                bg="slate.100"
                color="slate.700"
                borderColor="slate.200"
                _hover={{ bg: "slate.200" }}
                fontSize="xs"
                fontWeight="semibold"
              >
                <Box color="brand.600" display="inline-flex"><Activity className="h-4 w-4" /></Box>
                Tracking Board
              </Button>
            </Link>
            <Link href="/about" style={{ textDecoration: "none" }}>
              <Button
                size="sm"
                bg="brand.700"
                color="white"
                _hover={{ bg: "brand.800" }}
                fontSize="xs"
                fontWeight="semibold"
                boxShadow="xs"
              >
                <Info className="h-4 w-4" />
                About & Workflow
              </Button>
            </Link>
          </HStack>
        </Flex>
      </Box>

      {/* Main Container */}
      <Box as="main" flex="1" maxW="5xl" w="full" mx="auto" p={{ base: 6, md: 10 }} spaceY={10}>
        {/* Back Link & Hero */}
        <VStack align="stretch" gap={4}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <HStack gap={1.5} fontSize="xs" fontWeight="medium" color="slate.500" _hover={{ color: "brand.700" }}>
              <ArrowLeft className="h-3.5 w-3.5" />
              <Text>Back to Emergency Department Board</Text>
            </HStack>
          </Link>

          <Box bg="white" p={8} borderRadius="2xl" borderWidth="1px" borderColor="slate.200/80" boxShadow="xs" spaceY={4}>
            <Badge variant="outline" bg="brand.50" color="brand.800" borderColor="brand.200" fontSize="xs" fontWeight="medium" px={3} py={1} borderRadius="full" display="inline-flex" alignItems="center" gap={2}>
              <Box color="brand.600" display="inline-flex"><ShieldCheck className="h-4 w-4" /></Box>
              Research Prototype &bull; Clinical Decision Support
            </Badge>
            <Heading size={{ base: "xl", md: "2xl" }} fontWeight="extrabold" color="slate.900" letterSpacing="tight">
              About IbnSina & Clinical Architecture
            </Heading>
            <Text fontSize="sm" color="slate.600" lineHeight="relaxed" maxW="3xl">
              IbnSina is a multi-agent AI system designed to assist emergency clinicians in evaluating, triaging, and managing paediatric patients presenting with acute lower respiratory complaints — specifically Community-Acquired Pneumonia (CAP) in children aged 1 to 5 years.
            </Text>

            <Box p={4} borderRadius="xl" bg="brand.50" borderWidth="1px" borderColor="brand.200" fontSize="xs" color="slate.700" spaceY={1}>
              <Text fontSize="xs" fontWeight="bold" color="brand.900" display="block" textTransform="uppercase" letterSpacing="wider">
                Clinical Research Disclaimer
              </Text>
              <Text fontSize="xs" lineHeight="relaxed">
                IbnSina is an experimental research prototype intended solely for demonstration and clinical workflow supervision research. It is <Text as="strong" fontWeight="bold">not a certified medical device</Text> and must not be used for actual patient care. All patient encounters managed within this platform use synthetic, anonymized clinical scenarios.
              </Text>
            </Box>
          </Box>
        </VStack>

        {/* Section 1: The 6-Stage Multi-Agent Workflow */}
        <VStack align="stretch" gap={4}>
          <HStack gap={2}>
            <Box p={2} borderRadius="lg" bg="brand.100" color="brand.800">
              <Layers className="h-5 w-5" />
            </Box>
            <Box>
              <Heading size="md" fontWeight="bold" color="slate.900">The 6-Stage Multi-Agent Pipeline</Heading>
              <Text fontSize="xs" color="slate.500">How patient encounters progress from initial registration to disposition</Text>
            </Box>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            <Card.Root borderWidth="1px" borderColor="slate.200" bg="white" borderRadius="xl">
              <Card.Header pb={2} spaceY={1}>
                <Badge variant="outline" bg="brand.50" color="brand.800" borderColor="brand.200" fontSize="10px" px={2} py={0.5} w="fit-content">
                  Stage 1
                </Badge>
                <Card.Title fontSize="sm" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2} mt={1}>
                  <Box color="brand.600" display="inline-flex"><ClipboardList className="h-4 w-4" /></Box>
                  Intake Agent
                </Card.Title>
              </Card.Header>
              <Card.Body fontSize="xs" color="slate.600" lineHeight="relaxed">
                Parses raw clinical registration notes into structured patient demographics, vitals, and chief complaint statements.
              </Card.Body>
            </Card.Root>

            <Card.Root borderWidth="1px" borderColor="slate.200" bg="white" borderRadius="xl">
              <Card.Header pb={2} spaceY={1}>
                <Badge variant="outline" bg="brand.100" color="brand.900" borderColor="brand.300" fontSize="10px" px={2} py={0.5} w="fit-content">
                  Stage 2
                </Badge>
                <Card.Title fontSize="sm" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2} mt={1}>
                  <Box color="brand.600" display="inline-flex"><Activity className="h-4 w-4" /></Box>
                  Triage Agent
                </Card.Title>
              </Card.Header>
              <Card.Body fontSize="xs" color="slate.600" lineHeight="relaxed">
                Evaluates vital signs against WHO paediatric reference ranges to assign an initial Emergency Severity Index (ESI 1–5).
              </Card.Body>
            </Card.Root>

            <Card.Root borderWidth="1px" borderColor="slate.200" bg="white" borderRadius="xl">
              <Card.Header pb={2} spaceY={1}>
                <Badge variant="outline" bg="brand.200" color="brand.950" borderColor="brand.400" fontSize="10px" px={2} py={0.5} w="fit-content">
                  Stage 3
                </Badge>
                <Card.Title fontSize="sm" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2} mt={1}>
                  <Box color="brand.700" display="inline-flex"><BrainCircuit className="h-4 w-4" /></Box>
                  History Agent
                </Card.Title>
              </Card.Header>
              <Card.Body fontSize="xs" color="slate.600" lineHeight="relaxed">
                Synthesizes presenting history into structured Subjective/Objective clinical notes (HPI and SOAP narrative).
              </Card.Body>
            </Card.Root>

            <Card.Root borderWidth="1px" borderColor="slate.200" bg="white" borderRadius="xl">
              <Card.Header pb={2} spaceY={1}>
                <Badge variant="outline" bg="brand.600" color="white" borderColor="brand.700" fontSize="10px" px={2} py={0.5} w="fit-content">
                  Stage 4
                </Badge>
                <Card.Title fontSize="sm" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2} mt={1}>
                  <Box color="brand.600" display="inline-flex"><Microscope className="h-4 w-4" /></Box>
                  Orders Agent
                </Card.Title>
              </Card.Header>
              <Card.Body fontSize="xs" color="slate.600" lineHeight="relaxed">
                Generates evidence-based laboratory (CBC, Lactate, Blood Gas) and diagnostic imaging orders (Chest X-Ray).
              </Card.Body>
            </Card.Root>

            <Card.Root borderWidth="1px" borderColor="slate.200" bg="white" borderRadius="xl">
              <Card.Header pb={2} spaceY={1}>
                <Badge variant="outline" bg="brand.800" color="white" borderColor="brand.900" fontSize="10px" px={2} py={0.5} w="fit-content">
                  Stage 5
                </Badge>
                <Card.Title fontSize="sm" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2} mt={1}>
                  <Box color="brand.700" display="inline-flex"><Eye className="h-4 w-4" /></Box>
                  Radiology Agent
                </Card.Title>
              </Card.Header>
              <Card.Body fontSize="xs" color="slate.600" lineHeight="relaxed">
                Multimodal vision agent processes uploaded Chest X-Rays, reporting consolidation, effusion, pneumothorax, and confidence.
              </Card.Body>
            </Card.Root>

            <Card.Root borderWidth="1px" borderColor="slate.200" bg="white" borderRadius="xl">
              <Card.Header pb={2} spaceY={1}>
                <Badge variant="outline" bg="brand.950" color="white" borderColor="brand.800" fontSize="10px" px={2} py={0.5} w="fit-content">
                  Stage 6
                </Badge>
                <Card.Title fontSize="sm" fontWeight="bold" color="slate.900" display="flex" alignItems="center" gap={2} mt={1}>
                  <Box color="brand.600" display="inline-flex"><Sparkles className="h-4 w-4" /></Box>
                  Synthesis Agent
                </Card.Title>
              </Card.Header>
              <Card.Body fontSize="xs" color="slate.600" lineHeight="relaxed">
                Synthesizes all clinical findings into a final differential diagnosis, working diagnosis, and formatted ED narrative report.
              </Card.Body>
            </Card.Root>
          </SimpleGrid>
        </VStack>

        {/* Section 2: Clinician Approval Gates */}
        <Box p={6} borderRadius="2xl" bg="white" borderWidth="1px" borderColor="slate.200/80" boxShadow="xs" spaceY={6}>
          <HStack gap={2}>
            <Box p={2} borderRadius="lg" bg="brand.100" color="brand.800">
              <FileCheck2 className="h-5 w-5" />
            </Box>
            <Box>
              <Heading size="md" fontWeight="bold" color="slate.900">Human-in-the-Loop Approval Gates</Heading>
              <Text fontSize="xs" color="slate.500">Why and when clinician intervention is required</Text>
            </Box>
          </HStack>

          <Text fontSize="xs" color="slate.600" lineHeight="relaxed">
            IbnSina enforces strict human supervision. The multi-agent pipeline pauses at <Text as="strong" fontWeight="bold">two critical clinical checkpoints</Text> where an attending physician or nurse practitioner must review, edit, approve, or reject recommendations before execution continues:
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
            <Box p={4} borderRadius="xl" borderWidth="1px" borderColor="brand.300" bg="brand.50" spaceY={2}>
              <Flex align="center" justify="space-between">
                <Text fontWeight="bold" color="brand.900" fontSize="xs" textTransform="uppercase" letterSpacing="wider">
                  Gate 1: Radiology Gate
                </Text>
                <Badge variant="outline" bg="brand.100" color="brand.900" borderColor="brand.300" fontSize="10px" px={2} py={0.5}>
                  Orders & Imaging Review
                </Badge>
              </Flex>
              <Text fontSize="xs" color="slate.700" lineHeight="relaxed">
                Appears after Stage 4 (Orders). Clinicians review requested lab orders, vitals, and upload optional Chest X-Ray JPEG/PNG images. Clicking <Text as="strong" fontWeight="bold">Approve & Proceed</Text> triggers the Radiology vision agent.
              </Text>
            </Box>

            <Box p={4} borderRadius="xl" borderWidth="1px" borderColor="brand.300" bg="brand.50" spaceY={2}>
              <Flex align="center" justify="space-between">
                <Text fontWeight="bold" color="brand.900" fontSize="xs" textTransform="uppercase" letterSpacing="wider">
                  Gate 2: Synthesis Gate
                </Text>
                <Badge variant="outline" bg="brand.100" color="brand.900" borderColor="brand.300" fontSize="10px" px={2} py={0.5}>
                  Final Assessment Review
                </Badge>
              </Flex>
              <Text fontSize="xs" color="slate.700" lineHeight="relaxed">
                Appears after Stage 5 (Radiology). Clinicians review the CXR read, image findings, and limitations before authorizing final synthesis. Approving this gate finalizes the ED report narrative and disposition.
              </Text>
            </Box>
          </SimpleGrid>
        </Box>

        {/* Section 3: Safety Principles */}
        <Box p={6} borderRadius="2xl" bg="white" borderWidth="1px" borderColor="slate.200/80" boxShadow="xs" spaceY={4}>
          <HStack gap={2}>
            <Box p={2} borderRadius="lg" bg="brand.100" color="brand.800">
              <Lock className="h-5 w-5" />
            </Box>
            <Heading size="md" fontWeight="bold" color="slate.900">Safety & Governance Principles</Heading>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} fontSize="xs">
            <Box p={3.5} borderRadius="xl" bg="slate.50" borderWidth="1px" borderColor="slate.200" spaceY={1}>
              <Text fontWeight="bold" color="slate.900" display="block">Deterministic Scoring</Text>
              <Text color="slate.600" lineHeight="relaxed">
                Severity (WHO classification & PIDS/IDSA guidelines) is calculated strictly via code rules, never LLM generated.
              </Text>
            </Box>

            <Box p={3.5} borderRadius="xl" bg="slate.50" borderWidth="1px" borderColor="slate.200" spaceY={1}>
              <Text fontWeight="bold" color="slate.900" display="block">Rule-Based Disposition</Text>
              <Text color="slate.600" lineHeight="relaxed">
                Patient disposition (Discharge, General Ward, PICU) is derived from deterministic severity thresholds.
              </Text>
            </Box>

            <Box p={3.5} borderRadius="xl" bg="slate.50" borderWidth="1px" borderColor="slate.200" spaceY={1}>
              <Text fontWeight="bold" color="slate.900" display="block">Immutable Audit Log</Text>
              <Text color="slate.600" lineHeight="relaxed">
                Every gate action, timestamp, approving clinician ID, and state mutation is logged persistently.
              </Text>
            </Box>
          </SimpleGrid>
        </Box>

        {/* Call to Action */}
        <Flex p={8} borderRadius="2xl" bg="brand.900" color="white" direction={{ base: "column", md: "row" }} align={{ md: "center" }} justify="space-between" gap={6} boxShadow="md">
          <Box spaceY={1}>
            <Heading size="lg" fontWeight="bold">Ready to explore active encounters?</Heading>
            <Text fontSize="xs" color="brand.200">
              Experience the multi-agent clinical workflow firsthand using synthetic patient scenarios.
            </Text>
          </Box>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Button
              size="md"
              bg="white"
              color="brand.950"
              _hover={{ bg: "slate.100" }}
              fontWeight="bold"
              fontSize="xs"
              borderRadius="xl"
              boxShadow="xs"
              flexShrink={0}
            >
              Open Tracking Board
              <Box color="brand.700" display="inline-flex"><ArrowRight className="h-4 w-4" /></Box>
            </Button>
          </Link>
        </Flex>
      </Box>

      {/* Footer */}
      <Box as="footer" borderTopWidth="1px" borderColor="slate.200" bg="white" py={4} px={6} textAlign="center" fontSize="xs" color="slate.400">
        IbnSina Clinical Decision Support Platform &bull; Paediatric Scope (Ages 1–5) &bull; Production Infrastructure
      </Box>
    </Box>
  );
}
