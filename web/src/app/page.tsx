"use client";

import Link from "next/link";
import {
  Box,
  Flex,
  HStack,
  Badge,
  Button,
  Heading,
  Text,
} from "@chakra-ui/react";
import { EncounterBoard } from "@/components/EncounterBoard";
import { Stethoscope, ShieldCheck, Activity, Info } from "lucide-react";

export default function Home() {
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

          <HStack gap={4}>
            <HStack gap={3}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <Button
                  size="sm"
                  bg="brand.700"
                  color="white"
                  _hover={{ bg: "brand.800" }}
                  fontSize="xs"
                  fontWeight="semibold"
                  boxShadow="xs"
                >
                  <Activity className="h-4 w-4" />
                  Tracking Board
                </Button>
              </Link>
              <Link href="/about" style={{ textDecoration: "none" }}>
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
                  <Box color="brand.600" display="inline-flex"><Info className="h-4 w-4" /></Box>
                  About &amp; Workflow
                </Button>
              </Link>
            </HStack>

            <Flex
              display={{ base: "none", lg: "flex" }}
              align="center"
              gap={2}
              fontSize="xs"
              color="slate.500"
              bg="slate.100/80"
              px={3}
              py={1.5}
              borderRadius="full"
              borderWidth="1px"
              borderColor="slate.200"
            >
              <Box color="brand.600" display="inline-flex"><ShieldCheck className="h-4 w-4" /></Box>
              <Text>Multi-Agent Diagnostic Supervision</Text>
            </Flex>
          </HStack>
        </Flex>
      </Box>

      {/* Main Content Area */}
      <Box as="main" flex="1" maxW="7xl" w="full" mx="auto" p={{ base: 6, md: 8 }}>
        <EncounterBoard />
      </Box>

      {/* Footer */}
      <Box as="footer" borderTopWidth="1px" borderColor="slate.200" bg="white" py={4} px={6} textAlign="center" fontSize="xs" color="slate.400">
        IbnSina Clinical Decision Support Platform &bull; Paediatric Scope (Ages 1–5) &bull; Production Infrastructure
      </Box>
    </Box>
  );
}
