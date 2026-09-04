import { InMemoryAppointmentRepository } from "./in-memory-appointment.repository";
import { InMemoryClientRepository } from "./in-memory-client.repository";
import { InMemoryGuestBookingRepository } from "./in-memory-guest-booking.repository";

describe("InMemoryGuestBookingRepository", () => {
  it("rolls back a newly created guest client when appointment creation fails", async () => {
    const clientRepository = new InMemoryClientRepository();
    const appointmentRepository = new InMemoryAppointmentRepository();
    jest.spyOn(appointmentRepository, "createAppointment").mockRejectedValue(new Error("slot conflict"));
    const repository = new InMemoryGuestBookingRepository(clientRepository, appointmentRepository);

    await expect(
      repository.createGuestBooking({
        appointment: {
          businessId: "business-1",
          endsAt: new Date("2030-07-02T07:30:00.000Z"),
          id: "appointment-1",
          serviceDurationMinutes: 30,
          serviceId: "service-1",
          serviceName: "Haircut",
          servicePrice: 15,
          staffDisplayName: "Alex",
          staffMemberId: "staff-1",
          startsAt: new Date("2030-07-02T07:00:00.000Z")
        },
        guest: {
          businessId: "business-1",
          displayName: "Maria Lopez",
          normalizedDisplayName: "maria lopez",
          normalizedPhone: "5551234567",
          phoneNumber: "555-123-4567"
        }
      })
    ).rejects.toThrow("slot conflict");

    expect(clientRepository.getClients()).toEqual([]);
  });

  it("leaves an existing guest client unchanged when appointment creation fails", async () => {
    const clientRepository = new InMemoryClientRepository();
    const appointmentRepository = new InMemoryAppointmentRepository();
    const existing = await clientRepository.createClient({
      businessId: "business-1",
      displayName: "Maria Lopez",
      email: null,
      id: "client-1",
      linkedUserId: null,
      phoneNumber: "555-123-4567"
    });
    jest.spyOn(appointmentRepository, "createAppointment").mockRejectedValue(new Error("slot conflict"));
    const repository = new InMemoryGuestBookingRepository(clientRepository, appointmentRepository);

    await expect(
      repository.createGuestBooking({
        appointment: {
          businessId: "business-1",
          endsAt: new Date("2030-07-02T07:30:00.000Z"),
          id: "appointment-1",
          serviceDurationMinutes: 30,
          serviceId: "service-1",
          serviceName: "Haircut",
          servicePrice: 15,
          staffDisplayName: "Alex",
          staffMemberId: "staff-1",
          startsAt: new Date("2030-07-02T07:00:00.000Z")
        },
        guest: {
          businessId: "business-1",
          displayName: "Maria Lopez",
          normalizedDisplayName: "maria lopez",
          normalizedPhone: "5551234567",
          phoneNumber: "555-123-4567"
        }
      })
    ).rejects.toThrow("slot conflict");

    expect(clientRepository.getClients()).toEqual([existing]);
  });
});
