import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { APPOINTMENT_REPOSITORY } from "../src/appointments/appointment.repository";
import { PostgresAppointmentRepository } from "../src/appointments/postgres-appointment.repository";
import { zonedLocalToUtc } from "../src/appointments/scheduling";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { BUSINESS_HOURS_REPOSITORY } from "../src/businesses/business-hours.repository";
import { PostgresBusinessHoursRepository } from "../src/businesses/postgres-business-hours.repository";
import { BUSINESS_REPOSITORY } from "../src/businesses/business.repository";
import { PostgresBusinessRepository } from "../src/businesses/postgres-business.repository";
import { CLIENT_REPOSITORY } from "../src/clients/client.repository";
import { PostgresClientRepository } from "../src/clients/postgres-client.repository";
import { PostgresServiceRepository } from "../src/services/postgres-service.repository";
import { SERVICE_REPOSITORY } from "../src/services/service.repository";
import { PostgresStaffRepository } from "../src/staff/postgres-staff.repository";
import { STAFF_REPOSITORY } from "../src/staff/staff.repository";
import { InMemoryAppointmentRepository } from "./in-memory-appointment.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { InMemoryBusinessHoursRepository } from "./in-memory-business-hours.repository";
import { InMemoryBusinessRepository } from "./in-memory-business.repository";
import { InMemoryClientRepository } from "./in-memory-client.repository";
import { InMemoryServiceRepository } from "./in-memory-service.repository";
import { InMemoryStaffRepository } from "./in-memory-staff.repository";

const TEST_DATE = "2030-07-02";
const CLOSED_TEST_DATE = "2030-07-06";

describe("AppointmentsController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(APPOINTMENT_REPOSITORY)
      .useValue(new InMemoryAppointmentRepository())
      .overrideProvider(PostgresAppointmentRepository)
      .useValue({})
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(new InMemoryAuthRepository())
      .overrideProvider(PostgresAuthRepository)
      .useValue({})
      .overrideProvider(BUSINESS_REPOSITORY)
      .useValue(new InMemoryBusinessRepository())
      .overrideProvider(PostgresBusinessRepository)
      .useValue({})
      .overrideProvider(BUSINESS_HOURS_REPOSITORY)
      .useValue(new InMemoryBusinessHoursRepository())
      .overrideProvider(PostgresBusinessHoursRepository)
      .useValue({})
      .overrideProvider(SERVICE_REPOSITORY)
      .useValue(new InMemoryServiceRepository())
      .overrideProvider(PostgresServiceRepository)
      .useValue({})
      .overrideProvider(STAFF_REPOSITORY)
      .useValue(new InMemoryStaffRepository())
      .overrideProvider(PostgresStaffRepository)
      .useValue({})
      .overrideProvider(CLIENT_REPOSITORY)
      .useValue(new InMemoryClientRepository())
      .overrideProvider(PostgresClientRepository)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it("creates, lists, views, cancels, and completes appointments for a business member", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });
    const startTime = buildStartTime(TEST_DATE, "10:00");

    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime
    });

    expect(appointment).toMatchObject({
      businessId: setup.business.id,
      clientDisplayName: "Jane Customer",
      clientId: customer.id,
      serviceDurationMinutes: 30,
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff Member",
      status: "BOOKED"
    });
    expect(appointment.endsAt).toBe(buildStartTime(TEST_DATE, "10:30"));

    const listResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(appointment.id);

    await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments/${appointment.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const secondAppointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "11:00")
    });

    const cancelResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${appointment.id}/cancel`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(cancelResponse.body.status).toBe("CANCELLED");

    const completeResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${secondAppointment.id}/complete`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(completeResponse.body.status).toBe("COMPLETED");
  });

  it("treats cancelled and completed appointments as terminal states", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });
    const cancelled = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });
    const completed = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "11:00")
    });

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${cancelled.id}/cancel`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${completed.id}/complete`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${cancelled.id}/complete`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${completed.id}/cancel`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(409);
  });

  it("runs the full happy path: slots disappear when booked and return after cancellation", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });

    const hoursResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/business-hours`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(hoursResponse.body).toHaveLength(7);

    const initialSlots = await fetchSlots(app, owner.accessToken, setup, TEST_DATE);
    const firstSlot = initialSlots[0];

    expect(firstSlot.startTime).toBe(buildStartTime(TEST_DATE, "09:00"));

    const appointmentResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: firstSlot.startTime
      })
      .expect(201);
    const appointment = appointmentResponse.body;

    expect(appointment.clientDisplayName).toBe("Jane Customer");

    const slotsAfterBooking = await fetchSlots(app, owner.accessToken, setup, TEST_DATE);

    expect(slotsAfterBooking.map((slot: { startTime: string }) => slot.startTime)).not.toContain(firstSlot.startTime);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${appointment.id}/cancel`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    const slotsAfterCancel = await fetchSlots(app, owner.accessToken, setup, TEST_DATE);

    expect(slotsAfterCancel.map((slot: { startTime: string }) => slot.startTime)).toContain(firstSlot.startTime);
  });

  it("allows adjacent bookings and same-time bookings for different staff", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const firstStaffUser = await registerAndGetIdentity(app, "first-staff@example.com");
    const secondStaffUser = await registerAndGetIdentity(app, "second-staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, firstStaffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });
    const secondStaffMember = await createStaffMember(app, owner.accessToken, setup.business.id, secondStaffUser.userId);

    await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    const adjacent = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:30")
    });

    expect(adjacent.status).toBe("BOOKED");

    const differentStaff = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: secondStaffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    expect(differentStaff.status).toBe("BOOKED");
  });

  it("rejects bookings outside business hours", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });

    const bookAt = (time: string) =>
      request(app.getHttpServer())
        .post(`/businesses/${setup.business.id}/appointments`)
        .set("authorization", `Bearer ${owner.accessToken}`)
        .send({
          clientId: customer.id,
          serviceId: setup.businessService.id,
          staffMemberId: setup.staffMember.id,
          startTime: buildStartTime(TEST_DATE, time)
        });

    await bookAt("08:30").expect(400); // before open
    await bookAt("17:30").expect(400); // after close
    await bookAt("16:45").expect(400); // 30-minute service would cross the 17:00 close
    await bookAt("16:30").expect(201); // last slot that fits exactly

    // Closed day is rejected outright
    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: buildStartTime(CLOSED_TEST_DATE, "10:00")
      })
      .expect(400);
  });

  it("rejects booking inactive services and staff", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/services/${setup.businessService.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
      .expect(400);

    const activeServiceResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/services`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ description: "Beard trim", durationMinutes: 15, name: "Beard", price: 5 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/staff/${setup.staffMember.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: activeServiceResponse.body.id,
        staffMemberId: setup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
      .expect(400);
  });

  it("snapshots a null service price for services without pricing", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });

    const freeServiceResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/services`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ description: "Free consultation", durationMinutes: 30, name: "Consultation" })
      .expect(201);

    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: freeServiceResponse.body.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    expect(appointment.servicePrice).toBeNull();
  });

  it("rejects appointments that start in the past", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: buildStartTime("2020-07-01", "10:00")
      })
      .expect(400);
  });

  it("computes end time from service duration and rejects overlapping bookings", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId, 10, "Beard");
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });

    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    expect(appointment.serviceDurationMinutes).toBe(10);
    expect(appointment.endsAt).toBe(buildStartTime(TEST_DATE, "10:10"));

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:05")
      })
      .expect(409);
  });

  it("returns available slots and none on closed days", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);

    const openDayResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/available-slots`)
      .query({
        date: TEST_DATE,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id
      })
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(openDayResponse.body.length).toBeGreaterThan(0);

    const closedDayResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/available-slots`)
      .query({
        date: CLOSED_TEST_DATE,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id
      })
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(closedDayResponse.body).toEqual([]);
  });

  it("keeps appointment snapshots unchanged after service and staff updates", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });
    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await request(app.getHttpServer())
      .patch(`/businesses/${setup.business.id}/services/${setup.businessService.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ durationMinutes: 45, name: "Premium Haircut", price: 25 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/businesses/${setup.business.id}/staff/${setup.staffMember.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "Updated Staff" })
      .expect(200);

    const detailsResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments/${appointment.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(detailsResponse.body).toMatchObject({
      serviceDurationMinutes: 30,
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff Member"
    });
  });

  it("rejects service and staff from a different business", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const firstStaffUser = await registerAndGetIdentity(app, "first-staff@example.com");
    const secondStaffUser = await registerAndGetIdentity(app, "second-staff@example.com");
    const firstSetup = await createBookableSetup(app, owner.accessToken, firstStaffUser.userId);
    const secondSetup = await createBookableSetup(app, owner.accessToken, secondStaffUser.userId);
    const customer = await createClient(app, owner.accessToken, firstSetup.business.id, {
      displayName: "Jane Customer"
    });

    await request(app.getHttpServer())
      .post(`/businesses/${firstSetup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: secondSetup.businessService.id,
        staffMemberId: firstSetup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/businesses/${firstSetup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: customer.id,
        serviceId: firstSetup.businessService.id,
        staffMemberId: secondSetup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
      .expect(404);
  });

  it("prevents users without business access from accessing or modifying appointments", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const other = await registerAndGetIdentity(app, "other@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });
    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: customer.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });

    await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${other.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${appointment.id}/cancel`)
      .set("authorization", `Bearer ${other.accessToken}`)
      .expect(404);
  });

  it("rejects unauthenticated creation and invalid input", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const customer = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Jane Customer"
    });

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .send({
        clientId: customer.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: "not-a-uuid",
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: "not-a-date"
      })
      .expect(400);
  });
});

async function registerAndGetIdentity(app: INestApplication, email: string): Promise<{ accessToken: string; userId: string }> {
  const response = await request(app.getHttpServer())
    .post("/auth/register")
    .set("x-forwarded-for", email)
    .send({ email, password: "strong-password" })
    .expect(201);

  return {
    accessToken: response.body.accessToken,
    userId: getSubjectFromJwt(response.body.accessToken)
  };
}

async function createBookableSetup(
  app: INestApplication,
  accessToken: string,
  staffUserId: string,
  durationMinutes = 30,
  serviceName = "Haircut"
) {
  const business = await createBusiness(app, accessToken, `Business ${staffUserId}`);
  const businessService = await createService(app, accessToken, business.id, durationMinutes, serviceName);
  const staffMember = await createStaffMember(app, accessToken, business.id, staffUserId);

  return { business, businessService, staffMember };
}

async function createBusiness(app: INestApplication, accessToken: string, name: string) {
  const response = await request(app.getHttpServer())
    .post("/businesses")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ businessType: "BARBER", name, timezone: "Asia/Amman" })
    .expect(201);

  return response.body;
}

async function createClient(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  body: { displayName: string; email?: string; phoneNumber?: string }
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/clients`)
    .set("authorization", `Bearer ${accessToken}`)
    .send(body)
    .expect(201);

  return response.body;
}

async function createService(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  durationMinutes: number,
  name: string
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/services`)
    .set("authorization", `Bearer ${accessToken}`)
    .send({ description: "Classic haircut", durationMinutes, name, price: 15 })
    .expect(201);

  return response.body;
}

async function createStaffMember(app: INestApplication, accessToken: string, businessId: string, userId: string) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/staff`)
    .set("authorization", `Bearer ${accessToken}`)
    .send({ displayName: "Staff Member", userId })
    .expect(201);

  return response.body;
}

async function fetchSlots(
  app: INestApplication,
  accessToken: string,
  setup: { business: { id: string }; businessService: { id: string }; staffMember: { id: string } },
  date: string
) {
  const response = await request(app.getHttpServer())
    .get(`/businesses/${setup.business.id}/available-slots`)
    .query({
      date,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id
    })
    .set("authorization", `Bearer ${accessToken}`)
    .expect(200);

  return response.body;
}

async function createAppointment(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  body: {
    clientId: string;
    serviceId: string;
    staffMemberId: string;
    startTime: string;
  }
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/appointments`)
    .set("authorization", `Bearer ${accessToken}`)
    .send(body)
    .expect(201);

  return response.body;
}

function buildStartTime(date: string, time: string): string {
  return zonedLocalToUtc(`${date}T${time}:00`, "Asia/Amman").toISOString();
}

function getSubjectFromJwt(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decodedPayload.sub;
}
