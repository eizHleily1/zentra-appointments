import { randomUUID } from "node:crypto";
import { InMemoryAppointmentRepository } from "./in-memory-appointment.repository";
import { InMemoryBookingVerificationRepository } from "./in-memory-booking-verification.repository";
import { InMemoryClientRepository } from "./in-memory-client.repository";
import { InMemoryGuestBookingRepository } from "./in-memory-guest-booking.repository";

const GUEST = {
  businessId: "business-1",
  displayName: "Maria Lopez",
  normalizedDisplayName: "maria lopez",
  normalizedPhone: "5551234567",
  phoneNumber: "555-123-4567"
};

function appointmentWrite(id: string, startsAt: string, endsAt: string) {
  return {
    businessId: GUEST.businessId,
    endsAt: new Date(endsAt),
    id,
    serviceDurationMinutes: 30,
    serviceId: "service-1",
    serviceName: "Haircut",
    servicePrice: 15,
    staffDisplayName: "Alex",
    staffMemberId: "staff-1",
    startsAt: new Date(startsAt)
  };
}

async function createVerifiedChallenge(
  verificationRepository: InMemoryBookingVerificationRepository,
  overrides: { normalizedPhone?: string } = {}
): Promise<string> {
  const verification = verificationRepository.seedVerification({
    attemptsRemaining: 5,
    businessId: GUEST.businessId,
    codeHash: "hashed-code",
    expiresAt: new Date(Date.now() + 300_000),
    id: randomUUID(),
    normalizedPhone: overrides.normalizedPhone ?? GUEST.normalizedPhone
  });

  await verificationRepository.markVerificationVerified(verification.id);

  return verification.id;
}

describe("InMemoryGuestBookingRepository", () => {
  let clientRepository: InMemoryClientRepository;
  let appointmentRepository: InMemoryAppointmentRepository;
  let verificationRepository: InMemoryBookingVerificationRepository;
  let repository: InMemoryGuestBookingRepository;

  beforeEach(() => {
    clientRepository = new InMemoryClientRepository();
    appointmentRepository = new InMemoryAppointmentRepository();
    verificationRepository = new InMemoryBookingVerificationRepository();
    repository = new InMemoryGuestBookingRepository(
      clientRepository,
      appointmentRepository,
      verificationRepository
    );
  });

  it("rolls back a newly created guest client when appointment creation fails", async () => {
    const verificationId = await createVerifiedChallenge(verificationRepository);
    jest.spyOn(appointmentRepository, "createAppointment").mockRejectedValue(new Error("slot conflict"));

    await expect(
      repository.createGuestBooking({
        appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
        guest: GUEST,
        verificationId
      })
    ).rejects.toThrow("slot conflict");

    expect(clientRepository.getClients()).toEqual([]);
  });

  it("keeps the verification usable when appointment creation fails", async () => {
    const verificationId = await createVerifiedChallenge(verificationRepository);
    const createAppointment = jest
      .spyOn(appointmentRepository, "createAppointment")
      .mockRejectedValueOnce(new Error("slot conflict"));

    await expect(
      repository.createGuestBooking({
        appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
        guest: GUEST,
        verificationId
      })
    ).rejects.toThrow("slot conflict");

    createAppointment.mockRestore();

    const retried = await repository.createGuestBooking({
      appointment: appointmentWrite("appointment-2", "2030-07-02T08:00:00.000Z", "2030-07-02T08:30:00.000Z"),
      guest: GUEST,
      verificationId
    });

    expect(retried.appointment.id).toBe("appointment-2");
  });

  it("leaves an existing guest client unchanged when appointment creation fails", async () => {
    const existing = await clientRepository.createClient({
      businessId: GUEST.businessId,
      displayName: GUEST.displayName,
      email: null,
      id: "client-1",
      linkedUserId: null,
      phoneNumber: GUEST.phoneNumber
    });
    const verificationId = await createVerifiedChallenge(verificationRepository);
    jest.spyOn(appointmentRepository, "createAppointment").mockRejectedValue(new Error("slot conflict"));

    await expect(
      repository.createGuestBooking({
        appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
        guest: GUEST,
        verificationId
      })
    ).rejects.toThrow("slot conflict");

    expect(clientRepository.getClients()).toEqual([existing]);
  });

  it("rejects a booking whose verification was never verified", async () => {
    const verification = verificationRepository.seedVerification({
      attemptsRemaining: 5,
      businessId: GUEST.businessId,
      codeHash: "hashed-code",
      expiresAt: new Date(Date.now() + 300_000),
      id: randomUUID(),
      normalizedPhone: GUEST.normalizedPhone
    });

    await expect(
      repository.createGuestBooking({
        appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
        guest: GUEST,
        verificationId: verification.id
      })
    ).rejects.toThrow("Verify your phone number before booking");

    expect(clientRepository.getClients()).toEqual([]);
  });

  it("consumes a verification exactly once", async () => {
    const verificationId = await createVerifiedChallenge(verificationRepository);

    await repository.createGuestBooking({
      appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
      guest: GUEST,
      verificationId
    });

    await expect(
      repository.createGuestBooking({
        appointment: appointmentWrite("appointment-2", "2030-07-02T08:00:00.000Z", "2030-07-02T08:30:00.000Z"),
        guest: GUEST,
        verificationId
      })
    ).rejects.toThrow("Verify your phone number before booking");
  });

  it("rejects a verification issued for a different phone number", async () => {
    const verificationId = await createVerifiedChallenge(verificationRepository, {
      normalizedPhone: "5559998888"
    });

    await expect(
      repository.createGuestBooking({
        appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
        guest: GUEST,
        verificationId
      })
    ).rejects.toThrow("Verify your phone number before booking");
  });

  it("never reuses a linked client and creates a separate guest identity instead", async () => {
    const linked = await clientRepository.createClient({
      businessId: GUEST.businessId,
      displayName: GUEST.displayName,
      email: null,
      id: "client-linked",
      linkedUserId: "user-1",
      phoneNumber: GUEST.phoneNumber
    });
    const verificationId = await createVerifiedChallenge(verificationRepository);

    const booked = await repository.createGuestBooking({
      appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
      guest: GUEST,
      verificationId
    });

    expect(booked.client.id).not.toBe(linked.id);
    expect(booked.client.linkedUserId).toBeNull();
    expect(clientRepository.getClients()).toHaveLength(2);
  });

  it("reuses an existing unlinked guest client", async () => {
    const existing = await clientRepository.createClient({
      businessId: GUEST.businessId,
      displayName: GUEST.displayName,
      email: null,
      id: "client-1",
      linkedUserId: null,
      phoneNumber: GUEST.phoneNumber
    });
    const verificationId = await createVerifiedChallenge(verificationRepository);

    const booked = await repository.createGuestBooking({
      appointment: appointmentWrite("appointment-1", "2030-07-02T07:00:00.000Z", "2030-07-02T07:30:00.000Z"),
      guest: GUEST,
      verificationId
    });

    expect(booked.client.id).toBe(existing.id);
    expect(clientRepository.getClients()).toHaveLength(1);
  });
});
