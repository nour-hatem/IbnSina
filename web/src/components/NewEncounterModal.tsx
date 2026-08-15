"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  HStack,
  VStack,
  SimpleGrid,
  Button,
  Text,
  Input,
  Textarea,
  NativeSelect,
  Field,
  Dialog,
} from "@chakra-ui/react";
import { createEncounter, ApiError } from "@/lib/api";
import { Plus, Loader2, AlertCircle } from "lucide-react";

interface NewEncounterModalProps {
  onCreated?: () => void;
}

export function NewEncounterModal({ onCreated }: NewEncounterModalProps) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [ageUnit, setAgeUnit] = useState<"years" | "months">("years");
  const [sex, setSex] = useState<"male" | "female" | "other">("male");
  const [chiefComplaint, setChiefComplaint] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFullName("");
    setAge("");
    setAgeUnit("years");
    setSex("male");
    setChiefComplaint("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !age || !chiefComplaint.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    const numAge = Number(age);
    if (isNaN(numAge) || numAge <= 0) {
      setError("Please enter a valid age.");
      return;
    }

    const ageInMonths = ageUnit === "years" ? numAge * 12 : numAge;

    // Structured, deterministic registration string preventing intake agent parse bugs
    const rawRegistration = `${fullName.trim()}, ${numAge} ${ageUnit} old (${ageInMonths} months), ${sex} child presenting with chief complaint: ${chiefComplaint.trim()}`;

    try {
      setLoading(true);
      setError(null);
      await createEncounter({ raw_registration: rawRegistration });
      setOpen(false);
      resetForm();
      if (onCreated) {
        onCreated();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create encounter. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => { setOpen(e.open); if (!e.open) resetForm(); }}>
      <Dialog.Trigger asChild>
        <Button
          size="sm"
          bg="brand.700"
          color="white"
          _hover={{ bg: "brand.800" }}
          fontWeight="semibold"
          boxShadow="xs"
        >
          <Plus className="h-4 w-4" />
          New Encounter
        </Button>
      </Dialog.Trigger>

      <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />

      <Dialog.Positioner>
        <Dialog.Content bg="white" borderRadius="xl" borderWidth="1px" borderColor="slate.200" p={6} maxW="480px" w="full" boxShadow="xl">
          <Dialog.Header spaceY={1} pb={2}>
            <Dialog.Title fontSize="lg" fontWeight="bold" color="slate.900">
              Register Paediatric Encounter
            </Dialog.Title>
            <Dialog.Description fontSize="xs" color="slate.500">
              Enter patient details to initialize multi-agent triage and diagnostic supervision.
            </Dialog.Description>
          </Dialog.Header>

          <form onSubmit={handleSubmit}>
            <VStack align="stretch" gap={4} pt={2}>
              {error && (
                <Flex p={3} borderRadius="lg" bg="brand.50" borderWidth="1px" borderColor="brand.300" color="brand.900" fontSize="xs" align="center" gap={2}>
                  <Box color="brand.700" display="inline-flex" flexShrink={0}><AlertCircle className="h-4 w-4" /></Box>
                  <Text fontSize="xs">{error}</Text>
                </Flex>
              )}

              {/* Full Name */}
              <Field.Root spaceY={1.5}>
                <Field.Label htmlFor="fullName" fontSize="xs" fontWeight="semibold" color="slate.700">
                  Patient Full Name *
                </Field.Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Tariq Al-Mansoor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  size="sm"
                  borderColor="slate.200"
                  _focus={{ borderColor: "brand.500" }}
                  required
                />
              </Field.Root>

              {/* Age & Unit */}
              <SimpleGrid columns={3} gap={3}>
                <Field.Root gridColumn="span 2" spaceY={1.5}>
                  <Field.Label htmlFor="age" fontSize="xs" fontWeight="semibold" color="slate.700">
                    Age *
                  </Field.Label>
                  <Input
                    id="age"
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g. 3"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    disabled={loading}
                    size="sm"
                    borderColor="slate.200"
                    _focus={{ borderColor: "brand.500" }}
                    required
                  />
                </Field.Root>

                <Field.Root spaceY={1.5}>
                  <Field.Label htmlFor="ageUnit" fontSize="xs" fontWeight="semibold" color="slate.700">
                    Unit
                  </Field.Label>
                  <NativeSelect.Root size="sm" disabled={loading}>
                    <NativeSelect.Field
                      id="ageUnit"
                      value={ageUnit}
                      onChange={(e) => setAgeUnit(e.target.value as "years" | "months")}
                      borderColor="slate.200"
                      _focus={{ borderColor: "brand.500" }}
                    >
                      <option value="years">Years</option>
                      <option value="months">Months</option>
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>
              </SimpleGrid>

              {/* Sex */}
              <Field.Root spaceY={1.5}>
                <Field.Label htmlFor="sex" fontSize="xs" fontWeight="semibold" color="slate.700">
                  Biological Sex *
                </Field.Label>
                <NativeSelect.Root size="sm" disabled={loading}>
                  <NativeSelect.Field
                    id="sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value as "male" | "female" | "other")}
                    borderColor="slate.200"
                    _focus={{ borderColor: "brand.500" }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field.Root>

              {/* Chief Complaint */}
              <Field.Root spaceY={1.5}>
                <Field.Label htmlFor="chiefComplaint" fontSize="xs" fontWeight="semibold" color="slate.700">
                  Chief Complaint &amp; Symptoms *
                </Field.Label>
                <Textarea
                  id="chiefComplaint"
                  placeholder="e.g. 3-day history of high fever (39°C), persistent cough, and mild shortness of breath."
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  disabled={loading}
                  rows={3}
                  size="sm"
                  borderColor="slate.200"
                  _focus={{ borderColor: "brand.500" }}
                  required
                />
              </Field.Root>

              <Dialog.Footer pt={2} display="flex" justifyContent="flex-end" gap={2}>
                <Button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  color="slate.600"
                  _hover={{ bg: "slate.100" }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  size="sm"
                  bg="brand.700"
                  color="white"
                  _hover={{ bg: "brand.800" }}
                  fontWeight="semibold"
                >
                  {loading ? (
                    <HStack gap={2}>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <Text>Creating...</Text>
                    </HStack>
                  ) : (
                    "Initialize Encounter"
                  )}
                </Button>
              </Dialog.Footer>
            </VStack>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
