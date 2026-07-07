import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { APPOINTMENT_REPOSITORY } from "../src/appointments/appointment.repository";
import { PostgresAppointmentRepository } from "../src/appointments/postgres-appointment.repository";
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

describe("DiscoveryController", () => {
  let app: INestApplication;
  let businessRepository: InMemoryBusinessRepository;
  let clientRepository: InMemoryClientRepository;

  beforeEach(async () => {
    businessRepository = new InMemoryBusinessRepository();
    clientRepository = new InMemoryClientRepository();

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
      .useValue(businessRepository)
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
      .useValue(clientRepository)
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

  it("allows anonymous users to browse discovery", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const barber = await createBusiness(app, owner.accessToken, "Downtown Barber", "BARBER");
    activateBusiness(businessRepository, barber.id);

    await request(app.getHttpServer()).get("/discovery/businesses").query({ category: "BARBER" }).expect(200);

    await request(app.getHttpServer()).get(`/discovery/businesses/${barber.id}`).expect(200);
  });

  it("lists active businesses by category and search", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const consumer = await registerAndGetIdentity(app, "consumer@example.com");
    const barber = await createBusiness(app, owner.accessToken, "Downtown Barber", "BARBER");
    const salon = await createBusiness(app, owner.accessToken, "Glow Beauty", "SALON");

    activateBusiness(businessRepository, barber.id, { city: "Amman", address: "123 Main St" });
    activateBusiness(businessRepository, salon.id, { city: "Tel Aviv" });

    const barberList = await request(app.getHttpServer())
      .get("/discovery/businesses")
      .query({ category: "BARBER" })
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .expect(200);

    expect(barberList.body).toEqual([
      expect.objectContaining({
        businessType: "BARBER",
        city: "Amman",
        id: barber.id,
        name: "Downtown Barber"
      })
    ]);
    expect(barberList.body[0]).not.toHaveProperty("status");
    expect(barberList.body[0]).not.toHaveProperty("initialOwnerUserId");

    const searchResults = await request(app.getHttpServer())
      .get("/discovery/businesses")
      .query({ search: "glow" })
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .expect(200);

    expect(searchResults.body).toEqual([
      expect.objectContaining({
        id: salon.id,
        name: "Glow Beauty"
      })
    ]);
  });

  it("returns business profile with active services and staff only", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const consumer = await registerAndGetIdentity(app, "consumer@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    activateBusiness(businessRepository, setup.business.id);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/services/${setup.businessService.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    const activeService = await createService(app, owner.accessToken, setup.business.id, 45, "Beard Trim");
    const profile = await request(app.getHttpServer())
      .get(`/discovery/businesses/${setup.business.id}`)
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .expect(200);

    expect(profile.body).toMatchObject({
      id: setup.business.id,
      isBookable: true,
      name: setup.business.name,
      businessType: "BARBER"
    });
    expect(profile.body.services).toEqual([
      expect.objectContaining({
        id: activeService.id,
        name: "Beard Trim"
      })
    ]);
    expect(profile.body.staff).toEqual([
      expect.objectContaining({
        displayName: "Staff Member",
        id: setup.staffMember.id
      })
    ]);
    expect(profile.body.staff[0]).not.toHaveProperty("userId");
    expect(profile.body.businessHours).toHaveLength(7);
  });

  it("marks profile as not bookable when active services or staff are missing", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    activateBusiness(businessRepository, setup.business.id);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/services/${setup.businessService.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/staff/${setup.staffMember.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    const profile = await request(app.getHttpServer())
      .get(`/discovery/businesses/${setup.business.id}`)
      .expect(200);

    expect(profile.body.isBookable).toBe(false);
    expect(profile.body.services).toEqual([]);
    expect(profile.body.staff).toEqual([]);
  });

  it("creates linked client on self-book and rejects spoofed clientId", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const consumer = await registerAndGetIdentity(app, "consumer@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    activateBusiness(businessRepository, setup.business.id);

    const slots = await fetchConsumerSlots(app, consumer.accessToken, setup, TEST_DATE);
    const appointment = await request(app.getHttpServer())
      .post(`/discovery/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .send({
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: slots[0].startTime
      })
      .expect(201);

    expect(appointment.body.clientDisplayName).toBe("consumer");

    const linkedClient = await clientRepository.findClientByLinkedUserIdForBusiness(
      setup.business.id,
      consumer.userId
    );

    expect(linkedClient).toMatchObject({
      displayName: "consumer",
      linkedUserId: consumer.userId
    });
    expect(appointment.body.clientId).toBe(linkedClient?.id);

    await request(app.getHttpServer())
      .post(`/discovery/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .send({
        clientId: linkedClient?.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: slots[1].startTime
      })
      .expect(400);
  });

  it("returns only the authenticated user's linked-client appointments", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const consumer = await registerAndGetIdentity(app, "consumer@example.com");
    const otherConsumer = await registerAndGetIdentity(app, "other-consumer@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId, 30, "Haircut", "Prime Barber");
    activateBusiness(businessRepository, setup.business.id);

    const slots = await fetchConsumerSlots(app, consumer.accessToken, setup, TEST_DATE);
    await request(app.getHttpServer())
      .post(`/discovery/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .send({
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: slots[0].startTime
      })
      .expect(201);

    const otherSlots = await fetchConsumerSlots(app, otherConsumer.accessToken, setup, TEST_DATE);
    await request(app.getHttpServer())
      .post(`/discovery/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${otherConsumer.accessToken}`)
      .send({
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: otherSlots[0].startTime
      })
      .expect(201);

    const myAppointments = await request(app.getHttpServer())
      .get("/me/appointments")
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .expect(200);

    expect(myAppointments.body).toHaveLength(1);
    expect(myAppointments.body[0]).toMatchObject({
      businessCity: null,
      businessName: "Prime Barber",
      clientDisplayName: "consumer",
      serviceName: "Haircut",
      staffDisplayName: "Staff Member"
    });

    const appointmentId = myAppointments.body[0].id;
    const detailsResponse = await request(app.getHttpServer())
      .get(`/me/appointments/${appointmentId}`)
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .expect(200);

    expect(detailsResponse.body).toMatchObject({
      businessName: "Prime Barber",
      id: appointmentId,
      serviceName: "Haircut"
    });

    await request(app.getHttpServer())
      .get(`/me/appointments/${appointmentId}`)
      .set("authorization", `Bearer ${otherConsumer.accessToken}`)
      .expect(404);

    await request(app.getHttpServer()).get("/me/appointments").expect(401);
  });

  it("keeps tenant isolation for discovery profile and booking", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const consumer = await registerAndGetIdentity(app, "consumer@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    activateBusiness(businessRepository, setup.business.id);

    const otherOwner = await registerAndGetIdentity(app, "other-owner@example.com");
    const otherBusiness = await createBusiness(app, otherOwner.accessToken, "Hidden Shop", "BARBER");

    await request(app.getHttpServer())
      .get(`/discovery/businesses/${otherBusiness.id}`)
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .expect(404);

    const slots = await fetchConsumerSlots(app, consumer.accessToken, setup, TEST_DATE);
    await request(app.getHttpServer())
      .post(`/discovery/businesses/${otherBusiness.id}/appointments`)
      .set("authorization", `Bearer ${consumer.accessToken}`)
      .send({
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: slots[0].startTime
      })
      .expect(404);
  });
});

function activateBusiness(
  repository: InMemoryBusinessRepository,
  businessId: string,
  location?: { address?: string; city?: string }
): void {
  repository.setBusinessStatus(businessId, "ACTIVE");

  if (location?.address || location?.city) {
    void repository.updateBusiness(businessId, {
      address: location.address ?? null,
      city: location.city ?? null
    });
  }
}

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
  serviceName = "Haircut",
  businessName = "Business"
) {
  const business = await createBusiness(app, accessToken, businessName, "BARBER");
  const businessService = await createService(app, accessToken, business.id, durationMinutes, serviceName);
  const staffMember = await createStaffMember(app, accessToken, business.id, staffUserId);

  return { business, businessService, staffMember };
}

async function createBusiness(
  app: INestApplication,
  accessToken: string,
  name: string,
  businessType: string
) {
  const response = await request(app.getHttpServer())
    .post("/businesses")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ businessType, name, timezone: "Asia/Amman" })
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
    .send({ description: "Service", durationMinutes, name, price: 15 })
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

async function fetchConsumerSlots(
  app: INestApplication,
  accessToken: string,
  setup: { business: { id: string }; businessService: { id: string }; staffMember: { id: string } },
  date: string
) {
  const response = await request(app.getHttpServer())
    .get(`/discovery/businesses/${setup.business.id}/available-slots`)
    .query({
      date,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id
    })
    .set("authorization", `Bearer ${accessToken}`)
    .expect(200);

  return response.body;
}

function getSubjectFromJwt(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decodedPayload.sub;
}
